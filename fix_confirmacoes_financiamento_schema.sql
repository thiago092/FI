-- CORREÇÃO DA ESTRUTURA DA TABELA confirmacoes_financiamento
-- Execute no DBeaver para alinhar com o modelo Python

-- 1. Verificar estrutura atual
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'confirmacoes_financiamento' 
ORDER BY ordinal_position;

-- 2. Adicionar colunas que faltam (baseado no modelo Python)
ALTER TABLE confirmacoes_financiamento 
ADD COLUMN IF NOT EXISTS parcela_id INTEGER REFERENCES parcelas_financiamento(id);

ALTER TABLE confirmacoes_financiamento 
ADD COLUMN IF NOT EXISTS descricao VARCHAR(500) NOT NULL DEFAULT 'Confirmação de pagamento';

ALTER TABLE confirmacoes_financiamento 
ADD COLUMN IF NOT EXISTS valor_parcela NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE confirmacoes_financiamento 
ADD COLUMN IF NOT EXISTS data_vencimento DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE confirmacoes_financiamento 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDENTE';

ALTER TABLE confirmacoes_financiamento 
ADD COLUMN IF NOT EXISTS criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE confirmacoes_financiamento 
ADD COLUMN IF NOT EXISTS expira_em TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours');

ALTER TABLE confirmacoes_financiamento 
ADD COLUMN IF NOT EXISTS respondida_em TIMESTAMP;

ALTER TABLE confirmacoes_financiamento 
ADD COLUMN IF NOT EXISTS transacao_id INTEGER REFERENCES transacoes(id);

ALTER TABLE confirmacoes_financiamento 
ADD COLUMN IF NOT EXISTS telegram_user_id VARCHAR(100);

ALTER TABLE confirmacoes_financiamento 
ADD COLUMN IF NOT EXISTS telegram_message_id VARCHAR(100);

ALTER TABLE confirmacoes_financiamento 
ADD COLUMN IF NOT EXISTS whatsapp_user_id VARCHAR(100);

-- 3. Renomear colunas existentes se necessário
-- Se parcela_financiamento_id deve ser parcela_id:
-- ALTER TABLE confirmacoes_financiamento RENAME COLUMN parcela_financiamento_id TO parcela_id;

-- 4. Ajustar colunas existentes que têm nomes diferentes
-- Se valor_confirmado deve ser valor_parcela:
-- UPDATE confirmacoes_financiamento SET valor_parcela = valor_confirmado WHERE valor_parcela = 0;

-- Se data_confirmacao deve ser data_vencimento:
-- UPDATE confirmacoes_financiamento SET data_vencimento = data_confirmacao WHERE data_vencimento = CURRENT_DATE;

-- 5. Verificar estrutura final
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'confirmacoes_financiamento' 
ORDER BY ordinal_position; 