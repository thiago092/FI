from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional
from datetime import date, datetime
from ..database import get_db
from ..models.financial import Fatura, Cartao, StatusFatura, Conta, Categoria
from ..core.security import get_current_tenant_user
from ..models.user import User
from ..services.fatura_service import FaturaService
from pydantic import BaseModel

router = APIRouter()

class FaturaResponse(BaseModel):
    id: int
    cartao_id: int
    mes_referencia: int
    ano_referencia: int
    data_vencimento: date
    valor_total: float
    status: str
    cartao: Optional[dict] = None
    transacao_pagamento_id: Optional[int] = None
    
    class Config:
        from_attributes = True

class PagamentoFaturaRequest(BaseModel):
    conta_id: Optional[int] = None  # Opcional - usa conta vinculada se não especificada
    categoria_id: Optional[int] = None

@router.get("/", response_model=List[FaturaResponse])
def list_faturas(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, description="aberta, fechada, paga"),
    cartao_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar faturas do tenant"""
    
    query = db.query(Fatura).filter(
        Fatura.tenant_id == current_user.tenant_id
    )
    
    # Aplicar filtros
    if status_filter:
        try:
            status_enum = StatusFatura(status_filter)
            query = query.filter(Fatura.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status inválido. Use: aberta, fechada ou paga"
            )
    
    if cartao_id:
        query = query.filter(Fatura.cartao_id == cartao_id)
    
    # Ordenar por data de vencimento mais recente
    query = query.order_by(desc(Fatura.data_vencimento))
    
    # Aplicar paginação
    faturas = query.offset(skip).limit(limit).all()
    
    return faturas

@router.get("/vencendo", response_model=List[FaturaResponse])
def get_faturas_vencendo(
    dias: int = Query(7, ge=0, le=30, description="Dias de antecedência"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter faturas que vencem nos próximos X dias"""
    
    faturas = FaturaService.obter_faturas_abertas_vencendo(
        db, current_user.tenant_id, dias
    )
    
    return faturas

@router.get("/resumo")
def get_resumo_faturas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter resumo das faturas"""
    
    # Faturas abertas
    faturas_abertas = db.query(Fatura).filter(
        Fatura.tenant_id == current_user.tenant_id,
        Fatura.status == StatusFatura.ABERTA
    ).count()
    
    # Valor total em aberto
    valor_aberto = db.query(func.sum(Fatura.valor_total)).filter(
        Fatura.tenant_id == current_user.tenant_id,
        Fatura.status == StatusFatura.ABERTA
    ).scalar() or 0.0
    
    # Faturas vencendo nos próximos 7 dias
    faturas_vencendo = len(FaturaService.obter_faturas_abertas_vencendo(
        db, current_user.tenant_id, 7
    ))
    
    # Próxima fatura a vencer
    proxima_fatura = db.query(Fatura).filter(
        Fatura.tenant_id == current_user.tenant_id,
        Fatura.status == StatusFatura.ABERTA,
        Fatura.data_vencimento >= date.today()
    ).order_by(Fatura.data_vencimento).first()
    
    return {
        "faturas_abertas": faturas_abertas,
        "valor_total_aberto": valor_aberto,
        "faturas_vencendo_7_dias": faturas_vencendo,
        "proxima_fatura": {
            "id": proxima_fatura.id if proxima_fatura else None,
            "valor": proxima_fatura.valor_total if proxima_fatura else 0,
            "vencimento": proxima_fatura.data_vencimento if proxima_fatura else None,
            "cartao": proxima_fatura.cartao.nome if proxima_fatura else None
        } if proxima_fatura else None
    }

@router.post("/{fatura_id}/pagar")
def pagar_fatura(
    fatura_id: int,
    pagamento_data: PagamentoFaturaRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Gerar pagamento automático da fatura"""
    
    # Verificar se fatura existe e pertence ao tenant
    fatura = db.query(Fatura).filter(
        Fatura.id == fatura_id,
        Fatura.tenant_id == current_user.tenant_id
    ).first()
    
    if not fatura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fatura não encontrada"
        )
    
    if fatura.status != StatusFatura.ABERTA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fatura já está paga ou fechada"
        )
    
    # Validar conta se fornecida
    if pagamento_data.conta_id:
        conta = db.query(Conta).filter(
            Conta.id == pagamento_data.conta_id,
            Conta.tenant_id == current_user.tenant_id
        ).first()
        
        if not conta:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conta não encontrada"
            )
    
    # Validar categoria se fornecida
    if pagamento_data.categoria_id:
        categoria = db.query(Categoria).filter(
            Categoria.id == pagamento_data.categoria_id,
            Categoria.tenant_id == current_user.tenant_id
        ).first()
        
        if not categoria:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Categoria não encontrada"
            )
    
    try:
        transacao_pagamento = FaturaService.gerar_pagamento_fatura_automatico(
            db, fatura_id, pagamento_data.conta_id, pagamento_data.categoria_id
        )
        
        if not transacao_pagamento:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não foi possível gerar o pagamento. Verifique se há uma conta vinculada ao cartão ou especifique uma conta."
            )
        
        return {
            "message": "Pagamento gerado com sucesso",
            "transacao_id": transacao_pagamento.id,
            "valor": transacao_pagamento.valor,
            "conta_debitada": transacao_pagamento.conta.nome if transacao_pagamento.conta else None
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao processar pagamento: {str(e)}"
        )

@router.post("/processar-pagamentos-automaticos")
def processar_pagamentos_automaticos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Processar pagamentos automáticos para faturas que vencem hoje"""
    
    try:
        pagamentos = FaturaService.processar_pagamentos_automaticos(
            db, current_user.tenant_id
        )
        
        return {
            "message": f"{len(pagamentos)} pagamentos processados",
            "pagamentos": [
                {
                    "transacao_id": p.id,
                    "valor": p.valor,
                    "descricao": p.descricao
                } for p in pagamentos
            ]
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao processar pagamentos automáticos: {str(e)}"
        )

@router.get("/{fatura_id}", response_model=FaturaResponse)
def get_fatura(
    fatura_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter detalhes de uma fatura específica"""
    
    fatura = db.query(Fatura).filter(
        Fatura.id == fatura_id,
        Fatura.tenant_id == current_user.tenant_id
    ).first()
    
    if not fatura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fatura não encontrada"
        )
    
    return fatura

@router.post("/resetar-antigas")
def resetar_faturas_antigas(
    dias_limite: int = Query(45, description="Dias limite para considerar fatura antiga"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """TEMPORÁRIO: Resetar faturas antigas que causam valores negativos"""
    
    try:
        faturas_resetadas = FaturaService.resetar_faturas_antigas(
            db, current_user.tenant_id, dias_limite
        )
        
        return {
            "message": f"{faturas_resetadas} faturas antigas foram resetadas",
            "faturas_resetadas": faturas_resetadas,
            "dias_limite": dias_limite
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao resetar faturas antigas: {str(e)}"
        )

@router.post("/atualizar-status-vencidas")
def atualizar_status_faturas_vencidas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Atualizar status de faturas vencidas"""
    
    try:
        faturas_atualizadas = FaturaService.atualizar_status_faturas_vencidas(
            db, current_user.tenant_id
        )
        
        return {
            "message": f"{faturas_atualizadas} faturas marcadas como vencidas",
            "faturas_atualizadas": faturas_atualizadas
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao atualizar status das faturas: {str(e)}"
        ) 