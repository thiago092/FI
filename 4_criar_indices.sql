-- =====================================================================
-- PASSO 4: CRIAR ÍNDICES PARA PERFORMANCE
-- Execute este script após adicionar a coluna parcela_id
-- =====================================================================

-- Criar índices para melhorar a performance das consultas
CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_status 
ON confirmacoes_financiamento(status);

CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_expira 
ON confirmacoes_financiamento(expira_em);

CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_tenant 
ON confirmacoes_financiamento(tenant_id);

CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_financiamento 
ON confirmacoes_financiamento(financiamento_id);

CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_parcela 
ON confirmacoes_financiamento(parcela_id);

-- Verificar se os índices foram criados
SELECT 'Índices criados com sucesso!' as resultado; 