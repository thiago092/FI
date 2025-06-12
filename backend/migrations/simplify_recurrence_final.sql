-- Migração para simplificar transações recorrentes
-- Remover dia_vencimento e usar apenas data_inicio + frequencia
-- Execute no DBeaver

-- 1. Remover constraints que fazem referência ao dia_vencimento
DO $$ 
BEGIN
    -- Remove constraint check_dia_vencimento se existir
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'check_dia_vencimento' 
               AND table_name = 'transacoes_recorrentes') THEN
        ALTER TABLE transacoes_recorrentes DROP CONSTRAINT check_dia_vencimento;
    END IF;
    
    -- Remove outras constraints relacionadas se existirem
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'check_dia_vencimento_condicional' 
               AND table_name = 'transacoes_recorrentes') THEN
        ALTER TABLE transacoes_recorrentes DROP CONSTRAINT check_dia_vencimento_condicional;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'check_tipo_recorrencia' 
               AND table_name = 'transacoes_recorrentes') THEN
        ALTER TABLE transacoes_recorrentes DROP CONSTRAINT check_tipo_recorrencia;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'check_dia_semana' 
               AND table_name = 'transacoes_recorrentes') THEN
        ALTER TABLE transacoes_recorrentes DROP CONSTRAINT check_dia_semana;
    END IF;
END $$;

-- 2. Remover colunas desnecessárias se existirem
DO $$ 
BEGIN
    -- Remove dia_vencimento
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'transacoes_recorrentes' 
               AND column_name = 'dia_vencimento') THEN
        ALTER TABLE transacoes_recorrentes DROP COLUMN dia_vencimento;
    END IF;
    
    -- Remove dia_semana se existir
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'transacoes_recorrentes' 
               AND column_name = 'dia_semana') THEN
        ALTER TABLE transacoes_recorrentes DROP COLUMN dia_semana;
    END IF;
    
    -- Remove tipo_recorrencia se existir
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'transacoes_recorrentes' 
               AND column_name = 'tipo_recorrencia') THEN
        ALTER TABLE transacoes_recorrentes DROP COLUMN tipo_recorrencia;
    END IF;
END $$;

-- 3. Garantir que data_inicio seja obrigatória
ALTER TABLE transacoes_recorrentes ALTER COLUMN data_inicio SET NOT NULL;

-- 4. Adicionar constraint para frequencias válidas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'check_frequencia_valida' 
                   AND table_name = 'transacoes_recorrentes') THEN
        ALTER TABLE transacoes_recorrentes ADD CONSTRAINT check_frequencia_valida 
        CHECK (frequencia IN ('DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'));
    END IF;
END $$;

-- 5. Adicionar índices para performance se não existirem
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE indexname = 'idx_transacoes_recorrentes_data_inicio') THEN
        CREATE INDEX idx_transacoes_recorrentes_data_inicio ON transacoes_recorrentes(data_inicio);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE indexname = 'idx_transacoes_recorrentes_frequencia') THEN
        CREATE INDEX idx_transacoes_recorrentes_frequencia ON transacoes_recorrentes(frequencia);
    END IF;
END $$;

-- 6. Verificar resultado final
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'transacoes_recorrentes' 
ORDER BY ordinal_position; 