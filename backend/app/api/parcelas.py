from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, extract, func
from typing import List
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta

from ..database import get_db
from ..models.financial import CompraParcelada, ParcelaCartao, Transacao, Cartao, Categoria, TipoTransacao
from ..schemas.financial import (
    CompraParceladaCreate, CompraParceladaResponse, CompraParceladaCompleta,
    CompraParceladaUpdate, ParcelaCartaoResponse, CartaoComParcelamentos,
    TransacaoCreate, ResumoParcelamentosCartao
)
from ..core.security import get_current_tenant_user
from ..models.user import User

router = APIRouter()

def calcular_resumo_parcelamentos(cartao_id: int, db: Session, tenant_id: int) -> ResumoParcelamentosCartao:
    """Calcula resumo de parcelamentos para um cartão"""
    
    # Obter informações do cartão
    cartao = db.query(Cartao).filter(
        Cartao.id == cartao_id,
        Cartao.tenant_id == tenant_id
    ).first()
    
    if not cartao:
        raise HTTPException(status_code=404, detail="Cartão não encontrado")
    
    # Buscar compras parceladas ativas
    compras_ativas = db.query(CompraParcelada).filter(
        CompraParcelada.cartao_id == cartao_id,
        CompraParcelada.ativa == True,
        CompraParcelada.tenant_id == tenant_id
    ).all()
    
    # Calcular valor total parcelado
    valor_total_parcelado = sum(compra.valor_total for compra in compras_ativas)
    
    # Calcular parcelas dos próximos 6 meses
    hoje = date.today()
    parcelas_proximos_meses = {}
    
    for i in range(6):  # Próximos 6 meses
        mes_alvo = hoje + relativedelta(months=i)
        mes_str = mes_alvo.strftime("%Y-%m")
        
        # Buscar parcelas deste mês
        valor_mes = db.query(func.sum(ParcelaCartao.valor)).filter(
            ParcelaCartao.tenant_id == tenant_id,
            extract('year', ParcelaCartao.data_vencimento) == mes_alvo.year,
            extract('month', ParcelaCartao.data_vencimento) == mes_alvo.month,
            ParcelaCartao.paga == False,
            ParcelaCartao.compra_parcelada_id.in_([c.id for c in compras_ativas])
        ).scalar() or 0.0
        
        parcelas_proximos_meses[mes_str] = float(valor_mes)
    
    return ResumoParcelamentosCartao(
        cartao_id=cartao_id,
        cartao_nome=cartao.nome,
        total_compras_ativas=len(compras_ativas),
        valor_total_parcelado=valor_total_parcelado,
        parcelas_proximos_meses=parcelas_proximos_meses
    )

