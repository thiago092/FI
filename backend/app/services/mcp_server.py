"""
Financial MCP Server
Conecta chat/telegram aos dados financeiros reais via MCP Protocol
"""
import json
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.financial import Transacao, Cartao, Conta, Categoria
from ..models.user import User

class FinancialMCPServer:
    """MCP Server para dados financeiros"""
    
    def __init__(self):
        self.tools = {
            "get_transactions": self.get_transactions,
            "create_transaction": self.create_transaction,
            "get_balance": self.get_balance,
            "get_monthly_summary": self.get_monthly_summary,
            "get_categories": self.get_categories,
            "get_cards": self.get_cards,
            "get_accounts": self.get_accounts,
            "create_category": self.create_category,
            "analyze_spending": self.analyze_spending,
            "predict_budget": self.predict_budget,
        }
    
    async def process_request(self, tool_name: str, params: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        """Processa requisição MCP"""
        try:
            if tool_name not in self.tools:
                return {"error": f"Tool '{tool_name}' não encontrada"}
            
            # Adiciona user_id aos parâmetros
            params["user_id"] = user_id
            
            # Executa a função
            result = await self.tools[tool_name](**params)
            return {"success": True, "data": result}
            
        except Exception as e:
            return {"error": f"Erro ao executar {tool_name}: {str(e)}"}
    
    async def get_transactions(self, user_id: int, limit: int = 10, categoria: str = None, periodo: str = "30d") -> List[Dict]:
        """Busca transações do usuário"""
        db = next(get_db())
        try:
            query = db.query(Transacao).filter(Transacao.tenant_id == user_id)
            
            # Filtro por categoria
            if categoria:
                cat = db.query(Categoria).filter(
                    Categoria.tenant_id == user_id,
                    Categoria.nome.ilike(f"%{categoria}%")
                ).first()
                if cat:
                    query = query.filter(Transacao.categoria_id == cat.id)
            
            # Filtro por período
            if periodo:
                days = int(periodo.replace('d', ''))
                start_date = datetime.now() - timedelta(days=days)
                query = query.filter(Transacao.data >= start_date)
            
            transactions = query.order_by(Transacao.data.desc()).limit(limit).all()
            
            return [
                {
                    "id": t.id,
                    "descricao": t.descricao,
                    "valor": float(t.valor),
                    "tipo": t.tipo,
                    "data": t.data.isoformat(),
                    "categoria": t.categoria.nome if t.categoria else None,
                    "conta": t.conta.nome if t.conta else None,
                    "cartao": t.cartao.nome if t.cartao else None
                }
                for t in transactions
            ]
        finally:
            db.close()
    
    async def create_transaction(self, user_id: int, descricao: str, valor: float, 
                               tipo: str, categoria: str = None, conta: str = None) -> Dict:
        """Cria nova transação"""
        db = next(get_db())
        try:
            # Buscar categoria
            categoria_id = None
            if categoria:
                cat = db.query(Categoria).filter(
                    Categoria.tenant_id == user_id,
                    Categoria.nome.ilike(f"%{categoria}%")
                ).first()
                if cat:
                    categoria_id = cat.id
            
            # Buscar conta
            conta_id = None
            if conta:
                acc = db.query(Conta).filter(
                    Conta.tenant_id == user_id,
                    Conta.nome.ilike(f"%{conta}%")
                ).first()
                if acc:
                    conta_id = acc.id
            
            # Criar transação
            transaction = Transacao(
                descricao=descricao,
                valor=valor,
                tipo=tipo.upper(),
                data=datetime.now(),
                categoria_id=categoria_id,
                conta_id=conta_id,
                tenant_id=user_id
            )
            
            db.add(transaction)
            db.commit()
            db.refresh(transaction)
            
            return {
                "id": transaction.id,
                "descricao": transaction.descricao,
                "valor": float(transaction.valor),
                "tipo": transaction.tipo,
                "mensagem": "Transação criada com sucesso!"
            }
        finally:
            db.close()
    
    async def get_balance(self, user_id: int) -> Dict:
        """Calcula saldo atual"""
        db = next(get_db())
        try:
            entradas = db.query(Transacao).filter(
                Transacao.tenant_id == user_id,
                Transacao.tipo == "ENTRADA"
            ).all()
            
            saidas = db.query(Transacao).filter(
                Transacao.tenant_id == user_id,
                Transacao.tipo == "SAIDA"
            ).all()
            
            total_entradas = sum(float(t.valor) for t in entradas)
            total_saidas = sum(float(t.valor) for t in saidas)
            saldo = total_entradas - total_saidas
            
            return {
                "saldo_atual": saldo,
                "total_entradas": total_entradas,
                "total_saidas": total_saidas,
                "total_transacoes": len(entradas) + len(saidas)
            }
        finally:
            db.close()
    
    async def get_monthly_summary(self, user_id: int, mes: int = None, ano: int = None) -> Dict:
        """Resumo mensal"""
        db = next(get_db())
        try:
            if not mes:
                mes = datetime.now().month
            if not ano:
                ano = datetime.now().year
            
            start_date = datetime(ano, mes, 1)
            if mes == 12:
                end_date = datetime(ano + 1, 1, 1)
            else:
                end_date = datetime(ano, mes + 1, 1)
            
            transactions = db.query(Transacao).filter(
                Transacao.tenant_id == user_id,
                Transacao.data >= start_date,
                Transacao.data < end_date
            ).all()
            
            por_categoria = {}
            total_entradas = 0
            total_saidas = 0
            
            for t in transactions:
                if t.tipo == "ENTRADA":
                    total_entradas += float(t.valor)
                else:
                    total_saidas += float(t.valor)
                
                categoria = t.categoria.nome if t.categoria else "Sem categoria"
                if categoria not in por_categoria:
                    por_categoria[categoria] = 0
                por_categoria[categoria] += float(t.valor)
            
            return {
                "mes": mes,
                "ano": ano,
                "total_entradas": total_entradas,
                "total_saidas": total_saidas,
                "saldo_mes": total_entradas - total_saidas,
                "por_categoria": por_categoria,
                "total_transacoes": len(transactions)
            }
        finally:
            db.close()
    
    async def get_categories(self, user_id: int) -> List[Dict]:
        """Lista categorias"""
        db = next(get_db())
        try:
            categories = db.query(Categoria).filter(Categoria.tenant_id == user_id).all()
            return [
                {
                    "id": c.id,
                    "nome": c.nome,
                    "cor": c.cor,
                    "icone": c.icone
                }
                for c in categories
            ]
        finally:
            db.close()
    
    async def get_cards(self, user_id: int) -> List[Dict]:
        """Lista cartões"""
        db = next(get_db())
        try:
            cards = db.query(Cartao).filter(Cartao.tenant_id == user_id).all()
            return [
                {
                    "id": c.id,
                    "nome": c.nome,
                    "bandeira": c.bandeira,
                    "limite": float(c.limite),
                    "ativo": c.ativo
                }
                for c in cards
            ]
        finally:
            db.close()
    
    async def get_accounts(self, user_id: int) -> List[Dict]:
        """Lista contas"""
        db = next(get_db())
        try:
            accounts = db.query(Conta).filter(Conta.tenant_id == user_id).all()
            return [
                {
                    "id": a.id,
                    "nome": a.nome,
                    "banco": a.banco,
                    "tipo": a.tipo,
                    "saldo_inicial": float(a.saldo_inicial)
                }
                for a in accounts
            ]
        finally:
            db.close()
    
    async def create_category(self, user_id: int, nome: str, cor: str = "#3B82F6", icone: str = "💰") -> Dict:
        """Cria nova categoria"""
        db = next(get_db())
        try:
            category = Categoria(
                nome=nome,
                cor=cor,
                icone=icone,
                tenant_id=user_id
            )
            
            db.add(category)
            db.commit()
            db.refresh(category)
            
            return {
                "id": category.id,
                "nome": category.nome,
                "cor": category.cor,
                "icone": category.icone,
                "mensagem": f"Categoria '{nome}' criada com sucesso!"
            }
        finally:
            db.close()
    
    async def analyze_spending(self, user_id: int, periodo: str = "30d") -> Dict:
        """Análise de gastos"""
        db = next(get_db())
        try:
            days = int(periodo.replace('d', ''))
            start_date = datetime.now() - timedelta(days=days)
            
            transactions = db.query(Transacao).filter(
                Transacao.tenant_id == user_id,
                Transacao.data >= start_date,
                Transacao.tipo == "SAIDA"
            ).all()
            
            total_gasto = sum(float(t.valor) for t in transactions)
            media_diaria = total_gasto / days if days > 0 else 0
            
            # Análise por categoria
            por_categoria = {}
            for t in transactions:
                categoria = t.categoria.nome if t.categoria else "Sem categoria"
                if categoria not in por_categoria:
                    por_categoria[categoria] = 0
                por_categoria[categoria] += float(t.valor)
            
            # Categoria com maior gasto
            maior_gasto = max(por_categoria.items(), key=lambda x: x[1]) if por_categoria else ("Nenhuma", 0)
            
            return {
                "periodo_dias": days,
                "total_gasto": total_gasto,
                "media_diaria": media_diaria,
                "total_transacoes": len(transactions),
                "por_categoria": por_categoria,
                "maior_gasto_categoria": maior_gasto[0],
                "maior_gasto_valor": maior_gasto[1],
                "insights": [
                    f"Você gastou R$ {total_gasto:.2f} nos últimos {days} dias",
                    f"Média diária: R$ {media_diaria:.2f}",
                    f"Maior gasto: {maior_gasto[0]} (R$ {maior_gasto[1]:.2f})"
                ]
            }
        finally:
            db.close()
    
    async def predict_budget(self, user_id: int) -> Dict:
        """Previsão orçamentária"""
        db = next(get_db())
        try:
            # Últimos 90 dias para análise
            start_date = datetime.now() - timedelta(days=90)
            
            transactions = db.query(Transacao).filter(
                Transacao.tenant_id == user_id,
                Transacao.data >= start_date
            ).all()
            
            if not transactions:
                return {"erro": "Não há dados suficientes para previsão"}
            
            # Calcular médias
            entradas = [t for t in transactions if t.tipo == "ENTRADA"]
            saidas = [t for t in transactions if t.tipo == "SAIDA"]
            
            media_entrada_mensal = sum(float(t.valor) for t in entradas) / 3
            media_saida_mensal = sum(float(t.valor) for t in saidas) / 3
            
            # Previsão próximo mês
            previsao_saldo = media_entrada_mensal - media_saida_mensal
            
            # Recomendações
            recomendacoes = []
            if previsao_saldo < 0:
                recomendacoes.append("⚠️ Previsão de saldo negativo! Reduza gastos.")
            elif previsao_saldo < media_entrada_mensal * 0.1:
                recomendacoes.append("💡 Saldo baixo previsto. Considere economizar mais.")
            else:
                recomendacoes.append("✅ Situação financeira estável prevista.")
            
            return {
                "previsao_entrada_mensal": media_entrada_mensal,
                "previsao_saida_mensal": media_saida_mensal,
                "previsao_saldo": previsao_saldo,
                "baseado_em_dias": 90,
                "recomendacoes": recomendacoes
            }
        finally:
            db.close()

# Instância global do MCP Server
financial_mcp = FinancialMCPServer() 