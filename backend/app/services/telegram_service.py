import httpx
import random
import string
import io
import tempfile
import os
import asyncio
import concurrent.futures
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
        
        # Cliente OpenAI com timeout configurado
        self.openai_client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=60.0  # 60 segundos de timeout
        )
        
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

    async def send_message_with_buttons(self, chat_id: str, text: str, reply_markup: dict, parse_mode: str = "Markdown") -> bool:
        """Enviar mensagem com botões inline para o usuário no Telegram"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": text,
                        "parse_mode": parse_mode,
                        "reply_markup": reply_markup
                    }
                )
                
                if response.status_code == 200:
                    logger.info(f"✅ Mensagem com botões enviada para {chat_id}")
                    return True
                else:
                    logger.error(f"❌ Erro ao enviar mensagem com botões: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Erro ao enviar mensagem com botões: {e}")
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
        
        # Verificar se há confirmações pendentes ANTES de processar qualquer comando
        pending_confirmations = await self._check_pending_confirmations(db, telegram_user)
        
        # Se há confirmações pendentes e a mensagem pode ser uma resposta
        if pending_confirmations and self._is_potential_confirmation_response(text):
            return await self._handle_confirmation_context(db, telegram_user, text, pending_confirmations)
        
        # Usuário autenticado - processar comando/mensagem normal
        if text.startswith("/"):
            return await self.process_command(db, telegram_user, text)
        else:
            return await self.process_chat_message(db, telegram_user, text)

    async def _check_pending_confirmations(self, db: Session, telegram_user: TelegramUser) -> list:
        """Verificar se há confirmações pendentes para este usuário"""
        try:
            from ..models.transacao_recorrente import ConfirmacaoTransacao
            from datetime import datetime
            
            confirmacoes = db.query(ConfirmacaoTransacao).filter(
                ConfirmacaoTransacao.tenant_id == telegram_user.user.tenant_id,
                ConfirmacaoTransacao.status == 'pendente',
                ConfirmacaoTransacao.expira_em > datetime.now()
            ).order_by(ConfirmacaoTransacao.criada_em.asc()).all()
            
            return confirmacoes
            
        except Exception as e:
            logger.error(f"❌ Erro ao verificar confirmações pendentes: {e}")
            return []

    def _is_potential_confirmation_response(self, text: str) -> bool:
        """Verificar se a mensagem pode ser uma resposta de confirmação"""
        text_clean = text.strip().lower()
        
        # Respostas numéricas simples
        if text_clean in ["1", "2"]:
            return True
            
        # Comandos específicos de confirmação
        if text_clean.startswith(("/confirmar", "/rejeitar", "/aprovar", "/cancelar")):
            return True
            
        # Respostas em português
        confirmation_words = [
            "sim", "não", "nao", "ok", "aprovar", "rejeitar", "confirmar", 
            "cancelar", "aceitar", "recusar", "yes", "no"
        ]
        
        if text_clean in confirmation_words:
            return True
            
        return False

    async def _handle_confirmation_context(self, db: Session, telegram_user: TelegramUser, text: str, confirmations: list) -> str:
        """Lidar com contexto de confirmação ativa"""
        try:
            text_clean = text.strip().lower()
            
            # Se há apenas UMA confirmação pendente, processar diretamente
            if len(confirmations) == 1:
                confirmacao = confirmations[0]
                
                if text_clean in ["1", "sim", "ok", "aprovar", "confirmar", "aceitar", "yes"]:
                    return await self._process_single_confirmation(db, confirmacao, "approve", telegram_user)
                elif text_clean in ["2", "não", "nao", "rejeitar", "cancelar", "recusar", "no"]:
                    return await self._process_single_confirmation(db, confirmacao, "reject", telegram_user)
            
            # Se há MÚLTIPLAS confirmações, exigir ID específico
            elif len(confirmations) > 1:
                # Verificar se é comando com ID específico
                if text_clean.startswith("/confirmar "):
                    try:
                        conf_id = int(text_clean.split(" ")[1])
                        confirmacao = next((c for c in confirmations if c.id == conf_id), None)
                        if confirmacao:
                            return await self._process_single_confirmation(db, confirmacao, "approve", telegram_user)
                        else:
                            await self.send_message(telegram_user.telegram_id, f"❌ Confirmação #{conf_id} não encontrada ou já processada.")
                            return "confirmation_not_found"
                    except (IndexError, ValueError):
                        pass
                
                elif text_clean.startswith("/rejeitar "):
                    try:
                        conf_id = int(text_clean.split(" ")[1])
                        confirmacao = next((c for c in confirmations if c.id == conf_id), None)
                        if confirmacao:
                            return await self._process_single_confirmation(db, confirmacao, "reject", telegram_user)
                        else:
                            await self.send_message(telegram_user.telegram_id, f"❌ Confirmação #{conf_id} não encontrada ou já processada.")
                            return "confirmation_not_found"
                    except (IndexError, ValueError):
                        pass
                
                # Se não especificou ID, mostrar lista de confirmações
                await self._send_pending_confirmations_list(telegram_user, confirmations)
                return "multiple_confirmations_listed"
            
            # Se chegou aqui, não foi possível processar como confirmação
            # Avisar sobre confirmações pendentes e processar como mensagem normal
            await self._send_confirmation_reminder(telegram_user, confirmations)
            return await self.process_chat_message(db, telegram_user, text)
            
        except Exception as e:
            logger.error(f"❌ Erro ao processar contexto de confirmação: {e}")
            return "context_error"

    async def _process_single_confirmation(self, db: Session, confirmacao, action: str, telegram_user: TelegramUser) -> str:
        """Processar uma confirmação específica"""
        try:
            from ..models.financial import Transacao
            from datetime import datetime
            
            agora = datetime.now()
            
            if action == "approve":
                # Criar transação
                nova_transacao = Transacao(
                    descricao=confirmacao.descricao,
                    valor=confirmacao.valor,
                    tipo=confirmacao.tipo,
                    data=datetime.combine(confirmacao.data_transacao, agora.time()),
                    categoria_id=confirmacao.categoria_id,
                    conta_id=confirmacao.conta_id,
                    cartao_id=confirmacao.cartao_id,
                    tenant_id=confirmacao.tenant_id,
                    created_by_name=f"{telegram_user.telegram_first_name} (Telegram)",
                    observacoes=f"Aprovada via Telegram. Confirmação ID: {confirmacao.id}",
                    processado_por_ia=False
                )
                
                db.add(nova_transacao)
                db.flush()
                
                # Atualizar confirmação
                confirmacao.status = 'confirmada'
                confirmacao.transacao_id = nova_transacao.id
                confirmacao.processada_em = agora
                
                db.commit()
                
                await self.send_message(
                    telegram_user.telegram_id,
                    f"✅ **Confirmação #{confirmacao.id} APROVADA**\n\n💰 {confirmacao.descricao}\n💵 R$ {confirmacao.valor:.2f}\n📅 {confirmacao.data_transacao.strftime('%d/%m/%Y')}\n\n🎯 Transação criada com sucesso!"
                )
                
                return "confirmed"
                
            elif action == "reject":
                # Rejeitar
                confirmacao.status = 'cancelada'
                confirmacao.processada_em = agora
                
                db.commit()
                
                await self.send_message(
                    telegram_user.telegram_id,
                    f"❌ **Confirmação #{confirmacao.id} REJEITADA**\n\n💰 {confirmacao.descricao}\n💵 R$ {confirmacao.valor:.2f}\n📅 {confirmacao.data_transacao.strftime('%d/%m/%Y')}\n\n🚫 Transação não será criada."
                )
                
                return "rejected"
                
        except Exception as e:
            logger.error(f"❌ Erro ao processar confirmação: {e}")
            await self.send_message(
                telegram_user.telegram_id,
                "❌ Erro interno ao processar confirmação. Tente novamente."
            )
            return "processing_error"

    async def _send_pending_confirmations_list(self, telegram_user: TelegramUser, confirmations: list):
        """Enviar lista de confirmações pendentes"""
        message = "📋 **Você tem múltiplas confirmações pendentes:**\n\n"
        
        for i, conf in enumerate(confirmations, 1):
            message += f"**#{conf.id}** - {conf.descricao}\n"
            message += f"💵 R$ {conf.valor:.2f} | ⏰ Expira: {conf.expira_em.strftime('%H:%M')}\n\n"
        
        message += "🎯 **Para confirmar especificamente:**\n"
        message += "• `/confirmar [ID]` - Ex: `/confirmar 123`\n"
        message += "• `/rejeitar [ID]` - Ex: `/rejeitar 123`\n\n"
        message += "💡 **Ou use os botões na mensagem original**"
        
        await self.send_message(telegram_user.telegram_id, message)

    async def _send_confirmation_reminder(self, telegram_user: TelegramUser, confirmations: list):
        """Enviar lembrete sobre confirmações pendentes"""
        if len(confirmations) == 1:
            conf = confirmations[0]
            message = f"💡 **Lembrete:** Você tem 1 confirmação pendente:\n\n"
            message += f"**#{conf.id}** - {conf.descricao} (R$ {conf.valor:.2f})\n"
            message += f"⏰ Expira: {conf.expira_em.strftime('%d/%m às %H:%M')}\n\n"
            message += "🎯 Use os botões na mensagem ou digite:\n"
            message += f"• `/confirmar {conf.id}` para aprovar\n"
            message += f"• `/rejeitar {conf.id}` para rejeitar"
        else:
            message = f"💡 **Lembrete:** Você tem {len(confirmations)} confirmações pendentes.\n\n"
            message += "📋 Digite `/confirmacoes` para ver a lista completa."
        
        await self.send_message(telegram_user.telegram_id, message)

    async def process_command(self, db: Session, telegram_user: TelegramUser, command: str) -> str:
        """Processar comandos do bot"""
        if command == "/start":
            await self.send_message(
                telegram_user.telegram_id,
                f"👋 Olá, {telegram_user.telegram_first_name}! Sua conta já está vinculada.\n\n" +
                "💬 Envie uma mensagem, 🎤 áudio ou 📸 foto para começar!"
            )
            return "start_authenticated"
        
        elif command == "/confirmacoes":
            # Listar confirmações pendentes
            pending_confirmations = await self._check_pending_confirmations(db, telegram_user)
            
            if not pending_confirmations:
                await self.send_message(
                    telegram_user.telegram_id,
                    "✅ **Nenhuma confirmação pendente**\n\nVocê não tem transações aguardando confirmação no momento."
                )
                return "no_pending_confirmations"
            
            await self._send_pending_confirmations_list(telegram_user, pending_confirmations)
            return "confirmations_listed"
        
        elif command == "/help":
            help_text = """
