from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, extract
from typing import List
from datetime import datetime, date
from ..database import get_db
from ..models.financial import Cartao, Transacao, Conta
from ..schemas.financial import CartaoCreate, CartaoUpdate, CartaoResponse, CartaoComFatura, FaturaInfo
from ..core.security import get_current_tenant_user
from ..models.user import User
from ..models.financial import TipoTransacao

router = APIRouter()

def calcular_fatura_cartao(cartao: Cartao, db: Session) -> FaturaInfo:
    """Calcular informações da fatura do cartão"""
    hoje = date.today()
    
    # Buscar transações do cartão no mês atual
    transacoes_mes = db.query(Transacao).filter(
        and_(
            Transacao.cartao_id == cartao.id,
            extract('month', Transacao.data) == hoje.month,
            extract('year', Transacao.data) == hoje.year,
            Transacao.tipo == TipoTransacao.SAIDA  # Usar enum ao invés de string
        )
    ).all()
    
    # Calcular valor total da fatura do mês
    valor_total_mes = sum(transacao.valor for transacao in transacoes_mes)
    
    # Calcular dias para vencimento
    dias_para_vencimento = None
    data_vencimento = None
    
    if cartao.vencimento:
        # Calcular próxima data de vencimento
        vencimento_mes_atual = date(hoje.year, hoje.month, min(cartao.vencimento, 28))  # Máximo dia 28 para evitar problemas
        
        if hoje <= vencimento_mes_atual:
            data_vencimento = vencimento_mes_atual
        else:
            # Próximo mês
            if hoje.month == 12:
                data_vencimento = date(hoje.year + 1, 1, min(cartao.vencimento, 28))
            else:
                data_vencimento = date(hoje.year, hoje.month + 1, min(cartao.vencimento, 28))
        
        dias_para_vencimento = (data_vencimento - hoje).days
    
    # Calcular percentual do limite usado
    percentual_limite_usado = (valor_total_mes / cartao.limite * 100) if cartao.limite > 0 else 0
    
    return FaturaInfo(
        valor_atual=valor_total_mes,
        valor_total_mes=valor_total_mes,
        dias_para_vencimento=dias_para_vencimento,
        data_vencimento=datetime.combine(data_vencimento, datetime.min.time()) if data_vencimento else None,
        percentual_limite_usado=round(percentual_limite_usado, 2)
    )

