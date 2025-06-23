-- =====================================================
-- SCRIPT PARA VERIFICAR ESTRUTURA DA TABELA PARCELAS
-- Execute no DBeaver para identificar o problema
-- =====================================================

-- 1. Verificar se a tabela existe
SELECT 'TABELA EXISTE?' as verificacao,
       CASE 
           WHEN COUNT(*) > 0 THEN 'SIM' 
           ELSE 'NÃO' 
       END as resultado
FROM information_schema.tables 
WHERE table_name = 'parcelas_financiamento';

-- 2. Verificar estrutura completa da tabela
SELECT 
    'ESTRUTURA DA TABELA' as info,
    column_name as campo,
    data_type as tipo,
    is_nullable as permite_null,
    column_default as valor_padrao,
    character_maximum_length as tamanho_max
FROM information_schema.columns 
WHERE table_name = 'parcelas_financiamento'
ORDER BY ordinal_position;

-- 3. Verificar especificamente o campo valor_parcela (se existir)
SELECT 
    'CAMPO VALOR_PARCELA' as info,
    column_name as campo,
    data_type as tipo,
    is_nullable as permite_null,
    column_default as valor_padrao
FROM information_schema.columns 
WHERE table_name = 'parcelas_financiamento' 
  AND column_name LIKE '%valor_parcela%';

-- 4. Verificar constraints NOT NULL
SELECT 
    'CONSTRAINTS NOT NULL' as info,
    column_name as campo,
    is_nullable as permite_null
FROM information_schema.columns 
WHERE table_name = 'parcelas_financiamento' 
  AND is_nullable = 'NO'
ORDER BY column_name;

-- 5. Verificar dados existentes (se houver)
SELECT 
    'DADOS EXISTENTES' as info,
    COUNT(*) as total_registros
FROM parcelas_financiamento;

-- 6. Se existirem dados, verificar campos NULL problemáticos
SELECT 
    'CAMPOS NULL PROBLEMÁTICOS' as info,
    id,
    financiamento_id,
    numero_parcela,
    CASE WHEN valor_parcela IS NULL THEN 'NULL' ELSE 'OK' END as valor_parcela_status,
    CASE WHEN valor_parcela_simulado IS NULL THEN 'NULL' ELSE 'OK' END as valor_parcela_simulado_status
FROM parcelas_financiamento
LIMIT 5;

-- 7. SOLUÇÃO: Se o problema for campo valor_parcela com NOT NULL
-- Verificar se precisamos adicionar ou remover o campo

-- Opção A: Se a tabela tem campo valor_parcela que não deveria ter
-- ALTER TABLE parcelas_financiamento DROP COLUMN IF EXISTS valor_parcela;

-- Opção B: Se a tabela precisa do campo valor_parcela
-- ALTER TABLE parcelas_financiamento ADD COLUMN valor_parcela DECIMAL(10,2) NULL;

-- Opção C: Se o campo existe mas está NOT NULL e deveria ser NULL
-- ALTER TABLE parcelas_financiamento ALTER COLUMN valor_parcela DROP NOT NULL;

-- 8. Script para limpar dados problemáticos (se necessário)
-- DELETE FROM parcelas_financiamento WHERE valor_parcela IS NULL;

-- =====================================================
-- EXECUTE ESTE SCRIPT E ME MANDE O RESULTADO
-- ===================================================== 