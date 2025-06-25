from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User, Tenant
from ..models.email_verification import EmailVerificationToken
from ..schemas.user import UserLogin, Token, UserCreate, UserResponse, TenantCreate, TenantResponse
from ..schemas.auth import (
    UserRegister, UserRegisterWithInvite, RegisterResponse, EmailVerificationRequest, EmailVerificationConfirm, 
    VerificationResponse, PasswordResetRequest, PasswordResetConfirm, PasswordResetResponse,
    InviteRequest, InviteResponse
)
from ..core.security import verify_password, create_access_token, get_password_hash, get_current_admin_user, get_current_user
from ..core.config import settings
from ..services.email_service import email_service
import logging
import secrets
import string

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/login", response_model=Token)
async def login(request: Request, db: Session = Depends(get_db)):
    # Tentar obter dados como FormData primeiro
    try:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")
    except Exception:
        # Se falhar, tentar como JSON
        try:
            json_data = await request.json()
            username = json_data.get("email") or json_data.get("username")
            password = json_data.get("password")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid request format. Expected form data or JSON with email/username and password"
            )
    
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Username/email and password are required"
        )
    
    user = db.query(User).filter(User.email == username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive"
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.from_orm(user)
    )

@router.post("/admin/tenants", response_model=TenantResponse)
def create_tenant(
    tenant_data: TenantCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    # Verificar se já existe tenant com mesmo nome ou subdomínio
    existing_tenant = db.query(Tenant).filter(
        (Tenant.name == tenant_data.name) | (Tenant.subdomain == tenant_data.subdomain)
    ).first()
    
    if existing_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant with this name or subdomain already exists"
        )
    
    tenant = Tenant(**tenant_data.dict())
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    
    return TenantResponse.from_orm(tenant)

