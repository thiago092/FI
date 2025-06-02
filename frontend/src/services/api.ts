import axios from 'axios'
import { LoginCredentials, AuthResponse, CreateUserData, CreateTenantData, User, Tenant } from '../types/auth'
import { Categoria, CategoriaCreate } from '../types/categoria'
import { Cartao, CartaoCreate, CartaoComFatura, FaturaCartao } from '../types/cartao'
import { Conta, ContaCreate, ContaComResumo } from '../types/conta'
import { Transacao, TransacaoCreate, TransacaoUpdate, TransacaoResponse, ResumoTransacoes } from '../types/transacao'
import { PlanejamentoOrcamento } from '../types/planejamento'

const API_BASE_URL = 'https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor para adicionar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    console.log('🔄 API: Preparando login...', credentials)
    
    const formData = new FormData()
    formData.append('username', credentials.email)
    formData.append('password', credentials.password)
    
    console.log('📤 API: Enviando requisição para /auth/login')
    console.log('📤 API: FormData criado:', { username: credentials.email, password: '***' })
    
    const response = await api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    
    console.log('📥 API: Resposta recebida:', response.status, response.data)
    return response.data
  },
}

// Categorias API
export const categoriasApi = {
  getAll: async () => {
    const response = await api.get('/categorias/')
    return response.data
  },

  getEstatisticas: async () => {
    const response = await api.get('/categorias/estatisticas')
    return response.data
  },

  create: async (categoria: { nome: string; cor: string; icone: string }) => {
    const response = await api.post('/categorias/', categoria)
    return response.data
  },

  update: async (id: number, categoria: { nome: string; cor: string; icone: string }) => {
    const response = await api.put(`/categorias/${id}`, categoria)
    return response.data
  },

  delete: async (id: number) => {
    const response = await api.delete(`/categorias/${id}`)
    return response.data
  },
}

// Cartões API
export const cartoesApi = {
  getAll: async () => {
    const response = await api.get('/cartoes/')
    return response.data
  },

  getAllComFatura: async () => {
    const response = await api.get('/cartoes/com-fatura')
    return response.data
  },

  create: async (cartao: { 
    nome: string; 
    bandeira: string; 
    limite: number; 
    vencimento: number; 
    cor: string; 
    ativo: boolean 
  }) => {
    const response = await api.post('/cartoes/', cartao)
    return response.data
  },

  update: async (id: number, cartao: { 
    nome: string; 
    bandeira: string; 
    limite: number; 
    vencimento: number; 
    cor: string; 
    ativo: boolean 
  }) => {
    const response = await api.put(`/cartoes/${id}`, cartao)
    return response.data
  },

  delete: async (id: number) => {
    const response = await api.delete(`/cartoes/${id}`)
    return response.data
  },
}

// Contas API
export const contasApi = {
  getAll: async () => {
    const response = await api.get('/contas/')
    return response.data
  },

  getResumo: async (contaId: number) => {
    const response = await api.get(`/contas/${contaId}/resumo`)
    return response.data
  },

  create: async (conta: { 
    nome: string; 
    banco: string; 
    tipo: string; 
    numero?: string;
    agencia?: string;
    saldo_inicial: number; 
    cor: string 
  }) => {
    const response = await api.post('/contas/', conta)
    return response.data
  },

  update: async (id: number, conta: { 
    nome: string; 
    banco: string; 
    tipo: string; 
    numero?: string;
    agencia?: string;
    saldo_inicial: number; 
    cor: string 
  }) => {
    const response = await api.put(`/contas/${id}`, conta)
    return response.data
  },

  delete: async (id: number) => {
    const response = await api.delete(`/contas/${id}`)
    return response.data
  },
}

