#!/usr/bin/env python3
"""
Script para criar tabela telegram_users no banco de dados
"""

import sqlite3
import sys
import os

# Adicionar o diretório atual ao path
sys.path.insert(0, os.path.dirname(__file__))

# Caminho do banco de dados
db_path = "financas_ai.db"

def criar_tabela_telegram():
    """Criar tabela telegram_users"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verificar se a tabela já existe
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='telegram_users'
        """)
        
        if cursor.fetchone():
            print("✅ Tabela telegram_users já existe!")
            return True
        
        # Criar tabela telegram_users
        cursor.execute("""
            CREATE TABLE telegram_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id VARCHAR UNIQUE NOT NULL,
                telegram_username VARCHAR,
                telegram_first_name VARCHAR,
                telegram_last_name VARCHAR,
                user_id INTEGER,
                is_authenticated BOOLEAN DEFAULT 0,
                auth_code VARCHAR,
                auth_code_expires DATETIME,
                is_active BOOLEAN DEFAULT 1,
                language VARCHAR DEFAULT 'pt-BR',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        # Criar índices
        cursor.execute("CREATE INDEX idx_telegram_users_telegram_id ON telegram_users(telegram_id)")
        cursor.execute("CREATE INDEX idx_telegram_users_user_id ON telegram_users(user_id)")
        cursor.execute("CREATE INDEX idx_telegram_users_is_authenticated ON telegram_users(is_authenticated)")
        
        conn.commit()
        print("✅ Tabela telegram_users criada com sucesso!")
        print("📋 Índices criados:")
        print("   - idx_telegram_users_telegram_id")
        print("   - idx_telegram_users_user_id") 
        print("   - idx_telegram_users_is_authenticated")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao criar tabela: {e}")
        return False
        
    finally:
        if conn:
            conn.close()

def verificar_tabelas():
    """Verificar todas as tabelas no banco"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tabelas = cursor.fetchall()
        
        print("📋 Tabelas no banco de dados:")
        for tabela in tabelas:
            print(f"   - {tabela[0]}")
            
        return tabelas
        
    except Exception as e:
        print(f"❌ Erro ao verificar tabelas: {e}")
        return []
        
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("🗄️ Configurador de Banco - Telegram")
    print("=" * 40)
    
    # Verificar se o banco existe
    if not os.path.exists(db_path):
        print(f"❌ Banco de dados não encontrado: {db_path}")
        sys.exit(1)
    
    print(f"✅ Banco encontrado: {db_path}")
    
    # Verificar tabelas existentes
    print("\n📋 Verificando tabelas existentes...")
    verificar_tabelas()
    
    # Criar tabela telegram_users
    print("\n🔧 Criando tabela telegram_users...")
    success = criar_tabela_telegram()
    
    if success:
        print("\n🎉 Configuração concluída!")
        print("📱 Agora você pode usar o Telegram Bot!")
        
        print("\n📝 Próximos passos:")
        print("1. Reinicie o backend (uvicorn)")
        print("2. Execute: python telegram_bot_manager.py")
        print("3. Teste o bot: https://t.me/Financeiro_app_bot")
    else:
        print("\n❌ Falha na configuração!") 