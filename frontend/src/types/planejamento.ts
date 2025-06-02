export interface PlanejamentoOrcamento {
  id: number;
  nome: string;
  descricao?: string;
  mes: number;
  ano: number;
  renda_esperada: number;
  status: 'ativo' | 'pausado' | 'finalizado';
  created_at?: string;
  updated_at?: string;
}

export interface PlanejamentoCreate {
  nome: string;
  descricao?: string;
  mes: number;
  ano: number;
  renda_esperada: number;
  planos_categoria: Array<{
    categoria_id: number;
    valor_planejado: number;
    prioridade?: number;
    observacoes?: string;
  }>;
}

export interface PlanejamentoUpdate {
  nome?: string;
  descricao?: string;
  renda_esperada?: number;
  status?: 'ativo' | 'pausado' | 'finalizado';
} 