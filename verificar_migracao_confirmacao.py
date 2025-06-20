#!/usr/bin/env python3
"""
Script de diagnóstico para verificar migrações de confirmação de transações recorrentes
"""

import os
import sys
import psycopg2
from urllib.parse import urlparse

def verificar_banco_dados():
    """Verificar status das migrações no banco de dados"""
    
    # URL de conexão do banco (PostgreSQL na Azure)
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL não encontrada nas variáveis de ambiente")
        print("💡 Tentando usar configuração local...")
        database_url = "postgresql://postgres:password@localhost/financas"
    
    try:
        # Parse da URL
        parsed = urlparse(database_url)
        
        print("🔍 DIAGNÓSTICO DE MIGRAÇÕES - CONFIRMAÇÃO DE TRANSAÇÕES RECORRENTES")
        print("=" * 70)
        print(f"📡 Conectando ao banco: {parsed.hostname}:{parsed.port}")
        print(f"🗃️  Database: {parsed.path[1:]}")
        print()
        
        # Conectar ao banco
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # ==========================================
        # 1. Verificar tabela telegram_users
        # ==========================================
        print("1️⃣ VERIFICANDO TABELA telegram_users")
        print("-" * 40)
        
        # Verificar se a tabela existe
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'telegram_users'
            );
        """)
        telegram_table_exists = cursor.fetchone()[0]
        
        if telegram_table_exists:
            print("✅ Tabela telegram_users existe")
            
            # Verificar colunas
            cursor.execute("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = 'telegram_users' 
                AND table_schema = 'public'
                ORDER BY ordinal_position;
            """)
            columns = cursor.fetchall()
            
            print("\n📋 Colunas encontradas:")
            confirmacao_col = False
            timeout_col = False
            
            for col in columns:
                col_name, data_type, nullable, default = col
                print(f"  - {col_name:30} | {data_type:15} | Default: {default}")
                
                if col_name == 'confirmar_transacoes_recorrentes':
                    confirmacao_col = True
                elif col_name == 'timeout_confirmacao_horas':
                    timeout_col = True
            
            print(f"\n🔍 Status das colunas de confirmação:")
            print(f"  - confirmar_transacoes_recorrentes: {'✅ Presente' if confirmacao_col else '❌ AUSENTE'}")
            print(f"  - timeout_confirmacao_horas:        {'✅ Presente' if timeout_col else '❌ AUSENTE'}")
            
            # Se houver as colunas, mostrar dados
            if confirmacao_col and timeout_col:
                cursor.execute("""
                    SELECT COUNT(*) as total,
                           COUNT(CASE WHEN confirmar_transacoes_recorrentes = true THEN 1 END) as com_confirmacao
                    FROM telegram_users;
                """)
                stats = cursor.fetchone()
                print(f"\n📊 Estatísticas:")
                print(f"  - Total usuários Telegram: {stats[0]}")
                print(f"  - Com confirmação ativa:   {stats[1]}")
        else:
            print("❌ Tabela telegram_users NÃO existe")
        
        print("\n" + "=" * 70)
        
        # ==========================================
        # 2. Verificar tabela confirmacoes_transacao
        # ==========================================
        print("2️⃣ VERIFICANDO TABELA confirmacoes_transacao")
        print("-" * 45)
        
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'confirmacoes_transacao'
            );
        """)
        confirmacoes_table_exists = cursor.fetchone()[0]
        
        if confirmacoes_table_exists:
            print("✅ Tabela confirmacoes_transacao existe")
            
            # Verificar estrutura
            cursor.execute("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = 'confirmacoes_transacao' 
                AND table_schema = 'public'
                ORDER BY ordinal_position;
            """)
            columns = cursor.fetchall()
            
            print("\n📋 Estrutura da tabela:")
            for col in columns:
                col_name, data_type, nullable, default = col
                print(f"  - {col_name:25} | {data_type:15} | Default: {default}")
            
            # Verificar dados
            cursor.execute("SELECT COUNT(*) FROM confirmacoes_transacao;")
            total_confirmacoes = cursor.fetchone()[0]
            
            if total_confirmacoes > 0:
                cursor.execute("""
                    SELECT status, COUNT(*) 
                    FROM confirmacoes_transacao 
                    GROUP BY status;
                """)
                status_counts = cursor.fetchall()
                
                print(f"\n📊 Estatísticas de confirmações:")
                print(f"  - Total registros: {total_confirmacoes}")
                for status, count in status_counts:
                    print(f"  - Status {status}: {count}")
            else:
                print("\n📊 Tabela vazia (sem confirmações registradas)")
        else:
            print("❌ Tabela confirmacoes_transacao NÃO existe")
        
        print("\n" + "=" * 70)
        
        # ==========================================
        # 3. Verificar transações recorrentes
        # ==========================================
        print("3️⃣ VERIFICANDO TRANSAÇÕES RECORRENTES")
        print("-" * 37)
        
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'transacoes_recorrentes'
            );
        """)
        transacoes_table_exists = cursor.fetchone()[0]
        
        if transacoes_table_exists:
            cursor.execute("""
                SELECT COUNT(*) as total,
                       COUNT(CASE WHEN ativo = true THEN 1 END) as ativas
                FROM transacoes_recorrentes;
            """)
            stats = cursor.fetchone()
            print(f"✅ Tabela transacoes_recorrentes existe")
            print(f"📊 Total transações recorrentes: {stats[0]}")
            print(f"📊 Transações ativas: {stats[1]}")
            
            if stats[1] > 0:
                cursor.execute("""
                    SELECT id, descricao, valor, frequencia, proxima_execucao, tenant_id
                    FROM transacoes_recorrentes 
                    WHERE ativo = true 
                    ORDER BY proxima_execucao 
                    LIMIT 5;
                """)
                transacoes = cursor.fetchall()
                
                print(f"\n🔄 Próximas 5 transações ativas:")
                for t in transacoes:
                    print(f"  - ID:{t[0]} | {t[1]} | R${t[2]} | {t[3]} | {t[4]} | Tenant:{t[5]}")
        else:
            print("❌ Tabela transacoes_recorrentes NÃO existe")
        
        print("\n" + "=" * 70)
        
        # ==========================================
        # 4. Resumo e próximos passos
        # ==========================================
        print("4️⃣ RESUMO E PRÓXIMOS PASSOS")
        print("-" * 30)
        
        needs_migration = []
        
        if not telegram_table_exists:
            needs_migration.append("❌ Tabela telegram_users não existe")
        elif not (confirmacao_col and timeout_col):
            needs_migration.append("❌ Colunas de confirmação faltando na telegram_users")
        
        if not confirmacoes_table_exists:
            needs_migration.append("❌ Tabela confirmacoes_transacao não existe")
        
        if needs_migration:
            print("🚨 MIGRAÇÕES NECESSÁRIAS:")
            for issue in needs_migration:
                print(f"  {issue}")
            print("\n💡 Execute as migrações SQL necessárias no banco de dados.")
        else:
            print("✅ Todas as migrações estão aplicadas!")
            print("🎉 Sistema de confirmação pronto para uso!")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erro ao conectar ao banco: {e}")
        print(f"💡 Verifique se o DATABASE_URL está correto e o banco está acessível")

if __name__ == "__main__":
    verificar_banco_dados() 