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
  Hash,
  X,
  Info,
  Edit,
  Trash2,
  Calendar,
  Activity,
  Eye
} from 'lucide-react';
import { transacoesApi, categoriasApi, contasApi, cartoesApi, parcelasApi } from '../services/api';
import { CloudArrowUpIcon, DocumentArrowDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
  import { useMutation, useQueryClient } from 'react-query'
  
  interface Transacao {
  id: number;
  descricao: string;
  valor: number;
  tipo: 'ENTRADA' | 'SAIDA';
  data: string;
  categoria_id: number;
  conta_id?: number;
  cartao_id?: number;
  observacoes?: string;
  is_parcelada?: boolean;
  numero_parcela?: number;
  total_parcelas?: number;
  compra_parcelada_id?: number;
  categoria?: {
    id: number;
    nome: string;
    cor: string;
    icone: string;
  };
  conta?: {
    id: number;
    nome: string;
    banco: string;
  };
  cartao?: {
    id: number;
    nome: string;
    bandeira: string;
  };
  created_at: string;
}

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

interface Filtros {
  tipo?: 'ENTRADA' | 'SAIDA';
  categoria_id?: number;
  conta_id?: number;
  cartao_id?: number;
  data_inicio?: string;
  data_fim?: string;
  busca?: string;
}

interface Resumo {
  total_entradas: number;
  total_saidas: number;
  saldo: number;
  total_transacoes: number;
}

const Transacoes: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<Transacao | null>(null);
  
  const [filtros, setFiltros] = useState<Filtros>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Estados do formulário
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    tipo: 'SAIDA' as 'ENTRADA' | 'SAIDA',
    data: new Date().toISOString().split('T')[0],
    categoria_id: '',
    conta_id: '',
    cartao_id: '',
    observacoes: ''
  });

  // NOVO: Estados para parcelamento
  const [isParcelado, setIsParcelado] = useState(false);
  const [formParcelamento, setFormParcelamento] = useState({
    total_parcelas: 2,
    data_primeira_parcela: new Date().toISOString().split('T')[0]
  });

  // Estados para feedback
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [showInfo, setShowInfo] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<any>(null)
  
  const queryClient = useQueryClient()

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
      const response = await transacoesApi.getAll({
        skip: currentPage * 50,
        limit: 50,
        ...filtros
      });
      
      if (reset) {
        setTransacoes(response);
        setPage(0);
      } else {
        setTransacoes(prev => [...prev, ...response]);
      }
      
      setHasMore(response.length === 50);
      if (!reset) setPage(prev => prev + 1);
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResumo = async () => {
    try {
      const response = await transacoesApi.getResumo({
        data_inicio: filtros.data_inicio,
        data_fim: filtros.data_fim
      });
      setResumo(response);
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
    }
  };

  const loadDependencies = async () => {
    try {
      const [categoriasData, contasData, cartoesData] = await Promise.all([
        categoriasApi.getAll(),
        contasApi.getAll(),
        cartoesApi.getAll()
      ]);
      
      setCategorias(categoriasData);
      setContas(contasData);
      setCartoes(cartoesData);
    } catch (error) {
      console.error('Erro ao carregar dependências:', error);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  useEffect(() => {
    setLoading(true);
    loadTransacoes(true);
    loadResumo();
  }, [filtros]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // NOVO: Verificar se é parcelamento
      if (isParcelado && formData.cartao_id && parseFloat(formData.valor) > 0) {
        // Criar compra parcelada usando API service
        const parcelamentoData = {
          descricao: formData.descricao,
          valor_total: parseFloat(formData.valor),
          total_parcelas: formParcelamento.total_parcelas,
          cartao_id: parseInt(formData.cartao_id),
          data_primeira_parcela: formParcelamento.data_primeira_parcela,
          categoria_id: parseInt(formData.categoria_id)
        };

        // Usar api service em vez de fetch direto
        await parcelasApi.create(parcelamentoData);
        
        // 🎉 NOVO: Feedback de sucesso para parcelamento
        setSuccessMessage(`✅ Parcelamento criado com sucesso!\n\n📦 ${formData.descricao}\n💰 ${formParcelamento.total_parcelas}x de R$ ${(parseFloat(formData.valor) / formParcelamento.total_parcelas).toFixed(2)}\n🎯 Total: R$ ${parseFloat(formData.valor).toFixed(2)}`);
        
      } else {
        // Criar transação normal
        const transacaoData = {
          descricao: formData.descricao,
          valor: parseFloat(formData.valor),
          tipo: formData.tipo,
          data: new Date(formData.data).toISOString(),
          categoria_id: parseInt(formData.categoria_id),
          conta_id: formData.conta_id ? parseInt(formData.conta_id) : undefined,
          cartao_id: formData.cartao_id ? parseInt(formData.cartao_id) : undefined,
          observacoes: formData.observacoes || undefined
        };

        if (editingTransacao) {
          await transacoesApi.update(editingTransacao.id, transacaoData);
          // 🎉 NOVO: Feedback para edição
          setSuccessMessage('✅ Transação atualizada com sucesso!');
        } else {
          await transacoesApi.create(transacaoData);
          // 🎉 NOVO: Feedback para criação
          setSuccessMessage('✅ Transação criada com sucesso!');
        }
      }
      
      await loadTransacoes(true);
      await loadResumo();
      setShowModal(false);
      setEditingTransacao(null);
      resetForm();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      // 🚨 NOVO: Feedback de erro melhorado
      const errorMessage = error?.response?.data?.detail || error?.message || 'Erro desconhecido';
      setErrorMessage(`❌ Erro ao salvar: ${errorMessage}`);
    }
  };

  const handleEdit = (transacao: Transacao) => {
    setEditingTransacao(transacao);
    setFormData({
      descricao: transacao.descricao,
      valor: transacao.valor.toString(),
      tipo: transacao.tipo,
      data: transacao.data.split('T')[0],
      categoria_id: transacao.categoria_id.toString(),
      conta_id: transacao.conta_id?.toString() || '',
      cartao_id: transacao.cartao_id?.toString() || '',
      observacoes: transacao.observacoes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
      try {
        await transacoesApi.delete(id);
        loadTransacoes(true);
        loadResumo();
      } catch (error) {
        console.error('Erro ao excluir transação:', error);
      }
    }
  };

  // NOVO: Excluir parcelamento completo
  const handleDeleteParcelamento = async (transacao: Transacao) => {
    if (!transacao.compra_parcelada_id) return;

    const confirmacao = confirm(
      `🗑️ EXCLUIR PARCELAMENTO COMPLETO\n\n` +
      `📦 ${transacao.descricao}\n` +
      `📊 Parcela ${transacao.numero_parcela}/${transacao.total_parcelas}\n\n` +
      `⚠️ Esta ação excluirá TODAS as parcelas do parcelamento!\n` +
      `⚠️ Todas as transações relacionadas serão removidas!\n\n` +
      `Tem certeza que deseja continuar?`
    );

    if (!confirmacao) return;

    try {
      const result = await parcelasApi.delete(transacao.compra_parcelada_id);
      
      setSuccessMessage(
        `✅ Parcelamento excluído com sucesso!\n` +
        `📦 ${transacao.descricao} foi removido\n` +
        `🗑️ ${result.detalhes?.parcelas_excluidas || 0} parcelas excluídas\n` +
        `📄 ${result.detalhes?.transacoes_excluidas || 0} transações removidas`
      );
      
      loadTransacoes(true);
      loadResumo();
    } catch (err: any) {
      console.error('Erro ao excluir parcelamento:', err);
      setErrorMessage(
        `❌ Erro ao excluir parcelamento:\n${err.response?.data?.detail || err.message}`
      );
    }
  };

  // NOVO: Editar parcelamento
  const handleEditParcelamento = async (transacao: Transacao) => {
    if (!transacao.compra_parcelada_id) return;

    // Para simplicidade, vamos navegar para a página de cartões na aba parcelamentos
    navigate('/cartoes?tab=parcelas&highlight=' + transacao.compra_parcelada_id);
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      valor: '',
      tipo: 'SAIDA',
      data: new Date().toISOString().split('T')[0],
      categoria_id: '',
      conta_id: '',
      cartao_id: '',
      observacoes: ''
    });
    // NOVO: Reset parcelamento
    setIsParcelado(false);
    setFormParcelamento({
      total_parcelas: 2,
      data_primeira_parcela: new Date().toISOString().split('T')[0]
    });
  };

  const applyFilters = (newFiltros: Filtros) => {
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

  // Mutation para importação Excel
  const importExcelMutation = useMutation(
    (file: File) => transacoesApi.uploadExcel(file),
    {
      onSuccess: (result) => {
        setImportResult(result)
        setImportFile(null)
        queryClient.invalidateQueries('transacoes')
        queryClient.invalidateQueries('resumo-transacoes')
      },
      onError: (error: any) => {
        setImportResult({
          error: true,
          message: error.response?.data?.detail || 'Erro ao processar arquivo'
        })
      }
    }
  )

  const handleDownloadTemplate = async () => {
    try {
      await transacoesApi.downloadTemplate()
    } catch (error) {
      console.error('Erro ao baixar template:', error)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setImportFile(file)
      setImportResult(null)
    }
  }

  const handleImportExcel = () => {
    if (importFile) {
      importExcelMutation.mutate(importFile)
    }
  }

  return (
    <div className="min-h-screen-mobile bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Navigation user={user} />

      {/* 🎉 NOVO: Mensagens de Feedback */}
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

      <div className="container-mobile pb-safe">
        {/* Page Header */}
        <div className="py-6 lg:py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-responsive-heading text-slate-900">Transações</h1>
                <p className="text-slate-600 text-sm sm:text-base">Gerencie todas as suas movimentações financeiras</p>
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
                onClick={() => setShowModal(true)}
                className="btn-touch bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl space-x-2 touch-manipulation"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Nova Transação</span>
              </button>
            </div>
          </div>
        </div>

        {/* Info Box */}
        {showInfo && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-4 sm:p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                  <Info className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-responsive-subheading text-slate-800 mb-3">
                    Como funciona o fluxo financeiro?
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 flex-shrink-0" />
                        <span className="font-medium text-slate-700 text-sm sm:text-base">Cartão de Crédito</span>
                      </div>
                      <ul className="text-xs sm:text-sm text-slate-600 space-y-1 ml-6 sm:ml-7">
                        <li>• Compras não descontam imediatamente da conta</li>
                        <li>• Ficam como "futuro" até a data de vencimento</li>
                        <li>• Na fatura, é debitado da conta vinculada</li>
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                        <span className="font-medium text-slate-700 text-sm sm:text-base">Conta Corrente</span>
                      </div>
                      <ul className="text-xs sm:text-sm text-slate-600 space-y-1 ml-6 sm:ml-7">
                        <li>• Pagamentos à vista descontam imediatamente</li>
                        <li>• Saldo atualizado em tempo real</li>
                        <li>• Inclui recebimentos e pagamentos diretos</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="text-slate-400 hover:text-slate-600 p-1 touch-manipulation flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Resumo */}
        {resumo && (
          <div className="grid-responsive mb-8">
            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600">Entradas</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">
                    {formatCurrency(resumo.total_entradas)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {resumo.total_entradas > 0 ? 'Receitas do período' : 'Nenhuma entrada'}
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
                  <p className="text-xs sm:text-sm font-medium text-slate-600">Saídas</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600">
                    {formatCurrency(resumo.total_saidas)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {resumo.total_saidas > 0 ? 'Gastos do período' : 'Nenhuma saída'}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600">Saldo</p>
                  <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${resumo.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {formatCurrency(resumo.saldo)}
                  </p>
                  <p className={`text-xs sm:text-sm mt-1 ${
                    resumo.total_transacoes === 0 
                      ? 'text-slate-500' 
                      : resumo.saldo >= 0 
                        ? 'text-blue-600' 
                        : 'text-orange-600'
                  }`}>
                    {resumo.total_transacoes === 0 
                      ? 'Sem movimentação' 
                      : resumo.saldo >= 0 
                        ? 'Saldo positivo' 
                        : 'Saldo negativo'
                    }
                  </p>
                </div>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  resumo.total_transacoes === 0 
                    ? 'bg-slate-50' 
                    : resumo.saldo >= 0 
                      ? 'bg-blue-50' 
                      : 'bg-orange-50'
                }`}>
                  <DollarSign className={`w-5 h-5 sm:w-6 sm:h-6 ${
                    resumo.total_transacoes === 0 
                      ? 'text-slate-400' 
                      : resumo.saldo >= 0 
                        ? 'text-blue-600' 
                        : 'text-orange-600'
                  }`} />
                </div>
              </div>
            </div>

            <div className="card-mobile hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-600">Transações</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900">
                    {resumo.total_transacoes}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {resumo.total_transacoes === 0 
                      ? 'Nenhuma transação' 
                      : resumo.total_transacoes === 1 
                        ? '1 movimentação' 
                        : `${resumo.total_transacoes} movimentações`
                    }
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
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
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={filtros.busca || ''}
                    onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
                    placeholder="Descrição ou observação..."
                    className="pl-10 w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo
                </label>
                <select
                  value={filtros.tipo || ''}
                  onChange={(e) => setFiltros(prev => ({ ...prev, tipo: e.target.value as 'ENTRADA' | 'SAIDA' || undefined }))}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                >
                  <option value="">Todos</option>
                  <option value="ENTRADA">Entrada</option>
                  <option value="SAIDA">Saída</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Categoria
                </label>
                <select
                  value={filtros.categoria_id || ''}
                  onChange={(e) => setFiltros(prev => ({ ...prev, categoria_id: e.target.value ? parseInt(e.target.value) : undefined }))}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                >
                  <option value="">Todas</option>
                  {categorias.map(categoria => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.icone} {categoria.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Conta/Cartão
                </label>
                <select
                  value={filtros.conta_id || filtros.cartao_id ? `conta_${filtros.conta_id || ''}` || `cartao_${filtros.cartao_id || ''}` : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.startsWith('conta_')) {
                      const contaId = value.replace('conta_', '');
                      setFiltros(prev => ({ ...prev, conta_id: contaId ? parseInt(contaId) : undefined, cartao_id: undefined }));
                    } else if (value.startsWith('cartao_')) {
                      const cartaoId = value.replace('cartao_', '');
                      setFiltros(prev => ({ ...prev, cartao_id: cartaoId ? parseInt(cartaoId) : undefined, conta_id: undefined }));
                    } else {
                      setFiltros(prev => ({ ...prev, conta_id: undefined, cartao_id: undefined }));
                    }
                  }}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                >
                  <option value="">Todos</option>
                  <optgroup label="Contas">
                    {contas.map(conta => (
                      <option key={`conta_${conta.id}`} value={`conta_${conta.id}`}>
                        {conta.nome} - {conta.banco}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Cartões">
                    {cartoes.map(cartao => (
                      <option key={`cartao_${cartao.id}`} value={`cartao_${cartao.id}`}>
                        {cartao.nome} - {cartao.bandeira}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Data Início
                </label>
                <input
                  type="date"
                  value={filtros.data_inicio || ''}
                  onChange={(e) => setFiltros(prev => ({ ...prev, data_inicio: e.target.value || undefined }))}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={filtros.data_fim || ''}
                  onChange={(e) => setFiltros(prev => ({ ...prev, data_fim: e.target.value || undefined }))}
                  className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-2 flex items-end gap-2">
                <button
                  onClick={() => setFiltros({})}
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
            <h2 className="text-lg font-semibold text-slate-900">Movimentações</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-slate-600">Carregando transações...</p>
            </div>
          ) : transacoes.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Info className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-medium mb-2">Nenhuma transação encontrada</h3>
              <p>Comece criando sua primeira movimentação financeira.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {transacoes.map((transacao) => (
                <div key={transacao.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors">
                  {/* Layout Mobile */}
                  <div className="block sm:hidden">
                    <div className="flex items-start space-x-3">
                      <div 
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                          transacao.tipo === 'ENTRADA' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      >
                        <span className="text-sm">
                          {transacao.categoria?.icone || (transacao.tipo === 'ENTRADA' ? '💰' : '💸')}
                        </span>
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {transacao.descricao}
                              </p>
                              {/* NOVO: Indicador de parcelamento */}
                              {transacao.is_parcelada && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  📅 {transacao.numero_parcela}/{transacao.total_parcelas}
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
                                {transacao.categoria?.nome}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <p className={`text-lg font-semibold ${
                              transacao.tipo === 'ENTRADA' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transacao.tipo === 'ENTRADA' ? '+' : '-'}{formatCurrency(transacao.valor)}
                            </p>
                            {/* NOVO: Indicador de parcela */}
                            {transacao.is_parcelada && (
                              <p className="text-xs text-purple-600 font-medium">
                                Parcela {transacao.numero_parcela}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center space-x-2 text-xs text-slate-500">
                            {transacao.conta && (
                              <span>{transacao.conta.nome}</span>
                            )}
                            {transacao.cartao && (
                              <span>{transacao.cartao.nome}</span>
                            )}
                            <span>•</span>
                            <span>{formatDate(transacao.data)}</span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            {/* Botões para transações simples */}
                            {!transacao.is_parcelada && (
                              <>
                                <button
                                  onClick={() => handleEdit(transacao)}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
                                  title="Editar transação"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                
                                <button
                                  onClick={() => handleDelete(transacao.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-manipulation"
                                  title="Excluir transação"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {/* NOVO: Botões para transações parceladas */}
                            {transacao.is_parcelada && (
                              <>
                                <button
                                  onClick={() => handleEditParcelamento(transacao)}
                                  className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors touch-manipulation"
                                  title="Ver detalhes do parcelamento"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                
                                <button
                                  onClick={() => handleEditParcelamento(transacao)}
                                  className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors touch-manipulation"
                                  title="Editar parcelamento"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                
                                <button
                                  onClick={() => handleDeleteParcelamento(transacao)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-manipulation"
                                  title="Excluir parcelamento completo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {transacao.observacoes && (
                          <div className="mt-2">
                            <p className="text-sm text-slate-600 italic">
                              "{transacao.observacoes}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Layout Desktop */}
                  <div className="hidden sm:block">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div 
                          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                            transacao.tipo === 'ENTRADA' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        >
                          {transacao.categoria?.icone || (transacao.tipo === 'ENTRADA' ? '💰' : '💸')}
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
                            {/* NOVO: Indicador de parcelamento */}
                            {transacao.is_parcelada && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                📅 Parcela {transacao.numero_parcela}/{transacao.total_parcelas}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-sm text-slate-500">
                              {transacao.categoria?.nome}
                            </p>
                            
                            {transacao.conta && (
                              <p className="text-sm text-slate-500">
                                {transacao.conta.nome}
                              </p>
                            )}
                            
                            {transacao.cartao && (
                              <p className="text-sm text-slate-500">
                                {transacao.cartao.nome}
                              </p>
                            )}
                            
                            <p className="text-sm text-slate-500">
                              {formatDate(transacao.data)}
                            </p>
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
                          {/* NOVO: Indicador de valor parcelado */}
                          {transacao.is_parcelada && (
                            <p className="text-xs text-purple-600 font-medium">
                              Parcela {transacao.numero_parcela} de {transacao.total_parcelas}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* Botões para transações simples */}
                          {!transacao.is_parcelada && (
                            <>
                              <button
                                onClick={() => handleEdit(transacao)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
                                title="Editar transação"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleDelete(transacao.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-manipulation"
                                title="Excluir transação"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* NOVO: Botões para transações parceladas */}
                          {transacao.is_parcelada && (
                            <>
                              <button
                                onClick={() => handleEditParcelamento(transacao)}
                                className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors touch-manipulation"
                                title="Ver detalhes do parcelamento"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleEditParcelamento(transacao)}
                                className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors touch-manipulation"
                                title="Editar parcelamento"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleDeleteParcelamento(transacao)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-manipulation"
                                title="Excluir parcelamento completo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {transacao.observacoes && (
                      <div className="mt-3 pl-14">
                        <p className="text-sm text-slate-600 italic">
                          "{transacao.observacoes}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {hasMore && (
                <div className="p-6 text-center">
                  <button
                    onClick={() => loadTransacoes()}
                    className="btn-touch bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Carregar Mais
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botões de ação superiores - adicionar botão de importação */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={() => setShowModal(true)}
            className="btn-touch bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <span className="text-lg">+</span>
            Nova Transação
          </button>
          
          {/* NOVO: Botão de Importação Excel */}
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-touch bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2"
          >
            <CloudArrowUpIcon className="h-5 w-5" />
            Importar Excel
          </button>
        </div>

        {/* Modal de Criação/Edição */}
        {showModal && (
          <div className="modal-mobile">
            <div className="modal-content-mobile">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <h2 className="text-responsive-subheading text-slate-900">
                  {editingTransacao ? 'Editar Transação' : isParcelado ? 'Nova Compra Parcelada' : 'Nova Transação'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* NOVO: Toggle entre Transação e Parcelamento */}
                {!editingTransacao && (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Tipo de Lançamento
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="tipoLancamento"
                          checked={!isParcelado}
                          onChange={() => setIsParcelado(false)}
                          className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-slate-700">Transação Simples</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="tipoLancamento"
                          checked={isParcelado}
                          onChange={() => setIsParcelado(true)}
                          className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-slate-700">Compra Parcelada</span>
                      </label>
                    </div>
                    {isParcelado && (
                      <p className="text-xs text-blue-600 mt-2">
                        💳 Compras parceladas só podem ser feitas no cartão e geram transações automáticas a cada mês
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Descrição *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder={isParcelado ? "Ex: iPhone 15 Pro" : "Ex: Compra no supermercado"}
                      className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {isParcelado ? 'Valor Total *' : 'Valor *'}
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                      placeholder="0,00"
                      className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                    />
                    {isParcelado && formData.valor && formParcelamento.total_parcelas > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        {formParcelamento.total_parcelas}x de R$ {(parseFloat(formData.valor) / formParcelamento.total_parcelas).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Campos específicos para parcelamento */}
                  {isParcelado && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Número de Parcelas *
                        </label>
                        <select
                          required
                          value={formParcelamento.total_parcelas}
                          onChange={(e) => setFormParcelamento({ ...formParcelamento, total_parcelas: parseInt(e.target.value) })}
                          className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                        >
                          {Array.from({ length: 24 }, (_, i) => i + 2).map(num => (
                            <option key={num} value={num}>{num}x parcelas</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Data da Primeira Parcela *
                        </label>
                        <input
                          type="date"
                          required
                          value={formParcelamento.data_primeira_parcela}
                          onChange={(e) => setFormParcelamento({ ...formParcelamento, data_primeira_parcela: e.target.value })}
                          className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                        />
                      </div>
                    </>
                  )}

                  {!isParcelado && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Tipo *
                      </label>
                      <select
                        required
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'ENTRADA' | 'SAIDA' })}
                        className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                      >
                        <option value="SAIDA">Saída</option>
                        <option value="ENTRADA">Entrada</option>
                      </select>
                    </div>
                  )}

                  {!isParcelado && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Data *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.data}
                        onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                        className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Categoria *
                    </label>
                    <select
                      required
                      value={formData.categoria_id}
                      onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
                      className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                    >
                      <option value="">Selecione uma categoria</option>
                      {categorias.map(categoria => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.icone} {categoria.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!isParcelado && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Conta
                      </label>
                      <select
                        value={formData.conta_id}
                        onChange={(e) => {
                          setFormData({ 
                            ...formData, 
                            conta_id: e.target.value,
                            cartao_id: '' // Clear cartão when conta is selected
                          });
                        }}
                        className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                      >
                        <option value="">Selecione uma conta</option>
                        {contas.map(conta => (
                          <option key={conta.id} value={conta.id}>
                            {conta.nome} - {conta.banco}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {isParcelado ? 'Cartão *' : 'Cartão'}
                    </label>
                    <select
                      required={isParcelado}
                      value={formData.cartao_id}
                      onChange={(e) => {
                        setFormData({ 
                          ...formData, 
                          cartao_id: e.target.value,
                          conta_id: isParcelado ? '' : formData.conta_id // Clear conta when cartão is selected (only for simple transactions)
                        });
                      }}
                      className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                    >
                      <option value="">Selecione um cartão</option>
                      {cartoes.map(cartao => (
                        <option key={cartao.id} value={cartao.id}>
                          {cartao.nome} - {cartao.bandeira}
                        </option>
                      ))}
                    </select>
                    {isParcelado && (
                      <p className="text-xs text-slate-500 mt-1">
                        Compras parceladas são sempre no cartão de crédito
                      </p>
                    )}
                  </div>
                </div>

                {!isParcelado && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Observações
                    </label>
                    <textarea
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      placeholder="Informações adicionais sobre a transação..."
                      rows={3}
                      className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation text-sm sm:text-base"
                    />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingTransacao(null);
                      resetForm();
                    }}
                    className="btn-touch border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors order-2 sm:order-1"
                  >
                    Cancelar
                  </button>
                  
                  <button
                    type="submit"
                    className="btn-touch bg-gradient-to-r from-blue-600 to-purple-600 border border-transparent text-white hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 order-1 sm:order-2"
                  >
                    {editingTransacao ? 'Atualizar' : isParcelado ? 'Criar Parcelamento' : 'Criar'} 
                    {editingTransacao ? ' Transação' : ''}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* NOVO: Modal de Importação Excel */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">📊 Importação em Lote via Excel</h2>
                  <button
                    onClick={() => {
                      setShowImportModal(false)
                      setImportFile(null)
                      setImportResult(null)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Passo 1: Download do Template */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3">📋 Passo 1: Baixar Template</h3>
                  <p className="text-blue-700 mb-4">
                    Baixe o template Excel com exemplos e instruções. O arquivo já vem com suas categorias, cartões e contas.
                  </p>
                  <button
                    onClick={handleDownloadTemplate}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <DocumentArrowDownIcon className="h-5 w-5" />
                    Baixar Template
                  </button>
                </div>

                {/* Passo 2: Upload do Arquivo */}
                <div className="bg-green-50 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-green-900 mb-3">📤 Passo 2: Upload do Arquivo</h3>
                  <p className="text-green-700 mb-4">
                    Preencha o template com suas transações e faça o upload. Campos vazios serão preenchidos automaticamente via IA.
                  </p>
                  
                  <div className="space-y-4">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    
                    {importFile && (
                      <div className="flex items-center gap-2 text-green-700">
                        <span>📁 {importFile.name}</span>
                        <span className="text-sm text-gray-500">({(importFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    )}
                    
                    <button
                      onClick={handleImportExcel}
                      disabled={!importFile || importExcelMutation.isLoading}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {importExcelMutation.isLoading ? 'Processando...' : 'Importar Transações'}
                    </button>
                  </div>
                </div>

                {/* Resultado da Importação */}
                {importResult && (
                  <div className={`rounded-xl p-4 ${importResult.error ? 'bg-red-50' : 'bg-green-50'}`}>
                    <h3 className={`text-lg font-semibold mb-3 ${importResult.error ? 'text-red-900' : 'text-green-900'}`}>
                      {importResult.error ? '❌ Erro na Importação' : '✅ Importação Concluída'}
                    </h3>
                    
                    {importResult.error ? (
                      <p className="text-red-700">{importResult.message}</p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-green-700 font-medium">{importResult.message}</p>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="bg-white rounded-lg p-3">
                            <span className="text-gray-600">Transações criadas:</span>
                            <div className="text-lg font-bold text-green-600">{importResult.transacoes_criadas}</div>
                          </div>
                          <div className="bg-white rounded-lg p-3">
                            <span className="text-gray-600">Erros encontrados:</span>
                            <div className="text-lg font-bold text-red-600">{importResult.transacoes_com_erro}</div>
                          </div>
                        </div>

                        {/* Detalhes dos sucessos */}
                        {importResult.detalhes?.sucessos?.length > 0 && (
                          <div className="bg-white rounded-lg p-3">
                            <h4 className="font-semibold text-green-800 mb-2">✅ Transações Criadas:</h4>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                              {importResult.detalhes.sucessos.slice(0, 5).map((sucesso: any, index: number) => (
                                <div key={index} className="text-xs text-gray-600">
                                  Linha {sucesso.linha}: {sucesso.descricao} - R$ {sucesso.valor} ({sucesso.categoria})
                                </div>
                              ))}
                              {importResult.detalhes.sucessos.length > 5 && (
                                <div className="text-xs text-gray-500">... e mais {importResult.detalhes.sucessos.length - 5} transações</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Detalhes dos erros */}
                        {importResult.detalhes?.erros?.length > 0 && (
                          <div className="bg-white rounded-lg p-3">
                            <h4 className="font-semibold text-red-800 mb-2">❌ Erros Encontrados:</h4>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                              {importResult.detalhes.erros.map((erro: any, index: number) => (
                                <div key={index} className="text-xs text-red-600">
                                  Linha {erro.linha}: {erro.erro}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Informações Importantes */}
                <div className="bg-yellow-50 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-yellow-900 mb-3">💡 Informações Importantes</h3>
                  <ul className="text-yellow-700 text-sm space-y-1">
                    <li>• <strong>Descrição:</strong> Se vazia, será criada automaticamente</li>
                    <li>• <strong>Categoria:</strong> Se vazia, será sugerida pela IA baseada na descrição</li>
                    <li>• <strong>Cartão:</strong> Use o nome exato do seus cartões ou deixe vazio</li>
                    <li>• <strong>Data:</strong> Formato YYYY-MM-DD (ex: 2024-01-15)</li>
                    <li>• <strong>Tipo:</strong> ENTRADA ou SAIDA (obrigatório)</li>
                    <li>• <strong>Valor:</strong> Número decimal (ex: 45.50)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transacoes; 