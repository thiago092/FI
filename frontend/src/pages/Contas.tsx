import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { contasApi } from '../services/api';
import { Plus, CreditCard, TrendingUp, CheckCircle, Edit2, Trash2 } from 'lucide-react';

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
    saldo_inicial: 0,  // Sempre 0 - campo removido do formulário
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
        saldo_inicial: 0,  // Sempre 0 - campo removido do formulário
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
      saldo_inicial: 0,  // Sempre 0 - campo removido do formulário
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
      saldo_inicial: 0,  // Sempre 0 - campo removido do formulário
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Navigation user={user} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-gray-400">Carregando contas...</p>
            </div>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Contas</h1>
              <p className="text-slate-600 dark:text-gray-400 mt-2">Gerencie suas contas bancárias e acompanhe saldos</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 sm:mt-0 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Nova Conta</span>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-gray-400">Total de Contas</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{contasComResumo.length}</p>
              </div>
              <CreditCard className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-gray-400">Saldo Total</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">R$ {totalSaldo.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-gray-400">Contas Ativas</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{contasCorrente.length + contasPoupanca.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Accounts List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Suas Contas</h2>
            <div className="text-sm text-slate-600 dark:text-gray-400">
              {contasComResumo.length} {contasComResumo.length === 1 ? 'conta encontrada' : 'contas encontradas'}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {contasComResumo.map(conta => (
              <div key={conta.id} className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        conta.tipo === 'corrente' 
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                          : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                      }`}>
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white text-lg">{conta.nome}</h3>
                        <p className="text-slate-600 dark:text-gray-400 text-sm capitalize">
                          {conta.tipo} • {conta.banco}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(conta)}
                        className="p-2 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(conta.id)}
                        className="p-2 text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-gray-400 text-sm">Saldo Atual</span>
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">
                        R$ {(conta.resumo?.saldo_atual || conta.saldo_inicial).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {conta.resumo && (
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-gray-700">
                        <div className="text-center">
                          <p className="text-sm text-slate-600 dark:text-gray-400">Entradas</p>
                          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                            +R$ {(conta.resumo.total_entradas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-slate-600 dark:text-gray-400">Saídas</p>
                          <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                            -R$ {(conta.resumo.total_saidas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-gradient-to-r from-slate-800 to-slate-700 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xl font-bold text-white mb-2">Ações Rápidas</h3>
              <p className="text-slate-300 dark:text-gray-400">Gerencie suas contas de forma rápida e eficiente</p>
            </div>
            
            <div className="flex space-x-3">
              <button className="bg-white dark:bg-gray-700 text-slate-800 dark:text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-100 dark:hover:bg-gray-600 transition-colors duration-200 flex items-center space-x-2">
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
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingConta ? 'Editar Conta' : 'Nova Conta'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-slate-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Nome da Conta
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Conta Corrente Principal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Banco
                  </label>
                  <select
                    required
                    value={formData.banco}
                    onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Tipo de Conta
                  </label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Poupança</option>
                    <option value="investimento">Investimento</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                      Agência
                    </label>
                    <input
                      type="text"
                      value={formData.agencia}
                      onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0001"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                      Número da Conta
                    </label>
                    <input
                      type="text"
                      value={formData.numero}
                      onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="12345-6"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Cor
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="color"
                      value={formData.cor}
                      onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                      className="w-12 h-10 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.cor}
                      onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="#1E40AF"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
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