@router.post("/admin/users", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    # Verificar se usuário já existe
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Verificar se tenant existe (se fornecido)
    if user_data.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == user_data.tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
    
    # Criar usuário
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        tenant_id=user_data.tenant_id
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return UserResponse.from_orm(user)

@router.get("/admin/tenants", response_model=list[TenantResponse])
def list_tenants(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    tenants = db.query(Tenant).all()
    return [TenantResponse.from_orm(tenant) for tenant in tenants]

@router.get("/admin/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    users = db.query(User).all()
    return [UserResponse.from_orm(user) for user in users]

# ================================
# NOVOS ENDPOINTS PÚBLICOS
# ================================

def generate_token(length: int = 32) -> str:
    """Gerar token seguro"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

@router.post("/register", response_model=RegisterResponse)
async def register_user(user_data: UserRegister, db: Session = Depends(get_db)):
    """Registro público de novos usuários"""
    try:
        # Verificar se usuário já existe (incluindo inativos)
        existing_user = db.query(User).filter(User.email == user_data.email.lower()).first()
        if existing_user:
            # Se já existe mas não está verificado, dar opção de reenviar
            if not existing_user.email_verified:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Este email já foi cadastrado mas não verificado. Verifique sua caixa de entrada ou solicite reenvio da verificação."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Este email já está cadastrado. Tente fazer login ou recuperar sua senha."
                )
        
        # 1. Primeiro criar o usuário temporariamente
        hashed_password = get_password_hash(user_data.password)
        new_user = User(
            email=user_data.email.lower(),
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            is_active=False,  # Usuário fica inativo até verificar email
            email_verified=False,
            tenant_id=None  # Será definido após criar o tenant
        )
        
        db.add(new_user)
        db.flush()  # Flush para obter o ID do usuário
        
        # 2. Criar tenant automático para o usuário
        tenant_name = f"{user_data.full_name.split()[0]}'s Workspace"  # Ex: "João's Workspace"
        tenant_subdomain = f"user{new_user.id}"  # Ex: "user123"
        
        new_tenant = Tenant(
            name=tenant_name,
            subdomain=tenant_subdomain,
            is_active=True
        )
        
        db.add(new_tenant)
        db.flush()  # Flush para obter o ID do tenant
        
        # 3. Associar usuário ao tenant criado
        new_user.tenant_id = new_tenant.id
        
        # 4. Commit das mudanças
        db.commit()
        db.refresh(new_user)
        db.refresh(new_tenant)
        
        # Gerar token de verificação
        verification_token = generate_token()
        token_record = EmailVerificationToken.create_email_verification_token(
            user_id=new_user.id,
            token=verification_token
        )
        
        db.add(token_record)
        db.commit()
        
        # Enviar email de verificação
        email_sent = email_service.send_email_verification(
            email=new_user.email,
            full_name=new_user.full_name,
            verification_token=verification_token
        )
        
        logger.info(f"Usuário registrado: {new_user.email} - Email enviado: {email_sent}")
        
        return RegisterResponse(
            message="Cadastro realizado com sucesso! Verifique seu email para ativar a conta.",
            email=new_user.email,
            verification_sent=email_sent
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Erro no registro: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor. Tente novamente."
        )

@router.post("/verify-email", response_model=VerificationResponse)
async def verify_email(verification_data: EmailVerificationConfirm, db: Session = Depends(get_db)):
    """Verificar email com token"""
    try:
        # Buscar token
        token_record = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.token == verification_data.token,
            EmailVerificationToken.token_type == "email_verification"
        ).first()
        
        if not token_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token de verificação inválido."
            )
        
        if not token_record.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token de verificação expirado ou já utilizado."
            )
        
        # Ativar usuário
        user = db.query(User).filter(User.id == token_record.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário não encontrado."
            )
        
        user.is_active = True
        user.email_verified = True
        token_record.used = True
        
        db.commit()
        
        logger.info(f"Email verificado com sucesso: {user.email}")
        
        return VerificationResponse(
            message="Email verificado com sucesso! Sua conta está ativa.",
            verified=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Erro na verificação: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor. Tente novamente."
        )

@router.post("/resend-verification", response_model=RegisterResponse)
async def resend_verification(request_data: EmailVerificationRequest, db: Session = Depends(get_db)):
    """Reenviar email de verificação"""
    try:
        # Buscar usuário
        user = db.query(User).filter(User.email == request_data.email.lower()).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email não encontrado."
            )
        
        if user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este email já foi verificado."
            )
        
        # Invalidar tokens anteriores
        old_tokens = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.token_type == "email_verification",
            EmailVerificationToken.used == False
        ).all()
        
        for token in old_tokens:
            token.used = True
        
        # Gerar novo token
        verification_token = generate_token()
        token_record = EmailVerificationToken.create_email_verification_token(
            user_id=user.id,
            token=verification_token
        )
        
        db.add(token_record)
        db.commit()
        
        # Enviar email
        email_sent = email_service.send_email_verification(
            email=user.email,
            full_name=user.full_name,
            verification_token=verification_token
        )
        
        return RegisterResponse(
            message="Email de verificação reenviado.",
            email=user.email,
            verification_sent=email_sent
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Erro no reenvio: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor. Tente novamente."
        )

@router.post("/forgot-password", response_model=PasswordResetResponse)
async def forgot_password(request_data: PasswordResetRequest, db: Session = Depends(get_db)):
    """Solicitar recuperação de senha"""
    try:
        # Buscar usuário
        user = db.query(User).filter(User.email == request_data.email.lower()).first()
        if not user:
            # Por segurança, sempre retornar sucesso mesmo se email não existir
            return PasswordResetResponse(
                message="Se o email existir, você receberá instruções para recuperar sua senha."
            )
        
        # Invalidar tokens anteriores
        old_tokens = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.token_type == "password_reset",
            EmailVerificationToken.used == False
        ).all()
        
        for token in old_tokens:
            token.used = True
        
        # Gerar novo token
        reset_token = generate_token()
        token_record = EmailVerificationToken.create_password_reset_token(
            user_id=user.id,
            token=reset_token
        )
        
        db.add(token_record)
        db.commit()
        
        # Enviar email
        email_sent = email_service.send_password_reset(
            email=user.email,
            full_name=user.full_name,
            reset_token=reset_token
        )
        
        logger.info(f"Recuperação de senha solicitada: {user.email} - Email enviado: {email_sent}")
        
        return PasswordResetResponse(
            message="Se o email existir, você receberá instruções para recuperar sua senha."
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Erro na recuperação: {str(e)}")
        # Por segurança, sempre retornar sucesso
        return PasswordResetResponse(
            message="Se o email existir, você receberá instruções para recuperar sua senha."
        )

@router.post("/reset-password", response_model=PasswordResetResponse)
async def reset_password(reset_data: PasswordResetConfirm, db: Session = Depends(get_db)):
    """Confirmar nova senha"""
    try:
        # Buscar token
        token_record = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.token == reset_data.token,
            EmailVerificationToken.token_type == "password_reset"
        ).first()
        
        if not token_record or not token_record.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token de recuperação inválido ou expirado."
            )
        
        # Buscar usuário
        user = db.query(User).filter(User.id == token_record.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário não encontrado."
            )
        
        # Atualizar senha
        user.hashed_password = get_password_hash(reset_data.new_password)
        token_record.used = True
        
        db.commit()
        
        logger.info(f"Senha redefinida com sucesso: {user.email}")
        
        return PasswordResetResponse(
            message="Senha redefinida com sucesso! Faça login com sua nova senha."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Erro na redefinição: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor. Tente novamente."
        )

@router.post("/test-email")
async def test_email(db: Session = Depends(get_db)):
    """Endpoint de teste para verificar se o email está funcionando"""
    try:
        # Testar envio de email
        test_email_sent = email_service.send_email_verification(
            email="thiago.augustocarvalho@gmail.com",
            full_name="Teste",
            verification_token="test-token-123"
        )
        
        return {
            "message": "Teste de email executado",
            "email_sent": test_email_sent,
            "config": {
                "mail_server": settings.MAIL_SERVER,
                "mail_port": settings.MAIL_PORT,
                "mail_username": settings.MAIL_USERNAME,
                "mail_from": settings.MAIL_FROM,
                "mail_tls": settings.MAIL_TLS,
                "mail_ssl": settings.MAIL_SSL
            }
        }
    except Exception as e:
        logger.error(f"Erro no teste de email: {str(e)}")
        return {
            "message": "Erro no teste de email",
            "error": str(e),
            "config": {
                "mail_server": settings.MAIL_SERVER,
                "mail_port": settings.MAIL_PORT,
                "mail_username": settings.MAIL_USERNAME,
                "mail_from": settings.MAIL_FROM,
                "mail_tls": settings.MAIL_TLS,
                "mail_ssl": settings.MAIL_SSL
            }
        }

@router.post("/invite", response_model=InviteResponse)
async def invite_user_to_tenant(
    invite_data: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Convidar usuário para o tenant atual via email"""
    try:
        # Verificar se usuário tem tenant_id
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário deve estar associado a um tenant"
            )
        
        # Verificar se usuário já existe
        existing_user = db.query(User).filter(User.email == invite_data.email.lower()).first()
        if existing_user:
            if existing_user.tenant_id == current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Este usuário já faz parte da sua equipe"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Este email já está associado a outro workspace"
                )
        
        # Buscar tenant
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant não encontrado"
            )
        
        # Invalidar convites anteriores para este email
        old_invites = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.token_type == "invite",
            EmailVerificationToken.used == False
        ).all()
        
        for invite in old_invites:
            invite.used = True
        
        # Gerar token de convite
        invite_token = generate_token()
        token_record = EmailVerificationToken.create_invite_token(
            tenant_id=current_user.tenant_id,
            token=invite_token
        )
        
        db.add(token_record)
        db.commit()
        
        # Enviar email de convite
        email_sent = email_service.send_team_invite(
            email=invite_data.email,
            full_name=invite_data.full_name,
            inviter_name=current_user.full_name,
            tenant_name=tenant.name,
            invite_token=invite_token
        )
        
        logger.info(f"Convite enviado: {invite_data.email} para tenant {tenant.name} - Email enviado: {email_sent}")
        
        return InviteResponse(
            message="Convite enviado com sucesso! O usuário receberá um email com instruções.",
            invite_sent=email_sent
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Erro no convite: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor. Tente novamente."
        )

