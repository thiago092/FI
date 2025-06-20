-- ===============================================================================
-- APLICAR MIGRAÇÕES DE CONFIRMAÇÃO - EXECUTE NO DBEAVER
-- ===============================================================================

-- 1. PRIMEIRO: Verificar se as colunas já existem
SELECT 
    'VERIFICAÇÃO ANTES DA MIGRAÇÃO' as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'telegram_users' 
                AND column_name = 'confirmar_transacoes_recorrentes'
                AND table_schema = 'public'
        ) THEN '✅ confirmar_transacoes_recorrentes JÁ EXISTE'
        ELSE '❌ confirmar_transacoes_recorrentes PRECISA SER CRIADA'
    END as coluna_confirmacao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'telegram_users' 
                AND column_name = 'timeout_confirmacao_horas'
                AND table_schema = 'public'
        ) THEN '✅ timeout_confirmacao_horas JÁ EXISTE'
        ELSE '❌ timeout_confirmacao_horas PRECISA SER CRIADA'
    END as coluna_timeout;

-- ===============================================================================
-- 2. MIGRAÇÃO 1: ADICIONAR COLUNAS NA TABELA telegram_users
-- ===============================================================================

-- Adicionar coluna de confirmação
ALTER TABLE telegram_users 
ADD COLUMN IF NOT EXISTS confirmar_transacoes_recorrentes BOOLEAN DEFAULT FALSE;

-- Adicionar coluna de timeout
ALTER TABLE telegram_users 
ADD COLUMN IF NOT EXISTS timeout_confirmacao_horas INTEGER DEFAULT 2;

-- Adicionar comentários para documentação
COMMENT ON COLUMN telegram_users.confirmar_transacoes_recorrentes IS 'Se deve pedir confirmação via Telegram antes de criar transações recorrentes';
COMMENT ON COLUMN telegram_users.timeout_confirmacao_horas IS 'Horas para auto-confirmar transação se usuário não responder (1-24)';

-- ===============================================================================
-- 3. MIGRAÇÃO 2: CRIAR TABELA confirmacoes_transacao
-- ===============================================================================

CREATE TABLE IF NOT EXISTS confirmacoes_transacao (
    id SERIAL PRIMARY KEY,
    transacao_recorrente_id INTEGER NOT NULL,
    
    -- Dados da transação que será criada
    descricao VARCHAR NOT NULL,
    valor NUMERIC(10, 2) NOT NULL,
    tipo VARCHAR NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
    categoria_id INTEGER NOT NULL,
    conta_id INTEGER,
    cartao_id INTEGER,
    data_transacao DATE NOT NULL,
    
    -- Status da confirmação
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'CONFIRMADA', 'CANCELADA', 'AUTO_CONFIRMADA')),
    
    -- Controle de tempo
    criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expira_em TIMESTAMP NOT NULL,
    respondida_em TIMESTAMP,
    
    -- ID da transação criada (se confirmada)
    transacao_id INTEGER,
    
    -- Telegram info para notificação
    telegram_user_id VARCHAR,
    telegram_message_id VARCHAR,
    
    -- Identificação de quem deve confirmar
    criada_por_usuario VARCHAR(255),
    
    -- Observações
    observacoes TEXT,
    
    -- Tenant
    tenant_id INTEGER NOT NULL,
    
    -- Constraints
    CHECK (valor > 0),
    CHECK ((conta_id IS NOT NULL AND cartao_id IS NULL) OR (conta_id IS NULL AND cartao_id IS NOT NULL))
);

-- ===============================================================================
-- 4. ADICIONAR FOREIGN KEYS (se as tabelas existirem)
-- ===============================================================================

-- Foreign key para transacoes_recorrentes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transacoes_recorrentes') THEN
        ALTER TABLE confirmacoes_transacao 
        ADD CONSTRAINT IF NOT EXISTS fk_confirmacoes_transacao_recorrente 
        FOREIGN KEY (transacao_recorrente_id) REFERENCES transacoes_recorrentes(id);
    END IF;
END $$;

