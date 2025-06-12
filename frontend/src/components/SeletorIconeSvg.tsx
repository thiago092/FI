import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { SVG_LOGOS, SVG_LOGOS_POR_CATEGORIA, SvgLogo } from '../data/svgLogos';
import SvgLogoIcon from './SvgLogoIcon';

interface SeletorIconeSvgProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (logoId: string) => void;
  iconeAtual?: string;
}

const SeletorIconeSvg: React.FC<SeletorIconeSvgProps> = ({
  isOpen,
  onClose,
  onSelect,
  iconeAtual
}) => {
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('streaming');
  const [busca, setBusca] = useState('');

  // Filtrar logos por busca
  const logosFiltrados = busca
    ? SVG_LOGOS.filter(logo => 
        logo.nome.toLowerCase().includes(busca.toLowerCase())
      )
    : SVG_LOGOS_POR_CATEGORIA[categoriaAtiva as keyof typeof SVG_LOGOS_POR_CATEGORIA] || [];

  const categorias = [
    { id: 'streaming', nome: 'Streaming', emoji: '📺' },
    { id: 'delivery', nome: 'Delivery', emoji: '🛵' },
    { id: 'tecnologia', nome: 'Tecnologia', emoji: '💻' },
    { id: 'utilidades', nome: 'Utilidades', emoji: '🔧' },
    { id: 'financeiro', nome: 'Financeiro', emoji: '💳' },
    { id: 'transporte', nome: 'Transporte', emoji: '🚗' },
    { id: 'outros', nome: 'Outros', emoji: '📦' }
  ];

  const handleSelect = (logoId: string) => {
    onSelect(logoId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Escolher Ícone Personalizado</h2>
            <p className="text-sm text-gray-600 mt-1">Selecione um logo real do serviço</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Busca */}
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar serviço..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex">
          {/* Categorias - Sidebar */}
          {!busca && (
            <div className="w-64 bg-gray-50 border-r border-gray-200 max-h-[60vh] overflow-y-auto">
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Categorias</h3>
                <div className="space-y-1">
                  {categorias.map((categoria) => (
                    <button
                      key={categoria.id}
                      onClick={() => setCategoriaAtiva(categoria.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        categoriaAtiva === categoria.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="text-lg">{categoria.emoji}</span>
                      <span className="text-sm font-medium">{categoria.nome}</span>
                      <span className="ml-auto text-xs text-gray-500">
                        {SVG_LOGOS_POR_CATEGORIA[categoria.id as keyof typeof SVG_LOGOS_POR_CATEGORIA]?.length || 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Grid de Logos */}
          <div className="flex-1 max-h-[60vh] overflow-y-auto">
            <div className="p-6">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                {logosFiltrados.map((logo) => (
                  <button
                    key={logo.id}
                    onClick={() => handleSelect(logo.id)}
                    className={`group relative flex flex-col items-center p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                      iconeAtual === logo.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    title={logo.nome}
                  >
                    <div className="w-12 h-12 flex items-center justify-center mb-2">
                      <SvgLogoIcon logoId={logo.id} size={32} />
                    </div>
                    <span className="text-xs text-gray-600 text-center leading-tight truncate w-full">
                      {logo.nome}
                    </span>
                    
                    {/* Indicador de selecionado */}
                    {iconeAtual === logo.id && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {logosFiltrados.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-lg mb-2">🔍</div>
                  <p className="text-gray-600">
                    {busca ? 'Nenhum serviço encontrado' : 'Nenhum logo disponível nesta categoria'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Logos reais de serviços populares • CC0 License
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeletorIconeSvg; 