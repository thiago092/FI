-- Script SQL Simples - Sistema de Notificações
-- Para rodar no DBeaver (PostgreSQL)

-- 1. CRIAR TABELA
CREATE TABLE notification_preferences (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    telegram_user_id BIGINT NOT NULL,
    notification_type VARCHAR(20) NOT NULL,
    notification_hour INTEGER NOT NULL,
    day_of_week INTEGER NULL,
    day_of_month INTEGER NULL,
    include_balance BOOLEAN DEFAULT true,
    include_transactions BOOLEAN DEFAULT true,
    include_categories BOOLEAN DEFAULT true,
    include_insights BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CRIAR ÍNDICES
CREATE INDEX idx_notification_tenant ON notification_preferences(tenant_id);
CREATE INDEX idx_notification_active ON notification_preferences(is_active);
CREATE INDEX idx_notification_type_hour ON notification_preferences(notification_type, notification_hour);

-- 3. INSERIR DADOS DE TESTE
INSERT INTO notification_preferences (
    tenant_id, 
    telegram_user_id, 
    notification_type, 
    notification_hour
) VALUES (
    1, 
    123456789, 
    'daily',
    9
);

-- 4. VERIFICAR SE FUNCIONOU
SELECT * FROM notification_preferences;

-- REFERÊNCIA:
-- notification_type: 'daily', 'weekly', 'monthly'
-- notification_hour: 0-23 (formato 24h)
-- day_of_week: 0=domingo, 1=segunda, etc (só para weekly)
-- day_of_month: 1-28 (só para monthly) 