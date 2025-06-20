from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any
from pydantic import BaseModel
from ..database import get_db
from ..services.telegram_service import TelegramService
from ..services.telegram_polling_service import telegram_polling
from ..core.security import get_current_user
from ..models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class TelegramAuthRequest(BaseModel):
    auth_code: str

@router.post("/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    """Webhook para receber mensagens do Telegram (produção)"""
    try:
        telegram_data = await request.json()
        logger.info(f"📱 Webhook Telegram recebido: {telegram_data}")
        
        telegram_service = TelegramService()
        
        # Verificar se é uma mensagem
        if "message" in telegram_data:
            message = telegram_data["message"]
            logger.info(f"🔍 Tipo de mensagem detectado: {list(message.keys())}")
            
            # Verificar se é uma foto
            if "photo" in message:
                logger.info("📸 Processando foto...")
                result = await telegram_service.process_photo(db, telegram_data)
                logger.info(f"📸 Foto processada: {result}")
            
            # Verificar se é áudio/voice
            elif "voice" in message or "audio" in message:
                logger.info("🎤 Detectado áudio/voice - iniciando processamento...")
                if "voice" in message:
                    logger.info(f"🎤 Voice detectado: {message['voice']}")
                if "audio" in message:
                    logger.info(f"🎵 Audio detectado: {message['audio']}")
                
                result = await telegram_service.process_audio(db, telegram_data)
                logger.info(f"🎤 Áudio processado: {result}")
            
            # Verificar se é texto
            elif "text" in message:
                logger.info(f"💬 Processando texto: {message.get('text', '')[:50]}...")
                result = await telegram_service.process_message(db, telegram_data)
                logger.info(f"💬 Mensagem processada: {result}")
                
            else:
                logger.warning(f"⚠️ Tipo de mensagem não reconhecido: {list(message.keys())}")
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"❌ Erro no webhook Telegram: {e}")
        return {"status": "error", "message": str(e)}

@router.post("/start-polling")
async def start_telegram_polling(background_tasks: BackgroundTasks):
    """Iniciar polling do Telegram para desenvolvimento local"""
    if telegram_polling.is_running:
        return {"message": "Polling já está rodando", "status": "running"}
    
    background_tasks.add_task(telegram_polling.start_polling)
    return {"message": "Polling do Telegram iniciado", "status": "started"}

@router.post("/stop-polling")
async def stop_telegram_polling():
    """Parar polling do Telegram"""
    await telegram_polling.stop_polling()
    return {"message": "Polling do Telegram parado", "status": "stopped"}

@router.get("/polling-status")
async def get_polling_status():
    """Verificar status do polling"""
    return {
        "is_running": telegram_polling.is_running,
        "last_update_id": telegram_polling.last_update_id
    }

@router.post("/authenticate")
async def authenticate_telegram(
    request: TelegramAuthRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Autenticar usuário do Telegram com código"""
    try:
        telegram_service = TelegramService()
        telegram_user = telegram_service.authenticate_user(db, request.auth_code, current_user)
        
        if telegram_user:
            # Enviar confirmação via Telegram
            await telegram_service.send_message(
                telegram_user.telegram_id,
                f"✅ *Conta vinculada com sucesso!*\n\n"
                f"Olá, {current_user.full_name}! Sua conta está agora vinculada ao Telegram.\n\n"
                f"💬 Agora você pode enviar mensagens e fotos para gerenciar suas finanças!"
            )
            
            return {
                "success": True,
                "message": "Conta Telegram vinculada com sucesso!",
                "telegram_user": {
                    "first_name": telegram_user.telegram_first_name,
                    "username": telegram_user.telegram_username
                }
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código inválido ou expirado"
            )
            
    except Exception as e:
        logger.error(f"Erro na autenticação: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.get("/status")
async def telegram_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verificar status da integração com Telegram"""
    from ..models.telegram_user import TelegramUser
    
    telegram_user = db.query(TelegramUser).filter(
        TelegramUser.user_id == current_user.id,
        TelegramUser.is_authenticated == True
    ).first()
    
    if telegram_user:
        return {
            "connected": True,
            "telegram_info": {
                "first_name": telegram_user.telegram_first_name,
                "username": telegram_user.telegram_username,
                "last_interaction": telegram_user.last_interaction.isoformat() if telegram_user.last_interaction else None
            }
        }
    else:
        return {"connected": False}

@router.delete("/disconnect")
async def disconnect_telegram(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Desconectar conta do Telegram"""
    from ..models.telegram_user import TelegramUser
    
    telegram_user = db.query(TelegramUser).filter(
        TelegramUser.user_id == current_user.id,
        TelegramUser.is_authenticated == True
    ).first()
    
    if telegram_user:
        # Notificar no Telegram
        telegram_service = TelegramService()
        await telegram_service.send_message(
            telegram_user.telegram_id,
            "❌ *Conta desvinculada*\n\nSua conta foi desvinculada do FinançasAI.\n\n"
            "Para vincular novamente, digite /start"
        )
        
        # Desautenticar
        telegram_user.is_authenticated = False
        telegram_user.user_id = None
        db.commit()
        
        return {"success": True, "message": "Conta Telegram desvinculada com sucesso!"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma conta Telegram encontrada"
        )

@router.post("/test-message")
async def send_test_message(
    message: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enviar mensagem de teste para o Telegram do usuário"""
    from ..models.telegram_user import TelegramUser
    
    telegram_user = db.query(TelegramUser).filter(
        TelegramUser.user_id == current_user.id,
        TelegramUser.is_authenticated == True
    ).first()
    
    if telegram_user:
        telegram_service = TelegramService()
        success = await telegram_service.send_message(telegram_user.telegram_id, message)
        
        if success:
            return {"success": True, "message": "Mensagem enviada com sucesso!"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falha ao enviar mensagem"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma conta Telegram encontrada"
        )

@router.post("/setup-commands")
async def setup_telegram_commands():
    """Configurar comandos do menu do Telegram"""
    try:
        telegram_service = TelegramService()
        success = await telegram_service.setup_bot_commands()
        
        if success:
            return {
                "success": True,
                "message": "Comandos do menu do Telegram atualizados com sucesso! 🎉",
                "commands": [
                    "/start - 🔗 Iniciar e vincular sua conta",
                    "/help - 📖 Guia completo de funcionalidades", 
                    "/comandos - 📋 Lista todos os comandos disponíveis",
                    "/exemplos - 💡 Exemplos práticos de uso",
                    "/status - 📊 Status da sua conta vinculada",
                    "/sair - 🚪 Desconectar Telegram da conta"
                ]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falha ao configurar comandos do Telegram"
            )
            
    except Exception as e:
        logger.error(f"Erro ao configurar comandos: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )

@router.get("/bot-info")
async def get_telegram_bot_info():
    """Obter informações do bot do Telegram"""
    try:
        telegram_service = TelegramService()
        bot_info = await telegram_service.get_bot_info()
        
        if bot_info.get("ok"):
            result = bot_info["result"]
            return {
                "success": True,
                "bot_info": {
                    "id": result.get("id"),
                    "is_bot": result.get("is_bot"),
                    "first_name": result.get("first_name"),
                    "username": result.get("username"),
                    "can_join_groups": result.get("can_join_groups"),
                    "can_read_all_group_messages": result.get("can_read_all_group_messages"),
                    "supports_inline_queries": result.get("supports_inline_queries")
                }
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falha ao obter informações do bot"
            )
            
    except Exception as e:
        logger.error(f"Erro ao obter informações do bot: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )

@router.get("/debug/codes")
async def debug_telegram_codes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Debug: Verificar códigos de autenticação do Telegram"""
    from ..models.telegram_user import TelegramUser
    from datetime import datetime
    
    # Buscar todos os códigos ativos (não expirados)
    active_codes = db.query(TelegramUser).filter(
        TelegramUser.auth_code.isnot(None),
        TelegramUser.auth_code_expires > datetime.utcnow()
    ).all()
    
    # Buscar códigos expirados recentes (últimas 2 horas)
    from datetime import timedelta
    expired_codes = db.query(TelegramUser).filter(
        TelegramUser.auth_code.isnot(None),
        TelegramUser.auth_code_expires < datetime.utcnow(),
        TelegramUser.auth_code_expires > datetime.utcnow() - timedelta(hours=2)
    ).all()
    
    # Buscar usuários já autenticados
    authenticated_users = db.query(TelegramUser).filter(
        TelegramUser.user_id.isnot(None),
        TelegramUser.is_authenticated == True
    ).all()
    
    return {
        "current_user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name
        },
        "active_codes": [
            {
                "code": code.auth_code,
                "telegram_id": code.telegram_id,
                "telegram_name": code.telegram_first_name,
                "expires_at": code.auth_code_expires.isoformat(),
                "minutes_remaining": int((code.auth_code_expires - datetime.utcnow()).total_seconds() / 60)
            }
            for code in active_codes
        ],
        "expired_codes": [
            {
                "code": code.auth_code,
                "telegram_id": code.telegram_id,
                "telegram_name": code.telegram_first_name,
                "expired_at": code.auth_code_expires.isoformat()
            }
            for code in expired_codes
        ],
        "authenticated_users": [
            {
                "telegram_id": user.telegram_id,
                "telegram_name": user.telegram_first_name,
                "user_id": user.user_id,
                "last_interaction": user.last_interaction.isoformat() if user.last_interaction else None
            }
            for user in authenticated_users
        ],
        "stats": {
            "total_active_codes": len(active_codes),
            "total_expired_codes": len(expired_codes),
            "total_authenticated": len(authenticated_users)
        }
    }

@router.patch("/config/confirmacao-recorrentes")
async def configurar_confirmacao_recorrentes(
    ativar: bool,
    timeout_horas: int = 2,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Configurar confirmação de transações recorrentes via Telegram"""
    from ..models.telegram_user import TelegramUser
    
    try:
        # Buscar usuário do Telegram
        telegram_user = db.query(TelegramUser).filter(
            TelegramUser.user_id == current_user.id,
            TelegramUser.is_authenticated == True
        ).first()
        
        if not telegram_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Telegram não está vinculado ou não autenticado"
            )
        
        # Validar timeout
        if timeout_horas < 1 or timeout_horas > 24:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Timeout deve ser entre 1 e 24 horas"
            )
        
        # Verificar se os campos existem (migração executada)
        try:
            # Tentar acessar os campos
            _ = telegram_user.confirmar_transacoes_recorrentes
            _ = telegram_user.timeout_confirmacao_horas
        except AttributeError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Funcionalidade não disponível: execute a migração do banco de dados"
            )
        
        # Atualizar configurações
        telegram_user.confirmar_transacoes_recorrentes = ativar
        telegram_user.timeout_confirmacao_horas = timeout_horas
        
        db.commit()
        db.refresh(telegram_user)
        
        status_text = "ativada" if ativar else "desativada"
        logger.info(f"✅ Confirmação de transações recorrentes {status_text} para usuário {current_user.full_name}")
        
        return {
            "success": True,
            "message": f"Confirmação de transações recorrentes {status_text}",
            "config": {
                "ativo": telegram_user.confirmar_transacoes_recorrentes,
                "timeout_horas": telegram_user.timeout_confirmacao_horas
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao configurar confirmação: {e}")
        if "does not exist" in str(e):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Funcionalidade não disponível: execute a migração do banco de dados"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.get("/config/confirmacao-recorrentes")
async def obter_config_confirmacao_recorrentes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obter configurações atuais de confirmação de transações recorrentes"""
    from ..models.telegram_user import TelegramUser
    
    try:
        telegram_user = db.query(TelegramUser).filter(
            TelegramUser.user_id == current_user.id,
            TelegramUser.is_authenticated == True
        ).first()
        
        if not telegram_user:
            return {
                "telegram_conectado": False,
                "config": None
            }
        
        # Verificar se os campos existem (migração executada)
        try:
            confirmar = telegram_user.confirmar_transacoes_recorrentes
            timeout = telegram_user.timeout_confirmacao_horas
        except AttributeError:
            return {
                "telegram_conectado": True,
                "config": None,
                "erro": "Migração do banco de dados não executada"
            }
        
        return {
            "telegram_conectado": True,
            "config": {
                "ativo": confirmar,
                "timeout_horas": timeout
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter configuração: {e}")
        if "does not exist" in str(e):
            return {
                "telegram_conectado": True,
                "config": None,
                "erro": "Migração do banco de dados não executada"
            }
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        ) 