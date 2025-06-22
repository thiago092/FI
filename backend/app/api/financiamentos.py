from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, and_, func
from typing import List, Optional, Dict, Any
from datetime import date, datetime, timedelta
from pydantic import BaseModel

from ..database import get_db
from ..core.security import get_current_tenant_user
from ..models.user import User
from ..models.financiamento import (
    Financiamento, ParcelaFinanciamento, ConfirmacaoFinanciamento, 
    SimulacaoFinanciamento, TipoFinanciamento, SistemaAmortizacao, 
    StatusFinanciamento, StatusParcela
)
from ..services.financiamento_service import FinanciamentoService

router = APIRouter()

# Schemas de resposta
class FinanciamentoResponse(BaseModel):
    id: int
    descricao: str
    instituicao: Optional[str]
    numero_contrato: Optional[str]
    tipo_financiamento: str
    sistema_amortizacao: str
    valor_total: float
    valor_financiado: float
    valor_entrada: float
    taxa_juros_mensal: float
    taxa_juros_anual: Optional[float]
    numero_parcelas: int
    parcelas_pagas: int
    valor_parcela: float
    valor_parcela_atual: Optional[float]
    saldo_devedor: float
    data_contratacao: date
    data_primeira_parcela: date
    dia_vencimento: Optional[int]
    status: str
    porcentagem_paga: float
    auto_debito: bool
    observacoes: Optional[str]
    
    class Config:
        from_attributes = True

class ParcelaResponse(BaseModel):
    id: int
    numero_parcela: int
    data_vencimento: date
    valor_parcela: float
    valor_parcela_simulado: Optional[float]
    valor_juros: Optional[float]
    valor_amortizacao: Optional[float]
    saldo_devedor: float
    saldo_devedor_pos: Optional[float]
    status: str
    data_pagamento: Optional[date]
    valor_pago: Optional[float]
    
    class Config:
        from_attributes = True

class FinanciamentoCreate(BaseModel):
    descricao: str
    instituicao: Optional[str] = None
    numero_contrato: Optional[str] = None
    tipo_financiamento: str = "pessoal"
    sistema_amortizacao: str = "PRICE"
    valor_total: float
    valor_entrada: float = 0
    valor_financiado: float
    taxa_juros_anual: float
    numero_parcelas: int
    data_contratacao: date
    data_primeira_parcela: date
    dia_vencimento: Optional[int] = None
    categoria_id: int
    conta_id: Optional[int] = None
    conta_debito_id: Optional[int] = None
    auto_debito: bool = False
    taxa_seguro_mensal: float = 0
    taxa_administrativa: float = 0
    observacoes: Optional[str] = None

class SimulacaoRequest(BaseModel):
    valor_financiado: float
    prazo_meses: int
    taxa_juros_anual: float
    sistema_amortizacao: str = "PRICE"
    data_inicio: date
    taxa_seguro_mensal: float = 0
    taxa_administrativa: float = 0

class DashboardResponse(BaseModel):
    total_financiado: float
    total_ja_pago: float
    saldo_devedor: float
    financiamentos_ativos: int
    financiamentos_quitados: int
    valor_mes_atual: float
    proximos_vencimentos: List[Dict[str, Any]]
    media_juros_carteira: float

# Endpoints

@router.get("/dashboard/resumo", response_model=DashboardResponse)
def obter_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter dashboard dos financiamentos"""
    
    try:
        dashboard = FinanciamentoService.obter_dashboard_financiamentos(
            db=db,
            tenant_id=current_user.tenant_id
        )
        
        return dashboard
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao gerar dashboard: {str(e)}"
        )

@router.get("/proximos-vencimentos", response_model=List[Dict[str, Any]])
def proximos_vencimentos(
    dias: int = Query(30, ge=1, le=365, description="Próximos X dias"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter próximos vencimentos de parcelas"""
    
    hoje = date.today()
    data_limite = hoje + timedelta(days=dias)
    
    parcelas = db.query(ParcelaFinanciamento).join(Financiamento).filter(
        Financiamento.tenant_id == current_user.tenant_id,
        ParcelaFinanciamento.status.in_(['PENDENTE', 'PARCIAL']),
        ParcelaFinanciamento.data_vencimento.between(hoje, data_limite)
    ).order_by(ParcelaFinanciamento.data_vencimento).all()
    
    resultado = []
    for parcela in parcelas:
        dias_para_vencimento = (parcela.data_vencimento - hoje).days
        
        resultado.append({
            'financiamento_id': parcela.financiamento_id,
            'financiamento_nome': parcela.financiamento.descricao,
            'instituicao': parcela.financiamento.instituicao,
            'numero_parcela': parcela.numero_parcela,
            'data_vencimento': parcela.data_vencimento.isoformat(),
            'valor_parcela': float(parcela.valor_parcela),
            'dias_para_vencimento': dias_para_vencimento,
            'status': parcela.status
        })
    
    return resultado

@router.get("/", response_model=List[FinanciamentoResponse])
def listar_financiamentos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filtrar por status"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar financiamentos do tenant"""
    
    query = db.query(Financiamento).filter(
        Financiamento.tenant_id == current_user.tenant_id
    ).options(
        joinedload(Financiamento.categoria),
        joinedload(Financiamento.conta),
        joinedload(Financiamento.conta_debito)
    )
    
    if status:
        query = query.filter(Financiamento.status == status)
    
    if tipo:
        query = query.filter(Financiamento.tipo_financiamento == tipo)
    
    financiamentos = query.order_by(desc(Financiamento.created_at)).offset(skip).limit(limit).all()
    
    return financiamentos

