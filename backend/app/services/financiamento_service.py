from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, date
from typing import List, Optional
import logging

from ..models.financial import (
    Financiamento, ParcelaFinanciamento, Transacao, TipoTransacao, Conta
)

logger = logging.getLogger(__name__)

class FinanciamentoService:
    """Serviço para gerenciamento de financiamentos e débitos automáticos"""
    
    @staticmethod
    def processar_debitos_automaticos(db: Session, data_referencia: Optional[date] = None) -> dict:
        """
        Processa débitos automáticos de financiamentos vencidos
        
        Args:
            db: Sessão do banco de dados
            data_referencia: Data para verificar vencimentos (default: hoje)
            
        Returns:
            dict: Relatório do processamento
        """
        if not data_referencia:
            data_referencia = date.today()
        
        logger.info(f"Iniciando processamento de débitos automáticos para {data_referencia}")
        
        # Buscar parcelas vencidas e pendentes
        parcelas_vencidas = db.query(ParcelaFinanciamento).join(
            Financiamento
        ).filter(
            and_(
                ParcelaFinanciamento.data_vencimento <= data_referencia,
                ParcelaFinanciamento.status == "PENDENTE",
                Financiamento.status == "ATIVO"
            )
        ).all()
        
        sucessos = []
        falhas = []
        
        for parcela in parcelas_vencidas:
            try:
                financiamento = parcela.financiamento
                conta = financiamento.conta
                
                # Verificar se conta está ativa
                if not conta.ativo:
                    falhas.append({
                        "parcela_id": parcela.id,
                        "erro": f"Conta {conta.nome} inativa",
                        "financiamento": financiamento.descricao
                    })
                    continue
                
                # Criar transação de débito automático
                transacao = Transacao(
                    descricao=f"{financiamento.descricao} - Parcela {parcela.numero_parcela}/{financiamento.numero_parcelas} (Débito Automático)",
                    valor=-abs(float(parcela.valor_parcela)),
                    tipo=TipoTransacao.SAIDA,
                    categoria_id=financiamento.categoria_id,
                    conta_id=financiamento.conta_id,
                    data=data_referencia,
                    observacoes=f"Débito automático da parcela {parcela.numero_parcela} do financiamento #{financiamento.id}",
                    tenant_id=financiamento.tenant_id
                )
                
                db.add(transacao)
                db.flush()
                
                # Atualizar parcela como paga
                parcela.status = "PAGA"
                parcela.data_pagamento = data_referencia
                parcela.valor_pago = parcela.valor_parcela
                
                # Atualizar saldo devedor do financiamento
                financiamento.saldo_devedor = max(0, financiamento.saldo_devedor - parcela.valor_amortizacao)
                
                # Verificar se foi quitado
                parcelas_pendentes = db.query(ParcelaFinanciamento).filter(
                    and_(
                        ParcelaFinanciamento.financiamento_id == financiamento.id,
                        ParcelaFinanciamento.status == "PENDENTE"
                    )
                ).count()
                
                if parcelas_pendentes == 0:
                    financiamento.status = "QUITADO"
                    logger.info(f"Financiamento #{financiamento.id} foi quitado automaticamente")
                
                sucessos.append({
                    "parcela_id": parcela.id,
                    "transacao_id": transacao.id,
                    "valor": float(parcela.valor_parcela),
                    "financiamento": financiamento.descricao,
                    "conta": conta.nome
                })
                
                logger.info(f"Débito automático processado: Parcela {parcela.id} - R$ {parcela.valor_parcela}")
                
            except Exception as e:
                logger.error(f"Erro ao processar parcela {parcela.id}: {str(e)}")
                falhas.append({
                    "parcela_id": parcela.id,
                    "erro": str(e),
                    "financiamento": parcela.financiamento.descricao
                })
                db.rollback()
                continue
        
        # Commit das transações bem-sucedidas
        if sucessos:
            db.commit()
            logger.info(f"Processamento concluído: {len(sucessos)} sucessos, {len(falhas)} falhas")
        
        return {
            "data_processamento": data_referencia.isoformat(),
            "total_processado": len(parcelas_vencidas),
            "sucessos": len(sucessos),
            "falhas": len(falhas),
            "detalhes_sucessos": sucessos,
            "detalhes_falhas": falhas
        }
    
    @staticmethod
    def obter_parcelas_vencendo(db: Session, dias_antecedencia: int = 7, tenant_id: Optional[int] = None) -> List[dict]:
        """
        Obtém parcelas que vencerão nos próximos dias
        
        Args:
            db: Sessão do banco de dados
            dias_antecedencia: Número de dias de antecedência para alertar
            tenant_id: ID do tenant (opcional para filtrar)
            
        Returns:
            List[dict]: Lista de parcelas vencendo
        """
        from datetime import timedelta
        
        data_limite = date.today() + timedelta(days=dias_antecedencia)
        
        query = db.query(ParcelaFinanciamento).join(
            Financiamento
        ).filter(
            and_(
                ParcelaFinanciamento.data_vencimento <= data_limite,
                ParcelaFinanciamento.data_vencimento >= date.today(),
                ParcelaFinanciamento.status == "PENDENTE",
                Financiamento.status == "ATIVO"
            )
        )
        
        if tenant_id:
            query = query.filter(Financiamento.tenant_id == tenant_id)
        
        parcelas = query.all()
        
        resultado = []
        for parcela in parcelas:
            financiamento = parcela.financiamento
            dias_para_vencimento = (parcela.data_vencimento - date.today()).days
            
            resultado.append({
                "parcela_id": parcela.id,
                "financiamento_id": financiamento.id,
                "financiamento_descricao": financiamento.descricao,
                "numero_parcela": parcela.numero_parcela,
                "total_parcelas": financiamento.numero_parcelas,
                "valor_parcela": float(parcela.valor_parcela),
                "data_vencimento": parcela.data_vencimento.isoformat(),
                "dias_para_vencimento": dias_para_vencimento,
                "conta_nome": financiamento.conta.nome,
                "categoria_nome": financiamento.categoria.nome,
                "tenant_id": financiamento.tenant_id
            })
        
        return resultado
    
    @staticmethod
    def simular_tabela_price(
        valor_financiado: float,
        taxa_juros_mensal: float,
        numero_parcelas: int
    ) -> List[dict]:
        """
        Simula uma tabela Price para financiamento
        
        Args:
            valor_financiado: Valor total a ser financiado
            taxa_juros_mensal: Taxa de juros mensal em percentual (ex: 1.5 para 1.5%)
            numero_parcelas: Número de parcelas
            
        Returns:
            List[dict]: Lista com simulação das parcelas
        """
        taxa_decimal = taxa_juros_mensal / 100
        
        # Calcular valor da parcela usando fórmula Price
        if taxa_decimal > 0:
            fator = ((1 + taxa_decimal) ** numero_parcelas * taxa_decimal) / \
                   (((1 + taxa_decimal) ** numero_parcelas) - 1)
            valor_parcela = valor_financiado * fator
        else:
            valor_parcela = valor_financiado / numero_parcelas
        
        # Gerar tabela
        saldo = valor_financiado
        tabela = []
        
        for i in range(numero_parcelas):
            if taxa_decimal > 0:
                juros_parcela = saldo * taxa_decimal
                amortizacao = valor_parcela - juros_parcela
            else:
                juros_parcela = 0
                amortizacao = valor_parcela
            
            # Ajustar última parcela
            if i == numero_parcelas - 1:
                amortizacao = saldo
                valor_parcela_atual = saldo + juros_parcela
            else:
                valor_parcela_atual = valor_parcela
            
            tabela.append({
                "numero_parcela": i + 1,
                "valor_parcela": round(valor_parcela_atual, 2),
                "valor_juros": round(juros_parcela, 2),
                "valor_amortizacao": round(amortizacao, 2),
                "saldo_devedor": round(saldo - amortizacao, 2)
            })
            
            saldo -= amortizacao
        
        return tabela
    
    @staticmethod
    def calcular_estatisticas_financiamento(financiamento: Financiamento, db: Session) -> dict:
        """
        Calcula estatísticas detalhadas de um financiamento
        
        Args:
            financiamento: Objeto Financiamento
            db: Sessão do banco de dados
            
        Returns:
            dict: Estatísticas do financiamento
        """
        parcelas = db.query(ParcelaFinanciamento).filter(
            ParcelaFinanciamento.financiamento_id == financiamento.id
        ).all()
        
        parcelas_pagas = [p for p in parcelas if p.status == "PAGA"]
        parcelas_pendentes = [p for p in parcelas if p.status == "PENDENTE"]
        parcelas_vencidas = [p for p in parcelas_pendentes if p.data_vencimento < date.today()]
        
        valor_total_pago = sum([p.valor_pago or 0 for p in parcelas_pagas])
        valor_total_juros_pago = sum([p.valor_juros for p in parcelas_pagas])
        valor_pendente = sum([p.valor_parcela for p in parcelas_pendentes])
        valor_vencido = sum([p.valor_parcela for p in parcelas_vencidas])
        
        percentual_pago = (len(parcelas_pagas) / len(parcelas) * 100) if parcelas else 0
        
        # Próxima parcela
        proxima_parcela = None
        if parcelas_pendentes:
            proxima = min(parcelas_pendentes, key=lambda p: p.data_vencimento)
            dias_para_vencimento = (proxima.data_vencimento - date.today()).days
            proxima_parcela = {
                "numero": proxima.numero_parcela,
                "valor": float(proxima.valor_parcela),
                "data_vencimento": proxima.data_vencimento.isoformat(),
                "dias_para_vencimento": dias_para_vencimento
            }
        
        return {
            "parcelas_pagas": len(parcelas_pagas),
            "parcelas_pendentes": len(parcelas_pendentes),
            "parcelas_vencidas": len(parcelas_vencidas),
            "valor_total_pago": float(valor_total_pago),
            "valor_total_juros_pago": float(valor_total_juros_pago),
            "valor_pendente": float(valor_pendente),
            "valor_vencido": float(valor_vencido),
            "percentual_pago": round(percentual_pago, 2),
            "proxima_parcela": proxima_parcela,
            "saldo_devedor": float(financiamento.saldo_devedor)
        } 