🤖 *FinançasAI Bot - Guia Completo*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 *COMO USAR:*
Este bot entende *linguagem natural*! Converse normalmente sobre suas finanças.

💰 *REGISTRAR TRANSAÇÕES:*
• "Gastei R$ 50 no supermercado"
• "Recebi R$ 1000 de salário"
• "Paguei R$ 80 de luz"

📊 *CONSULTAS FINANCEIRAS:*
• "Quanto gastei este mês?"
• "Qual meu saldo atual?"
• "Gastos por categoria"
• "Extrato da semana"

🔔 *CONFIRMAÇÕES DE TRANSAÇÕES:*
• `/confirmacoes` - Ver confirmações pendentes
• `/confirmar [ID]` - Aprovar transação específica
• `/rejeitar [ID]` - Rejeitar transação específica

🎤 *ÁUDIO:*
Envie mensagens de voz para registrar transações rapidamente!

📸 *FOTOS:*
Envie fotos de notas fiscais e comprovantes para análise automática.

⚙️ *COMANDOS:*
• `/help` - Esta ajuda
• `/confirmacoes` - Listar confirmações pendentes

💡 *DICA:* Seja específico! Quanto mais detalhes, melhor a análise."""
            
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
        """Processar mensagem de chat comum"""
        try:
            # Verificar se é resposta de confirmação (1 ou 2)
            if message.strip() in ["1", "2"]:
                return await self.process_confirmation_response(db, telegram_user, message.strip())
            
            # Se não for confirmação, processar como chat normal
            if not telegram_user.user:
                await self.send_message(
                    telegram_user.telegram_id,
                    "❌ Erro: Conta não está corretamente vinculada. Digite /start para reconfigurar."
                )
                return "user_not_linked"
            
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
            
            # Construir nome completo do usuário do Telegram
            telegram_user_name = telegram_user.telegram_first_name
            if telegram_user.telegram_last_name:
                telegram_user_name += f" {telegram_user.telegram_last_name}"
            if telegram_user.telegram_username:
                telegram_user_name += f" (@{telegram_user.telegram_username})"
            
            # Usar o Enhanced Chat Service com MCP (passando tenant_id para isolamento correto)
            response = await enhanced_chat_service.process_message(
                message=message,
                user_id=tenant_id,  # CORREÇÃO: usar tenant_id para isolamento de dados
                telegram_user_name=telegram_user_name  # Adicionar nome do usuário do Telegram
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
            logger.info(f"💬 Telegram MCP: {message} → {response.get('fonte', 'generico')} (tenant: {tenant_id}, user: {telegram_user_name})")
            
            return "message_processed"
            
        except Exception as e:
            logger.error(f"Erro ao processar mensagem: {e}")
            await self.send_message(
                telegram_user.telegram_id,
                "❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente."
            )
            return "error"

    async def process_audio(self, db: Session, telegram_data: Dict[str, Any]) -> str:
        """Processar áudio/voice enviado pelo usuário com melhor tratamento de erros"""
        message = telegram_data.get("message", {})
        user_data = message.get("from", {})
        
        # Pode ser voice ou audio
        audio_data = message.get("voice") or message.get("audio")
        
        if not audio_data:
            logger.warning("❌ Nenhum dado de áudio encontrado na mensagem")
            return "no_audio"
        
        telegram_user = self.get_or_create_telegram_user(db, user_data)
        logger.info(f"🎤 Processando áudio do usuário: {telegram_user.telegram_id}")
        
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
            file_size = audio_data.get("file_size", 0)
            duration = audio_data.get("duration", 0)
            
            logger.info(f"🎤 Arquivo: {file_id}, Tamanho: {file_size} bytes, Duração: {duration}s")
            
            # Verificar limite de tamanho (20MB)
            if file_size > 20 * 1024 * 1024:
                await self.send_message(
                    telegram_user.telegram_id,
                    "❌ Arquivo muito grande. O limite é 20MB."
                )
                return "file_too_large"
            
            # Verificar duração (5 minutos)
            if duration > 300:
                await self.send_message(
                    telegram_user.telegram_id,
                    "❌ Áudio muito longo. O limite é 5 minutos."
                )
                return "audio_too_long"
            
            # Baixar arquivo com timeout
            async with httpx.AsyncClient(timeout=60.0) as client:
                logger.info(f"🎤 Obtendo informações do arquivo: {file_id}")
                
                # Obter informações do arquivo
                file_response = await client.get(f"{self.base_url}/getFile?file_id={file_id}")
                file_data = file_response.json()
                
                logger.info(f"🎤 Resposta da API: {file_data}")
                
                if not file_data.get("ok"):
                    error_msg = file_data.get("description", "Erro desconhecido")
                    logger.error(f"❌ Erro ao obter arquivo: {error_msg}")
                    await self.send_message(
                        telegram_user.telegram_id,
                        f"❌ Erro ao acessar o arquivo: {error_msg}"
                    )
                    return "file_access_error"
                
                file_path = file_data["result"]["file_path"]
                file_url = f"https://api.telegram.org/file/bot{self.bot_token}/{file_path}"
                
                logger.info(f"🎤 Baixando áudio de: {file_url}")
                
                # Baixar conteúdo do áudio
                audio_response = await client.get(file_url)
                
                if audio_response.status_code != 200:
                    logger.error(f"❌ Erro ao baixar áudio: Status {audio_response.status_code}")
                    await self.send_message(
                        telegram_user.telegram_id,
                        "❌ Erro ao baixar o arquivo de áudio."
                    )
                    return "download_error"
                
                audio_bytes = audio_response.content
                logger.info(f"🎤 Áudio baixado: {len(audio_bytes)} bytes")
                
                # Converter áudio para texto usando Whisper
                logger.info("🎤 Iniciando transcrição com Whisper...")
                text = await self._transcribe_audio(audio_bytes, file_path)
                
                if not text or text.strip() == "":
                    logger.warning("❌ Transcrição retornou texto vazio")
                    await self.send_message(
                        telegram_user.telegram_id,
                        "❌ Não consegui entender o áudio. Tente falar mais claramente ou verificar se há ruído de fundo."
                    )
                    return "transcription_failed"
                
                logger.info(f"✅ Transcrição bem-sucedida: '{text[:100]}...'")
                
                # Mostrar texto transcrito
                await self.send_message(
                    telegram_user.telegram_id,
                    f"📝 *Entendi:* {text}\n\n⏳ Processando sua solicitação..."
                )
                
                # Processar texto transcrito como se fosse uma mensagem normal
                logger.info("🎤 Enviando texto transcrito para processamento...")
                result = await self.process_chat_message(db, telegram_user, text)
                logger.info(f"✅ Processamento de áudio concluído: {result}")
                return result
                
        except asyncio.TimeoutError:
            logger.error("⏰ Timeout ao processar áudio")
            await self.send_message(
                telegram_user.telegram_id,
                "❌ Timeout ao processar o áudio. O arquivo pode ser muito grande ou haver problemas de conexão."
            )
            return "timeout_error"
            
        except Exception as e:
            logger.error(f"❌ Erro inesperado ao processar áudio: {str(e)}", exc_info=True)
            await self.send_message(
                telegram_user.telegram_id,
                "❌ Erro inesperado ao processar o áudio. Tente novamente em alguns instantes."
            )
            return "unexpected_error"

    async def _transcribe_audio(self, audio_bytes: bytes, file_path: str) -> Optional[str]:
        """Converter áudio em texto usando Whisper API com melhor tratamento de erros"""
        temp_file_path = None
        try:
            # Determinar extensão do arquivo
            file_extension = os.path.splitext(file_path)[1] or '.ogg'
            logger.info(f"🎤 Extensão do arquivo: {file_extension}")
            
            # Verificar tamanho mínimo
            if len(audio_bytes) < 100:
                logger.warning("❌ Arquivo de áudio muito pequeno")
                return None
            
            # Criar arquivo temporário
            with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
                temp_file.write(audio_bytes)
                temp_file_path = temp_file.name
            
            logger.info(f"🎤 Arquivo temporário criado: {temp_file_path}")
            
            try:
                # Usar Whisper para transcrever com timeout
                logger.info("🎤 Enviando para Whisper API...")
                
                # Executar transcrição de forma assíncrona
                def transcribe_sync():
                    with open(temp_file_path, 'rb') as audio_file:
                        return self.openai_client.audio.transcriptions.create(
                            model="whisper-1",
                            file=audio_file,
                            language="pt",  # Forçar português
                            response_format="text"  # Resposta mais simples
                        )
                
                # Executar em thread separada com timeout
                loop = asyncio.get_event_loop()
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    try:
                        transcription = await asyncio.wait_for(
                            loop.run_in_executor(executor, transcribe_sync),
                            timeout=45.0  # 45 segundos timeout
                        )
                        
                        logger.info("✅ Transcrição recebida da API")
                        
                        # Para response_format="text", já retorna string diretamente
                        if isinstance(transcription, str):
                            result = transcription.strip()
                        else:
                            result = transcription.text.strip()
                        
                        if not result:
                            logger.warning("❌ Transcrição retornou texto vazio")
                            return None
                            
                        logger.info(f"✅ Transcrição: '{result[:50]}...'")
                        return result
                        
                    except asyncio.TimeoutError:
                        logger.error("⏰ Timeout na API do Whisper")
                        return None
                        
            except Exception as whisper_error:
                logger.error(f"❌ Erro específico do Whisper: {str(whisper_error)}")
                return None
                
            finally:
                # Remover arquivo temporário
                try:
                    if temp_file_path and os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                        logger.info("🗑️ Arquivo temporário removido")
                except Exception as cleanup_error:
                    logger.warning(f"⚠️ Erro ao remover arquivo temporário: {cleanup_error}")
                
        except Exception as e:
            logger.error(f"❌ Erro geral na transcrição: {str(e)}", exc_info=True)
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
                        
                        # Construir nome completo do usuário do Telegram
                        telegram_user_name = telegram_user.telegram_first_name
                        if telegram_user.telegram_last_name:
                            telegram_user_name += f" {telegram_user.telegram_last_name}"
                        if telegram_user.telegram_username:
                            telegram_user_name += f" (@{telegram_user.telegram_username})"
                        
                        # Dados da transação pending vão para pending_transactions
                        enhanced_chat_service.smart_mcp.pending_transactions[tenant_id_num] = {
                            'valor': result.get('detalhes', {}).get('extracted_data', {}).get('valor', 0),
                            'descricao': result.get('detalhes', {}).get('extracted_data', {}).get('descricao', ''),
                            'tipo': 'SAIDA',
                            'status': 'requer_pagamento',
                            'created_by_name': telegram_user_name  # Adicionar nome do usuário
                        }
                        logger.info(f"🔄 Estado transferido para enhanced_chat_service: tenant {tenant_id_num} - tipo: pagamento, usuário: {telegram_user_name}")
                    
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

    async def process_confirmation_response(self, db: Session, telegram_user: TelegramUser, response: str) -> str:
        """Processar resposta de confirmação (1 ou 2)"""
        # Este método permanece para compatibilidade com mensagens de texto
        if response == "1":
            await self.send_message(
                telegram_user.telegram_id,
                "✅ *Transação aprovada!*\n\nSua transação será criada automaticamente."
            )
            return "approved"
        elif response == "2":
            await self.send_message(
                telegram_user.telegram_id,
                "❌ *Transação rejeitada!*\n\nA transação não será criada."
            )
            return "rejected"
        else:
            await self.send_message(
                telegram_user.telegram_id,
                "❓ Resposta não compreendida. Use:\n\n*1* - Aprovar ✅\n*2* - Rejeitar ❌"
            )
            return "invalid"

    async def process_confirmation_callback(self, db: Session, callback_query: dict) -> str:
        """Processar callback de botões inline de confirmação"""
        try:
            from ..models.transacao_recorrente import ConfirmacaoTransacao
            from ..models.financial import Transacao
            from datetime import datetime
            
            callback_data = callback_query.get("data", "")
            user_data = callback_query.get("from", {})
            query_id = callback_query.get("id")
            
            # Parse do callback_data: confirm_{confirmacao_id}_{action}
            parts = callback_data.split("_")
            if len(parts) != 3 or parts[0] != "confirm":
                await self._answer_callback_query(query_id, "❌ Comando inválido", show_alert=True)
                return "invalid_command"
            
            confirmacao_id = int(parts[1])
            action = parts[2]  # approve, reject, details
            
            # Buscar usuário do Telegram
            telegram_user = self.get_or_create_telegram_user(db, user_data)
            if not telegram_user.is_authenticated:
                await self._answer_callback_query(query_id, "❌ Usuário não autenticado", show_alert=True)
                return "not_authenticated"
            
            # Buscar confirmação
            confirmacao = db.query(ConfirmacaoTransacao).filter(
                ConfirmacaoTransacao.id == confirmacao_id,
                ConfirmacaoTransacao.status == 'pendente'
            ).first()
            
            if not confirmacao:
                await self._answer_callback_query(query_id, "❌ Confirmação não encontrada ou já processada", show_alert=True)
                return "not_found"
            
            # Verificar se o usuário tem permissão (mesmo tenant)
            if confirmacao.tenant_id != telegram_user.user.tenant_id:
                await self._answer_callback_query(query_id, "❌ Sem permissão para esta confirmação", show_alert=True)
                return "no_permission"
            
            agora = datetime.now()
            
            if action == "approve":
                # Aprovar transação
                nova_transacao = Transacao(
                    descricao=confirmacao.descricao,
                    valor=confirmacao.valor,
                    tipo=confirmacao.tipo,
                    data=datetime.combine(confirmacao.data_transacao, agora.time()),
                    categoria_id=confirmacao.categoria_id,
                    conta_id=confirmacao.conta_id,
                    cartao_id=confirmacao.cartao_id,
                    tenant_id=confirmacao.tenant_id,
                    created_by_name=f"{telegram_user.telegram_first_name} (Telegram)",
                    observacoes=f"Aprovada via Telegram. Confirmação ID: {confirmacao.id}",
                    processado_por_ia=False
                )
                
                db.add(nova_transacao)
                db.flush()
                
                # Atualizar confirmação
                confirmacao.status = 'confirmada'
                confirmacao.transacao_id = nova_transacao.id
                confirmacao.processada_em = agora
                
                db.commit()
                
                # Responder ao callback
                await self._answer_callback_query(query_id, "✅ Transação aprovada com sucesso!")
                
                # Editar mensagem original
                await self._edit_message_with_result(
                    telegram_user.telegram_id,
                    callback_query.get("message", {}).get("message_id"),
                    f"✅ **APROVADA** - Confirmação #{confirmacao_id}\n\n💰 {confirmacao.descricao}\n💵 R$ {confirmacao.valor:.2f}\n📅 {confirmacao.data_transacao.strftime('%d/%m/%Y')}\n\n👤 Aprovada por: {telegram_user.telegram_first_name}\n⏰ Em: {agora.strftime('%d/%m/%Y às %H:%M')}"
                )
                
                return "approved"
            
            elif action == "reject":
                # Rejeitar transação
                confirmacao.status = 'cancelada'
                confirmacao.processada_em = agora
                
                db.commit()
                
                # Responder ao callback
                await self._answer_callback_query(query_id, "❌ Transação rejeitada")
                
                # Editar mensagem original
                await self._edit_message_with_result(
                    telegram_user.telegram_id,
                    callback_query.get("message", {}).get("message_id"),
                    f"❌ **REJEITADA** - Confirmação #{confirmacao_id}\n\n💰 {confirmacao.descricao}\n💵 R$ {confirmacao.valor:.2f}\n📅 {confirmacao.data_transacao.strftime('%d/%m/%Y')}\n\n👤 Rejeitada por: {telegram_user.telegram_first_name}\n⏰ Em: {agora.strftime('%d/%m/%Y às %H:%M')}"
                )
                
                return "rejected"
            
            elif action == "details":
                # Mostrar detalhes
                detalhes = f"""📋 **Detalhes da Confirmação #{confirmacao_id}**

