import openai
import re
import json
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, date
from sqlalchemy.orm import Session
from ..models.financial import Categoria, Conta, Cartao
from ..core.config import settings

class IAService:
    def __init__(self):
        openai.api_key = settings.OPENAI_API_KEY
    
    def detectar_parcelamento(self, texto: str) -> Tuple[bool, int]:
        """
        Detecta se a mensagem menciona parcelamento e retorna o número de parcelas
        
        Returns:
            Tuple[bool, int]: (é_parcelada, numero_parcelas)
        """
        texto_lower = texto.lower()
        
        # Padrões de parcelamento
        padroes = [
            r'(\d+)\s*x\b',  # "12x", "3 x"
            r'(\d+)\s*vezes\b',  # "3 vezes"
            r'(\d+)\s*parcelas?\b',  # "12 parcelas", "3 parcela"
            r'em\s*(\d+)\b',  # "em 12", "em 3"
            r'parcel[ai]\w*\s*(\d+)',  # "parcelado 12", "parcelei 3"
            r'dividi[rd]\w*\s*(\d+)',  # "dividido 12", "dividir 3"
        ]
        
        # Palavras que indicam parcelamento
        palavras_parcelamento = [
            'parcelado', 'parcelei', 'parcelas', 'parcela',
            'dividido', 'dividir', 'vezes', 'prestação', 'prestações'
        ]
        
        # Verificar se há palavras de parcelamento
        tem_palavra_parcelamento = any(palavra in texto_lower for palavra in palavras_parcelamento)
        
        # Buscar número de parcelas
        numero_parcelas = 1
        for padrao in padroes:
            match = re.search(padrao, texto_lower)
            if match:
                numero_parcelas = int(match.group(1))
                tem_palavra_parcelamento = True
                break
        
        # Validar número de parcelas
        if tem_palavra_parcelamento and numero_parcelas > 1:
            # Limitar parcelas (máximo 48x)
            numero_parcelas = min(numero_parcelas, 48)
            return True, numero_parcelas
        
        return False, 1
    
    def processar_mensagem_financeira(self, mensagem: str, tenant_id: int, db: Session) -> Dict[str, Any]:
        """Processar mensagem usando IA para extrair informações financeiras"""
        
        # Detectar parcelamento
        eh_parcelada, num_parcelas = self.detectar_parcelamento(mensagem)
        
        # Buscar categorias, contas e cartões do tenant
        categorias = db.query(Categoria).filter(Categoria.tenant_id == tenant_id).all()
        contas = db.query(Conta).filter(Conta.tenant_id == tenant_id).all()
        cartoes = db.query(Cartao).filter(Cartao.tenant_id == tenant_id).all()
        
        # Preparar contexto para IA
        contexto_categorias = "\n".join([f"- {cat.id}: {cat.icone} {cat.nome}" for cat in categorias])
        contexto_contas = "\n".join([f"- {conta.id}: {conta.nome} ({conta.banco})" for conta in contas])
        contexto_cartoes = "\n".join([f"- {cartao.id}: {cartao.nome} ({cartao.bandeira})" for cartao in cartoes])
        
        # Cartão padrão (primeiro cartão ativo)
        cartao_padrao = next((c for c in cartoes if c.ativo), None)
        cartao_padrao_info = f"Cartão padrão: {cartao_padrao.nome} (ID: {cartao_padrao.id})" if cartao_padrao else "Nenhum cartão disponível"
        
        prompt = f"""Você é um assistente financeiro brasileiro. Analise a mensagem do usuário e extraia as informações financeiras.

MENSAGEM DO USUÁRIO: "{mensagem}"

DETECÇÃO DE PARCELAMENTO:
- Parcelamento detectado: {"SIM" if eh_parcelada else "NÃO"}
- Número de parcelas: {num_parcelas}

CONTEXTO DISPONÍVEL:
Categorias:
{contexto_categorias}

Contas:
{contexto_contas}

Cartões:
{contexto_cartoes}

{cartao_padrao_info}

REGRAS DE PROCESSAMENTO:
1. PARCELAMENTO:
   - Se detectou parcelamento, defina "tipo_transacao": "compra_parcelada"
   - Se NÃO detectou parcelamento, defina "tipo_transacao": "transacao_avulsa"

2. CARTÃO vs CONTA:
   - Compras em estabelecimentos = SEMPRE cartão (ou cartão padrão)
   - Palavras como "no cartão", "no nubank", "no inter" = cartão específico
   - Transferências, PIX, saque = conta
   - Cash, dinheiro vivo = conta

3. VALOR:
   - Sempre em formato numérico (ex: 150.50)
   - "Real", "reais", "R$" são indicadores de moeda

4. CATEGORIA:
   - Escolha a categoria mais adequada baseada no contexto
   - Se não souber, escolha categoria mais genérica

Responda APENAS com JSON válido:
{{
  "sucesso": true/false,
  "tipo_transacao": "compra_parcelada" ou "transacao_avulsa",
  "transacao": {{
    "descricao": "descrição clara da compra/transação",
    "valor": valor_numerico,
    "tipo": "SAIDA" ou "ENTRADA",
    "categoria_id": id_da_categoria,
    "conta_id": id_da_conta_ou_null,
    "cartao_id": id_do_cartao_ou_null,
    "observacoes": "observações relevantes ou null"
  }},
  "parcelamento": {{
    "numero_parcelas": {num_parcelas},
    "eh_parcelada": {str(eh_parcelada).lower()}
  }},
  "explicacao": "breve explicação da análise"
}}"""

        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "Você é um assistente financeiro brasileiro especializado em análise de transações e parcelamentos."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            resultado_text = response.choices[0].message.content.strip()
            
            # Parse do JSON
            try:
                resultado = json.loads(resultado_text)
                
                # Validar se é compra parcelada detectada
                if eh_parcelada and resultado.get("tipo_transacao") == "transacao_avulsa":
                    # Forçar tipo correto se detectamos parcelamento
                    resultado["tipo_transacao"] = "compra_parcelada"
                    resultado["parcelamento"]["eh_parcelada"] = True
                
                return resultado
                
            except json.JSONDecodeError as e:
                return {
                    "sucesso": False,
                    "erro": f"Erro ao interpretar resposta da IA: {e}",
                    "resposta_bruta": resultado_text
                }
                
        except Exception as e:
            return {
                "sucesso": False,
                "erro": f"Erro na API da OpenAI: {e}"
            }

    def sugerir_categoria_inteligente(self, descricao: str, categorias_disponiveis: list) -> Optional[int]:
        """Sugerir categoria baseada na descrição usando IA"""
        
        if not categorias_disponiveis:
            return None
            
        contexto_categorias = "\n".join([
            f"- {cat['id']}: {cat['icone']} {cat['nome']}" 
            for cat in categorias_disponiveis
        ])
        
        prompt = f"""Baseado na descrição "{descricao}", qual categoria seria mais adequada?

Categorias disponíveis:
{contexto_categorias}

Responda apenas com o ID da categoria mais adequada (número inteiro).
Se não tiver certeza, responda com o ID da categoria mais genérica."""

        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "Você é um especialista em categorização de gastos financeiros."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=50
            )
            
            categoria_id = int(response.choices[0].message.content.strip())
            
            # Verificar se o ID é válido
            ids_validos = [cat['id'] for cat in categorias_disponiveis]
            if categoria_id in ids_validos:
                return categoria_id
                
        except (ValueError, Exception):
            pass
            
        # Fallback: retornar primeira categoria
        return categorias_disponiveis[0]['id'] if categorias_disponiveis else None 