from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from ..database import get_db
from ..core.security import get_current_active_user, get_current_user
from ..models.user import User
from ..models.chat_history import ChatHistory
from ..services.chat_ai_service import ChatAIService
from ..services.chat_history_service import ChatHistoryService
from ..services.vision_service import VisionService
from ..schemas.financial import TransacaoResponse
from ..schemas.chat import (
    ChatHistoryFilters, ChatSearchResponse, ChatSessionResponse,
    ChatSessionWithMessages, ChatSessionUpdate, ResumoChat
)
from ..services.enhanced_chat_ai_service import enhanced_chat_service
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
async def processar_mensagem_chat(
    mensagem: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Processar mensagem de chat com MCP integration"""
    try:
        # Buscar histórico recente para contexto
        historico_recente = db.query(ChatHistory).filter(
            ChatHistory.user_id == current_user.id
        ).order_by(ChatHistory.timestamp.desc()).limit(5).all()
        
        # Converter para formato esperado
        chat_history = [
            {
                "pergunta": h.mensagem_usuario,
                "resposta": h.resposta_ia
            }
            for h in reversed(historico_recente)  # Ordem cronológica
        ]
        
        # Processar com Enhanced Chat Service (MCP)
        resultado = await enhanced_chat_service.process_message(
            message=mensagem,
            user_id=current_user.id,
            chat_history=chat_history
        )
        
        resposta = resultado.get('resposta', 'Desculpe, não consegui processar sua mensagem.')
        fonte = resultado.get('fonte', 'chat_generico')
        intent = resultado.get('intent')
        
        # Salvar no histórico
        chat_entry = ChatHistory(
            user_id=current_user.id,
            mensagem_usuario=mensagem,
            resposta_ia=resposta,
            fonte_dados=fonte,
            intent_detectado=intent,
            timestamp=datetime.utcnow()
        )
        db.add(chat_entry)
        db.commit()
        
        # Preparar resposta com metadados
        response_data = {
            "resposta": resposta,
            "fonte": fonte,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Adicionar indicadores visuais baseados na fonte
        if fonte == 'mcp_real_data':
            response_data["badge"] = "📊 Dados Reais"
            response_data["color"] = "green"
            response_data["intent"] = intent
        elif fonte == 'chat_generico':
            response_data["badge"] = "💡 Dica Geral" 
            response_data["color"] = "blue"
        
        # Log para monitoramento
        logger.info(f"💬 Chat MCP - User {current_user.id}: '{mensagem[:50]}...' → {fonte}")
        
        return response_data
        
    except Exception as e:
        logger.error(f"Erro no chat MCP: {e}")
        
        # Fallback para resposta padrão
        resposta_erro = "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes."
        
        # Salvar erro no histórico
        try:
            chat_entry = ChatHistory(
                user_id=current_user.id,
                mensagem_usuario=mensagem,
                resposta_ia=resposta_erro,
                fonte_dados="erro",
                timestamp=datetime.utcnow()
            )
            db.add(chat_entry)
            db.commit()
        except:
            pass  # Se não conseguir salvar, pelo menos retorna a resposta
        
        return {
            "resposta": resposta_erro,
            "fonte": "erro",
            "timestamp": datetime.utcnow().isoformat(),
            "badge": "⚠️ Erro",
            "color": "red"
        }

@router.post("/analisar-extrato")
async def analisar_extrato_bancario(
    extrato: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Análise automática de extrato bancário com IA"""
    try:
        # Importar OpenAI aqui para não afetar outras funções
        import openai
        
        # Configurar chave OpenAI
        openai_key = "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"
        client = openai.OpenAI(api_key=openai_key)
        
        # Prompt específico para análise de extrato
        prompt = f"""
Analise o seguinte extrato bancário e extraia as transações em formato JSON.
Para cada linha, identifique: data, descrição, valor, categoria e tipo.

Regras importantes:
- Data no formato YYYY-MM-DD
- Descrição: limpe e melhore o texto (remova códigos desnecessários)
- Valor: sempre número positivo (sem R$ ou símbolos)
- Categoria: sugira uma categoria apropriada (Transporte, Alimentação, Mercado, Supermercado, Combustível, Farmácia, Restaurante, Shopping, Outros, etc.)
- Tipo: sempre "SAIDA" para extratos de gastos

Dados do extrato:
{extrato}

Responda APENAS com um array JSON válido, sem texto adicional:
[{{"data": "2025-06-04", "descricao": "Uber Trip", "valor": 9.92, "categoria": "Transporte", "tipo": "SAIDA"}}]
"""

        # Chamar OpenAI
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Você é um especialista em análise de extratos bancários. Retorne sempre JSON válido."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=2000
        )
        
        resposta = response.choices[0].message.content
        
        # Log para debug
        logger.info(f"💳 Análise Extrato - User {current_user.id}: {len(extrato)} chars → {len(resposta)} chars")
        
        return {"resposta": resposta}
        
    except Exception as e:
        logger.error(f"Erro na análise de extrato: {e}")
        return {
            "resposta": "[]",
            "erro": "Erro ao processar extrato bancário. Tente novamente."
        }

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