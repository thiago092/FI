from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from ..database import Base

class EmailVerificationToken(Base):
    """Tokens para verificação de email, recuperação de senha e convites"""
    __tablename__ = "email_verification_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable para convites
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)  # Para convites
    token = Column(String(255), unique=True, nullable=False, index=True)
    token_type = Column(String(50), nullable=False)  # "email_verification", "password_reset", "invite"
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    user = relationship("User", back_populates="verification_tokens")
    tenant = relationship("Tenant", back_populates="invite_tokens")
    
    def is_expired(self) -> bool:
        """Verificar se o token expirou"""
        return datetime.utcnow() > self.expires_at
    
    def is_valid(self) -> bool:
        """Verificar se o token é válido (não usado e não expirado)"""
        return not self.used and not self.is_expired()
    
    @classmethod
    def create_email_verification_token(cls, user_id: int, token: str):
        """Criar token de verificação de email (24 horas)"""
        from ..core.config import settings
        return cls(
            user_id=user_id,
            token=token,
            token_type="email_verification",
            expires_at=datetime.utcnow() + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS)
        )
    
    @classmethod
    def create_password_reset_token(cls, user_id: int, token: str):
        """Criar token de recuperação de senha (1 hora)"""
        return cls(
            user_id=user_id,
            token=token,
            token_type="password_reset",
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )
    
    @classmethod
    def create_invite_token(cls, tenant_id: int, token: str, invited_email: str):
        """Criar token de convite (7 dias)"""
        return cls(
            tenant_id=tenant_id,
            token=token,
            token_type="invite",
            expires_at=datetime.utcnow() + timedelta(days=7)
        ) 