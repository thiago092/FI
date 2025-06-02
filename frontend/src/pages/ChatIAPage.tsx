import { useAuth } from '../contexts/AuthContext'
import Navigation from '../components/Navigation'
import ChatIA from '../components/ChatIA'

export default function ChatIAPage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navigation user={user} />
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
        <ChatIA />
      </div>
    </div>
  )
} 