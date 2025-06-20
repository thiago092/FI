from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class ConfirmacaoTransacao(Base):
    __tablename__ = "confirmacoes_transacao"

    id = Column(Integer, primary_key=True, index=True)
    
    # Dados da transação
    descricao = Column(String(500), nullable=False)
    valor = Column(Float, nullable=False)
    tipo = Column(String(10), nullable=False)  # ENTRADA ou SAIDA
    data_transacao = Column(DateTime, nullable=False)
    
    # Chaves estrangeiras
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    conta_id = Column(Integer, ForeignKey("contas.id"), nullable=True)
    cartao_id = Column(Integer, ForeignKey("cartoes.id"), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    transacao_recorrente_id = Column(Integer, ForeignKey("transacoes_recorrentes.id"), nullable=False)
    transacao_id = Column(Integer, ForeignKey("transacoes.id"), nullable=True)  # Preenchido quando confirmada
    
    # Dados de confirmação
    status = Column(String(20), nullable=False, default="pendente")  # pendente, confirmada, cancelada, auto_confirmada
    criada_em = Column(DateTime, nullable=False, default=datetime.utcnow)
    expira_em = Column(DateTime, nullable=False)
    processada_em = Column(DateTime, nullable=True)
    
    # Dados de controle
    criada_por_usuario = Column(String(200), nullable=True)  # Nome do usuário que configurou a confirmação
    
    # Relacionamentos
    categoria = relationship("Categoria", back_populates="confirmacoes_transacao")
    conta = relationship("Conta", back_populates="confirmacoes_transacao")
    cartao = relationship("Cartao", back_populates="confirmacoes_transacao")
    tenant = relationship("Tenant", back_populates="confirmacoes_transacao")
    transacao_recorrente = relationship("TransacaoRecorrente", back_populates="confirmacoes")
    transacao = relationship("Transacao", back_populates="confirmacao_origem")

    def __repr__(self):
        return f"<ConfirmacaoTransacao(id={self.id}, descricao='{self.descricao}', valor={self.valor}, status='{self.status}')>" 