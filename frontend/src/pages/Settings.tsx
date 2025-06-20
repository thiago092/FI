import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Navigation from '../components/Navigation';
import { settingsApi, notificationApi } from '../services/api';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  NotificationPreference, 
  NotificationConfig, 
  WEEK_DAYS, 
  NOTIFICATION_CONTENT_OPTIONS 
} from '../types/notification';

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
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬' },
  { id: 'preferences', name: 'Preferências', icon: '⚙️' },
  { id: 'notifications', name: 'Notificações', icon: '🔔' },
  { id: 'data', name: 'Dados', icon: '💾' },
];

function TabNavigation({ activeTab, setActiveTab }: TabProps) {
  const { isDark } = useTheme();
  
  return (
    <div className={`border-b ${isDark ? 'border-gray-700' : 'border-slate-200'}`}>
      <nav className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto px-2 sm:px-0" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              whitespace-nowrap py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center space-x-1 sm:space-x-2 transition-all duration-200 min-w-fit
              ${activeTab === tab.id
                ? isDark 
                  ? 'border-blue-400 text-blue-400'
                  : 'border-blue-500 text-blue-600'
                : isDark
                  ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }
            `}
          >
            <span className="text-sm sm:text-base">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  const { isDark } = useTheme();
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
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Informações do Perfil
        </h3>
        
        {message && (
          <div className={`mb-4 p-4 rounded-xl border transition-all duration-200 ${
            message.includes('sucesso') 
              ? isDark
                ? 'bg-green-900/20 text-green-400 border-green-500/30'
                : 'bg-green-50 text-green-700 border-green-200'
              : isDark
                ? 'bg-red-900/20 text-red-400 border-red-500/30'
                : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {message}
          </div>
        )}
        
        <div className={`p-4 sm:p-6 rounded-2xl border transition-all duration-200 ${
          isDark 
            ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
            : 'bg-white border-slate-200/50 shadow-sm'
        }`}>
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white text-xl sm:text-2xl font-semibold">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="text-center sm:text-left">
              <h4 className={`text-xl sm:text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {user?.full_name}
              </h4>
              <p className={`${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                {user?.email}
              </p>
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${
                isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
              }`}>
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                Conta Ativa
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                Nome Completo
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                disabled={!isEditing}
                className={`w-full px-3 py-3 border rounded-lg transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-800 disabled:text-gray-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500'
                }`}
              />
            </div>
            
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
                className={`w-full px-3 py-3 border rounded-lg transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-800 disabled:text-gray-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500'
                }`}
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
                  className={`w-full sm:w-auto px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isDark
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  disabled={updateProfileMutation.isLoading}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isLoading}
                  className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
                >
                  {updateProfileMutation.isLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all duration-200"
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
  const { isDark } = useTheme();
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async () => {
    // Validações do frontend
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

    if (!formData.current_password.trim()) {
      setMessage('Digite sua senha atual');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    try {
      setIsLoading(true);
      setMessage('');
      

      
      const result = await settingsApi.changePassword(
        formData.current_password, 
        formData.new_password
      );
      
      
      
      setMessage('Senha alterada com sucesso!');
      setFormData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      
      setTimeout(() => setMessage(''), 5000);
      
    } catch (error: any) {
      console.error('❌ Erro ao alterar senha:', error);
      
      let errorMessage = 'Erro ao alterar senha';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 7000);
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          🔒 Segurança da Conta
        </h3>
        
        {message && (
          <div className={`mb-4 p-4 rounded-xl border transition-all duration-200 ${
            message.includes('sucesso') 
              ? isDark
                ? 'bg-green-900/20 text-green-400 border-green-500/30'
                : 'bg-green-50 text-green-700 border-green-200'
              : isDark
                ? 'bg-red-900/20 text-red-400 border-red-500/30'
                : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {message}
          </div>
        )}
        
        <div className={`p-4 sm:p-6 rounded-2xl border transition-all duration-200 ${
          isDark 
            ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
            : 'bg-white border-slate-200/50 shadow-sm'
        }`}>
          <h4 className={`text-md font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            🔑 Alterar Senha
          </h4>
          
          <div className="space-y-4 sm:space-y-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                Senha Atual
              </label>
              <input
                type="password"
                value={formData.current_password}
                onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                className={`w-full px-3 py-3 border rounded-lg transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400'
                }`}
                placeholder="Digite sua senha atual"
              />
            </div>
            
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                Nova Senha
              </label>
              <input
                type="password"
                value={formData.new_password}
                onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                className={`w-full px-3 py-3 border rounded-lg transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400'
                }`}
                placeholder="Digite uma nova senha (mínimo 6 caracteres)"
              />
              {formData.new_password && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center space-x-2 text-xs">
                    <div className={`w-2 h-2 rounded-full ${formData.new_password.length >= 6 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className={`${formData.new_password.length >= 6 
                      ? isDark ? 'text-green-400' : 'text-green-600' 
                      : isDark ? 'text-red-400' : 'text-red-600'
                    }`}>
                      Mínimo 6 caracteres
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    <div className={`w-2 h-2 rounded-full ${/[A-Z]/.test(formData.new_password) ? 'bg-green-500' : isDark ? 'bg-gray-600' : 'bg-slate-300'}`}></div>
                    <span className={`${/[A-Z]/.test(formData.new_password) 
                      ? isDark ? 'text-green-400' : 'text-green-600' 
                      : isDark ? 'text-gray-400' : 'text-slate-500'
                    }`}>
                      Letra maiúscula (recomendado)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    <div className={`w-2 h-2 rounded-full ${/[0-9]/.test(formData.new_password) ? 'bg-green-500' : isDark ? 'bg-gray-600' : 'bg-slate-300'}`}></div>
                    <span className={`${/[0-9]/.test(formData.new_password) 
                      ? isDark ? 'text-green-400' : 'text-green-600' 
                      : isDark ? 'text-gray-400' : 'text-slate-500'
                    }`}>
                      Número (recomendado)
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                Confirmar Nova Senha
              </label>
              <input
                type="password"
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                className={`w-full px-3 py-3 border rounded-lg transition-all duration-200 ${
                  formData.confirm_password && formData.new_password && formData.confirm_password !== formData.new_password
                    ? isDark
                      ? 'border-red-500/50 bg-red-900/20 text-white placeholder-gray-400'
                      : 'border-red-300 bg-red-50 text-slate-900 placeholder-slate-400'
                    : formData.confirm_password && formData.new_password && formData.confirm_password === formData.new_password
                    ? isDark
                      ? 'border-green-500/50 bg-green-900/20 text-white placeholder-gray-400'
                      : 'border-green-300 bg-green-50 text-slate-900 placeholder-slate-400'
                    : isDark
                      ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400'
                      : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400'
                }`}
                placeholder="Confirme a nova senha"
              />
              {formData.confirm_password && formData.new_password && (
                <div className="mt-2 flex items-center space-x-2 text-xs">
                  {formData.confirm_password === formData.new_password ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className={isDark ? 'text-green-400' : 'text-green-600'}>As senhas coincidem</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className={isDark ? 'text-red-400' : 'text-red-600'}>As senhas não coincidem</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button 
              onClick={handleChangePassword}
              disabled={isLoading || !formData.current_password || !formData.new_password || !formData.confirm_password}
              className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
            >
              {isLoading ? '🔄 Alterando...' : '🔐 Alterar Senha'}
            </button>
          </div>
        </div>

        {/* Sessões Ativas */}
        <div className={`p-4 sm:p-6 rounded-2xl border mt-6 transition-all duration-200 ${
          isDark 
            ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
            : 'bg-white border-slate-200/50 shadow-sm'
        }`}>
          <h4 className={`text-md font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            💻 Sessões Ativas
          </h4>
          
          <div className="space-y-3">
            <div className={`flex items-center justify-between p-3 sm:p-4 rounded-xl transition-all duration-200 ${
              isDark ? 'bg-gray-700/50' : 'bg-slate-50'
            }`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">💻</span>
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Sessão Atual
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Windows • Chrome • Agora
                  </p>
                </div>
              </div>
              <span className="text-xs text-green-500 font-medium px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                ATIVA
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamTab() {
  const { isDark } = useTheme();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
  });
  const [message, setMessage] = useState('');
  const [tempCredentials, setTempCredentials] = useState<{email: string, password: string} | null>(null);

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
      onSuccess: (data: any) => {
        setMessage('Usuário convidado com sucesso!');
        setTempCredentials({
          email: data.user.email,
          password: data.temp_password
        });
        setFormData({ full_name: '', email: '' });
        loadUsers();
        setTimeout(() => setMessage(''), 10000);
      },
      onError: (error: any) => {
        console.error('Erro no convite:', error);
        let errorMessage = 'Erro ao convidar usuário';
        
        try {
          if (error?.response?.data?.detail) {
            errorMessage = error.response.data.detail;
          } else if (error?.message) {
            errorMessage = error.message;
          }
        } catch (e) {
          console.error('Erro ao processar erro:', e);
        }
        
        setMessage(errorMessage);
        setTimeout(() => setMessage(''), 5000);
      }
    }
  );

  const handleInviteUser = () => {
    setTempCredentials(null); // Limpar credenciais anteriores
    inviteUserMutation.mutate({
      email: formData.email,
      fullName: formData.full_name
    });
  };

  const removeUserMutation = useMutation(
    (userId: number) => settingsApi.removeUser(userId),
    {
      onSuccess: () => {
        setMessage('Usuário removido com sucesso!');
        loadUsers();
        setTimeout(() => setMessage(''), 3000);
      },
      onError: (error: any) => {
        setMessage(error.response?.data?.detail || 'Erro ao remover usuário');
        setTimeout(() => setMessage(''), 5000);
      }
    }
  );

  const handleRemoveUser = (userId: number, userName: string) => {
    if (window.confirm(`Tem certeza que deseja remover ${userName} da equipe?`)) {
      removeUserMutation.mutate(userId);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          👥 Gerenciamento de Equipe
        </h3>

        {/* Informações do Sistema */}
        <div className={`mb-6 p-4 rounded-xl border transition-all duration-200 ${
          isDark 
            ? 'border-blue-500/30 bg-blue-900/20' 
            : 'border-blue-200 bg-blue-50'
        }`}>
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">i</span>
            </div>
            <div className="flex-1">
              <h4 className={`font-semibold mb-2 ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                Como funciona
              </h4>
              <div className={`text-sm space-y-1 ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>
                <p>• Adicione membros da equipe inserindo nome e email</p>
                <p>• Uma senha temporária será gerada automaticamente</p>
                <p>• Compartilhe as credenciais com o novo usuário</p>
                <p>• O usuário deve trocar a senha no primeiro login</p>
                <p>• Todos os dados financeiros são compartilhados entre a equipe</p>
              </div>
            </div>
          </div>
        </div>
        
        {message && (
          <div className={`mb-4 p-4 rounded-xl border transition-all duration-200 ${
            message.includes('sucesso') 
              ? isDark
                ? 'bg-green-900/20 text-green-400 border-green-500/30'
                : 'bg-green-50 text-green-700 border-green-200'
              : isDark
                ? 'bg-red-900/20 text-red-400 border-red-500/30'
                : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {message}
          </div>
        )}

        {/* Credenciais Temporárias */}
        {tempCredentials && (
          <div className={`mb-4 p-4 rounded-xl border transition-all duration-200 ${
            isDark 
              ? 'border-blue-500/30 bg-blue-900/20' 
              : 'border-blue-200 bg-blue-50'
          }`}>
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">!</span>
              </div>
              <div className="flex-1">
                <h4 className={`font-semibold mb-2 ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                  Credenciais Temporárias
                </h4>
                <p className={`text-sm mb-3 ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>
                  Envie estas credenciais para o novo usuário:
                </p>
                <div className={`rounded-lg p-3 space-y-2 ${
                  isDark ? 'bg-gray-800' : 'bg-white'
                }`}>
                  <div>
                    <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                      EMAIL:
                    </span>
                    <p className={`font-mono text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {tempCredentials.email}
                    </p>
                  </div>
                  <div>
                    <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                      SENHA TEMPORÁRIA:
                    </span>
                    <p className={`font-mono text-sm px-2 py-1 rounded ${
                      isDark 
                        ? 'text-yellow-200 bg-yellow-900/30' 
                        : 'text-slate-900 bg-yellow-100'
                    }`}>
                      {tempCredentials.password}
                    </p>
                  </div>
                </div>
                <p className={`text-xs mt-2 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                  💡 O usuário deve alterar esta senha no primeiro login em Configurações {'>'} Segurança
                </p>
                <button
                  onClick={() => setTempCredentials(null)}
                  className="mt-3 text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                >
                  Entendi, ocultar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Convidar Novo Usuário */}
        <div className={`p-4 sm:p-6 rounded-2xl border transition-all duration-200 ${
          isDark 
            ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
            : 'bg-white border-slate-200/50 shadow-sm'
        }`}>
          <h4 className={`text-md font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ➕ Convidar Novo Usuário
          </h4>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                Nome Completo
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className={`w-full px-3 py-3 border rounded-lg transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400'
                }`}
                placeholder="Ex: João Silva"
              />
            </div>
            
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-3 py-3 border rounded-lg transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400'
                }`}
                placeholder="joao@empresa.com"
              />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button 
              onClick={handleInviteUser}
              disabled={inviteUserMutation.isLoading || !formData.full_name || !formData.email}
              className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
            >
              {inviteUserMutation.isLoading ? '📤 Convidando...' : '📩 Convidar Usuário'}
            </button>
          </div>
        </div>

        {/* Lista de Usuários */}
        <div className={`p-4 sm:p-6 rounded-2xl border transition-all duration-200 ${
          isDark 
            ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
            : 'bg-white border-slate-200/50 shadow-sm'
        }`}>
          <h4 className={`text-md font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            👥 Membros da Equipe
          </h4>
          
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Carregando usuários...
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className={`flex items-center justify-between p-4 rounded-xl transition-all duration-200 ${
                  isDark ? 'bg-gray-700/50' : 'bg-slate-50'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-semibold">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {user.full_name}
                      </p>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <span className="text-xs text-green-500 font-medium px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                        ATIVO
                      </span>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        Desde {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    {(user as any).is_admin !== true && (
                      <button
                        onClick={() => handleRemoveUser(user.id, user.full_name)}
                        disabled={removeUserMutation.isLoading}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                          isDark
                            ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20'
                            : 'text-red-600 hover:text-red-800 hover:bg-red-50'
                        }`}
                        title="Remover usuário"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {users.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 opacity-20">
                    <svg fill="currentColor" viewBox="0 0 24 24" className={isDark ? 'text-gray-400' : 'text-slate-400'}>
                      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>
                    Nenhum usuário encontrado
                  </p>
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
  const { isDark } = useTheme();
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
      <div className={`p-4 sm:p-6 rounded-2xl border transition-all duration-200 ${
        isDark 
          ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
          : 'bg-white border-slate-200/50 shadow-sm'
      }`}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.568 8.16c-.169 1.858-1.135 6.403-1.604 8.503-.2.892-.594 1.193-.976 1.222-.827.076-1.456-.547-2.256-1.072l-3.568-2.544c-.929-.659-.321-1.021.2-1.615.135-.154 2.486-2.28 2.536-2.47.006-.024.013-.112-.04-.159-.05-.047-.126-.031-.18-.019-.076.017-1.29.818-3.643 2.404-.344.238-.655.354-.933.35-.307-.006-1.5-.174-2.237-.317-.905-.176-1.625-.269-1.564-.567.032-.156.375-.315.954-.477l9.394-4.069c1.122-.49 2.25-.814 2.478-.826.51-.027.8.118.936.46.136.344.122.799.096 1.206z"/>
            </svg>
          </div>
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Telegram Bot
          </h2>
          <p className={isDark ? 'text-gray-400' : 'text-slate-600'}>
            Vincule sua conta para usar o bot no Telegram
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Instruções */}
          <div className="space-y-6">
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Como vincular:
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  isDark ? 'bg-blue-900/30' : 'bg-blue-100'
                }`}>
                  <span className={`text-sm font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    1
                  </span>
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Acesse o bot
                  </p>
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
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  isDark ? 'bg-blue-900/30' : 'bg-blue-100'
                }`}>
                  <span className={`text-sm font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    2
                  </span>
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Digite no Telegram
                  </p>
                  <code className={`px-2 py-1 rounded text-sm ${
                    isDark ? 'bg-gray-700 text-gray-300' : 'bg-slate-100 text-slate-900'
                  }`}>
                    /start
                  </code>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  isDark ? 'bg-blue-900/30' : 'bg-blue-100'
                }`}>
                  <span className={`text-sm font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    3
                  </span>
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Copie o código de 6 dígitos
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                    O bot enviará um código como: 123456
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  isDark ? 'bg-blue-900/30' : 'bg-blue-100'
                }`}>
                  <span className={`text-sm font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    4
                  </span>
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Cole o código aqui ao lado
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                    E clique em "Vincular Conta"
                  </p>
                </div>
              </div>
            </div>

            <div className={`rounded-lg p-4 border transition-all duration-200 ${
              isDark 
                ? 'bg-green-900/20 border-green-500/30' 
                : 'bg-green-50 border-green-200'
            }`}>
              <h4 className={`font-medium mb-2 ${isDark ? 'text-green-400' : 'text-green-800'}`}>
                Depois de vincular você pode:
              </h4>
              <ul className={`text-sm space-y-1 ${isDark ? 'text-green-300' : 'text-green-700'}`}>
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
                <label htmlFor="authCode" className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-slate-700'
                }`}>
                  Código de Autenticação
                </label>
                <input
                  id="authCode"
                  type="text"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className={`w-full px-4 py-3 border rounded-lg text-center text-lg font-mono transition-all duration-200 ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400'
                      : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400'
                  }`}
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
              <div className={`mt-4 p-4 rounded-lg border transition-all duration-200 ${
                isSuccess 
                  ? isDark
                    ? 'bg-green-900/20 text-green-400 border-green-500/30'
                    : 'bg-green-50 text-green-800 border-green-200'
                  : isDark
                    ? 'bg-red-900/20 text-red-400 border-red-500/30'
                    : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                <p className="text-sm">
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

// WhatsApp Integration - Updated flow v2.0
function WhatsAppTab() {
  const { isDark } = useTheme();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [step, setStep] = useState(1); // 1: phone, 2: verification

  const handleSubmitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/whatsapp/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ phone_number: phoneNumber })
      });

      const data = await response.json();

      if (response.ok) {
        setStep(2);
        setMessage(`✅ Código gerado: ${data.code}\n\n📱 IMPORTANTE: Envie uma mensagem "OLÁ" para nosso WhatsApp Business para receber o código de verificação. Você deve iniciar a conversa primeiro!`);
        setIsSuccess(true);
      } else {
        setIsSuccess(false);
        setMessage(data.detail || 'Erro ao enviar código de verificação');
      }
    } catch (error) {
      setIsSuccess(false);
      setMessage('Erro de conexão. Verifique se o backend está rodando.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) return;

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/whatsapp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          phone_number: phoneNumber,
          verification_code: verificationCode 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setMessage('✅ WhatsApp vinculado com sucesso! Agora você pode usar o bot.');
        setPhoneNumber('');
        setVerificationCode('');
        setStep(1);
      } else {
        setIsSuccess(false);
        setMessage(data.detail || 'Erro ao verificar código');
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
      <div className={`p-4 sm:p-6 rounded-2xl border transition-all duration-200 ${
        isDark 
          ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
          : 'bg-white border-slate-200/50 shadow-sm'
      }`}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
            </svg>
          </div>
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            WhatsApp Business
          </h2>
          <p className={isDark ? 'text-gray-400' : 'text-slate-600'}>
            Vincule seu WhatsApp para usar o bot financeiro
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Instruções */}
          <div className="space-y-6">
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Como vincular:
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  isDark ? 'bg-green-900/30' : 'bg-green-100'
                }`}>
                  <span className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    1
                  </span>
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Digite seu número
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                    Com código do país: +55 11 99999-9999
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  isDark ? 'bg-green-900/30' : 'bg-green-100'
                }`}>
                  <span className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    2
                  </span>
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Gere seu código
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                    O sistema gerará um código de verificação
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  isDark ? 'bg-green-900/30' : 'bg-green-100'
                }`}>
                  <span className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    3
                  </span>
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Envie mensagem no WhatsApp
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                    Envie "OLÁ" para nosso número WhatsApp Business
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  isDark ? 'bg-green-900/30' : 'bg-green-100'
                }`}>
                  <span className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    4
                  </span>
                </div>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Receba e digite o código
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                    Você receberá o código e deve digitá-lo aqui
                  </p>
                </div>
              </div>
            </div>

            <div className={`rounded-lg p-4 border transition-all duration-200 ${
              isDark 
                ? 'bg-blue-900/20 border-blue-500/30' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <h4 className={`font-medium mb-2 ${isDark ? 'text-blue-400' : 'text-blue-800'}`}>
                ⚠️ Importante sobre WhatsApp Business:
              </h4>
              <ul className={`text-sm space-y-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                <li>• Você deve enviar a primeira mensagem</li>
                <li>• Envie "OLÁ" para nosso número depois de gerar o código</li>
                <li>• Não podemos iniciar conversas por política do WhatsApp</li>
                <li>• Após sua primeira mensagem, responderemos com o código</li>
              </ul>
            </div>

            <div className={`rounded-lg p-4 border transition-all duration-200 ${
              isDark 
                ? 'bg-green-900/20 border-green-500/30' 
                : 'bg-green-50 border-green-200'
            }`}>
              <h4 className={`font-medium mb-2 ${isDark ? 'text-green-400' : 'text-green-800'}`}>
                Depois de vincular você pode:
              </h4>
              <ul className={`text-sm space-y-1 ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                <li>• Registrar gastos via WhatsApp</li>
                <li>• Enviar fotos de comprovantes</li>
                <li>• Receber relatórios financeiros</li>
                <li>• Gerenciar suas finanças facilmente</li>
              </ul>
            </div>
          </div>

          {/* Formulário */}
          <div>
            {step === 1 ? (
              <form onSubmit={handleSubmitPhone} className="space-y-6">
                <div>
                  <label htmlFor="phoneNumber" className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-slate-700'
                  }`}>
                    Número do WhatsApp
                  </label>
                  <input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+55 11 99999-9999"
                    className={`w-full px-4 py-3 border rounded-lg transition-all duration-200 ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-400'
                        : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-slate-400'
                    }`}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !phoneNumber.trim()}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 focus:ring-4 focus:ring-green-500/25 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Enviando...
                    </>
                  ) : (
                    'Enviar Código'
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmitVerification} className="space-y-6">
                <div>
                  <label htmlFor="verificationCode" className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-slate-700'
                  }`}>
                    Código de Verificação
                  </label>
                  <input
                    id="verificationCode"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    className={`w-full px-4 py-3 border rounded-lg text-center text-lg font-mono transition-all duration-200 ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-400'
                        : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-slate-400'
                    }`}
                    required
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setVerificationCode('');
                      setMessage('');
                    }}
                    className={`flex-1 py-3 rounded-lg font-semibold border transition-all duration-200 ${
                      isDark
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !verificationCode.trim()}
                    className="flex-2 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 focus:ring-4 focus:ring-green-500/25 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verificando...
                      </>
                    ) : (
                      'Verificar Código'
                    )}
                  </button>
                </div>
              </form>
            )}

            {message && (
              <div className={`mt-4 p-4 rounded-lg border transition-all duration-200 ${
                isSuccess 
                  ? isDark
                    ? 'bg-green-900/20 text-green-400 border-green-500/30'
                    : 'bg-green-50 text-green-800 border-green-200'
                  : isDark
                    ? 'bg-red-900/20 text-red-400 border-red-500/30'
                    : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                <p className="text-sm">
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
  const { theme, setTheme, isDark } = useTheme();
  const [preferences, setPreferences] = useState({
    currency: 'BRL',
    week_start: 'monday',
    timezone: 'America/Sao_Paulo',
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Preferências do Sistema
        </h3>
        
        <div className={`p-4 sm:p-6 rounded-2xl border transition-all duration-200 ${
          isDark 
            ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
            : 'bg-white border-slate-200/50 shadow-sm'
        }`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                🎨 Tema da Interface
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'auto')}
                className={`w-full px-3 py-3 border rounded-lg transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              >
                <option value="light">☀️ Claro</option>
                <option value="dark">🌙 Escuro</option>
                <option value="auto">🔄 Automático</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                💰 Moeda Principal
              </label>
              <select
                value={preferences.currency}
                onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                className={`w-full px-3 py-3 border rounded-lg transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              >
                <option value="BRL">🇧🇷 Real Brasileiro (R$)</option>
                <option value="USD">🇺🇸 Dólar Americano ($)</option>
                <option value="EUR">🇪🇺 Euro (€)</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                📅 Início da Semana
              </label>
              <select
                value={preferences.week_start}
                onChange={(e) => setPreferences({ ...preferences, week_start: e.target.value })}
                className={`w-full px-3 py-3 border rounded-lg transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              >
                <option value="monday">Segunda-feira</option>
                <option value="sunday">Domingo</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                🌍 Fuso Horário
              </label>
              <select
                value={preferences.timezone}
                onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                className={`w-full px-3 py-3 border rounded-lg transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              >
                <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                <option value="America/New_York">Nova York (GMT-5)</option>
                <option value="Europe/London">Londres (GMT+0)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all duration-200">
              💾 Salvar Preferências
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Estado para as preferências de notificação
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [telegramStatus, setTelegramStatus] = useState<{connected: boolean, telegram_id?: string, username?: string, first_name?: string, message?: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Buscar preferências existentes e status do Telegram
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Buscar status do Telegram primeiro
        const status = await notificationApi.getTelegramStatus();
        setTelegramStatus(status);
        
        // Se conectado, buscar preferências
        if (status.connected) {
          const data = await notificationApi.getPreferences();
          setPreferences(data);
        }
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
        setTelegramStatus({connected: false, message: 'Erro ao verificar status do Telegram'});
      }
    };

    fetchData();
  }, []);

  // Função para salvar/atualizar preferência
  const savePreference = async (type: string, data: any) => {
    setIsLoading(true);
    try {
      // Verificar se Telegram está conectado
      if (!telegramStatus?.connected) {
        setMessage('❌ Telegram não está vinculado. Vá para Configurações > Telegram para vincular.');
        return;
      }

      const existing = preferences.find(p => p.notification_type === type);
      const payload = {
        ...data,
        notification_type: type as 'daily' | 'weekly' | 'monthly'
        // telegram_user_id será preenchido automaticamente pela API
      };

      let newPref: NotificationPreference;
      
      if (existing) {
        newPref = await notificationApi.updatePreference(type, payload);
      } else {
        newPref = await notificationApi.createPreference(payload);
      }

      setPreferences(prev => {
        const filtered = prev.filter(p => p.notification_type !== type);
        return [...filtered, newPref];
      });
      setMessage('✅ Preferência salva com sucesso!');
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Erro ao salvar preferência';
      setMessage(`❌ ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Função para deletar preferência
  const deletePreference = async (type: string) => {
    try {
      await notificationApi.deletePreference(type);
      setPreferences(prev => prev.filter(p => p.notification_type !== type));
      setMessage('✅ Notificação removida!');
    } catch (error) {
      setMessage('❌ Erro ao remover notificação');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  // Função para testar notificação
  const testNotification = async (type: string) => {
    setIsLoading(true);
    try {
      const result = await notificationApi.testNotification(type);
      if (result.success) {
        setMessage(`✅ ${result.message}`);
      } else {
        setMessage('❌ Falha ao enviar notificação de teste');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Erro ao enviar notificação de teste';
      setMessage(`❌ ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Componente para configurar notificação
  const NotificationConfig = ({ 
    type, 
    title, 
    description, 
    icon 
  }: { 
    type: string; 
    title: string; 
    description: string; 
    icon: string; 
  }) => {
    const existing = preferences.find(p => p.notification_type === type);
    const [isExpanded, setIsExpanded] = useState(false);
    const [config, setConfig] = useState<NotificationConfig>({
      notification_hour: existing?.notification_hour || 9,
      day_of_week: existing?.day_of_week || 1,
      day_of_month: existing?.day_of_month || 1,
      include_balance: existing?.include_balance ?? true,
      include_transactions: existing?.include_transactions ?? true,
      include_categories: existing?.include_categories ?? true,
      include_insights: existing?.include_insights ?? true
    });

    const handleSave = () => {
      const data: any = {
        notification_hour: config.notification_hour,
        include_balance: config.include_balance,
        include_transactions: config.include_transactions,
        include_categories: config.include_categories,
        include_insights: config.include_insights
      };

      if (type === 'weekly') {
        data.day_of_week = config.day_of_week;
      } else if (type === 'monthly') {
        data.day_of_month = config.day_of_month;
      }

      savePreference(type, data);
      setIsExpanded(false);
    };

    const weekDays = WEEK_DAYS;

    return (
      <div className={`p-4 rounded-xl border transition-all duration-200 ${
        isDark 
          ? 'bg-gray-800/50 border-gray-700/50' 
          : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {title}
              </h4>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                {description}
              </p>
              {existing && (
                <p className={`text-xs mt-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  ✓ Configurado para {existing.notification_hour}h
                  {type === 'weekly' && ` às ${weekDays[existing.day_of_week]?.label}`}
                  {type === 'monthly' && ` dia ${existing.day_of_month}`}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {existing ? (
              <>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDark
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  ⚙️ Editar
                </button>
                <button
                  onClick={() => testNotification(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDark
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  🧪 Testar
                </button>
                <button
                  onClick={() => deletePreference(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDark
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                >
                  🗑️
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsExpanded(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                ➕ Ativar
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className={`mt-4 p-4 rounded-lg border-2 border-dashed ${
            isDark ? 'border-gray-600 bg-gray-700/30' : 'border-slate-300 bg-slate-50'
          }`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Horário */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                  Horário
                </label>
                <select
                  value={config.notification_hour}
                  onChange={(e) => setConfig({...config, notification_hour: parseInt(e.target.value)})}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  {Array.from({length: 24}, (_, i) => (
                    <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                  ))}
                </select>
                
                {/* Dica sobre horários permitidos para notificações diárias */}
                {type === 'daily' && (
                  <div className={`mt-2 p-2 rounded-lg ${
                    isDark ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'
                  } border`}>
                    <div className={`text-xs flex items-center ${
                      isDark ? 'text-blue-300' : 'text-blue-600'
                    }`}>
                      <span className="mr-1">💡</span>
                      <span>
                        <strong>Notificações diárias</strong> são enviadas apenas das <strong>18h às 23h</strong> (horário noturno).
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Dia da semana (se for semanal) */}
              {type === 'weekly' && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                    Dia da Semana
                  </label>
                  <select
                    value={config.day_of_week}
                    onChange={(e) => setConfig({...config, day_of_week: parseInt(e.target.value)})}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {weekDays.map(day => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dia do mês (se for mensal) */}
              {type === 'monthly' && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                    Dia do Mês
                  </label>
                  <select
                    value={config.day_of_month}
                    onChange={(e) => setConfig({...config, day_of_month: parseInt(e.target.value)})}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {Array.from({length: 28}, (_, i) => (
                      <option key={i+1} value={i+1}>Dia {i+1}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Configurações de conteúdo */}
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                Incluir no resumo:
              </label>
              <div className="grid grid-cols-2 gap-3">
                {NOTIFICATION_CONTENT_OPTIONS.map(item => (
                  <label key={item.key} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config[item.key as keyof typeof config] as boolean}
                      onChange={(e) => setConfig({...config, [item.key]: e.target.checked})}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsExpanded(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? 'bg-gray-600 text-white hover:bg-gray-700'
                    : 'bg-gray-500 text-white hover:bg-gray-600'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                } disabled:opacity-50`}
              >
                {isLoading ? '⏳ Salvando...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          📱 Notificações via Telegram
        </h3>
        
        {message && (
          <div className={`mb-4 p-4 rounded-xl border transition-all duration-200 ${
            message.includes('✅') 
              ? isDark
                ? 'bg-green-900/20 text-green-400 border-green-500/30'
                : 'bg-green-50 text-green-700 border-green-200'
              : isDark
                ? 'bg-red-900/20 text-red-400 border-red-500/30'
                : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {message}
          </div>
        )}

        {/* Status do Telegram */}
        <div className={`p-4 rounded-xl border transition-all duration-200 mb-6 ${
          telegramStatus?.connected
            ? isDark 
              ? 'bg-green-900/20 border-green-500/30' 
              : 'bg-green-50 border-green-200'
            : isDark 
              ? 'bg-yellow-900/20 border-yellow-500/30' 
              : 'bg-yellow-50 border-yellow-200'
        }`}>
          <h4 className={`font-semibold mb-2 ${
            telegramStatus?.connected
              ? isDark ? 'text-green-400' : 'text-green-700'
              : isDark ? 'text-yellow-400' : 'text-yellow-700'
          }`}>
            📱 Status do Telegram
          </h4>
          
          {telegramStatus?.connected ? (
            <div>
              <p className={`text-sm mb-2 ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                ✅ <strong>Telegram conectado com sucesso!</strong>
              </p>
              <div className={`text-sm ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                <div>👤 <strong>Nome:</strong> {telegramStatus.first_name}</div>
                {telegramStatus.username && (
                  <div>📧 <strong>Username:</strong> @{telegramStatus.username}</div>
                )}
                <div>🆔 <strong>ID:</strong> {telegramStatus.telegram_id}</div>
              </div>
            </div>
          ) : (
            <div>
              <p className={`text-sm mb-2 ${isDark ? 'text-yellow-300' : 'text-yellow-600'}`}>
                ⚠️ <strong>Telegram não está vinculado</strong>
              </p>
              <p className={`text-sm mb-3 ${isDark ? 'text-yellow-300' : 'text-yellow-600'}`}>
                Para usar notificações, você precisa vincular sua conta do Telegram primeiro.
              </p>
              <button 
                onClick={() => window.location.href = '#/telegram'}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-yellow-500 text-white hover:bg-yellow-600'
                }`}
              >
                🔗 Ir para Configurações do Telegram
              </button>
            </div>
          )}
        </div>

        {/* Tipos de Notificação - apenas se Telegram conectado */}
        {telegramStatus?.connected ? (
          <div className="space-y-4">
            <NotificationConfig
              type="daily"
              title="Resumo Diário"
              description="Receba um resumo das suas finanças todos os dias"
              icon="🌅"
            />
            
            <NotificationConfig
              type="weekly"
              title="Resumo Semanal"
              description="Análise completa dos seus gastos da semana"
              icon="📊"
            />
            
            <NotificationConfig
              type="monthly"
              title="Relatório Mensal"
              description="Relatório detalhado do mês com insights e tendências"
              icon="📈"
            />
          </div>
        ) : (
          <div className={`p-6 rounded-xl border-2 border-dashed text-center ${
            isDark ? 'border-gray-600 bg-gray-700/30' : 'border-slate-300 bg-slate-50'
          }`}>
            <div className="text-6xl mb-4">📱</div>
            <h4 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Vincule seu Telegram primeiro
            </h4>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Para configurar notificações automáticas, você precisa vincular sua conta do Telegram.
            </p>
          </div>
        )}

        {/* Informações */}
        <div className={`p-4 rounded-xl border transition-all duration-200 ${
          isDark 
            ? 'bg-gray-800/30 border-gray-700/50' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <h4 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ℹ️ Como funciona
          </h4>
          <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
            <li>• Configure o horário e frequência das notificações</li>
            <li>• Escolha que informações incluir no resumo</li>
            <li>• As notificações são enviadas automaticamente via Telegram</li>
            <li>• Você pode ativar/desativar ou editar a qualquer momento</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function DataTab() {
  const { isDark } = useTheme();
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
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          💾 Gerenciamento de Dados
        </h3>
        
        {/* Estatísticas */}
        <div className={`p-4 sm:p-6 rounded-2xl border transition-all duration-200 ${
          isDark 
            ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
            : 'bg-white border-slate-200/50 shadow-sm'
        }`}>
          <h4 className={`text-md font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            📊 Estatísticas dos Dados
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`text-center p-4 rounded-xl transition-all duration-200 ${
              isDark ? 'bg-blue-900/30' : 'bg-blue-50'
            }`}>
              <div className="text-2xl font-bold text-blue-600">{stats.total_transactions}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Transações
              </div>
            </div>
            <div className={`text-center p-4 rounded-xl transition-all duration-200 ${
              isDark ? 'bg-green-900/30' : 'bg-green-50'
            }`}>
              <div className="text-2xl font-bold text-green-600">{stats.total_categories}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Categorias
              </div>
            </div>
            <div className={`text-center p-4 rounded-xl transition-all duration-200 ${
              isDark ? 'bg-purple-900/30' : 'bg-purple-50'
            }`}>
              <div className="text-2xl font-bold text-purple-600">{stats.total_accounts}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Contas
              </div>
            </div>
            <div className={`text-center p-4 rounded-xl transition-all duration-200 ${
              isDark ? 'bg-orange-900/30' : 'bg-orange-50'
            }`}>
              <div className="text-2xl font-bold text-orange-600">{stats.data_size_mb} MB</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Tamanho
              </div>
            </div>
          </div>
        </div>

        {/* Exportar Dados */}
        <div className={`p-4 sm:p-6 rounded-2xl border transition-all duration-200 ${
          isDark 
            ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
            : 'bg-white border-slate-200/50 shadow-sm'
        }`}>
          <h4 className={`text-md font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            📤 Exportar Dados
          </h4>
          
          <div className="space-y-4">
            <div className={`flex items-center justify-between p-4 border rounded-xl transition-all duration-200 ${
              isDark ? 'border-gray-600' : 'border-slate-200'
            }`}>
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Relatório Completo (PDF)
                </p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Todas as transações, contas e estatísticas
                </p>
              </div>
              <button className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all duration-200">
                Baixar PDF
              </button>
            </div>
            
            <div className={`flex items-center justify-between p-4 border rounded-xl transition-all duration-200 ${
              isDark ? 'border-gray-600' : 'border-slate-200'
            }`}>
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Dados Brutos (CSV)
                </p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Arquivo CSV para análise em planilhas
                </p>
              </div>
              <button className="w-full sm:w-auto px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-all duration-200">
                Baixar CSV
              </button>
            </div>
            
            <div className={`flex items-center justify-between p-4 border rounded-xl transition-all duration-200 ${
              isDark ? 'border-gray-600' : 'border-slate-200'
            }`}>
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Backup Completo (JSON)
                </p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Backup completo para migração ou restauração
                </p>
              </div>
              <button className="w-full sm:w-auto px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-all duration-200">
                Baixar JSON
              </button>
            </div>
          </div>
        </div>

        {/* Zona de Perigo */}
        <div className={`p-4 sm:p-6 rounded-2xl border transition-all duration-200 ${
          isDark 
            ? 'border-red-500/30 bg-red-900/20 backdrop-blur-sm' 
            : 'border-red-200 bg-red-50'
        }`}>
          <h4 className={`text-md font-semibold mb-4 ${isDark ? 'text-red-400' : 'text-red-800'}`}>
            ⚠️ Zona de Perigo
          </h4>
          
          <div className="space-y-4">
            <div className={`p-4 border rounded-xl transition-all duration-200 ${
              isDark 
                ? 'bg-gray-800 border-red-500/30' 
                : 'bg-white border-red-200'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Limpar Todos os Dados
                  </p>
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Remove permanentemente todas as transações, contas e configurações.
                    <strong className={`ml-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                      Esta ação não pode ser desfeita!
                    </strong>
                  </p>
                </div>
                <button className="ml-4 w-full sm:w-auto px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-all duration-200">
                  Limpar Tudo
                </button>
              </div>
            </div>
            
            <div className={`p-4 border rounded-xl transition-all duration-200 ${
              isDark 
                ? 'bg-gray-800 border-red-500/30' 
                : 'bg-white border-red-200'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Excluir Conta
                  </p>
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Exclui permanentemente sua conta e todos os dados associados.
                    <strong className={`ml-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                      Esta ação não pode ser desfeita!
                    </strong>
                  </p>
                </div>
                <button className="ml-4 w-full sm:w-auto px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-all duration-200">
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
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');

  // Detectar parâmetro da URL para abrir tab específica
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['profile', 'security', 'team', 'telegram', 'whatsapp', 'preferences', 'notifications', 'data'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Carregando...
          </p>
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
      case 'whatsapp': return <WhatsAppTab />;
      case 'preferences': return <PreferencesTab />;
      case 'notifications': return <NotificationsTab />;
      case 'data': return <DataTab />;
      default: return <ProfileTab />;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'
    }`}>
      <Navigation user={user} />

      <div className="px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6">
        {/* Page Header */}
        <div className="py-4 sm:py-6 lg:py-8">
          <div className="flex flex-col space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    Configurações
                  </h1>
                  <p className={`text-sm sm:text-base ${
                    isDark ? 'text-gray-400' : 'text-slate-600'
                  }`}>
                    Gerencie suas preferências, equipe e configurações da conta
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-end">
                <button 
                  onClick={() => navigate('/dashboard')}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Voltar</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-6 sm:mb-8">
          <div className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
            isDark 
              ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
              : 'bg-white border-slate-200/50 shadow-sm'
          }`}>
            <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
            
            <div className="p-4 sm:p-6 lg:p-8">
              {renderActiveTab()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 