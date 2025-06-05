from pydantic import BaseModel, field_validator
from typing import Optional, List, Union
from datetime import datetime, date
from enum import Enum

class TipoTransacaoEnum(str, Enum):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"

class TipoContaEnum(str, Enum):
    CORRENTE = "corrente"
    POUPANCA = "poupanca"
    INVESTIMENTO = "investimento"

# Categoria Schemas
class CategoriaBase(BaseModel):
    nome: str
    cor: str = "#3B82F6"
    icone: str = "📊"

class CategoriaCreate(CategoriaBase):
    pass

class CategoriaUpdate(BaseModel):
    nome: Optional[str] = None
    cor: Optional[str] = None
    icone: Optional[str] = None

class CategoriaResponse(CategoriaBase):
    id: int
    tenant_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Cartão Schemas
class CartaoBase(BaseModel):
    nome: str
    bandeira: str
    numero_final: Optional[str] = None
    limite: float = 0.0
    vencimento: Optional[int] = None
    conta_vinculada_id: Optional[int] = None  # Conta para débito automático da fatura
    cor: str = "#8B5CF6"

class CartaoCreate(CartaoBase):
    pass

class CartaoUpdate(BaseModel):
    nome: Optional[str] = None
    bandeira: Optional[str] = None
    numero_final: Optional[str] = None
    limite: Optional[float] = None
    vencimento: Optional[int] = None
    conta_vinculada_id: Optional[int] = None
    cor: Optional[str] = None
    ativo: Optional[bool] = None

class CartaoResponse(CartaoBase):
    id: int
    ativo: bool
    tenant_id: int
    created_at: datetime
    conta_vinculada: Optional[dict] = None  # Dados da conta vinculada
    
    class Config:
        from_attributes = True

# Informações de fatura do cartão
class FaturaInfo(BaseModel):
    valor_atual: float = 0.0
    valor_total_mes: float = 0.0
    dias_para_vencimento: Optional[int] = None
    data_vencimento: Optional[datetime] = None
    percentual_limite_usado: float = 0.0

class CartaoComFatura(CartaoResponse):
    fatura: FaturaInfo

# Conta Schemas
class ContaBase(BaseModel):
    nome: str
    banco: str
    tipo: str = "corrente"
    numero: Optional[str] = None
    agencia: Optional[str] = None
    saldo_inicial: float = 0.0
    cor: str = "#10B981"

class ContaCreate(ContaBase):
    pass

class ContaUpdate(BaseModel):
    nome: Optional[str] = None
    banco: Optional[str] = None
    tipo: Optional[str] = None
    numero: Optional[str] = None
    agencia: Optional[str] = None
    saldo_inicial: Optional[float] = None
    cor: Optional[str] = None
    ativo: Optional[bool] = None

class ContaResponse(ContaBase):
    id: int
    ativo: bool
    tenant_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Resumo da conta com dados calculados (deve vir DEPOIS de ContaResponse)
class ResumoContaInfo(BaseModel):
    saldo_atual: float
    total_entradas: float = 0.0
    total_saidas: float = 0.0
    ultima_movimentacao: Optional[float] = None
    data_ultima_movimentacao: Optional[datetime] = None
    total_transacoes: int = 0

class ContaComResumo(ContaResponse):
    resumo: ResumoContaInfo

# Transação Schemas
class TransacaoBase(BaseModel):
    descricao: str
    valor: float
    tipo: TipoTransacaoEnum
    data: datetime
    categoria_id: int
    cartao_id: Optional[int] = None
    conta_id: Optional[int] = None
    observacoes: Optional[str] = None

class TransacaoCreate(TransacaoBase):
    # Campos opcionais para parcelamentos
    compra_parcelada_id: Optional[int] = None
    is_parcelada: Optional[bool] = False
    numero_parcela: Optional[int] = None
    total_parcelas: Optional[int] = None

class TransacaoUpdate(BaseModel):
    descricao: Optional[str] = None
    valor: Optional[float] = None
    tipo: Optional[TipoTransacaoEnum] = None
    data: Optional[datetime] = None
    categoria_id: Optional[int] = None
    cartao_id: Optional[int] = None
    conta_id: Optional[int] = None
    observacoes: Optional[str] = None

class TransacaoResponse(TransacaoBase):
    id: int
    processado_por_ia: bool
    prompt_original: Optional[str]
    # Campos de parcelamento
    compra_parcelada_id: Optional[int] = None
    is_parcelada: bool = False
    numero_parcela: Optional[int] = None
    total_parcelas: Optional[int] = None
    tenant_id: int
    created_at: datetime
    categoria: Optional[CategoriaResponse] = None
    cartao: Optional[CartaoResponse] = None
    conta: Optional[ContaResponse] = None
    
    class Config:
        from_attributes = True

class StatusPlanoEnum(str, Enum):
    ATIVO = "ativo"
    PAUSADO = "pausado"
    FINALIZADO = "finalizado"

class PrioridadeEnum(str, Enum):
    ALTA = "alta"
    MEDIA = "media"
    BAIXA = "baixa"

# PlanoCategoria Schemas
class PlanoCategoriaBase(BaseModel):
    categoria_id: int
    valor_planejado: float
    prioridade: int = 2  # 1=alta, 2=média, 3=baixa
    observacoes: Optional[str] = None

class PlanoCategoriaCreate(PlanoCategoriaBase):
    pass

class PlanoCategoriaUpdate(BaseModel):
    valor_planejado: Optional[float] = None
    prioridade: Optional[int] = None
    observacoes: Optional[str] = None

