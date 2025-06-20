-- ===============================================================================
-- TESTE SQL DIRETO - SIMULAR O QUE A API FAZ
-- ===============================================================================

-- 1. SIMULAR A QUERY GET /telegram/config/confirmacao-recorrentes
-- Isso é exatamente o que a API executa:

SELECT 
    'SIMULAÇÃO API GET' as teste,
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
LIMIT 1;

-- 2. VERIFICAR SE É PROBLEMA DE TIPO DE DADOS
SELECT 
    'TIPOS DE DADOS' as teste,
    pg_typeof(confirmar_transacoes_recorrentes) as tipo_confirmacao,
    pg_typeof(timeout_confirmacao_horas) as tipo_timeout,
    confirmar_transacoes_recorrentes,
    timeout_confirmacao_horas
FROM telegram_users 
WHERE is_authenticated = true
LIMIT 1;

-- 3. TESTAR UPDATE (o que o PATCH faz)
-- Primeiro vamos ver se dá erro:
SELECT 
    'ANTES UPDATE' as teste,
    id,
    confirmar_transacoes_recorrentes,
    timeout_confirmacao_horas
FROM telegram_users 
WHERE is_authenticated = true
LIMIT 1;

-- UNCOMMIT ESTE UPDATE SE QUISER TESTAR:
-- UPDATE telegram_users 
-- SET 
--     confirmar_transacoes_recorrentes = true,
--     timeout_confirmacao_horas = 2
-- WHERE is_authenticated = true 
--     AND id = (SELECT id FROM telegram_users WHERE is_authenticated = true LIMIT 1);

-- 4. VERIFICAR SE HÁ ALGUM CONSTRAINT QUE PODE ESTAR FALHANDO
SELECT 
    'CONSTRAINTS CHECK' as teste,
    conname as constraint_name,
    confrelid::regclass as referencing_table,
    confkey as foreign_keys,
    confupdtype as on_update,
    confdeltype as on_delete
FROM pg_constraint 
WHERE conrelid = 'telegram_users'::regclass
    AND contype IN ('f', 'c'); -- foreign key e check constraints

-- 5. VERIFICAR PERMISSÕES (pode ser que o usuário não tenha permissão para atualizar)
SELECT 
    'PERMISSÕES' as teste,
    has_table_privilege(current_user, 'telegram_users', 'SELECT') as can_select,
    has_table_privilege(current_user, 'telegram_users', 'UPDATE') as can_update,
    has_table_privilege(current_user, 'telegram_users', 'INSERT') as can_insert;

-- 6. VERIFICAR SE HÁ TRIGGERS QUE PODEM ESTAR CAUSANDO PROBLEMAS
SELECT 
    'TRIGGERS' as teste,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'telegram_users'; 