@router.post("/register-with-invite", response_model=RegisterResponse)
async def register_with_invite(user_data: UserRegisterWithInvite, db: Session = Depends(get_db)):
    """Registro com convite - associa automaticamente ao tenant"""
    try:
        # Verificar se usuário já existe
        existing_user = db.query(User).filter(User.email == user_data.email.lower()).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este email já está cadastrado. Tente fazer login ou recuperar sua senha."
            )
        
        # Validar token de convite
        invite_token = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.token == user_data.invite_token,
            EmailVerificationToken.token_type == "invite"
        ).first()
        
        if not invite_token or not invite_token.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token de convite inválido ou expirado."
            )
        
        # Buscar tenant
        tenant = db.query(Tenant).filter(Tenant.id == invite_token.tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workspace não encontrado."
            )
        
        # Criar usuário
        hashed_password = get_password_hash(user_data.password)
        new_user = User(
            email=user_data.email.lower(),
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            tenant_id=invite_token.tenant_id,
            is_active=True,
            email_verified=True  # Usuário convidado já é considerado verificado
        )
        
        db.add(new_user)
        db.flush()  # Flush para obter o ID do usuário
        
        # Invalidar token de convite
        invite_token.used = True
        
        # Gerar token de verificação (opcional, para manter consistência)
        verification_token = generate_token()
        token_record = EmailVerificationToken.create_email_verification_token(
            user_id=new_user.id,
            token=verification_token
        )
        
        db.add(token_record)
        db.commit()
        
        logger.info(f"Usuário registrado com convite: {new_user.email} no tenant {tenant.name}")
        
        return RegisterResponse(
            message="Cadastro realizado com sucesso! Você já pode fazer login.",
            email=new_user.email,
            verification_sent=False  # Não precisa verificar email
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Erro no registro com convite: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor. Tente novamente."
        ) 