💰 **Descrição:** {confirmacao.descricao}
💵 **Valor:** R$ {confirmacao.valor:.2f}
📅 **Data:** {confirmacao.data_transacao.strftime('%d/%m/%Y')}
⏰ **Expira em:** {confirmacao.expira_em.strftime('%d/%m às %H:%M')}

📊 **Categoria:** {confirmacao.categoria.nome if confirmacao.categoria else 'N/A'}
🏦 **Conta:** {confirmacao.conta.nome if confirmacao.conta else 'N/A'}
💳 **Cartão:** {confirmacao.cartao.nome if confirmacao.cartao else 'N/A'}

⚡ **Status:** {confirmacao.status.upper()}
🆔 **ID:** {confirmacao.id}"""
                
                await self._answer_callback_query(query_id, detalhes, show_alert=True)
                return "details_shown"
            
            else:
                await self._answer_callback_query(query_id, "❌ Ação inválida", show_alert=True)
                return "invalid_action"
                
        except Exception as e:
            logger.error(f"❌ Erro ao processar callback de confirmação: {e}")
            await self._answer_callback_query(query_id, "❌ Erro interno do servidor", show_alert=True)
            return "error"

    async def _answer_callback_query(self, query_id: str, text: str, show_alert: bool = False) -> bool:
        """Responder a um callback query"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/answerCallbackQuery",
                    json={
                        "callback_query_id": query_id,
                        "text": text,
                        "show_alert": show_alert
                    }
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"❌ Erro ao responder callback query: {e}")
            return False

    async def _edit_message_with_result(self, chat_id: str, message_id: int, new_text: str) -> bool:
        """Editar mensagem com resultado da confirmação"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/editMessageText",
                    json={
                        "chat_id": chat_id,
                        "message_id": message_id,
                        "text": new_text,
                        "parse_mode": "Markdown"
                    }
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"❌ Erro ao editar mensagem: {e}")
            return False 