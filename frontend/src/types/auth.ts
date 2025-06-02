export interface User {
  id: number
  email: string
  full_name: string
  is_active: boolean
  is_global_admin: boolean
  tenant_id?: number
  created_at: string
  tenant?: Tenant
}

export interface Tenant {
  id: number
  name: string
  subdomain: string
  is_active: boolean
  created_at: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface CreateUserData {
  email: string
  full_name: string
  password: string
  tenant_id?: number
}

export interface CreateTenantData {
  name: string
  subdomain: string
} 