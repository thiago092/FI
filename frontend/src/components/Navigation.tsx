import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

interface NavigationProps {
  user?: any;
}

interface NavItem {
  name: string;
  path: string;
  icon: JSX.Element;
  shortName: string;
  highlight?: boolean;
  isMenu?: boolean;
}

export default function Navigation({ user: propUser }: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user: authUser } = useAuth();
  const { theme, isDark, setTheme, toggleTheme } = useTheme();
  
  // Usar user da prop ou do contexto
  const user = propUser || authUser;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      shortName: 'Home'
    },
    {
      name: 'Transações',
      path: '/transacoes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      shortName: 'Transações'
    },
    {
      name: 'Recorrentes',
      path: '/transacoes-recorrentes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      shortName: 'Recorrentes'
    },
    {
      name: 'Categorias',
      path: '/categorias',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      shortName: 'Categorias'
    },
    {
      name: 'Cartões',
      path: '/cartoes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      shortName: 'Cartões'
    },
    {
      name: 'Contas',
      path: '/contas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      shortName: 'Contas'
    },
    {
      name: 'Financiamentos',
      path: '/financiamentos',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      shortName: 'Financiar'
    },
    {
      name: 'Planejamento',
      path: '/planejamento',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m5 0h2a2 2 0 002-2V7a2 2 0 00-2-2h-2m-5 4h6m-6 4h6m2-5l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      shortName: 'Planejar'
    },
    {
      name: 'Visão Futura',
      path: '/visao-futura',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      shortName: 'Visão'
    }
  ];

  // Primary navigation items for bottom nav (mobile)
  const primaryNavItems: NavItem[] = [
    navItems.find(item => item.path === '/dashboard')!,
    navItems.find(item => item.path === '/transacoes')!,
    navItems.find(item => item.path === '/planejamento')!,
    {
      name: 'Menu',
      path: '/menu',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
      shortName: 'Menu',
      isMenu: true
    }
  ];

  // Navigation items for mobile menu (includes Settings)
  const mobileNavItems: NavItem[] = [
    ...navItems,
    {
      name: 'Configurações',
      path: '/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      shortName: 'Config'
    }
  ];

  const handleNavigation = (item: NavItem) => {
    if (item.isMenu) {
      setIsMobileMenuOpen(true);
    } else {
      // Se navegando para dashboard, passar página atual como origem
      if (item.path === '/dashboard' && location.pathname !== '/dashboard') {
        const currentPageName = getCurrentPageName(location.pathname);
        navigate(item.path, { state: { from: currentPageName } });
      } else {
        navigate(item.path);
      }
      setIsMobileMenuOpen(false);
    }
  };

  // Helper para identificar nome da página atual
  const getCurrentPageName = (pathname: string): string => {
    if (pathname.includes('/transacoes-recorrentes')) return 'transacoes-recorrentes';
    if (pathname.includes('/transacoes')) return 'transacoes';
    if (pathname.includes('/cartoes')) return 'cartoes';
    if (pathname.includes('/contas')) return 'contas';
    if (pathname.includes('/categorias')) return 'categorias';
    if (pathname.includes('/financiamentos')) return 'financiamentos';
    if (pathname.includes('/faturas')) return 'faturas';
    if (pathname.includes('/parcelas')) return 'parcelas';
    if (pathname.includes('/planejamento')) return 'planejamento';
    if (pathname.includes('/visao-futura')) return 'visao-futura';
    if (pathname.includes('/chat')) return 'chat';
    return 'outros';
  };

  return (
    <>
      {/* Desktop Header */}
      <header className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-200/60 dark:border-gray-700/60 sticky top-0 z-40 shadow-sm">
        <div className="container-mobile">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3 lg:space-x-4">
              <button 
                onClick={() => {
                  if (location.pathname !== '/dashboard') {
                    const currentPageName = getCurrentPageName(location.pathname);
                    navigate('/dashboard', { state: { from: currentPageName } });
                  } else {
                    navigate('/dashboard');
                  }
                }}
                className="flex items-center space-x-2 sm:space-x-3 hover:opacity-80 transition-opacity duration-200 touch-manipulation"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-base sm:text-lg">F</span>
                </div>
                <div className="hidden xs:block">
                  <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    FinançasAI
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Controle Inteligente</p>
                </div>
              </button>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1 bg-slate-100/50 dark:bg-gray-800/50 rounded-2xl p-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      if (item.path === '/dashboard' && location.pathname !== '/dashboard') {
                        const currentPageName = getCurrentPageName(location.pathname);
                        navigate(item.path, { state: { from: currentPageName } });
                      } else {
                        navigate(item.path);
                      }
                    }}
                    className={`
                      flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 touch-manipulation
                      ${isActive 
                        ? item.highlight 
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                          : 'bg-white dark:bg-gray-700 text-slate-800 dark:text-white shadow-sm border border-slate-200 dark:border-gray-600'
                        : item.highlight
                          ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                          : 'text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white hover:bg-white/70 dark:hover:bg-gray-700/70'
                      }
                    `}
                  >
                    {item.icon}
                    <span className="text-sm">{item.name}</span>
                  </button>
                );
              })}
            </nav>

            {/* Mobile hamburger menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 transition-all duration-200 touch-manipulation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* User Menu - Desktop */}
            <div className="hidden lg:flex items-center space-x-3">
              {/* Theme Toggle Button */}
              <div className="relative">
                <button
                  onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                  className="p-2.5 rounded-xl text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 transition-all duration-200 touch-manipulation"
                  title="Alterar tema"
                >
                  {isDark ? (
                    <Moon className="w-5 h-5" />
                  ) : (
                    <Sun className="w-5 h-5" />
                  )}
                </button>

                {/* Theme Dropdown Menu */}
                {isThemeMenuOpen && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsThemeMenuOpen(false)}
                    />
                    
                    {/* Menu */}
                    <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-slate-200 dark:border-gray-700 py-2 z-20">
                      <button
                        onClick={() => {
                          setTheme('light');
                          setIsThemeMenuOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors ${theme === 'light' ? 'bg-slate-50 dark:bg-gray-700' : ''}`}
                      >
                        <Sun className="w-5 h-5 text-amber-500" />
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Claro</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setTheme('dark');
                          setIsThemeMenuOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors ${theme === 'dark' ? 'bg-slate-50 dark:bg-gray-700' : ''}`}
                      >
                        <Moon className="w-5 h-5 text-blue-500" />
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Escuro</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setTheme('auto');
                          setIsThemeMenuOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors ${theme === 'auto' ? 'bg-slate-50 dark:bg-gray-700' : ''}`}
                      >
                        <Monitor className="w-5 h-5 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Sistema</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 transition-all duration-200 touch-manipulation group"
                  title={`${user.full_name} - Clique para opções`}
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 dark:text-gray-400 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-gray-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    
                    {/* Menu */}
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-slate-200 dark:border-gray-700 py-2 z-20">
                      {/* User Info Header */}
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                            {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{user.full_name}</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          navigate('/settings');
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <svg className="w-5 h-5 text-slate-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Configurações</span>
                      </button>
                      
                      <div className="h-px bg-slate-200 dark:bg-gray-700 my-2"></div>
                      
                      <button
                        onClick={() => {
                          handleLogout();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="text-sm font-medium">Sair</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-slate-200 dark:border-gray-700 pb-safe">
        <div className="grid grid-cols-4 gap-1 p-2">
          {primaryNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item)}
                className={`mobile-nav-item ${isActive && !item.isMenu ? 'active' : ''} touch-manipulation`}
              >
                <div className="mb-1">
                  {item.icon}
                </div>
                <span className="text-xs font-medium leading-none">{item.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 dark:bg-black/70 transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-gray-900 shadow-2xl transform transition-transform">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg">F</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Menu</h2>
                    <p className="text-sm text-slate-500 dark:text-gray-400">{user.full_name}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors touch-manipulation"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Navigation Items */}
              <div className="flex-1 overflow-y-auto py-4">
                <div className="space-y-1 px-4">
                  {/* Theme Toggle Section for Mobile */}
                  <div className="mb-4 p-3 bg-slate-50 dark:bg-gray-800 rounded-xl">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-3">Tema</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setTheme('light')}
                        className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 ${theme === 'light' ? 'bg-white dark:bg-gray-700 shadow-sm border border-slate-200 dark:border-gray-600' : 'hover:bg-white/50 dark:hover:bg-gray-700/50'}`}
                      >
                        <Sun className="w-5 h-5 text-amber-500 mb-1" />
                        <span className="text-xs font-medium text-slate-600 dark:text-gray-400">Claro</span>
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 ${theme === 'dark' ? 'bg-white dark:bg-gray-700 shadow-sm border border-slate-200 dark:border-gray-600' : 'hover:bg-white/50 dark:hover:bg-gray-700/50'}`}
                      >
                        <Moon className="w-5 h-5 text-blue-500 mb-1" />
                        <span className="text-xs font-medium text-slate-600 dark:text-gray-400">Escuro</span>
                      </button>
                      <button
                        onClick={() => setTheme('auto')}
                        className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 ${theme === 'auto' ? 'bg-white dark:bg-gray-700 shadow-sm border border-slate-200 dark:border-gray-600' : 'hover:bg-white/50 dark:hover:bg-gray-700/50'}`}
                      >
                        <Monitor className="w-5 h-5 text-slate-500 mb-1" />
                        <span className="text-xs font-medium text-slate-600 dark:text-gray-400">Sistema</span>
                      </button>
                    </div>
                  </div>

                  {mobileNavItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    
                    return (
                      <button
                        key={item.name}
                        onClick={() => handleNavigation(item)}
                        className={`
                          w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 text-left touch-manipulation
                          ${isActive 
                            ? item.highlight 
                              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                              : 'bg-slate-100 dark:bg-gray-800 text-slate-900 dark:text-white'
                            : 'text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-gray-800'
                          }
                        `}
                      >
                        {item.icon}
                        <span>{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 dark:border-gray-700 p-4">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 touch-manipulation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-medium">Sair</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spacer for mobile bottom navigation */}
      <div className="lg:hidden h-20" />
    </>
  );
} 