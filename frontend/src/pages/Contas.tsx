import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { contasApi } from '../services/api';

interface Conta {
  id: number;
  nome: string;
  banco: string;
  tipo: string;
  numero?: string;
  agencia?: string;
  saldo_inicial: number;
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

export default function Contas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contas, setContas] = useState<Conta[]>([]);
  const [contasComResumo, setContasComResumo] = useState<Conta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingConta, setEditingConta] = useState<Conta | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    banco: '',
    tipo: 'corrente',
    numero: '',
    agencia: '',
    saldo_inicial: 0,
    cor: '#1E40AF'
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

  // Carregar contas do backend
  useEffect(() => {
    loadContas();
  }, []);

  const loadContas = async () => {
    try {
      setIsLoading(true);
      const data = await contasApi.getAll();
      setContas(data);
      
      // Carregar resumo para cada conta
      const contasComResumoPromises = data.map(async (conta: Conta) => {
        try {
          const contaComResumo = await contasApi.getResumo(conta.id);
          return contaComResumo;
        } catch (error) {
          console.error(`Erro ao carregar resumo da conta ${conta.id}:`, error);
          // Retornar conta sem resumo em caso de erro
          return {
            ...conta,
            resumo: {
              saldo_atual: conta.saldo_inicial,
              total_entradas: 0,
              total_saidas: 0,
              ultima_movimentacao: null,
              data_ultima_movimentacao: null,
              total_transacoes: 0
            }
          };
        }
      });
      
      const contasComResumoData = await Promise.all(contasComResumoPromises);
      setContasComResumo(contasComResumoData);
    } catch (error: any) {
      setError('Erro ao carregar contas');
      console.error('Erro ao carregar contas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingConta) {
        await contasApi.update(editingConta.id, formData);
      } else {
        await contasApi.create(formData);
      }
      
      await loadContas(); // Recarregar dados
      setShowModal(false);
      setEditingConta(null);
      setFormData({
        nome: '',
        banco: '',
        tipo: 'corrente',
        numero: '',
        agencia: '',
        saldo_inicial: 0,
        cor: '#1E40AF'
      });
    } catch (error: any) {
      setError('Erro ao salvar conta');
      console.error('Erro ao salvar conta:', error);
    }
  };

  const handleEdit = (conta: Conta) => {
    setEditingConta(conta);
    setFormData({
      nome: conta.nome,
      banco: conta.banco,
      tipo: conta.tipo,
      numero: conta.numero || '',
      agencia: conta.agencia || '',
      saldo_inicial: conta.saldo_inicial,
      cor: conta.cor
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta conta?')) {
      try {
        await contasApi.delete(id);
        await loadContas(); // Recarregar dados
      } catch (error: any) {
        setError('Erro ao excluir conta');
        console.error('Erro ao excluir conta:', error);
      }
    }
  };

  const openCreateModal = () => {
    setEditingConta(null);
    setFormData({
      nome: '',
      banco: '',
      tipo: 'corrente',
      numero: '',
      agencia: '',
      saldo_inicial: 0,
      cor: '#1E40AF'
    });
    setShowModal(true);
  };

  const totalSaldo = contasComResumo.reduce((sum, conta) => sum + (conta.resumo?.saldo_atual || conta.saldo_inicial), 0);
  const contasCorrente = contasComResumo.filter(c => c.tipo === 'corrente');
  const contasPoupanca = contasComResumo.filter(c => c.tipo === 'poupanca');

  const getBankIcon = (banco: string) => {
    const icons: Record<string, string> = {
      'Itaú': '🧡',
      'Bradesco': '❤️',
      'Nubank': '💜',
      'Santander': '❤️',
      'Banco do Brasil': '💛',
      'Caixa': '💙',
      'Inter': '🧡',
      'C6 Bank': '⚫',
      'BTG Pactual': '💚',
      'Safra': '🔷',
      'Sicoob': '💚',
      'Sicredi': '💚',
      'Original': '💚',
      'PagBank': '💙',
      'Mercado Pago': '💙',
      'Picpay': '💚',
      'Outro': '🏦'
    };
    return icons[banco] || '🏦';
  };

  const formatarUltimaMovimentacao = (conta: Conta) => {
    if (!conta.resumo?.ultima_movimentacao) {
      return 'Nenhuma movimentação';
    }
    
    const valor = conta.resumo.ultima_movimentacao;
    const sinal = valor >= 0 ? '+' : '';
    const data = conta.resumo.data_ultima_movimentacao ? 
      new Date(conta.resumo.data_ultima_movimentacao).toLocaleDateString() : 'hoje';
    
    return `${sinal}R$ ${Math.abs(valor).toLocaleString()} (${data})`;
  };

  const getCorUltimaMovimentacao = (valor?: number) => {
    if (!valor) return 'text-slate-500';
    return valor >= 0 ? 'text-green-600' : 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <Navigation user={user} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Carregando contas...</p>
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
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-4 mb-4 sm:mb-0">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Contas</h1>
                <p className="text-slate-600">Gerencie suas contas bancárias</p>
              </div>
            </div>
            
            <button 
              onClick={openCreateModal}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Nova Conta</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total de Contas</p>
                <p className="text-3xl font-bold text-slate-900">{contasComResumo.length}</p>
                <p className="text-sm text-green-600 mt-1">Todas ativas</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Saldo Total</p>
                <p className="text-3xl font-bold text-slate-900">R$ {totalSaldo.toLocaleString()}</p>
                <p className="text-sm text-blue-600 mt-1">Disponível</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Contas Corrente</p>
                <p className="text-3xl font-bold text-purple-600">{contasCorrente.length}</p>
                <p className="text-sm text-slate-500 mt-1">Movimento diário</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Poupanças</p>
                <p className="text-3xl font-bold text-amber-600">{contasPoupanca.length}</p>
                <p className="text-sm text-slate-500 mt-1">Rendimento mensal</p>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Accounts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contasComResumo.map((conta) => (
            <div key={conta.id} className="group bg-white rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="p-6">
                {/* Account Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                      style={{ backgroundColor: conta.cor }}
                    >
                      {getBankIcon(conta.banco)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-lg">{conta.nome}</h3>
                      <p className="text-sm text-slate-500">{conta.banco}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      conta.tipo === 'poupanca' 
                        ? 'bg-amber-100 text-amber-800' 
                        : conta.tipo === 'investimento'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {conta.tipo === 'corrente' ? 'Conta Corrente' : 
                       conta.tipo === 'poupanca' ? 'Poupança' : 
                       conta.tipo === 'investimento' ? 'Investimento' : conta.tipo}
                    </span>
                  </div>
                </div>

                {/* Account Details */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Dados da Conta</p>
                    <div className="space-y-1">
                      {conta.agencia && (
                        <p className="font-mono text-sm text-slate-700">Ag: {conta.agencia}</p>
                      )}
                      {conta.numero && (
                        <p className="font-mono text-sm text-slate-700">CC: {conta.numero}</p>
                      )}
                      {!conta.agencia && !conta.numero && (
                        <p className="font-mono text-sm text-slate-500 italic">Dados não informados</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-600">Saldo Atual</span>
                      <span className="text-2xl font-bold text-slate-900">
                        R$ {(conta.resumo?.saldo_atual || conta.saldo_inicial).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Última movimentação</span>
                      <span className={getCorUltimaMovimentacao(conta.resumo?.ultima_movimentacao)}>
                        {formatarUltimaMovimentacao(conta)}
                      </span>
                    </div>
                  </div>

                  {/* Account Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-600 font-medium mb-1">Entradas</p>
                      <p className="text-lg font-bold text-green-700">
                        R$ {(conta.resumo?.total_entradas || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-600 font-medium mb-1">Saídas</p>
                      <p className="text-lg font-bold text-red-700">
                        R$ {(conta.resumo?.total_saidas || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2 mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Extrato</span>
                  </button>
                  <button 
                    onClick={() => handleEdit(conta)}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Editar</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {/* Add New Account */}
          <div className="group">
            <div 
              onClick={openCreateModal}
              className="relative w-full h-full min-h-[320px] rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 transition-colors duration-300 flex items-center justify-center bg-slate-50 hover:bg-blue-50 cursor-pointer"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Adicionar Conta</h3>
                <p className="text-sm text-slate-500">Cadastre uma nova conta bancária</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xl font-bold text-white mb-2">Ações Rápidas</h3>
              <p className="text-slate-300">Gerencie suas contas de forma rápida e eficiente</p>
            </div>
            
            <div className="flex space-x-3">
              <button className="bg-white text-slate-800 px-4 py-2 rounded-lg font-medium hover:bg-slate-100 transition-colors duration-200 flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <span>Importar OFX</span>
              </button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Exportar Dados</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingConta ? 'Editar Conta' : 'Nova Conta'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome da Conta
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Conta Corrente Principal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Banco
                  </label>
                  <select
                    required
                    value={formData.banco}
                    onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecione o banco</option>
                    <option value="Nubank">Nubank</option>
                    <option value="Itaú">Itaú Unibanco</option>
                    <option value="Bradesco">Bradesco</option>
                    <option value="Santander">Santander</option>
                    <option value="Banco do Brasil">Banco do Brasil</option>
                    <option value="Caixa">Caixa Econômica Federal</option>
                    <option value="Inter">Banco Inter</option>
                    <option value="C6 Bank">C6 Bank</option>
                    <option value="BTG Pactual">BTG Pactual</option>
                    <option value="Safra">Banco Safra</option>
                    <option value="Sicoob">Sicoob</option>
                    <option value="Sicredi">Sicredi</option>
                    <option value="Original">Banco Original</option>
                    <option value="PagBank">PagBank</option>
                    <option value="Mercado Pago">Mercado Pago</option>
                    <option value="Picpay">PicPay</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tipo de Conta
                  </label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Poupança</option>
                    <option value="investimento">Investimento</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Agência
                    </label>
                    <input
                      type="text"
                      value={formData.agencia}
                      onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0001"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Número da Conta
                    </label>
                    <input
                      type="text"
                      value={formData.numero}
                      onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="12345-6"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Saldo Inicial
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.saldo_inicial}
                    onChange={(e) => setFormData({ ...formData, saldo_inicial: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cor
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={formData.cor}
                      onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                      className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.cor}
                      onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="#1E40AF"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    {editingConta ? 'Atualizar' : 'Criar'}
                  </button>
                  {editingConta && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingConta.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors duration-200"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 