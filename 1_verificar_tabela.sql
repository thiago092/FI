-- =====================================================================
-- PASSO 1: VERIFICAR SE A TABELA CONFIRMACOES_FINANCIAMENTO EXISTE
-- Execute este script primeiro no DBeaver
-- =====================================================================

-- Verificar se a tabela existe
SELECT 
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'confirmacoes_financiamento') 
        THEN '✅ Tabela confirmacoes_financiamento EXISTE'
        ELSE '❌ Tabela confirmacoes_financiamento NÃO EXISTE'
    END as status_tabela;

-- Se a tabela existir, mostrar as colunas atuais
SELECT 
    '📋 COLUNAS ATUAIS:' as info,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'confirmacoes_financiamento'
ORDER BY ordinal_position; 