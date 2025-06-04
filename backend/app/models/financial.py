from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Enum as SQLEnum, Text, Date, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime, date
from enum import Enum
from ..database import Base

class TipoTransacao(str, Enum):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"

class TipoConta(Enum):
    CORRENTE = "corrente"
    POUPANCA = "poupanca"
    INVESTIMENTO = "investimento"

class StatusFatura(str, Enum):
    ABERTA = "aberta"
    FECHADA = "fechada"
    PAGA = "paga"

class StatusPlano(str, Enum):
    ATIVO = "ATIVO"
    PAUSADO = "PAUSADO"
    FINALIZADO = "FINALIZADO"

class TipoMensagem(str, Enum):
    USUARIO = "USUARIO"
    BOT = "BOT"

class Categoria(Base):
    __tablename__ = "categorias"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    cor = Column(String, default="#3B82F6")  # Cor hex para UI
    icone = Column(String, default="📊")
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    transacoes = relationship("Transacao", back_populates="categoria")

class Cartao(Base):
    __tablename__ = "cartoes"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)  # Ex: "Nubank Roxinho"
    bandeira = Column(String, nullable=False)  # Ex: "Mastercard", "Visa"
    numero_final = Column(String(4), nullable=True)  # Últimos 4 dígitos do cartão
    limite = Column(Float, default=0.0)
    vencimento = Column(Integer)  # Dia do mês (1-31)
    
    # Conta vinculada para débito automático da fatura
    conta_vinculada_id = Column(Integer, ForeignKey("contas.id"), nullable=True)
    
    cor = Column(String, default="#8B5CF6")  # Cor hex para UI
    ativo = Column(Boolean, default=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    transacoes = relationship("Transacao", back_populates="cartao")
    faturas = relationship("Fatura", back_populates="cartao")
    conta_vinculada = relationship("Conta", foreign_keys=[conta_vinculada_id])

class Conta(Base):
    __tablename__ = "contas"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)  # Ex: "Conta Corrente Itaú"
    banco = Column(String, nullable=False)  # Ex: "Itaú", "Bradesco"
    tipo = Column(String, default="corrente")  # Changed from Enum to String
    numero = Column(String, nullable=True)  # Número da conta
    agencia = Column(String, nullable=True)  # Agência
    saldo_inicial = Column(Float, default=0.0)
    cor = Column(String, default="#10B981")  # Cor hex para UI
    ativo = Column(Boolean, default=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    transacoes = relationship("Transacao", back_populates="conta")

class Fatura(Base):
    __tablename__ = "faturas"
    
    id = Column(Integer, primary_key=True, index=True)
    cartao_id = Column(Integer, ForeignKey("cartoes.id"), nullable=False)
    mes_referencia = Column(Integer, nullable=False)  # 1-12
    ano_referencia = Column(Integer, nullable=False)  # 2023, 2024...
    data_vencimento = Column(Date, nullable=False)
    valor_total = Column(Float, default=0.0)
    status = Column(SQLEnum(StatusFatura), default=StatusFatura.ABERTA)
    
    # Transação de pagamento da fatura (quando paga)
    transacao_pagamento_id = Column(Integer, ForeignKey("transacoes.id"), nullable=True)
    
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    cartao = relationship("Cartao", back_populates="faturas")
    transacoes = relationship("Transacao", back_populates="fatura", foreign_keys="Transacao.fatura_id")
    transacao_pagamento = relationship("Transacao", foreign_keys=[transacao_pagamento_id], post_update=True)

class Transacao(Base):
    __tablename__ = "transacoes"
    
    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String(255), nullable=False)
    valor = Column(Float, nullable=False)
    tipo = Column(String(10), nullable=False)  # ENTRADA, SAIDA
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    conta_id = Column(Integer, ForeignKey("contas.id"), nullable=True)
    cartao_id = Column(Integer, ForeignKey("cartoes.id"), nullable=True)
    data = Column(Date, nullable=False)
    observacoes = Column(Text, nullable=True)
    fatura_id = Column(Integer, ForeignKey("faturas.id"), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Campos para parcelamento
    is_parcelada = Column(Boolean, default=False)
    numero_parcela = Column(Integer, nullable=True)  # Ex: 3 (terceira parcela)
    total_parcelas = Column(Integer, nullable=True)  # Ex: 12 (total de parcelas)
    compra_parcelada_id = Column(Integer, ForeignKey("compras_parceladas.id"), nullable=True)

    # Relacionamentos
    categoria = relationship("Categoria", back_populates="transacoes")
    fatura = relationship("Fatura", back_populates="transacoes", foreign_keys=[fatura_id])
    compra_parcelada = relationship("CompraParcelada", back_populates="parcelas")
    tenant = relationship("Tenant")

class PlanejamentoMensal(Base):
    __tablename__ = "planejamentos_mensais"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)  # Ex: "Planejamento Dezembro 2024"
    descricao = Column(Text, nullable=True)
    
    # Período do planejamento
    mes = Column(Integer, nullable=False)  # 1-12
    ano = Column(Integer, nullable=False)  # 2024, 2025...
    
    # Meta de renda esperada para o mês
    renda_esperada = Column(Float, default=0.0)
    
    # Totais calculados
    total_planejado = Column(Float, default=0.0)  # Soma de todos os planos de categoria
    total_gasto = Column(Float, default=0.0)     # Soma dos gastos reais do mês
    
    status = Column(SQLEnum(StatusPlano), default=StatusPlano.ATIVO)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    planos_categoria = relationship("PlanoCategoria", back_populates="planejamento", cascade="all, delete-orphan")

