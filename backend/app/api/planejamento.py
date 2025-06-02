from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, desc
from typing import List, Optional
from datetime import datetime
import calendar

from ..database import get_db
from ..core.security import get_current_tenant_id
from ..models.financial import PlanejamentoMensal, PlanoCategoria, Categoria
from ..schemas.financial import (
    PlanejamentoMensalCreate, PlanejamentoMensalUpdate, PlanejamentoMensalResponse,
    PlanoCategoriaCreate, PlanoCategoriaUpdate, PlanoCategoriaResponse,
    ResumoPlanejamento, EstatisticasCategoria
)
from ..services.planejamento_service import PlanejamentoService

router = APIRouter()

@router.get("/", response_model=List[PlanejamentoMensalResponse])
async def listar_planejamentos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    ano: Optional[int] = Query(None, description="Filtrar por ano"),
    mes: Optional[int] = Query(None, ge=1, le=12, description="Filtrar por mês"),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Listar planejamentos do usuário com filtros opcionais"""
    
    query = db.query(PlanejamentoMensal).filter(
        PlanejamentoMensal.tenant_id == tenant_id
    ).options(
        joinedload(PlanejamentoMensal.planos_categoria).joinedload(PlanoCategoria.categoria)
    )
    
    if ano:
        query = query.filter(PlanejamentoMensal.ano == ano)
    if mes:
        query = query.filter(PlanejamentoMensal.mes == mes)
    
    planejamentos = query.order_by(
        desc(PlanejamentoMensal.ano), 
        desc(PlanejamentoMensal.mes)
    ).offset(skip).limit(limit).all()
    
    # Calcular valores dinâmicos para cada planejamento
    resultado = []
    for planejamento in planejamentos:
        # Recalcular valores reais
        PlanejamentoService.calcular_valores_gasto_real(db, planejamento)
        
        # Converter para response com cálculos
        planejamento_dict = {
            "id": planejamento.id,
            "nome": planejamento.nome,
            "descricao": planejamento.descricao,
            "mes": planejamento.mes,
            "ano": planejamento.ano,
            "renda_esperada": planejamento.renda_esperada,
            "total_planejado": planejamento.total_planejado,
            "total_gasto": planejamento.total_gasto,
            "saldo_planejado": planejamento.renda_esperada - planejamento.total_planejado,
            "percentual_gasto": (planejamento.total_gasto / planejamento.total_planejado * 100) if planejamento.total_planejado > 0 else 0,
            "status": planejamento.status,
            "tenant_id": planejamento.tenant_id,
            "created_at": planejamento.created_at,
            "updated_at": planejamento.updated_at,
            "planos_categoria": []
        }
        
        # Adicionar planos de categoria com cálculos
        for plano in planejamento.planos_categoria:
            percentual_gasto = (plano.valor_gasto / plano.valor_planejado * 100) if plano.valor_planejado > 0 else 0
            plano_dict = {
                "id": plano.id,
                "planejamento_id": plano.planejamento_id,
                "categoria_id": plano.categoria_id,
                "valor_planejado": plano.valor_planejado,
                "valor_gasto": plano.valor_gasto,
                "percentual_gasto": round(percentual_gasto, 2),
                "saldo_restante": round(plano.valor_planejado - plano.valor_gasto, 2),
                "prioridade": plano.prioridade,
                "observacoes": plano.observacoes,
                "categoria": {
                    "id": plano.categoria.id,
                    "nome": plano.categoria.nome,
                    "cor": plano.categoria.cor,
                    "icone": plano.categoria.icone,
                    "tenant_id": plano.categoria.tenant_id,
                    "created_at": plano.categoria.created_at
                },
                "tenant_id": plano.tenant_id,
                "created_at": plano.created_at,
                "updated_at": plano.updated_at
            }
            planejamento_dict["planos_categoria"].append(plano_dict)
        
        resultado.append(planejamento_dict)
    
    return resultado

@router.get("/atual", response_model=Optional[PlanejamentoMensalResponse])
async def get_planejamento_atual(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Buscar planejamento do mês atual"""
    
    planejamento = PlanejamentoService.get_planejamento_atual(db, tenant_id)
    if not planejamento:
        return None
    
    # Recalcular valores reais
    PlanejamentoService.calcular_valores_gasto_real(db, planejamento)
    
    return planejamento

