import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useAuth } from '../contexts/AuthContext'
import { adminApi } from '../services/api'
import { 
  UsersIcon, 
  BuildingOfficeIcon, 
  ChartBarIcon, 
  CpuChipIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  SpeakerWaveIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline'

const AdminDashboard = () => {
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'tenants' | 'metrics' | 'broadcast'>('overview')
  const [showDeleteModal, setShowDeleteModal] = useState<{show: boolean, type: 'user' | 'tenant', id: number, name: string} | null>(null)
  
  // Estados para broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [targetType, setTargetType] = useState<'all' | 'active' | 'specific'>('all')
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [showBroadcastResult, setShowBroadcastResult] = useState<any>(null)

  // Estados para criação
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false)
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [createTenantData, setCreateTenantData] = useState({ name: '', subdomain: '' })
  const [createUserData, setCreateUserData] = useState({ 
    full_name: '', 
    email: '', 
    password: '', 
    tenant_id: 0 
  })

  // Queries para dados do admin
  const { data: overview, isLoading: overviewLoading } = useQuery(
    'admin-overview', 
    () => adminApi.getOverview(),
    { refetchInterval: 30000 }
  )

  const { data: usersDetailed, isLoading: usersLoading } = useQuery(
    'admin-users', 
    () => adminApi.getUsersDetailed()
  )

  const { data: tokenMetrics, isLoading: tokensLoading } = useQuery(
    'admin-tokens', 
    () => adminApi.getTokenMetrics()
  )

  const { data: performance, isLoading: performanceLoading } = useQuery(
    'admin-performance', 
    () => adminApi.getPerformanceMetrics(),
    { refetchInterval: 5000 }
  )

  const { data: telegramUsers, isLoading: telegramUsersLoading } = useQuery(
    'admin-telegram-users',
    () => adminApi.getTelegramUsers(),
    { enabled: activeTab === 'broadcast' }
  )

  // Nova query para tenants
  const { data: tenants, isLoading: tenantsLoading } = useQuery(
    'admin-tenants',
    () => adminApi.getTenants(),
    { enabled: activeTab === 'tenants' }
  )

  // Mutations para excluir
  const deleteUserMutation = useMutation(
    (userId: number) => adminApi.deleteUser(userId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('admin-users')
        queryClient.invalidateQueries('admin-overview')
        setShowDeleteModal(null)
      }
    }
  )

  const deleteTenantMutation = useMutation(
    (tenantId: number) => adminApi.deleteTenant(tenantId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('admin-users')
        queryClient.invalidateQueries('admin-overview')
        setShowDeleteModal(null)
      }
    }
  )

  // Mutation para broadcast
  const broadcastMutation = useMutation(
    (messageData: { message: string; target_type: 'all' | 'active' | 'specific'; target_users?: number[] }) => 
      adminApi.sendBroadcastMessage(messageData),
    {
      onSuccess: (data) => {
        setShowBroadcastResult(data)
        setBroadcastMessage('')
        setSelectedUsers([])
      },
      onError: (error) => {
        setShowBroadcastResult({ 
          success: false, 
          message: 'Erro ao enviar mensagem broadcast' 
        })
      }
    }
  )

  // Mutations para criação
  const createTenantMutation = useMutation(
    (tenantData: { name: string; subdomain: string }) => adminApi.createTenant(tenantData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('admin-tenants')
        queryClient.invalidateQueries('admin-overview')
        setShowCreateTenantModal(false)
        setCreateTenantData({ name: '', subdomain: '' })
      }
    }
  )

  const createUserMutation = useMutation(
    (userData: { full_name: string; email: string; password: string; tenant_id: number }) => 
      adminApi.createUser(userData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('admin-users')
        queryClient.invalidateQueries('admin-overview')
        setShowCreateUserModal(false)
        setCreateUserData({ full_name: '', email: '', password: '', tenant_id: 0 })
      }
    }
  )

  const handleDelete = () => {
    if (!showDeleteModal) return
    
    if (showDeleteModal.type === 'user') {
      deleteUserMutation.mutate(showDeleteModal.id)
    } else {
      deleteTenantMutation.mutate(showDeleteModal.id)
    }
  }

  const handleBroadcast = () => {
    if (!broadcastMessage.trim()) return
    
    const messageData = {
      message: broadcastMessage.trim(),
      target_type: targetType,
      target_users: targetType === 'specific' ? selectedUsers : undefined
    }
    
    broadcastMutation.mutate(messageData)
  }

  const handleUserSelection = (userId: number) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId))
    } else {
      setSelectedUsers([...selectedUsers, userId])
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': case 'healthy': return 'text-green-600 bg-green-100'
      case 'alto': case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🔧 Painel Administrativo</h1>
              <p className="text-sm text-gray-600">Sistema de monitoramento e controle</p>
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

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'overview', label: '📊 Visão Geral', icon: ChartBarIcon },
              { key: 'users', label: '👥 Usuários', icon: UsersIcon },
              { key: 'tenants', label: '🏢 Tenants', icon: BuildingOfficeIcon },
              { key: 'metrics', label: '⚡ Performance', icon: CpuChipIcon },
              { key: 'broadcast', label: '📢 Broadcast', icon: SpeakerWaveIcon }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {overviewLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Carregando métricas...</p>
              </div>
            ) : overview ? (
              <>
                {/* Cards de Estatísticas */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <UsersIcon className="h-8 w-8 text-blue-600" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total de Usuários</dt>
                          <dd className="flex items-baseline">
                            <div className="text-2xl font-semibold text-gray-900">{overview.users.total}</div>
                            <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                              +{overview.users.este_mes} este mês
                            </div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <BuildingOfficeIcon className="h-8 w-8 text-green-600" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Tenants Ativos</dt>
                          <dd className="flex items-baseline">
                            <div className="text-2xl font-semibold text-gray-900">{overview.tenants.active}</div>
                            <div className="ml-2 flex items-baseline text-sm font-semibold text-blue-600">
                              de {overview.tenants.total}
                            </div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">T</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Telegram Conectado</dt>
                          <dd className="flex items-baseline">
                            <div className="text-2xl font-semibold text-gray-900">{overview.telegram.conectados}</div>
                            <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                              {overview.telegram.taxa_conexao}%
                            </div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ChartBarIcon className="h-8 w-8 text-purple-600" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Volume Financeiro</dt>
                          <dd className="flex items-baseline">
                            <div className="text-2xl font-semibold text-gray-900">
                              {formatCurrency(overview.financeiro.volume_total)}
                            </div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance do Sistema */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">🖥️ Performance do Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600">CPU</span>
                        <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStatusColor(overview.sistema.cpu.status)}`}>
                          {overview.sistema.cpu.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${overview.sistema.cpu.percent}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{overview.sistema.cpu.cores} cores</p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600">Memória</span>
                        <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStatusColor(overview.sistema.memory.status)}`}>
                          {overview.sistema.memory.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${overview.sistema.memory.percent}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {overview.sistema.memory.used_gb}GB / {overview.sistema.memory.total_gb}GB
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600">Disco</span>
                        <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStatusColor(overview.sistema.disk.status)}`}>
                          {overview.sistema.disk.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full" 
                          style={{ width: `${overview.sistema.disk.percent}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {overview.sistema.disk.used_gb}GB / {overview.sistema.disk.total_gb}GB
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tokens OpenAI */}
                {tokenMetrics && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">🤖 Uso de Tokens OpenAI</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{tokenMetrics.estimativa_tokens.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Tokens este mês</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(tokenMetrics.custo_estimado_brl)}</div>
                        <div className="text-sm text-gray-600">Custo estimado</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{tokenMetrics.tokens_por_dia.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Tokens/dia</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{tokenMetrics.atividades_telegram}</div>
                        <div className="text-sm text-gray-600">Atividades Telegram</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-4 italic">{tokenMetrics.observacao}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">Erro ao carregar dados</p>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">👥 Gerenciamento de Usuários</h2>
              <button
                onClick={() => setShowCreateUserModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <span>+</span> Criar Usuário
              </button>
            </div>

            {usersLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Carregando usuários...</p>
              </div>
            ) : usersDetailed ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {usersDetailed.users.map((user: any) => (
                    <li key={user.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-700">
                                  {user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center">
                                <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                                {user.is_global_admin && (
                                  <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                    Admin Global
                                  </span>
                                )}
                                {user.telegram.connected && (
                                  <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                    Telegram
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{user.email}</p>
                              {user.tenant && (
                                <p className="text-xs text-gray-400">Tenant: {user.tenant.name}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">{user.metrics.total_transacoes} transações</p>
                            <p className="text-sm text-gray-500">{formatCurrency(user.metrics.volume_financeiro)}</p>
                            <p className="text-xs text-gray-400">{user.metrics.dias_desde_criacao} dias</p>
                          </div>
                          
                          {!user.is_global_admin && (
                            <button
                              onClick={() => setShowDeleteModal({
                                show: true,
                                type: 'user',
                                id: user.id,
                                name: user.full_name
                              })}
                              className="text-red-600 hover:text-red-800"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">Erro ao carregar usuários</p>
              </div>
            )}
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">🏢 Gerenciamento de Tenants</h2>
              <button
                onClick={() => setShowCreateTenantModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <span>+</span> Criar Tenant
              </button>
            </div>

            {tenantsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Carregando tenants...</p>
              </div>
            ) : tenants ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {tenants.map((tenant: any) => (
                    <li key={tenant.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                                <span className="text-sm font-medium text-white">
                                  {tenant.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center">
                                <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                                {tenant.active && (
                                  <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                    Ativo
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">ID: {tenant.id}</p>
                              <p className="text-xs text-gray-400">Criado em: {formatDate(tenant.created_at)}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">{tenant.users_count} usuários</p>
                            <p className="text-sm text-gray-500">{tenant.transactions_count} transações</p>
                            <p className="text-xs text-gray-400">{formatCurrency(tenant.total_volume)}</p>
                          </div>
                          
                          <button
                            onClick={() => setShowDeleteModal({
                              show: true,
                              type: 'tenant',
                              id: tenant.id,
                              name: tenant.name
                            })}
                            className="text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">Erro ao carregar tenants</p>
              </div>
            )}
          </div>
        )}

        {/* Metrics/Performance Tab */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">⚡ Métricas de Performance</h2>
            </div>

            {performanceLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Carregando métricas de performance...</p>
              </div>
            ) : performance ? (
              <>
                {/* Performance do Sistema */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">🖥️ Performance do Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600">CPU</span>
                        <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStatusColor(performance.cpu.status)}`}>
                          {performance.cpu.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                          style={{ width: `${performance.cpu.percent}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{performance.cpu.cores} cores</p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600">Memória</span>
                        <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStatusColor(performance.memory.status)}`}>
                          {performance.memory.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-green-600 h-3 rounded-full transition-all duration-300" 
                          style={{ width: `${performance.memory.percent}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {performance.memory.used_gb}GB / {performance.memory.total_gb}GB
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600">Disco</span>
                        <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStatusColor(performance.disk.status)}`}>
                          {performance.disk.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-purple-600 h-3 rounded-full transition-all duration-300" 
                          style={{ width: `${performance.disk.percent}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {performance.disk.used_gb}GB / {performance.disk.total_gb}GB
                      </p>
                    </div>
                  </div>
                </div>

                {/* Métricas de Rede (se disponíveis) */}
                {performance.network && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">🌐 Tráfego de Rede</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-2">Bytes Enviados</p>
                        <p className="text-2xl font-semibold text-blue-600">{(performance.network.bytes_sent / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-2">Bytes Recebidos</p>
                        <p className="text-2xl font-semibold text-green-600">{(performance.network.bytes_recv / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Informações do Sistema */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">📊 Informações do Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{performance.uptime || 'N/A'}</div>
                      <div className="text-sm text-gray-600">Uptime</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{performance.processes || 'N/A'}</div>
                      <div className="text-sm text-gray-600">Processos</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">Erro ao carregar métricas de performance</p>
              </div>
            )}
          </div>
        )}

        {/* Broadcast Tab */}
        {activeTab === 'broadcast' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">📢 Broadcast Telegram</h2>
            </div>

            {/* Estatísticas de usuários Telegram */}
            {telegramUsers && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">T</span>
                      </div>
                    </div>
                    <div className="ml-5">
                      <p className="text-sm font-medium text-gray-500">Total Conectados</p>
                      <p className="text-2xl font-semibold text-gray-900">{telegramUsers.total}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ClockIcon className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="ml-5">
                      <p className="text-sm font-medium text-gray-500">Ativos 24h</p>
                      <p className="text-2xl font-semibold text-gray-900">{telegramUsers.active_24h}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CheckCircleIcon className="h-8 w-8 text-purple-600" />
                    </div>
                    <div className="ml-5">
                      <p className="text-sm font-medium text-gray-500">Ativos 7 dias</p>
                      <p className="text-2xl font-semibold text-gray-900">{telegramUsers.active_week}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Formulário de Broadcast */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Enviar Mensagem</h3>
              
              {/* Tipo de público */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Público Alvo</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="all"
                      checked={targetType === 'all'}
                      onChange={(e) => setTargetType(e.target.value as any)}
                      className="mr-2"
                    />
                    Todos os usuários conectados ({telegramUsers?.total || 0})
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="active"
                      checked={targetType === 'active'}
                      onChange={(e) => setTargetType(e.target.value as any)}
                      className="mr-2"
                    />
                    Apenas usuários ativos (últimas 24h) ({telegramUsers?.active_24h || 0})
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="specific"
                      checked={targetType === 'specific'}
                      onChange={(e) => setTargetType(e.target.value as any)}
                      className="mr-2"
                    />
                    Usuários específicos ({selectedUsers.length} selecionados)
                  </label>
                </div>
              </div>

              {/* Seleção de usuários específicos */}
              {targetType === 'specific' && telegramUsers && (
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Selecionar Usuários</label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
                    {telegramUsers.users.map((user: any) => (
                      <label key={user.user_id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.user_id)}
                          onChange={() => handleUserSelection(user.user_id)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="flex items-center">
                            <span className="font-medium text-sm">{user.full_name}</span>
                            {user.is_recent_active && (
                              <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                Ativo
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            @{user.telegram_username || user.telegram_first_name} • {user.email}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Textarea da mensagem */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Mensagem</label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Digite sua mensagem aqui... (Suporte a Markdown: **negrito**, *itálico*, etc.)"
                  rows={6}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {broadcastMessage.length} caracteres • Suporte a Markdown
                </p>
              </div>

              {/* Botão de envio */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {targetType === 'all' && `Enviará para ${telegramUsers?.total || 0} usuários`}
                  {targetType === 'active' && `Enviará para ${telegramUsers?.active_24h || 0} usuários ativos`}
                  {targetType === 'specific' && `Enviará para ${selectedUsers.length} usuários selecionados`}
                </div>
                <button
                  onClick={handleBroadcast}
                  disabled={!broadcastMessage.trim() || broadcastMutation.isLoading || (targetType === 'specific' && selectedUsers.length === 0)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {broadcastMutation.isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                      Enviar Broadcast
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Resultado do broadcast */}
            {showBroadcastResult && (
              <div className={`rounded-lg shadow p-6 ${showBroadcastResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center">
                  {showBroadcastResult.success ? (
                    <CheckCircleIcon className="h-8 w-8 text-green-600 mr-3" />
                  ) : (
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-600 mr-3" />
                  )}
                  <div>
                    <h3 className={`font-medium ${showBroadcastResult.success ? 'text-green-900' : 'text-red-900'}`}>
                      {showBroadcastResult.success ? 'Mensagem Enviada!' : 'Erro no Envio'}
                    </h3>
                    <p className={`text-sm ${showBroadcastResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {showBroadcastResult.message}
                    </p>
                    {showBroadcastResult.success && (
                      <div className="text-sm text-green-600 mt-1">
                        ✅ {showBroadcastResult.enviadas} enviadas • ❌ {showBroadcastResult.falharam} falharam
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowBroadcastResult(null)}
                  className="mt-3 text-sm text-gray-600 hover:text-gray-800"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-600" />
              <h3 className="text-lg font-medium text-gray-900 mt-2">
                Confirmar Exclusão
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Tem certeza que deseja excluir {showDeleteModal.type === 'user' ? 'o usuário' : 'o tenant'} <strong>{showDeleteModal.name}</strong>?
                <br />
                <span className="text-red-600 font-medium">Esta ação não pode ser desfeita!</span>
              </p>
              <div className="flex justify-center space-x-3 mt-4">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteUserMutation.isLoading || deleteTenantMutation.isLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {(deleteUserMutation.isLoading || deleteTenantMutation.isLoading) ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Tenant Modal */}
      {showCreateTenantModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 text-center mb-4">
                🏢 Criar Novo Tenant
              </h3>
              <form onSubmit={(e) => {
                e.preventDefault()
                createTenantMutation.mutate(createTenantData)
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Tenant
                    </label>
                    <input
                      type="text"
                      value={createTenantData.name}
                      onChange={(e) => setCreateTenantData({...createTenantData, name: e.target.value})}
                      placeholder="Ex: Empresa ABC"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subdomínio
                    </label>
                    <input
                      type="text"
                      value={createTenantData.subdomain}
                      onChange={(e) => setCreateTenantData({...createTenantData, subdomain: e.target.value})}
                      placeholder="ex: empresa-abc"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Apenas letras, números e hífens</p>
                  </div>
                </div>
                <div className="flex justify-center space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateTenantModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createTenantMutation.isLoading || !createTenantData.name || !createTenantData.subdomain}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {createTenantMutation.isLoading ? 'Criando...' : 'Criar Tenant'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 text-center mb-4">
                👤 Criar Novo Usuário
              </h3>
              <form onSubmit={(e) => {
                e.preventDefault()
                createUserMutation.mutate(createUserData)
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      value={createUserData.full_name}
                      onChange={(e) => setCreateUserData({...createUserData, full_name: e.target.value})}
                      placeholder="Ex: João Silva"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={createUserData.email}
                      onChange={(e) => setCreateUserData({...createUserData, email: e.target.value})}
                      placeholder="joao@empresa.com"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Senha
                    </label>
                    <input
                      type="password"
                      value={createUserData.password}
                      onChange={(e) => setCreateUserData({...createUserData, password: e.target.value})}
                      placeholder="Senha temporária"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tenant
                    </label>
                    <select
                      value={createUserData.tenant_id}
                      onChange={(e) => setCreateUserData({...createUserData, tenant_id: Number(e.target.value)})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value={0}>Selecionar tenant...</option>
                      {tenants?.map((tenant: any) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-center space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateUserModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createUserMutation.isLoading || !createUserData.full_name || !createUserData.email || !createUserData.password || !createUserData.tenant_id}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createUserMutation.isLoading ? 'Criando...' : 'Criar Usuário'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard 