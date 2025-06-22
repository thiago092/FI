-- =====================================================================
-- SCRIPT DE MIGRAÇÃO: Sistema Completo de Financiamentos
-- =====================================================================

-- 1. ATUALIZAR TABELA EXISTENTE DE FINANCIAMENTOS
-- =====================================================================

-- Adicionar novos campos à tabela existente (se não existirem)
DO $$
BEGIN
    -- Adicionar campos que podem estar faltando
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'instituicao') THEN
        ALTER TABLE financiamentos ADD COLUMN instituicao VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'numero_contrato') THEN
        ALTER TABLE financiamentos ADD COLUMN numero_contrato VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'tipo_financiamento') THEN
        ALTER TABLE financiamentos ADD COLUMN tipo_financiamento VARCHAR(50) DEFAULT 'pessoal';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'sistema_amortizacao') THEN
        ALTER TABLE financiamentos ADD COLUMN sistema_amortizacao VARCHAR(20) DEFAULT 'PRICE';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'taxa_juros_anual') THEN
        ALTER TABLE financiamentos ADD COLUMN taxa_juros_anual NUMERIC(5,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'parcelas_pagas') THEN
        ALTER TABLE financiamentos ADD COLUMN parcelas_pagas INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'valor_parcela_atual') THEN
        ALTER TABLE financiamentos ADD COLUMN valor_parcela_atual NUMERIC(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'dia_vencimento') THEN
        ALTER TABLE financiamentos ADD COLUMN dia_vencimento INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'conta_debito_id') THEN
        ALTER TABLE financiamentos ADD COLUMN conta_debito_id INTEGER REFERENCES contas(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'auto_debito') THEN
        ALTER TABLE financiamentos ADD COLUMN auto_debito BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'lembrete_vencimento') THEN
        ALTER TABLE financiamentos ADD COLUMN lembrete_vencimento BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'taxa_seguro_mensal') THEN
        ALTER TABLE financiamentos ADD COLUMN taxa_seguro_mensal NUMERIC(5,4) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'taxa_administrativa') THEN
        ALTER TABLE financiamentos ADD COLUMN taxa_administrativa NUMERIC(10,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'observacoes') THEN
        ALTER TABLE financiamentos ADD COLUMN observacoes TEXT;
    END IF;

    -- Atualizar campos existentes se necessário
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'valor_parcela') THEN
        -- Copiar valor_parcela para valor_parcela_atual se não foi feito ainda
        UPDATE financiamentos SET valor_parcela_atual = valor_parcela WHERE valor_parcela_atual IS NULL;
    END IF;

END $$;

-- 2. CRIAR ENUMS PARA FINANCIAMENTOS
-- =====================================================================

-- Tipo de Financiamento
DO $$
BEGIN
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
    END IF;
END $$;

-- Sistema de Amortização
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sistema_amortizacao_enum') THEN
        CREATE TYPE sistema_amortizacao_enum AS ENUM (
            'PRICE',
            'SAC', 
            'SACRE',
            'AMERICANO',
            'BULLET'
        );
    END IF;
END $$;

-- Status do Financiamento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_financiamento_enum') THEN
        CREATE TYPE status_financiamento_enum AS ENUM (
            'simulacao',
            'ativo',
            'em_atraso', 
            'quitado',
            'suspenso'
        );
    END IF;
END $$;

-- Status da Parcela
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_parcela_enum') THEN
        CREATE TYPE status_parcela_enum AS ENUM (
            'pendente',
            'paga',
            'vencida',
            'antecipada'
        );
    END IF;
END $$;

-- 3. ATUALIZAR TIPOS DOS CAMPOS EXISTENTES
-- =====================================================================

