-- Migração: Adicionar campo criada_por_usuario na tabela confirmacoes_transacao
-- Data: 2024-12-19
-- Descrição: Registra quem criou a transação recorrente para evitar conflitos entre usuários do mesmo tenant

-- Adicionar coluna para identificação do criador
ALTER TABLE confirmacoes_transacao 
ADD COLUMN IF NOT EXISTS criada_por_usuario VARCHAR(255);

-- Adicionar comentário para documentação
COMMENT ON COLUMN confirmacoes_transacao.criada_por_usuario IS 'Nome do usuário que criou a transação recorrente original'; 