-- Foreign key para categorias
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categorias') THEN
        ALTER TABLE confirmacoes_transacao 
        ADD CONSTRAINT IF NOT EXISTS fk_confirmacoes_categoria 
        FOREIGN KEY (categoria_id) REFERENCES categorias(id);
    END IF;
END $$;

-- Foreign key para contas
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contas') THEN
        ALTER TABLE confirmacoes_transacao 
        ADD CONSTRAINT IF NOT EXISTS fk_confirmacoes_conta 
        FOREIGN KEY (conta_id) REFERENCES contas(id);
    END IF;
END $$;

-- Foreign key para cartoes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cartoes') THEN
        ALTER TABLE confirmacoes_transacao 
        ADD CONSTRAINT IF NOT EXISTS fk_confirmacoes_cartao 
        FOREIGN KEY (cartao_id) REFERENCES cartoes(id);
    END IF;
END $$;

-- Foreign key para transacoes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transacoes') THEN
        ALTER TABLE confirmacoes_transacao 
        ADD CONSTRAINT IF NOT EXISTS fk_confirmacoes_transacao 
        FOREIGN KEY (transacao_id) REFERENCES transacoes(id);
    END IF;
END $$;

-- Foreign key para tenants
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        ALTER TABLE confirmacoes_transacao 
        ADD CONSTRAINT IF NOT EXISTS fk_confirmacoes_tenant 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;
END $$;

-- ===============================================================================
-- 5. CRIAR ÍNDICES PARA PERFORMANCE
-- ===============================================================================

CREATE INDEX IF NOT EXISTS idx_confirmacoes_status ON confirmacoes_transacao(status);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_expira_em ON confirmacoes_transacao(expira_em);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_tenant ON confirmacoes_transacao(tenant_id);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_telegram ON confirmacoes_transacao(telegram_user_id);

-- ===============================================================================
-- 6. ADICIONAR COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ===============================================================================

COMMENT ON TABLE confirmacoes_transacao IS 'Gerencia confirmações de transações recorrentes via Telegram';
COMMENT ON COLUMN confirmacoes_transacao.status IS 'Status da confirmação: PENDENTE, CONFIRMADA, CANCELADA, AUTO_CONFIRMADA';
COMMENT ON COLUMN confirmacoes_transacao.expira_em IS 'Quando a confirmação expira e transação é criada automaticamente';
COMMENT ON COLUMN confirmacoes_transacao.criada_por_usuario IS 'Nome do usuário que criou a transação recorrente original';
COMMENT ON COLUMN confirmacoes_transacao.telegram_user_id IS 'ID do usuário no Telegram que receberá a notificação';

-- ===============================================================================
-- 7. VERIFICAR SE A MIGRAÇÃO FOI APLICADA COM SUCESSO
-- ===============================================================================

SELECT 
    'VERIFICAÇÃO PÓS-MIGRAÇÃO' as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'telegram_users' 
                AND column_name = 'confirmar_transacoes_recorrentes'
                AND table_schema = 'public'
        ) THEN '✅ confirmar_transacoes_recorrentes CRIADA'
        ELSE '❌ confirmar_transacoes_recorrentes FALHOU'
    END as coluna_confirmacao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'telegram_users' 
                AND column_name = 'timeout_confirmacao_horas'
                AND table_schema = 'public'
        ) THEN '✅ timeout_confirmacao_horas CRIADA'
        ELSE '❌ timeout_confirmacao_horas FALHOU'
    END as coluna_timeout,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'confirmacoes_transacao' AND table_schema = 'public'
        ) THEN '✅ confirmacoes_transacao CRIADA'
        ELSE '❌ confirmacoes_transacao FALHOU'
    END as tabela_confirmacoes;

-- ===============================================================================
-- 8. TESTE FINAL
-- ===============================================================================

SELECT 
    'TESTE FINAL' as teste,
    (SELECT COUNT(*) FROM telegram_users) as total_usuarios_telegram,
    (SELECT COUNT(*) FROM transacoes_recorrentes WHERE ativa = true) as transacoes_ativas,
    (SELECT COUNT(*) FROM confirmacoes_transacao) as total_confirmacoes,
    'SISTEMA PRONTO PARA USO!' as resultado; 