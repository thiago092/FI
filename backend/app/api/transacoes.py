from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func, extract
from typing import List, Optional
from datetime import datetime, date
from ..database import get_db
from ..models.financial import Transacao, Categoria, Conta, Cartao, TipoTransacao
from ..schemas.financial import (
    TransacaoCreate, 
    TransacaoUpdate, 
    TransacaoResponse,
    TipoTransacaoEnum
)
from ..core.security import get_current_tenant_user
from ..models.user import User
from ..services.fatura_service import FaturaService

router = APIRouter()

@router.post("/", response_model=TransacaoResponse)
def create_transacao(
    transacao_data: TransacaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Criar nova transação"""
    
    # Validar se categoria existe e pertence ao tenant
    categoria = db.query(Categoria).filter(
        Categoria.id == transacao_data.categoria_id,
        Categoria.tenant_id == current_user.tenant_id
    ).first()
    
    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Categoria not found or not accessible"
        )
    
    # Validar conta se fornecida
    if transacao_data.conta_id:
        conta = db.query(Conta).filter(
            Conta.id == transacao_data.conta_id,
            Conta.tenant_id == current_user.tenant_id
        ).first()
        
        if not conta:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conta not found or not accessible"
            )
    
    # Validar cartão se fornecido
    if transacao_data.cartao_id:
        cartao = db.query(Cartao).filter(
            Cartao.id == transacao_data.cartao_id,
            Cartao.tenant_id == current_user.tenant_id
        ).first()
        
        if not cartao:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cartão not found or not accessible"
            )
    
    # Criar transação
    transacao = Transacao(
        **transacao_data.model_dump(),
        tenant_id=current_user.tenant_id
    )
    
    db.add(transacao)
    db.flush()  # Para obter o ID antes do commit
    
    # Se é uma transação no cartão (saída), vincular à fatura automaticamente
    if transacao.cartao_id and transacao.tipo == TipoTransacao.SAIDA:
        try:
            FaturaService.adicionar_transacao_fatura(db, transacao)
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao processar fatura: {str(e)}"
            )
    
    db.commit()
    db.refresh(transacao)
    
    return transacao

@router.get("/", response_model=List[TransacaoResponse])
def list_transacoes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tipo: Optional[TipoTransacaoEnum] = None,
    categoria_id: Optional[int] = None,
    conta_id: Optional[int] = None,
    cartao_id: Optional[int] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    busca: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar transações com filtros"""
    
    query = db.query(Transacao).filter(
        Transacao.tenant_id == current_user.tenant_id
    )
    
    # Aplicar filtros
    if tipo:
        query = query.filter(Transacao.tipo == tipo)
    
    if categoria_id:
        query = query.filter(Transacao.categoria_id == categoria_id)
    
    if conta_id:
        query = query.filter(Transacao.conta_id == conta_id)
    
    if cartao_id:
        query = query.filter(Transacao.cartao_id == cartao_id)
    
    if data_inicio:
        query = query.filter(Transacao.data >= data_inicio)
    
    if data_fim:
        # Incluir todo o dia final
        data_fim_completa = datetime.combine(data_fim, datetime.max.time())
        query = query.filter(Transacao.data <= data_fim_completa)
    
    if busca:
        search_pattern = f"%{busca}%"
        query = query.filter(
            or_(
                Transacao.descricao.ilike(search_pattern),
                Transacao.observacoes.ilike(search_pattern)
            )
        )
    
    # Ordenar por data mais recente
    query = query.order_by(desc(Transacao.data))
    
    # Aplicar paginação
    transacoes = query.offset(skip).limit(limit).all()
    
    return transacoes

@router.get("/resumo")
def get_resumo_transacoes(
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter resumo das transações por período"""
    
    query = db.query(Transacao).filter(
        Transacao.tenant_id == current_user.tenant_id
    )
    
    # Aplicar filtros de data
    if data_inicio:
        query = query.filter(Transacao.data >= data_inicio)
    
    if data_fim:
        data_fim_completa = datetime.combine(data_fim, datetime.max.time())
        query = query.filter(Transacao.data <= data_fim_completa)
    
    # Calcular totais
    entradas = query.filter(Transacao.tipo == TipoTransacao.ENTRADA).with_entities(
        func.sum(Transacao.valor)
    ).scalar() or 0.0
    
    saidas = query.filter(Transacao.tipo == TipoTransacao.SAIDA).with_entities(
        func.sum(Transacao.valor)
    ).scalar() or 0.0
    
    total_transacoes = query.count()
    
    saldo = entradas - saidas
    
    return {
        "total_entradas": entradas,
        "total_saidas": saidas,
        "saldo": saldo,
        "total_transacoes": total_transacoes,
        "data_inicio": data_inicio,
        "data_fim": data_fim
    }

@router.get("/por-categoria")
def get_transacoes_por_categoria(
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter totais por categoria"""
    
    query = db.query(
        Categoria.nome,
        Categoria.cor,
        Categoria.icone,
        func.sum(Transacao.valor).label('total'),
        func.count(Transacao.id).label('quantidade'),
        Transacao.tipo
    ).join(
        Transacao, Categoria.id == Transacao.categoria_id
    ).filter(
        Transacao.tenant_id == current_user.tenant_id
    )
    
    # Aplicar filtros de data
    if data_inicio:
        query = query.filter(Transacao.data >= data_inicio)
    
    if data_fim:
        data_fim_completa = datetime.combine(data_fim, datetime.max.time())
        query = query.filter(Transacao.data <= data_fim_completa)
    
    resultados = query.group_by(
        Categoria.nome, 
        Categoria.cor, 
        Categoria.icone, 
        Transacao.tipo
    ).all()
    
    # Organizar por tipo
    entradas = []
    saidas = []
    
    for resultado in resultados:
        item = {
            "categoria": resultado.nome,
            "cor": resultado.cor,
            "icone": resultado.icone,
            "total": resultado.total,
            "quantidade": resultado.quantidade
        }
        
        if resultado.tipo == TipoTransacao.ENTRADA:
            entradas.append(item)
        else:
            saidas.append(item)
    
    return {
        "entradas": entradas,
        "saidas": saidas
    }

@router.get("/{transacao_id}", response_model=TransacaoResponse)
def get_transacao(
    transacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter transação específica"""
    
    transacao = db.query(Transacao).filter(
        Transacao.id == transacao_id,
        Transacao.tenant_id == current_user.tenant_id
    ).first()
    
    if not transacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação not found"
        )
    
    return transacao

@router.put("/{transacao_id}", response_model=TransacaoResponse)
def update_transacao(
    transacao_id: int,
    transacao_data: TransacaoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Atualizar transação"""
    
    transacao = db.query(Transacao).filter(
        Transacao.id == transacao_id,
        Transacao.tenant_id == current_user.tenant_id
    ).first()
    
    if not transacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação not found"
        )
    
    # Validar categoria se fornecida
    if transacao_data.categoria_id:
        categoria = db.query(Categoria).filter(
            Categoria.id == transacao_data.categoria_id,
            Categoria.tenant_id == current_user.tenant_id
        ).first()
        
        if not categoria:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Categoria not found"
            )
    
    # Atualizar campos
    for field, value in transacao_data.model_dump(exclude_unset=True).items():
        setattr(transacao, field, value)
    
    db.commit()
    db.refresh(transacao)
    
    return transacao

@router.delete("/{transacao_id}")
def delete_transacao(
    transacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Deletar transação"""
    
    transacao = db.query(Transacao).filter(
        Transacao.id == transacao_id,
        Transacao.tenant_id == current_user.tenant_id
    ).first()
    
    if not transacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação not found"
        )
    
    db.delete(transacao)
    db.commit()
    
    return {"message": "Transação deleted successfully"} 