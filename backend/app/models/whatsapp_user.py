from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from ..database import Base

class WhatsAppUser(Base):
    __tablename__ = "whatsapp_users"
    
    id = Column(Integer, primary_key=True, index=True)
    whatsapp_id = Column(String, unique=True, index=True, nullable=False)  # ID do usuário no WhatsApp
    phone_number = Column(String, nullable=False)  # Número de telefone do usuário
    whatsapp_name = Column(String, nullable=True)  # Nome do usuário no WhatsApp
    
    # Associação com usuário da aplicação
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Pode ser null até autenticar
    is_authenticated = Column(Boolean, default=False)  # Se o usuário já se autenticou
    auth_code = Column(String, nullable=True)  # Código temporário para autenticação
    auth_code_expires = Column(DateTime, nullable=True)  # Expiração do código
    
    # Configurações do bot
    is_active = Column(Boolean, default=True)
    language = Column(String, default="pt-BR")
    
    # Metadados do WhatsApp
    profile_name = Column(String, nullable=True)  # Nome do perfil
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_interaction = Column(DateTime, server_default=func.now())
    
    # Relacionamentos
    user = relationship("User", back_populates="whatsapp_users")
    
    def __repr__(self):
        return f"<WhatsAppUser(whatsapp_id={self.whatsapp_id}, phone={self.phone_number}, user_id={self.user_id}, authenticated={self.is_authenticated})>" 