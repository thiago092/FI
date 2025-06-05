import json
import re
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple, Any
import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from ..models.financial import Categoria, Transacao, TipoTransacao, Conta, Cartao, TipoMensagem, ChatSession
from ..schemas.financial import TransacaoCreate
from .chat_history_service import ChatHistoryService
from .vision_service import VisionService
from openai import OpenAI

load_dotenv()

class ChatAIService:
    def __init__(self, db: Session, openai_api_key: str, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        
        # Inicialização simples e direta do OpenAI - usar apenas a chave sem parâmetros extras
        self.client = OpenAI(api_key=openai_api_key)
        self.chat_history = ChatHistoryService(db, tenant_id)
        self.vision_service = VisionService()
        self.model = "gpt-4o-mini"  # Modelo disponível e funcional
    
    def processar_mensagem(self, prompt: str, sessao_id: Optional[int] = None) -> Dict[str, Any]:
        """Processa mensagem do usuário com histórico de conversas"""
        try:
            # Obter ou criar sessão
            if sessao_id:
                sessao = self.db.query(ChatSession).filter(
                    ChatSession.id == sessao_id
                ).first()
                if not sessao:
                    sessao = self.chat_history.obter_sessao_ativa()
            else:
                sessao = self.chat_history.obter_sessao_ativa()
            
            # Salvar mensagem do usuário
            msg_usuario = self.chat_history.adicionar_mensagem(
                sessao_id=sessao.id,
                tipo=TipoMensagem.USUARIO,
                conteudo=prompt,
                via_voz=False  # Será atualizado pelo frontend se necessário
            )
            
            # Obter contexto da conversa (últimas mensagens)
            contexto = self._obter_contexto_conversa(sessao.id)
            
            # Processar com sistema híbrido
            resposta_processamento = self._processar_com_sistema_hibrido(prompt, contexto)
            
            # Extrair dados da transação se necessário
            transacao_criada = False
            transacao = None
            
            if resposta_processamento.get('criar_transacao'):
                try:
                    transacao = self._criar_transacao(resposta_processamento['dados_transacao'])
                    transacao_criada = True
                    
                    # Atualizar título da sessão se for a primeira transação
                    if sessao.transacoes_criadas == 0:
                        titulo_inteligente = self.chat_history.gerar_titulo_inteligente([prompt])
                        sessao.titulo = titulo_inteligente
                        self.db.commit()
                        
                except Exception as e:
                    resposta_processamento['resposta'] += f"\n\n⚠️ Houve um erro ao salvar a transação: {str(e)}"
            
            # Salvar resposta do bot
            msg_bot = self.chat_history.adicionar_mensagem(
                sessao_id=sessao.id,
                tipo=TipoMensagem.BOT,
                conteudo=resposta_processamento['resposta'],
                transacao_criada=transacao_criada,
                transacao_id=transacao.id if transacao else None
            )
            
            return {
                'resposta': resposta_processamento['resposta'],
                'transacao_criada': transacao_criada,
                'transacao': self._transacao_para_dict(transacao) if transacao else None,
                'sessao_id': sessao.id,
                'mensagem_id': msg_bot.id
            }
            
        except Exception as e:
            # Salvar erro no histórico também
            if 'sessao' in locals():
                self.chat_history.adicionar_mensagem(
                    sessao_id=sessao.id,
                    tipo=TipoMensagem.BOT,
                    conteudo=f"❌ Erro interno: {str(e)}"
                )
            
            print(f"Erro no ChatAIService: {e}")
            return {
                'resposta': '❌ Desculpe, ocorreu um erro interno. Tente novamente.',
                'transacao_criada': False,
                'transacao': None
            }

    def _obter_contexto_conversa(self, sessao_id: int, limite: int = 10) -> List[Dict[str, str]]:
        """Obtém contexto das últimas mensagens da conversa"""
        from ..models.financial import ChatMessage
        
        mensagens = self.db.query(ChatMessage).filter(
            ChatMessage.sessao_id == sessao_id
        ).order_by(ChatMessage.criado_em.desc()).limit(limite).all()
        
        contexto = []
        for msg in reversed(mensagens):  # Reverter para ordem cronológica
            role = "user" if msg.tipo == TipoMensagem.USUARIO else "assistant"
            contexto.append({
                "role": role,
                "content": msg.conteudo
            })
        
        return contexto

    def _processar_com_sistema_hibrido(self, prompt: str, contexto: List[Dict[str, str]]) -> Dict[str, Any]:
        """Sistema híbrido: regex + IA + validação + lógica de perguntas"""
        
        # VERIFICAR CONTEXTO: Se última mensagem do bot foi pergunta sobre método de pagamento
        resposta_continuacao = self._detectar_resposta_metodo_pagamento(prompt, contexto)
        if resposta_continuacao:
            return resposta_continuacao
        
        dados_extraidos = None
        
        # PRIMEIRA TENTATIVA: Parser determinístico com regex
        dados_extraidos = self._parser_regex_inteligente(prompt)
        
        # SEGUNDA TENTATIVA: IA simples para extração (se regex falhou)
        if not dados_extraidos:
            print("ℹ️ REGEX falhou, tentando IA para extração...")
            dados_extraidos = self._extrair_com_ia_simples(prompt)

        # Se não conseguimos extrair dados básicos
        if not dados_extraidos or not dados_extraidos.get('valor') or not dados_extraidos.get('tipo'):
            return {
                'resposta': '''Para registrar uma transação, fale assim:

💰 **GASTOS:**
• "gastei 30 no mercado"
• "paguei 50 de uber"

💸 **RECEITAS:**
• "recebi 100 de salário"

📝 **Sempre inclua:** valor + descrição''',
                'criar_transacao': False
            }

        valor = dados_extraidos['valor']
        tipo_transacao = dados_extraidos['tipo']

        # CASO 1: DESCRIÇÃO AUSENTE OU VAGA
        if dados_extraidos.get('status') == 'requer_descricao':
            return {
                'resposta': f"Entendi o valor de R$ {valor}. Mas sobre o que é essa transação? (Ex: mercado, salário, uber...)",
                'criar_transacao': False
            }

        # CASO 2: SUCESSO COMPLETO - temos valor, tipo e descrição
        descricao = dados_extraidos.get('descricao', 'Não especificado')
        
        # Identificar cartão/conta mencionado
        cartao_id, conta_id = self._identificar_cartao_conta_na_mensagem(prompt)

        # CASO 3: Para SAIDA sem método de pagamento, PERGUNTAR (não usar padrão)
        if tipo_transacao == "SAIDA" and not cartao_id and not conta_id:
            cartoes_disponiveis = self._obter_cartoes_existentes()
            contas_disponiveis = self._obter_contas_existentes()
            
            # Criar lista numerada das opções
            opcoes_numeradas = []
            indice = 1
            
            # Adicionar cartões numerados
            if cartoes_disponiveis:
                opcoes_numeradas.append("**Cartões:**")
                for cartao in cartoes_disponiveis:
                    opcoes_numeradas.append(f"{indice}. {cartao['nome']}")
                    indice += 1
            
            # Adicionar contas numeradas  
            if contas_disponiveis:
                if opcoes_numeradas:  # Se já tem cartões, adicionar linha vazia
                    opcoes_numeradas.append("")
                opcoes_numeradas.append("**Contas:**")
                for conta in contas_disponiveis:
                    opcoes_numeradas.append(f"{indice}. {conta['nome']}")
                    indice += 1

            # Limpar descrição para exibição mais amigável
            descricao_limpa = self._limpar_descricao_para_exibicao(descricao)

            mensagem_pergunta = f"Entendi R$ {valor:.2f} para '{descricao_limpa}'. Qual conta ou cartão você usou?"
            
            if opcoes_numeradas:
                mensagem_pergunta += "\n\n" + "\n".join(opcoes_numeradas)
                mensagem_pergunta += "\n\n💡 *Você pode responder com o número ou o nome*"
            else:
                mensagem_pergunta += "\n\n(Não há cartões ou contas cadastrados)"
            
            print(f"ℹ️ PERGUNTANDO MÉTODO DE PAGAMENTO para R$ {valor} - {descricao}")
            return {
                'resposta': mensagem_pergunta,
                'criar_transacao': False
            }
        
        # CASO 4: SUCESSO COMPLETO - temos tudo ou é ENTRADA
        # Para ENTRADA sem conta especificada, pode usar conta padrão ou None
        if tipo_transacao == "ENTRADA" and not conta_id and not cartao_id:
            contas_disponiveis = self._obter_contas_existentes()
            if contas_disponiveis:
                conta_id = contas_disponiveis[0]['id']  # Usar primeira conta para receitas
                print(f"ℹ️ Usando conta padrão para receita ID: {conta_id}")
        
        # Montar dados para a transação
        dados_transacao = {
            'valor': valor,
            'descricao': descricao,
            'tipo': tipo_transacao,
            'cartao_id': cartao_id,
            'conta_id': conta_id
        }
        
        # Montar resposta para o usuário
        verbo = "gasto" if tipo_transacao == "SAIDA" else "receita"
        metodo = ""
        if cartao_id:
            nome_cartao = next((c['nome'] for c in self._obter_cartoes_existentes() if c['id'] == cartao_id), f"Cartão ID {cartao_id}")
            metodo = f" no {nome_cartao}"
        elif conta_id:
            nome_conta = next((c['nome'] for c in self._obter_contas_existentes() if c['id'] == conta_id), f"Conta ID {conta_id}")
            metodo = f" na {nome_conta}"

        return {
            'resposta': f"✅ Registrado {verbo} de R$ {valor:.2f} para '{descricao}'{metodo}!",
            'criar_transacao': True,
            'dados_transacao': dados_transacao
        }

    def _parser_regex_inteligente(self, texto: str) -> Optional[Dict[str, Any]]:
        """Parser determinístico usando regex"""
        import re
        
        texto_lower = texto.lower().strip()
        
        # Extrair valor
        padroes_valor = [
            r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:reais?|r\$|real)',
            r'r\$\s*(\d+(?:,\d+)?(?:\.\d+)?)',
            r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:conto|pila|mangos?)',
            r'(\d+(?:,\d+)?(?:\.\d+)?)' 
        ]
        
        valor = None
        for padrao in padroes_valor:
            match = re.search(padrao, texto_lower)
            if match:
                valor_str = match.group(1).replace(',', '.')
                try:
                    valor = float(valor_str)
                    break
                except:
                    continue
        
        if not valor:
            return None
        
        # Identificar tipo
        palavras_entrada = ['recebi', 'ganhei', 'entrou', 'salario', 'salário', 'renda', 'freelance', 'freela']
        palavras_saida = ['gastei', 'paguei', 'comprei', 'saiu', 'despesa', 'gasto']
        
        tipo = None
        for palavra in palavras_entrada:
            if palavra in texto_lower:
                tipo = "ENTRADA"
                break
        
        if not tipo:
            for palavra in palavras_saida:
                if palavra in texto_lower:
                    tipo = "SAIDA"
                    break
        
        if not tipo:
            return None
            
        # Extrair descrição
        descricao = self._extrair_descricao_regex(texto_lower, valor)
        
        if not descricao or len(descricao) < 2:
            return {'valor': valor, 'tipo': tipo, 'status': 'requer_descricao'}
        
        return {'valor': valor, 'tipo': tipo, 'descricao': descricao, 'status': 'sucesso_completo'}

    def _extrair_descricao_regex(self, texto: str, valor: float) -> str:
        """Extrai descrição de forma inteligente"""
        import re
        
        texto_limpo = texto
        
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
            if chave in texto:
                return valor_map
        
        # Se sobrou algo útil, capitalizar
        if texto_limpo and len(texto_limpo) > 1:
            return texto_limpo.title()
        
        return ""

    def _extrair_com_ia_simples(self, prompt: str) -> Optional[Dict[str, Any]]:
        """Extrai dados usando IA como backup do regex"""
        try:
            system_prompt = """Extraia informações financeiras e responda APENAS com JSON.

Se conseguir extrair VALOR, TIPO e DESCRIÇÃO:
{"valor": float, "tipo": "ENTRADA" ou "SAIDA", "descricao": "string", "status": "sucesso_completo"}

Se conseguir VALOR e TIPO mas descrição vaga:
{"valor": float, "tipo": "ENTRADA" ou "SAIDA", "status": "requer_descricao"}

Se não conseguir VALOR e TIPO:
null

Exemplos:
"gastei 30 no mercado" → {"valor": 30.0, "tipo": "SAIDA", "descricao": "Mercado", "status": "sucesso_completo"}
"recebi 1000 salario" → {"valor": 1000.0, "tipo": "ENTRADA", "descricao": "Salário", "status": "sucesso_completo"}
"gastei 50" → {"valor": 50.0, "tipo": "SAIDA", "status": "requer_descricao"}"""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.0,
                max_tokens=150
            )
            
            content = response.choices[0].message.content.strip()
            
            if not content or content.lower() == "null":
                return None 

            return json.loads(content)
            
        except Exception as e:
            print(f"IA simples falhou: {e}")
            return None

    def _identificar_cartao_conta_na_mensagem(self, texto_mensagem: str) -> Tuple[Optional[int], Optional[int]]:
        """Identifica cartões ou contas mencionados na mensagem"""
        texto_lower = texto_mensagem.lower().strip()
        cartoes = self._obter_cartoes_existentes()
        contas = self._obter_contas_existentes()

        print(f"🔍 Procurando cartão/conta em: '{texto_lower}'")
        print(f"📋 Cartões disponíveis: {[c['nome'] for c in cartoes]}")
        print(f"📋 Contas disponíveis: {[c['nome'] for c in contas]}")

        # NOVA FUNCIONALIDADE: Verificar se é um número (seleção numerada)
        import re
        numero_match = re.search(r'\b(\d+)\b', texto_lower)
        if numero_match:
            numero = int(numero_match.group(1))
            print(f"🔢 Número detectado: {numero}")
            
            # Criar lista ordenada de todos os métodos de pagamento (cartões primeiro, depois contas)
            todos_metodos = []
            
            # Adicionar cartões primeiro
            for cartao in cartoes:
                todos_metodos.append(('cartao', cartao))
            
            # Adicionar contas depois
            for conta in contas:
                todos_metodos.append(('conta', conta))
            
            # Verificar se o número está dentro do range válido
            if 1 <= numero <= len(todos_metodos):
                tipo, metodo = todos_metodos[numero - 1]  # -1 porque lista começa em 0
                if tipo == 'cartao':
                    print(f"✅ Cartão selecionado por número {numero}: {metodo['nome']}")
                    return metodo['id'], None
                else:  # tipo == 'conta'
                    print(f"✅ Conta selecionada por número {numero}: {metodo['nome']}")
                    return None, metodo['id']
            else:
                print(f"❌ Número {numero} fora do range válido (1-{len(todos_metodos)})")

        # Verificar cartões - busca exata primeiro
        for cartao in sorted(cartoes, key=lambda c: len(c['nome']), reverse=True):
            if cartao['nome'].lower() in texto_lower:
                print(f"✅ Cartão encontrado (exato): {cartao['nome']}")
                return cartao['id'], None
        
        # Verificar contas - busca exata primeiro
        for conta in sorted(contas, key=lambda c: len(c['nome']), reverse=True):
            if conta['nome'].lower() in texto_lower:
                print(f"✅ Conta encontrada (exata): {conta['nome']}")
                return None, conta['id']
        
        # Busca por fragmentos de nome - CARTÕES
        for cartao in cartoes:
            nome_palavras = cartao['nome'].lower().split()
            for palavra in nome_palavras:
                if len(palavra) >= 3 and palavra in texto_lower:  # Mínimo 3 caracteres
                    print(f"✅ Cartão encontrado (fragmento '{palavra}'): {cartao['nome']}")
                    return cartao['id'], None
        
        # Busca por fragmentos de nome - CONTAS  
        for conta in contas:
            nome_palavras = conta['nome'].lower().split()
            for palavra in nome_palavras:
                if len(palavra) >= 3 and palavra in texto_lower:  # Mínimo 3 caracteres
                    print(f"✅ Conta encontrada (fragmento '{palavra}'): {conta['nome']}")
                    return None, conta['id']
        
        # Busca fuzzy - verificar se alguma palavra do usuário está contida no nome
        palavras_usuario = texto_lower.split()
        for palavra_usuario in palavras_usuario:
            if len(palavra_usuario) >= 3:  # Mínimo 3 caracteres
                # Verificar cartões
                for cartao in cartoes:
                    if palavra_usuario in cartao['nome'].lower():
                        print(f"✅ Cartão encontrado (fuzzy '{palavra_usuario}'): {cartao['nome']}")
                        return cartao['id'], None
                
                # Verificar contas
                for conta in contas:
                    if palavra_usuario in conta['nome'].lower():
                        print(f"✅ Conta encontrada (fuzzy '{palavra_usuario}'): {conta['nome']}")
                        return None, conta['id']
        
        # Termos genéricos
        if any(termo in texto_lower for termo in ['cartão', 'credito', 'crédito']):
            if cartoes:
                print(f"✅ Usando cartão padrão: {cartoes[0]['nome']}")
                return cartoes[0]['id'], None
        elif any(termo in texto_lower for termo in ['conta', 'débito', 'debito']):
            if contas:
                print(f"✅ Usando conta padrão: {contas[0]['nome']}")
                return None, contas[0]['id']

        print(f"❌ Nenhum cartão/conta identificado em: '{texto_lower}'")
        return None, None

    def _obter_categorias_existentes(self) -> List[Dict[str, Any]]:
        """Obtém categorias existentes do usuário"""
        categorias = self.db.query(Categoria).filter(Categoria.tenant_id == self.tenant_id).all()
        return [{'id': c.id, 'nome': c.nome} for c in categorias]
    
    def _obter_contas_existentes(self) -> List[Dict[str, Any]]:
        """Obtém contas existentes do usuário"""
        contas = self.db.query(Conta).filter(Conta.tenant_id == self.tenant_id).all()
        return [{'id': c.id, 'nome': c.nome} for c in contas]
    
    def _obter_cartoes_existentes(self) -> List[Dict[str, Any]]:
        """Obtém cartões existentes do usuário"""
        cartoes = self.db.query(Cartao).filter(Cartao.tenant_id == self.tenant_id).all()
        return [{'id': c.id, 'nome': c.nome} for c in cartoes]
    
    def _criar_transacao(self, dados: Dict[str, Any]) -> Transacao:
        """Cria uma nova transação"""
        
        # Criar categoria automaticamente
        categoria_nome = self._determinar_categoria_automatica(dados['descricao'])
        categoria_id = self._criar_categoria_automatica(categoria_nome)
        
        # Usar cartão/conta especificado (não há mais fallback automático)
        cartao_id = dados.get('cartao_id')
        conta_id = dados.get('conta_id')
        
        try:
            transacao = Transacao(
                descricao=dados['descricao'],
                valor=float(dados['valor']),
                tipo=TipoTransacao(dados['tipo']),
                data=datetime.now(),
                categoria_id=categoria_id,
                conta_id=conta_id,
                cartao_id=cartao_id,
                tenant_id=self.tenant_id,
                processado_por_ia=True,
                prompt_original=""
            )
            
            self.db.add(transacao)
            self.db.commit()
            self.db.refresh(transacao)
            
            metodo = ""
            if cartao_id:
                nome_cartao = next((c['nome'] for c in self._obter_cartoes_existentes() if c['id'] == cartao_id), f"Cartão ID {cartao_id}")
                metodo = f" no {nome_cartao}"
            elif conta_id:
                nome_conta = next((c['nome'] for c in self._obter_contas_existentes() if c['id'] == conta_id), f"Conta ID {conta_id}")
                metodo = f" na {nome_conta}"
            
            print(f"✅ TRANSAÇÃO CRIADA: R$ {dados['valor']} - {dados['descricao']}{metodo}")
            return transacao
                
        except Exception as e:
            print(f"❌ ERRO ao criar transação: {e}")
            self.db.rollback()
            raise e
    
    def _determinar_categoria_automatica(self, descricao: str) -> str:
        """Determina categoria baseada na descrição"""
        try:
            prompt = f"Baseado na descrição '{descricao}', sugira UMA categoria simples (ex: Alimentação, Transporte, Saúde, etc). Responda apenas o nome da categoria."
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=20
            )
            
            categoria_sugerida = response.choices[0].message.content.strip()
            
            # Verificar se categoria já existe
            categoria_existente = self.db.query(Categoria).filter(
                Categoria.tenant_id == self.tenant_id,
                Categoria.nome.ilike(f"%{categoria_sugerida}%")
            ).first()
            
            if categoria_existente:
                return categoria_existente.nome
                
            return categoria_sugerida
            
        except Exception as e:
            print(f"Erro ao determinar categoria: {e}")
            # Fallback simples
            descricao_lower = descricao.lower()
            
            if any(palavra in descricao_lower for palavra in ['ifood', 'restaurante', 'comida', 'almoço', 'jantar', 'lanche', 'mercado']):
                return 'Alimentação'
            elif any(palavra in descricao_lower for palavra in ['uber', 'taxi', 'combustivel', 'gasolina']):
                return 'Transporte'
            elif any(palavra in descricao_lower for palavra in ['farmacia', 'medico', 'hospital']):
                return 'Saúde'
            elif any(palavra in descricao_lower for palavra in ['salario', 'renda']):
                return 'Renda'
            else:
                return 'Outros'
    
    def _criar_categoria_automatica(self, nome_categoria: str) -> int:
        """Cria categoria automaticamente se não existir"""
        
        # Verificar se já existe
        categoria_existente = self.db.query(Categoria).filter(
            Categoria.tenant_id == self.tenant_id,
            Categoria.nome.ilike(f"%{nome_categoria}%")
        ).first()
        
        if categoria_existente:
            return categoria_existente.id
        
        # Mapear ícones e cores
        icones = {
            'Alimentação': '🍽️', 'Transporte': '🚗', 'Saúde': '🏥',
            'Lazer': '🎉', 'Casa': '🏠', 'Compras': '🛒',
            'Educação': '📚', 'Trabalho': '💼', 'Renda': '💰',
            'Outros': '📁'
        }
        
        cores = {
            'Alimentação': '#FF6B6B', 'Transporte': '#4ECDC4', 'Saúde': '#45B7D1',
            'Lazer': '#96CEB4', 'Casa': '#FECA57', 'Compras': '#FD79A8',
            'Educação': '#A29BFE', 'Trabalho': '#6C5CE7', 'Renda': '#26DE81',
            'Outros': '#74B9FF'
        }
        
        # Criar nova categoria
        nova_categoria = Categoria(
            nome=nome_categoria,
            cor=cores.get(nome_categoria, '#74B9FF'),
            icone=icones.get(nome_categoria, '📁'),
            tenant_id=self.tenant_id
        )
        
        self.db.add(nova_categoria)
        self.db.flush()
        return nova_categoria.id
    
    def _transacao_para_dict(self, transacao: Optional[Transacao]) -> Optional[Dict[str, Any]]:
        """Converte transação para dicionário"""
        if not transacao:
            return None
            
        return {
            'id': transacao.id,
            'valor': transacao.valor,
            'descricao': transacao.descricao,
            'tipo': transacao.tipo.value,
            'data': transacao.data.isoformat(),
            'categoria': {'id': transacao.categoria.id, 'nome': transacao.categoria.nome} if transacao.categoria else None,
            'conta': {'id': transacao.conta.id, 'nome': transacao.conta.nome} if transacao.conta else None,
            'cartao': {'id': transacao.cartao.id, 'nome': transacao.cartao.nome} if transacao.cartao else None
        } 

    def obter_estatisticas(self) -> Dict[str, Any]:
        """Obtém estatísticas do chat"""
        total_transacoes = self.db.query(Transacao).filter(
            Transacao.tenant_id == self.tenant_id
        ).count()
        
        transacoes_via_chat = self.db.query(Transacao).filter(
            Transacao.tenant_id == self.tenant_id,
            Transacao.processado_por_ia == True
        ).count()
        
        resumo_chat = self.chat_history.obter_resumo()
        
        percentual_via_chat = round((transacoes_via_chat / total_transacoes * 100), 1) if total_transacoes > 0 else 0
        economia_tempo = f"{transacoes_via_chat * 2} min"
        
        return {
            'total_transacoes': total_transacoes,
            'total_transacoes_chat': transacoes_via_chat,
            'percentual_via_chat': percentual_via_chat,
            'economia_tempo': economia_tempo,
            'total_sessoes': resumo_chat.total_sessoes,
            'total_mensagens': resumo_chat.total_mensagens,
            'sessoes_ativas': resumo_chat.sessoes_ativas,
            'ultima_conversa': resumo_chat.ultima_conversa
        }

    def _detectar_resposta_metodo_pagamento(self, prompt: str, contexto: List[Dict[str, str]]) -> Optional[Dict[str, Any]]:
        """Detecta se o usuário está respondendo uma pergunta sobre método de pagamento"""
        
        print(f"🔍 DETECTANDO resposta método pagamento para: '{prompt}'")
        print(f"📝 Contexto tem {len(contexto)} mensagens")
        
        # Verificar se há contexto e se a última mensagem do bot perguntou sobre método de pagamento
        if not contexto or len(contexto) < 1:
            print("❌ Sem contexto suficiente")
            return None
            
        ultima_mensagem_bot = None
        for msg in reversed(contexto):
            if msg['role'] == 'assistant':  # Corrigido: usar 'role' ao invés de 'tipo'
                ultima_mensagem_bot = msg
                break
        
        if not ultima_mensagem_bot:
            print("❌ Nenhuma mensagem do bot encontrada no contexto")
            return None
            
        conteudo_bot = ultima_mensagem_bot['content'].lower()  # Corrigido: usar 'content' ao invés de 'conteudo'
        print(f"📋 Última mensagem do bot: '{conteudo_bot[:100]}...'")
        
        # Verificar se a última mensagem perguntou sobre cartão/conta
        if 'qual conta ou cartão' not in conteudo_bot and 'disponíveis:' not in conteudo_bot:
            print("❌ Última mensagem não perguntou sobre método de pagamento")
            return None
            
        print("✅ Detectada pergunta sobre método de pagamento!")
        
        # Extrair dados da pergunta anterior (valor e descrição)
        import re
        valor_match = re.search(r'r\$\s*(\d+(?:,\d+)?(?:\.\d+)?)', conteudo_bot)
        descricao_match = re.search(r"para '([^']+)'", conteudo_bot)
        
        if not valor_match or not descricao_match:
            print("⚠️ Não conseguiu extrair dados da pergunta anterior")
            print(f"   Valor match: {valor_match}")
            print(f"   Descrição match: {descricao_match}")
            return None
            
        valor = float(valor_match.group(1).replace(',', '.'))
        descricao = descricao_match.group(1)
        print(f"✅ Dados extraídos - Valor: R$ {valor}, Descrição: '{descricao}'")
        
        # Identificar cartão/conta na resposta do usuário
        cartao_id, conta_id = self._identificar_cartao_conta_na_mensagem(prompt)
        
        if not cartao_id and not conta_id:
            print(f"⚠️ Não identificou cartão/conta em: '{prompt}'")
            return {
                'resposta': f"Não consegui identificar o cartão ou conta em '{prompt}'. Pode tentar novamente?\\n\\nDisponíveis: {self._obter_opcoes_pagamento_texto()}",
                'criar_transacao': False
            }
        
        # Sucesso! Criar a transação
        dados_transacao = {
            'valor': valor,
            'descricao': descricao,
            'tipo': 'SAIDA',  # Se perguntou método de pagamento, é uma saída
            'cartao_id': cartao_id,
            'conta_id': conta_id
        }
        
        # Montar resposta
        metodo = ""
        if cartao_id:
            nome_cartao = next((c['nome'] for c in self._obter_cartoes_existentes() if c['id'] == cartao_id), f"Cartão ID {cartao_id}")
            metodo = f" no {nome_cartao}"
        elif conta_id:
            nome_conta = next((c['nome'] for c in self._obter_contas_existentes() if c['id'] == conta_id), f"Conta ID {conta_id}")
            metodo = f" na {nome_conta}"
        
        print(f"✅ TRANSAÇÃO VIA CONTINUAÇÃO: R$ {valor} - {descricao}{metodo}")
        
        return {
            'resposta': f"✅ Registrado gasto de R$ {valor:.2f} para '{descricao}'{metodo}!",
            'criar_transacao': True,
            'dados_transacao': dados_transacao
        }

    def _obter_opcoes_pagamento_texto(self) -> str:
        """Obter texto das opções de pagamento disponíveis com numeração"""
        cartoes = self._obter_cartoes_existentes()
        contas = self._obter_contas_existentes()
        
        if not cartoes and not contas:
            return "Nenhum método de pagamento cadastrado"
        
        opcoes_numeradas = []
        indice = 1
        
        # Adicionar cartões numerados
        if cartoes:
            opcoes_numeradas.append("**Cartões:**")
            for cartao in cartoes:
                opcoes_numeradas.append(f"{indice}. {cartao['nome']}")
                indice += 1
        
        # Adicionar contas numeradas  
        if contas:
            if opcoes_numeradas:  # Se já tem cartões, adicionar linha vazia
                opcoes_numeradas.append("")
            opcoes_numeradas.append("**Contas:**")
            for conta in contas:
                opcoes_numeradas.append(f"{indice}. {conta['nome']}")
                indice += 1
        
        return "\n".join(opcoes_numeradas) + "\n\n💡 *Você pode responder com o número ou o nome*"

    async def processar_imagem(self, file_content: bytes, filename: str = "imagem") -> Dict[str, Any]:
        """Processa uma imagem e extrai informações de transação"""
        try:
            # Determinar tipo MIME baseado no filename ou assumir JPEG como padrão
            mime_type = "image/jpeg"
            if filename.lower().endswith('.png'):
                mime_type = "image/png"
            elif filename.lower().endswith('.gif'):
                mime_type = "image/gif"
            elif filename.lower().endswith('.webp'):
                mime_type = "image/webp"

            print(f"🖼️ Processando imagem: {filename}, tipo: {mime_type}")

            # Extrair informações da imagem usando Vision API
            result = await self.vision_service.extract_transaction_from_image(
                image_bytes=file_content,
                mime_type=mime_type
            )

            if not result.get("success"):
                return {
                    'resposta': f"❌ Não foi possível extrair informações da imagem: {result.get('error', 'Erro desconhecido')}",
                    'sucesso': False,
                    'transacao_criada': False,
                    'transacao': None,
                    'detalhes': {'error': result.get('error')}
                }

            extracted_data = result["data"]
            print(f"✅ Dados extraídos da imagem: {extracted_data}")

            # Verificar se conseguiu extrair valor válido
            if extracted_data.get("valor", 0) <= 0:
                return {
                    'resposta': "❌ Não foi possível identificar o valor da transação na imagem. Tente com uma imagem mais clara.",
                    'sucesso': False,
                    'transacao_criada': False,
                    'transacao': None,
                    'detalhes': {'extracted_data': extracted_data}
                }

            # Obter ou criar sessão ativa
            sessao = self.chat_history.obter_sessao_ativa()

            # Criar mensagem simulando que o usuário disse sobre a transação
            descricao = extracted_data.get("descricao", "transação")
            valor = extracted_data.get("valor", 0)
            estabelecimento = extracted_data.get("estabelecimento", "")

            # Montar mensagem baseada nos dados extraídos
            if estabelecimento:
                mensagem_usuario = f"Gastei R$ {valor:.2f} em {descricao} no {estabelecimento}"
            else:
                mensagem_usuario = f"Gastei R$ {valor:.2f} em {descricao}"

            # Adicionar mensagem do usuário (simulada)
            msg_usuario = self.chat_history.adicionar_mensagem(
                sessao_id=sessao.id,
                tipo=TipoMensagem.USUARIO,
                conteudo=f"📷 {mensagem_usuario} (via imagem)",
                via_voz=False
            )

            print(f"📝 Processando como mensagem: {mensagem_usuario}")

            # Processar como se fosse uma mensagem de chat normal
            resposta_processamento = self._processar_com_sistema_hibrido(mensagem_usuario, [])

            # Criar transação se possível
            transacao_criada = False
            transacao = None

            if resposta_processamento.get('criar_transacao'):
                try:
                    # Ajustar dados da transação com informações da imagem
                    dados_transacao = resposta_processamento['dados_transacao']
                    
                    # Usar descrição limpa da imagem
                    dados_transacao['descricao'] = descricao
                    
                    # Usar categoria da imagem se disponível
                    if extracted_data.get("categoria"):
                        categoria_nome = extracted_data["categoria"]
                        categoria_id = self._criar_categoria_automatica(categoria_nome)
                        dados_transacao['categoria_id'] = categoria_id

                    # Usar data da imagem se disponível
                    if extracted_data.get("data"):
                        try:
                            data_transacao = datetime.strptime(extracted_data["data"], "%Y-%m-%d").date()
                            dados_transacao['data'] = data_transacao
                        except:
                            pass  # Usar data atual se houver erro

                    transacao = self._criar_transacao(dados_transacao)
                    transacao_criada = True

                    # Atualizar título da sessão se for a primeira transação
                    if sessao.transacoes_criadas == 0:
                        titulo_inteligente = f"Transação via imagem - {descricao}"
                        sessao.titulo = titulo_inteligente
                        self.db.commit()

                except Exception as e:
                    resposta_processamento['resposta'] += f"\n\n⚠️ Houve um erro ao salvar a transação: {str(e)}"

            # Personalizar resposta com informações da imagem
            confianca = extracted_data.get("confianca", "media")
            emoji_confianca = "🟢" if confianca == "alta" else "🟡" if confianca == "media" else "🔴"
            
            resposta_personalizada = f"📷 **Imagem processada** {emoji_confianca}\n\n"
            
            if transacao_criada:
                # Obter nome do método de pagamento
                metodo_pagamento = ""
                if dados_transacao.get('cartao_id'):
                    nome_cartao = next((c['nome'] for c in self._obter_cartoes_existentes() if c['id'] == dados_transacao['cartao_id']), f"Cartão ID {dados_transacao['cartao_id']}")
                    metodo_pagamento = f" no **{nome_cartao}**"
                elif dados_transacao.get('conta_id'):
                    nome_conta = next((c['nome'] for c in self._obter_contas_existentes() if c['id'] == dados_transacao['conta_id']), f"Conta ID {dados_transacao['conta_id']}")
                    metodo_pagamento = f" na **{nome_conta}**"
                
                resposta_personalizada += f"✅ Registrado gasto de **R$ {valor:.2f}** para '{descricao}'"
                if estabelecimento:
                    resposta_personalizada += f" no **{estabelecimento}**"
                resposta_personalizada += f"{metodo_pagamento}!"
            else:
                resposta_personalizada += resposta_processamento['resposta']

            if extracted_data.get("observacoes"):
                resposta_personalizada += f"\n\n📝 *{extracted_data['observacoes']}*"

            # Salvar resposta do bot
            msg_bot = self.chat_history.adicionar_mensagem(
                sessao_id=sessao.id,
                tipo=TipoMensagem.BOT,
                conteudo=resposta_personalizada,
                transacao_criada=transacao_criada,
                transacao_id=transacao.id if transacao else None
            )

            return {
                'resposta': resposta_personalizada,
                'sucesso': True,
                'transacao_criada': transacao_criada,
                'transacao': self._transacao_para_dict(transacao) if transacao else None,
                'detalhes': {
                    'extracted_data': extracted_data,
                    'confidence': confianca,
                    'message_processed': mensagem_usuario,
                    'sessao_id': sessao.id
                }
            }

        except Exception as e:
            print(f"❌ Erro inesperado ao processar imagem: {str(e)}")
            return {
                'resposta': f"❌ Erro interno ao processar imagem: {str(e)}",
                'sucesso': False,
                'transacao_criada': False,
                'transacao': None,
                'detalhes': {'error': str(e)}
            }

    def _limpar_descricao_para_exibicao(self, descricao: str) -> str:
        """Limpa descrição para exibição mais amigável, removendo códigos técnicos"""
        import re
        
        descricao_limpa = descricao
        
        # Remover símbolos de moeda
        descricao_limpa = descricao_limpa.replace("R$", "").replace("r$", "").replace("$", "")
        
        # Remover códigos técnicos comuns
        descricao_limpa = re.sub(r'\d+UNX?\d*\.?\d*', '', descricao_limpa)  # Remove códigos como 3UNX79
        descricao_limpa = re.sub(r'\bT\d+\b', '', descricao_limpa)  # Remove códigos como T3, T2
        descricao_limpa = re.sub(r'\b\d+UN\b', '', descricao_limpa)  # Remove códigos como 1UN
        descricao_limpa = re.sub(r'\b\d+\s*UNX?\s*', '', descricao_limpa)  # Remove quantidades com UNX
        
        # Remover números soltos no início ou fim
        descricao_limpa = re.sub(r'^\d+\s*', '', descricao_limpa)
        descricao_limpa = re.sub(r'\s*\d+$', '', descricao_limpa)
        
        # Limpar espaços e vírgulas
        descricao_limpa = re.sub(r'\s*,\s*,\s*', ', ', descricao_limpa)
        descricao_limpa = re.sub(r'\s+', ' ', descricao_limpa)
        descricao_limpa = descricao_limpa.strip(' ,')
        
        # Se ficou muito longa, simplificar
        if len(descricao_limpa) > 40:
            if ',' in descricao_limpa:
                partes = descricao_limpa.split(',')
                if len(partes) > 2:
                    # Muitos itens - generalizar
                    if any(word in descricao_limpa.lower() for word in ['rodizio', 'pizza']):
                        return "Rodízio"
                    elif any(word in descricao_limpa.lower() for word in ['refrigerante', 'agua', 'bebida']):
                        return "Bebidas"
                    else:
                        return "Compras variadas"
                else:
                    # Poucos itens - pegar o principal
                    descricao_limpa = partes[0].strip()
        
        return descricao_limpa.title() if descricao_limpa else "Transação" 