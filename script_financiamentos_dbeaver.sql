-- =====================================================================
-- 🔥 SCRIPT DEFINITIVO PARA FINANCIAMENTOS - RODAR NO DBEAVER
-- =====================================================================
-- Autor: Sistema FinançasAI
-- Data: Janeiro 2024
-- Descrição: Script completo para implementar sistema de financiamentos
--           aproveitando estrutura existente e adicionando funcionalidades
-- =====================================================================

BEGIN;

-- 1. VERIFICAR E CRIAR ENUMS NECESSÁRIOS
-- =====================================================================

DO $$
BEGIN
    -- Enum para tipos de financiamento
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_financiamento_enum') THEN
        CREATE TYPE tipo_financiamento_enum AS ENUM (
            'habitacional',
            'veiculo', 
            'pessoal',
            'consignado',
            'empresarial',
            'rural',
            'estudantil'
        );
        RAISE NOTICE '✅ Enum tipo_financiamento_enum criado';
    ELSE
        RAISE NOTICE '⚠️  Enum tipo_financiamento_enum já existe';
    END IF;

    -- Enum para sistemas de amortização
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sistema_amortizacao_enum') THEN
        CREATE TYPE sistema_amortizacao_enum AS ENUM (
            'PRICE',
            'SAC', 
            'SACRE',
            'AMERICANO',
            'BULLET'
        );
        RAISE NOTICE '✅ Enum sistema_amortizacao_enum criado';
    ELSE
        RAISE NOTICE '⚠️  Enum sistema_amortizacao_enum já existe';
    END IF;

    -- Enum para status do financiamento
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_financiamento_enum') THEN
        CREATE TYPE status_financiamento_enum AS ENUM (
            'simulacao',
            'ativo',
            'em_atraso', 
            'quitado',
            'suspenso'
        );
        RAISE NOTICE '✅ Enum status_financiamento_enum criado';
    ELSE
        RAISE NOTICE '⚠️  Enum status_financiamento_enum já existe';
    END IF;

    -- Enum para status da parcela
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_parcela_enum') THEN
        CREATE TYPE status_parcela_enum AS ENUM (
            'pendente',
            'paga',
            'vencida',
            'antecipada'
        );
        RAISE NOTICE '✅ Enum status_parcela_enum criado';
    ELSE
        RAISE NOTICE '⚠️  Enum status_parcela_enum já existe';
    END IF;
END $$;

-- 2. VERIFICAR SE TABELA FINANCIAMENTOS EXISTE E MELHORAR
-- =====================================================================

DO $$
BEGIN
    -- Verificar se tabela existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financiamentos') THEN
        RAISE EXCEPTION '❌ ERRO: Tabela financiamentos não existe! Crie primeiro a estrutura básica.';
    ELSE
        RAISE NOTICE '✅ Tabela financiamentos encontrada, iniciando melhorias...';
    END IF;
END $$;

-- 2.1 ADICIONAR NOVOS CAMPOS (SE NÃO EXISTIREM)
-- =====================================================================

-- Instituição financeira
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'instituicao') THEN
        ALTER TABLE financiamentos ADD COLUMN instituicao VARCHAR(255);
        UPDATE financiamentos SET instituicao = 'Não informado' WHERE instituicao IS NULL;
        RAISE NOTICE '✅ Campo instituicao adicionado';
    END IF;
END $$;

-- Número do contrato
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'numero_contrato') THEN
        ALTER TABLE financiamentos ADD COLUMN numero_contrato VARCHAR(100);
        RAISE NOTICE '✅ Campo numero_contrato adicionado';
    END IF;
END $$;

-- Tipo de financiamento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'tipo_financiamento') THEN
        ALTER TABLE financiamentos ADD COLUMN tipo_financiamento tipo_financiamento_enum DEFAULT 'pessoal';
        RAISE NOTICE '✅ Campo tipo_financiamento adicionado';
    END IF;
END $$;

-- Sistema de amortização
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'sistema_amortizacao') THEN
        ALTER TABLE financiamentos ADD COLUMN sistema_amortizacao sistema_amortizacao_enum DEFAULT 'PRICE';
        RAISE NOTICE '✅ Campo sistema_amortizacao adicionado';
    END IF;
END $$;

