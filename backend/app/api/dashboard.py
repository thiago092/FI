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
                TransacaoRecorrente.ativo == True,
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
    """Obter visão panorâmica dos próximos 6 meses - cada mês é independente, não acumula saldo"""
    try:
        # Log início da operação
        inicio_tempo = datetime.now()
        print(f"🚀 [PANORÂMICA] Iniciando cálculo de projeções 6 meses às {inicio_tempo.strftime('%H:%M:%S')} - Meses independentes")
        print(f"💡 NOVA LÓGICA: Faturas baseadas no mês de vencimento (não no mês de consumo)")
        
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário deve estar associado a um tenant"
            )
        
        # Timeout de segurança - retornar dados básicos se demorar muito
        timeout_segundos = 30
        if (datetime.now() - inicio_tempo).total_seconds() > timeout_segundos:
            print(f"⚠️  Timeout de {timeout_segundos}s atingido - retornando dados básicos")
            return {
                "saldo_atual": 0.0,
                "total_recorrentes_ativas": 0,
                "projecoes": [],
                "resumo": {
                    "menor_saldo": 0,
                    "maior_saldo": 0,
                    "mes_critico": None,
                    "total_financiamentos_6_meses": 0,
                    "media_mensal_recorrentes": 0
                },
                "performance": {
                    "tempo_calculo_segundos": timeout_segundos,
                    "timestamp": datetime.now().isoformat(),
                    "versao": "timeout_fallback_panoramica"
                }
            }
        
        # Importar modelos de parcelamento e FaturaService
        from ..models.financial import CompraParcelada, ParcelaCartao
        from ..services.fatura_service import FaturaService
        
        hoje = datetime.now().date()
        primeiro_dia_mes_atual = hoje.replace(day=1)
        
        # OTIMIZAÇÃO: Calcular saldo inicial com queries mais eficientes
        # Saldo inicial das contas
        saldo_inicial = db.query(func.sum(Conta.saldo_inicial)).filter(
            Conta.tenant_id == tenant_id
        ).scalar() or 0
        
        # Movimentações até o mês anterior (uma query só)
        movimentacoes_ate_mes_anterior = db.query(
            func.sum(case(
                (Transacao.tipo == 'ENTRADA', Transacao.valor),
                else_=-Transacao.valor
            ))
        ).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.data < primeiro_dia_mes_atual
            )
        ).scalar() or 0
        
        saldo_inicial += movimentacoes_ate_mes_anterior
        
        # Obter cartões para usar nas projeções
        cartoes = db.query(Cartao).filter(
            and_(
                Cartao.tenant_id == tenant_id,
                Cartao.ativo == True
            )
        ).all()
        
        # CORREÇÃO: Não subtrair faturas do saldo inicial
        # O saldo inicial deve ser apenas o dinheiro real nas contas
        # As faturas serão consideradas como despesas na projeção
        
        # Obter transações recorrentes ativas
        recorrentes_ativas = db.query(TransacaoRecorrente).filter(
            and_(
                TransacaoRecorrente.tenant_id == tenant_id,
                TransacaoRecorrente.ativo == True,
                or_(
                    TransacaoRecorrente.data_fim.is_(None),
                    TransacaoRecorrente.data_fim >= hoje
                )
            )
        ).all()
        
        print(f"🔄 Total recorrentes ativas encontradas: {len(recorrentes_ativas)}")
        for r in recorrentes_ativas:
            print(f"   - {r.descricao}: R$ {r.valor} ({r.tipo}) - {r.frequencia}")
        
        # Gerar projeções para os próximos 6 meses (sempre começando do mês atual)
        projecoes_meses = []
        
        for i in range(6):
            # Calcular data do mês - CORREÇÃO: usar dateutil para cálculo correto
            if i == 0:
                data_mes = hoje.replace(day=1)  # Mês atual
            else:
                # Adicionar meses corretamente
                mes_atual = hoje.month
                ano_atual = hoje.year
                novo_mes = mes_atual + i
                novo_ano = ano_atual
                
                while novo_mes > 12:
                    novo_mes -= 12
                    novo_ano += 1
                
                data_mes = datetime(novo_ano, novo_mes, 1).date()
            
            # Último dia do mês
            if data_mes.month == 12:
                ultimo_dia = data_mes.replace(year=data_mes.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                ultimo_dia = data_mes.replace(month=data_mes.month + 1, day=1) - timedelta(days=1)
            
            # === RECEITAS ===
            receitas_reais = 0
            receitas_recorrentes = 0
            
            # Para o primeiro mês (atual), incluir receitas reais já executadas
            if i == 0:
                # Mês atual - incluir receitas já realizadas
                receitas_reais = db.query(func.sum(Transacao.valor)).filter(
                    and_(
                        Transacao.tenant_id == tenant_id,
                        Transacao.tipo == 'ENTRADA',
                        Transacao.data >= data_mes,
                        Transacao.data <= hoje
                    )
                ).scalar() or 0
            
            # Calcular transações recorrentes de receita para este mês
            for recorrente in recorrentes_ativas:
                if recorrente.tipo == "ENTRADA":
                    ocorrencias = _calcular_ocorrencias_periodo(recorrente, data_mes, ultimo_dia)
                    print(f"   📈 Receita {recorrente.descricao}: {len(ocorrencias)} ocorrências em {data_mes.strftime('%B %Y')}")
                    
                    if i == 0:  # Mês atual - só incluir ocorrências futuras (que ainda vão "cair")
                        # Filtrar apenas ocorrências que ainda não aconteceram
                        ocorrencias_futuras = [data_ocor for data_ocor in ocorrencias if data_ocor > hoje]
                        valor_total_mes = len(ocorrencias_futuras) * float(recorrente.valor)
                        print(f"      Mês atual: {len(ocorrencias)} total, {len(ocorrencias_futuras)} futuras = R$ {valor_total_mes}")
                    else:  # Meses futuros - incluir todas as ocorrências
                        valor_total_mes = len(ocorrencias) * float(recorrente.valor)
                        print(f"      Mês futuro: {len(ocorrencias)} ocorrências = R$ {valor_total_mes}")
                    
                    receitas_recorrentes += valor_total_mes
            
            # === DESPESAS ===
            despesas_cartoes_fatura = 0    # Faturas reais dos cartões (transações já feitas)
            despesas_cartoes_recorrentes = 0  # Recorrentes previstas para cartões
            despesas_cartoes_parcelas = 0
            despesas_contas = 0               # Gastos diretos das contas (débito, PIX, etc)
            despesas_recorrentes = 0          # Recorrentes sem conta/cartão específico
            despesas_financiamentos = 0       # NOVO: Parcelas de financiamentos
            
            # 1. LÓGICA SIMPLIFICADA: Faturas de cartão (temporariamente simplificada para evitar erros)
            despesas_cartoes_fatura = 0
            
            # TEMPORÁRIO: Usar lógica simples até resolver problemas
            if i == 0:  # Apenas mês atual por enquanto
                # Buscar gastos de cartão já realizados neste mês
                despesas_cartoes_fatura = db.query(func.sum(func.abs(Transacao.valor))).filter(
                    and_(
                        Transacao.tenant_id == tenant_id,
                        Transacao.tipo == 'SAIDA',
                        Transacao.cartao_id.isnot(None),
                        Transacao.data >= data_mes,
                        Transacao.data <= hoje
                    )
                ).scalar() or 0
                print(f"   💳 Gastos cartão mês atual: R$ {despesas_cartoes_fatura:,.2f}")
            
            # TODO: Implementar lógica de vencimento correta depois que estiver funcionando
            
            # 2. Calcular transações diretas das contas (débito, PIX, transferência)
            despesas_contas_reais = 0
            if i == 0:  # APENAS mês atual - gastos diretos já executados
                despesas_contas_reais = db.query(func.sum(Transacao.valor)).filter(
                    and_(
                        Transacao.tenant_id == tenant_id,
                        Transacao.tipo == 'SAIDA',
                        Transacao.cartao_id.is_(None),  # APENAS gastos diretos da conta (não cartão)
                        Transacao.data >= data_mes,
                        Transacao.data <= hoje
                    )
                ).scalar() or 0
                print(f"   🏦 Gastos diretos contas (mês atual): R$ {despesas_contas_reais:,.2f}")
            # Meses futuros: NÃO incluir gastos diretos (só recorrentes)
            
            # 3. Calcular transações recorrentes (TODOS os meses)
            for recorrente in recorrentes_ativas:
                if recorrente.tipo == "SAIDA":
                    ocorrencias = _calcular_ocorrencias_periodo(recorrente, data_mes, ultimo_dia)
                    
                    if i == 0:  # Mês atual - só incluir ocorrências futuras (que ainda vão "cair")
                        # Filtrar apenas ocorrências que ainda não aconteceram
                        ocorrencias_futuras = [data_ocor for data_ocor in ocorrencias if data_ocor > hoje]
                        valor_total_mes = len(ocorrencias_futuras) * float(recorrente.valor)
                    else:  # Meses futuros - incluir todas as ocorrências
                        valor_total_mes = len(ocorrencias) * float(recorrente.valor)
                    
                    if valor_total_mes > 0:
                        # Separar recorrentes por destino
                        if recorrente.cartao_id:
                            despesas_cartoes_recorrentes += valor_total_mes
                        elif recorrente.conta_id:
                            despesas_contas_reais += valor_total_mes  # Somar às despesas reais das contas
                        else:
                            despesas_recorrentes += valor_total_mes
            
            # 4. Calcular parcelas futuras (TODOS os meses)
            parcelas_mes = db.query(ParcelaCartao).join(CompraParcelada).filter(
                and_(
                    CompraParcelada.tenant_id == tenant_id,
                    CompraParcelada.status == "ativa",
                    ParcelaCartao.paga == False,
                    ParcelaCartao.data_vencimento >= data_mes,
                    ParcelaCartao.data_vencimento <= ultimo_dia
                )
            ).all()
            
            despesas_cartoes_parcelas = sum(parcela.valor for parcela in parcelas_mes)
            
            # 5. NOVO: Calcular parcelas de financiamentos (TODOS os meses)
            financiamentos_parcelas = db.query(ParcelaFinanciamento).join(Financiamento).filter(
                and_(
                    Financiamento.tenant_id == tenant_id,
                    Financiamento.status == "ativo",
                    ParcelaFinanciamento.status.in_(['pendente', 'PENDENTE']),
                    ParcelaFinanciamento.data_vencimento >= data_mes,
                    ParcelaFinanciamento.data_vencimento <= ultimo_dia
                )
            ).all()
            
            despesas_financiamentos = sum(
                float(parcela.valor_parcela_simulado or parcela.valor_parcela) 
                for parcela in financiamentos_parcelas
            )

            # 6. Consolidar totais (ATUALIZADO para incluir financiamentos)
            total_despesas_cartoes = despesas_cartoes_fatura + despesas_cartoes_recorrentes + despesas_cartoes_parcelas
            total_receitas = receitas_reais + receitas_recorrentes
            total_despesas = total_despesas_cartoes + despesas_contas_reais + despesas_recorrentes + despesas_financiamentos
            saldo_mes = total_receitas - total_despesas
            
            # Debug detalhado
            if i == 0:
                print(f"🔍 Mês atual ({data_mes.strftime('%B %Y')}):")
                print(f"   📈 Receitas: Reais R$ {receitas_reais:,.2f} + Recorrentes R$ {receitas_recorrentes:,.2f} = R$ {total_receitas:,.2f}")
                print(f"   📉 Despesas: Faturas R$ {despesas_cartoes_fatura:,.2f} + Contas R$ {despesas_contas_reais:,.2f} + Recorrentes R$ {(despesas_cartoes_recorrentes + despesas_recorrentes):,.2f} + Parcelas R$ {despesas_cartoes_parcelas:,.2f} + Financiamentos R$ {despesas_financiamentos:,.2f} = R$ {total_despesas:,.2f}")
                print(f"   💰 Resultado: R$ {saldo_mes:,.2f}")
            else:
                print(f"🔍 Mês {i+1} ({data_mes.strftime('%B %Y')}):")
                print(f"   📈 Receitas: Recorrentes R$ {receitas_recorrentes:,.2f} = R$ {total_receitas:,.2f}")
                print(f"   📉 Despesas: Faturas R$ {despesas_cartoes_fatura:,.2f} + Recorrentes R$ {(despesas_cartoes_recorrentes + despesas_recorrentes):,.2f} + Parcelas R$ {despesas_cartoes_parcelas:,.2f} + Financiamentos R$ {despesas_financiamentos:,.2f} = R$ {total_despesas:,.2f}")
                print(f"   💰 Resultado: R$ {saldo_mes:,.2f}")
            
            # NOVA LÓGICA: Cada mês é independente - visão panorâmica
            # Não acumula saldo entre meses - "virou o mês, esquece o atual"
            # Cada mês mostra apenas seu fluxo (receitas - despesas)
            
            saldo_inicial_mes = 0  # Sempre 0 - não acumula saldo
            saldo_final_mes = saldo_mes  # Resultado do mês (positivo = sobra, negativo = déficit)
            
            # Apenas para o mês atual, mostrar o saldo real das contas como referência
            saldo_atual_contas = saldo_inicial if i == 0 else 0
            
            projecoes_meses.append({
                "mes": data_mes.strftime("%B %Y"),
                "mes_abrev": data_mes.strftime("%b/%Y"),
                "ano": data_mes.year,
                "mes_numero": data_mes.month,
                "saldo_inicial": float(saldo_inicial_mes),  # Sempre 0 - não acumula
                "receitas": {
                    "reais": float(receitas_reais),
                    "recorrentes": float(receitas_recorrentes),
                    "total": float(total_receitas)
                },
                "despesas": {
                    "cartoes": float(despesas_cartoes_fatura + despesas_cartoes_parcelas),
                    "contas": float(despesas_contas_reais),
                    "recorrentes": float(despesas_cartoes_recorrentes + despesas_recorrentes),
                    "parcelamentos": float(despesas_cartoes_parcelas),
                    "financiamentos": float(despesas_financiamentos),
                    "total": float(total_despesas)
                },
                "saldo_mensal": float(saldo_mes),  # Resultado do mês (receitas - despesas)
                "saldo_final": float(saldo_final_mes),  # Mesmo que saldo_mensal
                "fluxo": {
                    "entrada_liquida": float(total_receitas),
                    "saida_liquida": float(total_despesas),
                    "resultado_mes": float(saldo_mes),  # Resultado independente do mês
                    "saldo_projetado": float(saldo_final_mes)
                },
                # Informações adicionais
                "eh_mes_atual": i == 0,
                "saldo_atual_contas": float(saldo_atual_contas),  # Saldo real das contas (só mês atual)
                # Detalhes simplificados para evitar lentidão
                "total_parcelas": len(parcelas_mes) if 'parcelas_mes' in locals() else 0,
                "total_financiamentos": len(financiamentos_parcelas) if 'financiamentos_parcelas' in locals() else 0
            })
        
        # Log tempo total
        tempo_total = (datetime.now() - inicio_tempo).total_seconds()
        print(f"✅ [PANORÂMICA] Projeções 6 meses calculadas em {tempo_total:.2f}s - Lógica corrigida: meses independentes")
        
        return {
            "saldo_atual": float(saldo_inicial),  # Apenas referência - não usado nos cálculos
            "total_recorrentes_ativas": len(recorrentes_ativas),
            "projecoes": projecoes_meses,
            "resumo": {
                "menor_saldo": min(p["saldo_final"] for p in projecoes_meses) if projecoes_meses else 0,
                "maior_saldo": max(p["saldo_final"] for p in projecoes_meses) if projecoes_meses else 0,
                "mes_critico": min(projecoes_meses, key=lambda x: x["saldo_final"])["mes"] if projecoes_meses else None,
                "total_financiamentos_6_meses": sum(p["despesas"]["financiamentos"] for p in projecoes_meses) if projecoes_meses else 0,
                "media_mensal_recorrentes": sum(p["despesas"]["recorrentes"] for p in projecoes_meses) / 6 if projecoes_meses else 0,
                "media_mensal_financiamentos": sum(p["despesas"]["financiamentos"] for p in projecoes_meses) / 6 if projecoes_meses else 0
            },
            "performance": {
                "tempo_calculo_segundos": round(tempo_total, 2),
                "timestamp": datetime.now().isoformat(),
                "versao": "panoramica_v3",
                "melhorias_aplicadas": [
                    "Queries de saldo otimizadas",
                    "Cálculo de fatura simplificado",
                    "Logs reduzidos",
                    "Detalhes simplificados",
                    "Timeout de segurança",
                    "Lógica corrigida: meses independentes",
                    "Visão panorâmica: não acumula saldo"
                ]
            }
        }
        
    except Exception as e:
        # Log detalhado do erro
        print(f"❌ [ERRO] Projeções 6 meses: {str(e)}")
        
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
                "versao": "fallback_erro_panoramica",
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
    """Obter detalhes completos de um mês específico da projeção incluindo todas as transações"""
    try:
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário deve estar associado a um tenant"
            )
        
        # Importar modelos necessários
        from ..models.financial import CompraParcelada, ParcelaCartao
        from ..services.fatura_service import FaturaService
        
        # Validar parâmetros
        if mes < 1 or mes > 12:
            raise HTTPException(status_code=400, detail="Mês deve estar entre 1 e 12")
        
        today = datetime.now().date()
        data_mes = datetime(ano, mes, 1).date()
        
        # Calcular último dia do mês
        if data_mes.month == 12:
            ultimo_dia = data_mes.replace(year=data_mes.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            ultimo_dia = data_mes.replace(month=data_mes.month + 1, day=1) - timedelta(days=1)
        
        # Verificar se é mês atual ou futuro
        eh_mes_atual = data_mes.year == today.year and data_mes.month == today.month
        eh_mes_passado = data_mes < today.replace(day=1)
        
        if eh_mes_passado:
            raise HTTPException(status_code=400, detail="Não é possível consultar projeções de meses passados")
        
        # === RECEITAS ===
        receitas_reais = []
        receitas_recorrentes = []
        
        # Se for mês atual, buscar receitas reais já executadas
        if eh_mes_atual:
            transacoes_receitas = db.query(Transacao).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.tipo == 'ENTRADA',
                    Transacao.data >= data_mes,
                    Transacao.data <= today
                )
            ).all()
            
            receitas_reais = [
                {
                    "id": t.id,
                    "descricao": t.descricao,
                    "valor": float(t.valor),
                    "data": t.data.isoformat(),
                    "categoria": t.categoria.nome if t.categoria else "Sem categoria",
                    "conta": t.conta.nome if t.conta else "Sem conta",
                    "tipo_transacao": "real"
                }
                for t in transacoes_receitas
            ]
        
        # Buscar transações recorrentes de receita para este mês
        recorrentes_ativas = db.query(TransacaoRecorrente).filter(
            and_(
                TransacaoRecorrente.tenant_id == tenant_id,
                TransacaoRecorrente.ativo == True,
                TransacaoRecorrente.tipo == "ENTRADA",
                or_(
                    TransacaoRecorrente.data_fim.is_(None),
                    TransacaoRecorrente.data_fim >= today
                )
            )
        ).all()
        
        for recorrente in recorrentes_ativas:
            ocorrencias = _calcular_ocorrencias_periodo(recorrente, data_mes, ultimo_dia)
            
            # Se for mês atual, filtrar apenas ocorrências futuras
            if eh_mes_atual:
                ocorrencias = [data_ocor for data_ocor in ocorrencias if data_ocor > today]
            
            for data_ocorrencia in ocorrencias:
                receitas_recorrentes.append({
                    "id": f"rec_{recorrente.id}_{data_ocorrencia.isoformat()}",
                    "descricao": recorrente.descricao,
                    "valor": float(recorrente.valor),
                    "data": data_ocorrencia.isoformat(),
                    "categoria": recorrente.categoria.nome if recorrente.categoria else "Sem categoria",
                    "conta": recorrente.conta.nome if recorrente.conta else "Sem conta",
                    "tipo_transacao": "recorrente",
                    "frequencia": recorrente.frequencia,
                    "recorrente_id": recorrente.id
                })
        
        # === DESPESAS ===
        despesas_faturas_cartao = []  # Faturas que vencem neste mês
        despesas_reais_conta = []     # Gastos diretos das contas
        despesas_recorrentes = []
        parcelas_mes = []
        financiamentos_mes = []  # NOVO: Parcelas de financiamentos
        
        # Calcular faturas de cartão baseadas no vencimento específico de cada cartão
        cartoes = db.query(Cartao).filter(
            and_(
                Cartao.tenant_id == tenant_id,
                Cartao.ativo == True
            )
        ).all()
        
        for cartao in cartoes:
            if not cartao.dia_vencimento:
                continue
            
            try:
                data_vencimento = datetime(data_mes.year, data_mes.month, cartao.dia_vencimento).date()
                
                # Se o vencimento é neste mês
                if data_vencimento >= data_mes and data_vencimento <= ultimo_dia:
                    # Calcular período de fatura
                    dia_fechamento = cartao.dia_fechamento or (cartao.dia_vencimento - 5)
                    
                    # Data de fechamento do mês anterior
                    if data_mes.month == 1:
                        fechamento_anterior = datetime(data_mes.year - 1, 12, dia_fechamento).date()
                    else:
                        fechamento_anterior = datetime(data_mes.year, data_mes.month - 1, dia_fechamento).date()
                    
                    # Data de fechamento atual
                    fechamento_atual = datetime(data_mes.year, data_mes.month, dia_fechamento).date()
                    limite_superior = min(fechamento_atual, today)
                    
                    # Buscar transações do cartão no período da fatura
                    transacoes_fatura = db.query(Transacao).filter(
                        and_(
                            Transacao.tenant_id == tenant_id,
                            Transacao.tipo == 'SAIDA',
                            Transacao.cartao_id == cartao.id,
                            Transacao.data > fechamento_anterior,
                            Transacao.data <= limite_superior
                        )
                    ).all()
                    
                    for t in transacoes_fatura:
                        despesas_faturas_cartao.append({
                            "id": t.id,
                            "descricao": f"{t.descricao} (Fatura {cartao.nome})",
                            "valor": float(t.valor),
                            "data": t.data.isoformat(),
                            "data_vencimento": data_vencimento.isoformat(),
                            "categoria": t.categoria.nome if t.categoria else "Sem categoria",
                            "cartao": cartao.nome,
                            "tipo_transacao": "fatura_cartao"
                        })
            except ValueError:
                continue
        
        # Se for mês atual, buscar apenas despesas diretas das contas (não cartão)
        if eh_mes_atual:
            transacoes_conta = db.query(Transacao).filter(
                and_(
                    Transacao.tenant_id == tenant_id,
                    Transacao.tipo == 'SAIDA',
                    Transacao.cartao_id.is_(None),  # APENAS gastos diretos (não cartão)
                    Transacao.data >= data_mes,
                    Transacao.data <= today
                )
            ).all()
            
            despesas_reais_conta = [
                {
                    "id": t.id,
                    "descricao": t.descricao,
                    "valor": float(t.valor),
                    "data": t.data.isoformat(),
                    "categoria": t.categoria.nome if t.categoria else "Sem categoria",
                    "conta": t.conta.nome if t.conta else "Sem conta",
                    "tipo_transacao": "real_conta"
                }
                for t in transacoes_conta
            ]
        
        # Buscar transações recorrentes de despesa para este mês
        recorrentes_despesas = db.query(TransacaoRecorrente).filter(
            and_(
                TransacaoRecorrente.tenant_id == tenant_id,
                TransacaoRecorrente.ativo == True,
                TransacaoRecorrente.tipo == "SAIDA",
                or_(
                    TransacaoRecorrente.data_fim.is_(None),
                    TransacaoRecorrente.data_fim >= today
                )
            )
        ).all()
        
        for recorrente in recorrentes_despesas:
            ocorrencias = _calcular_ocorrencias_periodo(recorrente, data_mes, ultimo_dia)
            
            # Se for mês atual, filtrar apenas ocorrências futuras
            if eh_mes_atual:
                ocorrencias = [data_ocor for data_ocor in ocorrencias if data_ocor > today]
            
            for data_ocorrencia in ocorrencias:
                despesas_recorrentes.append({
                    "id": f"rec_{recorrente.id}_{data_ocorrencia.isoformat()}",
                    "descricao": recorrente.descricao,
                    "valor": float(recorrente.valor),
                    "data": data_ocorrencia.isoformat(),
                    "categoria": recorrente.categoria.nome if recorrente.categoria else "Sem categoria",
                    "conta": recorrente.conta.nome if recorrente.conta else "Sem conta",
                    "cartao": recorrente.cartao.nome if recorrente.cartao else None,
                    "tipo_transacao": "recorrente",
                    "frequencia": recorrente.frequencia,
                    "recorrente_id": recorrente.id,
                    "destino": "cartao" if recorrente.cartao_id else "conta"
                })
        
        # Buscar parcelas de cartão para este mês
        parcelas_query = db.query(ParcelaCartao).join(CompraParcelada).filter(
            and_(
                CompraParcelada.tenant_id == tenant_id,
                CompraParcelada.status == "ativa",
                ParcelaCartao.paga == False,
                ParcelaCartao.data_vencimento >= data_mes,
                ParcelaCartao.data_vencimento <= ultimo_dia
            )
        ).all()
        
        parcelas_mes = [
            {
                "id": f"parcela_{parcela.id}",
                "descricao": f"{parcela.compra_parcelada.descricao} - Parcela {parcela.numero_parcela}/{parcela.compra_parcelada.total_parcelas}",
                "valor": float(parcela.valor),
                "data": parcela.data_vencimento.isoformat(),
                "categoria": "Parcelamentos",
                "cartao": parcela.compra_parcelada.cartao.nome,
                "tipo_transacao": "parcelamento",
                "numero_parcela": parcela.numero_parcela,
                "total_parcelas": parcela.compra_parcelada.total_parcelas,
                "compra_id": parcela.compra_parcelada.id
            }
            for parcela in parcelas_query
        ]
        
        # Buscar parcelas de financiamentos para este mês
        financiamentos_query = db.query(ParcelaFinanciamento).join(Financiamento).filter(
            and_(
                Financiamento.tenant_id == tenant_id,
                Financiamento.status == "ativo",
                ParcelaFinanciamento.status.in_(['pendente', 'PENDENTE']),
                ParcelaFinanciamento.data_vencimento >= data_mes,
                ParcelaFinanciamento.data_vencimento <= ultimo_dia
            )
        ).all()
        
        financiamentos_mes = [
            {
                "id": f"financiamento_{parcela.id}",
                "descricao": f"{parcela.financiamento.descricao} - Parcela {parcela.numero_parcela}/{parcela.financiamento.numero_parcelas}",
                "valor": float(parcela.valor_parcela_simulado or parcela.valor_parcela),
                "data": parcela.data_vencimento.isoformat(),
                "categoria": "Financiamentos",
                "instituicao": parcela.financiamento.instituicao or "Sem instituição",
                "tipo_transacao": "financiamento",
                "numero_parcela": parcela.numero_parcela,
                "total_parcelas": parcela.financiamento.numero_parcelas,
                "financiamento_id": parcela.financiamento.id,
                "tipo_financiamento": parcela.financiamento.tipo_financiamento,
                "sistema_amortizacao": parcela.financiamento.sistema_amortizacao
            }
            for parcela in financiamentos_query
        ]
        
        # Calcular totais
        total_receitas_reais = sum(r["valor"] for r in receitas_reais)
        total_receitas_recorrentes = sum(r["valor"] for r in receitas_recorrentes)
        total_receitas = total_receitas_reais + total_receitas_recorrentes
        
        total_despesas_faturas_cartao = sum(d["valor"] for d in despesas_faturas_cartao)
        total_despesas_reais_conta = sum(d["valor"] for d in despesas_reais_conta)
        total_despesas_recorrentes = sum(d["valor"] for d in despesas_recorrentes)
        total_parcelas = sum(p["valor"] for p in parcelas_mes)
        total_financiamentos = sum(f["valor"] for f in financiamentos_mes)  # NOVO
        total_despesas = total_despesas_faturas_cartao + total_despesas_reais_conta + total_despesas_recorrentes + total_parcelas + total_financiamentos
        
        saldo_mes = total_receitas - total_despesas
        
        return {
            "mes": data_mes.strftime("%B %Y"),
            "mes_abrev": data_mes.strftime("%b/%Y"),
            "ano": ano,
            "mes_numero": mes,
            "eh_mes_atual": eh_mes_atual,
            "periodo": {
                "inicio": data_mes.isoformat(),
                "fim": ultimo_dia.isoformat()
            },
            "resumo_financeiro": {
                "total_receitas": float(total_receitas),
                "total_despesas": float(total_despesas),
                "saldo_mes": float(saldo_mes)
            },
            # Arrays consolidados para o frontend
            "receitas": receitas_reais + receitas_recorrentes,
            "despesas": despesas_faturas_cartao + despesas_reais_conta + despesas_recorrentes + parcelas_mes + financiamentos_mes,
            
            # Estrutura detalhada para referência
            "receitas_detalhadas": {
                "total": float(total_receitas),
                "reais": {
                    "total": float(total_receitas_reais),
                    "transacoes": receitas_reais
                },
                "recorrentes": {
                    "total": float(total_receitas_recorrentes),
                    "transacoes": receitas_recorrentes
                }
            },
            "despesas_detalhadas": {
                "total": float(total_despesas),
                "faturas_cartao": {
                    "total": float(total_despesas_faturas_cartao),
                    "transacoes": despesas_faturas_cartao
                },
                "reais_conta": {
                    "total": float(total_despesas_reais_conta),
                    "transacoes": despesas_reais_conta
                },
                "recorrentes": {
                    "total": float(total_despesas_recorrentes),
                    "transacoes": despesas_recorrentes
                },
                "parcelamentos": {
                    "total": float(total_parcelas),
                    "transacoes": parcelas_mes
                },
                "financiamentos": {  # NOVO
                    "total": float(total_financiamentos),
                    "transacoes": financiamentos_mes
                }
            },
            "estatisticas": {
                "total_transacoes": len(receitas_reais) + len(receitas_recorrentes) + len(despesas_faturas_cartao) + len(despesas_reais_conta) + len(despesas_recorrentes) + len(parcelas_mes) + len(financiamentos_mes),
                "transacoes_reais": len(receitas_reais) + len(despesas_faturas_cartao) + len(despesas_reais_conta),
                "transacoes_previstas": len(receitas_recorrentes) + len(despesas_recorrentes) + len(parcelas_mes) + len(financiamentos_mes)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao obter detalhes da projeção: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter detalhes da projeção: {str(e)}")

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
                TransacaoRecorrente.ativo == True,
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
                TransacaoRecorrente.ativo == True,
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
