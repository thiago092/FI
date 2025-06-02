export interface Conta {
  id: number;
  nome: string;
  banco: string;
  tipo: string;
  numero?: string;
  agencia?: string;
  saldo_inicial: number;
  cor: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContaCreate {
  nome: string;
  banco: string;
  tipo: string;
  numero?: string;
  agencia?: string;
  saldo_inicial: number;
  cor: string;
}

export interface ContaComResumo extends Conta {
  saldo_atual?: number;
  total_entradas?: number;
  total_saidas?: number;
} 