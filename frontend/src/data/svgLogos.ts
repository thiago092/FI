// SVG Logos Reais para Ícones Personalizados
// Baseado na coleção SVG Logos by Gil Barbara (Licença CC0)
// https://github.com/gilbarbara/logos

export interface SvgLogo {
  id: string;
  nome: string;
  categoria: 'streaming' | 'delivery' | 'transporte' | 'utilidades' | 'financeiro' | 'tecnologia' | 'outros';
  cor?: string;
  svg: string;
}

export const SVG_LOGOS: SvgLogo[] = [
  // Streaming Services
  {
    id: 'netflix',
    nome: 'Netflix',
    categoria: 'streaming',
    cor: '#E50914',
    svg: `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <rect fill="#000" width="256" height="256"/>
      <path d="M80.1 41.2L80.1 214.7C83.3 214.5 86.8 214.1 97.7 213C101.5 212.7 112.7 212 114 212L114 175.2L117.2 146.2C132.3 188.9 140.4 211.8 140.5 211.9C142.8 212 145.6 212.2 172.2 214.5C173.7 214.7 175.5 214.8 175.6 214.7L175.8 127.9L175.7 41.3L158.7 41.3L141.7 41.3L141.6 79.6L141.5 118L138.4 109.1L134.3 194.5C138.3 205.8 140.5 211.8 140.5 211.9C142.8 212 145.6 212.2 172.2 214.5C173.7 214.7 175.5 214.8 175.6 214.7L175.8 127.9L175.7 41.3L158.7 41.3L141.7 41.3z" fill="#E50914"/>
      <path d="M80.1 41.2L80.1 214.7C83.3 214.5 86.8 214.1 97.7 213C101.5 212.7 112.7 212 114 212L114 175.2L117.2 146.2C117.6 147.4 117.8 147.7 118.2 148.9L122.3 63.5C121.4 61.1 121.8 62.3 120.9 59.5C117.5 50.1 114.7 42.1 114.6 41.8L114.3 41.2L97.2 41.2L80.1 41.2z" fill="#B1060F"/>
    </svg>`
  },
  {
    id: 'spotify',
    nome: 'Spotify',
    categoria: 'streaming',
    cor: '#1DB954',
    svg: `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <circle cx="128" cy="128" r="128" fill="#1ED760"/>
      <path d="M185.8 195.8c-2.3 3.7-7.2 4.9-10.9 2.6-29.7-18.1-67.1-22.2-111.1-12.1-4.2.9-8.5-1.7-9.4-5.9-.9-4.2 1.7-8.5 5.9-9.4 48.4-11.1 89.8-6.3 123.5 14 3.7 2.3 4.9 7.2 2.6 10.9zm15.6-34.6c-2.9 4.7-9.1 6.2-13.8 3.3-34-20.9-85.9-27-126.3-14.8-5.3 1.6-10.9-1.3-12.5-6.6-1.6-5.3 1.3-10.9 6.6-12.5 46.4-14 105.1-7.2 143.9 17 4.7 2.9 6.2 9.1 3.3 13.8zm1.3-36c-40.8-24.2-108.2-26.5-147.2-14.6-6.3 1.9-13-1.6-14.9-7.9-1.9-6.3 1.6-13 7.9-14.9 44.8-13.6 120.7-11 168.1 16.9 5.5 3.2 7.3 10.4 4.1 15.9-3.2 5.5-10.4 7.3-15.9 4.1z" fill="#FFF"/>
    </svg>`
  },
  {
    id: 'youtube-premium',
    nome: 'YouTube Premium',
    categoria: 'streaming',
    cor: '#FF0000',
    svg: `<svg viewBox="0 0 256 180" xmlns="http://www.w3.org/2000/svg">
      <path d="M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134z" fill="#FF0000"/>
      <path fill="#FFF" d="m102.421 128.06 66.328-38.418-66.328-38.418z"/>
    </svg>`
  },
  {
    id: 'disney-plus',
    nome: 'Disney+',
    categoria: 'streaming',
    cor: '#113CCF',
    svg: `<svg viewBox="0 0 256 145" xmlns="http://www.w3.org/2000/svg">
      <path d="M44.895 43.947c-.734-.832-1.754-1.447-2.926-1.447-1.14 0-2.128.583-2.861 1.415l-12.29 13.862c-.796.864-1.847 1.447-3.02 1.447s-2.224-.583-3.02-1.447L8.487 43.915C7.754 43.083 6.766 42.5 5.626 42.5c-1.172 0-2.192.615-2.926 1.447C2.065 44.811 1.639 45.8 1.639 46.885c0 1.051.426 2.04 1.061 2.904l12.29 13.862c1.592 1.729 3.76 2.729 6.107 2.729s4.515-1 6.107-2.729l12.29-13.862c.635-.864 1.061-1.853 1.061-2.904 0-1.085-.426-2.074-1.061-2.938z" fill="#113CCF"/>
    </svg>`
  },
  {
    id: 'max-hbo',
    nome: 'Max (HBO)',
    categoria: 'streaming',
    cor: '#7B2CBF',
    svg: `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <circle cx="128" cy="128" r="128" fill="#7B2CBF"/>
      <path d="M91.5 80h25v96h-25zm49 0h25v40h25V80h25v96h-25v-40h-25v40h-25z" fill="#FFF"/>
    </svg>`
  },

  // Delivery & Food
  {
    id: 'ifood',
    nome: 'iFood',
    categoria: 'delivery',
    cor: '#EA1D2C',
    svg: `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <circle cx="128" cy="128" r="128" fill="#EA1D2C"/>
      <path d="M85 85h86v86H85z" fill="#FFF"/>
      <path d="M95 95h20v66H95zm26 0h20v30h-20zm26 0h20v66h-20z" fill="#EA1D2C"/>
    </svg>`
  },
  {
    id: 'uber-eats',
    nome: 'Uber Eats',
    categoria: 'delivery',
    cor: '#05A357',
    svg: `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <circle cx="128" cy="128" r="128" fill="#05A357"/>
      <path d="M170 100c0-23.196-18.804-42-42-42s-42 18.804-42 42v10h84v-10zm-84 30v46c0 11.046 8.954 20 20 20h28c11.046 0 20-8.954 20-20v-46H86z" fill="#FFF"/>
    </svg>`
  },

  // Tecnologia
  {
    id: 'apple',
    nome: 'Apple',
    categoria: 'tecnologia',
    cor: '#000000',
    svg: `<svg viewBox="0 0 256 315" xmlns="http://www.w3.org/2000/svg">
      <path d="M213.803 167.03c.442 47.58 41.74 63.413 42.197 63.615-.35 1.116-6.599 22.563-21.757 44.716-13.104 19.153-26.705 38.235-48.13 38.63-21.05.388-27.82-12.483-51.888-12.483-24.061 0-31.582 12.088-51.51 12.871-20.68.783-36.428-20.71-49.64-39.793-27-39.033-47.633-110.3-19.928-158.406 13.763-23.89 38.36-39.017 65.056-39.405 20.307-.387 39.475 13.662 51.889 13.662 12.406 0 35.699-16.895 60.186-14.414 10.25.427 39.026 4.14 57.503 31.19-1.49.923-34.335 20.044-33.978 59.822M174.24 50.199c10.98-13.29 18.369-31.79 16.353-50.199-15.826.636-34.962 10.546-46.314 23.828-10.13 11.703-19.021 30.61-16.66 48.633 17.606 1.365 35.557-8.964 46.621-22.262" fill="#000"/>
    </svg>`
  },
  {
    id: 'google',
    nome: 'Google',
    categoria: 'tecnologia',
    cor: '#4285F4',
    svg: `<svg viewBox="0 0 256 262" xmlns="http://www.w3.org/2000/svg">
      <path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/>
      <path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/>
      <path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/>
      <path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/>
    </svg>`
  },
  {
    id: 'microsoft',
    nome: 'Microsoft',
    categoria: 'tecnologia',
    cor: '#5E5E5E',
    svg: `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <path fill="#F25022" d="M0 0h121v121H0z"/>
      <path fill="#00A4EF" d="M135 0h121v121H135z"/>
      <path fill="#7FBA00" d="M0 135h121v121H0z"/>
      <path fill="#FFB900" d="M135 135h121v121H135z"/>
    </svg>`
  },

  // Utilidades
  {
    id: 'whatsapp',
    nome: 'WhatsApp',
    categoria: 'utilidades',
    cor: '#25D366',
    svg: `<svg viewBox="0 0 256 258" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.463 127.456c-.006 21.677 5.658 42.843 16.428 61.499L4.433 252.697l65.232-17.104a122.994 122.994 0 0 0 58.8 14.97h.054c67.815 0 123.018-55.183 123.047-123.01.013-32.867-12.775-63.773-36.009-87.025-23.23-23.25-54.125-36.061-87.043-36.076-67.823 0-123.022 55.18-123.05 123.004" fill="#25D366"/>
      <path d="M96.678 74.148c-2.386-5.303-4.897-5.41-7.166-5.503-1.858-.08-3.982-.074-6.104-.074-2.124 0-5.575.799-8.492 3.984-2.92 3.188-11.148 10.892-11.148 26.561 0 15.67 11.413 30.813 13.004 32.94 1.593 2.123 22.033 35.307 54.405 48.073 26.904 10.609 32.379 8.499 38.218 7.967 5.84-.53 18.844-7.702 21.497-15.139 2.655-7.436 2.655-13.81 1.859-15.142-.796-1.327-2.92-2.124-6.104-3.716-3.186-1.593-18.844-9.298-21.763-10.361-2.92-1.062-5.043-1.592-7.167 1.597-2.124 3.184-8.223 10.356-10.082 12.48-1.857 2.129-3.716 2.394-6.9.801-3.187-1.598-13.444-4.957-25.613-15.806-9.468-8.442-15.86-18.867-17.718-22.056-1.858-3.184-.199-4.91 1.398-6.497 1.431-1.427 3.186-3.719 4.78-5.578 1.588-1.86 2.118-3.187 3.18-5.311 1.063-2.126.531-3.986-.264-5.579-.798-1.593-7.2-17.343-9.87-23.749" fill="#FFF"/>
    </svg>`
  }
];

export const SVG_LOGOS_POR_CATEGORIA = {
  streaming: SVG_LOGOS.filter(logo => logo.categoria === 'streaming'),
  delivery: SVG_LOGOS.filter(logo => logo.categoria === 'delivery'),
  transporte: SVG_LOGOS.filter(logo => logo.categoria === 'transporte'),
  utilidades: SVG_LOGOS.filter(logo => logo.categoria === 'utilidades'),
  financeiro: SVG_LOGOS.filter(logo => logo.categoria === 'financeiro'),
  tecnologia: SVG_LOGOS.filter(logo => logo.categoria === 'tecnologia'),
  outros: SVG_LOGOS.filter(logo => logo.categoria === 'outros'),
};

export const getSvgLogo = (id: string): SvgLogo | null => {
  return SVG_LOGOS.find(logo => logo.id === id) || null;
};

export const renderSvgLogo = (id: string, size: number = 24): string => {
  const logo = getSvgLogo(id);
  if (!logo) return '';
  
  return logo.svg.replace('<svg', `<svg width="${size}" height="${size}"`);
}; 