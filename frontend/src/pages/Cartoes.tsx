import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { cartoesApi, categoriasApi, parcelasApi } from '../services/api';
import { CreditCard, Calendar, TrendingUp, CheckCircle, Clock, AlertCircle, Plus, Eye, Play } from 'lucide-react';
import { useExcelExport } from '../hooks/useExcelExport';

interface FaturaInfo {
  valor_atual: number;
  valor_total_mes: number;
  dias_para_vencimento: number | null;
  data_vencimento: string | null;
  percentual_limite_usado: number;
}

interface Cartao {
  id: number;
  nome: string;
  bandeira: string;
  numero_final?: string;
  limite: number;
  vencimento: number;
  dia_fechamento?: number; // Novo campo para dia de fechamento
  cor: string;
  ativo: boolean;
  fatura?: FaturaInfo;
}

interface CompraParcelada {
  id: number;
  descricao: string;
  valor_total: number;
  valor_parcela: number;
  total_parcelas: number;
  parcelas_pagas: number;
  parcelas_pendentes: number;
  valor_pago: number;
  valor_pendente: number;
  ativa: boolean;
  categoria_id?: number;
  cartao: {
    id: number;
    nome: string;
    cor: string;
  };
  proxima_parcela?: {
    numero_parcela: number;
    data_vencimento: string;
    valor: number;
  };
  created_at: string;
}

interface Categoria {
  id: number;
  nome: string;
  icone: string;
  cor: string;
}

// Funções utilitárias para formatação
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('pt-BR');
};