@router.get("/{financiamento_id}", response_model=FinanciamentoResponse)
def obter_financiamento(
    financiamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter financiamento específico"""
    
    financiamento = db.query(Financiamento).options(
        joinedload(Financiamento.categoria),
        joinedload(Financiamento.conta),
        joinedload(Financiamento.conta_debito)
    ).filter(
        Financiamento.id == financiamento_id,
        Financiamento.tenant_id == current_user.tenant_id
    ).first()
    
    if not financiamento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financiamento não encontrado"
        )
    
    return financiamento

@router.get("/{financiamento_id}/parcelas", response_model=List[ParcelaResponse])
def listar_parcelas(
    financiamento_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status_parcela: Optional[str] = Query(None, description="Filtrar por status da parcela"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar parcelas de um financiamento"""
    
    # Verificar se o financiamento existe e pertence ao tenant
    financiamento = db.query(Financiamento).filter(
        Financiamento.id == financiamento_id,
        Financiamento.tenant_id == current_user.tenant_id
    ).first()
    
    if not financiamento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financiamento não encontrado"
        )
    
    query = db.query(ParcelaFinanciamento).filter(
        ParcelaFinanciamento.financiamento_id == financiamento_id,
        ParcelaFinanciamento.tenant_id == current_user.tenant_id
    )
    
    if status_parcela:
        query = query.filter(ParcelaFinanciamento.status == status_parcela)
    
    parcelas = query.order_by(ParcelaFinanciamento.numero_parcela).offset(skip).limit(limit).all()
    
    return parcelas

@router.post("/", response_model=FinanciamentoResponse)
def criar_financiamento(
    financiamento_data: FinanciamentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Criar novo financiamento com parcelas"""
    
    try:
        # Calcular taxa mensal a partir da anual
        taxa_mensal = (1 + financiamento_data.taxa_juros_anual / 100) ** (1/12) - 1
        
        # Preparar dados para criação
        dados_financiamento = {
            "descricao": financiamento_data.descricao,
            "instituicao": financiamento_data.instituicao,
            "numero_contrato": financiamento_data.numero_contrato,
            "tipo_financiamento": financiamento_data.tipo_financiamento,
            "sistema_amortizacao": financiamento_data.sistema_amortizacao,
            "valor_total": financiamento_data.valor_total,
            "valor_entrada": financiamento_data.valor_entrada,
            "valor_financiado": financiamento_data.valor_financiado,
            "taxa_juros_mensal": taxa_mensal,
            "taxa_juros_anual": financiamento_data.taxa_juros_anual,
            "numero_parcelas": financiamento_data.numero_parcelas,
            "data_contratacao": financiamento_data.data_contratacao,
            "data_primeira_parcela": financiamento_data.data_primeira_parcela,
            "dia_vencimento": financiamento_data.dia_vencimento,
            "categoria_id": financiamento_data.categoria_id,
            "conta_id": financiamento_data.conta_id,
            "conta_debito_id": financiamento_data.conta_debito_id,
            "auto_debito": financiamento_data.auto_debito,
            "taxa_seguro_mensal": financiamento_data.taxa_seguro_mensal / 100,
            "taxa_administrativa": financiamento_data.taxa_administrativa,
            "observacoes": financiamento_data.observacoes,
            "status": "ativo"
        }
        
        # Usar service para criar com parcelas
        financiamento = FinanciamentoService.criar_financiamento_com_parcelas(
            db=db,
            dados_financiamento=dados_financiamento,
            tenant_id=current_user.tenant_id,
            user_name=current_user.nome or "Usuario"
        )
        
        return financiamento
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao criar financiamento: {str(e)}"
        )

@router.post("/simular", response_model=Dict[str, Any])
def simular_financiamento(
    simulacao_data: SimulacaoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Simular financiamento com diferentes sistemas de amortização"""
    
    try:
        sistema = SistemaAmortizacao(simulacao_data.sistema_amortizacao)
        
        simulacao = FinanciamentoService.simular_financiamento(
            valor_financiado=simulacao_data.valor_financiado,
            prazo_meses=simulacao_data.prazo_meses,
            taxa_juros_anual=simulacao_data.taxa_juros_anual,
            sistema_amortizacao=sistema,
            data_inicio=simulacao_data.data_inicio,
            taxa_seguro_mensal=simulacao_data.taxa_seguro_mensal,
            taxa_administrativa=simulacao_data.taxa_administrativa
        )
        
        return simulacao
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro na simulação: {str(e)}"
        )

@router.post("/{financiamento_id}/quitar")
def simular_quitacao(
    financiamento_id: int,
    data_quitacao: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Simular quitação antecipada"""
    
    try:
        simulacao = FinanciamentoService.simular_quitacao_antecipada(
            db=db,
            financiamento_id=financiamento_id,
            data_quitacao=data_quitacao,
            tenant_id=current_user.tenant_id
        )
        
        return simulacao
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro na simulação de quitação: {str(e)}"
        ) 