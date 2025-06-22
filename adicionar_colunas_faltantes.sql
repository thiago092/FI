-- Script para adicionar colunas faltantes na tabela parcelas_financiamento
-- Execute no DBeaver

-- 1. Adicionar colunas que estão faltando na tabela parcelas_financiamento
ALTER TABLE parcelas_financiamento 
ADD COLUMN IF NOT EXISTS valor_parcela_simulado NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS valor_juros NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS valor_amortizacao NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS saldo_devedor_pos NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS tipo_parcela VARCHAR(20) DEFAULT 'NORMAL',
ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- 2. Criar tabela confirmacoes_financiamento (que não existe)
CREATE TABLE IF NOT EXISTS confirmacoes_financiamento (
    id SERIAL PRIMARY KEY,
    parcela_financiamento_id INTEGER NOT NULL REFERENCES parcelas_financiamento(id),
    financiamento_id INTEGER NOT NULL REFERENCES financiamentos(id),
    valor_confirmado NUMERIC(12,2) NOT NULL,
    data_confirmacao DATE NOT NULL,
    tipo_confirmacao VARCHAR(20) DEFAULT 'PAGAMENTO',
    observacoes TEXT,
    criada_por_usuario BOOLEAN DEFAULT TRUE,
    tenant_id INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_parcela 
ON confirmacoes_financiamento(parcela_financiamento_id);

CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_financiamento 
ON confirmacoes_financiamento(financiamento_id);

CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_tenant 
ON confirmacoes_financiamento(tenant_id);

-- 4. Atualizar valores nas colunas novas (opcional - para dados existentes)
UPDATE parcelas_financiamento 
SET 
    valor_parcela_simulado = valor_parcela,
    valor_juros = 0,
    valor_amortizacao = valor_parcela,
    saldo_devedor_pos = saldo_devedor
WHERE valor_parcela_simulado IS NULL; 