from fastapi import APIRouter, Depends, HTTPException, status, Query, Response, Request
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

def calcular_proximo_vencimento(data_inicio: date, frequencia: str) -> date:
    """Calcula a próxima data de vencimento baseada APENAS na data de início e frequência"""
    hoje = date.today()
    
    # Se ainda não começou, retornar data de início
    if data_inicio > hoje:
        return data_inicio
    
    # Calcular próxima ocorrência baseada na data de início
    data_atual = data_inicio
    
    # Avançar até encontrar a próxima data (incluindo hoje se for data de início)
    while data_atual < hoje:
        if frequencia == "DIARIA":
            data_atual += timedelta(days=1)
        elif frequencia == "SEMANAL":
            data_atual += timedelta(weeks=1)
        elif frequencia == "QUINZENAL":
            data_atual += timedelta(weeks=2)
        elif frequencia == "MENSAL":
            # Manter o mesmo dia do mês da data_inicio
            if data_atual.month == 12:
                nova_data = date(data_atual.year + 1, 1, data_inicio.day)
            else:
                try:
                    nova_data = date(data_atual.year, data_atual.month + 1, data_inicio.day)
                except ValueError:
                    # Dia não existe no mês (ex: 31 em fevereiro)
                    ultima_dia_mes = date(data_atual.year, data_atual.month + 1, 1) - timedelta(days=1)
                    nova_data = ultima_dia_mes
            data_atual = nova_data
        elif frequencia == "BIMESTRAL":
            # Avançar 2 meses mantendo o dia
            novo_mes = data_atual.month + 2
            novo_ano = data_atual.year
            if novo_mes > 12:
                novo_mes -= 12
                novo_ano += 1
            try:
                data_atual = date(novo_ano, novo_mes, data_inicio.day)
            except ValueError:
                ultima_dia_mes = date(novo_ano, novo_mes + 1, 1) - timedelta(days=1)
                data_atual = ultima_dia_mes
        elif frequencia == "TRIMESTRAL":
            # Avançar 3 meses mantendo o dia
            novo_mes = data_atual.month + 3
            novo_ano = data_atual.year
            while novo_mes > 12:
                novo_mes -= 12
                novo_ano += 1
            try:
                data_atual = date(novo_ano, novo_mes, data_inicio.day)
            except ValueError:
                ultima_dia_mes = date(novo_ano, novo_mes + 1, 1) - timedelta(days=1)
                data_atual = ultima_dia_mes
        elif frequencia == "SEMESTRAL":
            # Avançar 6 meses mantendo o dia
            novo_mes = data_atual.month + 6
            novo_ano = data_atual.year
            while novo_mes > 12:
                novo_mes -= 12
                novo_ano += 1
            try:
                data_atual = date(novo_ano, novo_mes, data_inicio.day)
            except ValueError:
                ultima_dia_mes = date(novo_ano, novo_mes + 1, 1) - timedelta(days=1)
                data_atual = ultima_dia_mes
        elif frequencia == "ANUAL":
            # Avançar 1 ano mantendo mês e dia
            try:
                data_atual = date(data_atual.year + 1, data_inicio.month, data_inicio.day)
            except ValueError:
                # 29 de fevereiro em ano não bissexto
                data_atual = date(data_atual.year + 1, data_inicio.month, 28)
        else:
            # Fallback para mensal
            data_atual += timedelta(days=30)
    
    return data_atual

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
    transacao_dict = transacao_data.model_dump()
    
    # Se o created_by_name não foi fornecido, usar o nome do usuário atual
    if not transacao_dict.get("created_by_name"):
        transacao_dict["created_by_name"] = current_user.full_name or current_user.email
    
    transacao = TransacaoRecorrente(
        **transacao_dict,
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
        "data_inicio": transacao.data_inicio.isoformat() if transacao.data_inicio else None,
        "data_fim": transacao.data_fim.isoformat() if transacao.data_fim else None,
        "ativa": bool(transacao.ativa),
        "tenant_id": int(transacao.tenant_id),
        "created_at": transacao.created_at.isoformat() if transacao.created_at else None,
        "updated_at": transacao.updated_at.isoformat() if transacao.updated_at else None,
        "created_by_name": transacao.created_by_name,
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
            transacao.frequencia
        )
        
        resultado.append(TransacaoRecorrenteListResponse(
            id=transacao.id,
            descricao=transacao.descricao,
            valor=float(transacao.valor),
            tipo=transacao.tipo,
            frequencia=transacao.frequencia,
            ativa=transacao.ativa,
            categoria_nome=transacao.categoria.nome,
            categoria_icone=transacao.categoria.icone,
            categoria_cor=transacao.categoria.cor,
            forma_pagamento=forma_pagamento,
            proximo_vencimento=proximo_vencimento,
            data_inicio=transacao.data_inicio,
            data_fim=transacao.data_fim,
            icone_personalizado=transacao.icone_personalizado,
            created_by_name=transacao.created_by_name
        ))
    
    return resultado

