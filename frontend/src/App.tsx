import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { QueryClient, QueryClientProvider } from 'react-query'
import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import EmailVerificationPage from './pages/EmailVerificationPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Dashboard from './pages/Dashboard'
import Categorias from './pages/Categorias'
import Cartoes from './pages/Cartoes'
import FaturaCartao from './pages/FaturaCartao'
import Contas from './pages/Contas'
import Transacoes from './pages/Transacoes'
import TransacoesRecorrentes from './pages/TransacoesRecorrentes'
import Financiamentos from './pages/Financiamentos'
import Planejamento from './pages/Planejamento'

import AdminDashboard from './pages/AdminDashboard'
import Settings from './pages/Settings'

// Criar cliente do React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos
      refetchOnWindowFocus: false,
    },
  },
})

function AppRoutes() {
  const { isAuthenticated, isAdmin, isTenantUser, isLoading, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()



  // Redirecionamento automático após login
  useEffect(() => {
    if (isAuthenticated && location.pathname === '/login') {
      const targetPath = isAdmin ? '/admin' : '/dashboard'

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />} />
        <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPasswordPage /> : <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />} />
        <Route path="/reset-password" element={!isAuthenticated ? <ResetPasswordPage /> : <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />} />
        <Route path="/dashboard" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/categorias" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Categorias /> : <Navigate to="/login" replace />} />
        <Route path="/cartoes" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Cartoes /> : <Navigate to="/login" replace />} />
        <Route path="/cartoes/:cartaoId/fatura" element={isAuthenticated && (isTenantUser || !isAdmin) ? <FaturaCartao /> : <Navigate to="/login" replace />} />
        <Route path="/contas" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Contas /> : <Navigate to="/login" replace />} />
        <Route path="/transacoes" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Transacoes /> : <Navigate to="/login" replace />} />
        <Route path="/transacoes-recorrentes" element={isAuthenticated && (isTenantUser || !isAdmin) ? <TransacoesRecorrentes /> : <Navigate to="/login" replace />} />
        <Route path="/financiamentos" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Financiamentos /> : <Navigate to="/login" replace />} />
        <Route path="/planejamento" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Planejamento /> : <Navigate to="/login" replace />} />

        <Route path="/settings" element={isAuthenticated && (isTenantUser || !isAdmin) ? <Settings /> : <Navigate to="/login" replace />} />
        <Route path="/admin" element={isAuthenticated && isAdmin ? <AdminDashboard /> : <Navigate to="/login" replace />} />
        <Route path="/" element={<Navigate to={isAuthenticated ? (isAdmin ? "/admin" : "/dashboard") : "/login"} replace />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AppRoutes />
        </Router>
      </QueryClientProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}

export default App 