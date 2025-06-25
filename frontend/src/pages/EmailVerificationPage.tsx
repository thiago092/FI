import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { authApi } from '../services/api';

export default function EmailVerificationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setVerificationStatus('error');
        setError('Token de verificação não encontrado.');
        return;
      }

      try {
        const response = await authApi.verifyEmail(token);
        setVerificationStatus('success');
        setMessage(response.message || 'Email verificado com sucesso!');
      } catch (error: any) {
        setVerificationStatus('error');
        setError(error.response?.data?.detail || 'Erro ao verificar email.');
      }
    };

    verifyEmail();
  }, [searchParams]);

  const handleResendVerification = async () => {
    // Aqui você pode implementar o reenvio de verificação
    // Por enquanto, vamos redirecionar para a página de login
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 text-center">
          
          {/* Loading State */}
          {verificationStatus === 'loading' && (
            <>
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Verificando Email...
              </h1>
              
              <p className="text-gray-600 dark:text-gray-400">
                Estamos verificando seu email. Aguarde um momento.
              </p>
            </>
          )}

          {/* Success State */}
          {verificationStatus === 'success' && (
            <>
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Email Verificado! 🎉
              </h1>
              
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
                <p className="text-green-800 dark:text-green-200 text-sm">
                  {message}
                </p>
              </div>

              <div className="space-y-4">
                <Link
                  to="/login"
                  className="block w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-all duration-200"
                >
                  Fazer Login
                </Link>
                
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sua conta está ativa e pronta para uso!
                </p>
              </div>
            </>
          )}

          {/* Error State */}
          {verificationStatus === 'error' && (
            <>
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Erro na Verificação
              </h1>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                <p className="text-red-800 dark:text-red-200 text-sm">
                  {error}
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleResendVerification}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all duration-200"
                >
                  Tentar Novamente
                </button>
                
                <Link
                  to="/login"
                  className="block w-full py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 text-center"
                >
                  Voltar ao Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 