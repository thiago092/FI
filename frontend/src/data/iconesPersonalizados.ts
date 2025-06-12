export interface IconePersonalizado {
  id: string;
  nome: string;
  emoji: string;
  categoria: 'streaming' | 'delivery' | 'transporte' | 'utilidades' | 'fitness' | 'financeiro' | 'outros';
  cor?: string;
}

export const ICONES_PERSONALIZADOS: IconePersonalizado[] = [
  // Streaming
  { id: 'netflix', nome: 'Netflix', emoji: '🎬', categoria: 'streaming', cor: '#E50914' },
  { id: 'spotify', nome: 'Spotify', emoji: '🎵', categoria: 'streaming', cor: '#1DB954' },
  { id: 'youtube', nome: 'YouTube Premium', emoji: '📺', categoria: 'streaming', cor: '#FF0000' },
  { id: 'disney', nome: 'Disney+', emoji: '🏰', categoria: 'streaming', cor: '#113CCF' },
  { id: 'amazon-prime', nome: 'Amazon Prime', emoji: '📦', categoria: 'streaming', cor: '#00A8E1' },
  { id: 'max', nome: 'Max (HBO)', emoji: '🎭', categoria: 'streaming', cor: '#7B2CBF' },
  { id: 'paramount', nome: 'Paramount+', emoji: '⭐', categoria: 'streaming', cor: '#0066CC' },
  { id: 'apple-tv', nome: 'Apple TV+', emoji: '📱', categoria: 'streaming', cor: '#000000' },
  { id: 'globoplay', nome: 'Globoplay', emoji: '🌍', categoria: 'streaming', cor: '#F72C2C' },
  { id: 'crunchyroll', nome: 'Crunchyroll', emoji: '🍙', categoria: 'streaming', cor: '#F47521' },

  // Delivery & Food
  { id: 'ifood', nome: 'iFood', emoji: '🍔', categoria: 'delivery', cor: '#EA1D2C' },
  { id: 'uber-eats', nome: 'Uber Eats', emoji: '🚗', categoria: 'delivery', cor: '#05A357' },
  { id: 'rappi', nome: 'Rappi', emoji: '🛵', categoria: 'delivery', cor: '#FF441F' },
  { id: 'delivery-much', nome: 'Delivery Much', emoji: '🥘', categoria: 'delivery', cor: '#FF6B35' },

  // Transporte
  { id: 'uber', nome: 'Uber', emoji: '🚕', categoria: 'transporte', cor: '#000000' },
  { id: '99', nome: '99', emoji: '🚖', categoria: 'transporte', cor: '#FFD320' },
  { id: 'metro', nome: 'Metrô/Transporte', emoji: '🚇', categoria: 'transporte', cor: '#0066CC' },
  { id: 'combustivel', nome: 'Combustível', emoji: '⛽', categoria: 'transporte', cor: '#FF6B35' },

  // Utilidades & Contas
  { id: 'energia', nome: 'Energia Elétrica', emoji: '⚡', categoria: 'utilidades', cor: '#FFC107' },
  { id: 'agua', nome: 'Água', emoji: '💧', categoria: 'utilidades', cor: '#2196F3' },
  { id: 'gas', nome: 'Gás', emoji: '🔥', categoria: 'utilidades', cor: '#FF5722' },
  { id: 'internet', nome: 'Internet', emoji: '🌐', categoria: 'utilidades', cor: '#9C27B0' },
  { id: 'telefone', nome: 'Telefone', emoji: '📞', categoria: 'utilidades', cor: '#607D8B' },
  { id: 'tv-cabo', nome: 'TV a Cabo', emoji: '📡', categoria: 'utilidades', cor: '#795548' },

  // Fitness & Saúde
  { id: 'academia', nome: 'Academia', emoji: '💪', categoria: 'fitness', cor: '#4CAF50' },
  { id: 'personal', nome: 'Personal Trainer', emoji: '🏃', categoria: 'fitness', cor: '#FF9800' },
  { id: 'plano-saude', nome: 'Plano de Saúde', emoji: '🏥', categoria: 'fitness', cor: '#2196F3' },
  { id: 'farmacia', nome: 'Farmácia/Remédios', emoji: '💊', categoria: 'fitness', cor: '#4CAF50' },

  // Financeiro
  { id: 'banco', nome: 'Taxa Bancária', emoji: '🏦', categoria: 'financeiro', cor: '#607D8B' },
  { id: 'cartao', nome: 'Anuidade Cartão', emoji: '💳', categoria: 'financeiro', cor: '#FF9800' },
  { id: 'seguro', nome: 'Seguro', emoji: '🛡️', categoria: 'financeiro', cor: '#795548' },
  { id: 'investimento', nome: 'Investimento', emoji: '📈', categoria: 'financeiro', cor: '#4CAF50' },

  // Outros
  { id: 'salario', nome: 'Salário', emoji: '💰', categoria: 'outros', cor: '#4CAF50' },
  { id: 'freelance', nome: 'Freelance', emoji: '💻', categoria: 'outros', cor: '#9C27B0' },
  { id: 'aluguel', nome: 'Aluguel', emoji: '🏠', categoria: 'outros', cor: '#795548' },
  { id: 'condominio', nome: 'Condomínio', emoji: '🏢', categoria: 'outros', cor: '#607D8B' },
  { id: 'educacao', nome: 'Educação', emoji: '📚', categoria: 'outros', cor: '#2196F3' },
  { id: 'pets', nome: 'Pet Shop', emoji: '🐕', categoria: 'outros', cor: '#FF5722' },
  { id: 'supermercado', nome: 'Supermercado', emoji: '🛒', categoria: 'outros', cor: '#4CAF50' },
];

export const CATEGORIAS_ICONES = [
  { id: 'streaming', nome: 'Streaming', icone: '🎬' },
  { id: 'delivery', nome: 'Delivery', icone: '🍔' },
  { id: 'transporte', nome: 'Transporte', icone: '🚗' },
  { id: 'utilidades', nome: 'Utilidades', icone: '⚡' },
  { id: 'fitness', nome: 'Fitness & Saúde', icone: '💪' },
  { id: 'financeiro', nome: 'Financeiro', icone: '💳' },
  { id: 'outros', nome: 'Outros', icone: '📋' },
];

export const getIconePersonalizado = (id: string): IconePersonalizado | null => {
  return ICONES_PERSONALIZADOS.find(icone => icone.id === id) || null;
};

export const getIconesPorCategoria = (categoria: string): IconePersonalizado[] => {
  return ICONES_PERSONALIZADOS.filter(icone => icone.categoria === categoria);
}; 