from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from ..database import get_db
from ..core.security import get_current_active_user
from ..models.user import User
from ..services.chat_ai_service import ChatAIService
from ..services.chat_history_service import ChatHistoryService
from ..services.vision_service import VisionService
from ..schemas.financial import TransacaoResponse
from ..schemas.chat import (
    ChatHistoryFilters, ChatSearchResponse, ChatSessionResponse,
    ChatSessionWithMessages, ChatSessionUpdate, ResumoChat
)
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class ChatMensagem(BaseModel):
    mensagem: str

class ChatResposta(BaseModel):
    resposta: str
    sucesso: bool
    transacao_criada: bool = False
    transacao: Optional[TransacaoResponse] = Field(default=None)
    detalhes: Dict[str, Any] = Field(default_factory=dict)

def get_chat_service(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)) -> ChatAIService:
    """Dependency para obter o serviço de chat"""
    try:
        # Para admin global sem tenant, usar tenant padrão "1"
        # Para usuários de tenant, usar seu tenant_id
        if current_user.is_global_admin and not current_user.tenant_id:
            tenant_id = "1"  # Tenant padrão para admin global
        elif current_user.tenant_id:
            tenant_id = str(current_user.tenant_id)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must belong to a tenant or be global admin"
            )
        
        # Usar a chave específica fornecida
        openai_key = "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"
        
        return ChatAIService(
            db=db,
            openai_api_key=openai_key,
            tenant_id=tenant_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating chat service: {str(e)}")

def get_history_service(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)) -> ChatHistoryService:
    """Dependency para obter o serviço de histórico"""
    try:
        # Para admin global sem tenant, usar tenant padrão "1"
        # Para usuários de tenant, usar seu tenant_id
        if current_user.is_global_admin and not current_user.tenant_id:
            tenant_id = "1"  # Tenant padrão para admin global
        elif current_user.tenant_id:
            tenant_id = str(current_user.tenant_id)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must belong to a tenant or be global admin"
            )
        
        return ChatHistoryService(db=db, tenant_id=tenant_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating history service: {str(e)}")

@router.post("/processar")
async def processar_mensagem(
    request: Dict[str, Any],
    chat_service: ChatAIService = Depends(get_chat_service)
) -> Dict[str, Any]:
    """Processa mensagem do usuário com histórico"""
    try:
        mensagem = request.get("mensagem", "").strip()
        sessao_id = request.get("sessao_id")
        via_voz = request.get("via_voz", False)
        
        if not mensagem:
            raise HTTPException(status_code=400, detail="Mensagem não pode estar vazia")
        
        # Processar com o novo método que inclui histórico
        resultado = chat_service.processar_mensagem(mensagem, sessao_id)
        
        # Atualizar campo via_voz se necessário
        if via_voz and resultado.get('mensagem_id'):
            # Atualizar mensagem do usuário como via voz
            from ..models.financial import ChatMessage
            mensagem_obj = chat_service.db.query(ChatMessage).filter(
                ChatMessage.id == resultado['mensagem_id'] - 1  # Mensagem anterior (do usuário)
            ).first()
            if mensagem_obj:
                mensagem_obj.via_voz = True
                chat_service.db.commit()
        
        return resultado
        
    except Exception as e:
        print(f"Erro ao processar mensagem: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/estatisticas")
async def obter_estatisticas(
    chat_service: ChatAIService = Depends(get_chat_service)
) -> Dict[str, Any]:
    """Obtém estatísticas do chat incluindo histórico"""
    try:
        return chat_service.obter_estatisticas()
    except Exception as e:
        print(f"Erro ao obter estatísticas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# NOVOS ENDPOINTS DE HISTÓRICO

@router.get("/historico", response_model=ChatSearchResponse)
async def listar_historico(
    limit: int = 50,
    offset: int = 0,
    busca: Optional[str] = None,
    data_inicio: Optional[datetime] = None,
    data_fim: Optional[datetime] = None,
    apenas_ativas: bool = True,
    history_service: ChatHistoryService = Depends(get_history_service)
):
    """Lista histórico de conversas com filtros"""
    try:
        filtros = ChatHistoryFilters(
            limit=limit,
            offset=offset,
            busca=busca,
            data_inicio=data_inicio,
            data_fim=data_fim,
            apenas_ativas=apenas_ativas
        )
        
        return history_service.listar_sessoes(filtros)
    except Exception as e:
        print(f"Erro ao listar histórico: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessao/{sessao_id}", response_model=ChatSessionWithMessages)
async def obter_sessao(
    sessao_id: int,
    history_service: ChatHistoryService = Depends(get_history_service)
):
    """Obtém uma sessão específica com todas as mensagens"""
    try:
        sessao = history_service.obter_sessao_com_mensagens(sessao_id)
        if not sessao:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        return sessao
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao obter sessão: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/sessao/{sessao_id}", response_model=ChatSessionResponse)
async def atualizar_sessao(
    sessao_id: int,
    dados: ChatSessionUpdate,
    history_service: ChatHistoryService = Depends(get_history_service)
):
    """Atualiza dados de uma sessão (título, status)"""
    try:
        sessao = history_service.atualizar_sessao(sessao_id, dados)
        if not sessao:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        from ..schemas.chat import ChatSessionResponse
        return ChatSessionResponse.from_orm(sessao)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao atualizar sessão: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/sessao/{sessao_id}")
async def excluir_sessao(
    sessao_id: int,
    history_service: ChatHistoryService = Depends(get_history_service)
):
    """Exclui uma sessão e suas mensagens"""
    try:
        sucesso = history_service.excluir_sessao(sessao_id)
        if not sucesso:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        return {"message": "Sessão excluída com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao excluir sessão: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/buscar")
async def buscar_mensagens(
    termo: str,
    limite: int = 20,
    history_service: ChatHistoryService = Depends(get_history_service)
):
    """Busca mensagens por termo"""
    try:
        if not termo.strip():
            raise HTTPException(status_code=400, detail="Termo de busca não pode estar vazio")
        
        mensagens = history_service.buscar_mensagens(termo, limite)
        return {"mensagens": mensagens}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao buscar mensagens: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/resumo-historico", response_model=ResumoChat)
async def obter_resumo_chat(
    history_service: ChatHistoryService = Depends(get_history_service)
):
    """Obtém resumo estatístico do chat"""
    try:
        return history_service.obter_resumo()
    except Exception as e:
        print(f"Erro ao obter resumo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/nova-sessao", response_model=ChatSessionResponse)
async def criar_nova_sessao(
    titulo: Optional[str] = None,
    history_service: ChatHistoryService = Depends(get_history_service)
):
    """Cria uma nova sessão de chat"""
    try:
        sessao = history_service.criar_sessao(titulo)
        from ..schemas.chat import ChatSessionResponse
        return ChatSessionResponse.from_orm(sessao)
    except Exception as e:
        print(f"Erro ao criar sessão: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessao-ativa", response_model=ChatSessionResponse)
async def obter_sessao_ativa(
    history_service: ChatHistoryService = Depends(get_history_service)
):
    """Obtém ou cria a sessão ativa atual"""
    try:
        sessao = history_service.obter_sessao_ativa()
        from ..schemas.chat import ChatSessionResponse
        return ChatSessionResponse.from_orm(sessao)
    except Exception as e:
        print(f"Erro ao obter sessão ativa: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/arquivar-antigas")
async def arquivar_sessoes_antigas(
    dias: int = 30,
    history_service: ChatHistoryService = Depends(get_history_service)
):
    """Arquiva sessões antigas (marca como inativas)"""
    try:
        count = history_service.arquivar_sessoes_antigas(dias)
        return {"message": f"{count} sessões foram arquivadas"}
    except Exception as e:
        print(f"Erro ao arquivar sessões: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/processar-imagem", response_model=ChatResposta)
async def processar_imagem(
    file: UploadFile = File(...),
    chat_service: ChatAIService = Depends(get_chat_service)
) -> ChatResposta:
    """Processa uma imagem e retorna a resposta"""
    try:
        # Ler o conteúdo do arquivo enviado
        file_content = await file.read()
        
        # Processar a imagem usando o serviço de chat
        resultado = await chat_service.processar_imagem(file_content, file.filename or "imagem.jpg")
        
        return ChatResposta(
            resposta=resultado['resposta'],
            sucesso=resultado['sucesso'],
            transacao_criada=resultado['transacao_criada'],
            transacao=resultado['transacao'],
            detalhes=resultado['detalhes']
        )
    except Exception as e:
        print(f"Erro ao processar imagem: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 