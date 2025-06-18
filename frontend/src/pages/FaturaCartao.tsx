import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { cartoesApi, transacoesApi, parcelasApi, faturasApi, contasApi } from '../services/api';
import { 
  Calendar, 
  CreditCard, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Receipt,
  AlertCircle,
  CheckCircle,
  Filter,
  Wallet,
  X
} from 'lucide-react';

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
}

interface Conta {
  id: number;
  nome: string;
  banco: string;
  tipo: string;
  cor: string;
  ativo?: boolean;
}

interface Transacao {
  id: number;
  descricao: string;
  valor: number;
  data: string;
  categoria: {
    id: number;
    nome: string;
    cor: string;
    icone: string;
  };
  is_parcelada: boolean;
  numero_parcela?: number;
  total_parcelas?: number;
}

interface ParcelaMensal {
  id: number;
  compra_id: number;
  descricao: string;
  numero_parcela: number;
  total_parcelas: number;
  valor: number;
  data_vencimento: string;
  processada: boolean;
  categoria: {
    nome: string;
    cor: string;
    icone: string;
  };
}

interface FaturaMensal {
  id?: number; // Para poder pagar a fatura
  mes: number;
  ano: number;
  data_vencimento: string;
  valor_total: number;
  valor_processado: number;
  valor_pendente: number;
  status: 'aberta' | 'fechada' | 'paga';
  transacoes: Transacao[];
  parcelas_futuras: ParcelaMensal[];
  dias_para_vencimento?: number;
}

