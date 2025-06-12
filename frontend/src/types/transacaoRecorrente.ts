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
  dia_vencimento: number;
  data_inicio: string;
  data_fim?: string;
  ativa: boolean;
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
  dia_vencimento: number;
  data_inicio: string;
  data_fim?: string;
  ativa?: boolean;
}

export interface TransacaoRecorrenteUpdate {
  descricao?: string;
  valor?: number;
  tipo?: TipoTransacao;
  categoria_id?: number;
  conta_id?: number;
  cartao_id?: number;
  frequencia?: FrequenciaRecorrencia;
  dia_vencimento?: number;
  data_inicio?: string;
  data_fim?: string;
  ativa?: boolean;
}

export interface TransacaoRecorrenteListResponse {
  id: number;
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  frequencia: FrequenciaRecorrencia;
  dia_vencimento: number;
  ativa: boolean;
  categoria_nome: string;
  categoria_icone: string;
  categoria_cor: string;
  forma_pagamento: string; // "Conta: Nome" ou "Cartão: Nome"
  proximo_vencimento?: string;
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
  valor_mensal_entradas: number;
  valor_mensal_saidas: number;
  saldo_mensal_estimado: number;
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