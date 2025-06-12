from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime, date, timedelta
from ..database import get_db
from ..models.transacao_recorrente import TransacaoRecorrente
from ..models.financial import Categoria, Conta, Cartao
from ..schemas.transacao_recorrente import (
    TransacaoRecorrenteCreate,
    TransacaoRecorrenteUpdate,
    TransacaoRecorrenteResponse,
    TransacaoRecorrenteListResponse,
    FrequenciaEnum
)
from ..core.security import get_current_tenant_user
from ..models.user import User

router = APIRouter()

def calcular_proximo_vencimento(data_inicio: date, frequencia: str, dia_vencimento: int) -> date:
    """Calcula a próxima data de vencimento baseada na frequência e respeitando a data de início"""
    hoje = date.today()
    
    # Para frequências diárias, semanais e quinzenais, usar a data de início como base
    if frequencia == "DIARIA":
        # Calcular quantos dias se passaram desde o início
        if data_inicio <= hoje:
            dias_desde_inicio = (hoje - data_inicio).days
            return data_inicio + timedelta(days=dias_desde_inicio + 1)
        else:
            return data_inicio  # Ainda não começou
            
    elif frequencia == "SEMANAL":
        # Calcular próxima semana baseada na data de início
        if data_inicio <= hoje:
            semanas_desde_inicio = ((hoje - data_inicio).days // 7) + 1
            return data_inicio + timedelta(weeks=semanas_desde_inicio)
        else:
            return data_inicio
            
    elif frequencia == "QUINZENAL":
        # Calcular próxima quinzena baseada na data de início
        if data_inicio <= hoje:
            quinzenas_desde_inicio = ((hoje - data_inicio).days // 14) + 1
            return data_inicio + timedelta(weeks=quinzenas_desde_inicio * 2)
        else:
            return data_inicio
            
    # Para frequências mensais ou maiores, usar o dia de vencimento
    elif frequencia == "MENSAL":
        # Começar do mês da data de início ou posterior
        ano_base = max(data_inicio.year, hoje.year)
        mes_base = max(data_inicio.month, hoje.month) if ano_base == hoje.year else data_inicio.month
        
        # Se o dia de vencimento já passou no mês, ir para o próximo
        try:
            proxima_data = date(ano_base, mes_base, dia_vencimento)
            if proxima_data <= hoje:
                if mes_base == 12:
                    proxima_data = date(ano_base + 1, 1, min(dia_vencimento, 31))
                else:
                    proxima_data = date(ano_base, mes_base + 1, dia_vencimento)
        except ValueError:
            proxima_data = date(ano_base, mes_base, 28)
        
        return proxima_data
        
    elif frequencia == "BIMESTRAL":
        # Calcular baseado na data de início + múltiplos de 2 meses
        ano_atual = data_inicio.year
        mes_atual = data_inicio.month
        
        while date(ano_atual, mes_atual, min(dia_vencimento, 28)) <= hoje:
            mes_atual += 2
            if mes_atual > 12:
                mes_atual -= 12
                ano_atual += 1
        
        try:
            return date(ano_atual, mes_atual, dia_vencimento)
        except ValueError:
            return date(ano_atual, mes_atual, 28)
            
    elif frequencia == "TRIMESTRAL":
        # Calcular baseado na data de início + múltiplos de 3 meses
        ano_atual = data_inicio.year
        mes_atual = data_inicio.month
        
        while date(ano_atual, mes_atual, min(dia_vencimento, 28)) <= hoje:
            mes_atual += 3
            if mes_atual > 12:
                mes_atual -= 12
                ano_atual += 1
        
        try:
            return date(ano_atual, mes_atual, dia_vencimento)
        except ValueError:
            return date(ano_atual, mes_atual, 28)
            
    elif frequencia == "SEMESTRAL":
        # Calcular baseado na data de início + múltiplos de 6 meses
        ano_atual = data_inicio.year
        mes_atual = data_inicio.month
        
        while date(ano_atual, mes_atual, min(dia_vencimento, 28)) <= hoje:
            mes_atual += 6
            if mes_atual > 12:
                mes_atual -= 12
                ano_atual += 1
        
        try:
            return date(ano_atual, mes_atual, dia_vencimento)
        except ValueError:
            return date(ano_atual, mes_atual, 28)
            
    elif frequencia == "ANUAL":
        # Calcular baseado na data de início + múltiplos de 1 ano
        ano_atual = data_inicio.year
        
        while date(ano_atual, data_inicio.month, min(dia_vencimento, 28)) <= hoje:
            ano_atual += 1
        
        try:
            return date(ano_atual, data_inicio.month, dia_vencimento)
        except ValueError:
            return date(ano_atual, data_inicio.month, 28)
    
    return data_inicio  # Fallback para data de início

@router.post("/", response_model=TransacaoRecorrenteResponse)
def create_transacao_recorrente(
    transacao_data: TransacaoRecorrenteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Criar nova transação recorrente"""
    
    # Validar categoria
    categoria = db.query(Categoria).filter(
        Categoria.id == transacao_data.categoria_id,
        Categoria.tenant_id == current_user.tenant_id
    ).first()
    
    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Categoria não encontrada"
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
                detail="Conta não encontrada"
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
                detail="Cartão não encontrado"
            )
    
    # Criar transação recorrente
    transacao = TransacaoRecorrente(
        **transacao_data.model_dump(),
        tenant_id=current_user.tenant_id
    )
    
    db.add(transacao)
    db.commit()
    db.refresh(transacao)
    
    # Retornar resposta com dados serializados corretamente
    return {
        "id": int(transacao.id),
        "descricao": str(transacao.descricao),
        "valor": float(transacao.valor),
        "tipo": str(transacao.tipo),
        "categoria_id": int(transacao.categoria_id),
        "conta_id": int(transacao.conta_id) if transacao.conta_id is not None else None,
        "cartao_id": int(transacao.cartao_id) if transacao.cartao_id is not None else None,
        "frequencia": str(transacao.frequencia),
        "dia_vencimento": int(transacao.dia_vencimento),
        "data_inicio": transacao.data_inicio.isoformat() if transacao.data_inicio else None,
        "data_fim": transacao.data_fim.isoformat() if transacao.data_fim else None,
        "ativa": bool(transacao.ativa),
        "tenant_id": int(transacao.tenant_id),
        "created_at": transacao.created_at.isoformat() if transacao.created_at else None,
        "updated_at": transacao.updated_at.isoformat() if transacao.updated_at else None,
        # Dados relacionados
        "categoria_nome": transacao.categoria.nome if transacao.categoria else None,
        "categoria_icone": transacao.categoria.icone if transacao.categoria else None,
        "categoria_cor": transacao.categoria.cor if transacao.categoria else None,
        "conta_nome": transacao.conta.nome if transacao.conta else None,
        "cartao_nome": transacao.cartao.nome if transacao.cartao else None
    }

@router.get("/", response_model=List[TransacaoRecorrenteListResponse])
def list_transacoes_recorrentes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    ativa: Optional[bool] = None,
    tipo: Optional[str] = None,
    categoria_id: Optional[int] = None,
    frequencia: Optional[FrequenciaEnum] = None,
    busca: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar transações recorrentes com filtros"""
    
    query = db.query(TransacaoRecorrente).options(
        joinedload(TransacaoRecorrente.categoria),
        joinedload(TransacaoRecorrente.conta),
        joinedload(TransacaoRecorrente.cartao)
    ).filter(
        TransacaoRecorrente.tenant_id == current_user.tenant_id
    )
    
    # Aplicar filtros
    if ativa is not None:
        query = query.filter(TransacaoRecorrente.ativa == ativa)
    
    if tipo:
        query = query.filter(TransacaoRecorrente.tipo == tipo)
    
    if categoria_id:
        query = query.filter(TransacaoRecorrente.categoria_id == categoria_id)
    
    if frequencia:
        query = query.filter(TransacaoRecorrente.frequencia == frequencia)
    
    if busca:
        search_pattern = f"%{busca}%"
        query = query.filter(
            TransacaoRecorrente.descricao.ilike(search_pattern)
        )
    
    # Ordenar por data de criação mais recente
    query = query.order_by(desc(TransacaoRecorrente.created_at))
    
    # Aplicar paginação
    transacoes = query.offset(skip).limit(limit).all()
    
    # Montar resposta com dados relacionados
    resultado = []
    for transacao in transacoes:
        forma_pagamento = ""
        if transacao.conta:
            forma_pagamento = f"Conta: {transacao.conta.nome}"
        elif transacao.cartao:
            forma_pagamento = f"Cartão: {transacao.cartao.nome}"
        
        proximo_vencimento = calcular_proximo_vencimento(
            transacao.data_inicio,
            transacao.frequencia,
            transacao.dia_vencimento
        )
        
        resultado.append(TransacaoRecorrenteListResponse(
            id=transacao.id,
            descricao=transacao.descricao,
            valor=float(transacao.valor),
            tipo=transacao.tipo,
            frequencia=transacao.frequencia,
            dia_vencimento=transacao.dia_vencimento,
            ativa=transacao.ativa,
            categoria_nome=transacao.categoria.nome,
            categoria_icone=transacao.categoria.icone,
            categoria_cor=transacao.categoria.cor,
            forma_pagamento=forma_pagamento,
            proximo_vencimento=proximo_vencimento,
            icone_personalizado=transacao.icone_personalizado
        ))
    
    return resultado

@router.get("/{transacao_id}", response_model=TransacaoRecorrenteResponse)
def get_transacao_recorrente(
    transacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter transação recorrente por ID"""
    
    transacao = db.query(TransacaoRecorrente).options(
        joinedload(TransacaoRecorrente.categoria),
        joinedload(TransacaoRecorrente.conta),
        joinedload(TransacaoRecorrente.cartao)
    ).filter(
        TransacaoRecorrente.id == transacao_id,
        TransacaoRecorrente.tenant_id == current_user.tenant_id
    ).first()
    
    if not transacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação recorrente não encontrada"
        )
    
    return transacao

@router.put("/{transacao_id}")
def update_transacao_recorrente(
    transacao_id: int,
    transacao_data: TransacaoRecorrenteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Atualizar transação recorrente"""
    
    transacao = db.query(TransacaoRecorrente).filter(
        TransacaoRecorrente.id == transacao_id,
        TransacaoRecorrente.tenant_id == current_user.tenant_id
    ).first()
    
    if not transacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação recorrente não encontrada"
        )
    
    # Atualizar campos fornecidos
    update_data = transacao_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(transacao, field, value)
    
    transacao.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(transacao)
    
    # Retorno compatível com PostgreSQL types
    return {
        "id": int(transacao.id),
        "descricao": str(transacao.descricao),
        "valor": float(transacao.valor) if transacao.valor is not None else 0.0,
        "tipo": str(transacao.tipo),
        "categoria_id": int(transacao.categoria_id),
        "conta_id": int(transacao.conta_id) if transacao.conta_id is not None else None,
        "cartao_id": int(transacao.cartao_id) if transacao.cartao_id is not None else None,
        "frequencia": str(transacao.frequencia),
        "dia_vencimento": int(transacao.dia_vencimento),
        "data_inicio": transacao.data_inicio.isoformat() if transacao.data_inicio else None,
        "data_fim": transacao.data_fim.isoformat() if transacao.data_fim else None,
        "ativa": bool(transacao.ativa) if transacao.ativa is not None else True,
        "tenant_id": int(transacao.tenant_id),
        "created_at": transacao.created_at.isoformat() if transacao.created_at else None,
        "updated_at": transacao.updated_at.isoformat() if transacao.updated_at else None
    }

@router.delete("/{transacao_id}")
def delete_transacao_recorrente(
    transacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Deletar transação recorrente"""
    
    transacao = db.query(TransacaoRecorrente).filter(
        TransacaoRecorrente.id == transacao_id,
        TransacaoRecorrente.tenant_id == current_user.tenant_id
    ).first()
    
    if not transacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação recorrente não encontrada"
        )
    
    db.delete(transacao)
    db.commit()
    
    return {"message": "Transação recorrente deletada com sucesso"}

@router.post("/{transacao_id}/toggle")
def toggle_transacao_recorrente(
    transacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Ativar/desativar transação recorrente"""
    
    transacao = db.query(TransacaoRecorrente).filter(
        TransacaoRecorrente.id == transacao_id,
        TransacaoRecorrente.tenant_id == current_user.tenant_id
    ).first()
    
    if not transacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação recorrente não encontrada"
        )
    
    transacao.ativa = not transacao.ativa
    transacao.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(transacao)
    
    return {
        "message": f"Transação recorrente {'ativada' if transacao.ativa else 'desativada'} com sucesso",
        "ativa": transacao.ativa
    }

@router.get("/dashboard/resumo")
def get_resumo_transacoes_recorrentes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter resumo das transações recorrentes para dashboard"""
    
    query = db.query(TransacaoRecorrente).filter(
        TransacaoRecorrente.tenant_id == current_user.tenant_id
    )
    
    total = query.count()
    ativas = query.filter(TransacaoRecorrente.ativa == True).count()
    inativas = total - ativas
    
    # Calcular valor mensal estimado (apenas ativas)
    transacoes_ativas = query.filter(TransacaoRecorrente.ativa == True).all()
    
    valor_mensal_entradas = 0.0
    valor_mensal_saidas = 0.0
    
    for transacao in transacoes_ativas:
        valor = float(transacao.valor)
        
        # Converter para valor mensal baseado na frequência
        if transacao.frequencia == "DIARIA":
            valor_mensal = valor * 30
        elif transacao.frequencia == "SEMANAL":
            valor_mensal = valor * 4.33  # Média de semanas por mês
        elif transacao.frequencia == "QUINZENAL":
            valor_mensal = valor * 2
        elif transacao.frequencia == "MENSAL":
            valor_mensal = valor
        elif transacao.frequencia == "BIMESTRAL":
            valor_mensal = valor / 2
        elif transacao.frequencia == "TRIMESTRAL":
            valor_mensal = valor / 3
        elif transacao.frequencia == "SEMESTRAL":
            valor_mensal = valor / 6
        elif transacao.frequencia == "ANUAL":
            valor_mensal = valor / 12
        else:
            valor_mensal = valor
        
        if transacao.tipo == "ENTRADA":
            valor_mensal_entradas += valor_mensal
        else:
            valor_mensal_saidas += valor_mensal
    
    return {
        "total_transacoes": total,
        "ativas": ativas,
        "inativas": inativas,
        "valor_mensal_entradas": valor_mensal_entradas,
        "valor_mensal_saidas": valor_mensal_saidas,
        "saldo_mensal_estimado": valor_mensal_entradas - valor_mensal_saidas
    } 