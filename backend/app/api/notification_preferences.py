from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging

from ..database import get_db
from ..core.security import get_current_tenant_id, get_current_user
from ..models.notification import NotificationPreference
from ..models.telegram_user import TelegramUser
from ..models.user import User
from ..schemas.notification import (
    NotificationPreferenceCreate,
    NotificationPreferenceUpdate,
    NotificationPreferenceResponse
)

router = APIRouter(prefix="/notification-preferences", tags=["notification-preferences"])
logger = logging.getLogger(__name__)

def get_user_telegram_id(db: Session, user: User) -> int:
    """Buscar telegram_id do usuário autenticado"""
    telegram_user = db.query(TelegramUser).filter(
        TelegramUser.user_id == user.id,
        TelegramUser.is_authenticated == True
    ).first()
    
    if not telegram_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram não vinculado. Vincule sua conta do Telegram primeiro."
        )
    
    return int(telegram_user.telegram_id)

@router.get("/", response_model=List[NotificationPreferenceResponse])
async def get_preferences(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Buscar todas as preferências de notificação do usuário"""
    try:
        preferences = db.query(NotificationPreference).filter(
            NotificationPreference.tenant_id == tenant_id
        ).all()
        
        return preferences
        
    except Exception as e:
        logger.error(f"Erro ao buscar preferências: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.post("/", response_model=NotificationPreferenceResponse)
async def create_preference(
    preference_data: NotificationPreferenceCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user)
):
    """Criar nova preferência de notificação"""
    try:
        # Buscar telegram_id automaticamente
        telegram_user_id = get_user_telegram_id(db, current_user)
        
        # Verificar se já existe
        existing = db.query(NotificationPreference).filter(
            NotificationPreference.tenant_id == tenant_id,
            NotificationPreference.notification_type == preference_data.notification_type
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Já existe preferência {preference_data.notification_type}"
            )
        
        # Criar nova com telegram_id automático
        preference_dict = preference_data.dict()
        preference_dict['telegram_user_id'] = telegram_user_id
        
        preference = NotificationPreference(
            tenant_id=tenant_id,
            **preference_dict
        )
        
        db.add(preference)
        db.commit()
        db.refresh(preference)
        
        return preference
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar preferência: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.put("/{notification_type}", response_model=NotificationPreferenceResponse)
async def update_preference(
    notification_type: str,
    preference_data: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user)
):
    """Atualizar preferência existente"""
    try:
        # Buscar telegram_id automaticamente
        telegram_user_id = get_user_telegram_id(db, current_user)
        
        preference = db.query(NotificationPreference).filter(
            NotificationPreference.tenant_id == tenant_id,
            NotificationPreference.notification_type == notification_type
        ).first()
        
        if not preference:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Preferência {notification_type} não encontrada"
            )
        
        # Atualizar (garantindo que telegram_user_id seja sempre atualizado)
        update_data = preference_data.dict(exclude_unset=True)
        update_data['telegram_user_id'] = telegram_user_id
        
        for field, value in update_data.items():
            setattr(preference, field, value)
        
        db.commit()
        db.refresh(preference)
        
        return preference
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.delete("/{notification_type}")
async def delete_preference(
    notification_type: str,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Deletar preferência"""
    try:
        preference = db.query(NotificationPreference).filter(
            NotificationPreference.tenant_id == tenant_id,
            NotificationPreference.notification_type == notification_type
        ).first()
        
        if not preference:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Preferência {notification_type} não encontrada"
            )
        
        db.delete(preference)
        db.commit()
        
        return {"message": f"Preferência {notification_type} deletada"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao deletar: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.get("/telegram-status")
async def telegram_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verificar se o usuário tem Telegram vinculado"""
    try:
        telegram_user = db.query(TelegramUser).filter(
            TelegramUser.user_id == current_user.id,
            TelegramUser.is_authenticated == True
        ).first()
        
        if telegram_user:
            return {
                "connected": True,
                "telegram_id": telegram_user.telegram_id,
                "username": telegram_user.telegram_username,
                "first_name": telegram_user.telegram_first_name,
                "last_interaction": telegram_user.last_interaction
            }
        else:
            return {
                "connected": False,
                "message": "Telegram não vinculado. Vá para Configurações > Telegram para vincular."
            }
            
    except Exception as e:
        logger.error(f"Erro ao verificar status do Telegram: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        ) 