export default function FaturaCartao() {
  const { cartaoId } = useParams<{ cartaoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [cartao, setCartao] = useState<Cartao | null>(null);
  const [faturas, setFaturas] = useState<FaturaMensal[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [mesAtivo, setMesAtivo] = useState(new Date().getMonth() + 1);
  const [anoAtivo, setAnoAtivo] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // 💳 NOVO: Estados para pagamento
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [pagamentoLoading, setPagamentoLoading] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Carregar dados iniciais (apenas uma vez)
  useEffect(() => {
    if (cartaoId && user && !cartao) {
      const initializeData = async () => {
        const cartaoData = await loadCartaoData();
        if (cartaoData) {

          
          // Definir fatura atual apenas na inicialização
          const faturaAtualCalculada = calcularFaturaAtual(cartaoData.vencimento, cartaoData.dia_fechamento);
          

          
          setMesAtivo(faturaAtualCalculada.mes);
          setAnoAtivo(faturaAtualCalculada.ano);
          
          await loadFaturas(cartaoData);
        }
      };
      initializeData();
      loadContas();
    }
  }, [cartaoId, user]);

  // Recarregar faturas quando mudar mês/ano (sem resetar para atual)
  useEffect(() => {
    if (cartao) {
      loadFaturas(cartao);
    }
  }, [cartao, mesAtivo, anoAtivo]);

  const loadCartaoData = async () => {
    try {
      // Carregar dados do cartão apenas uma vez
      const cartaoData = await cartoesApi.getAll();
      const cartaoEncontrado = cartaoData.find((c: Cartao) => c.id === parseInt(cartaoId!));
      
      if (!cartaoEncontrado) {
        setError('Cartão não encontrado');
        return null;
      }
      
      setCartao(cartaoEncontrado);
      return cartaoEncontrado;
      
    } catch (error) {
      console.error('Erro ao carregar dados do cartão:', error);
      setError('Erro ao carregar dados do cartão');
      return null;
    }
  };

  const loadFaturas = async (cartaoData: Cartao) => {
    try {
      setIsLoading(true);
      
      // Carregar faturas dos últimos 6 meses e próximos 6 meses
      const faturasList: FaturaMensal[] = [];
      
      for (let i = -6; i <= 6; i++) {
        const data = new Date();
        data.setMonth(data.getMonth() + i);
        const mes = data.getMonth() + 1;
        const ano = data.getFullYear();
        
        const fatura = await loadFaturaMes(parseInt(cartaoId!), mes, ano, cartaoData.vencimento);
        faturasList.push(fatura);
      }
      
      setFaturas(faturasList);
      
    } catch (error) {
      console.error('Erro ao carregar faturas:', error);
      setError('Erro ao carregar dados da fatura');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFaturaMes = async (cartaoId: number, mes: number, ano: number, vencimento: number): Promise<FaturaMensal> => {
    try {
      // Calcular período da fatura baseado na NOVA LÓGICA
      const dataVencimento = calcularDataVencimento(mes, ano, vencimento);
      const { inicioFatura, fimFatura } = calcularPeriodoFatura(mes, ano, vencimento, cartao?.dia_fechamento);
      
      // Carregar transações do período CORRETO
      const transacoes = await transacoesApi.getAll({
        cartao_id: cartaoId,
        data_inicio: inicioFatura.toISOString().split('T')[0],
        data_fim: fimFatura.toISOString().split('T')[0]
      });
      
      // Debug: log removido por problemas de scope
      
      // Carregar parcelas que vencem neste mês
      const parcelasFuturas = await loadParcelasMes(cartaoId, mes, ano);
      
      // Calcular valores
      const valorTransacoes = transacoes.reduce((sum: number, t: Transacao) => sum + Math.abs(t.valor), 0);
      const valorParcelas = parcelasFuturas.reduce((sum, p) => sum + p.valor, 0);
      const valorTotal = valorTransacoes + valorParcelas;
      
      // Determinar status baseado no dia de fechamento
      const hoje = new Date();
      const diaAtual = hoje.getDate();
      const fechamento = cartao?.dia_fechamento || (vencimento > 5 ? vencimento - 5 : 25);
      
      let status: 'aberta' | 'fechada' | 'paga';
      
      // Verificar se fatura já venceu
      if (hoje > dataVencimento) {
        // Já venceu - FECHADA (vencida)
        status = 'fechada';
      } else if (diaAtual <= fechamento) {
        // Ainda no período de compras - ABERTA
        status = 'aberta';
      } else {
        // Passou do fechamento mas ainda não venceu - FECHADA  
        status = 'fechada';
      }
      
      const diasParaVencimento = dataVencimento > hoje ? 
        Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)) : 
        Math.ceil((hoje.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24)) * -1;
      
      return {
        mes,
        ano,
        data_vencimento: dataVencimento.toISOString(),
        valor_total: valorTotal,
        valor_processado: valorTransacoes,
        valor_pendente: valorParcelas,
        status,
        transacoes: transacoes || [],
        parcelas_futuras: parcelasFuturas,
        dias_para_vencimento: diasParaVencimento
      };
      
    } catch (error) {
      console.error(`Erro ao carregar fatura ${mes}/${ano}:`, error);
      return {
        mes,
        ano,
        data_vencimento: calcularDataVencimento(mes, ano, vencimento).toISOString(),
        valor_total: 0,
        valor_processado: 0,
        valor_pendente: 0,
        status: 'aberta',
        transacoes: [],
        parcelas_futuras: []
      };
    }
  };

  const loadParcelasMes = async (cartaoId: number, mes: number, ano: number): Promise<ParcelaMensal[]> => {
    try {
      // Buscar parcelamentos do cartão
      const response = await parcelasApi.getAll();
      const parcelamentos = response.filter((p: any) => p.cartao_id === cartaoId && p.ativa);
      
      const parcelas: ParcelaMensal[] = [];
      
      for (const parcelamento of parcelamentos) {
        try {
          const detalhes = await parcelasApi.getById(parcelamento.id);
          
          // Filtrar parcelas do mês específico que ainda não foram pagas
          if (detalhes.parcelas) {
            const parcelasMes = detalhes.parcelas.filter((parcela: any) => {
              const dataParcela = new Date(parcela.data_vencimento);
              return dataParcela.getMonth() + 1 === mes && 
                     dataParcela.getFullYear() === ano &&
                     !parcela.paga;
            });
            
            for (const parcela of parcelasMes) {
              parcelas.push({
                id: parcela.id,
                compra_id: parcelamento.id,
                descricao: parcelamento.descricao,
                numero_parcela: parcela.numero_parcela,
                total_parcelas: parcelamento.total_parcelas,
                valor: parcela.valor,
                data_vencimento: parcela.data_vencimento,
                processada: parcela.paga,
                categoria: {
                  nome: 'Parcelamento',
                  cor: '#8B5CF6',
                  icone: '🛒'
                }
              });
            }
          }
        } catch (error) {
          console.error(`Erro ao carregar detalhes do parcelamento ${parcelamento.id}:`, error);
        }
      }
      
      return parcelas;
    } catch (error) {
      console.error('Erro ao carregar parcelas:', error);
      return [];
    }
  };

  const calcularDataVencimento = (mes: number, ano: number, vencimento: number): Date => {
    // CORREÇÃO: Vencimento é sempre no MÊS SEGUINTE ao fechamento da fatura
    let mesVencimento = mes + 1;
    let anoVencimento = ano;
    
    // Ajustar virada de ano
    if (mesVencimento > 12) {
      mesVencimento = 1;
      anoVencimento = ano + 1;
    }
    
    const data = new Date(anoVencimento, mesVencimento - 1, vencimento);
    
    // Se o dia não existe no mês (ex: 31 em fevereiro), usar último dia do mês
    if (data.getMonth() !== mesVencimento - 1) {
      data.setDate(0); // Vai para o último dia do mês anterior
    }
    

    
    return data;
  };

  const calcularPeriodoFatura = (mes: number, ano: number, vencimento: number, diaFechamento?: number) => {
    // NOVA LÓGICA: Alinhada com backend v2.8.0
    // Usar dia_fechamento se disponível, senão vencimento - 5
    const fechamento = diaFechamento || (vencimento > 5 ? vencimento - 5 : 25);
    
    // Período da fatura: do dia_fechamento+1 do mês anterior até dia_fechamento do mês atual
    const inicioFatura = new Date(ano, mes - 2, fechamento + 1); // mes - 2 porque Date usa 0-based months
    const fimFatura = new Date(ano, mes - 1, fechamento); // mes - 1 porque Date usa 0-based months
    
    // Ajustar se passar do mês
    if (inicioFatura.getMonth() !== mes - 2) {
      inicioFatura.setDate(1); // Início do mês se dia não existir
    }
    
    return { inicioFatura, fimFatura };
  };

  const calcularFaturaAtual = (vencimento: number, diaFechamento?: number): { mes: number, ano: number } => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();
    const diaAtual = hoje.getDate();
    
    // Usar dia_fechamento se disponível, senão vencimento - 5 como fallback
    const fechamento = diaFechamento || (vencimento > 5 ? vencimento - 5 : 25);
    
    // NOVA LÓGICA: Alinhada com backend v2.8.0
    // Se ainda não passou do dia de fechamento neste mês, a fatura atual é deste mês
    // Se já passou do fechamento, a fatura atual é do próximo mês
    if (diaAtual <= fechamento) {
      // Ainda no período de compras da fatura atual
      return { mes: mesAtual, ano: anoAtual };
    } else {
      // Passou do fechamento, nova fatura começou
      let proximoMes, proximoAno;
      if (mesAtual === 12) {
        proximoMes = 1;
        proximoAno = anoAtual + 1;
      } else {
        proximoMes = mesAtual + 1;
        proximoAno = anoAtual;
      }
      
      return { mes: proximoMes, ano: proximoAno };
    }
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

  const formatMesAno = (mes: number, ano: number) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${meses[mes - 1]} ${ano}`;
  };

  const navegarMes = (direcao: 'anterior' | 'proximo') => {
    if (direcao === 'anterior') {
      if (mesAtivo === 1) {
        setMesAtivo(12);
        setAnoAtivo(anoAtivo - 1);
      } else {
        setMesAtivo(mesAtivo - 1);
      }
    } else {
      if (mesAtivo === 12) {
        setMesAtivo(1);
        setAnoAtivo(anoAtivo + 1);
      } else {
        setMesAtivo(mesAtivo + 1);
      }
    }
  };

  const faturaAtual = faturas.find(f => f.mes === mesAtivo && f.ano === anoAtivo);
  const transacoesFiltradas = faturaAtual?.transacoes.filter(t => 
    !filtroCategoria || t.categoria.nome.toLowerCase().includes(filtroCategoria.toLowerCase())
  ) || [];

  const loadContas = async () => {
    try {
      const contasData = await contasApi.getAll();
      setContas(contasData.filter((conta: any) => conta.ativo !== false));
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  // 💳 NOVO: Função para pagar fatura
  const handlePagarFatura = async () => {
    if (!faturaAtual || !contaSelecionada || !faturaAtual.id) return;
    
    try {
      setPagamentoLoading(true);
      
      const response = await faturasApi.pagarFatura(faturaAtual.id, {
        conta_id: contaSelecionada
      });
      
      setSuccessMessage(`Pagamento de ${formatCurrency(faturaAtual.valor_total)} realizado com sucesso!`);
      setShowPagamentoModal(false);
      
      // Recarregar faturas após pagamento
      if (cartao) {
        await loadFaturas(cartao);
      }
      
      // Limpar mensagem após 5 segundos
      setTimeout(() => setSuccessMessage(''), 5000);
      
    } catch (error: any) {
      console.error('Erro ao pagar fatura:', error);
      setErrorMessage(error.response?.data?.detail || 'Erro ao processar pagamento');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setPagamentoLoading(false);
    }
  };

  // Limpar mensagens após alguns segundos
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Navigation user={user} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-gray-400">Carregando fatura...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Navigation user={user} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Erro ao carregar fatura</h2>
            <p className="text-slate-600 dark:text-gray-400 mb-4">{error}</p>
            <button 
              onClick={() => navigate('/cartoes')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Voltar para Cartões
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation user={user} />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <button 
              onClick={() => navigate('/cartoes')}
              className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-gray-400" />
            </button>
            
            <div className="flex items-center space-x-4">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                style={{ backgroundColor: cartao?.cor }}
              >
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{cartao?.nome}</h1>
                <p className="text-slate-600 dark:text-gray-400">{cartao?.bandeira} •••• {cartao?.numero_final}</p>
              </div>
            </div>
          </div>

                      {/* Navegação de Meses */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-gray-700">
            <button 
              onClick={() => navegarMes('anterior')}
              className="w-10 h-10 bg-slate-50 dark:bg-gray-700 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-gray-600 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-gray-400" />
            </button>
            
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{formatMesAno(mesAtivo, anoAtivo)}</h2>
                {cartao && (() => {
                  const faturaAtualCalc = calcularFaturaAtual(cartao.vencimento, cartao.dia_fechamento);
                  return faturaAtualCalc.mes === mesAtivo && faturaAtualCalc.ano === anoAtivo;
                })() && (
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs font-medium px-2 py-1 rounded-full">
                    Atual
                  </span>
                )}
              </div>
              {faturaAtual?.data_vencimento && (
                <p className="text-sm text-slate-600 dark:text-gray-400">
                  Vencimento: {formatDate(faturaAtual.data_vencimento)}
                  {faturaAtual.dias_para_vencimento !== undefined && (
                    <span className={`ml-2 ${
                      faturaAtual.dias_para_vencimento < 0 
                        ? 'text-red-600 dark:text-red-400 font-medium' 
                        : faturaAtual.dias_para_vencimento <= 3
                        ? 'text-orange-600 dark:text-orange-400 font-medium'
                        : 'text-slate-600 dark:text-gray-400'
                    }`}>
                      ({faturaAtual.dias_para_vencimento < 0 
                        ? `${Math.abs(faturaAtual.dias_para_vencimento)} dias em atraso`
                        : `${faturaAtual.dias_para_vencimento} dias`
                      })
                    </span>
                  )}
                </p>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {cartao && (() => {
                const faturaAtualCalc = calcularFaturaAtual(cartao.vencimento);
                return !(faturaAtualCalc.mes === mesAtivo && faturaAtualCalc.ano === anoAtivo);
              })() && (
                <button 
                  onClick={() => {
                    const faturaAtualCalc = calcularFaturaAtual(cartao!.vencimento);
                    setMesAtivo(faturaAtualCalc.mes);
                    setAnoAtivo(faturaAtualCalc.ano);
                  }}
                  className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  Ir para Atual
                </button>
              )}
              <button 
                onClick={() => navegarMes('proximo')}
                className="w-10 h-10 bg-slate-50 dark:bg-gray-700 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-gray-600 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-gray-400">Total da Fatura</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(faturaAtual?.valor_total || 0)}
                </p>
              </div>
              <Receipt className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-gray-400">Processado</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(faturaAtual?.valor_processado || 0)}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-gray-400">Parcelamentos</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(faturaAtual?.valor_pendente || 0)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-gray-400">Status</p>
                <p className={`text-lg font-bold ${
                  faturaAtual?.status === 'paga' ? 'text-green-600 dark:text-green-400' :
                  faturaAtual?.status === 'fechada' ? 'text-orange-600 dark:text-orange-400' :
                  'text-blue-600 dark:text-blue-400'
                }`}>
                  {faturaAtual?.status === 'paga' ? 'Paga' :
                   faturaAtual?.status === 'fechada' ? 'Fechada' :
                   'Aberta'}
                </p>
                
                {/* 💳 NOVO: Botão de pagamento */}
                {faturaAtual?.status !== 'paga' && faturaAtual?.valor_total > 0 && (
                  <button
                    onClick={() => setShowPagamentoModal(true)}
                    className="mt-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-1"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Pagar Fatura</span>
                  </button>
                )}
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                faturaAtual?.status === 'paga' ? 'bg-green-100 dark:bg-green-900/30' :
                faturaAtual?.status === 'fechada' ? 'bg-orange-100 dark:bg-orange-900/30' :
                'bg-blue-100 dark:bg-blue-900/30'
              }`}>
                <div className={`w-4 h-4 rounded-full ${
                  faturaAtual?.status === 'paga' ? 'bg-green-600 dark:bg-green-400' :
                  faturaAtual?.status === 'fechada' ? 'bg-orange-600 dark:bg-orange-400' :
                  'bg-blue-600 dark:bg-blue-400'
                }`}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Detalhes da Fatura</h3>
            <button 
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className="flex items-center space-x-2 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
            >
              <Filter className="w-4 h-4" />
              <span>Filtros</span>
            </button>
          </div>

          {mostrarFiltros && (
            <div className="mb-6 p-4 bg-slate-50 dark:bg-gray-700/50 rounded-xl">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Filtrar por categoria
                  </label>
                  <input
                    type="text"
                    placeholder="Digite o nome da categoria..."
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button 
                  onClick={() => setFiltroCategoria('')}
                  className="bg-slate-200 dark:bg-gray-600 text-slate-600 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-slate-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Limpar
                </button>
              </div>
            </div>
          )}

          {/* Transações */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-900 dark:text-white flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span>Transações ({transacoesFiltradas.length})</span>
            </h4>
            
            {transacoesFiltradas.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-gray-400">
                <Receipt className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
                <p>Nenhuma transação encontrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transacoesFiltradas.map((transacao) => (
                  <div key={transacao.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm"
                        style={{ backgroundColor: transacao.categoria.cor }}
                      >
                        {transacao.categoria.icone}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{transacao.descricao}</p>
                        <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-gray-400">
                          <span>{transacao.categoria.nome}</span>
                          <span>•</span>
                          <span>{formatDate(transacao.data)}</span>
                          {transacao.is_parcelada && (
                            <>
                              <span>•</span>
                              <span className="text-purple-600 dark:text-purple-400 font-medium">
                                {transacao.numero_parcela}/{transacao.total_parcelas}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency(Math.abs(transacao.valor))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parcelamentos Futuros */}
          {faturaAtual && faturaAtual.parcelas_futuras.length > 0 && (
            <div className="mt-8 space-y-4">
              <h4 className="font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <span>Parcelamentos ({faturaAtual.parcelas_futuras.length})</span>
              </h4>
              
              <div className="space-y-3">
                {faturaAtual.parcelas_futuras.map((parcela) => (
                  <div key={parcela.id} className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm"
                        style={{ backgroundColor: parcela.categoria.cor }}
                      >
                        {parcela.categoria.icone}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{parcela.descricao}</p>
                        <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-gray-400">
                          <span>{parcela.categoria.nome}</span>
                          <span>•</span>
                          <span>{formatDate(parcela.data_vencimento)}</span>
                          <span>•</span>
                          <span className="text-orange-600 dark:text-orange-400 font-medium">
                            Parcela {parcela.numero_parcela}/{parcela.total_parcelas}
                          </span>
                          {parcela.processada && (
                            <>
                              <span>•</span>
                              <span className="text-green-600 dark:text-green-400 font-medium">Processada</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(parcela.valor)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timeline de Meses */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Histórico e Projeção</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {faturas.map((fatura) => {
              const isAtual = fatura.mes === mesAtivo && fatura.ano === anoAtivo;
              const hoje = new Date();
              const mesPassado = new Date(fatura.ano, fatura.mes - 1) < new Date(hoje.getFullYear(), hoje.getMonth());
              
              // Verificar se esta é a fatura "atual" do cartão
              const faturaAtualCartao = cartao ? calcularFaturaAtual(cartao.vencimento, cartao.dia_fechamento) : null;
              const isFaturaAtualCartao = faturaAtualCartao ? 
                fatura.mes === faturaAtualCartao.mes && fatura.ano === faturaAtualCartao.ano : false;
              
              return (
                <button
                  key={`${fatura.mes}-${fatura.ano}`}
                  onClick={() => {
                    setMesAtivo(fatura.mes);
                    setAnoAtivo(fatura.ano);
                  }}
                  className={`p-4 rounded-xl text-left transition-all relative ${
                    isAtual 
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 shadow-md' 
                      : 'bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-600 hover:bg-slate-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <p className={`font-medium ${isAtual ? 'text-blue-900 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}>
                        {formatMesAno(fatura.mes, fatura.ano).substring(0, 3)} {fatura.ano}
                      </p>
                      {isFaturaAtualCartao && (
                        <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                          Atual
                        </span>
                      )}
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      fatura.status === 'paga' ? 'bg-green-500' :
                      fatura.status === 'fechada' ? 'bg-orange-500' :
                      'bg-blue-500'
                    }`}></div>
                  </div>
                  
                  <p className={`text-lg font-bold ${isAtual ? 'text-blue-900 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}>
                    {formatCurrency(fatura.valor_total)}
                  </p>
                  
                  {fatura.valor_pendente > 0 && (
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                      + {formatCurrency(fatura.valor_pendente)} parcelamentos
                    </p>
                  )}
                  
                  {mesPassado && fatura.valor_total === 0 && (
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Sem movimentação</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 💳 NOVO: Modal de Pagamento */}
      {showPagamentoModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pagar Fatura</h3>
              <button
                onClick={() => setShowPagamentoModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-4 h-4 text-slate-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-gray-400">Valor da fatura</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                      {formatCurrency(faturaAtual?.valor_total || 0)}
                    </p>
                  </div>
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                    style={{ backgroundColor: cartao?.cor }}
                  >
                    <CreditCard className="w-6 h-6" />
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-gray-400 mt-2">
                  {cartao?.nome} • Vencimento: {faturaAtual?.data_vencimento ? formatDate(faturaAtual.data_vencimento) : ''}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">
                  Selecione a conta para débito
                </label>
                <div className="space-y-2">
                  {contas.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-gray-400 p-4 bg-slate-50 dark:bg-gray-700/50 rounded-lg">
                      Nenhuma conta encontrada. Cadastre uma conta primeiro.
                    </p>
                  ) : (
                    contas.map((conta) => (
                      <label
                        key={conta.id}
                        className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          contaSelecionada === conta.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-slate-200 dark:border-gray-600 hover:border-slate-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <input
                          type="radio"
                          name="conta"
                          value={conta.id}
                          checked={contaSelecionada === conta.id}
                          onChange={() => setContaSelecionada(conta.id)}
                          className="sr-only"
                        />
                        <div className="flex items-center flex-1">
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm mr-3"
                            style={{ backgroundColor: conta.cor }}
                          >
                            <Wallet className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{conta.nome}</p>
                            <p className="text-sm text-slate-600 dark:text-gray-400">{conta.banco} • {conta.tipo}</p>
                          </div>
                        </div>
                        {contaSelecionada === conta.id && (
                          <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowPagamentoModal(false)}
                className="flex-1 px-4 py-3 text-slate-600 dark:text-gray-300 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePagarFatura}
                disabled={!contaSelecionada || pagamentoLoading}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {pagamentoLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  'Confirmar Pagamento'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💳 NOVO: Mensagens de Feedback */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 px-6 py-4 rounded-xl shadow-lg flex items-center space-x-3">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-6 py-4 rounded-xl shadow-lg flex items-center space-x-3">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
} 