from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import Dict, Any
import logging

from ..services.agendador_service import AgendadorService

router = APIRouter(prefix="/agendador", tags=["agendador"])
logger = logging.getLogger(__name__)

@router.post("/webhook/executar")
async def webhook_executar_agendador(
    webhook_key: str = Query(..., description="Chave de segurança do webhook")
) -> Dict[str, Any]:
    """
    Endpoint público para execução via webhook (sem autenticação)
    Usado por serviços externos como cron-job.org
    """
    # Verificar chave de segurança
    WEBHOOK_KEY = "financas-ai-webhook-2024"
    
    if webhook_key != WEBHOOK_KEY:
        raise HTTPException(status_code=401, detail="Chave de webhook inválida")
    
    try:
        logger.info("🌐 Agendador executado via webhook externo")
        resultado = AgendadorService.processar_transacoes_do_dia()
        
        return {
            "success": True,
            "message": f"Webhook executado com sucesso: {resultado['criadas']} transações criadas",
            "data": {
                "webhook_execution": True,
                "data_execucao": datetime.now().isoformat(),
                "resultado": resultado
            }
        }
    except Exception as e:
        logger.error(f"❌ Erro na execução via webhook: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na execução: {str(e)}")

@router.get("/webhook/status")
async def webhook_status(
    webhook_key: str = Query(..., description="Chave de segurança do webhook")
) -> Dict[str, Any]:
    """
    Endpoint público para verificar status via webhook
    """
    WEBHOOK_KEY = "financas-ai-webhook-2024"
    
    if webhook_key != WEBHOOK_KEY:
        raise HTTPException(status_code=401, detail="Chave de webhook inválida")
    
    try:
        from datetime import date
        from ..database import get_db
        from ..models.transacao_recorrente import TransacaoRecorrente
        from sqlalchemy import or_
        
        # Contar transações recorrentes ativas
        db = next(get_db())
        try:
            hoje = date.today()
            transacoes_ativas = db.query(TransacaoRecorrente).filter(
                TransacaoRecorrente.ativa == True,
                TransacaoRecorrente.data_inicio <= hoje,
                or_(
                    TransacaoRecorrente.data_fim.is_(None),
                    TransacaoRecorrente.data_fim >= hoje
                )
            ).count()
            
            return {
                "success": True,
                "data": {
                    "webhook_status": True,
                    "data_atual": hoje.isoformat(),
                    "transacoes_recorrentes_ativas": transacoes_ativas,
                    "sistema_funcionando": True
                }
            }
        finally:
            db.close()
    except Exception as e:
        logger.error(f"❌ Erro no status via webhook: {e}")
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}") 