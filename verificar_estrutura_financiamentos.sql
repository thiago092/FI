-- Script para verificar estrutura completa do sistema de financiamentos
-- Execute este script no DBeaver para ver toda a estrutura atual

-- 1. Verificar se as tabelas de financiamentos existem
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name LIKE '%financiamento%' 
   OR table_name LIKE '%parcela%'
ORDER BY table_name;

-- 2. Verificar estrutura da tabela financiamentos
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'financiamentos'
ORDER BY ordinal_position;

-- 3. Verificar se existe tabela parcelas_financiamento
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'parcelas_financiamento'
ORDER BY ordinal_position;

-- 4. Verificar se existe tabela confirmacoes_financiamento
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'confirmacoes_financiamento'
ORDER BY ordinal_position;

-- 5. Verificar se existe tabela simulacoes_financiamento
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'simulacoes_financiamento'
ORDER BY ordinal_position;

-- 6. Verificar enums relacionados a financiamentos
SELECT 
    t.typname AS enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%financiamento%' 
   OR t.typname LIKE '%amortizacao%'
   OR t.typname LIKE '%parcela%'
GROUP BY t.typname
ORDER BY t.typname;

-- 7. Verificar constraints e índices
SELECT 
    tc.constraint_name,
    tc.table_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name LIKE '%financiamento%'
ORDER BY tc.table_name, tc.constraint_name;

-- 8. Verificar se há dados na tabela financiamentos
SELECT 
    COUNT(*) as total_financiamentos,
    COUNT(CASE WHEN status = 'ATIVO' THEN 1 END) as ativos,
    COUNT(CASE WHEN status = 'QUITADO' THEN 1 END) as quitados
FROM financiamentos;

-- 9. Verificar triggers relacionados a financiamentos
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table LIKE '%financiamento%'
ORDER BY event_object_table, trigger_name;

-- 10. Verificar views relacionadas a financiamentos
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_name LIKE '%financiamento%'
ORDER BY table_name; 