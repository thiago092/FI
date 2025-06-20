import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';

interface ConfigConfirmacao {
  ativo: boolean;
  timeout_horas: number;
}

export default function TelegramPage() {
  const { user } = useAuth();
  const [authCode, setAuthCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Estados para configurações de confirmação
  const [telegramConectado, setTelegramConectado] = useState(false);
  const [configConfirmacao, setConfigConfirmacao] = useState<ConfigConfirmacao | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [messageConfig, setMessageConfig] = useState('');
  const [isSuccessConfig, setIsSuccessConfig] = useState(false);

  useEffect(() => {
    carregarConfiguracao();
  }, []);

  const carregarConfiguracao = async () => {
    try {
      const response = await fetch('https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/telegram/config/confirmacao-recorrentes', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        setTelegramConectado(data.telegram_conectado);
        setConfigConfirmacao(data.config);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const atualizarConfiguracao = async (ativo: boolean, timeoutHoras: number) => {
    setIsLoadingConfig(true);
    setMessageConfig('');

    try {
      const response = await fetch('https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/telegram/config/confirmacao-recorrentes', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ativar: ativo,
          timeout_horas: timeoutHoras
        })
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccessConfig(true);
        setMessageConfig(data.message);
        setConfigConfirmacao(data.config);
      } else {
        setIsSuccessConfig(false);
        setMessageConfig(data.detail || 'Erro ao atualizar configuração');
      }
    } catch (error) {
      setIsSuccessConfig(false);
      setMessageConfig('Erro de conexão');
    } finally {
      setIsLoadingConfig(false);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authCode.trim()) return;

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/telegram/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ auth_code: authCode })
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setMessage('✅ Conta Telegram vinculada com sucesso! Agora você pode usar o bot.');
        setAuthCode('');
        // Recarregar configurações após vincular
        carregarConfiguracao();
      } else {
        setIsSuccess(false);
        setMessage(data.detail || 'Erro ao vincular conta');
      }
    } catch (error) {
      setIsSuccess(false);
      setMessage('Erro de conexão. Verifique se o backend está rodando.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navigation user={user} />
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-1.135 6.403-1.604 8.503-.2.892-.594 1.193-.976 1.222-.827.076-1.456-.547-2.256-1.072l-3.568-2.544c-.929-.659-.321-1.021.2-1.615.135-.154 2.486-2.28 2.536-2.47.006-.024.013-.112-.04-.159-.05-.047-.126-.031-.18-.019-.076.017-1.29.818-3.643 2.404-.344.238-.655.354-.933.35-.307-.006-1.5-.174-2.237-.317-.905-.176-1.625-.269-1.564-.567.032-.156.375-.315.954-.477l9.394-4.069c1.122-.49 2.25-.814 2.478-.826.51-.027.8.118.936.46.136.344.122.799.096 1.206z"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Telegram Bot</h1>
            <p className="text-gray-600">Vincule sua conta para usar o bot no Telegram</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Instruções */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Como vincular:</h2>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-bold text-blue-600">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Acesse o bot</p>
                    <a 
                      href="https://t.me/Financeiro_app_bot" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      https://t.me/Financeiro_app_bot
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-bold text-blue-600">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Digite no Telegram</p>
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">/start</code>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-bold text-blue-600">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Copie o código de 6 dígitos</p>
                    <p className="text-sm text-gray-600">O bot enviará um código como: 123456</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm font-bold text-blue-600">4</span>
                  </div>
                  <div>
                    <p className="font-medium">Cole o código aqui ao lado</p>
                    <p className="text-sm text-gray-600">E clique em "Vincular Conta"</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-800 mb-2">Depois de vincular você pode:</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Registrar gastos: "Gastei R$ 50 no Nubank"</li>
                  <li>• Enviar fotos de cupons fiscais</li>
                  <li>• Consultar saldo e estatísticas</li>
                  <li>• Usar todos os recursos do FinançasAI</li>
                </ul>
              </div>
            </div>

            {/* Formulário */}
            <div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="authCode" className="block text-sm font-medium text-gray-700 mb-2">
                    Código de Autenticação
                  </label>
                  <input
                    id="authCode"
                    type="text"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !authCode.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-500/25 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Vinculando...
                    </>
                  ) : (
                    'Vincular Conta'
                  )}
                </button>
              </form>

              {message && (
                <div className={`mt-4 p-4 rounded-lg ${isSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className={`text-sm ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
                    {message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Seção de Configurações - só aparece se Telegram estiver conectado */}
        {telegramConectado && (
          <div className="bg-white rounded-xl shadow-lg p-8 mt-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Configurações Avançadas</h2>
              <p className="text-gray-600">Personalize o comportamento das transações recorrentes</p>
            </div>

            <div className="max-w-2xl mx-auto">
              {configConfirmacao ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <h3 className="font-semibold text-blue-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Confirmação de Transações Recorrentes
                  </h3>
                  <p className="text-blue-700 text-sm mb-4">
                    Quando ativado, você receberá uma mensagem no Telegram pedindo confirmação antes de criar cada transação recorrente. 
                    Se não responder dentro do prazo, a transação será criada automaticamente.
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Pedir confirmação via Telegram</span>
                      <button
                        onClick={() => atualizarConfiguracao(!configConfirmacao.ativo, configConfirmacao.timeout_horas)}
                        disabled={isLoadingConfig}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          configConfirmacao.ativo ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            configConfirmacao.ativo ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {configConfirmacao.ativo && (
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Tempo limite para confirmação
                        </label>
                        <div className="flex items-center space-x-3">
                          <select
                            value={configConfirmacao.timeout_horas}
                            onChange={(e) => atualizarConfiguracao(true, parseInt(e.target.value))}
                            disabled={isLoadingConfig}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value={1}>1 hora</option>
                            <option value={2}>2 horas</option>
                            <option value={4}>4 horas</option>
                            <option value={6}>6 horas</option>
                            <option value={12}>12 horas</option>
                            <option value={24}>24 horas</option>
                          </select>
                          <span className="text-sm text-gray-600">
                            após este tempo, a transação será criada automaticamente
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {messageConfig && (
                    <div className={`mt-4 p-3 rounded-lg ${isSuccessConfig ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <p className={`text-sm ${isSuccessConfig ? 'text-green-800' : 'text-red-800'}`}>
                        {messageConfig}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                  <h3 className="font-semibold text-yellow-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Funcionalidade em Desenvolvimento
                  </h3>
                  <p className="text-yellow-700 text-sm">
                    As configurações avançadas de confirmação de transações recorrentes estão sendo preparadas. 
                    Esta funcionalidade estará disponível em breve após a atualização do sistema.
                  </p>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Como funciona:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>Desativado:</strong> Transações recorrentes são criadas automaticamente (padrão)</li>
                  <li>• <strong>Ativado:</strong> Você recebe uma mensagem perguntando se quer criar a transação</li>
                  <li>• Você pode responder "Sim" ou "Não" no Telegram</li>
                  <li>• Se não responder no prazo, a transação é criada automaticamente</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 