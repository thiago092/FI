from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from typing import Dict, Any
from pydantic import BaseModel
from ..database import get_db
from ..services.whatsapp_service import WhatsAppService
from ..core.security import get_current_user
from ..models.user import User
from ..models.whatsapp_user import WhatsAppUser
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class WhatsAppAuthRequest(BaseModel):
    auth_code: str

class WhatsAppPhoneRequest(BaseModel):
    phone_number: str

class WhatsAppVerifyRequest(BaseModel):
    phone_number: str
    verification_code: str

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
        logger.info(f"📱 Token esperado: {settings.WHATSAPP_VERIFY_TOKEN}")
        
        # Verificar se o token está configurado
        expected_token = settings.WHATSAPP_VERIFY_TOKEN
        if not expected_token:
            logger.error("❌ WHATSAPP_VERIFY_TOKEN não está configurado!")
            raise HTTPException(status_code=500, detail="Token de verificação não configurado")
        
        if hub_mode == "subscribe":
            if hub_verify_token == expected_token:
                logger.info("✅ Webhook WhatsApp verificado com sucesso!")
                return int(hub_challenge)  # WhatsApp espera número inteiro
            else:
                logger.error(f"❌ Token de verificação inválido. Recebido: {hub_verify_token}, Esperado: {expected_token}")
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
async def send_whatsapp_code(
    request: WhatsAppPhoneRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enviar código de verificação para WhatsApp"""
    try:
        logger.info(f"📱 Solicitação de código WhatsApp para: {request.phone_number}")
        
        # Por enquanto, simulamos o envio do código
        # Em produção, aqui você enviaria via WhatsApp Business API
        
        # Gerar código de 6 dígitos
        import random
        verification_code = f"{random.randint(100000, 999999)}"
        
        # Salvar temporariamente no banco (ou cache)
        whatsapp_user = db.query(WhatsAppUser).filter(
            WhatsAppUser.phone_number == request.phone_number
        ).first()
        
        if not whatsapp_user:
            whatsapp_user = WhatsAppUser(
                whatsapp_id=f"temp_{request.phone_number}",
                phone_number=request.phone_number,
                is_authenticated=False,
                auth_code=verification_code
            )
            db.add(whatsapp_user)
        else:
            whatsapp_user.auth_code = verification_code
        
        db.commit()
        
        # Simular sucesso
        logger.info(f"✅ Código gerado: {verification_code} (para teste)")
        
        return {
            "success": True,
            "message": f"Código de verificação enviado para {request.phone_number}",
            "code": verification_code  # APENAS PARA DESENVOLVIMENTO - REMOVER EM PRODUÇÃO
        }
        
    except Exception as e:
        logger.error(f"Erro ao enviar código WhatsApp: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.post("/verify")
async def verify_whatsapp_code(
    request: WhatsAppVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verificar código e vincular conta WhatsApp"""
    try:
        logger.info(f"📱 Verificação de código WhatsApp para: {request.phone_number}")
        
        # Buscar usuário WhatsApp com o código
        whatsapp_user = db.query(WhatsAppUser).filter(
            WhatsAppUser.phone_number == request.phone_number,
            WhatsAppUser.auth_code == request.verification_code
        ).first()
        
        if not whatsapp_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código inválido ou expirado"
            )
        
        # Vincular ao usuário atual
        whatsapp_user.user_id = current_user.id
        whatsapp_user.is_authenticated = True
        whatsapp_user.auth_code = None  # Limpar código usado
        whatsapp_user.whatsapp_name = current_user.full_name
        
        db.commit()
        
        logger.info(f"✅ WhatsApp vinculado com sucesso para usuário {current_user.id}")
        
        return {
            "success": True,
            "message": "WhatsApp vinculado com sucesso!",
            "whatsapp_user": {
                "name": whatsapp_user.whatsapp_name,
                "phone": whatsapp_user.phone_number
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na verificação WhatsApp: {e}")
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

@router.get("/debug")
async def whatsapp_debug():
    """Debug endpoint para verificar configurações"""
    return {
        "status": "WhatsApp API funcionando",
        "verify_token_configured": settings.WHATSAPP_VERIFY_TOKEN is not None,
        "access_token_configured": settings.WHATSAPP_ACCESS_TOKEN is not None,
        "phone_number_id_configured": settings.WHATSAPP_PHONE_NUMBER_ID is not None,
        "app_id_configured": settings.WHATSAPP_APP_ID is not None,
        "webhook_url": "https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/whatsapp/webhook"
    } 