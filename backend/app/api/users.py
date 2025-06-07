from fastapi import APIRouter, Depends, Form, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime

from ..database import get_db
from ..models.user import User, Tenant
from ..core.security import get_current_user

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def ensure_default_tenant(db: Session) -> Tenant:
    """Garante que existe um tenant padrão"""
    default_tenant = db.query(Tenant).filter(Tenant.subdomain == "default").first()
    if not default_tenant:
        default_tenant = Tenant(
            name="Tenant Padrão",
            subdomain="default",
            is_active=True
        )
        db.add(default_tenant)
        db.commit()
        db.refresh(default_tenant)
    return default_tenant

def ensure_user_has_tenant(user: User, db: Session) -> User:
    """Garante que o usuário tem um tenant_id"""
    if not user.tenant_id:
        default_tenant = ensure_default_tenant(db)
        user.tenant_id = default_tenant.id
        db.commit()
        db.refresh(user)
    return user

@router.put("/change-password")
async def change_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Alterar senha do usuário atual"""
    try:
        # Verificar senha atual
        if not pwd_context.verify(current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Senha atual incorreta"
            )
        
        # Validar nova senha
        if len(new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nova senha deve ter pelo menos 6 caracteres"
            )
        
        # Atualizar senha
        current_user.hashed_password = pwd_context.hash(new_password)
        db.commit()
        
        return {"message": "Senha alterada com sucesso"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao alterar senha: {str(e)}"
        )

@router.put("/profile")
async def update_profile(
    full_name: str = Form(...),
    email: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualizar perfil do usuário atual"""
    try:
        # Verificar se email já existe (se diferente do atual)
        if email != current_user.email:
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Este email já está em uso"
                )
        
        # Atualizar dados
        current_user.full_name = full_name
        current_user.email = email
        db.commit()
        
        return {
            "message": "Perfil atualizado com sucesso",
            "user": {
                "id": current_user.id,
                "email": current_user.email,
                "full_name": current_user.full_name,
                "is_active": current_user.is_active
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao atualizar perfil: {str(e)}"
        )

@router.get("/tenant/users")
async def get_tenant_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar usuários do tenant atual"""
    try:
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário deve estar associado a um tenant"
            )
        
        users = db.query(User).filter(
            User.tenant_id == current_user.tenant_id,
            User.is_active == True
        ).all()
        
        return [
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat(),
                "is_admin": user.id == current_user.id  # Verificar se é o próprio usuário
            }
            for user in users
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao listar usuários: {str(e)}"
        )

@router.post("/tenant/invite")
async def invite_user_to_tenant(
    email: str = Form(...),
    full_name: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Convidar usuário para o tenant atual"""
    try:
        # Verificar se usuário tem tenant_id
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário deve estar associado a um tenant"
            )
        
        # Validar dados de entrada
        email = email.strip() if email else ""
        full_name = full_name.strip() if full_name else ""
        
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email é obrigatório"
            )
        
        if not full_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nome completo é obrigatório"
            )
        
        # Verificar se usuário já existe
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            if existing_user.tenant_id == current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Usuário já faz parte deste tenant"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Este email já está associado a outro tenant"
                )
        
        # Criar novo usuário com senha temporária
        temp_password = "temp123456"  # Em produção, gerar senha aleatória
        new_user = User(
            email=email,
            full_name=full_name,
            hashed_password=pwd_context.hash(temp_password),
            tenant_id=current_user.tenant_id,
            is_active=True,
            is_global_admin=False
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return {
            "message": "Usuário convidado com sucesso",
            "temp_password": temp_password,
            "user": {
                "id": new_user.id,
                "email": new_user.email,
                "full_name": new_user.full_name
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao convidar usuário: {str(e)}"
        )

@router.delete("/tenant/remove/{user_id}")
async def remove_user_from_tenant(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remover usuário do tenant atual"""
    try:
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário deve estar associado a um tenant"
            )
        
        # Buscar usuário a ser removido
        user_to_remove = db.query(User).filter(User.id == user_id).first()
        if not user_to_remove:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado"
            )
        
        # Verificar se o usuário pertence ao mesmo tenant
        if user_to_remove.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuário não pertence ao seu tenant"
            )
        
        # Não permitir que o usuário remova a si mesmo
        if user_to_remove.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Você não pode remover a si mesmo da equipe"
            )
        
        # Remover o usuário (inativar ao invés de deletar para manter histórico)
        user_to_remove.is_active = False
        db.commit()
        
        return {
            "message": f"Usuário {user_to_remove.full_name} removido da equipe com sucesso"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao remover usuário: {str(e)}"
        )

@router.get("/debug/test")
async def debug_test():
    """Endpoint de teste para verificar se o módulo users está carregando"""
    return {
        "status": "ok",
        "message": "Módulo users está funcionando!",
        "endpoints": [
            "/users/change-password",
            "/users/profile", 
            "/users/tenant/users",
            "/users/tenant/invite",
            "/users/tenant/remove/{user_id}"
        ]
    } 