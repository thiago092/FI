import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { 
  Plus, 
  Search, 
  Filter,
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  X,
  Edit,
  Trash2,
  Calendar,
  Activity,
  Eye,
  RotateCcw,
  Clock,
  Power,
  PowerOff
} from 'lucide-react';
import { transacoesRecorrentesApi, categoriasApi, contasApi, cartoesApi } from '../services/api';
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { useExcelExport } from '../hooks/useExcelExport';
import { 
  TransacaoRecorrenteListResponse,
  TransacaoRecorrenteCreate,
  TransacaoRecorrenteUpdate,
  FiltrosTransacaoRecorrente,
  ResumoTransacoesRecorrentes,
  FREQUENCIA_OPTIONS,
  TIPO_TRANSACAO_OPTIONS,
  FrequenciaRecorrencia,
  TipoTransacao
} from '../types/transacaoRecorrente';

interface Categoria {
  id: number;
  nome: string;
  cor: string;
  icone: string;
}

interface Conta {
  id: number;
  nome: string;
  banco: string;
}

interface Cartao {
  id: number;
  nome: string;
  bandeira: string;
}

const TransacoesRecorrentes: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transacoes, setTransacoes] = useState<TransacaoRecorrenteListResponse[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [resumo, setResumo] = useState<ResumoTransacoesRecorrentes | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<TransacaoRecorrenteListResponse | null>(null);
  
  const [filtros, setFiltros] = useState<FiltrosTransacaoRecorrente>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalTransacoes, setTotalTransacoes] = useState(0);

  // Estados do formulário
  const [formData, setFormData] = useState<TransacaoRecorrenteCreate>({
    descricao: '',
    valor: 0,
    tipo: 'SAIDA',
    categoria_id: 0,
    conta_id: undefined,
    cartao_id: undefined,
    frequencia: 'MENSAL',
    dia_vencimento: 1,
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: undefined,
    ativa: true
  });

  // Estados para feedback
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const { exportTransacoes } = useExcelExport();

  // Limpar mensagens após 3 segundos
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Verificar se usuário está carregado
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  const loadTransacoes = async (reset = false) => {
    try {
      const currentPage = reset ? 0 : page;
      setLoading(reset);
      
      console.log('🔄 Loading transações recorrentes:', { reset, currentPage, filtros });
      
      const response = await transacoesRecorrentesApi.getAll({
        skip: currentPage * 50,
        limit: 50,
        ...filtros
      });
      
      if (reset) {
        setTransacoes(response);
        setPage(1);
      } else {
        setTransacoes(prev => [...prev, ...response]);
        setPage(prev => prev + 1);
      }
      
      setHasMore(response.length === 50);
      setTotalTransacoes(reset ? response.length : totalTransacoes + response.length);
      
    } catch (error) {
      console.error('❌ Erro ao carregar transações recorrentes:', error);
      setErrorMessage('Erro ao carregar transações recorrentes');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadResumo = async () => {
    try {
      const response = await transacoesRecorrentesApi.getResumo();
      setResumo(response);
    } catch (error) {
      console.error('❌ Erro ao carregar resumo:', error);
    }
  };

  const loadDependencies = async () => {
    try {
      const [categoriasResponse, contasResponse, cartoesResponse] = await Promise.all([
        categoriasApi.getAll(),
        contasApi.getAll(),
        cartoesApi.getAll()
      ]);
      
      setCategorias(categoriasResponse);
      setContas(contasResponse);
      setCartoes(cartoesResponse);
    } catch (error) {
      console.error('❌ Erro ao carregar dependências:', error);
      setErrorMessage('Erro ao carregar dados necessários');
    }
  };

  useEffect(() => {
    loadDependencies();
    loadResumo();
  }, []);

  useEffect(() => {
    loadTransacoes(true);
  }, [filtros]);

  const loadMoreTransacoes = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await loadTransacoes(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingTransacao) {
        await transacoesRecorrentesApi.update(editingTransacao.id, formData);
        setSuccessMessage('Transação recorrente atualizada com sucesso!');
      } else {
        await transacoesRecorrentesApi.create(formData);
        setSuccessMessage('Transação recorrente criada com sucesso!');
      }
      
      setShowModal(false);
      setEditingTransacao(null);
      resetForm();
      loadTransacoes(true);
      loadResumo();
      
    } catch (error: any) {
      console.error('❌ Erro ao salvar transação recorrente:', error);
      setErrorMessage(error.response?.data?.detail || 'Erro ao salvar transação recorrente');
    }
  };

  const handleEdit = (transacao: TransacaoRecorrenteListResponse) => {
    setEditingTransacao(transacao);
    setFormData({
      descricao: transacao.descricao,
      valor: transacao.valor,
      tipo: transacao.tipo,
      categoria_id: 0, // Será preenchido quando tivermos os dados completos
      conta_id: undefined,
      cartao_id: undefined,
      frequencia: transacao.frequencia,
      dia_vencimento: transacao.dia_vencimento,
      data_inicio: new Date().toISOString().split('T')[0], // Será preenchido quando tivermos os dados completos
      data_fim: undefined,
      ativa: transacao.ativa
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta transação recorrente?')) {
      return;
    }

    try {
      await transacoesRecorrentesApi.delete(id);
      setSuccessMessage('Transação recorrente excluída com sucesso!');
      loadTransacoes(true);
      loadResumo();
    } catch (error: any) {
      console.error('❌ Erro ao excluir transação recorrente:', error);
      setErrorMessage(error.response?.data?.detail || 'Erro ao excluir transação recorrente');
    }
  };

  const handleToggle = async (id: number) => {
    try {
      const response = await transacoesRecorrentesApi.toggle(id);
      setSuccessMessage(response.message);
      loadTransacoes(true);
      loadResumo();
    } catch (error: any) {
      console.error('❌ Erro ao alterar status:', error);
      setErrorMessage(error.response?.data?.detail || 'Erro ao alterar status');
    }
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      valor: 0,
      tipo: 'SAIDA',
      categoria_id: 0,
      conta_id: undefined,
      cartao_id: undefined,
      frequencia: 'MENSAL',
      dia_vencimento: 1,
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: undefined,
      ativa: true
    });
  };

  const applyFilters = (newFiltros: FiltrosTransacaoRecorrente) => {
    setFiltros(newFiltros);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getFrequenciaLabel = (frequencia: FrequenciaRecorrencia) => {
    return FREQUENCIA_OPTIONS.find(opt => opt.value === frequencia)?.label || frequencia;
  };

  const handleExportExcel = async () => {
    try {
      const dadosExport = transacoes.map(transacao => ({
        'Descrição': transacao.descricao,
        'Valor': transacao.valor,
        'Tipo': transacao.tipo,
        'Categoria': transacao.categoria_nome,
        'Forma de Pagamento': transacao.forma_pagamento,
        'Frequência': getFrequenciaLabel(transacao.frequencia),
        'Dia Vencimento': transacao.dia_vencimento,
        'Status': transacao.ativa ? 'Ativa' : 'Inativa',
        'Próximo Vencimento': transacao.proximo_vencimento ? formatDate(transacao.proximo_vencimento) : '-'
      }));

      await exportTransacoes(dadosExport, 'transacoes-recorrentes');
      setSuccessMessage('Dados exportados com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao exportar:', error);
      setErrorMessage('Erro ao exportar dados');
    }
  };

  return (
    <div className="min-h-screen-mobile bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Navigation />
      
      <div className="container-mobile pb-safe">
        {/* Page Header */}
        <div className="py-6 lg:py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center">
                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-responsive-heading text-slate-900">Transações Recorrentes</h1>
                <p className="text-slate-600 text-sm sm:text-base">Gerencie seus pagamentos e recebimentos automáticos</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn-touch bg-white text-slate-700 hover:bg-slate-50 transition-all duration-200 shadow-sm border border-slate-200/50 space-x-2 touch-manipulation"
              >
                <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Filtros</span>
              </button>
              
              <button
                onClick={handleExportExcel}
                disabled={transacoes.length === 0}
                className="btn-touch bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-sm space-x-2 touch-manipulation"
              >
                <DocumentArrowDownIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Excel</span>
                <span className="sm:hidden">XLS</span>
              </button>
              
              <button
                onClick={() => {
                  setEditingTransacao(null);
                  resetForm();
                  setShowModal(true);
                }}
                className="btn-touch bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl space-x-2 touch-manipulation"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Nova Recorrente</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mensagens de Feedback */}
        {successMessage && (
          <div className="fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="whitespace-pre-line text-sm">{successMessage}</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="whitespace-pre-line text-sm">{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Resumo */}
        {resumo && (
          <div className="grid-responsive mb-8">
            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600">Total de Recorrentes</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900">
                    {resumo.total_transacoes}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {resumo.total_transacoes === 0 
                      ? 'Nenhuma transação' 
                      : resumo.total_transacoes === 1 
                        ? '1 transação recorrente' 
                        : `${resumo.total_transacoes} transações`
                    }
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600">Ativas</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">
                    {resumo.ativas}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {resumo.ativas === 0 
                      ? 'Nenhuma ativa' 
                      : `${resumo.ativas} transaç${resumo.ativas === 1 ? 'ão' : 'ões'} ativa${resumo.ativas === 1 ? '' : 's'}`
                    }
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Power className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600">Entradas/Mês</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">
                    {formatCurrency(resumo.valor_mensal_entradas)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {resumo.valor_mensal_entradas > 0 ? 'Recebimentos mensais' : 'Sem entradas'}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600">Saídas/Mês</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600">
                    {formatCurrency(resumo.valor_mensal_saidas)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {resumo.valor_mensal_saidas > 0 ? 'Pagamentos mensais' : 'Sem saídas'}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        {showFilters && (
          <div className="card-mobile mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status
                </label>
                <select
                  value={filtros.ativa?.toString() || ''}
                  onChange={(e) => applyFilters({
                    ...filtros,
                    ativa: e.target.value === '' ? undefined : e.target.value === 'true'
                  })}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                >
                  <option value="">Todos</option>
                  <option value="true">Ativas</option>
                  <option value="false">Inativas</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo
                </label>
                <select
                  value={filtros.tipo || ''}
                  onChange={(e) => applyFilters({
                    ...filtros,
                    tipo: e.target.value as TipoTransacao || undefined
                  })}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                >
                  <option value="">Todos</option>
                  {TIPO_TRANSACAO_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Frequência
                </label>
                <select
                  value={filtros.frequencia || ''}
                  onChange={(e) => applyFilters({
                    ...filtros,
                    frequencia: e.target.value as FrequenciaRecorrencia || undefined
                  })}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                >
                  <option value="">Todas</option>
                  {FREQUENCIA_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={filtros.busca || ''}
                    onChange={(e) => applyFilters({
                      ...filtros,
                      busca: e.target.value || undefined
                    })}
                    placeholder="Descrição..."
                    className="pl-10 w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                  />
                </div>
              </div>
              
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={() => applyFilters({})}
                  className="btn-touch border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Transações */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Transações Recorrentes</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-slate-600">Carregando transações recorrentes...</p>
            </div>
          ) : transacoes.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <RotateCcw className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-medium mb-2">Nenhuma transação recorrente encontrada</h3>
              <p>Comece criando sua primeira transação recorrente para automatizar seus pagamentos.</p>
              <button
                onClick={() => {
                  setEditingTransacao(null);
                  resetForm();
                  setShowModal(true);
                }}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Transação Recorrente
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {transacoes.map((transacao) => (
                <div key={transacao.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors">
                  {/* Layout Mobile */}
                  <div className="block sm:hidden">
                    <div className="flex items-start space-x-3">
                      <div 
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white`}
                        style={{ backgroundColor: transacao.categoria_cor }}
                      >
                        <span className="text-sm">
                          {transacao.categoria_icone}
                        </span>
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {transacao.descricao}
                              </p>
                              {!transacao.ativa && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Inativa
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span 
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  transacao.tipo === 'ENTRADA' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {transacao.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
                              </span>
                              <span className="text-xs text-slate-500">
                                {transacao.categoria_nome}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <p className={`text-lg font-semibold ${
                              transacao.tipo === 'ENTRADA' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transacao.tipo === 'ENTRADA' ? '+' : '-'}{formatCurrency(transacao.valor)}
                            </p>
                            <p className="text-xs text-purple-600 font-medium">
                              {getFrequenciaLabel(transacao.frequencia)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center space-x-2 text-xs text-slate-500">
                            <span>{transacao.forma_pagamento}</span>
                            <span>•</span>
                            <span>Dia {transacao.dia_vencimento}</span>
                            {transacao.proximo_vencimento && (
                              <>
                                <span>•</span>
                                <span>Próx: {formatDate(transacao.proximo_vencimento)}</span>
                              </>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleToggle(transacao.id)}
                              className={`p-2 rounded-lg transition-colors touch-manipulation ${
                                transacao.ativa 
                                  ? 'text-green-600 hover:bg-green-50' 
                                  : 'text-slate-400 hover:bg-slate-50'
                              }`}
                              title={transacao.ativa ? 'Desativar' : 'Ativar'}
                            >
                              {transacao.ativa ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                            </button>
                            
                            <button
                              onClick={() => handleEdit(transacao)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => handleDelete(transacao.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-manipulation"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Layout Desktop */}
                  <div className="hidden sm:block">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div 
                          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white`}
                          style={{ backgroundColor: transacao.categoria_cor }}
                        >
                          {transacao.categoria_icone}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {transacao.descricao}
                            </p>
                            <span 
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                transacao.tipo === 'ENTRADA' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {transacao.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
                            </span>
                            {!transacao.ativa && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Inativa
                              </span>
                            )}
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              🔄 {getFrequenciaLabel(transacao.frequencia)}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-sm text-slate-500">
                              {transacao.categoria_nome}
                            </p>
                            <p className="text-sm text-slate-500">
                              {transacao.forma_pagamento}
                            </p>
                            <p className="text-sm text-slate-500">
                              Dia {transacao.dia_vencimento}
                            </p>
                            {transacao.proximo_vencimento && (
                              <p className="text-sm text-slate-500">
                                Próximo: {formatDate(transacao.proximo_vencimento)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className={`text-lg font-semibold ${
                            transacao.tipo === 'ENTRADA' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transacao.tipo === 'ENTRADA' ? '+' : '-'}{formatCurrency(transacao.valor)}
                          </p>
                          <p className="text-xs text-purple-600 font-medium">
                            por {getFrequenciaLabel(transacao.frequencia).toLowerCase()}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleToggle(transacao.id)}
                            className={`p-2 rounded-lg transition-colors touch-manipulation ${
                              transacao.ativa 
                                ? 'text-green-600 hover:bg-green-50' 
                                : 'text-slate-400 hover:bg-slate-50'
                            }`}
                            title={transacao.ativa ? 'Desativar' : 'Ativar'}
                          >
                            {transacao.ativa ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                          </button>
                          
                          <button
                            onClick={() => handleEdit(transacao)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDelete(transacao.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-manipulation"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Botão Carregar Mais */}
          {hasMore && !loading && transacoes.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-200">
              <button
                onClick={loadMoreTransacoes}
                disabled={loadingMore}
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Carregando...
                  </>
                ) : (
                  'Carregar mais'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingTransacao ? 'Editar Transação Recorrente' : 'Nova Transação Recorrente'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingTransacao(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Netflix, Conta de Luz, Salário..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo *
                  </label>
                  <select
                    required
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoTransacao })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIPO_TRANSACAO_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria *
                  </label>
                  <select
                    required
                    value={formData.categoria_id}
                    onChange={(e) => setFormData({ ...formData, categoria_id: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione uma categoria</option>
                    {categorias.map(categoria => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.icone} {categoria.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conta
                  </label>
                  <select
                    value={formData.conta_id || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      conta_id: e.target.value ? parseInt(e.target.value) : undefined,
                      cartao_id: undefined // Limpar cartão se conta for selecionada
                    })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione uma conta</option>
                    {contas.map(conta => (
                      <option key={conta.id} value={conta.id}>
                        {conta.nome} - {conta.banco}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cartão
                  </label>
                  <select
                    value={formData.cartao_id || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      cartao_id: e.target.value ? parseInt(e.target.value) : undefined,
                      conta_id: undefined // Limpar conta se cartão for selecionado
                    })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um cartão</option>
                    {cartoes.map(cartao => (
                      <option key={cartao.id} value={cartao.id}>
                        {cartao.nome} - {cartao.bandeira}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequência *
                  </label>
                  <select
                    required
                    value={formData.frequencia}
                    onChange={(e) => setFormData({ ...formData, frequencia: e.target.value as FrequenciaRecorrencia })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {FREQUENCIA_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dia do Vencimento *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={formData.dia_vencimento}
                    onChange={(e) => setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Fim (opcional)
                  </label>
                  <input
                    type="date"
                    value={formData.data_fim || ''}
                    onChange={(e) => setFormData({ ...formData, data_fim: e.target.value || undefined })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="ativa"
                  checked={formData.ativa}
                  onChange={(e) => setFormData({ ...formData, ativa: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="ativa" className="ml-2 block text-sm text-gray-900">
                  Transação ativa
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingTransacao(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {editingTransacao ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransacoesRecorrentes; 