import React, { useState, useEffect } from 'react';
import { planejamentoApi, categoriasApi, transacoesApi } from '../services/api';
import { Plus, TrendingUp, TrendingDown, Target, Calendar, DollarSign, BarChart3, Settings, Eye, Edit2, Copy, Trash2, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronRight, CreditCard, Banknote } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';

interface Categoria {
  id: number;
  nome: string;
  cor: string;
  icone: string;
}

interface PlanoCategoria {
  id: number;
  categoria_id: number;
  valor_planejado: number;
  valor_gasto: number;
  percentual_gasto: number;
  saldo_restante: number;
  prioridade: number;
  observacoes?: string;
  categoria: Categoria;
}

interface PlanejamentoMensal {
  id: number;
  nome: string;
  descricao?: string;
  mes: number;
  ano: number;
  renda_esperada: number;
  total_planejado: number;
  total_gasto: number;
  saldo_planejado: number;
  percentual_gasto: number;
  status: 'ativo' | 'pausado' | 'finalizado';
  planos_categoria: PlanoCategoria[];
  created_at: string;
  updated_at: string;
}

interface ResumoPlanejamento {
  total_planejamentos: number;
  planejamento_atual?: PlanejamentoMensal;
  total_gasto_mes: number;
  total_planejado_mes: number;
  percentual_cumprimento: number;
  categorias_excedidas: number;
  economias_categoria: Array<{
    categoria: string;
    economia: number;
    percentual_usado: number;
  }>;
}

