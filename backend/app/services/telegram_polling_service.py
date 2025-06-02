import asyncio
import httpx
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from ..database import get_db
from ..core.config import settings
from .telegram_service import TelegramService

logger = logging.getLogger(__name__)

class TelegramPollingService:
    def __init__(self):
        self.bot_token = settings.TELEGRAM_BOT_TOKEN
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
        self.last_update_id = 0
        self.telegram_service = TelegramService()
        self.is_running = False
        
    async def start_polling(self):
        """Iniciar polling de mensagens do Telegram"""
        if not self.bot_token:
            logger.error("❌ Token do Telegram não configurado!")
            return
            
        logger.info("🤖 Iniciando polling do Telegram...")
        self.is_running = True
        
        try:
            while self.is_running:
                await self._poll_updates()
                await asyncio.sleep(1)  # Verificar a cada 1 segundo
        except Exception as e:
            logger.error(f"Erro no polling: {e}")
        finally:
            logger.info("🛑 Polling do Telegram parado")
    
    async def stop_polling(self):
        """Parar polling"""
        self.is_running = False
        
    async def _poll_updates(self):
        """Verificar por novas atualizações"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/getUpdates",
                    params={
                        "offset": self.last_update_id + 1,
                        "timeout": 30,
                        "limit": 100
                    },
                    timeout=35
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get("ok"):
                        updates = data.get("result", [])
                        
                        for update in updates:
                            await self._process_update(update)
                            self.last_update_id = update.get("update_id", 0)
                
        except Exception as e:
            logger.error(f"Erro ao fazer polling: {e}")
    
    async def _process_update(self, update: Dict[str, Any]):
        """Processar uma atualização recebida"""
        try:
            # Simular estrutura de webhook
            telegram_data = update
            
            # Obter sessão do banco
            db = next(get_db())
            
            try:
                # Verificar se é uma mensagem
                if "message" in telegram_data:
                    message = telegram_data["message"]
                    
                    # Verificar se é uma foto
                    if "photo" in message:
                        result = await self.telegram_service.process_photo(db, telegram_data)
                        logger.info(f"📸 Foto processada via polling: {result}")
                    
                    # Verificar se é texto
                    elif "text" in message:
                        result = await self.telegram_service.process_message(db, telegram_data)
                        logger.info(f"💬 Mensagem processada via polling: {result}")
                        
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Erro ao processar update: {e}")

# Instância global para controlar o polling
telegram_polling = TelegramPollingService() 