DO $$
BEGIN
    -- Atualizar tipo_financiamento se for string
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'tipo_financiamento' AND data_type = 'character varying') THEN
        ALTER TABLE financiamentos ALTER COLUMN tipo_financiamento TYPE tipo_financiamento_enum USING tipo_financiamento::tipo_financiamento_enum;
    END IF;
    
    -- Atualizar sistema_amortizacao se for string
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'sistema_amortizacao' AND data_type = 'character varying') THEN
        ALTER TABLE financiamentos ALTER COLUMN sistema_amortizacao TYPE sistema_amortizacao_enum USING sistema_amortizacao::sistema_amortizacao_enum;
    END IF;
    
    -- Atualizar status se for string
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financiamentos' AND column_name = 'status' AND data_type = 'character varying') THEN
        ALTER TABLE financiamentos ALTER COLUMN status TYPE status_financiamento_enum USING status::status_financiamento_enum;
    END IF;
END $$;

-- 4. CRIAR TABELA DE PARCELAS DO FINANCIAMENTO (INSPIRADA NOS RECORRENTES)
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

-- 5. CRIAR TABELA DE CONFIRMAÇÕES DE FINANCIAMENTO (BASEADA NOS RECORRENTES)
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

-- 6. CRIAR TABELA DE SIMULAÇÕES (PARA HISTÓRICO)
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

-- 7. ATUALIZAR CONSTRAINTS E ÍNDICES
-- =====================================================================

