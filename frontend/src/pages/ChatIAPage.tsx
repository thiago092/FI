import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Navigation from '../components/Navigation'
import { MessageCircle, ArrowRight, Bot, Smartphone } from 'lucide-react'

export default function ChatIAPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Redireciona automaticamente após 3 segundos
    const timer = setTimeout(() => {
      navigate('/settings?tab=telegram')
    }, 3000)

    return () => clearTimeout(timer)
  }, [navigate])

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-slate-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    )
  }

  const handleRedirect = () => {
    navigate('/settings?tab=telegram')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation user={user} />
      
      <div className="container-mobile pb-safe">
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-slate-200 dark:border-gray-700 p-8 text-center">
            {/* Ícone principal */}
            <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Bot className="w-10 h-10 text-white" />
            </div>

            {/* Título */}
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              Chat Movido para o Telegram!
            </h1>

            {/* Descrição */}
            <p className="text-slate-600 dark:text-gray-400 mb-6 leading-relaxed">
              Para uma experiência mais conveniente, nossa IA financeira agora está disponível diretamente no <strong>Telegram</strong>. 
              Configure seu bot e tenha acesso instantâneo às suas consultas financeiras!
            </p>

            {/* Benefícios */}
            <div className="bg-slate-50 dark:bg-gray-700 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center">
                <Smartphone className="w-4 h-4 mr-2" />
                Vantagens do Telegram:
              </h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-gray-400">
                <li>• Acesso direto no seu celular</li>
                <li>• Notificações em tempo real</li>
                <li>• Histórico sempre disponível</li>
                <li>• Interface mais rápida</li>
              </ul>
            </div>

            {/* Botão de redirecionamento */}
            <button
              onClick={handleRedirect}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Configurar Telegram</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Timer visual */}
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-4">
              Redirecionando automaticamente em alguns segundos...
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 