from sqlalchemy import Column, Integer, String, Numeric, Boolean, Date, DateTime, ForeignKey, CheckConstraint, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime, date
from enum import Enum
from ..database import Base

# Enums para financiamentos
class TipoFinanciamento(str, Enum):
    HABITACIONAL = "habitacional"
    VEICULO = "veiculo"
    PESSOAL = "pessoal"
    CONSIGNADO = "consignado"
    EMPRESARIAL = "empresarial"
    RURAL = "rural"
    ESTUDANTIL = "estudantil"

class SistemaAmortizacao(str, Enum):
    PRICE = "PRICE"      # Parcelas fixas
    SAC = "SAC"          # Parcelas decrescentes
    SACRE = "SACRE"      # Misto
    AMERICANO = "AMERICANO" # Só juros
    BULLET = "BULLET"    # Pagamento único

class StatusFinanciamento(str, Enum):
    SIMULACAO = "simulacao"
    ATIVO = "ativo"
    EM_ATRASO = "em_atraso"
    QUITADO = "quitado"
    SUSPENSO = "suspenso"

class StatusParcela(str, Enum):
    PENDENTE = "pendente"
    PAGA = "paga"
    VENCIDA = "vencida"
    ANTECIPADA = "antecipada"

class Financiamento(Base):
    """
    Modelo principal para financiamentos
    Aproveita estrutura existente e adiciona funcionalidades avançadas
    """
    __tablename__ = "financiamentos"
    
    # Campos existentes (mantendo compatibilidade)
    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String, nullable=False)
    valor_total = Column(Numeric(12, 2), nullable=False)  # Valor total do contrato
    valor_entrada = Column(Numeric(12, 2), default=0)   # Valor da entrada
    valor_financiado = Column(Numeric(12, 2), nullable=False)  # Valor a ser financiado
    taxa_juros_mensal = Column(Numeric(5, 4), nullable=False)  # Taxa mensal em decimal
    numero_parcelas = Column(Integer, nullable=False)
    valor_parcela = Column(Numeric(10, 2), nullable=False)  # Valor inicial da parcela
    data_contratacao = Column(Date, nullable=False)
    data_primeira_parcela = Column(Date, nullable=False)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    conta_id = Column(Integer, ForeignKey("contas.id"), nullable=True)  # Conta de débito original
    status = Column(String, default="ativo")  # Será convertido para enum
    saldo_devedor = Column(Numeric(12, 2), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Novos campos adicionados pela migração
    instituicao = Column(String(255), nullable=True)
    numero_contrato = Column(String(100), nullable=True)
    tipo_financiamento = Column(String, default="pessoal")  # Será convertido para enum
    sistema_amortizacao = Column(String, default="PRICE")   # Será convertido para enum
    taxa_juros_anual = Column(Numeric(5, 2), nullable=True)
    parcelas_pagas = Column(Integer, default=0)
    valor_parcela_atual = Column(Numeric(10, 2), nullable=True)  # Parcela atual (pode variar no SAC)
    dia_vencimento = Column(Integer, nullable=True)  # Dia do mês para vencimento
    
    # Configurações de débito automático
    conta_debito_id = Column(Integer, ForeignKey("contas.id"), nullable=True)
    auto_debito = Column(Boolean, default=False)
    lembrete_vencimento = Column(Boolean, default=True)
    
    # Taxas adicionais
    taxa_seguro_mensal = Column(Numeric(5, 4), default=0)
    taxa_administrativa = Column(Numeric(10, 2), default=0)
    
    # Observações
    observacoes = Column(Text, nullable=True)
    
    # Relacionamentos
    categoria = relationship("Categoria")
    conta = relationship("Conta", foreign_keys=[conta_id])
    conta_debito = relationship("Conta", foreign_keys=[conta_debito_id])
    parcelas = relationship("ParcelaFinanciamento", back_populates="financiamento", cascade="all, delete-orphan")
    confirmacoes = relationship("ConfirmacaoFinanciamento", back_populates="financiamento", cascade="all, delete-orphan")
    simulacao_origem = relationship("SimulacaoFinanciamento", back_populates="financiamento_gerado")
    historico = relationship("HistoricoFinanciamento", back_populates="financiamento", cascade="all, delete-orphan")
    
    # Propriedades calculadas
    @property
    def porcentagem_paga(self) -> float:
        """Calcula a porcentagem já paga do financiamento"""
        if self.numero_parcelas == 0:
            return 0
        return (self.parcelas_pagas / self.numero_parcelas) * 100
    
    @property
    def valor_ja_pago(self) -> float:
        """Calcula o valor já pago (principal + juros)"""
        return float(self.valor_financiado - self.saldo_devedor)
    
    @property
    def juros_ja_pagos(self) -> float:
        """Calcula os juros já pagos baseado nas parcelas efetivamente pagas"""
        total_pago = sum(p.juros_simulados for p in self.parcelas if p.status == StatusParcela.PAGA)
        return float(total_pago)
    
    @property
    def proximo_vencimento(self) -> date:
        """Retorna a data do próximo vencimento"""
        proxima_parcela = next((p for p in self.parcelas if p.status == StatusParcela.PENDENTE), None)
        return proxima_parcela.data_vencimento if proxima_parcela else None
    
    @property
    def dias_atraso(self) -> int:
        """Calcula dias de atraso da parcela mais antiga vencida"""
        hoje = date.today()
        parcelas_vencidas = [p for p in self.parcelas if p.status == StatusParcela.VENCIDA]
        if not parcelas_vencidas:
            return 0
        parcela_mais_antiga = min(parcelas_vencidas, key=lambda p: p.data_vencimento)
        return (hoje - parcela_mais_antiga.data_vencimento).days
    
    def __repr__(self):
        return f"<Financiamento(id={self.id}, descricao='{self.descricao}', valor={self.valor_financiado})>"

class ParcelaFinanciamento(Base):
    """
    Modelo para parcelas individuais do financiamento
    ATUALIZADO para refletir estrutura real da tabela
    """
    __tablename__ = "parcelas_financiamento"
    
    id = Column(Integer, primary_key=True, index=True)
    financiamento_id = Column(Integer, ForeignKey("financiamentos.id"), nullable=False)
    numero_parcela = Column(Integer, nullable=False)
    data_vencimento = Column(Date, nullable=False)
    
    # CAMPOS OBRIGATÓRIOS da estrutura original
    valor_parcela = Column(Numeric(12, 2), nullable=False)  # Campo antigo obrigatório
    valor_juros = Column(Numeric(12, 2), nullable=False)    # Campo antigo obrigatório  
    valor_amortizacao = Column(Numeric(12, 2), nullable=False)  # Campo antigo obrigatório
    saldo_devedor = Column(Numeric(12, 2), nullable=False)  # Campo antigo obrigatório
    
    # Campos opcionais da estrutura original
    status = Column(String(20), nullable=True)
    data_pagamento = Column(Date, nullable=True)
    valor_pago = Column(Numeric(12, 2), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, nullable=True)
    
    # CAMPOS NOVOS adicionados pela migração (todos opcionais)
    valor_parcela_simulado = Column(Numeric(12, 2), nullable=True)
    saldo_devedor_pos = Column(Numeric(12, 2), nullable=True)
    tipo_parcela = Column(String(20), nullable=True, default='NORMAL')
    observacoes = Column(Text, nullable=True)
    saldo_inicial_simulado = Column(Numeric(12, 2), nullable=True)
    amortizacao_simulada = Column(Numeric(12, 2), nullable=True)
    juros_simulados = Column(Numeric(12, 2), nullable=True)
    saldo_final_simulado = Column(Numeric(12, 2), nullable=True)
    seguro_simulado = Column(Numeric(12, 2), nullable=True, default=0)
    valor_pago_real = Column(Numeric(12, 2), nullable=True)
    juros_multa_atraso = Column(Numeric(12, 2), nullable=True, default=0)
    desconto_quitacao = Column(Numeric(12, 2), nullable=True, default=0)
    dias_atraso = Column(Integer, nullable=True, default=0)
    comprovante_path = Column(String(500), nullable=True)
    transacao_id = Column(Integer, ForeignKey("transacoes.id"), nullable=True)
    updated_at = Column(DateTime, nullable=True, default=datetime.utcnow)
    
    # Relacionamentos
    financiamento = relationship("Financiamento", back_populates="parcelas")
    transacao = relationship("Transacao", foreign_keys=[transacao_id])
    
    # Propriedades calculadas
    @property
    def valor_total_pago(self) -> float:
        """Valor total pago nesta parcela (incluindo multas e descontos)"""
        if self.valor_pago_real is None:
            return 0
        return float(self.valor_pago_real + (self.juros_multa_atraso or 0) - (self.desconto_quitacao or 0))
    
    @property
    def em_atraso(self) -> bool:
        """Verifica se a parcela está em atraso"""
        return self.status in ['vencida'] or (self.dias_atraso or 0) > 0
    
    def __repr__(self):
        return f"<ParcelaFinanciamento(id={self.id}, financiamento_id={self.financiamento_id}, numero={self.numero_parcela}, status='{self.status}')>"

class ConfirmacaoFinanciamento(Base):
    """
    Sistema de confirmação de pagamento de parcelas
    Baseado no sistema de confirmações dos recorrentes
    """
    __tablename__ = "confirmacoes_financiamento"
    
    id = Column(Integer, primary_key=True, index=True)
    financiamento_id = Column(Integer, ForeignKey("financiamentos.id"), nullable=False)
    parcela_id = Column(Integer, ForeignKey("parcelas_financiamento.id"), nullable=False)
    
    # Dados da parcela que será paga
    valor_confirmado = Column(Numeric(12, 2), nullable=False)
    data_confirmacao = Column(Date, nullable=False)
    tipo_confirmacao = Column(String(50), default="PAGAMENTO")
    observacoes = Column(Text, nullable=True)
    criada_por_usuario = Column(Boolean, default=True)
    
    # Controle
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    financiamento = relationship("Financiamento", back_populates="confirmacoes")
    parcela_financiamento = relationship("ParcelaFinanciamento", foreign_keys=[parcela_id])
    
    # Constraints
    __table_args__ = (
        CheckConstraint('valor_confirmado > 0', name='check_confirmacao_valor_positivo'),
    )
    
    def __repr__(self):
        return f"<ConfirmacaoFinanciamento(id={self.id}, financiamento_id={self.financiamento_id}, valor={self.valor_confirmado})>"

class SimulacaoFinanciamento(Base):
    """
    Histórico de simulações de financiamento
    Permite salvar simulações para análise posterior
    """
    __tablename__ = "simulacoes_financiamento"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Parâmetros da simulação
    valor_financiado = Column(Numeric(12, 2), nullable=False)
    prazo_meses = Column(Integer, nullable=False)
    taxa_juros_anual = Column(Numeric(5, 2), nullable=False)
    taxa_juros_mensal = Column(Numeric(5, 4), nullable=False)
    sistema_amortizacao = Column(SQLEnum(SistemaAmortizacao), nullable=False)
    data_inicio = Column(Date, nullable=False)
    carencia_meses = Column(Integer, default=0)
    taxa_seguro_mensal = Column(Numeric(5, 4), default=0)
    taxa_administrativa = Column(Numeric(10, 2), default=0)
    
    # Resultados calculados
    valor_total_pago = Column(Numeric(12, 2), nullable=True)
    total_juros = Column(Numeric(12, 2), nullable=True)
    primeira_parcela = Column(Numeric(12, 2), nullable=True)
    ultima_parcela = Column(Numeric(12, 2), nullable=True)
    parcela_menor = Column(Numeric(12, 2), nullable=True)
    parcela_maior = Column(Numeric(12, 2), nullable=True)
    
    # Dados de renda (para análise de capacidade)
    renda_comprovada = Column(Numeric(12, 2), nullable=True)
    comprometimento_renda = Column(Numeric(5, 2), nullable=True)  # Percentual
    
    # Status da simulação
    convertida_em_financiamento = Column(Boolean, default=False)
    financiamento_id = Column(Integer, ForeignKey("financiamentos.id"), nullable=True)
    
    # Controle
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_name = Column(String(255), nullable=True)
    
    # Relacionamentos
    financiamento_gerado = relationship("Financiamento", back_populates="simulacao_origem")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('valor_financiado > 0', name='check_simulacao_valor_positivo'),
        CheckConstraint('prazo_meses > 0', name='check_simulacao_prazo_positivo'),
        CheckConstraint('taxa_juros_anual >= 0', name='check_simulacao_taxa_positiva'),
        CheckConstraint('carencia_meses >= 0', name='check_simulacao_carencia_positiva'),
    )
    
    def __repr__(self):
        return f"<SimulacaoFinanciamento(id={self.id}, valor={self.valor_financiado}, sistema='{self.sistema_amortizacao}')>"

