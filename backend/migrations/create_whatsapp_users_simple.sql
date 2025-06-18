-- ===========================================
-- ETAPA 1: Criar a tabela whatsapp_users
-- ===========================================

CREATE TABLE IF NOT EXISTS whatsapp_users (
    id SERIAL PRIMARY KEY,
    whatsapp_id VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    whatsapp_name VARCHAR(255),
    user_id INTEGER REFERENCES users(id),
    is_authenticated BOOLEAN DEFAULT FALSE,
    auth_code VARCHAR(10),
    auth_code_expires TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    language VARCHAR(10) DEFAULT 'pt-BR',
    profile_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- ETAPA 2: Criar índices
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_users_whatsapp_id ON whatsapp_users(whatsapp_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_user_id ON whatsapp_users(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_phone_number ON whatsapp_users(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_is_authenticated ON whatsapp_users(is_authenticated);

-- ===========================================
-- ETAPA 3: Verificar se deu certo
-- ===========================================

SELECT 'Tabela whatsapp_users criada com sucesso!' AS status; 