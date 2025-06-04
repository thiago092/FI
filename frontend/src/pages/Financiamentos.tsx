import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { Plus, Home, TrendingUp, Calendar, CreditCard, AlertTriangle, CheckCircle, Clock, Package, DollarSign } from 'lucide-react';

interface Financiamento {
  id: number;
  descricao: string;
  valor_total: number;
  valor_entrada: number;
  valor_financiado: number;
  taxa_juros_mensal: number;
  numero_parcelas: number;
  valor_parcela: number;
  data_contratacao: string;
  data_primeira_parcela: string;
  categoria_id: number;
  categoria_nome: string;
  categoria_icone: string;
  conta_id: number;
  conta_nome: string;
  status: string;
  saldo_devedor: number;
  parcelas_pagas: number;
  parcelas_pendentes: number;
  percentual_pago: number;
  valor_total_pago: number;
  valor_total_juros: number;
  proxima_parcela?: {
    numero: number;
    valor: number;
    data_vencimento: string;
    dias_para_vencimento: number;
  };
}

interface ParcelaFinanciamento {
  id: number;
  numero_parcela: number;
  valor_parcela: number;
  valor_juros: number;
  valor_amortizacao: number;
  saldo_devedor: number;
  data_vencimento: string;
  status: string;
  data_pagamento?: string;
  valor_pago?: number;
  dias_atraso?: number;
}

interface Categoria {
  id: number;
  nome: string;
  icone: string;
}

interface Conta {
  id: number;
  nome: string;
  banco: string;
}

interface ResumoFinanciamentos {
  total_financiamentos: number;
  valor_total_financiado: number;
  saldo_devedor_total: number;
  valor_parcelas_mes: number;
  parcelas_vencendo_30_dias: number;
}

