import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { financiamentosApi, categoriasApi } from '../services/api';
import Navigation from '../components/Navigation';
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
    tipoAdiantamento: 'proxima'
  });
  const [resultadoSimulacao, setResultadoSimulacao] = useState<any>(null);
  const [mostrandoSimulacao, setMostrandoSimulacao] = useState(false);
  const [categorias, setCategorias] = useState<any[]>([]);

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
      const [financiamentosData, dashboardData, vencimentosData, categoriasData] = await Promise.all([
        financiamentosApi.getAll(),
        financiamentosApi.getDashboard(),
        financiamentosApi.getProximosVencimentos(30),
        categoriasApi.getAll().catch(() => [])
      ]);
      
      // Converter dados da API para formato da interface
      const financiamentosConvertidos = financiamentosData.map((f: FinanciamentoAPI) => converterFinanciamentoAPI(f));
      
      setFinanciamentos(financiamentosConvertidos);
      setDashboard(dashboardData);
      setProximosVencimentos(vencimentosData);
      setCategorias(categoriasData || []);
      
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

  // Função para simular adiantamento de parcelas
  const simularAdiantamento = () => {
    const valorFinanciado = parseFloat(simuladorAdiantamento.valorFinanciado);
    const taxaJurosAnual = parseFloat(simuladorAdiantamento.taxaJurosAnual);
    const numeroParcelas = parseInt(simuladorAdiantamento.numeroParcelas);
    const valorAdiantamento = parseFloat(simuladorAdiantamento.valorAdiantamento);
    const parcelaAdiantamento = parseInt(simuladorAdiantamento.parcelaAdiantamento);

    if (!valorFinanciado || !taxaJurosAnual || !numeroParcelas || !valorAdiantamento || !parcelaAdiantamento) {
      alert('Por favor, preencha todos os campos da simulação.');
      return;
    }

    const taxaMensal = (taxaJurosAnual / 100) / 12;
    
    // Calcular cenário original (sem adiantamento)
    const tabelaOriginal = calcularTabelaAmortizacao(
      valorFinanciado,
      taxaJurosAnual,
      numeroParcelas,
      simuladorAdiantamento.sistemaAmortizacao,
      simuladorAdiantamento.dataInicio
    );

    // Calcular cenário com adiantamento
    let saldoDevedor = valorFinanciado;
    let totalJurosOriginal = 0;
    let totalJurosComAdiantamento = 0;
    let parcelasOriginais = [];
    let parcelasComAdiantamento = [];
    
    // Calcular até a parcela do adiantamento
    for (let i = 1; i <= numeroParcelas; i++) {
      let valorParcela = 0;
      let valorJuros = 0;
      let valorAmortizacao = 0;

      switch (simuladorAdiantamento.sistemaAmortizacao) {
        case 'PRICE':
          valorParcela = (valorFinanciado * taxaMensal * Math.pow(1 + taxaMensal, numeroParcelas)) / 
                        (Math.pow(1 + taxaMensal, numeroParcelas) - 1);
          valorJuros = saldoDevedor * taxaMensal;
          valorAmortizacao = valorParcela - valorJuros;
          break;
        case 'SAC':
          valorAmortizacao = valorFinanciado / numeroParcelas;
          valorJuros = saldoDevedor * taxaMensal;
          valorParcela = valorAmortizacao + valorJuros;
          break;
        default:
          valorParcela = (valorFinanciado * taxaMensal * Math.pow(1 + taxaMensal, numeroParcelas)) / 
                        (Math.pow(1 + taxaMensal, numeroParcelas) - 1);
          valorJuros = saldoDevedor * taxaMensal;
          valorAmortizacao = valorParcela - valorJuros;
      }

      totalJurosOriginal += valorJuros;

      // Se chegou na parcela do adiantamento
      if (i === parcelaAdiantamento) {
        // Adicionar o valor do adiantamento à amortização
        valorAmortizacao += valorAdiantamento;
        valorParcela += valorAdiantamento;
        
        parcelasComAdiantamento.push({
          numero: i,
          valorParcela: valorParcela,
          valorJuros: valorJuros,
          valorAmortizacao: valorAmortizacao,
          saldoAnterior: saldoDevedor,
          adiantamento: valorAdiantamento
        });
      } else {
        parcelasComAdiantamento.push({
          numero: i,
          valorParcela: valorParcela,
          valorJuros: valorJuros,
          valorAmortizacao: valorAmortizacao,
          saldoAnterior: saldoDevedor,
          adiantamento: 0
        });
      }

      totalJurosComAdiantamento += valorJuros;
      saldoDevedor -= valorAmortizacao;

      if (saldoDevedor <= 0) {
        // Financiamento quitado antecipadamente
        break;
      }
    }

    const economiaJuros = totalJurosOriginal - totalJurosComAdiantamento;
    const parcelasEconomizadas = numeroParcelas - parcelasComAdiantamento.length;
    const novoSaldoDevedor = Math.max(0, saldoDevedor);

    const resultado = {
      cenarioOriginal: {
        totalJuros: totalJurosOriginal,
        totalPago: valorFinanciado + totalJurosOriginal,
        numeroParcelas: numeroParcelas
      },
      cenarioComAdiantamento: {
        totalJuros: totalJurosComAdiantamento,
        totalPago: valorFinanciado + totalJurosComAdiantamento,
        numeroParcelas: parcelasComAdiantamento.length,
        saldoDevedor: novoSaldoDevedor
      },
      economia: {
        juros: economiaJuros,
        percentual: (economiaJuros / totalJurosOriginal) * 100,
        parcelasEconomizadas: parcelasEconomizadas,
        tempoEconomizado: Math.floor(parcelasEconomizadas / 12)
      },
      parcelas: parcelasComAdiantamento.slice(0, 12) // Mostrar apenas primeiras 12
    };

    setResultadoSimulacao(resultado);
    setMostrandoSimulacao(true);
  };

  const criarFinanciamento = async () => {
    // Validações mais rigorosas
    if (!novoFinanciamento.descricao?.trim()) {
      alert('Por favor, preencha a descrição do financiamento.');
      return;
    }
    
    if (!novoFinanciamento.valor_total || parseFloat(novoFinanciamento.valor_total) <= 0) {
      alert('Por favor, informe um valor total válido.');
      return;
    }
    
    if (!novoFinanciamento.taxa_juros_anual || parseFloat(novoFinanciamento.taxa_juros_anual) <= 0) {
      alert('Por favor, informe uma taxa de juros válida.');
      return;
    }
    
    if (!novoFinanciamento.numero_parcelas || parseInt(novoFinanciamento.numero_parcelas) <= 0) {
      alert('Por favor, informe um número de parcelas válido.');
      return;
    }
    
    if (!novoFinanciamento.data_contratacao) {
      alert('Por favor, informe a data de contratação.');
      return;
    }
    
    if (!novoFinanciamento.data_primeira_parcela) {
      alert('Por favor, informe a data da primeira parcela.');
      return;
    }
    
    if (!novoFinanciamento.categoria_id) {
      alert('Por favor, selecione uma categoria.');
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
        alert('O valor financiado deve ser positivo. Verifique se o valor da entrada não é maior que o valor total.');
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
        conta_id: null,
        conta_debito_id: null,
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
        auto_debito: false,
        observacoes: '',
        taxa_seguro_mensal: '',
        taxa_administrativa: '',
        iof_percentual: ''
      });
      
      setShowNovoFinanciamentoModal(false);
      
      // Recarregar dados
      await carregarDados();
      
      alert('Financiamento criado com sucesso!');
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
      
      alert(mensagemErro);
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
                onClick={() => setActiveTab('simulador')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
              >
                <Calculator className="w-4 h-4" />
                <span className="hidden sm:inline">Simulador</span>
              </button>
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
                        alert('🚧 Funcionalidade em desenvolvimento!\n\nEm breve você poderá:\n• Aplicar adiantamentos diretamente no contrato\n• Atualizar automaticamente as parcelas\n• Gerar novo cronograma de pagamentos\n• Registrar a operação no histórico');
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

        {activeTab === 'pagamentos' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Central de Pagamentos</h3>
                  <p className="text-slate-600 dark:text-gray-400">Controle de pagamentos e histórico de parcelas</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">{proximosVencimentos.length}</span>
                  </div>
                  <p className="text-blue-700 dark:text-blue-300 font-medium mt-2">Próximos Vencimentos</p>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center justify-between">
                    <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">0</span>
                  </div>
                  <p className="text-yellow-700 dark:text-yellow-300 font-medium mt-2">Em Atraso</p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                    <span className="text-2xl font-bold text-green-900 dark:text-green-100">0</span>
                  </div>
                  <p className="text-green-700 dark:text-green-300 font-medium mt-2">Pagas Este Mês</p>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between">
                    <Calendar className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    <span className="text-2xl font-bold text-purple-900 dark:text-purple-100">{formatCurrency(dashboard?.valor_mes_atual || 0)}</span>
                  </div>
                  <p className="text-purple-700 dark:text-purple-300 font-medium mt-2">Valor Total Mês</p>
                </div>
              </div>
            </div>

            {/* Lista de Próximos Vencimentos */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Próximos Vencimentos</h4>
              
              {proximosVencimentos.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-gray-400">Nenhum vencimento nos próximos 30 dias</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proximosVencimentos.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-700/50 rounded-xl border border-slate-200 dark:border-gray-600">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{item.financiamento_nome || item.financiamento}</p>
                          <p className="text-sm text-slate-500 dark:text-gray-400">
                            Vence em {formatDate(item.data_vencimento || item.data)} • Parcela {item.numero_parcela || '-'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.valor_parcela || item.valor)}</p>
                        <button 
                          onClick={() => {
                            alert('🚧 Funcionalidade em desenvolvimento!\n\nEm breve você poderá:\n• Registrar pagamentos\n• Anexar comprovantes\n• Configurar lembretes automáticos');
                          }}
                          className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg transition-colors duration-200"
                        >
                          Pagar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                    
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="auto_debito"
                        checked={novoFinanciamento.auto_debito}
                        onChange={(e) => setNovoFinanciamento({...novoFinanciamento, auto_debito: e.target.checked})}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <label htmlFor="auto_debito" className="text-sm font-medium text-slate-700 dark:text-gray-300">
                        Débito Automático
                      </label>
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
      </div>
    </div>
  );
} 