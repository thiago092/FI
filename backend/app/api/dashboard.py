from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract, case
from datetime import datetime, timedelta
from typing import Dict, Any, List
import calendar

from ..database import get_db
from ..models.user import User
from ..models.financial import Transacao, Categoria, Conta, Cartao
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