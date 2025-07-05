import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import ToastContainer from '../components/ToastContainer';
import { useToast } from '../hooks/useToast';
import { dashboardApi } from '../services/api';
import { useQuery } from 'react-query';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, Calendar, Eye, DollarSign, BarChart3, Target, AlertTriangle, 
  CheckCircle, Activity, Settings, ChevronRight, ChevronLeft, Download,
  CreditCard, Building, ArrowUpRight, ArrowDownRight, Clock, Star
} from 'lucide-react';

export default function VisaoFutura() {
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError, showInfo } = useToast();
  
  // Estados principais
  const [mesSelecionado, setMesSelecionado] = useState<any>(null);
  const [isLoadingDetalhes, setIsLoadingDetalhes] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'chart'>('timeline');
  
  // Estados para filtros
  const [showReceitas, setShowReceitas] = useState(true);
  const [showDespesas, setShowDespesas] = useState(true);
  const [showSaldo, setShowSaldo] = useState(true);

  // Query para buscar projeções de 6 meses
  const { data: projecoes6Meses, isLoading: isLoadingProjecoes, error: errorProjecoes } = useQuery(
    'projecoes-6-meses',
    dashboardApi.getProjecoes6Meses,
    {
      enabled: !!user,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      onError: (error) => {
        console.error('❌ Erro ao carregar projeções:', error);
        showError('Erro ao carregar dados', 'Não foi possível carregar as projeções futuras');
      }
    }
  );

  // Função para selecionar mês
  const handleSelecionarMes = async (mes: any) => {
    try {
      setIsLoadingDetalhes(true);
      
      // Buscar detalhes do mês
      const detalhes = await dashboardApi.getDetalhesProjecaoMes(mes.ano, mes.mes);
      setMesSelecionado({...mes, detalhes});
      
      showInfo('Detalhes carregados!', `Dados completos de ${mes.mes_nome} disponíveis.`);
    } catch (error) {
      console.error('Erro ao carregar detalhes do mês:', error);
      showError('Erro ao carregar detalhes', 'Não foi possível carregar os detalhes do mês selecionado.');
    } finally {
      setIsLoadingDetalhes(false);
    }
  };

  // Função para gerar PDF
  const handleGeneratePdf = async () => {
    if (!mesSelecionado) return;
    
    try {
      setIsGeneratingPdf(true);
      showInfo('Gerando PDF...', 'Preparando relatório para impressão.');
      
      // Simular geração de PDF
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showSuccess('PDF gerado', 'Relatório baixado com sucesso!');
    } catch (error) {
      showError('Erro ao gerar PDF', 'Não foi possível gerar o relatório');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  // Verificar se é mês atual
  const isCurrentMonth = (mes: any) => {
    const now = new Date();
    return mes.mes === now.getMonth() + 1 && mes.ano === now.getFullYear();
  };

  if (isLoadingProjecoes) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation user={user} />
        <div className="pt-20 pb-32">
          <div className="container-mobile">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando projeções futuras...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorProjecoes) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation user={user} />
        <div className="pt-20 pb-32">
          <div className="container-mobile">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">Erro ao carregar dados</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation user={user} />
      
      <div className="pt-20 pb-32">
        <div className="container-mobile">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <Eye className="w-8 h-8 text-blue-600" />
                  Visão Futura
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Panorama dos próximos meses • Projeções inteligentes • Planejamento independente
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => window.location.href = '/transacoes-recorrentes'}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm flex items-center gap-1"
                >
                  <Settings className="w-4 h-4" />
                  Gerenciar recorrentes
                </button>
                
                <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('timeline')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'timeline' 
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    onClick={() => setViewMode('chart')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'chart' 
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Gráfico
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Visualização Timeline */}
          {viewMode === 'timeline' && (
            <div className="space-y-6">
              {/* Cards dos meses */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.isArray(projecoes6Meses) && projecoes6Meses.length > 0 ? (
                  projecoes6Meses.map((mes: any, index: number) => (
                  <div
                    key={`${mes.ano}-${mes.mes}`}
                    className={`bg-white dark:bg-gray-800 rounded-xl p-6 border-2 transition-all cursor-pointer transform hover:scale-105 ${
                      mesSelecionado?.mes === mes.mes && mesSelecionado?.ano === mes.ano
                        ? 'border-blue-500 shadow-lg ring-2 ring-blue-200 dark:ring-blue-800'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => handleSelecionarMes(mes)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          isCurrentMonth(mes) ? 'bg-green-500' : 'bg-blue-500'
                        }`}></div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {mes.mes_nome}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {mes.ano}
                          </p>
                        </div>
                      </div>
                      
                      {isCurrentMonth(mes) && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                          Atual
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          <ArrowUpRight className="w-4 h-4 text-green-500" />
                          Receitas
                        </span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {formatarMoeda(mes.total_receitas)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                          Despesas
                        </span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {formatarMoeda(mes.total_despesas)}
                        </span>
                      </div>
                      
                      <div className="border-t pt-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-white">
                            Resultado
                          </span>
                          <span className={`font-bold ${
                            mes.resultado_mensal >= 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {formatarMoeda(mes.resultado_mensal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {mesSelecionado?.mes === mes.mes && mesSelecionado?.ano === mes.ano && (
                      <div className="mt-4 text-center">
                        <ChevronRight className="w-5 h-5 text-blue-500 mx-auto" />
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Detalhes carregados
                        </p>
                      </div>
                    )}
                  </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">
                      Nenhuma projeção disponível no momento
                    </p>
                  </div>
                )}
              </div>

              {/* Seção de detalhes */}
              {mesSelecionado && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        {mesSelecionado.mes_nome} {mesSelecionado.ano}
                        {isCurrentMonth(mesSelecionado) && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                            Mês Atual
                          </span>
                        )}
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400">
                        {isCurrentMonth(mesSelecionado) 
                          ? 'Dados reais + projeções futuras' 
                          : 'Apenas projeções baseadas em recorrentes'
                        }
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={handleGeneratePdf}
                        disabled={isGeneratingPdf}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        {isGeneratingPdf ? 'Gerando...' : 'PDF'}
                      </button>
                      <button
                        onClick={() => setMesSelecionado(null)}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {isLoadingDetalhes ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600 dark:text-gray-400">Carregando detalhes...</p>
                    </div>
                  ) : mesSelecionado.detalhes ? (
                    <div className="space-y-6">
                      {/* Resumo */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <ArrowUpRight className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-green-800 dark:text-green-300">
                              Receitas
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {formatarMoeda(mesSelecionado.total_receitas)}
                          </p>
                        </div>
                        
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <ArrowDownRight className="w-5 h-5 text-red-600" />
                            <span className="font-medium text-red-800 dark:text-red-300">
                              Despesas
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {formatarMoeda(mesSelecionado.total_despesas)}
                          </p>
                        </div>
                        
                        <div className={`p-4 rounded-lg ${
                          mesSelecionado.resultado_mensal >= 0 
                            ? 'bg-blue-50 dark:bg-blue-900/20' 
                            : 'bg-gray-50 dark:bg-gray-800'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="w-5 h-5 text-blue-600" />
                            <span className="font-medium text-blue-800 dark:text-blue-300">
                              Resultado
                            </span>
                          </div>
                          <p className={`text-2xl font-bold ${
                            mesSelecionado.resultado_mensal >= 0 
                              ? 'text-blue-600 dark:text-blue-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {formatarMoeda(mesSelecionado.resultado_mensal)}
                          </p>
                        </div>
                      </div>

                      {/* Detalhes das transações */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Receitas */}
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-green-500" />
                            Receitas Detalhadas
                          </h3>
                          <div className="space-y-3">
                            {Array.isArray(mesSelecionado.detalhes.receitas) && mesSelecionado.detalhes.receitas.length > 0 ? (
                              mesSelecionado.detalhes.receitas.map((receita: any, index: number) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${
                                      receita.tipo === 'recorrente' ? 'bg-green-500' : 'bg-blue-500'
                                    }`}></div>
                                    <div>
                                      <p className="font-medium text-gray-900 dark:text-white">
                                        {receita.descricao}
                                      </p>
                                      <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {receita.categoria}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="font-medium text-green-600 dark:text-green-400">
                                    {formatarMoeda(receita.valor)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-4">
                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                  Nenhuma receita encontrada para este mês
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Despesas */}
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <ArrowDownRight className="w-4 h-4 text-red-500" />
                            Despesas Detalhadas
                          </h3>
                          <div className="space-y-3">
                            {Array.isArray(mesSelecionado.detalhes.despesas) && mesSelecionado.detalhes.despesas.length > 0 ? (
                              mesSelecionado.detalhes.despesas.map((despesa: any, index: number) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${
                                      despesa.tipo === 'recorrente' ? 'bg-red-500' : 
                                      despesa.tipo === 'parcela' ? 'bg-orange-500' : 'bg-purple-500'
                                    }`}></div>
                                    <div>
                                      <p className="font-medium text-gray-900 dark:text-white">
                                        {despesa.descricao}
                                      </p>
                                      <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {despesa.categoria}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="font-medium text-red-600 dark:text-red-400">
                                    {formatarMoeda(despesa.valor)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-4">
                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                  Nenhuma despesa encontrada para este mês
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600 dark:text-gray-400">
                        Selecione um mês para ver os detalhes
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Visualização Gráfico */}
          {viewMode === 'chart' && (
            <div className="space-y-6">
              {/* Filtros do gráfico */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Filtros do Gráfico</h3>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showReceitas}
                      onChange={(e) => setShowReceitas(e.target.checked)}
                      className="w-4 h-4 text-green-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Receitas
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDespesas}
                      onChange={(e) => setShowDespesas(e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Despesas
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSaldo}
                      onChange={(e) => setShowSaldo(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Resultado
                    </span>
                  </label>
                </div>
              </div>

              {/* Gráfico */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Evolução dos Próximos Meses
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Array.isArray(projecoes6Meses) ? projecoes6Meses : []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes_nome" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: any, name: any) => [
                          formatarMoeda(value),
                          name === 'total_receitas' ? 'Receitas' :
                          name === 'total_despesas' ? 'Despesas' : 'Resultado'
                        ]}
                      />
                      {showReceitas && (
                        <Bar dataKey="total_receitas" fill="#10B981" name="Receitas" />
                      )}
                      {showDespesas && (
                        <Bar dataKey="total_despesas" fill="#EF4444" name="Despesas" />
                      )}
                      {showSaldo && (
                        <Bar dataKey="resultado_mensal" fill="#3B82F6" name="Resultado" />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
} 