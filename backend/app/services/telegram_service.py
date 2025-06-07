import httpx
import random
import string
import io
import tempfile
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from ..core.config import settings
from ..models.user import User
from ..models.telegram_user import TelegramUser
from ..services.enhanced_chat_ai_service import enhanced_chat_service
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

class TelegramService:
    def __init__(self):
        self.bot_token = settings.TELEGRAM_BOT_TOKEN
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
        self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
    async def send_message(self, chat_id: str, text: str, parse_mode: str = "Markdown") -> bool:
        """Enviar mensagem para o usuário no Telegram"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": text,
                        "parse_mode": parse_mode
                    }
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Erro ao enviar mensagem: {e}")
            return False

    async def send_photo(self, chat_id: str, photo_url: str, caption: str = "") -> bool:
        """Enviar foto para o usuário no Telegram"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/sendPhoto",
                    json={
                        "chat_id": chat_id,
                        "photo": photo_url,
                        "caption": caption,
                        "parse_mode": "Markdown"
                    }
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Erro ao enviar foto: {e}")
            return False

    def generate_auth_code(self) -> str:
        """Gerar código de autenticação de 6 dígitos"""
        return ''.join(random.choices(string.digits, k=6))

    def get_or_create_telegram_user(self, db: Session, telegram_data: Dict[str, Any]) -> TelegramUser:
        """Obter ou criar usuário do Telegram"""
        telegram_id = str(telegram_data.get("id"))
        
        telegram_user = db.query(TelegramUser).filter(
            TelegramUser.telegram_id == telegram_id
        ).first()
        
        if not telegram_user:
            telegram_user = TelegramUser(
                telegram_id=telegram_id,
                telegram_username=telegram_data.get("username"),
                telegram_first_name=telegram_data.get("first_name"),
                telegram_last_name=telegram_data.get("last_name"),
                last_interaction=datetime.utcnow()
            )
            db.add(telegram_user)
            db.commit()
            db.refresh(telegram_user)
        else:
            # Atualizar dados do usuário
            telegram_user.telegram_username = telegram_data.get("username")
            telegram_user.telegram_first_name = telegram_data.get("first_name")
            telegram_user.telegram_last_name = telegram_data.get("last_name")
            telegram_user.last_interaction = datetime.utcnow()
            db.commit()
            
        return telegram_user

    async def start_authentication(self, db: Session, telegram_user: TelegramUser) -> str:
        """Iniciar processo de autenticação"""
        auth_code = self.generate_auth_code()
        
        telegram_user.auth_code = auth_code
        telegram_user.auth_code_expires = datetime.utcnow() + timedelta(minutes=10)
        telegram_user.is_authenticated = False
        db.commit()
        
        welcome_message = f"""
🤖 *Bem-vindo ao FinançasAI Bot!*

Para começar a usar o bot, você precisa vincular sua conta.

*Código de Autenticação:* `{auth_code}`

*Como vincular sua conta:*
1. Acesse o site: http://localhost:3001
2. Faça login com sua conta
3. Vá em *Configurações* → *Telegram*
4. Digite o código: `{auth_code}`

⏰ *Este código expira em 10 minutos.*

Após vincular sua conta, você poderá:
• 📊 Enviar comprovantes de compra
• 💬 Fazer perguntas sobre suas finanças
• 🎤 Enviar áudios para registrar transações
• 📈 Receber análises financeiras
• 💰 Registrar transações
"""
        
        await self.send_message(telegram_user.telegram_id, welcome_message)
        return auth_code

    def authenticate_user(self, db: Session, auth_code: str, user: User) -> Optional[TelegramUser]:
        """Autenticar usuário com código"""
        telegram_user = db.query(TelegramUser).filter(
            TelegramUser.auth_code == auth_code,
            TelegramUser.auth_code_expires > datetime.utcnow()
        ).first()
        
        if telegram_user:
            telegram_user.user_id = user.id
            telegram_user.is_authenticated = True
            telegram_user.auth_code = None
            telegram_user.auth_code_expires = None
            db.commit()
            return telegram_user
        
        return None

    async def process_message(self, db: Session, telegram_data: Dict[str, Any]) -> str:
        """Processar mensagem recebida do Telegram"""
        message = telegram_data.get("message", {})
        user_data = message.get("from", {})
        chat = message.get("chat", {})
        text = message.get("text", "")
        
        telegram_user = self.get_or_create_telegram_user(db, user_data)
        
        # Se usuário não está autenticado
        if not telegram_user.is_authenticated:
            if text.startswith("/start"):
                await self.start_authentication(db, telegram_user)
                return "auth_started"
            else:
                await self.send_message(
                    telegram_user.telegram_id,
                    "❌ Você precisa vincular sua conta primeiro. Digite /start para começar."
                )
                return "not_authenticated"
        
        # Usuário autenticado - processar comando/mensagem
        if text.startswith("/"):
            return await self.process_command(db, telegram_user, text)
        else:
            return await self.process_chat_message(db, telegram_user, text)

    async def process_command(self, db: Session, telegram_user: TelegramUser, command: str) -> str:
        """Processar comandos do bot"""
        if command == "/start":
            await self.send_message(
                telegram_user.telegram_id,
                f"👋 Olá, {telegram_user.telegram_first_name}! Sua conta já está vinculada.\n\n" +
                "💬 Envie uma mensagem, 🎤 áudio ou 📸 foto para começar!"
            )
            return "start_authenticated"
        
        elif command == "/help":
            help_text = """
🤖 *Comandos do FinançasAI Bot:*

💬 *Mensagens:* Envie qualquer mensagem sobre suas finanças
🎤 *Áudios:* Envie mensagens de voz para registrar transações
📸 *Fotos:* Envie fotos de comprovantes para análise automática
📊 *Análises:* Peça análises sobre seus gastos
💰 *Transações:* Registre receitas e despesas

*Exemplos de mensagens/áudios:*
• "Gastei R$ 50 no supermercado"
• "Recebi R$ 1000 de salário"
• "Quanto gastei este mês?"
• "Analise meus gastos"

📱 Para mais funcionalidades, acesse: http://localhost:3001
            """
            await self.send_message(telegram_user.telegram_id, help_text)
            return "help_sent"
        
        else:
            await self.send_message(
                telegram_user.telegram_id,
                "❓ Comando não reconhecido. Digite /help para ver os comandos disponíveis."
            )
            return "unknown_command"

    async def process_chat_message(self, db: Session, telegram_user: TelegramUser, message: str) -> str:
        """Processar mensagem de chat usando o Enhanced ChatAI com MCP"""
        try:
            # Obter o usuário associado
            user = db.query(User).filter(User.id == telegram_user.user_id).first()
            if not user:
                await self.send_message(
                    telegram_user.telegram_id,
                    "❌ Erro: usuário não encontrado. Tente vincular sua conta novamente."
                )
                return "user_not_found"
            
            # Usar o Enhanced Chat Service com MCP
            response = await enhanced_chat_service.process_message(
                message=message,
                user_id=user.id
            )
            
            # Formatar resposta para Telegram
            resposta_text = response.get('resposta', 'Desculpe, não consegui processar sua mensagem.')
            
            # Se usou dados reais, adicionar indicador
            if response.get('fonte') == 'mcp_real_data':
                resposta_text = f"📊 *Dados atualizados:*\n\n{resposta_text}"
            
            # Enviar resposta
            await self.send_message(telegram_user.telegram_id, resposta_text)
            
            # Log para debug
            logger.info(f"💬 Telegram MCP: {message} → {response.get('fonte', 'generico')}")
            
            return "message_processed"
            
        except Exception as e:
            logger.error(f"Erro ao processar mensagem: {e}")
            await self.send_message(
                telegram_user.telegram_id,
                "❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente."
            )
            return "error"

    async def process_audio(self, db: Session, telegram_data: Dict[str, Any]) -> str:
        """Processar áudio/voice enviado pelo usuário"""
        message = telegram_data.get("message", {})
        user_data = message.get("from", {})
        
        # Pode ser voice ou audio
        audio_data = message.get("voice") or message.get("audio")
        
        if not audio_data:
            return "no_audio"
        
        telegram_user = self.get_or_create_telegram_user(db, user_data)
        
        if not telegram_user.is_authenticated:
            await self.send_message(
                telegram_user.telegram_id,
                "❌ Você precisa vincular sua conta primeiro. Digite /start para começar."
            )
            return "not_authenticated"
        
        try:
            # Enviar mensagem de processamento
            await self.send_message(
                telegram_user.telegram_id,
                "🎤 Processando seu áudio... Um momento!"
            )
            
            # Obter arquivo de áudio
            file_id = audio_data.get("file_id")
            
            # Baixar arquivo
            async with httpx.AsyncClient() as client:
                # Obter informações do arquivo
                file_response = await client.get(f"{self.base_url}/getFile?file_id={file_id}")
                file_data = file_response.json()
                
                if not file_data.get("ok"):
                    raise Exception("Erro ao obter informações do arquivo")
                
                file_path = file_data["result"]["file_path"]
                file_url = f"https://api.telegram.org/file/bot{self.bot_token}/{file_path}"
                
                # Baixar conteúdo do áudio
                audio_response = await client.get(file_url)
                audio_bytes = audio_response.content
                
                # Converter áudio para texto usando Whisper
                text = await self._transcribe_audio(audio_bytes, file_path)
                
                if not text:
                    await self.send_message(
                        telegram_user.telegram_id,
                        "❌ Não consegui entender o áudio. Tente falar mais claramente."
                    )
                    return "transcription_failed"
                
                # Mostrar texto transcrito
                await self.send_message(
                    telegram_user.telegram_id,
                    f"📝 *Entendi:* {text}\n\n⏳ Processando sua solicitação..."
                )
                
                # Processar texto transcrito como se fosse uma mensagem normal
                return await self.process_chat_message(db, telegram_user, text)
                
        except Exception as e:
            logger.error(f"Erro ao processar áudio: {e}")
            await self.send_message(
                telegram_user.telegram_id,
                "❌ Erro ao processar o áudio. Tente novamente ou envie uma mensagem de texto."
            )
            return "error"

    async def _transcribe_audio(self, audio_bytes: bytes, file_path: str) -> Optional[str]:
        """Converter áudio em texto usando Whisper API"""
        try:
            # Determinar extensão do arquivo
            file_extension = os.path.splitext(file_path)[1] or '.ogg'
            
            # Criar arquivo temporário
            with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
                temp_file.write(audio_bytes)
                temp_file_path = temp_file.name
            
            try:
                # Usar Whisper para transcrever
                with open(temp_file_path, 'rb') as audio_file:
                    transcription = self.openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language="pt"  # Forçar português
                    )
                
                return transcription.text.strip()
                
            finally:
                # Remover arquivo temporário
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
                
        except Exception as e:
            logger.error(f"Erro na transcrição: {e}")
            return None

    async def process_photo(self, db: Session, telegram_data: Dict[str, Any]) -> str:
        """Processar foto enviada pelo usuário"""
        message = telegram_data.get("message", {})
        user_data = message.get("from", {})
        photo = message.get("photo", [])
        
        if not photo:
            return "no_photo"
        
        telegram_user = self.get_or_create_telegram_user(db, user_data)
        
        if not telegram_user.is_authenticated:
            await self.send_message(
                telegram_user.telegram_id,
                "❌ Você precisa vincular sua conta primeiro. Digite /start para começar."
            )
            return "not_authenticated"
        
        try:
            # Pegar a foto de maior resolução
            largest_photo = max(photo, key=lambda p: p.get("file_size", 0))
            file_id = largest_photo.get("file_id")
            
            # Obter URL do arquivo
            async with httpx.AsyncClient() as client:
                file_response = await client.get(f"{self.base_url}/getFile?file_id={file_id}")
                file_data = file_response.json()
                
                if file_data.get("ok"):
                    file_path = file_data["result"]["file_path"]
                    file_url = f"https://api.telegram.org/file/bot{self.bot_token}/{file_path}"
                    
                    # Baixar arquivo
                    photo_response = await client.get(file_url)
                    photo_bytes = photo_response.content
                    
                    # Obter o usuário associado para pegar o tenant_id
                    user = db.query(User).filter(User.id == telegram_user.user_id).first()
                    tenant_id = str(user.tenant_id) if user.tenant_id else "default"
                    
                    # Processar com ChatAIService
                    chat_service = ChatAIService(
                        db=db,
                        openai_api_key=settings.OPENAI_API_KEY,
                        tenant_id=tenant_id
                    )
                    
                    result = await chat_service.processar_imagem(
                        file_content=photo_bytes,
                        filename="telegram_photo.jpg"
                    )
                    
                    await self.send_message(telegram_user.telegram_id, result['resposta'])
                    return "photo_processed"
                
        except Exception as e:
            logger.error(f"Erro ao processar foto: {e}")
            await self.send_message(
                telegram_user.telegram_id,
                "❌ Erro ao processar a foto. Tente novamente."
            )
            return "error"
        
        return "photo_error" 