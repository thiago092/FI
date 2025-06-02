import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { categoriasApi, cartoesApi, contasApi } from '../services/api';

interface Categoria {
  id: number;
  nome: string;
  cor: string;
  icone: string;
}

interface FaturaInfo {
  valor_atual: number;
  valor_total_mes: number;
  dias_para_vencimento: number | null;
  data_vencimento: string | null;
  percentual_limite_usado: number;
}

interface Cartao {
  id: number;
  nome: string;
  bandeira: string;
  limite: number;
  vencimento: number;
  cor: string;
  ativo: boolean;
  fatura?: FaturaInfo;
}

interface Conta {
  id: number;
  nome: string;
  banco: string;
  tipo: string;
  saldo_inicial: number;
  cor: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar dados do backend
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [categoriasData, cartoesData, contasData] = await Promise.all([
          categoriasApi.getAll(),
          cartoesApi.getAllComFatura(),
          contasApi.getAll()
        ]);
        
        setCategorias(categoriasData);
        setCartoes(cartoesData);
        setContas(contasData);
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  // Calcular totais reais dos cartões
  const totalContas = contas.reduce((sum, conta) => sum + conta.saldo_inicial, 0);
  const totalLimiteCartoes = cartoes.reduce((sum, cartao) => sum + cartao.limite, 0);
  const totalFaturaAtual = cartoes.reduce((sum, cartao) => sum + (cartao.fatura?.valor_atual || 0), 0);
  const limiteDisponivel = totalLimiteCartoes - totalFaturaAtual;
  const percentualDisponivel = totalLimiteCartoes > 0 ? Math.floor((limiteDisponivel / totalLimiteCartoes) * 100) : 0;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Navigation user={user} />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-6 lg:mb-0">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Bem-vindo de volta, {user.full_name?.split(' ')[0] || 'Usuário'}! 👋
              </h2>
              <p className="text-slate-600">
                Aqui está um resumo das suas finanças hoje, {new Date().toLocaleDateString('pt-BR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => navigate('/chat')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Chat IA</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">R$ {totalContas.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Total em Contas</p>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <div className="flex items-center text-green-600">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h1a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>{contas.length > 0 ? `${contas.length} conta${contas.length > 1 ? 's' : ''}` : 'Nenhuma conta'}</span>
              </div>
              <span className="text-slate-400 ml-2">cadastrada{contas.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-violet-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">R$ {totalLimiteCartoes.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Limite Cartões</p>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <div className={`flex items-center ${limiteDisponivel >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${limiteDisponivel >= 0 ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                <span>
                  {totalLimiteCartoes > 0 
                    ? limiteDisponivel >= 0 
                      ? `${percentualDisponivel}% disponível`
                      : `${Math.abs(percentualDisponivel)}% excesso`
                    : 'Nenhum cartão'
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">{categorias.length}</p>
                <p className="text-sm text-slate-500">Categorias Ativas</p>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <div className="flex items-center text-slate-600">
                <span>{categorias.length > 0 ? 'Organizadas e prontas' : 'Nenhuma categoria'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/50 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">Online</p>
                <p className="text-sm text-slate-500">IA Assistente</p>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <div className="flex items-center text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <span>Pronta para ajudar</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Carregando dados...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Categorias */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Categorias</h3>
                  </div>
                  <button 
                    onClick={() => navigate('/categorias')}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Ver todas →
                  </button>
                </div>
              </div>
              <div className="p-6">
                {categorias.length > 0 ? (
                  <div className="space-y-4">
                    {categorias.slice(0, 3).map((categoria) => (
                      <div key={categoria.id} className="flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-50 transition-colors duration-200">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-medium"
                          style={{ backgroundColor: categoria.cor }}
                        >
                          <span className="text-lg">{categoria.icone}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{categoria.nome}</p>
                          <p className="text-sm text-slate-500">Categoria ativa</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500 mb-3">Nenhuma categoria cadastrada</p>
                    <button 
                      onClick={() => navigate('/categorias')}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      Criar primeira categoria →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Cartões */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Cartões</h3>
                  </div>
                  <button 
                    onClick={() => navigate('/cartoes')}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Ver todos →
                  </button>
                </div>
              </div>
              <div className="p-6">
                {cartoes.length > 0 ? (
                  <div className="space-y-4">
                    {cartoes.slice(0, 2).map((cartao) => (
                      <div key={cartao.id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: cartao.cor }}
                            >
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{cartao.nome}</p>
                              <p className="text-xs text-slate-500">{cartao.bandeira}</p>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-slate-900">
                            R$ {cartao.limite.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              (cartao.fatura?.percentual_limite_usado || 0) > 100
                                ? 'bg-gradient-to-r from-red-400 to-red-500'
                                : (cartao.fatura?.percentual_limite_usado || 0) > 80
                                ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                                : 'bg-gradient-to-r from-green-400 to-green-500'
                            }`}
                            style={{ width: `${Math.min(cartao.fatura?.percentual_limite_usado || 0, 100)}%` }}
                          ></div>
                        </div>
                        <p className={`text-xs mt-2 ${
                          (cartao.fatura?.percentual_limite_usado || 0) > 100
                            ? 'text-red-600'
                            : 'text-slate-500'
                        }`}>
                          {(cartao.fatura?.percentual_limite_usado || 0) > 100
                            ? `${((cartao.fatura?.percentual_limite_usado || 0) - 100).toFixed(1)}% excesso`
                            : `${(100 - (cartao.fatura?.percentual_limite_usado || 0)).toFixed(1)}% disponível`
                          }
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500 mb-3">Nenhum cartão cadastrado</p>
                    <button 
                      onClick={() => navigate('/cartoes')}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      Adicionar primeiro cartão →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Contas */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Contas</h3>
                  </div>
                  <button 
                    onClick={() => navigate('/contas')}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Ver todas →
                  </button>
                </div>
              </div>
              <div className="p-6">
                {contas.length > 0 ? (
                  <div className="space-y-4">
                    {contas.slice(0, 3).map((conta) => (
                      <div key={conta.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors duration-200">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                            style={{ backgroundColor: conta.cor }}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{conta.nome}</p>
                            <p className="text-sm text-slate-500">{conta.banco}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-slate-900">
                          R$ {conta.saldo_inicial.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500 mb-3">Nenhuma conta cadastrada</p>
                    <button 
                      onClick={() => navigate('/contas')}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      Adicionar primeira conta →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI Chat CTA */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-3xl p-8 mb-8 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row items-center justify-between">
              <div className="mb-6 lg:mb-0 lg:mr-8">
                <h3 className="text-2xl font-bold text-white mb-3">
                  🤖 Adicione despesas com IA
                </h3>
                <p className="text-blue-100 text-lg leading-relaxed max-w-2xl">
                  Converse naturalmente com nossa inteligência artificial para registrar gastos, 
                  fazer upload de notas fiscais ou simplesmente falar sobre suas despesas.
                </p>
                <div className="flex items-center space-x-6 mt-4">
                  <div className="flex items-center space-x-2 text-blue-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 4v10a2 2 0 002 2h8a2 2 0 002-2V8M7 8h10" />
                    </svg>
                    <span className="text-sm">Texto natural</span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="text-sm">Comandos de voz</span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">Upload de imagens</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col space-y-3">
                <button 
                  onClick={() => navigate('/chat')}
                  className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-semibold hover:bg-blue-50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center space-x-3"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>Iniciar Chat</span>
                </button>
                <p className="text-blue-200 text-sm text-center">
                  Experimente: "Gastei R$ 25 no almoço"
                </p>
              </div>
            </div>
          </div>
          
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="50" fill="url(#gradient)" />
              <defs>
                <linearGradient id="gradient">
                  <stop offset="0%" stopColor="white" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
} 