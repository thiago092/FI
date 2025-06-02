from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from ..database import Base

class TelegramUser(Base):
    __tablename__ = "telegram_users"
    
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(String, unique=True, index=True, nullable=False)  # ID do usuário no Telegram
    telegram_username = Column(String, nullable=True)  # Username do Telegram (@usuario)
    telegram_first_name = Column(String, nullable=True)  # Primeiro nome do usuário
    telegram_last_name = Column(String, nullable=True)  # Último nome do usuário
    
    # Associação com usuário da aplicação
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Pode ser null até autenticar
    is_authenticated = Column(Boolean, default=False)  # Se o usuário já se autenticou
    auth_code = Column(String, nullable=True)  # Código temporário para autenticação
    auth_code_expires = Column(DateTime, nullable=True)  # Expiração do código
    
    # Configurações do bot
    is_active = Column(Boolean, default=True)
    language = Column(String, default="pt-BR")
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_interaction = Column(DateTime, server_default=func.now())
    
    # Relacionamentos
    user = relationship("User", back_populates="telegram_users")
    
    def __repr__(self):
        return f"<TelegramUser(telegram_id={self.telegram_id}, user_id={self.user_id}, authenticated={self.is_authenticated})>" 