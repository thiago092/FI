import React, { useState, useEffect } from 'react';
import { X, CreditCard, Calendar, ShoppingCart, DollarSign, AlertCircle, Info } from 'lucide-react';

interface CompraParceladaModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (dados: CompraParceladaData) => Promise<void>;
  cartoes: Array<{ id: number; nome: string; cor: string }>;
  categorias: Array<{ id: number; nome: string; icone: string; cor: string }>;
  dadosIniciais?: {
    descricao?: string;
    valorTotal?: number;
    totalParcelas?: number;
    valorParcela?: number;
  };
}

interface CompraParceladaData {
  descricao: string;
  valor_total: number;
  total_parcelas: number;
  cartao_id: number;
  data_primeira_parcela: Date;
  categoria_id: number;
}

// Funções utilitárias para formatação
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const parseCurrency = (value: string): number | null => {
  const cleanValue = value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const numValue = parseFloat(cleanValue);
  return isNaN(numValue) ? null : numValue;
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('pt-BR');
};

export default function CompraParceladaModal({ 
  open, 
  onClose, 
  onSubmit, 
  cartoes, 
  categorias,
  dadosIniciais 
}: CompraParceladaModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados do formulário
  const [descricao, setDescricao] = useState('');
  const [valorTotal, setValorTotal] = useState<number | null>(null);
  const [totalParcelas, setTotalParcelas] = useState<number | null>(null);
  const [cartaoId, setCartaoId] = useState<number | null>(null);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // Estados calculados
  const [valorParcela, setValorParcela] = useState<number | null>(null);
  const [previewParcelas, setPreviewParcelas] = useState<Array<{ numero: number; data: Date; valor: number }>>([]);

  // Inicializar com dados se fornecidos
  useEffect(() => {
    if (dadosIniciais && open) {
      setDescricao(dadosIniciais.descricao || '');
      setValorTotal(dadosIniciais.valorTotal || null);
      setTotalParcelas(dadosIniciais.totalParcelas || null);
      
      // Se tem valor da parcela, calcular valor total
      if (dadosIniciais.valorParcela && dadosIniciais.totalParcelas) {
        const total = dadosIniciais.valorParcela * dadosIniciais.totalParcelas;
        setValorTotal(total);
      }
    }
  }, [dadosIniciais, open]);

  // Calcular valor da parcela quando total ou quantidade mudar
  useEffect(() => {
    if (valorTotal && totalParcelas && totalParcelas > 0) {
      const parcela = valorTotal / totalParcelas;
      setValorParcela(parcela);
    } else {
      setValorParcela(null);
    }
  }, [valorTotal, totalParcelas]);

  // Gerar preview das parcelas
  useEffect(() => {
    if (valorParcela && totalParcelas && dataPrimeiraParcela) {
      const parcelas = [];
      const baseDate = new Date(dataPrimeiraParcela + 'T00:00:00');
      
      for (let i = 0; i < totalParcelas; i++) {
        const data = new Date(baseDate);
        data.setMonth(data.getMonth() + i);
        parcelas.push({
          numero: i + 1,
          data,
          valor: valorParcela
        });
      }
      setPreviewParcelas(parcelas);
    } else {
      setPreviewParcelas([]);
    }
  }, [valorParcela, totalParcelas, dataPrimeiraParcela]);

  const handleReset = () => {
    setDescricao('');
    setValorTotal(null);
    setTotalParcelas(null);
    setCartaoId(null);
    setCategoriaId(null);
    setDataPrimeiraParcela(new Date().toISOString().split('T')[0]);
    setValorParcela(null);
    setPreviewParcelas([]);
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);

    // Validações
    if (!descricao.trim()) {
      setError('Descrição é obrigatória');
      return;
    }
    
    if (!valorTotal || valorTotal <= 0) {
      setError('Valor total deve ser maior que zero');
      return;
    }
    
    if (!totalParcelas || totalParcelas < 1 || totalParcelas > 48) {
      setError('Número de parcelas deve ser entre 1 e 48');
      return;
    }
    
    if (!cartaoId) {
      setError('Selecione um cartão');
      return;
    }
    
    if (!categoriaId) {
      setError('Selecione uma categoria');
      return;
    }

    try {
      setLoading(true);
      
      const dados: CompraParceladaData = {
        descricao: descricao.trim(),
        valor_total: valorTotal,
        total_parcelas: totalParcelas,
        cartao_id: cartaoId,
        data_primeira_parcela: new Date(dataPrimeiraParcela + 'T00:00:00'),
        categoria_id: categoriaId
      };
      
      await onSubmit(dados);
      handleClose();
      
    } catch (err: any) {
      setError(err.message || 'Erro ao criar compra parcelada');
    } finally {
      setLoading(false);
    }
  };

  const cartaoSelecionado = cartoes.find(c => c.id === cartaoId);
  const categoriaSelecionada = categorias.find(c => c.id === categoriaId);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">Nova Compra Parcelada</h2>
                <p className="text-purple-100 text-sm">
                  Registre compras parceladas e acompanhe automaticamente as prestações
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-purple-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          <div className="space-y-6">
            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <ShoppingCart className="w-4 h-4 inline mr-1" />
                Descrição da compra
              </label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: iPhone 15 Pro, Geladeira Brastemp..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Valor Total e Parcelas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Valor Total
                </label>
                <input
                  type="text"
                  value={valorTotal ? formatCurrency(valorTotal) : ''}
                  onChange={(e) => {
                    const value = parseCurrency(e.target.value);
                    setValorTotal(value);
                  }}
                  placeholder="R$ 0,00"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Parcelas
                </label>
                <input
                  type="number"
                  value={totalParcelas || ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    setTotalParcelas(isNaN(value) ? null : value);
                  }}
                  placeholder="12"
                  min="1"
                  max="48"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Valor da Parcela Calculado */}
            {valorParcela && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-800">
                  <Info className="w-5 h-5" />
                  <span className="font-medium">
                    Valor de cada parcela: {formatCurrency(valorParcela)}
                  </span>
                </div>
              </div>
            )}

            {/* Cartão e Categoria */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <CreditCard className="w-4 h-4 inline mr-1" />
                  Cartão
                </label>
                <select
                  value={cartaoId || ''}
                  onChange={(e) => setCartaoId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Selecione um cartão</option>
                  {cartoes.map((cartao) => (
                    <option key={cartao.id} value={cartao.id}>
                      {cartao.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria
                </label>
                <select
                  value={categoriaId || ''}
                  onChange={(e) => setCategoriaId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Selecione uma categoria</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.icone} {categoria.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Data da Primeira Parcela */}
            <div className="md:w-1/2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data da 1ª Parcela
              </label>
              <input
                type="date"
                value={dataPrimeiraParcela}
                onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Preview das Parcelas */}
            {previewParcelas.length > 0 && (
              <div>
                <hr className="my-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  📅 Preview das Parcelas
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {previewParcelas.slice(0, 6).map((parcela) => (
                    <div
                      key={parcela.numero}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {parcela.numero}/{totalParcelas}
                      </div>
                      <div className="text-sm text-purple-600 font-medium">
                        {formatCurrency(parcela.valor)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(parcela.data)}
                      </div>
                    </div>
                  ))}
                  {previewParcelas.length > 6 && (
                    <div className="col-span-full text-center text-sm text-gray-500 italic">
                      ... e mais {previewParcelas.length - 6} parcelas
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resumo */}
            {cartaoSelecionado && categoriaSelecionada && valorTotal && totalParcelas && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  📋 Resumo:
                </h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>• <strong>Compra:</strong> {descricao || 'Não informado'}</div>
                  <div>
                    • <strong>Total:</strong> {formatCurrency(valorTotal)} em {totalParcelas}x de {valorParcela ? formatCurrency(valorParcela) : ''}
                  </div>
                  <div>• <strong>Cartão:</strong> {cartaoSelecionado.nome}</div>
                  <div>• <strong>Categoria:</strong> {categoriaSelecionada.icone} {categoriaSelecionada.nome}</div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !descricao || !valorTotal || !totalParcelas || !cartaoId || !categoriaId}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Criando...' : 'Criar Parcelamento'}
          </button>
        </div>
      </div>
    </div>
  );
} 