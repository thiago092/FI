import httpx
import random
import string
import io
import tempfile
import os
import asyncio
import concurrent.futures
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from ..core.config import settings
from ..models.user import User
from ..models.whatsapp_user import WhatsAppUser
from ..services.enhanced_chat_ai_service import enhanced_chat_service
from ..services.chat_ai_service import ChatAIService
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

class WhatsAppService:
    def __init__(self):
        # Configurações da Meta WhatsApp Business API
        self.app_id = getattr(settings, 'WHATSAPP_APP_ID', None)
        self.app_secret = getattr(settings, 'WHATSAPP_APP_SECRET', None)
        self.access_token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', None)
        self.phone_number_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', None)
        self.verify_token = getattr(settings, 'WHATSAPP_VERIFY_TOKEN', None)
        
        if not all([self.app_id, self.access_token, self.phone_number_id]):
            logger.warning("⚠️ Configurações do WhatsApp não estão completas!")
        
        if self.phone_number_id:
            self.base_url = f"https://graph.facebook.com/v18.0/{self.phone_number_id}"
        
        # Cliente OpenAI com timeout configurado
        self.openai_client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=60.0
        )
        
    async def send_message(self, phone_number: str, message: str, message_type: str = "text") -> bool:
        """Enviar mensagem de texto para o usuário no WhatsApp"""
        try:
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "messaging_product": "whatsapp",
                "to": phone_number,
                "type": "text",
                "text": {
                    "body": message
                }
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/messages",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    logger.info(f"✅ Mensagem enviada para {phone_number}")
                    return True
                else:
                    logger.error(f"❌ Erro ao enviar mensagem: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Erro ao enviar mensagem WhatsApp: {e}")
            return False

    async def send_template_message(self, phone_number: str, template_name: str, language: str = "pt_BR", components: List[Dict] = None) -> bool:
        """Enviar mensagem template (necessário para iniciar conversação)"""
        try:
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "messaging_product": "whatsapp",
                "to": phone_number,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {
                        "code": language
                    }
                }
            }
            
            if components:
                payload["template"]["components"] = components
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/messages",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    logger.info(f"✅ Template enviado para {phone_number}")
                    return True
                else:
                    logger.error(f"❌ Erro ao enviar template: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Erro ao enviar template WhatsApp: {e}")
            return False

    async def mark_as_read(self, message_id: str) -> bool:
        """Marcar mensagem como lida"""
        try:
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "messaging_product": "whatsapp",
                "status": "read",
                "message_id": message_id
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/messages",
                    headers=headers,
                    json=payload
                )
                
                return response.status_code == 200
                
        except Exception as e:
            logger.error(f"❌ Erro ao marcar como lida: {e}")
            return False

    def generate_auth_code(self) -> str:
        """Gerar código de autenticação de 6 dígitos"""
        return ''.join(random.choices(string.digits, k=6))

    def get_or_create_whatsapp_user(self, db: Session, whatsapp_data: Dict[str, Any]) -> WhatsAppUser:
        """Obter ou criar usuário do WhatsApp"""
        whatsapp_id = whatsapp_data.get("id")
        phone_number = whatsapp_data.get("phone_number", "")
        name = whatsapp_data.get("name", "")
        
        whatsapp_user = db.query(WhatsAppUser).filter(
            WhatsAppUser.whatsapp_id == whatsapp_id
        ).first()
        
        if not whatsapp_user:
            whatsapp_user = WhatsAppUser(
                whatsapp_id=whatsapp_id,
                phone_number=phone_number,
                whatsapp_name=name,
                profile_name=name,
                last_interaction=datetime.utcnow()
            )
            db.add(whatsapp_user)
            db.commit()
            db.refresh(whatsapp_user)
        else:
            # Atualizar dados do usuário
            whatsapp_user.whatsapp_name = name
            whatsapp_user.profile_name = name
            whatsapp_user.last_interaction = datetime.utcnow()
            db.commit()
            
        return whatsapp_user

    async def start_authentication(self, db: Session, whatsapp_user: WhatsAppUser) -> str:
        """Iniciar processo de autenticação"""
        auth_code = self.generate_auth_code()
        
        whatsapp_user.auth_code = auth_code
        whatsapp_user.auth_code_expires = datetime.utcnow() + timedelta(minutes=10)
        whatsapp_user.is_authenticated = False
        db.commit()
        
        welcome_message = f"""🤖 *Bem-vindo ao FinançasAI!*

Para começar a usar o bot, você precisa vincular sua conta.

*Código de Autenticação:* {auth_code}

*Como vincular sua conta:*
1. Acesse: https://seu-site.com
2. Faça login com sua conta
3. Vá em *Configurações* → *WhatsApp*
4. Digite o código: {auth_code}

⏰ *Este código expira em 10 minutos.*

Após vincular sua conta, você poderá:
• 📊 Enviar comprovantes de compra
• 💬 Fazer perguntas sobre suas finanças
• 🎤 Enviar áudios para registrar transações
• 📈 Receber análises financeiras
• 💰 Registrar transações"""
        
        await self.send_message(whatsapp_user.phone_number, welcome_message)
        return auth_code

    def authenticate_user(self, db: Session, auth_code: str, user: User) -> Optional[WhatsAppUser]:
        """Autenticar usuário com código"""
        whatsapp_user = db.query(WhatsAppUser).filter(
            WhatsAppUser.auth_code == auth_code,
            WhatsAppUser.auth_code_expires > datetime.utcnow()
        ).first()
        
        if whatsapp_user:
            whatsapp_user.user_id = user.id
            whatsapp_user.is_authenticated = True
            whatsapp_user.auth_code = None
            whatsapp_user.auth_code_expires = None
            db.commit()
            return whatsapp_user
        
        return None

    async def process_webhook(self, db: Session, webhook_data: Dict[str, Any]) -> str:
        """Processar webhook recebido do WhatsApp"""
        try:
            entry = webhook_data.get("entry", [])
            if not entry:
                return "no_entry"
            
            changes = entry[0].get("changes", [])
            if not changes:
                return "no_changes"
            
            value = changes[0].get("value", {})
            messages = value.get("messages", [])
            
            if not messages:
                return "no_messages"
            
            # Processar primeira mensagem
            message = messages[0]
            return await self.process_message(db, message, value)
            
        except Exception as e:
            logger.error(f"❌ Erro ao processar webhook: {e}")
            return f"error: {str(e)}"

    async def process_message(self, db: Session, message: Dict[str, Any], value: Dict[str, Any]) -> str:
        """Processar mensagem individual"""
        try:
            # Extrair dados da mensagem
            from_data = message.get("from")
            message_type = message.get("type")
            message_id = message.get("id")
            
            # Marcar como lida
            await self.mark_as_read(message_id)
            
            # Buscar perfil do usuário
            contacts = value.get("contacts", [])
            contact_info = contacts[0] if contacts else {}
            
            whatsapp_data = {
                "id": from_data,
                "phone_number": from_data,
                "name": contact_info.get("profile", {}).get("name", "")
            }
            
            whatsapp_user = self.get_or_create_whatsapp_user(db, whatsapp_data)
            
            # Se usuário não está autenticado
            if not whatsapp_user.is_authenticated:
                await self.start_authentication(db, whatsapp_user)
                return "auth_started"
            
            # Processar diferentes tipos de mensagem
            if message_type == "text":
                text_content = message.get("text", {}).get("body", "")
                return await self.process_text_message(db, whatsapp_user, text_content)
            elif message_type == "audio":
                return await self.process_audio_message(db, whatsapp_user, message)
            elif message_type == "image":
                return await self.process_image_message(db, whatsapp_user, message)
            else:
                await self.send_message(
                    whatsapp_user.phone_number,
                    f"❌ Tipo de mensagem '{message_type}' não suportado ainda."
                )
                return f"unsupported_type_{message_type}"
                
        except Exception as e:
            logger.error(f"❌ Erro ao processar mensagem: {e}")
            return f"error: {str(e)}"

    async def process_text_message(self, db: Session, whatsapp_user: WhatsAppUser, text: str) -> str:
        """Processar mensagem de texto"""
        try:
            # Usar o serviço de chat AI (mesmo do Telegram)
            chat_service = ChatAIService()
            response = await chat_service.process_message(
                text, 
                whatsapp_user.user_id,
                db,
                platform="whatsapp"
            )
            
            await self.send_message(whatsapp_user.phone_number, response)
            return "text_processed"
            
        except Exception as e:
            logger.error(f"❌ Erro ao processar texto: {e}")
            await self.send_message(
                whatsapp_user.phone_number,
                "❌ Desculpe, ocorreu um erro ao processar sua mensagem."
            )
            return f"error: {str(e)}"

    async def process_audio_message(self, db: Session, whatsapp_user: WhatsAppUser, message: Dict[str, Any]) -> str:
        """Processar mensagem de áudio"""
        # TODO: Implementar processamento de áudio similar ao Telegram
        await self.send_message(
            whatsapp_user.phone_number,
            "🎤 Processamento de áudio será implementado em breve!"
        )
        return "audio_not_implemented"

    async def process_image_message(self, db: Session, whatsapp_user: WhatsAppUser, message: Dict[str, Any]) -> str:
        """Processar mensagem de imagem"""
        # TODO: Implementar processamento de imagem similar ao Telegram
        await self.send_message(
            whatsapp_user.phone_number,
            "📸 Processamento de imagens será implementado em breve!"
        )
        return "image_not_implemented"

    def verify_webhook(self, token: str, challenge: str) -> Optional[str]:
        """Verificar webhook do WhatsApp"""
        if token == self.verify_token:
            return challenge
        return None 