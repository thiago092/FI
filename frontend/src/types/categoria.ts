export interface Categoria {
  id: number;
  nome: string;
  cor: string;
  icone: string;
  created_at?: string;
  updated_at?: string;
}

export interface CategoriaCreate {
  nome: string;
  cor: string;
  icone: string;
}

export interface CategoriaUpdate {
  nome?: string;
  cor?: string;
  icone?: string;
} 