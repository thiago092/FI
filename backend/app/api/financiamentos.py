from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_
from typing import List, Optional
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from decimal import Decimal
import calendar

from ..database import get_db
from ..core.security import get_current_user
from ..models.user import User
from ..models.financial import (
    Financiamento, ParcelaFinanciamento, Categoria, Conta, Transacao, TipoTransacao
)
from pydantic import BaseModel

router = APIRouter()

# Schemas
class FinanciamentoCreate(BaseModel):
    descricao: str
    valor_total: float
    valor_entrada: float = 0
    taxa_juros_mensal: float  # Ex: 1.5 para 1.5%
    numero_parcelas: int
    data_contratacao: date
    data_primeira_parcela: date
    categoria_id: int
    conta_id: int

class FinanciamentoUpdate(BaseModel):
    descricao: Optional[str] = None
    status: Optional[str] = None

class FinanciamentoResponse(BaseModel):
    id: int
    descricao: str
    valor_total: float
    valor_entrada: float
    valor_financiado: float
    taxa_juros_mensal: float
    numero_parcelas: int
    valor_parcela: float
    data_contratacao: date
    data_primeira_parcela: date
    categoria_id: int
    categoria_nome: str
    categoria_icone: str
    conta_id: int
    conta_nome: str
    status: str
    saldo_devedor: float
    parcelas_pagas: int
    parcelas_pendentes: int
    percentual_pago: float
    valor_total_pago: float
    valor_total_juros: float
    proxima_parcela: Optional[dict] = None

class ParcelaFinanciamentoResponse(BaseModel):
    id: int
    numero_parcela: int
    valor_parcela: float
    valor_juros: float
    valor_amortizacao: float
    saldo_devedor: float
    data_vencimento: date
    status: str
    data_pagamento: Optional[date] = None
    valor_pago: Optional[float] = None
    dias_atraso: Optional[int] = None

