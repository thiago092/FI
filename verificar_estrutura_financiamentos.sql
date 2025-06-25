-- VERIFICAÇÃO DA ESTRUTURA DAS TABELAS DE FINANCIAMENTOS
-- Execute no DBeaver para verificar se está tudo correto para exclusão

-- 1. Verificar estrutura da tabela principal
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'financiamentos' 
ORDER BY ordinal_position;

-- 2. Verificar estrutura da tabela de parcelas
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'parcelas_financiamento' 
ORDER BY ordinal_position;

-- 3. Verificar estrutura da tabela de confirmações
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'confirmacoes_financiamento' 
ORDER BY ordinal_position;

-- 4. Verificar chaves estrangeiras (relacionamentos)
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('financiamentos', 'parcelas_financiamento', 'confirmacoes_financiamento')
ORDER BY tc.table_name, kcu.column_name;

-- 5. Verificar se existe CASCADE nas foreign keys
SELECT 
    con.conname AS constraint_name,
    rel.relname AS table_name,
    att.attname AS column_name,
    confrel.relname AS referenced_table,
    confatt.attname AS referenced_column,
    CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END AS on_delete_action
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
JOIN pg_class confrel ON confrel.oid = con.confrelid
JOIN pg_attribute confatt ON confatt.attrelid = con.confrelid AND confatt.attnum = ANY(con.confkey)
WHERE con.contype = 'f'
    AND rel.relname IN ('financiamentos', 'parcelas_financiamento', 'confirmacoes_financiamento')
ORDER BY rel.relname, att.attname;

-- 6. Contar registros existentes
SELECT 
    'financiamentos' as tabela,
    COUNT(*) as total_registros
FROM financiamentos
UNION ALL
SELECT 
    'parcelas_financiamento' as tabela,
    COUNT(*) as total_registros
FROM parcelas_financiamento
UNION ALL
SELECT 
    'confirmacoes_financiamento' as tabela,
    COUNT(*) as total_registros
FROM confirmacoes_financiamento;

-- 7. Verificar se existe a coluna parcela_id na tabela confirmacoes_financiamento
SELECT 
    EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'confirmacoes_financiamento' 
        AND column_name = 'parcela_id'
    ) as parcela_id_existe;

-- 8. Teste de exclusão simulada (sem executar)
-- EXPLAIN (ANALYZE false, BUFFERS false) 
-- DELETE FROM financiamentos WHERE id = 1; 