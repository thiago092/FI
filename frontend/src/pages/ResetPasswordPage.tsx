import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { authApi } from '../services/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Token de recuperação não encontrado.');
    } else {
      setStatus('loading');
    }
  }, [token]);

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    return {
      isValid: minLength && hasUpperCase && hasLowerCase && hasNumbers,
      minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setError('Token de recuperação não encontrado.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setError('A senha deve ter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas e números.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.resetPassword({ 
        token, 
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      setStatus('success');
      setMessage(response.message || 'Senha redefinida com sucesso!');
    } catch (error: any) {
      setStatus('error');
      setError(error.response?.data?.detail || 'Erro ao redefinir senha.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordValidation = validatePassword(newPassword);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Nova Senha
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400">
              Digite sua nova senha para redefinir o acesso
            </p>
          </div>

          {/* Loading State */}
          {status === 'loading' && !token && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Verificando token...</p>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                Senha Redefinida! 🎉
              </h2>
              
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
                <p className="text-green-800 dark:text-green-200 text-sm text-center">
                  {message}
                </p>
              </div>

              <Link
                to="/login"
                className="block w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-all duration-200 text-center"
              >
                Fazer Login
              </Link>
            </>
          )}

          {/* Error State */}
          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                Erro na Redefinição
              </h2>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                <p className="text-red-800 dark:text-red-200 text-sm text-center">
                  {error}
                </p>
              </div>

              <Link
                to="/forgot-password"
                className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all duration-200 text-center"
              >
                Solicitar Novo Link
              </Link>
            </>
          )}

          {/* Form */}
          {status === 'loading' && token && (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* New Password Field */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Digite sua nova senha"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Password Validation */}
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className={`flex items-center space-x-2 text-xs ${passwordValidation.minLength ? 'text-green-600' : 'text-red-600'}`}>
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.minLength ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span>Mínimo 8 caracteres</span>
                    </div>
                    <div className={`flex items-center space-x-2 text-xs ${passwordValidation.hasUpperCase ? 'text-green-600' : 'text-red-600'}`}>
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.hasUpperCase ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span>Pelo menos 1 maiúscula</span>
                    </div>
                    <div className={`flex items-center space-x-2 text-xs ${passwordValidation.hasLowerCase ? 'text-green-600' : 'text-red-600'}`}>
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.hasLowerCase ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span>Pelo menos 1 minúscula</span>
                    </div>
                    <div className={`flex items-center space-x-2 text-xs ${passwordValidation.hasNumbers ? 'text-green-600' : 'text-red-600'}`}>
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.hasNumbers ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span>Pelo menos 1 número</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Confirme sua nova senha"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !passwordValidation.isValid || newPassword !== confirmPassword}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all duration-200"
              >
                {isLoading ? 'Redefinindo...' : 'Redefinir Senha'}
              </button>
            </form>
          )}

          {/* Back to Login */}
          {status === 'loading' && token && (
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
              >
                Voltar ao Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 