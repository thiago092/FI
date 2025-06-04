from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta
from typing import List, Optional
from decimal import Decimal

from ..database import get_db
from ..models.user import User
from ..models.financial import Transacao, CompraParcelada, Categoria, Cartao, Fatura
from ..core.security import get_current_user
from pydantic import BaseModel

router = APIRouter(tags=["cartoes-parcelados"])

# Schemas
class CompraParceladaCreate(BaseModel):
    descricao: str
    valor_total: float
    numero_parcelas: int
    categoria_id: int
    cartao_id: int
    data_compra: date

class CompraParceladaResponse(BaseModel):
    id: int
    descricao: str
    valor_total: float
    numero_parcelas: int
    valor_parcela: float
    parcelas_pagas: int
    parcelas_restantes: int
    categoria_nome: str
    cartao_nome: str
    status: str
    data_compra: str

@router.post("/criar")
async def criar_compra_parcelada(
    compra: CompraParceladaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Criar compra parcelada no cartão"""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(status_code=400, detail="Usuário deve estar associado a um tenant")

        # Validar cartão
        cartao = db.query(Cartao).filter(
            and_(Cartao.id == compra.cartao_id, Cartao.tenant_id == tenant_id)
        ).first()
        if not cartao:
            raise HTTPException(status_code=404, detail="Cartão não encontrado")

        # Calcular valor da parcela
        valor_parcela = compra.valor_total / compra.numero_parcelas

        # Criar registro da compra parcelada
        compra_parcelada = CompraParcelada(
            descricao=compra.descricao,
            valor_total=compra.valor_total,
            numero_parcelas=compra.numero_parcelas,
            valor_parcela=valor_parcela,
            data_compra=compra.data_compra,
            categoria_id=compra.categoria_id,
            cartao_id=compra.cartao_id,
            tenant_id=tenant_id
        )
        db.add(compra_parcelada)
        db.flush()

        # Gerar as transações das parcelas
        parcelas_criadas = []
        for i in range(compra.numero_parcelas):
            # Data da parcela (próximos meses)
            data_parcela = compra.data_compra + relativedelta(months=i)
            
            # Buscar ou criar fatura do mês
            ano_mes = data_parcela.strftime("%Y-%m")
            fatura = db.query(Fatura).filter(
                and_(
                    Fatura.cartao_id == cartao.id,
                    func.to_char(Fatura.data_vencimento, 'YYYY-MM') == ano_mes
                )
            ).first()

            if not fatura:
                # Criar fatura se não existir
                data_vencimento = data_parcela.replace(day=cartao.vencimento)
                if data_vencimento <= data_parcela:
                    data_vencimento = data_vencimento + relativedelta(months=1)
                
                fatura = Fatura(
                    cartao_id=cartao.id,
                    mes_referencia=data_parcela.month,
                    ano_referencia=data_parcela.year,
                    data_vencimento=data_vencimento,
                    valor_total=0,
                    valor_pago=0,
                    status="ABERTA",
                    tenant_id=tenant_id
                )
                db.add(fatura)
                db.flush()

            # Criar transação da parcela
            transacao_parcela = Transacao(
                descricao=f"{compra.descricao} - {i+1}/{compra.numero_parcelas}",
                valor=-abs(valor_parcela),  # Negativo para despesa
                tipo="SAIDA",
                categoria_id=compra.categoria_id,
                cartao_id=cartao.id,
                data=data_parcela,
                fatura_id=fatura.id,
                is_parcelada=True,
                numero_parcela=i + 1,
                total_parcelas=compra.numero_parcelas,
                compra_parcelada_id=compra_parcelada.id,
                tenant_id=tenant_id
            )
            db.add(transacao_parcela)

            # Atualizar valor da fatura
            fatura.valor_total += valor_parcela

            parcelas_criadas.append({
                "numero": i + 1,
                "valor": float(valor_parcela),
                "data": data_parcela.strftime("%d/%m/%Y"),
                "fatura_vencimento": fatura.data_vencimento.strftime("%d/%m/%Y")
            })

        db.commit()

        return {
            "message": "Compra parcelada criada com sucesso",
            "compra_id": compra_parcelada.id,
            "valor_total": compra.valor_total,
            "numero_parcelas": compra.numero_parcelas,
            "valor_parcela": float(valor_parcela),
            "parcelas": parcelas_criadas
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar compra parcelada: {str(e)}")

@router.get("/listar")
async def listar_compras_parceladas(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar compras parceladas"""
    try:
        tenant_id = current_user.tenant_id

        query = db.query(
            CompraParcelada,
            Categoria.nome.label('categoria_nome'),
            Cartao.nome.label('cartao_nome')
        ).join(
            Categoria, CompraParcelada.categoria_id == Categoria.id
        ).join(
            Cartao, CompraParcelada.cartao_id == Cartao.id
        ).filter(CompraParcelada.tenant_id == tenant_id)

        if status:
            query = query.filter(CompraParcelada.status == status)

        compras = query.all()

        resultado = []
        for compra, categoria_nome, cartao_nome in compras:
            parcelas_restantes = compra.numero_parcelas - compra.parcelas_pagas
            
            resultado.append({
                "id": compra.id,
                "descricao": compra.descricao,
                "valor_total": float(compra.valor_total),
                "numero_parcelas": compra.numero_parcelas,
                "valor_parcela": float(compra.valor_parcela),
                "parcelas_pagas": compra.parcelas_pagas,
                "parcelas_restantes": parcelas_restantes,
                "categoria_nome": categoria_nome,
                "cartao_nome": cartao_nome,
                "status": compra.status,
                "data_compra": compra.data_compra.strftime("%d/%m/%Y"),
                "progresso": round((compra.parcelas_pagas / compra.numero_parcelas) * 100, 1)
            })

        return resultado

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar compras: {str(e)}")

@router.get("/detalhes/{compra_id}")
async def detalhes_compra_parcelada(
    compra_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obter detalhes de uma compra parcelada"""
    try:
        tenant_id = current_user.tenant_id

        # Buscar compra
        compra = db.query(CompraParcelada).filter(
            and_(CompraParcelada.id == compra_id, CompraParcelada.tenant_id == tenant_id)
        ).first()

        if not compra:
            raise HTTPException(status_code=404, detail="Compra não encontrada")

        # Buscar parcelas
        parcelas = db.query(
            Transacao,
            Fatura.data_vencimento,
            Fatura.status.label('fatura_status')
        ).join(
            Fatura, Transacao.fatura_id == Fatura.id
        ).filter(
            Transacao.compra_parcelada_id == compra_id
        ).order_by(Transacao.numero_parcela).all()

        parcelas_detalhes = []
        for transacao, fatura_vencimento, fatura_status in parcelas:
            hoje = date.today()
            data_transacao = transacao.data
            
            # Determinar status da parcela
            if data_transacao <= hoje:
                status_parcela = "paga" if fatura_status == "PAGA" else "vencida"
            else:
                status_parcela = "pendente"

            parcelas_detalhes.append({
                "numero": transacao.numero_parcela,
                "valor": float(abs(transacao.valor)),
                "data": data_transacao.strftime("%d/%m/%Y"),
                "fatura_vencimento": fatura_vencimento.strftime("%d/%m/%Y"),
                "status": status_parcela,
                "dias_vencimento": (fatura_vencimento - hoje).days
            })

        return {
            "compra": {
                "id": compra.id,
                "descricao": compra.descricao,
                "valor_total": float(compra.valor_total),
                "numero_parcelas": compra.numero_parcelas,
                "valor_parcela": float(compra.valor_parcela),
                "parcelas_pagas": compra.parcelas_pagas,
                "status": compra.status,
                "data_compra": compra.data_compra.strftime("%d/%m/%Y")
            },
            "parcelas": parcelas_detalhes
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar detalhes: {str(e)}")

@router.post("/quitar/{compra_id}")
async def quitar_compra_parcelada(
    compra_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Quitar antecipadamente uma compra parcelada"""
    try:
        tenant_id = current_user.tenant_id

        # Buscar compra
        compra = db.query(CompraParcelada).filter(
            and_(CompraParcelada.id == compra_id, CompraParcelada.tenant_id == tenant_id)
        ).first()

        if not compra:
            raise HTTPException(status_code=404, detail="Compra não encontrada")

        if compra.status == "QUITADA":
            raise HTTPException(status_code=400, detail="Compra já foi quitada")

        # Buscar parcelas futuras não pagas
        hoje = date.today()
        parcelas_futuras = db.query(Transacao).filter(
            and_(
                Transacao.compra_parcelada_id == compra_id,
                Transacao.data > hoje
            )
        ).all()

        # Remover parcelas futuras das faturas
        for parcela in parcelas_futuras:
            if parcela.fatura_id:
                fatura = db.query(Fatura).filter(Fatura.id == parcela.fatura_id).first()
                if fatura:
                    fatura.valor_total -= abs(parcela.valor)
            
            db.delete(parcela)

        # Atualizar compra
        compra.status = "QUITADA"
        compra.parcelas_pagas = compra.numero_parcelas

        db.commit()

        return {
            "message": "Compra quitada com sucesso",
            "parcelas_removidas": len(parcelas_futuras)
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao quitar compra: {str(e)}")

@router.get("/resumo")
async def resumo_compras_parceladas(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resumo das compras parceladas"""
    try:
        tenant_id = current_user.tenant_id

        # Total de compras ativas
        total_compras = db.query(func.count(CompraParcelada.id)).filter(
            and_(CompraParcelada.tenant_id == tenant_id, CompraParcelada.status == "ATIVA")
        ).scalar() or 0

        # Valor total em parcelas
        valor_total = db.query(func.sum(CompraParcelada.valor_total)).filter(
            and_(CompraParcelada.tenant_id == tenant_id, CompraParcelada.status == "ATIVA")
        ).scalar() or 0

        # Parcelas do mês atual
        hoje = date.today()
        inicio_mes = hoje.replace(day=1)
        fim_mes = (inicio_mes + relativedelta(months=1)) - timedelta(days=1)

        parcelas_mes = db.query(func.sum(func.abs(Transacao.valor))).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.is_parcelada == True,
                Transacao.data >= inicio_mes,
                Transacao.data <= fim_mes
            )
        ).scalar() or 0

        # Próximas parcelas (próximos 30 dias)
        data_limite = hoje + timedelta(days=30)
        proximas_parcelas = db.query(func.count(Transacao.id)).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.is_parcelada == True,
                Transacao.data > hoje,
                Transacao.data <= data_limite
            )
        ).scalar() or 0

        return {
            "total_compras_ativas": total_compras,
            "valor_total_parcelado": float(valor_total),
            "parcelas_mes_atual": float(parcelas_mes),
            "proximas_parcelas_30_dias": proximas_parcelas
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar resumo: {str(e)}") 