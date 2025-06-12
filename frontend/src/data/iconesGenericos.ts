// Ícones Genéricos Variados para Transações
// Usando Lucide Icons para grande variedade de situações

export interface IconeGenerico {
  id: string;
  nome: string;
  categoria: 'casa' | 'transporte' | 'saude' | 'educacao' | 'lazer' | 'compras' | 'trabalho' | 'financeiro' | 'comida' | 'tecnologia' | 'outros';
  lucideIcon: string; // Nome do ícone no Lucide
  cor?: string;
}

export const ICONES_GENERICOS: IconeGenerico[] = [
  // Casa & Utilidades
  { id: 'energia-eletrica', nome: 'Energia Elétrica', categoria: 'casa', lucideIcon: 'Zap', cor: '#F59E0B' },
  { id: 'agua', nome: 'Água', categoria: 'casa', lucideIcon: 'Droplets', cor: '#3B82F6' },
  { id: 'gas', nome: 'Gás', categoria: 'casa', lucideIcon: 'Flame', cor: '#EF4444' },
  { id: 'internet', nome: 'Internet', categoria: 'casa', lucideIcon: 'Wifi', cor: '#8B5CF6' },
  { id: 'telefone', nome: 'Telefone', categoria: 'casa', lucideIcon: 'Phone', cor: '#10B981' },
  { id: 'aluguel', nome: 'Aluguel', categoria: 'casa', lucideIcon: 'Home', cor: '#6366F1' },
  { id: 'condominio', nome: 'Condomínio', categoria: 'casa', lucideIcon: 'Building', cor: '#64748B' },
  { id: 'limpeza', nome: 'Limpeza', categoria: 'casa', lucideIcon: 'Sparkles', cor: '#06B6D4' },
  { id: 'seguranca', nome: 'Segurança', categoria: 'casa', lucideIcon: 'Shield', cor: '#DC2626' },
  { id: 'manutencao', nome: 'Manutenção', categoria: 'casa', lucideIcon: 'Wrench', cor: '#92400E' },

  // Transporte
  { id: 'gasolina', nome: 'Gasolina', categoria: 'transporte', lucideIcon: 'Fuel', cor: '#EF4444' },
  { id: 'estacionamento', nome: 'Estacionamento', categoria: 'transporte', lucideIcon: 'ParkingCircle', cor: '#6B7280' },
  { id: 'pedagio', nome: 'Pedágio', categoria: 'transporte', lucideIcon: 'MapPin', cor: '#F97316' },
  { id: 'onibus', nome: 'Ônibus', categoria: 'transporte', lucideIcon: 'Bus', cor: '#059669' },
  { id: 'metro', nome: 'Metrô', categoria: 'transporte', lucideIcon: 'Train', cor: '#7C3AED' },
  { id: 'taxi', nome: 'Táxi', categoria: 'transporte', lucideIcon: 'Car', cor: '#FBBF24' },
  { id: 'aviao', nome: 'Avião', categoria: 'transporte', lucideIcon: 'Plane', cor: '#3B82F6' },
  { id: 'bike', nome: 'Bicicleta', categoria: 'transporte', lucideIcon: 'Bike', cor: '#10B981' },
  { id: 'manutencao-carro', nome: 'Manutenção Carro', categoria: 'transporte', lucideIcon: 'Settings', cor: '#6B7280' },

  // Saúde
  { id: 'farmacia', nome: 'Farmácia', categoria: 'saude', lucideIcon: 'Pill', cor: '#DC2626' },
  { id: 'medico', nome: 'Médico', categoria: 'saude', lucideIcon: 'Stethoscope', cor: '#059669' },
  { id: 'dentista', nome: 'Dentista', categoria: 'saude', lucideIcon: 'Smile', cor: '#0EA5E9' },
  { id: 'plano-saude', nome: 'Plano de Saúde', categoria: 'saude', lucideIcon: 'Heart', cor: '#EF4444' },
  { id: 'academia', nome: 'Academia', categoria: 'saude', lucideIcon: 'Dumbbell', cor: '#F97316' },
  { id: 'psicologia', nome: 'Psicologia', categoria: 'saude', lucideIcon: 'Brain', cor: '#8B5CF6' },
  { id: 'exames', nome: 'Exames', categoria: 'saude', lucideIcon: 'Activity', cor: '#06B6D4' },

  // Educação
  { id: 'escola', nome: 'Escola', categoria: 'educacao', lucideIcon: 'GraduationCap', cor: '#7C3AED' },
  { id: 'curso', nome: 'Curso', categoria: 'educacao', lucideIcon: 'BookOpen', cor: '#059669' },
  { id: 'material-escolar', nome: 'Material Escolar', categoria: 'educacao', lucideIcon: 'PenTool', cor: '#F59E0B' },
  { id: 'livros', nome: 'Livros', categoria: 'educacao', lucideIcon: 'Book', cor: '#8B5CF6' },
  { id: 'universidade', nome: 'Universidade', categoria: 'educacao', lucideIcon: 'School', cor: '#DC2626' },

  // Lazer & Entretenimento
  { id: 'cinema', nome: 'Cinema', categoria: 'lazer', lucideIcon: 'Film', cor: '#DC2626' },
  { id: 'teatro', nome: 'Teatro', categoria: 'lazer', lucideIcon: 'Drama', cor: '#7C3AED' },
  { id: 'show', nome: 'Show/Evento', categoria: 'lazer', lucideIcon: 'Music', cor: '#F59E0B' },
  { id: 'viagem', nome: 'Viagem', categoria: 'lazer', lucideIcon: 'MapPin', cor: '#0EA5E9' },
  { id: 'hotel', nome: 'Hotel', categoria: 'lazer', lucideIcon: 'Building2', cor: '#6366F1' },
  { id: 'parque', nome: 'Parque', categoria: 'lazer', lucideIcon: 'Trees', cor: '#059669' },
  { id: 'esporte', nome: 'Esporte', categoria: 'lazer', lucideIcon: 'Trophy', cor: '#F97316' },
  { id: 'jogo', nome: 'Jogos', categoria: 'lazer', lucideIcon: 'Gamepad2', cor: '#8B5CF6' },

  // Compras
  { id: 'supermercado', nome: 'Supermercado', categoria: 'compras', lucideIcon: 'ShoppingCart', cor: '#059669' },
  { id: 'farmacia-compra', nome: 'Farmácia', categoria: 'compras', lucideIcon: 'Cross', cor: '#DC2626' },
  { id: 'roupas', nome: 'Roupas', categoria: 'compras', lucideIcon: 'Shirt', cor: '#F59E0B' },
  { id: 'calcados', nome: 'Calçados', categoria: 'compras', lucideIcon: 'Footprints', cor: '#8B5CF6' },
  { id: 'eletronicos', nome: 'Eletrônicos', categoria: 'compras', lucideIcon: 'Smartphone', cor: '#6366F1' },
  { id: 'casa-decoracao', nome: 'Casa e Decoração', categoria: 'compras', lucideIcon: 'Sofa', cor: '#92400E' },
  { id: 'presente', nome: 'Presente', categoria: 'compras', lucideIcon: 'Gift', cor: '#EF4444' },
  { id: 'pet-shop', nome: 'Pet Shop', categoria: 'compras', lucideIcon: 'Dog', cor: '#F97316' },

  // Trabalho
  { id: 'salario', nome: 'Salário', categoria: 'trabalho', lucideIcon: 'Banknote', cor: '#059669' },
  { id: 'freelance', nome: 'Freelance', categoria: 'trabalho', lucideIcon: 'Briefcase', cor: '#8B5CF6' },
  { id: 'consultoria', nome: 'Consultoria', categoria: 'trabalho', lucideIcon: 'Users', cor: '#0EA5E9' },
  { id: 'bonus', nome: 'Bônus', categoria: 'trabalho', lucideIcon: 'Star', cor: '#F59E0B' },
  { id: 'equipamento-trabalho', nome: 'Equipamento', categoria: 'trabalho', lucideIcon: 'Monitor', cor: '#6B7280' },

  // Financeiro
  { id: 'investimento', nome: 'Investimento', categoria: 'financeiro', lucideIcon: 'TrendingUp', cor: '#059669' },
  { id: 'emprestimo', nome: 'Empréstimo', categoria: 'financeiro', lucideIcon: 'HandCoins', cor: '#DC2626' },
  { id: 'poupanca', nome: 'Poupança', categoria: 'financeiro', lucideIcon: 'PiggyBank', cor: '#F59E0B' },
  { id: 'seguro', nome: 'Seguro', categoria: 'financeiro', lucideIcon: 'Shield', cor: '#6366F1' },
  { id: 'taxa-bancaria', nome: 'Taxa Bancária', categoria: 'financeiro', lucideIcon: 'CreditCard', cor: '#EF4444' },
  { id: 'cambio', nome: 'Câmbio', categoria: 'financeiro', lucideIcon: 'ArrowRightLeft', cor: '#8B5CF6' },

  // Comida
  { id: 'restaurante', nome: 'Restaurante', categoria: 'comida', lucideIcon: 'UtensilsCrossed', cor: '#F97316' },
  { id: 'lanche', nome: 'Lanche', categoria: 'comida', lucideIcon: 'Cookie', cor: '#FBBF24' },
  { id: 'cafe', nome: 'Café', categoria: 'comida', lucideIcon: 'Coffee', cor: '#92400E' },
  { id: 'doce', nome: 'Doce', categoria: 'comida', lucideIcon: 'Cake', cor: '#EC4899' },
  { id: 'bebida', nome: 'Bebida', categoria: 'comida', lucideIcon: 'Wine', cor: '#7C3AED' },
  { id: 'churrasco', nome: 'Churrasco', categoria: 'comida', lucideIcon: 'Beef', cor: '#DC2626' },

  // Tecnologia
  { id: 'software', nome: 'Software', categoria: 'tecnologia', lucideIcon: 'Code', cor: '#6366F1' },
  { id: 'aplicativo', nome: 'Aplicativo', categoria: 'tecnologia', lucideIcon: 'Smartphone', cor: '#8B5CF6' },
  { id: 'cloud', nome: 'Cloud/Nuvem', categoria: 'tecnologia', lucideIcon: 'Cloud', cor: '#0EA5E9' },
  { id: 'dominio', nome: 'Domínio', categoria: 'tecnologia', lucideIcon: 'Globe', cor: '#059669' },
  { id: 'hosting', nome: 'Hospedagem', categoria: 'tecnologia', lucideIcon: 'Server', cor: '#6B7280' },
  { id: 'equipamento-tech', nome: 'Equipamento Tech', categoria: 'tecnologia', lucideIcon: 'Laptop', cor: '#374151' },

  // Outros
  { id: 'doacao', nome: 'Doação', categoria: 'outros', lucideIcon: 'Heart', cor: '#EF4444' },
  { id: 'multa', nome: 'Multa', categoria: 'outros', lucideIcon: 'AlertTriangle', cor: '#DC2626' },
  { id: 'imposto', nome: 'Imposto', categoria: 'outros', lucideIcon: 'Receipt', cor: '#6B7280' },
  { id: 'subscricao', nome: 'Assinatura', categoria: 'outros', lucideIcon: 'RefreshCw', cor: '#8B5CF6' },
  { id: 'cartorio', nome: 'Cartório', categoria: 'outros', lucideIcon: 'FileText', cor: '#92400E' },
  { id: 'advocacia', nome: 'Advocacia', categoria: 'outros', lucideIcon: 'Scale', cor: '#374151' },
  { id: 'contabilidade', nome: 'Contabilidade', categoria: 'outros', lucideIcon: 'Calculator', cor: '#059669' },
  { id: 'correios', nome: 'Correios', categoria: 'outros', lucideIcon: 'Package', cor: '#F59E0B' },
  { id: 'religiao', nome: 'Religião', categoria: 'outros', lucideIcon: 'Church', cor: '#7C3AED' },
  { id: 'funeral', nome: 'Funeral', categoria: 'outros', lucideIcon: 'Flower', cor: '#6B7280' }
];

export const ICONES_GENERICOS_POR_CATEGORIA = {
  casa: ICONES_GENERICOS.filter(icone => icone.categoria === 'casa'),
  transporte: ICONES_GENERICOS.filter(icone => icone.categoria === 'transporte'),
  saude: ICONES_GENERICOS.filter(icone => icone.categoria === 'saude'),
  educacao: ICONES_GENERICOS.filter(icone => icone.categoria === 'educacao'),
  lazer: ICONES_GENERICOS.filter(icone => icone.categoria === 'lazer'),
  compras: ICONES_GENERICOS.filter(icone => icone.categoria === 'compras'),
  trabalho: ICONES_GENERICOS.filter(icone => icone.categoria === 'trabalho'),
  financeiro: ICONES_GENERICOS.filter(icone => icone.categoria === 'financeiro'),
  comida: ICONES_GENERICOS.filter(icone => icone.categoria === 'comida'),
  tecnologia: ICONES_GENERICOS.filter(icone => icone.categoria === 'tecnologia'),
  outros: ICONES_GENERICOS.filter(icone => icone.categoria === 'outros'),
};

export const getIconeGenerico = (id: string): IconeGenerico | null => {
  return ICONES_GENERICOS.find(icone => icone.id === id) || null;
}; 