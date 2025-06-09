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
from ..services.chat_ai_service import ChatAIService
from ..models.user import User
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

class TelegramService:
    def __init__(self):
        self.bot_token = settings.TELEGRAM_BOT_TOKEN
        if not self.bot_token:
            logger.warning("⚠️ TELEGRAM_BOT_TOKEN não está configurado!")
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
🤖 *FinançasAI Bot - Guia Completo*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 *COMO USAR:*
Este bot entende *linguagem natural*! Converse normalmente sobre suas finanças.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *REGISTRAR TRANSAÇÕES:*
📤 *Gastos:*
• "Gastei R$ 50 no supermercado"
• "Paguei R$ 120 de conta de luz"
• "Comprei um café por R$ 8"

📥 *Receitas:*
• "Recebi R$ 3000 de salário"
• "Ganhei R$ 200 de freelance"
• "Entrou R$ 50 na conta"

🔄 *Parcelamento:*
• "Parcelei R$ 600 em 12x no cartão"
• "Comprei em 6 parcelas de R$ 100"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *CONSULTAS E ANÁLISES:*
💵 *Saldo e Gastos:*
• "Quanto tenho de saldo?"
• "Quanto gastei hoje/ontem/este mês?"
• "Minhas últimas transações"

📈 *Relatórios:*
• "Resumo do mês"
• "Analise meus gastos"
• "Relatório semanal"
• "Previsão de orçamento"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎤 *ÁUDIO:*
Envie mensagens de voz! Fale naturalmente:
🗣️ "Oi, gastei cinquenta reais no mercado hoje"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📸 *FOTOS DE RECIBOS:*
Envie fotos de:
• 🧾 Cupons fiscais
• 💳 Comprovantes de cartão
• 📄 Boletos pagos
• 🧾 Notas fiscais

O bot extrai automaticamente:
✅ Valor da compra
✅ Local/estabelecimento
✅ Data da transação
✅ Descrição do produto

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ *MÉTODOS DE PAGAMENTO:*
O bot reconhece automaticamente ou pergunta:
💳 Cartões de crédito/débito
🏦 Contas bancárias
💰 Dinheiro/PIX

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧠 *INTELIGÊNCIA ARTIFICIAL:*
• Categorização automática
• Análise de padrões de gasto
• Sugestões personalizadas
• Detecção de gastos incomuns

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 *COMANDOS:*
/start - Iniciar/vincular conta
/help - Este guia completo
/sair - Desconectar Telegram da conta

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *DICAS RÁPIDAS:*
✨ Seja específico: "Almoço no McDonald's" vs "Comida"
✨ Use valores exatos: "R$ 47,50" vs "uns 50 reais"
✨ Para correções: "Corrigir última transação para R$ 60"

📱 *Versão Web Completa:*
Acesse todas as funcionalidades avançadas em:
🌐 [Seu link da aplicação web aqui]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ *Dúvidas?* Apenas pergunte!
"Como funciona o parcelamento?"
"Posso corrigir uma transação?"
            """
            await self.send_message(telegram_user.telegram_id, help_text)
            return "help_sent"
        
        elif command == "/comandos":
            commands_text = """
🔧 *Lista de Comandos Disponíveis:*

/start - Iniciar bot e vincular conta
/help - Guia completo de funcionalidades
/comandos - Esta lista de comandos
/exemplos - Exemplos práticos de uso
/status - Status da sua conta
/sair - Desconectar Telegram da conta

💡 *Lembre-se:* Você pode conversar normalmente!
Não precisa usar comandos para registrar transações.
            """
            await self.send_message(telegram_user.telegram_id, commands_text)
            return "commands_sent"
        
        elif command == "/exemplos":
            examples_text = """
📚 *Exemplos Práticos:*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *TRANSAÇÕES SIMPLES:*
✍️ "Gastei 25 reais no Uber"
✍️ "Paguei 80 reais de farmácia"
✍️ "Recebi 150 reais de freelance"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 *PARCELAMENTO:*
✍️ "Parcelei 1200 reais em 10x no cartão"
✍️ "Comprei uma TV em 6 parcelas de 200"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *CONSULTAS:*
✍️ "Quanto gastei hoje?"
✍️ "Saldo das contas"
✍️ "Últimas 5 transações"
✍️ "Resumo desta semana"
✍️ "Gastei quanto em comida este mês?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎤 *MENSAGENS DE VOZ:*
🗣️ "Oi bot, gastei quarenta e cinco reais no almoço hoje no restaurante do shopping"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📸 *FOTOS:*
Envie qualquer foto de:
• Nota fiscal do supermercado
• Comprovante do cartão
• Cupom da farmácia
• Recibo de combustível

