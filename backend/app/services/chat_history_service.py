from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
import re

from ..models.financial import ChatSession, ChatMessage, TipoMensagem, Transacao
from ..schemas.chat import (
    ChatSessionCreate, ChatSessionUpdate, ChatSessionResponse, 
    ChatMessageCreate, ChatMessageResponse, ChatHistoryFilters,
    ChatSearchResponse, ResumoChat, ChatSessionWithMessages
)

class ChatHistoryService:
    def __init__(self, db: Session, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id

    def criar_sessao(self, titulo: Optional[str] = None) -> ChatSession:
        """Cria uma nova sessão de chat"""
        if not titulo:
            # Gerar título baseado na data
            titulo = f"Conversa {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        
        sessao = ChatSession(
            titulo=titulo,
            tenant_id=self.tenant_id
        )
        
        self.db.add(sessao)
        self.db.commit()
        self.db.refresh(sessao)
        
        return sessao

    def obter_sessao_ativa(self) -> Optional[ChatSession]:
        """Obtém a sessão ativa mais recente ou cria uma nova"""
        sessao = self.db.query(ChatSession).filter(
            and_(
                ChatSession.tenant_id == self.tenant_id,
                ChatSession.ativa == True
            )
        ).order_by(desc(ChatSession.atualizado_em)).first()
        
        if not sessao:
            sessao = self.criar_sessao()
        
        return sessao

    def adicionar_mensagem(
        self, 
        sessao_id: int, 
        tipo: TipoMensagem, 
        conteudo: str,
        via_voz: bool = False,
        transacao_criada: bool = False,
        transacao_id: Optional[int] = None
    ) -> ChatMessage:
        """Adiciona uma mensagem à sessão"""
        
        mensagem = ChatMessage(
            sessao_id=sessao_id,
            tipo=tipo,
            conteudo=conteudo,
            via_voz=via_voz,
            transacao_criada=transacao_criada,
            transacao_id=transacao_id,
            tenant_id=self.tenant_id
        )
        
        self.db.add(mensagem)
        
        # Atualizar contadores da sessão
        sessao = self.db.query(ChatSession).filter(ChatSession.id == sessao_id).first()
        if sessao:
            sessao.total_mensagens += 1
            if transacao_criada:
                sessao.transacoes_criadas += 1
            sessao.atualizado_em = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(mensagem)
        
        return mensagem

    def listar_sessoes(self, filtros: ChatHistoryFilters) -> ChatSearchResponse:
        """Lista sessões com filtros"""
        query = self.db.query(ChatSession).filter(ChatSession.tenant_id == self.tenant_id)
        
        # Filtros
        if filtros.apenas_ativas:
            query = query.filter(ChatSession.ativa == True)
        
        if filtros.busca:
            # Buscar no título da sessão ou conteúdo das mensagens
            busca_pattern = f"%{filtros.busca}%"
            query = query.filter(
                or_(
                    ChatSession.titulo.ilike(busca_pattern),
                    ChatSession.id.in_(
                        self.db.query(ChatMessage.sessao_id).filter(
                            and_(
                                ChatMessage.tenant_id == self.tenant_id,
                                ChatMessage.conteudo.ilike(busca_pattern)
                            )
                        )
                    )
                )
            )
        
        if filtros.data_inicio:
            query = query.filter(ChatSession.criado_em >= filtros.data_inicio)
        
        if filtros.data_fim:
            query = query.filter(ChatSession.criado_em <= filtros.data_fim)
        
        # Contar total
        total = query.count()
        
        # Aplicar paginação e ordenação
        sessoes = query.order_by(desc(ChatSession.atualizado_em))\
                      .offset(filtros.offset)\
                      .limit(filtros.limit)\
                      .all()
        
        return ChatSearchResponse(
            total=total,
            sessoes=[ChatSessionResponse.from_orm(s) for s in sessoes]
        )

    def obter_sessao_com_mensagens(self, sessao_id: int) -> Optional[ChatSessionWithMessages]:
        """Obtém uma sessão específica com todas as mensagens"""
        sessao = self.db.query(ChatSession).filter(
            and_(
                ChatSession.id == sessao_id,
                ChatSession.tenant_id == self.tenant_id
            )
        ).first()
        
        if not sessao:
            return None
        
        mensagens = self.db.query(ChatMessage).filter(
            ChatMessage.sessao_id == sessao_id
        ).order_by(ChatMessage.criado_em).all()
        
        return ChatSessionWithMessages(
            **sessao.__dict__,
            mensagens=[ChatMessageResponse.from_orm(m) for m in mensagens]
        )

    def atualizar_sessao(self, sessao_id: int, dados: ChatSessionUpdate) -> Optional[ChatSession]:
        """Atualiza dados de uma sessão"""
        sessao = self.db.query(ChatSession).filter(
            and_(
                ChatSession.id == sessao_id,
                ChatSession.tenant_id == self.tenant_id
            )
        ).first()
        
        if not sessao:
            return None
        
        if dados.titulo is not None:
            sessao.titulo = dados.titulo
        if dados.ativa is not None:
            sessao.ativa = dados.ativa
        
        sessao.atualizado_em = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(sessao)
        
        return sessao

    def excluir_sessao(self, sessao_id: int) -> bool:
        """Exclui uma sessão e suas mensagens"""
        sessao = self.db.query(ChatSession).filter(
            and_(
                ChatSession.id == sessao_id,
                ChatSession.tenant_id == self.tenant_id
            )
        ).first()
        
        if not sessao:
            return False
        
        self.db.delete(sessao)
        self.db.commit()
        
        return True

    def buscar_mensagens(self, termo: str, limite: int = 20) -> List[ChatMessageResponse]:
        """Busca mensagens por termo"""
        mensagens = self.db.query(ChatMessage).filter(
            and_(
                ChatMessage.tenant_id == self.tenant_id,
                ChatMessage.conteudo.ilike(f"%{termo}%")
            )
        ).order_by(desc(ChatMessage.criado_em)).limit(limite).all()
        
        return [ChatMessageResponse.from_orm(m) for m in mensagens]

    def obter_resumo(self) -> ResumoChat:
        """Obtém resumo estatístico do chat"""
        total_sessoes = self.db.query(func.count(ChatSession.id)).filter(
            ChatSession.tenant_id == self.tenant_id
        ).scalar() or 0
        
        total_mensagens = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.tenant_id == self.tenant_id
        ).scalar() or 0
        
        transacoes_via_chat = self.db.query(func.count(ChatMessage.id)).filter(
            and_(
                ChatMessage.tenant_id == self.tenant_id,
                ChatMessage.transacao_criada == True
            )
        ).scalar() or 0
        
        sessoes_ativas = self.db.query(func.count(ChatSession.id)).filter(
            and_(
                ChatSession.tenant_id == self.tenant_id,
                ChatSession.ativa == True
            )
        ).scalar() or 0
        
        ultima_conversa = self.db.query(func.max(ChatMessage.criado_em)).filter(
            ChatMessage.tenant_id == self.tenant_id
        ).scalar()
        
        return ResumoChat(
            total_sessoes=total_sessoes,
            total_mensagens=total_mensagens,
            transacoes_via_chat=transacoes_via_chat,
            sessoes_ativas=sessoes_ativas,
            ultima_conversa=ultima_conversa
        )

    def gerar_titulo_inteligente(self, mensagens: List[str]) -> str:
        """Gera título inteligente baseado no conteúdo das mensagens"""
        if not mensagens:
            return f"Conversa {datetime.now().strftime('%d/%m/%Y')}"
        
        # Análise simples do conteúdo
        conteudo_completo = " ".join(mensagens).lower()
        
        # Palavras-chave para categorização
        categorias = {
            "gastos": ["gastei", "paguei", "comprei", "despesa"],
            "receitas": ["recebi", "ganho", "salário", "renda"],
            "planejamento": ["planejar", "budget", "orçamento", "meta"],
            "consulta": ["mostrar", "ver", "saldo", "extrato"]
        }
        
        for categoria, palavras in categorias.items():
            if any(palavra in conteudo_completo for palavra in palavras):
                data = datetime.now().strftime('%d/%m')
                return f"Conversa sobre {categoria} - {data}"
        
        return f"Conversa {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    def arquivar_sessoes_antigas(self, dias: int = 30) -> int:
        """Arquiva sessões antigas (marca como inativas)"""
        data_limite = datetime.utcnow() - timedelta(days=dias)
        
        sessoes_antigas = self.db.query(ChatSession).filter(
            and_(
                ChatSession.tenant_id == self.tenant_id,
                ChatSession.ativa == True,
                ChatSession.atualizado_em < data_limite
            )
        ).all()
        
        for sessao in sessoes_antigas:
            sessao.ativa = False
        
        self.db.commit()
        
        return len(sessoes_antigas) 