@router.post("/", response_model=CompraParceladaResponse)
def criar_compra_parcelada(
    compra_data: CompraParceladaCompleta,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Criar uma nova compra parcelada"""
    
    # Verificar se cartão existe e pertence ao tenant
    cartao = db.query(Cartao).filter(
        Cartao.id == compra_data.cartao_id,
        Cartao.tenant_id == current_user.tenant_id,
        Cartao.ativo == True
    ).first()
    
    if not cartao:
        raise HTTPException(status_code=404, detail="Cartão não encontrado")
    
    # Verificar se categoria existe
    categoria = db.query(Categoria).filter(
        Categoria.id == compra_data.categoria_id,
        Categoria.tenant_id == current_user.tenant_id
    ).first()
    
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    # Calcular valor da parcela
    valor_parcela = compra_data.valor_total / compra_data.total_parcelas
    
    try:
        # Criar a compra parcelada
        compra_parcelada = CompraParcelada(
            descricao=compra_data.descricao,
            valor_total=compra_data.valor_total,
            total_parcelas=compra_data.total_parcelas,
            valor_parcela=valor_parcela,
            cartao_id=compra_data.cartao_id,
            categoria_id=compra_data.categoria_id,
            data_primeira_parcela=compra_data.data_primeira_parcela.date() if isinstance(compra_data.data_primeira_parcela, datetime) else compra_data.data_primeira_parcela,
            tenant_id=current_user.tenant_id
        )
        
        db.add(compra_parcelada)
        db.flush()  # Para obter o ID
        
        # Criar todas as parcelas
        parcelas = []
        for i in range(compra_data.total_parcelas):
            data_vencimento = compra_parcelada.data_primeira_parcela + relativedelta(months=i)
            
            parcela = ParcelaCartao(
                compra_parcelada_id=compra_parcelada.id,
                numero_parcela=i + 1,
                valor=valor_parcela,
                data_vencimento=data_vencimento,
                tenant_id=current_user.tenant_id
            )
            parcelas.append(parcela)
            db.add(parcela)
        
        # Criar a primeira transação (parcela atual)
        primeira_parcela = parcelas[0]
        transacao = Transacao(
            descricao=f"{compra_data.descricao} (1/{compra_data.total_parcelas})",
            valor=valor_parcela,
            tipo=TipoTransacao.SAIDA,
            data=datetime.now(),
            cartao_id=compra_data.cartao_id,
            categoria_id=compra_data.categoria_id,
            compra_parcelada_id=compra_parcelada.id,
            is_parcelada=True,
            numero_parcela=1,
            total_parcelas=compra_data.total_parcelas,
            tenant_id=current_user.tenant_id
        )
        
        db.add(transacao)
        db.flush()
        
        # Atualizar primeira parcela como processada
        primeira_parcela.processada = True
        primeira_parcela.transacao_id = transacao.id
        
        db.commit()
        db.refresh(compra_parcelada)
        
        return compra_parcelada
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar compra parcelada: {str(e)}")

@router.get("/", response_model=List[CompraParceladaResponse])
def listar_compras_parceladas(
    ativas_apenas: bool = True,
    cartao_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar compras parceladas do tenant"""
    
    query = db.query(CompraParcelada).filter(
        CompraParcelada.tenant_id == current_user.tenant_id
    )
    
    if ativas_apenas:
        query = query.filter(CompraParcelada.ativa == True)
    
    if cartao_id:
        query = query.filter(CompraParcelada.cartao_id == cartao_id)
    
    compras = query.order_by(CompraParcelada.created_at.desc()).all()
    
    # Calcular campos adicionais para cada compra
    for compra in compras:
        parcelas_pagas = sum(1 for p in compra.parcelas if p.paga)
        compra.parcelas_pagas = parcelas_pagas
        compra.parcelas_pendentes = compra.total_parcelas - parcelas_pagas
        compra.valor_pago = parcelas_pagas * compra.valor_parcela
        compra.valor_pendente = compra.valor_total - compra.valor_pago
        
        # Próxima parcela não paga
        proxima = next((p for p in sorted(compra.parcelas, key=lambda x: x.numero_parcela) if not p.paga), None)
        compra.proxima_parcela = proxima
    
    return compras

@router.get("/{compra_id}", response_model=CompraParceladaResponse)
def obter_compra_parcelada(
    compra_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter detalhes de uma compra parcelada"""
    
    compra = db.query(CompraParcelada).filter(
        CompraParcelada.id == compra_id,
        CompraParcelada.tenant_id == current_user.tenant_id
    ).first()
    
    if not compra:
        raise HTTPException(status_code=404, detail="Compra parcelada não encontrada")
    
    # Calcular campos adicionais
    parcelas_pagas = sum(1 for p in compra.parcelas if p.paga)
    compra.parcelas_pagas = parcelas_pagas
    compra.parcelas_pendentes = compra.total_parcelas - parcelas_pagas
    compra.valor_pago = parcelas_pagas * compra.valor_parcela
    compra.valor_pendente = compra.valor_total - compra.valor_pago
    
    # Próxima parcela não paga
    proxima = next((p for p in sorted(compra.parcelas, key=lambda x: x.numero_parcela) if not p.paga), None)
    compra.proxima_parcela = proxima
    
    return compra

@router.put("/{compra_id}", response_model=CompraParceladaResponse)
def atualizar_compra_parcelada(
    compra_id: int,
    compra_data: CompraParceladaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Atualizar uma compra parcelada"""
    
    compra = db.query(CompraParcelada).filter(
        CompraParcelada.id == compra_id,
        CompraParcelada.tenant_id == current_user.tenant_id
    ).first()
    
    if not compra:
        raise HTTPException(status_code=404, detail="Compra parcelada não encontrada")
    
    # Atualizar campos permitidos
    for field, value in compra_data.dict(exclude_unset=True).items():
        setattr(compra, field, value)
    
    db.commit()
    db.refresh(compra)
    
    return compra

@router.post("/{compra_id}/processar-parcela/{parcela_numero}")
def processar_parcela_manual(
    compra_id: int,
    parcela_numero: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Processar manualmente uma parcela específica (criar transação)"""
    
    compra = db.query(CompraParcelada).filter(
        CompraParcelada.id == compra_id,
        CompraParcelada.tenant_id == current_user.tenant_id
    ).first()
    
    if not compra:
        raise HTTPException(status_code=404, detail="Compra parcelada não encontrada")
    
    # Buscar a parcela específica
    parcela = db.query(ParcelaCartao).filter(
        ParcelaCartao.compra_parcelada_id == compra_id,
        ParcelaCartao.numero_parcela == parcela_numero,
        ParcelaCartao.tenant_id == current_user.tenant_id
    ).first()
    
    if not parcela:
        raise HTTPException(status_code=404, detail="Parcela não encontrada")
    
    if parcela.processada:
        raise HTTPException(status_code=400, detail="Parcela já foi processada")
    
    try:
        # Criar transação para esta parcela
        transacao = Transacao(
            descricao=f"{compra.descricao} ({parcela_numero}/{compra.total_parcelas})",
            valor=parcela.valor,
            tipo=TipoTransacao.SAIDA,
            data=datetime.now(),
            cartao_id=compra.cartao_id,
            categoria_id=compra.transacoes[0].categoria_id if compra.transacoes else 1,  # Usar categoria da primeira transação
            compra_parcelada_id=compra.id,
            parcela_cartao_id=parcela.id,
            is_parcelada=True,
            numero_parcela=parcela_numero,
            total_parcelas=compra.total_parcelas,
            tenant_id=current_user.tenant_id
        )
        
        db.add(transacao)
        db.flush()
        
        # Atualizar parcela
        parcela.processada = True
        parcela.paga = True
        parcela.transacao_id = transacao.id
        
        db.commit()
        
        return {"message": f"Parcela {parcela_numero} processada com sucesso", "transacao_id": transacao.id}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao processar parcela: {str(e)}")

@router.get("/cartao/{cartao_id}/resumo", response_model=ResumoParcelamentosCartao)
def obter_resumo_parcelamentos_cartao(
    cartao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter resumo de parcelamentos de um cartão específico"""
    return calcular_resumo_parcelamentos(cartao_id, db, current_user.tenant_id) 