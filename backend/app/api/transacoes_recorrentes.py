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
    mes: Optional[int] = Query(None, description="Mês para cálculo (1-12), padrão é mês atual"),
    ano: Optional[int] = Query(None, description="Ano para cálculo, padrão é ano atual"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter resumo das transações recorrentes para o mês específico"""
    
    # Se não especificado, usar mês/ano atual
    hoje = date.today()
    mes_calculo = mes if mes else hoje.month
    ano_calculo = ano if ano else hoje.year
    
    print(f"📊 Calculando resumo para {mes_calculo}/{ano_calculo}")
    
    query = db.query(TransacaoRecorrente).filter(
        TransacaoRecorrente.tenant_id == current_user.tenant_id
    )
    
    total = query.count()
    ativas = query.filter(TransacaoRecorrente.ativa == True).count()
    inativas = total - ativas
    
    # Calcular valores do mês específico (apenas ativas)
    transacoes_ativas = query.filter(TransacaoRecorrente.ativa == True).all()
    
    valor_mes_entradas = 0.0
    valor_mes_saidas = 0.0
    
    # Definir período do mês
    inicio_mes = date(ano_calculo, mes_calculo, 1)
    if mes_calculo == 12:
        fim_mes = date(ano_calculo + 1, 1, 1) - timedelta(days=1)
    else:
        fim_mes = date(ano_calculo, mes_calculo + 1, 1) - timedelta(days=1)
    
    print(f"📅 Período: {inicio_mes} a {fim_mes}")
    
    for transacao in transacoes_ativas:
        # Calcular quantas vezes a transação ocorre neste mês específico
        ocorrencias_no_mes = calcular_ocorrencias_no_mes(
            transacao, inicio_mes, fim_mes
        )
        
        valor_total_no_mes = float(transacao.valor) * ocorrencias_no_mes
        
        print(f"💰 {transacao.descricao}: {ocorrencias_no_mes}x R${transacao.valor} = R${valor_total_no_mes} ({transacao.tipo})")
        
        if transacao.tipo == "ENTRADA":
            valor_mes_entradas += valor_total_no_mes
        else:
            valor_mes_saidas += valor_total_no_mes
    
    print(f"📈 Total Entradas: R${valor_mes_entradas}")
    print(f"📉 Total Saídas: R${valor_mes_saidas}")
    
    return {
        "total_transacoes": total,
        "ativas": ativas,
        "inativas": inativas,
        "valor_mes_entradas": valor_mes_entradas,
        "valor_mes_saidas": valor_mes_saidas,
        "saldo_mes_estimado": valor_mes_entradas - valor_mes_saidas,
        "mes_referencia": mes_calculo,
        "ano_referencia": ano_calculo
    }

def calcular_ocorrencias_no_mes(transacao: TransacaoRecorrente, inicio_mes: date, fim_mes: date) -> int:
    """Calcular quantas vezes uma transação recorrente ocorre em um mês específico"""
    
    if not transacao.ativa:
        return 0
    
    # Se data de início é depois do fim do mês, não há ocorrências
    if transacao.data_inicio and transacao.data_inicio > fim_mes:
        return 0
    
    # Se data de fim é antes do início do mês, não há ocorrências
    if transacao.data_fim and transacao.data_fim < inicio_mes:
        return 0
    
    # Usar próximo vencimento como base se disponível
    if transacao.proximo_vencimento:
        data_base = transacao.proximo_vencimento
    else:
        data_base = transacao.data_inicio if transacao.data_inicio else inicio_mes
    
    ocorrencias = 0
    data_atual = data_base
    contador = 0  # Proteção contra loop infinito
    
    # Retroceder para encontrar primeira ocorrência antes/no período
    while data_atual > inicio_mes and contador < 365:
        contador += 1
        data_atual = calcular_data_anterior_simples(data_atual, transacao.frequencia, transacao.dia_vencimento)
    
    # Avançar contando ocorrências no período
    contador = 0
    while data_atual <= fim_mes and contador < 365:
        contador += 1
        
        if inicio_mes <= data_atual <= fim_mes:
            ocorrencias += 1
            print(f"   ✅ Ocorrência em {data_atual}")
        
        data_atual = calcular_proxima_data_simples(data_atual, transacao.frequencia, transacao.dia_vencimento)
        
        # Se próxima data passou do período, parar
        if data_atual > fim_mes:
            break
    
    return ocorrencias

def calcular_proxima_data_simples(data_base: date, frequencia: str, dia_vencimento: int) -> date:
    """Calcular próxima data baseada na frequência"""
    if frequencia == "DIARIA":
        return data_base + timedelta(days=1)
    elif frequencia == "SEMANAL":
        return data_base + timedelta(weeks=1)
    elif frequencia == "QUINZENAL":
        return data_base + timedelta(weeks=2)
    elif frequencia == "MENSAL":
        if data_base.month == 12:
            return date(data_base.year + 1, 1, min(dia_vencimento, 31))
        else:
            try:
                return date(data_base.year, data_base.month + 1, dia_vencimento)
            except ValueError:
                # Dia não existe no mês (ex: 31 de fevereiro)
                return date(data_base.year, data_base.month + 1, 28)
    elif frequencia == "BIMESTRAL":
        novo_mes = data_base.month + 2
        novo_ano = data_base.year
        if novo_mes > 12:
            novo_mes -= 12
            novo_ano += 1
        try:
            return date(novo_ano, novo_mes, dia_vencimento)
        except ValueError:
            return date(novo_ano, novo_mes, 28)
    elif frequencia == "TRIMESTRAL":
        novo_mes = data_base.month + 3
        novo_ano = data_base.year
        if novo_mes > 12:
            novo_mes -= 12
            novo_ano += 1
        try:
            return date(novo_ano, novo_mes, dia_vencimento)
        except ValueError:
            return date(novo_ano, novo_mes, 28)
    elif frequencia == "SEMESTRAL":
        novo_mes = data_base.month + 6
        novo_ano = data_base.year
        if novo_mes > 12:
            novo_mes -= 12
            novo_ano += 1
        try:
            return date(novo_ano, novo_mes, dia_vencimento)
        except ValueError:
            return date(novo_ano, novo_mes, 28)
    elif frequencia == "ANUAL":
        try:
            return date(data_base.year + 1, data_base.month, dia_vencimento)
        except ValueError:
            return date(data_base.year + 1, data_base.month, 28)
    else:
        return data_base + timedelta(days=30)  # Fallback

def calcular_data_anterior_simples(data_base: date, frequencia: str, dia_vencimento: int) -> date:
    """Calcular data anterior baseada na frequência"""
    if frequencia == "DIARIA":
        return data_base - timedelta(days=1)
    elif frequencia == "SEMANAL":
        return data_base - timedelta(weeks=1)
    elif frequencia == "QUINZENAL":
        return data_base - timedelta(weeks=2)
    elif frequencia == "MENSAL":
        if data_base.month == 1:
            return date(data_base.year - 1, 12, min(dia_vencimento, 31))
        else:
            try:
                return date(data_base.year, data_base.month - 1, dia_vencimento)
            except ValueError:
                return date(data_base.year, data_base.month - 1, 28)
    elif frequencia == "BIMESTRAL":
        novo_mes = data_base.month - 2
        novo_ano = data_base.year
        if novo_mes < 1:
            novo_mes += 12
            novo_ano -= 1
        try:
            return date(novo_ano, novo_mes, dia_vencimento)
        except ValueError:
            return date(novo_ano, novo_mes, 28)
    elif frequencia == "TRIMESTRAL":
        novo_mes = data_base.month - 3
        novo_ano = data_base.year
        if novo_mes < 1:
            novo_mes += 12
            novo_ano -= 1
        try:
            return date(novo_ano, novo_mes, dia_vencimento)
        except ValueError:
            return date(novo_ano, novo_mes, 28)
    elif frequencia == "SEMESTRAL":
        novo_mes = data_base.month - 6
        novo_ano = data_base.year
        if novo_mes < 1:
            novo_mes += 12
            novo_ano -= 1
        try:
            return date(novo_ano, novo_mes, dia_vencimento)
        except ValueError:
            return date(novo_ano, novo_mes, 28)
    elif frequencia == "ANUAL":
        try:
            return date(data_base.year - 1, data_base.month, dia_vencimento)
        except ValueError:
            return date(data_base.year - 1, data_base.month, 28)
    else:
        return data_base - timedelta(days=30)  # Fallback 