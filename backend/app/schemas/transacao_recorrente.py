from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import date
from enum import Enum

class TipoTransacaoEnum(str, Enum):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"

class FrequenciaEnum(str, Enum):
    DIARIA = "DIARIA"
    SEMANAL = "SEMANAL"
    QUINZENAL = "QUINZENAL"
    MENSAL = "MENSAL"
    BIMESTRAL = "BIMESTRAL"
    TRIMESTRAL = "TRIMESTRAL"
    SEMESTRAL = "SEMESTRAL"
    ANUAL = "ANUAL"

class TransacaoRecorrenteBase(BaseModel):
    descricao: str = Field(..., min_length=1, max_length=255)
    valor: float = Field(..., gt=0)
    tipo: TipoTransacaoEnum
    categoria_id: int
    conta_id: Optional[int] = None
    cartao_id: Optional[int] = None
    frequencia: FrequenciaEnum
    dia_vencimento: int = Field(..., ge=1, le=31)
    data_inicio: date
    data_fim: Optional[date] = None
    ativa: bool = True

    @validator('data_fim')
    def validate_data_fim(cls, v, values):
        if v and 'data_inicio' in values and v <= values['data_inicio']:
            raise ValueError('Data fim deve ser posterior à data início')
        return v

    @validator('cartao_id')
    def validate_forma_pagamento(cls, v, values):
        conta_id = values.get('conta_id')
        if (conta_id is None and v is None) or (conta_id is not None and v is not None):
            raise ValueError('Deve ser informado apenas uma forma de pagamento: conta OU cartão')
        return v

class TransacaoRecorrenteCreate(TransacaoRecorrenteBase):
    pass

class TransacaoRecorrenteUpdate(BaseModel):
    descricao: Optional[str] = Field(None, min_length=1, max_length=255)
    valor: Optional[float] = Field(None, gt=0)
    tipo: Optional[TipoTransacaoEnum] = None
    categoria_id: Optional[int] = None
    conta_id: Optional[int] = None
    cartao_id: Optional[int] = None
    frequencia: Optional[FrequenciaEnum] = None
    dia_vencimento: Optional[int] = Field(None, ge=1, le=31)
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    ativa: Optional[bool] = None

class TransacaoRecorrenteResponse(TransacaoRecorrenteBase):
    id: int
    tenant_id: int
    created_at: str
    updated_at: str
    
    # Dados relacionados (opcionais para evitar queries desnecessárias)
    categoria_nome: Optional[str] = None
    categoria_icone: Optional[str] = None
    categoria_cor: Optional[str] = None
    conta_nome: Optional[str] = None
    cartao_nome: Optional[str] = None

    class Config:
        from_attributes = True

# Schema para listagem com informações resumidas
class TransacaoRecorrenteListResponse(BaseModel):
    id: int
    descricao: str
    valor: float
    tipo: TipoTransacaoEnum
    frequencia: FrequenciaEnum
    dia_vencimento: int
    ativa: bool
    categoria_nome: str
    categoria_icone: str
    categoria_cor: str
    forma_pagamento: str  # "Conta: Nome" ou "Cartão: Nome"
    proximo_vencimento: Optional[date] = None  # Calculado

    class Config:
        from_attributes = True 