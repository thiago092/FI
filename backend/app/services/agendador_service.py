import logging
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, text
from typing import List, Dict, Any, Optional

from ..database import get_db
from ..models.transacao_recorrente import TransacaoRecorrente
from ..models.financial import Transacao, TipoTransacao, Conta
from ..models.telegram_user import TelegramUser
from ..models.user import User
from ..api.transacoes_recorrentes import calcular_proximo_vencimento
from ..models.transacao_recorrente import ConfirmacaoTransacao
from ..models.financiamento import Financiamento, ParcelaFinanciamento, StatusParcela
from ..services.financiamento_service import FinanciamentoService

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
        """Envia notificação de confirmação via Telegram com botões inline específicos"""
        try:
            # Importar o TelegramService
            from ..services.telegram_service import TelegramService
            
            # Criar mensagem melhorada com botões inline
            message = f"""🔔 *Confirmação de Transação #{confirmacao.id}*

💰 *{confirmacao.descricao}*
💵 R$ {confirmacao.valor:.2f}
📅 {confirmacao.data_transacao.strftime('%d/%m/%Y')}

⏰ Expira em: {confirmacao.expira_em.strftime('%d/%m às %H:%M')}

Use os botões abaixo para confirmar esta transação específica:"""

            # Criar botões inline específicos para esta confirmação
            inline_keyboard = {
                "inline_keyboard": [
                    [
                        {
                            "text": "✅ Aprovar",
                            "callback_data": f"confirm_{confirmacao.id}_approve"
                        },
                        {
                            "text": "❌ Rejeitar", 
                            "callback_data": f"confirm_{confirmacao.id}_reject"
                        }
                    ],
                    [
                        {
                            "text": "📋 Ver Detalhes",
                            "callback_data": f"confirm_{confirmacao.id}_details"
                        }
                    ]
                ]
            }

            # Enviar mensagem de forma assíncrona (não bloqueante)
            telegram_service = TelegramService()
            
            # Executar de forma assíncrona em background
            import asyncio
            import threading
            
            def send_async():
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    
                    # Enviar mensagem com botões inline
                    success = loop.run_until_complete(
                        telegram_service.send_message_with_buttons(
                            telegram_user.telegram_id, 
                            message,
                            inline_keyboard
                        )
                    )
                    loop.close()
                    
                    if success:
                        logger.info(f"📱 Notificação com botões enviada para {telegram_user.telegram_id} - Confirmação {confirmacao.id}")
                    else:
                        logger.error(f"❌ Falha ao enviar notificação para {telegram_user.telegram_id}")
                        
                except Exception as e:
                    logger.error(f"❌ Erro ao enviar notificação assíncrona: {e}")
                    # Fallback: enviar mensagem simples sem botões
                    try:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        fallback_message = f"""🔔 *Confirmação #{confirmacao.id}*

💰 {confirmacao.descricao} - R$ {confirmacao.valor:.2f}
📅 {confirmacao.data_transacao.strftime('%d/%m/%Y')}

⏰ Responda até {confirmacao.expira_em.strftime('%d/%m %H:%M')}

Digite: `/confirmar {confirmacao.id}` ou `/rejeitar {confirmacao.id}`"""
                        
                        loop.run_until_complete(
                            telegram_service.send_message(telegram_user.telegram_id, fallback_message)
                        )
                        loop.close()
                        logger.info(f"📱 Fallback - Mensagem simples enviada para confirmação {confirmacao.id}")
                    except Exception as fallback_error:
                        logger.error(f"❌ Erro no fallback também: {fallback_error}")
            
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
    def processar_financiamentos_do_dia(data_processamento: date = None) -> Dict[str, Any]:
        """
        Processa débitos automáticos de financiamentos que vencem na data especificada
        """
        if data_processamento is None:
            data_processamento = date.today()
            
        logger.info(f"💳 Iniciando processamento de débitos automáticos de financiamentos para {data_processamento}")
        
        db = next(get_db())
        try:
            # Buscar financiamentos ativos com débito automático
            financiamentos_auto_debito = db.query(Financiamento).filter(
                Financiamento.auto_debito == True,
                Financiamento.status == "ativo",
                Financiamento.conta_debito_id.is_not(None)
            ).all()
            
            estatisticas = {
                "data_processamento": data_processamento.isoformat(),
                "total_financiamentos_auto_debito": len(financiamentos_auto_debito),
                "processados": 0,
                "parcelas_pagas": 0,
                "transacoes_criadas": 0,
                "erros": 0,
                "detalhes": []
            }
            
            for financiamento in financiamentos_auto_debito:
                try:
                    resultado = AgendadorService._processar_financiamento_individual(
                        db, financiamento, data_processamento
                    )
                    
                    estatisticas["processados"] += 1
                    if resultado["parcela_paga"]:
                        estatisticas["parcelas_pagas"] += 1
                        estatisticas["transacoes_criadas"] += 1
                        
                    estatisticas["detalhes"].append(resultado)
                    
                except Exception as e:
                    logger.error(f"❌ Erro ao processar financiamento {financiamento.id}: {e}")
                    estatisticas["erros"] += 1
                    estatisticas["detalhes"].append({
                        "financiamento_id": financiamento.id,
                        "descricao": financiamento.descricao,
                        "erro": str(e),
                        "parcela_paga": False
                    })
            
            db.commit()
            logger.info(f"✅ Processamento de financiamentos concluído: {estatisticas['parcelas_pagas']} parcelas pagas, {estatisticas['erros']} erros")
            return estatisticas
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Erro geral no processamento de financiamentos: {e}")
            raise
        finally:
            db.close()
    
    @staticmethod
    def _processar_financiamento_individual(
        db: Session, 
        financiamento: Financiamento, 
        data_processamento: date
    ) -> Dict[str, Any]:
        """Processa um financiamento individual para débito automático"""
        
        resultado = {
            "financiamento_id": financiamento.id,
            "descricao": financiamento.descricao,
            "instituicao": financiamento.instituicao,
            "parcela_paga": False,
            "transacao_id": None,
            "valor_pago": 0,
            "motivo": None
        }
        
        # Calcular data de vencimento baseada no dia de vencimento configurado
        if financiamento.dia_vencimento:
            try:
                # Construir data de vencimento para o mês atual
                data_vencimento = data_processamento.replace(day=financiamento.dia_vencimento)
                
                # Se a data já passou no mês, vai para o próximo mês
                if data_vencimento < data_processamento:
                    if data_vencimento.month == 12:
                        data_vencimento = data_vencimento.replace(year=data_vencimento.year + 1, month=1)
                    else:
                        data_vencimento = data_vencimento.replace(month=data_vencimento.month + 1)
                        
            except ValueError:
                # Dia inválido para o mês (ex: 31 em fevereiro)
                # Usar último dia do mês
                import calendar
                ultimo_dia = calendar.monthrange(data_processamento.year, data_processamento.month)[1]
                data_vencimento = data_processamento.replace(day=ultimo_dia)
        else:
            # Se não tem dia configurado, usar baseado na data da primeira parcela
            data_vencimento = financiamento.data_primeira_parcela
            
            # Adicionar meses baseado em parcelas já pagas
            meses_adicionar = financiamento.parcelas_pagas
            for _ in range(meses_adicionar):
                if data_vencimento.month == 12:
                    data_vencimento = data_vencimento.replace(year=data_vencimento.year + 1, month=1)
                else:
                    data_vencimento = data_vencimento.replace(month=data_vencimento.month + 1)
        
        # Verificar se é dia de vencimento
        if data_vencimento == data_processamento:
            # Verificar se ainda há parcelas para pagar
            if financiamento.parcelas_pagas >= financiamento.numero_parcelas:
                resultado["motivo"] = "Financiamento já quitado"
                return resultado
            
            # Buscar parcela específica para este vencimento
            numero_parcela_atual = financiamento.parcelas_pagas + 1
            parcela = db.query(ParcelaFinanciamento).filter(
                ParcelaFinanciamento.financiamento_id == financiamento.id,
                ParcelaFinanciamento.numero_parcela == numero_parcela_atual,
                ParcelaFinanciamento.status == StatusParcela.PENDENTE
            ).first()
            
            if not parcela:
                resultado["motivo"] = f"Parcela {numero_parcela_atual} não encontrada ou já paga"
                return resultado
            
            # Verificar se já existe transação para esta parcela hoje
            transacao_existente = db.query(Transacao).filter(
                Transacao.tenant_id == financiamento.tenant_id,
                Transacao.descricao.like(f"%{financiamento.descricao}%parcela%{numero_parcela_atual}%"),
                Transacao.data >= datetime.combine(data_processamento, datetime.min.time()),
                Transacao.data < datetime.combine(data_processamento + timedelta(days=1), datetime.min.time())
            ).first()
            
            if transacao_existente:
                resultado["motivo"] = "Transação já existe para esta parcela hoje"
                resultado["transacao_id"] = transacao_existente.id
                return resultado
            
            # Verificar se conta de débito existe
            conta_debito = db.query(Conta).filter(
                Conta.id == financiamento.conta_debito_id
            ).first()
            
            if not conta_debito:
                resultado["motivo"] = "Conta de débito não encontrada"
                return resultado
            
            # Criar transação de débito automático
            valor_parcela = float(parcela.valor_parcela_simulado)
            
            nova_transacao = Transacao(
                descricao=f"[AUTO] {financiamento.descricao} - Parcela {numero_parcela_atual}/{financiamento.numero_parcelas}",
                valor=valor_parcela,
                tipo=TipoTransacao.DEBITO,
                data=datetime.combine(data_processamento, datetime.now().time()),
                categoria_id=financiamento.categoria_id,
                conta_id=financiamento.conta_debito_id,
                tenant_id=financiamento.tenant_id,
                created_by_name="Sistema Agendador (Débito Automático)",
                observacoes=f"Débito automático - Financiamento ID: {financiamento.id}, Parcela: {numero_parcela_atual}",
                processado_por_ia=False
            )
            
            db.add(nova_transacao)
            db.flush()  # Para obter o ID da transação
            
            # Registrar pagamento da parcela usando o serviço
            try:
                FinanciamentoService.registrar_pagamento_parcela(
                    db=db,
                    parcela_id=parcela.id,
                    valor_pago=valor_parcela,
                    data_pagamento=data_processamento,
                    tenant_id=financiamento.tenant_id,
                    categoria_id=financiamento.categoria_id,
                    conta_id=financiamento.conta_debito_id,
                    observacoes=f"Débito automático - Transação ID: {nova_transacao.id}"
                )
                
                resultado["parcela_paga"] = True
                resultado["transacao_id"] = nova_transacao.id
                resultado["valor_pago"] = valor_parcela
                resultado["motivo"] = f"Parcela {numero_parcela_atual} paga automaticamente"
                
                logger.info(f"💳 Débito automático processado: {financiamento.descricao} - R$ {valor_parcela:.2f}")
                
            except Exception as e:
                # Se falhar ao registrar pagamento, remover a transação
                db.rollback()
                raise e
                
        else:
            resultado["motivo"] = f"Não é dia de vencimento (próximo: {data_vencimento})"
        
        return resultado

    @staticmethod
    def executar_agendamentos(tenant_id: Optional[int] = None) -> Dict[str, Any]:
        """Executa todos os agendamentos pendentes"""
        logger.info(f"🚀 Iniciando execução de agendamentos para tenant_id: {tenant_id}")
        
        inicio = datetime.now()
        
        # Processar transações recorrentes
        resultado_recorrentes = AgendadorService.processar_transacoes_do_dia()
        
        # Processar confirmações expiradas
        resultado_confirmacoes = AgendadorService.processar_confirmacoes_expiradas(tenant_id)
        
        # Processar financiamentos com débito automático
        resultado_financiamentos = AgendadorService.processar_financiamentos_do_dia()
        
        fim = datetime.now()
        tempo_execucao = (fim - inicio).total_seconds()
        
        resultado_final = {
            "inicio": inicio.isoformat(),
            "fim": fim.isoformat(),
            "tempo_execucao_segundos": tempo_execucao,
            "transacoes_recorrentes": resultado_recorrentes,
            "confirmacoes_expiradas": resultado_confirmacoes,
            "financiamentos_auto_debito": resultado_financiamentos,
            "resumo": {
                "transacoes_criadas": resultado_recorrentes.get("criadas", 0),
                "confirmacoes_criadas": sum(1 for t in resultado_recorrentes.get("detalhes", []) if t.get("confirmacao_criada")),
                "confirmacoes_auto_processadas": resultado_confirmacoes.get("transacoes_criadas", 0),
                "financiamentos_parcelas_pagas": resultado_financiamentos.get("parcelas_pagas", 0),
                "total_transacoes": (resultado_recorrentes.get("criadas", 0) + 
                                   resultado_confirmacoes.get("transacoes_criadas", 0) +
                                   resultado_financiamentos.get("transacoes_criadas", 0)),
                "total_processado": (resultado_recorrentes.get("processadas", 0) + 
                                   resultado_confirmacoes.get("confirmacoes_processadas", 0) +
                                   resultado_financiamentos.get("processados", 0))
            }
        }
        
        logger.info(f"✅ Agendamentos concluídos em {tempo_execucao:.2f}s - Resumo: {resultado_final['resumo']}")
        return resultado_final 