@router.get("/resumo", response_model=ResumoPlanejamento)
async def get_resumo_planejamento(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Resumo geral dos planejamentos"""
    
    # Contar total de planejamentos
    total_planejamentos = db.query(PlanejamentoMensal).filter(
        PlanejamentoMensal.tenant_id == tenant_id
    ).count()
    
    # Buscar planejamento atual
    planejamento_atual = PlanejamentoService.get_planejamento_atual(db, tenant_id)
    
    resumo = {
        "total_planejamentos": total_planejamentos,
        "planejamento_atual": planejamento_atual,
        "total_gasto_mes": 0.0,
        "total_planejado_mes": 0.0,
        "percentual_cumprimento": 0.0,
        "categorias_excedidas": 0,
        "economias_categoria": []
    }
    
    if planejamento_atual:
        # Recalcular valores
        PlanejamentoService.calcular_valores_gasto_real(db, planejamento_atual)
        
        resumo["total_gasto_mes"] = planejamento_atual.total_gasto
        resumo["total_planejado_mes"] = planejamento_atual.total_planejado
        resumo["percentual_cumprimento"] = (
            planejamento_atual.total_gasto / planejamento_atual.total_planejado * 100
        ) if planejamento_atual.total_planejado > 0 else 0
        
        # Contar categorias excedidas e economias
        for plano in planejamento_atual.planos_categoria:
            percentual = (plano.valor_gasto / plano.valor_planejado * 100) if plano.valor_planejado > 0 else 0
            
            if percentual > 100:
                resumo["categorias_excedidas"] += 1
            elif percentual < 80:  # Categoria com economia
                resumo["economias_categoria"].append({
                    "categoria": plano.categoria.nome,
                    "economia": round(plano.valor_planejado - plano.valor_gasto, 2),
                    "percentual_usado": round(percentual, 2)
                })
    
    return resumo

@router.get("/{planejamento_id}", response_model=PlanejamentoMensalResponse)
async def get_planejamento(
    planejamento_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Buscar planejamento específico"""
    
    planejamento = db.query(PlanejamentoMensal).filter(
        and_(
            PlanejamentoMensal.id == planejamento_id,
            PlanejamentoMensal.tenant_id == tenant_id
        )
    ).options(
        joinedload(PlanejamentoMensal.planos_categoria).joinedload(PlanoCategoria.categoria)
    ).first()
    
    if not planejamento:
        raise HTTPException(status_code=404, detail="Planejamento não encontrado")
    
    # Recalcular valores reais
    PlanejamentoService.calcular_valores_gasto_real(db, planejamento)
    
    return planejamento

@router.get("/{planejamento_id}/estatisticas", response_model=List[EstatisticasCategoria])
async def get_estatisticas_categoria(
    planejamento_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Estatísticas detalhadas por categoria"""
    
    estatisticas = PlanejamentoService.get_estatisticas_categoria(db, planejamento_id, tenant_id)
    return estatisticas

@router.post("/", response_model=PlanejamentoMensalResponse)
async def criar_planejamento(
    planejamento: PlanejamentoMensalCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Criar novo planejamento mensal"""
    
    try:
        novo_planejamento = PlanejamentoService.criar_planejamento(db, planejamento, tenant_id)
        return novo_planejamento
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{planejamento_id}/duplicar")
async def duplicar_planejamento(
    planejamento_id: int,
    novo_mes: int = Query(..., ge=1, le=12),
    novo_ano: int = Query(..., ge=2020),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Duplicar planejamento existente para outro mês"""
    
    try:
        novo_planejamento = PlanejamentoService.duplicar_planejamento(
            db, planejamento_id, novo_mes, novo_ano, tenant_id
        )
        return novo_planejamento
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{planejamento_id}", response_model=PlanejamentoMensalResponse)
async def atualizar_planejamento(
    planejamento_id: int,
    planejamento: PlanejamentoMensalUpdate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Atualizar planejamento existente"""
    
    planejamento_atualizado = PlanejamentoService.atualizar_planejamento(
        db, planejamento_id, planejamento, tenant_id
    )
    
    if not planejamento_atualizado:
        raise HTTPException(status_code=404, detail="Planejamento não encontrado")
    
    return planejamento_atualizado

@router.delete("/{planejamento_id}")
async def deletar_planejamento(
    planejamento_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Deletar planejamento"""
    
    planejamento = db.query(PlanejamentoMensal).filter(
        and_(
            PlanejamentoMensal.id == planejamento_id,
            PlanejamentoMensal.tenant_id == tenant_id
        )
    ).first()
    
    if not planejamento:
        raise HTTPException(status_code=404, detail="Planejamento não encontrado")
    
    db.delete(planejamento)
    db.commit()
    
    return {"message": "Planejamento deletado com sucesso"}

# Endpoints para planos de categoria individuais
@router.put("/{planejamento_id}/categorias/{plano_id}", response_model=PlanoCategoriaResponse)
async def atualizar_plano_categoria(
    planejamento_id: int,
    plano_id: int,
    plano_data: PlanoCategoriaUpdate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Atualizar plano de categoria específico"""
    
    plano = db.query(PlanoCategoria).filter(
        and_(
            PlanoCategoria.id == plano_id,
            PlanoCategoria.planejamento_id == planejamento_id,
            PlanoCategoria.tenant_id == tenant_id
        )
    ).first()
    
    if not plano:
        raise HTTPException(status_code=404, detail="Plano de categoria não encontrado")
    
    # Atualizar campos
    for field, value in plano_data.dict(exclude_unset=True).items():
        setattr(plano, field, value)
    
    plano.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(plano)
    
    return plano

@router.post("/{planejamento_id}/categorias", response_model=PlanoCategoriaResponse)
async def adicionar_categoria_ao_plano(
    planejamento_id: int,
    plano_data: PlanoCategoriaCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Adicionar nova categoria ao planejamento"""
    
    # Verificar se planejamento existe
    planejamento = db.query(PlanejamentoMensal).filter(
        and_(
            PlanejamentoMensal.id == planejamento_id,
            PlanejamentoMensal.tenant_id == tenant_id
        )
    ).first()
    
    if not planejamento:
        raise HTTPException(status_code=404, detail="Planejamento não encontrado")
    
    # Verificar se categoria já existe no planejamento
    plano_existente = db.query(PlanoCategoria).filter(
        and_(
            PlanoCategoria.planejamento_id == planejamento_id,
            PlanoCategoria.categoria_id == plano_data.categoria_id,
            PlanoCategoria.tenant_id == tenant_id
        )
    ).first()
    
    if plano_existente:
        raise HTTPException(status_code=400, detail="Categoria já existe neste planejamento")
    
    # Criar novo plano de categoria
    novo_plano = PlanoCategoria(
        planejamento_id=planejamento_id,
        categoria_id=plano_data.categoria_id,
        valor_planejado=plano_data.valor_planejado,
        prioridade=plano_data.prioridade,
        observacoes=plano_data.observacoes,
        tenant_id=tenant_id
    )
    
    db.add(novo_plano)
    db.commit()
    db.refresh(novo_plano)
    
    # Recalcular totais do planejamento
    PlanejamentoService.calcular_valores_gasto_real(db, planejamento)
    
    return novo_plano 