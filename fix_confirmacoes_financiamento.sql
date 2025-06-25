-- =====================================================================
-- SCRIPT PARA CORRIGIR TABELA CONFIRMACOES_FINANCIAMENTO
-- Execute este script no DBeaver para corrigir a estrutura da tabela
-- =====================================================================

-- 1. VERIFICAR SE A TABELA EXISTE
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'confirmacoes_financiamento') THEN
        RAISE NOTICE '✅ Tabela confirmacoes_financiamento existe';
    ELSE
        RAISE NOTICE '❌ Tabela confirmacoes_financiamento NÃO existe';
    END IF;
END $$;

-- 2. VERIFICAR COLUNAS EXISTENTES
SELECT 
    '📋 COLUNAS ATUAIS:' as info,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'confirmacoes_financiamento'
ORDER BY ordinal_position;

-- 3. VERIFICAR SE A COLUNA PARCELA_ID EXISTE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'confirmacoes_financiamento' 
        AND column_name = 'parcela_id'
    ) THEN
        RAISE NOTICE '✅ Coluna parcela_id JÁ EXISTE - nenhuma correção necessária';
    ELSE
        RAISE NOTICE '❌ Coluna parcela_id NÃO EXISTE - será adicionada';
        
        -- Adicionar a coluna parcela_id
        ALTER TABLE confirmacoes_financiamento 
        ADD COLUMN parcela_id INTEGER REFERENCES parcelas_financiamento(id) ON DELETE CASCADE;
        
        RAISE NOTICE '✅ Coluna parcela_id adicionada com sucesso!';
    END IF;
END $$;

-- 4. VERIFICAR QUANTOS REGISTROS EXISTEM NA TABELA
SELECT 
    '📊 REGISTROS NA TABELA:' as info,
    COUNT(*) as total_registros
FROM confirmacoes_financiamento;

-- 5. CRIAR A TABELA COMPLETA SE ELA NÃO EXISTIR
CREATE TABLE IF NOT EXISTS confirmacoes_financiamento (
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

-- 6. CRIAR ÍNDICES PARA PERFORMANCE
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

-- 7. VERIFICAÇÃO FINAL
SELECT 
    '🎉 VERIFICAÇÃO FINAL:' as info,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'confirmacoes_financiamento'
AND column_name IN ('id', 'financiamento_id', 'parcela_id', 'status', 'tenant_id')
ORDER BY 
    CASE column_name 
        WHEN 'id' THEN 1
        WHEN 'financiamento_id' THEN 2
        WHEN 'parcela_id' THEN 3
        WHEN 'status' THEN 4
        WHEN 'tenant_id' THEN 5
        ELSE 6
    END;

-- 8. MOSTRAR RESUMO
DO $$
DECLARE
    total_registros INTEGER;
    tem_parcela_id BOOLEAN;
BEGIN
    -- Contar registros
    SELECT COUNT(*) INTO total_registros FROM confirmacoes_financiamento;
    
    -- Verificar se tem parcela_id
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'confirmacoes_financiamento' 
        AND column_name = 'parcela_id'
    ) INTO tem_parcela_id;
    
    RAISE NOTICE '';
    RAISE NOTICE '================================';
    RAISE NOTICE '🎉 RESUMO DA CORREÇÃO:';
    RAISE NOTICE '================================';
    RAISE NOTICE '📊 Total de registros: %', total_registros;
    RAISE NOTICE '🎯 Coluna parcela_id: %', CASE WHEN tem_parcela_id THEN '✅ EXISTE' ELSE '❌ NÃO EXISTE' END;
    
    IF tem_parcela_id THEN
        RAISE NOTICE '✅ SUCESSO! Tabela confirmacoes_financiamento está correta!';
        RAISE NOTICE '   ✅ Estrutura compatível com o modelo Python';
        RAISE NOTICE '   ✅ Exclusão de financiamentos deve funcionar agora';
    ELSE
        RAISE NOTICE '❌ ERRO! Ainda há problemas com a tabela';
    END IF;
    
    RAISE NOTICE '================================';
END $$; 