from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta
from typing import List, Optional
from decimal import Decimal

from ..database import get_db
from ..models.user import User
from ..models.financial import Transacao, Parcela, TransacaoRecorrente, Categoria, Conta, Cartao
from ..core.security import get_current_user
from pydantic import BaseModel

router = APIRouter(tags=["parcelas"])

# Schemas
class ParcelaCreate(BaseModel):
    transacao_origem_id: int
    numero_parcela: int
    total_parcelas: int
    valor: float
    data_vencimento: date
    status: str = "PENDENTE"

class ParcelaUpdate(BaseModel):
    status: Optional[str] = None
    data_pagamento: Optional[date] = None

class TransacaoParceladaCreate(BaseModel):
    descricao: str
    valor_total: float
    numero_parcelas: int
    data_primeira_parcela: date
    categoria_id: int
    cartao_id: Optional[int] = None
    conta_id: Optional[int] = None

class TransacaoRecorrenteCreate(BaseModel):
    descricao: str
    valor: float
    tipo: str  # ENTRADA, SAIDA
    categoria_id: int
    conta_id: Optional[int] = None
    cartao_id: Optional[int] = None
    frequencia: str  # MENSAL, SEMANAL, ANUAL
    dia_vencimento: int
    data_inicio: date
    data_fim: Optional[date] = None