O bot extrai tudo automaticamente! 🎯
            """
            await self.send_message(telegram_user.telegram_id, examples_text)
            return "examples_sent"
        
        elif command == "/status":
            user = db.query(User).filter(User.id == telegram_user.user_id).first()
            if user:
                status_text = f"""
📊 *Status da Conta:*

👤 *Usuário:* {user.full_name}
📧 *Email:* {user.email}
🔗 *Conta:* Vinculada ✅
🤖 *Bot:* Ativo ✅

🎯 *Pronto para usar!*
Envie uma mensagem, áudio ou foto para começar.
                """
            else:
                status_text = """
❌ *Conta não encontrada*
Tente usar /start para vincular sua conta novamente.
                """
            await self.send_message(telegram_user.telegram_id, status_text)
            return "status_sent"
        
        elif command == "/sair":
            return await self.disconnect_telegram_user(db, telegram_user)
        
        elif command == "/atualizar_menu":
            # Comando especial para atualizar menu de comandos
            success = await self.setup_bot_commands()
            if success:
                await self.send_message(
                    telegram_user.telegram_id,
                    "✅ *Menu de comandos atualizado!*\n\n" +
                    "🎯 Os comandos no menu do Telegram foram sincronizados.\n\n" +
                    "📱 *Para ver o menu atualizado:*\n" +
                    "• Digite `/` e veja a lista\n" +
                    "• Ou clique no ícone de menu (☰)\n\n" +
                    "🔄 *Comandos disponíveis:*\n" +
                    "• /start - Iniciar e vincular conta\n" +
                    "• /help - Guia completo\n" +
                    "• /comandos - Lista de comandos\n" +
                    "• /exemplos - Exemplos práticos\n" +
                    "• /status - Status da conta\n" +
                    "• /sair - Desconectar Telegram"
                )
                return "menu_updated"
            else:
                await self.send_message(
                    telegram_user.telegram_id,
                    "❌ Erro ao atualizar menu de comandos. Tente novamente."
                )
                return "menu_update_failed"
        
        else:
            await self.send_message(
                telegram_user.telegram_id,
                "❓ Comando não reconhecido.\n\n" +
                "📋 *Comandos disponíveis:*\n" +
                "/help - Guia completo\n" +
                "/comandos - Lista de comandos\n" +
                "/exemplos - Exemplos práticos\n" +
                "/status - Status da conta"
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
            
            # CORREÇÃO: Usar tenant_id para isolamento correto de dados
            tenant_id = user.tenant_id if user.tenant_id else user.id
            
            # Debug: Log do estado atual com informações de tenant
            logger.info(f"🔍 Processando mensagem: '{message}' para user_id: {user.id}, tenant_id: {tenant_id}")
            logger.info(f"🔍 Estado do SmartMCP: awaiting_responses = {enhanced_chat_service.smart_mcp.awaiting_responses}")
            logger.info(f"🔍 Estado do SmartMCP: pending_transactions = {enhanced_chat_service.smart_mcp.pending_transactions}")
            
            # Usar o Enhanced Chat Service com MCP (passando tenant_id para isolamento correto)
            response = await enhanced_chat_service.process_message(
                message=message,
                user_id=tenant_id  # CORREÇÃO: usar tenant_id para isolamento de dados
            )
            
            # Formatar resposta para Telegram
            resposta_text = response.get('resposta', 'Desculpe, não consegui processar sua mensagem.')
            
            # Se usou dados reais, adicionar indicador simples
            if response.get('fonte') == 'mcp_real_data':
                resposta_text = f"📊 {resposta_text}"
            
            # Debug: Log da mensagem antes de enviar
            logger.info(f"📤 Enviando para Telegram: {repr(resposta_text)}")
            
            # Enviar resposta
            await self.send_message(telegram_user.telegram_id, resposta_text)
            
            # Log para debug
            logger.info(f"💬 Telegram MCP: {message} → {response.get('fonte', 'generico')} (tenant: {tenant_id})")
            
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
            # Enviar mensagem de processamento
            await self.send_message(
                telegram_user.telegram_id,
                "📸 Processando sua foto... Um momento!"
            )
            
            # Pegar a foto de maior resolução
            largest_photo = max(photo, key=lambda p: p.get("file_size", 0))
            file_id = largest_photo.get("file_id")
            
            # Obter URL do arquivo
            async with httpx.AsyncClient() as client:
                logger.info(f"📸 Obtendo informações do arquivo: {file_id}")
                file_response = await client.get(f"{self.base_url}/getFile?file_id={file_id}")
                file_data = file_response.json()
                
                logger.info(f"📸 Resposta da API: {file_data}")
                
                if file_data.get("ok"):
                    file_path = file_data["result"]["file_path"]
                    file_url = f"https://api.telegram.org/file/bot{self.bot_token}/{file_path}"
                    
                    logger.info(f"📸 Baixando arquivo de: {file_url}")
                    
                    # Baixar arquivo
                    photo_response = await client.get(file_url)
                    photo_bytes = photo_response.content
                    
                    logger.info(f"📸 Arquivo baixado: {len(photo_bytes)} bytes")
                    
                    # Obter o usuário associado e corrigir isolamento por tenant
                    user = db.query(User).filter(User.id == telegram_user.user_id).first()
                    tenant_id_num = user.tenant_id if user.tenant_id else user.id
                    tenant_id_str = str(tenant_id_num)
                    
                    logger.info(f"📸 Processando com ChatAI Service para user: {user.id}, tenant: {tenant_id_num}")
                    
                    # Processar com ChatAIService mas depois integrar com estado do enhanced_chat_service
                    chat_service = ChatAIService(
                        db=db,
                        openai_api_key=settings.OPENAI_API_KEY,
                        tenant_id=tenant_id_str
                    )
                    
                    logger.info("📸 Chamando processar_imagem...")
                    result = await chat_service.processar_imagem(
                        file_content=photo_bytes,
                        filename="telegram_photo.jpg"
                    )
                    
                    # Verificar se ChatAI detectou uma transação e precisa de método de pagamento
                    if "Qual método de pagamento você usou?" in result['resposta']:
                        # Transferir estado para enhanced_chat_service para manter continuidade
                        # CORREÇÃO: usar tenant_id para isolamento correto
                        enhanced_chat_service.smart_mcp.awaiting_responses[tenant_id_num] = 'pagamento'
                        
                        # Dados da transação pending vão para pending_transactions
                        enhanced_chat_service.smart_mcp.pending_transactions[tenant_id_num] = {
                            'valor': result.get('detalhes', {}).get('extracted_data', {}).get('valor', 0),
                            'descricao': result.get('detalhes', {}).get('extracted_data', {}).get('descricao', ''),
                            'tipo': 'SAIDA',
                            'status': 'requer_pagamento'
                        }
                        logger.info(f"🔄 Estado transferido para enhanced_chat_service: tenant {tenant_id_num} - tipo: pagamento")
                    
                    response_text = result['resposta']
                    
                    logger.info(f"📸 Resultado da IA: {result}")
                    
                    await self.send_message(telegram_user.telegram_id, response_text)
                    logger.info("📸 Resposta enviada com sucesso!")
                    return "photo_processed"
                else:
                    logger.error(f"📸 Erro na API do Telegram: {file_data}")
                    await self.send_message(
                        telegram_user.telegram_id,
                        "❌ Erro ao baixar a foto do Telegram. Tente novamente."
                    )
                    return "telegram_api_error"
                
        except Exception as e:
            logger.error(f"Erro ao processar foto: {e}")
            await self.send_message(
                telegram_user.telegram_id,
                "❌ Erro ao processar a foto. Tente novamente."
            )
            return "error"
        
        return "photo_error"

    async def disconnect_telegram_user(self, db: Session, telegram_user: TelegramUser) -> str:
        """Desconectar usuário do Telegram da conta"""
        try:
            # Obter dados do usuário antes de desconectar
            user = None
            if telegram_user.user_id:
                user = db.query(User).filter(User.id == telegram_user.user_id).first()
            
            user_name = user.full_name if user else telegram_user.telegram_first_name
            
            # Limpar associação com a conta
            telegram_user.user_id = None
            telegram_user.is_authenticated = False
            telegram_user.auth_code = None
            telegram_user.auth_code_expires = None
            
            # Salvar alterações
            db.commit()
            
            # Limpar estados pendentes do Smart MCP Service se existir
            from .enhanced_chat_ai_service import enhanced_chat_service
            tenant_id_to_clean = user.tenant_id if user and user.tenant_id else (user.id if user else None)
            
            if tenant_id_to_clean:
                # Limpar estados pendentes apenas deste usuário/tenant
                if tenant_id_to_clean in enhanced_chat_service.smart_mcp.awaiting_responses:
                    del enhanced_chat_service.smart_mcp.awaiting_responses[tenant_id_to_clean]
                if tenant_id_to_clean in enhanced_chat_service.smart_mcp.pending_transactions:
                    del enhanced_chat_service.smart_mcp.pending_transactions[tenant_id_to_clean]
            
            # Enviar mensagem de confirmação
            disconnect_message = f"""
