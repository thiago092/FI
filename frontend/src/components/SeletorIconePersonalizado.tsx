import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { 
  ICONES_PERSONALIZADOS, 
  CATEGORIAS_ICONES, 
  getIconePersonalizado, 
  type IconePersonalizado 
} from '../data/iconesPersonalizados';

interface SeletorIconePersonalizadoProps {
  iconeAtual?: string;
  onSelect: (icone: string | null) => void;
  isOpen: boolean;
  onClose: () => void;
}

const SeletorIconePersonalizado: React.FC<SeletorIconePersonalizadoProps> = ({
  iconeAtual,
  onSelect,
  isOpen,
  onClose
}) => {
  const [categoriaAtiva, setCategoriaAtiva] = useState('streaming');
  const [busca, setBusca] = useState('');

  if (!isOpen) return null;

  // Filtrar ícones baseado na busca
  const iconesFiltrados = ICONES_PERSONALIZADOS.filter(icone => {
    const matchCategoria = categoriaAtiva === 'todos' || icone.categoria === categoriaAtiva;
    const matchBusca = busca === '' || 
      icone.nome.toLowerCase().includes(busca.toLowerCase()) ||
      icone.id.toLowerCase().includes(busca.toLowerCase());
    
    return matchCategoria && matchBusca;
  });

  const iconeSelecionado = iconeAtual ? getIconePersonalizado(iconeAtual) : null;

  const handleSelect = (icone: IconePersonalizado | null) => {
    onSelect(icone?.id || null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2 shadow-lg rounded-2xl bg-white max-h-[80vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Escolher Ícone Personalizado
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar serviço..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Ícone Atual e Opção de Remover */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">Atual:</span>
              {iconeSelecionado ? (
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{iconeSelecionado.emoji}</span>
                  <span className="text-sm text-gray-600">{iconeSelecionado.nome}</span>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Usando ícone da categoria</span>
              )}
            </div>
            <button
              onClick={() => handleSelect(null)}
              className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Usar categoria
            </button>
          </div>
        </div>

        {/* Abas de Categorias */}
        <div className="flex space-x-1 mb-4 overflow-x-auto">
          <button
            onClick={() => setCategoriaAtiva('todos')}
            className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              categoriaAtiva === 'todos'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📋 Todos
          </button>
          {CATEGORIAS_ICONES.map(categoria => (
            <button
              key={categoria.id}
              onClick={() => setCategoriaAtiva(categoria.id)}
              className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                categoriaAtiva === categoria.id
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {categoria.icone} {categoria.nome}
            </button>
          ))}
        </div>

        {/* Grade de Ícones */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {iconesFiltrados.map(icone => (
              <button
                key={icone.id}
                onClick={() => handleSelect(icone)}
                className={`p-3 rounded-lg border transition-all duration-200 flex flex-col items-center space-y-1 hover:shadow-md ${
                  iconeAtual === icone.id
                    ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                title={icone.nome}
              >
                <span className="text-2xl mb-1">{icone.emoji}</span>
                <span className="text-xs text-gray-600 text-center leading-tight">
                  {icone.nome}
                </span>
              </button>
            ))}
          </div>
          
          {iconesFiltrados.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum ícone encontrado</p>
              <p className="text-sm">Tente ajustar sua busca</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            💡 Escolha um ícone que represente melhor sua transação recorrente
          </p>
        </div>
      </div>
    </div>
  );
};

export default SeletorIconePersonalizado; 