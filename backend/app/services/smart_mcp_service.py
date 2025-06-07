"""
Smart MCP Service - Incorpora lógica avançada do chat antigo
Sistema inteligente de detecção de transações, parcelamentos e perguntas automáticas
"""
import json
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from openai import AsyncOpenAI
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.financial import Transacao, Cartao, Conta, Categoria
from ..models.user import User
from ..core.config import settings
from .mcp_server import financial_mcp
import logging

logger = logging.getLogger(__name__)

class SmartMCPService:
    """MCP Service com inteligência avançada"""
    
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.mcp_server = financial_mcp
        
        # Estado para conversas multi-step
        self.pending_transactions = {}  # user_id -> dados_pendentes
        self.awaiting_responses = {}   # user_id -> tipo_aguardando
    
    async def process_message(self, message: str, user_id: int, chat_history: List[Dict] = None) -> Dict[str, Any]:
        """Processa mensagem com lógica inteligente completa"""
        try:
            logger.info(f"🔍 Smart MCP processando: '{message}' para user_id: {user_id}")
            
            # 1. VERIFICAR SE É RESPOSTA A PERGUNTA ANTERIOR
            if user_id in self.awaiting_responses:
                logger.info(f"🔄 Processando resposta aguardada para user_id: {user_id}")
                return await self._process_awaited_response(message, user_id, chat_history)
            
            # 2. DETECTAR TIPO DE MENSAGEM
            intent_result = await self._detect_smart_intent(message, user_id)
            logger.info(f"🎯 Intent detectado: {intent_result}")
            
            if not intent_result:
                logger.info(f"❌ Nenhum intent detectado, usando fallback")
                # Fallback para chat genérico
                return await self._fallback_chat(message, user_id, chat_history)
            
            intent = intent_result['intent']
            data = intent_result['data']
            logger.info(f"✅ Processando intent: {intent} com data: {data}")
            
            # 3. PROCESSAR BASEADO NA INTENÇÃO
            if intent == 'transacao_incompleta':
                return await self._handle_incomplete_transaction(data, user_id)
            
            elif intent == 'transacao_sem_pagamento':
                return await self._handle_transaction_needs_payment(data, user_id)
            
            elif intent == 'parcelamento_sem_cartao':
                return await self._handle_parcelamento_needs_card(data, user_id)
            
            elif intent == 'transacao_completa':
                return await self._handle_complete_transaction(data, user_id)
                
            elif intent == 'parcelamento_completo':
                return await self._handle_complete_parcelamento(data, user_id)
            
            elif intent in ['consulta_transacoes', 'consulta_saldo', 'consulta_resumo', 'analise_gastos', 'previsao_orcamento']:
                return await self._handle_data_query(intent, data, user_id)
            
            else:
                logger.info(f"⚠️ Intent não reconhecido: {intent}, usando fallback")
                return await self._fallback_chat(message, user_id, chat_history)
                
        except Exception as e:
            logger.error(f"❌ Erro no Smart MCP: {str(e)}")
            return {
                "resposta": f"Desculpe, ocorreu um erro: {str(e)}",
                "erro": True
            }
    
    async def _detect_smart_intent(self, message: str, user_id: int) -> Optional[Dict]:
        """Detecção inteligente de intenção (baseado no chat antigo)"""
        
        logger.info(f"🔍 Detectando intent para: '{message}'")
        
        # 1. DETECTAR TRANSAÇÕES PRIMEIRO (mais comum)
        transaction_data = self._parse_transaction_advanced(message)
        logger.info(f"💰 Dados de transação detectados: {transaction_data}")
        if transaction_data:
            
            # Transação com parcelamento
            if transaction_data.get('is_parcelamento'):
                if transaction_data.get('status') == 'requer_cartao':
                    return {
                        'intent': 'parcelamento_sem_cartao',
                        'data': transaction_data
                    }
                else:
                    return {
                        'intent': 'parcelamento_completo', 
                        'data': transaction_data
                    }
            
            # Transação simples
            else:
                if transaction_data.get('status') == 'requer_descricao':
                    return {
                        'intent': 'transacao_incompleta',
                        'data': transaction_data
                    }
                elif transaction_data.get('status') == 'requer_pagamento':
                    return {
                        'intent': 'transacao_sem_pagamento',
                        'data': transaction_data
                    }
                else:
                    return {
                        'intent': 'transacao_completa',
                        'data': transaction_data
                    }
        
        # 2. DETECTAR CONSULTAS
        message_lower = message.lower()
        
        if any(word in message_lower for word in ["transaç", "gasto", "despesa", "compra", "últim"]):
            params = self._extract_transaction_params(message)
            return {'intent': 'consulta_transacoes', 'data': params}
            
        elif any(word in message_lower for word in ["saldo", "quanto tenho", "dinheiro", "sobrou"]):
            return {'intent': 'consulta_saldo', 'data': {}}
            
        elif any(word in message_lower for word in ["resumo", "relatório", "mês", "mensal"]):
            params = self._extract_period_params(message)
            return {'intent': 'consulta_resumo', 'data': params}
            
        elif any(word in message_lower for word in ["análise", "analise", "analisa"]):
            params = self._extract_period_params(message)
            return {'intent': 'analise_gastos', 'data': params}
            
        elif any(word in message_lower for word in ["previsão", "previsao", "prever", "orçamento"]):
            return {'intent': 'previsao_orcamento', 'data': {}}
        
        return None
    
    def _parse_transaction_advanced(self, message: str) -> Optional[Dict]:
        """Parser avançado de transações (baseado no chat antigo)"""
        message_lower = message.lower().strip()
        logger.info(f"📝 Parsing transação para: '{message_lower}'")
        
        # 1. DETECTAR PARCELAMENTO PRIMEIRO
        parcelamento_data = self._detect_parcelamento_advanced(message_lower)
        if parcelamento_data:
            logger.info(f"🔄 Parcelamento detectado: {parcelamento_data}")
            return parcelamento_data
        
        # 2. DETECTAR TRANSAÇÃO SIMPLES
        valor = self._extract_valor_regex(message_lower)
        logger.info(f"💵 Valor extraído: {valor}")
        if not valor:
            return None
        
        tipo = self._detect_tipo_transacao(message_lower)
        logger.info(f"📊 Tipo detectado: {tipo}")
        if not tipo:
            return None
            
        descricao = self._extract_descricao_advanced(message_lower, valor)
        
        # Verificar se descrição é suficiente
        if not descricao or len(descricao) < 2:
            return {
                'valor': valor,
                'tipo': tipo,
                'status': 'requer_descricao'
            }
        
        # Para transações de SAIDA, verificar método de pagamento
        if tipo == "SAIDA":
            cartao_id, conta_id = self._identify_payment_method(message)
            if not cartao_id and not conta_id:
                return {
                    'valor': valor,
                    'tipo': tipo,
                    'descricao': descricao,
                    'status': 'requer_pagamento'
                }
        
        return {
            'valor': valor,
            'tipo': tipo,
            'descricao': descricao,
            'status': 'completo'
        }
    
    def _detect_parcelamento_advanced(self, message: str) -> Optional[Dict]:
        """Detecta parcelamento com padrões avançados"""
        padroes_parcelamento = [
            r'(\d+)x\s*(?:de)?\s*(\d+(?:,\d+)?(?:\.\d+)?)',  # "12x de 100"
            r'(?:em|de)\s*(\d+)\s*(?:parcelas?|vezes?)\s*(?:de)?\s*(\d+(?:,\d+)?(?:\.\d+)?)',
            r'parcel(?:ei|ar|ado)\s*em\s*(\d+)(?:x)?\s*(?:de)?\s*(\d+(?:,\d+)?(?:\.\d+)?)',
            r'(\d+)\s*(?:parcelas?|vezes?)\s*(?:de)?\s*(\d+(?:,\d+)?(?:\.\d+)?)',
            r'dividi(?:r|do)?\s*em\s*(\d+)\s*(?:de)?\s*(\d+(?:,\d+)?(?:\.\d+)?)'
        ]
        
        for padrao in padroes_parcelamento:
            match = re.search(padrao, message)
            if match:
                total_parcelas = int(match.group(1))
                valor_parcela = float(match.group(2).replace(',', '.'))
                
                if total_parcelas > 1:
                    descricao = self._extract_descricao_parcelamento(message, valor_parcela)
                    
                    return {
                        'is_parcelamento': True,
                        'total_parcelas': total_parcelas,
                        'valor_parcela': valor_parcela,
                        'valor_total': valor_parcela * total_parcelas,
                        'descricao': descricao or 'Compra parcelada',
                        'status': 'requer_cartao'
                    }
        
        return None
    
    def _extract_valor_regex(self, message: str) -> Optional[float]:
        """Extrai valor da mensagem"""
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
    
    def _detect_tipo_transacao(self, message: str) -> Optional[str]:
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
        """Extrai descrição avançada"""
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
            'ifood': 'iFood', 'uber': 'Uber', 'mercado': 'Mercado',
            'supermercado': 'Supermercado', 'farmacia': 'Farmácia',
            'gasolina': 'Gasolina', 'salario': 'Salário', 'freela': 'Freelance',
            'freelance': 'Freelance', 'lanchonete': 'Lanchonete',
            'almoço': 'Almoço', 'almoco': 'Almoço', 'jantar': 'Jantar', 'lanche': 'Lanche'
        }
        
        for chave, valor_map in mapeamento.items():
            if chave in message:
                return valor_map
        
        if texto_limpo and len(texto_limpo) > 1:
            return texto_limpo.title()
        
        return ""
    
    def _extract_descricao_parcelamento(self, message: str, valor_parcela: float) -> str:
        """Extrai descrição de parcelamento"""
        texto = message
        texto = re.sub(r'\d+x\s*(?:de)?\s*\d+(?:,\d+)?(?:\.\d+)?', '', texto)
        texto = re.sub(r'(?:em|de)\s*\d+\s*(?:parcelas?|vezes?)', '', texto)
        texto = re.sub(r'parcel(?:ei|ar|ado)', '', texto)
        
        return self._extract_descricao_advanced(texto, valor_parcela)
    
    def _identify_payment_method(self, message: str) -> Tuple[Optional[int], Optional[int]]:
        """Identifica cartão/conta mencionado na mensagem"""
        # TODO: Implementar lógica para identificar cartões/contas por nome
        # Por enquanto retorna None para forçar pergunta
        return None, None
    
    async def _handle_incomplete_transaction(self, data: Dict, user_id: int) -> Dict:
        """Lida com transação com descrição incompleta"""
        valor = data['valor']
        tipo = data['tipo']
        
        # Salvar dados pendentes
        self.pending_transactions[user_id] = data
        self.awaiting_responses[user_id] = 'descricao'
        
        return {
            'resposta': f"Entendi o valor de R$ {valor:.2f}. Mas sobre o que é essa transação? (Ex: mercado, salário, uber...)",
            'fonte': 'mcp_interaction',
            'aguardando': 'descricao'
        }
    
    async def _handle_transaction_needs_payment(self, data: Dict, user_id: int) -> Dict:
        """Lida com transação que precisa de método de pagamento"""
        db = next(get_db())
        try:
            # Buscar cartões e contas do usuário
            cartoes = db.query(Cartao).filter(Cartao.user_id == user_id, Cartao.ativo == True).all()
            contas = db.query(Conta).filter(Conta.user_id == user_id).all()
            
            if not cartoes and not contas:
                return {
                    'resposta': 'Para registrar gastos, você precisa cadastrar pelo menos um cartão ou conta no sistema.',
                    'fonte': 'mcp_interaction'
                }
            
            # Criar lista numerada das opções
            opcoes = []
            indice = 1
            
            if cartoes:
                opcoes.append("**Cartões:**")
                for cartao in cartoes:
                    opcoes.append(f"{indice}. {cartao.nome}")
                    indice += 1
            
            if contas:
                if opcoes:
                    opcoes.append("")
                opcoes.append("**Contas:**")
                for conta in contas:
                    opcoes.append(f"{indice}. {conta.nome}")
                    indice += 1
            
            opcoes_texto = "\n".join(opcoes)
            
            # Salvar dados pendentes
            self.pending_transactions[user_id] = data
            self.awaiting_responses[user_id] = 'pagamento'
            
            descricao = data['descricao']
            valor = data['valor']
            
            return {
                'resposta': f'''🤔 Entendi! **{descricao}** de **R$ {valor:.2f}**

Qual método de pagamento você usou? Responda com o número:

{opcoes_texto}''',
                'fonte': 'mcp_interaction',
                'aguardando': 'pagamento'
            }
        finally:
            db.close()
    
    async def _handle_parcelamento_needs_card(self, data: Dict, user_id: int) -> Dict:
        """Lida com parcelamento que precisa de cartão"""
        db = next(get_db())
        try:
            cartoes = db.query(Cartao).filter(Cartao.user_id == user_id, Cartao.ativo == True).all()
            
            if not cartoes:
                return {
                    'resposta': 'Para fazer parcelamentos, você precisa cadastrar pelo menos um cartão no sistema.',
                    'fonte': 'mcp_interaction'
                }
            
            opcoes = []
            for i, cartao in enumerate(cartoes, 1):
                opcoes.append(f"{i}. {cartao.nome}")
            
            opcoes_texto = "\n".join(opcoes)
            
            # Salvar dados pendentes
            self.pending_transactions[user_id] = data
            self.awaiting_responses[user_id] = 'cartao_parcelamento'
            
            descricao = data['descricao']
            parcelas = data['total_parcelas']
            valor_parcela = data['valor_parcela']
            valor_total = data['valor_total']
            
            return {
                'resposta': f'''💳 **{descricao}** em **{parcelas}x de R$ {valor_parcela:.2f}**
**Total:** R$ {valor_total:.2f}

Em qual cartão você quer parcelar?

{opcoes_texto}''',
                'fonte': 'mcp_interaction',
                'aguardando': 'cartao_parcelamento'
            }
        finally:
            db.close()
    
    async def _handle_complete_transaction(self, data: Dict, user_id: int) -> Dict:
        """Processa transação completa"""
        try:
            # Usar MCP para criar transação
            result = await self.mcp_server.process_request(
                'create_transaction',
                {
                    'descricao': data['descricao'],
                    'valor': data['valor'],
                    'tipo': data['tipo']
                },
                user_id
            )
            
            if result.get('success'):
                transaction_data = result['data']
                return {
                    'resposta': f'''✅ Transação registrada:

📝 **{transaction_data['descricao']}**
💰 **R$ {transaction_data['valor']:.2f}**
🏷️ **{transaction_data.get('categoria', 'Categoria automática')}**

Saldo atualizado!''',
                    'fonte': 'mcp_real_data',
                    'dados_utilizados': result
                }
            else:
                return {
                    'resposta': f"Erro ao criar transação: {result.get('error', 'Erro desconhecido')}",
                    'fonte': 'mcp_error'
                }
                
        except Exception as e:
            return {
                'resposta': f"Erro ao processar transação: {str(e)}",
                'fonte': 'mcp_error'
            }
    
    async def _handle_complete_parcelamento(self, data: Dict, user_id: int) -> Dict:
        """Processa parcelamento completo (quando tem cartão)"""
        # TODO: Implementar criação de parcelamento via MCP
        return {
            'resposta': 'Funcionalidade de parcelamento completo em desenvolvimento.',
            'fonte': 'mcp_interaction'
        }
    
    async def _handle_data_query(self, intent: str, data: Dict, user_id: int) -> Dict:
        """Processa consultas de dados"""
        try:
            if intent == 'consulta_saldo':
                tool_name = 'get_balance'
            elif intent == 'consulta_transacoes':
                tool_name = 'get_transactions'
            elif intent == 'consulta_resumo':
                tool_name = 'get_monthly_summary'
            elif intent == 'analise_gastos':
                tool_name = 'analyze_spending'
            elif intent == 'previsao_orcamento':
                tool_name = 'predict_budget'
            else:
                tool_name = 'get_balance'
            
            result = await self.mcp_server.process_request(tool_name, data, user_id)
            
            if result.get('success'):
                # Gerar resposta natural com IA
                response = await self._generate_response_with_data(intent, result, data)
                return {
                    'resposta': response,
                    'fonte': 'mcp_real_data',
                    'dados_utilizados': result,
                    'intent': intent
                }
            else:
                return {
                    'resposta': f"Erro na consulta: {result.get('error', 'Erro desconhecido')}",
                    'fonte': 'mcp_error'
                }
                
        except Exception as e:
            return {
                'resposta': f"Erro ao consultar dados: {str(e)}",
                'fonte': 'mcp_error'
            }
    
    async def _process_awaited_response(self, message: str, user_id: int, chat_history: List[Dict]) -> Dict:
        """Processa resposta aguardada do usuário"""
        if user_id not in self.awaiting_responses:
            return await self._fallback_chat(message, user_id, chat_history)
        
        awaiting_type = self.awaiting_responses[user_id]
        pending_data = self.pending_transactions.get(user_id, {})
        
        # Limpar estado
        del self.awaiting_responses[user_id]
        if user_id in self.pending_transactions:
            del self.pending_transactions[user_id]
        
        if awaiting_type == 'descricao':
            # Completar transação com nova descrição
            pending_data['descricao'] = message.strip()
            pending_data['status'] = 'completo'
            return await self._handle_complete_transaction(pending_data, user_id)
        
        elif awaiting_type == 'pagamento':
            # Processar seleção de método de pagamento
            # TODO: Implementar identificação por número ou nome
            pending_data['status'] = 'completo'
            return await self._handle_complete_transaction(pending_data, user_id)
        
        elif awaiting_type == 'cartao_parcelamento':
            # Processar seleção de cartão para parcelamento
            # TODO: Implementar seleção de cartão
            return await self._handle_complete_parcelamento(pending_data, user_id)
        
        return await self._fallback_chat(message, user_id, chat_history)
    
    async def _generate_response_with_data(self, intent: str, mcp_result: Dict, original_data: Dict) -> str:
        """Gera resposta natural usando dados MCP"""
        data = mcp_result.get("data", {})
        
        context = f"""
        Dados financeiros reais do usuário:
        {json.dumps(data, indent=2, ensure_ascii=False)}
        
        Tipo de consulta: {intent}
        
        Responda de forma natural e amigável, usando os dados fornecidos.
        Seja específico com números e datas.
        Use emojis quando apropriado.
        """
        
        messages = [
            {"role": "system", "content": "Você é um assistente financeiro que responde com dados reais do usuário."},
            {"role": "user", "content": context}
        ]
        
        response = await self.client.chat.completions.create(
            model="gpt-4",
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    
    async def _fallback_chat(self, message: str, user_id: int, chat_history: List[Dict] = None) -> Dict:
        """Chat genérico quando não detecta intenção específica"""
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
        year_match = re.search(r'\b(20\d{2})\b', message)
        if year_match:
            params["ano"] = int(year_match.group(1))
        
        return params

# Instância global do serviço inteligente
smart_mcp_service = SmartMCPService() 