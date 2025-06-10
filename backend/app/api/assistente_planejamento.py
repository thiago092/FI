from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional
from ..database import get_db
from ..models.financial import Categoria, PlanejamentoMensal, PlanoCategoria
from ..schemas.financial import CategoriaCreate
from ..core.security import get_current_tenant_user
from ..models.user import User
from ..core.config import settings
from openai import OpenAI
import json
import re
from datetime import datetime

router = APIRouter()

# Dados socioeconômicos brasileiros (baseados em POF-IBGE)
DADOS_SOCIOECONOMICOS = {
    "classe_baixa": {
        "renda_max": 2640,  # até 2 salários mínimos
        "alimentacao": {"min": 30, "max": 40},
        "moradia": {"min": 25, "max": 35},
        "transporte": {"min": 15, "max": 20},
        "saude": {"min": 8, "max": 12},
        "educacao": {"min": 3, "max": 8},
        "lazer": {"min": 2, "max": 5},
        "vestuario": {"min": 3, "max": 6},
        "poupanca": {"min": 0, "max": 2}
    },
    "classe_media_baixa": {
        "renda_min": 2641,
        "renda_max": 6600,  # 3-5 salários
        "alimentacao": {"min": 20, "max": 30},
        "moradia": {"min": 20, "max": 30},
        "transporte": {"min": 10, "max": 18},
        "saude": {"min": 8, "max": 15},
        "educacao": {"min": 5, "max": 12},
        "lazer": {"min": 5, "max": 10},
        "vestuario": {"min": 3, "max": 8},
        "investimentos": {"min": 2, "max": 5},
        "poupanca": {"min": 3, "max": 8}
    },
    "classe_media": {
        "renda_min": 6601,
        "renda_max": 13200,  # 6-10 salários
        "alimentacao": {"min": 15, "max": 25},
        "moradia": {"min": 20, "max": 30},
        "transporte": {"min": 8, "max": 15},
        "saude": {"min": 8, "max": 15},
        "educacao": {"min": 8, "max": 15},
        "lazer": {"min": 8, "max": 15},
        "vestuario": {"min": 3, "max": 8},
        "investimentos": {"min": 5, "max": 10},
        "poupanca": {"min": 10, "max": 15}
    },
    "classe_media_alta": {
        "renda_min": 13201,
        "renda_max": 26400,  # 11-20 salários
        "alimentacao": {"min": 10, "max": 15},
        "moradia": {"min": 15, "max": 20},
        "transporte": {"min": 5, "max": 10},
        "saude": {"min": 5, "max": 10},
        "educacao": {"min": 8, "max": 12},
        "lazer": {"min": 8, "max": 12},
        "vestuario": {"min": 3, "max": 6},
        "investimentos": {"min": 10, "max": 15},
        "poupanca": {"min": 10, "max": 15}
    },
    "classe_alta": {
        "renda_min": 26401,
        "alimentacao": {"min": 8, "max": 15},
        "moradia": {"min": 10, "max": 20},
        "transporte": {"min": 5, "max": 10},
        "saude": {"min": 5, "max": 10},
        "educacao": {"min": 8, "max": 15},
        "lazer": {"min": 15, "max": 25},
        "vestuario": {"min": 3, "max": 8},
        "investimentos": {"min": 20, "max": 40},
        "poupanca": {"min": 15, "max": 30}
    }
}

# Categorias essenciais com mapeamentos semânticos
CATEGORIAS_ESSENCIAIS = {
    "alimentacao": {
        "nomes": ["alimentação", "alimentacao", "mercado", "supermercado", "comida", "restaurante", "delivery"],
        "cor": "#10B981",
        "icone": "Utensils"
    },
    "moradia": {
        "nomes": ["moradia", "aluguel", "financiamento", "condomínio", "condominio", "iptu", "água", "agua", "luz", "energia", "gás", "gas"],
        "cor": "#3B82F6",
        "icone": "Home"
    },
    "transporte": {
        "nomes": ["transporte", "combustível", "combustivel", "gasolina", "uber", "99", "ônibus", "onibus", "metrô", "metro", "taxi"],
        "cor": "#F59E0B",
        "icone": "Car"
    },
    "saude": {
        "nomes": ["saúde", "saude", "plano de saúde", "médico", "medico", "farmácia", "farmacia", "remédio", "remedio"],
        "cor": "#EF4444",
        "icone": "Heart"
    },
    "educacao": {
        "nomes": ["educação", "educacao", "escola", "faculdade", "curso", "livro", "material escolar"],
        "cor": "#8B5CF6",
        "icone": "BookOpen"
    },
    "lazer": {
        "nomes": ["lazer", "entretenimento", "cinema", "teatro", "festa", "viagem", "hobby"],
        "cor": "#EC4899",
        "icone": "Gamepad2"
    },
    "vestuario": {
        "nomes": ["vestuário", "vestuario", "roupa", "calçado", "calcado", "sapato", "tênis", "tenis"],
        "cor": "#14B8A6",
        "icone": "Shirt"
    },
    "poupanca": {
        "nomes": ["poupança", "poupanca", "reserva", "emergência", "emergencia"],
        "cor": "#059669",
        "icone": "PiggyBank"
    },
    "investimentos": {
        "nomes": ["investimentos", "investimento", "ações", "acoes", "renda fixa", "tesouro"],
        "cor": "#7C3AED",
        "icone": "TrendingUp"
    }
}

class AssistentePlanejamentoService:
    def __init__(self, db: Session, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.client = None
        if settings.OPENAI_API_KEY:
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def determinar_classe_social(self, renda: float) -> str:
        """Determina a classe social baseada na renda"""
        if renda <= 2640:
            return "classe_baixa"
        elif renda <= 6600:
            return "classe_media_baixa"
        elif renda <= 13200:
            return "classe_media"
        elif renda <= 26400:
            return "classe_media_alta"
        else:
            return "classe_alta"

    def obter_categorias_usuario(self) -> List[Dict[str, Any]]:
        """Obtém categorias existentes do usuário"""
        categorias = self.db.query(Categoria).filter(
            Categoria.tenant_id == self.tenant_id
        ).all()
        
        return [{
            "id": cat.id,
            "nome": cat.nome,
            "cor": cat.cor,
            "icone": cat.icone
        } for cat in categorias]

    def mapear_categoria_existente(self, categorias_usuario: List[Dict], categoria_essencial: str) -> Optional[Dict]:
        """Mapeia categoria essencial para categoria existente do usuário"""
        essencial_info = CATEGORIAS_ESSENCIAIS.get(categoria_essencial, {})
        nomes_busca = essencial_info.get("nomes", [])
        
        for categoria in categorias_usuario:
            nome_lower = categoria["nome"].lower()
            if any(nome in nome_lower for nome in nomes_busca):
                return categoria
        
        return None

    def gerar_sugestoes_com_ia(self, perfil: Dict[str, Any], categorias_usuario: List[Dict]) -> Dict[str, Any]:
        """Gera sugestões usando GPT"""
        if not self.client:
            return self.gerar_sugestoes_fallback(perfil, categorias_usuario)
        
        try:
            classe_social = self.determinar_classe_social(perfil["renda"])
            dados_classe = DADOS_SOCIOECONOMICOS[classe_social]
            renda = perfil["renda"]
            limite_orcamento = renda * 0.95  # Máximo 95% da renda
            
            # Montar contexto para a IA
            categorias_texto = "\n".join([f"- {cat['nome']}" for cat in categorias_usuario])
            
            prompt = f"""
Você é um consultor financeiro especialista em orçamento familiar brasileiro.

PERFIL DO USUÁRIO:
- Renda mensal: R$ {perfil["renda"]:,.2f}
- Composição familiar: {perfil["composicao_familiar"]}
- Tipo de moradia: {perfil["tipo_moradia"]}
- Estilo de vida: {perfil["estilo_vida"]}
- Classe social estimada: {classe_social.replace("_", " ").title()}

RESTRIÇÕES IMPORTANTES:
- LIMITE MÁXIMO: R$ {limite_orcamento:,.2f} (95% da renda)
- O total de todas as sugestões NÃO PODE EXCEDER este limite
- Reserve 5% da renda para emergências e imprevistos
- Se necessário, reduza proporcionalmente todas as categorias para caber no limite

CATEGORIAS JÁ EXISTENTES:
{categorias_texto or "Nenhuma categoria criada ainda"}

DADOS SOCIOECONÔMICOS BRASILEIROS para {classe_social.replace("_", " ").title()}:
{json.dumps(dados_classe, indent=2)}

TAREFA:
1. Analise o perfil e as categorias existentes
2. Para cada categoria existente, sugira um valor adequado baseado na renda e perfil
3. Identifique categorias essenciais faltantes que o usuário deveria ter
4. Gere sugestões personalizadas considerando composição familiar e estilo de vida
5. GARANTA que o total_sugerido não exceda R$ {limite_orcamento:,.2f}

FORMATO DE RESPOSTA (JSON):
{{
    "classe_social": "{classe_social}",
    "analise_perfil": "Análise detalhada do perfil financeiro do usuário",
    "categorias_existentes": [
        {{
            "categoria_id": 1,
            "nome": "Nome da categoria",
            "valor_sugerido": 500.0,
            "percentual": 10.0,
            "justificativa": "Explicação da sugestão"
        }}
    ],
    "categorias_novas": [
        {{
            "nome": "Nova categoria",
            "valor_sugerido": 300.0,
            "percentual": 6.0,
            "justificativa": "Por que é importante ter esta categoria",
            "cor": "#10B981",
            "icone": "Home"
        }}
    ],
    "dicas_personalizadas": [
        "Dica financeira 1",
        "Dica financeira 2"
    ],
    "percentual_reserva": 5.0,
    "total_sugerido": DEVE_SER_MENOR_QUE_{limite_orcamento}
}}

Responda APENAS com o JSON válido, sem comentários adicionais.
"""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            
            resultado = json.loads(response.choices[0].message.content)
            
            # VALIDAÇÃO CRÍTICA: Garantir que não exceda 95% da renda
            total_sugerido = resultado.get("total_sugerido", 0)
            if total_sugerido > limite_orcamento:
                # Aplicar redução proporcional
                fator_reducao = limite_orcamento / total_sugerido
                
                # Reduzir categorias existentes
                for cat in resultado.get("categorias_existentes", []):
                    cat["valor_sugerido"] = round(cat["valor_sugerido"] * fator_reducao, 2)
                    cat["percentual"] = round(cat["percentual"] * fator_reducao, 1)
                
                # Reduzir categorias novas
                for cat in resultado.get("categorias_novas", []):
                    cat["valor_sugerido"] = round(cat["valor_sugerido"] * fator_reducao, 2)
                    cat["percentual"] = round(cat["percentual"] * fator_reducao, 1)
                
                resultado["total_sugerido"] = round(limite_orcamento, 2)
            
            # Adicionar campos extras para compatibilidade
            resultado["percentual_total"] = round((resultado["total_sugerido"] / renda) * 100, 1)
            resultado["saldo_livre"] = round(renda - resultado["total_sugerido"], 2)
            
            return resultado
            
        except Exception as e:
            print(f"Erro na IA: {e}")
            return self.gerar_sugestoes_fallback(perfil, categorias_usuario)

    def gerar_sugestoes_fallback(self, perfil: Dict[str, Any], categorias_usuario: List[Dict]) -> Dict[str, Any]:
        """Fallback sem IA - lógica baseada em regras INTELIGENTE"""
        classe_social = self.determinar_classe_social(perfil["renda"])
        dados_classe = DADOS_SOCIOECONOMICOS[classe_social]
        renda = perfil["renda"]
        
        # Ajustar percentuais baseado no perfil
        fator_ajuste = self.calcular_fator_ajuste_perfil(perfil)
        
        resultado = {
            "classe_social": classe_social,
            "analise_perfil": self.gerar_analise_personalizada(perfil, classe_social),
            "categorias_existentes": [],
            "categorias_novas": [],
            "dicas_personalizadas": self.gerar_dicas_personalizadas(perfil, classe_social),
            "percentual_reserva": 5.0,
            "total_sugerido": 0.0
        }
        
        # ETAPA 1: Categorias existentes (prioridade)
        total_usado = 0.0
        for categoria in categorias_usuario:
            categoria_mapeada = self.encontrar_categoria_essencial(categoria["nome"])
            if categoria_mapeada and categoria_mapeada in dados_classe:
                percentual_base = (dados_classe[categoria_mapeada]["min"] + dados_classe[categoria_mapeada]["max"]) / 2
                percentual_ajustado = percentual_base * fator_ajuste
                valor = renda * (percentual_ajustado / 100)
                
                resultado["categorias_existentes"].append({
                    "categoria_id": categoria["id"],
                    "nome": categoria["nome"],
                    "valor_sugerido": round(valor, 2),
                    "percentual": round(percentual_ajustado, 1),
                    "justificativa": self.gerar_justificativa_categoria(categoria_mapeada, perfil, classe_social)
                })
                total_usado += valor
        
        # ETAPA 2: Categorias novas (ajustar para não ultrapassar renda)
        limite_orcamento = renda * 0.95
        saldo_disponivel = limite_orcamento - total_usado
        categorias_faltantes = self.identificar_categorias_faltantes(categorias_usuario, dados_classe)
        
        if saldo_disponivel > 0 and categorias_faltantes:
            # Calcular total de percentuais ideais das categorias faltantes
            total_percentual_faltante = sum(
                (dados_classe[cat]["min"] + dados_classe[cat]["max"]) / 2 
                for cat in categorias_faltantes.keys()
            )
            
            # Se o total ideal exceder o saldo, aplicar redução proporcional
            if total_percentual_faltante > (saldo_disponivel / renda * 100):
                fator_reducao_faltante = (saldo_disponivel / renda * 100) / total_percentual_faltante
            else:
                fator_reducao_faltante = 1.0
            
            # Distribuir saldo disponível entre categorias faltantes
            for categoria_essencial, info in categorias_faltantes.items():
                percentual_ideal = (dados_classe[categoria_essencial]["min"] + dados_classe[categoria_essencial]["max"]) / 2
                percentual_ajustado = percentual_ideal * fator_reducao_faltante * fator_ajuste
                valor_final = renda * (percentual_ajustado / 100)
                
                if valor_final >= renda * 0.01:  # Mínimo 1% da renda
                    resultado["categorias_novas"].append({
                        "nome": info["nomes"][0].title(),
                        "valor_sugerido": round(valor_final, 2),
                        "percentual": round(percentual_ajustado, 1),
                        "justificativa": self.gerar_justificativa_categoria(categoria_essencial, perfil, classe_social),
                        "cor": info["cor"],
                        "icone": info["icone"]
                    })
                    total_usado += valor_final
        
        # Garantir que não ultrapasse 95% da renda
        if total_usado > renda * 0.95:
            fator_reducao = (renda * 0.95) / total_usado
            
            # Aplicar redução proporcional
            for cat in resultado["categorias_existentes"]:
                cat["valor_sugerido"] = round(cat["valor_sugerido"] * fator_reducao, 2)
                cat["percentual"] = round(cat["percentual"] * fator_reducao, 1)
            
            for cat in resultado["categorias_novas"]:
                cat["valor_sugerido"] = round(cat["valor_sugerido"] * fator_reducao, 2)
                cat["percentual"] = round(cat["percentual"] * fator_reducao, 1)
            
            total_usado = renda * 0.95
        
        resultado["total_sugerido"] = round(total_usado, 2)
        resultado["percentual_total"] = round((total_usado / renda) * 100, 1)
        resultado["saldo_livre"] = round(renda - total_usado, 2)
        
        return resultado

    def calcular_fator_ajuste_perfil(self, perfil: Dict[str, Any]) -> float:
        """Calcula fator de ajuste baseado no perfil"""
        fator = 1.0
        
        # Ajuste por composição familiar
        if perfil.get("composicao_familiar") == "familia_grande":
            fator *= 1.1  # +10% para famílias grandes
        elif perfil.get("composicao_familiar") == "solteiro":
            fator *= 0.9  # -10% para solteiros
        
        # Ajuste por estilo de vida
        if perfil.get("estilo_vida") == "economico":
            fator *= 0.8  # -20% para estilo econômico
        elif perfil.get("estilo_vida") == "confortavel":
            fator *= 1.1  # +10% para estilo confortável
        
        return min(fator, 0.9)  # Máximo 90% da renda

    def gerar_analise_personalizada(self, perfil: Dict[str, Any], classe_social: str) -> str:
        """Gera análise personalizada baseada no perfil"""
        renda = perfil["renda"]
        composicao = perfil.get("composicao_familiar", "")
        moradia = perfil.get("tipo_moradia", "")
        estilo = perfil.get("estilo_vida", "")
        
        analise = f"Com uma renda de R$ {renda:,.2f}, você está na {classe_social.replace('_', ' ')}. "
        
        if "familia" in composicao:
            analise += "Como você tem família, priorizamos categorias essenciais como saúde e educação. "
        elif "solteiro" in composicao:
            analise += "Sendo solteiro(a), você tem mais flexibilidade para investimentos e lazer. "
        
        if "aluguel" in moradia:
            analise += "Considerando que você paga aluguel, ajustamos os percentuais para suas necessidades fixas. "
        elif "financiamento" in moradia:
            analise += "Com financiamento habitacional, balanceamos os custos fixos com outras prioridades. "
        
        if "economico" in estilo:
            analise += "Seu perfil econômico permite focar mais em poupança e necessidades básicas."
        elif "investidor" in estilo:
            analise += "Como investidor, priorizamos categorias de investimento e crescimento patrimonial."
        
        return analise

    def gerar_dicas_personalizadas(self, perfil: Dict[str, Any], classe_social: str) -> List[str]:
        """Gera dicas personalizadas baseadas no perfil"""
        dicas = ["Mantenha sempre uma reserva de emergência equivalente a 6 meses de gastos"]
        
        if perfil.get("composicao_familiar") in ["familia_pequena", "familia_grande"]:
            dicas.append("Considere um seguro de vida e saúde para proteger sua família")
            
        if "aluguel" in perfil.get("tipo_moradia", ""):
            dicas.append("Avalie periodicamente se vale a pena continuar alugando ou partir para financiamento")
            
        if classe_social in ["classe_media_alta", "classe_alta"]:
            dicas.append("Diversifique seus investimentos entre renda fixa e variável")
            dicas.append("Considere planejamento tributário para otimizar impostos")
        
        if perfil.get("estilo_vida") == "economico":
            dicas.append("Aproveite sua disciplina financeira para acelerar seus investimentos")
        
        return dicas

    def gerar_justificativa_categoria(self, categoria: str, perfil: Dict[str, Any], classe_social: str) -> str:
        """Gera justificativa personalizada para cada categoria"""
        justificativas = {
            "alimentacao": f"Alimentação representa prioridade para {classe_social.replace('_', ' ')}, considerando sua composição familiar",
            "moradia": "Gastos com moradia ajustados conforme sua situação habitacional atual",
            "transporte": f"Transporte balanceado para {classe_social.replace('_', ' ')}, considerando mobilidade necessária",
            "saude": "Saúde é investimento essencial, especialmente importante para sua família",
            "educacao": "Educação é fundamental para desenvolvimento pessoal e profissional",
            "lazer": f"Lazer equilibrado conforme seu estilo de vida {perfil.get('estilo_vida', '')}",
            "vestuario": f"Vestuário adequado para {classe_social.replace('_', ' ')}, sem excessos",
            "poupanca": "Poupança essencial para segurança financeira e emergências",
            "investimentos": f"Investimentos adequados para crescimento patrimonial na {classe_social.replace('_', ' ')}"
        }
        
        return justificativas.get(categoria, f"Categoria importante para {classe_social.replace('_', ' ')}")

    def identificar_categorias_faltantes(self, categorias_usuario: List[Dict], dados_classe: Dict) -> Dict:
        """Identifica categorias essenciais que estão faltando"""
        categorias_existentes_nomes = [cat["nome"].lower() for cat in categorias_usuario]
        faltantes = {}
        
        for categoria_essencial, info in CATEGORIAS_ESSENCIAIS.items():
            if categoria_essencial in dados_classe:
                if not any(nome in " ".join(categorias_existentes_nomes) for nome in info["nomes"]):
                    faltantes[categoria_essencial] = info
        
        return faltantes

    def encontrar_categoria_essencial(self, nome_categoria: str) -> Optional[str]:
        """Encontra categoria essencial correspondente"""
        nome_lower = nome_categoria.lower()
        for essencial, info in CATEGORIAS_ESSENCIAIS.items():
            if any(nome in nome_lower for nome in info["nomes"]):
                return essencial
        return None

    def criar_categorias_automaticamente(self, categorias_novas: List[Dict], user: User) -> List[int]:
        """Cria as categorias novas automaticamente"""
        ids_criados = []
        
        for cat_data in categorias_novas:
            # Verificar se já existe
            existing = self.db.query(Categoria).filter(
                Categoria.tenant_id == user.tenant_id,
                Categoria.nome == cat_data["nome"]
            ).first()
            
            if not existing:
                nova_categoria = Categoria(
                    nome=cat_data["nome"],
                    cor=cat_data["cor"],
                    icone=cat_data["icone"],
                    tenant_id=user.tenant_id
                )
                self.db.add(nova_categoria)
                self.db.flush()
                ids_criados.append(nova_categoria.id)
        
        self.db.commit()
        return ids_criados

@router.post("/analisar")
def analisar_perfil(
    perfil_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Analisa o perfil do usuário e gera sugestões de orçamento"""
    try:
        # Validações básicas
        required_fields = ["renda", "composicao_familiar", "tipo_moradia", "estilo_vida"]
        for field in required_fields:
            if field not in perfil_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Campo obrigatório: {field}"
                )
        
        renda = float(perfil_data["renda"])
        if renda <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Renda deve ser maior que zero"
            )
        
        # Inicializar serviço
        service = AssistentePlanejamentoService(db, current_user.tenant_id)
        
        # Obter categorias do usuário
        categorias_usuario = service.obter_categorias_usuario()
        
        # Gerar sugestões
        sugestoes = service.gerar_sugestoes_com_ia(perfil_data, categorias_usuario)
        
        # Adicionar informações extras
        sugestoes["total_categorias_existentes"] = len(categorias_usuario)
        sugestoes["total_categorias_novas"] = len(sugestoes.get("categorias_novas", []))
        
        return sugestoes
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro na análise: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno no processamento"
        )

@router.post("/aplicar")
def aplicar_sugestoes(
    dados_aplicacao: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Aplica as sugestões criando categorias e planejamento"""
    try:
        # Validar dados
        required_fields = ["sugestoes", "perfil"]
        for field in required_fields:
            if field not in dados_aplicacao:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Campo obrigatório: {field}"
                )
        
        sugestoes = dados_aplicacao["sugestoes"]
        perfil = dados_aplicacao["perfil"]
        
        service = AssistentePlanejamentoService(db, current_user.tenant_id)
        
        # 1. Criar categorias novas
        categorias_novas = sugestoes.get("categorias_novas", [])
        ids_criados = service.criar_categorias_automaticamente(categorias_novas, current_user)
        
        # 2. Criar planejamento
        nome_planejamento = f"Orçamento IA - {datetime.now().strftime('%B %Y')}"
        
        # Verificar se já existe planejamento para este mês
        mes_atual = datetime.now().month
        ano_atual = datetime.now().year
        
        planejamento_existente = db.query(PlanejamentoMensal).filter(
            PlanejamentoMensal.tenant_id == current_user.tenant_id,
            PlanejamentoMensal.mes == mes_atual,
            PlanejamentoMensal.ano == ano_atual,
            PlanejamentoMensal.status == 'ativo'
        ).first()
        
        if planejamento_existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Já existe um planejamento ativo para este mês"
            )
        
        novo_planejamento = PlanejamentoMensal(
            nome=nome_planejamento,
            descricao=f"Planejamento gerado automaticamente pela IA para {sugestoes.get('classe_social', '').replace('_', ' ')}",
            mes=mes_atual,
            ano=ano_atual,
            renda_esperada=float(perfil["renda"]),
            status='ativo',
            tenant_id=current_user.tenant_id
        )
        
        db.add(novo_planejamento)
        db.flush()
        
        # 3. Criar planos de categoria
        total_planejado = 0.0
        planos_criados = 0
        
        # Para categorias existentes
        for cat_sugestao in sugestoes.get("categorias_existentes", []):
            plano = PlanoCategoria(
                planejamento_id=novo_planejamento.id,
                categoria_id=cat_sugestao["categoria_id"],
                valor_planejado=float(cat_sugestao["valor_sugerido"]),
                prioridade=1,
                observacoes=cat_sugestao.get("justificativa", ""),
                tenant_id=current_user.tenant_id
            )
            db.add(plano)
            total_planejado += float(cat_sugestao["valor_sugerido"])
            planos_criados += 1
        
        # Para categorias novas (mapear IDs criados)
        for i, cat_sugestao in enumerate(sugestoes.get("categorias_novas", [])):
            if i < len(ids_criados):
                plano = PlanoCategoria(
                    planejamento_id=novo_planejamento.id,
                    categoria_id=ids_criados[i],
                    valor_planejado=float(cat_sugestao["valor_sugerido"]),
                    prioridade=1,
                    observacoes=cat_sugestao.get("justificativa", ""),
                    tenant_id=current_user.tenant_id
                )
                db.add(plano)
                total_planejado += float(cat_sugestao["valor_sugerido"])
                planos_criados += 1
        
        # Atualizar total planejado
        novo_planejamento.total_planejado = total_planejado
        
        db.commit()
        
        return {
            "sucesso": True,
            "planejamento_id": novo_planejamento.id,
            "nome_planejamento": nome_planejamento,
            "categorias_criadas": len(ids_criados),
            "planos_criados": planos_criados,
            "total_planejado": total_planejado,
            "mensagem": f"✅ Planejamento criado com sucesso! {len(ids_criados)} categorias criadas e {planos_criados} planos configurados."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao aplicar sugestões: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao aplicar sugestões"
        )