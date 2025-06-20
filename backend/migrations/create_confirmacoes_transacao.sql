-- Migração: Criar tabela confirmacoes_transacao
-- Data: 2024-12-19
-- Descrição: Tabela para gerenciar confirmações de transações recorrentes via Telegram

CREATE TABLE IF NOT EXISTS confirmacoes_transacao (
    id SERIAL PRIMARY KEY,
    transacao_recorrente_id INTEGER NOT NULL,
    descricao VARCHAR NOT NULL,
    valor NUMERIC(10, 2) NOT NULL,
    tipo VARCHAR NOT NULL,
    categoria_id INTEGER NOT NULL,
    conta_id INTEGER,
    cartao_id INTEGER,
    data_transacao DATE NOT NULL,
    status VARCHAR DEFAULT 'PENDENTE',
    criada_em TIMESTAMP DEFAULT NOW(),
    expira_em TIMESTAMP NOT NULL,
    respondida_em TIMESTAMP,
    processada_em TIMESTAMP,
    transacao_id INTEGER,
    telegram_user_id VARCHAR,
    telegram_message_id VARCHAR,
    criada_por_usuario VARCHAR(255),
    observacoes TEXT,
    tenant_id INTEGER NOT NULL
);

-- Adicionar foreign keys
ALTER TABLE confirmacoes_transacao ADD FOREIGN KEY (transacao_recorrente_id) REFERENCES transacoes_recorrentes(id);
ALTER TABLE confirmacoes_transacao ADD FOREIGN KEY (categoria_id) REFERENCES categorias(id);
ALTER TABLE confirmacoes_transacao ADD FOREIGN KEY (conta_id) REFERENCES contas(id);
ALTER TABLE confirmacoes_transacao ADD FOREIGN KEY (cartao_id) REFERENCES cartoes(id);
ALTER TABLE confirmacoes_transacao ADD FOREIGN KEY (transacao_id) REFERENCES transacoes(id);
ALTER TABLE confirmacoes_transacao ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- Adicionar constraints
ALTER TABLE confirmacoes_transacao ADD CHECK (valor > 0);
ALTER TABLE confirmacoes_transacao ADD CHECK (tipo IN ('ENTRADA', 'SAIDA'));
ALTER TABLE confirmacoes_transacao ADD CHECK (status IN ('PENDENTE', 'CONFIRMADA', 'CANCELADA', 'AUTO_CONFIRMADA'));
ALTER TABLE confirmacoes_transacao ADD CHECK ((conta_id IS NOT NULL AND cartao_id IS NULL) OR (conta_id IS NULL AND cartao_id IS NOT NULL));

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_confirmacoes_status ON confirmacoes_transacao(status);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_expira_em ON confirmacoes_transacao(expira_em);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_tenant ON confirmacoes_transacao(tenant_id);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_telegram ON confirmacoes_transacao(telegram_user_id);

-- Comentários para documentação
COMMENT ON TABLE confirmacoes_transacao IS 'Gerencia confirmações de transações recorrentes via Telegram';
COMMENT ON COLUMN confirmacoes_transacao.status IS 'Status da confirmação: PENDENTE, CONFIRMADA, CANCELADA, AUTO_CONFIRMADA';
COMMENT ON COLUMN confirmacoes_transacao.expira_em IS 'Quando a confirmação expira e transação é criada automaticamente';
COMMENT ON COLUMN confirmacoes_transacao.criada_por_usuario IS 'Nome do usuário que criou a transação recorrente original';
COMMENT ON COLUMN confirmacoes_transacao.telegram_user_id IS 'ID do usuário no Telegram que receberá a notificação'; 