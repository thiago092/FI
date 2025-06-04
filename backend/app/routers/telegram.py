from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..models.telegram_user import TelegramUser
from ..services.telegram_service import TelegramService
from ..core.security import get_current_user
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram", tags=["telegram"])

class TelegramAuthRequest(BaseModel):
    auth_code: str

class TelegramAuthResponse(BaseModel):
    message: str
    success: bool

@router.post("/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    """Webhook para receber mensagens do Telegram"""
    try:
        telegram_data = await request.json()
        telegram_service = TelegramService()
        
        # Verificar se é uma mensagem
        if "message" in telegram_data:
            message = telegram_data["message"]
            
            # Verificar se é uma foto
            if "photo" in message:
                result = await telegram_service.process_photo(db, telegram_data)
                return {"status": "photo_processed", "result": result}
            
            # Verificar se é áudio/voice
            elif "voice" in message or "audio" in message:
                result = await telegram_service.process_audio(db, telegram_data)
                return {"status": "audio_processed", "result": result}
            
            # Verificar se é texto
            elif "text" in message:
                result = await telegram_service.process_message(db, telegram_data)
                return {"status": "message_processed", "result": result}
        
        return {"status": "ignored"}
        
    except Exception as e:
        logger.error(f"Erro no webhook do Telegram: {e}")
        # Telegram espera HTTP 200 mesmo em erro
        return {"status": "error", "message": str(e)}

@router.post("/auth", response_model=TelegramAuthResponse)
async def authenticate_telegram(
    auth_data: TelegramAuthRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Autenticar usuário do Telegram com código"""
    try:
        telegram_service = TelegramService()
        
        telegram_user = telegram_service.authenticate_user(
            db=db,
            auth_code=auth_data.auth_code,
            user=current_user
        )
        
        if telegram_user:
            return TelegramAuthResponse(
                message=f"Telegram vinculado com sucesso! Usuário: @{telegram_user.telegram_username or telegram_user.telegram_first_name}",
                success=True
            )
        else:
            return TelegramAuthResponse(
                message="Código inválido ou expirado. Solicite um novo código no bot.",
                success=False
            )
            
    except Exception as e:
        logger.error(f"Erro na autenticação do Telegram: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/status")
async def get_telegram_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verificar status da vinculação do Telegram"""
    try:
        telegram_user = db.query(TelegramUser).filter(
            TelegramUser.user_id == current_user.id,
            TelegramUser.is_authenticated == True
        ).first()
        
        if telegram_user:
            return {
                "is_connected": True,
                "telegram_username": telegram_user.telegram_username,
                "telegram_name": f"{telegram_user.telegram_first_name} {telegram_user.telegram_last_name or ''}".strip(),
                "last_interaction": telegram_user.last_interaction
            }
        else:
            return {
                "is_connected": False,
                "message": "Telegram não vinculado"
            }
            
    except Exception as e:
        logger.error(f"Erro ao verificar status do Telegram: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor") 