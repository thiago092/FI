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
        
        # Para transações de SAIDA, verificar método de pagamento
        cartao_id = None
        conta_id = None
        
        if tipo == "SAIDA":
            cartao_id, conta_id = self._identify_payment_method(message, user_id)
            if not cartao_id and not conta_id:
                return {
                    'valor': valor,
                    'tipo': tipo,
                    'descricao': descricao,
                    'status': 'requer_pagamento'
                }
        
        # Se chegou aqui, identificou método de pagamento ou é ENTRADA
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
        
        # Remove palavras de ação
        palavras_acao = ['gastei', 'gaste', 'paguei', 'pague', 'comprei', 'compre', 'recebi', 'ganhei', 'saiu', 'entrou', 'de', 'no', 'na', 'com', 'para', 'em']
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
    
    async def _find_or_create_smart_category(self, descricao: str, user_id: int) -> int:
        """Encontra ou cria categoria inteligente baseada na descrição"""
        db = next(get_db())
        try:
            # Palavras-chave para categorias
            categorias_palavras = {
                'Alimentação': ['mercado', 'supermercado', 'ifood', 'food', 'comida', 'lanche', 'almoço', 'almoco', 'jantar', 'café', 'padaria', 'restaurante', 'lanchonete', 'pizza', 'hamburguer', 'açougue', 'verdura', 'fruta'],
                'Transporte': ['uber', 'taxi', '99', 'gasolina', 'combustivel', 'onibus', 'ônibus', 'metro', 'metrô', 'passagem', 'viagem', 'estacionamento'],
                'Lazer': ['cinema', 'teatro', 'show', 'festa', 'bar', 'balada', 'cerveja', 'game', 'jogo', 'streaming', 'netflix', 'spotify', 'youtube'],
                'Saúde': ['farmacia', 'farmácia', 'medicamento', 'remedio', 'remédio', 'médico', 'medico', 'consulta', 'exame', 'hospital', 'dentista'],
                'Casa': ['mercado', 'supermercado', 'limpeza', 'casa', 'cozinha', 'banheiro', 'móvel', 'movel', 'eletrodoméstico', 'luz', 'água', 'gas', 'gás', 'condomínio', 'condominio'],
                'Educação': ['curso', 'livro', 'escola', 'faculdade', 'universidade', 'material', 'caneta', 'caderno'],
                'Vestuário': ['roupa', 'camisa', 'calça', 'calca', 'sapato', 'tênis', 'tenis', 'vestido', 'shorts', 'loja']
            }
            
            descricao_lower = descricao.lower()
            
            # Buscar categoria existente que faça match
            for categoria_nome, palavras in categorias_palavras.items():
                for palavra in palavras:
                    if palavra in descricao_lower:
                        # Verificar se categoria já existe
                        categoria_existente = db.query(Categoria).filter(
                            Categoria.tenant_id == user_id,
                            Categoria.nome == categoria_nome
                        ).first()
                        
                        if categoria_existente:
                            logger.info(f"🏷️ Categoria encontrada: '{descricao}' → {categoria_nome}")
                            return categoria_existente.id
                        else:
                            # Criar nova categoria
                            nova_categoria = Categoria(
                                tenant_id=user_id,
                                nome=categoria_nome,
                                tipo="SAIDA"
                            )
                            db.add(nova_categoria)
                            db.commit()
                            db.refresh(nova_categoria)
                            logger.info(f"🆕 Nova categoria criada: '{descricao}' → {categoria_nome}")
                            return nova_categoria.id
            
            # Se não encontrou categoria específica, criar categoria genérica
            nome_categoria = self._generate_category_name(descricao)
            
            # Verificar se já existe
            categoria_existente = db.query(Categoria).filter(
                Categoria.tenant_id == user_id,
                Categoria.nome == nome_categoria
            ).first()
            
            if categoria_existente:
                return categoria_existente.id
                
            # Criar nova categoria
            nova_categoria = Categoria(
                tenant_id=user_id,
                nome=nome_categoria,
                tipo="SAIDA"
            )
            db.add(nova_categoria)
            db.commit()
            db.refresh(nova_categoria)
            logger.info(f"🔧 Categoria genérica criada: '{descricao}' → {nome_categoria}")
            return nova_categoria.id
            
        finally:
            db.close()
    
    def _generate_category_name(self, descricao: str) -> str:
        """Gera nome de categoria baseado na descrição"""
        # Casos comuns
        descricao_lower = descricao.lower()
        
        if any(word in descricao_lower for word in ['mercado', 'supermercado', 'comida']):
            return 'Alimentação'
        elif any(word in descricao_lower for word in ['uber', 'taxi', 'gasolina']):
            return 'Transporte'
        elif any(word in descricao_lower for word in ['salário', 'salario', 'freelance']):
            return 'Renda'
        else:
            # Usar primeira palavra significativa
            palavras = descricao.split()
            if palavras:
                return palavras[0].title()
            return 'Geral'

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
        """Identifica cartão por número ou nome (copiado do sistema antigo)"""
        import re
        
        message_lower = message.lower().strip()
        
        # Obter cartões do usuário
        db = next(get_db())
        try:
            cartoes = db.query(Cartao).filter(
                Cartao.tenant_id == user_id,
                Cartao.ativo == True
            ).all()
            
            if not cartoes:
                return None
            
            # Verificar se é um número (seleção numerada)
            numero_match = re.search(r'\b(\d+)\b', message_lower)
            if numero_match:
                numero = int(numero_match.group(1))
                logger.info(f"🔢 Número detectado: {numero}")
                
                # Verificar se o número está dentro do range válido
                if 1 <= numero <= len(cartoes):
                    cartao_selecionado = cartoes[numero - 1]  # -1 porque lista começa em 0
                    logger.info(f"✅ Cartão selecionado por número {numero}: {cartao_selecionado.nome}")
                    return cartao_selecionado.id
                else:
                    logger.info(f"❌ Número {numero} fora do range válido (1-{len(cartoes)})")
            
            # Verificar cartões - busca exata primeiro
            for cartao in sorted(cartoes, key=lambda c: len(c.nome), reverse=True):
                if cartao.nome.lower() in message_lower:
                    logger.info(f"✅ Cartão encontrado (exato): {cartao.nome}")
                    return cartao.id
            
            # Busca por fragmentos de nome - CARTÕES
            for cartao in cartoes:
                nome_palavras = cartao.nome.lower().split()
                for palavra in nome_palavras:
                    if len(palavra) >= 3 and palavra in message_lower:  # Mínimo 3 caracteres
                        logger.info(f"✅ Cartão encontrado (fragmento '{palavra}'): {cartao.nome}")
                        return cartao.id
            
            return None
            
        finally:
            db.close()
    
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
                
                # Chamar API para criar compra parcelada
                current_user = TempUser(user_id)
                compra_parcelada = criar_compra_parcelada(
                    compra_data=compra_data,
                    db=db,
                    current_user=current_user
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
        
        elif awaiting_type == 'cartao_parcelamento':
            # Processar seleção de cartão para parcelamento
            cartao_id = self._identificar_cartao_por_numero_ou_nome(message, user_id)
            if cartao_id:
                pending_data['cartao_id'] = cartao_id
                return await self._handle_complete_parcelamento(pending_data, user_id)
            else:
                return {
                    'resposta': '❌ Cartão não encontrado. Tente novamente com o número ou nome do cartão.',
                    'fonte': 'mcp_interaction'
                }
        
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