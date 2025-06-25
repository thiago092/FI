import axios from 'axios'
import { LoginCredentials, AuthResponse, CreateUserData, CreateTenantData, User, Tenant } from '../types/auth'
import { Categoria, CategoriaCreate } from '../types/categoria'
import { Cartao, CartaoCreate, CartaoComFatura, FaturaCartao } from '../types/cartao'
import { Conta, ContaCreate, ContaComResumo } from '../types/conta'
import { Transacao, TransacaoCreate, TransacaoUpdate, TransacaoResponse, ResumoTransacoes } from '../types/transacao'
import { PlanejamentoOrcamento } from '../types/planejamento'
import { NotificationPreference, NotificationPreferenceCreate, NotificationPreferenceUpdate } from '../types/notification'

const API_BASE_URL = 'https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api'

// DEBUG: Log para verificar Mixed Content
console.log('🔧 API Base URL configurada:', API_BASE_URL);

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

  register: async (userData: {
    full_name: string;
    email: string;
    password: string;
  }) => {
    console.log('🔄 API: Registrando usuário...', { email: userData.email, full_name: userData.full_name })
    
    const response = await api.post('/auth/register', userData)
    
    console.log('📥 API: Registro concluído:', response.status, response.data)
    return response.data
  },

  verifyEmail: async (token: string) => {
    console.log('🔄 API: Verificando email...', { token: token.substring(0, 8) + '...' })
    
    const response = await api.post('/auth/verify-email', { token })
    
    console.log('📥 API: Email verificado:', response.status, response.data)
    return response.data
  },

  resendVerification: async (email: { email: string }) => {
    console.log('🔄 API: Reenviando verificação...', email)
    
    const response = await api.post('/auth/resend-verification', email)
    
    console.log('📥 API: Verificação reenviada:', response.status, response.data)
    return response.data
  },

  forgotPassword: async (email: { email: string }) => {
    console.log('🔄 API: Solicitando recuperação de senha...', email)
    
    const response = await api.post('/auth/forgot-password', email)
    
    console.log('📥 API: Recuperação solicitada:', response.status, response.data)
    return response.data
  },

  resetPassword: async (data: { token: string; new_password: string; confirm_password: string }) => {
    console.log('🔄 API: Redefinindo senha...', { token: data.token.substring(0, 8) + '...' })
    
    const response = await api.post('/auth/reset-password', data)
    
    console.log('📥 API: Senha redefinida:', response.status, response.data)
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

  // NOVO: Verificar informações de transações da categoria
  getTransacoesInfo: async (id: number) => {
    const response = await api.get(`/categorias/${id}/transacoes-info`)
    return response.data
  },

  // NOVO: Mover todas as transações para outra categoria
  moverTransacoes: async (categoriaOrigemId: number, categoriaDestinoId: number) => {
    const response = await api.post(`/categorias/${categoriaOrigemId}/mover-transacoes?nova_categoria_id=${categoriaDestinoId}`)
    return response.data
  },

  // NOVO: Forçar exclusão da categoria e todas as transações
  forcarExclusao: async (id: number) => {
    const response = await api.delete(`/categorias/${id}/forcar-exclusao`)
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
    numero_final?: string;
    limite: number; 
    vencimento: number; 
    dia_fechamento?: number;
    cor: string; 
    ativo: boolean 
  }) => {
    const response = await api.post('/cartoes/', cartao)
    return response.data
  },

  update: async (id: number, cartao: { 
    nome: string; 
    bandeira: string; 
    numero_final?: string;
    limite: number; 
    vencimento: number; 
    dia_fechamento?: number;
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
        if (value !== undefined && value !== null && value !== '') {
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

  getResumo: async (filtros?: {
    data_inicio?: string;
    data_fim?: string;
    tipo?: 'ENTRADA' | 'SAIDA';
    categoria_id?: number;
    conta_id?: number;
    cartao_id?: number;
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
    
    const response = await api.get(`/transacoes/resumo?${params.toString()}`);
    return response.data;
  },

  create: async (transacao: {
    descricao: string;
    valor: number;
    tipo: 'ENTRADA' | 'SAIDA';
    data: string;
    categoria_id: number;
    cartao_id?: number;
    conta_id?: number;
    observacoes?: string;
  }) => {
    const response = await api.post('/transacoes/', transacao)
    return response.data
  },

  update: async (id: number, transacao: {
    descricao?: string;
    valor?: number;
    tipo?: 'ENTRADA' | 'SAIDA';
    data?: string;
    categoria_id?: number;
    cartao_id?: number;
    conta_id?: number;
    observacoes?: string;
  }) => {
    const response = await api.put(`/transacoes/${id}`, transacao)
    return response.data
  },

  delete: async (id: number) => {
    const response = await api.delete(`/transacoes/${id}`)
    return response.data
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

  // 📊 NOVO: Importação Excel
  downloadTemplate: async () => {
    const response = await api.get('/transacoes/template/excel', {
      responseType: 'blob'
    })
    
    // Criar blob e download
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'template_transacoes.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },

  uploadExcel: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post('/transacoes/upload/excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },
}

// 💳 NOVO: Faturas API
export const faturasApi = {
  getAll: async (filtros?: {
    skip?: number;
    limit?: number;
    status_filter?: 'aberta' | 'fechada' | 'paga';
    cartao_id?: number;
  }) => {
    const params = new URLSearchParams();
    
    if (filtros) {
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== 0) {
          params.append(key, value.toString());
        }
      });
    }

    const response = await api.get(`/faturas/?${params.toString()}`);
    return response.data;
  },

  getById: async (faturaId: number) => {
    const response = await api.get(`/faturas/${faturaId}`);
    return response.data;
  },

  getVencendo: async (dias: number = 7) => {
    const response = await api.get(`/faturas/vencendo?dias=${dias}`);
    return response.data;
  },

  getResumo: async () => {
    const response = await api.get('/faturas/resumo');
    return response.data;
  },

  // 🎯 NOVO: Pagar fatura
  pagarFatura: async (faturaId: number, pagamento: {
    conta_id?: number;
    categoria_id?: number;
  }) => {
    const response = await api.post(`/faturas/${faturaId}/pagar`, pagamento);
    return response.data;
  },

  // 🛠️ NOVO: Endpoints de gestão
  resetarAntigas: async (diasLimite: number = 45) => {
    const response = await api.post(`/faturas/resetar-antigas?dias_limite=${diasLimite}`);
    return response.data;
  },

  atualizarStatusVencidas: async () => {
    const response = await api.post('/faturas/atualizar-status-vencidas');
    return response.data;
  },

  processarPagamentosAutomaticos: async () => {
    const response = await api.post('/faturas/processar-pagamentos-automaticos');
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

  // Novas APIs administrativas
  getOverview: async () => {
    const response = await api.get('/admin/dashboard/overview')
    return response.data
  },

  getUsersDetailed: async (page: number = 1, perPage: number = 50) => {
    const response = await api.get(`/admin/users/detailed?page=${page}&per_page=${perPage}`)
    return response.data
  },

  deleteUser: async (userId: number) => {
    const response = await api.delete(`/admin/users/${userId}`)
    return response.data
  },

  deleteTenant: async (tenantId: number) => {
    const response = await api.delete(`/admin/tenants/${tenantId}`)
    return response.data
  },

  getTokenMetrics: async () => {
    const response = await api.get('/admin/metrics/tokens')
    return response.data
  },

  getPerformanceMetrics: async () => {
    const response = await api.get('/admin/metrics/performance')
    return response.data
  },

  // Telegram Broadcast APIs
  sendBroadcastMessage: async (messageData: {
    message: string;
    target_type: 'all' | 'active' | 'specific';
    target_users?: number[];
  }) => {
    const response = await api.post('/admin/telegram/broadcast', messageData)
    return response.data
  },

  getTelegramUsers: async () => {
    const response = await api.get('/admin/telegram/users')
    return response.data
  }
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

// Transações Recorrentes API
export const transacoesRecorrentesApi = {
  getAll: async (filtros?: {
    skip?: number;
    limit?: number;
    ativa?: boolean;
    tipo?: 'ENTRADA' | 'SAIDA';
    categoria_id?: number;
    frequencia?: string;
    busca?: string;
  }) => {
    const params = new URLSearchParams();
    
    if (filtros) {
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await api.get(`/transacoes-recorrentes/?${params.toString()}`);
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/transacoes-recorrentes/${id}`);
    return response.data;
  },

  create: async (transacao: {
    descricao: string;
    valor: number;
    tipo: 'ENTRADA' | 'SAIDA';
    categoria_id: number;
    conta_id?: number;
    cartao_id?: number;
    frequencia: string;
    data_inicio: string;
    data_fim?: string;
    ativa?: boolean;
  }) => {
    const response = await api.post('/transacoes-recorrentes/', transacao);
    return response.data;
  },

  update: async (id: number, transacao: {
    descricao?: string;
    valor?: number;
    tipo?: 'ENTRADA' | 'SAIDA';
    categoria_id?: number;
    conta_id?: number;
    cartao_id?: number;
    frequencia?: string;
    data_inicio?: string;
    data_fim?: string;
    ativa?: boolean;
    icone_personalizado?: string;
  }) => {
    const response = await api.put(`/transacoes-recorrentes/${id}`, transacao);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/transacoes-recorrentes/${id}`);
    return response.data;
  },

  toggle: async (id: number) => {
    const response = await api.post(`/transacoes-recorrentes/${id}/toggle`);
    return response.data;
  },

  getResumo: async () => {
    try {
      const response = await api.get('/transacoes-recorrentes/dashboard/resumo');
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao carregar resumo de transações recorrentes:', error);
      throw error;
    }
  }
};

// Dashboard API
export const dashboardApi = {
  getChartsData: async () => {
    const response = await api.get('/dashboard/charts/overview');
    return response.data;
  },

  getProjecoesFuturas: async () => {
    const response = await api.get('/dashboard/projecoes-futuras');
    return response.data;
  },

  getProjecoes6Meses: async () => {
    const response = await api.get('/dashboard/projecoes-6-meses');
    return response.data;
  },

  getDetalhesProjecaoMes: async (mes: number, ano: number) => {
    const response = await api.get(`/dashboard/projecoes-6-meses/detalhes/${mes}/${ano}`);
    return response.data;
  }
};

// Configurações de usuário
export const settingsApi = {
  // Alterar senha
  changePassword: async (currentPassword: string, newPassword: string) => {
    const formData = new FormData();
    formData.append('current_password', currentPassword);
    formData.append('new_password', newPassword);
    
    const response = await api.put('/users/change-password', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Atualizar perfil
  updateProfile: async (fullName: string, email: string) => {
    const formData = new FormData();
    formData.append('full_name', fullName);
    formData.append('email', email);
    
    const response = await api.put('/users/profile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Listar usuários do tenant
  getTenantUsers: async () => {
    const response = await api.get('/users/tenant/users');
    return response.data;
  },

  // Convidar usuário para o tenant (NOVO - via email)
  inviteUserByEmail: async (email: string, fullName: string) => {
    const response = await api.post('/auth/invite', {
      email,
      full_name: fullName
    });
    return response.data;
  },

  // Convidar usuário para o tenant (LEGADO - com senha temporária)
  inviteUser: async (email: string, fullName: string) => {
    const formData = new FormData();
    formData.append('email', email);
    formData.append('full_name', fullName);
    
    const response = await api.post('/users/tenant/invite', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Remover usuário do tenant
  removeUser: async (userId: number) => {
    const response = await api.delete(`/users/tenant/remove/${userId}`);
    return response.data;
  },

  // Estatísticas do usuário (placeholder para futuras implementações)
  getUserStats: async () => {
    // Para agora, vamos retornar dados mockados
    return {
      total_transacoes: 1247,
      categorias_criadas: 18,
      cartoes_cadastrados: 5,
      contas_cadastradas: 3
    };
  }
};

export default api

// NOVO: Parcelas API
export const parcelasApi = {
  create: async (parcelamento: {
    descricao: string;
    valor_total: number;
    total_parcelas: number;
    cartao_id: number;
    data_primeira_parcela: string;
    categoria_id: number;
  }) => {
    // DEBUG: Log para verificar URL sendo usada
    console.log('🔧 parcelasApi.create chamado:', { url: api.defaults.baseURL + '/parcelas/', data: parcelamento });
    const response = await api.post('/parcelas/', parcelamento);
    console.log('✅ parcelasApi.create response:', response.status);
    return response.data;
  },

  getAll: async (ativasApenas?: boolean, cartaoId?: number) => {
    const params = new URLSearchParams();
    if (ativasApenas) params.append('ativas_apenas', 'true');
    if (cartaoId) params.append('cartao_id', cartaoId.toString());
    
    const response = await api.get(`/parcelas/?${params.toString()}`);
    return response.data;
  },

  processarParcela: async (compraId: number, numeroParcela: number) => {
    const response = await api.post(`/parcelas/${compraId}/processar-parcela/${numeroParcela}`);
    return response.data;
  },

  // NOVO: Quitar parcelamento antecipadamente  
  quitarAntecipado: async (parcelamentoId: number) => {
    const response = await api.post(`/parcelas/${parcelamentoId}/quitar`);
    return response.data;
  },

  // NOVO: Excluir parcelamento
  delete: async (parcelamentoId: number) => {
    const response = await api.delete(`/parcelas/${parcelamentoId}`);
    return response.data;
  },

  // NOVO: Atualizar parcelamento
  update: async (parcelamentoId: number, dados: {
    descricao?: string;
    valor_total?: number;
    total_parcelas?: number;
    categoria_id?: number;
  }) => {
    const response = await api.put(`/parcelas/${parcelamentoId}`, dados);
    return response.data;
  },

  // NOVO: Obter detalhes de um parcelamento específico
  getById: async (parcelamentoId: number) => {
    const response = await api.get(`/parcelas/${parcelamentoId}`);
    return response.data;
  },

  // NOVO: Obter detalhes completos com todas as parcelas
  getDetalhes: async (parcelamentoId: number) => {
    const response = await api.get(`/parcelas/${parcelamentoId}/detalhes`);
    return response.data;
  },

  // NOVO: Adiantar apenas a próxima parcela
  adiantarProxima: async (parcelamentoId: number) => {
    const response = await api.post(`/parcelas/${parcelamentoId}/adiantar-proxima`);
    return response.data;
  },

  // TEMPORÁRIO: Funções de debug e limpeza
  diagnosticar: async () => {
    const response = await api.get('/parcelas/debug/diagnosticar');
    return response.data;
  },

  limparOrfaos: async () => {
    const response = await api.delete('/parcelas/debug/limpar-orfaos');
    return response.data;
  },

  // DESENVOLVIMENTO: Zerar tudo (SEM PROTEÇÃO)
  zerarTudo: async () => {
    const response = await api.delete('/parcelas/dev/zerar-tudo');
    return response.data;
  },
}

// Assistente de Planejamento IA API
export const assistentePlanejamentoApi = {
  analisar: async (perfilData: {
    renda: number;
    composicao_familiar: string;
    tipo_moradia: string;
    estilo_vida: string;
  }) => {
    const response = await api.post('/assistente-planejamento/analisar', perfilData);
    return response.data;
  },

  aplicar: async (dadosAplicacao: {
    sugestoes: any;
    perfil: any;
  }) => {
    const response = await api.post('/assistente-planejamento/aplicar', dadosAplicacao);
    return response.data;
  },
}

// Notification APIs
export const notificationApi = {
  // Buscar todas as preferências de notificação do usuário
  getPreferences: async (): Promise<NotificationPreference[]> => {
    const response = await api.get('/notification-preferences/');
    return response.data;
  },

  // Criar nova preferência de notificação
  createPreference: async (data: NotificationPreferenceCreate): Promise<NotificationPreference> => {
    const response = await api.post('/notification-preferences/', data);
    return response.data;
  },

  // Atualizar preferência existente
  updatePreference: async (type: string, data: NotificationPreferenceUpdate): Promise<NotificationPreference> => {
    const response = await api.put(`/notification-preferences/${type}`, data);
    return response.data;
  },

  // Deletar preferência
  deletePreference: async (type: string): Promise<void> => {
    await api.delete(`/notification-preferences/${type}`);
  },

  // Testar notificação (enviar teste)
  testNotification: async (type: string): Promise<{success: boolean, message: string}> => {
    const response = await api.post(`/notifications/test/${type}`);
    return response.data;
  },

  // Verificar status do Telegram
  getTelegramStatus: async (): Promise<{connected: boolean, telegram_id?: string, username?: string, first_name?: string, message?: string}> => {
    const response = await api.get('/notification-preferences/telegram-status');
    return response.data;
  }
};

// 🏦 NOVO: Financiamentos API
export const financiamentosApi = {
  getAll: async (filtros?: {
    skip?: number;
    limit?: number;
    status?: string;
    tipo?: string;
  }) => {
    const params = new URLSearchParams();
    
    if (filtros) {
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }

    const response = await api.get(`/financiamentos/?${params.toString()}`);
    return response.data;
  },

  getById: async (financiamentoId: number) => {
    const response = await api.get(`/financiamentos/${financiamentoId}`);
    return response.data;
  },

  getParcelas: async (financiamentoId: number, filtros?: {
    skip?: number;
    limit?: number;
    status_parcela?: string;
  }) => {
    const params = new URLSearchParams();
    
    if (filtros) {
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }

    const response = await api.get(`/financiamentos/${financiamentoId}/parcelas?${params.toString()}`);
    return response.data;
  },

  getDashboard: async () => {
    const response = await api.get('/financiamentos/dashboard/resumo');
    return response.data;
  },

  getProximosVencimentos: async (dias: number = 30) => {
    const response = await api.get(`/financiamentos/proximos-vencimentos?dias=${dias}`);
    return response.data;
  },

  create: async (financiamento: {
    descricao: string;
    instituicao?: string;
    numero_contrato?: string;
    tipo_financiamento?: string;
    sistema_amortizacao?: string;
    valor_total: number;
    valor_entrada?: number;
    valor_financiado: number;
    taxa_juros_anual: number;
    numero_parcelas: number;
    data_contratacao: string;
    data_primeira_parcela: string;
    dia_vencimento?: number;
    categoria_id: number;
    conta_id?: number;
    conta_debito_id?: number;
    auto_debito?: boolean;
    taxa_seguro_mensal?: number;
    taxa_administrativa?: number;
    observacoes?: string;
  }) => {
    const response = await api.post('/financiamentos/', financiamento);
    return response.data;
  },

  simular: async (simulacao: {
    valor_financiado: number;
    prazo_meses: number;
    taxa_juros_anual: number;
    sistema_amortizacao?: string;
    data_inicio: string;
    taxa_seguro_mensal?: number;
    taxa_administrativa?: number;
  }) => {
    const response = await api.post('/financiamentos/simular', simulacao);
    return response.data;
  },

  simularQuitacao: async (financiamentoId: number, dataQuitacao: string) => {
    const response = await api.post(`/financiamentos/${financiamentoId}/quitar?data_quitacao=${dataQuitacao}`);
    return response.data;
  },

  // NOVO: Registrar pagamento de parcela
  pagarParcela: async (pagamento: {
    parcela_id: number;
    valor_pago: number;
    data_pagamento: string;
    categoria_id: number;
    conta_id?: number;
    cartao_id?: number;
    observacoes?: string;
    comprovante_path?: string;
  }) => {
    const response = await api.post('/financiamentos/pagar-parcela', pagamento);
    return response.data;
  },

  // NOVO: Obter próxima parcela pendente
  getProximaParcela: async (financiamentoId: number) => {
    const response = await api.get(`/financiamentos/${financiamentoId}/proxima-parcela`);
    return response.data;
  },

  // NOVO: Aplicar adiantamento em financiamento
  aplicarAdiantamento: async (adiantamento: {
    financiamento_id: number;
    valor_adiantamento: number;
    tipo_adiantamento?: string;
    parcela_numero?: number;
    categoria_id: number;
    conta_id?: number;
    data_aplicacao: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/financiamentos/aplicar-adiantamento', adiantamento);
    return response.data;
  },

  // NOVO: Excluir financiamento
  excluirFinanciamento: async (financiamentoId: number) => {
    const response = await api.delete(`/financiamentos/${financiamentoId}`);
    return response.data;
  },

  // NOVO: Buscar histórico de um financiamento
  getHistorico: async (financiamentoId: number, skip = 0, limit = 50) => {
    const response = await api.get(`/financiamentos/${financiamentoId}/historico?skip=${skip}&limit=${limit}`);
    return response.data;
  },
}; 