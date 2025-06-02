from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# Tenant Schemas
class TenantBase(BaseModel):
    name: str
    subdomain: str

class TenantCreate(TenantBase):
    pass

class TenantResponse(TenantBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str
    tenant_id: Optional[int] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    is_global_admin: bool
    tenant_id: Optional[int] = None
    created_at: datetime
    tenant: Optional[TenantResponse] = None
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse 