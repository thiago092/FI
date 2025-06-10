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
        "alimentacao": {"min": 10, "max": 20},
        "moradia": {"min": 15, "max": 25},
        "transporte": {"min": 5, "max": 12},
        "saude": {"min": 5, "max": 12},
        "educacao": {"min": 8, "max": 18},
        "lazer": {"min": 10, "max": 20},
        "vestuario": {"min": 3, "max": 10},
        "investimentos": {"min": 15, "max": 25},
        "poupanca": {"min": 15, "max": 25}
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

CATEGORIAS JÁ EXISTENTES:
{categorias_texto or "Nenhuma categoria criada ainda"}

DADOS SOCIOECONÔMICOS BRASILEIROS para {classe_social.replace("_", " ").title()}:
{json.dumps(dados_classe, indent=2)}

TAREFA:
1. Analise o perfil e as categorias existentes
2. Para cada categoria existente, sugira um valor adequado baseado na renda e perfil
3. Identifique categorias essenciais faltantes que o usuário deveria ter
4. Gere sugestões personalizadas considerando composição familiar e estilo de vida

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
    "total_sugerido": 4500.0
}}

Responda APENAS com o JSON válido, sem comentários adicionais.
"""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            
            resultado = json.loads(response.choices[0].message.content)
            return resultado
            
        except Exception as e:
            print(f"Erro na IA: {e}")
            return self.gerar_sugestoes_fallback(perfil, categorias_usuario)

    def gerar_sugestoes_fallback(self, perfil: Dict[str, Any], categorias_usuario: List[Dict]) -> Dict[str, Any]:
        """Fallback sem IA - lógica baseada em regras"""
        classe_social = self.determinar_classe_social(perfil["renda"])
        dados_classe = DADOS_SOCIOECONOMICOS[classe_social]
        renda = perfil["renda"]
        
        resultado = {
            "classe_social": classe_social,
            "analise_perfil": f"Baseado na renda de R$ {renda:,.2f}, você se enquadra na {classe_social.replace('_', ' ')}. Vamos otimizar seu orçamento!",
            "categorias_existentes": [],
            "categorias_novas": [],
            "dicas_personalizadas": [
                "Mantenha sempre uma reserva de emergência",
                "Acompanhe seus gastos mensalmente",
                "Revise seu orçamento periodicamente"
            ],
            "percentual_reserva": 5.0,
            "total_sugerido": 0.0
        }
        
        # Analisar categorias existentes
        total_usado = 0.0
        for categoria in categorias_usuario:
            categoria_mapeada = self.encontrar_categoria_essencial(categoria["nome"])
            if categoria_mapeada and categoria_mapeada in dados_classe:
                percentual = (dados_classe[categoria_mapeada]["min"] + dados_classe[categoria_mapeada]["max"]) / 2
                valor = renda * (percentual / 100)
                
                resultado["categorias_existentes"].append({
                    "categoria_id": categoria["id"],
                    "nome": categoria["nome"],
                    "valor_sugerido": round(valor, 2),
                    "percentual": round(percentual, 1),
                    "justificativa": f"Baseado na média para {classe_social.replace('_', ' ')}"
                })
                total_usado += valor
        
        # Identificar categorias faltantes
        categorias_existentes_nomes = [cat["nome"].lower() for cat in categorias_usuario]
        for categoria_essencial, info in CATEGORIAS_ESSENCIAIS.items():
            if not any(nome in " ".join(categorias_existentes_nomes) for nome in info["nomes"]):
                if categoria_essencial in dados_classe:
                    percentual = (dados_classe[categoria_essencial]["min"] + dados_classe[categoria_essencial]["max"]) / 2
                    valor = renda * (percentual / 100)
                    
                    resultado["categorias_novas"].append({
                        "nome": info["nomes"][0].title(),
                        "valor_sugerido": round(valor, 2),
                        "percentual": round(percentual, 1),
                        "justificativa": f"Categoria essencial para {classe_social.replace('_', ' ')}",
                        "cor": info["cor"],
                        "icone": info["icone"]
                    })
                    total_usado += valor
        
        resultado["total_sugerido"] = round(total_usado, 2)
        return resultado

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