import logging
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Dict, Any, Optional

from ..database import get_db
from ..models.transacao_recorrente import TransacaoRecorrente, ConfirmacaoTransacao
from ..models.financial import Transacao, TipoTransacao
from ..models.telegram_user import TelegramUser
from ..api.transacoes_recorrentes import calcular_proximo_vencimento
from ..models.user import User

logger = logging.getLogger(__name__)

class AgendadorService:
    """Serviço para processar transações recorrentes e criar transações reais"""
    
    @staticmethod
    def processar_transacoes_do_dia(data_processamento: date = None) -> Dict[str, Any]:
        """
        Processa todas as transações recorrentes que vencem na data especificada
        """
        if data_processamento is None:
            data_processamento = date.today()
            
        logger.info(f"🔄 Iniciando processamento de transações recorrentes para {data_processamento}")
        
        db = next(get_db())
        try:
            # Buscar todas as transações recorrentes ativas
            transacoes_recorrentes = db.query(TransacaoRecorrente).filter(
                TransacaoRecorrente.ativa == True,
                TransacaoRecorrente.data_inicio <= data_processamento,
                # Se tem data_fim, verificar se ainda não expirou
                or_(
                    TransacaoRecorrente.data_fim.is_(None),
                    TransacaoRecorrente.data_fim >= data_processamento
                )
            ).all()
            
            estatisticas = {
                "data_processamento": data_processamento.isoformat(),
                "total_recorrentes_ativas": len(transacoes_recorrentes),
                "processadas": 0,
                "criadas": 0,
                "erros": 0,
                "detalhes": []
            }
            
            for transacao_recorrente in transacoes_recorrentes:
                try:
                    resultado = AgendadorService._processar_transacao_individual(
                        db, transacao_recorrente, data_processamento
                    )
                    
                    estatisticas["processadas"] += 1
                    if resultado["criada"]:
                        estatisticas["criadas"] += 1
                        
                    estatisticas["detalhes"].append(resultado)
                    
                except Exception as e:
                    logger.error(f"❌ Erro ao processar transação {transacao_recorrente.id}: {e}")
                    estatisticas["erros"] += 1
                    estatisticas["detalhes"].append({
                        "transacao_recorrente_id": transacao_recorrente.id,
                        "descricao": transacao_recorrente.descricao,
                        "erro": str(e),
                        "criada": False
                    })
            
            db.commit()
            logger.info(f"✅ Processamento concluído: {estatisticas['criadas']} transações criadas, {estatisticas['erros']} erros")
            return estatisticas
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Erro geral no processamento: {e}")
            raise
        finally:
            db.close()
    
    @staticmethod
    def _processar_transacao_individual(
        db: Session, 
        transacao_recorrente: TransacaoRecorrente, 
        data_processamento: date
    ) -> Dict[str, Any]:
        """Processa uma transação recorrente individual"""
        # Calcular próximo vencimento
        proximo_vencimento = calcular_proximo_vencimento(
            transacao_recorrente.data_inicio,
            transacao_recorrente.frequencia
        )
        
        resultado = {
            "transacao_recorrente_id": transacao_recorrente.id,
            "descricao": transacao_recorrente.descricao,
            "proximo_vencimento": proximo_vencimento.isoformat(),
            "criada": False,
            "confirmacao_criada": False,
            "transacao_id": None,
            "confirmacao_id": None,
            "motivo": None
        }
        
        # Verificar se deve criar transação hoje
        if proximo_vencimento == data_processamento:
            # Verificar se já existe transação para esta data
            transacao_existente = db.query(Transacao).filter(
                Transacao.tenant_id == transacao_recorrente.tenant_id,
                Transacao.descricao == f"[AUTO] {transacao_recorrente.descricao}",
                Transacao.data >= datetime.combine(data_processamento, datetime.min.time()),
                Transacao.data < datetime.combine(data_processamento + timedelta(days=1), datetime.min.time())
            ).first()
            
            if transacao_existente:
                resultado["motivo"] = "Transação já existe para esta data"
                resultado["transacao_id"] = transacao_existente.id
                logger.info(f"⚠️ Transação já existe: {transacao_recorrente.descricao}")
            else:
                # Verificar se usuário quer confirmação via Telegram
                telegram_user = None
                try:
                    # Buscar o usuário específico que criou esta transação recorrente
                    # Primeiro, tenta encontrar pelo nome (created_by_name)
                    if transacao_recorrente.created_by_name:
                        # Buscar usuários do tenant
                        from ..models.user import User
                        
                        # Primeiro, encontrar o usuário por nome
                        user = db.query(User).filter(
                            User.tenant_id == transacao_recorrente.tenant_id,
                            User.full_name == transacao_recorrente.created_by_name
                        ).first()
                        
                        if user:
                            # Depois, buscar o telegram_user
                            telegram_user = db.query(TelegramUser).filter(
                                TelegramUser.user_id == user.id,
                                TelegramUser.is_authenticated == True,
                                TelegramUser.confirmar_transacoes_recorrentes == True
                            ).first()
                    
                    # Se não encontrou, busca qualquer usuário do tenant com confirmação ativada
                    if not telegram_user:
                        # Buscar qualquer usuário do tenant
                        from ..models.user import User
                        
                        users_do_tenant = db.query(User).filter(
                            User.tenant_id == transacao_recorrente.tenant_id
                        ).all()
                        
                        for user in users_do_tenant:
                            telegram_user = db.query(TelegramUser).filter(
                                TelegramUser.user_id == user.id,
                                TelegramUser.is_authenticated == True,
                                TelegramUser.confirmar_transacoes_recorrentes == True
                            ).first()
                            
                            if telegram_user:
                                logger.info(f"⚠️ Transação recorrente criada por '{transacao_recorrente.created_by_name}' - usando configuração de '{user.full_name}'")
                                break
                    
                except Exception as e:
                    # Campos não existem ainda (migração não executada)
                    if "does not exist" in str(e):
                        logger.warning("⚠️ Campos de confirmação não existem - execute a migração")
                        telegram_user = None
                    else:
                        logger.error(f"❌ Erro ao buscar configuração telegram: {e}")
                        telegram_user = None  # Continuar sem confirmação ao invés de falhar
                
                if telegram_user:
                    # Criar confirmação ao invés de transação direta
                    resultado_confirmacao = AgendadorService._criar_confirmacao(
                        db, transacao_recorrente, data_processamento, telegram_user
                    )
                    resultado.update(resultado_confirmacao)
                else:
                    # Criar transação diretamente (comportamento padrão)
                    resultado_transacao = AgendadorService._criar_transacao_direta(
                        db, transacao_recorrente, data_processamento
                    )
                    resultado.update(resultado_transacao)
        else:
            resultado["motivo"] = f"Não é dia de vencimento (próximo: {proximo_vencimento})"
        
        return resultado
    
    @staticmethod
    def _criar_confirmacao(
        db: Session, 
        transacao_recorrente: TransacaoRecorrente, 
        data_processamento: date,
        telegram_user: TelegramUser
    ) -> Dict[str, Any]:
        """Cria uma confirmação pendente para a transação recorrente"""
        
        # Verificar se o campo existe e obter timeout (com fallback)
        try:
            timeout_horas = telegram_user.timeout_confirmacao_horas
        except AttributeError:
            timeout_horas = 2  # Fallback padrão
            logger.warning("⚠️ Campo timeout_confirmacao_horas não existe - usando padrão: 2h")
        
        # Calcular tempo de expiração
        expira_em = datetime.combine(data_processamento, datetime.now().time()) + timedelta(
            hours=timeout_horas
        )
        
        # Criar confirmação
        confirmacao = ConfirmacaoTransacao(
            transacao_recorrente_id=transacao_recorrente.id,
            descricao=f"[AUTO] {transacao_recorrente.descricao}",
            valor=transacao_recorrente.valor,
            tipo=transacao_recorrente.tipo,
            categoria_id=transacao_recorrente.categoria_id,
            conta_id=transacao_recorrente.conta_id,
            cartao_id=transacao_recorrente.cartao_id,
            data_transacao=data_processamento,
            expira_em=expira_em,
            telegram_user_id=telegram_user.telegram_id,
            criada_por_usuario=transacao_recorrente.created_by_name,
            tenant_id=transacao_recorrente.tenant_id,
            observacoes=f"Aguardando confirmação para recorrência ID: {transacao_recorrente.id}"
        )
        
        db.add(confirmacao)
        db.flush()  # Para obter o ID
        
        # Enviar notificação via Telegram (async - não bloqueia)
        try:
            AgendadorService._enviar_notificacao_confirmacao(confirmacao, telegram_user)
        except Exception as e:
            logger.error(f"❌ Erro ao enviar notificação de confirmação: {e}")
        
        logger.info(f"📋 Confirmação criada: {confirmacao.descricao} - ID: {confirmacao.id}")
        
        return {
            "confirmacao_criada": True,
            "confirmacao_id": confirmacao.id,
            "motivo": f"Confirmação criada - expira em {timeout_horas}h"
        }
    
    @staticmethod
    def _criar_transacao_direta(
        db: Session, 
        transacao_recorrente: TransacaoRecorrente, 
        data_processamento: date
    ) -> Dict[str, Any]:
        """Cria transação diretamente (comportamento padrão)"""
        
        nova_transacao = Transacao(
            descricao=f"[AUTO] {transacao_recorrente.descricao}",
            valor=transacao_recorrente.valor,
            tipo=transacao_recorrente.tipo,
            data=datetime.combine(data_processamento, datetime.now().time()),
            categoria_id=transacao_recorrente.categoria_id,
            conta_id=transacao_recorrente.conta_id,
            cartao_id=transacao_recorrente.cartao_id,
            tenant_id=transacao_recorrente.tenant_id,
            created_by_name="Sistema Agendador",
            observacoes=f"Gerada automaticamente da recorrência ID: {transacao_recorrente.id}",
            processado_por_ia=False
        )
        
        db.add(nova_transacao)
        db.flush()  # Para obter o ID
        
        logger.info(f"✅ Transação criada: {nova_transacao.descricao} - R$ {nova_transacao.valor}")
        
        return {
            "criada": True,
            "transacao_id": nova_transacao.id,
            "motivo": "Transação criada com sucesso"
        }
    
    @staticmethod
    def _enviar_notificacao_confirmacao(confirmacao: ConfirmacaoTransacao, telegram_user: TelegramUser):
        """Envia notificação de confirmação via Telegram"""
        try:
            # Importar o TelegramService
            from ..services.telegram_service import TelegramService
            
            # Criar mensagem simples e clara
            message = f"""🔔 *Confirmação de Transação*

💰 *{confirmacao.descricao}*
💵 R$ {confirmacao.valor:.2f}
📅 {confirmacao.data_transacao.strftime('%d/%m/%Y')}

⏰ Responda até {confirmacao.expira_em.strftime('%d/%m %H:%M')}

*1* - Aprovar ✅
*2* - Não aprovar ❌"""

            # Enviar mensagem de forma assíncrona (não bloqueante)
            telegram_service = TelegramService()
            
            # Executar de forma assíncrona em background
            import asyncio
            import threading
            
            def send_async():
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    success = loop.run_until_complete(
                        telegram_service.send_message(telegram_user.telegram_id, message)
                    )
                    loop.close()
                    
                    if success:
                        logger.info(f"📱 Notificação enviada para {telegram_user.telegram_id} - Confirmação {confirmacao.id}")
                    else:
                        logger.error(f"❌ Falha ao enviar notificação para {telegram_user.telegram_id}")
                        
                except Exception as e:
                    logger.error(f"❌ Erro ao enviar notificação assíncrona: {e}")
            
            # Executar em thread separada para não bloquear
            thread = threading.Thread(target=send_async)
            thread.daemon = True
            thread.start()
            
        except Exception as e:
            logger.error(f"❌ Erro ao preparar notificação de confirmação: {e}")
    
    @staticmethod
    def processar_confirmacoes_expiradas(tenant_id: Optional[int] = None) -> Dict[str, Any]:
        """Processa confirmações expiradas e cria transações automaticamente"""
        db = next(get_db())
        agora = datetime.now()
        
        try:
            # Buscar confirmações expiradas
            query = db.query(ConfirmacaoTransacao).filter(
                ConfirmacaoTransacao.status == 'pendente',
                ConfirmacaoTransacao.expira_em <= agora
            )
            
            if tenant_id:
                query = query.filter(ConfirmacaoTransacao.tenant_id == tenant_id)
            
            confirmacoes_expiradas = query.all()
            
            resultado = {
                "confirmacoes_processadas": 0,
                "transacoes_criadas": 0,
                "erros": []
            }
            
            for confirmacao in confirmacoes_expiradas:
                try:
                    # Criar transação automaticamente
                    nova_transacao = Transacao(
                        descricao=confirmacao.descricao,
                        valor=confirmacao.valor,
                        tipo=confirmacao.tipo,
                        data=datetime.combine(confirmacao.data_transacao, agora.time()),
                        categoria_id=confirmacao.categoria_id,
                        conta_id=confirmacao.conta_id,
                        cartao_id=confirmacao.cartao_id,
                        tenant_id=confirmacao.tenant_id,
                        created_by_name="Sistema Agendador (Auto-confirmado)",
                        observacoes=f"Auto-confirmada após expiração. Confirmação ID: {confirmacao.id}",
                        processado_por_ia=False
                    )
                    
                    db.add(nova_transacao)
                    
                    # Atualizar status da confirmação
                    confirmacao.status = 'auto_confirmada'
                    confirmacao.transacao_id = nova_transacao.id
                    confirmacao.processada_em = agora
                    
                    resultado["transacoes_criadas"] += 1
                    
                    logger.info(f"⏰ Transação auto-confirmada: {nova_transacao.descricao} - R$ {nova_transacao.valor}")
                    
                except Exception as e:
                    resultado["erros"].append(f"Erro ao processar confirmação {confirmacao.id}: {str(e)}")
                    logger.error(f"❌ Erro ao processar confirmação {confirmacao.id}: {e}")
                
                resultado["confirmacoes_processadas"] += 1
            
            db.commit()
            
            if resultado["confirmacoes_processadas"] > 0:
                logger.info(f"✅ Processamento de confirmações concluído: {resultado}")
            
            return resultado
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Erro geral no processamento de confirmações: {e}")
            return {
                "confirmacoes_processadas": 0,
                "transacoes_criadas": 0,
                "erros": [f"Erro geral: {str(e)}"]
            }
        finally:
            db.close()
    
    @staticmethod
    def executar_agendamentos(tenant_id: Optional[int] = None) -> Dict[str, Any]:
        """Executa todos os agendamentos pendentes"""
        logger.info(f"🚀 Iniciando execução de agendamentos para tenant_id: {tenant_id}")
        
        inicio = datetime.now()
        
        # Processar transações recorrentes
        resultado_recorrentes = AgendadorService.processar_transacoes_recorrentes(tenant_id)
        
        # Processar confirmações expiradas
        resultado_confirmacoes = AgendadorService.processar_confirmacoes_expiradas(tenant_id)
        
        fim = datetime.now()
        tempo_execucao = (fim - inicio).total_seconds()
        
        resultado_final = {
            "inicio": inicio.isoformat(),
            "fim": fim.isoformat(),
            "tempo_execucao_segundos": tempo_execucao,
            "transacoes_recorrentes": resultado_recorrentes,
            "confirmacoes_expiradas": resultado_confirmacoes,
            "resumo": {
                "transacoes_criadas": resultado_recorrentes.get("transacoes_criadas", 0),
                "confirmacoes_criadas": sum(1 for t in resultado_recorrentes.get("resultados", []) if t.get("confirmacao_criada")),
                "confirmacoes_auto_processadas": resultado_confirmacoes.get("transacoes_criadas", 0),
                "total_processado": resultado_recorrentes.get("transacoes_processadas", 0) + resultado_confirmacoes.get("confirmacoes_processadas", 0)
            }
        }
        
        logger.info(f"✅ Agendamentos concluídos em {tempo_execucao:.2f}s - Resumo: {resultado_final['resumo']}")
        return resultado_final 