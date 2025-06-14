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
    
    async def process_message(self, message: str, user_id: int, chat_history: List[Dict] = None, telegram_user_name: str = None) -> Dict[str, Any]:
        """Processa mensagem com lógica inteligente completa"""
        try:
            logger.info(f"🔍 Smart MCP processando: '{message}' para user_id: {user_id}")
            
            # 1. VERIFICAR SE É RESPOSTA A PERGUNTA ANTERIOR
            if user_id in self.awaiting_responses:
                logger.info(f"🔄 Processando resposta aguardada para user_id: {user_id}")
                return await self._process_awaited_response(message, user_id, chat_history, telegram_user_name)
            
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
            
            # Adicionar nome do usuário do Telegram se disponível
            if telegram_user_name:
                data['created_by_name'] = telegram_user_name
            
            # 3. PROCESSAR BASEADO NA INTENÇÃO
            if intent == 'transacao_incompleta':
                return await self._handle_incomplete_transaction(data, user_id)
            
            elif intent == 'transacao_sem_pagamento':
                return await self._handle_transaction_needs_payment(data, user_id)
            
            elif intent == 'transacao_sem_conta':
                return await self._handle_transaction_needs_account(data, user_id)
            
            elif intent == 'parcelamento_sem_cartao':
                return await self._handle_parcelamento_needs_card(data, user_id)
            
            elif intent == 'transacao_completa':
                return await self._handle_complete_transaction(data, user_id)
                
            elif intent == 'parcelamento_completo':
                return await self._handle_complete_parcelamento(data, user_id)
            
            elif intent in ['consulta_transacoes', 'consulta_saldo', 'consulta_resumo', 'analise_gastos', 'previsao_orcamento']:
                return await self._handle_data_query(intent, data, user_id)
                
            elif intent == 'correcao_transacao':
                return await self._handle_correction(data, user_id)
                
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
        transaction_data = self._parse_transaction_advanced(message, user_id)
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
                elif transaction_data.get('status') == 'requer_conta':
                    return {
                        'intent': 'transacao_sem_conta',
                        'data': transaction_data
                    }
                else:
                    return {
                        'intent': 'transacao_completa',
                        'data': transaction_data
                    }
        
        # 2. DETECTAR CORREÇÕES PRIMEIRO (prioridade alta)
        message_lower = message.lower()
        
        if any(word in message_lower for word in ["corrig", "edit", "alter", "mude", "mudança", "fix"]):
            correction_data = self._parse_correction_intent(message)
            return {'intent': 'correcao_transacao', 'data': correction_data}
        
        # 3. DETECTAR CONSULTAS
        if any(word in message_lower for word in ["transaç", "gasto", "despesa", "compra", "últim"]):
            params = self._extract_transaction_params(message)
            return {'intent': 'consulta_transacoes', 'data': params}
            
        elif any(word in message_lower for word in ["saldo", "quanto tenho", "dinheiro", "sobrou"]):
            return {'intent': 'consulta_saldo', 'data': {}}
            
        elif any(word in message_lower for word in ["resumo", "relatório", "mês", "mensal", "semana", "semanal", "diário", "diario", "hoje", "ontem", "quanto gastei"]):
            params = self._extract_period_params(message)
            return {'intent': 'consulta_resumo', 'data': params}
            
        elif any(word in message_lower for word in ["análise", "analise", "analisa"]):
            params = self._extract_period_params(message)
            return {'intent': 'analise_gastos', 'data': params}
            
        elif any(word in message_lower for word in ["previsão", "previsao", "prever", "orçamento"]):
            return {'intent': 'previsao_orcamento', 'data': {}}
        
        return None
    
    def _parse_transaction_advanced(self, message: str, user_id: int) -> Optional[Dict]:
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
        
        # Verificar método de pagamento/destino baseado no tipo
        cartao_id = None
        conta_id = None
        
        if tipo == "SAIDA":
            # Para gastos, identificar cartão ou conta de origem
            cartao_id, conta_id = self._identify_payment_method(message, user_id)
            if not cartao_id and not conta_id:
                return {
                    'valor': valor,
                    'tipo': tipo,
                    'descricao': descricao,
                    'status': 'requer_pagamento'
                }
        elif tipo == "ENTRADA":
            # Para entradas, identificar conta de destino
            conta_id = self._identify_destination_account(message, user_id)
            if not conta_id:
                return {
                    'valor': valor,
                    'tipo': tipo,
                    'descricao': descricao,
                    'status': 'requer_conta'
                }
        
        # Se chegou aqui, identificou método/destino correto
        return {
            'valor': valor,
            'tipo': tipo,
            'descricao': descricao,
            'cartao_id': cartao_id,
            'conta_id': conta_id,
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
            r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:reais?|r\$|real)',  # "50 reais", "100,50 real"
            r'r\$\s*(\d+(?:,\d+)?(?:\.\d+)?)',                  # "R$ 50", "R$ 100,50"
            r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:conto|pila|mangos?)',  # "50 contos"
            r'(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)$',              # "230,26", "1.051,37" no final
            r'(\d+(?:,\d+)?(?:\.\d+)?)'                         # qualquer número
        ]
        
        # Buscar todos os valores possíveis
        valores_encontrados = []
        for padrao in padroes_valor:
            matches = re.findall(padrao, message)
            for match in matches:
                try:
                    # Converter formato brasileiro para float
                    valor_str = match.replace('.', '').replace(',', '.')  # "1.051,37" -> "1051.37"
                    valor = float(valor_str)
                    if valor > 0:  # Só valores positivos
                        valores_encontrados.append(valor)
                except:
                    continue
        
        # Retornar o maior valor encontrado (geralmente é o valor principal)
        return max(valores_encontrados) if valores_encontrados else None
    
    def _detect_tipo_transacao(self, message: str) -> Optional[str]:
        """Detecta tipo de transação"""
        palavras_entrada = ['recebi', 'ganhei', 'entrou', 'salario', 'salário', 'renda', 'freelance', 'freela']
        palavras_saida = ['gastei', 'gaste', 'paguei', 'pague', 'comprei', 'compre', 'saiu', 'despesa', 'gasto']
        
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
        
        # Remove caracteres especiais problemáticos mas preserva acentos
        texto_limpo = re.sub(r'[!@#$%^&*()_+=\[\]{}|;\':"\\,.<>?/~`]', ' ', texto_limpo)
        
        # Remove palavras de ação
        palavras_acao = ['gastei', 'gaste', 'paguei', 'pague', 'comprei', 'compre', 'recebi', 'ganhei', 'saiu', 'entrou', 'de', 'no', 'na', 'com', 'para', 'em']
        for palavra in palavras_acao:
            texto_limpo = re.sub(rf'\b{palavra}\b', '', texto_limpo, flags=re.IGNORECASE)
        
        # Remove preposições e artigos
        texto_limpo = re.sub(r'\b(o|a|os|as|um|uma|de|da|do|das|dos|em|na|no|nas|nos|com|para|por)\b', '', texto_limpo, flags=re.IGNORECASE)
        
        # Limpa espaços extras
        texto_limpo = ' '.join(texto_limpo.split())
        
        # Casos especiais conhecidos
        mapeamento = {
            'ifood': 'iFood', 'uber': 'Uber', 'mercado': 'Mercado',
            'supermercado': 'Supermercado', 'farmacia': 'Farmácia',
            'gasolina': 'Gasolina', 'salario': 'Salário', 'freela': 'Freelance',
            'freelance': 'Freelance', 'lanchonete': 'Lanchonete',
            'almoço': 'Almoço', 'almoco': 'Almoço', 'jantar': 'Jantar', 'lanche': 'Lanche',
            'dízimo': 'Dízimo', 'dizimo': 'Dízimo', 'vó': 'Presente da Vó', 'avo': 'Presente da Avó',
            'minha vó': 'Presente da Vó', 'minha avo': 'Presente da Avó'
        }
        
        # Verificar mapeamento primeiro
        message_lower = message.lower()
        for chave, valor_map in mapeamento.items():
            if chave in message_lower:
                return valor_map
        
        # Se texto limpo é válido, usar ele
        if texto_limpo and len(texto_limpo.strip()) > 1:
            # Capitalizar primeira letra de cada palavra
            return ' '.join(word.capitalize() for word in texto_limpo.split())
        
        # Fallback: tentar extrair palavras significativas da mensagem original
        palavras = message.split()
        palavras_filtradas = []
        for palavra in palavras:
            palavra_limpa = re.sub(r'[^\w\sáàâãéèêíìîóòôõúùûüç]', '', palavra, flags=re.IGNORECASE)
            if (len(palavra_limpa) > 2 and 
                not any(char.isdigit() for char in palavra_limpa) and
                palavra_limpa.lower() not in ['gastei', 'ganhei', 'recebi', 'paguei', 'reais', 'real']):
                palavras_filtradas.append(palavra_limpa.capitalize())
        
        if palavras_filtradas:
            return ' '.join(palavras_filtradas[:3])  # Máximo 3 palavras
        
        return "Transação"
    
    def _extract_descricao_parcelamento(self, message: str, valor_parcela: float) -> str:
        """Extrai descrição de parcelamento"""
        texto = message
        texto = re.sub(r'\d+x\s*(?:de)?\s*\d+(?:,\d+)?(?:\.\d+)?', '', texto)
        texto = re.sub(r'(?:em|de)\s*\d+\s*(?:parcelas?|vezes?)', '', texto)
        texto = re.sub(r'parcel(?:ei|ar|ado)', '', texto)
        
        return self._extract_descricao_advanced(texto, valor_parcela)
    
    async def _find_or_create_smart_category(self, descricao: str, user_id: int) -> int:
        """Encontra ou cria categoria inteligente - VERSÃO MELHORADA"""
        logger.info(f"🔍 Buscando categoria INTELIGENTE para: '{descricao}', user_id: {user_id}")
        db = next(get_db())
        try:
            descricao_lower = descricao.lower()
            
            # 1. PRIMEIRO: Buscar entre categorias EXISTENTES do usuário
            categorias_existentes = db.query(Categoria).filter(
                Categoria.tenant_id == user_id
            ).all()
            
            if categorias_existentes:
                melhor_match = self._find_best_existing_category(descricao_lower, categorias_existentes)
                if melhor_match:
                    logger.info(f"✅ Categoria existente reutilizada: '{descricao}' → {melhor_match.nome}")
                    return melhor_match.id
            
            # 2. SEGUNDO: Mapear para categorias PADRÃO inteligentes
            categoria_padrao = self._map_to_standard_category(descricao_lower)
            if categoria_padrao:
                # Verificar se categoria padrão já existe
                categoria_existente = db.query(Categoria).filter(
                    Categoria.tenant_id == user_id,
                    Categoria.nome == categoria_padrao
                ).first()
                
                if categoria_existente:
                    logger.info(f"🎯 Categoria padrão existente: '{descricao}' → {categoria_padrao}")
                    return categoria_existente.id
                else:
                    # Criar categoria padrão
                    nova_categoria = Categoria(
                        tenant_id=user_id,
                        nome=categoria_padrao
                    )
                    db.add(nova_categoria)
                    db.commit()
                    db.refresh(nova_categoria)
                    logger.info(f"🆕 Categoria padrão criada: '{descricao}' → {categoria_padrao}")
                    return nova_categoria.id
            
            # 3. ÚLTIMO RECURSO: Usar categoria "Compras" genérica
            categoria_generica = "Compras"
            categoria_existente = db.query(Categoria).filter(
                Categoria.tenant_id == user_id,
                Categoria.nome == categoria_generica
            ).first()
            
            if categoria_existente:
                logger.info(f"🔧 Usando categoria genérica existente: '{descricao}' → {categoria_generica}")
                return categoria_existente.id
            else:
                # Criar categoria genérica
                nova_categoria = Categoria(
                    tenant_id=user_id,
                    nome=categoria_generica
                )
                db.add(nova_categoria)
                db.commit()
                db.refresh(nova_categoria)
                logger.info(f"🛒 Categoria genérica criada: '{descricao}' → {categoria_generica}")
                return nova_categoria.id
            
        finally:
            db.close()
    
    def _find_best_existing_category(self, descricao: str, categorias_existentes) -> Optional[any]:
        """Encontra a melhor categoria existente para a descrição"""
        # Mapeamento inteligente de palavras para categorias existentes
        mapeamentos = {
            # Alimentação
            'alimentação': ['café', 'coffee', 'restaurante', 'comida', 'lanche', 'mercado', 'supermercado', 'ifood', 'delivery', 'pizza', 'hamburger', 'açougue', 'padaria', 'hortifruti'],
            'alimentacao': ['café', 'coffee', 'restaurante', 'comida', 'lanche', 'mercado', 'supermercado', 'ifood', 'delivery', 'pizza', 'hamburger', 'açougue', 'padaria', 'hortifruti'],
            'comida': ['café', 'coffee', 'restaurante', 'comida', 'lanche', 'mercado', 'supermercado', 'ifood', 'delivery', 'pizza', 'hamburger', 'açougue', 'padaria', 'hortifruti'],
            
            # Casa e Pet
            'casa': ['tapetinho', 'tapete', 'decoração', 'decoracao', 'móvel', 'movel', 'limpeza', 'cozinha', 'banheiro'],
            'pet': ['cachorro', 'gato', 'ração', 'racao', 'petisco', 'brinquedo pet', 'veterinário', 'veterinario', 'tapetinho'],
            'animals': ['cachorro', 'gato', 'ração', 'racao', 'petisco', 'brinquedo pet', 'veterinário', 'veterinario', 'tapetinho'],
            
            # Transporte  
            'transporte': ['uber', 'taxi', '99', 'gasolina', 'combustível', 'combustivel', 'ônibus', 'onibus', 'metro', 'metrô'],
            
            # Vestuário
            'roupa': ['camisa', 'calça', 'calca', 'vestido', 'sapato', 'tênis', 'tenis', 'shorts', 'blusa'],
            'vestuário': ['camisa', 'calça', 'calca', 'vestido', 'sapato', 'tênis', 'tenis', 'shorts', 'blusa'],
            'vestuario': ['camisa', 'calça', 'calca', 'vestido', 'sapato', 'tênis', 'tenis', 'shorts', 'blusa'],
            
            # Lazer
            'lazer': ['cinema', 'bar', 'festa', 'show', 'game', 'jogo', 'netflix', 'spotify'],
            'entretenimento': ['cinema', 'bar', 'festa', 'show', 'game', 'jogo', 'netflix', 'spotify'],
            
            # Saúde
            'saúde': ['farmácia', 'farmacia', 'remédio', 'remedio', 'médico', 'medico', 'consulta', 'exame'],
            'saude': ['farmácia', 'farmacia', 'remédio', 'remedio', 'médico', 'medico', 'consulta', 'exame']
        }
        
        # Para cada categoria existente, ver se faz match
        for categoria in categorias_existentes:
            nome_categoria_lower = categoria.nome.lower()
            
            # Match direto com mapeamento
            if nome_categoria_lower in mapeamentos:
                palavras_relacionadas = mapeamentos[nome_categoria_lower]
                for palavra in palavras_relacionadas:
                    if palavra in descricao:
                        return categoria
            
            # Match por similaridade de palavras
            palavras_descricao = descricao.split()
            palavras_categoria = nome_categoria_lower.split()
            
            for palavra_desc in palavras_descricao:
                for palavra_cat in palavras_categoria:
                    if len(palavra_desc) > 3 and len(palavra_cat) > 3:
                        if palavra_desc in palavra_cat or palavra_cat in palavra_desc:
                            return categoria
        
        return None
    
    def _map_to_standard_category(self, descricao: str) -> Optional[str]:
        """Mapeia descrição para categorias padrão inteligentes"""
        categorias_inteligentes = {
            'Alimentação': [
                'café', 'coffee', 'restaurante', 'comida', 'lanche', 'almoço', 'almoco', 'jantar', 
                'padaria', 'ifood', 'delivery', 'pizza', 'hamburger', 'hamburguer', 'açougue', 
                'mercado', 'supermercado', 'hortifruti', 'verdura', 'fruta', 'bebida', 'cerveja'
            ],
            'Transporte': [
                'uber', 'taxi', '99', 'gasolina', 'combustível', 'combustivel', 'ônibus', 'onibus', 
                'metro', 'metrô', 'passagem', 'viagem', 'estacionamento', 'carro', 'moto'
            ],
            'Casa': [
                'tapetinho', 'tapete', 'decoração', 'decoracao', 'móvel', 'movel', 'limpeza', 
                'cozinha', 'banheiro', 'casa', 'eletrodoméstico', 'eletrodomestico', 'luz', 
                'água', 'agua', 'gás', 'gas', 'condomínio', 'condominio'
            ],
            'Pet': [
                'cachorro', 'gato', 'ração', 'racao', 'petisco', 'brinquedo pet', 'veterinário', 
                'veterinario', 'tapetinho cachorro', 'coleira', 'casinha'
            ],
            'Vestuário': [
                'roupa', 'camisa', 'calça', 'calca', 'vestido', 'sapato', 'tênis', 'tenis', 
                'shorts', 'blusa', 'casaco', 'jaqueta', 'meia', 'cueca', 'calcinha'
            ],
            'Lazer': [
                'cinema', 'teatro', 'show', 'festa', 'bar', 'balada', 'game', 'jogo', 
                'streaming', 'netflix', 'spotify', 'youtube', 'diversão', 'diversao'
            ],
            'Saúde': [
                'farmácia', 'farmacia', 'medicamento', 'remédio', 'remedio', 'médico', 'medico', 
                'consulta', 'exame', 'hospital', 'dentista', 'psicólogo', 'psicologo'
            ],
            'Educação': [
                'curso', 'livro', 'escola', 'faculdade', 'universidade', 'material', 
                'caneta', 'caderno', 'educação', 'educacao', 'aula'
            ],
            'Tecnologia': [
                'celular', 'smartphone', 'iphone', 'android', 'computador', 'notebook', 
                'tablet', 'fone', 'carregador', 'cabo', 'mouse', 'teclado'
            ]
        }
        
        # Buscar match mais específico primeiro
        for categoria, palavras in categorias_inteligentes.items():
            for palavra in palavras:
                if palavra in descricao:
                    return categoria
        
        return None
    


    def _identify_payment_method(self, message: str, user_id: int) -> Tuple[Optional[int], Optional[int]]:
        """Identifica cartão/conta mencionado na mensagem"""
        message_lower = message.lower()
        
        db = next(get_db())
        try:
            # Buscar cartões do usuário
            cartoes = db.query(Cartao).filter(
                Cartao.tenant_id == user_id,
                Cartao.ativo == True
            ).all()
            
            # Buscar contas do usuário  
            contas = db.query(Conta).filter(
                Conta.tenant_id == user_id
            ).all()
            
            # Padrões para detectar cartões
            padroes_cartao = [
                r'\bno\s+(\w+)',           # "no Nubank", "no Inter"
                r'\bcartão\s+(\w+)',       # "cartão Nubank"
                r'\bcartao\s+(\w+)',       # "cartao Inter"
                r'\bcard\s+(\w+)',         # "card Nubank"
                r'\bcom\s+(\w+)',          # "com Nubank"
            ]
            
            # Padrões para detectar contas
            padroes_conta = [
                r'\bna\s+conta\s+(\w+)',   # "na conta Bradesco"
                r'\bconta\s+(\w+)',        # "conta Inter"
                r'\bbanco\s+(\w+)',        # "banco Bradesco"
                r'\bpix\s+(\w+)',          # "pix Nubank"
            ]
            
            # Verificar cartões primeiro
            for padrao in padroes_cartao:
                import re
                match = re.search(padrao, message_lower)
                if match:
                    nome_mencionado = match.group(1)
                    
                    # Buscar cartão por nome (exato ou similar)
                    for cartao in cartoes:
                        if (nome_mencionado.lower() in cartao.nome.lower() or 
                            cartao.nome.lower() in nome_mencionado.lower()):
                            logger.info(f"✅ Cartão detectado: '{nome_mencionado}' → {cartao.nome}")
                            return cartao.id, None
            
            # Verificar contas
            for padrao in padroes_conta:
                match = re.search(padrao, message_lower)
                if match:
                    nome_mencionado = match.group(1)
                    
                    # Buscar conta por nome
                    for conta in contas:
                        if (nome_mencionado.lower() in conta.nome.lower() or 
                            conta.nome.lower() in nome_mencionado.lower()):
                            logger.info(f"✅ Conta detectada: '{nome_mencionado}' → {conta.nome}")
                            return None, conta.id
            
            # Se não encontrou nada específico, retornar None (pergunta manual)
            return None, None
            
        finally:
            db.close()
    
    def _identificar_cartao_por_numero_ou_nome(self, message: str, user_id: int) -> Optional[int]:
        """Identifica cartão por número parcial ou nome"""
        from ..database import get_db
        from ..models.financial import Cartao
        
        db = next(get_db())
        try:
            cartoes = db.query(Cartao).filter(Cartao.tenant_id == user_id, Cartao.ativo == True).all()
            
            if not cartoes:
                return None
            
            message_clean = message.lower()
            
            # 1. Buscar por final do cartão (últimos 4 dígitos)
            numeros = re.findall(r'\d{4}', message)
            for numero in numeros:
                for cartao in cartoes:
                    if cartao.numero_final and cartao.numero_final.endswith(numero):
                        return cartao.id
            
            # 2. Buscar por nome/apelido do cartão
            for cartao in cartoes:
                nome_cartao = cartao.nome.lower()
                # Match exato do nome
                if nome_cartao in message_clean:
                    return cartao.id
                
                # Match de palavras do nome
                palavras_cartao = nome_cartao.split()
                for palavra in palavras_cartao:
                    if palavra in message_clean and len(palavra) > 2:
                        return cartao.id
            
            # 3. Detectar bandeiras conhecidas
            bandeiras = {
                'visa': ['visa'],
                'mastercard': ['master', 'mastercard'],
                'elo': ['elo'],
                'amex': ['amex', 'american', 'express'],
                'nubank': ['nubank', 'roxinho'],
                'itau': ['itau', 'itaú'],
                'bradesco': ['bradesco'],
                'santander': ['santander'],
                'bb': ['banco do brasil', 'bb'],
                'caixa': ['caixa']
            }
            
            for cartao in cartoes:
                nome_lower = cartao.nome.lower()
                for bandeira, palavras in bandeiras.items():
                    if any(palavra in nome_lower for palavra in palavras):
                        if any(palavra in message_clean for palavra in palavras):
                            return cartao.id
            
            return None
            
        finally:
            db.close()

    def _identify_destination_account(self, message: str, user_id: int) -> Optional[int]:
        """Identifica conta de destino para transações de entrada"""
        from ..database import get_db
        from ..models.financial import Conta
        
        db = next(get_db())
        try:
            contas = db.query(Conta).filter(Conta.tenant_id == user_id).all()
            
            if not contas:
                return None
            
            message_clean = message.lower()
            
            # 1. Buscar por nome específico da conta
            for conta in contas:
                nome_conta = conta.nome.lower()
                if nome_conta in message_clean:
                    return conta.id
                
                # Match de palavras do nome
                palavras_conta = nome_conta.split()
                for palavra in palavras_conta:
                    if palavra in message_clean and len(palavra) > 2:
                        return conta.id
            
            # 2. Detectar bancos conhecidos
            bancos = {
                'nubank': ['nubank', 'nu'],
                'itau': ['itau', 'itaú'],
                'bradesco': ['bradesco'],
                'santander': ['santander'],
                'bb': ['banco do brasil', 'bb'],
                'caixa': ['caixa'],
                'inter': ['inter'],
                'original': ['original'],
                'c6': ['c6', 'c6 bank'],
                'next': ['next'],
                'picpay': ['picpay', 'pic pay']
            }
            
            for conta in contas:
                nome_lower = conta.nome.lower()
                for banco, palavras in bancos.items():
                    if any(palavra in nome_lower for palavra in palavras):
                        if any(palavra in message_clean for palavra in palavras):
                            return conta.id
            
            # 3. Se só tem uma conta, usar ela
            if len(contas) == 1:
                return contas[0].id
            
            return None
            
        finally:
            db.close()

    async def _handle_transaction_needs_account(self, data: Dict, user_id: int) -> Dict:
        """Processa transação de entrada que precisa especificar conta"""
        try:
            from ..database import get_db
            from ..models.financial import Conta
            
            # Salvar transação pendente
            self.pending_transactions[user_id] = data
            self.awaiting_responses[user_id] = 'conta'
            
            # Buscar contas disponíveis
            db = next(get_db())
            try:
                contas = db.query(Conta).filter(Conta.tenant_id == user_id).all()
            finally:
                db.close()
            
            if not contas:
                return {
                    'resposta': '❌ Você não tem contas cadastradas. Cadastre uma conta primeiro na aplicação web.',
                    'fonte': 'mcp_error'
                }
            
            # Criar lista numerada das contas
            contas_numeradas = []
            for i, conta in enumerate(contas, 1):
                contas_numeradas.append(f"{i}. {conta.nome}")
            
            contas_texto = "\n".join(contas_numeradas)
            
            return {
                'resposta': f"""💰 *Entrada de R$ {data['valor']:.2f}* detectada!
📝 *Descrição:* {data['descricao']}

🏦 *Em qual conta você recebeu?*

*Contas disponíveis:*
{contas_texto}

💡 *Responda com o número ou nome da conta*
Exemplo: "1" ou "Nubank"
""",
                'fonte': 'mcp_interaction'
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao processar entrada sem conta: {str(e)}")
            return {
                'resposta': "❌ Erro ao processar entrada. Tente novamente.",
                'fonte': 'mcp_error'
            }
    
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
            cartoes = db.query(Cartao).filter(Cartao.tenant_id == user_id, Cartao.ativo == True).all()
            contas = db.query(Conta).filter(Conta.tenant_id == user_id).all()
            
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
                'resposta': f"🤔 Entendi! {descricao} de R$ {valor:.2f}. Qual método de pagamento? {opcoes_texto}",
                'fonte': 'mcp_interaction',
                'aguardando': 'pagamento'
            }
        finally:
            db.close()
    
    async def _handle_parcelamento_needs_card(self, data: Dict, user_id: int) -> Dict:
        """Lida com parcelamento que precisa de cartão"""
        db = next(get_db())
        try:
            cartoes = db.query(Cartao).filter(Cartao.tenant_id == user_id, Cartao.ativo == True).all()
            
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
                'resposta': f"💳 {descricao} em {parcelas}x de R$ {valor_parcela:.2f} (Total: R$ {valor_total:.2f}). Em qual cartão? {opcoes_texto}",
                'fonte': 'mcp_interaction',
                'aguardando': 'cartao_parcelamento'
            }
        finally:
            db.close()
    
    async def _handle_complete_transaction(self, data: Dict, user_id: int) -> Dict:
        """Processa transação completa"""
        try:
            # CATEGORIZAÇÃO INTELIGENTE - buscar nome da categoria
            categoria_id = await self._find_or_create_smart_category(data['descricao'], user_id)
            
            # Buscar nome da categoria para passar ao MCP
            db = next(get_db())
            try:
                categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
                categoria_nome = categoria.nome if categoria else None
            finally:
                db.close()
            
            # Preparar dados da transação
            transaction_params = {
                'descricao': data['descricao'],
                'valor': data['valor'],
                'tipo': data['tipo'],
                'categoria': categoria_nome  # Usar nome da categoria (não ID)
            }
            
            # Adicionar método de pagamento se identificado
            if data.get('cartao_id'):
                transaction_params['cartao_id'] = data['cartao_id']
            if data.get('conta_id'):
                transaction_params['conta_id'] = data['conta_id']
            
            # Adicionar nome do usuário que criou a transação (se disponível)
            if data.get('created_by_name'):
                transaction_params['created_by_name'] = data['created_by_name']
            
            result = await self.mcp_server.process_request(
                'create_transaction',
                transaction_params,
                user_id
            )
            
            if result.get('success'):
                transaction_data = result['data']
                resposta_final = f"✅ Transação registrada! {transaction_data['descricao']} - R$ {transaction_data['valor']:.2f} ({transaction_data.get('categoria', 'Categoria automática')})"
                logger.info(f"📊 Resposta final gerada: {repr(resposta_final)}")
                return {
                    'resposta': resposta_final,
                    'fonte': 'mcp_real_data',
                    'dados_utilizados': result
                }
            else:
                return {
                    'resposta': "❌ Erro ao criar transacao. Tente novamente.",
                    'fonte': 'mcp_error'
                }
                
        except Exception as e:
            return {
                'resposta': "❌ Erro ao processar transacao. Tente novamente.",
                'fonte': 'mcp_error'
            }
    
    async def _handle_complete_parcelamento(self, data: Dict, user_id: int) -> Dict:
        """Processa parcelamento completo (quando tem cartão)"""
        try:
            from datetime import datetime
            from ..api.parcelas import criar_compra_parcelada
            from ..schemas.financial import CompraParceladaCompleta
            
            # Criar usuário fictício para API (como no sistema antigo)
            class TempUser:
                def __init__(self, tenant_id: int):
                    self.tenant_id = tenant_id
            
            # Obter primeiro cartão ativo (simplificado)
            db = next(get_db())
            try:
                cartao = db.query(Cartao).filter(
                    Cartao.tenant_id == user_id,
                    Cartao.ativo == True
                ).first()
                
                if not cartao:
                    return {
                        'resposta': '❌ Você precisa ter pelo menos um cartão cadastrado.',
                        'fonte': 'mcp_error'
                    }
                
                # Determinar categoria automaticamente
                categoria = db.query(Categoria).filter(
                    Categoria.tenant_id == user_id
                ).first()
                
                if not categoria:
                    # Criar categoria padrão
                    categoria = Categoria(
                        nome="Compras",
                        tenant_id=user_id
                    )
                    db.add(categoria)
                    db.commit()
                    db.refresh(categoria)
                
                # Criar objeto para API
                compra_data = CompraParceladaCompleta(
                    descricao=data['descricao'],
                    valor_total=data['valor_total'],
                    total_parcelas=data['total_parcelas'],
                    cartao_id=cartao.id,
                    data_primeira_parcela=datetime.now(),
                    categoria_id=categoria.id
                )
                
                # Determinar o nome do criador
                created_by_name = "Sistema - Parcelamento"
                if data.get('created_by_name'):
                    created_by_name = data['created_by_name']
                
                # Chamar API para criar compra parcelada
                current_user = TempUser(user_id)
                compra_parcelada = criar_compra_parcelada(
                    compra_data=compra_data,
                    db=db,
                    current_user=current_user,
                    created_by_name=created_by_name
                )
                
                return {
                    'resposta': f"🎉 Parcelamento criado! {data['descricao']} - R$ {data['valor_total']:.2f} em {data['total_parcelas']}x de R$ {data['valor_parcela']:.2f} no {cartao.nome}",
                    'fonte': 'mcp_real_data',
                    'parcelamento_criado': True,
                    'compra_parcelada_id': compra_parcelada.id
                }
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"❌ Erro ao criar parcelamento: {str(e)}")
            return {
                'resposta': f'❌ Erro ao criar parcelamento: {str(e)}',
                'fonte': 'mcp_error'
            }
    
    async def _handle_data_query(self, intent: str, data: Dict, user_id: int) -> Dict:
        """Processa consultas de dados"""
        try:
            logger.info(f"🔍 Processando consulta: {intent} com data: {data}")
            
            # Mapear intent para tool MCP correto
            if intent == 'consulta_saldo':
                tool_name = 'get_balance'
            elif intent == 'consulta_transacoes':
                tool_name = 'get_transactions'
            elif intent == 'consulta_resumo':
                # Decidir tool baseado no período solicitado
                periodo = data.get('periodo', '30d')
                if periodo in ['1d', '7d']:
                    # Para períodos curtos, usar get_transactions
                    tool_name = 'get_transactions'
                    if not data.get('limit'):
                        data['limit'] = 50  # Limite maior para resumos
                else:
                    # Para períodos longos (mês), usar get_monthly_summary
                    tool_name = 'get_monthly_summary'
                    # Converter período para mes/ano se necessário
                    if 'mes' not in data:
                        from datetime import datetime
                        now = datetime.now()
                        data['mes'] = now.month
                        data['ano'] = now.year
            elif intent == 'analise_gastos':
                tool_name = 'analyze_spending'
            elif intent == 'previsao_orcamento':
                tool_name = 'predict_budget'
            else:
                tool_name = 'get_balance'
            
            logger.info(f"🛠️ Chamando MCP tool: {tool_name} com params: {data}")
            result = await self.mcp_server.process_request(tool_name, data, user_id)
            logger.info(f"📊 Resultado MCP: {result}")
            
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
                error_msg = result.get('error', 'Erro desconhecido')
                logger.error(f"❌ Erro MCP: {error_msg}")
                return {
                    'resposta': f"Erro na consulta: {error_msg}",
                    'fonte': 'mcp_error'
                }
                
        except Exception as e:
            logger.error(f"❌ Erro ao consultar dados: {str(e)}")
            return {
                'resposta': f"Erro ao consultar dados: {str(e)}",
                'fonte': 'mcp_error'
            }
    
    async def _process_awaited_response(self, message: str, user_id: int, chat_history: List[Dict], telegram_user_name: str = None) -> Dict:
        """Processa resposta aguardada do usuário"""
        if user_id not in self.awaiting_responses:
            return await self._fallback_chat(message, user_id, chat_history)
        
        awaiting_type = self.awaiting_responses[user_id]
        pending_data = self.pending_transactions.get(user_id, {})
        
        # Limpar estado
        del self.awaiting_responses[user_id]
        if user_id in self.pending_transactions:
            del self.pending_transactions[user_id]
        
        # Adicionar nome do usuário do Telegram se disponível
        if telegram_user_name:
            pending_data['created_by_name'] = telegram_user_name
        
        if awaiting_type == 'descricao':
            # Completar transação com nova descrição
            pending_data['descricao'] = message.strip()
            pending_data['status'] = 'completo'
            return await self._handle_complete_transaction(pending_data, user_id)
        
        elif awaiting_type == 'pagamento':
            # Processar seleção de método de pagamento
            db = next(get_db())
            try:
                # Buscar cartões e contas do usuário
                cartoes = db.query(Cartao).filter(Cartao.tenant_id == user_id, Cartao.ativo == True).all()
                contas = db.query(Conta).filter(Conta.tenant_id == user_id).all()
                
                # Tentar identificar por número
                try:
                    numero = int(message.strip())
                    indice = numero - 1  # Converter para índice 0-based
                    
                    # Determinar se é cartão ou conta
                    total_cartoes = len(cartoes)
                    
                    if 0 <= indice < total_cartoes:
                        # É um cartão
                        cartao_selecionado = cartoes[indice]
                        pending_data['cartao_id'] = cartao_selecionado.id
                        logger.info(f"✅ Cartão selecionado por número {numero}: {cartao_selecionado.nome}")
                    elif 0 <= (indice - total_cartoes) < len(contas):
                        # É uma conta
                        conta_selecionada = contas[indice - total_cartoes]
                        pending_data['conta_id'] = conta_selecionada.id
                        logger.info(f"✅ Conta selecionada por número {numero}: {conta_selecionada.nome}")
                    else:
                        return {
                            'resposta': f'❌ Número {numero} inválido. Por favor, escolha um número entre 1 e {total_cartoes + len(contas)}.',
                            'fonte': 'mcp_interaction'
                        }
                        
                except ValueError:
                    # Não é um número, tentar identificar por nome
                    cartao_id = self._identificar_cartao_por_numero_ou_nome(message, user_id)
                    if cartao_id:
                        pending_data['cartao_id'] = cartao_id
                    else:
                        return {
                            'resposta': '❌ Método de pagamento não reconhecido. Tente novamente com o número ou nome.',
                            'fonte': 'mcp_interaction'
                        }
                
                pending_data['status'] = 'completo'
                return await self._handle_complete_transaction(pending_data, user_id)
                
            finally:
                db.close()
        
        elif awaiting_type == 'conta':
            # Processar seleção de conta para entrada
            db = next(get_db())
            try:
                # Buscar contas do usuário
                contas = db.query(Conta).filter(Conta.tenant_id == user_id).all()
                
                # Tentar identificar por número primeiro
                try:
                    numero = int(message.strip())
                    indice = numero - 1  # Converter para índice 0-based
                    
                    if 0 <= indice < len(contas):
                        # É uma conta válida
                        conta_selecionada = contas[indice]
                        pending_data['conta_id'] = conta_selecionada.id
                        pending_data['status'] = 'completo'
                        logger.info(f"✅ Conta selecionada por número {numero}: {conta_selecionada.nome}")
                        return await self._handle_complete_transaction(pending_data, user_id)
                    else:
                        return {
                            'resposta': f'❌ Número {numero} inválido. Por favor, escolha um número entre 1 e {len(contas)}.',
                            'fonte': 'mcp_interaction'
                        }
                        
                except ValueError:
                    # Não é um número, tentar identificar por nome
                    conta_id = self._identify_destination_account(message, user_id)
                    if conta_id:
                        pending_data['conta_id'] = conta_id
                        pending_data['status'] = 'completo'
                        return await self._handle_complete_transaction(pending_data, user_id)
                    else:
                        return {
                            'resposta': '❌ Conta não encontrada. Tente novamente com o número ou nome da conta (ex: "1" ou "Nubank").',
                            'fonte': 'mcp_interaction'
                        }
                        
            finally:
                db.close()
        
        elif awaiting_type == 'cartao_parcelamento':
            # Processar seleção de cartão para parcelamento
            db = next(get_db())
            try:
                cartoes = db.query(Cartao).filter(Cartao.tenant_id == user_id, Cartao.ativo == True).all()
                
                # Tentar identificar por número primeiro (1, 2, 3...)
                try:
                    numero = int(message.strip())
                    indice = numero - 1  # Converter para índice 0-based
                    
                    if 0 <= indice < len(cartoes):
                        # É um cartão válido
                        cartao_selecionado = cartoes[indice]
                        pending_data['cartao_id'] = cartao_selecionado.id
                        logger.info(f"✅ Cartão parcelamento selecionado por número {numero}: {cartao_selecionado.nome}")
                        return await self._handle_complete_parcelamento(pending_data, user_id)
                    else:
                        return {
                            'resposta': f'❌ Número {numero} inválido. Por favor, escolha um número entre 1 e {len(cartoes)}.',
                            'fonte': 'mcp_interaction'
                        }
                        
                except ValueError:
                    # Não é um número, tentar identificar por nome
                    cartao_id = self._identificar_cartao_por_numero_ou_nome(message, user_id)
                    if cartao_id:
                        pending_data['cartao_id'] = cartao_id
                        return await self._handle_complete_parcelamento(pending_data, user_id)
                    else:
                        return {
                            'resposta': '❌ Cartão não encontrado. Tente novamente com o número ou nome do cartão.',
                            'fonte': 'mcp_interaction'
                        }
                        
            finally:
                db.close()
        
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
        if "hoje" in message.lower() or "dia" in message.lower() or "diário" in message.lower() or "diario" in message.lower():
            params["periodo"] = "1d"
        elif "ontem" in message.lower():
            params["periodo"] = "1d"
            params["offset_dias"] = 1
        elif "semana" in message.lower():
            params["periodo"] = "7d"
        elif "quinzena" in message.lower():
            params["periodo"] = "15d"
        elif "mês" in message.lower():
            params["periodo"] = "30d"
        
        return params
    
    def _extract_period_params(self, message: str) -> Dict:
        """Extrai parâmetros de período"""
        params = {}
        
        # Extrair período 
        if "hoje" in message.lower() or "dia" in message.lower() or "diário" in message.lower() or "diario" in message.lower():
            params["periodo"] = "1d"
        elif "ontem" in message.lower():
            params["periodo"] = "1d"
            params["offset_dias"] = 1  # Para buscar dia anterior
        elif "semana" in message.lower():
            params["periodo"] = "7d"
        elif "quinzena" in message.lower():
            params["periodo"] = "15d"
        elif "mês" in message.lower() or "mes" in message.lower():
            params["periodo"] = "30d"
        
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
    
    def _parse_correction_intent(self, message: str) -> Dict:
        """Parse de intenções de correção"""
        import re
        message_lower = message.lower()
        data = {}
        
        # Detectar que tipo de correção
        if any(word in message_lower for word in ["última", "ultima", "último", "ultimo", "last"]):
            data['target'] = 'ultima_transacao'
        elif re.search(r'transação\s+(\d+)', message_lower):
            match = re.search(r'transação\s+(\d+)', message_lower)
            data['target'] = 'transacao_id'
            data['transacao_id'] = int(match.group(1))
        else:
            data['target'] = 'ultima_transacao'  # Default
        
        # Detectar novo valor
        valor_match = re.search(r'(?:para|valor)\s*r?\$?\s*(\d+(?:,\d+)?(?:\.\d+)?)', message_lower)
        if valor_match:
            data['novo_valor'] = float(valor_match.group(1).replace(',', '.'))
        
        # Detectar nova descrição
        desc_match = re.search(r'(?:descrição|para)\s+"([^"]+)"', message_lower)
        if desc_match:
            data['nova_descricao'] = desc_match.group(1)
        
        # Detectar nova categoria
        cat_match = re.search(r'categoria\s+(?:para\s+)?(\w+)', message_lower)
        if cat_match:
            data['nova_categoria'] = cat_match.group(1)
        
        return data
    
    async def _handle_correction(self, data: Dict, user_id: int) -> Dict:
        """Processa correção de transação"""
        try:
            db = next(get_db())
            try:
                # Buscar transação a ser corrigida
                if data.get('target') == 'ultima_transacao':
                    # Buscar última transação do usuário
                    transacao = db.query(Transacao).filter(
                        Transacao.tenant_id == user_id
                    ).order_by(Transacao.data.desc()).first()
                elif data.get('target') == 'transacao_id':
                    # Buscar por ID específico
                    transacao = db.query(Transacao).filter(
                        Transacao.id == data['transacao_id'],
                        Transacao.tenant_id == user_id
                    ).first()
                else:
                    # Default: última transação
                    transacao = db.query(Transacao).filter(
                        Transacao.tenant_id == user_id
                    ).order_by(Transacao.data.desc()).first()
                
                if not transacao:
                    return {
                        'resposta': '❌ Não foi possível encontrar a transação para corrigir.',
                        'fonte': 'mcp_error'
                    }
                
                # Aplicar correções
                alteracoes = []
                
                if 'novo_valor' in data:
                    valor_antigo = transacao.valor
                    transacao.valor = data['novo_valor']
                    alteracoes.append(f"💰 Valor: R$ {valor_antigo:.2f} → R$ {data['novo_valor']:.2f}")
                
                if 'nova_descricao' in data:
                    desc_antiga = transacao.descricao
                    transacao.descricao = data['nova_descricao']
                    alteracoes.append(f"📝 Descrição: '{desc_antiga}' → '{data['nova_descricao']}'")
                
                if 'nova_categoria' in data:
                    # Buscar categoria
                    categoria = db.query(Categoria).filter(
                        Categoria.tenant_id == user_id,
                        Categoria.nome.ilike(f"%{data['nova_categoria']}%")
                    ).first()
                    
                    if categoria:
                        cat_antiga = transacao.categoria.nome if transacao.categoria else "Sem categoria"
                        transacao.categoria_id = categoria.id
                        alteracoes.append(f"🏷️ Categoria: '{cat_antiga}' → '{categoria.nome}'")
                
                if not alteracoes:
                    return {
                        'resposta': '⚠️ Nenhuma alteração foi detectada. Especifique o que deseja corrigir (valor, descrição, categoria).',
                        'fonte': 'mcp_interaction'
                    }
                
                # Salvar alterações
                db.commit()
                db.refresh(transacao)
                
                alteracoes_texto = "\n".join(alteracoes)
                
                return {
                    'resposta': f'''✅ **Transação corrigida com sucesso!**

📊 **Alterações realizadas:**
{alteracoes_texto}

🎯 **Transação atualizada:**
📝 {transacao.descricao}
💰 R$ {transacao.valor:.2f}
🏷️ {transacao.categoria.nome if transacao.categoria else "Sem categoria"}''',
                    'fonte': 'mcp_real_data',
                    'transacao_corrigida': True
                }
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"❌ Erro ao corrigir transação: {str(e)}")
            return {
                'resposta': f'❌ Erro ao corrigir transação: {str(e)}',
                'fonte': 'mcp_error'
            }

# Instância global do serviço inteligente
smart_mcp_service = SmartMCPService() 