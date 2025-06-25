-- Adicionar coluna tenant_id na tabela email_verification_tokens
ALTER TABLE email_verification_tokens 
ADD COLUMN tenant_id INTEGER;

-- Adicionar foreign key constraint
ALTER TABLE email_verification_tokens 
ADD CONSTRAINT fk_email_verification_tokens_tenant_id 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Criar índice para melhor performance
CREATE INDEX idx_email_verification_tokens_tenant_id ON email_verification_tokens(tenant_id);

-- Criar índice composto para tokens de convite
CREATE INDEX idx_email_verification_tokens_invite ON email_verification_tokens(token_type, used) 
WHERE token_type = 'invite'; 