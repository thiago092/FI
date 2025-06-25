from pydantic import BaseModel, EmailStr, validator
from typing import Optional

class UserRegister(BaseModel):
    """Schema para registro de novo usuário"""
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str
    
    @validator('full_name')
    def validate_full_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Nome completo deve ter pelo menos 2 caracteres')
        return v.strip()
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Senha deve ter pelo menos 6 caracteres')
        return v
    
    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Senhas não coincidem')
        return v

class UserRegisterWithInvite(BaseModel):
    """Schema para registro com convite"""
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str
    invite_token: str
    
    @validator('full_name')
    def validate_full_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Nome completo deve ter pelo menos 2 caracteres')
        return v.strip()
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Senha deve ter pelo menos 8 caracteres')
        if not any(c.isupper() for c in v):
            raise ValueError('Senha deve conter pelo menos uma letra maiúscula')
        if not any(c.islower() for c in v):
            raise ValueError('Senha deve conter pelo menos uma letra minúscula')
        if not any(c.isdigit() for c in v):
            raise ValueError('Senha deve conter pelo menos um número')
        return v
    
    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Senhas não coincidem')
        return v

class InviteRequest(BaseModel):
    """Schema para solicitar convite"""
    email: EmailStr
    full_name: str

class InviteResponse(BaseModel):
    """Resposta do convite"""
    message: str
    invite_sent: bool

class EmailVerificationRequest(BaseModel):
    """Schema para solicitar reenvio de email de verificação"""
    email: EmailStr

class EmailVerificationConfirm(BaseModel):
    """Schema para confirmar verificação de email"""
    token: str

class PasswordResetRequest(BaseModel):
    """Schema para solicitar recuperação de senha"""
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    """Schema para confirmar nova senha"""
    token: str
    new_password: str
    confirm_password: str
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Senha deve ter pelo menos 8 caracteres')
        if not any(c.isupper() for c in v):
            raise ValueError('Senha deve conter pelo menos uma letra maiúscula')
        if not any(c.islower() for c in v):
            raise ValueError('Senha deve conter pelo menos uma letra minúscula')
        if not any(c.isdigit() for c in v):
            raise ValueError('Senha deve conter pelo menos um número')
        return v
    
    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Senhas não coincidem')
        return v

class RegisterResponse(BaseModel):
    """Resposta do registro"""
    message: str
    email: str
    verification_sent: bool

class VerificationResponse(BaseModel):
    """Resposta da verificação"""
    message: str
    verified: bool

class PasswordResetResponse(BaseModel):
    """Resposta da recuperação de senha"""
    message: str 