import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, LoginCredentials, AuthResponse } from '../types/auth'
import { authApi } from '../services/api'

interface AuthContextType {
  user: User | null
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  isTenantUser: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Verificar se há token salvo
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    
    setIsLoading(false)
  }, [])

  const login = async (credentials: LoginCredentials) => {
    try {
      console.log('🔄 AuthContext: Iniciando login...', credentials)
      const response: AuthResponse = await authApi.login(credentials)
      console.log('✅ AuthContext: Resposta recebida:', response)
      
      localStorage.setItem('token', response.access_token)
      localStorage.setItem('user', JSON.stringify(response.user))
      
      setUser(response.user)
      console.log('✅ AuthContext: Login concluído com sucesso!')
    } catch (error) {
      console.error('❌ AuthContext: Erro no login:', error)
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.is_global_admin || false,
    isTenantUser: !!user?.tenant_id && !user?.is_global_admin,
  }

  // Debug logs
  if (user) {
    console.log('🔍 AuthContext Debug:', {
      email: user.email,
      is_global_admin: user.is_global_admin,
      tenant_id: user.tenant_id,
      isAdmin: user?.is_global_admin || false,
      isTenantUser: !!user?.tenant_id && !user?.is_global_admin,
    })
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 