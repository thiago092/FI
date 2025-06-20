from pydantic import BaseModel, Field, validator
from typing import Optional, Literal
from datetime import datetime

class NotificationPreferenceBase(BaseModel):
    """Schema base para preferências de notificação"""
    notification_type: Literal['daily', 'weekly', 'monthly'] = Field(..., description="Tipo de notificação")
    notification_hour: int = Field(..., ge=0, le=23, description="Hora da notificação (0-23)")
    day_of_week: Optional[int] = Field(None, ge=0, le=6, description="Dia da semana (0=domingo)")
    day_of_month: Optional[int] = Field(None, ge=1, le=28, description="Dia do mês (1-28)")
    
    # Configurações de conteúdo
    include_balance: bool = True
    include_transactions: bool = True
    include_categories: bool = True
    include_insights: bool = True
    is_active: bool = True

    @validator('day_of_week')
    def validate_weekly_config(cls, v, values):
        """Valida se day_of_week está presente quando type é weekly"""
        if values.get('notification_type') == 'weekly' and v is None:
            raise ValueError('day_of_week é obrigatório para notificações semanais')
        return v

    @validator('day_of_month')
    def validate_monthly_config(cls, v, values):
        """Valida se day_of_month está presente quando type é monthly"""
        if values.get('notification_type') == 'monthly' and v is None:
            raise ValueError('day_of_month é obrigatório para notificações mensais')
        return v

class NotificationPreferenceCreate(NotificationPreferenceBase):
    """Schema para criação de preferência de notificação"""
    # telegram_user_id será preenchido automaticamente pela API
    telegram_user_id: Optional[int] = Field(None, description="ID do usuário no Telegram (preenchido automaticamente)")

class NotificationPreferenceUpdate(NotificationPreferenceBase):
    """Schema para atualização de preferência de notificação"""
    notification_type: Optional[Literal['daily', 'weekly', 'monthly']] = None
    notification_hour: Optional[int] = Field(None, ge=0, le=23)
    telegram_user_id: Optional[int] = None

class NotificationPreferenceResponse(NotificationPreferenceBase):
    """Schema para resposta com preferência de notificação"""
    id: int
    tenant_id: int
    telegram_user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True 