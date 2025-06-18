import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';

export default function WhatsAppPage() {
  const { user } = useAuth();
  const [authCode, setAuthCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/whatsapp/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      setStatus(data.connected ? 'connected' : 'disconnected');
    } catch (error) {
      setStatus('disconnected');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
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
      const response = await fetch('https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/whatsapp/authenticate', {
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
        setMessage('✅ Conta WhatsApp vinculada com sucesso! Agora você pode usar o bot.');
        setAuthCode('');
        setStatus('connected');
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

  const handleDisconnect = async () => {
    try {
      const response = await fetch('https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/whatsapp/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setStatus('disconnected');
        setMessage('Conta WhatsApp desconectada com sucesso.');
        setIsSuccess(true);
      }
    } catch (error) {
      setMessage('Erro ao desconectar conta WhatsApp.');
      setIsSuccess(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <Navigation user={user} />
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">WhatsApp Bot</h1>
            <p className="text-gray-600">Vincule sua conta para usar o bot no WhatsApp</p>
            
            {/* Status de conexão */}
            <div className="mt-4">
              {status === 'checking' && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600 mr-2"></div>
                  Verificando status...
                </div>
              )}
              {status === 'connected' && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Conectado
                </div>
              )}
              {status === 'disconnected' && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                  Desconectado
                </div>
              )}
            </div>
          </div>

          {status === 'connected' ? (
            /* Conta já conectada */
            <div className="text-center space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="font-medium text-green-800 mb-4">✅ Sua conta WhatsApp está vinculada!</h3>
                <p className="text-green-700 mb-4">Agora você pode usar o bot enviando mensagens diretamente no WhatsApp.</p>
                
                <div className="bg-white rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-800 mb-2">Comandos disponíveis:</h4>
                  <ul className="text-sm text-gray-600 space-y-1 text-left">
                    <li>• "Gastei R$ 50 no Nubank" - Registrar gasto</li>
                    <li>• "Saldo" - Consultar saldo atual</li>
                    <li>• "Relatório" - Ver estatísticas</li>
                    <li>• Envie fotos de cupons fiscais</li>
                    <li>• Pergunte qualquer coisa sobre finanças</li>
                  </ul>
                </div>
                
                <button
                  onClick={handleDisconnect}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Desconectar Conta
                </button>
              </div>
            </div>
          ) : (
            /* Formulário de vinculação */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Instruções */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Como vincular:</h2>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-sm font-bold text-green-600">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Adicione o número do bot</p>
                      <p className="text-green-600 font-mono">+55 11 9XXXX-XXXX</p>
                      <p className="text-sm text-gray-600">Salve o número em seus contatos</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-sm font-bold text-green-600">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Envie uma mensagem</p>
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">Olá</code>
                      <p className="text-sm text-gray-600">Para iniciar a conversa</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-sm font-bold text-green-600">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Copie o código de 6 dígitos</p>
                      <p className="text-sm text-gray-600">O bot enviará um código como: 123456</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-sm font-bold text-green-600">4</span>
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

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-800 mb-2">⚠️ Importante:</h3>
                  <p className="text-sm text-blue-700">
                    Este recurso usa a API oficial do WhatsApp Business. 
                    O número do bot ainda está em configuração. 
                    Entre em contato para mais informações.
                  </p>
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center text-lg font-mono"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !authCode.trim()}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 focus:ring-4 focus:ring-green-500/25 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
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
          )}
        </div>
      </div>
    </div>
  );
}