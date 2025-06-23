-- Migração: Criar tabela de histórico de financiamentos
-- Data: 2025-01-01
-- Descrição: Tabela para armazenar histórico de alterações nos financiamentos

CREATE TABLE IF NOT EXISTS historico_financiamentos (
    id SERIAL PRIMARY KEY,
    financiamento_id INTEGER NOT NULL REFERENCES financiamentos(id) ON DELETE CASCADE,
    data_alteracao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo_operacao VARCHAR(50) NOT NULL,
    descricao TEXT NOT NULL,
    
    -- Dados anteriores
    saldo_devedor_anterior DECIMAL(15,2),
    parcelas_pagas_anterior INTEGER,
    valor_parcela_anterior DECIMAL(15,2),
    
    -- Dados novos
    saldo_devedor_novo DECIMAL(15,2),
    parcelas_pagas_novo INTEGER,
    valor_parcela_novo DECIMAL(15,2),
    
    -- Valor da operação
    valor_operacao DECIMAL(15,2),
    economia_juros DECIMAL(15,2),
    
    -- Dados adicionais em JSON
    dados_adicionais TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_historico_financiamentos_financiamento_id 
ON historico_financiamentos(financiamento_id);

CREATE INDEX IF NOT EXISTS idx_historico_financiamentos_data_alteracao 
ON historico_financiamentos(data_alteracao DESC);

CREATE INDEX IF NOT EXISTS idx_historico_financiamentos_tipo_operacao 
ON historico_financiamentos(tipo_operacao);

-- Comentários para documentação
COMMENT ON TABLE historico_financiamentos IS 'Histórico de alterações nos financiamentos';
COMMENT ON COLUMN historico_financiamentos.tipo_operacao IS 'Tipo da operação: adiantamento, pagamento_parcela, criacao, exclusao, etc.';
COMMENT ON COLUMN historico_financiamentos.descricao IS 'Descrição detalhada da operação realizada';
COMMENT ON COLUMN historico_financiamentos.economia_juros IS 'Economia de juros gerada pela operação (quando aplicável)';
COMMENT ON COLUMN historico_financiamentos.dados_adicionais IS 'Dados extras em formato JSON para informações específicas'; 