-- Taxa de juros anual
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'taxa_juros_anual') THEN
        ALTER TABLE financiamentos ADD COLUMN taxa_juros_anual NUMERIC(5,2);
        -- Calcular taxa anual baseada na mensal existente
        UPDATE financiamentos 
        SET taxa_juros_anual = (((1 + taxa_juros_mensal)^12 - 1) * 100)
        WHERE taxa_juros_anual IS NULL AND taxa_juros_mensal IS NOT NULL;
        RAISE NOTICE '✅ Campo taxa_juros_anual adicionado e calculado';
    END IF;
END $$;

-- Parcelas pagas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'parcelas_pagas') THEN
        ALTER TABLE financiamentos ADD COLUMN parcelas_pagas INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Campo parcelas_pagas adicionado';
    END IF;
END $$;

-- Valor da parcela atual (pode variar no SAC)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'valor_parcela_atual') THEN
        ALTER TABLE financiamentos ADD COLUMN valor_parcela_atual NUMERIC(10,2);
        -- Copiar do valor_parcela existente
        UPDATE financiamentos SET valor_parcela_atual = valor_parcela WHERE valor_parcela_atual IS NULL;
        RAISE NOTICE '✅ Campo valor_parcela_atual adicionado';
    END IF;
END $$;

-- Dia de vencimento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'dia_vencimento') THEN
        ALTER TABLE financiamentos ADD COLUMN dia_vencimento INTEGER;
        -- Extrair dia da data_primeira_parcela
        UPDATE financiamentos 
        SET dia_vencimento = EXTRACT(DAY FROM data_primeira_parcela)
        WHERE dia_vencimento IS NULL AND data_primeira_parcela IS NOT NULL;
        RAISE NOTICE '✅ Campo dia_vencimento adicionado e calculado';
    END IF;
END $$;

-- Conta para débito automático
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'conta_debito_id') THEN
        ALTER TABLE financiamentos ADD COLUMN conta_debito_id INTEGER REFERENCES contas(id);
        RAISE NOTICE '✅ Campo conta_debito_id adicionado';
    END IF;
END $$;

-- Auto débito
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'auto_debito') THEN
        ALTER TABLE financiamentos ADD COLUMN auto_debito BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Campo auto_debito adicionado';
    END IF;
END $$;

-- Lembrete de vencimento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'lembrete_vencimento') THEN
        ALTER TABLE financiamentos ADD COLUMN lembrete_vencimento BOOLEAN DEFAULT TRUE;
        RAISE NOTICE '✅ Campo lembrete_vencimento adicionado';
    END IF;
END $$;

-- Taxa de seguro mensal
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'taxa_seguro_mensal') THEN
        ALTER TABLE financiamentos ADD COLUMN taxa_seguro_mensal NUMERIC(5,4) DEFAULT 0;
        RAISE NOTICE '✅ Campo taxa_seguro_mensal adicionado';
    END IF;
END $$;

-- Taxa administrativa
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'taxa_administrativa') THEN
        ALTER TABLE financiamentos ADD COLUMN taxa_administrativa NUMERIC(10,2) DEFAULT 0;
        RAISE NOTICE '✅ Campo taxa_administrativa adicionado';
    END IF;
END $$;

-- Observações
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'observacoes') THEN
        ALTER TABLE financiamentos ADD COLUMN observacoes TEXT;
        RAISE NOTICE '✅ Campo observacoes adicionado';
    END IF;
END $$;

-- 3. CRIAR TABELA DE PARCELAS DO FINANCIAMENTO
-- =====================================================================

CREATE TABLE IF NOT EXISTS parcelas_financiamento (
    id SERIAL PRIMARY KEY,
    financiamento_id INTEGER NOT NULL REFERENCES financiamentos(id) ON DELETE CASCADE,
    numero_parcela INTEGER NOT NULL,
    
    -- Dados simulados/originais (tabela de amortização)
    data_vencimento DATE NOT NULL,
    saldo_inicial_simulado NUMERIC(12,2) NOT NULL,
    amortizacao_simulada NUMERIC(12,2) NOT NULL,
    juros_simulados NUMERIC(12,2) NOT NULL,
    seguro_simulado NUMERIC(12,2) DEFAULT 0,
    valor_parcela_simulado NUMERIC(12,2) NOT NULL,
    saldo_final_simulado NUMERIC(12,2) NOT NULL,
    
    -- Dados reais (quando pago)
    data_pagamento DATE,
    valor_pago_real NUMERIC(12,2),
    juros_multa_atraso NUMERIC(12,2) DEFAULT 0,
    desconto_quitacao NUMERIC(12,2) DEFAULT 0,
    
    -- Status e controle
    status status_parcela_enum DEFAULT 'pendente',
    dias_atraso INTEGER DEFAULT 0,
    comprovante_path VARCHAR(500),
    
    -- Transação vinculada (quando paga)
    transacao_id INTEGER REFERENCES transacoes(id),
    
    -- Tenant isolation
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(financiamento_id, numero_parcela)
);

