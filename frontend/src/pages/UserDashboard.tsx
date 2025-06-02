import { useAuth } from '../contexts/AuthContext'

const UserDashboard = () => {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">FinançasAI</h1>
              <p className="text-sm text-gray-600">Bem-vindo, {user?.full_name}</p>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Dashboard do Usuário</h2>
          <p className="text-gray-600">Esta é a área do usuário. As funcionalidades de finanças serão implementadas aqui.</p>
        </div>
      </main>
    </div>
  )
}

export default UserDashboard 