👋 *Telegram Desconectado com Sucesso!*

Olá {user_name}! Seu Telegram foi desvinculado da conta do FinançasAI.

🔓 *O que aconteceu:*
• Sua conta não está mais conectada a este Telegram
• Não será mais possível registrar/consultar transações
• Todos os estados de conversação foram limpos

🔗 *Para reconectar:*
• Digite /start para vincular novamente
• Use o mesmo código que aparece na aplicação web
• Seus dados financeiros continuam seguros na conta

💡 *Motivos comuns para desconectar:*
• Troca de celular/número
• Compartilhamento temporário do Telegram
• Limpeza de segurança

✅ *Seus dados estão seguros!*
Todas as transações e configurações permanecem na sua conta web.

Obrigado por usar o FinançasAI! 🚀
            """
            
            await self.send_message(telegram_user.telegram_id, disconnect_message)
            
            logger.info(f"🔓 Telegram desconectado: {telegram_user.telegram_id} (user: {user.email if user else 'N/A'})")
            
            return "telegram_disconnected"
            
        except Exception as e:
            logger.error(f"Erro ao desconectar Telegram: {e}")
            await self.send_message(
                telegram_user.telegram_id,
                "❌ Erro ao desconectar. Tente novamente ou contate o suporte."
            )
            return "disconnect_error"

    async def setup_bot_commands(self) -> bool:
        """Configurar comandos do menu do Telegram"""
        if not self.bot_token:
            logger.warning("⚠️ Não é possível configurar comandos: TELEGRAM_BOT_TOKEN não configurado")
            return False
            
        try:
            # Lista de comandos que realmente funcionam no bot
            commands = [
                {
                    "command": "start",
                    "description": "🔗 Iniciar e vincular sua conta"
                },
                {
                    "command": "help", 
                    "description": "📖 Guia completo de funcionalidades"
                },
                {
                    "command": "comandos",
                    "description": "📋 Lista todos os comandos disponíveis"
                },
                {
                    "command": "exemplos",
                    "description": "💡 Exemplos práticos de uso"
                },
                {
                    "command": "status",
                    "description": "📊 Status da sua conta vinculada"
                },
                {
                    "command": "sair",
                    "description": "🚪 Desconectar Telegram da conta"
                }
            ]
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/setMyCommands",
                    json={"commands": commands}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("ok"):
                        logger.info("✅ Comandos do menu do Telegram atualizados com sucesso!")
                        return True
                    else:
                        logger.error(f"❌ Erro na resposta da API: {result}")
                        return False
                else:
                    logger.error(f"❌ Erro HTTP ao configurar comandos: {response.status_code}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Erro ao configurar comandos do Telegram: {e}")
            return False

    async def get_bot_info(self) -> Dict[str, Any]:
        """Obter informações do bot"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/getMe")
                if response.status_code == 200:
                    return response.json()
                return {}
        except Exception as e:
            logger.error(f"Erro ao obter informações do bot: {e}")
            return {} 