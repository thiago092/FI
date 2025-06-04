from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from ...database import get_db
from ...schemas.chat import ChatMessage, ChatResponse, ChatStats, SessaoResponse, SessaoCreate
from ...services.chat_ai_service import ChatAIService
from ...services.vision_service import VisionService
# from ...models.sessao_chat import SessaoChat  # Comentado - arquivo não existe
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Inicializar serviços
chat_service = ChatAIService()
vision_service = VisionService()

@router.post("/processar-imagem")
async def processar_imagem(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Processa uma imagem (recibo, cupom fiscal, nota, boleto) e extrai informações da transação
    """
    try:
        # Validar tipo de arquivo
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Arquivo deve ser uma imagem")
        
        # Validar tamanho (máximo 10MB)
        file_size = 0
        content = await file.read()
        file_size = len(content)
        
        if file_size > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(status_code=400, detail="Arquivo muito grande. Máximo 10MB")
        
        logger.info(f"🖼️ Processando imagem: {file.filename}, tamanho: {file_size} bytes")
        
        # Extrair informações da imagem usando Vision API
        result = await vision_service.extract_transaction_from_image(
            image_bytes=content,
            mime_type=file.content_type
        )
        
        if not result.get("success"):
            logger.error(f"❌ Erro ao extrair dados da imagem: {result.get('error')}")
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": result.get("error", "Erro desconhecido"),
                    "message": "Não foi possível extrair informações da imagem. Tente com uma imagem mais clara."
                }
            )
        
        extracted_data = result["data"]
        
        logger.info(f"✅ Dados extraídos da imagem: {extracted_data}")
        
        # Verificar se conseguiu extrair valor válido
        if extracted_data.get("valor", 0) <= 0:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Valor não identificado",
                    "message": "Não foi possível identificar o valor da transação na imagem.",
                    "extracted_data": extracted_data
                }
            )
        
        # Obter ou criar sessão ativa
        sessao_ativa = chat_service.obter_sessao_ativa(db)
        if not sessao_ativa:
            sessao_ativa = chat_service.criar_nova_sessao(db)
        
        # Criar mensagem simulando que o usuário disse sobre a transação
        descricao = extracted_data.get("descricao", "transação")
        valor = extracted_data.get("valor", 0)
        estabelecimento = extracted_data.get("estabelecimento", "")
        
        # Montar mensagem baseada nos dados extraídos
        if estabelecimento:
            mensagem_usuario = f"Gastei R$ {valor:.2f} em {descricao} no {estabelecimento}"
        else:
            mensagem_usuario = f"Gastei R$ {valor:.2f} em {descricao}"
        
        # Processar como se fosse uma mensagem de chat normal
        logger.info(f"📝 Processando como mensagem: {mensagem_usuario}")
        
        chat_response = await chat_service.processar_mensagem(
            mensagem=mensagem_usuario,
            sessao_id=sessao_ativa.id,
            via_voz=False,
            db=db
        )
        
        # Adicionar informações extras sobre a extração da imagem
        response_data = {
            "success": True,
            "extracted_data": extracted_data,
            "message_processed": mensagem_usuario,
            "chat_response": chat_response,
            "sessao_id": sessao_ativa.id,
            "confidence": extracted_data.get("confianca", "media"),
            "observacoes": extracted_data.get("observacoes", "")
        }
        
        logger.info(f"✅ Imagem processada com sucesso para sessão {sessao_ativa.id}")
        
        return JSONResponse(
            status_code=200,
            content=response_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro inesperado ao processar imagem: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro interno do servidor: {str(e)}"
        ) 