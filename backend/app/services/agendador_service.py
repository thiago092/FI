import logging
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Dict, Any

from ..database import get_db
from ..models.transacao_recorrente import TransacaoRecorrente
from ..models.financial import Transacao, TipoTransacao
from ..api.transacoes_recorrentes import calcular_proximo_vencimento

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
            "transacao_id": None,
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
                # Criar nova transação
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
                
                resultado["criada"] = True
                resultado["transacao_id"] = nova_transacao.id
                resultado["motivo"] = "Transação criada com sucesso"
                
                logger.info(f"✅ Transação criada: {nova_transacao.descricao} - R$ {nova_transacao.valor}")
        else:
            resultado["motivo"] = f"Não é dia de vencimento (próximo: {proximo_vencimento})"
        
        return resultado 