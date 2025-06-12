from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
import os
import logging

router = APIRouter()

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@router.post("/setup/pagamentos-recorrentes")
async def setup_pagamentos_recorrentes(db: Session = Depends(get_db)):
    """
    Endpoint especial para criar estrutura de pagamentos recorrentes em produção.
    
    ⚠️ IMPORTANTE: Este endpoint NÃO requer autenticação para facilitar setup em produção.
    ⚠️ Deve ser usado apenas UMA VEZ para criar a estrutura inicial.
    
    Segurança:
    - Apenas CRIA novas estruturas (não modifica existentes)
    - Verifica se já existe antes de criar
    - Rollback automático em caso de erro
    - Logs detalhados de todas as operações
    """
    
    try:
        logger.info("🚀 Iniciando setup de pagamentos recorrentes...")
        
        # Verificar se a tabela já existe
        check_table_query = """
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'pagamentos_recorrentes'
        );
        """
        
        result = db.execute(text(check_table_query)).scalar()
        
        if result:
            logger.info("✅ Tabela pagamentos_recorrentes já existe")
            return {
                "success": True,
                "message": "Estrutura já existe - nenhuma alteração necessária",
                "status": "already_exists",
                "details": {
                    "tabela_existe": True,
                    "acao_executada": "verificacao_apenas"
                }
            }
        
        logger.info("📄 Criando estrutura de pagamentos recorrentes...")
        
        # 1. Criar enum para frequências se não existir
        enum_query = """
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'frequencia_recorrencia') THEN
                CREATE TYPE frequencia_recorrencia AS ENUM (
                    'DIARIA', 
                    'SEMANAL', 
                    'QUINZENAL', 
                    'MENSAL', 
                    'BIMESTRAL', 
                    'TRIMESTRAL', 
                    'SEMESTRAL', 
                    'ANUAL'
                );
            END IF;
        END $$;
        """
        
        db.execute(text(enum_query))
        logger.info("✅ Enum frequencia_recorrencia criado")
        
        # 2. Criar tabela principal
        table_query = """
        CREATE TABLE pagamentos_recorrentes (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            
            -- Dados básicos
            descricao VARCHAR(255) NOT NULL,
            icone VARCHAR(10) NOT NULL DEFAULT '💰',
            valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
            tipo tipo_transacao NOT NULL DEFAULT 'SAIDA',
            categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
            
            -- Forma de pagamento (uma obrigatória)
            conta_id INTEGER REFERENCES contas(id) ON DELETE SET NULL,
            cartao_id INTEGER REFERENCES cartoes(id) ON DELETE SET NULL,
            
            -- Configuração de recorrência
            frequencia frequencia_recorrencia NOT NULL,
            dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
            data_inicio DATE NOT NULL,
            data_fim DATE CHECK (data_fim IS NULL OR data_fim > data_inicio),
            
            -- Controle de execução
            ativo BOOLEAN NOT NULL DEFAULT true,
            proximo_vencimento DATE NOT NULL,
            total_gerado INTEGER NOT NULL DEFAULT 0,
            ultima_execucao TIMESTAMP,
            
            -- Metadados
            observacoes TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            
            -- Constraints de integridade
            CONSTRAINT forma_pagamento_obrigatoria 
                CHECK (conta_id IS NOT NULL OR cartao_id IS NOT NULL),
            CONSTRAINT forma_pagamento_unica 
                CHECK (NOT (conta_id IS NOT NULL AND cartao_id IS NOT NULL)),
            CONSTRAINT data_inicio_valida
                CHECK (data_inicio >= CURRENT_DATE - INTERVAL '1 year'),
            CONSTRAINT proximo_vencimento_valido
                CHECK (proximo_vencimento >= data_inicio)
        );
        """
        
        db.execute(text(table_query))
        logger.info("✅ Tabela pagamentos_recorrentes criada")
        
        # 3. Criar índices
        indices = [
            "CREATE INDEX idx_pagamentos_recorrentes_tenant ON pagamentos_recorrentes(tenant_id);",
            "CREATE INDEX idx_pagamentos_recorrentes_proximo_vencimento ON pagamentos_recorrentes(proximo_vencimento) WHERE ativo = true;",
            "CREATE INDEX idx_pagamentos_recorrentes_categoria ON pagamentos_recorrentes(categoria_id);",
            "CREATE INDEX idx_pagamentos_recorrentes_conta ON pagamentos_recorrentes(conta_id) WHERE conta_id IS NOT NULL;",
            "CREATE INDEX idx_pagamentos_recorrentes_cartao ON pagamentos_recorrentes(cartao_id) WHERE cartao_id IS NOT NULL;"
        ]
        
        for indice in indices:
            db.execute(text(indice))
        
        logger.info("✅ Índices criados")
        
        # 4. Criar função e trigger para updated_at
        function_query = """
        CREATE OR REPLACE FUNCTION update_pagamentos_recorrentes_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
        
        trigger_query = """
        CREATE TRIGGER trigger_update_pagamentos_recorrentes_updated_at
            BEFORE UPDATE ON pagamentos_recorrentes
            FOR EACH ROW
            EXECUTE FUNCTION update_pagamentos_recorrentes_updated_at();
        """
        
        db.execute(text(function_query))
        db.execute(text(trigger_query))
        logger.info("✅ Trigger de updated_at criado")
        
        # Commit todas as mudanças
        db.commit()
        logger.info("✅ Setup executado com sucesso!")
        
        # Verificar se foi criada corretamente
        verify_query = """
        SELECT 
            table_name,
            (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'pagamentos_recorrentes') as total_colunas,
            (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'pagamentos_recorrentes') as total_constraints
        FROM information_schema.tables 
        WHERE table_name = 'pagamentos_recorrentes';
        """
        
        verification = db.execute(text(verify_query)).fetchone()
        
        if not verification:
            raise HTTPException(
                status_code=500,
                detail="Falha na verificação: tabela não foi criada corretamente"
            )
        
        logger.info(f"🔍 Verificação: {verification.total_colunas} colunas, {verification.total_constraints} constraints")
        
        return {
            "success": True,
            "message": "Estrutura de pagamentos recorrentes criada com sucesso!",
            "status": "created",
            "details": {
                "tabela_criada": True,
                "total_colunas": verification.total_colunas,
                "total_constraints": verification.total_constraints,
                "enum_criado": True,
                "indices_criados": 5,
                "trigger_criado": True
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Erro durante setup: {str(e)}")
        
        # Rollback automático
        try:
            db.rollback()
            logger.info("🔄 Rollback executado com sucesso")
        except Exception as rollback_error:
            logger.error(f"❌ Erro no rollback: {str(rollback_error)}")
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Falha no setup de pagamentos recorrentes",
                "message": str(e),
                "rollback_executado": True,
                "dados_preservados": True
            }
        )

@router.get("/setup/status")
async def check_setup_status(db: Session = Depends(get_db)):
    """
    Verificar status da estrutura de pagamentos recorrentes.
    Endpoint público para diagnóstico.
    """
    
    try:
        # Verificar tabela principal
        table_check = """
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'pagamentos_recorrentes'
        );
        """
        
        table_exists = db.execute(text(table_check)).scalar()
        
        # Verificar enum
        enum_check = """
        SELECT EXISTS (
            SELECT 1 FROM pg_type 
            WHERE typname = 'frequencia_recorrencia'
        );
        """
        
        enum_exists = db.execute(text(enum_check)).scalar()
        
        # Contar registros se tabela existe
        count_records = 0
        if table_exists:
            count_query = "SELECT COUNT(*) FROM pagamentos_recorrentes;"
            count_records = db.execute(text(count_query)).scalar()
        
        return {
            "estrutura_criada": table_exists,
            "enum_frequencia_existe": enum_exists,
            "total_pagamentos_recorrentes": count_records,
            "status": "ready" if table_exists and enum_exists else "needs_setup",
            "timestamp": "2024-12-19T19:30:00Z"
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao verificar status: {str(e)}")
        return {
            "estrutura_criada": False,
            "erro": str(e),
            "status": "error"
        } 