export default function Cartoes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [comprasParceladas, setComprasParceladas] = useState<CompraParcelada[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCartao, setEditingCartao] = useState<Cartao | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'parcelas'>('overview');
  const [filtroCartaoParcelamento, setFiltroCartaoParcelamento] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingParcelamentos, setLoadingParcelamentos] = useState(false);
  
  // NOVO: Estado para destacar parcelamento específico
  const [highlightParcelamento, setHighlightParcelamento] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    bandeira: 'Visa',
    numero_final: '',
    limite: 0,
    vencimento: 1,
    dia_fechamento: 25, // Default: 25 do mês
    cor: '#1E40AF',
    ativo: true
  });

  // Estados para feedback
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // NOVO: Estados para modais
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedParcelamento, setSelectedParcelamento] = useState<CompraParcelada | null>(null);
  const [parcelamentoDetails, setParcelamentoDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // NOVO: Estados para edição
  const [editFormData, setEditFormData] = useState({
    descricao: '',
    categoria_id: 0
  });
  const [loadingEdit, setLoadingEdit] = useState(false);

  // Hook para exportação Excel
  const { exportCartoes } = useExcelExport();

  // NOVO: Detectar parâmetros da URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    const highlight = searchParams.get('highlight');
    
    if (tab === 'parcelas') {
      setActiveTab('parcelas');
    }
    
    if (highlight) {
      setHighlightParcelamento(parseInt(highlight));
      // Remover highlight após 5 segundos
      setTimeout(() => setHighlightParcelamento(null), 5000);
    }
  }, [searchParams]);

  // Limpar mensagens após alguns segundos
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 6000);
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

  // Carregar cartões do backend
  useEffect(() => {
    loadCartoes();
    loadCategorias(); // Carregar categorias sempre
    if (activeTab === 'parcelas') {
      loadParcelamentos();
    }
  }, [activeTab]);

  const loadCartoes = async () => {
    try {
      setIsLoading(true);
      const data = await cartoesApi.getAllComFatura(); // Usar nova API com fatura
      setCartoes(data);
    } catch (error: any) {
      setError('Erro ao carregar cartões');
      console.error('Erro ao carregar cartões:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadParcelamentos = async () => {
    try {
      setLoadingParcelamentos(true);
      const data = await parcelasApi.getAll(true, filtroCartaoParcelamento ? parseInt(filtroCartaoParcelamento) : undefined);
      setComprasParceladas(data);
    } catch (error: any) {
      console.error('❌ Erro ao carregar parcelamentos:', error);
      setError('Erro ao carregar parcelamentos');
    } finally {
      setLoadingParcelamentos(false);
    }
  };

  const loadCategorias = async () => {
    try {
      const data = await categoriasApi.getAll();
      setCategorias(data);
    } catch (error: any) {
      setError('Erro ao carregar categorias');
      console.error('Erro ao carregar categorias:', error);
    }
  };

  // Recarregar parcelamentos quando filtro mudar
  useEffect(() => {
    if (activeTab === 'parcelas') {
      loadParcelamentos();
    }
  }, [filtroCartaoParcelamento]);

  const handleProcessarParcela = async (compraId: number, numeroParcela: number) => {
    try {
      await parcelasApi.processarParcela(compraId, numeroParcela);
      loadParcelamentos(); // Recarregar lista
    } catch (err: any) {
      setError(err.message);
    }
  };

  // NOVO: Quitar parcelamento antecipadamente
  const handleQuitarAntecipado = async (parcelamento: CompraParcelada) => {
    const valorRestante = parcelamento.valor_pendente;
    const parcelasRestantes = parcelamento.parcelas_pendentes;
    
    const confirmacao = confirm(
      `💰 QUITAÇÃO ANTECIPADA\n\n` +
      `📦 ${parcelamento.descricao}\n` +
      `💳 ${parcelamento.cartao.nome}\n` +
      `📊 ${parcelasRestantes} parcelas restantes\n` +
      `💰 Valor: ${formatCurrency(valorRestante)}\n\n` +
      `⚠️  O valor será debitado automaticamente da conta vinculada ao cartão.\n\n` +
      `Confirma a quitação antecipada?`
    );

    if (!confirmacao) return;

    try {
      setLoadingParcelamentos(true);
      const result = await parcelasApi.quitarAntecipado(parcelamento.id);
      
      setSuccessMessage(
        `✅ Parcelamento quitado com sucesso!\n` +
        `💰 ${formatCurrency(result.valor_quitacao)} debitado da conta\n` +
        `📊 ${result.parcelas_quitadas} parcelas quitadas`
      );
      
      await loadParcelamentos(); // Recarregar lista
    } catch (err: any) {
      console.error('Erro ao quitar parcelamento:', err);
      setErrorMessage(
        `❌ Erro ao quitar parcelamento:\n${err.response?.data?.detail || err.message}`
      );
    } finally {
      setLoadingParcelamentos(false);
    }
  };

  // NOVO: Excluir parcelamento
  const handleExcluirParcelamento = async (parcelamento: CompraParcelada) => {
    const confirmacao = confirm(
      `🗑️  EXCLUIR PARCELAMENTO\n\n` +
      `📦 ${parcelamento.descricao}\n` +
      `💳 ${parcelamento.cartao.nome}\n` +
      `📊 ${parcelamento.parcelas_pagas}/${parcelamento.total_parcelas} parcelas processadas\n\n` +
      `⚠️  Esta ação não pode ser desfeita!\n` +
      `${parcelamento.parcelas_pagas > 0 ? '❌ Atenção: Há parcelas já processadas.' : '✅ Nenhuma parcela foi processada ainda.'}\n\n` +
      `Confirma a exclusão?`
    );

    if (!confirmacao) return;

    try {
      setLoadingParcelamentos(true);
      const result = await parcelasApi.delete(parcelamento.id);
      
      setSuccessMessage(
        `✅ Parcelamento excluído com sucesso!\n` +
        `📦 ${parcelamento.descricao} foi removido\n` +
        `🗑️ ${result.detalhes?.parcelas_excluidas || 0} parcelas excluídas\n` +
        `📄 ${result.detalhes?.transacoes_excluidas || 0} transações removidas`
      );
      
      await loadParcelamentos(); // Recarregar lista
    } catch (err: any) {
      console.error('Erro ao excluir parcelamento:', err);
      setErrorMessage(
        `❌ Erro ao excluir parcelamento:\n${err.response?.data?.detail || err.message}`
      );
    } finally {
      setLoadingParcelamentos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCartao) {
        await cartoesApi.update(editingCartao.id, formData);
      } else {
        await cartoesApi.create(formData);
      }
      
      await loadCartoes(); // Recarregar dados
      setShowModal(false);
      setEditingCartao(null);
      setFormData({
        nome: '',
        bandeira: 'Visa',
        numero_final: '',
        limite: 0,
        vencimento: 1,
        dia_fechamento: 25,
        cor: '#1E40AF',
        ativo: true
      });
    } catch (error: any) {
      setError('Erro ao salvar cartão');
      console.error('Erro ao salvar cartão:', error);
    }
  };

  const handleEdit = (cartao: Cartao) => {
    setEditingCartao(cartao);
    setFormData({
      nome: cartao.nome,
      bandeira: cartao.bandeira,
      numero_final: cartao.numero_final || '',
      limite: cartao.limite,
      vencimento: cartao.vencimento,
      dia_fechamento: cartao.dia_fechamento || 25,
      cor: cartao.cor,
      ativo: cartao.ativo
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este cartão?')) {
      try {
        await cartoesApi.delete(id);
        await loadCartoes(); // Recarregar dados
      } catch (error: any) {
        setError('Erro ao excluir cartão');
        console.error('Erro ao excluir cartão:', error);
      }
    }
  };

  const openCreateModal = () => {
    setEditingCartao(null);
    setFormData({
      nome: '',
      bandeira: 'Visa',
      numero_final: '',
      limite: 0,
      vencimento: 1,
      dia_fechamento: 25,
      cor: '#1E40AF',
      ativo: true
    });
    setShowModal(true);
  };

  // NOVO: Função para exportar cartões para Excel
  const handleExportExcel = async () => {
    try {
      if (cartoes.length === 0) {
        setErrorMessage('❌ Nenhum cartão para exportar');
        return;
      }

      // Enriquecer dados com informações da fatura
      const cartoesComFatura = cartoes.map(cartao => ({
        ...cartao,
        fatura_atual: cartao.fatura?.valor_atual || 0,
        limite_disponivel: cartao.limite - (cartao.fatura?.valor_atual || 0),
        percentual_usado: cartao.limite > 0 ? 
          ((cartao.fatura?.valor_atual || 0) / cartao.limite * 100).toFixed(1) : 0,
        dias_vencimento: cartao.fatura?.dias_para_vencimento || 'N/A',
        data_vencimento: cartao.fatura?.data_vencimento || 'N/A'
      }));

      const sucesso = exportCartoes(cartoesComFatura);
      
      if (sucesso) {
        setSuccessMessage(`✅ Excel exportado com sucesso!\n💳 ${cartoes.length} cartões exportados`);
      } else {
        setErrorMessage('❌ Erro ao exportar Excel');
      }
    } catch (error) {
      console.error('Erro na exportação:', error);
      setErrorMessage('❌ Erro ao exportar Excel');
    }
  };

  // NOVO: Adiantar apenas a próxima parcela
  const handleAdiantarProxima = async (parcelamento: CompraParcelada) => {
    const proximaParcela = parcelamento.parcelas_pendentes > 0 ? 
      (parcelamento.parcelas_pagas + 1) : null;
    
    if (!proximaParcela) {
      setErrorMessage('❌ Não há parcelas pendentes para adiantar');
      return;
    }

    const confirmacao = confirm(
      `⏩ ADIANTAR PRÓXIMA PARCELA\n\n` +
      `📦 ${parcelamento.descricao}\n` +
      `💳 ${parcelamento.cartao.nome}\n` +
      `📊 Parcela ${proximaParcela}/${parcelamento.total_parcelas}\n` +
      `💰 Valor: ${formatCurrency(parcelamento.valor_total / parcelamento.total_parcelas)}\n\n` +
      `⚠️  O valor será debitado automaticamente da conta vinculada ao cartão.\n\n` +
      `Confirma o adiantamento desta parcela?`
    );

    if (!confirmacao) return;

    try {
      setLoadingParcelamentos(true);
      const result = await parcelasApi.adiantarProxima(parcelamento.id);
      
      setSuccessMessage(
        `✅ Parcela adiantada com sucesso!\n` +
        `📊 Parcela ${result.parcela_numero}/${parcelamento.total_parcelas}\n` +
        `💰 ${formatCurrency(result.valor_parcela)} debitado da conta\n` +
        `📋 ${result.parcelas_restantes} parcelas restantes`
      );
      
      await loadParcelamentos();
    } catch (err: any) {
      console.error('Erro ao adiantar parcela:', err);
      setErrorMessage(
        `❌ Erro ao adiantar parcela:\n${err.response?.data?.detail || err.message}`
      );
    } finally {
      setLoadingParcelamentos(false);
    }
  };

  // NOVO: Ver detalhes completos do parcelamento
  const handleVerDetalhes = async (parcelamento: CompraParcelada) => {
    try {
      setLoadingDetails(true);
      setSelectedParcelamento(parcelamento);
      setShowDetailsModal(true);
      
      const details = await parcelasApi.getDetalhes(parcelamento.id);
      setParcelamentoDetails(details);
    } catch (err: any) {
      console.error('Erro ao carregar detalhes:', err);
      setErrorMessage(
        `❌ Erro ao carregar detalhes:\n${err.response?.data?.detail || err.message}`
      );
      setShowDetailsModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // NOVO: Editar parcelamento
  const handleEditarParcelamento = (parcelamento: CompraParcelada) => {
    setSelectedParcelamento(parcelamento);
    setEditFormData({
      descricao: parcelamento.descricao,
      categoria_id: parcelamento.categoria_id || 0
    });
    setShowEditModal(true);
  };

  // NOVO: Salvar edição do parcelamento
  const handleSalvarEdicao = async () => {
    if (!selectedParcelamento) return;

    if (!editFormData.descricao.trim()) {
      setErrorMessage('❌ Descrição é obrigatória');
      return;
    }

    if (!editFormData.categoria_id) {
      setErrorMessage('❌ Categoria é obrigatória');
      return;
    }

    try {
      setLoadingEdit(true);
      
      await parcelasApi.update(selectedParcelamento.id, {
        descricao: editFormData.descricao.trim(),
        categoria_id: editFormData.categoria_id
      });

      setSuccessMessage(
        `✅ Parcelamento editado com sucesso!\n` +
        `📦 ${editFormData.descricao}\n` +
        `📁 Categoria atualizada`
      );

      setShowEditModal(false);
      setSelectedParcelamento(null);
      await loadParcelamentos();
    } catch (err: any) {
      console.error('Erro ao salvar edição:', err);
      setErrorMessage(
        `❌ Erro ao salvar alterações:\n${err.response?.data?.detail || err.message}`
      );
    } finally {
      setLoadingEdit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Navigation user={user} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-gray-400">Carregando cartões...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalLimite = cartoes.reduce((sum, cartao) => sum + cartao.limite, 0);
  const totalFaturaAtual = cartoes.reduce((sum, cartao) => sum + (cartao.fatura?.valor_atual || 0), 0);
  const limiteDisponivel = totalLimite - totalFaturaAtual;
  const percentualDisponivel = totalLimite > 0 ? Math.floor((limiteDisponivel / totalLimite) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation user={user} />

      {/* 🎉 Mensagens de Feedback */}
      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="whitespace-pre-line text-sm font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="whitespace-pre-line text-sm font-medium">{errorMessage}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-4 mb-4 sm:mb-0">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-violet-500 rounded-2xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Cartões</h1>
                <p className="text-slate-600 dark:text-gray-300">Gerencie seus cartões de crédito</p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              {/* NOVO: Botão de exportação Excel */}
              <button
                onClick={handleExportExcel}
                disabled={cartoes.length === 0}
                className="btn-touch bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl space-x-2 touch-manipulation"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Excel</span>
                <span className="sm:hidden">XLS</span>
              </button>
              
              <button
                onClick={() => setShowModal(true)}
                className="btn-touch bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl space-x-2 touch-manipulation"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Novo Cartão</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200/50 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-gray-400">Total de Cartões</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{cartoes.length}</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">Todos ativos</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200/50 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-gray-400">Limite Total</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">R$ {totalLimite.toLocaleString()}</p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">Aprovado</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200/50 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-gray-400">Disponível</p>
                <p className={`text-3xl font-bold ${limiteDisponivel >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  R$ {limiteDisponivel.toLocaleString()}
                </p>
                <p className={`text-sm mt-1 ${limiteDisponivel >= 0 ? 'text-slate-500 dark:text-gray-400' : 'text-red-500 dark:text-red-400'}`}>
                  {limiteDisponivel >= 0 
                    ? `${percentualDisponivel}% livre` 
                    : `${Math.abs(percentualDisponivel)}% excesso`
                  }
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                limiteDisponivel >= 0 ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'
              }`}>
                {limiteDisponivel >= 0 ? (
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200/50 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-gray-400">Fatura Atual</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">R$ {totalFaturaAtual.toLocaleString()}</p>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                  {cartoes.length > 0 && cartoes[0].fatura?.dias_para_vencimento !== null 
                    ? `Vence em ${cartoes[0].fatura?.dias_para_vencimento} dias`
                    : 'Sem vencimento definido'
                  }
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-1 bg-slate-100/50 dark:bg-gray-800/50 rounded-2xl p-1 w-fit">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ease-in-out transform ${
                activeTab === 'overview'
                  ? 'bg-white dark:bg-gray-700 text-slate-800 dark:text-white shadow-sm border border-slate-200 dark:border-gray-600 scale-105'
                  : 'text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white hover:bg-white/70 dark:hover:bg-gray-700/70 hover:scale-102'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CreditCard className={`w-5 h-5 transition-all duration-300 ${
                  activeTab === 'overview' ? 'text-blue-600' : ''
                }`} />
                <span>Visão Geral</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('parcelas')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ease-in-out transform ${
                activeTab === 'parcelas'
                  ? 'bg-white dark:bg-gray-700 text-slate-800 dark:text-white shadow-sm border border-slate-200 dark:border-gray-600 scale-105'
                  : 'text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white hover:bg-white/70 dark:hover:bg-gray-700/70 hover:scale-102'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Calendar className={`w-5 h-5 transition-all duration-300 ${
                  activeTab === 'parcelas' ? 'text-purple-600' : ''
                }`} />
                <span>Parcelamentos</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className={`transition-all duration-500 ease-in-out ${
          activeTab === 'overview' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 hidden'
        }`}>
          {activeTab === 'overview' && (
            /* Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cartoes.map((cartao) => (
                <div key={cartao.id} className="group relative">
                  {/* Card Physical Design */}
                  <div 
                    className="relative w-full h-48 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:rotate-1 overflow-hidden"
                    style={{ 
                      background: `linear-gradient(135deg, ${cartao.cor} 0%, ${cartao.cor}dd 100%)` 
                    }}
                  >
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute top-4 right-4 w-16 h-16 bg-white rounded-full blur-xl"></div>
                      <div className="absolute bottom-4 left-4 w-24 h-24 bg-white rounded-full blur-2xl"></div>
                    </div>
                    
                    {/* Card Content */}
                    <div className="relative z-10 h-full p-6 flex flex-col justify-between text-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm opacity-90 font-medium">{cartao.bandeira}</p>
                          <h3 className="text-lg font-bold mt-1">{cartao.nome}</h3>
                          {cartao.numero_final && (
                            <p className="text-sm opacity-90 font-mono mt-1">•••• {cartao.numero_final}</p>
                          )}
                        </div>
                        <div className="w-10 h-6 bg-white/20 rounded backdrop-blur-sm border border-white/30 flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-lg font-mono tracking-wider mb-2">{cartao.limite.toLocaleString()}</p>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-xs opacity-75">Limite</p>
                            <p className="text-sm font-semibold">R$ {cartao.limite.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs opacity-75">Disponível</p>
                            <p className={`text-sm font-semibold ${
                              (cartao.limite - (cartao.fatura?.valor_atual || 0)) >= 0 
                                ? 'text-white' 
                                : 'text-red-200'
                            }`}>
                              R$ {(cartao.limite - (cartao.fatura?.valor_atual || 0)).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Info */}
                  <div className="bg-white rounded-xl mt-4 p-4 shadow-sm border border-slate-200/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-600">Utilização</span>
                      <span className={`text-sm font-semibold ${
                        (cartao.fatura?.percentual_limite_usado || 0) > 100 
                          ? 'text-red-600' 
                          : 'text-slate-900'
                      }`}>
                        {cartao.fatura?.percentual_limite_usado.toFixed(1) || 0}%
                      </span>
                    </div>
                    
                    <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                      <div 
                        className={`h-2 rounded-full ${
                          (cartao.fatura?.percentual_limite_usado || 0) > 100
                            ? 'bg-gradient-to-r from-red-400 to-red-500'
                            : (cartao.fatura?.percentual_limite_usado || 0) > 80
                            ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                            : 'bg-gradient-to-r from-green-400 to-green-500'
                        }`}
                        style={{ width: `${Math.min(cartao.fatura?.percentual_limite_usado || 0, 100)}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">
                        Usado: R$ {(cartao.fatura?.valor_atual || 0).toLocaleString()}
                      </span>
                      <span className={`font-medium ${
                        (cartao.fatura?.percentual_limite_usado || 0) > 100
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}>
                        {(cartao.fatura?.percentual_limite_usado || 0) > 100
                          ? `${((cartao.fatura?.percentual_limite_usado || 0) - 100).toFixed(1)}% excesso`
                          : `${(100 - (cartao.fatura?.percentual_limite_usado || 0)).toFixed(1)}% livre`
                        }
                      </span>
                    </div>

                    {(cartao.fatura?.percentual_limite_usado || 0) > 100 && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <p className="text-xs text-red-700 font-medium">
                            Limite excedido
                          </p>
                        </div>
                      </div>
                    )}

                    {cartao.fatura?.dias_para_vencimento !== null && (
                      <div className="mt-3 p-2 bg-orange-50 rounded-lg">
                        <p className="text-xs text-orange-700 font-medium">
                          Fatura vence em {cartao.fatura?.dias_para_vencimento} dias
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button 
                        onClick={() => navigate(`/cartoes/${cartao.id}/fatura`)}
                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-200"
                      >
                        Ver Fatura
                      </button>
                      <button 
                        onClick={() => handleEdit(cartao)}
                        className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-200"
                      >
                        Configurar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Add New Card */}
              <div className="group">
                <div 
                  onClick={openCreateModal}
                  className="relative w-full h-48 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 transition-colors duration-300 flex items-center justify-center bg-slate-50 hover:bg-blue-50 cursor-pointer"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Adicionar Cartão</h3>
                    <p className="text-sm text-slate-500">Cadastre um novo cartão de crédito</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Seção de Parcelamentos com animação */}
        <div className={`transition-all duration-500 ease-in-out ${
          activeTab === 'parcelas' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 hidden'
        }`}>
          {activeTab === 'parcelas' && (
            <div>
              {/* Header da aba de parcelamentos */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Compras Parceladas</h2>
                  <p className="text-slate-600 mt-1">Gerencie suas compras parceladas nos cartões</p>
                </div>
                
                {/* Info box sobre criação de parcelamentos */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 sm:mt-0">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-blue-900">
                      💡 Para criar novos parcelamentos, vá em "Transações" → "Nova Transação" → "Compra Parcelada"
                    </span>
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-slate-200/50">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Filtrar por Cartão</label>
                    <select
                      value={filtroCartaoParcelamento}
                      onChange={(e) => setFiltroCartaoParcelamento(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Todos os cartões</option>
                      {cartoes.map((cartao) => (
                        <option key={cartao.id} value={cartao.id}>
                          {cartao.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Loading State */}
              {loadingParcelamentos ? (
                <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-slate-200/50">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Carregando parcelamentos...</p>
                </div>
              ) : (
                <>
                  {/* Resumo dos Parcelamentos */}
                  {comprasParceladas.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600">Total Parcelado</p>
                            <p className="text-2xl font-bold text-slate-900">
                              {formatCurrency(comprasParceladas.reduce((acc, p) => acc + p.valor_total, 0))}
                            </p>
                          </div>
                          <TrendingUp className="w-8 h-8 text-purple-600" />
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600">Total Pago</p>
                            <p className="text-2xl font-bold text-green-600">
                              {formatCurrency(comprasParceladas.reduce((acc, p) => acc + p.valor_pago, 0))}
                            </p>
                          </div>
                          <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600">Pendente</p>
                            <p className="text-2xl font-bold text-orange-600">
                              {formatCurrency(comprasParceladas.reduce((acc, p) => acc + p.valor_pendente, 0))}
                            </p>
                          </div>
                          <Clock className="w-8 h-8 text-orange-600" />
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600">Compras Ativas</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {comprasParceladas.filter(p => p.ativa).length}
                            </p>
                          </div>
                          <Calendar className="w-8 h-8 text-blue-600" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lista simplificada de Parcelamentos */}
                  {comprasParceladas.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-slate-200/50">
                      <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-xl font-medium text-slate-900 mb-2">Nenhum parcelamento encontrado</h3>
                      <p className="text-slate-600 mb-6">
                        Para criar sua primeira compra parcelada, vá em "Transações" e escolha a opção "Compra Parcelada".
                      </p>
                      <button
                        onClick={() => navigate('/transacoes')}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all inline-flex items-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Ir para Transações
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {comprasParceladas.map((parcelamento) => (
                        <div 
                          key={parcelamento.id} 
                          className={`bg-white rounded-xl p-6 shadow-sm border transition-all duration-200 ${
                            highlightParcelamento === parcelamento.id
                              ? 'border-purple-300 bg-purple-50 shadow-lg animate-pulse'
                              : 'border-slate-200/50 hover:shadow-md'
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-3">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: parcelamento.cartao.cor }}
                                ></div>
                                <h3 className="text-lg font-semibold text-slate-900">{parcelamento.descricao}</h3>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  parcelamento.ativa 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {parcelamento.ativa ? 'Ativa' : 'Inativa'}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-slate-500">Cartão</p>
                                  <p className="font-medium">{parcelamento.cartao.nome}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Valor Total</p>
                                  <p className="font-medium">{formatCurrency(parcelamento.valor_total)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Parcelas</p>
                                  <p className="font-medium">{parcelamento.parcelas_pagas}/{parcelamento.total_parcelas}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Restante</p>
                                  <p className="font-medium text-orange-600">{formatCurrency(parcelamento.valor_pendente)}</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 mt-4 lg:mt-0">
                              {/* Botão Quitar Antecipado */}
                              <button 
                                onClick={() => handleQuitarAntecipado(parcelamento)}
                                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={parcelamento.parcelas_pendentes === 0 || !parcelamento.ativa}
                                title={
                                  !parcelamento.ativa 
                                    ? "Parcelamento já foi quitado" 
                                    : parcelamento.parcelas_pendentes === 0 
                                    ? "Não há parcelas pendentes"
                                    : "Quitar todas as parcelas restantes"
                                }
                              >
                                💰 Quitar Antecipado
                              </button>

                              {/* Menu de Ações */}
                              <div className="relative group">
                                <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition-all">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                                  </svg>
                                </button>
                                
                                {/* Dropdown Menu */}
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                  <div className="py-1">
                                    <button 
                                      onClick={() => handleQuitarAntecipado(parcelamento)}
                                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                                      disabled={parcelamento.parcelas_pendentes === 0}
                                    >
                                      <span className="text-green-600">💰</span>
                                      <span>Quitar Antecipado</span>
                                    </button>
                                    
                                    <button 
                                      onClick={() => handleAdiantarProxima(parcelamento)}
                                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                                      disabled={parcelamento.parcelas_pendentes === 0}
                                    >
                                      <span className="text-blue-600">⏩</span>
                                      <span>Adiantar Próxima</span>
                                    </button>
                                    
                                    <button 
                                      onClick={() => handleVerDetalhes(parcelamento)}
                                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                                    >
                                      <span className="text-purple-600">👁️</span>
                                      <span>Ver Detalhes</span>
                                    </button>
                                    
                                    <div className="border-t border-slate-200 my-1"></div>
                                    
                                    <button 
                                      onClick={() => handleEditarParcelamento(parcelamento)}
                                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                                    >
                                      <span className="text-orange-600">✏️</span>
                                      <span>Editar</span>
                                    </button>
                                    
                                    <button 
                                      onClick={() => handleExcluirParcelamento(parcelamento)}
                                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                                      disabled={parcelamento.parcelas_pagas > 0}
                                      title={
                                        parcelamento.parcelas_pagas > 0 
                                          ? "Não é possível excluir: há parcelas já processadas"
                                          : "Excluir parcelamento"
                                      }
                                    >
                                      <span className="text-red-600">🗑️</span>
                                      <span>Excluir</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingCartao ? 'Editar Cartão' : 'Novo Cartão'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome do Cartão
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Nubank Roxinho"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bandeira
                  </label>
                  <select
                    value={formData.bandeira}
                    onChange={(e) => setFormData({ ...formData, bandeira: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="Elo">Elo</option>
                    <option value="American Express">American Express</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número Final (últimos 4 dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formData.numero_final}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                      setFormData({ ...formData, numero_final: value });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="1234"
                  />
                  <p className="text-xs text-slate-500 mt-1">Apenas os últimos 4 dígitos do cartão</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Limite
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.limite}
                    onChange={(e) => setFormData({ ...formData, limite: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Dia do Fechamento
                    </label>
                    <select
                      value={formData.dia_fechamento}
                      onChange={(e) => setFormData({ ...formData, dia_fechamento: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>
                          Dia {day}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Quando a fatura fecha para compras</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Dia do Vencimento
                    </label>
                    <select
                      value={formData.vencimento}
                      onChange={(e) => setFormData({ ...formData, vencimento: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>
                          Dia {day}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Quando a fatura vence para pagamento</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cor
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={formData.cor}
                      onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                      className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.cor}
                      onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="#1E40AF"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="ativo" className="text-sm font-medium text-slate-700">
                    Cartão ativo
                  </label>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    {editingCartao ? 'Atualizar' : 'Criar'}
                  </button>
                  {editingCartao && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingCartao.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors duration-200"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ver Detalhes do Parcelamento */}
      {showDetailsModal && selectedParcelamento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
                  <span className="text-purple-600">👁️</span>
                  <span>Detalhes do Parcelamento</span>
                </h2>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setParcelamentoDetails(null);
                    setSelectedParcelamento(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-slate-600">Carregando detalhes...</span>
                </div>
              ) : parcelamentoDetails ? (
                <div className="space-y-6">
                  {/* Informações da Compra */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                      <span>📦</span>
                      <span>Informações da Compra</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Descrição</p>
                        <p className="font-medium">{parcelamentoDetails.compra.descricao}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Cartão</p>
                        <p className="font-medium flex items-center space-x-2">
                          <span 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: parcelamentoDetails.compra.cartao.cor }}
                          ></span>
                          <span>{parcelamentoDetails.compra.cartao.nome}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Valor Total</p>
                        <p className="font-medium text-lg text-green-600">
                          {formatCurrency(parcelamentoDetails.compra.valor_total)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Total de Parcelas</p>
                        <p className="font-medium">{parcelamentoDetails.compra.total_parcelas}x</p>
                      </div>
                    </div>
                  </div>

                  {/* Estatísticas */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                      <span>📊</span>
                      <span>Estatísticas</span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {parcelamentoDetails.estatisticas.parcelas_pagas}
                        </p>
                        <p className="text-sm text-slate-600">Pagas</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {parcelamentoDetails.estatisticas.parcelas_pendentes}
                        </p>
                        <p className="text-sm text-slate-600">Pendentes</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {parcelamentoDetails.estatisticas.percentual_pago}%
                        </p>
                        <p className="text-sm text-slate-600">Concluído</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {formatCurrency(parcelamentoDetails.estatisticas.valor_pendente)}
                        </p>
                        <p className="text-sm text-slate-600">Restante</p>
                      </div>
                    </div>
                    
                    {/* Barra de Progresso */}
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-slate-600 mb-1">
                        <span>Progresso</span>
                        <span>{parcelamentoDetails.estatisticas.percentual_pago}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${parcelamentoDetails.estatisticas.percentual_pago}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Parcelas */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                      <span>📋</span>
                      <span>Histórico de Parcelas</span>
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {parcelamentoDetails.parcelas.map((parcela: any, index: number) => (
                        <div 
                          key={index}
                          className={`p-3 rounded-lg border ${
                            parcela.paga 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-orange-50 border-orange-200'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                              <span className={`text-lg ${
                                parcela.paga ? 'text-green-600' : 'text-orange-600'
                              }`}>
                                {parcela.paga ? '✅' : '⏳'}
                              </span>
                              <div>
                                <p className="font-medium">
                                  Parcela {parcela.numero_parcela}/{parcelamentoDetails.compra.total_parcelas}
                                </p>
                                <p className="text-sm text-slate-600">
                                  Vencimento: {new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">
                                {formatCurrency(parcela.valor)}
                              </p>
                              <p className={`text-sm font-medium ${
                                parcela.paga ? 'text-green-600' : 'text-orange-600'
                              }`}>
                                {parcela.status}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Próxima Parcela */}
                  {parcelamentoDetails.estatisticas.proxima_parcela_numero && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-800 mb-2 flex items-center space-x-2">
                        <span>⏰</span>
                        <span>Próxima Parcela</span>
                      </h4>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">
                            Parcela {parcelamentoDetails.estatisticas.proxima_parcela_numero}/{parcelamentoDetails.compra.total_parcelas}
                          </p>
                          <p className="text-sm text-yellow-700">
                            Vencimento: {new Date(parcelamentoDetails.estatisticas.proxima_parcela_vencimento).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-lg">
                            {formatCurrency(parcelamentoDetails.compra.valor_parcela)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-600">Erro ao carregar detalhes</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editar Parcelamento */}
      {showEditModal && selectedParcelamento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
                  <span className="text-orange-600">✏️</span>
                  <span>Editar Parcelamento</span>
                </h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedParcelamento(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Informações da Compra (apenas exibição) */}
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <span 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedParcelamento.cartao.cor }}
                    ></span>
                    <span className="font-medium text-slate-700">{selectedParcelamento.cartao.nome}</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {formatCurrency(selectedParcelamento.valor_total)} em {selectedParcelamento.total_parcelas}x
                  </p>
                </div>

                {/* Campo Descrição */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Descrição *
                  </label>
                  <input
                    type="text"
                    value={editFormData.descricao}
                    onChange={(e) => setEditFormData({
                      ...editFormData,
                      descricao: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Compra na Amazon, Celular novo..."
                    maxLength={200}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {editFormData.descricao.length}/200 caracteres
                  </p>
                </div>

                {/* Campo Categoria */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Categoria *
                  </label>
                  <select
                    value={editFormData.categoria_id}
                    onChange={(e) => setEditFormData({
                      ...editFormData,
                      categoria_id: parseInt(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={0}>Selecione uma categoria...</option>
                    {categorias.map(categoria => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.icone} {categoria.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botões */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedParcelamento(null);
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                    disabled={loadingEdit}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSalvarEdicao}
                    disabled={loadingEdit || !editFormData.descricao.trim() || !editFormData.categoria_id}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                  >
                    {loadingEdit ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <span>💾</span>
                        <span>Salvar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 