class PlanoCategoriaResponse(PlanoCategoriaBase):
    id: int
    planejamento_id: int
    valor_gasto: float
    percentual_gasto: float = 0.0  # Calculado: (valor_gasto / valor_planejado) * 100
    saldo_restante: float = 0.0    # Calculado: valor_planejado - valor_gasto
    categoria: CategoriaResponse
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# PlanejamentoMensal Schemas
class PlanejamentoMensalBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    mes: int  # 1-12
    ano: int  # 2024, 2025...
    renda_esperada: float = 0.0

class PlanejamentoMensalCreate(PlanejamentoMensalBase):
    planos_categoria: list[PlanoCategoriaCreate] = []

class PlanejamentoMensalUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    renda_esperada: Optional[float] = None
    status: Optional[StatusPlanoEnum] = None

class PlanejamentoMensalResponse(PlanejamentoMensalBase):
    id: int
    total_planejado: float
    total_gasto: float
    saldo_planejado: float = 0.0     # Calculado: renda_esperada - total_planejado
    percentual_gasto: float = 0.0    # Calculado: (total_gasto / total_planejado) * 100
    status: StatusPlanoEnum
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    planos_categoria: list[PlanoCategoriaResponse] = []
    
    class Config:
        from_attributes = True

# Schemas para resumos e estatísticas
class ResumoPlanejamento(BaseModel):
    total_planejamentos: int
    planejamento_atual: Optional[PlanejamentoMensalResponse] = None
    total_gasto_mes: float = 0.0
    total_planejado_mes: float = 0.0
    percentual_cumprimento: float = 0.0
    categorias_excedidas: int = 0
    economias_categoria: list[dict] = []  # Categorias que estão abaixo do planejado

class EstatisticasCategoria(BaseModel):
    categoria_id: int
    categoria_nome: str
    valor_planejado: float
    valor_gasto: float
    percentual_gasto: float
    saldo_restante: float
    status: str  # "dentro_limite", "proximo_limite", "excedido"
    cor_categoria: str

# NOVOS SCHEMAS PARA PARCELAMENTOS

# ParcelaCartao Schemas
class ParcelaCartaoBase(BaseModel):
    numero_parcela: int
    valor: float
    data_vencimento: datetime

class ParcelaCartaoCreate(ParcelaCartaoBase):
    compra_parcelada_id: int

class ParcelaCartaoResponse(ParcelaCartaoBase):
    id: int
    compra_parcelada_id: int
    paga: bool
    processada: bool
    transacao_id: Optional[int] = None
    tenant_id: int
    created_at: datetime
    transacao: Optional[TransacaoResponse] = None
    
    class Config:
        from_attributes = True

# CompraParcelada Schemas
class CompraParceladaBase(BaseModel):
    descricao: str
    valor_total: float
    total_parcelas: int
    cartao_id: int
    data_primeira_parcela: datetime

class CompraParceladaCreate(BaseModel):
    descricao: str
    valor_total: float
    total_parcelas: int
    cartao_id: int
    categoria_id: int
    data_primeira_parcela: Union[date, datetime]

class CompraParceladaUpdate(BaseModel):
    descricao: Optional[str] = None
    valor_total: Optional[float] = None
    total_parcelas: Optional[int] = None
    categoria_id: Optional[int] = None

    @validator('valor_total')
    def validate_valor_total(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Valor total deve ser positivo')
        return v

    @validator('total_parcelas')
    def validate_total_parcelas(cls, v):
        if v is not None and (v < 2 or v > 120):
            raise ValueError('Total de parcelas deve estar entre 2 e 120')
        return v

class CompraParceladaResponse(CompraParceladaBase):
    id: int
    valor_parcela: float
    ativa: bool
    tenant_id: int
    created_at: datetime
    cartao: Optional[CartaoResponse] = None
    parcelas: list[ParcelaCartaoResponse] = []
    # Campos calculados
    parcelas_pagas: int = 0
    parcelas_pendentes: int = 0
    valor_pago: float = 0.0
    valor_pendente: float = 0.0
    proxima_parcela: Optional[ParcelaCartaoResponse] = None
    
    class Config:
        from_attributes = True

# Schema para criar compra parcelada com todas as parcelas
class CompraParceladaCompleta(BaseModel):
    descricao: str
    valor_total: float
    total_parcelas: int
    cartao_id: int
    data_primeira_parcela: Union[str, datetime, date]  # CORRIGIDO: Aceitar string, datetime ou date
    categoria_id: int  # Para as transações geradas
    
    @field_validator('data_primeira_parcela', mode='before')
    @classmethod
    def parse_data_primeira_parcela(cls, value):
        """Converter string de data para datetime se necessário"""
        if isinstance(value, str):
            try:
                # Tenta parsear data no formato YYYY-MM-DD
                return datetime.strptime(value, '%Y-%m-%d').date()
            except ValueError:
                # Se falhar, tenta formato ISO completo
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
        return value

# Schema para resumo de parcelamentos por cartão
class ResumoParcelamentosCartao(BaseModel):
    cartao_id: int
    cartao_nome: str
    total_compras_ativas: int
    valor_total_parcelado: float
    parcelas_proximos_meses: dict[str, float]  # {"2025-01": 450.00, "2025-02": 300.00}
    
# Schema atualizado para cartão com parcelamentos
class CartaoComParcelamentos(CartaoResponse):
    fatura: FaturaInfo
    compras_parceladas: list[CompraParceladaResponse] = []
    resumo_parcelamentos: ResumoParcelamentosCartao 