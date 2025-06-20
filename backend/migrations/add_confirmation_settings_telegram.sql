-- Migração: Adicionar configurações de confirmação de transações recorrentes
-- Data: 2024-12-19
-- Descrição: Adiciona campos para configurar confirmação via Telegram

-- Adicionar colunas para configuração de confirmação
ALTER TABLE telegram_users 
ADD COLUMN IF NOT EXISTS confirmar_transacoes_recorrentes BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS timeout_confirmacao_horas INTEGER DEFAULT 2;

-- Adicionar comentários para documentação
COMMENT ON COLUMN telegram_users.confirmar_transacoes_recorrentes IS 'Se deve pedir confirmação via Telegram antes de criar transações recorrentes';
COMMENT ON COLUMN telegram_users.timeout_confirmacao_horas IS 'Horas para auto-confirmar transação se usuário não responder (1-24)'; 