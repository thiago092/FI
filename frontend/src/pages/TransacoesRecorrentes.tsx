import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { 
  TransacaoRecorrenteListResponse, 
  TransacaoRecorrenteCreate,
  FiltrosTransacaoRecorrente,
  ResumoTransacoesRecorrentes,
  TipoTransacao,
  FrequenciaRecorrencia,
  FREQUENCIA_OPTIONS 
} from '../types/transacaoRecorrente';
import { transacoesRecorrentesApi } from '../services/api';
import { categoriasApi } from '../services/api';
import { contasApi } from '../services/api';
import { cartoesApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useExcelExport } from '../hooks/useExcelExport';
import CalendarioRecorrentes from '../components/CalendarioRecorrentes';
import Navigation from '../components/Navigation';

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
  const { user } = useAuth();
  
  // Estados principais
  const [transacoes, setTransacoes] = useState<TransacaoRecorrenteListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalTransacoes, setTotalTransacoes] = useState(0);
  
  // Estados do modal
  const [showModal, setShowModal] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<TransacaoRecorrenteListResponse | null>(null);
  
  // Estados dos filtros
  const [filtros, setFiltros] = useState<FiltrosTransacaoRecorrente>({});
  const [showFilters, setShowFilters] = useState(false);
  
  // Estado do resumo
  const [resumo, setResumo] = useState<ResumoTransacoesRecorrentes | null>(null);
  
  // Estados das dependências
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  
  // Estados da visualização
  const [activeTab, setActiveTab] = useState<'lista' | 'calendario'>('lista');
  
  // Estado do formulário
  const [formData, setFormData] = useState<TransacaoRecorrenteCreate>({
    descricao: '',
    valor: 0,
    tipo: 'SAIDA',
    categoria_id: 0,
    conta_id: undefined,
    cartao_id: undefined,
    frequencia: 'MENSAL',
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: undefined,
    ativa: true,
    icone_personalizado: undefined
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
      categoria_id: 0,
      conta_id: undefined,
      cartao_id: undefined,
      frequencia: transacao.frequencia,
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: undefined,
      ativa: transacao.ativa,
      icone_personalizado: undefined
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
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: undefined,
      ativa: true,
      icone_personalizado: undefined
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
      const success = await exportTransacoes(transacoes, filtros);
      if (success) {
        setSuccessMessage('Dados exportados com sucesso!');
      } else {
        setErrorMessage('Erro ao exportar dados');
      }
    } catch (error) {
      console.error('❌ Erro ao exportar:', error);
      setErrorMessage('Erro ao exportar dados');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />
      
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Cabeçalho */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Transações Recorrentes</h1>
            <p className="text-gray-600 mt-1">Gerencie suas receitas e despesas fixas</p>
          </div>
          
          {/* Botões de ação */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <Filter size={20} />
              Filtros
            </button>
            
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Download size={20} />
              Exportar
            </button>
            
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus size={20} />
              Nova Transação
            </button>
          </div>
        </div>

        {/* Abas de navegação */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('lista')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'lista'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 size={18} />
              Lista
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('calendario')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'calendario'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar size={18} />
              Calendário
            </div>
          </button>
        </div>

        {/* Conteúdo baseado na aba ativa */}
        {activeTab === 'lista' ? (
          <div>
            {/* Cards de resumo */}
            {resumo && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total de Transações</p>
                      <p className="text-2xl font-bold text-gray-900">{resumo.total_transacoes}</p>
                    </div>
                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Entradas/Mês</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(resumo.valor_mes_entradas || resumo.valor_mensal_entradas || 0)}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Saídas/Mês</p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(resumo.valor_mes_saidas || resumo.valor_mensal_saidas || 0)}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Saldo Estimado</p>
                      <p className={`text-2xl font-bold ${
                        (resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0) >= 0 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {formatCurrency(resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0)}
                      </p>
                    </div>
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                      (resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0) >= 0 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                    }`}>
                      <BarChart3 className={`h-6 w-6 ${
                        (resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0) >= 0 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de transações */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {transacoes.map((transacao) => (
                  <div
                    key={transacao.id}
                    className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${
                          transacao.tipo === 'ENTRADA' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {transacao.tipo === 'ENTRADA' ? (
                            <TrendingUp className="h-6 w-6 text-green-600" />
                          ) : (
                            <TrendingDown className="h-6 w-6 text-red-600" />
                          )}
                        </div>
                        
                        <div>
                          <h3 className="font-semibold text-gray-900">{transacao.descricao}</h3>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-sm text-gray-600">
                              {getFrequenciaLabel(transacao.frequencia)}
                            </span>
                            {transacao.proximo_vencimento && (
                              <span className="text-sm text-gray-600">
                                Próximo: {formatDate(transacao.proximo_vencimento)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`text-xl font-bold ${
                            transacao.tipo === 'ENTRADA' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(transacao.valor)}
                          </p>
                          <p className="text-sm text-gray-600">{transacao.forma_pagamento}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(transacao)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          
                          <button
                            onClick={() => handleToggle(transacao.id)}
                            className={`p-2 transition-colors ${
                              transacao.ativa 
                                ? 'text-green-600 hover:text-green-700' 
                                : 'text-gray-400 hover:text-green-600'
                            }`}
                          >
                            {transacao.ativa ? <Eye size={18} /> : <EyeOff size={18} />}
                          </button>
                          
                          <button
                            onClick={() => handleDelete(transacao.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Botão carregar mais */}
                {hasMore && (
                  <div className="flex justify-center py-6">
                    <button
                      onClick={loadMoreTransacoes}
                      disabled={loadingMore}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loadingMore ? 'Carregando...' : 'Carregar Mais'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <CalendarioRecorrentes transacoes={transacoes} />
        )}

        {/* Modal de criação/edição */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">
                    {editingTransacao ? 'Editar Transação Recorrente' : 'Nova Transação Recorrente'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingTransacao(null);
                      resetForm();
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Descrição */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descrição
                    </label>
                    <input
                      type="text"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Salário, Aluguel, Netflix..."
                      required
                    />
                  </div>

                  {/* Valor e Tipo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valor
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0,00"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo
                      </label>
                      <select
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoTransacao })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="ENTRADA">Entrada</option>
                        <option value="SAIDA">Saída</option>
                      </select>
                    </div>
                  </div>

                  {/* Categoria */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoria
                    </label>
                    <select
                      value={formData.categoria_id}
                      onChange={(e) => setFormData({ ...formData, categoria_id: parseInt(e.target.value) })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value={0}>Selecione uma categoria</option>
                      {categorias.map(categoria => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Forma de pagamento */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Conta
                      </label>
                      <select
                        value={formData.conta_id || ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          conta_id: e.target.value ? parseInt(e.target.value) : undefined,
                          cartao_id: undefined 
                        })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Nenhuma conta</option>
                        {contas.map(conta => (
                          <option key={conta.id} value={conta.id}>
                            {conta.nome} - {conta.banco}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cartão
                      </label>
                      <select
                        value={formData.cartao_id || ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          cartao_id: e.target.value ? parseInt(e.target.value) : undefined,
                          conta_id: undefined 
                        })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Nenhum cartão</option>
                        {cartoes.map(cartao => (
                          <option key={cartao.id} value={cartao.id}>
                            {cartao.nome} - {cartao.bandeira}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Frequência e Data de Início */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Frequência
                      </label>
                      <select
                        value={formData.frequencia}
                        onChange={(e) => setFormData({ ...formData, frequencia: e.target.value as FrequenciaRecorrencia })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {FREQUENCIA_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data de Início
                      </label>
                      <input
                        type="date"
                        value={formData.data_inicio}
                        onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  {/* Data de Fim (opcional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data de Fim (opcional)
                    </label>
                    <input
                      type="date"
                      value={formData.data_fim || ''}
                      onChange={(e) => setFormData({ ...formData, data_fim: e.target.value || undefined })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Status Ativo */}
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

                  {/* Botões */}
                  <div className="flex justify-end gap-3 pt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setEditingTransacao(null);
                        resetForm();
                      }}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {editingTransacao ? 'Atualizar' : 'Criar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Mensagens de feedback */}
        {successMessage && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransacoesRecorrentes; 