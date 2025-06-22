-- Script para verificar estrutura atual da tabela financiamentos existente
-- Execute este script no DBeaver

-- 1. Verificar estrutura atual da tabela financiamentos
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'financiamentos'
ORDER BY ordinal_position;

-- 2. Verificar se existem as outras tabelas necessárias
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parcelas_financiamento') 
        THEN 'EXISTE' 
        ELSE 'NÃO EXISTE' 
    END as parcelas_financiamento,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'confirmacoes_financiamento') 
        THEN 'EXISTE' 
        ELSE 'NÃO EXISTE' 
    END as confirmacoes_financiamento,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'simulacoes_financiamento') 
        THEN 'EXISTE' 
        ELSE 'NÃO EXISTE' 
    END as simulacoes_financiamento;

-- 3. Verificar enums existentes
SELECT 
    t.typname AS enum_name
FROM pg_type t 
WHERE t.typname IN ('tipo_financiamento_enum', 'sistema_amortizacao_enum', 'status_financiamento_enum', 'status_parcela_enum');

-- 4. Ver alguns dados da tabela financiamentos (se houver)
SELECT 
    id,
    descricao,
    valor_total,
    valor_financiado,
    taxa_juros_mensal,
    numero_parcelas,
    status
FROM financiamentos 
LIMIT 5; 