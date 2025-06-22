import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { financiamentosApi } from '../services/api';
import Navigation from '../components/Navigation';
import {
  Building2,
  Calculator,
  TrendingUp,
  Calendar,
  FileText,
  Plus,
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  PieChart,
  BarChart3,
  Target,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react';

// Interface para dados da API
interface FinanciamentoAPI {
  id: number;
  descricao: string;
  instituicao?: string;
  numero_contrato?: string;
  tipo_financiamento: string;
  sistema_amortizacao: string;
  valor_total: number;
  valor_financiado: number;
  valor_entrada: number;
  taxa_juros_mensal: number;
  taxa_juros_anual?: number;
  numero_parcelas: number;
  parcelas_pagas: number;
  valor_parcela: number;
  valor_parcela_atual?: number;
  saldo_devedor: number;
  data_contratacao: string;
  data_primeira_parcela: string;
  dia_vencimento?: number;
  status: string;
  porcentagem_paga?: number;
  auto_debito: boolean;
  observacoes?: string;
}

// Interface para dados mockados (compatibilidade)
interface Financiamento {
  id: number;
  nome: string;
  instituicao: string;
  tipo: 'habitacional' | 'veiculo' | 'pessoal' | 'consignado';
  sistemaAmortizacao: 'PRICE' | 'SAC' | 'SACRE';
  valorOriginal: number;
  valorTotalContrato: number;
  saldoDevedor: number;
  totalParcelas: number;
  parcelasPagas: number;
  valorParcelaAtual: number;
  proximoVencimento: string;
  dataContratacao: string;
  taxaJurosAnual: number;
  status: 'ativo' | 'em_atraso' | 'quitado';
  diasAtraso?: number;
  porcentagemPaga: number;
  cor: string;
}

interface DashboardData {
  total_financiado: number;
  total_ja_pago: number;
  saldo_devedor: number;
  total_juros_restantes?: number;
  valor_mes_atual: number;
  financiamentos_ativos: number;
  financiamentos_quitados: number;
  media_juros_carteira: number;
  proximos_vencimentos?: any[];
}

// Dados mockados
const mockFinanciamentos: Financiamento[] = [
  {
    id: 1,
    nome: 'Financiamento Apartamento',
    instituicao: 'Caixa Econômica Federal',
    tipo: 'habitacional',
    sistemaAmortizacao: 'SAC',
    valorOriginal: 300000,
    valorTotalContrato: 420000,
    saldoDevedor: 245000,
    totalParcelas: 360,
    parcelasPagas: 48,
    valorParcelaAtual: 1850,
    proximoVencimento: '2024-01-15',
    dataContratacao: '2020-01-15',
    taxaJurosAnual: 8.5,
    status: 'ativo',
    porcentagemPaga: 22.4,
    cor: '#059669'
  },
  {
    id: 2,
    nome: 'Financiamento Honda Civic',
    instituicao: 'Banco do Brasil',
    tipo: 'veiculo',
    sistemaAmortizacao: 'PRICE',
    valorOriginal: 85000,
    valorTotalContrato: 102000,
    saldoDevedor: 45200,
    totalParcelas: 48,
    parcelasPagas: 28,
    valorParcelaAtual: 2125,
    proximoVencimento: '2024-01-10',
    dataContratacao: '2021-09-10',
    taxaJurosAnual: 12.9,
    status: 'ativo',
    porcentagemPaga: 58.3,
    cor: '#7C3AED'
  },
  {
    id: 3,
    nome: 'Empréstimo Pessoal',
    instituicao: 'Nubank',
    tipo: 'pessoal',
    sistemaAmortizacao: 'PRICE',
    valorOriginal: 25000,
    valorTotalContrato: 32500,
    saldoDevedor: 8750,
    totalParcelas: 24,
    parcelasPagas: 18,
    valorParcelaAtual: 1354,
    proximoVencimento: '2024-01-20',
    dataContratacao: '2022-07-20',
    taxaJurosAnual: 18.5,
    status: 'ativo',
    porcentagemPaga: 75.0,
    cor: '#DC2626'
  }
];

const mockDashboard: DashboardData = {
  total_financiado: 410000,
  total_ja_pago: 111050,
  saldo_devedor: 298950,
  total_juros_restantes: 89950,
  valor_mes_atual: 5329,
  financiamentos_ativos: 3,
  financiamentos_quitados: 1,
  media_juros_carteira: 12.3
};

const mockProximosVencimentos = [
  { financiamento: 'Honda Civic', valor: 2125, data: '2024-01-10', status: 'pendente' },
  { financiamento: 'Apartamento', valor: 1850, data: '2024-01-15', status: 'pendente' },
  { financiamento: 'Empréstimo Pessoal', valor: 1354, data: '2024-01-20', status: 'pendente' }
];

export default function Financiamentos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'financiamentos' | 'simulador' | 'pagamentos' | 'relatorios'>('dashboard');
  const [financiamentos, setFinanciamentos] = useState<Financiamento[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [proximosVencimentos, setProximosVencimentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função para converter dados da API para formato da interface
  const converterFinanciamentoAPI = (apiData: FinanciamentoAPI): Financiamento => {
    const porcentagemPaga = apiData.porcentagem_paga || 
      (apiData.numero_parcelas > 0 ? (apiData.parcelas_pagas / apiData.numero_parcelas) * 100 : 0);
    
    return {
      id: apiData.id,
      nome: apiData.descricao,
      instituicao: apiData.instituicao || 'Não informado',
      tipo: mapearTipoFinanciamento(apiData.tipo_financiamento),
      sistemaAmortizacao: apiData.sistema_amortizacao as 'PRICE' | 'SAC' | 'SACRE',
      valorOriginal: apiData.valor_total,
      valorTotalContrato: apiData.valor_total,
      saldoDevedor: apiData.saldo_devedor,
      totalParcelas: apiData.numero_parcelas,
      parcelasPagas: apiData.parcelas_pagas,
      valorParcelaAtual: apiData.valor_parcela_atual || apiData.valor_parcela,
      proximoVencimento: calcularProximoVencimento(apiData),
      dataContratacao: apiData.data_contratacao,
      taxaJurosAnual: apiData.taxa_juros_anual || (apiData.taxa_juros_mensal * 12 * 100),
      status: mapearStatus(apiData.status),
      diasAtraso: 0, // TODO: calcular baseado na data
      porcentagemPaga,
      cor: obterCorPorTipo(apiData.tipo_financiamento)
    };
  };

  const mapearTipoFinanciamento = (tipo: string): 'habitacional' | 'veiculo' | 'pessoal' | 'consignado' => {
    switch (tipo?.toLowerCase()) {
      case 'imovel':
      case 'habitacional':
        return 'habitacional';
      case 'veiculo':
      case 'automovel':
        return 'veiculo';
      case 'consignado':
        return 'consignado';
      default:
        return 'pessoal';
    }
  };

  const mapearStatus = (status: string): 'ativo' | 'em_atraso' | 'quitado' => {
    switch (status?.toLowerCase()) {
      case 'quitado':
        return 'quitado';
      case 'em_atraso':
      case 'vencido':
        return 'em_atraso';
      default:
        return 'ativo';
    }
  };

  const obterCorPorTipo = (tipo: string): string => {
    switch (tipo?.toLowerCase()) {
      case 'imovel':
      case 'habitacional':
        return '#059669'; // Verde
      case 'veiculo':
      case 'automovel':
        return '#7C3AED'; // Roxo
      case 'consignado':
        return '#0891B2'; // Azul
      default:
        return '#DC2626'; // Vermelho
    }
  };

  const calcularProximoVencimento = (apiData: FinanciamentoAPI): string => {
    if (apiData.dia_vencimento) {
      const hoje = new Date();
      const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, apiData.dia_vencimento);
      return proximoMes.toISOString().split('T')[0];
    }
    return apiData.data_primeira_parcela;
  };

  // Carregar dados da API
  useEffect(() => {
    const carregarDados = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔄 Carregando dados de financiamentos...');
        
        // Testar endpoint básico primeiro
        try {
          console.log('🧪 Testando endpoint /financiamentos/');
          const testResponse = await financiamentosApi.getAll();
          console.log('✅ Endpoint funcionando, dados recebidos:', testResponse);
        } catch (testError: any) {
          console.error('❌ Erro no teste do endpoint:', testError);
          console.error('Status:', testError?.response?.status);
          console.error('Data:', testError?.response?.data);
        }
        
        // Carregar dados em paralelo
        const [financiamentosData, dashboardData, vencimentosData] = await Promise.all([
          financiamentosApi.getAll(),
          financiamentosApi.getDashboard(),
          financiamentosApi.getProximosVencimentos(30)
        ]);
        
        // Converter dados da API para formato da interface
        const financiamentosConvertidos = financiamentosData.map((f: FinanciamentoAPI) => converterFinanciamentoAPI(f));
        
        setFinanciamentos(financiamentosConvertidos);
        setDashboard(dashboardData);
        setProximosVencimentos(vencimentosData);
        
      } catch (err: any) {
        console.error('Erro ao carregar dados dos financiamentos:', err);
        
        let mensagemErro = 'Erro ao carregar dados dos financiamentos';
        if (err?.response?.status === 404) {
          mensagemErro = 'Endpoint de financiamentos não encontrado (404). Usando dados de demonstração.';
        } else if (err?.response?.status === 500) {
          mensagemErro = 'Erro interno do servidor. Usando dados de demonstração.';
        } else if (err?.message?.includes('Network Error')) {
          mensagemErro = 'Erro de conexão com o servidor. Usando dados de demonstração.';
        }
        
        setError(mensagemErro);
        
        // Fallback para dados mockados em caso de erro
        setFinanciamentos(mockFinanciamentos);
        setDashboard(mockDashboard);
        setProximosVencimentos(mockProximosVencimentos);
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, []);

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'habitacional': return '🏠';
      case 'veiculo': return '🚗';
      case 'pessoal': return '💰';
      case 'consignado': return '💼';
      default: return '📄';
    }
  };

  const getStatusColor = (status: string, diasAtraso?: number) => {
    if (status === 'em_atraso' || (diasAtraso && diasAtraso > 0)) return 'text-red-600 bg-red-50 border-red-200';
    if (status === 'quitado') return 'text-green-600 bg-green-50 border-green-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation user={user} />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-4 mb-4 sm:mb-0">
              <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Financiamentos</h1>
                <p className="text-slate-600 dark:text-gray-300">Sistema completo de gestão de financiamentos</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button 
                onClick={async () => {
                  console.log('🧪 Teste manual da API');
                  try {
                    const response = await financiamentosApi.getAll();
                    console.log('✅ Sucesso:', response);
                    alert('API funcionando! Verifique o console para detalhes.');
                  } catch (error: any) {
                    console.error('❌ Erro:', error);
                    alert(`Erro na API: ${error?.response?.status || error.message}`);
                  }
                }}
                className="btn-ghost text-xs"
                title="Testar API"
              >
                🧪 Debug
              </button>
              <button className="btn-secondary">
                <Calculator className="w-4 h-4" />
                <span className="hidden sm:inline">Simulador</span>
              </button>
              <button className="btn-primary">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Novo Financiamento</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-1 bg-slate-100/50 dark:bg-gray-800/50 rounded-2xl p-1 w-fit">
            {[
              { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { key: 'financiamentos', label: 'Meus Financiamentos', icon: Building2 },
              { key: 'simulador', label: 'Simulador', icon: Calculator },
              { key: 'pagamentos', label: 'Pagamentos', icon: CreditCard },
              { key: 'relatorios', label: 'Relatórios', icon: FileText }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-3 rounded-xl font-medium transition-all duration-300 ease-in-out transform ${
                  activeTab === tab.key
                    ? 'bg-white dark:bg-gray-700 text-slate-800 dark:text-white shadow-sm border border-slate-200 dark:border-gray-600 scale-105'
                    : 'text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white hover:bg-white/70 dark:hover:bg-gray-700/70'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <tab.icon className={`w-4 h-4 transition-all duration-300 ${
                    activeTab === tab.key ? 'text-green-600' : ''
                  }`} />
                  <span className="hidden md:inline">{tab.label}</span>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Aviso de dados de demonstração */}
        {error && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                <strong>Modo Demonstração:</strong> Os dados exibidos são fictícios para demonstração das funcionalidades.
              </p>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm text-slate-500 dark:text-gray-400">Total Financiado</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(dashboard?.total_financiado || 0)}</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  <ArrowUpRight className="w-4 h-4 inline mr-1" />
                  {dashboard?.financiamentos_ativos || 0} ativos
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-slate-500 dark:text-gray-400">Já Pago</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(dashboard?.total_ja_pago || 0)}</p>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                  {dashboard && dashboard.total_financiado > 0 ? ((dashboard.total_ja_pago / dashboard.total_financiado) * 100).toFixed(1) : '0'}% do total
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-sm text-slate-500 dark:text-gray-400">Saldo Devedor</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(dashboard?.saldo_devedor || 0)}</p>
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                  <ArrowDownRight className="w-4 h-4 inline mr-1" />
                  + {formatCurrency(dashboard?.total_juros_restantes || 0)} juros
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-sm text-slate-500 dark:text-gray-400">Este Mês</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(dashboard?.valor_mes_atual || 0)}</p>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                  {proximosVencimentos.length} parcelas
                </p>
              </div>
            </div>

            {/* Próximos Vencimentos */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Próximos Vencimentos</h3>
                <button className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium text-sm">
                  Ver todos →
                </button>
              </div>
              
              <div className="space-y-4">
                {proximosVencimentos.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{item.financiamento_nome || item.financiamento}</p>
                        <p className="text-sm text-slate-500 dark:text-gray-400">Vence em {formatDate(item.data_vencimento || item.data)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.valor_parcela || item.valor)}</p>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Pendente
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financiamentos' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md mx-auto shadow-sm border border-slate-200 dark:border-gray-700">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-slate-600 dark:text-gray-400 font-medium">Carregando financiamentos...</p>
                  <p className="text-sm text-slate-500 dark:text-gray-500 mt-2">Conectando com o servidor</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 max-w-md mx-auto">
                  <AlertCircle className="w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
                  <p className="text-yellow-800 dark:text-yellow-200 mb-4">{error}</p>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="btn-secondary"
                  >
                    Tentar Novamente
                  </button>
                </div>
              </div>
            ) : financiamentos.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl p-8 max-w-md mx-auto">
                  <Building2 className="w-16 h-16 text-slate-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                    Nenhum financiamento encontrado
                  </h3>
                  <p className="text-slate-500 dark:text-gray-400 mb-6">
                    Comece criando seu primeiro financiamento para acompanhar parcelas e juros
                  </p>
                  <button className="btn-primary">
                    <Plus className="w-4 h-4" />
                    Adicionar Primeiro Financiamento
                  </button>
                </div>
              </div>
            ) : (
              financiamentos.map((financiamento) => (
              <div key={financiamento.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
                  {/* Info Principal */}
                  <div className="flex items-start space-x-4">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl"
                      style={{ backgroundColor: financiamento.cor }}
                    >
                      {getTipoIcon(financiamento.tipo)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{financiamento.nome}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(financiamento.status, financiamento.diasAtraso)}`}>
                          {financiamento.status === 'ativo' ? 'Em Dia' : financiamento.status === 'em_atraso' ? 'Em Atraso' : 'Quitado'}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-gray-400 mb-2">{financiamento.instituicao} • {financiamento.sistemaAmortizacao}</p>
                      
                      {/* Barra de Progresso */}
                      <div className="w-full bg-slate-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${financiamento.porcentagemPaga}%`,
                            backgroundColor: financiamento.cor 
                          }}
                        ></div>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-gray-400">
                        {financiamento.parcelasPagas} de {financiamento.totalParcelas} parcelas • {financiamento.porcentagemPaga.toFixed(1)}% pago
                      </p>
                    </div>
                  </div>

                  {/* Valores */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <div className="text-center lg:text-right">
                      <p className="text-sm text-slate-500 dark:text-gray-400">Saldo Devedor</p>
                      <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(financiamento.saldoDevedor)}</p>
                    </div>
                    <div className="text-center lg:text-right">
                      <p className="text-sm text-slate-500 dark:text-gray-400">Parcela Atual</p>
                      <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(financiamento.valorParcelaAtual)}</p>
                    </div>
                    <div className="text-center lg:text-right">
                      <p className="text-sm text-slate-500 dark:text-gray-400">Próximo Venc.</p>
                      <p className="font-bold text-slate-900 dark:text-white">{formatDate(financiamento.proximoVencimento)}</p>
                    </div>
                    <div className="text-center lg:text-right">
                      <p className="text-sm text-slate-500 dark:text-gray-400">Taxa Anual</p>
                      <p className="font-bold text-slate-900 dark:text-white">{financiamento.taxaJurosAnual}%</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 mt-4 pt-4 border-t border-slate-100 dark:border-gray-700">
                  <button className="btn-ghost text-sm">
                    <FileText className="w-4 h-4" />
                    Tabela
                  </button>
                  <button className="btn-ghost text-sm">
                    <Calculator className="w-4 h-4" />
                    Simular
                  </button>
                  <button className="btn-secondary text-sm">
                    <CreditCard className="w-4 h-4" />
                    Pagar
                  </button>
                </div>
              </div>
            ))
            )}
          </div>
        )}

        {activeTab === 'simulador' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
            <div className="text-center py-16">
              <Calculator className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Simulador de Financiamentos</h3>
              <p className="text-slate-600 dark:text-gray-400 mb-6">Compare diferentes sistemas de amortização (PRICE, SAC, SACRE)</p>
              <button className="btn-primary">
                <Plus className="w-4 h-4" />
                Iniciar Simulação
              </button>
            </div>
          </div>
        )}

        {activeTab === 'pagamentos' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
            <div className="text-center py-16">
              <CreditCard className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Central de Pagamentos</h3>
              <p className="text-slate-600 dark:text-gray-400 mb-6">Controle de pagamentos e histórico de parcelas</p>
              <button className="btn-primary">
                <Clock className="w-4 h-4" />
                Ver Vencimentos
              </button>
            </div>
          </div>
        )}

        {activeTab === 'relatorios' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
            <div className="text-center py-16">
              <BarChart3 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Relatórios e Análises</h3>
              <p className="text-slate-600 dark:text-gray-400 mb-6">Dashboards analíticos e relatórios detalhados</p>
              <button className="btn-primary">
                <FileText className="w-4 h-4" />
                Gerar Relatório
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 