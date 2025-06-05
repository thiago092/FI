"""
Script para migrar banco PostgreSQL - Adicionar colunas de parcelamento
EXECUÇÃO SEGURA - não afeta dados existentes
"""
import os
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

load_dotenv()

def conectar_postgres():
    """Conecta ao PostgreSQL do Azure"""
    try:
        # String de conexão do Azure PostgreSQL
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise ValueError("DATABASE_URL não encontrada no .env")
        
        conn = psycopg2.connect(db_url)
        return conn
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")
        return None

def verificar_coluna_existe(cursor, tabela, coluna):
    """Verifica se uma coluna existe na tabela"""
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = %s AND column_name = %s
        )
    """, (tabela, coluna))
    return cursor.fetchone()[0]

def verificar_tabela_existe(cursor, tabela):
    """Verifica se uma tabela existe"""
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = %s
        )
    """, (tabela,))
    return cursor.fetchone()[0]

def migrar_banco():
    """Executa a migração segura"""
    conn = conectar_postgres()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        print("🔄 Iniciando migração do banco PostgreSQL...")
        
        # 1. Criar tabelas novas se não existirem
        tabelas_novas = [
            ("compras_parceladas", """
                CREATE TABLE IF NOT EXISTS compras_parceladas (
                    id SERIAL PRIMARY KEY,
                    descricao VARCHAR NOT NULL,
                    valor_total FLOAT NOT NULL,
                    total_parcelas INTEGER NOT NULL,
                    valor_parcela FLOAT NOT NULL,
                    cartao_id INTEGER NOT NULL REFERENCES cartoes(id),
                    data_primeira_parcela DATE NOT NULL,
                    ativa BOOLEAN DEFAULT true,
                    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """),
            ("parcelas_cartao", """
                CREATE TABLE IF NOT EXISTS parcelas_cartao (
                    id SERIAL PRIMARY KEY,
                    compra_parcelada_id INTEGER NOT NULL REFERENCES compras_parceladas(id),
                    numero_parcela INTEGER NOT NULL,
                    valor FLOAT NOT NULL,
                    data_vencimento DATE NOT NULL,
                    paga BOOLEAN DEFAULT false,
                    processada BOOLEAN DEFAULT false,
                    transacao_id INTEGER REFERENCES transacoes(id),
                    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        ]
        
        for nome_tabela, sql_create in tabelas_novas:
            if not verificar_tabela_existe(cursor, nome_tabela):
                print(f"📝 Criando tabela {nome_tabela}...")
                cursor.execute(sql_create)
                print(f"✅ Tabela {nome_tabela} criada com sucesso!")
            else:
                print(f"ℹ️  Tabela {nome_tabela} já existe")
        
        # 2. Adicionar colunas novas à tabela transacoes (se não existirem)
        colunas_transacoes = [
            ("compra_parcelada_id", "INTEGER REFERENCES compras_parceladas(id)"),
            ("parcela_cartao_id", "INTEGER REFERENCES parcelas_cartao(id)"),
            ("is_parcelada", "BOOLEAN DEFAULT false"),
            ("numero_parcela", "INTEGER"),
            ("total_parcelas", "INTEGER")
        ]
        
        for coluna, tipo in colunas_transacoes:
            if not verificar_coluna_existe(cursor, "transacoes", coluna):
                print(f"📝 Adicionando coluna {coluna} à tabela transacoes...")
                cursor.execute(f"ALTER TABLE transacoes ADD COLUMN {coluna} {tipo}")
                print(f"✅ Coluna {coluna} adicionada com sucesso!")
            else:
                print(f"ℹ️  Coluna {coluna} já existe na tabela transacoes")
        
        # 3. Commit das mudanças
        conn.commit()
        print("🎉 Migração concluída com sucesso!")
        
        # 4. Verificação final
        print("\n🔍 Verificação final das estruturas:")
        
        # Verificar colunas da tabela transacoes
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'transacoes' 
            AND column_name IN ('compra_parcelada_id', 'parcela_cartao_id', 'is_parcelada', 'numero_parcela', 'total_parcelas')
            ORDER BY column_name
        """)
        
        colunas = cursor.fetchall()
        print(f"✅ Colunas de parcelamento em transacoes: {len(colunas)}")
        for coluna, tipo in colunas:
            print(f"   • {coluna} ({tipo})")
        
        # Verificar tabelas de parcelamento
        for tabela in ["compras_parceladas", "parcelas_cartao"]:
            cursor.execute("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_name = %s
            """, (tabela,))
            existe = cursor.fetchone()[0]
            status = "✅ Existe" if existe else "❌ Não existe"
            print(f"{status} Tabela: {tabela}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro durante migração: {e}")
        conn.rollback()
        return False
        
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    print("🚀 Iniciando migração do banco de dados PostgreSQL")
    print("🔒 Esta migração é SEGURA - não afeta dados existentes")
    print("=" * 60)
    
    sucesso = migrar_banco()
    
    print("=" * 60)
    if sucesso:
        print("🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!")
        print("✅ O sistema de parcelamentos está pronto para funcionar")
    else:
        print("❌ MIGRAÇÃO FALHOU!")
        print("🔧 Verifique os logs de erro acima") 