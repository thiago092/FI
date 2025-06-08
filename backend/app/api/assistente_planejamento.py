from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any, Optional
import json
from openai import OpenAI

from ..database import get_db
from ..core.security import get_current_tenant_id
from ..models.financial import Categoria
from ..schemas.financial import PlanejamentoMensalCreate
from ..core.config import Settings

router = APIRouter()
settings = Settings()

class AssistentePlanejamentoService:
    """Serviço inteligente que considera gastos fixos e calcula distribuição saudável da renda disponível"""
    
    def __init__(self, db: Session, tenant_id: int):
        self.db = db
        self.tenant_id = tenant_id
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    def gerar_planejamento_inteligente(self, dados_usuario: Dict[str, Any]) -> Dict[str, Any]:
        """Gera planejamento considerando gastos fixos e renda disponível"""
        
        # Buscar categorias disponíveis
        categorias = self.db.query(Categoria).filter(
            Categoria.tenant_id == self.tenant_id
        ).all()
        
        categorias_dict = {cat.id: {"nome": cat.nome, "cor": cat.cor, "icone": cat.icone} 
                          for cat in categorias}
        
        # Calcular renda disponível após gastos fixos
        analise_financeira = self._analisar_situacao_financeira(dados_usuario)
        
        # Gerar planejamento usando IA ou fallback
        try:
            resultado = self._gerar_com_openai(dados_usuario, categorias_dict, analise_financeira)
        except Exception as e:
            print(f"Erro na IA, usando fallback: {e}")
            resultado = self._gerar_planejamento_inteligente_offline(dados_usuario, categorias_dict, analise_financeira)
        
        return resultado
    
    def _analisar_situacao_financeira(self, dados: Dict[str, Any]) -> Dict[str, Any]:
        """Analisa a situação financeira separando gastos fixos de variáveis"""
        
        renda_total = dados.get('renda_total', 0)
        pessoas_casa = dados.get('pessoas_casa', 1)
        
        # GASTOS FIXOS (não podem ser alterados facilmente)
        gastos_fixos = {
            'moradia': dados.get('gasto_moradia', 0),  # Aluguel/financiamento já estabelecido
            'seguros': dados.get('gasto_seguros', 0),  # Seguro carro, vida, etc
            'financiamentos': dados.get('gasto_financiamentos', 0),  # Parcelas fixas
            'plano_saude': dados.get('gasto_plano_saude', 0),  # Plano de saúde familiar
        }
        
        total_gastos_fixos = sum(gastos_fixos.values())
        renda_disponivel = renda_total - total_gastos_fixos
        
        # ANÁLISE DE SAÚDE FINANCEIRA
        percentual_gastos_fixos = (total_gastos_fixos / renda_total * 100) if renda_total > 0 else 0
        
        # Classificar situação financeira
        if percentual_gastos_fixos > 70:
            situacao = "CRÍTICA"
            alerta = "Gastos fixos muito altos! Considere renegociar contratos ou buscar renda adicional."
        elif percentual_gastos_fixos > 50:
            situacao = "ATENÇÃO"
            alerta = "Gastos fixos elevados. Pouco espaço para outros gastos e poupança."
        elif percentual_gastos_fixos > 35:
            situacao = "MODERADA"
            alerta = "Situação controlada, mas monitore os gastos variáveis."
        else:
            situacao = "SAUDÁVEL"
            alerta = "Boa margem para gastos variáveis e poupança!"
        
        return {
            'renda_total': renda_total,
            'gastos_fixos': gastos_fixos,
            'total_gastos_fixos': total_gastos_fixos,
            'renda_disponivel': renda_disponivel,
            'percentual_gastos_fixos': round(percentual_gastos_fixos, 1),
            'situacao_financeira': situacao,
            'alerta_principal': alerta,
            'pessoas_casa': pessoas_casa
        }
    
    def _gerar_com_openai(self, dados_usuario: Dict, categorias: Dict, analise: Dict) -> Dict[str, Any]:
        """Gera planejamento usando OpenAI com foco na renda disponível"""
        
        prompt = self._criar_prompt_inteligente(dados_usuario, categorias, analise)
        
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """Você é um especialista em planejamento financeiro pessoal. 

FOCO: Trabalhar com a RENDA DISPONÍVEL após gastos fixos.

MÉTRICAS SAUDÁVEIS PARA RENDA DISPONÍVEL:
- Alimentação: 30-40% da renda disponível
- Transporte variável: 15-25% (combustível, manutenção, uber)
- Emergências médicas: 10-15% (além do plano)
- Educação/Desenvolvimento: 10-20%
- Lazer/Entretenimento: 15-25%
- Poupança: 20-30% (OBRIGATÓRIO para saúde financeira)
- Outros/Contingência: 5-10%

REGRAS IMPORTANTES:
1. NUNCA sugerir redução de gastos fixos informados
2. Trabalhar APENAS com a renda disponível
3. Garantir pelo menos 20% para poupança
4. Adaptar percentuais ao perfil da família
5. Considerar emergências e imprevistos
6. Retornar apenas JSON válido

Se renda disponível for negativa ou muito baixa, dar alertas específicos."""
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=1500,
            response_format={"type": "json_object"}
        )
        
        resultado_ia = json.loads(response.choices[0].message.content)
        return self._processar_resultado_ia(resultado_ia, dados_usuario, categorias, analise)
    
    def _criar_prompt_inteligente(self, dados: Dict, categorias: Dict, analise: Dict) -> str:
        """Cria prompt focado na renda disponível"""
        
        categorias_info = "\n".join([
            f"- ID {cat_id}: {cat_data['nome']}" 
            for cat_id, cat_data in categorias.items()
        ])
        
        return f"""
ANÁLISE FINANCEIRA COMPLETA:

SITUAÇÃO ATUAL:
- Renda total mensal: R$ {analise['renda_total']:,.2f}
- Pessoas na casa: {analise['pessoas_casa']}
- Situação financeira: {analise['situacao_financeira']}

GASTOS FIXOS (NÃO ALTERAR):
- Moradia: R$ {analise['gastos_fixos']['moradia']:,.2f}
- Seguros: R$ {analise['gastos_fixos']['seguros']:,.2f}
- Financiamentos: R$ {analise['gastos_fixos']['financiamentos']:,.2f}
- Plano de Saúde: R$ {analise['gastos_fixos']['plano_saude']:,.2f}
- TOTAL FIXO: R$ {analise['total_gastos_fixos']:,.2f} ({analise['percentual_gastos_fixos']:.1f}% da renda)

RENDA DISPONÍVEL PARA PLANEJAMENTO: R$ {analise['renda_disponivel']:,.2f}

PERFIL ADICIONAL:
- Gasto atual alimentação: R$ {dados.get('gasto_alimentacao', 0):,.2f}
- Gasto atual transporte: R$ {dados.get('gasto_transporte', 0):,.2f}
- Tem filhos escola: {dados.get('tem_filhos_escola', 'Não')}
- Hábito poupança: {dados.get('habito_poupanca', 'Pouco')}
- Meta economia: R$ {dados.get('meta_economia', 0):,.2f}

CATEGORIAS DISPONÍVEIS:
{categorias_info}

TAREFA:
Criar planejamento INTELIGENTE baseado na renda disponível de R$ {analise['renda_disponivel']:,.2f}.

FORMATO RESPOSTA:
{{
  "analise_situacao": "Análise da situação financeira atual",
  "viabilidade_poupanca": "Se é possível poupar e quanto",
  "alertas_importantes": ["Alertas específicos"],
  "planos_categoria": [
    {{
      "categoria_id": id_categoria,
      "valor_planejado": valor_em_reais,
      "percentual_renda_disponivel": percentual_da_renda_disponivel,
      "prioridade": 1_2_ou_3,
      "observacoes": "Justificativa específica",
      "tipo_gasto": "fixo_obrigatorio|variavel_necessario|variavel_opcional"
    }}
  ],
  "resumo_distribuicao": {{
    "alimentacao_percentual": percentual_renda_disponivel,
    "transporte_percentual": percentual_renda_disponivel,
    "educacao_percentual": percentual_renda_disponivel,
    "lazer_percentual": percentual_renda_disponivel,
    "poupanca_percentual": percentual_renda_disponivel,
    "outros_percentual": percentual_renda_disponivel
  }},
  "dicas_personalizadas": ["Dicas específicas para este perfil"],
  "metas_financeiras": ["Metas recomendadas para próximos meses"]
}}
"""
    
    def _processar_resultado_ia(self, resultado_ia: Dict, dados_usuario: Dict, categorias: Dict, analise: Dict) -> Dict:
        """Processa e valida resultado da IA"""
        
        renda_disponivel = analise['renda_disponivel']
        
        # Validar planos de categoria
        planos_categoria = []
        total_planejado_variavel = 0
        
        for plano in resultado_ia.get('planos_categoria', []):
            categoria_id = plano.get('categoria_id')
            if categoria_id not in categorias:
                continue
                
            valor_planejado = max(0, plano.get('valor_planejado', 0))
            
            # Limitar valor ao disponível
            if total_planejado_variavel + valor_planejado > renda_disponivel:
                valor_planejado = max(0, renda_disponivel - total_planejado_variavel)
            
            if valor_planejado > 0:
                plano_validado = {
                    "categoria_id": categoria_id,
                    "valor_planejado": round(valor_planejado, 2),
                    "prioridade": plano.get('prioridade', 2),
                    "observacoes": plano.get('observacoes', 'Sugerido pelo assistente'),
                    "tipo_gasto": plano.get('tipo_gasto', 'variavel_necessario'),
                    "percentual_renda_disponivel": round((valor_planejado / renda_disponivel * 100), 1) if renda_disponivel > 0 else 0
                }
                planos_categoria.append(plano_validado)
                total_planejado_variavel += valor_planejado
        
        # Adicionar gastos fixos ao planejamento final
        for tipo_gasto, valor in analise['gastos_fixos'].items():
            if valor > 0:
                # Buscar categoria correspondente
                categoria_id = self._mapear_categoria_fixa(tipo_gasto, categorias)
                if categoria_id:
                    planos_categoria.append({
                        "categoria_id": categoria_id,
                        "valor_planejado": valor,
                        "prioridade": 1,
                        "observacoes": f"Gasto fixo - {tipo_gasto}",
                        "tipo_gasto": "fixo_obrigatorio",
                        "percentual_renda_disponivel": 0  # Não conta na renda disponível
                    })
        
        # Construir resposta final
        agora = __import__('datetime').datetime.now()
        total_geral = analise['total_gastos_fixos'] + total_planejado_variavel
        
        return {
            "planejamento": {
                "nome": dados_usuario.get('nome', f"Planejamento Inteligente {agora.month}/{agora.year}"),
                "descricao": f"Planejamento para {analise['pessoas_casa']} pessoa(s) - {analise['situacao_financeira']} - " + 
                           resultado_ia.get('analise_situacao', 'Criado pelo assistente'),
                "mes": agora.month,
                "ano": agora.year,
                "renda_esperada": analise['renda_total'],
                "planos_categoria": planos_categoria
            },
            "analise_inteligente": {
                "situacao_financeira": analise['situacao_financeira'],
                "renda_disponivel": renda_disponivel,
                "percentual_gastos_fixos": analise['percentual_gastos_fixos'],
                "analise_situacao": resultado_ia.get('analise_situacao', ''),
                "viabilidade_poupanca": resultado_ia.get('viabilidade_poupanca', ''),
                "alertas_importantes": resultado_ia.get('alertas_importantes', []),
                "dicas_personalizadas": resultado_ia.get('dicas_personalizadas', []),
                "metas_financeiras": resultado_ia.get('metas_financeiras', [])
            },
            "metricas_saude": {
                "total_planejado": total_geral,
                "sobra_mensal": analise['renda_total'] - total_geral,
                "percentual_poupanca": round((planos_categoria and next((p['valor_planejado'] for p in planos_categoria if 'poupan' in categorias.get(p['categoria_id'], {}).get('nome', '').lower()), 0) / analise['renda_total'] * 100), 1),
                "saude_financeira": self._calcular_saude_financeira(analise, total_planejado_variavel),
                "gastos_fixos_vs_renda": analise['percentual_gastos_fixos'],
                "margem_seguranca": round((renda_disponivel - total_planejado_variavel) / analise['renda_total'] * 100, 1) if analise['renda_total'] > 0 else 0
            }
        }
    
    def _gerar_planejamento_inteligente_offline(self, dados_usuario: Dict, categorias: Dict, analise: Dict) -> Dict:
        """Fallback inteligente baseado em métricas saudáveis"""
        
        renda_disponivel = analise['renda_disponivel']
        pessoas_casa = analise['pessoas_casa']
        
        if renda_disponivel <= 0:
            return self._gerar_alerta_situacao_critica(dados_usuario, analise)
        
        # Percentuais saudáveis para renda disponível
        distribuicao_saudavel = {
            'alimentacao': 0.35,
            'transporte': 0.20,
            'saude_emergencial': 0.10,
            'educacao': 0.15,
            'lazer': 0.15,
            'poupanca': 0.25,  # Mínimo para saúde financeira
        }
        
        # Ajustar para tamanho da família
        if pessoas_casa > 3:
            distribuicao_saudavel['alimentacao'] += 0.05
            distribuicao_saudavel['lazer'] -= 0.05
        
        # Mapear categorias
        mapeamento = self._mapear_categorias_inteligente(categorias)
        
        planos_categoria = []
        total_usado = 0
        
        for tipo, percentual in distribuicao_saudavel.items():
            if tipo in mapeamento:
                valor_sugerido = renda_disponivel * percentual
                
                # Ajustes específicos
                if tipo == 'alimentacao':
                    valor_atual = dados_usuario.get('gasto_alimentacao', 0)
                    if valor_atual > 0:
                        valor_sugerido = max(valor_sugerido, valor_atual)
                
                valor_final = min(valor_sugerido, renda_disponivel - total_usado)
                
                if valor_final > 0:
                    planos_categoria.append({
                        "categoria_id": mapeamento[tipo],
                        "valor_planejado": round(valor_final, 2),
                        "prioridade": 1 if tipo in ['alimentacao', 'poupanca'] else 2,
                        "observacoes": f"Distribuição saudável: {percentual*100:.0f}% da renda disponível",
                        "tipo_gasto": "variavel_necessario" if tipo != 'lazer' else "variavel_opcional",
                        "percentual_renda_disponivel": round(percentual * 100, 1)
                    })
                    total_usado += valor_final
        
        # Adicionar gastos fixos
        for tipo_gasto, valor in analise['gastos_fixos'].items():
            if valor > 0:
                categoria_id = self._mapear_categoria_fixa(tipo_gasto, categorias)
                if categoria_id:
                    planos_categoria.append({
                        "categoria_id": categoria_id,
                        "valor_planejado": valor,
                        "prioridade": 1,
                        "observacoes": f"Gasto fixo - {tipo_gasto}",
                        "tipo_gasto": "fixo_obrigatorio",
                        "percentual_renda_disponivel": 0
                    })
        
        agora = __import__('datetime').datetime.now()
        total_geral = analise['total_gastos_fixos'] + total_usado
        
        return {
            "planejamento": {
                "nome": dados_usuario.get('nome', f"Planejamento Saudável {agora.month}/{agora.year}"),
                "descricao": f"Planejamento baseado em métricas saudáveis para {pessoas_casa} pessoa(s) - {analise['situacao_financeira']}",
                "mes": agora.month,
                "ano": agora.year,
                "renda_esperada": analise['renda_total'],
                "planos_categoria": planos_categoria
            },
            "analise_inteligente": {
                "situacao_financeira": analise['situacao_financeira'],
                "renda_disponivel": renda_disponivel,
                "percentual_gastos_fixos": analise['percentual_gastos_fixos'],
                "analise_situacao": f"Planejamento criado com base em métricas saudáveis para renda disponível de R$ {renda_disponivel:,.2f}",
                "alertas_importantes": [analise['alerta_principal']] if analise['situacao_financeira'] != 'SAUDÁVEL' else [],
                "dicas_personalizadas": self._gerar_dicas_personalizadas(analise, pessoas_casa),
                "metas_financeiras": self._gerar_metas_financeiras(analise)
            },
            "metricas_saude": {
                "total_planejado": total_geral,
                "sobra_mensal": analise['renda_total'] - total_geral,
                "percentual_poupanca": round((renda_disponivel * 0.25) / analise['renda_total'] * 100, 1),
                "saude_financeira": self._calcular_saude_financeira(analise, total_usado),
                "gastos_fixos_vs_renda": analise['percentual_gastos_fixos'],
                "margem_seguranca": round((renda_disponivel - total_usado) / analise['renda_total'] * 100, 1)
            }
        }
    
    def _mapear_categorias_inteligente(self, categorias: Dict) -> Dict[str, int]:
        """Mapeia categorias do usuário para tipos de gasto"""
        mapeamento = {}
        
        for cat_id, cat_data in categorias.items():
            nome_lower = cat_data['nome'].lower()
            
            if any(palavra in nome_lower for palavra in ['alimenta', 'comida', 'mercado', 'supermercado', 'feira']):
                mapeamento['alimentacao'] = cat_id
            elif any(palavra in nome_lower for palavra in ['transport', 'combustível', 'gasolina', 'uber', 'onibus']):
                mapeamento['transporte'] = cat_id
            elif any(palavra in nome_lower for palavra in ['saúde', 'saude', 'médico', 'emergencia', 'farmacia']):
                mapeamento['saude_emergencial'] = cat_id
            elif any(palavra in nome_lower for palavra in ['educação', 'educacao', 'escola', 'curso', 'desenvolvimento']):
                mapeamento['educacao'] = cat_id
            elif any(palavra in nome_lower for palavra in ['lazer', 'entretenimento', 'diversão', 'cinema', 'viagem']):
                mapeamento['lazer'] = cat_id
            elif any(palavra in nome_lower for palavra in ['poupança', 'poupanca', 'investimento', 'reserva', 'emergencia']):
                mapeamento['poupanca'] = cat_id
        
        return mapeamento
    
    def _mapear_categoria_fixa(self, tipo_gasto: str, categorias: Dict) -> Optional[int]:
        """Mapeia gasto fixo para categoria"""
        palavras_chave = {
            'moradia': ['moradia', 'casa', 'aluguel', 'financiamento', 'habitação'],
            'seguros': ['seguro', 'seguros', 'proteção'],
            'financiamentos': ['financiamento', 'parcela', 'empréstimo'],
            'plano_saude': ['saúde', 'saude', 'plano', 'médico']
        }
        
        for cat_id, cat_data in categorias.items():
            nome_lower = cat_data['nome'].lower()
            if any(palavra in nome_lower for palavra in palavras_chave.get(tipo_gasto, [])):
                return cat_id
        
        return None
    
    def _calcular_saude_financeira(self, analise: Dict, gastos_variaveis: float) -> str:
        """Calcula indicador de saúde financeira"""
        percentual_fixos = analise['percentual_gastos_fixos']
        sobra = analise['renda_total'] - analise['total_gastos_fixos'] - gastos_variaveis
        percentual_sobra = (sobra / analise['renda_total'] * 100) if analise['renda_total'] > 0 else 0
        
        if percentual_fixos > 70 or percentual_sobra < 5:
            return "CRÍTICA - Busque renda adicional ou renegocie contratos"
        elif percentual_fixos > 50 or percentual_sobra < 15:
            return "ATENÇÃO - Controle rigoroso dos gastos variáveis"
        elif percentual_fixos > 35 or percentual_sobra < 25:
            return "MODERADA - Situação controlada, mantenha disciplina"
        else:
            return "EXCELENTE - Boa margem para investimentos e objetivos"
    
    def _gerar_dicas_personalizadas(self, analise: Dict, pessoas_casa: int) -> List[str]:
        """Gera dicas baseadas no perfil"""
        dicas = []
        
        if analise['percentual_gastos_fixos'] > 60:
            dicas.append("Considere renegociar contratos fixos ou buscar renda adicional")
        
        if pessoas_casa > 3:
            dicas.append("Compre alimentos em maior quantidade para economizar")
            dicas.append("Considere atividades familiares gratuitas ou de baixo custo")
        
        if analise['renda_disponivel'] > 0:
            dicas.append("Reserve pelo menos 20% da renda disponível para emergências")
            dicas.append("Monitore gastos variáveis semanalmente")
        
        return dicas
    
    def _gerar_metas_financeiras(self, analise: Dict) -> List[str]:
        """Gera metas baseadas na situação"""
        metas = []
        
        if analise['situacao_financeira'] in ['CRÍTICA', 'ATENÇÃO']:
            metas.append("Criar reserva de emergência de pelo menos R$ 1.000")
            metas.append("Reduzir gastos variáveis em 10% nos próximos 3 meses")
        else:
            metas.append("Aumentar reserva para 6 meses de gastos essenciais")
            metas.append("Investir pelo menos 15% da renda em objetivos de longo prazo")
        
        return metas
    
    def _gerar_alerta_situacao_critica(self, dados_usuario: Dict, analise: Dict) -> Dict:
        """Gera resposta para situação financeira crítica"""
        return {
            "planejamento": None,
            "analise_inteligente": {
                "situacao_financeira": "CRÍTICA",
                "renda_disponivel": analise['renda_disponivel'],
                "alertas_importantes": [
                    "ATENÇÃO: Gastos fixos excedem ou igualam a renda total!",
                    "É urgente revisar contratos e buscar renda adicional",
                    "Considere renegociar financiamentos e seguros"
                ],
                "acoes_urgentes": [
                    "Renegociar aluguel ou financiamento imobiliário",
                    "Revisar seguros e planos (manter apenas essenciais)",
                    "Buscar renda extra ou novo emprego",
                    "Conversar com banco sobre renegociação de dívidas"
                ]
            },
            "emergencia": True
        }

