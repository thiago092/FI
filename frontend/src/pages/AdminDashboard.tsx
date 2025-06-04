import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useAuth } from '../contexts/AuthContext'
import { 
  UsersIcon, 
  BuildingOfficeIcon, 
  ChartBarIcon, 
  CpuChipIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

const AdminDashboard = () => {
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'tenants' | 'metrics'>('overview')
  const [showDeleteModal, setShowDeleteModal] = useState<{show: boolean, type: 'user' | 'tenant', id: number, name: string} | null>(null)

  // Queries para dados do admin
  const { data: overview, isLoading: overviewLoading } = useQuery(
    'admin-overview', 
    () => fetch('/api/admin/dashboard/overview').then(res => res.json()),
    { refetchInterval: 30000 }
  )

  const { data: usersDetailed, isLoading: usersLoading } = useQuery(
    'admin-users', 
    () => fetch('/api/admin/users/detailed').then(res => res.json())
  )

  const { data: tokenMetrics, isLoading: tokensLoading } = useQuery(
    'admin-tokens', 
    () => fetch('/api/admin/metrics/tokens').then(res => res.json())
  )

  const { data: performance, isLoading: performanceLoading } = useQuery(
    'admin-performance', 
    () => fetch('/api/admin/metrics/performance').then(res => res.json()),
    { refetchInterval: 5000 }
  )

  // Mutations para excluir
  const deleteUserMutation = useMutation(
    (userId: number) => fetch(`/api/admin/users/${userId}`, { method: 'DELETE' }).then(res => res.json()),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('admin-users')
        queryClient.invalidateQueries('admin-overview')
        setShowDeleteModal(null)
      }
    }
  )

  const deleteTenantMutation = useMutation(
    (tenantId: number) => fetch(`/api/admin/tenants/${tenantId}`, { method: 'DELETE' }).then(res => res.json()),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('admin-users')
        queryClient.invalidateQueries('admin-overview')
        setShowDeleteModal(null)
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
              { key: 'metrics', label: '⚡ Performance', icon: CpuChipIcon }
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
    </div>
  )
}

export default AdminDashboard 