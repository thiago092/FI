import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import ToastContainer from '../components/ToastContainer';
import { useToast } from '../hooks/useToast';
import { categoriasApi, cartoesApi, contasApi, dashboardApi, transacoesRecorrentesApi } from '../services/api';
import { useQuery } from 'react-query';
import { useDashboardInvalidation } from '../hooks/useDashboardInvalidation';
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart
} from 'recharts';

interface Categoria {
  id: number;
  nome: string;
  cor: string;
  icone: string;
}

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
  limite: number;
  vencimento: number;
  dia_fechamento?: number; // Novo campo para dia de fechamento
  cor: string;
  ativo: boolean;
  fatura?: FaturaInfo;
}

interface Conta {
  id: number;
  nome: string;
  banco: string;
  tipo: string;
  saldo_inicial: number;
  saldo_atual?: number;
  cor: string;
  resumo?: {
    saldo_atual: number;
    total_entradas: number;
    total_saidas: number;
    ultima_movimentacao?: number;
    data_ultima_movimentacao?: string;
    total_transacoes: number;
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError, showInfo, showLoadingToast } = useToast();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  // Estados de carregamento em cascata
  const [loadingStates, setLoadingStates] = useState({
    quickStats: true,      // Cards de resumo rápido
    charts: true,          // Gráficos principais
    projecoes: true,       // Projeções futuras
    projecoes6Meses: true, // Projeções 6 meses
    completo: true         // Carregamento geral
  });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
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

  // Hook para invalidação inteligente
  const { invalidateOnReturn } = useDashboardInvalidation();

  // SISTEMA DE CACHE COM ATUALIZAÇÃO EM BACKGROUND
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery(
    'dashboard-unified',
    async () => {
      // Carregar TODOS os dados dos gráficos em paralelo
      const [chartsData, projecoesData, resumoRecorrentes, projecoes6Meses] = await Promise.all([
        dashboardApi.getChartsData(),
        dashboardApi.getProjecoesFuturas(),
        transacoesRecorrentesApi.getResumo(),
        dashboardApi.getProjecoes6Meses()
      ]);
      
      return {
        charts: chartsData,
        projecoes: projecoesData,
        resumoRecorrentes,
        projecoes6Meses
      };
    },
    {
      enabled: !!user,
      staleTime: 0, // SEMPRE considerar dados como stale para permitir atualização em background
      cacheTime: 10 * 60 * 1000, // 10 minutos de cache
      refetchOnWindowFocus: true, // Atualizar ao voltar para a aba
      refetchOnMount: false, // NÃO refetch ao montar (usa cache primeiro)
      refetchOnReconnect: true, // Atualizar ao reconectar
      // Atualização em background automática
      refetchInterval: 30 * 1000, // Atualizar a cada 30 segundos em background
      refetchIntervalInBackground: true, // Continuar atualizando mesmo com aba inativa
    }
  );

  // Extrair dados da query unificada (com fallbacks para evitar erros)
  const chartsData = dashboardData?.charts;
  const projecoesData = dashboardData?.projecoes;  
  const resumoRecorrentes = dashboardData?.resumoRecorrentes;
  const projecoes6Meses = dashboardData?.projecoes6Meses;
  
  // Estados de loading unificados (mantidos para compatibilidade com query)
  const chartsLoading = dashboardLoading;
  const projecoesLoading = dashboardLoading;
  const resumoRecorrentesLoading = dashboardLoading;
  const projecoes6MesesLoading = dashboardLoading;

