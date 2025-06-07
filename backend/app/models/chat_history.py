from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base

class ChatHistory(Base):
    __tablename__ = "chat_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mensagem_usuario = Column(Text, nullable=False)
    resposta_ia = Column(Text, nullable=False)
    fonte_dados = Column(String(50), default="chat_generico")  # mcp_real_data, chat_generico, erro
    intent_detectado = Column(String(100), nullable=True)  # transacoes, saldo, etc.
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    user = relationship("User") 