class HistoricoFinanciamento(Base):
    __tablename__ = "historico_financiamentos"
    
    id = Column(Integer, primary_key=True)
    financiamento_id = Column(Integer, ForeignKey("financiamentos.id"), nullable=False)
    data_alteracao = Column(DateTime, default=datetime.utcnow)
    tipo_operacao = Column(String(50), nullable=False)  # 'adiantamento', 'pagamento_parcela', 'criacao', etc.
    descricao = Column(Text, nullable=False)
    
    # Dados anteriores
    saldo_devedor_anterior = Column(Numeric(15, 2), nullable=True)
    parcelas_pagas_anterior = Column(Integer, nullable=True)
    valor_parcela_anterior = Column(Numeric(15, 2), nullable=True)
    
    # Dados novos
    saldo_devedor_novo = Column(Numeric(15, 2), nullable=True)
    parcelas_pagas_novo = Column(Integer, nullable=True)
    valor_parcela_novo = Column(Numeric(15, 2), nullable=True)
    
    # Valor da operação
    valor_operacao = Column(Numeric(15, 2), nullable=True)
    economia_juros = Column(Numeric(15, 2), nullable=True)
    
    # Dados adicionais em JSON
    dados_adicionais = Column(Text, nullable=True)  # JSON string com informações extras
    
    # Relationships
    financiamento = relationship("Financiamento", back_populates="historico")
    
    def __repr__(self):
        return f"<HistoricoFinanciamento(id={self.id}, financiamento_id={self.financiamento_id}, tipo_operacao='{self.tipo_operacao}')>"

# Os campos de financiamento foram adicionados diretamente ao modelo Transacao em financial.py 