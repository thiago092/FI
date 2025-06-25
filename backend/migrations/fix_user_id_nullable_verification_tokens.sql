-- Migração: Tornar coluna user_id nullable na tabela email_verification_tokens
-- Data: 2025-01-06
-- Descrição: Permite que tokens de convite sejam criados sem user_id (usuário ainda não existe)

-- Alterar coluna user_id para permitir NULL
ALTER TABLE email_verification_tokens 
ALTER COLUMN user_id DROP NOT NULL;

-- Verificar a alteração
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'email_verification_tokens' 
AND column_name = 'user_id'; 