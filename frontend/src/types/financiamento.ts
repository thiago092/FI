export interface Financiamento {
  id: number;
  nome: string;
  instituicao: string;
  numeroContrato?: string;
  tipo: TipoFinanciamento;
  sistemaAmortizacao: SistemaAmortizacao;
  
  // Valores financeiros
  valorOriginal: number;
  valorTotalContrato: number;
  saldoDevedorAtual: number;
  taxaJurosAnual: number;
  taxaJurosMensal: number;
  
  // Parcelas
  totalParcelas: number;
  parcelasPagas: number;
  valorParcelaInicial: number;
  valorParcelaAtual: number;
  
  // Datas
  dataContratacao: string;
  dataPrimeiroVencimento: string;
  dataUltimoVencimento: string;
  proximoVencimento: string;
  diaVencimento: number;
  
  // Configurações
  contaDebitoId?: number;
  autoDebito: boolean;
  lembreteVencimento: boolean;
  
  // Taxas adicionais
  taxaSeguroMensal: number;
  taxaAdministrativa: number;
  
  // Status e controle
  status: StatusFinanciamento;
  diasAtraso?: number;
  observacoes?: string;
  
  // Campos calculados
  porcentagemPaga: number;
  jurosJaPagos: number;
  principalJaPago: number;
  economiaQuitacaoAntecipada?: number;
  cor: string;
}

export interface ParcelaFinanciamento {
  id: number;
  financiamentoId: number;
  numeroParcela: number;
  
  // Dados simulados/originais
  dataVencimento: string;
  saldoInicialSimulado: number;
  amortizacaoSimulada: number;
  jurosSimulados: number;
  seguroSimulado: number;
  valorParcelaSimulado: number;
  saldoFinalSimulado: number;
  
  // Dados reais (quando pago)
  dataPagamento?: string;
  valorPagoReal?: number;
  jurosMultaAtraso: number;
  descontoQuitacao: number;
  
  // Status
  status: StatusParcela;
  diasAtraso: number;
  comprovantePath?: string;
  
  // Transação vinculada
  transacaoId?: number;
}

export interface SimulacaoParams {
  valorFinanciado: number;
  prazoMeses: number;
  taxaJurosAnual: number;
  taxaJurosMensal?: number;
  sistemaAmortizacao: SistemaAmortizacao;
  dataInicio: string;
  carenciaMeses?: number;
  taxaSeguroMensal?: number;
  taxaAdministrativa?: number;
  
  // Para cálculos avançados
  rendaComprovada?: number;
  valorEntrada?: number;
  bensGarantia?: number;
}

export interface ResultadoSimulacao {
  sistemaAmortizacao: SistemaAmortizacao;
  resumo: {
    valorFinanciado: number;
    valorTotalPago: number;
    totalJuros: number;
    primeiraParcela: number;
    ultimaParcela: number;
    parcelaMenor: number;
    parcelaMaior: number;
    comprometimentoRenda?: number;
    economiaEmRelacaoPrice?: number;
  };
  parcelas: ParcelaSimulacao[];
  graficos: {
    evolucaoParcelas: ChartData[];
    saldoDevedor: ChartData[];
    composicaoJurosAmortizacao: ChartData[];
  };
}

export interface ParcelaSimulacao {
  numero: number;
  dataVencimento: string;
  saldoInicial: number;
  amortizacao: number;
  juros: number;
  seguro: number;
  valorParcela: number;
  saldoFinal: number;
  porcentagemAmortizada: number;
}

export interface DashboardFinanciamentos {
  resumoGeral: {
    totalFinanciado: number;
    totalJaPago: number;
    saldoDevedor: number;
    totalJurosRestantes: number;
    valorMesAtual: number;
    proximosVencimentos: ProximoVencimento[];
  };
  financiamentosAtivos: number;
  financiamentosQuitados: number;
  mediaJurosCarteira: number;
  evolucaoPatrimonio: ChartData[];
}

export interface ProximoVencimento {
  financiamentoId: number;
  financiamentoNome: string;
  valor: number;
  dataVencimento: string;
  status: StatusParcela;
  diasParaVencimento: number;
}

export interface QuitacaoAntecipada {
  financiamentoId: number;
  dataQuitacao: string;
  saldoDevedorAtual: number;
  valorQuitacao: number;
  economiaJuros: number;
  valorTotalSemQuitacao: number;
  porcentagemEconomia: number;
}

export interface ChartData {
  name: string;
  value: number;
  date?: string;
  parcela?: number;
  amortizacao?: number;
  juros?: number;
}

// Enums
export type TipoFinanciamento = 
  | 'habitacional' 
  | 'veiculo' 
  | 'pessoal' 
  | 'consignado' 
  | 'empresarial' 
  | 'rural' 
  | 'estudantil';

export type SistemaAmortizacao = 
  | 'PRICE' 
  | 'SAC' 
  | 'SACRE' 
  | 'AMERICANO' 
  | 'BULLET';

export type StatusFinanciamento = 
  | 'simulacao' 
  | 'ativo' 
  | 'em_atraso' 
  | 'quitado' 
  | 'suspenso';

export type StatusParcela = 
  | 'pendente' 
  | 'paga' 
  | 'vencida' 
  | 'antecipada';

// Request/Response types para API (futuras)
export interface FinanciamentoCreate {
  nome: string;
  instituicao: string;
  numeroContrato?: string;
  tipo: TipoFinanciamento;
  sistemaAmortizacao: SistemaAmortizacao;
  valorOriginal: number;
  valorTotalContrato: number;
  taxaJurosAnual: number;
  totalParcelas: number;
  dataContratacao: string;
  dataPrimeiroVencimento: string;
  diaVencimento: number;
  contaDebitoId?: number;
  autoDebito?: boolean;
  taxaSeguroMensal?: number;
  taxaAdministrativa?: number;
  observacoes?: string;
}

export interface FinanciamentoUpdate extends Partial<FinanciamentoCreate> {
  id: number;
}

export interface PagamentoParcela {
  parcelaId: number;
  dataPagamento: string;
  valorPago: number;
  jurosMultaAtraso?: number;
  descontoQuitacao?: number;
  comprovante?: File;
}

// Filtros para listagem
export interface FiltrosFinanciamento {
  tipo?: TipoFinanciamento;
  status?: StatusFinanciamento;
  sistemaAmortizacao?: SistemaAmortizacao;
  instituicao?: string;
  dataInicioContrato?: string;
  dataFimContrato?: string;
  valorMinimo?: number;
  valorMaximo?: number;
} 