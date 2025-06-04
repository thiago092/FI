import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { settingsApi } from '../services/api';
import { useQuery, useMutation, useQueryClient } from 'react-query';

interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

interface UserStats {
  total_transactions: number;
  total_categories: number;
  total_accounts: number;
  total_cards: number;
  data_size_mb: number;
  last_backup: string;
}

interface TeamUser {
  id: number;
  full_name: string;
  email: string;
  created_at: string;
}

interface TabProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const tabs = [
  { id: 'profile', name: 'Perfil', icon: '👤' },
  { id: 'security', name: 'Segurança', icon: '🔒' },
  { id: 'team', name: 'Equipe', icon: '👥' },
  { id: 'telegram', name: 'Telegram', icon: '📱' },
  { id: 'preferences', name: 'Preferências', icon: '⚙️' },
  { id: 'notifications', name: 'Notificações', icon: '🔔' },
  { id: 'data', name: 'Dados', icon: '💾' },
];

function TabNavigation({ activeTab, setActiveTab }: TabProps) {
  return (
    <div className="border-b border-slate-200">
      <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors duration-200
              ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }
            `}
          >
            <span>{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');

  const updateProfileMutation = useMutation(
    ({ fullName, email }: { fullName: string; email: string }) => 
      settingsApi.updateProfile(fullName, email),
    {
      onSuccess: (data) => {
        setMessage('Perfil atualizado com sucesso!');
        setIsEditing(false);
        queryClient.invalidateQueries('user');
        setTimeout(() => setMessage(''), 3000);
      },
      onError: (error: any) => {
        setMessage(error.response?.data?.detail || 'Erro ao atualizar perfil');
        setTimeout(() => setMessage(''), 5000);
      }
    }
  );

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      fullName: formData.full_name,
      email: formData.email
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Informações do Perfil</h3>
        
        {message && (
          <div className={`mb-4 p-4 rounded-xl border ${
            message.includes('sucesso') 
              ? 'bg-green-50 text-green-700 border-green-200' 
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {message}
          </div>
        )}
        
        <div className="card-mobile">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white text-xl font-semibold">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h4 className="text-xl font-semibold text-slate-900">{user?.full_name}</h4>
              <p className="text-slate-500">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nome Completo
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                disabled={!isEditing}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end mt-6 space-y-2 sm:space-y-0 sm:space-x-3">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      full_name: user?.full_name || '',
                      email: user?.email || '',
                    });
                  }}
                  className="btn-touch bg-slate-100 text-slate-700 hover:bg-slate-200"
                  disabled={updateProfileMutation.isLoading}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isLoading}
                  className="btn-touch bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateProfileMutation.isLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-touch bg-blue-600 text-white hover:bg-blue-700"
              >
                Editar Perfil
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [message, setMessage] = useState('');

  const changePasswordMutation = useMutation(
    ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => 
      settingsApi.changePassword(currentPassword, newPassword),
    {
      onSuccess: () => {
        setMessage('Senha alterada com sucesso!');
        setFormData({
          current_password: '',
          new_password: '',
          confirm_password: '',
        });
        setTimeout(() => setMessage(''), 3000);
      },
      onError: (error: any) => {
        setMessage(error.response?.data?.detail || 'Erro ao alterar senha');
        setTimeout(() => setMessage(''), 5000);
      }
    }
  );

  const handleChangePassword = () => {
    if (formData.new_password !== formData.confirm_password) {
      setMessage('As senhas não coincidem');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    if (formData.new_password.length < 6) {
      setMessage('A nova senha deve ter pelo menos 6 caracteres');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: formData.current_password,
      newPassword: formData.new_password
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Segurança da Conta</h3>
        
        {message && (
          <div className={`mb-4 p-4 rounded-xl border ${
            message.includes('sucesso') 
              ? 'bg-green-50 text-green-700 border-green-200' 
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {message}
          </div>
        )}
        
        <div className="card-mobile">
          <h4 className="text-md font-semibold text-slate-900 mb-4">Alterar Senha</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Senha Atual
              </label>
              <input
                type="password"
                value={formData.current_password}
                onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Digite sua senha atual"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nova Senha
              </label>
              <input
                type="password"
                value={formData.new_password}
                onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Digite uma nova senha"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Confirmar Nova Senha
              </label>
              <input
                type="password"
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Confirme a nova senha"
              />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button 
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isLoading || !formData.current_password || !formData.new_password || !formData.confirm_password}
              className="btn-touch bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {changePasswordMutation.isLoading ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </div>

        {/* Sessões Ativas */}
        <div className="card-mobile mt-6">
          <h4 className="text-md font-semibold text-slate-900 mb-4">Sessões Ativas</h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">💻</span>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Sessão Atual</p>
                  <p className="text-sm text-slate-500">Windows • Chrome • Agora</p>
                </div>
              </div>
              <span className="text-xs text-green-600 font-medium">ATIVA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamTab() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
  });
  const [message, setMessage] = useState('');

  const loadUsers = async () => {
    try {
      const response = await settingsApi.getTenantUsers();
      setUsers(response);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const inviteUserMutation = useMutation(
    ({ email, fullName }: { email: string; fullName: string }) => 
      settingsApi.inviteUser(email, fullName),
    {
      onSuccess: () => {
        setMessage('Usuário convidado com sucesso!');
        setFormData({ full_name: '', email: '' });
        loadUsers();
        setTimeout(() => setMessage(''), 3000);
      },
      onError: (error: any) => {
        setMessage(error.response?.data?.detail || 'Erro ao convidar usuário');
        setTimeout(() => setMessage(''), 5000);
      }
    }
  );

  const handleInviteUser = () => {
    inviteUserMutation.mutate({
      email: formData.email,
      fullName: formData.full_name
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Gerenciamento de Equipe</h3>
        
        {message && (
          <div className={`mb-4 p-4 rounded-xl border ${
            message.includes('sucesso') 
              ? 'bg-green-50 text-green-700 border-green-200' 
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {message}
          </div>
        )}
        
        {/* Convidar Novo Usuário */}
        <div className="card-mobile">
          <h4 className="text-md font-semibold text-slate-900 mb-4">Convidar Novo Usuário</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nome Completo
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: João Silva"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="joao@empresa.com"
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button 
              onClick={handleInviteUser}
              disabled={inviteUserMutation.isLoading || !formData.full_name || !formData.email}
              className="btn-touch bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {inviteUserMutation.isLoading ? 'Convidando...' : 'Convidar Usuário'}
            </button>
          </div>
        </div>

        {/* Lista de Usuários */}
        <div className="card-mobile">
          <h4 className="text-md font-semibold text-slate-900 mb-4">Membros da Equipe</h4>
          
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-slate-600">Carregando usuários...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-semibold">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.full_name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-green-600 font-medium">ATIVO</span>
                    <p className="text-xs text-slate-500">
                      Desde {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
              
              {users.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-500">Nenhum usuário encontrado</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TelegramTab() {
  const [authCode, setAuthCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

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
    <div className="space-y-6">
      <div className="card-mobile">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-1.135 6.403-1.604 8.503-.2.892-.594 1.193-.976 1.222-.827.076-1.456-.547-2.256-1.072l-3.568-2.544c-.929-.659-.321-1.021.2-1.615.135-.154 2.486-2.28 2.536-2.47.006-.024.013-.112-.04-.159-.05-.047-.126-.031-.18-.019-.076.017-1.29.818-3.643 2.404-.344.238-.655.354-.933.35-.307-.006-1.5-.174-2.237-.317-.905-.176-1.625-.269-1.564-.567.032-.156.375-.315.954-.477l9.394-4.069c1.122-.49 2.25-.814 2.478-.826.51-.027.8.118.936.46.136.344.122.799.096 1.206z"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Telegram Bot</h2>
          <p className="text-slate-600">Vincule sua conta para usar o bot no Telegram</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Instruções */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Como vincular:</h3>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-sm font-bold text-blue-600">1</span>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Acesse o bot</p>
                  <a 
                    href="https://t.me/Financeiro_app_bot" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
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
                  <p className="font-medium text-slate-900">Digite no Telegram</p>
                  <code className="bg-slate-100 px-2 py-1 rounded text-sm">/start</code>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-sm font-bold text-blue-600">3</span>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Copie o código de 6 dígitos</p>
                  <p className="text-sm text-slate-600">O bot enviará um código como: 123456</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-sm font-bold text-blue-600">4</span>
                </div>
                <div>
                  <p className="font-medium text-slate-900">Cole o código aqui ao lado</p>
                  <p className="text-sm text-slate-600">E clique em "Vincular Conta"</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-2">Depois de vincular você pode:</h4>
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
                <label htmlFor="authCode" className="block text-sm font-medium text-slate-700 mb-2">
                  Código de Autenticação
                </label>
                <input
                  id="authCode"
                  type="text"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !authCode.trim()}
                className="btn-touch w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-500/25 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
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
    </div>
  );
}

function PreferencesTab() {
  const [preferences, setPreferences] = useState({
    theme: 'light',
    currency: 'BRL',
    week_start: 'monday',
    timezone: 'America/Sao_Paulo',
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Preferências do Sistema</h3>
        
        <div className="card-mobile">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tema da Interface
              </label>
              <select
                value={preferences.theme}
                onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
                <option value="auto">Automático</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Moeda Principal
              </label>
              <select
                value={preferences.currency}
                onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="BRL">Real Brasileiro (R$)</option>
                <option value="USD">Dólar Americano ($)</option>
                <option value="EUR">Euro (€)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Início da Semana
              </label>
              <select
                value={preferences.week_start}
                onChange={(e) => setPreferences({ ...preferences, week_start: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="monday">Segunda-feira</option>
                <option value="sunday">Domingo</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Fuso Horário
              </label>
              <select
                value={preferences.timezone}
                onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                <option value="America/New_York">Nova York (GMT-5)</option>
                <option value="Europe/London">Londres (GMT+0)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button className="btn-touch bg-blue-600 text-white hover:bg-blue-700">
              Salvar Preferências
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [notifications, setNotifications] = useState({
    email_transactions: true,
    email_weekly_summary: true,
    email_monthly_report: false,
    push_new_transaction: true,
    push_bill_reminder: true,
    push_limit_alert: true,
  });

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Configurações de Notificação</h3>
        
        {/* Notificações por Email */}
        <div className="card-mobile">
          <h4 className="text-md font-semibold text-slate-900 mb-4">📧 Notificações por Email</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Novas Transações</p>
                <p className="text-sm text-slate-500">Receba um email quando uma nova transação for criada</p>
              </div>
              <button
                onClick={() => handleToggle('email_transactions')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.email_transactions ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.email_transactions ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Resumo Semanal</p>
                <p className="text-sm text-slate-500">Receba um resumo das suas finanças toda semana</p>
              </div>
              <button
                onClick={() => handleToggle('email_weekly_summary')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.email_weekly_summary ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.email_weekly_summary ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Relatório Mensal</p>
                <p className="text-sm text-slate-500">Relatório detalhado das suas finanças mensais</p>
              </div>
              <button
                onClick={() => handleToggle('email_monthly_report')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.email_monthly_report ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.email_monthly_report ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Notificações Push */}
        <div className="card-mobile">
          <h4 className="text-md font-semibold text-slate-900 mb-4">🔔 Notificações Push</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Nova Transação</p>
                <p className="text-sm text-slate-500">Notificação instantânea para novas movimentações</p>
              </div>
              <button
                onClick={() => handleToggle('push_new_transaction')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.push_new_transaction ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.push_new_transaction ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Lembrete de Contas</p>
                <p className="text-sm text-slate-500">Alerta antes do vencimento das suas contas</p>
              </div>
              <button
                onClick={() => handleToggle('push_bill_reminder')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.push_bill_reminder ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.push_bill_reminder ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Alerta de Limite</p>
                <p className="text-sm text-slate-500">Quando atingir 80% do limite do cartão</p>
              </div>
              <button
                onClick={() => handleToggle('push_limit_alert')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.push_limit_alert ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.push_limit_alert ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn-touch bg-blue-600 text-white hover:bg-blue-700">
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}

function DataTab() {
  const [stats] = useState<UserStats>({
    total_transactions: 1250,
    total_categories: 15,
    total_accounts: 4,
    total_cards: 3,
    data_size_mb: 2.4,
    last_backup: '2024-01-15T10:30:00Z'
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Gerenciamento de Dados</h3>
        
        {/* Estatísticas */}
        <div className="card-mobile">
          <h4 className="text-md font-semibold text-slate-900 mb-4">📊 Estatísticas dos Dados</h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-600">{stats.total_transactions}</div>
              <div className="text-sm text-slate-600">Transações</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <div className="text-2xl font-bold text-green-600">{stats.total_categories}</div>
              <div className="text-sm text-slate-600">Categorias</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-xl">
              <div className="text-2xl font-bold text-purple-600">{stats.total_accounts}</div>
              <div className="text-sm text-slate-600">Contas</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-xl">
              <div className="text-2xl font-bold text-orange-600">{stats.data_size_mb} MB</div>
              <div className="text-sm text-slate-600">Tamanho</div>
            </div>
          </div>
        </div>

        {/* Exportar Dados */}
        <div className="card-mobile">
          <h4 className="text-md font-semibold text-slate-900 mb-4">📤 Exportar Dados</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
              <div>
                <p className="font-medium text-slate-900">Relatório Completo (PDF)</p>
                <p className="text-sm text-slate-500">Todas as transações, contas e estatísticas</p>
              </div>
              <button className="btn-touch bg-blue-600 text-white hover:bg-blue-700">
                Baixar PDF
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
              <div>
                <p className="font-medium text-slate-900">Dados Brutos (CSV)</p>
                <p className="text-sm text-slate-500">Arquivo CSV para análise em planilhas</p>
              </div>
              <button className="btn-touch bg-green-600 text-white hover:bg-green-700">
                Baixar CSV
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
              <div>
                <p className="font-medium text-slate-900">Backup Completo (JSON)</p>
                <p className="text-sm text-slate-500">Backup completo para migração ou restauração</p>
              </div>
              <button className="btn-touch bg-purple-600 text-white hover:bg-purple-700">
                Baixar JSON
              </button>
            </div>
          </div>
        </div>

        {/* Zona de Perigo */}
        <div className="card-mobile border-red-200 bg-red-50">
          <h4 className="text-md font-semibold text-red-800 mb-4">⚠️ Zona de Perigo</h4>
          
          <div className="space-y-4">
            <div className="p-4 bg-white border border-red-200 rounded-xl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Limpar Todos os Dados</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Remove permanentemente todas as transações, contas e configurações.
                    <strong className="text-red-600"> Esta ação não pode ser desfeita!</strong>
                  </p>
                </div>
                <button className="ml-4 btn-touch bg-red-600 text-white hover:bg-red-700">
                  Limpar Tudo
                </button>
              </div>
            </div>
            
            <div className="p-4 bg-white border border-red-200 rounded-xl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Excluir Conta</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Exclui permanentemente sua conta e todos os dados associados.
                    <strong className="text-red-600"> Esta ação não pode ser desfeita!</strong>
                  </p>
                </div>
                <button className="ml-4 btn-touch bg-red-600 text-white hover:bg-red-700">
                  Excluir Conta
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

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

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'profile': return <ProfileTab />;
      case 'security': return <SecurityTab />;
      case 'team': return <TeamTab />;
      case 'telegram': return <TelegramTab />;
      case 'preferences': return <PreferencesTab />;
      case 'notifications': return <NotificationsTab />;
      case 'data': return <DataTab />;
      default: return <ProfileTab />;
    }
  };

  return (
    <div className="min-h-screen-mobile bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Navigation user={user} />

      <div className="container-mobile pb-safe">
        {/* Page Header */}
        <div className="py-6 lg:py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-responsive-heading text-slate-900">Configurações</h1>
                <p className="text-slate-600 text-sm sm:text-base">Gerencie suas preferências, equipe e configurações da conta</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center lg:justify-end">
              <button 
                onClick={() => navigate('/dashboard')}
                className="btn-touch bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all duration-200 space-x-2 touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Voltar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden">
            <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
            
            <div className="p-6 lg:p-8">
              {renderActiveTab()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 