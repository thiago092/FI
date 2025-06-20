-- ===============================================================================
-- VERIFICAÇÃO COMPLETA EM UM ÚNICO SELECT
-- Execute este script para ver o status completo das migrações
-- ===============================================================================

SELECT 
    '🔍 STATUS DAS MIGRAÇÕES - CONFIRMAÇÃO DE TRANSAÇÕES RECORRENTES' as titulo,
    
    -- Verificar tabela telegram_users
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'telegram_users' AND table_schema = 'public'
        ) THEN '✅ telegram_users EXISTE'
        ELSE '❌ telegram_users NÃO EXISTE'
    END as status_tabela_telegram,
    
    -- Verificar coluna confirmar_transacoes_recorrentes
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'telegram_users' 
                AND column_name = 'confirmar_transacoes_recorrentes'
                AND table_schema = 'public'
        ) THEN '✅ COLUNA confirmação EXISTE'
        ELSE '❌ COLUNA confirmação AUSENTE'
    END as status_coluna_confirmacao,
    
    -- Verificar coluna timeout_confirmacao_horas
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'telegram_users' 
                AND column_name = 'timeout_confirmacao_horas'
                AND table_schema = 'public'
        ) THEN '✅ COLUNA timeout EXISTE'
        ELSE '❌ COLUNA timeout AUSENTE'
    END as status_coluna_timeout,
    
    -- Verificar tabela confirmacoes_transacao
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'confirmacoes_transacao' AND table_schema = 'public'
        ) THEN '✅ confirmacoes_transacao EXISTE'
        ELSE '❌ confirmacoes_transacao NÃO EXISTE'
    END as status_tabela_confirmacoes,
    
    -- Verificar se todas as migrações estão aplicadas
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'telegram_users' AND table_schema = 'public'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'telegram_users' 
                AND column_name = 'confirmar_transacoes_recorrentes'
                AND table_schema = 'public'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'telegram_users' 
                AND column_name = 'timeout_confirmacao_horas'
                AND table_schema = 'public'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'confirmacoes_transacao' AND table_schema = 'public'
        ) THEN '🎉 TODAS AS MIGRAÇÕES APLICADAS - SISTEMA PRONTO!'
        ELSE '⚠️ MIGRAÇÕES PENDENTES - EXECUTE OS SCRIPTS ABAIXO'
    END as status_geral;

-- ===============================================================================
-- SCRIPTS DE MIGRAÇÃO PARA EXECUTAR (se necessário)
-- ===============================================================================

-- Se o resultado acima mostrar "MIGRAÇÕES PENDENTES", execute os comandos abaixo:

-- 1. ADICIONAR COLUNAS NA TABELA telegram_users:
/*
ALTER TABLE telegram_users 
ADD COLUMN IF NOT EXISTS confirmar_transacoes_recorrentes BOOLEAN DEFAULT FALSE;

ALTER TABLE telegram_users 
ADD COLUMN IF NOT EXISTS timeout_confirmacao_horas INTEGER DEFAULT 2;
*/

-- 2. CRIAR TABELA confirmacoes_transacao:
/*
CREATE TABLE IF NOT EXISTS confirmacoes_transacao (
    id SERIAL PRIMARY KEY,
    transacao_recorrente_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    telegram_user_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expira_em TIMESTAMP NOT NULL,
    respondida_em TIMESTAMP,
    criada_por_usuario BIGINT,
    FOREIGN KEY (transacao_recorrente_id) REFERENCES transacoes_recorrentes(id),
    FOREIGN KEY (tenant_id) REFERENCES users(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_confirmacoes_status ON confirmacoes_transacao(status);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_expira_em ON confirmacoes_transacao(expira_em);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_tenant ON confirmacoes_transacao(tenant_id);
*/

-- ===============================================================================
-- DEPOIS DE EXECUTAR AS MIGRAÇÕES, EXECUTE ESTE SELECT PARA TESTAR:
-- ===============================================================================
/*
SELECT 
    'TESTE PÓS-MIGRAÇÃO' as teste,
    (SELECT COUNT(*) FROM telegram_users) as total_usuarios_telegram,
    (SELECT COUNT(*) FROM transacoes_recorrentes WHERE ativa = true) as transacoes_ativas,
    (SELECT COUNT(*) FROM confirmacoes_transacao) as total_confirmacoes;
*/ 