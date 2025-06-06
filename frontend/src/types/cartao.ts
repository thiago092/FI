export interface Cartao {
  id: number;
  nome: string;
  bandeira: string;
  limite: number;
  vencimento: number;
  dia_fechamento?: number; // Novo campo para dia de fechamento da fatura
  cor: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CartaoCreate {
  nome: string;
  bandeira: string;
  limite: number;
  vencimento: number;
  dia_fechamento?: number;
  cor: string;
  ativo: boolean;
}

export interface CartaoComFatura extends Cartao {
  fatura_atual?: FaturaCartao;
}

export interface FaturaCartao {
  id: number;
  cartao_id: number;
  mes: number;
  ano: number;
  valor_total: number;
  data_vencimento: string;
  pago: boolean;
  created_at?: string;
  updated_at?: string;
} 