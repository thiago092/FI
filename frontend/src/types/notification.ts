export interface NotificationPreference {
  id: number;
  tenant_id: number;
  telegram_user_id: number;
  notification_type: 'daily' | 'weekly' | 'monthly';
  notification_hour: number; // 0-23
  day_of_week?: number; // 0-6 (0=domingo)
  day_of_month?: number; // 1-28
  include_balance: boolean;
  include_transactions: boolean;
  include_categories: boolean;
  include_insights: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferenceCreate {
  telegram_user_id: number;
  notification_type: 'daily' | 'weekly' | 'monthly';
  notification_hour: number;
  day_of_week?: number;
  day_of_month?: number;
  include_balance?: boolean;
  include_transactions?: boolean;
  include_categories?: boolean;
  include_insights?: boolean;
  is_active?: boolean;
}

export interface NotificationPreferenceUpdate {
  notification_type?: 'daily' | 'weekly' | 'monthly';
  notification_hour?: number;
  day_of_week?: number;
  day_of_month?: number;
  telegram_user_id?: number;
  include_balance?: boolean;
  include_transactions?: boolean;
  include_categories?: boolean;
  include_insights?: boolean;
  is_active?: boolean;
}

export interface NotificationConfig {
  notification_hour: number;
  day_of_week: number;
  day_of_month: number;
  include_balance: boolean;
  include_transactions: boolean;
  include_categories: boolean;
  include_insights: boolean;
}

export const NOTIFICATION_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly'
} as const;

export const WEEK_DAYS = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda', short: 'Seg' },
  { value: 2, label: 'Terça', short: 'Ter' },
  { value: 3, label: 'Quarta', short: 'Qua' },
  { value: 4, label: 'Quinta', short: 'Qui' },
  { value: 5, label: 'Sexta', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' }
];

export const NOTIFICATION_CONTENT_OPTIONS = [
  { key: 'include_balance', label: '💰 Saldo atual', description: 'Saldo total das contas' },
  { key: 'include_transactions', label: '💳 Transações', description: 'Lista das movimentações' },
  { key: 'include_categories', label: '📊 Por categoria', description: 'Gastos agrupados por categoria' },
  { key: 'include_insights', label: '💡 Insights', description: 'Análises e dicas automáticas' }
]; 