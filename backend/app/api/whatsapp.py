from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from typing import Dict, Any
from pydantic import BaseModel
from ..database import get_db
from ..services.whatsapp_service import WhatsAppService
from ..core.security import get_current_user
from ..models.user import User
from ..models.whatsapp_user import WhatsAppUser
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class WhatsAppAuthRequest(BaseModel):
    auth_code: str

@router.get("/webhook")
async def whatsapp_webhook_verify(
    request: Request,
    hub_mode: str = Query(alias="hub.mode"),
    hub_challenge: str = Query(alias="hub.challenge"),
    hub_verify_token: str = Query(alias="hub.verify_token")
):
    """Verificação do webhook do WhatsApp (Meta)"""
    try:
        logger.info(f"📱 Verificação webhook WhatsApp: mode={hub_mode}, token={hub_verify_token}")
        
        whatsapp_service = WhatsAppService()
        
        if hub_mode == "subscribe":
            challenge = whatsapp_service.verify_webhook(hub_verify_token, hub_challenge)
            if challenge:
                logger.info("✅ Webhook WhatsApp verificado com sucesso!")
                return int(challenge)  # WhatsApp espera número inteiro
            else:
                logger.error("❌ Token de verificação inválido")
                raise HTTPException(status_code=403, detail="Token de verificação inválido")
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"❌ Erro na verificação do webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def whatsapp_webhook_receive(request: Request, db: Session = Depends(get_db)):
    """Receber mensagens do WhatsApp via webhook"""
    try:
        webhook_data = await request.json()
        logger.info(f"📱 Webhook WhatsApp recebido: {webhook_data}")
        
        whatsapp_service = WhatsAppService()
        # TODO: Implementar process_webhook no WhatsAppService
        
        logger.info(f"📱 Webhook processado com sucesso")
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"❌ Erro no webhook WhatsApp: {e}")
        return {"status": "error", "message": str(e)}

@router.post("/authenticate")
async def authenticate_whatsapp(
    request: WhatsAppAuthRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Autenticar usuário do WhatsApp com código"""
    try:
        whatsapp_service = WhatsAppService()
        whatsapp_user = whatsapp_service.authenticate_user(db, request.auth_code, current_user)
        
        if whatsapp_user:
            # Enviar confirmação via WhatsApp
            await whatsapp_service.send_message(
                whatsapp_user.phone_number,
                f"✅ *Conta vinculada com sucesso!*\n\n"
                f"Olá, {current_user.full_name}! Sua conta está agora vinculada ao WhatsApp.\n\n"
                f"💬 Agora você pode enviar mensagens e fotos para gerenciar suas finanças!"
            )
            
            return {
                "success": True,
                "message": "Conta WhatsApp vinculada com sucesso!",
                "whatsapp_user": {
                    "name": whatsapp_user.whatsapp_name,
                    "phone": whatsapp_user.phone_number
                }
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código inválido ou expirado"
            )
            
    except Exception as e:
        logger.error(f"Erro na autenticação WhatsApp: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.get("/status")
async def whatsapp_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verificar status da integração com WhatsApp"""
    whatsapp_user = db.query(WhatsAppUser).filter(
        WhatsAppUser.user_id == current_user.id,
        WhatsAppUser.is_authenticated == True
    ).first()
    
    if whatsapp_user:
        return {
            "connected": True,
            "whatsapp_info": {
                "name": whatsapp_user.whatsapp_name,
                "phone": whatsapp_user.phone_number,
                "last_interaction": whatsapp_user.last_interaction.isoformat() if whatsapp_user.last_interaction else None
            }
        }
    else:
        return {"connected": False}

@router.delete("/disconnect")
async def disconnect_whatsapp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Desconectar conta do WhatsApp"""
    whatsapp_user = db.query(WhatsAppUser).filter(
        WhatsAppUser.user_id == current_user.id,
        WhatsAppUser.is_authenticated == True
    ).first()
    
    if whatsapp_user:
        # Notificar no WhatsApp
        whatsapp_service = WhatsAppService()
        await whatsapp_service.send_message(
            whatsapp_user.phone_number,
            "❌ *Conta desvinculada*\n\nSua conta foi desvinculada do FinançasAI.\n\n"
            "Para vincular novamente, envie qualquer mensagem."
        )
        
        # Desautenticar
        whatsapp_user.is_authenticated = False
        whatsapp_user.user_id = None
        db.commit()
        
        return {"success": True, "message": "Conta WhatsApp desvinculada com sucesso!"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma conta WhatsApp encontrada"
        )

@router.post("/test-message")
async def send_test_message(
    message: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enviar mensagem de teste para o WhatsApp do usuário"""
    whatsapp_user = db.query(WhatsAppUser).filter(
        WhatsAppUser.user_id == current_user.id,
        WhatsAppUser.is_authenticated == True
    ).first()
    
    if not whatsapp_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma conta WhatsApp vinculada"
        )
    
    whatsapp_service = WhatsAppService()
    success = await whatsapp_service.send_message(whatsapp_user.phone_number, message)
    
    if success:
        return {"success": True, "message": "Mensagem enviada com sucesso!"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao enviar mensagem"
        ) 