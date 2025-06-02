export interface Transacao {
  id: number;
  descricao: string;
  valor: number;
  tipo: 'ENTRADA' | 'SAIDA';
  data: string;
  categoria_id: number;
  conta_id?: number;
  cartao_id?: number;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TransacaoCreate {
  descricao: string;
  valor: number;
  tipo: 'ENTRADA' | 'SAIDA';
  data: string;
  categoria_id: number;
  conta_id?: number;
  cartao_id?: number;
  observacoes?: string;
}

export interface TransacaoUpdate {
  descricao?: string;
  valor?: number;
  tipo?: 'ENTRADA' | 'SAIDA';
  data?: string;
  categoria_id?: number;
  conta_id?: number;
  cartao_id?: number;
  observacoes?: string;
}

export interface TransacaoResponse extends Transacao {
  categoria?: {
    id: number;
    nome: string;
    cor: string;
    icone: string;
  };
  conta?: {
    id: number;
    nome: string;
    banco: string;
  };
  cartao?: {
    id: number;
    nome: string;
    bandeira: string;
  };
}

export interface ResumoTransacoes {
  total_entradas: number;
  total_saidas: number;
  saldo: number;
  total_transacoes: number;
} 