export default function Financiamentos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [financiamentos, setFinanciamentos] = useState<Financiamento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaFinanciamento[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanciamentos | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showParcelasModal, setShowParcelasModal] = useState(false);
  const [editingFinanciamento, setEditingFinanciamento] = useState<Financiamento | null>(null);
  const [selectedFinanciamento, setSelectedFinanciamento] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    descricao: '',
    valor_total: 0,
    valor_entrada: 0,
    taxa_juros_mensal: 0,
    numero_parcelas: 12,
    data_contratacao: new Date().toISOString().split('T')[0],
    data_primeira_parcela: new Date().toISOString().split('T')[0],
    categoria_id: 0,
    conta_id: 0
  });

  // Verificar se usuário está carregado
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadFinanciamentos(),
        loadCategorias(),
        loadContas(),
        loadResumo()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFinanciamentos = async () => {
    try {
      const response = await fetch('/api/financiamentos/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFinanciamentos(data);
      }
    } catch (error) {
      console.error('Erro ao carregar financiamentos:', error);
    }
  };

  const loadCategorias = async () => {
    try {
      const response = await fetch('/api/categorias/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCategorias(data);
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const loadContas = async () => {
    try {
      const response = await fetch('/api/contas/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setContas(data);
      }
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  const loadResumo = async () => {
    try {
      const response = await fetch('/api/financiamentos/resumo', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setResumo(data);
      }
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
    }
  };

  const loadParcelas = async (financiamentoId: number) => {
    try {
      const response = await fetch(`/api/financiamentos/${financiamentoId}/parcelas`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setParcelas(data);
      }
    } catch (error) {
      console.error('Erro ao carregar parcelas:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.descricao || !formData.categoria_id || !formData.conta_id) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const response = await fetch('/api/financiamentos/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadData();
        setShowModal(false);
        resetForm();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Erro ao criar financiamento');
      }
    } catch (error) {
      console.error('Erro ao salvar financiamento:', error);
      setError('Erro ao salvar financiamento');
    }
  };

  const pagarParcela = async (financiamentoId: number, parcelaId: number) => {
    if (!confirm('Confirma o pagamento desta parcela?')) return;

    try {
      const response = await fetch(`/api/financiamentos/${financiamentoId}/parcelas/${parcelaId}/pagar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await loadData();
        if (selectedFinanciamento) {
          await loadParcelas(selectedFinanciamento);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Erro ao pagar parcela');
      }
    } catch (error) {
      console.error('Erro ao pagar parcela:', error);
      setError('Erro ao pagar parcela');
    }
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      valor_total: 0,
      valor_entrada: 0,
      taxa_juros_mensal: 0,
      numero_parcelas: 12,
      data_contratacao: new Date().toISOString().split('T')[0],
      data_primeira_parcela: new Date().toISOString().split('T')[0],
      categoria_id: 0,
      conta_id: 0
    });
    setEditingFinanciamento(null);
    setError('');
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openParcelasModal = async (financiamento: Financiamento) => {
    setSelectedFinanciamento(financiamento.id);
    await loadParcelas(financiamento.id);
    setShowParcelasModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ATIVO': return 'text-blue-600 bg-blue-100';
      case 'QUITADO': return 'text-green-600 bg-green-100';
      case 'CANCELADO': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ATIVO': return <Clock className="w-4 h-4" />;
      case 'QUITADO': return <CheckCircle className="w-4 h-4" />;
      case 'CANCELADO': return <AlertTriangle className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <Navigation user={user} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Carregando financiamentos...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Navigation user={user} />
      
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Home className="w-8 h-8 text-blue-600" />
              Financiamentos
            </h1>
            <p className="text-slate-600 mt-1">Gerencie seus financiamentos e consórcios</p>
          </div>
          
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5" />
            Novo Financiamento
          </button>
        </div>

        {/* Resumo */}
        {resumo && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Financiamentos</p>
                  <p className="text-2xl font-bold text-slate-900">{resumo.total_financiamentos}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Home className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Valor Financiado</p>
                  <p className="text-2xl font-bold text-slate-900">
                    R$ {resumo.valor_total_financiado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Saldo Devedor</p>
                  <p className="text-2xl font-bold text-red-600">
                    R$ {resumo.saldo_devedor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Parcelas Este Mês</p>
                  <p className="text-2xl font-bold text-slate-900">
                    R$ {resumo.valor_parcelas_mes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Vencendo 30 dias</p>
                  <p className="text-2xl font-bold text-orange-600">{resumo.parcelas_vencendo_30_dias}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Financiamentos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {financiamentos.map((financiamento) => (
            <div key={financiamento.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
              {/* Header do card */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <span className="text-xl">{financiamento.categoria_icone}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{financiamento.descricao}</h3>
                    <p className="text-sm text-slate-600">{financiamento.categoria_nome}</p>
                  </div>
                </div>
                
                <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(financiamento.status)}`}>
                  {getStatusIcon(financiamento.status)}
                  {financiamento.status}
                </div>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Valor Total</p>
                  <p className="font-semibold text-slate-900">
                    R$ {financiamento.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Saldo Devedor</p>
                  <p className="font-semibold text-red-600">
                    R$ {financiamento.saldo_devedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Valor da Parcela</p>
                  <p className="font-semibold text-blue-600">
                    R$ {financiamento.valor_parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Taxa de Juros</p>
                  <p className="font-semibold text-slate-900">{financiamento.taxa_juros_mensal}% a.m.</p>
                </div>
              </div>

              {/* Progresso */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Progresso</span>
                  <span className="font-medium">{financiamento.parcelas_pagas}/{financiamento.numero_parcelas} parcelas</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${financiamento.percentual_pago}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-500 mt-1">{financiamento.percentual_pago}% concluído</p>
              </div>

              {/* Próxima parcela */}
              {financiamento.proxima_parcela && (
                <div className="bg-slate-50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-slate-500 mb-1">Próxima Parcela</p>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-900">
                      R$ {financiamento.proxima_parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-sm text-slate-600">
                      {new Date(financiamento.proxima_parcela.data_vencimento).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {financiamento.proxima_parcela.dias_para_vencimento <= 7 && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 text-orange-500" />
                      <span className="text-xs text-orange-600">
                        Vence em {financiamento.proxima_parcela.dias_para_vencimento} dias
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2">
                <button
                  onClick={() => openParcelasModal(financiamento)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  Ver Parcelas
                </button>
                <button className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors text-sm font-medium">
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Mensagem quando não há financiamentos */}
        {financiamentos.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Home className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum financiamento encontrado</h3>
            <p className="text-slate-600 mb-6">Comece criando seu primeiro financiamento ou consórcio</p>
            <button
              onClick={openCreateModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 mx-auto transition-all"
            >
              <Plus className="w-5 h-5" />
              Novo Financiamento
            </button>
          </div>
        )}
      </div>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingFinanciamento ? 'Editar Financiamento' : 'Novo Financiamento'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Descrição *
                  </label>
                  <input
                    type="text"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Financiamento da Casa, Consórcio do Carro"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Valor Total *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_total}
                    onChange={(e) => setFormData({ ...formData, valor_total: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0,00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Valor de Entrada
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_entrada}
                    onChange={(e) => setFormData({ ...formData, valor_entrada: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Taxa de Juros Mensal (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.taxa_juros_mensal}
                    onChange={(e) => setFormData({ ...formData, taxa_juros_mensal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="1.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número de Parcelas *
                  </label>
                  <input
                    type="number"
                    value={formData.numero_parcelas}
                    onChange={(e) => setFormData({ ...formData, numero_parcelas: parseInt(e.target.value) || 12 })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="12"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Data de Contratação *
                  </label>
                  <input
                    type="date"
                    value={formData.data_contratacao}
                    onChange={(e) => setFormData({ ...formData, data_contratacao: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Data da Primeira Parcela *
                  </label>
                  <input
                    type="date"
                    value={formData.data_primeira_parcela}
                    onChange={(e) => setFormData({ ...formData, data_primeira_parcela: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Categoria *
                  </label>
                  <select
                    value={formData.categoria_id}
                    onChange={(e) => setFormData({ ...formData, categoria_id: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value={0}>Selecione uma categoria</option>
                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.icone} {categoria.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Conta de Débito *
                  </label>
                  <select
                    value={formData.conta_id}
                    onChange={(e) => setFormData({ ...formData, conta_id: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value={0}>Selecione uma conta</option>
                    {contas.map((conta) => (
                      <option key={conta.id} value={conta.id}>
                        {conta.nome} - {conta.banco}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview do cálculo */}
              {formData.valor_total > 0 && formData.numero_parcelas > 0 && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-2">Preview do Financiamento</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">Valor Financiado:</span>
                      <span className="ml-2 font-medium">
                        R$ {(formData.valor_total - formData.valor_entrada).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-600">Valor da Parcela:</span>
                      <span className="ml-2 font-medium">
                        R$ {(() => {
                          const valorFinanciado = formData.valor_total - formData.valor_entrada;
                          const taxaDecimal = formData.taxa_juros_mensal / 100;
                          let valorParcela;
                          
                          if (taxaDecimal > 0) {
                            const fator = ((1 + taxaDecimal) ** formData.numero_parcelas * taxaDecimal) / 
                                        (((1 + taxaDecimal) ** formData.numero_parcelas) - 1);
                            valorParcela = valorFinanciado * fator;
                          } else {
                            valorParcela = valorFinanciado / formData.numero_parcelas;
                          }
                          
                          return valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingFinanciamento ? 'Salvar Alterações' : 'Criar Financiamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Parcelas */}
      {showParcelasModal && selectedFinanciamento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Parcelas do Financiamento</h2>
                <button
                  onClick={() => setShowParcelasModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-medium text-slate-900">#</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-900">Vencimento</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-900">Valor</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-900">Juros</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-900">Amortização</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-900">Saldo</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-900">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-900">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelas.map((parcela) => (
                      <tr key={parcela.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">{parcela.numero_parcela}</td>
                        <td className="py-3 px-4">
                          {new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}
                          {parcela.dias_atraso && parcela.dias_atraso > 0 && (
                            <div className="text-xs text-red-600 mt-1">
                              {parcela.dias_atraso} dias de atraso
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium">
                          R$ {parcela.valor_parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-red-600">
                          R$ {parcela.valor_juros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-blue-600">
                          R$ {parcela.valor_amortizacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          R$ {parcela.saldo_devedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          <div className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                            parcela.status === 'PAGA' ? 'text-green-600 bg-green-100' : 
                            parcela.dias_atraso && parcela.dias_atraso > 0 ? 'text-red-600 bg-red-100' :
                            'text-yellow-600 bg-yellow-100'
                          }`}>
                            {parcela.status === 'PAGA' ? <CheckCircle className="w-3 h-3" /> : 
                             parcela.dias_atraso && parcela.dias_atraso > 0 ? <AlertTriangle className="w-3 h-3" /> :
                             <Clock className="w-3 h-3" />}
                            {parcela.status}
                          </div>
                          {parcela.data_pagamento && (
                            <div className="text-xs text-slate-500 mt-1">
                              Pago em {new Date(parcela.data_pagamento).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {parcela.status === 'PENDENTE' && (
                            <button
                              onClick={() => pagarParcela(selectedFinanciamento, parcela.id)}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs transition-colors"
                            >
                              Pagar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 