-- ===============================================================================
-- DEBUG DO ERRO 500 - INVESTIGAÇÃO ESPECÍFICA
-- ===============================================================================

-- 1. VERIFICAR ESTRUTURA COMPLETA DA TABELA telegram_users
SELECT 
    'ESTRUTURA telegram_users' as debug,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'telegram_users' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. VERIFICAR DADOS DE UM USUÁRIO ESPECÍFICO
SELECT 
    'DADOS USUÁRIO TELEGRAM' as debug,
    id,
    telegram_id,
    telegram_first_name,
    user_id,
    is_authenticated,
    confirmar_transacoes_recorrentes,
    timeout_confirmacao_horas,
    created_at
FROM telegram_users 
WHERE is_authenticated = true
LIMIT 3;

-- 3. VERIFICAR SE TABELA confirmacoes_transacao EXISTE
SELECT 
    'TABELA CONFIRMACOES' as debug,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'confirmacoes_transacao' AND table_schema = 'public'
        ) THEN '✅ EXISTE'
        ELSE '❌ NÃO EXISTE'
    END as status_tabela;

-- 4. VERIFICAR USUÁRIOS COM PROBLEMAS DE FK
SELECT 
    'USUÁRIOS COM PROBLEMAS' as debug,
    tu.id,
    tu.telegram_id,
    tu.user_id,
    CASE 
        WHEN u.id IS NULL THEN '❌ USER_ID INVÁLIDO'
        ELSE '✅ USER_ID OK'
    END as status_user_fk
FROM telegram_users tu
LEFT JOIN users u ON tu.user_id = u.id
WHERE tu.is_authenticated = true
LIMIT 5;

-- 5. VERIFICAR SE HÁ VALORES NULL NAS NOVAS COLUNAS
SELECT 
    'VALORES NULL' as debug,
    COUNT(*) as total_usuarios,
    COUNT(CASE WHEN confirmar_transacoes_recorrentes IS NULL THEN 1 END) as confirmacao_null,
    COUNT(CASE WHEN timeout_confirmacao_horas IS NULL THEN 1 END) as timeout_null,
    COUNT(CASE WHEN confirmar_transacoes_recorrentes = true THEN 1 END) as com_confirmacao_ativa
FROM telegram_users;

-- 6. TESTAR SELECT ESPECÍFICO QUE PODE ESTAR CAUSANDO ERRO
SELECT 
    'TESTE API QUERY' as debug,
    tu.telegram_id,
    tu.telegram_first_name,
    tu.user_id,
    tu.is_authenticated,
    tu.confirmar_transacoes_recorrentes,
    tu.timeout_confirmacao_horas,
    u.full_name as user_name
FROM telegram_users tu
LEFT JOIN users u ON tu.user_id = u.id
WHERE tu.is_authenticated = true
    AND tu.user_id IS NOT NULL
LIMIT 3;

-- 7. VERIFICAR SE EXISTE ALGUM CONSTRAINT OU TRIGGER PROBLEMÁTICO
SELECT 
    'CONSTRAINTS' as debug,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'telegram_users' 
    AND table_schema = 'public';

-- 8. VERIFICAR LOGS DE ERRO (se disponível)
-- Esta query pode falhar, é normal
SELECT 
    'ÚLTIMA ATIVIDADE' as debug,
    id,
    telegram_id,
    last_interaction,
    updated_at
FROM telegram_users 
WHERE is_authenticated = true
ORDER BY last_interaction DESC
LIMIT 3; 