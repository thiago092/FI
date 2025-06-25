-- =====================================================================
-- ALTERNATIVA: CRIAR TABELA COMPLETA DO ZERO
-- Execute este script APENAS se o passo 1 mostrou que a tabela NÃO EXISTE
-- =====================================================================

-- ATENÇÃO: Só execute este script se a tabela confirmacoes_financiamento NÃO EXISTIR!
-- Se a tabela já existir, use os outros scripts numerados

CREATE TABLE confirmacoes_financiamento (
    id SERIAL PRIMARY KEY,
    financiamento_id INTEGER NOT NULL REFERENCES financiamentos(id) ON DELETE CASCADE,
    parcela_id INTEGER NOT NULL REFERENCES parcelas_financiamento(id) ON DELETE CASCADE,
    
    -- Dados da parcela que será paga
    descricao VARCHAR(500) NOT NULL,
    valor_parcela NUMERIC(12,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    
    -- Status da confirmação
    status VARCHAR(20) DEFAULT 'PENDENTE', -- PENDENTE, CONFIRMADA, CANCELADA, AUTO_CONFIRMADA
    
    -- Controle de tempo
    criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expira_em TIMESTAMP NOT NULL,
    respondida_em TIMESTAMP,
    
    -- Transação criada (se confirmada)
    transacao_id INTEGER REFERENCES transacoes(id),
    
    -- Telegram/WhatsApp integration
    telegram_user_id VARCHAR(100),
    telegram_message_id VARCHAR(100),
    whatsapp_user_id VARCHAR(100),
    
    -- Controle
    criada_por_usuario VARCHAR(255),
    observacoes TEXT,
    
    -- Tenant isolation
    tenant_id INTEGER NOT NULL REFERENCES tenants(id)
);

-- Verificar se a tabela foi criada
SELECT 'Tabela confirmacoes_financiamento criada com sucesso!' as resultado; 