@router.post("/criar-parcelada")
async def criar_transacao_parcelada(
    transacao: TransacaoParceladaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Criar transação parcelada e suas parcelas"""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(status_code=400, detail="Usuário deve estar associado a um tenant")

        # Criar transação origem (apenas para controle)
        transacao_origem = Transacao(
            descricao=f"{transacao.descricao} (Parcelado {transacao.numero_parcelas}x)",
            valor=transacao.valor_total,
            tipo="SAIDA",
            categoria_id=transacao.categoria_id,
            conta_id=transacao.conta_id,
            cartao_id=transacao.cartao_id,
            data=transacao.data_primeira_parcela,
            tenant_id=tenant_id,
            is_parcela_origem=True  # Flag para identificar
        )
        db.add(transacao_origem)
        db.flush()

        # Calcular valor da parcela
        valor_parcela = transacao.valor_total / transacao.numero_parcelas

        # Criar parcelas
        parcelas_criadas = []
        for i in range(transacao.numero_parcelas):
            data_vencimento = transacao.data_primeira_parcela + relativedelta(months=i)
            
            parcela = Parcela(
                transacao_origem_id=transacao_origem.id,
                numero_parcela=i + 1,
                total_parcelas=transacao.numero_parcelas,
                valor=valor_parcela,
                data_vencimento=data_vencimento,
                tenant_id=tenant_id
            )
            db.add(parcela)
            parcelas_criadas.append({
                "numero": i + 1,
                "valor": valor_parcela,
                "vencimento": data_vencimento.strftime("%d/%m/%Y")
            })

        db.commit()

        return {
            "message": "Transação parcelada criada com sucesso",
            "transacao_id": transacao_origem.id,
            "total_parcelas": transacao.numero_parcelas,
            "valor_parcela": valor_parcela,
            "parcelas": parcelas_criadas
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar transação parcelada: {str(e)}")

@router.get("/proximas-parcelas")
async def get_proximas_parcelas(
    dias: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obter parcelas que vencem nos próximos X dias"""
    try:
        tenant_id = current_user.tenant_id
        data_limite = date.today() + timedelta(days=dias)

        parcelas = db.query(
            Parcela,
            Transacao.descricao,
            Categoria.nome.label('categoria_nome'),
            Categoria.icone.label('categoria_icone')
        ).join(
            Transacao, Parcela.transacao_origem_id == Transacao.id
        ).join(
            Categoria, Transacao.categoria_id == Categoria.id
        ).filter(
            and_(
                Parcela.tenant_id == tenant_id,
                Parcela.status == "PENDENTE",
                Parcela.data_vencimento <= data_limite
            )
        ).order_by(Parcela.data_vencimento).all()

        resultado = []
        for parcela, descricao, categoria_nome, categoria_icone in parcelas:
            dias_vencimento = (parcela.data_vencimento - date.today()).days
            status_vencimento = "vencida" if dias_vencimento < 0 else "hoje" if dias_vencimento == 0 else "próxima"
            
            resultado.append({
                "id": parcela.id,
                "descricao": descricao,
                "categoria": categoria_nome,
                "categoria_icone": categoria_icone,
                "numero_parcela": parcela.numero_parcela,
                "total_parcelas": parcela.total_parcelas,
                "valor": float(parcela.valor),
                "data_vencimento": parcela.data_vencimento.strftime("%d/%m/%Y"),
                "dias_vencimento": dias_vencimento,
                "status_vencimento": status_vencimento
            })

        return resultado

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar parcelas: {str(e)}")

@router.post("/pagar-parcela/{parcela_id}")
async def pagar_parcela(
    parcela_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Marcar parcela como paga e criar transação"""
    try:
        tenant_id = current_user.tenant_id

        # Buscar parcela
        parcela = db.query(Parcela).filter(
            and_(Parcela.id == parcela_id, Parcela.tenant_id == tenant_id)
        ).first()

        if not parcela:
            raise HTTPException(status_code=404, detail="Parcela não encontrada")

        if parcela.status == "PAGA":
            raise HTTPException(status_code=400, detail="Parcela já foi paga")

        # Buscar transação origem
        transacao_origem = db.query(Transacao).filter(Transacao.id == parcela.transacao_origem_id).first()

        # Criar transação da parcela
        transacao_parcela = Transacao(
            descricao=f"{transacao_origem.descricao} - Parcela {parcela.numero_parcela}/{parcela.total_parcelas}",
            valor=-abs(parcela.valor),  # Negativo para despesa
            tipo="SAIDA",
            categoria_id=transacao_origem.categoria_id,
            conta_id=transacao_origem.conta_id,
            cartao_id=transacao_origem.cartao_id,
            data=date.today(),
            tenant_id=tenant_id
        )
        db.add(transacao_parcela)

        # Atualizar parcela
        parcela.status = "PAGA"
        parcela.data_pagamento = date.today()

        db.commit()

        return {
            "message": "Parcela paga com sucesso",
            "transacao_id": transacao_parcela.id,
            "valor_pago": float(parcela.valor)
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao pagar parcela: {str(e)}")

@router.post("/recorrente")
async def criar_transacao_recorrente(
    transacao: TransacaoRecorrenteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Criar transação recorrente"""
    try:
        tenant_id = current_user.tenant_id

        transacao_rec = TransacaoRecorrente(
            descricao=transacao.descricao,
            valor=transacao.valor,
            tipo=transacao.tipo,
            categoria_id=transacao.categoria_id,
            conta_id=transacao.conta_id,
            cartao_id=transacao.cartao_id,
            frequencia=transacao.frequencia,
            dia_vencimento=transacao.dia_vencimento,
            data_inicio=transacao.data_inicio,
            data_fim=transacao.data_fim,
            tenant_id=tenant_id
        )
        db.add(transacao_rec)
        db.commit()

        return {
            "message": "Transação recorrente criada com sucesso",
            "id": transacao_rec.id
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar transação recorrente: {str(e)}")

@router.get("/recorrentes")
async def get_transacoes_recorrentes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar transações recorrentes"""
    try:
        tenant_id = current_user.tenant_id

        recorrentes = db.query(
            TransacaoRecorrente,
            Categoria.nome.label('categoria_nome'),
            Categoria.icone.label('categoria_icone')
        ).join(
            Categoria, TransacaoRecorrente.categoria_id == Categoria.id
        ).filter(
            and_(
                TransacaoRecorrente.tenant_id == tenant_id,
                TransacaoRecorrente.ativa == True
            )
        ).all()

        resultado = []
        for rec, categoria_nome, categoria_icone in recorrentes:
            # Calcular próxima ocorrência
            hoje = date.today()
            if rec.frequencia == "MENSAL":
                if hoje.day <= rec.dia_vencimento:
                    proxima = hoje.replace(day=rec.dia_vencimento)
                else:
                    proxima = (hoje + relativedelta(months=1)).replace(day=rec.dia_vencimento)
            
            resultado.append({
                "id": rec.id,
                "descricao": rec.descricao,
                "valor": float(rec.valor),
                "tipo": rec.tipo,
                "categoria": categoria_nome,
                "categoria_icone": categoria_icone,
                "frequencia": rec.frequencia,
                "proxima_ocorrencia": proxima.strftime("%d/%m/%Y"),
                "ativa": rec.ativa
            })

        return resultado

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar transações recorrentes: {str(e)}")

@router.post("/gerar-recorrentes")
async def gerar_transacoes_recorrentes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Gerar transações das recorrências vencidas"""
    try:
        tenant_id = current_user.tenant_id
        hoje = date.today()

        # Buscar recorrentes ativas
        recorrentes = db.query(TransacaoRecorrente).filter(
            and_(
                TransacaoRecorrente.tenant_id == tenant_id,
                TransacaoRecorrente.ativa == True,
                TransacaoRecorrente.data_inicio <= hoje
            )
        ).all()

        transacoes_criadas = 0

        for rec in recorrentes:
            # Verificar se já foi criada transação neste mês
            inicio_mes = hoje.replace(day=1)
            fim_mes = (inicio_mes + relativedelta(months=1)) - timedelta(days=1)
            
            existe = db.query(Transacao).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.descricao.like(f"%{rec.descricao}%"),
                    Transacao.data >= inicio_mes,
                    Transacao.data <= fim_mes
                )
            ).first()

            if not existe and hoje.day >= rec.dia_vencimento:
                # Criar transação
                transacao = Transacao(
                    descricao=f"{rec.descricao} (Recorrente)",
                    valor=rec.valor if rec.tipo == "ENTRADA" else -abs(rec.valor),
                    tipo=rec.tipo,
                    categoria_id=rec.categoria_id,
                    conta_id=rec.conta_id,
                    cartao_id=rec.cartao_id,
                    data=hoje,
                    tenant_id=tenant_id
                )
                db.add(transacao)
                transacoes_criadas += 1

        db.commit()

        return {
            "message": f"{transacoes_criadas} transações recorrentes criadas",
            "quantidade": transacoes_criadas
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao gerar transações recorrentes: {str(e)}") 