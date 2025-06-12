import React from 'react';
import { getIconeGenerico } from '../data/iconesGenericos';
import * as LucideIcons from 'lucide-react';

interface IconeGenericoComponentProps {
  iconeId: string;
  size?: number;
  className?: string;
}

const IconeGenericoComponent: React.FC<IconeGenericoComponentProps> = ({ 
  iconeId, 
  size = 24, 
  className = '' 
}) => {
  const icone = getIconeGenerico(iconeId);
  
  if (!icone) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-200 rounded ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-gray-500 text-xs">?</span>
      </div>
    );
  }

  // Obter o componente do ícone dinamicamente
  const IconComponent = (LucideIcons as any)[icone.lucideIcon];
  
  if (!IconComponent) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-200 rounded ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-gray-500 text-xs">?</span>
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <IconComponent 
        size={size} 
        color={icone.cor} 
        className="flex-shrink-0"
      />
    </div>
  );
};

export default IconeGenericoComponent; 