class PlanoCategoria(Base):
    __tablename__ = "planos_categoria"
    
    id = Column(Integer, primary_key=True, index=True)
    planejamento_id = Column(Integer, ForeignKey("planejamentos_mensais.id"), nullable=False)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    
    # Valor planejado para gastar nesta categoria no mês
    valor_planejado = Column(Float, nullable=False)
    
    # Valor já gasto (calculado em tempo real)
    valor_gasto = Column(Float, default=0.0)
    
    # Prioridade (1=alta, 2=média, 3=baixa)
    prioridade = Column(Integer, default=2)
    
    # Observações específicas da categoria
    observacoes = Column(Text, nullable=True)
    
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    planejamento = relationship("PlanejamentoMensal", back_populates="planos_categoria")
    categoria = relationship("Categoria")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=True)  # "Conversa sobre gastos de Janeiro"
    tenant_id = Column(String(100), nullable=False, index=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    ativa = Column(Boolean, default=True)
    total_mensagens = Column(Integer, default=0)
    transacoes_criadas = Column(Integer, default=0)
    
    # Relacionamentos
    mensagens = relationship("ChatMessage", back_populates="sessao", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    sessao_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    tipo = Column(SQLEnum(TipoMensagem), nullable=False)
    conteudo = Column(Text, nullable=False)
    criado_em = Column(DateTime, default=datetime.utcnow)
    via_voz = Column(Boolean, default=False)
    transacao_criada = Column(Boolean, default=False)
    transacao_id = Column(Integer, ForeignKey("transacoes.id"), nullable=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    
    # Relacionamentos
    sessao = relationship("ChatSession", back_populates="mensagens")
    transacao = relationship("Transacao", backref="mensagem_chat")

class Parcela(Base):
    __tablename__ = "parcelas"

    id = Column(Integer, primary_key=True, index=True)
    transacao_origem_id = Column(Integer, ForeignKey("transacoes.id"), nullable=False)
    numero_parcela = Column(Integer, nullable=False)  # 1, 2, 3...
    total_parcelas = Column(Integer, nullable=False)  # Total de parcelas
    valor = Column(Numeric(10, 2), nullable=False)
    data_vencimento = Column(Date, nullable=False)
    status = Column(String(20), default="PENDENTE")  # PENDENTE, PAGA, VENCIDA
    data_pagamento = Column(Date, nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacionamentos
    transacao_origem = relationship("Transacao", back_populates="parcelas")
    tenant = relationship("Tenant")

class TransacaoRecorrente(Base):
    __tablename__ = "transacoes_recorrentes"

    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String(255), nullable=False)
    valor = Column(Numeric(10, 2), nullable=False)
    tipo = Column(String(10), nullable=False)  # ENTRADA, SAIDA
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    conta_id = Column(Integer, ForeignKey("contas.id"), nullable=True)
    cartao_id = Column(Integer, ForeignKey("cartoes.id"), nullable=True)
    frequencia = Column(String(20), nullable=False)  # MENSAL, SEMANAL, ANUAL
    dia_vencimento = Column(Integer, nullable=False)  # Dia do mês (1-31)
    data_inicio = Column(Date, nullable=False)
    data_fim = Column(Date, nullable=True)  # Null = infinito
    ativa = Column(Boolean, default=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacionamentos
    categoria = relationship("Categoria")
    conta = relationship("Conta")
    cartao = relationship("Cartao")
    tenant = relationship("Tenant")

class Financiamento(Base):
    __tablename__ = "financiamentos"

    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String(255), nullable=False)
    valor_total = Column(Numeric(12, 2), nullable=False)
    valor_entrada = Column(Numeric(12, 2), default=0)
    valor_financiado = Column(Numeric(12, 2), nullable=False)
    taxa_juros_mensal = Column(Numeric(5, 4), nullable=False)  # Ex: 0.0199 = 1.99%
    numero_parcelas = Column(Integer, nullable=False)
    valor_parcela = Column(Numeric(10, 2), nullable=False)
    data_contratacao = Column(Date, nullable=False)
    data_primeira_parcela = Column(Date, nullable=False)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    conta_id = Column(Integer, ForeignKey("contas.id"), nullable=False)
    status = Column(String(20), default="ATIVO")  # ATIVO, QUITADO, CANCELADO
    saldo_devedor = Column(Numeric(12, 2), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacionamentos
    categoria = relationship("Categoria")
    conta = relationship("Conta")
    tenant = relationship("Tenant")
    parcelas_financiamento = relationship("ParcelaFinanciamento", back_populates="financiamento")

class ParcelaFinanciamento(Base):
    __tablename__ = "parcelas_financiamento"

    id = Column(Integer, primary_key=True, index=True)
    financiamento_id = Column(Integer, ForeignKey("financiamentos.id"), nullable=False)
    numero_parcela = Column(Integer, nullable=False)
    valor_parcela = Column(Numeric(10, 2), nullable=False)
    valor_juros = Column(Numeric(10, 2), nullable=False)
    valor_amortizacao = Column(Numeric(10, 2), nullable=False)
    saldo_devedor = Column(Numeric(12, 2), nullable=False)
    data_vencimento = Column(Date, nullable=False)
    status = Column(String(20), default="PENDENTE")  # PENDENTE, PAGA, VENCIDA
    data_pagamento = Column(Date, nullable=True)
    valor_pago = Column(Numeric(10, 2), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    financiamento = relationship("Financiamento", back_populates="parcelas_financiamento")
    tenant = relationship("Tenant")

class CompraParcelada(Base):
    __tablename__ = "compras_parceladas"

    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String(255), nullable=False)
    valor_total = Column(Numeric(10, 2), nullable=False)
    numero_parcelas = Column(Integer, nullable=False)
    valor_parcela = Column(Numeric(10, 2), nullable=False)
    data_compra = Column(Date, nullable=False)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    cartao_id = Column(Integer, ForeignKey("cartoes.id"), nullable=False)
    status = Column(String(20), default="ATIVA")  # ATIVA, QUITADA, CANCELADA
    parcelas_pagas = Column(Integer, default=0)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    categoria = relationship("Categoria")
    cartao = relationship("Cartao")
    tenant = relationship("Tenant")
    parcelas = relationship("Transacao", back_populates="compra_parcelada") 