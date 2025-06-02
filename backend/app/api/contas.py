from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.financial import Conta
from ..schemas.financial import ContaCreate, ContaUpdate, ContaResponse, ContaComResumo, ResumoContaInfo
from ..core.security import get_current_tenant_user
from ..models.user import User
from ..services.conta_service import ContaService

router = APIRouter()

@router.post("/", response_model=ContaResponse)
def create_conta(
    conta_data: ContaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Criar nova conta para o tenant do usuário"""
    # Verificar se já existe conta com mesmo nome no tenant
    existing = db.query(Conta).filter(
        Conta.tenant_id == current_user.tenant_id,
        Conta.nome == conta_data.nome
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conta with this name already exists"
        )
    
    conta = Conta(
        **conta_data.model_dump(),
        tenant_id=current_user.tenant_id
    )
    
    db.add(conta)
    db.commit()
    db.refresh(conta)
    
    return conta

@router.get("/", response_model=List[ContaResponse])
def list_contas(
    ativo_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar todas as contas do tenant"""
    query = db.query(Conta).filter(
        Conta.tenant_id == current_user.tenant_id
    )
    
    if ativo_only:
        query = query.filter(Conta.ativo == True)
    
    contas = query.all()
    
    return contas

@router.get("/{conta_id}", response_model=ContaResponse)
def get_conta(
    conta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter conta específica"""
    conta = db.query(Conta).filter(
        Conta.id == conta_id,
        Conta.tenant_id == current_user.tenant_id
    ).first()
    
    if not conta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta not found"
        )
    
    return conta

@router.get("/{conta_id}/resumo", response_model=ContaComResumo)
def get_conta_resumo(
    conta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter conta com resumo financeiro calculado"""
    # Buscar a conta
    conta = db.query(Conta).filter(
        Conta.id == conta_id,
        Conta.tenant_id == current_user.tenant_id
    ).first()
    
    if not conta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta not found"
        )
    
    # Calcular resumo usando o service
    try:
        resumo = ContaService.calcular_resumo_conta(
            db=db, 
            conta_id=conta_id, 
            tenant_id=current_user.tenant_id
        )
        
        # Criar resposta combinando conta + resumo
        conta_dict = {
            "id": conta.id,
            "nome": conta.nome,
            "banco": conta.banco,
            "tipo": conta.tipo,
            "numero": conta.numero,
            "agencia": conta.agencia,
            "saldo_inicial": conta.saldo_inicial,
            "cor": conta.cor,
            "ativo": conta.ativo,
            "tenant_id": conta.tenant_id,
            "created_at": conta.created_at,
            "resumo": resumo
        }
        
        return ContaComResumo(**conta_dict)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

@router.put("/{conta_id}", response_model=ContaResponse)
def update_conta(
    conta_id: int,
    conta_data: ContaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Atualizar conta"""
    conta = db.query(Conta).filter(
        Conta.id == conta_id,
        Conta.tenant_id == current_user.tenant_id
    ).first()
    
    if not conta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta not found"
        )
    
    # Verificar nome duplicado se está mudando
    if conta_data.nome and conta_data.nome != conta.nome:
        existing = db.query(Conta).filter(
            Conta.tenant_id == current_user.tenant_id,
            Conta.nome == conta_data.nome,
            Conta.id != conta_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conta with this name already exists"
            )
    
    # Atualizar campos
    for field, value in conta_data.model_dump(exclude_unset=True).items():
        setattr(conta, field, value)
    
    db.commit()
    db.refresh(conta)
    
    return conta

@router.delete("/{conta_id}")
def delete_conta(
    conta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Deletar conta"""
    conta = db.query(Conta).filter(
        Conta.id == conta_id,
        Conta.tenant_id == current_user.tenant_id
    ).first()
    
    if not conta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta not found"
        )
    
    # Verificar se há transações usando esta conta
    # TODO: Implementar verificação quando criarmos transações
    
    db.delete(conta)
    db.commit()
    
    return {"message": "Conta deleted successfully"} 