-- Constraints na tabela principal
DO $$
BEGIN
    -- Valor financiado positivo
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financiamentos_valor_positivo') THEN
        ALTER TABLE financiamentos ADD CONSTRAINT financiamentos_valor_positivo 
        CHECK (valor_financiado > 0);
    END IF;
    
    -- Número de parcelas válido
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financiamentos_parcelas_validas') THEN
        ALTER TABLE financiamentos ADD CONSTRAINT financiamentos_parcelas_validas 
        CHECK (numero_parcelas > 0 AND numero_parcelas <= 600); -- máximo 50 anos
    END IF;
    
    -- Taxa de juros válida
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financiamentos_taxa_valida') THEN
        ALTER TABLE financiamentos ADD CONSTRAINT financiamentos_taxa_valida 
        CHECK (taxa_juros_mensal >= 0 AND taxa_juros_mensal <= 10); -- máximo 10% ao mês
    END IF;
    
    -- Dia de vencimento válido
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financiamentos_dia_vencimento_valido') THEN
        ALTER TABLE financiamentos ADD CONSTRAINT financiamentos_dia_vencimento_valido 
        CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31);
    END IF;
    
    -- Parcelas pagas não podem ser maiores que o total
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financiamentos_parcelas_pagas_validas') THEN
        ALTER TABLE financiamentos ADD CONSTRAINT financiamentos_parcelas_pagas_validas 
        CHECK (parcelas_pagas >= 0 AND parcelas_pagas <= numero_parcelas);
    END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_financiamentos_tenant_status ON financiamentos(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_financiamentos_tipo ON financiamentos(tipo_financiamento);
CREATE INDEX IF NOT EXISTS idx_financiamentos_instituicao ON financiamentos(instituicao);

CREATE INDEX IF NOT EXISTS idx_parcelas_financiamento_vencimento ON parcelas_financiamento(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_parcelas_financiamento_status ON parcelas_financiamento(status);
CREATE INDEX IF NOT EXISTS idx_parcelas_financiamento_tenant ON parcelas_financiamento(tenant_id);

CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_status ON confirmacoes_financiamento(status);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_expira ON confirmacoes_financiamento(expira_em);

-- 8. TRIGGERS PARA AUDITORIA E CÁLCULOS AUTOMÁTICOS
-- =====================================================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_financiamento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_financiamento_updated_at') THEN
        CREATE TRIGGER trigger_update_financiamento_updated_at
            BEFORE UPDATE ON financiamentos
            FOR EACH ROW EXECUTE FUNCTION update_financiamento_updated_at();
    END IF;
END $$;

-- Trigger para recalcular saldo devedor quando parcela é paga
CREATE OR REPLACE FUNCTION recalcular_saldo_devedor()
RETURNS TRIGGER AS $$
BEGIN
    -- Se uma parcela foi marcada como paga
    IF NEW.status = 'paga' AND OLD.status != 'paga' THEN
        UPDATE financiamentos 
        SET 
            saldo_devedor = saldo_devedor - NEW.amortizacao_simulada,
            parcelas_pagas = parcelas_pagas + 1
        WHERE id = NEW.financiamento_id;
        
        -- Se todas as parcelas foram pagas, marcar como quitado
        UPDATE financiamentos 
        SET status = 'quitado'
        WHERE id = NEW.financiamento_id 
        AND parcelas_pagas >= numero_parcelas;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_recalcular_saldo_devedor') THEN
        CREATE TRIGGER trigger_recalcular_saldo_devedor
            AFTER UPDATE ON parcelas_financiamento
            FOR EACH ROW EXECUTE FUNCTION recalcular_saldo_devedor();
    END IF;
END $$;

-- 9. VIEWS PARA RELATÓRIOS E DASHBOARDS
-- =====================================================================

-- View para dashboard de financiamentos
CREATE OR REPLACE VIEW vw_dashboard_financiamentos AS
SELECT 
    f.tenant_id,
    COUNT(CASE WHEN f.status = 'ativo' THEN 1 END) as financiamentos_ativos,
    COUNT(CASE WHEN f.status = 'quitado' THEN 1 END) as financiamentos_quitados,
    SUM(CASE WHEN f.status IN ('ativo', 'em_atraso') THEN f.valor_financiado ELSE 0 END) as total_financiado,
    SUM(CASE WHEN f.status IN ('ativo', 'em_atraso') THEN f.saldo_devedor ELSE 0 END) as saldo_devedor_total,
    SUM(CASE WHEN f.status IN ('ativo', 'em_atraso') THEN (f.valor_financiado - f.saldo_devedor) ELSE 0 END) as total_ja_pago,
    AVG(CASE WHEN f.status IN ('ativo', 'em_atraso') THEN f.taxa_juros_anual ELSE NULL END) as media_juros_carteira
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

-- 10. DADOS INICIAIS E MIGRAÇÕES
-- =====================================================================

-- Atualizar registros existentes com valores padrão
UPDATE financiamentos 
SET 
    instituicao = COALESCE(instituicao, 'Instituição não informada'),
    tipo_financiamento = COALESCE(tipo_financiamento::tipo_financiamento_enum, 'pessoal'::tipo_financiamento_enum),
    sistema_amortizacao = COALESCE(sistema_amortizacao::sistema_amortizacao_enum, 'PRICE'::sistema_amortizacao_enum),
    status = COALESCE(status::status_financiamento_enum, 'ativo'::status_financiamento_enum),
    parcelas_pagas = COALESCE(parcelas_pagas, 0),
    valor_parcela_atual = COALESCE(valor_parcela_atual, valor_parcela),
    dia_vencimento = COALESCE(dia_vencimento, EXTRACT(DAY FROM data_primeira_parcela)),
    auto_debito = COALESCE(auto_debito, false),
    lembrete_vencimento = COALESCE(lembrete_vencimento, true),
    taxa_seguro_mensal = COALESCE(taxa_seguro_mensal, 0),
    taxa_administrativa = COALESCE(taxa_administrativa, 0)
WHERE instituicao IS NULL 
   OR tipo_financiamento IS NULL 
   OR sistema_amortizacao IS NULL 
   OR status IS NULL;

-- Calcular taxa anual baseada na mensal se não existir
UPDATE financiamentos 
SET taxa_juros_anual = (((1 + taxa_juros_mensal/100)^12 - 1) * 100)
WHERE taxa_juros_anual IS NULL AND taxa_juros_mensal IS NOT NULL;

COMMIT;

-- =====================================================================
-- SCRIPT CONCLUÍDO COM SUCESSO!
-- =====================================================================

-- Para verificar se tudo foi criado corretamente:
SELECT 'Financiamentos' as tabela, COUNT(*) as registros FROM financiamentos
UNION ALL
SELECT 'Parcelas Financiamento' as tabela, COUNT(*) as registros FROM parcelas_financiamento
UNION ALL
SELECT 'Confirmações Financiamento' as tabela, COUNT(*) as registros FROM confirmacoes_financiamento
UNION ALL
SELECT 'Simulações Financiamento' as tabela, COUNT(*) as registros FROM simulacoes_financiamento; 