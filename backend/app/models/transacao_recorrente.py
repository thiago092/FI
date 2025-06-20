from sqlalchemy import Column, Integer, String, Numeric, Boolean, Date, DateTime, ForeignKey, CheckConstraint, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base

class TransacaoRecorrente(Base):
    __tablename__ = "transacoes_recorrentes"
    
    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String, nullable=False)
    valor = Column(Numeric(10, 2), nullable=False)
    tipo = Column(String, nullable=False)  # 'ENTRADA' ou 'SAIDA'
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    conta_id = Column(Integer, ForeignKey("contas.id"), nullable=True)
    cartao_id = Column(Integer, ForeignKey("cartoes.id"), nullable=True)
    frequencia = Column(String, nullable=False)  # 'MENSAL', 'SEMANAL', etc.
    data_inicio = Column(Date, nullable=False)
    data_fim = Column(Date, nullable=True)
    ativa = Column(Boolean, default=True)
    icone_personalizado = Column(String(50), nullable=True)  # Ícone personalizado (netflix, spotify, etc.)
    created_by_name = Column(String(255), nullable=True)  # Identificação de quem criou a transação recorrente
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    categoria = relationship("Categoria")
    conta = relationship("Conta")
    cartao = relationship("Cartao")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('valor > 0', name='check_valor_positivo'),
        CheckConstraint(
            '(conta_id IS NOT NULL AND cartao_id IS NULL) OR (conta_id IS NULL AND cartao_id IS NOT NULL)',
            name='check_forma_pagamento'
        ),
        CheckConstraint('data_fim IS NULL OR data_fim > data_inicio', name='check_data_fim'),
        CheckConstraint(
            "frequencia IN ('DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL')",
            name='check_frequencia_valida'
        ),
    )
    
    def __repr__(self):
        return f"<TransacaoRecorrente(id={self.id}, descricao='{self.descricao}', valor={self.valor})>"

class ConfirmacaoTransacao(Base):
    __tablename__ = "confirmacoes_transacao"
    
    id = Column(Integer, primary_key=True, index=True)
    transacao_recorrente_id = Column(Integer, ForeignKey("transacoes_recorrentes.id"), nullable=False)
    
    # Dados da transação que será criada
    descricao = Column(String, nullable=False)
    valor = Column(Numeric(10, 2), nullable=False)
    tipo = Column(String, nullable=False)  # 'ENTRADA' ou 'SAIDA'
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    conta_id = Column(Integer, ForeignKey("contas.id"), nullable=True)
    cartao_id = Column(Integer, ForeignKey("cartoes.id"), nullable=True)
    data_transacao = Column(Date, nullable=False)  # Quando a transação deveria ocorrer
    
    # Status da confirmação
    status = Column(String, default="PENDENTE")  # PENDENTE, CONFIRMADA, CANCELADA, AUTO_CONFIRMADA
    
    # Controle de tempo
    criada_em = Column(DateTime, default=datetime.utcnow)
    expira_em = Column(DateTime, nullable=False)  # Quando auto-confirma
    respondida_em = Column(DateTime, nullable=True)
    
    # ID da transação criada (se confirmada)
    transacao_id = Column(Integer, ForeignKey("transacoes.id"), nullable=True)
    
    # Telegram info para notificação
    telegram_user_id = Column(String, nullable=True)
    telegram_message_id = Column(String, nullable=True)  # Para editar mensagem
    
    # Identificação de quem deve confirmar
    criada_por_usuario = Column(String, nullable=True)  # Nome do usuário que criou a transação recorrente
    
    # Observações
    observacoes = Column(Text, nullable=True)
    
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    # Relacionamentos
    transacao_recorrente = relationship("TransacaoRecorrente")
    categoria = relationship("Categoria")
    conta = relationship("Conta")
    cartao = relationship("Cartao")
    transacao = relationship("Transacao")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('valor > 0', name='check_confirmacao_valor_positivo'),
        CheckConstraint(
            '(conta_id IS NOT NULL AND cartao_id IS NULL) OR (conta_id IS NULL AND cartao_id IS NOT NULL)',
            name='check_confirmacao_forma_pagamento'
        ),
        CheckConstraint(
            "status IN ('PENDENTE', 'CONFIRMADA', 'CANCELADA', 'AUTO_CONFIRMADA')",
            name='check_status_valido'
        ),
    )
    
    def __repr__(self):
        return f"<ConfirmacaoTransacao(id={self.id}, descricao='{self.descricao}', status='{self.status}')>" 