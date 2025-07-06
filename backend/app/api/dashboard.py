from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract, case, or_
from datetime import datetime, timedelta
from typing import Dict, Any, List
import calendar

from ..database import get_db
from ..models.user import User
from ..models.financial import Transacao, Categoria, Conta, Cartao
from ..models.transacao_recorrente import TransacaoRecorrente
from ..core.security import get_current_user
from ..services.fatura_service import FaturaService
from ..api.cartoes import calcular_fatura_cartao  # Importar função de fatura precisa
from ..models.financiamento import Financiamento, ParcelaFinanciamento, StatusParcela

router = APIRouter(tags=["dashboard"])

@router.get("/charts/overview")
async def get_dashboard_charts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obter dados para gráficos do dashboard"""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário deve estar associado a um tenant"
            )

        # Data atual e intervalos
        hoje = datetime.now().date()
        inicio_mes_atual = hoje.replace(day=1)
        inicio_ano = hoje.replace(month=1, day=1)
        inicio_mes_anterior = (inicio_mes_atual - timedelta(days=1)).replace(day=1)
        fim_mes_anterior = inicio_mes_atual - timedelta(days=1)

        # 1. Transações por mês (últimos 12 meses)
        transacoes_por_mes = []
        for i in range(12):
            data_ref = inicio_mes_atual - timedelta(days=30*i)
            inicio_mes = data_ref.replace(day=1)
            proximo_mes = (inicio_mes + timedelta(days=32)).replace(day=1)
            
            receitas = db.query(func.sum(Transacao.valor)).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.tipo == 'ENTRADA',
                    Transacao.data >= inicio_mes,
                    Transacao.data < proximo_mes
                )
            ).scalar() or 0
            
            despesas = abs(db.query(func.sum(Transacao.valor)).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.tipo == 'SAIDA',
                    Transacao.data >= inicio_mes,
                    Transacao.data < proximo_mes
                )
            ).scalar() or 0)
            
            total_transacoes = db.query(func.count(Transacao.id)).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.data >= inicio_mes,
                    Transacao.data < proximo_mes
                )
            ).scalar() or 0
            
            transacoes_por_mes.append({
                "mes": inicio_mes.strftime("%b/%Y"),
                "mes_completo": inicio_mes.strftime("%B de %Y"),
                "receitas": float(receitas),
                "despesas": float(despesas),
                "saldo": float(receitas - despesas),
                "total_transacoes": total_transacoes
            })
        
        transacoes_por_mes.reverse()  # Ordem cronológica

        # 2. Gastos por categoria (mês atual)
        gastos_categoria = db.query(
            Categoria.nome,
            Categoria.cor,
            Categoria.icone,
            func.sum(func.abs(Transacao.valor)).label('total'),
            func.count(Transacao.id).label('quantidade')
        ).join(
            Transacao, Transacao.categoria_id == Categoria.id
        ).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.tipo == 'SAIDA',
                Transacao.data >= inicio_mes_atual
            )
        ).group_by(
            Categoria.id, Categoria.nome, Categoria.cor, Categoria.icone
        ).order_by(func.sum(func.abs(Transacao.valor)).desc()).all()

        total_gastos = sum(item.total for item in gastos_categoria)
        gastos_categoria_chart = []
        
        for item in gastos_categoria:
            percentual = (item.total / total_gastos * 100) if total_gastos > 0 else 0
            gastos_categoria_chart.append({
                "categoria": item.nome,
                "valor": float(item.total),
                "cor": item.cor,
                "icone": item.icone,
                "percentual": round(percentual, 1),
                "quantidade": item.quantidade
            })

        # 3. Receita vs Despesa (últimos 6 meses)
        receita_despesa = []
        for i in range(6):
            data_ref = inicio_mes_atual - timedelta(days=30*i)
            inicio_mes = data_ref.replace(day=1)
            proximo_mes = (inicio_mes + timedelta(days=32)).replace(day=1)
            
            receitas = db.query(func.sum(Transacao.valor)).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.tipo == 'ENTRADA',
                    Transacao.data >= inicio_mes,
                    Transacao.data < proximo_mes
                )
            ).scalar() or 0
            
            despesas = abs(db.query(func.sum(Transacao.valor)).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.tipo == 'SAIDA',
                    Transacao.data >= inicio_mes,
                    Transacao.data < proximo_mes
                )
            ).scalar() or 0)
            
            receita_despesa.append({
                "mes": inicio_mes.strftime("%b"),
                "receitas": float(receitas),
                "despesas": float(despesas),
                "economia": float(receitas - despesas)
            })
        
        receita_despesa.reverse()

        # 4. Tendência de saldo (últimos 30 dias)
        tendencia_saldo = []
        saldo_inicial = db.query(func.sum(Conta.saldo_inicial)).filter(
            Conta.tenant_id == tenant_id
        ).scalar() or 0
        
        saldo_atual = saldo_inicial
        
        for i in range(30):
            data_dia = hoje - timedelta(days=29-i)
            
            # Movimentações do dia
            movimentacao_dia = db.query(func.sum(Transacao.valor)).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    func.date(Transacao.data) == data_dia
                )
            ).scalar() or 0
            
            saldo_atual += movimentacao_dia
            
            tendencia_saldo.append({
                "data": data_dia.strftime("%d/%m"),
                "data_completa": data_dia.strftime("%d/%m/%Y"),
                "saldo": float(saldo_atual),
                "movimentacao": float(movimentacao_dia)
            })

        # 5. Estatísticas rápidas
        # Top 5 maiores gastos do mês
        maiores_gastos = db.query(
            Transacao.descricao,
            func.abs(Transacao.valor).label('valor_abs'),
            Transacao.valor,
            Categoria.nome.label('categoria'),
            Transacao.data
        ).join(
            Categoria, Transacao.categoria_id == Categoria.id
        ).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.tipo == 'SAIDA',
                Transacao.data >= inicio_mes_atual
            )
        ).order_by(func.abs(Transacao.valor).desc()).limit(5).all()  # Maiores gastos por valor absoluto

        top_gastos = [
            {
                "descricao": gasto.descricao,
                "valor": float(gasto.valor_abs),
                "categoria": gasto.categoria,
                "data": gasto.data.strftime("%d/%m")
            }
            for gasto in maiores_gastos
        ]

        # Gastos totais por dia da semana (não média)
        gastos_semana = db.query(
            extract('dow', Transacao.data).label('dia_semana'),
            func.sum(func.abs(Transacao.valor)).label('total_gastos'),
            func.count(Transacao.id).label('quantidade')
        ).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.tipo == 'SAIDA',
                Transacao.data >= hoje - timedelta(days=90)  # Últimos 3 meses
            )
        ).group_by('dia_semana').all()

        dias_semana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        gastos_por_dia = []
        
        for dia in range(7):
            gasto_info = next((item for item in gastos_semana if item.dia_semana == dia), None)
            total = float(gasto_info.total_gastos) if gasto_info else 0
            quantidade = gasto_info.quantidade if gasto_info else 0
            media = total / quantidade if quantidade > 0 else 0
            
            gastos_por_dia.append({
                "dia": dias_semana[dia],
                "dia_completo": ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dia],
                "total": total,
                "media": round(media, 2),
                "quantidade": quantidade
            })

        # Comparativo com mês anterior
        receitas_mes_atual = db.query(func.sum(Transacao.valor)).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.tipo == 'ENTRADA',
                Transacao.data >= inicio_mes_atual
            )
        ).scalar() or 0

        despesas_mes_atual = abs(db.query(func.sum(Transacao.valor)).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.tipo == 'SAIDA',
                Transacao.data >= inicio_mes_atual
            )
        ).scalar() or 0)

        receitas_mes_anterior = db.query(func.sum(Transacao.valor)).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.tipo == 'ENTRADA',
                Transacao.data >= inicio_mes_anterior,
                Transacao.data <= fim_mes_anterior
            )
        ).scalar() or 0

        despesas_mes_anterior = abs(db.query(func.sum(Transacao.valor)).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.tipo == 'SAIDA',
                Transacao.data >= inicio_mes_anterior,
                Transacao.data <= fim_mes_anterior
            )
        ).scalar() or 0)

        return {
            "transacoes_por_mes": transacoes_por_mes,
            "gastos_por_categoria": gastos_categoria_chart,
            "receita_vs_despesa": receita_despesa,
            "tendencia_saldo": tendencia_saldo,
            "estatisticas": {
                "maiores_gastos_mes": top_gastos,
                "gastos_semana": gastos_por_dia,
                "comparativo_mes_anterior": {
                    "receitas": {
                        "atual": float(receitas_mes_atual),
                        "anterior": float(receitas_mes_anterior),
                        "variacao": round(((receitas_mes_atual - receitas_mes_anterior) / receitas_mes_anterior * 100) if receitas_mes_anterior > 0 else 0, 1)
                    },
                    "despesas": {
                        "atual": float(despesas_mes_atual),
                        "anterior": float(despesas_mes_anterior),
                        "variacao": round(((despesas_mes_atual - despesas_mes_anterior) / despesas_mes_anterior * 100) if despesas_mes_anterior > 0 else 0, 1)
                    }
                }
            },
            "periodo": {
                "mes_atual": inicio_mes_atual.strftime("%B de %Y"),
                "ultimo_update": datetime.now().isoformat()
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao obter dados do dashboard: {str(e)}"
        )

@router.get("/projecoes-futuras")
async def get_projecoes_futuras(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obter projeções financeiras do mês atual e próximo baseadas em transações recorrentes"""
    try:
        # Log início da operação
        inicio_tempo = datetime.now()
        print(f"🚀 Iniciando cálculo de projeções futuras às {inicio_tempo.strftime('%H:%M:%S')}")
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário deve estar associado a um tenant"
            )
        
        hoje = datetime.now().date()
        
        # Mês atual
        inicio_mes = hoje.replace(day=1)
        ultimo_dia = calendar.monthrange(hoje.year, hoje.month)[1]
        fim_mes = hoje.replace(day=ultimo_dia)
        
        # Próximo mês
        if hoje.month == 12:
            proximo_mes = datetime(hoje.year + 1, 1, 1).date()
        else:
            proximo_mes = datetime(hoje.year, hoje.month + 1, 1).date()
        
        ultimo_dia_proximo = calendar.monthrange(proximo_mes.year, proximo_mes.month)[1]
        fim_proximo_mes = proximo_mes.replace(day=ultimo_dia_proximo)
        
        # === MÊS ATUAL ===
        
        # OTIMIZAÇÃO: Usar aggregation ao invés de buscar todas as transações
        print(f"📊 Calculando transações realizadas no mês atual...")
        
        # Receitas realizadas
        realizado_receitas = db.query(func.sum(Transacao.valor)).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.tipo == 'ENTRADA',
                Transacao.data >= inicio_mes,
                Transacao.data <= hoje
            )
        ).scalar() or 0
        
        # Despesas realizadas
        realizado_despesas = db.query(func.sum(Transacao.valor)).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.tipo == 'SAIDA',
                Transacao.data >= inicio_mes,
                Transacao.data <= hoje
            )
        ).scalar() or 0
        
        realizado_saldo = realizado_receitas - realizado_despesas
        print(f"✅ Realizadas: R$ {realizado_receitas:,.2f} receitas, R$ {realizado_despesas:,.2f} despesas")
        
        # Transações recorrentes ativas
        print(f"📊 Buscando transações recorrentes ativas...")
        recorrentes_ativas = db.query(TransacaoRecorrente).filter(
            and_(
                TransacaoRecorrente.tenant_id == tenant_id,
                TransacaoRecorrente.ativa == True,
                or_(
                    TransacaoRecorrente.data_fim.is_(None),
                    TransacaoRecorrente.data_fim >= hoje
                )
            )
        ).all()
        print(f"✅ Encontradas {len(recorrentes_ativas)} transações recorrentes ativas")
        
        # Calcular ocorrências no restante do mês atual
        pendentes_mes_atual = []
        for recorrente in recorrentes_ativas:
            ocorrencias = _calcular_ocorrencias_periodo(recorrente, hoje + timedelta(days=1), fim_mes)
            for data_ocorrencia in ocorrencias:
                pendentes_mes_atual.append({
                    "descricao": recorrente.descricao,
                    "valor": float(recorrente.valor),
                    "tipo": recorrente.tipo,
                    "data": data_ocorrencia.isoformat(),
                    "categoria_id": recorrente.categoria_id
                })
        
        # Totais projetados do mês atual
        receitas_pendentes = sum(p["valor"] for p in pendentes_mes_atual if p["tipo"] == "ENTRADA")
        despesas_pendentes = sum(p["valor"] for p in pendentes_mes_atual if p["tipo"] == "SAIDA")
        
        projetado_receitas_mes = realizado_receitas + receitas_pendentes
        projetado_despesas_mes = realizado_despesas + despesas_pendentes
        projetado_saldo_mes = projetado_receitas_mes - projetado_despesas_mes
        # === PRÓXIMO MÊS ===
        
        # Calcular todas as ocorrências do próximo mês
        projecoes_proximo_mes = []
        for recorrente in recorrentes_ativas:
            ocorrencias = _calcular_ocorrencias_periodo(recorrente, proximo_mes, fim_proximo_mes)
            for data_ocorrencia in ocorrencias:
                projecoes_proximo_mes.append({
                    "descricao": recorrente.descricao,
                    "valor": float(recorrente.valor),
                    "tipo": recorrente.tipo,
                    "data": data_ocorrencia.isoformat(),
                    "categoria_id": recorrente.categoria_id
                })
        
        receitas_proximo_mes = [p for p in projecoes_proximo_mes if p["tipo"] == "ENTRADA"]
        despesas_proximo_mes = [p for p in projecoes_proximo_mes if p["tipo"] == "SAIDA"]
        
        total_receitas_proximo = sum(r["valor"] for r in receitas_proximo_mes)
        total_despesas_proximo = sum(d["valor"] for d in despesas_proximo_mes)
        saldo_proximo_mes = total_receitas_proximo - total_despesas_proximo
        
        # === TIMELINE SEMANAL ===
        print(f"📊 Gerando timeline semanal...")
        timeline = _gerar_timeline_semanal(
            hoje, fim_mes, realizado_saldo, pendentes_mes_atual
        )
        
        # Log tempo total
        tempo_total = (datetime.now() - inicio_tempo).total_seconds()
        print(f"✅ Projeções futuras calculadas em {tempo_total:.2f}s")
        
        return {
            "mes_atual": {
                "mes": hoje.strftime("%B %Y"),
                "dias_decorridos": (hoje - inicio_mes).days + 1,
                "dias_restantes": (fim_mes - hoje).days,
                "realizado": {
                    "receitas": float(realizado_receitas),
                    "despesas": float(realizado_despesas),
                    "saldo": float(realizado_saldo)
                },
                "projetado": {
                    "receitas": float(projetado_receitas_mes),
                    "despesas": float(projetado_despesas_mes),
                    "saldo": float(projetado_saldo_mes)
                },
                "pendentes": {
                    "receitas": [p for p in pendentes_mes_atual if p["tipo"] == "ENTRADA"],
                    "despesas": [p for p in pendentes_mes_atual if p["tipo"] == "SAIDA"]
                }
            },
            "proximo_mes": {
                "mes": proximo_mes.strftime("%B %Y"),
                "projetado": {
                    "receitas": float(total_receitas_proximo),
                    "despesas": float(total_despesas_proximo),
                    "saldo": float(saldo_proximo_mes)
                },
                "receitas": receitas_proximo_mes,
                "despesas": despesas_proximo_mes
            },
            "timeline": timeline,
            "resumo": {
                "tendencia": "positiva" if projetado_saldo_mes > 0 else "negativa",
                "economia_mes": float(projetado_saldo_mes),
                "media_diaria": float(projetado_saldo_mes / ultimo_dia) if ultimo_dia > 0 else 0,
                "maior_receita_pendente": max([p["valor"] for p in pendentes_mes_atual if p["tipo"] == "ENTRADA"], default=0),
                "maior_despesa_pendente": max([p["valor"] for p in pendentes_mes_atual if p["tipo"] == "SAIDA"], default=0),
                "total_recorrentes_ativas": len(recorrentes_ativas)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao calcular projeções: {str(e)}")

def _calcular_ocorrencias_periodo(recorrente: TransacaoRecorrente, inicio: datetime.date, fim: datetime.date) -> List[datetime.date]:
    """Calcular datas de ocorrência de uma recorrente em um período específico"""
    ocorrencias = []
    
    # Se a data de início é depois do fim do período, não há ocorrências
    if recorrente.data_inicio > fim:
        return ocorrencias
    
    # Se tem data de fim e é antes do início do período, não há ocorrências
    if recorrente.data_fim and recorrente.data_fim < inicio:
        return ocorrencias
    
    # Começar da data de início ou do início do período (o que for maior)
    data_atual = max(recorrente.data_inicio, inicio)
    
    # Gerar ocorrências baseadas na frequência
    contador = 0
    while data_atual <= fim and contador < 100:  # Limite de segurança
        contador += 1
        
        # Se está no período válido
        if inicio <= data_atual <= fim:
            ocorrencias.append(data_atual)
        
        # Calcular próxima data baseada na frequência
        if recorrente.frequencia == 'DIARIA':
            data_atual += timedelta(days=1)
        elif recorrente.frequencia == 'SEMANAL':
            data_atual += timedelta(weeks=1)
        elif recorrente.frequencia == 'QUINZENAL':
            data_atual += timedelta(weeks=2)
        elif recorrente.frequencia == 'MENSAL':
            # Avançar um mês mantendo o mesmo dia
            if data_atual.month == 12:
                novo_ano = data_atual.year + 1
                novo_mes = 1
            else:
                novo_ano = data_atual.year
                novo_mes = data_atual.month + 1
            
            try:
                data_atual = data_atual.replace(year=novo_ano, month=novo_mes)
            except ValueError:
                # Dia não existe no mês (ex: 31 em fevereiro)
                ultimo_dia_mes = calendar.monthrange(novo_ano, novo_mes)[1]
                data_atual = data_atual.replace(year=novo_ano, month=novo_mes, day=ultimo_dia_mes)
        elif recorrente.frequencia == 'TRIMESTRAL':
            # Avançar 3 meses
            novo_mes = data_atual.month + 3
            novo_ano = data_atual.year
            while novo_mes > 12:
                novo_mes -= 12
                novo_ano += 1
            
            try:
                data_atual = data_atual.replace(year=novo_ano, month=novo_mes)
            except ValueError:
                ultimo_dia_mes = calendar.monthrange(novo_ano, novo_mes)[1]
                data_atual = data_atual.replace(year=novo_ano, month=novo_mes, day=ultimo_dia_mes)
        else:
            # Para outras frequências, avançar um mês como fallback
            if data_atual.month == 12:
                data_atual = data_atual.replace(year=data_atual.year + 1, month=1)
            else:
                data_atual = data_atual.replace(month=data_atual.month + 1)
    
    return ocorrencias

def _gerar_timeline_semanal(
    hoje: datetime.date, 
    fim_mes: datetime.date, 
    saldo_inicial: float,
    pendentes: List[Dict]
) -> List[Dict]:
    """Gerar timeline semanal do saldo projetado"""
    timeline = []
    saldo_atual = saldo_inicial
    data_atual = hoje + timedelta(days=1)  # Começar de amanhã
    
    while data_atual <= fim_mes:
        fim_semana = min(data_atual + timedelta(days=6), fim_mes)
        
        # Movimentações da semana
        receitas_semana = sum(
            p["valor"] for p in pendentes 
            if p["tipo"] == "ENTRADA" and data_atual <= datetime.fromisoformat(p["data"]).date() <= fim_semana
        )
        despesas_semana = sum(
            p["valor"] for p in pendentes 
            if p["tipo"] == "SAIDA" and data_atual <= datetime.fromisoformat(p["data"]).date() <= fim_semana
        )
        
        saldo_atual += receitas_semana - despesas_semana
        
        timeline.append({
            "periodo": f"{data_atual.strftime('%d/%m')} - {fim_semana.strftime('%d/%m')}",
            "saldo": float(saldo_atual),
            "receitas": float(receitas_semana),
            "despesas": float(despesas_semana),
            "variacao": float(receitas_semana - despesas_semana)
        })
        
        data_atual = fim_semana + timedelta(days=1)
    
    return timeline 

@router.get("/projecoes-6-meses")
async def get_projecoes_proximos_6_meses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Versão simplificada das projeções de 6 meses"""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário deve estar associado a um tenant"
            )
        
        hoje = datetime.now().date()
        
        # Buscar transações recorrentes ativas (versão simplificada)
        recorrentes_ativas = db.query(TransacaoRecorrente).filter(
            and_(
                TransacaoRecorrente.tenant_id == tenant_id,
                TransacaoRecorrente.ativa == True,
                or_(
                    TransacaoRecorrente.data_fim.is_(None),
                    TransacaoRecorrente.data_fim >= hoje
                )
            )
        ).all()
        
        print(f"🔍 Encontradas {len(recorrentes_ativas)} transações recorrentes ativas")
        
        # Calcular saldo atual das contas
        saldo_atual = db.query(func.sum(Conta.saldo_inicial)).filter(
            Conta.tenant_id == tenant_id
        ).scalar() or 0
        
        # Criar projeções simples para 6 meses
        projecoes = []
        
        for i in range(6):
            # Calcular mês
            mes_atual = hoje.month
            ano_atual = hoje.year
            novo_mes = mes_atual + i
            novo_ano = ano_atual
            
            while novo_mes > 12:
                novo_mes -= 12
                novo_ano += 1
            
            data_mes = datetime(novo_ano, novo_mes, 1).date()
            
            # Calcular receitas e despesas recorrentes simples
            receitas_mes = sum(
                float(r.valor) for r in recorrentes_ativas 
                if r.tipo == 'ENTRADA'
            )
            
            despesas_mes = sum(
                float(r.valor) for r in recorrentes_ativas 
                if r.tipo == 'SAIDA'
            )
            
            saldo_mes = receitas_mes - despesas_mes
            
            projecoes.append({
                "mes": data_mes.strftime("%B %Y"),
                "mes_abrev": data_mes.strftime("%b/%Y"),
                "ano": data_mes.year,
                "mes_numero": data_mes.month,
                "saldo_inicial": 0,
                "receitas": {
                    "reais": 0 if i > 0 else receitas_mes,
                    "recorrentes": receitas_mes,
                    "total": receitas_mes
                },
                "despesas": {
                    "cartoes": 0,
                    "contas": 0,
                    "recorrentes": despesas_mes,
                    "parcelamentos": 0,
                    "financiamentos": 0,
                    "total": despesas_mes
                },
                "saldo_mensal": saldo_mes,
                "saldo_final": saldo_mes,
                "fluxo": {
                    "entrada_liquida": receitas_mes,
                    "saida_liquida": despesas_mes,
                    "resultado_mes": saldo_mes,
                    "saldo_projetado": saldo_mes
                },
                "eh_mes_atual": i == 0,
                "saldo_atual_contas": saldo_atual if i == 0 else 0,
                "total_parcelas": 0,
                "total_financiamentos": 0
            })
        
        return {
            "saldo_atual": float(saldo_atual),
            "total_recorrentes_ativas": len(recorrentes_ativas),
            "projecoes": projecoes,
            "resumo": {
                "menor_saldo": min(p["saldo_final"] for p in projecoes) if projecoes else 0,
                "maior_saldo": max(p["saldo_final"] for p in projecoes) if projecoes else 0,
                "mes_critico": min(projecoes, key=lambda x: x["saldo_final"])["mes"] if projecoes else None,
                "total_financiamentos_6_meses": 0,
                "media_mensal_recorrentes": sum(p["despesas"]["recorrentes"] for p in projecoes) / 6 if projecoes else 0,
                "media_mensal_financiamentos": 0
            },
            "performance": {
                "tempo_calculo_segundos": 0.1,
                "timestamp": datetime.now().isoformat(),
                "versao": "simplificada_v1"
            }
        }
        
    except Exception as e:
        print(f"❌ [ERRO] Projeções 6 meses simplificadas: {str(e)}")
        
        # Retornar resposta básica em caso de erro
        return {
            "saldo_atual": 0.0,
            "total_recorrentes_ativas": 0,
            "projecoes": [],
            "resumo": {
                "menor_saldo": 0,
                "maior_saldo": 0,
                "mes_critico": None,
                "total_financiamentos_6_meses": 0,
                "media_mensal_recorrentes": 0,
                "media_mensal_financiamentos": 0
            },
            "performance": {
                "tempo_calculo_segundos": 0,
                "timestamp": datetime.now().isoformat(),
                "versao": "fallback_erro_simplificada",
                "erro": str(e)
            }
                }
        
    except Exception as e:
        print(f"❌ [ERRO] Projeções 6 meses simplificadas: {str(e)}")
        
        # Retornar resposta básica em caso de erro
        return {
            "saldo_atual": 0.0,
            "total_recorrentes_ativas": 0,
            "projecoes": [],
            "resumo": {
                "menor_saldo": 0,
                "maior_saldo": 0,
                "mes_critico": None,
                "total_financiamentos_6_meses": 0,
                "media_mensal_recorrentes": 0,
                "media_mensal_financiamentos": 0
            },
            "performance": {
                "tempo_calculo_segundos": 0,
                "timestamp": datetime.now().isoformat(),
                "versao": "fallback_erro_simplificada",
                "erro": str(e)
            }
        }


@router.get("/projecoes-6-meses/teste")
async def test_projecoes_6_meses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Endpoint de teste simplificado para verificar se a API está funcionando"""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário deve estar associado a um tenant"
            )
        
        hoje = datetime.now().date()
        
        # Teste básico de conectividade
        contas_count = db.query(func.count(Conta.id)).filter(Conta.tenant_id == tenant_id).scalar() or 0
        cartoes_count = db.query(func.count(Cartao.id)).filter(Cartao.tenant_id == tenant_id).scalar() or 0
        recorrentes_count = db.query(func.count(TransacaoRecorrente.id)).filter(TransacaoRecorrente.tenant_id == tenant_id).scalar() or 0
        
        return {
            "status": "ok",
            "tenant_id": tenant_id,
            "data_teste": hoje.isoformat(),
            "contas": contas_count,
            "cartoes": cartoes_count,
            "recorrentes": recorrentes_count,
            "mensagem": "API de projeções funcionando corretamente"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no teste: {str(e)}")


@router.get("/projecoes-6-meses/detalhes/{mes}/{ano}")
async def get_detalhes_projecao_mes(
    mes: int,
    ano: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Versão simplificada dos detalhes do mês"""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário deve estar associado a um tenant"
            )
        
        # Validar parâmetros
        if mes < 1 or mes > 12:
            raise HTTPException(status_code=400, detail="Mês deve estar entre 1 e 12")
        
        today = datetime.now().date()
        data_mes = datetime(ano, mes, 1).date()
        
        # Buscar transações recorrentes ativas
        recorrentes_ativas = db.query(TransacaoRecorrente).filter(
            and_(
                TransacaoRecorrente.tenant_id == tenant_id,
                TransacaoRecorrente.ativa == True,
                or_(
                    TransacaoRecorrente.data_fim.is_(None),
                    TransacaoRecorrente.data_fim >= today
                )
            )
        ).all()
        
        # Buscar cartões ativos para calcular faturas
        cartoes = db.query(Cartao).filter(
            and_(
                Cartao.tenant_id == tenant_id,
                Cartao.ativo == True
            )
        ).all()
        
        # Separar receitas e despesas
        receitas = []
        despesas = []
        
        # 1. RECEITAS E DESPESAS RECORRENTES
        for recorrente in recorrentes_ativas:
            if recorrente.tipo == "ENTRADA":
                receitas.append({
                    "id": f"rec_{recorrente.id}",
                    "descricao": recorrente.descricao,
                    "valor": float(recorrente.valor),
                    "data": data_mes.isoformat(),
                    "categoria": recorrente.categoria.nome if recorrente.categoria else "Sem categoria",
                    "conta": recorrente.conta.nome if recorrente.conta else "Sem conta",
                    "tipo_transacao": "recorrente",
                    "frequencia": recorrente.frequencia
                })
            else:  # SAIDA
                despesas.append({
                    "id": f"rec_{recorrente.id}",
                    "descricao": recorrente.descricao,
                    "valor": float(recorrente.valor),
                    "data": data_mes.isoformat(),
                    "categoria": recorrente.categoria.nome if recorrente.categoria else "Sem categoria",
                    "conta": recorrente.conta.nome if recorrente.conta else "Sem conta",
                    "tipo_transacao": "recorrente",
                    "frequencia": recorrente.frequencia
                })
        
        # 2. FATURAS DOS CARTÕES QUE VENCEM NESTE MÊS
        eh_mes_atual = (ano == today.year and mes == today.month)
        
        for cartao in cartoes:
            try:
                # Verificar se o cartão tem dia de vencimento configurado
                if not cartao.dia_vencimento:
                    continue
                
                # Verificar se a fatura vence neste mês
                try:
                    data_vencimento = datetime(ano, mes, cartao.dia_vencimento).date()
                except ValueError:
                    # Dia inválido para o mês (ex: 31 em fevereiro)
                    continue
                
                # LÓGICA CORRETA: Para mês atual, só incluir faturas que ainda não venceram
                if eh_mes_atual and data_vencimento <= today:
                    print(f"⏭️  Fatura {cartao.nome} venceu dia {data_vencimento.strftime('%d/%m')} - não incluir")
                    continue
                
                # Calcular período da fatura (baseado no dia de fechamento)
                dia_fechamento = cartao.dia_fechamento or (cartao.dia_vencimento - 7)  # Padrão: 7 dias antes do vencimento
                
                # PERÍODO DA FATURA: Gastos do período anterior que viram fatura neste mês
                # Ex: Fatura que vence em Jan/15 = gastos de Dez/16 até Jan/15
                if mes == 1:
                    # Janeiro: dezembro do ano anterior
                    try:
                        inicio_periodo = datetime(ano - 1, 12, dia_fechamento + 1).date()
                        fim_periodo = datetime(ano, 1, dia_fechamento).date()
                    except ValueError:
                        continue
                else:
                    # Outros meses: mês anterior até fechamento atual
                    try:
                        inicio_periodo = datetime(ano, mes - 1, dia_fechamento + 1).date()
                        fim_periodo = datetime(ano, mes, dia_fechamento).date()
                    except ValueError:
                        continue
                
                # Para meses futuros: calcular fatura completa
                # Para mês atual: apenas gastos até hoje
                if eh_mes_atual:
                    fim_busca = min(fim_periodo, today)
                else:
                    fim_busca = fim_periodo
                
                # Buscar transações do cartão no período da fatura
                transacoes_fatura = db.query(Transacao).filter(
                    and_(
                        Transacao.tenant_id == tenant_id,
                        Transacao.tipo == 'SAIDA',
                        Transacao.cartao_id == cartao.id,
                        Transacao.data >= inicio_periodo,
                        Transacao.data <= fim_busca
                    )
                ).all()
                
                # Calcular valor total da fatura
                valor_fatura = sum(float(t.valor) for t in transacoes_fatura)
                
                # Se há valor na fatura, adicionar como despesa
                if valor_fatura > 0:
                    status_fatura = "A vencer" if data_vencimento > today else "Vencida"
                    
                    despesas.append({
                        "id": f"fatura_{cartao.id}",
                        "descricao": f"Fatura {cartao.nome} (vence {data_vencimento.strftime('%d/%m')})",
                        "valor": valor_fatura,
                        "data": data_vencimento.isoformat(),
                        "categoria": "Fatura Cartão",
                        "conta": f"Cartão {cartao.nome}",
                        "tipo_transacao": "fatura_cartao",
                        "cartao": cartao.nome,
                        "data_vencimento": data_vencimento.isoformat(),
                        "periodo_fatura": f"{inicio_periodo.strftime('%d/%m')} a {fim_periodo.strftime('%d/%m')}",
                        "total_transacoes": len(transacoes_fatura),
                        "status": status_fatura,
                        "dias_para_vencimento": (data_vencimento - today).days
                    })
                    
                    print(f"💳 Fatura {cartao.nome} vence {data_vencimento.strftime('%d/%m')}: R$ {valor_fatura:,.2f} ({len(transacoes_fatura)} transações)")
                
            except Exception as e:
                print(f"❌ Erro ao calcular fatura do cartão {cartao.nome}: {e}")
                continue
        
        # Calcular totais
        total_receitas = sum(r["valor"] for r in receitas)
        total_despesas = sum(d["valor"] for d in despesas)
        saldo_mes = total_receitas - total_despesas
        
        return {
            "mes": data_mes.strftime("%B %Y"),
            "mes_abrev": data_mes.strftime("%b/%Y"),
            "ano": ano,
            "mes_numero": mes,
            "eh_mes_atual": data_mes.year == today.year and data_mes.month == today.month,
            "periodo": {
                "inicio": data_mes.isoformat(),
                "fim": data_mes.isoformat()
            },
            "resumo_financeiro": {
                "total_receitas": float(total_receitas),
                "total_despesas": float(total_despesas),
                "saldo_mes": float(saldo_mes)
            },
            "receitas": receitas,
            "despesas": despesas,
            "receitas_detalhadas": {
                "total": float(total_receitas),
                "reais": {"total": 0, "transacoes": []},
                "recorrentes": {"total": float(total_receitas), "transacoes": receitas}
            },
            "despesas_detalhadas": {
                "total": float(total_despesas),
                "faturas_cartao": {
                    "total": float(sum(d["valor"] for d in despesas if d["tipo_transacao"] == "fatura_cartao")),
                    "transacoes": [d for d in despesas if d["tipo_transacao"] == "fatura_cartao"]
                },
                "reais_conta": {"total": 0, "transacoes": []},
                "recorrentes": {
                    "total": float(sum(d["valor"] for d in despesas if d["tipo_transacao"] == "recorrente")),
                    "transacoes": [d for d in despesas if d["tipo_transacao"] == "recorrente"]
                },
                "parcelamentos": {"total": 0, "transacoes": []},
                "financiamentos": {"total": 0, "transacoes": []}
            },
            "estatisticas": {
                "total_transacoes": len(receitas) + len(despesas),
                "transacoes_reais": 0,
                "transacoes_previstas": len(receitas) + len(despesas)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro simples: {str(e)}")
        return {
            "mes": f"{mes}/{ano}",
            "receitas": [],
            "despesas": [],
            "resumo_financeiro": {"total_receitas": 0, "total_despesas": 0, "saldo_mes": 0}
        }


@router.get("/projecoes-6-meses/debug")
async def debug_projecoes_6_meses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Debug endpoint para verificar dados básicos"""
    try:
        tenant_id = current_user.tenant_id
        hoje = datetime.now().date()
        
        # Verificar transações recorrentes
        recorrentes = db.query(TransacaoRecorrente).filter(
            TransacaoRecorrente.tenant_id == tenant_id
        ).all()
        
        recorrentes_ativas = db.query(TransacaoRecorrente).filter(
            and_(
                TransacaoRecorrente.tenant_id == tenant_id,
                TransacaoRecorrente.ativa == True,
                or_(
                    TransacaoRecorrente.data_fim.is_(None),
                    TransacaoRecorrente.data_fim >= hoje
                )
            )
        ).all()
        
        # Verificar cartões
        cartoes = db.query(Cartao).filter(
            Cartao.tenant_id == tenant_id
        ).all()
        
        # Verificar transações recentes
        transacoes_recentes = db.query(Transacao).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.data >= hoje - timedelta(days=30)
            )
        ).limit(10).all()
        
        # Verificar contas
        contas = db.query(Conta).filter(
            Conta.tenant_id == tenant_id
        ).all()
        
        return {
            "tenant_id": tenant_id,
            "hoje": hoje.isoformat(),
            "recorrentes": {
                "total": len(recorrentes),
                "ativas": len(recorrentes_ativas),
                "detalhes": [
                    {
                        "id": r.id,
                        "descricao": r.descricao,
                        "valor": float(r.valor),
                        "tipo": r.tipo,
                        "ativa": r.ativa,
                        "frequencia": r.frequencia,
                        "data_inicio": r.data_inicio.isoformat() if r.data_inicio else None,
                        "data_fim": r.data_fim.isoformat() if r.data_fim else None
                    } for r in recorrentes_ativas
                ]
            },
            "cartoes": {
                "total": len(cartoes),
                "detalhes": [
                    {
                        "id": c.id,
                        "nome": c.nome,
                        "ativo": c.ativo,
                        "dia_vencimento": c.dia_vencimento,
                        "dia_fechamento": c.dia_fechamento
                    } for c in cartoes
                ]
            },
            "contas": {
                "total": len(contas),
                "saldo_total": sum(float(c.saldo_inicial) for c in contas),
                "detalhes": [
                    {
                        "id": c.id,
                        "nome": c.nome,
                        "saldo_inicial": float(c.saldo_inicial)
                    } for c in contas
                ]
            },
            "transacoes_recentes": {
                "total": len(transacoes_recentes),
                "detalhes": [
                    {
                        "id": t.id,
                        "descricao": t.descricao,
                        "valor": float(t.valor),
                        "tipo": t.tipo,
                        "data": t.data.isoformat(),
                        "cartao_id": t.cartao_id,
                        "conta_id": t.conta_id
                    } for t in transacoes_recentes
                ]
            }
        }
        
    except Exception as e:
        print(f"Erro no debug: {e}")
        return {"erro": str(e)}
    """Debug endpoint para verificar dados coletados na projeção de 6 meses"""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário deve estar associado a um tenant"
            )
        
        from ..models.financial import CompraParcelada, ParcelaCartao
        from ..services.fatura_service import FaturaService
        
        hoje = datetime.now().date()
        primeiro_dia_mes_atual = hoje.replace(day=1)
        
        # === DEBUG: SALDO INICIAL ===
        contas = db.query(Conta).filter(Conta.tenant_id == tenant_id).all()
        debug_contas = []
        saldo_inicial_total = 0
        
        for conta in contas:
            total_entradas = db.query(func.sum(Transacao.valor)).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.conta_id == conta.id,
                    Transacao.tipo == 'ENTRADA',
                    Transacao.data < primeiro_dia_mes_atual
                )
            ).scalar() or 0
            
            total_saidas = db.query(func.sum(Transacao.valor)).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.conta_id == conta.id,
                    Transacao.tipo == 'SAIDA',
                    Transacao.data < primeiro_dia_mes_atual
                )
            ).scalar() or 0
            
            saldo_conta = conta.saldo_inicial + total_entradas - total_saidas
            saldo_inicial_total += saldo_conta
            
            debug_contas.append({
                "id": conta.id,
                "nome": conta.nome,
                "saldo_inicial": float(conta.saldo_inicial),
                "total_entradas_historico": float(total_entradas),
                "total_saidas_historico": float(total_saidas),
                "saldo_atual_calculado": float(saldo_conta)
            })
        
        # === DEBUG: CARTÕES ===
        cartoes = db.query(Cartao).filter(
            and_(
                Cartao.tenant_id == tenant_id,
                Cartao.ativo == True
            )
        ).all()
        
        debug_cartoes = []
        for cartao in cartoes:
            # Calcular fatura atual
            hoje_datetime = datetime.combine(hoje, datetime.min.time())
            inicio_periodo, fim_periodo = FaturaService.calcular_periodo_fatura(cartao, hoje_datetime)
            dia_fechamento = cartao.dia_fechamento or (cartao.vencimento - 5 if cartao.vencimento and cartao.vencimento > 5 else 25)
            
            if hoje.day <= dia_fechamento:
                inicio_busca = inicio_periodo
                fim_busca = hoje
            else:
                inicio_busca = inicio_periodo  
                fim_busca = fim_periodo
            
            gastos_cartao = db.query(func.sum(Transacao.valor)).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.cartao_id == cartao.id,
                    Transacao.tipo == 'SAIDA',
                    Transacao.data >= inicio_busca,
                    Transacao.data <= fim_busca
                )
            ).scalar() or 0
            
            # Contar transações
            count_transacoes = db.query(func.count(Transacao.id)).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.cartao_id == cartao.id,
                    Transacao.tipo == 'SAIDA',
                    Transacao.data >= inicio_busca,
                    Transacao.data <= fim_busca
                )
            ).scalar() or 0
            
            debug_cartoes.append({
                "id": cartao.id,
                "nome": cartao.nome,
                "dia_fechamento": cartao.dia_fechamento,
                "vencimento": cartao.vencimento,
                "periodo_fatura": {
                    "inicio": inicio_periodo.isoformat(),
                    "fim": fim_periodo.isoformat(),
                    "inicio_busca": inicio_busca.isoformat(),
                    "fim_busca": fim_busca.isoformat()
                },
                "fatura_atual": float(gastos_cartao),
                "total_transacoes": count_transacoes
            })
        
        # === DEBUG: TRANSAÇÕES RECORRENTES ===
        recorrentes_ativas = db.query(TransacaoRecorrente).filter(
            and_(
                TransacaoRecorrente.tenant_id == tenant_id,
                TransacaoRecorrente.ativa == True,
                or_(
                    TransacaoRecorrente.data_fim.is_(None),
                    TransacaoRecorrente.data_fim >= hoje
                )
            )
        ).all()
        
        debug_recorrentes = []
        for recorrente in recorrentes_ativas:
            debug_recorrentes.append({
                "id": recorrente.id,
                "descricao": recorrente.descricao,
                "tipo": recorrente.tipo,
                "valor": float(recorrente.valor),
                "frequencia": recorrente.frequencia,
                "data_inicio": recorrente.data_inicio.isoformat(),
                "data_fim": recorrente.data_fim.isoformat() if recorrente.data_fim else None,
                "conta_id": recorrente.conta_id,
                "cartao_id": recorrente.cartao_id,
                "categoria": recorrente.categoria.nome if recorrente.categoria else None
            })
        
        # === DEBUG: PARCELAMENTOS ===
        # Próximos 6 meses de parcelas
        fim_6_meses = hoje.replace(day=1) + timedelta(days=32*6)
        parcelas_futuras = db.query(ParcelaCartao).join(CompraParcelada).filter(
            and_(
                CompraParcelada.tenant_id == tenant_id,
                CompraParcelada.status == "ativa",
                ParcelaCartao.paga == False,
                ParcelaCartao.data_vencimento >= hoje,
                ParcelaCartao.data_vencimento <= fim_6_meses
            )
        ).all()
        
        debug_parcelas = []
        for parcela in parcelas_futuras:
            debug_parcelas.append({
                "id": parcela.id,
                "compra_id": parcela.compra_parcelada.id,
                "descricao": parcela.compra_parcelada.descricao,
                "valor": float(parcela.valor),
                "numero_parcela": parcela.numero_parcela,
                "total_parcelas": parcela.compra_parcelada.total_parcelas,
                "data_vencimento": parcela.data_vencimento.isoformat(),
                "cartao": parcela.compra_parcelada.cartao.nome,
                "mes_vencimento": parcela.data_vencimento.month,
                "ano_vencimento": parcela.data_vencimento.year
            })
        
        # === DEBUG: MÊS ATUAL - TRANSAÇÕES REAIS ===
        receitas_mes_atual = db.query(Transacao).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.tipo == 'ENTRADA',
                Transacao.data >= primeiro_dia_mes_atual,
                Transacao.data <= hoje
            )
        ).all()
        
        despesas_mes_atual = db.query(Transacao).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.tipo == 'SAIDA',
                Transacao.data >= primeiro_dia_mes_atual,
                Transacao.data <= hoje
            )
        ).all()
        
        debug_transacoes_mes = {
            "receitas": [
                {
                    "id": t.id,
                    "descricao": t.descricao,
                    "valor": float(t.valor),
                    "data": t.data.isoformat(),
                    "conta": t.conta.nome if t.conta else None,
                    "categoria": t.categoria.nome if t.categoria else None
                }
                for t in receitas_mes_atual
            ],
            "despesas": [
                {
                    "id": t.id,
                    "descricao": t.descricao,
                    "valor": float(t.valor),
                    "data": t.data.isoformat(),
                    "conta": t.conta.nome if t.conta else None,
                    "cartao": t.cartao.nome if t.cartao else None,
                    "categoria": t.categoria.nome if t.categoria else None
                }
                for t in despesas_mes_atual
            ]
        }
        
        return {
            "data_debug": hoje.isoformat(),
            "periodo_mes_atual": {
                "inicio": primeiro_dia_mes_atual.isoformat(),
                "hoje": hoje.isoformat()
            },
            "saldo_inicial": {
                "total": float(saldo_inicial_total),
                "contas": debug_contas
            },
            "cartoes": debug_cartoes,
            "transacoes_recorrentes": {
                "total_ativas": len(debug_recorrentes),
                "receitas": [r for r in debug_recorrentes if r["tipo"] == "ENTRADA"],
                "despesas": [r for r in debug_recorrentes if r["tipo"] == "SAIDA"]
            },
            "parcelamentos": {
                "total_parcelas_futuras": len(debug_parcelas),
                "parcelas_por_mes": {
                    f"{p['mes_vencimento']}/{p['ano_vencimento']}": len([x for x in debug_parcelas if x['mes_vencimento'] == p['mes_vencimento'] and x['ano_vencimento'] == p['ano_vencimento']])
                    for p in debug_parcelas
                },
                "detalhes": debug_parcelas
            },
            "transacoes_mes_atual": {
                "total_receitas": len(debug_transacoes_mes["receitas"]),
                "total_despesas": len(debug_transacoes_mes["despesas"]),
                "valor_receitas": sum(t["valor"] for t in debug_transacoes_mes["receitas"]),
                "valor_despesas": sum(t["valor"] for t in debug_transacoes_mes["despesas"]),
                "detalhes": debug_transacoes_mes
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no debug: {str(e)}") 
