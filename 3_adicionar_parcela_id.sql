-- =====================================================================
-- PASSO 3: ADICIONAR COLUNA PARCELA_ID (só execute se o passo 2 mostrou que não existe)
-- Execute este script APENAS se o passo 2 mostrou que a coluna não existe
-- =====================================================================

-- ATENÇÃO: Só execute este comando se a coluna parcela_id NÃO EXISTIR!
-- Se já existir, pule este passo

ALTER TABLE confirmacoes_financiamento 
ADD COLUMN parcela_id INTEGER REFERENCES parcelas_financiamento(id) ON DELETE CASCADE;

-- Verificar se a coluna foi adicionada
SELECT 'Coluna parcela_id adicionada com sucesso!' as resultado; 