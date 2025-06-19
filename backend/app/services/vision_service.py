import base64
import json
from typing import Optional, Dict, Any
from openai import OpenAI
from ..core.config import settings

class VisionService:
    def __init__(self):
        # Verificar se a chave da OpenAI está configurada
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY não configurada nas variáveis de ambiente")
        
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def encode_image(self, image_bytes: bytes) -> str:
        """Codifica a imagem em base64"""
        return base64.b64encode(image_bytes).decode('utf-8')

    async def extract_transaction_from_image(self, image_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        """
        Extrai informações de transação de uma imagem usando OpenAI Vision
        """
        try:
            # Codificar imagem
            base64_image = self.encode_image(image_bytes)
            
            # Prompt melhorado para garantir resposta JSON válida
            prompt = """
Você é um especialista em extrair informações de cupons fiscais, recibos e notas fiscais brasileiras.

Analise esta imagem e extraia as seguintes informações financeiras:

OBRIGATÓRIO: Responda APENAS com um JSON válido no formato exato abaixo, sem nenhum texto adicional antes ou depois:

{
    "valor": 0.0,
    "descricao": "descrição específica do produto/serviço",
    "data": "2024-01-01",
    "tipo": "despesa",
    "estabelecimento": "nome da empresa/local",
    "categoria": "alimentacao",
    "confianca": "alta",
    "observacoes": "informações extras se necessário"
}

REGRAS IMPORTANTES PARA A DESCRIÇÃO:
- "descricao": Seja CONCISO e CLARO. Use nomes simples e diretos dos produtos/serviços
- NÃO inclua códigos de produto (como 3UNX79, T3, etc.)
- NÃO inclua quantidades exatas se houver muitos itens
- NÃO inclua preços individuais
- NÃO inclua símbolos de moeda (R$, $)
- Use português simples e natural

EXEMPLOS DE BOAS DESCRIÇÕES:
- "Rodízio de pizza" (ao invés de "1 Rodízio Promocão 3UNX79 30 T3")
- "Refrigerante e água" (ao invés de "2 Refrigerante Lata 2UNX5.50 T2, 1 Água Aquarius Fresh 1UN T2")
- "Compras do supermercado" (para vários itens variados)
- "Creme de leite" (para um item específico)
- "Medicamentos" (para farmácia)
- "Combustível" (para posto de gasolina)

OUTRAS REGRAS:
- "valor": apenas o número decimal total (ex: 25.50)
- "data": formato YYYY-MM-DD ou "2024-01-01" se não conseguir identificar
- "tipo": sempre "despesa" (raramente será "receita")
- "estabelecimento": nome da empresa/loja SEM códigos ou informações técnicas
- "categoria": use uma das opções: alimentacao, transporte, saude, educacao, lazer, casa, compras, servicos, outros
- "confianca": "alta", "media" ou "baixa"

Se não conseguir identificar alguma informação, use valores padrão mas mantenha o formato JSON válido.
"""

            # Fazer requisição para OpenAI Vision
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}",
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=800,
                temperature=0.0
            )

            # Extrair resposta
            content = response.choices[0].message.content.strip()
            print(f"🤖 Resposta da OpenAI: {content}")
            
            # Tentar limpar a resposta para garantir JSON válido
            content = self._clean_json_response(content)
            
            # Tentar fazer parse do JSON
            try:
                result = json.loads(content)
                print(f"✅ JSON parseado com sucesso: {result}")
                
                # Validar e limpar dados
                cleaned_result = self._clean_extracted_data(result)
                return {
                    "success": True,
                    "data": cleaned_result,
                    "raw_response": content
                }
                
            except json.JSONDecodeError as e:
                print(f"❌ Erro ao fazer parse do JSON: {e}")
                print(f"📝 Conteúdo que falhou: {content}")
                
                # Tentar extrair informações manualmente como fallback
                fallback_data = self._extract_fallback_data(content)
                if fallback_data:
                    print(f"🔄 Dados extraídos via fallback: {fallback_data}")
                    cleaned_result = self._clean_extracted_data(fallback_data)
                    return {
                        "success": True,
                        "data": cleaned_result,
                        "raw_response": content
                    }
                
                return {
                    "success": False,
                    "error": "Não foi possível extrair informações estruturadas da imagem",
                    "raw_response": content
                }

        except Exception as e:
            print(f"❌ Erro geral no VisionService: {str(e)}")
            return {
                "success": False,
                "error": f"Erro ao processar imagem: {str(e)}"
            }

    def _clean_json_response(self, content: str) -> str:
        """
        Limpa a resposta para garantir JSON válido
        """
        # Remover possível texto antes e depois do JSON
        import re
        
        # Procurar por JSON entre chaves
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            return json_match.group(0)
        
        return content

    def _extract_fallback_data(self, content: str) -> Optional[Dict[str, Any]]:
        """
        Tenta extrair dados quando o JSON parsing falha
        """
        try:
            import re
            
            # Tentar extrair valor
            valor_match = re.search(r'valor["\s:]*(\d+[.,]?\d*)', content, re.IGNORECASE)
            valor = float(valor_match.group(1).replace(',', '.')) if valor_match else 0.0
            
            # Tentar extrair descrição
            desc_match = re.search(r'descricao["\s:]*["\']([^"\']+)["\']', content, re.IGNORECASE)
            descricao = desc_match.group(1) if desc_match else "Transação extraída da imagem"
            
            # Se conseguiu pelo menos o valor, criar dados básicos
            if valor > 0:
                from datetime import datetime
                return {
                    "valor": valor,
                    "descricao": descricao,
                    "data": datetime.now().strftime("%Y-%m-%d"),
                    "tipo": "despesa",
                    "estabelecimento": "Não identificado",
                    "categoria": "outros",
                    "confianca": "baixa",
                    "observacoes": "Dados extraídos via fallback"
                }
        except:
            pass
        
        return None

    def _clean_extracted_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Limpa e valida os dados extraídos
        """
        cleaned = {}
        
        # Valor - garantir que é float
        try:
            valor = data.get("valor", 0)
            if isinstance(valor, str):
                # Remover caracteres não numéricos exceto ponto e vírgula
                valor = valor.replace(",", ".").replace("R$", "").replace(" ", "")
                valor = ''.join(c for c in valor if c.isdigit() or c == '.')
            cleaned["valor"] = float(valor) if valor else 0.0
        except:
            cleaned["valor"] = 0.0

        # Descrição - limpar e formatar
        descricao = str(data.get("descricao", "")).strip()
        
        # Remover símbolos de moeda e caracteres indesejados
        descricao = descricao.replace("R$", "").replace("r$", "").replace("$", "")
        
        # Remover códigos técnicos comuns (padrões como 3UNX79, T3, 2UNX5.50, etc.)
        import re
        descricao = re.sub(r'\d+UNX?\d*\.?\d*', '', descricao)  # Remove códigos como 3UNX79, 2UNX5.50
        descricao = re.sub(r'\bT\d+\b', '', descricao)  # Remove códigos como T3, T2
        descricao = re.sub(r'\b\d+UN\b', '', descricao)  # Remove códigos como 1UN
        descricao = re.sub(r'\b\d+\s*UNX?\s*', '', descricao)  # Remove quantidades com UNX
        
        # Remover números soltos no início ou fim
        descricao = re.sub(r'^\d+\s*', '', descricao)  # Remove números do início
        descricao = re.sub(r'\s*\d+$', '', descricao)  # Remove números do fim
        
        # Limpar espaços múltiplos e vírgulas desnecessárias
        descricao = re.sub(r'\s*,\s*,\s*', ', ', descricao)  # Remove vírgulas duplicadas
        descricao = re.sub(r'\s+', ' ', descricao)  # Remove espaços múltiplos
        descricao = descricao.strip(' ,')  # Remove espaços e vírgulas das bordas
        
        # Capitalizar primeira letra de cada palavra
        descricao = ' '.join(word.capitalize() for word in descricao.split())
        
        # Se a descrição ficou muito longa (mais de 50 caracteres), tentar simplificar
        if len(descricao) > 50:
            # Se tem vírgulas, pegar apenas a primeira parte ou resumir
            if ',' in descricao:
                partes = descricao.split(',')
                if len(partes) > 2:
                    # Muitos itens - generalizar
                    if any(word in descricao.lower() for word in ['rodizio', 'pizza']):
                        descricao = "Rodízio"
                    elif any(word in descricao.lower() for word in ['refrigerante', 'agua', 'bebida']):
                        descricao = "Bebidas"
                    elif any(word in descricao.lower() for word in ['mercado', 'supermercado']):
                        descricao = "Compras do supermercado"
                    else:
                        descricao = "Compras variadas"
                else:
                    # Poucos itens - pegar o principal
                    descricao = partes[0].strip()
        
        cleaned["descricao"] = descricao[:100] if descricao else "Produto/Serviço"
        
        # Data
        data_str = str(data.get("data", "")).strip()
        if data_str and data_str != "não identificado":
            cleaned["data"] = data_str
        else:
            # Usar data atual se não identificada
            from datetime import datetime
            cleaned["data"] = datetime.now().strftime("%Y-%m-%d")

        # Tipo
        tipo = str(data.get("tipo", "despesa")).lower()
        cleaned["tipo"] = "receita" if "receita" in tipo else "despesa"

        # Estabelecimento - limpar e formatar
        estabelecimento = str(data.get("estabelecimento", "")).strip()
        # Capitalizar cada palavra
        estabelecimento = ' '.join(word.capitalize() for word in estabelecimento.split())
        cleaned["estabelecimento"] = estabelecimento[:100] if estabelecimento else "Não identificado"

        # Categoria
        categoria = str(data.get("categoria", "outros")).lower().strip()
        
        # Mapear categorias brasileiras
        categoria_mapping = {
            'alimentacao': 'Alimentação',
            'alimentação': 'Alimentação', 
            'comida': 'Alimentação',
            'food': 'Alimentação',
            'mercado': 'Alimentação',
            'supermercado': 'Alimentação',
            'restaurante': 'Alimentação',
            'lanchonete': 'Alimentação',
            'padaria': 'Alimentação',
            'transporte': 'Transporte',
            'uber': 'Transporte',
            'taxi': 'Transporte',
            'combustivel': 'Transporte',
            'combustível': 'Transporte',
            'gasolina': 'Transporte',
            'saude': 'Saúde',
            'saúde': 'Saúde',
            'farmacia': 'Saúde',
            'farmácia': 'Saúde',
            'medico': 'Saúde',
            'médico': 'Saúde',
            'hospital': 'Saúde',
            'educacao': 'Educação',
            'educação': 'Educação',
            'escola': 'Educação',
            'curso': 'Educação',
            'lazer': 'Lazer',
            'cinema': 'Lazer',
            'entretenimento': 'Lazer',
            'casa': 'Casa',
            'casa e jardim': 'Casa',
            'limpeza': 'Casa',
            'compras': 'Compras',
            'shopping': 'Compras',
            'roupas': 'Compras',
            'vestuario': 'Compras',
            'vestuário': 'Compras',
            'servicos': 'Serviços',
            'serviços': 'Serviços',
            'servico': 'Serviços',
            'serviço': 'Serviços'
        }
        
        cleaned["categoria"] = categoria_mapping.get(categoria, 'Outros')

        # Confiança
        confianca = str(data.get("confianca", "media")).lower()
        cleaned["confianca"] = confianca if confianca in ["alta", "media", "baixa"] else "media"

        # Observações
        cleaned["observacoes"] = str(data.get("observacoes", "")).strip()[:500]

        return cleaned 