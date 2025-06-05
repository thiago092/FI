import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { cartoesApi } from '../services/api';
import CompraParceladaModal from '../components/CompraParceladaModal';
import { CreditCard, Calendar, TrendingUp, CheckCircle, Clock, AlertCircle, Plus, Eye, Play } from 'lucide-react';

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
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [comprasParceladas, setComprasParceladas] = useState<CompraParcelada[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showParcelamentoModal, setShowParcelamentoModal] = useState(false);
  const [editingCartao, setEditingCartao] = useState<Cartao | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'parcelas'>('overview');
  const [filtroCartaoParcelamento, setFiltroCartaoParcelamento] = useState<string>('');
  
  const [formData, setFormData] = useState({
    nome: '',
    bandeira: 'Visa',
    numero_final: '',
    limite: 0,
    vencimento: 1,
    cor: '#1E40AF',
    ativo: true
  });

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
      const response = await fetch(`/api/parcelas?ativas_apenas=true&cartao_id=${filtroCartaoParcelamento}`);
      if (!response.ok) throw new Error('Erro ao carregar parcelamentos');
      const data = await response.json();
      setComprasParceladas(data);
    } catch (error: any) {
      setError('Erro ao carregar parcelamentos');
      console.error('Erro ao carregar parcelamentos:', error);
    }
  };

  const loadCategorias = async () => {
    try {
      const response = await fetch('/api/categorias');
      if (!response.ok) throw new Error('Erro ao carregar categorias');
      const data = await response.json();
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

  const handleCriarParcelamento = async (dados: any) => {
    try {
      const response = await fetch('/api/parcelas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dados),
      });

      if (!response.ok) throw new Error('Erro ao criar parcelamento');

      loadParcelamentos(); // Recarregar lista
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const handleProcessarParcela = async (compraId: number, numeroParc: number) => {
    try {
      const response = await fetch(`/api/parcelas/${compraId}/processar-parcela/${numeroParc}`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Erro ao processar parcela');

      loadParcelamentos(); // Recarregar lista
    } catch (err: any) {
      setError(err.message);
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
      cor: '#1E40AF',
      ativo: true
    });
    setShowModal(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <Navigation user={user} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Carregando cartões...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Navigation user={user} />

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
                <h1 className="text-3xl font-bold text-slate-900">Cartões</h1>
                <p className="text-slate-600">Gerencie seus cartões de crédito</p>
              </div>
            </div>
            
            <button 
              onClick={openCreateModal}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Novo Cartão</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total de Cartões</p>
                <p className="text-3xl font-bold text-slate-900">{cartoes.length}</p>
                <p className="text-sm text-green-600 mt-1">Todos ativos</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Limite Total</p>
                <p className="text-3xl font-bold text-slate-900">R$ {totalLimite.toLocaleString()}</p>
                <p className="text-sm text-blue-600 mt-1">Aprovado</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Disponível</p>
                <p className={`text-3xl font-bold ${limiteDisponivel >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  R$ {limiteDisponivel.toLocaleString()}
                </p>
                <p className={`text-sm mt-1 ${limiteDisponivel >= 0 ? 'text-slate-500' : 'text-red-500'}`}>
                  {limiteDisponivel >= 0 
                    ? `${percentualDisponivel}% livre` 
                    : `${Math.abs(percentualDisponivel)}% excesso`
                  }
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                limiteDisponivel >= 0 ? 'bg-green-50' : 'bg-red-50'
              }`}>
                {limiteDisponivel >= 0 ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Fatura Atual</p>
                <p className="text-3xl font-bold text-orange-600">R$ {totalFaturaAtual.toLocaleString()}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {cartoes.length > 0 && cartoes[0].fatura?.dias_para_vencimento !== null 
                    ? `Vence em ${cartoes[0].fatura?.dias_para_vencimento} dias`
                    : 'Sem vencimento definido'
                  }
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-1 bg-slate-100/50 rounded-2xl p-1 w-fit">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white/70'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5" />
                <span>Visão Geral</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('parcelas')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                activeTab === 'parcelas'
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white/70'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Parcelamentos</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' ? (
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
                    <button className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-200">
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
        ) : (
          /* Parcelamentos Section */
          <div>
            {/* Header da aba de parcelamentos */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Compras Parceladas</h2>
                <p className="text-slate-600 mt-1">Gerencie suas compras parceladas nos cartões</p>
              </div>
              <button
                onClick={() => setShowParcelamentoModal(true)}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center space-x-2 mt-4 sm:mt-0"
              >
                <Plus className="w-5 h-5" />
                <span>Nova Compra Parcelada</span>
              </button>
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

            {/* Grid de Parcelamentos */}
            {comprasParceladas.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-slate-200/50">
                <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-slate-900 mb-2">Nenhum parcelamento encontrado</h3>
                <p className="text-slate-600 mb-6">
                  Crie sua primeira compra parcelada para começar a acompanhar os pagamentos.
                </p>
                <button
                  onClick={() => setShowParcelamentoModal(true)}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Nova Compra Parcelada
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {comprasParceladas.map((parcelamento) => (
                  <div key={parcelamento.id} className="group relative">
                    {/* Card Physical Design */}
                    <div 
                      className="relative w-full h-48 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:rotate-1 overflow-hidden"
                      style={{ 
                        background: `linear-gradient(135deg, ${parcelamento.cartao.cor} 0%, ${parcelamento.cartao.cor}dd 100%)` 
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
                            <p className="text-sm opacity-90 font-medium">Parcelamento</p>
                            <h3 className="text-lg font-bold mt-1">{parcelamento.cartao.nome}</h3>
                          </div>
                          <div className="w-10 h-6 bg-white/20 rounded backdrop-blur-sm border border-white/30 flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-lg font-mono tracking-wider mb-2">{parcelamento.descricao}</p>
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-xs opacity-75">Valor Total</p>
                              <p className="text-sm font-semibold">R$ {parcelamento.valor_total.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs opacity-75">Valor Parcela</p>
                              <p className="text-sm font-semibold">R$ {parcelamento.valor_parcela.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Info */}
                    <div className="bg-white rounded-xl mt-4 p-4 shadow-sm border border-slate-200/50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-600">Status</span>
                        <span className={`text-sm font-semibold ${
                          parcelamento.ativa ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {parcelamento.ativa ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">
                          Parcelas Pagas: {parcelamento.parcelas_pagas}
                        </span>
                        <span className="text-slate-500">
                          Parcelas Pendentes: {parcelamento.parcelas_pendentes}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button 
                          onClick={() => handleProcessarParcela(parcelamento.id, parcelamento.parcelas_pagas + 1)}
                          className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-200"
                        >
                          Pagar Parcela
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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

      {/* Modal de Parcelamentos */}
      <CompraParceladaModal
        open={showParcelamentoModal}
        onClose={() => setShowParcelamentoModal(false)}
        onSubmit={handleCriarParcelamento}
        cartoes={cartoes}
        categorias={categorias}
      />
    </div>
  );
} 