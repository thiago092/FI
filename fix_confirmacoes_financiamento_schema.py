#!/usr/bin/env python3
"""
Script para verificar e corrigir a estrutura da tabela confirmacoes_financiamento
"""

import os
import sys
import psycopg2
from psycopg2 import sql
from datetime import datetime

# Configuração da conexão com o banco (Azure)
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://financas_ai_user:financas_ai_password_2024@financas-ai-server.postgres.database.azure.com:5432/financas_ai_db?sslmode=require')

def check_table_structure():
    """Verificar a estrutura atual da tabela confirmacoes_financiamento"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("🔍 Verificando estrutura da tabela confirmacoes_financiamento...")
        
        # Verificar se a tabela existe
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'confirmacoes_financiamento'
            );
        """)
        
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            print("❌ Tabela confirmacoes_financiamento não existe!")
            return False, []
        
        print("✅ Tabela confirmacoes_financiamento existe")
        
        # Verificar colunas existentes
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'confirmacoes_financiamento'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        print(f"\n📋 Colunas encontradas ({len(columns)}):")
        
        column_names = []
        for col in columns:
            column_name, data_type, is_nullable, column_default = col
            column_names.append(column_name)
            print(f"  - {column_name}: {data_type} ({'NULL' if is_nullable == 'YES' else 'NOT NULL'})")
            if column_default:
                print(f"    Default: {column_default}")
        
        # Verificar se a coluna parcela_id existe
        has_parcela_id = 'parcela_id' in column_names
        print(f"\n🎯 Coluna 'parcela_id': {'✅ EXISTE' if has_parcela_id else '❌ NÃO EXISTE'}")
        
        cursor.close()
        conn.close()
        
        return True, column_names
        
    except Exception as e:
        print(f"❌ Erro ao verificar estrutura: {e}")
        return False, []

def fix_table_structure():
    """Corrigir a estrutura da tabela adicionando a coluna parcela_id se necessário"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("\n🔧 Iniciando correção da estrutura...")
        
        # Verificar se a coluna parcela_id existe
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'confirmacoes_financiamento' 
            AND column_name = 'parcela_id';
        """)
        
        has_parcela_id = cursor.fetchone() is not None
        
        if has_parcela_id:
            print("✅ Coluna parcela_id já existe - nenhuma correção necessária")
            cursor.close()
            conn.close()
            return True
        
        print("➕ Adicionando coluna parcela_id...")
        
        # Adicionar a coluna parcela_id
        cursor.execute("""
            ALTER TABLE confirmacoes_financiamento 
            ADD COLUMN parcela_id INTEGER REFERENCES parcelas_financiamento(id) ON DELETE CASCADE;
        """)
        
        print("✅ Coluna parcela_id adicionada com sucesso")
        
        # Verificar se existem registros na tabela
        cursor.execute("SELECT COUNT(*) FROM confirmacoes_financiamento;")
        count = cursor.fetchone()[0]
        
        print(f"📊 Registros existentes na tabela: {count}")
        
        if count > 0:
            print("⚠️  ATENÇÃO: Existem registros na tabela!")
            print("   Os registros existentes terão parcela_id = NULL")
            print("   Considere atualizar manualmente se necessário")
        
        # Commit das mudanças
        conn.commit()
        print("💾 Mudanças salvas no banco de dados")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao corrigir estrutura: {e}")
        try:
            conn.rollback()
            cursor.close()
            conn.close()
        except:
            pass
        return False

def create_table_if_not_exists():
    """Criar a tabela completa se ela não existir"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("\n🏗️  Criando tabela confirmacoes_financiamento...")
        
        # Criar a tabela completa com todas as colunas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS confirmacoes_financiamento (
                id SERIAL PRIMARY KEY,
                financiamento_id INTEGER NOT NULL REFERENCES financiamentos(id) ON DELETE CASCADE,
                parcela_id INTEGER NOT NULL REFERENCES parcelas_financiamento(id) ON DELETE CASCADE,
                
                -- Dados da parcela que será paga
                descricao VARCHAR(500) NOT NULL,
                valor_parcela NUMERIC(12,2) NOT NULL,
                data_vencimento DATE NOT NULL,
                
                -- Status da confirmação
                status VARCHAR(20) DEFAULT 'PENDENTE', -- PENDENTE, CONFIRMADA, CANCELADA, AUTO_CONFIRMADA
                
                -- Controle de tempo
                criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expira_em TIMESTAMP NOT NULL,
                respondida_em TIMESTAMP,
                
                -- Transação criada (se confirmada)
                transacao_id INTEGER REFERENCES transacoes(id),
                
                -- Telegram/WhatsApp integration
                telegram_user_id VARCHAR(100),
                telegram_message_id VARCHAR(100),
                whatsapp_user_id VARCHAR(100),
                
                -- Controle
                criada_por_usuario VARCHAR(255),
                observacoes TEXT,
                
                -- Tenant isolation
                tenant_id INTEGER NOT NULL REFERENCES tenants(id)
            );
        """)
        
        print("✅ Tabela criada/verificada com sucesso")
        
        # Criar índices
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_status 
            ON confirmacoes_financiamento(status);
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_expira 
            ON confirmacoes_financiamento(expira_em);
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_confirmacoes_financiamento_tenant 
            ON confirmacoes_financiamento(tenant_id);
        """)
        
        print("✅ Índices criados/verificados com sucesso")
        
        # Commit das mudanças
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao criar tabela: {e}")
        try:
            conn.rollback()
            cursor.close()
            conn.close()
        except:
            pass
        return False

def main():
    """Função principal"""
    print("=" * 60)
    print("🔧 CORREÇÃO DA TABELA CONFIRMACOES_FINANCIAMENTO")
    print("=" * 60)
    print(f"⏰ Iniciado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Passo 1: Verificar estrutura atual
    table_exists, columns = check_table_structure()
    
    if not table_exists:
        # Tabela não existe - criar do zero
        print("\n🏗️  Tabela não existe - criando do zero...")
        if create_table_if_not_exists():
            print("✅ Tabela criada com sucesso!")
        else:
            print("❌ Falha ao criar tabela")
            return False
    else:
        # Tabela existe - verificar se precisa de correção
        if 'parcela_id' not in columns:
            print("\n🔧 Tabela existe mas precisa de correção...")
            if fix_table_structure():
                print("✅ Estrutura corrigida com sucesso!")
            else:
                print("❌ Falha ao corrigir estrutura")
                return False
        else:
            print("\n✅ Estrutura da tabela está correta!")
    
    # Passo 2: Verificar estrutura final
    print("\n🔍 Verificação final...")
    table_exists, final_columns = check_table_structure()
    
    if table_exists and 'parcela_id' in final_columns:
        print("\n🎉 SUCESSO! Tabela confirmacoes_financiamento está correta!")
        print("   ✅ Tabela existe")
        print("   ✅ Coluna parcela_id presente")
        print("   ✅ Estrutura compatível com o modelo")
    else:
        print("\n❌ ERRO! Ainda há problemas com a tabela")
        return False
    
    print(f"\n⏰ Finalizado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Operação cancelada pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Erro inesperado: {e}")
        sys.exit(1) 