-- ====================================================
-- SISTEMA DE NOTIFICAÇÕES AUTOMÁTICAS
-- Script para criar tabela notification_preferences
-- PostgreSQL - Para rodar no DBeaver
-- ====================================================

-- Verificar se a tabela já existe antes de criar
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notification_preferences'
    ) THEN
        
        -- Criar tabela de preferências de notificação
        CREATE TABLE notification_preferences (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            telegram_user_id BIGINT NOT NULL,
            
            -- Tipo de notificação
            notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('daily', 'weekly', 'monthly')),
            
            -- Configurações de horário
            notification_hour INTEGER NOT NULL CHECK (notification_hour >= 0 AND notification_hour <= 23),
            day_of_week INTEGER NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=domingo, 6=sábado
            day_of_month INTEGER NULL CHECK (day_of_month >= 1 AND day_of_month <= 28),
            
            -- Configurações de conteúdo
            include_balance BOOLEAN DEFAULT true,
            include_transactions BOOLEAN DEFAULT true,
            include_categories BOOLEAN DEFAULT true,
            include_insights BOOLEAN DEFAULT true,
            
            -- Controle
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            -- Constraints para garantir configuração correta
            CONSTRAINT valid_weekly_config CHECK (
                notification_type != 'weekly' OR day_of_week IS NOT NULL
            ),
            CONSTRAINT valid_monthly_config CHECK (
                notification_type != 'monthly' OR day_of_month IS NOT NULL
            ),
            
            -- Evitar duplicatas (um usuário só pode ter uma config por tipo)
            CONSTRAINT unique_user_notification_type UNIQUE (tenant_id, notification_type)
        );
        
        -- Comentários para documentação
        COMMENT ON TABLE notification_preferences IS 'Preferências de notificações automáticas dos usuários';
        COMMENT ON COLUMN notification_preferences.tenant_id IS 'ID do tenant/usuário no sistema';
        COMMENT ON COLUMN notification_preferences.telegram_user_id IS 'ID do usuário no Telegram';
        COMMENT ON COLUMN notification_preferences.notification_type IS 'Tipo: daily, weekly, monthly';
        COMMENT ON COLUMN notification_preferences.notification_hour IS 'Hora do dia para enviar (0-23)';
        COMMENT ON COLUMN notification_preferences.day_of_week IS 'Dia da semana para notificações semanais (0=domingo)';
        COMMENT ON COLUMN notification_preferences.day_of_month IS 'Dia do mês para notificações mensais (1-28)';
        
        -- Criar índices para performance
        CREATE INDEX idx_notification_preferences_tenant ON notification_preferences(tenant_id);
        CREATE INDEX idx_notification_preferences_telegram ON notification_preferences(telegram_user_id);
        CREATE INDEX idx_notification_preferences_active ON notification_preferences(is_active) WHERE is_active = true;
        CREATE INDEX idx_notification_preferences_daily ON notification_preferences(notification_type, notification_hour) WHERE notification_type = 'daily';
        CREATE INDEX idx_notification_preferences_weekly ON notification_preferences(notification_type, day_of_week, notification_hour) WHERE notification_type = 'weekly';
        CREATE INDEX idx_notification_preferences_monthly ON notification_preferences(notification_type, day_of_month, notification_hour) WHERE notification_type = 'monthly';
        
        RAISE NOTICE 'Tabela notification_preferences criada com sucesso!';
    ELSE
        RAISE NOTICE 'Tabela notification_preferences já existe, pulando criação...';
    END IF;
END $$;

-- ====================================================
-- DADOS DE EXEMPLO PARA TESTE
-- ====================================================

