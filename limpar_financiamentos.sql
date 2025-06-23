-- Script para limpar todos os dados de financiamentos
-- Execute este script no DBeaver conectado ao Azure SQL Database

-- Desabilitar verificação de foreign keys temporariamente
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Limpar histórico de financiamentos (se existir)
DELETE FROM historico_financiamentos;

-- 2. Limpar confirmações de financiamento
DELETE FROM confirmacoes_financiamento;

-- 3. Limpar simulações de financiamento
DELETE FROM simulacoes_financiamento;

-- 4. Limpar parcelas de financiamento
DELETE FROM parcelas_financiamento;

-- 5. Limpar financiamentos principais
DELETE FROM financiamentos;

-- 6. Limpar transações relacionadas a financiamentos (opcionalmente)
-- Se quiser manter outras transações, comente estas linhas:
UPDATE transacoes SET is_financiamento = FALSE, parcela_financiamento_id = NULL 
WHERE is_financiamento = TRUE OR parcela_financiamento_id IS NOT NULL;

-- 7. Reset dos auto increment (opcional)
-- ALTER TABLE financiamentos AUTO_INCREMENT = 1;
-- ALTER TABLE parcelas_financiamento AUTO_INCREMENT = 1;
-- ALTER TABLE confirmacoes_financiamento AUTO_INCREMENT = 1;
-- ALTER TABLE simulacoes_financiamento AUTO_INCREMENT = 1;
-- ALTER TABLE historico_financiamentos AUTO_INCREMENT = 1;

-- Reabilitar verificação de foreign keys
SET FOREIGN_KEY_CHECKS = 1;

-- Verificar se limpeza foi bem-sucedida
SELECT 'financiamentos' as tabela, COUNT(*) as registros FROM financiamentos
UNION ALL
SELECT 'parcelas_financiamento' as tabela, COUNT(*) as registros FROM parcelas_financiamento
UNION ALL
SELECT 'confirmacoes_financiamento' as tabela, COUNT(*) as registros FROM confirmacoes_financiamento
UNION ALL
SELECT 'simulacoes_financiamento' as tabela, COUNT(*) as registros FROM simulacoes_financiamento
UNION ALL
SELECT 'historico_financiamentos' as tabela, COUNT(*) as registros FROM historico_financiamentos;

SELECT 'Limpeza concluída!' as status; 