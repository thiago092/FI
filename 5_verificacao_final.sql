-- =====================================================================
-- PASSO 5: VERIFICAÇÃO FINAL
-- Execute este script por último para confirmar que tudo está correto
-- =====================================================================

-- Verificar estrutura final da tabela
SELECT 
    '🎉 ESTRUTURA FINAL:' as info,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'confirmacoes_financiamento'
AND column_name IN ('id', 'financiamento_id', 'parcela_id', 'status', 'tenant_id')
ORDER BY 
    CASE column_name 
        WHEN 'id' THEN 1
        WHEN 'financiamento_id' THEN 2
        WHEN 'parcela_id' THEN 3
        WHEN 'status' THEN 4
        WHEN 'tenant_id' THEN 5
        ELSE 6
    END;

-- Contar registros na tabela
SELECT 
    '📊 TOTAL DE REGISTROS:' as info,
    COUNT(*) as total_registros
FROM confirmacoes_financiamento;

-- Verificar se a correção foi bem-sucedida
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'confirmacoes_financiamento' 
            AND column_name = 'parcela_id'
        ) 
        THEN '🎉 SUCESSO! Tabela confirmacoes_financiamento está correta! A exclusão de financiamentos deve funcionar agora.'
        ELSE '❌ ERRO! Ainda há problemas com a tabela.'
    END as resultado_final; 