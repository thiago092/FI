-- Migração: Adicionar coluna invited_email à tabela email_verification_tokens
-- Data: 2025-01-06
-- Descrição: Adiciona suporte para armazenar o email do usuário convidado nos tokens de convite

-- Adicionar coluna invited_email (nullable)
ALTER TABLE email_verification_tokens 
ADD COLUMN invited_email VARCHAR(255) NULL;

-- Criar índice para otimizar consultas por email convidado
CREATE INDEX idx_email_verification_tokens_invited_email 
ON email_verification_tokens(invited_email);

-- Comentário da coluna
COMMENT ON COLUMN email_verification_tokens.invited_email IS 'Email do usuário convidado (apenas para tokens de convite)';

-- Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'email_verification_tokens' 
AND column_name = 'invited_email'; 