const mesesNomes = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function Planejamento() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [resumo, setResumo] = useState<ResumoPlanejamento | null>(null);
  const [planejamentos, setPlanejamentos] = useState<PlanejamentoMensal[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [showModalCriar, setShowModalCriar] = useState(false);
  const [showModalDetalhes, setShowModalDetalhes] = useState(false);
  const [showModalDuplicar, setShowModalDuplicar] = useState(false);
  const [planejamentoSelecionado, setPlanejamentoSelecionado] = useState<PlanejamentoMensal | null>(null);
  
  // Novos estados para edição
  const [showModalEditar, setShowModalEditar] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    renda_esperada: 0,
    planos_categoria: [] as Array<{
      categoria_id: number;
      valor_planejado: number;
      prioridade: number;
      observacoes: string;
    }>
  });

  // Estados para duplicação
  const [mesesParaDuplicar, setMesesParaDuplicar] = useState<Array<{mes: number, ano: number}>>([]);
  const [fatorAjuste, setFatorAjuste] = useState(1.0); // Para ajustar valores automaticamente
  const [transacoesDetalhadas, setTransacoesDetalhadas] = useState<{[key: number]: any[]}>({});
  const [expandedCategoria, setExpandedCategoria] = useState<number | null>(null);

  // Carregar dados
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [resumoData, planejamentosData, categoriasData] = await Promise.all([
          planejamentoApi.getResumo(),
          planejamentoApi.getAll({ limit: 12 }), // Últimos 12 meses
          categoriasApi.getAll()
        ]);
        
        console.log('📊 Dados carregados:', { resumoData, planejamentosData, categoriasData });
        
        setResumo(resumoData);
        setPlanejamentos(planejamentosData);
        setCategorias(categoriasData);
        
      } catch (error) {
        console.error('❌ Erro ao carregar dados do planejamento:', error);
        // Em caso de erro, tentar carregar só as categorias
        try {
          const categoriasData = await categoriasApi.getAll();
          setCategorias(categoriasData);
          console.log('✅ Categorias carregadas após erro:', categoriasData);
        } catch (catError) {
          console.error('❌ Erro ao carregar categorias:', catError);
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  const handleCriarPlanejamento = async () => {
    try {
      setIsActionLoading(true);
      
      // Validações
      if (!formData.nome.trim()) {
        setMessage({ type: 'error', text: 'Nome do orçamento é obrigatório.' });
        return;
      }
      
      if (formData.renda_esperada <= 0) {
        setMessage({ type: 'error', text: 'Renda esperada deve ser maior que zero.' });
        return;
      }
      
      if (formData.planos_categoria.length === 0) {
        setMessage({ type: 'error', text: 'Adicione pelo menos uma categoria ao orçamento.' });
        return;
      }

      // Validar categorias
      for (let i = 0; i < formData.planos_categoria.length; i++) {
        const plano = formData.planos_categoria[i];
        
        if (!plano.categoria_id || plano.categoria_id === 0) {
          setMessage({ type: 'error', text: `Selecione uma categoria válida para o item ${i + 1}.` });
          return;
        }
        
        if (plano.valor_planejado <= 0) {
          setMessage({ type: 'error', text: `O valor planejado deve ser maior que zero para o item ${i + 1}.` });
          return;
        }
      }
      
      // Log dos dados para debug
      console.log('📤 Enviando dados do planejamento:', {
        ...formData,
        total_categorias: formData.planos_categoria.length
      });
      
      const novoPlanejamento = await planejamentoApi.create(formData);
      setPlanejamentos([novoPlanejamento, ...planejamentos]);
      setShowModalCriar(false);
      
      // Recarregar resumo
      const novoResumo = await planejamentoApi.getResumo();
      setResumo(novoResumo);
      
      setMessage({ type: 'success', text: 'Orçamento criado com sucesso!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
      
      // Reset form
      setFormData({
        nome: '',
        descricao: '',
        mes: new Date().getMonth() + 1,
        ano: new Date().getFullYear(),
        renda_esperada: 0,
        planos_categoria: []
      });
    } catch (error: any) {
      console.error('❌ Erro ao criar planejamento:', error);
      
      // Melhor tratamento de erro
      let errorMessage = 'Erro ao criar orçamento. Tente novamente.';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.status === 400) {
        errorMessage = 'Dados inválidos. Verifique as informações e tente novamente.';
      } else if (error.response?.status === 409) {
        errorMessage = 'Já existe um orçamento para este período.';
      }
      
      setMessage({ type: 'error', text: errorMessage });
      setTimeout(() => setMessage({ type: '', text: '' }), 6000);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleEditarPlanejamento = (planejamento: PlanejamentoMensal) => {
    setPlanejamentoSelecionado(planejamento);
    setFormData({
      nome: planejamento.nome,
      descricao: planejamento.descricao || '',
      mes: planejamento.mes,
      ano: planejamento.ano,
      renda_esperada: planejamento.renda_esperada,
      planos_categoria: planejamento.planos_categoria.map(p => ({
        categoria_id: p.categoria_id,
        valor_planejado: p.valor_planejado,
        prioridade: p.prioridade,
        observacoes: p.observacoes || ''
      }))
    });
    setShowModalEditar(true);
  };

  const handleSalvarEdicao = async () => {
    if (!planejamentoSelecionado) return;
    
    try {
      setIsActionLoading(true);
      const planejamentoAtualizado = await planejamentoApi.update(planejamentoSelecionado.id, {
        nome: formData.nome,
        descricao: formData.descricao,
        renda_esperada: formData.renda_esperada
      });
      
      setPlanejamentos(planejamentos.map(p => 
        p.id === planejamentoSelecionado.id ? { ...p, ...planejamentoAtualizado } : p
      ));
      
      setShowModalEditar(false);
      setPlanejamentoSelecionado(null);
      
      setMessage({ type: 'success', text: 'Orçamento atualizado com sucesso!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (error: any) {
      console.error('Erro ao atualizar planejamento:', error);
      setMessage({ type: 'error', text: 'Erro ao atualizar orçamento. Tente novamente.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 6000);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleExcluirPlanejamento = async (planejamento: PlanejamentoMensal) => {
    const confirmacao = window.confirm(
      `Tem certeza que deseja excluir o orçamento "${planejamento.nome}"?\n\nEsta ação não pode ser desfeita.`
    );
    
    if (!confirmacao) return;
    
    try {
      setIsActionLoading(true);
      await planejamentoApi.delete(planejamento.id);
      
      setPlanejamentos(planejamentos.filter(p => p.id !== planejamento.id));
      
      // Recarregar resumo
      const novoResumo = await planejamentoApi.getResumo();
      setResumo(novoResumo);
      
      setMessage({ type: 'success', text: 'Orçamento excluído com sucesso!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (error: any) {
      console.error('Erro ao excluir planejamento:', error);
      setMessage({ type: 'error', text: 'Erro ao excluir orçamento. Tente novamente.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 6000);
    } finally {
      setIsActionLoading(false);
    }
  };

  const adicionarCategoriaAoPlano = () => {
    // Verificar se há categorias disponíveis
    if (categorias.length === 0) {
      setMessage({ type: 'error', text: 'Crie pelo menos uma categoria na página "Configurações" antes de criar um orçamento.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 6000);
      return;
    }

    setFormData({
      ...formData,
      planos_categoria: [
        ...formData.planos_categoria,
        {
          categoria_id: categorias[0]?.id || 0,
          valor_planejado: 100, // Valor padrão de R$ 100 para facilitar
          prioridade: 2,
          observacoes: ''
        }
      ]
    });
  };

  const removerCategoriaDoPlano = (index: number) => {
    const novasCategoriasPlano = formData.planos_categoria.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      planos_categoria: novasCategoriasPlano
    });
  };

  const atualizarCategoriaDoPlano = (index: number, campo: string, valor: any) => {
    const novasCategoriasPlano = [...formData.planos_categoria];
    novasCategoriasPlano[index] = {
      ...novasCategoriasPlano[index],
      [campo]: valor
    };
    setFormData({
      ...formData,
      planos_categoria: novasCategoriasPlano
    });
  };

  const getStatusColor = (percentual: number) => {
    if (percentual > 100) return 'text-red-600 bg-red-50';
    if (percentual > 80) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getStatusIcon = (percentual: number) => {
    if (percentual > 100) return <AlertTriangle className="w-4 h-4" />;
    if (percentual > 80) return <Clock className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  // Função para recalcular valores corretos
  const calcularValoresCorretos = (plano: PlanoCategoria) => {
    const percentual_gasto = plano.valor_planejado > 0 
      ? (plano.valor_gasto / plano.valor_planejado) * 100 
      : 0;
    
    const saldo_restante = plano.valor_planejado - plano.valor_gasto;
    
    return {
      percentual_gasto: Math.round(percentual_gasto * 10) / 10, // 1 casa decimal
      saldo_restante: Math.round(saldo_restante * 100) / 100 // 2 casas decimais
    };
  };

  // Função para calcular percentual geral do planejamento
  const calcularPercentualGeral = (planejamento: PlanejamentoMensal) => {
    const percentual = planejamento.total_planejado > 0 
      ? (planejamento.total_gasto / planejamento.total_planejado) * 100 
      : 0;
    
    return Math.round(percentual * 10) / 10; // 1 casa decimal
  };

  const carregarTransacoesCategoria = async (categoriaId: number, planejamento: PlanejamentoMensal) => {
    try {
      // Formato de data para filtros (YYYY-MM-DD)
      const dataInicio = `${planejamento.ano}-${planejamento.mes.toString().padStart(2, '0')}-01`;
      const ultimoDiaMes = new Date(planejamento.ano, planejamento.mes, 0).getDate();
      const dataFim = `${planejamento.ano}-${planejamento.mes.toString().padStart(2, '0')}-${ultimoDiaMes}`;
      
      const transacoes = await transacoesApi.getAll({
        categoria_id: categoriaId,
        tipo: 'SAIDA',
        data_inicio: dataInicio,
        data_fim: dataFim,
        limit: 100
      });
      
      setTransacoesDetalhadas(prev => ({
        ...prev,
        [categoriaId]: transacoes
      }));
    } catch (error) {
      console.error('Erro ao carregar transações da categoria:', error);
    }
  };

  const toggleCategoriaExpanded = async (categoriaId: number, planejamento: PlanejamentoMensal) => {
    if (expandedCategoria === categoriaId) {
      setExpandedCategoria(null);
    } else {
      setExpandedCategoria(categoriaId);
      if (!transacoesDetalhadas[categoriaId]) {
        await carregarTransacoesCategoria(categoriaId, planejamento);
      }
    }
  };

  const calcularResumoFormaPagamento = (transacoes: any[]) => {
    const resumo = {
      cartoes: {} as {[key: string]: {nome: string, valor: number, cor: string}},
      contas: {} as {[key: string]: {nome: string, valor: number, cor: string}},
      totalCartoes: 0,
      totalContas: 0
    };

    transacoes.forEach(transacao => {
      if (transacao.cartao) {
        const id = `cartao_${transacao.cartao.id}`;
        if (!resumo.cartoes[id]) {
          resumo.cartoes[id] = {
            nome: transacao.cartao.nome,
            valor: 0,
            cor: transacao.cartao.cor
          };
        }
        resumo.cartoes[id].valor += transacao.valor;
        resumo.totalCartoes += transacao.valor;
      } else if (transacao.conta) {
        const id = `conta_${transacao.conta.id}`;
        if (!resumo.contas[id]) {
          resumo.contas[id] = {
            nome: transacao.conta.nome,
            valor: 0,
            cor: transacao.conta.cor
          };
        }
        resumo.contas[id].valor += transacao.valor;
        resumo.totalContas += transacao.valor;
      }
    });

    return resumo;
  };

  const handleDuplicarPlanejamento = async (planejamento: PlanejamentoMensal) => {
    try {
      // Para simplificar, vamos duplicar para o próximo mês
      const proximoMes = planejamento.mes === 12 ? 1 : planejamento.mes + 1;
      const proximoAno = planejamento.mes === 12 ? planejamento.ano + 1 : planejamento.ano;
      
      const novoPlanejamento = await planejamentoApi.duplicar(planejamento.id, proximoMes, proximoAno);
      setPlanejamentos([novoPlanejamento, ...planejamentos]);
      
      // Recarregar resumo
      const novoResumo = await planejamentoApi.getResumo();
      setResumo(novoResumo);
      
      alert(`Planejamento duplicado para ${mesesNomes[proximoMes - 1]} ${proximoAno}!`);
    } catch (error) {
      console.error('Erro ao duplicar planejamento:', error);
      alert('Erro ao duplicar planejamento. Pode ser que já exista um planejamento para esse período.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen-mobile bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Navigation user={user} />
      
      <div className="container-mobile pb-safe">
        {/* Header com design consistente */}
        <div className="py-6 lg:py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
                <Target className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-responsive-heading text-slate-900">Orçamento Mensal</h1>
                <p className="text-slate-600 text-sm sm:text-base">Controle suas finanças e metas de gastos</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center lg:justify-end">
              <button
                onClick={() => setShowModalCriar(true)}
                disabled={isActionLoading}
                className="btn-touch bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl space-x-2 touch-manipulation disabled:opacity-50"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Novo Orçamento</span>
                <span className="sm:hidden">Novo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mensagens de feedback */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl border flex items-center space-x-2 ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Planejamentos */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-2xl font-bold text-slate-900">{resumo?.total_planejamentos || 0}</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Planejamentos</h3>
            <p className="text-sm text-slate-600">Criados até agora</p>
          </div>

          {/* Gasto Mensal */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-2xl font-bold text-slate-900">
                R$ {(resumo?.total_gasto_mes || 0).toLocaleString()}
              </span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Gasto no Mês</h3>
            <p className="text-sm text-slate-600">Total realizado</p>
          </div>

          {/* Planejado Mensal */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-2xl font-bold text-slate-900">
                R$ {(resumo?.total_planejado_mes || 0).toLocaleString()}
              </span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Planejado no Mês</h3>
            <p className="text-sm text-slate-600">Orçamento definido</p>
          </div>

          {/* Percentual Cumprimento */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <span className={`text-2xl font-bold ${
                (resumo?.percentual_cumprimento || 0) > 100 ? 'text-red-600' : 'text-slate-900'
              }`}>
                {(resumo?.percentual_cumprimento || 0).toFixed(1)}%
              </span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Cumprimento</h3>
            <p className="text-sm text-slate-600">Do orçamento planejado</p>
          </div>
        </div>

        {/* Planejamento Atual */}
        {resumo?.planejamento_atual && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                Planejamento Atual - {mesesNomes[resumo.planejamento_atual.mes - 1]} {resumo.planejamento_atual.ano}
              </h2>
              <button
                onClick={() => {
                  setPlanejamentoSelecionado(resumo.planejamento_atual!);
                  setShowModalDetalhes(true);
                }}
                className="text-blue-600 hover:text-blue-700 flex items-center space-x-2"
              >
                <Eye className="w-4 h-4" />
                <span>Ver Detalhes</span>
              </button>
            </div>

            {/* Progresso Geral */}
            <div className="mb-6 p-4 bg-slate-50 rounded-xl">
              {(() => {
                const percentualGeral = calcularPercentualGeral(resumo.planejamento_atual);
                return (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        R$ {resumo.planejamento_atual.total_gasto.toLocaleString()} de R$ {resumo.planejamento_atual.total_planejado.toLocaleString()}
                      </span>
                      <span className={`text-sm font-medium ${
                        percentualGeral > 100 ? 'text-red-600' : 'text-slate-700'
                      }`}>
                        {percentualGeral.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full ${
                          percentualGeral > 100 ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        style={{ 
                          width: `${Math.min(percentualGeral, 100)}%` 
                        }}
                      ></div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Categorias */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resumo.planejamento_atual.planos_categoria.map(plano => {
                const valoresCorretos = calcularValoresCorretos(plano);
                
                return (
                  <div key={plano.id} className="p-4 border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"
                          style={{ backgroundColor: plano.categoria.cor }}
                        >
                          {plano.categoria.icone}
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-900">{plano.categoria.nome}</h4>
                          <p className="text-xs text-slate-500">
                            R$ {plano.valor_gasto.toLocaleString()} / R$ {plano.valor_planejado.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${getStatusColor(valoresCorretos.percentual_gasto)}`}>
                        {getStatusIcon(valoresCorretos.percentual_gasto)}
                        <span className="text-xs font-medium">{valoresCorretos.percentual_gasto.toFixed(0)}%</span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          valoresCorretos.percentual_gasto > 100 ? 'bg-red-500' : 
                          valoresCorretos.percentual_gasto > 80 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ 
                          width: `${Math.min(valoresCorretos.percentual_gasto, 100)}%` 
                        }}
                      ></div>
                    </div>
                    
                    <p className="text-xs text-slate-600 mt-2">
                      Restante: <span className={valoresCorretos.saldo_restante >= 0 ? 'text-green-600' : 'text-red-600'}>
                        R$ {valoresCorretos.saldo_restante.toLocaleString()}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lista de Planejamentos */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Histórico de Planejamentos</h2>
          </div>
          
          <div className="p-6">
            {planejamentos.length === 0 ? (
              <div className="text-center py-12">
                <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum planejamento criado</h3>
                <p className="text-slate-600 mb-6">Comece criando seu primeiro planejamento mensal</p>
                <button
                  onClick={() => setShowModalCriar(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  Criar Primeiro Planejamento
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {planejamentos.map(planejamento => (
                  <div key={planejamento.id} className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900">{planejamento.nome}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        planejamento.status === 'ativo' ? 'bg-green-100 text-green-700' :
                        planejamento.status === 'pausado' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {planejamento.status}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-600 mb-4">
                      {mesesNomes[planejamento.mes - 1]} {planejamento.ano}
                    </p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Renda Esperada:</span>
                        <span className="font-medium">R$ {planejamento.renda_esperada.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Total Planejado:</span>
                        <span className="font-medium">R$ {planejamento.total_planejado.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Total Gasto:</span>
                        <span className={`font-medium ${
                          planejamento.total_gasto > planejamento.total_planejado ? 'text-red-600' : 'text-slate-900'
                        }`}>
                          R$ {planejamento.total_gasto.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-slate-200 rounded-full h-2 mb-4">
                      {(() => {
                        const percentualGeral = calcularPercentualGeral(planejamento);
                        return (
                          <div 
                            className={`h-2 rounded-full ${
                              percentualGeral > 100 ? 'bg-red-500' : 'bg-blue-500'
                            }`}
                            style={{ 
                              width: `${Math.min(percentualGeral, 100)}%` 
                            }}
                          ></div>
                        );
                      })()}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        {planejamento.planos_categoria.length} categorias
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setPlanejamentoSelecionado(planejamento);
                            setShowModalDetalhes(true);
                          }}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditarPlanejamento(planejamento)}
                          disabled={isActionLoading}
                          className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Editar orçamento"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setPlanejamentoSelecionado(planejamento);
                            setShowModalDuplicar(true);
                          }}
                          disabled={isActionLoading}
                          className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Duplicar para próximos meses"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExcluirPlanejamento(planejamento)}
                          disabled={isActionLoading}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Excluir orçamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Criar Planejamento */}
        {showModalCriar && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Criar Novo Planejamento</h2>
                <button
                  onClick={() => setShowModalCriar(false)}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Informações Básicas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Nome do Planejamento</label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Planejamento Janeiro 2024"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Renda Esperada</label>
                    <input
                      type="number"
                      value={formData.renda_esperada}
                      onChange={(e) => setFormData({ ...formData, renda_esperada: Number(e.target.value) })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="5000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Mês</label>
                    <select
                      value={formData.mes}
                      onChange={(e) => setFormData({ ...formData, mes: Number(e.target.value) })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {mesesNomes.map((mes, index) => (
                        <option key={index} value={index + 1}>{mes}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Ano</label>
                    <select
                      value={formData.ano}
                      onChange={(e) => setFormData({ ...formData, ano: Number(e.target.value) })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {[2024, 2025, 2026].map(ano => (
                        <option key={ano} value={ano}>{ano}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Descrição (Opcional)</label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Descrição do planejamento..."
                  />
                </div>

                {/* Categorias */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Orçamento por Categoria</h3>
                    <button
                      type="button"
                      onClick={adicionarCategoriaAoPlano}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar Categoria</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formData.planos_categoria.map((plano, index) => (
                      <div key={index} className="p-4 border border-slate-200 rounded-xl">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Categoria</label>
                            <select
                              value={plano.categoria_id}
                              onChange={(e) => atualizarCategoriaDoPlano(index, 'categoria_id', Number(e.target.value))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              {isLoading ? (
                                <option value={0} disabled>Carregando...</option>
                              ) : categorias.length === 0 ? (
                                <option value={0} disabled>Nenhuma categoria disponível</option>
                              ) : (
                                <>
                                  <option value={0} disabled>Selecione uma categoria</option>
                                  {categorias.map(categoria => (
                                    <option key={categoria.id} value={categoria.id}>
                                      {categoria.icone} {categoria.nome}
                                    </option>
                                  ))}
                                </>
                              )}
                            </select>
                            {!isLoading && categorias.length === 0 && (
                              <p className="text-sm text-amber-600 mt-1">
                                ⚠️ Cadastre categorias na página "Configurações" antes de criar um planejamento.
                              </p>
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Valor Planejado</label>
                            <input
                              type="number"
                              value={plano.valor_planejado}
                              onChange={(e) => atualizarCategoriaDoPlano(index, 'valor_planejado', Number(e.target.value))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="500"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Prioridade</label>
                            <select
                              value={plano.prioridade}
                              onChange={(e) => atualizarCategoriaDoPlano(index, 'prioridade', Number(e.target.value))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value={1}>Alta</option>
                              <option value={2}>Média</option>
                              <option value={3}>Baixa</option>
                            </select>
                          </div>
                          
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => removerCategoriaDoPlano(index)}
                              className="w-full bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center space-x-1"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Remover</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resumo */}
                {formData.planos_categoria.length > 0 && (
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <h4 className="font-semibold text-slate-900 mb-2">Resumo do Planejamento</h4>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700">Total Planejado:</span>
                      <span className="font-bold text-lg">
                        R$ {formData.planos_categoria.reduce((total, plano) => total + plano.valor_planejado, 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700">Sobra da Renda:</span>
                      <span className={`font-bold ${
                        (formData.renda_esperada - formData.planos_categoria.reduce((total, plano) => total + plano.valor_planejado, 0)) >= 0 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        R$ {(formData.renda_esperada - formData.planos_categoria.reduce((total, plano) => total + plano.valor_planejado, 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-4 mt-8">
                <button
                  onClick={() => setShowModalCriar(false)}
                  className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCriarPlanejamento}
                  disabled={!formData.nome || formData.planos_categoria.length === 0}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Criar Planejamento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Detalhes */}
        {showModalDetalhes && planejamentoSelecionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">{planejamentoSelecionado.nome}</h2>
                <button
                  onClick={() => setShowModalDetalhes(false)}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                  ×
                </button>
              </div>

              {/* Resumo do Planejamento */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-50 p-4 rounded-xl">
                  <h4 className="font-semibold text-blue-900 mb-1">Renda Esperada</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    R$ {planejamentoSelecionado.renda_esperada.toLocaleString()}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl">
                  <h4 className="font-semibold text-green-900 mb-1">Total Planejado</h4>
                  <p className="text-2xl font-bold text-green-600">
                    R$ {planejamentoSelecionado.total_planejado.toLocaleString()}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-xl">
                  <h4 className="font-semibold text-red-900 mb-1">Total Gasto</h4>
                  <p className="text-2xl font-bold text-red-600">
                    R$ {planejamentoSelecionado.total_gasto.toLocaleString()}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl">
                  <h4 className="font-semibold text-purple-900 mb-1">Saldo Restante</h4>
                  <p className={`text-2xl font-bold ${
                    planejamentoSelecionado.saldo_planejado >= 0 ? 'text-purple-600' : 'text-red-600'
                  }`}>
                    R$ {planejamentoSelecionado.saldo_planejado.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Lista de Categorias */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Orçamento por Categoria</h3>
                <div className="space-y-4">
                  {planejamentoSelecionado.planos_categoria.map(plano => {
                    const transacoes = transacoesDetalhadas[plano.categoria_id] || [];
                    const resumoPagamento = calcularResumoFormaPagamento(transacoes);
                    const isExpanded = expandedCategoria === plano.categoria_id;
                    const valoresCorretos = calcularValoresCorretos(plano);
                    
                    return (
                      <div key={plano.id} className="border border-slate-200 rounded-xl">
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-4">
                              <div 
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg"
                                style={{ backgroundColor: plano.categoria.cor }}
                              >
                                {plano.categoria.icone}
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-slate-900">{plano.categoria.nome}</h4>
                                <p className="text-sm text-slate-600">
                                  Prioridade: {plano.prioridade === 1 ? 'Alta' : plano.prioridade === 2 ? 'Média' : 'Baixa'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className={`flex items-center space-x-2 px-3 py-2 rounded-full ${getStatusColor(valoresCorretos.percentual_gasto)}`}>
                                {getStatusIcon(valoresCorretos.percentual_gasto)}
                                <span className="font-medium">{valoresCorretos.percentual_gasto.toFixed(1)}%</span>
                              </div>
                              <button
                                onClick={() => toggleCategoriaExpanded(plano.categoria_id, planejamentoSelecionado)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Ver detalhes dos gastos"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-5 h-5 text-slate-600" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-slate-600" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-slate-600">Valor Planejado</p>
                              <p className="text-xl font-bold text-slate-900">R$ {plano.valor_planejado.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm text-slate-600">Valor Gasto</p>
                              <p className="text-xl font-bold text-red-600">R$ {plano.valor_gasto.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm text-slate-600">Saldo Restante</p>
                              <p className={`text-xl font-bold ${valoresCorretos.saldo_restante >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                R$ {valoresCorretos.saldo_restante.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="w-full bg-slate-200 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full ${
                                valoresCorretos.percentual_gasto > 100 ? 'bg-red-500' : 
                                valoresCorretos.percentual_gasto > 80 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ 
                                width: `${Math.min(valoresCorretos.percentual_gasto, 100)}%` 
                              }}
                            ></div>
                          </div>

                          {plano.observacoes && (
                            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                              <p className="text-sm text-slate-600">{plano.observacoes}</p>
                            </div>
                          )}
                        </div>

                        {/* Seção Expandida com Detalhes */}
                        {isExpanded && (
                          <div className="border-t border-slate-200 p-6 bg-slate-50">
                            {transacoes.length > 0 ? (
                              <div className="space-y-6">
                                {/* Resumo por Forma de Pagamento */}
                                <div>
                                  <h5 className="font-semibold text-slate-900 mb-3 flex items-center space-x-2">
                                    <BarChart3 className="w-4 h-4" />
                                    <span>Resumo por Forma de Pagamento</span>
                                  </h5>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Cartões */}
                                    {Object.keys(resumoPagamento.cartoes).length > 0 && (
                                      <div className="bg-white rounded-lg p-4 border border-slate-200">
                                        <div className="flex items-center space-x-2 mb-3">
                                          <CreditCard className="w-4 h-4 text-purple-600" />
                                          <h6 className="font-medium text-slate-900">Cartões</h6>
                                          <span className="text-sm text-slate-500">
                                            (R$ {resumoPagamento.totalCartoes.toLocaleString()})
                                          </span>
                                        </div>
                                        <div className="space-y-2">
                                          {Object.entries(resumoPagamento.cartoes).map(([id, dados]) => (
                                            <div key={id} className="flex items-center justify-between">
                                              <div className="flex items-center space-x-2">
                                                <div 
                                                  className="w-3 h-3 rounded-full"
                                                  style={{ backgroundColor: dados.cor }}
                                                ></div>
                                                <span className="text-sm text-slate-700">{dados.nome}</span>
                                              </div>
                                              <span className="text-sm font-medium text-slate-900">
                                                R$ {dados.valor.toLocaleString()}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Contas */}
                                    {Object.keys(resumoPagamento.contas).length > 0 && (
                                      <div className="bg-white rounded-lg p-4 border border-slate-200">
                                        <div className="flex items-center space-x-2 mb-3">
                                          <Banknote className="w-4 h-4 text-green-600" />
                                          <h6 className="font-medium text-slate-900">Contas</h6>
                                          <span className="text-sm text-slate-500">
                                            (R$ {resumoPagamento.totalContas.toLocaleString()})
                                          </span>
                                        </div>
                                        <div className="space-y-2">
                                          {Object.entries(resumoPagamento.contas).map(([id, dados]) => (
                                            <div key={id} className="flex items-center justify-between">
                                              <div className="flex items-center space-x-2">
                                                <div 
                                                  className="w-3 h-3 rounded-full"
                                                  style={{ backgroundColor: dados.cor }}
                                                ></div>
                                                <span className="text-sm text-slate-700">{dados.nome}</span>
                                              </div>
                                              <span className="text-sm font-medium text-slate-900">
                                                R$ {dados.valor.toLocaleString()}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Lista de Transações */}
                                <div>
                                  <h5 className="font-semibold text-slate-900 mb-3 flex items-center space-x-2">
                                    <Calendar className="w-4 h-4" />
                                    <span>Transações ({transacoes.length})</span>
                                  </h5>
                                  
                                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                    <div className="max-h-64 overflow-y-auto">
                                      {transacoes.map((transacao, index) => (
                                        <div key={transacao.id} className={`p-4 ${index !== transacoes.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                          <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                              <p className="font-medium text-slate-900">{transacao.descricao}</p>
                                              <div className="flex items-center space-x-4 mt-1">
                                                <span className="text-xs text-slate-500">
                                                  {new Date(transacao.data).toLocaleDateString('pt-BR')}
                                                </span>
                                                {transacao.cartao && (
                                                  <div className="flex items-center space-x-1">
                                                    <CreditCard className="w-3 h-3 text-purple-500" />
                                                    <span className="text-xs text-slate-600">{transacao.cartao.nome}</span>
                                                  </div>
                                                )}
                                                {transacao.conta && (
                                                  <div className="flex items-center space-x-1">
                                                    <Banknote className="w-3 h-3 text-green-500" />
                                                    <span className="text-xs text-slate-600">{transacao.conta.nome}</span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <p className="font-bold text-red-600">R$ {transacao.valor.toLocaleString()}</p>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-600">Nenhuma transação encontrada para esta categoria no período</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editar Planejamento */}
        {showModalEditar && planejamentoSelecionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Editar Orçamento</h2>
                <button
                  onClick={() => {
                    setShowModalEditar(false);
                    setPlanejamentoSelecionado(null);
                  }}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Informações Básicas */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Nome do Orçamento</label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Orçamento Janeiro 2024"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Descrição (opcional)</label>
                    <textarea
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Adicione uma descrição para este orçamento..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Renda Esperada</label>
                    <input
                      type="number"
                      value={formData.renda_esperada}
                      onChange={(e) => setFormData({ ...formData, renda_esperada: Number(e.target.value) })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="5000"
                    />
                  </div>
                </div>

                {/* Período (apenas visualização) */}
                <div className="p-4 bg-blue-50 rounded-xl">
                  <h4 className="font-semibold text-blue-900 mb-1">Período</h4>
                  <p className="text-blue-700">
                    {mesesNomes[formData.mes - 1]} {formData.ano}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    O período não pode ser alterado após a criação
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-4 mt-8">
                <button
                  onClick={() => {
                    setShowModalEditar(false);
                    setPlanejamentoSelecionado(null);
                  }}
                  disabled={isActionLoading}
                  className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarEdicao}
                  disabled={isActionLoading || !formData.nome.trim()}
                  className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isActionLoading && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Duplicar Planejamento */}
        {showModalDuplicar && planejamentoSelecionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Duplicar Planejamento</h2>
                <button
                  onClick={() => setShowModalDuplicar(false)}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    Planejamento: {planejamentoSelecionado.nome}
                  </h3>
                  <p className="text-blue-700 text-sm">
                    {mesesNomes[planejamentoSelecionado.mes - 1]} {planejamentoSelecionado.ano} • 
                    R$ {planejamentoSelecionado.total_planejado.toLocaleString()} planejado
                  </p>
                </div>

                {/* Seleção de Meses */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Para quais meses duplicar?</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map(offset => {
                      const novoMes = (planejamentoSelecionado.mes + offset - 1) % 12 + 1;
                      const novoAno = planejamentoSelecionado.ano + Math.floor((planejamentoSelecionado.mes + offset - 1) / 12);
                      const isSelected = mesesParaDuplicar.some(m => m.mes === novoMes && m.ano === novoAno);
                      
                      return (
                        <button
                          key={offset}
                          onClick={() => {
                            if (isSelected) {
                              setMesesParaDuplicar(prev => prev.filter(m => !(m.mes === novoMes && m.ano === novoAno)));
                            } else {
                              setMesesParaDuplicar(prev => [...prev, {mes: novoMes, ano: novoAno}]);
                            }
                          }}
                          className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                            isSelected 
                              ? 'bg-blue-100 border-blue-300 text-blue-700' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {mesesNomes[novoMes - 1]} {novoAno}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ajuste de Valores */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Ajustar valores</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Fator de Ajuste ({((fatorAjuste - 1) * 100).toFixed(0)}% {fatorAjuste >= 1 ? 'aumento' : 'redução'})
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={fatorAjuste}
                        onChange={(e) => setFatorAjuste(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>-50%</span>
                        <span>Normal</span>
                        <span>+50%</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => setFatorAjuste(0.9)}
                        className="p-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200"
                      >
                        -10%
                      </button>
                      <button 
                        onClick={() => setFatorAjuste(1.0)}
                        className="p-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200"
                      >
                        Normal
                      </button>
                      <button 
                        onClick={() => setFatorAjuste(1.1)}
                        className="p-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200"
                      >
                        +10%
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {mesesParaDuplicar.length > 0 && (
                  <div className="p-4 bg-green-50 rounded-xl">
                    <h4 className="font-semibold text-green-900 mb-2">Resumo da Duplicação</h4>
                    <div className="space-y-1 text-sm text-green-700">
                      <p>• {mesesParaDuplicar.length} mês(es) selecionado(s)</p>
                      <p>• Valor original: R$ {planejamentoSelecionado.total_planejado.toLocaleString()}</p>
                      <p>• Valor ajustado: R$ {(planejamentoSelecionado.total_planejado * fatorAjuste).toLocaleString()}</p>
                      <p>• Meses: {mesesParaDuplicar.map(m => `${mesesNomes[m.mes - 1]} ${m.ano}`).join(', ')}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-4 mt-8">
                <button
                  onClick={() => setShowModalDuplicar(false)}
                  className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    try {
                      for (const mesAno of mesesParaDuplicar) {
                        await planejamentoApi.duplicar(planejamentoSelecionado.id, mesAno.mes, mesAno.ano);
                      }
                      
                      // Recarregar dados
                      const [novoResumo, novosPlanejamentos] = await Promise.all([
                        planejamentoApi.getResumo(),
                        planejamentoApi.getAll({ limit: 12 })
                      ]);
                      
                      setResumo(novoResumo);
                      setPlanejamentos(novosPlanejamentos);
                      setShowModalDuplicar(false);
                      setMesesParaDuplicar([]);
                      setFatorAjuste(1.0);
                      
                      alert(`${mesesParaDuplicar.length} planejamento(s) duplicado(s) com sucesso!`);
                    } catch (error) {
                      console.error('Erro ao duplicar:', error);
                      alert('Erro ao duplicar alguns planejamentos. Verifique se já existem planejamentos para esses períodos.');
                    }
                  }}
                  disabled={mesesParaDuplicar.length === 0}
                  className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Duplicar {mesesParaDuplicar.length > 0 ? `(${mesesParaDuplicar.length})` : ''}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 