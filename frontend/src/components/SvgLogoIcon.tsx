import React from 'react';
import { getSvgLogo } from '../data/svgLogos';

interface SvgLogoIconProps {
  logoId: string;
  size?: number;
  className?: string;
}

const SvgLogoIcon: React.FC<SvgLogoIconProps> = ({ logoId, size = 24, className = '' }) => {
  const logo = getSvgLogo(logoId);
  
  if (!logo) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-200 rounded ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-gray-500 text-xs">?</span>
      </div>
    );
  }

  // Renderizar SVG inline com tamanho personalizado
  const svgWithSize = logo.svg.replace(
    '<svg',
    `<svg width="${size}" height="${size}" className="${className}"`
  );

  return (
    <div 
      className={`flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgWithSize }}
    />
  );
};

export default SvgLogoIcon; 