  // SISTEMA DE CACHE COM ATUALIZAÇÃO EM BACKGROUND
  const loadData = async (forceRefresh = false) => {
    try {
      // Se não for refresh forçado, usar cache primeiro
      if (!forceRefresh && (categorias.length > 0 || cartoes.length > 0 || contas.length > 0)) {
        console.log('📱 Usando dados do cache - atualização em background');
        setLastUpdate(new Date());
        
        // Atualizar em background sem bloquear interface
        setTimeout(async () => {
          try {
            console.log('🔄 Atualizando dados em background...');
            const [categoriasData, cartoesData, contasData] = await Promise.all([
              categoriasApi.getAll(),
              cartoesApi.getAllComFatura(),
              contasApi.getAll()
            ]);
            
            // Atualizar dados silenciosamente
            setCategorias(categoriasData);
            setCartoes(cartoesData);
            
            const contasComResumo = await Promise.all(
              contasData.map(async (conta: any) => {
                try {
                  const contaComResumo = await contasApi.getResumo(conta.id);
                  return contaComResumo;
                } catch (error) {
                  console.error(`Erro ao carregar resumo da conta ${conta.id}:`, error);
                  return { ...conta, saldo_atual: conta.saldo_inicial };
                }
              })
            );
            
            setContas(contasComResumo);
            setLastUpdate(new Date());
            console.log('✅ Dados atualizados em background');
          } catch (error) {
            console.error('❌ Erro na atualização em background:', error);
          }
        }, 100);
        
        return;
      }
      
      // Carregamento inicial ou refresh forçado
      setLoadingStates(prev => ({ ...prev, completo: true }));
      console.log('🔄 Carregamento inicial/forçado...');
      
      const [categoriasData, cartoesData, contasData] = await Promise.all([
        categoriasApi.getAll(),
        cartoesApi.getAllComFatura(),
        contasApi.getAll()
      ]);
      
      setCategorias(categoriasData);
      setCartoes(cartoesData);
      
      const contasComResumo = await Promise.all(
        contasData.map(async (conta: any) => {
          try {
            const contaComResumo = await contasApi.getResumo(conta.id);
            return contaComResumo;
          } catch (error) {
            console.error(`Erro ao carregar resumo da conta ${conta.id}:`, error);
            return { ...conta, saldo_atual: conta.saldo_inicial };
          }
        })
      );
      
      setContas(contasComResumo);
      setLoadingStates(prev => ({ ...prev, completo: false }));
      setLastUpdate(new Date());
      
      if (forceRefresh) {
        showSuccess('Dashboard atualizado!', 'Dados carregados com sucesso.');
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados do dashboard:', error);
      setLoadingStates(prev => ({ 
        quickStats: false, 
        charts: false, 
        projecoes: false, 
        projecoes6Meses: false, 
        completo: false 
      }));
      
      showError(
        'Erro ao carregar dados',
        'Não foi possível carregar os dados do dashboard. Tente novamente.',
        {
          action: {
            label: 'Tentar novamente',
            onClick: () => loadData(true),
          }
        }
      );
    }
  };

  // Carregar dados do backend
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Invalidação inteligente ao voltar de páginas
  useEffect(() => {
    // Detectar de onde o usuário veio usando navigation state
    const fromPage = location.state?.from;
    
    if (fromPage) {
      console.log(`📱 Chegou no dashboard vindo de: ${fromPage}`);
      invalidateOnReturn(fromPage);
      
      // Limpar state para evitar invalidações desnecessárias
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location, invalidateOnReturn]);

  // Função de refresh manual
  const handleRefresh = async () => {
    const loadingToastId = showLoadingToast('Atualizando dashboard...');
    
    try {
      await loadData(true); // Forçar refresh completo
      
      removeToast(loadingToastId);
      showSuccess('Dashboard atualizado!', 'Todos os dados foram atualizados com sucesso.');
    } catch (error) {
      removeToast(loadingToastId);
      console.error('❌ Erro durante refresh manual:', error);
      showError(
        'Erro na atualização',
        'Não foi possível atualizar todos os dados. Alguns podem estar desatualizados.',
        {
          action: {
            label: 'Tentar novamente',
            onClick: () => handleRefresh(),
          }
        }
      );
    }
  };

  // Função para abrir modal de detalhes da projeção
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

  // Função para gerar PDF (versão simplificada)
  const handleGeneratePdf = async () => {
    if (!mesDetalhes) return;
    
    try {
      setIsGeneratingPdf(true);
      showInfo('Gerando PDF...', 'Preparando relatório para impressão.');
      
      // Criar conteúdo profissional para impressão
      const reportContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2d3748; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px 20px;">
          
          <!-- Cabeçalho Profissional -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 20px; text-align: center; margin-bottom: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
            <div style="background: rgba(255,255,255,0.1); display: inline-block; padding: 15px; border-radius: 50%; margin-bottom: 20px;">
              <span style="font-size: 48px;">📊</span>
            </div>
            <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -1px;">Relatório Financeiro Detalhado</h1>
            <h2 style="margin: 15px 0 5px 0; font-size: 24px; font-weight: 400; opacity: 0.9;">${mesDetalhes.mes}</h2>
            <p style="margin: 0; font-size: 16px; opacity: 0.8;">
              📅 Período: ${new Date(mesDetalhes.periodo.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} 
              até ${new Date(mesDetalhes.periodo.fim).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <!-- Resumo Executivo -->
          <div style="background: #f8fafc; padding: 30px; border-radius: 15px; margin-bottom: 40px; border-left: 5px solid #3b82f6;">
            <h3 style="color: #1e40af; margin: 0 0 25px 0; font-size: 24px; display: flex; align-items: center; gap: 10px;">
              <span style="background: #dbeafe; padding: 8px; border-radius: 8px; font-size: 20px;">💰</span>
              Resumo Executivo
            </h3>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px;">
              <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border: 2px solid #dcfce7;">
                <div style="color: #16a34a; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">📈 Receitas</div>
                <div style="color: #15803d; font-size: 28px; font-weight: 700; margin-bottom: 5px;">R$ ${mesDetalhes.resumo_financeiro.total_receitas.toLocaleString('pt-BR')}</div>
                <div style="color: #16a34a; font-size: 12px;">${mesDetalhes.estatisticas.transacoes_reais} realizadas</div>
              </div>
              
              <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border: 2px solid #fee2e2;">
                <div style="color: #dc2626; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">📉 Despesas</div>
                <div style="color: #dc2626; font-size: 28px; font-weight: 700; margin-bottom: 5px;">R$ ${mesDetalhes.resumo_financeiro.total_despesas.toLocaleString('pt-BR')}</div>
                <div style="color: #dc2626; font-size: 12px;">${mesDetalhes.estatisticas.total_transacoes} transações</div>
              </div>
              
              <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border: 2px solid ${mesDetalhes.resumo_financeiro.saldo_mes >= 0 ? '#dbeafe' : '#fed7aa'};">
                <div style="color: ${mesDetalhes.resumo_financeiro.saldo_mes >= 0 ? '#2563eb' : '#ea580c'}; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                  ${mesDetalhes.resumo_financeiro.saldo_mes >= 0 ? '🤑 Saldo Positivo' : '😰 Saldo Negativo'}
                </div>
                <div style="color: ${mesDetalhes.resumo_financeiro.saldo_mes >= 0 ? '#1d4ed8' : '#ea580c'}; font-size: 28px; font-weight: 700; margin-bottom: 5px;">R$ ${mesDetalhes.resumo_financeiro.saldo_mes.toLocaleString('pt-BR')}</div>
                <div style="color: ${mesDetalhes.resumo_financeiro.saldo_mes >= 0 ? '#2563eb' : '#ea580c'}; font-size: 12px;">
                  ${mesDetalhes.resumo_financeiro.saldo_mes >= 0 ? 'Superávit' : 'Déficit'} mensal
                </div>
              </div>
            </div>
          </div>

          <!-- Análise de Receitas -->
          <div style="background: white; padding: 30px; border-radius: 15px; margin-bottom: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border-top: 4px solid #16a34a;">
            <h3 style="color: #15803d; margin: 0 0 25px 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
              <span style="background: #dcfce7; padding: 8px; border-radius: 8px; font-size: 18px;">📈</span>
              Análise Detalhada de Receitas
              <span style="background: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-left: auto;">
                R$ ${mesDetalhes.receitas.total.toLocaleString('pt-BR')}
              </span>
            </h3>
            
            ${mesDetalhes.receitas.reais.transacoes.length > 0 ? `
              <div style="margin-bottom: 25px;">
                <h4 style="color: #16a34a; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                  <span style="background: #f0fdf4; padding: 6px; border-radius: 6px;">💰</span>
                  Receitas Realizadas
                  <span style="background: #f0fdf4; color: #16a34a; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                    R$ ${mesDetalhes.receitas.reais.total.toLocaleString('pt-BR')}
                  </span>
                </h4>
                ${mesDetalhes.receitas.reais.transacoes.map((t: any) => `
                  <div style="padding: 12px; background: #f8fffe; border-left: 4px solid #16a34a; margin-bottom: 8px; border-radius: 0 8px 8px 0;">
                    <div style="display: flex; justify-content: between; align-items: center;">
                      <strong style="color: #15803d;">${t.descricao}</strong>
                      <span style="color: #15803d; font-weight: 700; font-size: 16px;">R$ ${t.valor.toLocaleString('pt-BR')}</span>
                    </div>
                    <div style="color: #16a34a; font-size: 14px; margin-top: 4px;">
                      ${new Date(t.data).toLocaleDateString('pt-BR')} • ${t.categoria}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${mesDetalhes.receitas.recorrentes.transacoes.length > 0 ? `
              <div style="margin-bottom: 20px;">
                <h4 style="color: #16a34a; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                  <span style="background: #f0fdf4; padding: 6px; border-radius: 6px;">🔄</span>
                  Receitas Previstas (Recorrentes)
                  <span style="background: #f0fdf4; color: #16a34a; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                    R$ ${mesDetalhes.receitas.recorrentes.total.toLocaleString('pt-BR')}
                  </span>
                </h4>
                ${mesDetalhes.receitas.recorrentes.transacoes.map((t: any) => `
                  <div style="padding: 12px; background: #f8fffe; border-left: 4px solid #16a34a; margin-bottom: 8px; border-radius: 0 8px 8px 0; opacity: 0.8; border-style: dashed;">
                    <div style="display: flex; justify-content: between; align-items: center;">
                      <strong style="color: #15803d;">${t.descricao}</strong>
                      <span style="color: #15803d; font-weight: 700; font-size: 16px;">R$ ${t.valor.toLocaleString('pt-BR')}</span>
                    </div>
                    <div style="color: #16a34a; font-size: 14px; margin-top: 4px;">
                      ${new Date(t.data).toLocaleDateString('pt-BR')} • ${t.frequencia}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Análise de Despesas -->
          <div style="background: white; padding: 30px; border-radius: 15px; margin-bottom: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border-top: 4px solid #dc2626;">
            <h3 style="color: #dc2626; margin: 0 0 25px 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
              <span style="background: #fee2e2; padding: 8px; border-radius: 8px; font-size: 18px;">📉</span>
              Análise Detalhada de Despesas
              <span style="background: #fee2e2; color: #dc2626; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-left: auto;">
                R$ ${mesDetalhes.despesas.total.toLocaleString('pt-BR')}
              </span>
            </h3>

            ${mesDetalhes.despesas.reais_cartao.transacoes.length > 0 ? `
              <div style="margin-bottom: 25px;">
                <h4 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                  <span style="background: #fef2f2; padding: 6px; border-radius: 6px;">💳</span>
                  Despesas no Cartão de Crédito
                  <span style="background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                    R$ ${mesDetalhes.despesas.reais_cartao.total.toLocaleString('pt-BR')}
                  </span>
                </h4>
                ${mesDetalhes.despesas.reais_cartao.transacoes.map((t: any) => `
                  <div style="padding: 12px; background: #fffbfb; border-left: 4px solid #dc2626; margin-bottom: 8px; border-radius: 0 8px 8px 0;">
                    <div style="display: flex; justify-content: between; align-items: center;">
                      <strong style="color: #b91c1c;">${t.descricao}</strong>
                      <span style="color: #b91c1c; font-weight: 700; font-size: 16px;">R$ ${t.valor.toLocaleString('pt-BR')}</span>
                    </div>
                    <div style="color: #dc2626; font-size: 14px; margin-top: 4px;">
                      ${new Date(t.data).toLocaleDateString('pt-BR')} • ${t.cartao}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${mesDetalhes.despesas.reais_conta.transacoes.length > 0 ? `
              <div style="margin-bottom: 25px;">
                <h4 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                  <span style="background: #fef2f2; padding: 6px; border-radius: 6px;">🏦</span>
                  Despesas na Conta Bancária
                  <span style="background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                    R$ ${mesDetalhes.despesas.reais_conta.total.toLocaleString('pt-BR')}
                  </span>
                </h4>
                ${mesDetalhes.despesas.reais_conta.transacoes.map((t: any) => `
                  <div style="padding: 12px; background: #fffbfb; border-left: 4px solid #dc2626; margin-bottom: 8px; border-radius: 0 8px 8px 0;">
                    <div style="display: flex; justify-content: between; align-items: center;">
                      <strong style="color: #b91c1c;">${t.descricao}</strong>
                      <span style="color: #b91c1c; font-weight: 700; font-size: 16px;">R$ ${t.valor.toLocaleString('pt-BR')}</span>
                    </div>
                    <div style="color: #dc2626; font-size: 14px; margin-top: 4px;">
                      ${new Date(t.data).toLocaleDateString('pt-BR')} • ${t.conta}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${mesDetalhes.despesas.recorrentes.transacoes.length > 0 ? `
              <div style="margin-bottom: 25px;">
                <h4 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                  <span style="background: #fef2f2; padding: 6px; border-radius: 6px;">🔄</span>
                  Despesas Recorrentes
                  <span style="background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                    R$ ${mesDetalhes.despesas.recorrentes.total.toLocaleString('pt-BR')}
                  </span>
                </h4>
                ${mesDetalhes.despesas.recorrentes.transacoes.map((t: any) => `
                  <div style="padding: 12px; background: #fffbfb; border-left: 4px solid #dc2626; margin-bottom: 8px; border-radius: 0 8px 8px 0; opacity: 0.8; border-style: dashed;">
                    <div style="display: flex; justify-content: between; align-items: center;">
                      <strong style="color: #b91c1c;">${t.descricao}</strong>
                      <span style="color: #b91c1c; font-weight: 700; font-size: 16px;">R$ ${t.valor.toLocaleString('pt-BR')}</span>
                    </div>
                    <div style="color: #dc2626; font-size: 14px; margin-top: 4px;">
                      ${new Date(t.data).toLocaleDateString('pt-BR')} • ${t.destino === 'cartao' ? t.cartao : t.conta}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${mesDetalhes.despesas.parcelamentos.transacoes.length > 0 ? `
              <div style="margin-bottom: 20px;">
                <h4 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                  <span style="background: #fef2f2; padding: 6px; border-radius: 6px;">💱</span>
                  Parcelamentos
                  <span style="background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                    R$ ${mesDetalhes.despesas.parcelamentos.total.toLocaleString('pt-BR')}
                  </span>
                </h4>
                ${mesDetalhes.despesas.parcelamentos.transacoes.map((t: any) => `
                  <div style="padding: 12px; background: #fffbfb; border-left: 4px solid #dc2626; margin-bottom: 8px; border-radius: 0 8px 8px 0;">
                    <div style="display: flex; justify-content: between; align-items: center;">
                      <strong style="color: #b91c1c;">${t.descricao}</strong>
                      <span style="color: #b91c1c; font-weight: 700; font-size: 16px;">R$ ${t.valor.toLocaleString('pt-BR')}</span>
                    </div>
                    <div style="color: #dc2626; font-size: 14px; margin-top: 4px;">
                      ${new Date(t.data).toLocaleDateString('pt-BR')} • ${t.cartao}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Rodapé Profissional -->
          <div style="text-align: center; margin-top: 50px; padding: 30px 20px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 15px; color: #64748b;">
            <div style="margin-bottom: 15px;">
              <span style="background: #475569; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                📊 RELATÓRIO GERADO AUTOMATICAMENTE
              </span>
            </div>
            <p style="margin: 10px 0 5px 0; font-size: 16px; color: #475569; font-weight: 500;">
              Gerado em ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} às ${new Date().toLocaleTimeString('pt-BR')}
            </p>
            <p style="margin: 0; font-size: 14px; color: #64748b;">
              <strong>FinançasAI</strong> - Sistema Inteligente de Gestão Financeira Personal
            </p>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #cbd5e1;">
              <span style="font-size: 12px; color: #94a3b8;">
                Este relatório contém informações confidenciais e deve ser mantido em sigilo
              </span>
            </div>
          </div>
          
        </div>
      `;
      
      // Criar nova janela para impressão
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Relatório Financeiro - ${mesDetalhes.mes}</title>
              <meta charset="UTF-8">
              <style>
                @media print {
                  body { 
                    margin: 0; 
                    -webkit-print-color-adjust: exact;
                    color-adjust: exact;
                  }
                  @page { 
                    margin: 0.5in; 
                    size: A4;
                  }
                  * {
                    -webkit-print-color-adjust: exact !important;
                    color-adjust: exact !important;
                  }
                }
                @media screen {
                  body {
                    background: #f5f5f5;
                    padding: 20px;
                  }
                }
              </style>
            </head>
            <body>
              ${reportContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        
        // Aguardar carregamento e imprimir
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            setTimeout(() => printWindow.close(), 500);
          }, 250);
        };
      }
      
      showSuccess('PDF gerado!', 'Relatório pronto para impressão ou download.');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      showError(
        'Erro ao gerar PDF',
        'Não foi possível gerar o relatório. Tente novamente.',
        {
          action: {
            label: 'Tentar novamente',
            onClick: () => handleGeneratePdf(),
          }
        }
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Calcular totais reais dos cartões
  const totalContas = contas.reduce((sum, conta) => {
    // Usar resumo.saldo_atual se disponível, caso contrário usar saldo_inicial
    const saldo = conta.resumo?.saldo_atual !== undefined ? conta.resumo.saldo_atual : conta.saldo_atual !== undefined ? conta.saldo_atual : conta.saldo_inicial;
    return sum + saldo;
  }, 0);
  const totalLimiteCartoes = cartoes.reduce((sum, cartao) => sum + cartao.limite, 0);
  const totalFaturaAtual = cartoes.reduce((sum, cartao) => sum + (cartao.fatura?.valor_atual || 0), 0);
  const limiteDisponivel = totalLimiteCartoes - totalFaturaAtual;
  const percentualDisponivel = totalLimiteCartoes > 0 ? Math.floor((limiteDisponivel / totalLimiteCartoes) * 100) : 0;

  // Funções auxiliares para lógica temporal das faturas com dia de fechamento
  const calcularStatusFatura = (cartao: Cartao) => {
    const hoje = new Date();
    const diaAtual = hoje.getDate();
    
    // Usar dia_fechamento se disponível, senão vencimento - 5 como fallback
    const diaFechamento = cartao.dia_fechamento || (cartao.vencimento > 5 ? cartao.vencimento - 5 : 25);
    const diaVencimento = cartao.vencimento;
    
    // Se há informação de dias para vencimento do backend, usar ela
    if (cartao.fatura?.dias_para_vencimento !== null && cartao.fatura?.dias_para_vencimento !== undefined) {
      if (cartao.fatura.dias_para_vencimento < 0) {
        // Fatura vencida
        return {
          status: 'vencida' as const,
          diasParaFechamento: null,
          diasParaVencimento: Math.abs(cartao.fatura.dias_para_vencimento)
        };
      } else if (diaAtual > diaFechamento) {
        // Fatura fechada (já passou do dia de fechamento)
        return {
          status: 'fechada' as const,
          diasParaFechamento: null,
          diasParaVencimento: cartao.fatura.dias_para_vencimento
        };
      } else {
        // Fatura aberta (ainda no período de compras)
        return {
          status: 'aberta' as const,
          diasParaFechamento: diaFechamento - diaAtual,
          diasParaVencimento: cartao.fatura.dias_para_vencimento
        };
      }
    }
    
    // Fallback baseado no dia de fechamento manual
    if (diaAtual <= diaFechamento) {
      // Ainda no período de compras
      return {
        status: 'aberta' as const,
        diasParaFechamento: diaFechamento - diaAtual,
        diasParaVencimento: null
      };
    } else {
      // Já fechou, aguardando vencimento
      const diasParaVencimento = diaVencimento >= diaAtual ? 
        diaVencimento - diaAtual : 
        (30 - diaAtual + diaVencimento); // Próximo mês
      
      return {
        status: 'fechada' as const,
        diasParaFechamento: null,
        diasParaVencimento: diasParaVencimento
      };
    }
  };

  // Calcular totais por status de fatura
  const faturasAbertas = cartoes.filter(cartao => calcularStatusFatura(cartao).status === 'aberta');
  const faturasFechadas = cartoes.filter(cartao => calcularStatusFatura(cartao).status === 'fechada');
  const faturasVencidas = cartoes.filter(cartao => calcularStatusFatura(cartao).status === 'vencida');

  const totalFaturasAbertas = faturasAbertas.reduce((sum, cartao) => sum + (cartao.fatura?.valor_atual || 0), 0);
  const totalFaturasFechadas = faturasFechadas.reduce((sum, cartao) => sum + (cartao.fatura?.valor_atual || 0), 0);
  const totalFaturasVencidas = faturasVencidas.reduce((sum, cartao) => sum + (cartao.fatura?.valor_atual || 0), 0);

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

  return (
    <div className="min-h-screen-mobile bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation user={user} />

      <div className="container-mobile pb-safe">
        {/* Welcome Section */}
        <div className="py-6 lg:py-8">

          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div>
              <h2 className="text-responsive-heading text-slate-900 dark:text-white mb-2">
                Bem-vindo de volta, {user.full_name?.split(' ')[0] || 'Usuário'}! 👋
              </h2>
              <p className="text-slate-600 dark:text-gray-300 text-sm sm:text-base">
                Aqui está um resumo das suas finanças hoje, {new Date().toLocaleDateString('pt-BR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              {lastUpdate ? (
                <div className="flex items-center space-x-3 text-xs mt-1">
                  <p className="text-slate-500 dark:text-gray-400">
                    🕐 Última atualização: {lastUpdate.toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit'
                    })}
                  </p>
                  {loadingStates.completo && (
                    <p className="text-blue-500 dark:text-blue-400 animate-pulse">
                      🔄 Sincronizando...
                    </p>
                  )}
                  {!loadingStates.completo && (
                    <p className="text-green-500 dark:text-green-400 text-xs">
                      ✅ Atualização automática ativa
                    </p>
                  )}
                </div>
              ) : loadingStates.completo && (
                <p className="text-blue-500 dark:text-blue-400 text-xs mt-1 animate-pulse">
                  🔄 Carregando dados financeiros...
                </p>
              )}
            </div>
            
            <div className="flex items-center justify-center lg:justify-end gap-3">
              <button 
                onClick={handleRefresh}
                disabled={loadingStates.completo}
                className="btn-touch bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-gray-200 font-medium hover:bg-slate-50 dark:hover:bg-gray-700 hover:border-slate-300 dark:hover:border-gray-500 transition-all duration-200 shadow-sm hover:shadow-md space-x-2 touch-manipulation disabled:opacity-50"
                title="Atualizar todos os dados"
              >
                <svg 
                  className={`w-5 h-5 ${loadingStates.completo ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>
                  {loadingStates.completo 
                    ? 'Atualizando...' 
                    : 'Atualizar'
                  }
                </span>
              </button>
              
              <button 
                onClick={() => navigate('/settings?tab=telegram')}
                className="btn-touch bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 space-x-2 touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Telegram Bot</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card-mobile hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">R$ {totalContas.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">Total em Contas</p>
              </div>
            </div>
            <div className="flex items-center text-xs sm:text-sm">
              <div className="flex items-center text-green-600">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h1a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>{contas.length > 0 ? `${contas.length} conta${contas.length > 1 ? 's' : ''}` : 'Nenhuma conta'}</span>
              </div>
                              <span className="text-slate-400 dark:text-gray-500 ml-2">cadastrada{contas.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="card-mobile hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">R$ {totalFaturasAbertas.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">Fatura Aberta</p>
              </div>
            </div>
            <div className="flex items-center text-xs sm:text-sm">
              <div className="flex items-center text-blue-600">
                <div className="w-2 h-2 rounded-full mr-2 bg-blue-500"></div>
                <span>
                  {faturasAbertas.length > 0 
                    ? `${faturasAbertas.length} cartã${faturasAbertas.length > 1 ? 'ões' : 'o'} em compras`
                    : 'Nenhuma fatura aberta'
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="card-mobile hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">R$ {totalFaturasFechadas.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">Fatura Fechada</p>
              </div>
            </div>
            <div className="flex items-center text-xs sm:text-sm">
              <div className="flex items-center text-orange-600">
                <div className="w-2 h-2 rounded-full mr-2 bg-orange-500"></div>
                <span>
                  {faturasFechadas.length > 0 
                    ? (() => {
                        const proximoVencimento = faturasFechadas.find(c => c.fatura?.dias_para_vencimento)?.fatura?.dias_para_vencimento;
                        return proximoVencimento 
                          ? `Vence em ${proximoVencimento} dia${proximoVencimento > 1 ? 's' : ''}`
                          : 'Aguardando vencimento';
                      })()
                    : 'Nenhuma fatura fechada'
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="card-mobile hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${
                totalFaturasVencidas > 0 
                  ? 'bg-gradient-to-r from-red-500 to-rose-500' 
                  : 'bg-gradient-to-r from-purple-500 to-violet-500'
              }`}>
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {totalFaturasVencidas > 0 ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  )}
                </svg>
              </div>
              <div className="text-right">
                <p className={`text-xl sm:text-2xl font-bold ${
                  totalFaturasVencidas > 0 ? 'text-red-600' : 'text-purple-600'
                }`}>
                  {totalFaturasVencidas > 0 
                    ? `R$ ${totalFaturasVencidas.toLocaleString()}`
                    : `R$ ${limiteDisponivel.toLocaleString()}`
                  }
                </p>
                <p className="text-xs sm:text-sm text-slate-500">
                  {totalFaturasVencidas > 0 ? 'Fatura Vencida' : 'Limite Disponível'}
                </p>
              </div>
            </div>
            <div className="flex items-center text-xs sm:text-sm">
              <div className={`flex items-center ${
                totalFaturasVencidas > 0 ? 'text-red-600' : 'text-purple-600'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  totalFaturasVencidas > 0 ? 'bg-red-500' : 'bg-purple-500'
                }`}></div>
                <span>
                  {totalFaturasVencidas > 0 
                    ? `${faturasVencidas.length} cartã${faturasVencidas.length > 1 ? 'ões' : 'o'} em atraso`
                    : `${percentualDisponivel}% do limite livre`
                  }
                </span>
              </div>
            </div>
          </div>


        </div>

        {/* Loading das Projeções */}
        {loadingStates.projecoes && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">🔮 Visão Futura</h3>
                <p className="text-slate-600 dark:text-gray-300">Carregando projeções...</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 animate-pulse">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-slate-200 rounded-xl"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-20"></div>
                      <div className="h-3 bg-slate-200 rounded w-16"></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-6 bg-slate-200 rounded"></div>
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NOVA SEÇÃO: Projeções Futuras */}
        {!loadingStates.projecoes && projecoesData && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">🔮 Visão Futura</h3>
                <p className="text-slate-600 dark:text-gray-300">Projeções baseadas nas suas transações recorrentes</p>
              </div>
              <button 
                onClick={() => navigate('/transacoes-recorrentes')}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
              >
                Gerenciar recorrentes →
              </button>
            </div>



            {/* Gráfico de Projeções dos Próximos 6 Meses */}
            {!loadingStates.projecoes6Meses && projecoes6Meses && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                                      <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center">
                        <span className="text-lg">📊</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Projeção 6 Meses</h4>
                        <p className="text-sm text-slate-500 dark:text-gray-400">Receitas, despesas e evolução do saldo</p>
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
                      <span>Saldo Final</span>
                    </button>

                    <div className="flex-1"></div>
                    <div className="text-xs text-slate-500 dark:text-gray-400 px-2 py-2">
                      {projecoes6Meses.total_recorrentes_ativas} transações recorrentes ativas • 
                      <span className="text-blue-600 dark:text-blue-400 font-medium ml-1">Clique nas barras para detalhes</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={420} style={{ cursor: 'pointer' }}>
                    <BarChart 
                      data={projecoes6Meses.projecoes.map(p => ({
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
                        <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6}/>
                        </linearGradient>
                        <linearGradient id="resultadoGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6}/>
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
                                  <>
                                    <div className="flex justify-between items-center">
                                      <span className="flex items-center text-sm text-slate-600">
                                        <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                                        Receitas Totais:
                                      </span>
                                      <span className="font-semibold text-green-600">
                                        R$ {data.receitas?.total?.toLocaleString('pt-BR') || '0'}
                                      </span>
                                    </div>
                                    <div className="ml-4 space-y-1 text-xs text-slate-500">
                                      {data.receitas?.reais > 0 && (
                                        <div className="flex justify-between">
                                          <span>• Recebidas:</span>
                                          <span>R$ {data.receitas?.reais?.toLocaleString('pt-BR') || '0'}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between">
                                        <span>• Previstas:</span>
                                        <span>R$ {data.receitas?.recorrentes?.toLocaleString('pt-BR') || '0'}</span>
                                      </div>
                                    </div>
                                  </>
                                )}
                                {showDespesas && (
                                  <>
                                    <div className="flex justify-between items-center">
                                      <span className="flex items-center text-sm text-slate-600">
                                        <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                                        Despesas Totais:
                                      </span>
                                      <span className="font-semibold text-red-600">
                                        R$ {Math.abs(data.despesas?.total || 0)?.toLocaleString('pt-BR') || '0'}
                                      </span>
                                    </div>
                                    <div className="ml-4 space-y-1 text-xs text-slate-500">
                                      <div className="flex justify-between">
                                        <span>• Faturas Cartão:</span>
                                        <span>R$ {Math.abs(data.despesas?.cartoes || 0)?.toLocaleString('pt-BR') || '0'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>• Gastos Conta:</span>
                                        <span>R$ {Math.abs(data.despesas?.contas || 0)?.toLocaleString('pt-BR') || '0'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>• Recorrentes:</span>
                                        <span>R$ {Math.abs(data.despesas?.recorrentes || 0)?.toLocaleString('pt-BR') || '0'}</span>
                                      </div>
                                      {data.despesas?.parcelamentos > 0 && (
                                        <div className="flex justify-between">
                                          <span>• Parcelas Futuras:</span>
                                          <span>R$ {Math.abs(data.despesas?.parcelamentos || 0)?.toLocaleString('pt-BR') || '0'}</span>
                                        </div>
                                      )}
                                      {data.despesas?.financiamentos > 0 && (
                                        <div className="flex justify-between">
                                          <span>• 💳 Financiamentos:</span>
                                          <span>R$ {Math.abs(data.despesas?.financiamentos || 0)?.toLocaleString('pt-BR') || '0'}</span>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                                {showSaldo && (
                                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                    <span className="flex items-center text-sm font-medium text-slate-700">
                                      <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                                      Saldo Final:
                                    </span>
                                    <span className={`font-bold ${data.saldo_final >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                      R$ {data.saldo_final?.toLocaleString('pt-BR') || '0'}
                                    </span>
                                  </div>
                                )}

                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend />
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
                          radius={[0, 0, 4, 4]}  // Bordas arredondadas na parte inferior para barras negativas
                        />
                      )}
                      {showSaldo && (
                        <Bar 
                          dataKey="saldo_final" 
                          fill="url(#saldoGradient)" 
                          name="Saldo Final" 
                          radius={[4, 4, 0, 0]} 
                        />
                      )}

                    </BarChart>
                  </ResponsiveContainer>

                </div>
              </div>
            )}
            
            {projecoes6MesesLoading && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                      <span className="text-lg">📊</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Projeção 6 Meses</h4>
                      <p className="text-sm text-slate-500">Carregando projeções...</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="animate-pulse">
                    <div className="h-[350px] bg-slate-200 rounded-lg"></div>
                  </div>
                </div>
              </div>
            )}




          </div>
        )}

        {/* Faturas Inteligentes */}
        {cartoes.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">💳 Status das Faturas</h3>
                <p className="text-slate-600 dark:text-gray-300">Acompanhe suas faturas com contexto temporal</p>
              </div>
              <button 
                onClick={() => navigate('/cartoes')}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
              >
                Ver todos cartões →
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Faturas Abertas */}
              {faturasAbertas.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
                  <div className="p-4 border-b border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                        <span className="text-lg">🛒</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-200">Faturas Abertas</h4>
                        <p className="text-sm text-blue-600 dark:text-blue-300">Ainda no período de compras</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {faturasAbertas.slice(0, 3).map((cartao) => {
                      const statusInfo = calcularStatusFatura(cartao);
                      return (
                        <div key={cartao.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-200">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: cartao.cor }}
                            >
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{cartao.nome}</p>
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                Fecha em {statusInfo.diasParaFechamento} dia{statusInfo.diasParaFechamento !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              R$ {(cartao.fatura?.valor_atual || 0).toLocaleString()}
                            </p>
                            <button 
                              onClick={() => navigate(`/cartoes/${cartao.id}/fatura`)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                            >
                              Ver fatura →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Faturas Fechadas */}
              {faturasFechadas.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
                  <div className="p-4 border-b border-orange-100 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                        <span className="text-lg">⏰</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-orange-900 dark:text-orange-200">Faturas Fechadas</h4>
                        <p className="text-sm text-orange-600 dark:text-orange-300">Aguardando vencimento</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {faturasFechadas.slice(0, 3).map((cartao) => {
                      const statusInfo = calcularStatusFatura(cartao);
                      return (
                        <div key={cartao.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors duration-200">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: cartao.cor }}
                            >
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{cartao.nome}</p>
                              <p className="text-xs text-orange-600 dark:text-orange-400">
                                Vence em {statusInfo.diasParaVencimento} dia{statusInfo.diasParaVencimento !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              R$ {(cartao.fatura?.valor_atual || 0).toLocaleString()}
                            </p>
                            <button 
                              onClick={() => navigate(`/cartoes/${cartao.id}/fatura`)}
                              className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                            >
                              Ver fatura →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Faturas Vencidas */}
              {faturasVencidas.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-red-200/50 dark:border-red-700/50 overflow-hidden">
                  <div className="p-4 border-b border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-900/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                        <span className="text-lg">⚠️</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-red-900 dark:text-red-200">Faturas Vencidas</h4>
                        <p className="text-sm text-red-600 dark:text-red-300">Atenção necessária</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {faturasVencidas.slice(0, 3).map((cartao) => {
                      const statusInfo = calcularStatusFatura(cartao);
                      return (
                        <div key={cartao.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: cartao.cor }}
                            >
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{cartao.nome}</p>
                              <p className="text-xs text-red-600 dark:text-red-400">
                                Venceu há {statusInfo.diasParaVencimento} dia{statusInfo.diasParaVencimento !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-red-600 dark:text-red-400">
                              R$ {(cartao.fatura?.valor_atual || 0).toLocaleString()}
                            </p>
                            <button 
                              onClick={() => navigate(`/cartoes/${cartao.id}/fatura`)}
                              className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                            >
                              Ver fatura →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Limite Disponível - Aparece apenas se não houver faturas vencidas */}
              {faturasVencidas.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
                  <div className="p-4 border-b border-purple-100 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center">
                        <span className="text-lg">💰</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-200">Limite Disponível</h4>
                        <p className="text-sm text-purple-600 dark:text-purple-300">Capacidade de compra</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 text-center">
                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                      R$ {limiteDisponivel.toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-gray-300 mb-4">
                      {percentualDisponivel}% do limite total disponível
                    </p>
                    <div className="w-full bg-slate-100 dark:bg-gray-700 rounded-full h-2 mb-3">
                      <div 
                        className="h-2 rounded-full bg-gradient-to-r from-purple-400 to-purple-500"
                        style={{ width: `${percentualDisponivel}%` }}
                      ></div>
                    </div>
                    <button 
                      onClick={() => navigate('/cartoes')}
                      className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                    >
                      Gerenciar cartões →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Financial Charts Section */}
        {!dashboardLoading && chartsData && (
          <div className="mb-8">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">📊 Análise Financeira</h3>
              <p className="text-slate-600 dark:text-gray-300">Visualize suas finanças com gráficos interativos</p>
            </div>

            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              
              {/* 📈 Gráfico de Transações por Mês */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                      <span className="text-lg">📈</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Transações por Mês</h4>
                      <p className="text-sm text-slate-500 dark:text-gray-400">Últimos 12 meses</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartsData.transacoes_por_mes}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="mes" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value: number, name: string) => [
                          `R$ ${value.toLocaleString('pt-BR')}`,
                          name === 'receitas' ? 'Receitas' : name === 'despesas' ? 'Despesas' : 'Saldo'
                        ]}
                        labelFormatter={(label) => `Mês: ${label}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="receitas" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        name="Receitas"
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="despesas" 
                        stroke="#ef4444" 
                        strokeWidth={3}
                        name="Despesas"
                        dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="saldo" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        name="Saldo"
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 🥧 Pizza de Gastos por Categoria */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                      <span className="text-lg">🥧</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Gastos por Categoria</h4>
                      <p className="text-sm text-slate-500 dark:text-gray-400">Mês atual</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {chartsData.gastos_por_categoria?.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={chartsData.gastos_por_categoria.slice(0, 8)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="valor"
                          >
                            {chartsData.gastos_por_categoria.slice(0, 8).map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.cor} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string, props: any) => [
                              `R$ ${value.toLocaleString('pt-BR')}`,
                              `${props.payload.categoria} (${props.payload.percentual}%)`
                            ]}
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e2e8f0',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      
                      <div className="mt-4 max-h-48 overflow-y-auto">
                        <div className="grid grid-cols-1 gap-2">
                          {chartsData.gastos_por_categoria.map((categoria: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                              <div className="flex items-center space-x-3">
                                <div 
                                  className="w-4 h-4 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: categoria.cor }}
                                ></div>
                                <span className="text-sm font-medium text-slate-700 dark:text-gray-200 truncate">
                                  {categoria.icone} {categoria.categoria}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-gray-400">
                                  ({categoria.quantidade} gastos)
                                </span>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                  R$ {categoria.valor.toLocaleString('pt-BR')}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-gray-400">
                                  {categoria.percentual}%
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {chartsData.gastos_por_categoria.length > 8 && (
                          <div className="mt-3 p-2 bg-blue-50 rounded-lg text-center">
                            <p className="text-xs text-blue-600">
                              Mostrando top 8 categorias no gráfico. {chartsData.gastos_por_categoria.length - 8} categorias a mais na lista.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-slate-500 dark:text-gray-400">
                      <div className="text-center">
                        <span className="text-4xl mb-2 block">💰</span>
                        <p>Nenhum gasto registrado este mês</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 📊 Receita vs Despesa */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                      <span className="text-lg">📊</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Receita vs Despesa</h4>
                      <p className="text-sm text-slate-500 dark:text-gray-400">Últimos 6 meses</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartsData.receita_vs_despesa}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="mes" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value: number, name: string) => [
                          `R$ ${value.toLocaleString('pt-BR')}`,
                          name === 'receitas' ? 'Receitas' : name === 'despesas' ? 'Despesas' : 'Economia'
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="receitas" fill="#10b981" name="Receitas" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesas" fill="#ef4444" name="Despesas" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="economia" fill="#3b82f6" name="Economia" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 📉 Tendência de Saldo */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                      <span className="text-lg">📉</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Evolução do Saldo</h4>
                      <p className="text-sm text-slate-500 dark:text-gray-400">Últimos 30 dias</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartsData.tendencia_saldo}>
                      <defs>
                        <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="data" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Saldo']}
                        labelFormatter={(label) => `Data: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="saldo"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorSaldo)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Estatísticas Extras */}
            {chartsData.estatisticas && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Maiores Gastos do Mês */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                        <span className="text-lg">💸</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Maiores Gastos</h4>
                        <p className="text-sm text-slate-500 dark:text-gray-400">Este mês</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    {chartsData.estatisticas.maiores_gastos_mes?.length > 0 ? (
                      <div className="space-y-4">
                        {chartsData.estatisticas.maiores_gastos_mes.map((gasto: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-700 rounded-xl">
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{gasto.descricao}</p>
                              <p className="text-sm text-slate-500 dark:text-gray-400">{gasto.categoria} • {gasto.data}</p>
                            </div>
                            <span className="font-bold text-red-600 dark:text-red-400">R$ {gasto.valor.toLocaleString('pt-BR')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 dark:text-gray-400">
                        <span className="text-3xl mb-2 block">🎉</span>
                        <p>Nenhum gasto registrado ainda</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Gastos por Dia da Semana */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <span className="text-lg">📅</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Gastos por Dia da Semana</h4>
                        <p className="text-sm text-slate-500 dark:text-gray-400">Total dos últimos 3 meses</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    {chartsData.estatisticas.gastos_semana?.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={chartsData.estatisticas.gastos_semana}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="dia"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#64748b' }}
                            />
                            <YAxis 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#64748b' }}
                              tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                            />
                            <Tooltip 
                              formatter={(value: number, name: string) => [
                                `R$ ${value.toLocaleString('pt-BR')}`,
                                name === 'total' ? 'Total' : 'Média por transação'
                              ]}
                              labelFormatter={(label) => `${chartsData.estatisticas.gastos_semana.find((d: any) => d.dia === label)?.dia_completo || label}`}
                              contentStyle={{ 
                                backgroundColor: 'white', 
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                              }}
                            />
                            <Legend />
                            <Bar dataKey="total" fill="#6366f1" name="Total Gastos" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="media" fill="#8b5cf6" name="Média por Gasto" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-4 grid grid-cols-7 gap-2 text-xs">
                          {chartsData.estatisticas.gastos_semana.map((dia: any, index: number) => (
                            <div key={index} className="text-center p-2 bg-slate-50 dark:bg-gray-700 rounded-lg">
                              <div className="font-medium text-slate-900 dark:text-white">{dia.dia}</div>
                              <div className="text-slate-600 dark:text-gray-300">{dia.quantidade} gastos</div>
                              <div className="text-indigo-600 dark:text-indigo-400 font-semibold">R$ {(dia.total / 1000).toFixed(1)}k</div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-slate-500 dark:text-gray-400">
                        <span className="text-3xl mb-2 block">📊</span>
                        <p>Nenhum dado de gastos semanais</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {dashboardLoading && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 p-8">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Carregando gráficos...</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        {loadingStates.completo ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Carregando dados...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Categorias */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Categorias</h3>
                  </div>
                  <button 
                    onClick={() => navigate('/categorias')}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
                  >
                    Ver todas →
                  </button>
                </div>
              </div>
              <div className="p-6">
                {categorias.length > 0 ? (
                  <div className="space-y-4">
                    {categorias.slice(0, 3).map((categoria) => (
                      <div key={categoria.id} className="flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors duration-200">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-medium"
                          style={{ backgroundColor: categoria.cor }}
                        >
                          <span className="text-lg">{categoria.icone}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 dark:text-white">{categoria.nome}</p>
                          <p className="text-sm text-slate-500 dark:text-gray-400">Categoria ativa</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500 dark:text-gray-400 mb-3">Nenhuma categoria cadastrada</p>
                    <button 
                      onClick={() => navigate('/categorias')}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
                    >
                      Criar primeira categoria →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Cartões */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Cartões</h3>
                  </div>
                  <button 
                    onClick={() => navigate('/cartoes')}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
                  >
                    Ver todos →
                  </button>
                </div>
              </div>
              <div className="p-6">
                {cartoes.length > 0 ? (
                  <div className="space-y-4">
                    {cartoes.slice(0, 2).map((cartao) => (
                      <div key={cartao.id} className="p-4 rounded-xl border border-slate-100 dark:border-gray-600 hover:border-slate-200 dark:hover:border-gray-500 transition-colors duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: cartao.cor }}
                            >
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{cartao.nome}</p>
                              <p className="text-xs text-slate-500 dark:text-gray-400">{cartao.bandeira}</p>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            R$ {cartao.limite.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-gray-700 rounded-full h-2">
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
                        <p className={`text-xs mt-2 ${
                          (cartao.fatura?.percentual_limite_usado || 0) > 100
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-500 dark:text-gray-400'
                        }`}>
                          {(cartao.fatura?.percentual_limite_usado || 0) > 100
                            ? `${((cartao.fatura?.percentual_limite_usado || 0) - 100).toFixed(1)}% excesso`
                            : `${(100 - (cartao.fatura?.percentual_limite_usado || 0)).toFixed(1)}% disponível`
                          }
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500 dark:text-gray-400 mb-3">Nenhum cartão cadastrado</p>
                    <button 
                      onClick={() => navigate('/cartoes')}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
                    >
                      Adicionar primeiro cartão →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Contas */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-gray-700/50 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h1a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Contas</h3>
                  </div>
                  <button 
                    onClick={() => navigate('/contas')}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
                  >
                    Ver todas →
                  </button>
                </div>
              </div>
              <div className="p-6">
                {contas.length > 0 ? (
                  <div className="space-y-4">
                    {contas.slice(0, 3).map((conta) => (
                      <div key={conta.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors duration-200">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                            style={{ backgroundColor: conta.cor }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{conta.nome}</p>
                            <p className="text-sm text-slate-500 dark:text-gray-400">{conta.banco}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          R$ {(conta.resumo?.saldo_atual !== undefined ? conta.resumo.saldo_atual : conta.saldo_atual !== undefined ? conta.saldo_atual : conta.saldo_inicial).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500 dark:text-gray-400 mb-3">Nenhuma conta cadastrada</p>
                    <button 
                      onClick={() => navigate('/contas')}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
                    >
                      Adicionar primeira conta →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI Chat CTA */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-3xl p-8 mb-8 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row items-center justify-between">
              <div className="mb-6 lg:mb-0 lg:mr-8">
                <h3 className="text-2xl font-bold text-white mb-3">
                  📱 IA no Telegram
                </h3>
                <p className="text-blue-100 text-lg leading-relaxed max-w-2xl">
                  Configure o bot do Telegram para ter nossa IA financeira sempre ao seu alcance. 
                  Registre gastos, faça consultas e receba insights diretamente no seu celular.
                </p>
                <div className="flex items-center space-x-6 mt-4">
                  <div className="flex items-center space-x-2 text-blue-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 4v10a2 2 0 002 2h8a2 2 0 002-2V8M7 8h10" />
                    </svg>
                    <span className="text-sm">Texto natural</span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="text-sm">Comandos de voz</span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">Upload de imagens</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col space-y-3">
                <button 
                  onClick={() => navigate('/settings?tab=telegram')}
                  className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-semibold hover:bg-blue-50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center space-x-3"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>Conectar Telegram</span>
                </button>
                <p className="text-blue-200 text-sm text-center">
                  Acesso via celular 24/7
                </p>
              </div>
            </div>
          </div>
          
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="50" fill="url(#gradient)" />
              <defs>
                <linearGradient id="gradient">
                  <stop offset="0%" stopColor="white" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
          </div>
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
                  
                  {/* Resumo Financeiro - Sempre visível */}
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
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-xl border-l-4 border-green-500">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-green-800 dark:text-green-300 font-semibold text-lg">Total Receitas</h4>
                            <span className="text-3xl">📈</span>
                          </div>
                          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                            R$ {mesDetalhes.resumo_financeiro.total_receitas.toLocaleString()}
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
                            R$ {mesDetalhes.resumo_financeiro.total_despesas.toLocaleString()}
                          </p>
                          <p className="text-sm text-red-600/70 dark:text-red-400/70 mt-2">
                            Gastos totais previstos
                          </p>
                        </div>

                        <div className={`bg-gradient-to-br p-6 rounded-xl border-l-4 ${
                          mesDetalhes.resumo_financeiro.saldo_mes >= 0
                            ? 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-500'
                            : 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-500'
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className={`font-semibold text-lg ${
                              mesDetalhes.resumo_financeiro.saldo_mes >= 0
                                ? 'text-blue-800 dark:text-blue-300'
                                : 'text-orange-800 dark:text-orange-300'
                            }`}>
                              Saldo do Mês
                            </h4>
                            <span className="text-3xl">{mesDetalhes.resumo_financeiro.saldo_mes >= 0 ? '🤑' : '😰'}</span>
                          </div>
                          <p className={`text-3xl font-bold ${
                            mesDetalhes.resumo_financeiro.saldo_mes >= 0
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}>
                            R$ {mesDetalhes.resumo_financeiro.saldo_mes.toLocaleString()}
                          </p>
                          <p className={`text-sm mt-2 ${
                            mesDetalhes.resumo_financeiro.saldo_mes >= 0
                              ? 'text-blue-600/70 dark:text-blue-400/70'
                              : 'text-orange-600/70 dark:text-orange-400/70'
                          }`}>
                            {mesDetalhes.resumo_financeiro.saldo_mes >= 0 ? 'Superávit mensal' : 'Déficit mensal'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Estatísticas - Colapsável */}
                  <div>
                    <button 
                      onClick={() => toggleSection('estatisticas')}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-lg hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-500 transition-all duration-200"
                    >
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center space-x-3">
                        <span className="text-2xl">📊</span>
                        <span>Estatísticas Detalhadas</span>
                      </h3>
                      <svg 
                        className={`w-6 h-6 transform transition-transform duration-200 text-gray-600 dark:text-gray-300 ${expandedSections.estatisticas ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {expandedSections.estatisticas && (
                      <div className="mt-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                            <div className="text-3xl mb-2">🎯</div>
                            <p className="text-sm text-slate-600 dark:text-gray-400 mb-1">Total de Transações</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{mesDetalhes.estatisticas.total_transacoes}</p>
                          </div>
                          <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                            <div className="text-3xl mb-2">✅</div>
                            <p className="text-sm text-slate-600 dark:text-gray-400 mb-1">Já Realizadas</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{mesDetalhes.estatisticas.transacoes_reais}</p>
                          </div>
                          <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                            <div className="text-3xl mb-2">⏳</div>
                            <p className="text-sm text-slate-600 dark:text-gray-400 mb-1">Previstas</p>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{mesDetalhes.estatisticas.transacoes_previstas}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Receitas - Colapsável */}
                  <div>
                    <button 
                      onClick={() => toggleSection('receitas')}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-700 dark:to-green-600 rounded-lg hover:from-green-100 hover:to-green-200 dark:hover:from-green-600 dark:hover:to-green-500 transition-all duration-200"
                    >
                      <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 flex items-center space-x-3">
                        <span className="text-2xl">📈</span>
                        <span>Receitas Detalhadas</span>
                        <span className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded-lg text-sm font-semibold">
                          R$ {mesDetalhes.receitas.total.toLocaleString()}
                        </span>
                      </h3>
                      <svg 
                        className={`w-6 h-6 transform transition-transform duration-200 text-green-600 dark:text-green-300 ${expandedSections.receitas ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {expandedSections.receitas && (
                      <div className="mt-4 space-y-4 animate-fade-in">
                        
                        {/* Receitas Reais */}
                        {mesDetalhes.receitas.reais.transacoes.length > 0 && (
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
                            <h5 className="font-semibold text-green-900 dark:text-green-400 mb-4 flex items-center space-x-2">
                              <span className="text-xl">💰</span>
                              <span>Já Recebidas</span>
                              <span className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded text-sm">
                                R$ {mesDetalhes.receitas.reais.total.toLocaleString()}
                              </span>
                            </h5>
                            <div className={`space-y-3 ${modalMaximized ? 'max-h-64' : 'max-h-40'} overflow-y-auto scrollbar-thin scrollbar-thumb-green-300 dark:scrollbar-thumb-green-600`}>
                              {mesDetalhes.receitas.reais.transacoes.map((transacao: any, index: number) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex-1">
                                    <p className="font-medium text-green-800 dark:text-green-300">{transacao.descricao}</p>
                                    <p className="text-sm text-green-600 dark:text-green-400">
                                      📅 {new Date(transacao.data).toLocaleDateString('pt-BR')} • 🏷️ {transacao.categoria}
                                    </p>
                                  </div>
                                  <span className="font-bold text-green-700 dark:text-green-400 text-lg">
                                    R$ {transacao.valor.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Receitas Recorrentes */}
                        {mesDetalhes.receitas.recorrentes.transacoes.length > 0 && (
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700 border-dashed">
                            <h5 className="font-semibold text-green-900 dark:text-green-400 mb-4 flex items-center space-x-2">
                              <span className="text-xl">🔄</span>
                              <span>Previstas (Recorrentes)</span>
                              <span className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded text-sm">
                                R$ {mesDetalhes.receitas.recorrentes.total.toLocaleString()}
                              </span>
                            </h5>
                            <div className={`space-y-3 ${modalMaximized ? 'max-h-64' : 'max-h-40'} overflow-y-auto scrollbar-thin scrollbar-thumb-green-300 dark:scrollbar-thumb-green-600`}>
                              {mesDetalhes.receitas.recorrentes.transacoes.map((transacao: any, index: number) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow opacity-90">
                                  <div className="flex-1">
                                    <p className="font-medium text-green-800 dark:text-green-300">{transacao.descricao}</p>
                                    <p className="text-sm text-green-600 dark:text-green-400">
                                      📅 {new Date(transacao.data).toLocaleDateString('pt-BR')} • 🔄 {transacao.frequencia}
                                    </p>
                                  </div>
                                  <span className="font-bold text-green-700 dark:text-green-400 text-lg">
                                    R$ {transacao.valor.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Despesas - Colapsável */}
                  <div>
                    <button 
                      onClick={() => toggleSection('despesas')}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-700 dark:to-red-600 rounded-lg hover:from-red-100 hover:to-red-200 dark:hover:from-red-600 dark:hover:to-red-500 transition-all duration-200"
                    >
                      <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 flex items-center space-x-3">
                        <span className="text-2xl">📉</span>
                        <span>Despesas Detalhadas</span>
                        <span className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded-lg text-sm font-semibold">
                          R$ {mesDetalhes.despesas.total.toLocaleString()}
                        </span>
                      </h3>
                      <svg 
                        className={`w-6 h-6 transform transition-transform duration-200 text-red-600 dark:text-red-300 ${expandedSections.despesas ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {expandedSections.despesas && (
                      <div className="mt-4 space-y-4 animate-fade-in">

                        {/* Despesas Reais - Cartão */}
                        {mesDetalhes.despesas.reais_cartao.transacoes.length > 0 && (
                          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-700">
                            <h5 className="font-semibold text-red-900 dark:text-red-400 mb-4 flex items-center space-x-2">
                              <span className="text-xl">💳</span>
                              <span>Gastos no Cartão</span>
                              <span className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded text-sm">
                                R$ {mesDetalhes.despesas.reais_cartao.total.toLocaleString()}
                              </span>
                            </h5>
                            <div className={`space-y-3 ${modalMaximized ? 'max-h-64' : 'max-h-40'} overflow-y-auto scrollbar-thin scrollbar-thumb-red-300 dark:scrollbar-thumb-red-600`}>
                              {mesDetalhes.despesas.reais_cartao.transacoes.map((transacao: any, index: number) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex-1">
                                    <p className="font-medium text-red-800 dark:text-red-300">{transacao.descricao}</p>
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                      📅 {new Date(transacao.data).toLocaleDateString('pt-BR')} • 💳 {transacao.cartao}
                                    </p>
                                  </div>
                                  <span className="font-bold text-red-700 dark:text-red-400 text-lg">
                                    R$ {transacao.valor.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Despesas Reais - Conta */}
                        {mesDetalhes.despesas.reais_conta.transacoes.length > 0 && (
                          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-700">
                            <h5 className="font-semibold text-red-900 dark:text-red-400 mb-4 flex items-center space-x-2">
                              <span className="text-xl">🏦</span>
                              <span>Gastos na Conta</span>
                              <span className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded text-sm">
                                R$ {mesDetalhes.despesas.reais_conta.total.toLocaleString()}
                              </span>
                            </h5>
                            <div className={`space-y-3 ${modalMaximized ? 'max-h-64' : 'max-h-40'} overflow-y-auto scrollbar-thin scrollbar-thumb-red-300 dark:scrollbar-thumb-red-600`}>
                              {mesDetalhes.despesas.reais_conta.transacoes.map((transacao: any, index: number) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex-1">
                                    <p className="font-medium text-red-800 dark:text-red-300">{transacao.descricao}</p>
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                      📅 {new Date(transacao.data).toLocaleDateString('pt-BR')} • 🏦 {transacao.conta}
                                    </p>
                                  </div>
                                  <span className="font-bold text-red-700 dark:text-red-400 text-lg">
                                    R$ {transacao.valor.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Despesas Recorrentes */}
                        {mesDetalhes.despesas.recorrentes.transacoes.length > 0 && (
                          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-700 border-dashed">
                            <h5 className="font-semibold text-red-900 dark:text-red-400 mb-4 flex items-center space-x-2">
                              <span className="text-xl">🔄</span>
                              <span>Recorrentes</span>
                              <span className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded text-sm">
                                R$ {mesDetalhes.despesas.recorrentes.total.toLocaleString()}
                              </span>
                            </h5>
                            <div className={`space-y-3 ${modalMaximized ? 'max-h-64' : 'max-h-40'} overflow-y-auto scrollbar-thin scrollbar-thumb-red-300 dark:scrollbar-thumb-red-600`}>
                              {mesDetalhes.despesas.recorrentes.transacoes.map((transacao: any, index: number) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow opacity-90">
                                  <div className="flex-1">
                                    <p className="font-medium text-red-800 dark:text-red-300">{transacao.descricao}</p>
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                      📅 {new Date(transacao.data).toLocaleDateString('pt-BR')} • 🔄 {transacao.frequencia} • 
                                      {transacao.destino === 'cartao' ? ` 💳 ${transacao.cartao}` : ` 🏦 ${transacao.conta}`}
                                    </p>
                                  </div>
                                  <span className="font-bold text-red-700 dark:text-red-400 text-lg">
                                    R$ {transacao.valor.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Parcelamentos */}
                        {mesDetalhes.despesas.parcelamentos.transacoes.length > 0 && (
                          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-700">
                            <h5 className="font-semibold text-red-900 dark:text-red-400 mb-4 flex items-center space-x-2">
                              <span className="text-xl">💱</span>
                              <span>Parcelamentos</span>
                              <span className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded text-sm">
                                R$ {mesDetalhes.despesas.parcelamentos.total.toLocaleString()}
                              </span>
                            </h5>
                            <div className={`space-y-3 ${modalMaximized ? 'max-h-64' : 'max-h-40'} overflow-y-auto scrollbar-thin scrollbar-thumb-red-300 dark:scrollbar-thumb-red-600`}>
                              {mesDetalhes.despesas.parcelamentos.transacoes.map((transacao: any, index: number) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex-1">
                                    <p className="font-medium text-red-800 dark:text-red-300">{transacao.descricao}</p>
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                      📅 {new Date(transacao.data).toLocaleDateString('pt-BR')} • 💳 {transacao.cartao}
                                    </p>
                                  </div>
                                  <span className="font-bold text-red-700 dark:text-red-400 text-lg">
                                    R$ {transacao.valor.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Financiamentos */}
                        {mesDetalhes.despesas.financiamentos && mesDetalhes.despesas.financiamentos.transacoes.length > 0 && (
                          <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-4 border-2 border-orange-200 dark:border-orange-700">
                            <h5 className="font-semibold text-red-900 dark:text-red-400 mb-4 flex items-center space-x-2">
                              <span className="text-xl">💳</span>
                              <span>Financiamentos</span>
                              <span className="bg-gradient-to-r from-orange-200 to-red-200 dark:from-orange-800 dark:to-red-800 text-orange-800 dark:text-orange-200 px-2 py-1 rounded text-sm font-semibold">
                                R$ {mesDetalhes.despesas.financiamentos.total.toLocaleString()}
                              </span>
                            </h5>
                            <div className={`space-y-3 ${modalMaximized ? 'max-h-64' : 'max-h-40'} overflow-y-auto scrollbar-thin scrollbar-thumb-orange-300 dark:scrollbar-thumb-orange-600`}>
                              {mesDetalhes.despesas.financiamentos.transacoes.map((transacao: any, index: number) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-gradient-to-r from-white to-orange-50 dark:from-gray-800 dark:to-orange-900/20 rounded-lg shadow-sm hover:shadow-md transition-all border border-orange-100 dark:border-orange-800">
                                  <div className="flex-1">
                                    <p className="font-semibold text-orange-900 dark:text-orange-300">{transacao.descricao}</p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      <span className="text-xs bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
                                        📅 {new Date(transacao.data).toLocaleDateString('pt-BR')}
                                      </span>
                                      <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                                        🏦 {transacao.instituicao}
                                      </span>
                                      <span className="text-xs bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">
                                        📊 {transacao.sistema_amortizacao}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="font-bold text-orange-700 dark:text-orange-400 text-lg ml-4">
                                    R$ {transacao.valor.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rodapé Informativo */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-6 text-center border-t-4 border-slate-300 dark:border-gray-500">
                    <div className="flex items-center justify-center space-x-2 mb-3">
                      <span className="text-2xl">{mesDetalhes.eh_mes_atual ? '⏳' : '📊'}</span>
                      <p className="text-lg font-semibold text-slate-800 dark:text-gray-200">
                        {mesDetalhes.eh_mes_atual ? 'Dados do Mês Atual' : 'Projeção Financeira'}
                      </p>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-gray-400 mb-2">
                      {mesDetalhes.eh_mes_atual 
                        ? 'Valores incluem transações já realizadas e projeções para o restante do mês'
                        : 'Projeção baseada em transações recorrentes ativas e parcelas futuras'
                      }
                    </p>
                    <p className="text-xs text-slate-500 dark:text-gray-500">
                      📅 Período: {new Date(mesDetalhes.periodo.inicio).toLocaleDateString('pt-BR')} a {new Date(mesDetalhes.periodo.fim).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">😞</div>
                  <p className="text-xl font-semibold text-slate-700 dark:text-gray-300 mb-2">Ops! Algo deu errado</p>
                  <p className="text-slate-500 dark:text-gray-400">Não foi possível carregar os detalhes deste mês</p>
                  <button 
                    onClick={handleCloseModalDetalhes}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer 
        toasts={toasts} 
        onRemoveToast={removeToast}
        position="top-right"
      />
    </div>
  );
} 