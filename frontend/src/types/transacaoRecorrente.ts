export type TipoTransacao = 'ENTRADA' | 'SAIDA';

export type FrequenciaRecorrencia = 
  | 'DIARIA'
  | 'SEMANAL' 
  | 'QUINZENAL'
  | 'MENSAL'
  | 'BIMESTRAL'
  | 'TRIMESTRAL'
  | 'SEMESTRAL'
  | 'ANUAL';

export interface TransacaoRecorrente {
  id: number;
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  categoria_id: number;
  conta_id?: number;
  cartao_id?: number;
  frequencia: FrequenciaRecorrencia;
  data_inicio: string;
  data_fim?: string;
  ativa: boolean;
  icone_personalizado?: string;
  tenant_id: number;
  created_at: string;
  updated_at: string;
  
  // Dados relacionados (opcionais)
  categoria_nome?: string;
  categoria_icone?: string;
  categoria_cor?: string;
  conta_nome?: string;
  cartao_nome?: string;
}

export interface TransacaoRecorrenteCreate {
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  categoria_id: number;
  conta_id?: number;
  cartao_id?: number;
  frequencia: FrequenciaRecorrencia;
  data_inicio: string;
  data_fim?: string;
  ativa?: boolean;
  icone_personalizado?: string;
}

export interface TransacaoRecorrenteUpdate {
  descricao?: string;
  valor?: number;
  tipo?: TipoTransacao;
  categoria_id?: number;
  conta_id?: number;
  cartao_id?: number;
  frequencia?: FrequenciaRecorrencia;
  data_inicio?: string;
  data_fim?: string;
  ativa?: boolean;
  icone_personalizado?: string;
}

export interface TransacaoRecorrenteListResponse {
  id: number;
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  frequencia: FrequenciaRecorrencia;
  ativa: boolean;
  categoria_nome: string;
  categoria_icone: string;
  categoria_cor: string;
  forma_pagamento: string; // "Conta: Nome" ou "Cartão: Nome"
  proximo_vencimento?: string;
  icone_personalizado?: string;
}

export interface FiltrosTransacaoRecorrente {
  ativa?: boolean;
  tipo?: TipoTransacao;
  categoria_id?: number;
  frequencia?: FrequenciaRecorrencia;
  busca?: string;
}

export interface ResumoTransacoesRecorrentes {
  total_transacoes: number;
  ativas: number;
  inativas: number;
  // Campos antigos (compatibilidade)
  valor_mensal_entradas?: number;
  valor_mensal_saidas?: number;
  saldo_mensal_estimado?: number;
  // Campos novos (valores do mês específico)
  valor_mes_entradas?: number;
  valor_mes_saidas?: number;
  saldo_mes_estimado?: number;
  mes_referencia?: number;
  ano_referencia?: number;
}

// Opções para os selects
export const FREQUENCIA_OPTIONS = [
  { value: 'DIARIA', label: 'Diária' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'QUINZENAL', label: 'Quinzenal' },
  { value: 'MENSAL', label: 'Mensal' },
  { value: 'BIMESTRAL', label: 'Bimestral' },
  { value: 'TRIMESTRAL', label: 'Trimestral' },
  { value: 'SEMESTRAL', label: 'Semestral' },
  { value: 'ANUAL', label: 'Anual' }
] as const;

export const TIPO_TRANSACAO_OPTIONS = [
  { value: 'ENTRADA', label: 'Entrada', color: 'text-green-600' },
  { value: 'SAIDA', label: 'Saída', color: 'text-red-600' }
] as const; 