from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from typing import Optional
from ..models.financial import Conta, Transacao, TipoTransacao
from ..schemas.financial import ResumoContaInfo

class ContaService:
    
    @staticmethod
    def calcular_resumo_conta(db: Session, conta_id: int, tenant_id: int) -> ResumoContaInfo:
        """Calcula o resumo financeiro de uma conta baseado nas transações"""
        
        # Buscar a conta
        conta = db.query(Conta).filter(
            Conta.id == conta_id,
            Conta.tenant_id == tenant_id
        ).first()
        
        if not conta:
            raise ValueError("Conta não encontrada")
        
        # Calcular totais de entradas e saídas
        entradas = db.query(func.sum(Transacao.valor)).filter(
            Transacao.conta_id == conta_id,
            Transacao.tenant_id == tenant_id,
            Transacao.tipo == TipoTransacao.ENTRADA
        ).scalar() or 0.0
        
        saidas = db.query(func.sum(Transacao.valor)).filter(
            Transacao.conta_id == conta_id,
            Transacao.tenant_id == tenant_id,
            Transacao.tipo == TipoTransacao.SAIDA
        ).scalar() or 0.0
        
        # Calcular saldo atual
        saldo_atual = conta.saldo_inicial + entradas - saidas
        
        # Buscar última movimentação
        ultima_transacao = db.query(Transacao).filter(
            Transacao.conta_id == conta_id,
            Transacao.tenant_id == tenant_id
        ).order_by(desc(Transacao.data)).first()
        
        ultima_movimentacao = None
        data_ultima_movimentacao = None
        
        if ultima_transacao:
            # Se é entrada, valor positivo; se é saída, valor negativo
            if ultima_transacao.tipo == TipoTransacao.ENTRADA:
                ultima_movimentacao = ultima_transacao.valor
            else:
                ultima_movimentacao = -ultima_transacao.valor
            data_ultima_movimentacao = ultima_transacao.data
        
        # Contar total de transações
        total_transacoes = db.query(func.count(Transacao.id)).filter(
            Transacao.conta_id == conta_id,
            Transacao.tenant_id == tenant_id
        ).scalar() or 0
        
        return ResumoContaInfo(
            saldo_atual=saldo_atual,
            total_entradas=entradas,
            total_saidas=saidas,
            ultima_movimentacao=ultima_movimentacao,
            data_ultima_movimentacao=data_ultima_movimentacao,
            total_transacoes=total_transacoes
        )
    
    @staticmethod
    def calcular_resumo_mes_atual(db: Session, conta_id: int, tenant_id: int) -> dict:
        """Calcula resumo do mês atual para uma conta"""
        
        # Primeiro e último dia do mês atual
        hoje = datetime.now()
        primeiro_dia_mes = hoje.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Calcular totais do mês atual
        entradas_mes = db.query(func.sum(Transacao.valor)).filter(
            Transacao.conta_id == conta_id,
            Transacao.tenant_id == tenant_id,
            Transacao.tipo == TipoTransacao.ENTRADA,
            Transacao.data >= primeiro_dia_mes
        ).scalar() or 0.0
        
        saidas_mes = db.query(func.sum(Transacao.valor)).filter(
            Transacao.conta_id == conta_id,
            Transacao.tenant_id == tenant_id,
            Transacao.tipo == TipoTransacao.SAIDA,
            Transacao.data >= primeiro_dia_mes
        ).scalar() or 0.0
        
        # Movimentações de hoje
        hoje_inicio = hoje.replace(hour=0, minute=0, second=0, microsecond=0)
        hoje_fim = hoje_inicio + timedelta(days=1)
        
        movimentacao_hoje = db.query(func.sum(
            func.case(
                (Transacao.tipo == TipoTransacao.ENTRADA, Transacao.valor),
                else_=-Transacao.valor
            )
        )).filter(
            Transacao.conta_id == conta_id,
            Transacao.tenant_id == tenant_id,
            Transacao.data >= hoje_inicio,
            Transacao.data < hoje_fim
        ).scalar() or 0.0
        
        return {
            "entradas_mes": entradas_mes,
            "saidas_mes": saidas_mes,
            "movimentacao_hoje": movimentacao_hoje
        } 