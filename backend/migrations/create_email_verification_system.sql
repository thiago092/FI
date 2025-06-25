-- Migration: Email Verification System
-- Data: 2024-12-19
-- Descrição: Adiciona sistema de verificação de email e recuperação de senha

-- 1. Adicionar campo email_verified na tabela users (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email_verified'
    ) THEN
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
        UPDATE users SET email_verified = TRUE WHERE is_active = TRUE; -- Usuários existentes já verificados
    END IF;
END $$;

-- 2. Criar tabela de tokens de verificação de email
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    token_type VARCHAR(50) NOT NULL DEFAULT 'email_verification', -- 'email_verification' ou 'password_reset'
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    
    -- Índices para performance
    INDEX(user_id),
    INDEX(token),
    INDEX(token_type),
    INDEX(expires_at),
    INDEX(used)
);

-- 3. Comentários para documentação
COMMENT ON TABLE email_verification_tokens IS 'Tokens para verificação de email e recuperação de senha';
COMMENT ON COLUMN email_verification_tokens.token_type IS 'Tipo do token: email_verification ou password_reset';
COMMENT ON COLUMN email_verification_tokens.expires_at IS 'Data/hora de expiração do token (24h para verificação, 1h para reset)';
COMMENT ON COLUMN email_verification_tokens.used IS 'Indica se o token já foi utilizado';

-- 4. Verificar se tudo foi criado corretamente
DO $$
BEGIN
    -- Verificar se a tabela foi criada
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_verification_tokens') THEN
        RAISE NOTICE 'Tabela email_verification_tokens criada com sucesso!';
    ELSE
        RAISE EXCEPTION 'Erro: Tabela email_verification_tokens não foi criada!';
    END IF;
    
    -- Verificar se o campo email_verified foi adicionado
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified') THEN
        RAISE NOTICE 'Campo email_verified adicionado com sucesso!';
    ELSE
        RAISE EXCEPTION 'Erro: Campo email_verified não foi adicionado!';
    END IF;
    
    RAISE NOTICE 'Sistema de verificação de email configurado com sucesso! ✅';
END $$; 