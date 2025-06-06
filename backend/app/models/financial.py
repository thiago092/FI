from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Enum as SQLEnum, Text, Date
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
    vencimento = Column(Integer)  # Dia do mês (1-31) - DIA DE VENCIMENTO DA FATURA
    dia_fechamento = Column(Integer, nullable=True)  # Dia do mês (1-31) - DIA DE FECHAMENTO DA FATURA
    
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
    # Novo relacionamento para parcelamentos
    compras_parceladas = relationship("CompraParcelada", back_populates="cartao")

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

# NOVO: Modelo para compras parceladas
class CompraParcelada(Base):
    __tablename__ = "compras_parceladas"
    
    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String, nullable=False)  # Ex: "iPhone 15 Pro"
    valor_total = Column(Float, nullable=False)  # Ex: 6000.00
    numero_parcelas = Column(Integer, nullable=False)  # Ex: 12 (usar nome real da coluna)
    valor_parcela = Column(Float, nullable=False)  # Ex: 500.00
    
    # Cartão onde foi feita a compra
    cartao_id = Column(Integer, ForeignKey("cartoes.id"), nullable=False)
    
    # Data da primeira parcela
    data_compra = Column(Date, nullable=False)  # usar nome real da coluna
    
    # Status da compra parcelada
    categoria_id = Column(Integer, nullable=True)  # coluna existente
    status = Column(String, default="ativa")  # coluna existente
    parcelas_pagas = Column(Integer, default=0)  # coluna existente
    
    # Tenant isolation
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Propriedades para compatibilidade com o código existente
    @property
    def total_parcelas(self):
        return self.numero_parcelas
    
    @total_parcelas.setter
    def total_parcelas(self, value):
        self.numero_parcelas = value
        
    @property
    def data_primeira_parcela(self):
        return self.data_compra
    
    @data_primeira_parcela.setter
    def data_primeira_parcela(self, value):
        self.data_compra = value
        
    @property
    def ativa(self):
        return self.status == "ativa"
    
    @ativa.setter
    def ativa(self, value):
        self.status = "ativa" if value else "inativa"
    
    # Relacionamentos
    cartao = relationship("Cartao", back_populates="compras_parceladas")
    parcelas = relationship("ParcelaCartao", back_populates="compra_parcelada", cascade="all, delete-orphan")
    # Relacionamento com transações geradas
    transacoes = relationship("Transacao", back_populates="compra_parcelada")

# NOVO: Modelo para parcelas individuais
class ParcelaCartao(Base):
    __tablename__ = "parcelas_cartao"
    
    id = Column(Integer, primary_key=True, index=True)
    compra_parcelada_id = Column(Integer, ForeignKey("compras_parceladas.id"), nullable=False)
    numero_parcela = Column(Integer, nullable=False)  # 1, 2, 3, 4... até total_parcelas
    valor = Column(Float, nullable=False)  # CORRIGIDO: usar nome real da coluna
    data_vencimento = Column(Date, nullable=False)  # Quando esta parcela será processada
    
    # Status da parcela - CORRIGIDO: usar nomes reais das colunas
    paga = Column(Boolean, default=False)  # usar nome real da coluna
    processada = Column(Boolean, default=False)  # usar nome real da coluna
    
    # Transação gerada para esta parcela (quando processada)
    transacao_id = Column(Integer, ForeignKey("transacoes.id"), nullable=True)
    
    # Tenant isolation
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos - CORRIGIDO: especificar foreign_keys explicitamente
    compra_parcelada = relationship("CompraParcelada", back_populates="parcelas")
    transacao = relationship("Transacao", foreign_keys=[transacao_id], back_populates="parcela_cartao")

class Transacao(Base):
    __tablename__ = "transacoes"
    
    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String, nullable=False)
    valor = Column(Float, nullable=False)
    tipo = Column(SQLEnum(TipoTransacao), nullable=False)
    data = Column(DateTime, nullable=False)
    
    # Método de pagamento (cartão ou conta)
    cartao_id = Column(Integer, ForeignKey("cartoes.id"), nullable=True)
    conta_id = Column(Integer, ForeignKey("contas.id"), nullable=True)
    
    # Fatura do cartão (para transações no cartão)
    fatura_id = Column(Integer, ForeignKey("faturas.id"), nullable=True)
    
    # Categoria
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    
    # Observações adicionais
    observacoes = Column(Text, nullable=True)
    
    # Dados da IA (para auditoria)
    processado_por_ia = Column(Boolean, default=False)
    prompt_original = Column(Text, nullable=True)  # O que o usuário digitou/falou
    
    # NOVOS CAMPOS PARA PARCELAMENTOS (opcionais - compatibilidade com dados existentes)
    # Se esta transação faz parte de uma compra parcelada
    compra_parcelada_id = Column(Integer, ForeignKey("compras_parceladas.id"), nullable=True)
    # Se esta transação representa uma parcela específica  
    parcela_cartao_id = Column(Integer, ForeignKey("parcelas_cartao.id"), nullable=True)
    # Para identificar facilmente transações parceladas
    is_parcelada = Column(Boolean, default=False)
    numero_parcela = Column(Integer, nullable=True)  # Ex: 1, 2, 3...
    total_parcelas = Column(Integer, nullable=True)  # Ex: 12 (para mostrar "3/12")
    
    # Tenant isolation
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    cartao = relationship("Cartao", back_populates="transacoes")
    conta = relationship("Conta", back_populates="transacoes")
    categoria = relationship("Categoria", back_populates="transacoes")
    fatura = relationship("Fatura", back_populates="transacoes", foreign_keys=[fatura_id])
    # Novos relacionamentos para parcelamentos - CORRIGIDO: especificar foreign_keys explicitamente
    compra_parcelada = relationship("CompraParcelada", back_populates="transacoes", foreign_keys=[compra_parcelada_id])
    parcela_cartao = relationship("ParcelaCartao", foreign_keys="ParcelaCartao.transacao_id", back_populates="transacao")

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