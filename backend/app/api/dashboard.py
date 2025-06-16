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
        
        # Transações já realizadas no mês atual
        transacoes_realizadas = db.query(Transacao).filter(
            and_(
                Transacao.tenant_id == tenant_id,
                Transacao.data >= inicio_mes,
                Transacao.data <= hoje
            )
        ).all()
        
        realizado_receitas = sum(t.valor for t in transacoes_realizadas if t.tipo == 'ENTRADA')
        realizado_despesas = sum(abs(t.valor) for t in transacoes_realizadas if t.tipo == 'SAIDA')
        realizado_saldo = realizado_receitas - realizado_despesas
        
        # Transações recorrentes ativas
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
        timeline = _gerar_timeline_semanal(
            hoje, fim_mes, realizado_saldo, pendentes_mes_atual
        )
        
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