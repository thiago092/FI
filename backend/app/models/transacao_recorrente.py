from sqlalchemy import Column, Integer, String, Numeric, Boolean, Date, DateTime, ForeignKey, CheckConstraint
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
    dia_vencimento = Column(Integer, nullable=False)
    data_inicio = Column(Date, nullable=False)
    data_fim = Column(Date, nullable=True)
    ativa = Column(Boolean, default=True)
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
        CheckConstraint('dia_vencimento BETWEEN 1 AND 31', name='check_dia_vencimento'),
        CheckConstraint('data_fim IS NULL OR data_fim > data_inicio', name='check_data_fim'),
    )
    
    def __repr__(self):
        return f"<TransacaoRecorrente(id={self.id}, descricao='{self.descricao}', valor={self.valor})>" 