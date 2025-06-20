import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..database import get_db
from ..models.notification import NotificationPreference
from ..models.telegram_user import TelegramUser
from ..models.user import User
from ..models.financial import Transacao, Conta, Cartao, Categoria
from ..services.telegram_service import TelegramService
from ..services.smart_mcp_service import SmartMCPService

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        self.telegram_service = TelegramService()
        self.smart_mcp = SmartMCPService()
        
    async def process_notifications(self, db: Session):
        """Processar todas as notificações que devem ser enviadas agora"""
        try:
            current_time = datetime.now()
            logger.info(f"🔔 Processando notificações para {current_time.strftime('%d/%m/%Y %H:%M')}")
            
            # Buscar todas as preferências ativas
            preferences = self._get_due_notifications(db, current_time)
            
            if not preferences:
                logger.info("📭 Nenhuma notificação para enviar agora")
                return
            
            logger.info(f"📬 Encontradas {len(preferences)} notificações para processar")
            
            # Processar cada notificação
            for preference in preferences:
                try:
                    await self._process_single_notification(db, preference, current_time)
                except Exception as e:
                    logger.error(f"❌ Erro ao processar notificação {preference.id}: {e}")
                    
        except Exception as e:
            logger.error(f"❌ Erro geral no processamento de notificações: {e}")
    
    def _get_due_notifications(self, db: Session, current_time: datetime) -> List[NotificationPreference]:
        """Buscar notificações que devem ser enviadas agora"""
        current_hour = current_time.hour
        current_weekday = current_time.weekday()  # 0=segunda, 6=domingo
        current_day = current_time.day
        
        # Converter weekday para padrão da aplicação (0=domingo)
        weekday_app = (current_weekday + 1) % 7
        
        # Query base - preferências ativas na hora atual
        base_query = db.query(NotificationPreference).filter(
            NotificationPreference.is_active == True,
            NotificationPreference.notification_hour == current_hour
        )
        
        # Filtros específicos por tipo
        daily_prefs = base_query.filter(NotificationPreference.notification_type == 'daily').all()
        
        weekly_prefs = base_query.filter(
            and_(
                NotificationPreference.notification_type == 'weekly',
                NotificationPreference.day_of_week == weekday_app
            )
        ).all()
        
        monthly_prefs = base_query.filter(
            and_(
                NotificationPreference.notification_type == 'monthly',
                NotificationPreference.day_of_month == current_day
            )
        ).all()
        
        all_prefs = daily_prefs + weekly_prefs + monthly_prefs
        
        logger.info(f"📊 Notificações encontradas: {len(daily_prefs)} diárias, {len(weekly_prefs)} semanais, {len(monthly_prefs)} mensais")
        
        return all_prefs
    
    async def _process_single_notification(self, db: Session, preference: NotificationPreference, current_time: datetime):
        """Processar uma única notificação"""
        try:
            # Buscar usuário do Telegram
            telegram_user = db.query(TelegramUser).filter(
                TelegramUser.telegram_id == str(preference.telegram_user_id),
                TelegramUser.is_authenticated == True
            ).first()
            
            if not telegram_user:
                logger.warning(f"⚠️ Usuário Telegram {preference.telegram_user_id} não encontrado ou não autenticado")
                return
            
            # Buscar dados do usuário
            user = db.query(User).filter(User.id == telegram_user.user_id).first()
            if not user:
                logger.warning(f"⚠️ Usuário {telegram_user.user_id} não encontrado")
                return
            
            # Gerar conteúdo da notificação
            message_content = await self._generate_notification_content(
                db, preference, user, current_time
            )
            
            # Enviar mensagem
            success = await self.telegram_service.send_message(
                telegram_user.telegram_id, 
                message_content
            )
            
            if success:
                logger.info(f"✅ Notificação {preference.notification_type} enviada para {user.full_name}")
            else:
                logger.error(f"❌ Falha ao enviar notificação para {user.full_name}")
                
        except Exception as e:
            logger.error(f"❌ Erro ao processar notificação individual: {e}")
    
    async def _generate_notification_content(
        self, 
        db: Session, 
        preference: NotificationPreference, 
        user: User, 
        current_time: datetime
    ) -> str:
        """Gerar conteúdo da notificação baseado nas preferências"""
        
        tenant_id = user.tenant_id if user.tenant_id else user.id
        
        # Cabeçalho baseado no tipo
        if preference.notification_type == 'daily':
            header = f"🌅 **Resumo Diário - {current_time.strftime('%d/%m/%Y')}**"
            period_start = current_time.replace(hour=0, minute=0, second=0, microsecond=0)
            period_end = current_time
        elif preference.notification_type == 'weekly':
            header = f"📊 **Resumo Semanal - {current_time.strftime('Semana de %d/%m/%Y')}**"
            period_start = current_time - timedelta(days=7)
            period_end = current_time
        else:  # monthly
            header = f"📈 **Relatório Mensal - {current_time.strftime('%B %Y')}**"
            first_day = current_time.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            period_start = first_day
            period_end = current_time
        
        content_parts = [f"Olá, {user.full_name}! 👋\n", header, ""]
        
        # Saldo atual (se solicitado)
        if preference.include_balance:
            balance_info = await self._get_balance_info(db, tenant_id)
            if balance_info:
                content_parts.extend(["💰 **Saldo Atual:**", balance_info, ""])
        
        # Transações do período (se solicitado)
        if preference.include_transactions:
            transactions_info = await self._get_transactions_info(db, tenant_id, period_start, period_end)
            if transactions_info:
                content_parts.extend(["💳 **Transações do Período:**", transactions_info, ""])
        
        # Gastos por categoria (se solicitado)
        if preference.include_categories:
            categories_info = await self._get_categories_info(db, tenant_id, period_start, period_end)
            if categories_info:
                content_parts.extend(["📊 **Gastos por Categoria:**", categories_info, ""])
        
        # Insights e análises (se solicitado)
        if preference.include_insights:
            insights_info = await self._get_insights_info(db, tenant_id, period_start, period_end, preference.notification_type)
            if insights_info:
                content_parts.extend(["💡 **Insights:**", insights_info, ""])
        
        # Rodapé
        content_parts.extend([
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            f"📱 *FinançasAI* - {current_time.strftime('%d/%m/%Y às %H:%M')}",
            "💬 Responda esta mensagem para interagir comigo!"
        ])
        
        return "\n".join(content_parts)
    
    async def _get_balance_info(self, db: Session, tenant_id: int) -> str:
        """Obter informações de saldo"""
        try:
            contas = db.query(Conta).filter(Conta.tenant_id == tenant_id).all()
            
            if not contas:
                return "Nenhuma conta cadastrada"
            
            total_saldo = sum(conta.saldo for conta in contas)
            
            info_parts = [f"💰 Total: R$ {total_saldo:,.2f}"]
            
            if len(contas) > 1:
                info_parts.append("\n📋 Detalhes:")
                for conta in contas:
                    emoji = "🏦" if conta.tipo == "CONTA_CORRENTE" else "💳" if conta.tipo == "CONTA_POUPANCA" else "💼"
                    info_parts.append(f"  {emoji} {conta.nome}: R$ {conta.saldo:,.2f}")
            
            return "\n".join(info_parts)
            
        except Exception as e:
            logger.error(f"Erro ao obter saldo: {e}")
            return "Erro ao consultar saldo"
    
    async def _get_transactions_info(self, db: Session, tenant_id: int, start_date: datetime, end_date: datetime) -> str:
        """Obter informações de transações do período"""
        try:
            transacoes = db.query(Transacao).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.data >= start_date,
                    Transacao.data <= end_date
                )
            ).order_by(Transacao.data.desc()).limit(10).all()
            
            if not transacoes:
                return "Nenhuma transação no período"
            
            # Calcular totais
            entradas = sum(t.valor for t in transacoes if t.tipo == 'ENTRADA')
            saidas = sum(t.valor for t in transacoes if t.tipo == 'SAIDA')
            
            info_parts = [
                f"📈 Entradas: R$ {entradas:,.2f}",
                f"📉 Saídas: R$ {saidas:,.2f}",
                f"💰 Saldo: R$ {entradas - saidas:,.2f}",
                ""
            ]
            
            if len(transacoes) <= 5:
                info_parts.append("📋 Últimas transações:")
                for transacao in transacoes[:5]:
                    emoji = "📈" if transacao.tipo == 'ENTRADA' else "📉"
                    data_str = transacao.data.strftime('%d/%m')
                    info_parts.append(f"  {emoji} {data_str} - {transacao.descricao}: R$ {transacao.valor:,.2f}")
            else:
                info_parts.append(f"📋 Total de {len(transacoes)} transações no período")
            
            return "\n".join(info_parts)
            
        except Exception as e:
            logger.error(f"Erro ao obter transações: {e}")
            return "Erro ao consultar transações"
    
    async def _get_categories_info(self, db: Session, tenant_id: int, start_date: datetime, end_date: datetime) -> str:
        """Obter gastos por categoria"""
        try:
            # Query para agrupar gastos por categoria
            from sqlalchemy import func
            
            result = db.query(
                Categoria.nome,
                Categoria.icone,
                func.sum(Transacao.valor).label('total')
            ).join(
                Transacao, Transacao.categoria_id == Categoria.id
            ).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.tipo == 'SAIDA',
                    Transacao.data >= start_date,
                    Transacao.data <= end_date
                )
            ).group_by(
                Categoria.id, Categoria.nome, Categoria.icone
            ).order_by(
                func.sum(Transacao.valor).desc()
            ).limit(5).all()
            
            if not result:
                return "Nenhum gasto por categoria no período"
            
            info_parts = ["📊 Top 5 categorias:"]
            for cat_nome, cat_icone, total in result:
                emoji = cat_icone if cat_icone else "📦"
                info_parts.append(f"  {emoji} {cat_nome}: R$ {total:,.2f}")
            
            return "\n".join(info_parts)
            
        except Exception as e:
            logger.error(f"Erro ao obter categorias: {e}")
            return "Erro ao consultar categorias"
    
    async def _get_insights_info(self, db: Session, tenant_id: int, start_date: datetime, end_date: datetime, notification_type: str) -> str:
        """Gerar insights automáticos"""
        try:
            insights = []
            
            # Análise de gastos
            transacoes = db.query(Transacao).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.data >= start_date,
                    Transacao.data <= end_date
                )
            ).all()
            
            if not transacoes:
                return "Sem dados suficientes para insights"
            
            saidas = [t for t in transacoes if t.tipo == 'SAIDA']
            entradas = [t for t in transacoes if t.tipo == 'ENTRADA']
            
            # Insight sobre maior gasto
            if saidas:
                maior_gasto = max(saidas, key=lambda x: x.valor)
                insights.append(f"💸 Maior gasto: {maior_gasto.descricao} (R$ {maior_gasto.valor:,.2f})")
            
            # Insight sobre frequência
            if len(saidas) > 0:
                media_diaria = len(saidas) / max(1, (end_date - start_date).days)
                if media_diaria > 3:
                    insights.append(f"⚠️ Alta frequência: {len(saidas)} gastos ({media_diaria:.1f}/dia)")
                elif media_diaria < 1:
                    insights.append(f"✅ Baixa frequência: {len(saidas)} gastos no período")
            
            # Insight sobre balanço
            total_entradas = sum(t.valor for t in entradas)
            total_saidas = sum(t.valor for t in saidas)
            
            if total_entradas > total_saidas:
                insights.append(f"📈 Mês positivo: Economia de R$ {total_entradas - total_saidas:,.2f}")
            elif total_saidas > total_entradas:
                insights.append(f"📉 Déficit: R$ {total_saidas - total_entradas:,.2f} a mais em gastos")
            
            # Dica baseada no tipo de notificação
            if notification_type == 'daily':
                insights.append("💡 Dica: Revise seus gastos diários para manter o controle")
            elif notification_type == 'weekly':
                insights.append("💡 Dica: Compare esta semana com a anterior para identificar padrões")
            else:
                insights.append("💡 Dica: Use este relatório para planejar o próximo mês")
            
            return "\n".join(insights) if insights else "Sem insights específicos para este período"
            
        except Exception as e:
            logger.error(f"Erro ao gerar insights: {e}")
            return "Erro ao gerar insights"
    
    async def send_test_notification(self, db: Session, user_id: int, notification_type: str):
        """Enviar notificação de teste"""
        try:
            # Buscar usuário
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"❌ Usuário {user_id} não encontrado")
                raise Exception("Usuário não encontrado")
            
            # Buscar telegram user
            telegram_user = db.query(TelegramUser).filter(
                TelegramUser.user_id == user_id,
                TelegramUser.is_authenticated == True
            ).first()
            
            if not telegram_user:
                logger.error(f"❌ Telegram não vinculado para usuário {user.full_name} (ID: {user_id})")
                raise Exception("Telegram não está vinculado. Conecte seu Telegram primeiro em Configurações > Telegram.")
            
            # Verificar se telegram_service está funcionando
            if not self.telegram_service:
                logger.error("❌ Telegram service não inicializado")
                raise Exception("Serviço do Telegram não disponível")
            
            # Criar preferência temporária para teste
            temp_preference = NotificationPreference(
                tenant_id=user.tenant_id or user.id,
                telegram_user_id=int(telegram_user.telegram_id),
                notification_type=notification_type,
                notification_hour=datetime.now().hour,
                include_balance=True,
                include_transactions=True,
                include_categories=True,
                include_insights=True,
                is_active=True
            )
            
            # Gerar conteúdo
            current_time = datetime.now()
            message_content = await self._generate_notification_content(
                db, temp_preference, user, current_time
            )
            
            # Adicionar cabeçalho de teste
            test_message = f"🧪 **NOTIFICAÇÃO DE TESTE**\n\n{message_content}"
            
            logger.info(f"📤 Enviando notificação de teste para {user.full_name} (Telegram: {telegram_user.telegram_id})")
            
            # Enviar
            success = await self.telegram_service.send_message(
                telegram_user.telegram_id, 
                test_message
            )
            
            if success:
                logger.info(f"✅ Notificação de teste enviada para {user.full_name}")
                return True
            else:
                logger.error(f"❌ Falha ao enviar notificação de teste para {user.full_name}")
                raise Exception("Falha ao enviar mensagem via Telegram")
                
        except Exception as e:
            logger.error(f"❌ Erro ao enviar notificação de teste: {e}")
            raise Exception(str(e))

# Instância global do serviço
notification_service = NotificationService() 