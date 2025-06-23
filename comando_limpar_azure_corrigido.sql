-- COMANDO CORRIGIDO PARA AZURE SQL DATABASE (PostgreSQL)
-- Execute este script inteiro de uma vez no DBeaver

-- ========================================
-- PARTE 1: VERIFICAR DADOS EXISTENTES
-- ========================================
SELECT 'ANTES DA LIMPEZA - CONTAGEM DE REGISTROS' as status;

SELECT 'financiamentos' as tabela, COUNT(*) as registros FROM financiamentos
UNION ALL
SELECT 'parcelas_financiamento' as tabela, COUNT(*) as registros FROM parcelas_financiamento
UNION ALL  
SELECT 'confirmacoes_financiamento' as tabela, COUNT(*) as registros FROM confirmacoes_financiamento
UNION ALL
SELECT 'simulacoes_financiamento' as tabela, COUNT(*) as registros FROM simulacoes_financiamento
UNION ALL
SELECT 'historico_financiamentos' as tabela, COUNT(*) as registros FROM historico_financiamentos
UNION ALL
SELECT 'transacoes_financiamento' as tabela, COUNT(*) as registros FROM transacoes WHERE is_financiamento = TRUE;

-- ========================================
-- PARTE 2: LIMPEZA DOS DADOS
-- ========================================

-- 1. Limpar histórico de financiamentos
DELETE FROM historico_financiamentos;

-- 2. Limpar confirmações de financiamento  
DELETE FROM confirmacoes_financiamento;

-- 3. Limpar simulações de financiamento
DELETE FROM simulacoes_financiamento;

-- 4. Limpar parcelas de financiamento
DELETE FROM parcelas_financiamento;

-- 5. Limpar financiamentos principais
DELETE FROM financiamentos;

-- 6. Resetar campos de financiamento nas transações
UPDATE transacoes 
SET is_financiamento = FALSE, 
    parcela_financiamento_id = NULL 
WHERE is_financiamento = TRUE OR parcela_financiamento_id IS NOT NULL;

-- ========================================
-- PARTE 3: VERIFICAR LIMPEZA
-- ========================================
SELECT 'APÓS LIMPEZA - CONTAGEM DE REGISTROS' as status;

SELECT 'financiamentos' as tabela, COUNT(*) as registros FROM financiamentos
UNION ALL
SELECT 'parcelas_financiamento' as tabela, COUNT(*) as registros FROM parcelas_financiamento
UNION ALL
SELECT 'confirmacoes_financiamento' as tabela, COUNT(*) as registros FROM confirmacoes_financiamento  
UNION ALL
SELECT 'simulacoes_financiamento' as tabela, COUNT(*) as registros FROM simulacoes_financiamento
UNION ALL
SELECT 'historico_financiamentos' as tabela, COUNT(*) as registros FROM historico_financiamentos
UNION ALL
SELECT 'transacoes_financiamento' as tabela, COUNT(*) as registros FROM transacoes WHERE is_financiamento = TRUE;

SELECT 'LIMPEZA CONCLUÍDA COM SUCESSO!' as resultado; 