// Transações API
export const transacoesApi = {
  getAll: async (filtros?: {
    skip?: number;
    limit?: number;
    tipo?: 'ENTRADA' | 'SAIDA';
    categoria_id?: number;
    conta_id?: number;
    cartao_id?: number;
    data_inicio?: string;
    data_fim?: string;
    busca?: string;
  }) => {
    const params = new URLSearchParams();
    
    if (filtros) {
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await api.get(`/transacoes/?${params.toString()}`);
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/transacoes/${id}`);
    return response.data;
  },

  create: async (transacao: {
    descricao: string;
    valor: number;
    tipo: 'ENTRADA' | 'SAIDA';
    data: string;
    categoria_id: number;
    conta_id?: number;
    cartao_id?: number;
    observacoes?: string;
  }) => {
    const response = await api.post('/transacoes/', transacao);
    return response.data;
  },

  update: async (id: number, transacao: {
    descricao?: string;
    valor?: number;
    tipo?: 'ENTRADA' | 'SAIDA';
    data?: string;
    categoria_id?: number;
    conta_id?: number;
    cartao_id?: number;
    observacoes?: string;
  }) => {
    const response = await api.put(`/transacoes/${id}`, transacao);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/transacoes/${id}`);
    return response.data;
  },

  getResumo: async (filtros?: {
    data_inicio?: string;
    data_fim?: string;
  }) => {
    const params = new URLSearchParams();
    
    if (filtros) {
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await api.get(`/transacoes/resumo?${params.toString()}`);
    return response.data;
  },

  getPorCategoria: async (filtros?: {
    data_inicio?: string;
    data_fim?: string;
  }) => {
    const params = new URLSearchParams();
    
    if (filtros) {
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await api.get(`/transacoes/por-categoria?${params.toString()}`);
    return response.data;
  },
}

// Admin API
export const adminApi = {
  createTenant: async (tenantData: CreateTenantData): Promise<Tenant> => {
    const response = await api.post('/auth/admin/tenants', tenantData)
    return response.data
  },
  
  createUser: async (userData: CreateUserData): Promise<User> => {
    const response = await api.post('/auth/admin/users', userData)
    return response.data
  },
  
  getTenants: async (): Promise<Tenant[]> => {
    const response = await api.get('/auth/admin/tenants')
    return response.data
  },
  
  getUsers: async (): Promise<User[]> => {
    const response = await api.get('/auth/admin/users')
    return response.data
  },
}

// Planejamento API
export const planejamentoApi = {
  getAll: async (filtros?: {
    skip?: number;
    limit?: number;
    ano?: number;
    mes?: number;
  }) => {
    const params = new URLSearchParams();
    
    if (filtros) {
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await api.get(`/planejamento/?${params.toString()}`);
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/planejamento/${id}`);
    return response.data;
  },

  getAtual: async () => {
    const response = await api.get('/planejamento/atual');
    return response.data;
  },

  getResumo: async () => {
    const response = await api.get('/planejamento/resumo');
    return response.data;
  },

  getEstatisticas: async (planejamentoId: number) => {
    const response = await api.get(`/planejamento/${planejamentoId}/estatisticas`);
    return response.data;
  },

  create: async (planejamento: {
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
  }) => {
    const response = await api.post('/planejamento/', planejamento);
    return response.data;
  },

  update: async (id: number, planejamento: {
    nome?: string;
    descricao?: string;
    renda_esperada?: number;
    status?: 'ativo' | 'pausado' | 'finalizado';
  }) => {
    const response = await api.put(`/planejamento/${id}`, planejamento);
    return response.data;
  },

  duplicar: async (id: number, novoMes: number, novoAno: number) => {
    const response = await api.post(`/planejamento/${id}/duplicar?novo_mes=${novoMes}&novo_ano=${novoAno}`);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/planejamento/${id}`);
    return response.data;
  },

  // Planos de categoria
  adicionarCategoria: async (planejamentoId: number, planoCategoria: {
    categoria_id: number;
    valor_planejado: number;
    prioridade?: number;
    observacoes?: string;
  }) => {
    const response = await api.post(`/planejamento/${planejamentoId}/categorias`, planoCategoria);
    return response.data;
  },

  atualizarCategoria: async (planejamentoId: number, planoId: number, dados: {
    valor_planejado?: number;
    prioridade?: number;
    observacoes?: string;
  }) => {
    const response = await api.put(`/planejamento/${planejamentoId}/categorias/${planoId}`, dados);
    return response.data;
  },
}

// Chat AI API
export const chatApi = {
  processar: async (mensagem: string) => {
    const response = await api.post('/chat/processar', { mensagem });
    return response.data;
  },

  sugerirCategoria: async (descricao: string) => {
    const response = await api.post('/chat/sugerir-categoria', { descricao });
    return response.data;
  },

  getHistorico: async (limit: number = 20) => {
    const response = await api.get(`/chat/historico?limit=${limit}`);
    return response.data;
  },

  getEstatisticas: async () => {
    const response = await api.get('/chat/estatisticas');
    return response.data;
  },
}

export default api 