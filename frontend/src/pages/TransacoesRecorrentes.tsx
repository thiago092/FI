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
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Transações Recorrentes</h1>
              <p className="mt-2 text-gray-600">
                Gerencie seus pagamentos e recebimentos automáticos
              </p>
            </div>
            
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <button
                onClick={handleExportExcel}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                Exportar Excel
              </button>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </button>
              
              <button
                onClick={() => {
                  setEditingTransacao(null);
                  resetForm();
                  setShowModal(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Transação Recorrente
              </button>
            </div>
          </div>
        </div>

        {/* Mensagens de Feedback */}
        {successMessage && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Cards de Resumo */}
        {resumo && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Activity className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total</dt>
                      <dd className="text-lg font-medium text-gray-900">{resumo.total_transacoes}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Power className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Ativas</dt>
                      <dd className="text-lg font-medium text-gray-900">{resumo.ativas}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Entradas/Mês</dt>
                      <dd className="text-lg font-medium text-green-600">
                        {formatCurrency(resumo.valor_mensal_entradas)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingDown className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Saídas/Mês</dt>
                      <dd className="text-lg font-medium text-red-600">
                        {formatCurrency(resumo.valor_mensal_saidas)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        {showFilters && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Filtros</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filtros.ativa?.toString() || ''}
                  onChange={(e) => applyFilters({
                    ...filtros,
                    ativa: e.target.value === '' ? undefined : e.target.value === 'true'
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="true">Ativas</option>
                  <option value="false">Inativas</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  value={filtros.tipo || ''}
                  onChange={(e) => applyFilters({
                    ...filtros,
                    tipo: e.target.value as TipoTransacao || undefined
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequência
                </label>
                <select
                  value={filtros.frequencia || ''}
                  onChange={(e) => applyFilters({
                    ...filtros,
                    frequencia: e.target.value as FrequenciaRecorrencia || undefined
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buscar
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar por descrição..."
                    value={filtros.busca || ''}
                    onChange={(e) => applyFilters({
                      ...filtros,
                      busca: e.target.value || undefined
                    })}
                    className="w-full border border-gray-300 rounded-md pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => applyFilters({})}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        )}

        {/* Lista de Transações */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Carregando transações recorrentes...</p>
            </div>
          ) : transacoes.length === 0 ? (
            <div className="p-8 text-center">
              <RotateCcw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma transação recorrente encontrada
              </h3>
              <p className="text-gray-600 mb-4">
                Comece criando sua primeira transação recorrente para automatizar seus pagamentos.
              </p>
              <button
                onClick={() => {
                  setEditingTransacao(null);
                  resetForm();
                  setShowModal(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Transação Recorrente
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {transacoes.map((transacao) => (
                <li key={transacao.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
                        style={{ backgroundColor: transacao.categoria_cor }}
                      >
                        {transacao.categoria_icone}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {transacao.descricao}
                          </p>
                          {!transacao.ativa && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              Inativa
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-1">
                          <p className="text-sm text-gray-500">
                            {transacao.categoria_nome}
                          </p>
                          <p className="text-sm text-gray-500">
                            {transacao.forma_pagamento}
                          </p>
                          <p className="text-sm text-gray-500">
                            {getFrequenciaLabel(transacao.frequencia)} - Dia {transacao.dia_vencimento}
                          </p>
                          {transacao.proximo_vencimento && (
                            <p className="text-sm text-gray-500">
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
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggle(transacao.id)}
                          className={`p-2 rounded-md ${
                            transacao.ativa 
                              ? 'text-green-600 hover:bg-green-50' 
                              : 'text-gray-400 hover:bg-gray-50'
                          }`}
                          title={transacao.ativa ? 'Desativar' : 'Ativar'}
                        >
                          {transacao.ativa ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                        </button>
                        
                        <button
                          onClick={() => handleEdit(transacao)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => handleDelete(transacao.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          
          {/* Botão Carregar Mais */}
          {hasMore && !loading && transacoes.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200">
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