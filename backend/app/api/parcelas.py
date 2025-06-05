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
        CompraParcelada.status == "ativa",
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
            status="ativa",
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
        query = query.filter(CompraParcelada.status == "ativa")
    
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

@router.delete("/{parcela_id}")
def excluir_compra_parcelada(
    parcela_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Excluir uma compra parcelada"""
    try:
        # Buscar a compra parcelada
        compra = db.query(CompraParcelada).filter(
            CompraParcelada.id == parcela_id,
            CompraParcelada.tenant_id == current_user.tenant_id
        ).first()
        
        if not compra:
            raise HTTPException(status_code=404, detail="Compra parcelada não encontrada")
        
        # Verificar se há parcelas já processadas (pagas)
        parcelas_pagas = db.query(ParcelaCartao).filter(
            ParcelaCartao.compra_parcelada_id == parcela_id,
            ParcelaCartao.paga == True,
            ParcelaCartao.tenant_id == current_user.tenant_id
        ).count()
        
        if parcelas_pagas > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Não é possível excluir: {parcelas_pagas} parcela(s) já foram processadas"
            )
        
        # Excluir todas as parcelas relacionadas
        db.query(ParcelaCartao).filter(
            ParcelaCartao.compra_parcelada_id == parcela_id,
            ParcelaCartao.tenant_id == current_user.tenant_id
        ).delete()
        
        # Excluir a compra parcelada
        db.delete(compra)
        db.commit()
        
        return {"message": "Compra parcelada excluída com sucesso"}
        
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao excluir compra parcelada: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@router.post("/{parcela_id}/quitar")
def quitar_parcelamento_antecipado(
    parcela_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Quitar todas as parcelas restantes de uma compra parcelada"""
    try:
        # Buscar a compra parcelada
        compra = db.query(CompraParcelada).filter(
            CompraParcelada.id == parcela_id,
            CompraParcelada.tenant_id == current_user.tenant_id
        ).first()
        
        if not compra:
            raise HTTPException(status_code=404, detail="Compra parcelada não encontrada")
        
        if compra.status != "ativa":
            raise HTTPException(status_code=400, detail="Compra parcelada não está ativa")
        
        # Buscar cartão para obter conta vinculada
        cartao = db.query(Cartao).filter(Cartao.id == compra.cartao_id).first()
        if not cartao or not cartao.conta_vinculada_id:
            raise HTTPException(
                status_code=400, 
                detail="Cartão não possui conta vinculada para débito"
            )
        
        # Buscar parcelas pendentes
        parcelas_pendentes = db.query(ParcelaCartao).filter(
            ParcelaCartao.compra_parcelada_id == parcela_id,
            ParcelaCartao.paga == False,
            ParcelaCartao.tenant_id == current_user.tenant_id
        ).all()
        
        if not parcelas_pendentes:
            raise HTTPException(status_code=400, detail="Não há parcelas pendentes para quitar")
        
        # Calcular valor total a quitar
        valor_total_quitacao = sum(parcela.valor for parcela in parcelas_pendentes)
        
        # Criar transação de débito na conta vinculada
        from .transacoes import criar_transacao_interna
        
        transacao_quitacao = criar_transacao_interna(
            db=db,
            tenant_id=current_user.tenant_id,
            conta_id=cartao.conta_vinculada_id,
            categoria_id=compra.categoria_id,
            valor=-valor_total_quitacao,  # Débito (saída de dinheiro)
            descricao=f"Quitação antecipada: {compra.descricao}",
            data_transacao=datetime.now().date()
        )
        
        # Marcar todas as parcelas pendentes como pagas
        for parcela in parcelas_pendentes:
            parcela.paga = True
            parcela.processada = True
            parcela.transacao_id = transacao_quitacao.id
        
        # Marcar compra como quitada
        compra.status = "quitada"
        
        db.commit()
        
        return {
            "message": "Parcelamento quitado com sucesso",
            "parcelas_quitadas": len(parcelas_pendentes),
            "valor_quitacao": valor_total_quitacao,
            "transacao_id": transacao_quitacao.id
        }
        
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao quitar parcelamento: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@router.put("/{parcela_id}")
def atualizar_compra_parcelada(
    parcela_id: int,
    compra_data: CompraParceladaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Atualizar uma compra parcelada"""
    try:
        # Buscar a compra parcelada
        compra = db.query(CompraParcelada).filter(
            CompraParcelada.id == parcela_id,
            CompraParcelada.tenant_id == current_user.tenant_id
        ).first()
        
        if not compra:
            raise HTTPException(status_code=404, detail="Compra parcelada não encontrada")
        
        # Verificar se há parcelas já processadas
        parcelas_processadas = db.query(ParcelaCartao).filter(
            ParcelaCartao.compra_parcelada_id == parcela_id,
            ParcelaCartao.paga == True,
            ParcelaCartao.tenant_id == current_user.tenant_id
        ).count()
        
        if parcelas_processadas > 0 and (compra_data.total_parcelas or compra_data.valor_total):
            raise HTTPException(
                status_code=400, 
                detail="Não é possível alterar valor/parcelas: há parcelas já processadas"
            )
        
        # Atualizar campos
        if compra_data.descricao is not None:
            compra.descricao = compra_data.descricao
        if compra_data.categoria_id is not None:
            compra.categoria_id = compra_data.categoria_id
        
        # Se pode alterar valor/parcelas
        if parcelas_processadas == 0:
            if compra_data.valor_total is not None:
                compra.valor_total = compra_data.valor_total
                compra.valor_parcela = compra_data.valor_total / compra.total_parcelas
            
            if compra_data.total_parcelas is not None:
                compra.total_parcelas = compra_data.total_parcelas
                compra.valor_parcela = compra.valor_total / compra_data.total_parcelas
                
                # Recriar parcelas se necessário
                db.query(ParcelaCartao).filter(
                    ParcelaCartao.compra_parcelada_id == parcela_id
                ).delete()
                
                # Criar novas parcelas
                for i in range(compra.total_parcelas):
                    data_vencimento = compra.data_primeira_parcela + timedelta(days=30 * i)
                    
                    parcela = ParcelaCartao(
                        compra_parcelada_id=compra.id,
                        numero_parcela=i + 1,
                        valor=compra.valor_parcela,
                        data_vencimento=data_vencimento,
                        paga=False,
                        processada=False,
                        tenant_id=current_user.tenant_id
                    )
                    db.add(parcela)
        
        db.commit()
        
        return {"message": "Compra parcelada atualizada com sucesso"}
        
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao atualizar compra parcelada: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}") 