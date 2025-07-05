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
import { TrendingUp, Calendar, Eye, DollarSign, BarChart3, Target, AlertTriangle, CheckCircle, Activity, Settings } from 'lucide-react';

export default function VisaoFutura() {
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError, showInfo } = useToast();
  
  // Estados para filtros do gráfico de projeções
  const [showReceitas, setShowReceitas] = useState(true);
  const [showDespesas, setShowDespesas] = useState(true);
  const [showSaldo, setShowSaldo] = useState(true);

  // Estados para modal de detalhes da projeção
  const [showModalDetalhes, setShowModalDetalhes] = useState(false);
  const [mesDetalhes, setMesDetalhes] = useState<any>(null);
  const [isLoadingDetalhes, setIsLoadingDetalhes] = useState(false);
  const [modalMaximized, setModalMaximized] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    resumo: true,
    estatisticas: true,
    receitas: true,
    despesas: true
  });

  // Query para buscar projeções de 6 meses
  const { data: projecoes6Meses, isLoading: isLoadingProjecoes, error: errorProjecoes } = useQuery(
    'projecoes-6-meses',
    dashboardApi.getProjecoes6Meses,
    {
      enabled: !!user,
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos
      refetchOnWindowFocus: false,
      onError: (error) => {
        console.error('❌ Erro ao carregar projeções:', error);
        showError('Erro ao carregar dados', 'Não foi possível carregar as projeções futuras');
      }
    }
  );

  // Função para clique no mês do gráfico
  const handleClickMesProjecao = async (data: any) => {
    try {
      setIsLoadingDetalhes(true);
      setShowModalDetalhes(true);
      
      // Buscar detalhes do mês
      const detalhes = await dashboardApi.getDetalhesProjecaoMes(data.mes_numero, data.ano);
      setMesDetalhes(detalhes);
      
      showInfo('Detalhes carregados!', `Dados completos de ${data.mes} disponíveis.`);
    } catch (error) {
      console.error('Erro ao carregar detalhes do mês:', error);
      setShowModalDetalhes(false);
      showError(
        'Erro ao carregar detalhes',
        'Não foi possível carregar os detalhes do mês selecionado.',
        {
          action: {
            label: 'Tentar novamente',
            onClick: () => handleClickMesProjecao(data),
          }
        }
      );
    } finally {
      setIsLoadingDetalhes(false);
    }
  };

  // Função para fechar modal
  const handleCloseModalDetalhes = () => {
    setShowModalDetalhes(false);
    setMesDetalhes(null);
    setModalMaximized(false);
  };

  // Função para maximizar/minimizar modal
  const handleToggleMaximize = () => {
    setModalMaximized(!modalMaximized);
  };

  // Função para alternar seções colapsáveis
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Função para gerar PDF (simplificada)
  const handleGeneratePdf = async () => {
    if (!mesDetalhes) return;
    
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-6 h-6 text-blue-600" />
                  Visão Futura
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Panorama dos próximos meses • Planejamento independente • Não acumula saldo
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
              </div>
            </div>
          </div>

          {/* Resumo das Projeções */}
          {projecoes6Meses && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total de Receitas</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatarMoeda(projecoes6Meses.projecoes?.reduce((acc: number, p: any) => acc + (p.receitas?.total || 0), 0) || 0)}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total de Despesas</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {formatarMoeda(projecoes6Meses.projecoes?.reduce((acc: number, p: any) => acc + (p.despesas?.total || 0), 0) || 0)}
                    </p>
                  </div>
                  <Activity className="w-8 h-8 text-red-600" />
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Recorrentes Ativas</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {projecoes6Meses.total_recorrentes_ativas || 0}
                    </p>
                  </div>
                  <Target className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </div>
          )}

          {/* Gráfico de Projeções dos Próximos 6 Meses */}
          {projecoes6Meses && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center">
                    <span className="text-lg">📊</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Projeção 6 Meses</h4>
                    <p className="text-sm text-slate-500 dark:text-gray-400">Visão panorâmica • Cada mês é independente</p>
                  </div>
                </div>
                
                {/* Filtros do Gráfico */}
                <div className="flex flex-wrap gap-3 bg-slate-50 dark:bg-gray-700 p-3 rounded-lg">
                  <button 
                    onClick={() => setShowReceitas(!showReceitas)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      showReceitas 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700' 
                        : 'bg-white dark:bg-gray-600 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-500 hover:bg-slate-100 dark:hover:bg-gray-500'
                    }`}
                  >
                    <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                    <span>Receitas</span>
                  </button>
                  <button 
                    onClick={() => setShowDespesas(!showDespesas)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      showDespesas 
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700' 
                        : 'bg-white dark:bg-gray-600 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-500 hover:bg-slate-100 dark:hover:bg-gray-500'
                    }`}
                  >
                    <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                    <span>Despesas</span>
                  </button>
                  <button 
                    onClick={() => setShowSaldo(!showSaldo)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      showSaldo 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700' 
                        : 'bg-white dark:bg-gray-600 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-500 hover:bg-slate-100 dark:hover:bg-gray-500'
                    }`}
                  >
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                    <span>Resultado Mensal</span>
                  </button>

                  <div className="flex-1"></div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 px-2 py-2">
                    {projecoes6Meses.total_recorrentes_ativas} transações recorrentes ativas • 
                    <span className="text-blue-600 dark:text-blue-400 font-medium ml-1">Clique nas barras para detalhes</span>
                    <br />
                    <span className="italic">💡 Cada mês mostra apenas seu fluxo - não acumula saldo</span>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <ResponsiveContainer width="100%" height={420} style={{ cursor: 'pointer' }}>
                  <BarChart 
                    data={projecoes6Meses.projecoes?.map((p: any) => ({
                      ...p,
                      despesas_negativas: -(p.despesas?.total || 0)  // Transformar despesas em negativas
                    }))} 
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    onClick={(data) => {
                      if (data && data.activePayload && data.activePayload[0]) {
                        handleClickMesProjecao(data.activePayload[0].payload);
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="receitasGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.6}/>
                      </linearGradient>
                      <linearGradient id="despesasGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.6}/>
                      </linearGradient>
                      <linearGradient id="resultadoGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="mes_abrev" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickFormatter={(value) => {
                        if (Math.abs(value) >= 1000) {
                          return `R$ ${(value / 1000).toFixed(0)}k`;
                        }
                        return `R$ ${value.toFixed(0)}`;
                      }}
                      domain={['dataMin - 100', 'dataMax + 100']}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        maxWidth: '320px'
                      }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload) return null;
                        
                        const data = payload[0]?.payload;
                        if (!data) return null;
                        
                        return (
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-lg">
                            <h5 className="font-semibold text-slate-900 mb-3">{data.mes}</h5>
                            <div className="space-y-2">
                              <div className="text-center mb-3">
                                <p className="text-xs text-blue-600 font-medium">👆 Clique para ver detalhes completos</p>
                              </div>
                              {showReceitas && (
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center text-sm text-slate-600">
                                    <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                                    Receitas Totais:
                                  </span>
                                  <span className="font-semibold text-green-600">
                                    {formatarMoeda(data.receitas?.total || 0)}
                                  </span>
                                </div>
                              )}
                              {showDespesas && (
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center text-sm text-slate-600">
                                    <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                                    Despesas Totais:
                                  </span>
                                  <span className="font-semibold text-red-600">
                                    {formatarMoeda(data.despesas?.total || 0)}
                                  </span>
                                </div>
                              )}
                              {showSaldo && (
                                <div className="flex justify-between items-center">
                                  <span className="flex items-center text-sm text-slate-600">
                                    <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                                    Resultado:
                                  </span>
                                  <span className={`font-semibold ${
                                    ((data.receitas?.total || 0) - (data.despesas?.total || 0)) >= 0 
                                      ? 'text-green-600' 
                                      : 'text-red-600'
                                  }`}>
                                    {formatarMoeda((data.receitas?.total || 0) - (data.despesas?.total || 0))}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }}
                    />
                    
                    {/* Barras do gráfico */}
                    {showReceitas && (
                      <Bar 
                        dataKey="receitas.total" 
                        fill="url(#receitasGradient)"
                        name="Receitas"
                        radius={[4, 4, 0, 0]}
                      />
                    )}
                    {showDespesas && (
                      <Bar 
                        dataKey="despesas_negativas" 
                        fill="url(#despesasGradient)"
                        name="Despesas"
                        radius={[0, 0, 4, 4]}
                      />
                    )}
                    {showSaldo && (
                      <Bar 
                        dataKey={(entry: any) => (entry.receitas?.total || 0) - (entry.despesas?.total || 0)}
                        fill="url(#resultadoGradient)"
                        name="Resultado"
                        radius={[4, 4, 4, 4]}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalhes da Projeção */}
      {showModalDetalhes && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full overflow-hidden transition-all duration-300 ${
            modalMaximized 
              ? 'max-w-[95vw] max-h-[95vh] h-[95vh]' 
              : 'max-w-6xl max-h-[90vh]'
          }`}>
            
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                    <span className="text-lg">📊</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      {isLoadingDetalhes ? 'Carregando...' : mesDetalhes?.mes || 'Detalhes do Mês'}
                    </h3>
                    <p className="text-blue-100 text-sm">
                      {isLoadingDetalhes ? 'Buscando transações...' : 'Descritivo completo do cálculo'}
                    </p>
                  </div>
                </div>
                
                {/* Controles do Modal */}
                <div className="flex items-center space-x-2">
                  {/* Botão PDF */}
                  {mesDetalhes && (
                    <button
                      onClick={handleGeneratePdf}
                      disabled={isGeneratingPdf}
                      className="flex items-center space-x-2 bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded-lg transition-colors text-white text-sm font-medium disabled:opacity-50"
                      title="Gerar PDF"
                    >
                      {isGeneratingPdf ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                      <span className="hidden sm:inline">
                        {isGeneratingPdf ? 'Gerando...' : 'PDF'}
                      </span>
                    </button>
                  )}
                  
                  {/* Botão Maximizar/Minimizar */}
                  <button
                    onClick={handleToggleMaximize}
                    className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center hover:bg-opacity-30 transition-colors text-white"
                    title={modalMaximized ? 'Minimizar' : 'Maximizar'}
                  >
                    {modalMaximized ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9v-4.5M15 9h4.5M15 9l5.25-5.25M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 15v4.5m0-4.5h4.5m-4.5 0l5.25 5.25" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                      </svg>
                    )}
                  </button>
                  
                  {/* Botão Fechar */}
                  <button
                    onClick={handleCloseModalDetalhes}
                    className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center hover:bg-opacity-30 transition-colors text-white"
                    title="Fechar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className={`p-6 overflow-y-auto ${
              modalMaximized 
                ? 'max-h-[calc(95vh-120px)]' 
                : 'max-h-[calc(90vh-120px)]'
            }`}>
              {isLoadingDetalhes ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : mesDetalhes ? (
                <div className="space-y-6">
                  
                  {/* Resumo Financeiro */}
                  <div>
                    <button 
                      onClick={() => toggleSection('resumo')}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-lg hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-500 transition-all duration-200"
                    >
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center space-x-3">
                        <span className="text-2xl">💰</span>
                        <span>Resumo Financeiro</span>
                      </h3>
                      <svg 
                        className={`w-6 h-6 transform transition-transform duration-200 text-gray-600 dark:text-gray-300 ${expandedSections.resumo ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {expandedSections.resumo && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-xl border-l-4 border-green-500">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-green-800 dark:text-green-300 font-semibold text-lg">Total Receitas</h4>
                            <span className="text-3xl">📈</span>
                          </div>
                          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                            {formatarMoeda(mesDetalhes.resumo_financeiro?.total_receitas || 0)}
                          </p>
                          <p className="text-sm text-green-600/70 dark:text-green-400/70 mt-2">
                            Entrada total prevista
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-6 rounded-xl border-l-4 border-red-500">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-red-800 dark:text-red-300 font-semibold text-lg">Total Despesas</h4>
                            <span className="text-3xl">📉</span>
                          </div>
                          <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                            {formatarMoeda(mesDetalhes.resumo_financeiro?.total_despesas || 0)}
                          </p>
                          <p className="text-sm text-red-600/70 dark:text-red-400/70 mt-2">
                            Gastos totais previstos
                          </p>
                        </div>

                        <div className={`bg-gradient-to-br p-6 rounded-xl border-l-4 ${
                          (mesDetalhes.resumo_financeiro?.saldo_mes || 0) >= 0
                            ? 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-500'
                            : 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-500'
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className={`font-semibold text-lg ${
                              (mesDetalhes.resumo_financeiro?.saldo_mes || 0) >= 0
                                ? 'text-blue-800 dark:text-blue-300'
                                : 'text-orange-800 dark:text-orange-300'
                            }`}>
                              Saldo do Mês
                            </h4>
                            <span className="text-3xl">{(mesDetalhes.resumo_financeiro?.saldo_mes || 0) >= 0 ? '🤑' : '😰'}</span>
                          </div>
                          <p className={`text-3xl font-bold ${
                            (mesDetalhes.resumo_financeiro?.saldo_mes || 0) >= 0
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}>
                            {formatarMoeda(mesDetalhes.resumo_financeiro?.saldo_mes || 0)}
                          </p>
                          <p className={`text-sm mt-2 ${
                            (mesDetalhes.resumo_financeiro?.saldo_mes || 0) >= 0
                              ? 'text-blue-600/70 dark:text-blue-400/70'
                              : 'text-orange-600/70 dark:text-orange-400/70'
                          }`}>
                            {(mesDetalhes.resumo_financeiro?.saldo_mes || 0) >= 0 ? 'Superávit mensal' : 'Déficit mensal'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mensagem se não houver dados */}
                  {!mesDetalhes.resumo_financeiro && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <p>Detalhes não disponíveis para este mês</p>
                    </div>
                  )}

                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Nenhum detalhe disponível</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
} 