@router.get("/dashboard/resumo-test", include_in_schema=False)
def get_resumo_test():
    """Endpoint de teste sem autenticação para debug"""
    
    # Retornar dados fixos para teste
    return {
        "total_transacoes": 2,
        "ativas": 2,
        "inativas": 0,
        "valor_mes_entradas": 0,
        "valor_mes_saidas": 320,
        "saldo_mes_estimado": -320,
        "mes_referencia": datetime.now().month,
        "ano_referencia": datetime.now().year
    }

@router.get("/dashboard/resumo")
def get_resumo_transacoes_recorrentes(
    mes: Optional[int] = Query(None, description="Mês para cálculo (1-12), padrão é mês atual"),
    ano: Optional[int] = Query(None, description="Ano para cálculo, padrão é ano atual"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter resumo das transações recorrentes para o mês específico"""
    
    try:
        # Se não especificado, usar mês/ano atual
        hoje = date.today()
        mes_calculo = mes if mes else hoje.month
        ano_calculo = ano if ano else hoje.year
        
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
        
        for transacao in transacoes_ativas:
            try:
                # Verificar se transacao tem data_inicio
                if not transacao.data_inicio:
                    continue
                    
                # Calcular quantas vezes a transação ocorre neste mês específico
                ocorrencias_no_mes = calcular_ocorrencias_no_mes(
                    transacao, inicio_mes, fim_mes
                )
                
                valor_total_no_mes = float(transacao.valor) * ocorrencias_no_mes
                
                if transacao.tipo == "ENTRADA":
                    valor_mes_entradas += valor_total_no_mes
                else:
                    valor_mes_saidas += valor_total_no_mes
                    
            except Exception as e:
                # Ignorar transações com erro de cálculo
                continue
        
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
        
    except Exception as e:
        # Retornar resposta vazia em caso de erro
        return {
            "total_transacoes": 0,
            "ativas": 0,
            "inativas": 0,
            "valor_mes_entradas": 0.0,
            "valor_mes_saidas": 0.0,
            "saldo_mes_estimado": 0.0,
            "mes_referencia": date.today().month,
            "ano_referencia": date.today().year
        }

@router.get("/{transacao_id}")
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
    
    # Retornar resposta com dados serializados manualmente
    return {
        "id": int(transacao.id),
        "descricao": str(transacao.descricao),
        "valor": float(transacao.valor),
        "tipo": str(transacao.tipo),
        "categoria_id": int(transacao.categoria_id),
        "conta_id": int(transacao.conta_id) if transacao.conta_id is not None else None,
        "cartao_id": int(transacao.cartao_id) if transacao.cartao_id is not None else None,
        "frequencia": str(transacao.frequencia),
        "data_inicio": transacao.data_inicio.isoformat() if transacao.data_inicio else None,
        "data_fim": transacao.data_fim.isoformat() if transacao.data_fim else None,
        "ativa": bool(transacao.ativa),
        "tenant_id": int(transacao.tenant_id),
        "created_at": transacao.created_at.isoformat() if transacao.created_at else None,
        "updated_at": transacao.updated_at.isoformat() if transacao.updated_at else None,
        "created_by_name": transacao.created_by_name,
        # Dados relacionados
        "categoria_nome": transacao.categoria.nome if transacao.categoria else None,
        "categoria_icone": transacao.categoria.icone if transacao.categoria else None,
        "categoria_cor": transacao.categoria.cor if transacao.categoria else None,
        "conta_nome": transacao.conta.nome if transacao.conta else None,
        "cartao_nome": transacao.cartao.nome if transacao.cartao else None
    }

@router.put("/{transacao_id}")
def update_transacao_recorrente(
    transacao_id: int,
    transacao_data: TransacaoRecorrenteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Atualizar transação recorrente"""
    
    # Buscar a transação no banco de dados
    transacao = db.query(TransacaoRecorrente).filter(
        TransacaoRecorrente.id == transacao_id,
        TransacaoRecorrente.tenant_id == current_user.tenant_id
    ).first()
    
    if not transacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação recorrente não encontrada"
        )
    
    # Atualizar os campos fornecidos
    for field, value in transacao_data.model_dump(exclude_unset=True).items():
        setattr(transacao, field, value)
    
    # Atualizar data de modificação
    transacao.updated_at = datetime.utcnow()
    
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

# Endpoint especial com CORS explícito para edição
@router.put("/cors/{transacao_id}", include_in_schema=False)
async def update_transacao_recorrente_cors(
    transacao_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Endpoint especial com CORS explícito para atualizar uma transação recorrente"""
    from fastapi.responses import JSONResponse
    import json
    
    try:
        # Obter dados do corpo da requisição
        body_bytes = await request.body()
        body_str = body_bytes.decode('utf-8')
        data = json.loads(body_str)
        
        # Buscar a transação no banco de dados
        transacao = db.query(TransacaoRecorrente).filter(
            TransacaoRecorrente.id == transacao_id,
            TransacaoRecorrente.tenant_id == current_user.tenant_id
        ).first()
        
        if not transacao:
            response = JSONResponse(
                content={"detail": "Transação recorrente não encontrada"},
                status_code=404
            )
        else:
            # Atualizar campos fornecidos
            if "descricao" in data:
                transacao.descricao = data["descricao"]
            if "valor" in data:
                transacao.valor = data["valor"]
            if "tipo" in data:
                transacao.tipo = data["tipo"]
            if "categoria_id" in data:
                transacao.categoria_id = data["categoria_id"]
            if "conta_id" in data:
                transacao.conta_id = data["conta_id"]
            if "cartao_id" in data:
                transacao.cartao_id = data["cartao_id"]
            if "frequencia" in data:
                transacao.frequencia = data["frequencia"]
            if "data_inicio" in data and data["data_inicio"]:
                from datetime import date
                try:
                    transacao.data_inicio = date.fromisoformat(data["data_inicio"].split('T')[0])
                except:
                    pass
            if "data_fim" in data:
                if data["data_fim"]:
                    from datetime import date
                    try:
                        transacao.data_fim = date.fromisoformat(data["data_fim"].split('T')[0])
                    except:
                        pass
                else:
                    transacao.data_fim = None
            if "ativa" in data:
                transacao.ativa = data["ativa"]
            if "icone_personalizado" in data:
                transacao.icone_personalizado = data["icone_personalizado"]
            
            transacao.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(transacao)
            
            # Retorno compatível com PostgreSQL types
            result = {
                "id": int(transacao.id),
                "descricao": str(transacao.descricao),
                "valor": float(transacao.valor) if transacao.valor is not None else 0.0,
                "tipo": str(transacao.tipo),
                "categoria_id": int(transacao.categoria_id),
                "conta_id": int(transacao.conta_id) if transacao.conta_id is not None else None,
                "cartao_id": int(transacao.cartao_id) if transacao.cartao_id is not None else None,
                "frequencia": str(transacao.frequencia),
                "data_inicio": transacao.data_inicio.isoformat() if transacao.data_inicio else None,
                "data_fim": transacao.data_fim.isoformat() if transacao.data_fim else None,
                "ativa": bool(transacao.ativa) if transacao.ativa is not None else True,
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
            response = JSONResponse(content=result)
    except Exception as e:
        response = JSONResponse(
            content={"detail": f"Erro ao atualizar transação: {str(e)}"},
            status_code=500
        )
    
    # Adicionar headers CORS explícitos
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "PUT, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    return response

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
    
    # CORREÇÃO: Sempre começar da data_inicio, nunca antes dela
    data_atual = transacao.data_inicio if transacao.data_inicio else inicio_mes
    
    # Se a data de início é antes do período, avançar até o período
    contador = 0
    while data_atual < inicio_mes and contador < 365:
        contador += 1
        data_atual = calcular_proxima_data_simples(data_atual, transacao.frequencia, transacao.data_inicio)
    
    # Contar ocorrências no período
    ocorrencias = 0
    contador = 0
    while data_atual <= fim_mes and contador < 365:
        contador += 1
        
        # Verificar se está no período E não é antes da data de início
        if (inicio_mes <= data_atual <= fim_mes and 
            data_atual >= transacao.data_inicio):
            ocorrencias += 1
        
        data_atual = calcular_proxima_data_simples(data_atual, transacao.frequencia, transacao.data_inicio)
        
        # Se próxima data passou do período, parar
        if data_atual > fim_mes:
            break
    
    return ocorrencias

def calcular_proxima_data_simples(data_base: date, frequencia: str, data_inicio: date) -> date:
    """Calcular próxima data baseada na frequência, mantendo mesmo dia da data_inicio"""
    if frequencia == "DIARIA":
        return data_base + timedelta(days=1)
    elif frequencia == "SEMANAL":
        return data_base + timedelta(weeks=1)
    elif frequencia == "QUINZENAL":
        return data_base + timedelta(weeks=2)
    elif frequencia == "MENSAL":
        if data_base.month == 12:
            novo_ano = data_base.year + 1
            novo_mes = 1
        else:
            novo_ano = data_base.year
            novo_mes = data_base.month + 1
        try:
            return date(novo_ano, novo_mes, data_inicio.day)
        except ValueError:
            # Dia não existe no mês (ex: 31 em fevereiro)
            ultima_dia_mes = date(novo_ano, novo_mes + 1, 1) - timedelta(days=1)
            return ultima_dia_mes
    elif frequencia == "BIMESTRAL":
        novo_mes = data_base.month + 2
        novo_ano = data_base.year
        if novo_mes > 12:
            novo_mes -= 12
            novo_ano += 1
        try:
            return date(novo_ano, novo_mes, data_inicio.day)
        except ValueError:
            ultima_dia_mes = date(novo_ano, novo_mes + 1, 1) - timedelta(days=1)
            return ultima_dia_mes
    elif frequencia == "TRIMESTRAL":
        novo_mes = data_base.month + 3
        novo_ano = data_base.year
        while novo_mes > 12:
            novo_mes -= 12
            novo_ano += 1
        try:
            return date(novo_ano, novo_mes, data_inicio.day)
        except ValueError:
            ultima_dia_mes = date(novo_ano, novo_mes + 1, 1) - timedelta(days=1)
            return ultima_dia_mes
    elif frequencia == "SEMESTRAL":
        novo_mes = data_base.month + 6
        novo_ano = data_base.year
        while novo_mes > 12:
            novo_mes -= 12
            novo_ano += 1
        try:
            return date(novo_ano, novo_mes, data_inicio.day)
        except ValueError:
            ultima_dia_mes = date(novo_ano, novo_mes + 1, 1) - timedelta(days=1)
            return ultima_dia_mes
    elif frequencia == "ANUAL":
        try:
            return date(data_base.year + 1, data_inicio.month, data_inicio.day)
        except ValueError:
            # 29 de fevereiro em ano não bissexto
            return date(data_base.year + 1, data_inicio.month, 28)
    else:
        return data_base + timedelta(days=30)  # Fallback

def calcular_data_anterior_simples(data_base: date, frequencia: str, data_inicio: date) -> date:
    """Calcular data anterior baseada na frequência, mantendo mesmo dia da data_inicio"""
    if frequencia == "DIARIA":
        return data_base - timedelta(days=1)
    elif frequencia == "SEMANAL":
        return data_base - timedelta(weeks=1)
    elif frequencia == "QUINZENAL":
        return data_base - timedelta(weeks=2)
    elif frequencia == "MENSAL":
        if data_base.month == 1:
            novo_ano = data_base.year - 1
            novo_mes = 12
        else:
            novo_ano = data_base.year
            novo_mes = data_base.month - 1
        try:
            return date(novo_ano, novo_mes, data_inicio.day)
        except ValueError:
            ultima_dia_mes = date(novo_ano, novo_mes + 1, 1) - timedelta(days=1)
            return ultima_dia_mes
    elif frequencia == "BIMESTRAL":
        novo_mes = data_base.month - 2
        novo_ano = data_base.year
        if novo_mes < 1:
            novo_mes += 12
            novo_ano -= 1
        try:
            return date(novo_ano, novo_mes, data_inicio.day)
        except ValueError:
            ultima_dia_mes = date(novo_ano, novo_mes + 1, 1) - timedelta(days=1)
            return ultima_dia_mes
    elif frequencia == "TRIMESTRAL":
        novo_mes = data_base.month - 3
        novo_ano = data_base.year
        if novo_mes < 1:
            novo_mes += 12
            novo_ano -= 1
        try:
            return date(novo_ano, novo_mes, data_inicio.day)
        except ValueError:
            ultima_dia_mes = date(novo_ano, novo_mes + 1, 1) - timedelta(days=1)
            return ultima_dia_mes
    elif frequencia == "SEMESTRAL":
        novo_mes = data_base.month - 6
        novo_ano = data_base.year
        if novo_mes < 1:
            novo_mes += 12
            novo_ano -= 1
        try:
            return date(novo_ano, novo_mes, data_inicio.day)
        except ValueError:
            ultima_dia_mes = date(novo_ano, novo_mes + 1, 1) - timedelta(days=1)
            return ultima_dia_mes
    elif frequencia == "ANUAL":
        try:
            return date(data_base.year - 1, data_inicio.month, data_inicio.day)
        except ValueError:
            return date(data_base.year - 1, data_inicio.month, 28)
    else:
        return data_base - timedelta(days=30)  # Fallback 

# Endpoint especial com CORS explícito para obter detalhes
@router.get("/cors/{transacao_id}", include_in_schema=False)
async def get_transacao_recorrente_cors(
    transacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Endpoint especial com CORS explícito para obter detalhes de uma transação recorrente"""
    from fastapi.responses import JSONResponse
    
    try:
        # Buscar a transação no banco de dados
        transacao = db.query(TransacaoRecorrente).filter(
            TransacaoRecorrente.id == transacao_id,
            TransacaoRecorrente.tenant_id == current_user.tenant_id
        ).first()
        
        if not transacao:
            response = JSONResponse(
                content={"detail": "Transação recorrente não encontrada"},
                status_code=404
            )
        else:
            # Converter para dicionário e serializar datas
            result = {
                "id": int(transacao.id),
                "descricao": str(transacao.descricao),
                "valor": float(transacao.valor) if transacao.valor is not None else 0.0,
                "tipo": str(transacao.tipo),
                "categoria_id": int(transacao.categoria_id),
                "conta_id": int(transacao.conta_id) if transacao.conta_id is not None else None,
                "cartao_id": int(transacao.cartao_id) if transacao.cartao_id is not None else None,
                "frequencia": str(transacao.frequencia),
                "data_inicio": transacao.data_inicio.isoformat() if transacao.data_inicio else None,
                "data_fim": transacao.data_fim.isoformat() if transacao.data_fim else None,
                "ativa": bool(transacao.ativa) if transacao.ativa is not None else True,
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
            response = JSONResponse(content=result)
    except Exception as e:
        response = JSONResponse(
            content={"detail": f"Erro ao buscar transação: {str(e)}"},
            status_code=500
        )
    
    # Adicionar headers CORS explícitos
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    return response 