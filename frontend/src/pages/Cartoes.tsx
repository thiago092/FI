import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import CompraParceladaModal from '../components/CompraParceladaModal';
import { cartoesApi } from '../services/api';
import { Plus, CreditCard, Calendar, TrendingUp, Package, ChevronRight } from 'lucide-react';

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
  numero_final?: string;
  limite: number;
  vencimento: number;
  cor: string;
  ativo: boolean;
  fatura?: FaturaInfo;
}

interface CompraParcelada {
  id: number;
  descricao: string;
  valor_total: number;
  numero_parcelas: number;
  valor_parcela: number;
  parcelas_pagas: number;
  categoria_nome: string;
  cartao_nome: string;
  status: string;
  data_compra: string;
  progresso: number;
}

export default function Cartoes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [comprasParceladas, setComprasParceladas] = useState<CompraParcelada[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showParceladaModal, setShowParceladaModal] = useState(false);
  const [editingCartao, setEditingCartao] = useState<Cartao | null>(null);
  const [selectedCartao, setSelectedCartao] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    bandeira: 'Visa',
    numero_final: '',
    limite: 0,
    vencimento: 1,
    cor: '#1E40AF',
    ativo: true
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

  // Carregar cartões do backend
  useEffect(() => {
    loadCartoes();
    loadComprasParceladas();
  }, []);

  const loadCartoes = async () => {
    try {
      setIsLoading(true);
      const data = await cartoesApi.getAllComFatura(); // Usar nova API com fatura
      setCartoes(data);
    } catch (error: any) {
      setError('Erro ao carregar cartões');
      console.error('Erro ao carregar cartões:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadComprasParceladas = async () => {
    try {
      const response = await fetch('/api/cartoes-parcelados/listar', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setComprasParceladas(data);
      }
    } catch (error) {
      console.error('Erro ao carregar compras parceladas:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCartao) {
        await cartoesApi.update(editingCartao.id, formData);
      } else {
        await cartoesApi.create(formData);
      }
      
      await loadCartoes(); // Recarregar dados
      setShowModal(false);
      setEditingCartao(null);
      setFormData({
        nome: '',
        bandeira: 'Visa',
        numero_final: '',
        limite: 0,
        vencimento: 1,
        cor: '#1E40AF',
        ativo: true
      });
    } catch (error: any) {
      setError('Erro ao salvar cartão');
      console.error('Erro ao salvar cartão:', error);
    }
  };

  const handleEdit = (cartao: Cartao) => {
    setEditingCartao(cartao);
    setFormData({
      nome: cartao.nome,
      bandeira: cartao.bandeira,
      numero_final: cartao.numero_final || '',
      limite: cartao.limite,
      vencimento: cartao.vencimento,
      cor: cartao.cor,
      ativo: cartao.ativo
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este cartão?')) {
      try {
        await cartoesApi.delete(id);
        await loadCartoes(); // Recarregar dados
      } catch (error: any) {
        setError('Erro ao excluir cartão');
        console.error('Erro ao excluir cartão:', error);
      }
    }
  };

  const openCreateModal = () => {
    setEditingCartao(null);
    setFormData({
      nome: '',
      bandeira: 'Visa',
      numero_final: '',
      limite: 0,
      vencimento: 1,
      cor: '#1E40AF',
      ativo: true
    });
    setShowModal(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <Navigation user={user} />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Carregando cartões...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalLimite = cartoes.reduce((sum, cartao) => sum + cartao.limite, 0);
  const totalFaturaAtual = cartoes.reduce((sum, cartao) => sum + (cartao.fatura?.valor_atual || 0), 0);
  const limiteDisponivel = totalLimite - totalFaturaAtual;
  const percentualDisponivel = totalLimite > 0 ? Math.floor((limiteDisponivel / totalLimite) * 100) : 0;

  return (
    <div className="min-h-screen-mobile bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Navigation user={user} />

      <div className="container-mobile pb-safe">
        {/* Page Header */}
        <div className="py-6 lg:py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-responsive-heading text-slate-900">Cartões</h1>
                <p className="text-slate-600 text-sm sm:text-base">Gerencie seus cartões de crédito e compras parceladas</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button 
                onClick={() => setShowParceladaModal(true)}
                className="btn-touch bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 flex items-center space-x-2"
              >
                <Package className="w-5 h-5" />
                <span>Parcelar Compra</span>
              </button>
              <button 
                onClick={() => setShowModal(true)}
                className="btn-touch bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Novo Cartão</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card-mobile text-center">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{cartoes.length}</h3>
            <p className="text-sm text-slate-600">Cartões Ativos</p>
          </div>
          
          <div className="card-mobile text-center">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              R$ {limiteDisponivel.toLocaleString()}
            </h3>
            <p className="text-sm text-slate-600">Limite Disponível</p>
          </div>

          <div className="card-mobile text-center">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{comprasParceladas.length}</h3>
            <p className="text-sm text-slate-600">Compras Parceladas</p>
          </div>

          <div className="card-mobile text-center">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              R$ {comprasParceladas.reduce((sum, c) => sum + c.valor_parcela, 0).toLocaleString()}
            </h3>
            <p className="text-sm text-slate-600">Parcelas/Mês</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Cartões Section */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <CreditCard className="w-5 h-5" />
              <span>Meus Cartões</span>
            </h2>
            
            {/* Existing cartões rendering logic */}
            {/* ... */}
          </div>

          {/* Compras Parceladas Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <Package className="w-5 h-5" />
                <span>Compras Parceladas</span>
              </h2>
              <button 
                onClick={() => setShowParceladaModal(true)}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Nova</span>
              </button>
            </div>

            <div className="space-y-4">
              {comprasParceladas.length > 0 ? (
                comprasParceladas.map((compra) => (
                  <div key={compra.id} className="card-mobile hover:shadow-md transition-all duration-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">{compra.descricao}</h3>
                        <p className="text-sm text-slate-500">{compra.cartao_nome} • {compra.categoria_nome}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        compra.status === 'ATIVA' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {compra.status}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-600">
                            {compra.parcelas_pagas}/{compra.numero_parcelas} parcelas pagas
                          </span>
                          <span className="font-medium text-slate-900">{compra.progresso}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${compra.progresso}%` }}
                          />
                        </div>
                      </div>

                      {/* Values */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-slate-500">Total</p>
                          <p className="font-semibold text-slate-900">R$ {compra.valor_total.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Parcela</p>
                          <p className="font-semibold text-slate-900">R$ {compra.valor_parcela.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Restam</p>
                          <p className="font-semibold text-blue-600">{compra.numero_parcelas - compra.parcelas_pagas}</p>
                        </div>
                      </div>

                      {/* Action Button */}
                      <button 
                        onClick={() => {/* Ver detalhes */}}
                        className="w-full flex items-center justify-center space-x-2 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <span className="text-sm font-medium">Ver Detalhes</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="card-mobile text-center py-12">
                  <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhuma compra parcelada</h3>
                  <p className="text-slate-500 mb-6">Comece parcelando uma compra no cartão</p>
                  <button 
                    onClick={() => setShowParceladaModal(true)}
                    className="btn-touch bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Parcelar Primeira Compra
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal para Compra Parcelada */}
      {showParceladaModal && (
        <CompraParceladaModal 
          onClose={() => setShowParceladaModal(false)}
          onSuccess={() => {
            setShowParceladaModal(false);
            loadComprasParceladas();
          }}
          cartoes={cartoes}
        />
      )}

      {/* Existing modals */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingCartao ? 'Editar Cartão' : 'Novo Cartão'}
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
                    Nome do Cartão
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Nubank Roxinho"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bandeira
                  </label>
                  <select
                    value={formData.bandeira}
                    onChange={(e) => setFormData({ ...formData, bandeira: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="Elo">Elo</option>
                    <option value="American Express">American Express</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número Final (últimos 4 dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formData.numero_final}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                      setFormData({ ...formData, numero_final: value });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="1234"
                  />
                  <p className="text-xs text-slate-500 mt-1">Apenas os últimos 4 dígitos do cartão</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Limite
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.limite}
                    onChange={(e) => setFormData({ ...formData, limite: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Dia do Vencimento
                  </label>
                  <select
                    value={formData.vencimento}
                    onChange={(e) => setFormData({ ...formData, vencimento: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        Dia {day}
                      </option>
                    ))}
                  </select>
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

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="ativo" className="text-sm font-medium text-slate-700">
                    Cartão ativo
                  </label>
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
                    {editingCartao ? 'Atualizar' : 'Criar'}
                  </button>
                  {editingCartao && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingCartao.id)}
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