# Endpoints
@router.get("/", response_model=List[FinanciamentoResponse])
def listar_financiamentos(
    status: Optional[str] = None,
    categoria_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista todos os financiamentos do usuário"""
    
    query = db.query(Financiamento).filter(
        Financiamento.tenant_id == current_user.tenant_id
    )
    
    if status:
        query = query.filter(Financiamento.status == status)
    
    if categoria_id:
        query = query.filter(Financiamento.categoria_id == categoria_id)
    
    financiamentos = query.order_by(desc(Financiamento.created_at)).all()
    
    result = []
    for fin in financiamentos:
        # Calcular estatísticas
        parcelas = db.query(ParcelaFinanciamento).filter(
            ParcelaFinanciamento.financiamento_id == fin.id
        ).all()
        
        parcelas_pagas = len([p for p in parcelas if p.status == "PAGA"])
        parcelas_pendentes = len([p for p in parcelas if p.status == "PENDENTE"])
        
        percentual_pago = (parcelas_pagas / fin.numero_parcelas * 100) if fin.numero_parcelas > 0 else 0
        valor_total_pago = sum([p.valor_pago or 0 for p in parcelas if p.status == "PAGA"])
        valor_total_juros = sum([p.valor_juros for p in parcelas])
        
        # Próxima parcela
        proxima_parcela = None
        proxima = next((p for p in parcelas if p.status == "PENDENTE"), None)
        if proxima:
            hoje = date.today()
            dias_para_vencimento = (proxima.data_vencimento - hoje).days
            proxima_parcela = {
                "numero": proxima.numero_parcela,
                "valor": float(proxima.valor_parcela),
                "data_vencimento": proxima.data_vencimento.strftime("%d/%m/%Y"),
                "dias_para_vencimento": dias_para_vencimento
            }
        
        result.append(FinanciamentoResponse(
            id=fin.id,
            descricao=fin.descricao,
            valor_total=float(fin.valor_total),
            valor_entrada=float(fin.valor_entrada),
            valor_financiado=float(fin.valor_financiado),
            taxa_juros_mensal=float(fin.taxa_juros_mensal),
            numero_parcelas=fin.numero_parcelas,
            valor_parcela=float(fin.valor_parcela),
            data_contratacao=fin.data_contratacao,
            data_primeira_parcela=fin.data_primeira_parcela,
            categoria_id=fin.categoria_id,
            categoria_nome=fin.categoria.nome,
            categoria_icone=fin.categoria.icone,
            conta_id=fin.conta_id,
            conta_nome=fin.conta.nome,
            status=fin.status,
            saldo_devedor=float(fin.saldo_devedor),
            parcelas_pagas=parcelas_pagas,
            parcelas_pendentes=parcelas_pendentes,
            percentual_pago=round(percentual_pago, 1),
            valor_total_pago=float(valor_total_pago),
            valor_total_juros=float(valor_total_juros),
            proxima_parcela=proxima_parcela
        ))
    
    return result

@router.post("/", response_model=FinanciamentoResponse)
def criar_financiamento(
    financiamento_data: FinanciamentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria um novo financiamento com todas as parcelas"""
    
    # Validações
    if financiamento_data.numero_parcelas <= 0:
        raise HTTPException(
            status_code=400,
            detail="Número de parcelas deve ser maior que zero"
        )
    
    if financiamento_data.taxa_juros_mensal < 0:
        raise HTTPException(
            status_code=400,
            detail="Taxa de juros não pode ser negativa"
        )
    
    if financiamento_data.valor_entrada > financiamento_data.valor_total:
        raise HTTPException(
            status_code=400,
            detail="Valor de entrada não pode ser maior que o valor total"
        )
    
    # Verificar se categoria e conta existem
    categoria = db.query(Categoria).filter(
        Categoria.id == financiamento_data.categoria_id,
        Categoria.tenant_id == current_user.tenant_id
    ).first()
    
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    
    conta = db.query(Conta).filter(
        Conta.id == financiamento_data.conta_id,
        Conta.tenant_id == current_user.tenant_id
    ).first()
    
    if not conta:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    
    # Calcular valores
    valor_financiado = financiamento_data.valor_total - financiamento_data.valor_entrada
    taxa_decimal = financiamento_data.taxa_juros_mensal / 100
    
    # Calcular valor da parcela usando fórmula Price
    if taxa_decimal > 0:
        fator = ((1 + taxa_decimal) ** financiamento_data.numero_parcelas * taxa_decimal) / \
                (((1 + taxa_decimal) ** financiamento_data.numero_parcelas) - 1)
        valor_parcela = valor_financiado * fator
    else:
        # Sem juros - parcelamento simples
        valor_parcela = valor_financiado / financiamento_data.numero_parcelas
    
    # Criar financiamento
    financiamento = Financiamento(
        descricao=financiamento_data.descricao,
        valor_total=Decimal(str(financiamento_data.valor_total)),
        valor_entrada=Decimal(str(financiamento_data.valor_entrada)),
        valor_financiado=Decimal(str(valor_financiado)),
        taxa_juros_mensal=Decimal(str(financiamento_data.taxa_juros_mensal)),
        numero_parcelas=financiamento_data.numero_parcelas,
        valor_parcela=Decimal(str(valor_parcela)),
        data_contratacao=financiamento_data.data_contratacao,
        data_primeira_parcela=financiamento_data.data_primeira_parcela,
        categoria_id=financiamento_data.categoria_id,
        conta_id=financiamento_data.conta_id,
        saldo_devedor=Decimal(str(valor_financiado)),
        tenant_id=current_user.tenant_id
    )
    
    db.add(financiamento)
    db.flush()
    
    # Gerar tabela Price (parcelas)
    saldo = valor_financiado
    data_atual = financiamento_data.data_primeira_parcela
    
    for i in range(financiamento_data.numero_parcelas):
        # Calcular juros da parcela
        if taxa_decimal > 0:
            juros_parcela = saldo * taxa_decimal
            amortizacao = valor_parcela - juros_parcela
        else:
            juros_parcela = 0
            amortizacao = valor_parcela
        
        # Ajustar última parcela para evitar diferenças de arredondamento
        if i == financiamento_data.numero_parcelas - 1:
            amortizacao = saldo
            valor_parcela_atual = saldo + juros_parcela
        else:
            valor_parcela_atual = valor_parcela
        
        # Criar parcela
        parcela = ParcelaFinanciamento(
            financiamento_id=financiamento.id,
            numero_parcela=i + 1,
            valor_parcela=Decimal(str(valor_parcela_atual)),
            valor_juros=Decimal(str(juros_parcela)),
            valor_amortizacao=Decimal(str(amortizacao)),
            saldo_devedor=Decimal(str(saldo - amortizacao)),
            data_vencimento=data_atual,
            tenant_id=current_user.tenant_id
        )
        
        db.add(parcela)
        
        # Atualizar saldo e data
        saldo -= amortizacao
        data_atual = data_atual + relativedelta(months=1)
    
    # Registrar entrada se houver
    if financiamento_data.valor_entrada > 0:
        transacao_entrada = Transacao(
            descricao=f"Entrada - {financiamento_data.descricao}",
            valor=-abs(financiamento_data.valor_entrada),
            tipo=TipoTransacao.SAIDA,
            categoria_id=financiamento_data.categoria_id,
            conta_id=financiamento_data.conta_id,
            data=financiamento_data.data_contratacao,
            observacoes=f"Entrada do financiamento #{financiamento.id}",
            tenant_id=current_user.tenant_id
        )
        db.add(transacao_entrada)
    
    db.commit()
    db.refresh(financiamento)
    
    # Retornar resposta
    return FinanciamentoResponse(
        id=financiamento.id,
        descricao=financiamento.descricao,
        valor_total=float(financiamento.valor_total),
        valor_entrada=float(financiamento.valor_entrada),
        valor_financiado=float(financiamento.valor_financiado),
        taxa_juros_mensal=float(financiamento.taxa_juros_mensal),
        numero_parcelas=financiamento.numero_parcelas,
        valor_parcela=float(financiamento.valor_parcela),
        data_contratacao=financiamento.data_contratacao,
        data_primeira_parcela=financiamento.data_primeira_parcela,
        categoria_id=financiamento.categoria_id,
        categoria_nome=categoria.nome,
        categoria_icone=categoria.icone,
        conta_id=financiamento.conta_id,
        conta_nome=conta.nome,
        status=financiamento.status,
        saldo_devedor=float(financiamento.saldo_devedor),
        parcelas_pagas=0,
        parcelas_pendentes=financiamento.numero_parcelas,
        percentual_pago=0,
        valor_total_pago=0,
        valor_total_juros=float(valor_parcela * financiamento.numero_parcelas - valor_financiado),
        proxima_parcela={
            "numero": 1,
            "valor": float(valor_parcela),
            "data_vencimento": financiamento.data_primeira_parcela.strftime("%d/%m/%Y"),
            "dias_para_vencimento": (financiamento.data_primeira_parcela - date.today()).days
        }
    )

@router.get("/{financiamento_id}/parcelas", response_model=List[ParcelaFinanciamentoResponse])
def listar_parcelas_financiamento(
    financiamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista todas as parcelas de um financiamento"""
    
    financiamento = db.query(Financiamento).filter(
        Financiamento.id == financiamento_id,
        Financiamento.tenant_id == current_user.tenant_id
    ).first()
    
    if not financiamento:
        raise HTTPException(status_code=404, detail="Financiamento não encontrado")
    
    parcelas = db.query(ParcelaFinanciamento).filter(
        ParcelaFinanciamento.financiamento_id == financiamento_id
    ).order_by(ParcelaFinanciamento.numero_parcela).all()
    
    hoje = date.today()
    result = []
    
    for parcela in parcelas:
        dias_atraso = None
        if parcela.status == "PENDENTE" and parcela.data_vencimento < hoje:
            dias_atraso = (hoje - parcela.data_vencimento).days
        
        result.append(ParcelaFinanciamentoResponse(
            id=parcela.id,
            numero_parcela=parcela.numero_parcela,
            valor_parcela=float(parcela.valor_parcela),
            valor_juros=float(parcela.valor_juros),
            valor_amortizacao=float(parcela.valor_amortizacao),
            saldo_devedor=float(parcela.saldo_devedor),
            data_vencimento=parcela.data_vencimento,
            status=parcela.status,
            data_pagamento=parcela.data_pagamento,
            valor_pago=float(parcela.valor_pago) if parcela.valor_pago else None,
            dias_atraso=dias_atraso
        ))
    
    return result

@router.post("/{financiamento_id}/parcelas/{parcela_id}/pagar")
def pagar_parcela_financiamento(
    financiamento_id: int,
    parcela_id: int,
    valor_pago: Optional[float] = None,
    data_pagamento: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Registra o pagamento de uma parcela"""
    
    financiamento = db.query(Financiamento).filter(
        Financiamento.id == financiamento_id,
        Financiamento.tenant_id == current_user.tenant_id
    ).first()
    
    if not financiamento:
        raise HTTPException(status_code=404, detail="Financiamento não encontrado")
    
    parcela = db.query(ParcelaFinanciamento).filter(
        ParcelaFinanciamento.id == parcela_id,
        ParcelaFinanciamento.financiamento_id == financiamento_id
    ).first()
    
    if not parcela:
        raise HTTPException(status_code=404, detail="Parcela não encontrada")
    
    if parcela.status == "PAGA":
        raise HTTPException(status_code=400, detail="Parcela já foi paga")
    
    # Valores padrão
    if not valor_pago:
        valor_pago = float(parcela.valor_parcela)
    
    if not data_pagamento:
        data_pagamento = date.today()
    
    # Atualizar parcela
    parcela.status = "PAGA"
    parcela.data_pagamento = data_pagamento
    parcela.valor_pago = Decimal(str(valor_pago))
    
    # Atualizar saldo devedor do financiamento
    financiamento.saldo_devedor = max(0, financiamento.saldo_devedor - parcela.valor_amortizacao)
    
    # Verificar se foi quitado
    parcelas_pendentes = db.query(ParcelaFinanciamento).filter(
        ParcelaFinanciamento.financiamento_id == financiamento_id,
        ParcelaFinanciamento.status == "PENDENTE"
    ).count()
    
    if parcelas_pendentes == 0:
        financiamento.status = "QUITADO"
    
    # Registrar transação de pagamento
    transacao_pagamento = Transacao(
        descricao=f"{financiamento.descricao} - Parcela {parcela.numero_parcela}/{financiamento.numero_parcelas}",
        valor=-abs(valor_pago),
        tipo=TipoTransacao.SAIDA,
        categoria_id=financiamento.categoria_id,
        conta_id=financiamento.conta_id,
        data=data_pagamento,
        observacoes=f"Parcela do financiamento #{financiamento.id}",
        tenant_id=current_user.tenant_id
    )
    
    db.add(transacao_pagamento)
    db.commit()
    
    return {"message": "Parcela paga com sucesso", "transacao_id": transacao_pagamento.id}

@router.get("/resumo")
def resumo_financiamentos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retorna resumo dos financiamentos"""
    
    financiamentos = db.query(Financiamento).filter(
        Financiamento.tenant_id == current_user.tenant_id,
        Financiamento.status == "ATIVO"
    ).all()
    
    if not financiamentos:
        return {
            "total_financiamentos": 0,
            "valor_total_financiado": 0,
            "saldo_devedor_total": 0,
            "valor_parcelas_mes": 0,
            "parcelas_vencendo_30_dias": 0
        }
    
    # Calcular parcelas do próximo mês
    hoje = date.today()
    proximo_mes = hoje + relativedelta(months=1)
    
    parcelas_mes = db.query(ParcelaFinanciamento).filter(
        ParcelaFinanciamento.financiamento_id.in_([f.id for f in financiamentos]),
        ParcelaFinanciamento.data_vencimento >= hoje,
        ParcelaFinanciamento.data_vencimento < proximo_mes,
        ParcelaFinanciamento.status == "PENDENTE"
    ).all()
    
    # Parcelas vencendo em 30 dias
    data_limite = hoje + relativedelta(days=30)
    parcelas_vencendo = db.query(ParcelaFinanciamento).filter(
        ParcelaFinanciamento.financiamento_id.in_([f.id for f in financiamentos]),
        ParcelaFinanciamento.data_vencimento >= hoje,
        ParcelaFinanciamento.data_vencimento <= data_limite,
        ParcelaFinanciamento.status == "PENDENTE"
    ).count()
    
    return {
        "total_financiamentos": len(financiamentos),
        "valor_total_financiado": float(sum([f.valor_financiado for f in financiamentos])),
        "saldo_devedor_total": float(sum([f.saldo_devedor for f in financiamentos])),
        "valor_parcelas_mes": float(sum([p.valor_parcela for p in parcelas_mes])),
        "parcelas_vencendo_30_dias": parcelas_vencendo
    }

@router.put("/{financiamento_id}")
def atualizar_financiamento(
    financiamento_id: int,
    financiamento_data: FinanciamentoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um financiamento"""
    
    financiamento = db.query(Financiamento).filter(
        Financiamento.id == financiamento_id,
        Financiamento.tenant_id == current_user.tenant_id
    ).first()
    
    if not financiamento:
        raise HTTPException(status_code=404, detail="Financiamento não encontrado")
    
    # Atualizar campos permitidos
    if financiamento_data.descricao:
        financiamento.descricao = financiamento_data.descricao
    
    if financiamento_data.status:
        if financiamento_data.status not in ["ATIVO", "QUITADO", "CANCELADO"]:
            raise HTTPException(status_code=400, detail="Status inválido")
        financiamento.status = financiamento_data.status
    
    db.commit()
    db.refresh(financiamento)
    
    return {"message": "Financiamento atualizado com sucesso", "financiamento": financiamento}

@router.delete("/{financiamento_id}")
def excluir_financiamento(
    financiamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Exclui um financiamento (apenas se não tiver parcelas pagas)"""
    
    financiamento = db.query(Financiamento).filter(
        Financiamento.id == financiamento_id,
        Financiamento.tenant_id == current_user.tenant_id
    ).first()
    
    if not financiamento:
        raise HTTPException(status_code=404, detail="Financiamento não encontrado")
    
    # Verificar se tem parcelas pagas
    parcelas_pagas = db.query(ParcelaFinanciamento).filter(
        ParcelaFinanciamento.financiamento_id == financiamento_id,
        ParcelaFinanciamento.status == "PAGA"
    ).count()
    
    if parcelas_pagas > 0:
        raise HTTPException(
            status_code=400, 
            detail="Não é possível excluir financiamento com parcelas já pagas"
        )
    
    # Excluir parcelas primeiro
    db.query(ParcelaFinanciamento).filter(
        ParcelaFinanciamento.financiamento_id == financiamento_id
    ).delete()
    
    # Excluir financiamento
    db.delete(financiamento)
    db.commit()
    
    return {"message": "Financiamento excluído com sucesso"}

@router.post("/processar-debitos-automaticos")
def processar_debitos_automaticos(
    data_referencia: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Processa débitos automáticos de financiamentos (apenas admin)"""
    
    # Verificar se é admin global
    if not current_user.is_global_admin:
        raise HTTPException(
            status_code=403,
            detail="Apenas administradores podem executar débitos automáticos"
        )
    
    from ..services.financiamento_service import FinanciamentoService
    
    try:
        resultado = FinanciamentoService.processar_debitos_automaticos(db, data_referencia)
        return resultado
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar débitos automáticos: {str(e)}"
        )

@router.get("/parcelas-vencendo")
def listar_parcelas_vencendo(
    dias_antecedencia: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista parcelas que vencerão nos próximos dias"""
    
    from ..services.financiamento_service import FinanciamentoService
    
    try:
        parcelas = FinanciamentoService.obter_parcelas_vencendo(
            db, 
            dias_antecedencia, 
            current_user.tenant_id
        )
        return parcelas
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao obter parcelas vencendo: {str(e)}"
        )

class SimulacaoFinanciamentoRequest(BaseModel):
    valor_financiado: float
    taxa_juros_mensal: float
    numero_parcelas: int

@router.post("/simular")
def simular_financiamento(
    simulacao_data: SimulacaoFinanciamentoRequest,
    current_user: User = Depends(get_current_user)
):
    """Simula um financiamento com tabela Price"""
    
    from ..services.financiamento_service import FinanciamentoService
    
    try:
        # Validações
        if simulacao_data.valor_financiado <= 0:
            raise HTTPException(status_code=400, detail="Valor financiado deve ser maior que zero")
        
        if simulacao_data.numero_parcelas <= 0:
            raise HTTPException(status_code=400, detail="Número de parcelas deve ser maior que zero")
        
        if simulacao_data.taxa_juros_mensal < 0:
            raise HTTPException(status_code=400, detail="Taxa de juros não pode ser negativa")
        
        # Simular
        tabela = FinanciamentoService.simular_tabela_price(
            simulacao_data.valor_financiado,
            simulacao_data.taxa_juros_mensal,
            simulacao_data.numero_parcelas
        )
        
        # Calcular totais
        valor_total_financiado = simulacao_data.valor_financiado
        valor_total_parcelas = sum([p["valor_parcela"] for p in tabela])
        valor_total_juros = valor_total_parcelas - valor_total_financiado
        
        return {
            "simulacao": {
                "valor_financiado": valor_total_financiado,
                "taxa_juros_mensal": simulacao_data.taxa_juros_mensal,
                "numero_parcelas": simulacao_data.numero_parcelas,
                "valor_total_parcelas": round(valor_total_parcelas, 2),
                "valor_total_juros": round(valor_total_juros, 2),
                "valor_parcela_media": round(valor_total_parcelas / simulacao_data.numero_parcelas, 2)
            },
            "tabela": tabela
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao simular financiamento: {str(e)}"
        ) 