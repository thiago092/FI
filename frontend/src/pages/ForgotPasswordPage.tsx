import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { authApi } from '../services/api';

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Carregar email da URL se disponível
  useEffect(() => {
    const emailFromUrl = searchParams.get('email');
    if (emailFromUrl) {
      setEmail(emailFromUrl);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Por favor, insira seu email.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await authApi.forgotPassword({ email });
      setSuccess('Se o email existir, você receberá instruções para recuperar sua senha.');
    } catch (error: any) {
      // Por segurança, sempre mostrar sucesso mesmo se der erro
      setSuccess('Se o email existir, você receberá instruções para recuperar sua senha.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Recuperar Senha
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400">
              Digite seu email para receber instruções de recuperação
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-800 dark:text-green-200 text-sm">{success}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Digite seu email"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all duration-200"
            >
              {isLoading ? 'Enviando...' : 'Enviar Instruções'}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Login</span>
            </Link>
          </div>

          {/* Additional Info */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 text-sm mb-2">
              📧 O que acontece depois?
            </h3>
            <ul className="text-blue-800 dark:text-blue-300 text-xs space-y-1">
              <li>• Você receberá um email com link de recuperação</li>
              <li>• O link expira em 1 hora por segurança</li>
              <li>• Verifique sua pasta de spam se não receber</li>
              <li>• Você poderá definir uma nova senha</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 