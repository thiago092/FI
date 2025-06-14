"""
Enhanced Chat AI Service com MCP Integration
Evolui o chat atual para usar dados reais via MCP Server
"""
import json
import re
from typing import Dict, List, Any
from openai import AsyncOpenAI
from ..core.config import settings
from .smart_mcp_service import smart_mcp_service

class EnhancedChatAIService:
    """Chat AI com integração MCP"""
    
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.smart_mcp = smart_mcp_service
        
        # Mapeamento de intenções para tools MCP
        self.intent_mapping = {
            # Consultas
            "transacoes": "get_transactions",
            "saldo": "get_balance", 
            "resumo": "get_monthly_summary",
            "categorias": "get_categories",
            "cartoes": "get_cards",
            "contas": "get_accounts",
            "analise": "analyze_spending",
            "previsao": "predict_budget",
            
            # Ações
            "criar_transacao": "create_transaction",
            "criar_categoria": "create_category"
        }
    
    async def process_message(self, message: str, user_id: int, chat_history: List[Dict] = None, telegram_user_name: str = None) -> Dict[str, Any]:
        """Processa mensagem com Smart MCP (lógica avançada)"""
        try:
            # Usar o Smart MCP Service que incorpora toda a lógica inteligente
            return await self.smart_mcp.process_message(message, user_id, chat_history, telegram_user_name)
            
        except Exception as e:
            return {
                "resposta": f"Desculpe, ocorreu um erro: {str(e)}",
                "erro": True
            }
    
    async def _detect_intent_and_params(self, message: str, user_id: int) -> tuple:
        """Detecta intenção usando sistema híbrido avançado (como chat antigo)"""
        message_lower = message.lower()
        
        # PRIORIDADE 1: Detecção de transação (mais comum)
        transaction_data = self._parse_transaction_advanced(message)
        if transaction_data:
            if transaction_data.get('is_parcelamento'):
                return "parcelamento", transaction_data
            else:
                return "criar_transacao", transaction_data
        
        # PRIORIDADE 2: Consultas de dados
        if any(word in message_lower for word in ["transaç", "gasto", "despesa", "compra", "últim"]):
            params = self._extract_transaction_params(message)
            return "transacoes", params
            
        elif any(word in message_lower for word in ["saldo", "quanto tenho", "dinheiro", "sobrou"]):
            return "saldo", {}
            
        elif any(word in message_lower for word in ["resumo", "relatório", "mês", "mensal"]):
            params = self._extract_period_params(message)
            return "resumo", params
            
        elif any(word in message_lower for word in ["análise", "analise", "analisa"]):
            params = self._extract_period_params(message)
            return "analise", params
            
        elif any(word in message_lower for word in ["previsão", "previsao", "prever", "orçamento"]):
            return "previsao", {}
        
        # PRIORIDADE 3: Gestão de dados
        elif any(word in message_lower for word in ["categoria", "categorias"]):
            if "criar" in message_lower or "nova" in message_lower:
                params = self._extract_category_params(message)
                return "criar_categoria", params
            return "categorias", {}
            
        elif any(word in message_lower for word in ["cartão", "cartões", "cartao"]):
            return "cartoes", {}
            
        elif any(word in message_lower for word in ["conta", "contas", "banco"]):
            return "contas", {}
            
        return None, {}
    
    def _parse_transaction_advanced(self, message: str) -> dict:
        """Parser avançado de transações (baseado no chat antigo)"""
        import re
        
        message_lower = message.lower().strip()
        
        # 1. DETECTAR PARCELAMENTO PRIMEIRO
        parcelamento_data = self._detect_parcelamento_advanced(message_lower)
        if parcelamento_data:
            return parcelamento_data
        
        # 2. DETECTAR TRANSAÇÃO SIMPLES
        # Extrair valor
        valor = self._extract_valor_regex(message_lower)
        if not valor:
            return None
        
        # Identificar tipo
        tipo = self._detect_tipo_transacao(message_lower)
        if not tipo:
            return None
            
        # Extrair descrição
        descricao = self._extract_descricao_advanced(message_lower, valor)
        
        # Verificar se descrição é suficiente
        if not descricao or len(descricao) < 2:
            return {
                'valor': valor,
                'tipo': tipo,
                'status': 'requer_descricao'
            }
        
        return {
            'valor': valor,
            'tipo': tipo,
            'descricao': descricao,
            'status': 'completo'
        }
    
    def _detect_parcelamento_advanced(self, message: str) -> dict:
        """Detecta parcelamento com padrões avançados"""
        import re
        
        padroes_parcelamento = [
            r'(\d+)x\s*(?:de)?\s*(\d+(?:,\d+)?(?:\.\d+)?)',  # "12x de 100"
            r'(?:em|de)\s*(\d+)\s*(?:parcelas?|vezes?)\s*(?:de)?\s*(\d+(?:,\d+)?(?:\.\d+)?)',  # "em 6 parcelas de 200"
            r'parcel(?:ei|ar|ado)\s*em\s*(\d+)(?:x)?\s*(?:de)?\s*(\d+(?:,\d+)?(?:\.\d+)?)',  # "parcelei em 3x de 50"
            r'(\d+)\s*(?:parcelas?|vezes?)\s*(?:de)?\s*(\d+(?:,\d+)?(?:\.\d+)?)',  # "3 parcelas de 100"
            r'dividi(?:r|do)?\s*em\s*(\d+)\s*(?:de)?\s*(\d+(?:,\d+)?(?:\.\d+)?)'  # "dividi em 4 de 250"
        ]
        
        for padrao in padroes_parcelamento:
            match = re.search(padrao, message)
            if match:
                total_parcelas = int(match.group(1))
                valor_parcela = float(match.group(2).replace(',', '.'))
                
                if total_parcelas > 1:  # Só é parcelamento se > 1 parcela
                    descricao = self._extract_descricao_parcelamento(message, valor_parcela)
                    
                    return {
                        'is_parcelamento': True,
                        'total_parcelas': total_parcelas,
                        'valor_parcela': valor_parcela,
                        'valor_total': valor_parcela * total_parcelas,
                        'descricao': descricao or 'Compra parcelada',
                        'status': 'requer_cartao'  # Sempre precisa perguntar cartão
                    }
        
        return None
    
    def _extract_valor_regex(self, message: str) -> float:
        """Extrai valor da mensagem"""
        import re
        
        padroes_valor = [
            r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:reais?|r\$|real)',
            r'r\$\s*(\d+(?:,\d+)?(?:\.\d+)?)',
            r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:conto|pila|mangos?)',
            r'(\d+(?:,\d+)?(?:\.\d+)?)' 
        ]
        
        for padrao in padroes_valor:
            match = re.search(padrao, message)
            if match:
                try:
                    return float(match.group(1).replace(',', '.'))
                except:
                    continue
        return None
    
    def _detect_tipo_transacao(self, message: str) -> str:
        """Detecta tipo de transação"""
        palavras_entrada = ['recebi', 'ganhei', 'entrou', 'salario', 'salário', 'renda', 'freelance', 'freela']
        palavras_saida = ['gastei', 'paguei', 'comprei', 'saiu', 'despesa', 'gasto']
        
        for palavra in palavras_entrada:
            if palavra in message:
                return "ENTRADA"
        
        for palavra in palavras_saida:
            if palavra in message:
                return "SAIDA"
        
        return None
    
    def _extract_descricao_advanced(self, message: str, valor: float) -> str:
        """Extrai descrição avançada (baseado no chat antigo)"""
        import re
        
        texto_limpo = message
        
        # Remove valores
        texto_limpo = re.sub(r'\d+(?:,\d+)?(?:\.\d+)?\s*(?:reais?|r\$|real|conto|pila|mangos?)?', '', texto_limpo)
        texto_limpo = re.sub(r'r\$\s*\d+(?:,\d+)?(?:\.\d+)?', '', texto_limpo)
        
        # Remove palavras de ação
        palavras_acao = ['gastei', 'paguei', 'comprei', 'recebi', 'ganhei', 'saiu', 'entrou', 'de', 'no', 'na', 'com', 'para', 'em']
        for palavra in palavras_acao:
            texto_limpo = re.sub(rf'\b{palavra}\b', '', texto_limpo)
        
        # Remove preposições e artigos
        texto_limpo = re.sub(r'\b(o|a|os|as|um|uma|de|da|do|das|dos|em|na|no|nas|nos|com|para|por)\b', '', texto_limpo)
        
        # Limpa espaços extras
        texto_limpo = ' '.join(texto_limpo.split())
        
        # Casos especiais conhecidos
        mapeamento = {
            'ifood': 'iFood',
            'uber': 'Uber',
            'mercado': 'Mercado',
            'supermercado': 'Supermercado',
            'farmacia': 'Farmácia',
            'gasolina': 'Gasolina',
            'salario': 'Salário',
            'freela': 'Freelance',
            'freelance': 'Freelance',
            'lanchonete': 'Lanchonete',
            'almoço': 'Almoço',
            'almoco': 'Almoço',
            'jantar': 'Jantar',
            'lanche': 'Lanche'
        }
        
        for chave, valor_map in mapeamento.items():
            if chave in message:
                return valor_map
        
        # Se sobrou algo útil, capitalizar
        if texto_limpo and len(texto_limpo) > 1:
            return texto_limpo.title()
        
        return ""
    
    def _extract_descricao_parcelamento(self, message: str, valor_parcela: float) -> str:
        """Extrai descrição de parcelamento"""
        # Remove info de parcelamento para focar na descrição
        import re
        
        texto = message
        texto = re.sub(r'\d+x\s*(?:de)?\s*\d+(?:,\d+)?(?:\.\d+)?', '', texto)
        texto = re.sub(r'(?:em|de)\s*\d+\s*(?:parcelas?|vezes?)', '', texto)
        texto = re.sub(r'parcel(?:ei|ar|ado)', '', texto)
        
        return self._extract_descricao_advanced(texto, valor_parcela)
    
    def _extract_transaction_params(self, message: str) -> Dict:
        """Extrai parâmetros para consulta de transações"""
        params = {"limit": 10}
        
        # Extrair categoria
        if "alimenta" in message.lower():
            params["categoria"] = "alimentação"
        elif "transport" in message.lower():
            params["categoria"] = "transporte"
        elif "lazer" in message.lower():
            params["categoria"] = "lazer"
        
        # Extrair período
        if "semana" in message.lower():
            params["periodo"] = "7d"
        elif "quinzena" in message.lower():
            params["periodo"] = "15d"
        elif "mês" in message.lower():
            params["periodo"] = "30d"
        
        return params
    
    def _extract_period_params(self, message: str) -> Dict:
        """Extrai parâmetros de período"""
        params = {}
        
        # Extrair mês específico
        meses = {
            "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4,
            "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
            "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
        }
        
        for mes_nome, mes_num in meses.items():
            if mes_nome in message.lower():
                params["mes"] = mes_num
                break
        
        # Extrair ano
        import re
        year_match = re.search(r'\b(20\d{2})\b', message)
        if year_match:
            params["ano"] = int(year_match.group(1))
        
        return params
    
    def _extract_category_params(self, message: str) -> Dict:
        """Extrai parâmetros para criação de categoria"""
        params = {}
        
        # Tentar extrair nome da categoria
        if '"' in message:
            nome_match = re.search(r'"([^"]+)"', message)
            if nome_match:
                params["nome"] = nome_match.group(1)
        else:
            # Tentar extrair por palavras-chave
            words = message.split()
            for i, word in enumerate(words):
                if word.lower() in ["categoria", "criar", "nova"] and i + 1 < len(words):
                    params["nome"] = words[i + 1]
                    break
        
        return params
    
    def _is_transaction_creation(self, message: str) -> bool:
        """Verifica se é criação de transação"""
        patterns = [
            r"gastei\s+(\d+)",
            r"recebi\s+(\d+)", 
            r"paguei\s+(\d+)",
            r"comprei.*(\d+)",
            r"gasto.*(\d+)"
        ]
        
        return any(re.search(pattern, message.lower()) for pattern in patterns)
    
    def _extract_transaction_creation_params(self, message: str) -> Dict:
        """Extrai parâmetros para criação de transação"""
        params = {}
        
        # Extrair valor
        value_match = re.search(r'(\d+(?:,\d{2})?)', message)
        if value_match:
            valor_str = value_match.group(1).replace(',', '.')
            params["valor"] = float(valor_str)
        
        # Determinar tipo
        if any(word in message.lower() for word in ["gastei", "paguei", "comprei", "gasto"]):
            params["tipo"] = "SAIDA"
        elif any(word in message.lower() for word in ["recebi", "recebimento", "entrada"]):
            params["tipo"] = "ENTRADA"
        else:
            params["tipo"] = "SAIDA"  # default
        
        # Extrair descrição (tudo depois do valor ou palavras-chave)
        if "com" in message.lower():
            desc_match = re.search(r'com\s+(.+)', message.lower())
            if desc_match:
                params["descricao"] = desc_match.group(1).strip()
        elif "no" in message.lower():
            desc_match = re.search(r'no\s+(.+)', message.lower())
            if desc_match:
                params["descricao"] = desc_match.group(1).strip()
        else:
            params["descricao"] = "Transação via chat"
        
        return params
    
    async def _call_mcp_tool(self, intent: str, params: Dict, user_id: int) -> Dict:
        """Chama tool MCP apropriado"""
        tool_name = self.intent_mapping[intent]
        return await self.mcp_server.process_request(tool_name, params, user_id)
    
    async def _generate_response_with_data(self, original_message: str, mcp_result: Dict, chat_history: List[Dict] = None) -> str:
        """Gera resposta natural usando dados MCP"""
        if mcp_result.get("error"):
            return f"Desculpe, não consegui processar: {mcp_result['error']}"
        
        data = mcp_result.get("data", {})
        
        # Preparar contexto para GPT
        context = f"""
        Dados financeiros reais do usuário:
        {json.dumps(data, indent=2, ensure_ascii=False)}
        
        Mensagem original: {original_message}
        
        Responda de forma natural e amigável, usando os dados fornecidos.
        Seja específico com números e datas.
        Use emojis quando apropriado.
        """
        
        messages = [
            {"role": "system", "content": "Você é um assistente financeiro que responde com dados reais do usuário."},
            {"role": "user", "content": context}
        ]
        
        # Adicionar histórico se disponível
        if chat_history:
            for msg in chat_history[-3:]:  # últimas 3 mensagens
                messages.insert(-1, {"role": "user", "content": msg.get("pergunta", "")})
                messages.insert(-1, {"role": "assistant", "content": msg.get("resposta", "")})
        
        response = await self.client.chat.completions.create(
            model="gpt-4",
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    
    async def _fallback_chat(self, message: str, user_id: int, chat_history: List[Dict] = None) -> Dict:
        """Chat genérico quando não detecta intenção MCP"""
        messages = [
            {"role": "system", "content": "Você é um assistente financeiro amigável. Ajude com dúvidas sobre finanças pessoais."},
            {"role": "user", "content": message}
        ]
        
        if chat_history:
            for msg in chat_history[-3:]:
                messages.insert(-1, {"role": "user", "content": msg.get("pergunta", "")})
                messages.insert(-1, {"role": "assistant", "content": msg.get("resposta", "")})
        
        response = await self.client.chat.completions.create(
            model="gpt-4",
            messages=messages,
            max_tokens=300,
            temperature=0.7
        )
        
        return {
            "resposta": response.choices[0].message.content,
            "fonte": "chat_generico"
        }

# Instância global do serviço
enhanced_chat_service = EnhancedChatAIService() 