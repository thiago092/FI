import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import Categorias from './pages/Categorias'
import Cartoes from './pages/Cartoes'
import Contas from './pages/Contas'
import Transacoes from './pages/Transacoes'
import Planejamento from './pages/Planejamento'
import ChatIAPage from './pages/ChatIAPage'
import AdminDashboard from './pages/AdminDashboard'
import TelegramPage from './pages/TelegramPage'

function AppRoutes() {
  const { isAuthenticated, isAdmin, isTenantUser, isLoading, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Debug logs
  console.log('🔍 Debug App.tsx:', {
    isAuthenticated,
    isAdmin,
    isTenantUser,
    isLoading,
    userEmail: user?.email,
    userTenantId: user?.tenant_id,
    userIsGlobalAdmin: user?.is_global_admin,
    currentPath: location.pathname
  })

  // Redirecionamento automático após login
  useEffect(() => {
    if (isAuthenticated && location.pathname === '/login') {
      const targetPath = isAdmin ? '/admin' : '/dashboard'
      console.log(`🔄 Redirecionando de ${location.pathname} para ${targetPath}`)
      navigate(targetPath, { replace: true })
    }
  }, [isAuthenticated, isAdmin, location.pathname, navigate])

  if (isLoading) {
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
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />} />
        <Route path="/dashboard" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/categorias" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Categorias /> : <Navigate to="/login" replace />} />
        <Route path="/cartoes" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Cartoes /> : <Navigate to="/login" replace />} />
        <Route path="/contas" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Contas /> : <Navigate to="/login" replace />} />
        <Route path="/transacoes" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Transacoes /> : <Navigate to="/login" replace />} />
        <Route path="/planejamento" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Planejamento /> : <Navigate to="/login" replace />} />
        <Route path="/chat" element={isAuthenticated && (isTenantUser || !isAdmin) ? <ChatIAPage /> : <Navigate to="/login" replace />} />
        <Route path="/telegram" element={isAuthenticated && (isTenantUser || !isAdmin) ? <TelegramPage /> : <Navigate to="/login" replace />} />
        <Route path="/admin" element={isAuthenticated && isAdmin ? <AdminDashboard /> : <Navigate to="/login" replace />} />
        <Route path="/" element={<Navigate to={isAuthenticated ? (isAdmin ? "/admin" : "/dashboard") : "/login"} replace />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  )
}

export default App 