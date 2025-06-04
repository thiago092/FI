import React, { useState, useEffect } from 'react';
import { X, Package, CreditCard, Calendar, DollarSign } from 'lucide-react';

interface Cartao {
  id: number;
  nome: string;
  bandeira: string;
  cor: string;
}

interface Categoria {
  id: number;
  nome: string;
  icone: string;
}

interface CompraParceladaModalProps {
  onClose: () => void;
  onSuccess: () => void;
  cartoes: Cartao[];
}

export default function CompraParceladaModal({ onClose, onSuccess, cartoes }: CompraParceladaModalProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [formData, setFormData] = useState({
    descricao: '',
    valor_total: '',
    numero_parcelas: '12',
    categoria_id: '',
    cartao_id: '',
    data_compra: new Date().toISOString().split('T')[0]
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Calcular valor da parcela
  const valorParcela = formData.valor_total && formData.numero_parcelas 
    ? (parseFloat(formData.valor_total) / parseInt(formData.numero_parcelas))
    : 0;

  useEffect(() => {
    loadCategorias();
  }, []);

  const loadCategorias = async () => {
    try {
      const response = await fetch('/api/categorias', {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/cartoes-parcelados/criar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          valor_total: parseFloat(formData.valor_total),
          numero_parcelas: parseInt(formData.numero_parcelas),
          categoria_id: parseInt(formData.categoria_id),
          cartao_id: parseInt(formData.cartao_id)
        })
      });

      if (response.ok) {
        onSuccess();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Erro ao criar compra parcelada');
      }
    } catch (error) {
      setError('Erro de conexão. Tente novamente.');
      console.error('Erro:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Parcelar Compra</h2>
              <p className="text-sm text-slate-500">Divida sua compra em parcelas no cartão</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Descrição da Compra
            </label>
            <input
              type="text"
              name="descricao"
              value={formData.descricao}
              onChange={handleChange}
              placeholder="Ex: TV Samsung 55 polegadas"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Valor Total */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Valor Total
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="number"
                name="valor_total"
                value={formData.valor_total}
                onChange={handleChange}
                placeholder="0,00"
                step="0.01"
                min="0"
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Grid: Parcelas e Valor da Parcela */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Parcelas
              </label>
              <select
                name="numero_parcelas"
                value={formData.numero_parcelas}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {[2,3,4,5,6,7,8,9,10,11,12,15,18,24].map(num => (
                  <option key={num} value={num}>{num}x</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Valor da Parcela
              </label>
              <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium">
                R$ {valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Cartão */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Cartão de Crédito
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                name="cartao_id"
                value={formData.cartao_id}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                required
              >
                <option value="">Selecione um cartão</option>
                {cartoes.map(cartao => (
                  <option key={cartao.id} value={cartao.id}>
                    {cartao.nome} - {cartao.bandeira}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Categoria
            </label>
            <select
              name="categoria_id"
              value={formData.categoria_id}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Selecione uma categoria</option>
              {categorias.map(categoria => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.icone} {categoria.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Data da Compra */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Data da Compra
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="date"
                name="data_compra"
                value={formData.data_compra}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Preview das Parcelas */}
          {formData.valor_total && formData.numero_parcelas && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-medium text-blue-900 mb-2">Preview das Parcelas</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• {formData.numero_parcelas} parcelas de R$ {valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p>• Primeira parcela: {new Date(formData.data_compra).toLocaleDateString('pt-BR')}</p>
                <p>• Última parcela: {new Date(new Date(formData.data_compra).setMonth(new Date(formData.data_compra).getMonth() + parseInt(formData.numero_parcelas) - 1)).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <Package className="w-5 h-5" />
                  <span>Parcelar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 