-- Inserir algumas preferências de exemplo (apenas se a tabela estiver vazia)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM notification_preferences LIMIT 1) THEN
        
        -- Exemplo 1: Usuário quer notificação diária às 9h
        INSERT INTO notification_preferences (
            tenant_id, 
            telegram_user_id, 
            notification_type, 
            notification_hour,
            include_balance,
            include_transactions,
            include_categories,
            include_insights
        ) VALUES (
            1, -- tenant_id (ajuste conforme seus dados)
            123456789, -- telegram_user_id (ajuste conforme seus dados)
            'daily',
            9, -- 9h da manhã
            true,
            true,
            true,
            false
        );
        
        -- Exemplo 2: Usuário quer notificação semanal às segundas 18h
        INSERT INTO notification_preferences (
            tenant_id, 
            telegram_user_id, 
            notification_type, 
            notification_hour,
            day_of_week,
            include_balance,
            include_transactions,
            include_categories,
            include_insights
        ) VALUES (
            1, -- tenant_id
            123456789, -- telegram_user_id
            'weekly',
            18, -- 18h
            1, -- Segunda-feira (0=domingo, 1=segunda)
            true,
            true,
            false,
            true
        );
        
        -- Exemplo 3: Usuário quer notificação mensal no dia 1 às 10h
        INSERT INTO notification_preferences (
            tenant_id, 
            telegram_user_id, 
            notification_type, 
            notification_hour,
            day_of_month,
            include_balance,
            include_transactions,
            include_categories,
            include_insights
        ) VALUES (
            1, -- tenant_id
            123456789, -- telegram_user_id
            'monthly',
            10, -- 10h da manhã
            1, -- Dia 1 do mês
            true,
            true,
            true,
            true
        );
        
        RAISE NOTICE 'Dados de exemplo inseridos!';
    ELSE
        RAISE NOTICE 'Tabela já contém dados, pulando inserção de exemplos...';
    END IF;
END $$;

-- ====================================================
-- QUERIES ÚTEIS PARA TESTE E VALIDAÇÃO
-- ====================================================

-- Consultar todas as preferências
-- SELECT * FROM notification_preferences ORDER BY tenant_id, notification_type;

-- Consultar preferências por tipo
-- SELECT * FROM notification_preferences WHERE notification_type = 'daily';

-- Consultar preferências ativas
-- SELECT * FROM notification_preferences WHERE is_active = true;

-- Consultar preferências por horário específico
-- SELECT * FROM notification_preferences WHERE notification_type = 'daily' AND notification_hour = 9;

-- Consultar preferências semanais por dia da semana
-- SELECT * FROM notification_preferences WHERE notification_type = 'weekly' AND day_of_week = 1;

-- Consultar preferências mensais por dia do mês
-- SELECT * FROM notification_preferences WHERE notification_type = 'monthly' AND day_of_month = 1;

-- ====================================================
-- FUNÇÃO PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- ====================================================

-- Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar updated_at automaticamente
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_update_notification_preferences_updated_at'
    ) THEN
        CREATE TRIGGER trigger_update_notification_preferences_updated_at
            BEFORE UPDATE ON notification_preferences
            FOR EACH ROW
            EXECUTE FUNCTION update_notification_preferences_updated_at();
        
        RAISE NOTICE 'Trigger para updated_at criado!';
    ELSE
        RAISE NOTICE 'Trigger para updated_at já existe!';
    END IF;
END $$;

-- ====================================================
-- VALIDAÇÃO FINAL
-- ====================================================

-- Verificar se tudo foi criado corretamente
DO $$ 
DECLARE
    table_count INTEGER;
    index_count INTEGER;
    trigger_count INTEGER;
BEGIN
    -- Verificar tabela
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notification_preferences';
    
    -- Verificar índices
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE tablename = 'notification_preferences';
    
    -- Verificar trigger
    SELECT COUNT(*) INTO trigger_count 
    FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_update_notification_preferences_updated_at';
    
    RAISE NOTICE '=== VALIDAÇÃO FINAL ===';
    RAISE NOTICE 'Tabela notification_preferences: % (esperado: 1)', table_count;
    RAISE NOTICE 'Índices criados: % (esperado: >= 6)', index_count;
    RAISE NOTICE 'Trigger created: % (esperado: 1)', trigger_count;
    
    IF table_count = 1 AND index_count >= 6 AND trigger_count = 1 THEN
        RAISE NOTICE '✅ SUCESSO: Sistema de notificações criado corretamente!';
    ELSE
        RAISE NOTICE '❌ ATENÇÃO: Algo pode ter dado errado na criação!';
    END IF;
END $$;

-- ====================================================
-- REFERÊNCIA RÁPIDA
-- ====================================================

/*
TIPOS DE NOTIFICAÇÃO:
- 'daily': Diária (especificar notification_hour)
- 'weekly': Semanal (especificar notification_hour + day_of_week)
- 'monthly': Mensal (especificar notification_hour + day_of_month)

DIAS DA SEMANA (day_of_week):
0 = Domingo
1 = Segunda-feira
2 = Terça-feira
3 = Quarta-feira
4 = Quinta-feira
5 = Sexta-feira
6 = Sábado

HORÁRIOS (notification_hour):
0-23 (formato 24h)

EXEMPLOS DE USO:
- Diária às 9h: type='daily', hour=9
- Semanal às sextas 18h: type='weekly', hour=18, day_of_week=5
- Mensal dia 1 às 10h: type='monthly', hour=10, day_of_month=1
*/ 