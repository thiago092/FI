from sqlalchemy import Column, Integer, String, Boolean, BigInteger, DateTime
from sqlalchemy.sql import func
from ..database import Base

class NotificationPreference(Base):
    """Modelo para preferências de notificação dos usuários"""
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    telegram_user_id = Column(BigInteger, nullable=False)
    
    # Configurações de notificação
    notification_type = Column(String(20), nullable=False)  # 'daily', 'weekly', 'monthly'
    notification_hour = Column(Integer, nullable=False)  # 0-23
    day_of_week = Column(Integer, nullable=True)  # 0-6 (só para weekly)
    day_of_month = Column(Integer, nullable=True)  # 1-28 (só para monthly)
    
    # Configurações de conteúdo
    include_balance = Column(Boolean, default=True)
    include_transactions = Column(Boolean, default=True)
    include_categories = Column(Boolean, default=True)
    include_insights = Column(Boolean, default=True)
    
    # Controle
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<NotificationPreference(id={self.id}, tenant_id={self.tenant_id}, type={self.notification_type}, hour={self.notification_hour})>" 