-- 4. CRIAR TABELA DE CONFIRMAÇÕES DE FINANCIAMENTO
-- =====================================================================

CREATE TABLE IF NOT EXISTS confirmacoes_financiamento (
    id SERIAL PRIMARY KEY,
    financiamento_id INTEGER NOT NULL REFERENCES financiamentos(id) ON DELETE CASCADE,
    parcela_id INTEGER NOT NULL REFERENCES parcelas_financiamento(id) ON DELETE CASCADE,
    
    -- Dados da parcela que será paga
    descricao VARCHAR(500) NOT NULL,
    valor_parcela NUMERIC(12,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    
    -- Status da confirmação
    status VARCHAR(20) DEFAULT 'PENDENTE',
    
    -- Controle de tempo
    criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expira_em TIMESTAMP NOT NULL,
    respondida_em TIMESTAMP,
    
    -- Transação criada (se confirmada)
    transacao_id INTEGER REFERENCES transacoes(id),
    
    -- Notificações
    telegram_user_id VARCHAR(100),
    telegram_message_id VARCHAR(100),
    whatsapp_user_id VARCHAR(100),
    
    -- Controle
    criada_por_usuario VARCHAR(255),
    observacoes TEXT,
    
    -- Tenant isolation
    tenant_id INTEGER NOT NULL REFERENCES tenants(id)
);

-- 5. CRIAR TABELA DE SIMULAÇÕES
-- =====================================================================

CREATE TABLE IF NOT EXISTS simulacoes_financiamento (
    id SERIAL PRIMARY KEY,
    
    -- Parâmetros da simulação
    valor_financiado NUMERIC(12,2) NOT NULL,
    prazo_meses INTEGER NOT NULL,
    taxa_juros_anual NUMERIC(5,2) NOT NULL,
    taxa_juros_mensal NUMERIC(5,4) NOT NULL,
    sistema_amortizacao sistema_amortizacao_enum NOT NULL,
    data_inicio DATE NOT NULL,
    carencia_meses INTEGER DEFAULT 0,
    taxa_seguro_mensal NUMERIC(5,4) DEFAULT 0,
    taxa_administrativa NUMERIC(10,2) DEFAULT 0,
    
    -- Resultados calculados
    valor_total_pago NUMERIC(12,2),
    total_juros NUMERIC(12,2),
    primeira_parcela NUMERIC(12,2),
    ultima_parcela NUMERIC(12,2),
    parcela_menor NUMERIC(12,2),
    parcela_maior NUMERIC(12,2),
    
    -- Dados extras
    renda_comprovada NUMERIC(12,2),
    comprometimento_renda NUMERIC(5,2),
    
    -- Status
    convertida_em_financiamento BOOLEAN DEFAULT FALSE,
    financiamento_id INTEGER REFERENCES financiamentos(id),
    
    -- Controle
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_name VARCHAR(255)
);

-- 6. CRIAR CONSTRAINTS E VALIDAÇÕES
-- =====================================================================

-- Constraints na tabela principal
DO $$
BEGIN
    -- Valor financiado positivo
    BEGIN
        ALTER TABLE financiamentos ADD CONSTRAINT financiamentos_valor_positivo 
        CHECK (valor_financiado > 0);
        RAISE NOTICE '✅ Constraint valor_positivo adicionada';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '⚠️  Constraint valor_positivo já existe';
    END;
    
    -- Número de parcelas válido
    BEGIN
        ALTER TABLE financiamentos ADD CONSTRAINT financiamentos_parcelas_validas 
        CHECK (numero_parcelas > 0 AND numero_parcelas <= 600);
        RAISE NOTICE '✅ Constraint parcelas_validas adicionada';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '⚠️  Constraint parcelas_validas já existe';
    END;
    
    -- Taxa de juros válida
    BEGIN
        ALTER TABLE financiamentos ADD CONSTRAINT financiamentos_taxa_valida 
        CHECK (taxa_juros_mensal >= 0 AND taxa_juros_mensal <= 10);
        RAISE NOTICE '✅ Constraint taxa_valida adicionada';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '⚠️  Constraint taxa_valida já existe';
    END;
    
    -- Dia de vencimento válido
    BEGIN
        ALTER TABLE financiamentos ADD CONSTRAINT financiamentos_dia_vencimento_valido 
        CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31);
        RAISE NOTICE '✅ Constraint dia_vencimento_valido adicionada';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '⚠️  Constraint dia_vencimento_valido já existe';
    END;
    
    -- Parcelas pagas não podem ser maiores que o total
    BEGIN
        ALTER TABLE financiamentos ADD CONSTRAINT financiamentos_parcelas_pagas_validas 
        CHECK (parcelas_pagas >= 0 AND parcelas_pagas <= numero_parcelas);
        RAISE NOTICE '✅ Constraint parcelas_pagas_validas adicionada';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '⚠️  Constraint parcelas_pagas_validas já existe';
    END;
