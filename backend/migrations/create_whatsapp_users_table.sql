-- Migração: Criação da tabela whatsapp_users
-- Data: 2024-12-20
-- Descrição: Adiciona suporte para integração com WhatsApp Business API

-- Criar tabela whatsapp_users
CREATE TABLE IF NOT EXISTS whatsapp_users (
    id SERIAL PRIMARY KEY,
    whatsapp_id VARCHAR UNIQUE NOT NULL,
    phone_number VARCHAR NOT NULL,
    whatsapp_name VARCHAR,
    
    -- Associação com usuário da aplicação
    user_id INTEGER REFERENCES users(id),
    is_authenticated BOOLEAN DEFAULT FALSE,
    auth_code VARCHAR,
    auth_code_expires TIMESTAMP,
    
    -- Configurações do bot
    is_active BOOLEAN DEFAULT TRUE,
    language VARCHAR DEFAULT 'pt-BR',
    
    -- Metadados do WhatsApp
    profile_name VARCHAR,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_whatsapp_id ON whatsapp_users(whatsapp_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_user_id ON whatsapp_users(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_phone_number ON whatsapp_users(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_is_authenticated ON whatsapp_users(is_authenticated);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_whatsapp_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at automaticamente
-- Primeiro, remove o trigger se existir
DROP TRIGGER IF EXISTS trigger_update_whatsapp_users_updated_at ON whatsapp_users;

-- Agora cria o trigger
CREATE TRIGGER trigger_update_whatsapp_users_updated_at
    BEFORE UPDATE ON whatsapp_users
    FOR EACH ROW
    EXECUTE FUNCTION update_whatsapp_users_updated_at();

-- Comentários nas colunas para documentação
COMMENT ON TABLE whatsapp_users IS 'Usuários vinculados ao WhatsApp Business API';
COMMENT ON COLUMN whatsapp_users.whatsapp_id IS 'ID único do usuário no WhatsApp';
COMMENT ON COLUMN whatsapp_users.phone_number IS 'Número de telefone do usuário';
COMMENT ON COLUMN whatsapp_users.user_id IS 'Referência ao usuário da aplicação (pode ser NULL até autenticação)';
COMMENT ON COLUMN whatsapp_users.is_authenticated IS 'Indica se o usuário já foi autenticado na aplicação';
COMMENT ON COLUMN whatsapp_users.auth_code IS 'Código temporário para autenticação';
COMMENT ON COLUMN whatsapp_users.auth_code_expires IS 'Data de expiração do código de autenticação';

-- Verificar se a migração foi executada com sucesso
SELECT 'Tabela whatsapp_users criada com sucesso!' AS status; 