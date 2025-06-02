"""
Serviço para gerenciar faturas de cartão de crédito
"""

from sqlalchemy.orm import Session
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from typing import Optional, List

from ..models.financial import Fatura, Cartao, Transacao, TipoTransacao, StatusFatura, Categoria
from ..database import get_db

class FaturaService:
    @staticmethod
    def calcular_data_vencimento(cartao: Cartao, data_compra: datetime) -> date:
        """
        Calcula a data de vencimento da fatura baseada na data da compra e dia de vencimento do cartão
        """
        mes_atual = data_compra.month
        ano_atual = data_compra.year
        
        # Se a compra é após o dia de vencimento do mês atual, vai para a próxima fatura
        if data_compra.day > cartao.vencimento:
            proxima_data = date(ano_atual, mes_atual, 1) + relativedelta(months=2)
        else:
            proxima_data = date(ano_atual, mes_atual, 1) + relativedelta(months=1)
        
        # Ajustar para o dia de vencimento, ou último dia do mês se o dia não existir
        try:
            data_vencimento = date(proxima_data.year, proxima_data.month, cartao.vencimento)
        except ValueError:
            # Se o dia não existe no mês (ex: 31 em fevereiro), usar último dia do mês
            ultima_data = date(proxima_data.year, proxima_data.month, 1) + relativedelta(months=1) - relativedelta(days=1)
            data_vencimento = ultima_data
        
        return data_vencimento

    @staticmethod
    def obter_ou_criar_fatura(db: Session, cartao_id: int, data_compra: datetime, tenant_id: int) -> Fatura:
        """
        Obtém fatura existente ou cria uma nova para a transação
        """
        cartao = db.query(Cartao).filter(Cartao.id == cartao_id).first()
        if not cartao:
            raise ValueError(f"Cartão {cartao_id} não encontrado")
        
        data_vencimento = FaturaService.calcular_data_vencimento(cartao, data_compra)
        mes_referencia = data_vencimento.month - 1 if data_vencimento.month > 1 else 12
        ano_referencia = data_vencimento.year if data_vencimento.month > 1 else data_vencimento.year - 1
        
        # Verificar se já existe fatura para este período
        fatura_existente = db.query(Fatura).filter(
            Fatura.cartao_id == cartao_id,
            Fatura.mes_referencia == mes_referencia,
            Fatura.ano_referencia == ano_referencia
        ).first()
        
        if fatura_existente:
            return fatura_existente
        
        # Criar nova fatura
        nova_fatura = Fatura(
            cartao_id=cartao_id,
            mes_referencia=mes_referencia,
            ano_referencia=ano_referencia,
            data_vencimento=data_vencimento,
            valor_total=0.0,
            status=StatusFatura.ABERTA,
            tenant_id=tenant_id
        )
        
        db.add(nova_fatura)
        db.flush()  # Para obter o ID
        return nova_fatura

    @staticmethod
    def adicionar_transacao_fatura(db: Session, transacao: Transacao):
        """
        Adiciona uma transação à fatura apropriada e atualiza o valor total
        """
        if not transacao.cartao_id or transacao.tipo != TipoTransacao.SAIDA:
            return  # Só processa saídas no cartão
        
        fatura = FaturaService.obter_ou_criar_fatura(
            db, transacao.cartao_id, transacao.data, transacao.tenant_id
        )
        
        # Vincular transação à fatura
        transacao.fatura_id = fatura.id
        
        # Atualizar valor total da fatura
        FaturaService.recalcular_valor_fatura(db, fatura.id)

    @staticmethod
    def recalcular_valor_fatura(db: Session, fatura_id: int):
        """
        Recalcula o valor total da fatura baseado nas transações vinculadas
        """
        fatura = db.query(Fatura).filter(Fatura.id == fatura_id).first()
        if not fatura:
            return
        
        total = db.query(Transacao).filter(
            Transacao.fatura_id == fatura_id,
            Transacao.tipo == TipoTransacao.SAIDA
        ).with_entities(
            db.func.sum(Transacao.valor)
        ).scalar() or 0.0
        
        fatura.valor_total = total
        db.commit()

    @staticmethod
    def gerar_pagamento_fatura_automatico(db: Session, fatura_id: int, conta_id: Optional[int] = None, categoria_pagamento_id: Optional[int] = None):
        """
        Gera automaticamente uma transação de pagamento da fatura na conta especificada
        Se conta_id não for fornecida, usa a conta vinculada ao cartão
        """
        fatura = db.query(Fatura).filter(Fatura.id == fatura_id).first()
        if not fatura or fatura.status != StatusFatura.ABERTA:
            return None
        
        if fatura.valor_total <= 0:
            return None
        
        # Determinar qual conta usar para o pagamento
        conta_pagamento_id = conta_id
        if not conta_pagamento_id:
            # Usar conta vinculada ao cartão
            if fatura.cartao.conta_vinculada_id:
                conta_pagamento_id = fatura.cartao.conta_vinculada_id
            else:
                # Se não há conta vinculada, buscar primeira conta ativa do tenant
                from ..models.financial import Conta
                conta_padrao = db.query(Conta).filter(
                    Conta.tenant_id == fatura.tenant_id,
                    Conta.ativo == True
                ).first()
                if not conta_padrao:
                    return None  # Não há conta para debitar
                conta_pagamento_id = conta_padrao.id
        
        # Buscar ou criar categoria de pagamento se não fornecida
        if not categoria_pagamento_id:
            categoria_cartao = db.query(Categoria).filter(
                Categoria.tenant_id == fatura.tenant_id,
                Categoria.nome.ilike("%cartão%")
            ).first()
            
            if not categoria_cartao:
                # Criar categoria se não existir
                categoria_cartao = Categoria(
                    nome="Pagamento Cartão",
                    cor="#8B5CF6",
                    icone="💳",
                    tenant_id=fatura.tenant_id
                )
                db.add(categoria_cartao)
                db.flush()
            categoria_pagamento_id = categoria_cartao.id
        
        # Criar transação de pagamento
        transacao_pagamento = Transacao(
            descricao=f"Pagamento Fatura {fatura.cartao.nome} - {fatura.mes_referencia:02d}/{fatura.ano_referencia}",
            valor=fatura.valor_total,
            tipo=TipoTransacao.SAIDA,
            data=datetime.combine(fatura.data_vencimento, datetime.min.time()),
            conta_id=conta_pagamento_id,  # Agora debita da conta específica
            categoria_id=categoria_pagamento_id,
            observacoes=f"Pagamento automático da fatura do cartão {fatura.cartao.nome}",
            tenant_id=fatura.tenant_id
        )
        
        db.add(transacao_pagamento)
        db.flush()
        
        # Atualizar fatura
        fatura.transacao_pagamento_id = transacao_pagamento.id
        fatura.status = StatusFatura.PAGA
        
        db.commit()
        return transacao_pagamento

    @staticmethod
    def obter_faturas_abertas_vencendo(db: Session, tenant_id: int, dias_antecedencia: int = 5) -> List[Fatura]:
        """
        Obtém faturas abertas que vencem nos próximos X dias
        """
        data_limite = date.today() + relativedelta(days=dias_antecedencia)
        
        return db.query(Fatura).filter(
            Fatura.tenant_id == tenant_id,
            Fatura.status == StatusFatura.ABERTA,
            Fatura.data_vencimento <= data_limite,
            Fatura.valor_total > 0
        ).all()

    @staticmethod
    def processar_pagamentos_automaticos(db: Session, tenant_id: int):
        """
        Processa pagamentos automáticos para faturas que vencem hoje
        Deve ser executado diariamente
        """
        faturas_vencendo = FaturaService.obter_faturas_abertas_vencendo(db, tenant_id, 0)
        
        pagamentos_gerados = []
        for fatura in faturas_vencendo:
            # Usar conta vinculada do cartão ou conta padrão
            pagamento = FaturaService.gerar_pagamento_fatura_automatico(
                db, fatura.id
            )
            if pagamento:
                pagamentos_gerados.append(pagamento)
        
        return pagamentos_gerados 