END $$;

-- 7. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_financiamentos_tenant_status ON financiamentos(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_financiamentos_tipo ON financiamentos(tipo_financiamento);
CREATE INDEX IF NOT EXISTS idx_financiamentos_instituicao ON financiamentos(instituicao);
CREATE INDEX IF NOT EXISTS idx_financiamentos_data_primeira_parcela ON financiamentos(data_primeira_parcela);

CREATE INDEX IF NOT EXISTS idx_parcelas_financiamento_vencimento ON parcelas_financiamento(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_parcelas_financiamento_status ON parcelas_financiamento(status);
CREATE INDEX IF NOT EXISTS idx_parcelas_financiamento_tenant ON parcelas_financiamento(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_financiamento_financiamento ON parcelas_financiamento(financiamento_id);

CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_status ON confirmacoes_financiamento(status);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_expira ON confirmacoes_financiamento(expira_em);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_tenant ON confirmacoes_financiamento(tenant_id);

CREATE INDEX IF NOT EXISTS idx_simulacoes_financiamento_tenant ON simulacoes_financiamento(tenant_id);
CREATE INDEX IF NOT EXISTS idx_simulacoes_financiamento_data ON simulacoes_financiamento(created_at);

RAISE NOTICE '✅ Índices criados para melhor performance';

-- 8. CRIAR TRIGGERS PARA AUDITORIA E CÁLCULOS AUTOMÁTICOS
-- =====================================================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_financiamento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_financiamento_updated_at') THEN
        CREATE TRIGGER trigger_update_financiamento_updated_at
            BEFORE UPDATE ON financiamentos
            FOR EACH ROW EXECUTE FUNCTION update_financiamento_updated_at();
        RAISE NOTICE '✅ Trigger update_financiamento_updated_at criado';
    ELSE
        RAISE NOTICE '⚠️  Trigger update_financiamento_updated_at já existe';
    END IF;
END $$;

-- Trigger para recalcular saldo devedor quando parcela é paga
CREATE OR REPLACE FUNCTION recalcular_saldo_devedor()
RETURNS TRIGGER AS $$
BEGIN
    -- Se uma parcela foi marcada como paga
    IF NEW.status = 'paga' AND (OLD.status IS NULL OR OLD.status != 'paga') THEN
        UPDATE financiamentos 
        SET 
            saldo_devedor = saldo_devedor - NEW.amortizacao_simulada,
            parcelas_pagas = parcelas_pagas + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.financiamento_id;
        
        -- Se todas as parcelas foram pagas, marcar como quitado
        UPDATE financiamentos 
        SET status = 'quitado'::status_financiamento_enum
        WHERE id = NEW.financiamento_id 
        AND parcelas_pagas >= numero_parcelas;
        
        RAISE NOTICE 'Saldo devedor recalculado para financiamento %', NEW.financiamento_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_recalcular_saldo_devedor') THEN
        CREATE TRIGGER trigger_recalcular_saldo_devedor
            AFTER UPDATE ON parcelas_financiamento
            FOR EACH ROW EXECUTE FUNCTION recalcular_saldo_devedor();
        RAISE NOTICE '✅ Trigger recalcular_saldo_devedor criado';
    ELSE
        RAISE NOTICE '⚠️  Trigger recalcular_saldo_devedor já existe';
    END IF;
END $$;

-- 9. CRIAR VIEWS PARA RELATÓRIOS E DASHBOARDS
-- =====================================================================

-- View para dashboard de financiamentos
CREATE OR REPLACE VIEW vw_dashboard_financiamentos AS
SELECT 
    f.tenant_id,
    COUNT(CASE WHEN f.status = 'ativo' THEN 1 END) as financiamentos_ativos,
    COUNT(CASE WHEN f.status = 'quitado' THEN 1 END) as financiamentos_quitados,
    COALESCE(SUM(CASE WHEN f.status IN ('ativo', 'em_atraso') THEN f.valor_financiado ELSE 0 END), 0) as total_financiado,
    COALESCE(SUM(CASE WHEN f.status IN ('ativo', 'em_atraso') THEN f.saldo_devedor ELSE 0 END), 0) as saldo_devedor_total,
    COALESCE(SUM(CASE WHEN f.status IN ('ativo', 'em_atraso') THEN (f.valor_financiado - f.saldo_devedor) ELSE 0 END), 0) as total_ja_pago,
    COALESCE(AVG(CASE WHEN f.status IN ('ativo', 'em_atraso') THEN f.taxa_juros_anual ELSE NULL END), 0) as media_juros_carteira
FROM financiamentos f
GROUP BY f.tenant_id;

-- View para próximos vencimentos
CREATE OR REPLACE VIEW vw_proximos_vencimentos_financiamento AS
SELECT 
    pf.tenant_id,
    f.id as financiamento_id,
    f.descricao as financiamento_nome,
    pf.numero_parcela,
    pf.data_vencimento,
    pf.valor_parcela_simulado as valor,
    pf.status,
    CASE 
        WHEN pf.data_vencimento < CURRENT_DATE THEN CURRENT_DATE - pf.data_vencimento
        ELSE 0 
    END as dias_atraso,
    CASE 
        WHEN pf.data_vencimento >= CURRENT_DATE THEN pf.data_vencimento - CURRENT_DATE
        ELSE 0 
    END as dias_para_vencimento
FROM parcelas_financiamento pf
JOIN financiamentos f ON f.id = pf.financiamento_id
WHERE pf.status IN ('pendente', 'vencida')
AND f.status IN ('ativo', 'em_atraso')
ORDER BY pf.data_vencimento;

RAISE NOTICE '✅ Views criadas para dashboard e relatórios';

-- 10. ATUALIZAR DADOS EXISTENTES COM VALORES PADRÃO
-- =====================================================================

-- Atualizar registros existentes com valores padrão seguros
UPDATE financiamentos 
SET 
    instituicao = COALESCE(instituicao, 'Não informado'),
    tipo_financiamento = COALESCE(tipo_financiamento, 'pessoal'::tipo_financiamento_enum),
    sistema_amortizacao = COALESCE(sistema_amortizacao, 'PRICE'::sistema_amortizacao_enum),
    parcelas_pagas = COALESCE(parcelas_pagas, 0),
    valor_parcela_atual = COALESCE(valor_parcela_atual, valor_parcela),
    dia_vencimento = COALESCE(dia_vencimento, EXTRACT(DAY FROM data_primeira_parcela)),
    auto_debito = COALESCE(auto_debito, false),
    lembrete_vencimento = COALESCE(lembrete_vencimento, true),
    taxa_seguro_mensal = COALESCE(taxa_seguro_mensal, 0),
    taxa_administrativa = COALESCE(taxa_administrativa, 0),
    updated_at = CURRENT_TIMESTAMP
WHERE instituicao IS NULL 
   OR tipo_financiamento IS NULL 
   OR sistema_amortizacao IS NULL 
   OR parcelas_pagas IS NULL
   OR valor_parcela_atual IS NULL
   OR auto_debito IS NULL;

-- Calcular taxa anual se não existir (usando fórmula de juros compostos)
UPDATE financiamentos 
SET taxa_juros_anual = ROUND((((1 + taxa_juros_mensal)^12 - 1) * 100)::numeric, 2)
WHERE taxa_juros_anual IS NULL AND taxa_juros_mensal IS NOT NULL;

RAISE NOTICE '✅ Dados existentes atualizados com valores padrão';

-- 11. ADICIONAR CAMPOS NA TABELA TRANSACOES (SE NECESSÁRIO)
-- =====================================================================

-- Campo para vincular transação a parcela de financiamento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes' AND column_name = 'parcela_financiamento_id') THEN
        ALTER TABLE transacoes ADD COLUMN parcela_financiamento_id INTEGER REFERENCES parcelas_financiamento(id);
        RAISE NOTICE '✅ Campo parcela_financiamento_id adicionado em transacoes';
    END IF;
END $$;

-- Campo para identificar transações de financiamento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes' AND column_name = 'is_financiamento') THEN
        ALTER TABLE transacoes ADD COLUMN is_financiamento BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Campo is_financiamento adicionado em transacoes';
    END IF;
END $$;

-- 12. DADOS PARA TESTE (OPCIONAL - DESCOMENTE SE QUISER)
-- =====================================================================

/*
-- Inserir dados de teste (descomente se quiser testar)
DO $$
DECLARE
    test_tenant_id INTEGER := 1; -- Altere para seu tenant_id
    test_categoria_id INTEGER := 1; -- Altere para uma categoria válida
BEGIN
    -- Verificar se já existem dados de teste
    IF NOT EXISTS (SELECT 1 FROM financiamentos WHERE descricao LIKE '%TESTE%') THEN
        INSERT INTO simulacoes_financiamento (
            valor_financiado, prazo_meses, taxa_juros_anual, taxa_juros_mensal,
            sistema_amortizacao, data_inicio, tenant_id, created_by_name,
            valor_total_pago, total_juros, primeira_parcela, ultima_parcela
        ) VALUES (
            100000, 48, 12.5, 0.987, 'PRICE', CURRENT_DATE, 
            test_tenant_id, 'Sistema - Teste',
            125000, 25000, 2604.17, 2604.17
        );
        
        RAISE NOTICE '✅ Dados de teste inseridos em simulacoes_financiamento';
    END IF;
END $$;
*/

COMMIT;

-- =====================================================================
-- 🎉 SCRIPT EXECUTADO COM SUCESSO!
-- =====================================================================

-- Verificar resultados
DO $$
DECLARE
    financiamentos_count INTEGER;
    parcelas_count INTEGER;
    confirmacoes_count INTEGER;
    simulacoes_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO financiamentos_count FROM financiamentos;
    SELECT COUNT(*) INTO parcelas_count FROM parcelas_financiamento;
    SELECT COUNT(*) INTO confirmacoes_count FROM confirmacoes_financiamento;
    SELECT COUNT(*) INTO simulacoes_count FROM simulacoes_financiamento;
    
    RAISE NOTICE '
    =====================================================================
    🎉 SISTEMA DE FINANCIAMENTOS CONFIGURADO COM SUCESSO!
    =====================================================================
    
    📊 ESTATÍSTICAS:
    • Financiamentos existentes: %
    • Parcelas cadastradas: %
    • Confirmações pendentes: %
    • Simulações realizadas: %
    
    📋 PRÓXIMOS PASSOS:
    1. ✅ Estrutura do banco configurada
    2. 🔄 Implementar APIs Python (backend/app/api/financiamentos.py)
    3. 🎨 Interface já criada (frontend/src/pages/Financiamentos.tsx)
    4. 🧮 Services de cálculo prontos (backend/app/services/financiamento_service.py)
    
    🚀 PRONTO PARA USO!
    =====================================================================', 
    financiamentos_count, parcelas_count, confirmacoes_count, simulacoes_count;
END $$;

-- Query final para verificar tudo
SELECT 
    'financiamentos' as tabela, 
    COUNT(*) as registros,
    'Estrutura principal' as descricao
FROM financiamentos
UNION ALL
SELECT 
    'parcelas_financiamento' as tabela, 
    COUNT(*) as registros,
    'Controle de parcelas' as descricao
FROM parcelas_financiamento
UNION ALL
SELECT 
    'confirmacoes_financiamento' as tabela, 
    COUNT(*) as registros,
    'Sistema de confirmações' as descricao
FROM confirmacoes_financiamento
UNION ALL
SELECT 
    'simulacoes_financiamento' as tabela, 
    COUNT(*) as registros,
    'Histórico de simulações' as descricao
FROM simulacoes_financiamento
ORDER BY registros DESC; 