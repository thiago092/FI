-- ===============================================================================
-- SCRIPT DE VERIFICAÇÃO - MIGRAÇÕES DE CONFIRMAÇÃO DE TRANSAÇÕES RECORRENTES
-- Execute este script no DBeaver para verificar o status das migrações
-- ===============================================================================

-- 1. VERIFICAR SE A TABELA telegram_users EXISTE
SELECT 
    '1️⃣ TABELA telegram_users' as verificacao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'telegram_users' AND table_schema = 'public'
        ) THEN '✅ EXISTE'
        ELSE '❌ NÃO EXISTE'
    END as status;

-- 2. VERIFICAR COLUNAS DA TABELA telegram_users
SELECT 
    '2️⃣ COLUNAS telegram_users' as verificacao,
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name = 'confirmar_transacoes_recorrentes' THEN '🎯 CONFIRMAÇÃO'
        WHEN column_name = 'timeout_confirmacao_horas' THEN '⏰ TIMEOUT'
        ELSE '📝 PADRÃO'
    END as tipo_coluna
FROM information_schema.columns 
WHERE table_name = 'telegram_users' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. VERIFICAR SE AS COLUNAS ESPECÍFICAS EXISTEM
SELECT 
    '3️⃣ COLUNAS DE CONFIRMAÇÃO' as verificacao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'telegram_users' 
                AND column_name = 'confirmar_transacoes_recorrentes'
                AND table_schema = 'public'
        ) THEN '✅ confirmar_transacoes_recorrentes EXISTE'
        ELSE '❌ confirmar_transacoes_recorrentes AUSENTE'
    END as coluna_confirmacao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'telegram_users' 
                AND column_name = 'timeout_confirmacao_horas'
                AND table_schema = 'public'
        ) THEN '✅ timeout_confirmacao_horas EXISTE'
        ELSE '❌ timeout_confirmacao_horas AUSENTE'
    END as coluna_timeout;

-- 4. VERIFICAR TABELA confirmacoes_transacao
SELECT 
    '4️⃣ TABELA confirmacoes_transacao' as verificacao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'confirmacoes_transacao' AND table_schema = 'public'
        ) THEN '✅ EXISTE'
        ELSE '❌ NÃO EXISTE'
    END as status;

-- 5. SE A TABELA confirmacoes_transacao EXISTE, MOSTRAR ESTRUTURA
SELECT 
    '5️⃣ ESTRUTURA confirmacoes_transacao' as verificacao,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'confirmacoes_transacao' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. ESTATÍSTICAS DOS USUÁRIOS TELEGRAM (se a tabela existir)
-- Esta query só funcionará se as colunas existirem
SELECT 
    '6️⃣ ESTATÍSTICAS USUÁRIOS' as verificacao,
    COUNT(*) as total_usuarios,
    COUNT(CASE WHEN confirmar_transacoes_recorrentes = true THEN 1 END) as com_confirmacao_ativa,
    COUNT(CASE WHEN confirmar_transacoes_recorrentes = false THEN 1 END) as com_confirmacao_desativa,
    AVG(timeout_confirmacao_horas) as timeout_medio_horas
FROM telegram_users
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'telegram_users' 
        AND column_name = 'confirmar_transacoes_recorrentes'
        AND table_schema = 'public'
);

-- 7. ESTATÍSTICAS DE CONFIRMAÇÕES (se a tabela existir)
SELECT 
    '7️⃣ ESTATÍSTICAS CONFIRMAÇÕES' as verificacao,
    COUNT(*) as total_confirmacoes,
    status,
    COUNT(*) as quantidade
FROM confirmacoes_transacao
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'confirmacoes_transacao' AND table_schema = 'public'
)
GROUP BY status
ORDER BY status;

-- 8. VERIFICAR TRANSAÇÕES RECORRENTES ATIVAS
SELECT 
    '8️⃣ TRANSAÇÕES RECORRENTES' as verificacao,
    COUNT(*) as total_transacoes,
    COUNT(CASE WHEN ativa = true THEN 1 END) as transacoes_ativas
FROM transacoes_recorrentes
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'transacoes_recorrentes' AND table_schema = 'public'
);

-- 9. TRANSAÇÕES RECORRENTES ATIVAS (para teste)
SELECT 
    '9️⃣ TRANSAÇÕES ATIVAS PARA TESTE' as verificacao,
    id,
    descricao,
    valor,
    frequencia,
    data_inicio,
    data_fim,
    tenant_id,
    created_by_name
FROM transacoes_recorrentes 
WHERE ativa = true 
    AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'transacoes_recorrentes' AND table_schema = 'public'
    )
ORDER BY data_inicio DESC
LIMIT 5;

-- ===============================================================================
-- SCRIPTS DE MIGRAÇÃO (EXECUTE APENAS SE NECESSÁRIO)
-- ===============================================================================

-- 🔧 MIGRAÇÃO 1: Adicionar colunas na tabela telegram_users
-- Execute apenas se as colunas não existirem:
/*
ALTER TABLE telegram_users 
ADD COLUMN IF NOT EXISTS confirmar_transacoes_recorrentes BOOLEAN DEFAULT FALSE;

ALTER TABLE telegram_users 
ADD COLUMN IF NOT EXISTS timeout_confirmacao_horas INTEGER DEFAULT 2;
*/

-- 🔧 MIGRAÇÃO 2: Criar tabela confirmacoes_transacao
-- Execute apenas se a tabela não existir:
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_confirmacoes_status ON confirmacoes_transacao(status);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_expira_em ON confirmacoes_transacao(expira_em);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_tenant ON confirmacoes_transacao(tenant_id);
*/

-- ===============================================================================
-- RESULTADO ESPERADO
-- ===============================================================================
-- Se tudo estiver correto, você deve ver:
-- ✅ telegram_users EXISTE
-- ✅ confirmar_transacoes_recorrentes EXISTE
-- ✅ timeout_confirmacao_horas EXISTE  
-- ✅ confirmacoes_transacao EXISTE
-- + Estruturas das tabelas
-- + Estatísticas dos dados 