@router.post("/gerar-planejamento")
async def gerar_planejamento_inteligente(
    dados_usuario: Dict[str, Any],
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id)
):
    """
    Gera planejamento inteligente considerando gastos fixos e renda disponível.
    
    O assistente:
    1. Separa gastos fixos (moradia, seguros) dos variáveis
    2. Calcula renda disponível após gastos fixos
    3. Aplica métricas saudáveis à renda disponível
    4. Usa IA para personalizar sugestões
    """
    try:
        assistente = AssistentePlanejamentoService(db, tenant_id)
        resultado = assistente.gerar_planejamento_inteligente(dados_usuario)
        return resultado
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Erro ao gerar planejamento: {str(e)}"
        )

@router.get("/metricas-saudaveis")
async def get_metricas_saudaveis():
    """Retorna métricas saudáveis baseadas em renda disponível"""
    return {
        "conceito": "Métricas baseadas na RENDA DISPONÍVEL após gastos fixos obrigatórios",
        "gastos_fixos_max": {
            "percentual_maximo": 60,
            "percentual_ideal": 40,
            "descricao": "Gastos que não podem ser alterados facilmente (moradia, seguros, financiamentos)"
        },
        "distribuicao_renda_disponivel": {
            "alimentacao": {
                "percentual": "30-40%",
                "descricao": "Supermercado, feira, refeições (ajustar por pessoa)"
            },
            "transporte_variavel": {
                "percentual": "15-25%", 
                "descricao": "Combustível, manutenção, transporte eventual"
            },
            "saude_emergencial": {
                "percentual": "10-15%",
                "descricao": "Gastos médicos não cobertos pelo plano"
            },
            "educacao": {
                "percentual": "10-20%",
                "descricao": "Cursos, desenvolvimento, material escolar"
            },
            "lazer": {
                "percentual": "15-25%",
                "descricao": "Entretenimento, viagens, hobbies"
            },
            "poupanca": {
                "percentual": "20-30%",
                "descricao": "OBRIGATÓRIO para saúde financeira"
            }
        },
        "indicadores_saude": {
            "critica": "Gastos fixos > 70% da renda OU sobra < 5%",
            "atencao": "Gastos fixos 50-70% da renda OU sobra 5-15%", 
            "moderada": "Gastos fixos 35-50% da renda OU sobra 15-25%",
            "excelente": "Gastos fixos < 35% da renda E sobra > 25%"
        },
        "regras_importantes": [
            "Gastos fixos nunca devem exceder 60% da renda",
            "Sempre reserve pelo menos 20% da renda disponível",
            "Priorize criar reserva de emergência de 6 meses",
            "Monitore gastos variáveis semanalmente",
            "Renda disponível negativa = situação crítica urgente"
        ]
    } 