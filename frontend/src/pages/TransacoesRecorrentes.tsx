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
import ToastContainer from '../components/ToastContainer';
import { useToast } from '../hooks/useToast';
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
  const { toasts, removeToast, showSuccess, showError, showSaveSuccess, showDeleteSuccess } = useToast();
  
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

  // Estados para feedback (removidos - usando toasts agora)
  const { exportTransacoes } = useExcelExport();

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
      showError('Erro ao carregar', 'Não foi possível carregar as transações recorrentes');
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
      showError('Erro ao carregar', 'Não foi possível carregar os dados necessários');
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
      showError('Campo obrigatório', 'Descrição é obrigatória');
      return;
    }
    
    if (formData.valor <= 0) {
      showError('Valor inválido', 'Valor deve ser maior que zero');
      return;
    }
    
    if (formData.categoria_id <= 0) {
      showError('Campo obrigatório', 'Categoria é obrigatória');
      return;
    }
    
    if (!formData.conta_id && !formData.cartao_id) {
      showError('Seleção obrigatória', 'Você deve selecionar uma Conta OU um Cartão para a transação');
      return;
    }
    
    if (formData.conta_id && formData.cartao_id) {
      showError('Seleção inválida', 'Você não pode selecionar Conta E Cartão ao mesmo tempo. Escolha apenas um.');
      return;
    }
    
    try {
      if (editingTransacao) {
        console.log('🔄 Editando transação recorrente:', formData);
        await transacoesRecorrentesApi.update(editingTransacao.id, formData);
        showSaveSuccess('Transação recorrente atualizada');
      } else {
        console.log('🔄 Criando transação recorrente:', formData);
        await transacoesRecorrentesApi.create(formData);
        showSaveSuccess('Transação recorrente criada');
      }
      
      setShowModal(false);
      resetForm();
      setEditingTransacao(null);
      loadTransacoes(true);
      loadResumo();
      
    } catch (error: any) {
      console.error('❌ Erro ao salvar transação recorrente:', error);
      showError('Erro ao salvar', error.response?.data?.detail || 'Erro ao salvar transação recorrente');
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
      showError('Erro ao carregar', 'Não foi possível carregar os dados da transação');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta transação recorrente?')) {
      return;
    }

    try {
      await transacoesRecorrentesApi.delete(id);
      showDeleteSuccess('Transação recorrente excluída');
      loadTransacoes(true);
      loadResumo();
    } catch (error: any) {
      console.error('❌ Erro ao excluir transação recorrente:', error);
      showError('Erro ao excluir', error.response?.data?.detail || 'Erro ao excluir transação recorrente');
    }
  };

  const handleToggle = async (id: number) => {
    try {
      const response = await transacoesRecorrentesApi.toggle(id);
      showSuccess('Status alterado', response.message);
      loadTransacoes(true);
      loadResumo();
    } catch (error: any) {
      console.error('❌ Erro ao alterar status:', error);
      showError('Erro ao alterar status', error.response?.data?.detail || 'Erro ao alterar status');
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
        showSuccess('Dados exportados!', 'Arquivo Excel gerado com sucesso');
      } else {
        showError('Erro na exportação', 'Não foi possível exportar os dados');
      }
    } catch (error) {
      console.error('❌ Erro ao exportar:', error);
      showError('Erro na exportação', 'Ocorreu um erro ao exportar os dados');
    }
  };

  // Debug log
  console.log('🎯 Estado resumo atual:', resumo);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation user={user} />
      
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        {/* Cabeçalho com estilo melhorado */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Transações Recorrentes</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">Gerencie suas receitas e despesas fixas mensais</p>
          </div>
          
          {/* Botões de ação com estilo melhorado */}
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-touch bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 shadow-sm hover:shadow space-x-2 touch-manipulation"
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

        {/* 🆕 Aviso sobre confirmação via Telegram */}
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800/50 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                🆕 Nova Funcionalidade: Confirmação via Telegram
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                Agora você pode receber notificações no Telegram antes das transações recorrentes serem criadas automaticamente. 
                Configure o tempo de confirmação e aprove ou rejeite cada transação diretamente pelo chat!
              </p>
              <div className="flex flex-wrap gap-2">
                <a 
                  href="/settings" 
                  className="inline-flex items-center gap-1 text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  ⚙️ Configurar Agora
                </a>
                <span className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-800/30 px-3 py-1.5 rounded-lg">
                  📱 Requer Telegram conectado
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Abas de navegação */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('lista')}
            className={`px-4 sm:px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'lista'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
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
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
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
            <div className="card-mobile hover:shadow-md dark:hover:shadow-xl dark:hover:shadow-gray-900/50 transition-all duration-200 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-400">Total de Transações</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{resumo.total_transacoes}</p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 mt-1">
                    {resumo.ativas} ativas, {resumo.inativas} inativas
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md dark:hover:shadow-xl dark:hover:shadow-gray-900/50 transition-all duration-200 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-400">Entradas/Mês</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(resumo.valor_mes_entradas || resumo.valor_mensal_entradas || 0)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 mt-1">
                    {(resumo.valor_mes_entradas || resumo.valor_mensal_entradas || 0) > 0 
                      ? 'Receitas recorrentes' 
                      : 'Sem receitas fixas'}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md dark:hover:shadow-xl dark:hover:shadow-gray-900/50 transition-all duration-200 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-400">Saídas/Mês</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(resumo.valor_mes_saidas || resumo.valor_mensal_saidas || 0)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 mt-1">
                    {(resumo.valor_mes_saidas || resumo.valor_mensal_saidas || 0) > 0 
                      ? 'Despesas recorrentes' 
                      : 'Sem despesas fixas'}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md dark:hover:shadow-xl dark:hover:shadow-gray-900/50 transition-all duration-200 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-400">Saldo Estimado</p>
                  <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${
                    (resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0) >= 0 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-orange-600 dark:text-orange-400'
                  }`}>
                    {formatCurrency(resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0)}
                  </p>
                  <p className={`text-xs sm:text-sm mt-1 ${
                    resumo.total_transacoes === 0 
                      ? 'text-slate-500 dark:text-gray-400' 
                      : (resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0) >= 0 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-orange-600 dark:text-orange-400'
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
                    ? 'bg-slate-50 dark:bg-gray-700' 
                    : (resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0) >= 0 
                      ? 'bg-blue-50 dark:bg-blue-900/30' 
                      : 'bg-orange-50 dark:bg-orange-900/30'
                }`}>
                  <DollarSign className={`h-5 w-5 sm:h-6 sm:w-6 ${
                    resumo.total_transacoes === 0 
                      ? 'text-slate-400 dark:text-gray-500' 
                      : (resumo.saldo_mes_estimado || resumo.saldo_mensal_estimado || 0) >= 0 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-orange-600 dark:text-orange-400'
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
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
                    <div className="mx-auto w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                      <Calendar className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhuma transação recorrente</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">Você ainda não tem transações recorrentes cadastradas.</p>
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
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md dark:hover:shadow-xl dark:hover:shadow-gray-900/50 transition-shadow"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-full ${
                            transacao.tipo === 'ENTRADA' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                          }`}>
                            {transacao.icone_personalizado ? (
                              renderIconePersonalizado(transacao.icone_personalizado, 24)
                            ) : transacao.tipo === 'ENTRADA' ? (
                              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                            ) : (
                              <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                            )}
                          </div>
                          
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white text-base sm:text-lg">{transacao.descricao}</h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                {getFrequenciaLabel(transacao.frequencia)}
                              </span>
                              {transacao.proximo_vencimento && (
                                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                  {formatDate(transacao.proximo_vencimento)}
                                </span>
                              )}
                              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                <Tag className="h-3 w-3 sm:h-4 sm:w-4" />
                                {transacao.categoria_nome}
                              </span>
                              {transacao.created_by_name && (
                                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
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
                              transacao.tipo === 'ENTRADA' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {formatCurrency(transacao.valor)}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{transacao.forma_pagamento}</p>
                          </div>
                          
                          <div className="flex items-center gap-1 sm:gap-2">
                            <button
                              onClick={() => handleEdit(transacao)}
                              className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                            
                            <button
                              onClick={() => handleToggle(transacao.id)}
                              className={`p-2 transition-colors ${
                                transacao.ativa 
                                  ? 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300' 
                                  : 'text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400'
                              }`}
                              title={transacao.ativa ? "Desativar" : "Ativar"}
                            >
                              {transacao.ativa ? <Eye size={18} /> : <EyeOff size={18} />}
                            </button>
                            
                            <button
                              onClick={() => handleDelete(transacao.id)}
                              className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
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
                      className="btn-touch bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
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



        {/* Modal de criação/edição */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {editingTransacao ? 'Editar Transação Recorrente' : 'Nova Transação Recorrente'}
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Descrição */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Descrição
                    </label>
                    <input
                      type="text"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
                      placeholder="Ex: Salário, Aluguel, Netflix..."
                      required
                    />
                  </div>

                  {/* Valor e Tipo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Valor
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
                        placeholder="0,00"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tipo
                      </label>
                      <select
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoTransacao })}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="ENTRADA">Entrada</option>
                        <option value="SAIDA">Saída</option>
                      </select>
                    </div>
                  </div>

                  {/* Categoria */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Categoria
                    </label>
                    <select
                      value={formData.categoria_id}
                      onChange={(e) => setFormData({ ...formData, categoria_id: parseInt(e.target.value) })}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Conta
                      </label>
                      <select
                        value={formData.conta_id || ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          conta_id: e.target.value ? parseInt(e.target.value) : undefined,
                          cartao_id: undefined 
                        })}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Cartão
                      </label>
                      <select
                        value={formData.cartao_id || ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          cartao_id: e.target.value ? parseInt(e.target.value) : undefined,
                          conta_id: undefined 
                        })}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Frequência
                      </label>
                      <select
                        value={formData.frequencia}
                        onChange={(e) => setFormData({ ...formData, frequencia: e.target.value as FrequenciaRecorrencia })}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        {FREQUENCIA_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Data de Início
                      </label>
                      <input
                        type="date"
                        value={formData.data_inicio}
                        onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  {/* Data de Fim (opcional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Data de Fim (opcional)
                    </label>
                    <input
                      type="date"
                      value={formData.data_fim || ''}
                      onChange={(e) => setFormData({ ...formData, data_fim: e.target.value || undefined })}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Ícone personalizado */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ícone Personalizado (opcional)
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowIconSelector(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                    />
                    <label htmlFor="ativa" className="ml-2 block text-sm text-gray-900 dark:text-white">
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
                      className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-700"
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

        {/* Toast Container */}
        <ToastContainer 
          toasts={toasts} 
          onRemoveToast={removeToast}
          position="top-right"
        />
      </div>
    </div>
  );
};

export default TransacoesRecorrentes; 