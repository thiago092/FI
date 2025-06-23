import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { financiamentosApi, categoriasApi, contasApi } from '../services/api';
import Navigation from '../components/Navigation';
import ToastContainer from '../components/ToastContainer';
import { useToast } from '../hooks/useToast';
import {
  Building2,
  Calculator,
  TrendingUp,
  TrendingDown,
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
  Info,
  Home,
  Car,
  User,
  Briefcase,
  GraduationCap,
  Tractor,
  X,
  Save,
  FileCheck,
  Eye,
  EyeOff,
  Zap
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
  tipo: 'habitacional' | 'veiculo' | 'pessoal' | 'consignado' | 'estudantil' | 'rural' | 'empresarial';
  sistemaAmortizacao: 'PRICE' | 'SAC' | 'SACRE' | 'AMERICANO' | 'BULLET';
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
  parcelas_mes_atual?: number;
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
  const { toasts, removeToast, showSuccess, showError, showSaveSuccess, showDeleteSuccess, showInfo } = useToast();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'financiamentos'>('dashboard');
  const [financiamentos, setFinanciamentos] = useState<Financiamento[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [proximosVencimentos, setProximosVencimentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNovoFinanciamentoModal, setShowNovoFinanciamentoModal] = useState(false);
  const [novoFinanciamento, setNovoFinanciamento] = useState({
    descricao: '',
    instituicao: '',
    numero_contrato: '',
    tipo_financiamento: 'pessoal',
    sistema_amortizacao: 'PRICE',
    valor_total: '',
    valor_entrada: '',
    taxa_juros_anual: '',
    numero_parcelas: '',
    data_contratacao: '',
    data_primeira_parcela: '',
    dia_vencimento: '',
    categoria_id: '',
    conta_debito_id: '',
    auto_debito: false,
    observacoes: '',
    // Taxas adicionais (opcionais)
    taxa_seguro_mensal: '',
    taxa_administrativa: '',
    iof_percentual: ''
  });
  const [mostrarTaxasAdicionais, setMostrarTaxasAdicionais] = useState(false);
  const [salvandoFinanciamento, setSalvandoFinanciamento] = useState(false);
  const [mostrarTabelaAmortizacao, setMostrarTabelaAmortizacao] = useState(false);
  const [tabelaAmortizacao, setTabelaAmortizacao] = useState<any[]>([]);
  const [simuladorAdiantamento, setSimuladorAdiantamento] = useState({
    financiamentoSelecionado: '',
    valorFinanciado: '',
    taxaJurosAnual: '',
    numeroParcelas: '',
    sistemaAmortizacao: 'PRICE',
    dataInicio: '',
    valorAdiantamento: '',
    parcelaAdiantamento: '',
    tipoAdiantamento: 'amortizacao_extraordinaria',
    numeroParcela: '1'
  });
  const [resultadoSimulacao, setResultadoSimulacao] = useState<any>(null);
  const [mostrandoSimulacao, setMostrandoSimulacao] = useState(false);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  
  // Estados para funcionalidades dos botões
  const [financiamentoSelecionado, setFinanciamentoSelecionado] = useState<Financiamento | null>(null);
  const [showTabelaModal, setShowTabelaModal] = useState(false);
  const [showSimuladorModal, setShowSimuladorModal] = useState(false);
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [tabelaParcelasFinanciamento, setTabelaParcelasFinanciamento] = useState<any[]>([]);
  
  // Estados para pagamento de parcelas
  const [proximaParcela, setProximaParcela] = useState<any>(null);
  const [carregandoParcela, setCarregandoParcela] = useState(false);
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);
  const [formPagamento, setFormPagamento] = useState({
    valor_pago: '',
    data_pagamento: new Date().toISOString().split('T')[0],
    categoria_id: '',
    conta_id: '',
    observacoes: ''
  });

  // Novos estados para melhor UX
  const [aplicandoAdiantamento, setAplicandoAdiantamento] = useState(false);
  const [excluindoFinanciamento, setExcluindoFinanciamento] = useState<number | null>(null);
  const [carregandoSimulacao, setCarregandoSimulacao] = useState(false);
  
  // Estados para histórico
  const [historicoFinanciamento, setHistoricoFinanciamento] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  // Função para converter dados da API para formato da interface
  const converterFinanciamentoAPI = (apiData: FinanciamentoAPI): Financiamento => {
    const porcentagemPaga = apiData.porcentagem_paga || 
      (apiData.numero_parcelas > 0 ? (apiData.parcelas_pagas / apiData.numero_parcelas) * 100 : 0);
    
    return {
      id: apiData.id,
      nome: apiData.descricao,
      instituicao: apiData.instituicao || 'Não informado',
      tipo: mapearTipoFinanciamento(apiData.tipo_financiamento),
      sistemaAmortizacao: apiData.sistema_amortizacao as 'PRICE' | 'SAC' | 'SACRE' | 'AMERICANO' | 'BULLET',
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

  const mapearTipoFinanciamento = (tipo: string): 'habitacional' | 'veiculo' | 'pessoal' | 'consignado' | 'estudantil' | 'rural' | 'empresarial' => {
    switch (tipo?.toLowerCase()) {
      case 'imovel':
      case 'habitacional':
        return 'habitacional';
      case 'veiculo':
      case 'automovel':
        return 'veiculo';
      case 'consignado':
        return 'consignado';
      case 'estudantil':
        return 'estudantil';
      case 'rural':
        return 'rural';
      case 'empresarial':
        return 'empresarial';
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
      case 'estudantil':
        return '#007BFF'; // Azul
      case 'rural':
        return '#007BFF'; // Azul
      case 'empresarial':
        return '#007BFF'; // Azul
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

  // Função para carregar dados da API
  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Carregando dados de financiamentos...');
      
      // Carregar dados em paralelo
      const [financiamentosData, dashboardData, vencimentosData, categoriasData, contasData] = await Promise.all([
        financiamentosApi.getAll(),
        financiamentosApi.getDashboard(),
        financiamentosApi.getProximosVencimentos(30),
        categoriasApi.getAll().catch(() => []),
        contasApi.getAll().catch(() => [])
      ]);
      
      console.log('📊 DADOS BRUTOS DA API:');
      console.log('  financiamentosData:', financiamentosData);
      console.log('  Tipo:', typeof financiamentosData);
      console.log('  É array?', Array.isArray(financiamentosData));
      console.log('  Quantidade:', financiamentosData?.length);
      
      if (financiamentosData && Array.isArray(financiamentosData) && financiamentosData.length > 0) {
        console.log('  Primeiro item:', financiamentosData[0]);
        
        // Converter dados da API para formato da interface
        const financiamentosConvertidos = financiamentosData.map((f: FinanciamentoAPI, index: number) => {
          console.log(`🔄 Convertendo financiamento ${index + 1}:`, f);
          try {
            const convertido = converterFinanciamentoAPI(f);
            console.log(`✅ Convertido ${index + 1}:`, convertido);
            return convertido;
          } catch (err) {
            console.error(`❌ Erro ao converter financiamento ${index + 1}:`, err);
            throw err;
          }
        });
        
        console.log('✅ Todos os financiamentos convertidos:', financiamentosConvertidos);
        setFinanciamentos(financiamentosConvertidos);
      } else {
        console.log('⚠️ NENHUM FINANCIAMENTO ENCONTRADO');
        console.log('  financiamentosData é falsy ou vazio');
        setFinanciamentos([]);
      }
      
      console.log('📈 Dashboard data:', dashboardData);
      console.log('📅 Vencimentos data:', vencimentosData);
      
      setDashboard(dashboardData);
      setProximosVencimentos(vencimentosData);
      setCategorias(categoriasData || []);
      setContas(contasData || []);
      
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

  // Carregar dados na inicialização
  useEffect(() => {
    carregarDados();
  }, []);

  // Filtrar financiamentos ativos para o simulador
  const financiamentosAtivos = financiamentos.filter(f => f.status === 'ativo');

  // Funções para os botões de ação
  const handleVerTabela = async (financiamento: Financiamento) => {
    try {
      setFinanciamentoSelecionado(financiamento);
      
      // Buscar parcelas do financiamento na API
      const parcelas = await financiamentosApi.getParcelas(financiamento.id);
      setTabelaParcelasFinanciamento(parcelas);
      setShowTabelaModal(true);
    } catch (error) {
      console.error('Erro ao carregar parcelas:', error);
      
      // Fallback: calcular tabela baseada nos dados do financiamento
      const tabela = calcularTabelaAmortizacao(
        financiamento.saldoDevedor,
        financiamento.taxaJurosAnual,
        financiamento.totalParcelas - financiamento.parcelasPagas,
        financiamento.sistemaAmortizacao,
        financiamento.proximoVencimento
      );
      setTabelaParcelasFinanciamento(tabela);
      setShowTabelaModal(true);
    }
  };

  const handleSimular = (financiamento: Financiamento) => {
    setFinanciamentoSelecionado(financiamento);
    
    // Preencher dados do simulador com o financiamento selecionado
    setSimuladorAdiantamento({
      ...simuladorAdiantamento,
      financiamentoSelecionado: financiamento.id.toString(),
      valorFinanciado: financiamento.saldoDevedor.toString(),
      taxaJurosAnual: financiamento.taxaJurosAnual.toString(),
      numeroParcelas: (financiamento.totalParcelas - financiamento.parcelasPagas).toString(),
      sistemaAmortizacao: financiamento.sistemaAmortizacao,
      dataInicio: new Date().toISOString().split('T')[0],
      valorAdiantamento: '',
      tipoAdiantamento: 'amortizacao_extraordinaria',
      parcelaAdiantamento: '1'
    });
    
    // Limpar simulação anterior
    setMostrandoSimulacao(false);
    setResultadoSimulacao(null);
    
    // Abrir modal do simulador
    setShowSimuladorModal(true);
  };

  const handlePagar = async (financiamento: Financiamento) => {
    try {
      setFinanciamentoSelecionado(financiamento);
      setCarregandoParcela(true);
      
      // Buscar dados da próxima parcela
      const dadosParcela = await financiamentosApi.getProximaParcela(financiamento.id);
      setProximaParcela(dadosParcela.proxima_parcela);
      
      // Preencher formulário com valores padrão
      setFormPagamento({
        valor_pago: dadosParcela.proxima_parcela?.valor_parcela?.toString() || '',
        data_pagamento: new Date().toISOString().split('T')[0],
        categoria_id: '',
        conta_id: '',
        observacoes: ''
      });
      
      setShowPagamentoModal(true);
    } catch (error) {
      console.error('Erro ao carregar próxima parcela:', error);
      showError('Erro ao carregar dados da parcela. Tente novamente.');
    } finally {
      setCarregandoParcela(false);
    }
  };

  // Função para processar pagamento
  const processarPagamento = async () => {
    if (!proximaParcela || !financiamentoSelecionado) {
      showError('Dados da parcela não encontrados');
      return;
    }

    if (!formPagamento.categoria_id) {
      showError('Por favor, selecione uma categoria');
      return;
    }

    if (!formPagamento.valor_pago || parseFloat(formPagamento.valor_pago) <= 0) {
      showError('Por favor, informe um valor válido');
      return;
    }

    try {
      setSalvandoPagamento(true);

      const dadosPagamento = {
        parcela_id: proximaParcela.id,
        valor_pago: parseFloat(formPagamento.valor_pago),
        data_pagamento: formPagamento.data_pagamento,
        categoria_id: parseInt(formPagamento.categoria_id),
        conta_id: formPagamento.conta_id ? parseInt(formPagamento.conta_id) : undefined,
        observacoes: formPagamento.observacoes || undefined
      };

      console.log('Enviando pagamento:', dadosPagamento);

      const resultado = await financiamentosApi.pagarParcela(dadosPagamento);
      
      console.log('Pagamento registrado:', resultado);

      // Fechar modal
      setShowPagamentoModal(false);
      
      // Limpar estados
      setProximaParcela(null);
      setFormPagamento({
        valor_pago: '',
        data_pagamento: new Date().toISOString().split('T')[0],
        categoria_id: '',
        conta_id: '',
        observacoes: ''
      });

      // Recarregar dados
      await carregarDados();

      // Mostrar sucesso com detalhes
      let mensagemSucesso = `✅ ${resultado.mensagem}\n\n`;
      
      if (resultado.tipo_pagamento === 'parcial') {
        mensagemSucesso += 
          `⚠️ PAGAMENTO PARCIAL:\n` +
          `• Valor esperado: ${formatCurrency(resultado.parcela.valor_ideal)}\n` +
          `• Valor pago: ${formatCurrency(resultado.parcela.valor_pago)}\n` +
          `• Valor restante: ${formatCurrency(Math.abs(resultado.parcela.diferenca))}\n` +
          `• Status: Pendente (pagamento parcial)\n\n` +
          `⚡ Para quitar completamente esta parcela, pague o valor restante.`;
      } else if (resultado.tipo_pagamento === 'sobrepagamento') {
        mensagemSucesso += 
          `💰 SOBREPAGAMENTO:\n` +
          `• Valor esperado: ${formatCurrency(resultado.parcela.valor_ideal)}\n` +
          `• Valor pago: ${formatCurrency(resultado.parcela.valor_pago)}\n` +
          `• Sobrepagamento: ${formatCurrency(resultado.parcela.diferenca)}\n` +
          `• Status: Paga completamente\n\n` +
          `✨ O valor extra foi registrado na transação.`;
      } else {
        mensagemSucesso += 
          `✅ PAGAMENTO EXATO:\n` +
          `• Valor pago: ${formatCurrency(resultado.parcela.valor_pago)}\n` +
          `• Status: Paga completamente`;
      }
      
      if (resultado.parcela.juros_atraso > 0) {
        mensagemSucesso += `\n📅 Juros de atraso: ${formatCurrency(resultado.parcela.juros_atraso)} (${resultado.parcela.dias_atraso} dias)`;
      }
      
      if (resultado.parcela.desconto > 0) {
        mensagemSucesso += `\n🎉 Desconto antecipação: ${formatCurrency(resultado.parcela.desconto)}`;
      }
      
      showSaveSuccess(mensagemSucesso);

    } catch (error: any) {
      console.error('Erro ao processar pagamento:', error);
      
      let mensagem = 'Erro ao processar pagamento';
      if (error?.response?.data?.detail) {
        mensagem = error.response.data.detail;
      } else if (error?.message) {
        mensagem = error.message;
      }
      
      showError(mensagem);
    } finally {
      setSalvandoPagamento(false);
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'habitacional': return <Home className="w-5 h-5" />;
      case 'veiculo': return <Car className="w-5 h-5" />;
      case 'pessoal': return <User className="w-5 h-5" />;
      case 'consignado': return <Briefcase className="w-5 h-5" />;
      case 'estudantil': return <GraduationCap className="w-5 h-5" />;
      case 'rural': return <Tractor className="w-5 h-5" />;
      case 'empresarial': return <Building2 className="w-5 h-5" />;
      default: return <Building2 className="w-5 h-5" />;
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'habitacional': return 'Habitacional';
      case 'veiculo': return 'Veículo';
      case 'pessoal': return 'Pessoal';
      case 'consignado': return 'Consignado';
      case 'estudantil': return 'Estudantil';
      case 'rural': return 'Rural';
      case 'empresarial': return 'Empresarial';
      default: return 'Pessoal';
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

  // Função para buscar histórico de alterações
  const buscarHistoricoFinanciamento = async (financiamentoId: number) => {
    try {
      setCarregandoHistorico(true);
      const historico = await financiamentosApi.getHistorico(financiamentoId);
      setHistoricoFinanciamento(historico);
      setMostrarHistorico(true);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      showError('Erro ao carregar histórico do financiamento');
    } finally {
      setCarregandoHistorico(false);
    }
  };

  // Função para calcular tabela de amortização
  const calcularTabelaAmortizacao = (
    valorFinanciado: number,
    taxaJurosAnual: number,
    numeroParcelas: number,
    sistemaAmortizacao: string,
    dataInicio: string
  ) => {
    if (!valorFinanciado || !taxaJurosAnual || !numeroParcelas || !dataInicio) {
      return [];
    }

    const taxaMensal = (taxaJurosAnual / 100) / 12;
    const parcelas = [];
    let saldoDevedor = valorFinanciado;
    const dataInicioObj = new Date(dataInicio);

    for (let i = 1; i <= Math.min(numeroParcelas, 12); i++) { // Mostrar apenas primeiras 12 parcelas
      const dataVencimento = new Date(dataInicioObj);
      dataVencimento.setMonth(dataVencimento.getMonth() + i - 1);

      let valorParcela = 0;
      let valorJuros = 0;
      let valorAmortizacao = 0;

      switch (sistemaAmortizacao) {
        case 'PRICE':
          // Sistema PRICE - Parcelas fixas
          valorParcela = (valorFinanciado * taxaMensal * Math.pow(1 + taxaMensal, numeroParcelas)) / 
                        (Math.pow(1 + taxaMensal, numeroParcelas) - 1);
          valorJuros = saldoDevedor * taxaMensal;
          valorAmortizacao = valorParcela - valorJuros;
          break;

        case 'SAC':
          // Sistema SAC - Amortização constante
          valorAmortizacao = valorFinanciado / numeroParcelas;
          valorJuros = saldoDevedor * taxaMensal;
          valorParcela = valorAmortizacao + valorJuros;
          break;

        case 'SACRE':
          // Sistema SACRE - Misto (simplificado como PRICE para este exemplo)
          valorParcela = (valorFinanciado * taxaMensal * Math.pow(1 + taxaMensal, numeroParcelas)) / 
                        (Math.pow(1 + taxaMensal, numeroParcelas) - 1);
          valorJuros = saldoDevedor * taxaMensal;
          valorAmortizacao = valorParcela - valorJuros;
          break;

        case 'AMERICANO':
          // Sistema Americano - Só juros até a última parcela
          if (i === numeroParcelas) {
            valorAmortizacao = saldoDevedor;
            valorJuros = saldoDevedor * taxaMensal;
            valorParcela = valorAmortizacao + valorJuros;
          } else {
            valorJuros = valorFinanciado * taxaMensal;
            valorAmortizacao = 0;
            valorParcela = valorJuros;
          }
          break;

        case 'BULLET':
          // Sistema Bullet - Pagamento único no final
          if (i === numeroParcelas) {
            valorAmortizacao = saldoDevedor;
            valorJuros = valorFinanciado * taxaMensal * numeroParcelas;
            valorParcela = valorAmortizacao + valorJuros;
          } else {
            valorJuros = 0;
            valorAmortizacao = 0;
            valorParcela = 0;
          }
          break;

        default:
          valorParcela = 0;
          valorJuros = 0;
          valorAmortizacao = 0;
      }

      const saldoAnterior = saldoDevedor;
      saldoDevedor = Math.max(0, saldoDevedor - valorAmortizacao);

      parcelas.push({
        numero: i,
        dataVencimento: dataVencimento.toISOString().split('T')[0],
        saldoAnterior: saldoAnterior,
        valorParcela: valorParcela,
        valorJuros: valorJuros,
        valorAmortizacao: valorAmortizacao,
        saldoPosterior: saldoDevedor
      });
    }

    return parcelas;
  };

  // Função para atualizar tabela de amortização quando dados mudarem
  const atualizarTabelaAmortizacao = () => {
    if (novoFinanciamento.valor_total && novoFinanciamento.valor_entrada !== undefined && 
        novoFinanciamento.taxa_juros_anual && novoFinanciamento.numero_parcelas && 
        novoFinanciamento.data_primeira_parcela) {
      
      const valorTotal = parseFloat(novoFinanciamento.valor_total);
      const valorEntrada = parseFloat(novoFinanciamento.valor_entrada) || 0;
      const valorFinanciado = valorTotal - valorEntrada;
      const taxaJurosAnual = parseFloat(novoFinanciamento.taxa_juros_anual);
      const numeroParcelas = parseInt(novoFinanciamento.numero_parcelas);

      if (valorFinanciado > 0) {
        const tabela = calcularTabelaAmortizacao(
          valorFinanciado,
          taxaJurosAnual,
          numeroParcelas,
          novoFinanciamento.sistema_amortizacao,
          novoFinanciamento.data_primeira_parcela
        );
        setTabelaAmortizacao(tabela);
      }
    }
  };

  // Atualizar tabela quando dados relevantes mudarem
  React.useEffect(() => {
    if (mostrarTabelaAmortizacao) {
      atualizarTabelaAmortizacao();
    }
  }, [
    novoFinanciamento.valor_total,
    novoFinanciamento.valor_entrada,
    novoFinanciamento.taxa_juros_anual,
    novoFinanciamento.numero_parcelas,
    novoFinanciamento.sistema_amortizacao,
    novoFinanciamento.data_primeira_parcela,
    mostrarTabelaAmortizacao
  ]);

  // Função para calcular cenário original (sem adiantamento)
  const calcularCenarioOriginal = (valorFinanciado: number, taxaMensal: number, numeroParcelas: number, sistemaAmortizacao: string) => {
    let saldoDevedor = valorFinanciado;
    let totalJuros = 0;
    
    for (let i = 1; i <= numeroParcelas; i++) {
      let valorJuros = saldoDevedor * taxaMensal;
      let valorAmortizacao = 0;
      
      switch (sistemaAmortizacao) {
        case 'SAC':
          valorAmortizacao = valorFinanciado / numeroParcelas;
          break;
        case 'PRICE':
        default:
          const valorParcela = (valorFinanciado * taxaMensal * Math.pow(1 + taxaMensal, numeroParcelas)) / 
                             (Math.pow(1 + taxaMensal, numeroParcelas) - 1);
          valorAmortizacao = valorParcela - valorJuros;
          break;
      }
      
      totalJuros += valorJuros;
      saldoDevedor -= valorAmortizacao;
    }
    
    return {
      totalJuros,
      totalPago: valorFinanciado + totalJuros,
      numeroParcelas
    };
  };

  // Função para calcular cenário com adiantamento
  const calcularCenarioComAdiantamento = (
    valorFinanciado: number, 
    taxaMensal: number, 
    numeroParcelas: number, 
    valorAdiantamento: number,
    parcelaAdiantamento: number,
    sistemaAmortizacao: string
  ) => {
    let saldoDevedor = valorFinanciado;
    let totalJuros = 0;
    let parcelas: any[] = [];
    let parcelaAtual = 1;
    
    while (saldoDevedor > 0.01 && parcelaAtual <= numeroParcelas) {
      let valorJuros = saldoDevedor * taxaMensal;
      let valorAmortizacao = 0;
      let valorParcela = 0;
      let adiantamento = 0;
      
      switch (sistemaAmortizacao) {
        case 'SAC':
          valorAmortizacao = valorFinanciado / numeroParcelas;
          valorParcela = valorAmortizacao + valorJuros;
          break;
        case 'PRICE':
        default:
          valorParcela = (valorFinanciado * taxaMensal * Math.pow(1 + taxaMensal, numeroParcelas)) / 
                       (Math.pow(1 + taxaMensal, numeroParcelas) - 1);
          valorAmortizacao = valorParcela - valorJuros;
          break;
      }
      
      // Aplicar adiantamento na parcela especificada
      if (parcelaAtual === parcelaAdiantamento) {
        adiantamento = valorAdiantamento;
        valorAmortizacao += valorAdiantamento;
        valorParcela += valorAdiantamento;
      }
      
      // Garantir que não amortize mais que o saldo devedor
      if (valorAmortizacao > saldoDevedor) {
        valorAmortizacao = saldoDevedor;
        valorParcela = valorAmortizacao + valorJuros;
      }
      
      totalJuros += valorJuros;
      saldoDevedor -= valorAmortizacao;
      
      parcelas.push({
        numero: parcelaAtual,
        valorParcela: valorParcela,
        valorJuros: valorJuros,
        valorAmortizacao: valorAmortizacao,
        saldoAnterior: saldoDevedor + valorAmortizacao,
        saldoDevedor: Math.max(0, saldoDevedor),
        adiantamento: adiantamento
      });
      
      parcelaAtual++;
      
      // Se saldo chegou a zero, parar
      if (saldoDevedor <= 0.01) {
        break;
      }
    }
    
    return {
      totalJuros,
      totalPago: valorFinanciado + totalJuros,
      numeroParcelas: parcelas.length,
      saldoFinal: Math.max(0, saldoDevedor),
      parcelas
    };
  };

  // Função para simular adiantamento de parcelas
  const simularAdiantamento = async () => {
    const valorFinanciado = parseFloat(simuladorAdiantamento.valorFinanciado);
    const taxaJurosAnual = parseFloat(simuladorAdiantamento.taxaJurosAnual);
    const numeroParcelas = parseInt(simuladorAdiantamento.numeroParcelas);
    const valorAdiantamento = parseFloat(simuladorAdiantamento.valorAdiantamento);

    console.log('🔍 Debug simulação:', {
      valorFinanciado,
      taxaJurosAnual,
      numeroParcelas,
      valorAdiantamento,
      sistemaAmortizacao: simuladorAdiantamento.sistemaAmortizacao
    });

    if (!valorFinanciado || !taxaJurosAnual || !numeroParcelas || !valorAdiantamento) {
      showError('Por favor, preencha todos os campos da simulação.');
      return;
    }

    // 🔧 SEMPRE USAR CÁLCULO LOCAL para garantir consistência na estrutura dos dados
    console.log('🧮 Usando cálculo local para simulação de adiantamento');

    // 🧮 CÁLCULO LOCAL: Simulação de adiantamento
    const parcelaAdiantamento = parseInt(simuladorAdiantamento.parcelaAdiantamento) || 1;
    const taxaMensal = (taxaJurosAnual / 100) / 12;
    
    // Calcular cenário original (sem adiantamento)
    const cenarioOriginal = calcularCenarioOriginal(valorFinanciado, taxaMensal, numeroParcelas, simuladorAdiantamento.sistemaAmortizacao);
    
    // Calcular cenário com adiantamento
    const cenarioAdiantamento = calcularCenarioComAdiantamento(
      valorFinanciado, 
      taxaMensal, 
      numeroParcelas, 
      valorAdiantamento,
      parcelaAdiantamento,
      simuladorAdiantamento.sistemaAmortizacao
    );

    const economiaJuros = cenarioOriginal.totalJuros - cenarioAdiantamento.totalJuros;
    const parcelasEconomizadas = cenarioOriginal.numeroParcelas - cenarioAdiantamento.numeroParcelas;

    const resultado = {
      cenarioOriginal: {
        totalJuros: cenarioOriginal.totalJuros,
        totalPago: cenarioOriginal.totalPago,
        numeroParcelas: cenarioOriginal.numeroParcelas
      },
      cenarioComAdiantamento: {
        totalJuros: cenarioAdiantamento.totalJuros,
        totalPago: cenarioAdiantamento.totalPago,
        numeroParcelas: cenarioAdiantamento.numeroParcelas,
        saldoDevedor: cenarioAdiantamento.saldoFinal
      },
      economia: {
        juros: economiaJuros,
        percentual: (economiaJuros / cenarioOriginal.totalJuros) * 100,
        parcelasEconomizadas: parcelasEconomizadas,
        tempoEconomizado: Math.floor(parcelasEconomizadas / 12)
      },
      parcelas: cenarioAdiantamento.parcelas.slice(0, 12) // Mostrar apenas primeiras 12
    };

    setResultadoSimulacao(resultado);
    setMostrandoSimulacao(true);
  };

  // Função para aplicar adiantamento real
  const aplicarAdiantamentoReal = async () => {
    if (!financiamentoSelecionado || !simuladorAdiantamento.valorAdiantamento) {
      showError('Dados incompletos para aplicar o adiantamento.');
      return;
    }

    // Validações básicas
    const valorAdiantamento = parseFloat(simuladorAdiantamento.valorAdiantamento);
    
    if (valorAdiantamento <= 0) {
      showError('O valor do adiantamento deve ser positivo.');
      return;
    }

    if (valorAdiantamento > financiamentoSelecionado.saldoDevedor) {
      showError('O valor do adiantamento não pode ser maior que o saldo devedor.');
      return;
    }

    // Verificar se tem categoria e conta
    if (categorias.length === 0) {
      showError('Nenhuma categoria encontrada. Cadastre uma categoria primeiro.');
      return;
    }

    // Mostrar modal integrado para confirmar e selecionar dados
    const modalData = await mostrarModalConfirmacaoIntegrada(valorAdiantamento);
    if (!modalData) return;

    try {
      setAplicandoAdiantamento(true);

      const adiantamentoData = {
        financiamento_id: financiamentoSelecionado.id,
        valor_adiantamento: valorAdiantamento,
        tipo_adiantamento: simuladorAdiantamento.tipoAdiantamento || 'amortizacao_extraordinaria',
        parcela_numero: simuladorAdiantamento.tipoAdiantamento === 'parcela_especifica' ? 
          parseInt(simuladorAdiantamento.numeroParcela) || 1 : 
          parseInt(simuladorAdiantamento.parcelaAdiantamento) || 1,
        categoria_id: parseInt(modalData.categoria_id),
        conta_id: modalData.conta_id ? parseInt(modalData.conta_id) : undefined,
        data_aplicacao: new Date().toISOString().split('T')[0],
        observacoes: modalData.observacoes || `Adiantamento aplicado via simulador: economia estimada de ${formatCurrency(resultadoSimulacao?.economia?.juros || 0)}`
      };

      console.log('📤 Enviando adiantamento:', adiantamentoData);

      const resultado = await financiamentosApi.aplicarAdiantamento(adiantamentoData);

      console.log('✅ Adiantamento aplicado:', resultado);

      // Mostrar mensagem de sucesso específica para cada estratégia
      let mensagemSucesso = `✅ Adiantamento de ${formatCurrency(valorAdiantamento)} aplicado com sucesso!\n\n`;
      
      // Informações específicas por estratégia
      const estrategia = resultado.parcelas_recalculadas?.estrategia_aplicada;
      
      if (estrategia === 'amortizacao_extraordinaria') {
        mensagemSucesso += 
          `💰 AMORTIZAÇÃO EXTRAORDINÁRIA:\n` +
          `• Saldo anterior: ${formatCurrency(resultado.financiamento.saldo_anterior)}\n` +
          `• Saldo atual: ${formatCurrency(resultado.financiamento.saldo_atual)}\n` +
          `• Parcelas recalculadas: ${resultado.parcelas_recalculadas?.parcelas_atualizadas || 0}\n` +
          `• Parcelas removidas: ${resultado.parcelas_recalculadas?.parcelas_removidas || 0}\n` +
          `• Economia de juros significativa!`;
      } else if (estrategia === 'tras_para_frente') {
        mensagemSucesso += 
          `⏪ DE TRÁS PARA FRENTE:\n` +
          `• Últimas parcelas removidas: ${resultado.parcelas_recalculadas?.parcelas_removidas || 0}\n` +
          `• Parcelas restantes: ${resultado.parcelas_recalculadas?.total_parcelas_restantes || 0}\n` +
          `• Contrato termina ${resultado.parcelas_recalculadas?.parcelas_removidas || 0} meses antes!\n` +
          `• Valores das parcelas mantidos`;
             } else if (estrategia === 'frente_para_tras') {
         mensagemSucesso += 
           `⏩ DA FRENTE PARA TRÁS:\n` +
           `• Próximas parcelas pagas: ${resultado.parcelas_recalculadas?.parcelas_puladas || 0}\n` +
           `• Você fica ${resultado.parcelas_recalculadas?.parcelas_puladas || 0} meses sem pagar!\n` +
           `• Retoma pagamentos na parcela ${(resultado.parcelas_recalculadas?.parcelas_puladas || 0) + 1}\n` +
           `• Prazo total mantido`;
       } else if (estrategia === 'parcela_especifica') {
         const numeroParcelaEspecifica = simuladorAdiantamento.numeroParcela || 'N/A';
         if (resultado.parcelas_recalculadas?.parcelas_puladas > 0) {
           mensagemSucesso += 
             `🎯 PARCELA ESPECÍFICA:\n` +
             `• Parcela ${numeroParcelaEspecifica} paga completamente!\n` +
             `• Valor aplicado: ${formatCurrency(valorAdiantamento)}\n` +
             `• Status: Quitada antecipadamente`;
         } else {
           mensagemSucesso += 
             `🎯 PARCELA ESPECÍFICA:\n` +
             `• Parcela ${numeroParcelaEspecifica} com desconto aplicado\n` +
             `• Valor aplicado: ${formatCurrency(valorAdiantamento)}\n` +
             `• Novo valor da parcela será menor`;
         }
       }
      
      if (resultado.financiamento.quitado) {
        mensagemSucesso += '\n\n🎉 FINANCIAMENTO QUITADO COMPLETAMENTE!';
      }

      showSaveSuccess(mensagemSucesso);

      // Recarregar dados
      await carregarDados();

      // Fechar modal e limpar simulação
      setShowSimuladorModal(false);
      setMostrandoSimulacao(false);
      setResultadoSimulacao(null);
      setFinanciamentoSelecionado(null);

    } catch (error: any) {
      console.error('❌ Erro ao aplicar adiantamento:', error);
      showError(
        error.response?.data?.detail || 
        error.message || 
        'Erro desconhecido ao aplicar adiantamento'
      );
    } finally {
      setAplicandoAdiantamento(false);
    }
  };

  // Função para excluir financiamento
  const excluirFinanciamento = async (financiamento: Financiamento) => {
    const confirma = window.confirm(
      `🗑️ EXCLUIR FINANCIAMENTO\n\n` +
      `📋 Financiamento: ${financiamento.nome}\n` +
      `🏛️ Instituição: ${financiamento.instituicao}\n` +
      `💰 Saldo Devedor: ${formatCurrency(financiamento.saldoDevedor)}\n` +
      `📊 Parcelas Pagas: ${financiamento.parcelasPagas}/${financiamento.totalParcelas}\n\n` +
      `⚠️ ATENÇÃO:\n` +
      `• Esta ação não pode ser desfeita\n` +
      `• Todos os dados do financiamento serão perdidos\n` +
      `• Histórico de pagamentos será mantido nas transações\n\n` +
      `Tem certeza que deseja excluir este financiamento?`
    );

    if (!confirma) return;

    try {
      setExcluindoFinanciamento(financiamento.id);
      
      await financiamentosApi.excluirFinanciamento(financiamento.id);
      
      showDeleteSuccess(`Financiamento "${financiamento.nome}" excluído com sucesso!`);
      
      // Recarregar dados
      await carregarDados();
      
    } catch (error: any) {
      console.error('❌ Erro ao excluir financiamento:', error);
      showError(
        error.response?.data?.detail || 
        error.message || 
        'Erro desconhecido ao excluir financiamento'
      );
    } finally {
      setExcluindoFinanciamento(null);
    }
  };

  // Nova função integrada para confirmação de adiantamento
  const mostrarModalConfirmacaoIntegrada = (valorAdiantamento: number): Promise<{categoria_id: string, conta_id?: string, observacoes?: string} | null> => {
    return new Promise((resolve) => {
      const confirma = window.confirm(
        `💰 CONFIRMAR APLICAÇÃO DE ADIANTAMENTO\n\n` +
        `📋 Financiamento: ${financiamentoSelecionado?.nome}\n` +
        `🏛️ Instituição: ${financiamentoSelecionado?.instituicao}\n` +
        `💵 Valor do adiantamento: ${formatCurrency(valorAdiantamento)}\n` +
        `📊 Saldo atual: ${formatCurrency(financiamentoSelecionado?.saldoDevedor || 0)}\n` +
        `📊 Saldo após adiantamento: ${formatCurrency((financiamentoSelecionado?.saldoDevedor || 0) - valorAdiantamento)}\n\n` +
        `⚠️ Esta ação irá:\n` +
        `• Debitar R$ ${formatCurrency(valorAdiantamento)} da conta selecionada\n` +
        `• Reduzir o saldo devedor do financiamento\n` +
        `• Recalcular todas as parcelas restantes\n` +
        `• Criar histórico da alteração\n` +
        `• Criar uma transação de débito\n\n` +
        `Deseja continuar e selecionar categoria/conta?`
      );

      if (!confirma) {
        resolve(null);
        return;
      }

      // Agora solicitar categoria
      const categoriaId = prompt(
        `💳 SELECIONE A CATEGORIA PARA A TRANSAÇÃO:\n\n` +
        categorias.map((cat, index) => `${index + 1}. ${cat.nome}`).join('\n') +
        `\n\nDigite o número da categoria:`
      );

      if (!categoriaId || isNaN(parseInt(categoriaId)) || parseInt(categoriaId) < 1 || parseInt(categoriaId) > categorias.length) {
        resolve(null);
        return;
      }

      const categoriaSelecionada = categorias[parseInt(categoriaId) - 1];

      let contaId = '';
      if (contas.length > 0) {
        const contaPrompt = prompt(
          `🏦 SELECIONE A CONTA PARA DÉBITO (opcional):\n\n` +
          `0. Não especificar conta\n` +
          contas.map((conta, index) => `${index + 1}. ${conta.nome}`).join('\n') +
          `\n\nDigite o número da conta:`
        );

        if (contaPrompt && !isNaN(parseInt(contaPrompt)) && parseInt(contaPrompt) > 0 && parseInt(contaPrompt) <= contas.length) {
          contaId = contas[parseInt(contaPrompt) - 1].id.toString();
        }
      }

      resolve({
        categoria_id: categoriaSelecionada.id.toString(),
        conta_id: contaId || undefined,
        observacoes: `Adiantamento aplicado via simulador: ${simuladorAdiantamento.tipoAdiantamento}`
      });
    });
  };

  // Função auxiliar para mostrar modal de confirmação com categoria e conta
  const mostrarModalConfirmacao = (): Promise<{categoria_id: string, conta_id?: string, observacoes?: string} | null> => {
    return new Promise((resolve) => {
      // Por simplicidade, vamos usar prompt por enquanto
      // Em uma implementação mais completa, seria um modal React
      const categoriaId = prompt(
        `Selecione a categoria para a transação:\n\n` +
        categorias.map((cat, index) => `${index + 1}. ${cat.nome}`).join('\n') +
        `\n\nDigite o número da categoria:`
      );

      if (!categoriaId || isNaN(parseInt(categoriaId)) || parseInt(categoriaId) < 1 || parseInt(categoriaId) > categorias.length) {
        resolve(null);
        return;
      }

      const categoriaSelecionada = categorias[parseInt(categoriaId) - 1];

      let contaId = '';
      if (contas.length > 0) {
        const contaPrompt = prompt(
          `Selecione a conta para débito (opcional):\n\n` +
          `0. Não especificar conta\n` +
          contas.map((conta, index) => `${index + 1}. ${conta.nome}`).join('\n') +
          `\n\nDigite o número da conta:`
        );

        if (contaPrompt && !isNaN(parseInt(contaPrompt)) && parseInt(contaPrompt) > 0 && parseInt(contaPrompt) <= contas.length) {
          contaId = contas[parseInt(contaPrompt) - 1].id.toString();
        }
      }

      resolve({
        categoria_id: categoriaSelecionada.id.toString(),
        conta_id: contaId || undefined,
        observacoes: undefined
      });
    });
  };

  const criarFinanciamento = async () => {
    // Validações mais rigorosas
    if (!novoFinanciamento.descricao?.trim()) {
      showError('Por favor, preencha a descrição do financiamento.');
      return;
    }
    
    if (!novoFinanciamento.valor_total || parseFloat(novoFinanciamento.valor_total) <= 0) {
      showError('Por favor, informe um valor total válido.');
      return;
    }
    
    if (!novoFinanciamento.taxa_juros_anual || parseFloat(novoFinanciamento.taxa_juros_anual) <= 0) {
      showError('Por favor, informe uma taxa de juros válida.');
      return;
    }
    
    if (!novoFinanciamento.numero_parcelas || parseInt(novoFinanciamento.numero_parcelas) <= 0) {
      showError('Por favor, informe um número de parcelas válido.');
      return;
    }
    
    if (!novoFinanciamento.data_contratacao) {
      showError('Por favor, informe a data de contratação.');
      return;
    }
    
    if (!novoFinanciamento.data_primeira_parcela) {
      showError('Por favor, informe a data da primeira parcela.');
      return;
    }
    
    if (!novoFinanciamento.categoria_id) {
      showError('Por favor, selecione uma categoria.');
      return;
    }
    
    if (novoFinanciamento.auto_debito && !novoFinanciamento.conta_debito_id) {
      showError('Por favor, selecione uma conta para o débito automático.');
      return;
    }

    setSalvandoFinanciamento(true);
    try {
      const valorTotal = parseFloat(novoFinanciamento.valor_total);
      const valorEntrada = parseFloat(novoFinanciamento.valor_entrada) || 0;
      const valorFinanciado = valorTotal - valorEntrada;
      const taxaJurosAnual = parseFloat(novoFinanciamento.taxa_juros_anual);

      // Validar se valor financiado é positivo
      if (valorFinanciado <= 0) {
        showError('O valor financiado deve ser positivo. Verifique se o valor da entrada não é maior que o valor total.');
        return;
      }

      // Calcular valor da parcela baseado no sistema de amortização
      const numeroParcelas = parseInt(novoFinanciamento.numero_parcelas);
      const taxaJurosMensal = (taxaJurosAnual / 100) / 12;
      const taxaSeguroMensal = (parseFloat(novoFinanciamento.taxa_seguro_mensal) || 0) / 100;
      const taxaAdministrativa = parseFloat(novoFinanciamento.taxa_administrativa) || 0;
      
      let valorParcela = 0;
      let taxaJurosMensalCalculada = taxaJurosMensal;
      
      switch (novoFinanciamento.sistema_amortizacao) {
        case 'PRICE':
          // Fórmula PRICE: PMT = PV * [i * (1+i)^n] / [(1+i)^n - 1]
          valorParcela = (valorFinanciado * taxaJurosMensal * Math.pow(1 + taxaJurosMensal, numeroParcelas)) / 
                        (Math.pow(1 + taxaJurosMensal, numeroParcelas) - 1);
          break;
        case 'SAC':
          // SAC: Primeira parcela (amortização + juros)
          const amortizacaoSAC = valorFinanciado / numeroParcelas;
          valorParcela = amortizacaoSAC + (valorFinanciado * taxaJurosMensal);
          break;
        case 'SACRE':
          // SACRE: Simplificado como PRICE
          valorParcela = (valorFinanciado * taxaJurosMensal * Math.pow(1 + taxaJurosMensal, numeroParcelas)) / 
                        (Math.pow(1 + taxaJurosMensal, numeroParcelas) - 1);
          break;
        case 'AMERICANO':
          // AMERICANO: Só juros durante o período
          valorParcela = valorFinanciado * taxaJurosMensal;
          break;
        case 'BULLET':
          // BULLET: Sem pagamentos durante o período
          valorParcela = 0;
          break;
        default:
          valorParcela = (valorFinanciado * taxaJurosMensal * Math.pow(1 + taxaJurosMensal, numeroParcelas)) / 
                        (Math.pow(1 + taxaJurosMensal, numeroParcelas) - 1);
      }

      // Adicionar taxas adicionais ao valor da parcela
      const valorSeguro = valorFinanciado * taxaSeguroMensal; // Seguro sobre o saldo devedor
      valorParcela += valorSeguro + taxaAdministrativa;

      // Usar primeira conta disponível como padrão, ou omitir campo se não houver contas
      const contaPadrao = contas.length > 0 ? contas[0].id : null;

      const dadosFinanciamento = {
        descricao: novoFinanciamento.descricao,
        instituicao: novoFinanciamento.instituicao || null,
        numero_contrato: novoFinanciamento.numero_contrato || null,
        tipo_financiamento: novoFinanciamento.tipo_financiamento,
        sistema_amortizacao: novoFinanciamento.sistema_amortizacao,
        valor_total: valorTotal,
        valor_entrada: valorEntrada,
        valor_financiado: valorFinanciado,
        taxa_juros_anual: taxaJurosAnual,
        taxa_juros_mensal: taxaJurosMensalCalculada,
        numero_parcelas: numeroParcelas,
        valor_parcela: valorParcela,
        saldo_devedor: valorFinanciado,
        data_contratacao: novoFinanciamento.data_contratacao,
        data_primeira_parcela: novoFinanciamento.data_primeira_parcela,
        dia_vencimento: novoFinanciamento.dia_vencimento ? parseInt(novoFinanciamento.dia_vencimento) : null,
        categoria_id: parseInt(novoFinanciamento.categoria_id),
        ...(contaPadrao && { conta_id: contaPadrao }), // Só inclui se houver conta disponível
        conta_debito_id: novoFinanciamento.conta_debito_id ? parseInt(novoFinanciamento.conta_debito_id) : null,
        auto_debito: novoFinanciamento.auto_debito,
        taxa_seguro_mensal: parseFloat(novoFinanciamento.taxa_seguro_mensal) || 0,
        taxa_administrativa: parseFloat(novoFinanciamento.taxa_administrativa) || 0,
        observacoes: novoFinanciamento.observacoes || null
      };

      console.log('🔧 Dados que serão enviados para criação:', dadosFinanciamento);
      
      await financiamentosApi.create(dadosFinanciamento);
      
      // Resetar formulário
      setNovoFinanciamento({
        descricao: '',
        instituicao: '',
        numero_contrato: '',
        tipo_financiamento: 'pessoal',
        sistema_amortizacao: 'PRICE',
        valor_total: '',
        valor_entrada: '',
        taxa_juros_anual: '',
        numero_parcelas: '',
        data_contratacao: '',
        data_primeira_parcela: '',
        dia_vencimento: '',
        categoria_id: '',
        conta_debito_id: '',
        auto_debito: false,
        observacoes: '',
        taxa_seguro_mensal: '',
        taxa_administrativa: '',
        iof_percentual: ''
      });
      
      setShowNovoFinanciamentoModal(false);
      
      // Recarregar dados
      await carregarDados();
      
      showSaveSuccess('Financiamento criado com sucesso!');
    } catch (error: any) {
      console.error('❌ Erro ao criar financiamento:', error);
      console.error('❌ Resposta do servidor:', error?.response?.data);
      console.error('❌ Status:', error?.response?.status);
      
      let mensagemErro = 'Erro ao criar financiamento. Tente novamente.';
      if (error?.response?.data?.detail) {
        mensagemErro = `Erro: ${error.response.data.detail}`;
      } else if (error?.response?.status === 400) {
        mensagemErro = 'Dados inválidos. Verifique os campos preenchidos.';
      } else if (error?.response?.status === 500) {
        mensagemErro = 'Erro interno do servidor. Tente novamente mais tarde.';
      }
      
      showError(mensagemErro);
    } finally {
      setSalvandoFinanciamento(false);
    }
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
                onClick={() => setShowNovoFinanciamentoModal(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
              >
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
              { key: 'financiamentos', label: 'Meus Financiamentos', icon: Building2 }
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
                  {dashboard?.parcelas_mes_atual || 0} parcelas
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
                  <button 
                    onClick={() => setShowNovoFinanciamentoModal(true)}
                    className="btn-primary"
                  >
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
                  <button 
                    onClick={() => handleVerTabela(financiamento)}
                    className="btn-ghost text-sm"
                    title="Ver tabela de parcelas"
                  >
                    <FileText className="w-4 h-4" />
                    Tabela
                  </button>
                  <button 
                    onClick={() => handleSimular(financiamento)}
                    className="btn-ghost text-sm"
                    title="Simular adiantamento"
                  >
                    <Calculator className="w-4 h-4" />
                    Simular
                  </button>
                  <button 
                    onClick={() => handlePagar(financiamento)}
                    className="btn-secondary text-sm"
                    title="Registrar pagamento"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pagar
                  </button>
                  <button 
                    onClick={() => buscarHistoricoFinanciamento(financiamento.id)}
                    disabled={carregandoHistorico}
                    className="btn-ghost text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Ver histórico de alterações"
                  >
                    {carregandoHistorico ? (
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <BarChart3 className="w-4 h-4" />
                    )}
                    Histórico
                  </button>
                  <button 
                    onClick={() => excluirFinanciamento(financiamento)}
                    disabled={excluindoFinanciamento === financiamento.id}
                    className="btn-ghost text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Excluir financiamento"
                  >
                    {excluindoFinanciamento === financiamento.id ? (
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))
            )}
          </div>
        )}

        {false && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Simulador de Adiantamento</h3>
                  <p className="text-slate-600 dark:text-gray-400">Simule o impacto de adiantar parcelas dos seus financiamentos existentes</p>
                </div>
              </div>

              {/* Seleção do Financiamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Selecionar Financiamento *
                  </label>
                  <select
                    value={simuladorAdiantamento.financiamentoSelecionado}
                    onChange={(e) => {
                      const financiamentoId = e.target.value;
                      const financiamento = financiamentosAtivos.find(f => f.id.toString() === financiamentoId);
                      
                      if (financiamento) {
                        setSimuladorAdiantamento({
                          ...simuladorAdiantamento,
                          financiamentoSelecionado: financiamentoId,
                          valorFinanciado: financiamento.saldoDevedor.toString(),
                          taxaJurosAnual: financiamento.taxaJurosAnual.toString(),
                          numeroParcelas: (financiamento.totalParcelas - financiamento.parcelasPagas).toString(),
                          sistemaAmortizacao: financiamento.sistemaAmortizacao
                        });
                      }
                    }}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Selecione um financiamento...</option>
                    {financiamentosAtivos.map(financiamento => (
                      <option key={financiamento.id} value={financiamento.id}>
                        {financiamento.nome} - {financiamento.instituicao} 
                        ({formatCurrency(financiamento.saldoDevedor)} restante)
                      </option>
                    ))}
                  </select>
                  {financiamentosAtivos.length === 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                      ⚠️ Nenhum financiamento ativo encontrado. Crie um financiamento primeiro.
                    </p>
                  )}
                </div>

                {simuladorAdiantamento.financiamentoSelecionado && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                      <FileText className="w-4 h-4 mr-1" />
                      Resumo do Contrato
                    </h4>
                    {(() => {
                      const financiamento = financiamentosAtivos.find(f => f.id.toString() === simuladorAdiantamento.financiamentoSelecionado);
                      return financiamento ? (
                        <div className="text-sm space-y-1 text-blue-800 dark:text-blue-200">
                          <div>Saldo Devedor: <strong>{formatCurrency(financiamento.saldoDevedor)}</strong></div>
                          <div>Parcelas Restantes: <strong>{financiamento.totalParcelas - financiamento.parcelasPagas}</strong></div>
                          <div>Sistema: <strong>{financiamento.sistemaAmortizacao}</strong></div>
                          <div>Taxa: <strong>{financiamento.taxaJurosAnual}% a.a.</strong></div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>

              {/* Parâmetros do Adiantamento */}
              {simuladorAdiantamento.financiamentoSelecionado && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                      <DollarSign className="w-4 h-4 inline mr-1" />
                      Valor do Adiantamento (R$) *
                    </label>
                    <input
                      type="number"
                      placeholder="50000"
                      value={simuladorAdiantamento.valorAdiantamento}
                      onChange={(e) => setSimuladorAdiantamento({...simuladorAdiantamento, valorAdiantamento: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                      Valor que será adiantado para reduzir o saldo devedor
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Quando Aplicar o Adiantamento
                    </label>
                    <select
                      value={simuladorAdiantamento.tipoAdiantamento}
                      onChange={(e) => setSimuladorAdiantamento({...simuladorAdiantamento, tipoAdiantamento: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="proxima">Na Próxima Parcela</option>
                      <option value="parcela_especifica">Em Parcela Específica</option>
                      <option value="imediato">Aplicar Imediatamente</option>
                    </select>
                  </div>

                  {simuladorAdiantamento.tipoAdiantamento === 'parcela_especifica' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Número da Parcela
                      </label>
                      <input
                        type="number"
                        placeholder="12"
                        min="1"
                        max={(() => {
                          const financiamento = financiamentosAtivos.find(f => f.id.toString() === simuladorAdiantamento.financiamentoSelecionado);
                          return financiamento ? financiamento.totalParcelas - financiamento.parcelasPagas : 1;
                        })()}
                        value={simuladorAdiantamento.parcelaAdiantamento}
                        onChange={(e) => setSimuladorAdiantamento({...simuladorAdiantamento, parcelaAdiantamento: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-center">
                <button 
                  onClick={simularAdiantamento}
                  disabled={!simuladorAdiantamento.financiamentoSelecionado || !simuladorAdiantamento.valorAdiantamento}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 shadow-lg"
                >
                  <Calculator className="w-5 h-5" />
                  <span>Simular Adiantamento</span>
                </button>
              </div>
            </div>

            {/* Resultado da Simulação */}
            {mostrandoSimulacao && resultadoSimulacao && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                  <TrendingDown className="w-6 h-6 mr-2 text-green-600" />
                  Resultado da Simulação
                </h4>

                {/* Cards de Comparação */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Cenário Original */}
                  <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-2xl p-6 border border-red-200 dark:border-red-800">
                    <h5 className="text-lg font-bold text-red-900 dark:text-red-100 mb-4 flex items-center">
                      <Clock className="w-5 h-5 mr-2" />
                      Cenário Original
                    </h5>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-red-700 dark:text-red-300">Total de Juros:</span>
                        <span className="font-bold text-red-900 dark:text-red-100">
                          {formatCurrency(resultadoSimulacao.cenarioOriginal.totalJuros)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-700 dark:text-red-300">Total Pago:</span>
                        <span className="font-bold text-red-900 dark:text-red-100">
                          {formatCurrency(resultadoSimulacao.cenarioOriginal.totalPago)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-700 dark:text-red-300">Número de Parcelas:</span>
                        <span className="font-bold text-red-900 dark:text-red-100">
                          {resultadoSimulacao.cenarioOriginal.numeroParcelas}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cenário com Adiantamento */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl p-6 border border-green-200 dark:border-green-800">
                    <h5 className="text-lg font-bold text-green-900 dark:text-green-100 mb-4 flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      Com Adiantamento
                    </h5>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-green-700 dark:text-green-300">Total de Juros:</span>
                        <span className="font-bold text-green-900 dark:text-green-100">
                          {formatCurrency(resultadoSimulacao.cenarioComAdiantamento.totalJuros)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700 dark:text-green-300">Total Pago:</span>
                        <span className="font-bold text-green-900 dark:text-green-100">
                          {formatCurrency(resultadoSimulacao.cenarioComAdiantamento.totalPago)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700 dark:text-green-300">Número de Parcelas:</span>
                        <span className="font-bold text-green-900 dark:text-green-100">
                          {resultadoSimulacao.cenarioComAdiantamento.numeroParcelas}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card de Economia */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800 mb-6">
                  <h5 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4 flex items-center">
                    <Zap className="w-6 h-6 mr-2" />
                    💰 Economia Total
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-1">
                        {formatCurrency(resultadoSimulacao.economia.juros)}
                      </div>
                      <div className="text-blue-700 dark:text-blue-300 text-sm">Economia em Juros</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-1">
                        {resultadoSimulacao.economia.parcelasEconomizadas}
                      </div>
                      <div className="text-blue-700 dark:text-blue-300 text-sm">Parcelas Economizadas</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-1">
                        {resultadoSimulacao.economia.tempoEconomizado} anos
                      </div>
                      <div className="text-blue-700 dark:text-blue-300 text-sm">Tempo Economizado</div>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                      Economia de {resultadoSimulacao.economia.percentual.toFixed(1)}% nos juros totais
                    </div>
                  </div>
                </div>

                {/* Tabela de Parcelas */}
                <div className="bg-slate-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <h6 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Primeiras 12 Parcelas com Adiantamento
                  </h6>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-gray-600">
                          <th className="text-left py-2 text-slate-700 dark:text-gray-300">Parcela</th>
                          <th className="text-right py-2 text-slate-700 dark:text-gray-300">Valor Total</th>
                          <th className="text-right py-2 text-slate-700 dark:text-gray-300">Juros</th>
                          <th className="text-right py-2 text-slate-700 dark:text-gray-300">Amortização</th>
                          <th className="text-right py-2 text-slate-700 dark:text-gray-300">Adiantamento</th>
                          <th className="text-right py-2 text-slate-700 dark:text-gray-300">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultadoSimulacao.parcelas.map((parcela: any, index: number) => (
                          <tr key={index} className={`border-b border-slate-100 dark:border-gray-700 ${parcela.adiantamento > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}>
                            <td className="py-2 font-medium text-slate-900 dark:text-white">{parcela.numero}</td>
                            <td className="py-2 text-right text-slate-900 dark:text-white">
                              {formatCurrency(parcela.valorParcela)}
                            </td>
                            <td className="py-2 text-right text-red-600 dark:text-red-400">
                              {formatCurrency(parcela.valorJuros)}
                            </td>
                            <td className="py-2 text-right text-green-600 dark:text-green-400">
                              {formatCurrency(parcela.valorAmortizacao - parcela.adiantamento)}
                            </td>
                            <td className="py-2 text-right font-bold text-yellow-600 dark:text-yellow-400">
                              {parcela.adiantamento > 0 ? formatCurrency(parcela.adiantamento) : '-'}
                            </td>
                            <td className="py-2 text-right text-slate-900 dark:text-white">
                              {formatCurrency(Math.max(0, parcela.saldoAnterior - parcela.valorAmortizacao))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Seção para Aplicar o Adiantamento */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20 rounded-2xl p-6 border border-green-200 dark:border-green-800 mt-6">
                  <h5 className="text-xl font-bold text-green-900 dark:text-green-100 mb-4 flex items-center">
                    <CheckCircle className="w-6 h-6 mr-2" />
                    🎯 Aplicar Adiantamento
                  </h5>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4">
                    <p className="text-slate-700 dark:text-gray-300 mb-4">
                      <strong>Resumo:</strong> Você está simulando um adiantamento de{' '}
                      <span className="font-bold text-green-600">{formatCurrency(parseFloat(simuladorAdiantamento.valorAdiantamento) || 0)}</span>
                      {(() => {
                        const financiamento = financiamentosAtivos.find(f => f.id.toString() === simuladorAdiantamento.financiamentoSelecionado);
                        return financiamento ? ` no financiamento "${financiamento.nome}"` : '';
                      })()}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500 dark:text-gray-400">Economia em Juros:</span>
                        <div className="font-bold text-green-600">{formatCurrency(resultadoSimulacao.economia.juros)}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-gray-400">Parcelas Economizadas:</span>
                        <div className="font-bold text-blue-600">{resultadoSimulacao.economia.parcelasEconomizadas}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-gray-400">Tempo Economizado:</span>
                        <div className="font-bold text-purple-600">{resultadoSimulacao.economia.tempoEconomizado} anos</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => {
                        showInfo('🚧 Funcionalidade em desenvolvimento! Em breve você poderá aplicar adiantamentos diretamente no contrato.');
                      }}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>Aplicar Adiantamento</span>
                    </button>
                    
                    <button
                      onClick={() => setMostrandoSimulacao(false)}
                      className="flex-1 px-6 py-3 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-300 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                    >
                      <X className="w-5 h-5" />
                      <span>Nova Simulação</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}





        {/* Modal Novo Financiamento */}
        {showNovoFinanciamentoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Financiamento</h2>
                  <button
                    onClick={() => setShowNovoFinanciamentoModal(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-8">
                {/* Informações Básicas */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                    <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                    Informações Básicas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Descrição *
                      </label>
                      <input
                        type="text"
                        value={novoFinanciamento.descricao}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, descricao: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Ex: Financiamento Imóvel Rua das Flores"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Instituição Financeira
                      </label>
                      <input
                        type="text"
                        value={novoFinanciamento.instituicao}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, instituicao: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Ex: Banco do Brasil"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Número do Contrato
                      </label>
                      <input
                        type="text"
                        value={novoFinanciamento.numero_contrato}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, numero_contrato: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Ex: 123456789"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Tipo de Financiamento *
                      </label>
                      <select
                        value={novoFinanciamento.tipo_financiamento}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, tipo_financiamento: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="habitacional">🏠 Habitacional</option>
                        <option value="veiculo">🚗 Veículo</option>
                        <option value="pessoal">👤 Pessoal</option>
                        <option value="consignado">💼 Consignado</option>
                        <option value="estudantil">🎓 Estudantil</option>
                        <option value="rural">🚜 Rural</option>
                        <option value="empresarial">🏢 Empresarial</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Sistema de Amortização *
                      </label>
                      <select
                        value={novoFinanciamento.sistema_amortizacao}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, sistema_amortizacao: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="PRICE">PRICE (Parcelas Fixas)</option>
                        <option value="SAC">SAC (Parcelas Decrescentes)</option>
                        <option value="SACRE">SACRE (Misto)</option>
                        <option value="AMERICANO">AMERICANO (Só Juros)</option>
                        <option value="BULLET">BULLET (Pagamento Único)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Valores e Taxas */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                    Valores e Taxas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Valor Total *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={novoFinanciamento.valor_total}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, valor_total: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Ex: 350000.00"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Valor da Entrada
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={novoFinanciamento.valor_entrada}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, valor_entrada: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Ex: 70000.00"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Taxa de Juros (% ao ano) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={novoFinanciamento.taxa_juros_anual}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, taxa_juros_anual: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Ex: 8.5"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Número de Parcelas *
                      </label>
                      <input
                        type="number"
                        value={novoFinanciamento.numero_parcelas}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, numero_parcelas: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Ex: 360"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Dia do Vencimento
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={novoFinanciamento.dia_vencimento}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, dia_vencimento: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Ex: 15"
                      />
                    </div>
                  </div>
                </div>

                {/* Datas */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-purple-600" />
                    Datas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Data da Contratação *
                      </label>
                      <input
                        type="date"
                        value={novoFinanciamento.data_contratacao}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, data_contratacao: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Data da Primeira Parcela *
                      </label>
                      <input
                        type="date"
                        value={novoFinanciamento.data_primeira_parcela}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, data_primeira_parcela: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Configurações */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                    <FileCheck className="w-5 h-5 mr-2 text-indigo-600" />
                    Configurações
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Categoria *
                      </label>
                      <select
                        value={novoFinanciamento.categoria_id}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, categoria_id: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Selecione uma categoria...</option>
                        {categorias.map((categoria) => (
                          <option key={categoria.id} value={categoria.id}>
                            {categoria.nome}
                          </option>
                        ))}
                      </select>
                      {categorias.length === 0 && (
                        <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                          ⚠️ Nenhuma categoria encontrada. Crie uma categoria primeiro.
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="auto_debito"
                          checked={novoFinanciamento.auto_debito}
                          onChange={(e) => setNovoFinanciamento({...novoFinanciamento, auto_debito: e.target.checked, conta_debito_id: e.target.checked ? novoFinanciamento.conta_debito_id : ''})}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor="auto_debito" className="text-sm font-medium text-slate-700 dark:text-gray-300">
                          Débito Automático
                        </label>
                      </div>
                      
                      {/* Campo de seleção de conta - só aparece quando débito automático está ativado */}
                      {novoFinanciamento.auto_debito && (
                        <div className="pl-7">
                          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                            Conta para Débito *
                          </label>
                          <select
                            value={novoFinanciamento.conta_debito_id}
                            onChange={(e) => setNovoFinanciamento({...novoFinanciamento, conta_debito_id: e.target.value})}
                            className="w-full px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          >
                            <option value="">Selecione a conta para débito...</option>
                            {contas.map((conta) => (
                              <option key={conta.id} value={conta.id}>
                                {conta.nome} - {conta.banco} ({conta.tipo})
                              </option>
                            ))}
                          </select>
                          {contas.length === 0 && (
                            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                              ⚠️ Nenhuma conta encontrada. Crie uma conta primeiro para usar débito automático.
                            </p>
                          )}
                          {novoFinanciamento.auto_debito && !novoFinanciamento.conta_debito_id && contas.length > 0 && (
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                              ⚠️ Selecione uma conta para o débito automático.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Observações
                      </label>
                      <textarea
                        value={novoFinanciamento.observacoes}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, observacoes: e.target.value})}
                        rows={3}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Informações adicionais sobre o financiamento..."
                      />
                    </div>
                  </div>
                </div>

                {/* Taxas Adicionais (Opcional) */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                      <DollarSign className="w-5 h-5 mr-2 text-orange-600" />
                      Taxas Adicionais
                      <span className="text-xs text-slate-500 dark:text-gray-400 ml-2">(Opcional)</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setMostrarTaxasAdicionais(!mostrarTaxasAdicionais)}
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
                    >
                      {mostrarTaxasAdicionais ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      <span>{mostrarTaxasAdicionais ? 'Ocultar' : 'Mostrar'} Taxas</span>
                    </button>
                  </div>
                  
                  {mostrarTaxasAdicionais && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                          Taxa de Seguro (% a.m.)
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          value={novoFinanciamento.taxa_seguro_mensal}
                          onChange={(e) => setNovoFinanciamento({...novoFinanciamento, taxa_seguro_mensal: e.target.value})}
                          className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          placeholder="Ex: 0.0234"
                        />
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                          Seguro prestamista mensal
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                          Taxa Administrativa (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={novoFinanciamento.taxa_administrativa}
                          onChange={(e) => setNovoFinanciamento({...novoFinanciamento, taxa_administrativa: e.target.value})}
                          className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          placeholder="Ex: 25.00"
                        />
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                          Taxa fixa mensal de administração
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                          IOF (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={novoFinanciamento.iof_percentual}
                          onChange={(e) => setNovoFinanciamento({...novoFinanciamento, iof_percentual: e.target.value})}
                          className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          placeholder="Ex: 0.38"
                        />
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                          Imposto sobre Operações Financeiras
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Preview dos Cálculos */}
                {novoFinanciamento.valor_total && novoFinanciamento.taxa_juros_anual && novoFinanciamento.numero_parcelas && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Preview dos Cálculos</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setMostrarTabelaAmortizacao(!mostrarTabelaAmortizacao);
                          if (!mostrarTabelaAmortizacao) {
                            atualizarTabelaAmortizacao();
                          }
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors flex items-center space-x-1"
                      >
                        {mostrarTabelaAmortizacao ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{mostrarTabelaAmortizacao ? 'Ocultar' : 'Ver'} Parcelas</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-blue-700 dark:text-blue-300">Valor Financiado:</span>
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          {formatCurrency((parseFloat(novoFinanciamento.valor_total) || 0) - (parseFloat(novoFinanciamento.valor_entrada) || 0))}
                        </p>
                      </div>
                      <div>
                        <span className="text-blue-700 dark:text-blue-300">Taxa Mensal:</span>
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          {((parseFloat(novoFinanciamento.taxa_juros_anual) || 0) / 12).toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <span className="text-blue-700 dark:text-blue-300">Prazo:</span>
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          {Math.round((parseInt(novoFinanciamento.numero_parcelas) || 0) / 12)} anos
                        </p>
                      </div>
                      <div>
                        <span className="text-blue-700 dark:text-blue-300">Sistema:</span>
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          {novoFinanciamento.sistema_amortizacao}
                        </p>
                      </div>
                    </div>

                    {/* Tabela de Amortização */}
                    {mostrarTabelaAmortizacao && tabelaAmortizacao.length > 0 && (
                      <div className="mt-4 border-t border-blue-200 dark:border-blue-700 pt-4">
                        <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
                          Primeiras 12 Parcelas - Sistema {novoFinanciamento.sistema_amortizacao}
                        </h5>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-blue-100 dark:bg-blue-800/30">
                                <th className="px-2 py-2 text-left text-blue-900 dark:text-blue-100">Nº</th>
                                <th className="px-2 py-2 text-left text-blue-900 dark:text-blue-100">Data</th>
                                <th className="px-2 py-2 text-right text-blue-900 dark:text-blue-100">Saldo Anterior</th>
                                <th className="px-2 py-2 text-right text-blue-900 dark:text-blue-100">Parcela</th>
                                <th className="px-2 py-2 text-right text-blue-900 dark:text-blue-100">Juros</th>
                                <th className="px-2 py-2 text-right text-blue-900 dark:text-blue-100">Amortização</th>
                                <th className="px-2 py-2 text-right text-blue-900 dark:text-blue-100">Saldo Posterior</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tabelaAmortizacao.map((parcela, index) => (
                                <tr key={index} className={index % 2 === 0 ? 'bg-blue-25 dark:bg-blue-900/10' : ''}>
                                  <td className="px-2 py-2 text-blue-900 dark:text-blue-100">{parcela.numero}</td>
                                  <td className="px-2 py-2 text-blue-900 dark:text-blue-100">{formatDate(parcela.dataVencimento)}</td>
                                  <td className="px-2 py-2 text-right text-blue-900 dark:text-blue-100">{formatCurrency(parcela.saldoAnterior)}</td>
                                  <td className="px-2 py-2 text-right font-medium text-blue-900 dark:text-blue-100">{formatCurrency(parcela.valorParcela)}</td>
                                  <td className="px-2 py-2 text-right text-red-600 dark:text-red-400">{formatCurrency(parcela.valorJuros)}</td>
                                  <td className="px-2 py-2 text-right text-green-600 dark:text-green-400">{formatCurrency(parcela.valorAmortizacao)}</td>
                                  <td className="px-2 py-2 text-right text-blue-900 dark:text-blue-100">{formatCurrency(parcela.saldoPosterior)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        {parseInt(novoFinanciamento.numero_parcelas) > 12 && (
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 text-center">
                            ... e mais {parseInt(novoFinanciamento.numero_parcelas) - 12} parcelas
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-gray-700 flex justify-end space-x-4">
                <button
                  onClick={() => setShowNovoFinanciamentoModal(false)}
                  className="px-6 py-3 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={criarFinanciamento}
                  disabled={salvandoFinanciamento}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  {salvandoFinanciamento ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Criar Financiamento</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Tabela de Parcelas */}
        {showTabelaModal && financiamentoSelecionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      Tabela de Parcelas - {financiamentoSelecionado.nome}
                    </h2>
                    <p className="text-slate-600 dark:text-gray-400">
                      {financiamentoSelecionado.instituicao} • Sistema {financiamentoSelecionado.sistemaAmortizacao}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTabelaModal(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Resumo do Financiamento */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">Saldo Devedor</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {formatCurrency(financiamentoSelecionado.saldoDevedor)}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-300">Parcelas Restantes</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {financiamentoSelecionado.totalParcelas - financiamentoSelecionado.parcelasPagas}
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                    <p className="text-sm text-purple-700 dark:text-purple-300">Valor da Parcela</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {formatCurrency(financiamentoSelecionado.valorParcelaAtual)}
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                    <p className="text-sm text-orange-700 dark:text-orange-300">Taxa Anual</p>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {financiamentoSelecionado.taxaJurosAnual}%
                    </p>
                  </div>
                </div>

                {/* Tabela de Parcelas */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-gray-300">Nº</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-gray-300">Vencimento</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-slate-700 dark:text-gray-300">Valor Parcela</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-slate-700 dark:text-gray-300">Juros</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-slate-700 dark:text-gray-300">Amortização</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-slate-700 dark:text-gray-300">Saldo Devedor</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-slate-700 dark:text-gray-300">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                        {tabelaParcelasFinanciamento.length > 0 ? tabelaParcelasFinanciamento.map((parcela, index) => (
                          <tr key={index} className="hover:bg-slate-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                              {parcela.numero_parcela || parcela.numero || (index + 1)}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                              {formatDate(parcela.data_vencimento || parcela.dataVencimento)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-slate-900 dark:text-white">
                              {formatCurrency(parcela.valor_parcela || parcela.valorParcela)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                              {formatCurrency(parcela.valor_juros || parcela.valorJuros)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                              {formatCurrency(parcela.valor_amortizacao || parcela.valorAmortizacao)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-slate-900 dark:text-white">
                              {formatCurrency(parcela.saldo_devedor || parcela.saldoPosterior)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                (parcela.status || 'pendente') === 'pago' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              }`}>
                                {parcela.status || 'Pendente'}
                              </span>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-gray-400">
                              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p>Nenhuma parcela encontrada</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Histórico */}
        {mostrarHistorico && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                      <BarChart3 className="w-7 h-7 mr-3 text-blue-600" />
                      Histórico de Alterações
                    </h2>
                    <p className="text-slate-600 dark:text-gray-400">
                      Registro de todas as modificações realizadas no financiamento
                    </p>
                  </div>
                  <button
                    onClick={() => setMostrarHistorico(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {carregandoHistorico ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-gray-400">Carregando histórico...</p>
                  </div>
                ) : historicoFinanciamento.length > 0 ? (
                  <div className="space-y-4">
                    {historicoFinanciamento.map((item, index) => (
                      <div key={item.id} className="bg-white dark:bg-gray-700 rounded-xl p-6 border border-slate-200 dark:border-gray-600 shadow-sm">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              item.tipo_operacao === 'adiantamento' 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                : item.tipo_operacao === 'pagamento_parcela'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                            }`}>
                              {item.tipo_operacao === 'adiantamento' && <TrendingUp className="w-5 h-5" />}
                              {item.tipo_operacao === 'pagamento_parcela' && <CreditCard className="w-5 h-5" />}
                              {item.tipo_operacao === 'criacao' && <Plus className="w-5 h-5" />}
                              {item.tipo_operacao === 'exclusao' && <X className="w-5 h-5" />}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 dark:text-white capitalize">
                                {item.tipo_operacao.replace('_', ' ')}
                              </h3>
                              <p className="text-sm text-slate-500 dark:text-gray-400">
                                {new Date(item.data_alteracao).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          {item.valor_operacao && (
                            <div className="text-right">
                              <p className="text-sm text-slate-500 dark:text-gray-400">Valor da Operação</p>
                              <p className="font-bold text-lg text-green-600 dark:text-green-400">
                                {formatCurrency(item.valor_operacao)}
                              </p>
                            </div>
                          )}
                        </div>

                        <p className="text-slate-700 dark:text-gray-300 mb-4">
                          {item.descricao}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {item.saldo_devedor_anterior && item.saldo_devedor_novo && (
                            <div className="bg-slate-50 dark:bg-gray-800 rounded-lg p-3">
                              <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Saldo Devedor</p>
                              <div className="flex items-center space-x-2">
                                <span className="text-red-600 dark:text-red-400">
                                  {formatCurrency(item.saldo_devedor_anterior)}
                                </span>
                                <ArrowDownRight className="w-4 h-4 text-slate-400" />
                                <span className="text-green-600 dark:text-green-400 font-bold">
                                  {formatCurrency(item.saldo_devedor_novo)}
                                </span>
                              </div>
                            </div>
                          )}

                          {item.parcelas_pagas_anterior !== null && item.parcelas_pagas_novo !== null && (
                            <div className="bg-slate-50 dark:bg-gray-800 rounded-lg p-3">
                              <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Parcelas Pagas</p>
                              <div className="flex items-center space-x-2">
                                <span className="text-slate-600 dark:text-gray-400">
                                  {item.parcelas_pagas_anterior}
                                </span>
                                <ArrowDownRight className="w-4 h-4 text-slate-400" />
                                <span className="text-blue-600 dark:text-blue-400 font-bold">
                                  {item.parcelas_pagas_novo}
                                </span>
                              </div>
                            </div>
                          )}

                          {item.economia_juros && item.economia_juros > 0 && (
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Economia de Juros</p>
                              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                {formatCurrency(item.economia_juros)}
                              </p>
                            </div>
                          )}
                        </div>

                        {item.dados_adicionais && (
                          <details className="mt-4">
                            <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                              Detalhes técnicos
                            </summary>
                            <pre className="mt-2 text-xs bg-slate-100 dark:bg-gray-800 rounded p-3 overflow-x-auto text-slate-600 dark:text-gray-400">
                              {JSON.stringify(JSON.parse(item.dados_adicionais), null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-gray-600" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                      Nenhum histórico encontrado
                    </h3>
                    <p className="text-slate-500 dark:text-gray-400">
                      Este financiamento ainda não possui alterações registradas.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Pagamento */}
        {showPagamentoModal && financiamentoSelecionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl">
              <div className="p-6 border-b border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      Registrar Pagamento
                    </h2>
                    <p className="text-slate-600 dark:text-gray-400">
                      {financiamentoSelecionado.nome} • {financiamentoSelecionado.instituicao}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPagamentoModal(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {carregandoParcela ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-gray-400">Carregando dados da parcela...</p>
                  </div>
                ) : proximaParcela ? (
                  <>
                    {/* Dados da Próxima Parcela */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800 mb-6">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-blue-900 dark:text-blue-100">Próxima Parcela</h3>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Vencimento: {formatDate(proximaParcela.data_vencimento)}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Valor da Parcela:</span>
                          <p className="font-bold text-blue-900 dark:text-blue-100 text-lg">
                            {formatCurrency(proximaParcela.valor_parcela)}
                          </p>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Parcela:</span>
                          <p className="font-bold text-blue-900 dark:text-blue-100">
                            {proximaParcela.numero_parcela} / {financiamentoSelecionado.totalParcelas}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Formulário de Pagamento */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                            Valor Pago (R$) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formPagamento.valor_pago}
                            onChange={(e) => setFormPagamento({...formPagamento, valor_pago: e.target.value})}
                            className="w-full px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            placeholder="Ex: 1500.00"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                            Data do Pagamento *
                          </label>
                          <input
                            type="date"
                            value={formPagamento.data_pagamento}
                            onChange={(e) => setFormPagamento({...formPagamento, data_pagamento: e.target.value})}
                            className="w-full px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                            Categoria *
                          </label>
                          <select
                            value={formPagamento.categoria_id}
                            onChange={(e) => setFormPagamento({...formPagamento, categoria_id: e.target.value})}
                            className="w-full px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          >
                            <option value="">Selecione uma categoria...</option>
                            {categorias.map(categoria => (
                              <option key={categoria.id} value={categoria.id}>
                                {categoria.nome}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                            Conta (Opcional)
                          </label>
                          <select
                            value={formPagamento.conta_id}
                            onChange={(e) => setFormPagamento({...formPagamento, conta_id: e.target.value})}
                            className="w-full px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          >
                            <option value="">Selecione uma conta...</option>
                            {contas.map(conta => (
                              <option key={conta.id} value={conta.id}>
                                {conta.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                          Observações
                        </label>
                        <textarea
                          value={formPagamento.observacoes}
                          onChange={(e) => setFormPagamento({...formPagamento, observacoes: e.target.value})}
                          className="w-full px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          rows={3}
                          placeholder="Observações sobre o pagamento..."
                        />
                      </div>
                    </div>

                    {/* Botões */}
                    <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-slate-200 dark:border-gray-700">
                      <button
                        onClick={() => setShowPagamentoModal(false)}
                        className="px-6 py-3 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 font-medium transition-colors"
                        disabled={salvandoPagamento}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={processarPagamento}
                        disabled={salvandoPagamento || !formPagamento.categoria_id || !formPagamento.valor_pago}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                      >
                        {salvandoPagamento ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Processando...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Registrar Pagamento</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                      Erro ao Carregar Parcela
                    </h3>
                    <p className="text-slate-600 dark:text-gray-400 mb-6">
                      Não foi possível carregar os dados da próxima parcela.
                    </p>
                    <button
                      onClick={() => setShowPagamentoModal(false)}
                      className="btn-primary"
                    >
                      Fechar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Simulador */}
        {showSimuladorModal && financiamentoSelecionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      Simular Adiantamento
                    </h2>
                    <p className="text-slate-600 dark:text-gray-400">
                      {financiamentoSelecionado.nome} • {financiamentoSelecionado.instituicao}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSimuladorModal(false);
                      setMostrandoSimulacao(false);
                    }}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                {/* Formulário de Simulação */}
                <div className="space-y-6">
                  {/* Informações do Financiamento Selecionado */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-blue-900 dark:text-blue-100">Financiamento Selecionado</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          {financiamentoSelecionado?.nome} • {financiamentoSelecionado?.instituicao}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-blue-700 dark:text-blue-300">Saldo Devedor:</span>
                        <p className="font-bold text-blue-900 dark:text-blue-100">
                          {formatCurrency(financiamentoSelecionado?.saldoDevedor || 0)}
                        </p>
                      </div>
                      <div>
                        <span className="text-blue-700 dark:text-blue-300">Parcelas Restantes:</span>
                        <p className="font-bold text-blue-900 dark:text-blue-100">
                          {financiamentoSelecionado ? financiamentoSelecionado.totalParcelas - financiamentoSelecionado.parcelasPagas : 0}
                        </p>
                      </div>
                      <div>
                        <span className="text-blue-700 dark:text-blue-300">Taxa de Juros:</span>
                        <p className="font-bold text-blue-900 dark:text-blue-100">
                          {financiamentoSelecionado?.taxaJurosAnual}% a.a.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Formulário de Adiantamento */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Valor do Adiantamento (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={simuladorAdiantamento.valorAdiantamento}
                        onChange={(e) => setSimuladorAdiantamento({...simuladorAdiantamento, valorAdiantamento: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Ex: 50000.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                        Tipo de Adiantamento *
                      </label>
                      <select
                        value={simuladorAdiantamento.tipoAdiantamento}
                        onChange={(e) => setSimuladorAdiantamento({...simuladorAdiantamento, tipoAdiantamento: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="amortizacao_extraordinaria">💰 Amortização Extraordinária (Reduz Saldo)</option>
                        <option value="tras_para_frente">⏪ De Trás para Frente (Remove Últimas Parcelas)</option>
                        <option value="frente_para_tras">⏩ Da Frente para Trás (Pula Próximas Parcelas)</option>
                        <option value="parcela_especifica">🎯 Aplicar em Parcela Específica</option>
                      </select>
                      
                      {/* Explicação do tipo selecionado */}
                      <div className="mt-2 p-3 bg-slate-50 dark:bg-gray-700 rounded-lg border border-slate-200 dark:border-gray-600">
                        <div className="text-sm text-slate-700 dark:text-gray-300">
                          {simuladorAdiantamento.tipoAdiantamento === 'amortizacao_extraordinaria' && (
                            <div>
                              <strong>💰 Amortização Extraordinária:</strong><br/>
                              Aplica o valor direto no saldo devedor. Reduz drasticamente os juros futuros e pode diminuir o prazo total.
                            </div>
                          )}
                          {simuladorAdiantamento.tipoAdiantamento === 'tras_para_frente' && (
                            <div>
                              <strong>⏪ De Trás para Frente:</strong><br/>
                              Considera como pagamento das últimas parcelas. Remove parcelas do final do contrato, terminando antes.
                            </div>
                          )}
                          {simuladorAdiantamento.tipoAdiantamento === 'frente_para_tras' && (
                            <div>
                              <strong>⏩ Da Frente para Trás:</strong><br/>
                              Pula as próximas parcelas antecipadamente. O sistema reorganiza os vencimentos - você fica alguns meses sem pagar, e as parcelas seguintes são reagendadas para datas mais próximas. O prazo total é mantido, mas o cronograma é compactado.
                              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                <span className="text-blue-700 dark:text-blue-300 text-xs">
                                  💡 <strong>Exemplo:</strong> Com R$ 3.000 (equivale a 3 parcelas), você pula Fev/Mar/Abr e as parcelas seguintes são reorganizadas para começar em Maio.
                                </span>
                              </div>
                            </div>
                          )}
                          {simuladorAdiantamento.tipoAdiantamento === 'parcela_especifica' && (
                            <div>
                              <strong>🎯 Parcela Específica:</strong><br/>
                              Aplica o adiantamento em uma parcela escolhida por você. Útil para situações específicas.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {simuladorAdiantamento.tipoAdiantamento === 'parcela_especifica' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                          Número da Parcela
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={financiamentoSelecionado ? financiamentoSelecionado.totalParcelas - financiamentoSelecionado.parcelasPagas : 1}
                          value={simuladorAdiantamento.parcelaAdiantamento}
                          onChange={(e) => setSimuladorAdiantamento({...simuladorAdiantamento, parcelaAdiantamento: e.target.value})}
                          className="w-full px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          placeholder="Ex: 12"
                        />
                      </div>
                    )}
                  </div>

                  {/* Botão de Simular */}
                  <div className="flex justify-center">
                    <button
                      onClick={simularAdiantamento}
                      disabled={!simuladorAdiantamento.valorAdiantamento}
                      className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <Calculator className="w-5 h-5" />
                      <span>Simular Adiantamento</span>
                    </button>
                  </div>

                  {/* Resultados da Simulação */}
                  {mostrandoSimulacao && resultadoSimulacao && (
                    <div className="bg-slate-50 dark:bg-gray-700/50 rounded-xl p-6 border border-slate-200 dark:border-gray-600">
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                        Resultados da Simulação
                      </h4>

                      {/* Comparação de Cenários */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* Cenário Original */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-slate-200 dark:border-gray-700">
                          <h5 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-2 text-orange-600" />
                            Cenário Atual
                          </h5>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-gray-400">Total Juros:</span>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {formatCurrency(resultadoSimulacao.cenarioOriginal.totalJuros)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-gray-400">Total Pago:</span>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {formatCurrency(resultadoSimulacao.cenarioOriginal.totalPago)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-gray-400">Parcelas:</span>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {resultadoSimulacao.cenarioOriginal.numeroParcelas}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Cenário com Adiantamento */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200 dark:border-green-800">
                          <h5 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center">
                            <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                            Com Adiantamento
                          </h5>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-gray-400">Total Juros:</span>
                              <span className="font-medium text-green-600">
                                {formatCurrency(resultadoSimulacao.cenarioComAdiantamento.totalJuros)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-gray-400">Total Pago:</span>
                              <span className="font-medium text-green-600">
                                {formatCurrency(resultadoSimulacao.cenarioComAdiantamento.totalPago)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-gray-400">Parcelas:</span>
                              <span className="font-medium text-green-600">
                                {resultadoSimulacao.cenarioComAdiantamento.numeroParcelas}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Resumo de Economia */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800 mb-6">
                        <h5 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center">
                          <Target className="w-4 h-4 mr-2" />
                          Economia Projetada
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {formatCurrency(resultadoSimulacao.economia.juros)}
                            </div>
                            <div className="text-green-700 dark:text-green-300">Economia em Juros</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {resultadoSimulacao.economia.parcelasEconomizadas}
                            </div>
                            <div className="text-blue-700 dark:text-blue-300">Parcelas a Menos</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              {resultadoSimulacao.economia.tempoEconomizado} anos
                            </div>
                            <div className="text-purple-700 dark:text-purple-300">Tempo Economizado</div>
                          </div>
                        </div>
                        <div className="text-center mt-4">
                          <div className="text-lg font-semibold text-green-800 dark:text-green-200">
                            Economia de {resultadoSimulacao.economia.percentual.toFixed(1)}% nos juros totais
                          </div>
                        </div>
                      </div>

                      {/* Nova Tabela de Amortização (Primeiras Parcelas) */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-gray-700">
                          <h5 className="font-semibold text-slate-900 dark:text-white flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-blue-600" />
                            Nova Tabela de Amortização (Primeiras 12 parcelas)
                          </h5>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-3 py-2 text-left text-slate-700 dark:text-gray-300">Nº</th>
                                <th className="px-3 py-2 text-right text-slate-700 dark:text-gray-300">Valor Parcela</th>
                                <th className="px-3 py-2 text-right text-slate-700 dark:text-gray-300">Juros</th>
                                <th className="px-3 py-2 text-right text-slate-700 dark:text-gray-300">Amortização</th>
                                <th className="px-3 py-2 text-right text-slate-700 dark:text-gray-300">Saldo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                              {resultadoSimulacao.parcelas.map((parcela: any, index: number) => (
                                <tr key={index} className={`hover:bg-slate-50 dark:hover:bg-gray-700 ${parcela.adiantamento > 0 ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                                  <td className="px-3 py-2 text-slate-900 dark:text-white">
                                    {parcela.numero}
                                    {parcela.adiantamento > 0 && <span className="ml-1 text-green-600">💰</span>}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-white">
                                    {formatCurrency(parcela.valorParcela)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">
                                    {formatCurrency(parcela.valorJuros)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">
                                    {formatCurrency(parcela.valorAmortizacao)}
                                    {parcela.adiantamento > 0 && (
                                      <div className="text-xs text-green-700 dark:text-green-300">
                                        +{formatCurrency(parcela.adiantamento)} adiant.
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-900 dark:text-white">
                                    {formatCurrency(parcela.saldoDevedor)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex flex-col sm:flex-row gap-3 mt-6">
                        <button
                          onClick={aplicarAdiantamentoReal}
                          disabled={!simuladorAdiantamento.valorAdiantamento || !categorias.length || aplicandoAdiantamento}
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg"
                        >
                          {aplicandoAdiantamento ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Aplicando...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-5 h-5" />
                              <span>Aplicar Adiantamento</span>
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => setMostrandoSimulacao(false)}
                          className="flex-1 px-6 py-3 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-300 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                        >
                          <Calculator className="w-5 h-5" />
                          <span>Nova Simulação</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast Container */}
        <ToastContainer
          toasts={toasts}
          onRemoveToast={removeToast}
        />
      </div>
    </div>
  );
} 