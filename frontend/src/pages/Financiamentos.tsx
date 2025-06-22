import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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

// Types para os dados mockados
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
  totalFinanciado: number;
  totalJaPago: number;
  saldoDevedor: number;
  totalJurosRestantes: number;
  valorMesAtual: number;
  financiamentosAtivos: number;
  financiamentosQuitados: number;
  mediaJurosCarteira: number;
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
  totalFinanciado: 410000,
  totalJaPago: 111050,
  saldoDevedor: 298950,
  totalJurosRestantes: 89950,
  valorMesAtual: 5329,
  financiamentosAtivos: 3,
  financiamentosQuitados: 1,
  mediaJurosCarteira: 12.3
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
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(mockDashboard.totalFinanciado)}</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  <ArrowUpRight className="w-4 h-4 inline mr-1" />
                  {mockDashboard.financiamentosAtivos} ativos
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-slate-500 dark:text-gray-400">Já Pago</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(mockDashboard.totalJaPago)}</p>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                  {((mockDashboard.totalJaPago / mockDashboard.totalFinanciado) * 100).toFixed(1)}% do total
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-sm text-slate-500 dark:text-gray-400">Saldo Devedor</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(mockDashboard.saldoDevedor)}</p>
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                  <ArrowDownRight className="w-4 h-4 inline mr-1" />
                  + {formatCurrency(mockDashboard.totalJurosRestantes)} juros
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-sm text-slate-500 dark:text-gray-400">Este Mês</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(mockDashboard.valorMesAtual)}</p>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                  {mockProximosVencimentos.length} parcelas
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
                {mockProximosVencimentos.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{item.financiamento}</p>
                        <p className="text-sm text-slate-500 dark:text-gray-400">Vence em {formatDate(item.data)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.valor)}</p>
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
            {mockFinanciamentos.map((financiamento) => (
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
            ))}
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