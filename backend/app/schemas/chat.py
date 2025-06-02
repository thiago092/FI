from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from ..models.financial import TipoMensagem

# Schemas para ChatMessage
class ChatMessageBase(BaseModel):
    tipo: TipoMensagem
    conteudo: str
    via_voz: bool = False
    transacao_criada: bool = False
    transacao_id: Optional[int] = None

class ChatMessageCreate(ChatMessageBase):
    sessao_id: int

class ChatMessageResponse(ChatMessageBase):
    id: int
    sessao_id: int
    criado_em: datetime
    tenant_id: str
    
    class Config:
        from_attributes = True

# Schemas para ChatSession
class ChatSessionBase(BaseModel):
    titulo: Optional[str] = None
    ativa: bool = True

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSessionUpdate(BaseModel):
    titulo: Optional[str] = None
    ativa: Optional[bool] = None

class ChatSessionResponse(ChatSessionBase):
    id: int
    tenant_id: str
    criado_em: datetime
    atualizado_em: datetime
    total_mensagens: int
    transacoes_criadas: int
    
    class Config:
        from_attributes = True

class ChatSessionWithMessages(ChatSessionResponse):
    mensagens: List[ChatMessageResponse] = []

# Schemas para busca e filtros
class ChatHistoryFilters(BaseModel):
    limit: int = 50
    offset: int = 0
    busca: Optional[str] = None
    data_inicio: Optional[datetime] = None
    data_fim: Optional[datetime] = None
    apenas_ativas: bool = True

class ChatSearchResponse(BaseModel):
    total: int
    sessoes: List[ChatSessionResponse]
    
class ResumoChat(BaseModel):
    total_sessoes: int
    total_mensagens: int
    transacoes_via_chat: int
    sessoes_ativas: int
    ultima_conversa: Optional[datetime] = None 