@router.post("/", response_model=CartaoResponse)
def create_cartao(
    cartao_data: CartaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Criar novo cartão para o tenant do usuário"""
    # Verificar se já existe cartão com mesmo nome no tenant
    existing = db.query(Cartao).filter(
        Cartao.tenant_id == current_user.tenant_id,
        Cartao.nome == cartao_data.nome
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cartão with this name already exists"
        )
    
    # Validar vencimento
    if cartao_data.vencimento and (cartao_data.vencimento < 1 or cartao_data.vencimento > 31):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vencimento must be between 1 and 31"
        )
    
    # Validar numero_final
    if cartao_data.numero_final and (len(cartao_data.numero_final) != 4 or not cartao_data.numero_final.isdigit()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Numero final must be exactly 4 digits"
        )
    
    # Validar conta vinculada se fornecida
    if cartao_data.conta_vinculada_id:
        conta = db.query(Conta).filter(
            Conta.id == cartao_data.conta_vinculada_id,
            Conta.tenant_id == current_user.tenant_id,
            Conta.ativo == True
        ).first()
        
        if not conta:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conta vinculada not found or inactive"
            )
    
    cartao = Cartao(
        **cartao_data.dict(),
        tenant_id=current_user.tenant_id
    )
    
    db.add(cartao)
    db.commit()
    db.refresh(cartao)
    
    # Incluir dados da conta vinculada na resposta
    cartao_response = CartaoResponse.from_orm(cartao)
    if cartao.conta_vinculada:
        cartao_response.conta_vinculada = {
            "id": cartao.conta_vinculada.id,
            "nome": cartao.conta_vinculada.nome,
            "banco": cartao.conta_vinculada.banco
        }
    
    return cartao_response

@router.get("/", response_model=List[CartaoResponse])
def list_cartoes(
    ativo_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar todos os cartões do tenant"""
    query = db.query(Cartao).filter(
        Cartao.tenant_id == current_user.tenant_id
    )
    
    if ativo_only:
        query = query.filter(Cartao.ativo == True)
    
    cartoes = query.all()
    
    result = []
    for cartao in cartoes:
        cartao_response = CartaoResponse.from_orm(cartao)
        if cartao.conta_vinculada:
            cartao_response.conta_vinculada = {
                "id": cartao.conta_vinculada.id,
                "nome": cartao.conta_vinculada.nome,
                "banco": cartao.conta_vinculada.banco
            }
        result.append(cartao_response)
    
    return result

@router.get("/com-fatura", response_model=List[CartaoComFatura])
def list_cartoes_com_fatura(
    ativo_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar todos os cartões do tenant com informações de fatura"""
    query = db.query(Cartao).filter(
        Cartao.tenant_id == current_user.tenant_id
    )
    
    if ativo_only:
        query = query.filter(Cartao.ativo == True)
    
    cartoes = query.all()
    
    result = []
    for cartao in cartoes:
        fatura_info = calcular_fatura_cartao(cartao, db)
        cartao_com_fatura = CartaoComFatura(
            **cartao.__dict__,
            fatura=fatura_info
        )
        result.append(cartao_com_fatura)
    
    return result

@router.get("/{cartao_id}", response_model=CartaoResponse)
def get_cartao(
    cartao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter cartão específico"""
    cartao = db.query(Cartao).filter(
        Cartao.id == cartao_id,
        Cartao.tenant_id == current_user.tenant_id
    ).first()
    
    if not cartao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cartão not found"
        )
    
    return CartaoResponse.from_orm(cartao)

@router.put("/{cartao_id}", response_model=CartaoResponse)
def update_cartao(
    cartao_id: int,
    cartao_data: CartaoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Atualizar cartão"""
    cartao = db.query(Cartao).filter(
        Cartao.id == cartao_id,
        Cartao.tenant_id == current_user.tenant_id
    ).first()
    
    if not cartao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cartão not found"
        )
    
    # Verificar nome duplicado se está mudando
    if cartao_data.nome and cartao_data.nome != cartao.nome:
        existing = db.query(Cartao).filter(
            Cartao.tenant_id == current_user.tenant_id,
            Cartao.nome == cartao_data.nome,
            Cartao.id != cartao_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cartão with this name already exists"
            )
    
    # Validar vencimento se está mudando
    if cartao_data.vencimento and (cartao_data.vencimento < 1 or cartao_data.vencimento > 31):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vencimento must be between 1 and 31"
        )
    
    # Validar numero_final se está mudando
    if cartao_data.numero_final and (len(cartao_data.numero_final) != 4 or not cartao_data.numero_final.isdigit()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Numero final must be exactly 4 digits"
        )
    
    # Validar conta vinculada se está mudando
    if cartao_data.conta_vinculada_id is not None:
        if cartao_data.conta_vinculada_id:
            conta = db.query(Conta).filter(
                Conta.id == cartao_data.conta_vinculada_id,
                Conta.tenant_id == current_user.tenant_id,
                Conta.ativo == True
            ).first()
            
            if not conta:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Conta vinculada not found or inactive"
                )
    
    # Atualizar campos
    for field, value in cartao_data.dict(exclude_unset=True).items():
        setattr(cartao, field, value)
    
    db.commit()
    db.refresh(cartao)
    
    # Incluir dados da conta vinculada na resposta
    cartao_response = CartaoResponse.from_orm(cartao)
    if cartao.conta_vinculada:
        cartao_response.conta_vinculada = {
            "id": cartao.conta_vinculada.id,
            "nome": cartao.conta_vinculada.nome,
            "banco": cartao.conta_vinculada.banco
        }
    
    return cartao_response

@router.delete("/{cartao_id}")
def delete_cartao(
    cartao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Deletar cartão"""
    cartao = db.query(Cartao).filter(
        Cartao.id == cartao_id,
        Cartao.tenant_id == current_user.tenant_id
    ).first()
    
    if not cartao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cartão not found"
        )
    
    # Verificar se há transações usando este cartão
    # TODO: Implementar verificação quando criarmos transações
    
    db.delete(cartao)
    db.commit()
    
    return {"message": "Cartão deleted successfully"} 