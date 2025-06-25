import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, User, CheckCircle, AlertCircle, TrendingUp, Brain, Shield, Zap, Users, Gift } from 'lucide-react'
import { authApi } from '../services/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const { showSuccess, showError, showInfo, toasts, removeToast } = useToast();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [emailExists, setEmailExists] = useState(false)
  const [emailExistsStatus, setEmailExistsStatus] = useState<'unverified' | 'verified' | null>(null)
  const [emailCheckStatus, setEmailCheckStatus] = useState<{
    exists: boolean
    is_verified: boolean
    has_pending_invite: boolean
    tenant_name?: string
    suggested_actions: Array<{
      action_type: string
      label: string
      description: string
      endpoint?: string
    }>
  } | null>(null)
  
  // Estados para convite
  const [hasInvite, setHasInvite] = useState(false)
  const [inviteToken, setInviteToken] = useState('')
  const [inviteInfo, setInviteInfo] = useState<{
    inviter_name?: string
    tenant_name?: string
  } | null>(null)
  
  const navigate = useNavigate()

  // Detectar convite na URL
  useEffect(() => {
    const invite = searchParams.get('invite');
    if (invite) {
      setHasInvite(true);
      setInviteToken(invite);
      showInfo(
        '🎉 Convite detectado!', 
        'Você foi convidado para uma equipe. Complete seu cadastro para aceitar o convite e ter acesso aos dados financeiros compartilhados.',
        {
          duration: 8000 // Toast fica mais tempo visível para convites
        }
      );
    }
  }, [searchParams, showInfo]);

  // Função para verificar status do email
  const checkEmailStatus = async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailCheckStatus(null)
      return
    }

    try {
      const response = await authApi.checkEmail({ email })
      setEmailCheckStatus(response)
      
      if (response.exists) {
        setEmailExists(true)
        setEmailExistsStatus(response.is_verified ? 'verified' : 'unverified')
        
        // Exibir toasts baseados no status
        if (response.is_verified) {
          showError(
            'Email já cadastrado',
            `Este email já possui uma conta ativa${response.tenant_name ? ` em ${response.tenant_name}` : ''}.`,
            {
              action: {
                label: 'Fazer login',
                onClick: () => navigate('/login', { state: { email } })
              }
            }
          )
        } else {
          showInfo(
            'Email não verificado',
            'Este email foi cadastrado mas não foi verificado.',
            {
              action: {
                label: 'Reenviar verificação',
                onClick: () => handleResendVerification()
              }
            }
          )
        }
      } else if (response.has_pending_invite) {
        showInfo(
          'Convite pendente!',
          `Você foi convidado para ${response.tenant_name || 'uma equipe'}.`,
          {
            action: {
              label: 'Aceitar convite',
              onClick: () => navigate('/register?invite=true')
            }
          }
        )
      } else {
        setEmailExists(false)
        setEmailExistsStatus(null)
        showSuccess(
          'Email disponível',
          'Este email está livre para cadastro.'
        )
      }
    } catch (error) {
      console.error('Erro ao verificar email:', error)
      setEmailCheckStatus(null)
      showError(
        'Erro na verificação',
        'Não foi possível verificar o email. Tente novamente.'
      )
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
    
    // Verificar email quando mudar
    if (name === 'email') {
      setEmailExists(false)
      setEmailExistsStatus(null)
      setEmailCheckStatus(null)
      
      // Debounce para verificar email após 1 segundo
      const timeoutId = setTimeout(() => {
        if (value.trim()) {
          checkEmailStatus(value.trim().toLowerCase())
        }
      }, 1000)
      
      return () => clearTimeout(timeoutId)
    }
  }

  const validateForm = () => {
    if (!formData.full_name.trim()) {
      showError('Campo obrigatório', 'Nome completo é obrigatório');
      return false
    }
    if (formData.full_name.trim().length < 2) {
      showError('Nome inválido', 'Nome deve ter pelo menos 2 caracteres');
      return false
    }
    if (!formData.email.trim()) {
      showError('Campo obrigatório', 'Email é obrigatório');
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showError('Email inválido', 'Digite um email válido');
      return false
    }
    if (!formData.password) {
      showError('Campo obrigatório', 'Senha é obrigatória');
      return false
    }
    if (formData.password.length < 8) {
      showError('Senha fraca', 'Senha deve ter pelo menos 8 caracteres');
      return false
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      showError('Senha fraca', 'Senha deve conter letra maiúscula, minúscula e número');
      return false
    }
    if (formData.password !== formData.confirm_password) {
      showError('Senhas diferentes', 'As senhas não coincidem');
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsLoading(true)
    setError('')

    try {
      let response;
      
      if (hasInvite && inviteToken) {
        // Registro com convite
        response = await authApi.registerWithInvite({
          ...formData,
          invite_token: inviteToken
        });
        showSuccess(
          '🎉 Convite aceito com sucesso!', 
          'Você foi adicionado à equipe automaticamente e já pode acessar o dashboard compartilhado.',
          {
            duration: 6000
          }
        );
      } else {
        // Registro normal
        response = await authApi.register(formData);
        showSuccess(
          '✅ Conta criada com sucesso!', 
          'Verifique seu email para confirmar a conta e começar a usar o sistema.',
          {
            duration: 5000
          }
        );
      }
      
      setSuccess(response.message)
      setRegistrationComplete(true)
      
      // Resetar formulário
      setFormData({
        full_name: '',
        email: '',
        password: '',
        confirm_password: ''
      })
      
    } catch (error: any) {
      console.error('❌ Registration Error:', error)
      
      // Verificar se é erro de email já existente
      const errorDetail = error.response?.data?.detail || ''
      if (errorDetail.includes('já foi cadastrado') || 
          errorDetail.includes('já está cadastrado') ||
          errorDetail.includes('already registered') ||
          error.response?.status === 409) {
        
        setEmailExists(true)
        
        // Verificar se o email não foi verificado
        if (errorDetail.includes('não verificado')) {
          setEmailExistsStatus('unverified')
          showError(
            'Email não verificado', 
            'Este email já foi cadastrado mas não foi verificado. Verifique sua caixa de entrada ou reenvie a verificação.',
            {
              action: {
                label: 'Reenviar verificação',
                onClick: () => handleResendVerification()
              }
            }
          );
        } else {
          setEmailExistsStatus('verified')
          showError(
            'Usuário já existe', 
            'Este email já está cadastrado. Tente fazer login ou recuperar sua senha.',
            {
              action: {
                label: 'Fazer login',
                onClick: () => navigate('/login', { state: { email: formData.email } })
              }
            }
          );
        }
      } else if (errorDetail.includes('Token de convite inválido')) {
        showError(
          '❌ Convite inválido', 
          'Este convite expirou ou é inválido. Solicite um novo convite à pessoa que te convidou.',
          {
            duration: 8000
          }
        );
      } else {
        const errorMessage = errorDetail || error.message || 'Erro no cadastro';
        setError(errorMessage);
        showError('Erro no cadastro', errorMessage);
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!formData.email) return

    setIsLoading(true)
    try {
      await authApi.resendVerification({ email: formData.email })
      showSuccess('Email reenviado!', 'Verifique sua caixa de entrada.');
      setSuccess('Email de verificação reenviado! Verifique sua caixa de entrada.')
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Erro ao reenviar email';
      showError('Erro ao reenviar', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = () => {
    // Redirecionar para página de recuperação de senha
    navigate(`/forgot-password?email=${encodeURIComponent(formData.email)}`);
  }

  const handleTryAnotherEmail = () => {
    setEmailExists(false);
    setEmailExistsStatus(null);
    setError('');
    setSuccess('');
    setFormData(prev => ({ ...prev, email: '' }));
  }

  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {hasInvite ? 'Convite Aceito!' : 'Cadastro Realizado!'}
            </h1>
            
            {hasInvite ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
                <p className="text-green-800 dark:text-green-200 text-sm">
                  <strong>🎉 Parabéns!</strong><br />
                  Você foi adicionado à equipe com sucesso!
                </p>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  <strong>📧 Verifique seu email</strong><br />
                  Enviamos um link de verificação para <strong>{formData.email}</strong>
                </p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
                <p className="text-green-800 dark:text-green-200 text-sm">
                  {success}
                </p>
              </div>
            )}

            <div className="space-y-4">
              {!hasInvite && (
                <button
                  onClick={handleResendVerification}
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all duration-200"
                >
                  {isLoading ? 'Reenviando...' : '📧 Reenviar Email de Verificação'}
                </button>
              )}

              <button
                onClick={handleForgotPassword}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-all duration-200"
              >
                🔑 Recuperar Senha
              </button>

              <Link
                to="/login"
                className="block w-full py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 text-center"
              >
                Voltar ao Login
              </Link>

              <button
                onClick={handleTryAnotherEmail}
                className="block w-full py-3 px-4 text-blue-600 dark:text-blue-400 font-medium rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 text-center"
              >
                Tentar com outro email
              </button>
            </div>

            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                💡 O que fazer agora?
              </h3>
              <ul className="text-gray-600 dark:text-gray-400 text-xs space-y-1 text-left">
                {hasInvite ? (
                  <>
                    <li>• <strong>Fazer login:</strong> Acesse sua conta recém-criada</li>
                    <li>• <strong>Explorar o workspace:</strong> Conheça as funcionalidades da equipe</li>
                    <li>• <strong>Configurar perfil:</strong> Personalize suas preferências</li>
                  </>
                ) : (
                  <>
                    {emailExistsStatus === 'unverified' && (
                      <li>• <strong>Reenviar verificação:</strong> Se você não recebeu o email de confirmação</li>
                    )}
                    <li>• <strong>Recuperar senha:</strong> Se você esqueceu sua senha</li>
                    <li>• <strong>Fazer login:</strong> Se você já tem uma conta ativa</li>
                    <li>• <strong>Usar outro email:</strong> Para criar uma nova conta</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="flex min-h-screen">
        
        {/* Left Panel - Features */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-12 items-center justify-center">
          <div className="max-w-lg text-white">
            {hasInvite ? (
              <>
                <div className="flex items-center space-x-3 mb-8">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Gift className="w-6 h-6" />
                  </div>
                  <h1 className="text-4xl font-bold">
                    Convite Aceito! 🎉
                  </h1>
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Junte-se à Equipe</h3>
                      <p className="text-blue-100">Você foi convidado para fazer parte de uma equipe colaborativa</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Dashboard Compartilhado</h3>
                      <p className="text-blue-100">Acesse dados financeiros e relatórios da equipe</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <Brain className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">IA Colaborativa</h3>
                      <p className="text-blue-100">Assistente inteligente para decisões em equipe</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Segurança Total</h3>
                      <p className="text-blue-100">Dados protegidos e acesso controlado</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-4xl font-bold mb-8">
                  Bem-vindo ao Finanças AI! 🚀
                </h1>
                
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Controle Inteligente</h3>
                      <p className="text-blue-100">Monitore suas finanças com IA e tome decisões mais inteligentes</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <Brain className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Assistente IA</h3>
                      <p className="text-blue-100">Chat inteligente para dúvidas financeiras e planejamento</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Segurança Total</h3>
                      <p className="text-blue-100">Dados criptografados e proteção avançada da sua privacidade</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Automação</h3>
                      <p className="text-blue-100">Automatize recorrências e receba notificações inteligentes</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Panel - Register Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="max-w-md w-full">
            
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                {hasInvite ? 'Aceitar Convite' : 'Criar Conta'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {hasInvite 
                  ? 'Complete seu cadastro para juntar-se à equipe'
                  : 'Comece a controlar suas finanças hoje mesmo'
                }
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Full Name Field */}
              <div>
                <label htmlFor="full_name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Digite seu nome completo"
                    required
                  />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-700 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                      emailCheckStatus?.exists
                        ? emailCheckStatus.is_verified
                          ? 'border-amber-300 focus:ring-amber-500 dark:border-amber-600'
                          : 'border-blue-300 focus:ring-blue-500 dark:border-blue-600'
                        : emailCheckStatus?.has_pending_invite
                        ? 'border-purple-300 focus:ring-purple-500 dark:border-purple-600'
                        : 'border-gray-200 focus:ring-blue-500 dark:border-gray-600'
                    }`}
                    placeholder="Digite seu email"
                    required
                  />
                </div>


              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Deve conter pelo menos 8 caracteres, uma letra maiúscula, minúscula e número
                </p>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label htmlFor="confirm_password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="confirm_password"
                    name="confirm_password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirm_password}
                    onChange={handleChange}
                    className="w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Digite a senha novamente"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-[1.02] ${
                  isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : hasInvite
                    ? 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 shadow-lg hover:shadow-xl'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {hasInvite ? 'Aceitando convite...' : 'Criando conta...'}
                  </span>
                ) : (
                  hasInvite ? 'Aceitar Convite' : 'Criar Conta'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Já tem uma conta?{' '}
                <Link
                  to="/login"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition-colors duration-200"
                >
                  Fazer Login
                </Link>
              </p>
            </div>

            {/* Terms */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ao criar uma conta, você concorda com nossos{' '}
                <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Termos de Uso</a>
                {' '}e{' '}
                <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Política de Privacidade</a>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Toast Container */}
      <ToastContainer 
        toasts={toasts} 
        onRemoveToast={removeToast}
        position="top-right"
      />
    </div>
  )
} 