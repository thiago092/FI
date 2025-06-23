-- Migração: Adicionar campos de financiamento na tabela transacoes
-- Data: $(date)
-- Objetivo: Adicionar campos para vincular transações com parcelas de financiamento

-- Adicionar campo is_financiamento para identificar transações de financiamento
ALTER TABLE transacoes 
ADD COLUMN is_financiamento BOOLEAN DEFAULT FALSE;

-- Adicionar campo parcela_financiamento_id para vincular com parcelas
ALTER TABLE transacoes 
ADD COLUMN parcela_financiamento_id INTEGER;

-- Adicionar foreign key constraint para parcela_financiamento_id
ALTER TABLE transacoes 
ADD CONSTRAINT fk_transacoes_parcela_financiamento 
FOREIGN KEY (parcela_financiamento_id) REFERENCES parcelas_financiamento(id);

-- Criar índice para melhor performance nas consultas
CREATE INDEX idx_transacoes_is_financiamento ON transacoes(is_financiamento);
CREATE INDEX idx_transacoes_parcela_financiamento_id ON transacoes(parcela_financiamento_id);

-- Comentários para documentação
COMMENT ON COLUMN transacoes.is_financiamento IS 'Flag para identificar se a transação é relacionada a um financiamento';
COMMENT ON COLUMN transacoes.parcela_financiamento_id IS 'FK para vincular transação com parcela específica de financiamento';

-- Confirmar migração
SELECT 'Migração de campos de financiamento em transacoes aplicada com sucesso!' as resultado; 