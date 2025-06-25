-- =====================================================================
-- PASSO 2: VERIFICAR SE A COLUNA PARCELA_ID EXISTE
-- Execute este script após o passo 1
-- =====================================================================

-- Verificar se a coluna parcela_id existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'confirmacoes_financiamento' 
            AND column_name = 'parcela_id'
        ) 
        THEN '✅ Coluna parcela_id JÁ EXISTE'
        ELSE '❌ Coluna parcela_id NÃO EXISTE - precisa ser adicionada'
    END as status_parcela_id;

-- Mostrar especificamente as colunas principais
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'confirmacoes_financiamento'
AND column_name IN ('id', 'financiamento_id', 'parcela_id', 'tenant_id')
ORDER BY column_name; 