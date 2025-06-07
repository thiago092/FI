from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User, Tenant
from ..schemas.user import UserLogin, Token, UserCreate, UserResponse, TenantCreate, TenantResponse
from ..core.security import verify_password, create_access_token, get_password_hash, get_current_admin_user
from ..core.config import settings
import logging

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