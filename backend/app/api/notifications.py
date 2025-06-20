from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging

from ..database import get_db
from ..core.security import get_current_user, get_current_tenant_id, get_current_admin_user
from ..models.user import User
from ..models.notification import NotificationPreference
from ..schemas.notification import (
    NotificationPreferenceCreate,
    NotificationPreferenceUpdate,
    NotificationPreferenceResponse
)

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)

@router.get("/preferences", response_model=List[NotificationPreferenceResponse])
async def get_notification_preferences(
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

@router.get("/preferences/{notification_type}", response_model=NotificationPreferenceResponse)
async def get_notification_preference_by_type(
    notification_type: str,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Buscar preferência específica por tipo (daily, weekly, monthly)"""
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
        
        return preference
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar preferência {notification_type}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.post("/preferences", response_model=NotificationPreferenceResponse)
async def create_notification_preference(
    preference_data: NotificationPreferenceCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Criar nova preferência de notificação"""
    try:
        # Verificar se já existe preferência deste tipo para o usuário
        existing = db.query(NotificationPreference).filter(
            NotificationPreference.tenant_id == tenant_id,
            NotificationPreference.notification_type == preference_data.notification_type
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Já existe preferência de notificação {preference_data.notification_type}"
            )
        
        # Criar nova preferência
        preference = NotificationPreference(
            tenant_id=tenant_id,
            **preference_data.dict()
        )
        
        db.add(preference)
        db.commit()
        db.refresh(preference)
        
        logger.info(f"✅ Preferência {preference_data.notification_type} criada para tenant {tenant_id}")
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

@router.put("/preferences/{notification_type}", response_model=NotificationPreferenceResponse)
async def update_notification_preference(
    notification_type: str,
    preference_data: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Atualizar preferência de notificação existente"""
    try:
        # Buscar preferência existente
        preference = db.query(NotificationPreference).filter(
            NotificationPreference.tenant_id == tenant_id,
            NotificationPreference.notification_type == notification_type
        ).first()
        
        if not preference:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Preferência {notification_type} não encontrada"
            )
        
        # Atualizar campos fornecidos
        update_data = preference_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(preference, field, value)
        
        db.commit()
        db.refresh(preference)
        
        logger.info(f"✅ Preferência {notification_type} atualizada para tenant {tenant_id}")
        return preference
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar preferência: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.delete("/preferences/{notification_type}")
async def delete_notification_preference(
    notification_type: str,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Deletar preferência de notificação"""
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
        
        logger.info(f"✅ Preferência {notification_type} deletada para tenant {tenant_id}")
        return {"message": f"Preferência {notification_type} deletada com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao deletar preferência: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.patch("/preferences/{notification_type}/toggle")
async def toggle_notification_preference(
    notification_type: str,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Ativar/desativar preferência de notificação"""
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
        
        # Alternar status
        preference.is_active = not preference.is_active
        db.commit()
        db.refresh(preference)
        
        status_text = "ativada" if preference.is_active else "desativada"
        logger.info(f"✅ Preferência {notification_type} {status_text} para tenant {tenant_id}")
        
        return {
            "message": f"Preferência {notification_type} {status_text}",
            "is_active": preference.is_active
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao alternar preferência: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.post("/test/{notification_type}")
async def test_notification(
    notification_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Enviar notificação de teste para o usuário"""
    try:
        from ..services.notification_service import notification_service
        
        # Validar tipo de notificação
        if notification_type not in ['daily', 'weekly', 'monthly']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tipo de notificação inválido. Use: daily, weekly ou monthly"
            )
        
        # Enviar notificação de teste
        success = await notification_service.send_test_notification(
            db, current_user.id, notification_type
        )
        
        if success:
            return {
                "success": True,
                "message": f"Notificação de teste ({notification_type}) enviada com sucesso!"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falha ao enviar notificação de teste"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao enviar notificação de teste: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.post("/process-now")
async def process_notifications_now(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Processar notificações agora (endpoint para admin)"""
    try:
        from ..services.notification_service import notification_service
        
        await notification_service.process_notifications(db)
        
        return {
            "success": True,
            "message": "Processamento de notificações executado com sucesso"
        }
        
    except Exception as e:
        logger.error(f"Erro ao processar notificações: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        ) 