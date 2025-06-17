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
  X,
  DollarSign,
  Tag,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  User
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
import SeletorIconeSvg from '../components/SeletorIconeSvg';
import SvgLogoIcon from '../components/SvgLogoIcon';
import IconeGenericoComponent from '../components/IconeGenericoComponent';
import { getSvgLogo } from '../data/svgLogos';
import { getIconeGenerico } from '../data/iconesGenericos';

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
  
  // Estados do seletor de ícone
  const [showIconSelector, setShowIconSelector] = useState(false);
  
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
      console.log('🔄 Carregando resumo...');
      const response = await transacoesRecorrentesApi.getResumo();
      console.log('📊 Resumo recebido:', response);
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
    
    // Validação para criação
    if (!formData.descricao || formData.descricao.trim() === '') {
      setErrorMessage('Descrição é obrigatória');
      return;
    }
    
    if (formData.valor <= 0) {
      setErrorMessage('Valor deve ser maior que zero');
      return;
    }
    
    if (formData.categoria_id <= 0) {
      setErrorMessage('Categoria é obrigatória');
      return;
    }
    
    if (!formData.conta_id && !formData.cartao_id) {
      setErrorMessage('❌ Você deve selecionar uma Conta OU um Cartão para a transação');
      return;
    }
    
    if (formData.conta_id && formData.cartao_id) {
      setErrorMessage('❌ Você não pode selecionar Conta E Cartão ao mesmo tempo. Escolha apenas um.');
      return;
    }
    
    try {
      if (editingTransacao) {
        console.log('🔄 Editando transação recorrente:', formData);
        await transacoesRecorrentesApi.update(editingTransacao.id, formData);
        setSuccessMessage('Transação recorrente atualizada com sucesso!');
      } else {
        console.log('🔄 Criando transação recorrente:', formData);
        await transacoesRecorrentesApi.create(formData);
        setSuccessMessage('Transação recorrente criada com sucesso!');
      }
      
      setShowModal(false);
      resetForm();
      setEditingTransacao(null);
      loadTransacoes(true);
      loadResumo();
      
    } catch (error: any) {
      console.error('❌ Erro ao salvar transação recorrente:', error);
      setErrorMessage(error.response?.data?.detail || 'Erro ao salvar transação recorrente');
    }
  };

  const handleEdit = async (transacao: TransacaoRecorrenteListResponse) => {
    try {
      // Buscar dados completos da transação
      const transacaoCompleta: any = await transacoesRecorrentesApi.getById(transacao.id);
      
      setEditingTransacao(transacao);
      setFormData({
        descricao: transacaoCompleta.descricao,
        valor: transacaoCompleta.valor,
        tipo: transacaoCompleta.tipo,
        categoria_id: transacaoCompleta.categoria_id,
        conta_id: transacaoCompleta.conta_id || undefined,
        cartao_id: transacaoCompleta.cartao_id || undefined,
        frequencia: transacaoCompleta.frequencia,
        data_inicio: transacaoCompleta.data_inicio,
        data_fim: transacaoCompleta.data_fim || undefined,
        ativa: transacaoCompleta.ativa,
        icone_personalizado: transacaoCompleta.icone_personalizado || undefined
      });
      setShowModal(true);
    } catch (error: any) {
      console.error('❌ Erro ao carregar transação para edição:', error);
      setErrorMessage('Erro ao carregar dados da transação');
    }
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
    setEditingTransacao(null);
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

  // Helper para renderizar ícone personalizado
  const renderIconePersonalizado = (iconePersonalizado: string | undefined, size: number = 24) => {
    if (!iconePersonalizado) return null;
    
    // Verificar se é um SVG logo real
    const svgLogo = getSvgLogo(iconePersonalizado);
    if (svgLogo) {
      return <SvgLogoIcon logoId={iconePersonalizado} size={size} />;
    }
    
    // Verificar se é um ícone genérico
    const iconeGenerico = getIconeGenerico(iconePersonalizado);
    if (iconeGenerico) {
      return <IconeGenericoComponent iconeId={iconePersonalizado} size={size} />;
    }
    
    return null;
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

  // Debug log
  console.log('🎯 Estado resumo atual:', resumo);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />
      
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        {/* Cabeçalho com estilo melhorado */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Transações Recorrentes</h1>
            <p className="text-gray-600 mt-1">Gerencie suas receitas e despesas fixas mensais</p>
          </div>
          
          {/* Botões de ação com estilo melhorado */}
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-touch bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow space-x-2 touch-manipulation"
            >
              <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Filtros</span>
            </button>
            
            <button
              onClick={handleExportExcel}
              className="btn-touch bg-gradient-to-r from-green-500 to-teal-600 text-white hover:from-green-600 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl space-x-2 touch-manipulation"
            >
              <Download className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Excel</span>
              <span className="sm:hidden">XLS</span>
            </button>
            
            <button
              onClick={() => setShowModal(true)}
              className="btn-touch bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl space-x-2 touch-manipulation"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Nova Recorrente</span>
            </button>
          </div>
        </div>

        {/* Abas de navegação */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('lista')}
            className={`px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
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
            className={`px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
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

        {/* Cards de resumo - visível em todas as abas */}
        {resumo && (
          <div className="grid-responsive mb-8">
            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600">Total de Transações</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{resumo.total_transacoes}</p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {resumo.ativas} ativas, {resumo.inativas} inativas
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600">Entradas/Mês</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">
                    {formatCurrency(resumo.valor_mes_entradas || resumo.valor_mensal_entradas || 0)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {(resumo.valor_mes_entradas || resumo.valor_mensal_entradas || 0) > 0 
                      ? 'Receitas recorrentes' 
                      : 'Sem receitas fixas'}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600">Saídas/Mês</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600">
                    {formatCurrency(resumo.valor_mes_saidas || resumo.valor_mensal_saidas || 0)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {(resumo.valor_mes_saidas || resumo.valor_mensal_saidas || 0) > 0 
                      ? 'Despesas recorrentes' 
                      : 'Sem despesas fixas'}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600">Saldo Estimado</p>
                  <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${
                    (resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0) >= 0 
                      ? 'text-blue-600' 
                      : 'text-orange-600'
                  }`}>
                    {formatCurrency(resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0)}
                  </p>
                  <p className={`text-xs sm:text-sm mt-1 ${
                    resumo.total_transacoes === 0 
                      ? 'text-slate-500' 
                      : (resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0) >= 0 
                        ? 'text-blue-600' 
                        : 'text-orange-600'
                  }`}>
                    {resumo.total_transacoes === 0 
                      ? 'Sem movimentação' 
                      : (resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0) >= 0 
                        ? 'Saldo positivo' 
                        : 'Saldo negativo'
                    }
                  </p>
                </div>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  resumo.total_transacoes === 0 
                    ? 'bg-slate-50' 
                    : (resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0) >= 0 
                      ? 'bg-blue-50' 
                      : 'bg-orange-50'
                }`}>
                  <DollarSign className={`h-5 w-5 sm:h-6 sm:w-6 ${
                    resumo.total_transacoes === 0 
                      ? 'text-slate-400' 
                      : (resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0) >= 0 
                        ? 'text-blue-600' 
                        : 'text-orange-600'
                  }`} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo baseado na aba ativa */}
        {activeTab === 'lista' ? (
          <div>
            {/* Lista de transações */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {transacoes.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                    <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <Calendar className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma transação recorrente</h3>
                    <p className="text-gray-500 mb-6">Você ainda não tem transações recorrentes cadastradas.</p>
                    <button
                      onClick={() => setShowModal(true)}
                      className="btn-touch bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-5 w-5" />
                      <span>Criar Nova Recorrente</span>
                    </button>
                  </div>
                ) : (
                  transacoes.map((transacao) => (
                    <div
                      key={transacao.id}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-full ${
                            transacao.tipo === 'ENTRADA' ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            {transacao.icone_personalizado ? (
                              renderIconePersonalizado(transacao.icone_personalizado, 24)
                            ) : transacao.tipo === 'ENTRADA' ? (
                              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                            ) : (
                              <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                            )}
                          </div>
                          
                          <div>
                            <h3 className="font-medium text-gray-900 text-base sm:text-lg">{transacao.descricao}</h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                              <span className="text-xs sm:text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                {getFrequenciaLabel(transacao.frequencia)}
                              </span>
                              {transacao.proximo_vencimento && (
                                <span className="text-xs sm:text-sm text-gray-600 flex items-center gap-1">
                                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                  {formatDate(transacao.proximo_vencimento)}
                                </span>
                              )}
                              <span className="text-xs sm:text-sm text-gray-600 flex items-center gap-1">
                                <Tag className="h-3 w-3 sm:h-4 sm:w-4" />
                                {transacao.categoria_nome}
                              </span>
                              {transacao.created_by_name && (
                                <span className="text-xs sm:text-sm text-gray-600 flex items-center gap-1">
                                  <User className="h-3 w-3 sm:h-4 sm:w-4" />
                                  {transacao.created_by_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                          <div className="text-right">
                            <p className={`text-lg sm:text-xl font-bold ${
                              transacao.tipo === 'ENTRADA' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(transacao.valor)}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-600">{transacao.forma_pagamento}</p>
                          </div>
                          
                          <div className="flex items-center gap-1 sm:gap-2">
                            <button
                              onClick={() => handleEdit(transacao)}
                              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Editar"
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
                              title={transacao.ativa ? "Desativar" : "Ativar"}
                            >
                              {transacao.ativa ? <Eye size={18} /> : <EyeOff size={18} />}
                            </button>
                            
                            <button
                              onClick={() => handleDelete(transacao.id)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Botão carregar mais */}
                {hasMore && (
                  <div className="flex justify-center py-6">
                    <button
                      onClick={loadMoreTransacoes}
                      disabled={loadingMore}
                      className="btn-touch bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <>
                          <div className="h-4 w-4 border-2 border-t-blue-600 border-r-blue-600 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                          <span>Carregando...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          <span>Carregar Mais</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <CalendarioRecorrentes transacoes={transacoes} />
        )}

        {/* Mensagens de feedback */}
        {successMessage && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-fade-in">
            <CheckCircle size={20} />
            <span>{successMessage}</span>
          </div>
        )}
        
        {errorMessage && (
          <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-fade-in">
            <AlertCircle size={20} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal de criação/edição */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {editingTransacao ? 'Editar Transação Recorrente' : 'Nova Transação Recorrente'}
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowModal(false);
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

                  {/* Ícone personalizado */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ícone Personalizado (opcional)
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowIconSelector(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {formData.icone_personalizado ? (
                          <>
                            <div className="w-6 h-6 flex items-center justify-center">
                              {renderIconePersonalizado(formData.icone_personalizado, 16)}
                            </div>
                            <span className="text-sm">Ícone selecionado</span>
                          </>
                        ) : (
                          <>
                            <Plus size={16} />
                            <span className="text-sm">Escolher ícone</span>
                          </>
                        )}
                      </button>
                      
                      {formData.icone_personalizado && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, icone_personalizado: undefined })}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
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

        {/* Seletor de Ícone */}
        <SeletorIconeSvg
          isOpen={showIconSelector}
          onClose={() => setShowIconSelector(false)}
          onSelect={(logoId) => setFormData({ ...formData, icone_personalizado: logoId })}
          iconeAtual={formData.icone_personalizado}
        />
      </div>
    </div>
  );
};

export default TransacoesRecorrentes; 