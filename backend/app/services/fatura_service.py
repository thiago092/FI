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
    def calcular_periodo_fatura(cartao: Cartao, data_transacao: datetime) -> tuple[date, date]:
        """
        Calcula o período correto da fatura baseado no dia de fechamento
        REGRA: Gastos após o fechamento vão para a próxima fatura
        """
        dia_fechamento = cartao.dia_fechamento or (cartao.vencimento - 5 if cartao.vencimento and cartao.vencimento > 5 else 25)
        data_ref = data_transacao.date()
        
        # Se a transação é APÓS o fechamento do mês atual
        if data_ref.day > dia_fechamento:
            # VAI PARA A PRÓXIMA FATURA
            # Período: dia_fechamento+1 do mês atual até dia_fechamento do próximo mês
            inicio_periodo = date(data_ref.year, data_ref.month, dia_fechamento + 1)
            
            # Próximo mês
            if data_ref.month == 12:
                fim_periodo = date(data_ref.year + 1, 1, dia_fechamento)
            else:
                fim_periodo = date(data_ref.year, data_ref.month + 1, dia_fechamento)
        else:
            # FAZ PARTE DA FATURA ATUAL (ainda não fechou)
            # Período: dia_fechamento+1 do mês anterior até dia_fechamento do mês atual
            if data_ref.month == 1:
                inicio_periodo = date(data_ref.year - 1, 12, dia_fechamento + 1)
            else:
                inicio_periodo = date(data_ref.year, data_ref.month - 1, dia_fechamento + 1)
            
            fim_periodo = date(data_ref.year, data_ref.month, dia_fechamento)
        
        return inicio_periodo, fim_periodo

    @staticmethod
    def calcular_data_vencimento(cartao: Cartao, periodo_inicio: date, periodo_fim: date) -> date:
        """
        Calcula a data de vencimento baseada no período da fatura
        REGRA: Fatura vence sempre no dia do vencimento do mês seguinte ao fechamento
        """
        # A fatura vence no mês seguinte ao fechamento
        mes_vencimento = periodo_fim.month + 1 if periodo_fim.month < 12 else 1
        ano_vencimento = periodo_fim.year if periodo_fim.month < 12 else periodo_fim.year + 1
        
        try:
            data_vencimento = date(ano_vencimento, mes_vencimento, cartao.vencimento)
        except ValueError:
            # Dia não existe no mês (ex: 31 em fevereiro), usar último dia
            if mes_vencimento == 12:
                ultimo_dia = date(ano_vencimento + 1, 1, 1) - relativedelta(days=1)
            else:
                ultimo_dia = date(ano_vencimento, mes_vencimento + 1, 1) - relativedelta(days=1)
            data_vencimento = ultimo_dia
        
        return data_vencimento

    @staticmethod
    def obter_ou_criar_fatura(db: Session, cartao_id: int, data_compra: datetime, tenant_id: int) -> Fatura:
        """
        Obtém fatura existente ou cria uma nova para a transação
        NOVA LÓGICA: Usa período correto baseado no dia de fechamento
        """
        cartao = db.query(Cartao).filter(Cartao.id == cartao_id).first()
        if not cartao:
            raise ValueError(f"Cartão {cartao_id} não encontrado")
        
        inicio_periodo, fim_periodo = FaturaService.calcular_periodo_fatura(cartao, data_compra)
        data_vencimento = FaturaService.calcular_data_vencimento(cartao, inicio_periodo, fim_periodo)
        
        # Usar o mês/ano do FINAL do período como referência
        mes_referencia = fim_periodo.month
        ano_referencia = fim_periodo.year
        
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
        
        from sqlalchemy import func
        
        total = db.query(Transacao).filter(
            Transacao.fatura_id == fatura_id,
            Transacao.tipo == TipoTransacao.SAIDA
        ).with_entities(
            func.sum(Transacao.valor)
        ).scalar() or 0.0
        
        fatura.valor_total = total
        # Não fazer commit aqui - deixar para quem chama a função

    @staticmethod
    def gerar_pagamento_fatura_automatico(db: Session, fatura_id: int, conta_id: Optional[int] = None, categoria_pagamento_id: Optional[int] = None):
        """
        Gera automaticamente uma transação de pagamento da fatura na conta especificada
        Se conta_id não for fornecida, usa a conta vinculada ao cartão
        NOVO: Cria nova fatura após pagamento
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
            tenant_id=fatura.tenant_id,
            created_by_name="Sistema - Pagamento Automático"
        )
        
        db.add(transacao_pagamento)
        db.flush()
        
        # Atualizar fatura
        fatura.transacao_pagamento_id = transacao_pagamento.id
        fatura.status = StatusFatura.PAGA
        
        # 🚀 NOVO: Criar nova fatura para o próximo ciclo
        try:
            nova_fatura = FaturaService.criar_nova_fatura_pos_pagamento(
                db, fatura.cartao_id, fatura.tenant_id
            )
            db.commit()
            
            # Log da criação da nova fatura
            print(f"💳 Nova fatura criada: {nova_fatura.id} para cartão {fatura.cartao.nome}")
            
        except Exception as e:
            print(f"⚠️ Erro ao criar nova fatura: {e}")
            # Não falha o pagamento se houver erro na criação da nova fatura
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
        Processa pagamentos automáticos de faturas que vencem hoje
        """
        faturas_vencendo = FaturaService.obter_faturas_abertas_vencendo(db, tenant_id, 0)
        pagamentos_realizados = []
        
        for fatura in faturas_vencendo:
            # Só processa se o cartão tem conta vinculada
            if fatura.cartao.conta_vinculada_id:
                transacao = FaturaService.gerar_pagamento_fatura_automatico(
                    db, fatura.id, fatura.cartao.conta_vinculada_id
                )
                if transacao:
                    pagamentos_realizados.append(transacao)
        
        return pagamentos_realizados

    @staticmethod
    def criar_nova_fatura_pos_pagamento(db: Session, cartao_id: int, tenant_id: int) -> Fatura:
        """
        Cria uma nova fatura após o pagamento da anterior
        NOVA LÓGICA: Inicia novo ciclo de cobrança
        """
        cartao = db.query(Cartao).filter(Cartao.id == cartao_id).first()
        if not cartao:
            raise ValueError(f"Cartão {cartao_id} não encontrado")
        
        hoje = datetime.now()
        
        # Calcular próximo período (ciclo seguinte)
        inicio_periodo, fim_periodo = FaturaService.calcular_periodo_fatura(cartao, hoje)
        
        # Se estamos após o fechamento, a próxima fatura já começou
        dia_fechamento = cartao.dia_fechamento or (cartao.vencimento - 5 if cartao.vencimento and cartao.vencimento > 5 else 25)
        
        if hoje.day > dia_fechamento:
            # Nova fatura já está em andamento
            inicio_periodo = date(hoje.year, hoje.month, dia_fechamento + 1)
            if hoje.month == 12:
                fim_periodo = date(hoje.year + 1, 1, dia_fechamento)
            else:
                fim_periodo = date(hoje.year, hoje.month + 1, dia_fechamento)
        
        data_vencimento = FaturaService.calcular_data_vencimento(cartao, inicio_periodo, fim_periodo)
        
        # Verificar se já existe fatura para este período
        fatura_existente = db.query(Fatura).filter(
            Fatura.cartao_id == cartao_id,
            Fatura.mes_referencia == fim_periodo.month,
            Fatura.ano_referencia == fim_periodo.year
        ).first()
        
        if fatura_existente:
            return fatura_existente
        
        # Criar nova fatura
        nova_fatura = Fatura(
            cartao_id=cartao_id,
            mes_referencia=fim_periodo.month,
            ano_referencia=fim_periodo.year,
            data_vencimento=data_vencimento,
            valor_total=0.0,
            status=StatusFatura.ABERTA,
            tenant_id=tenant_id
        )
        
        db.add(nova_fatura)
        db.flush()
        return nova_fatura

    @staticmethod
    def atualizar_status_faturas_vencidas(db: Session, tenant_id: int):
        """
        Atualiza status de faturas que venceram para VENCIDA
        """
        hoje = date.today()
        
        faturas_vencidas = db.query(Fatura).filter(
            Fatura.tenant_id == tenant_id,
            Fatura.status == StatusFatura.ABERTA,
            Fatura.data_vencimento < hoje
        ).all()
        
        for fatura in faturas_vencidas:
            fatura.status = StatusFatura.FECHADA  # Ou criar novo status VENCIDA
        
        db.commit()
        return len(faturas_vencidas)

    @staticmethod
    def resetar_faturas_antigas(db: Session, tenant_id: int, dias_limite: int = 45):
        """
        MÉTODO TEMPORÁRIO: Reseta faturas muito antigas para evitar valores negativos
        Remove após implementar sistema completo de pagamento
        """
        data_limite = date.today() - relativedelta(days=dias_limite)
        
        faturas_antigas = db.query(Fatura).filter(
            Fatura.tenant_id == tenant_id,
            Fatura.status == StatusFatura.ABERTA,
            Fatura.data_vencimento < data_limite
        ).all()
        
        for fatura in faturas_antigas:
            # Marcar como paga automaticamente
            fatura.status = StatusFatura.PAGA
            
            # Criar nova fatura para o período atual
            FaturaService.criar_nova_fatura_pos_pagamento(db, fatura.cartao_id, tenant_id)
        
        db.commit()
        return len(faturas_antigas) 