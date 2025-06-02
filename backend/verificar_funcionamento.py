import sqlite3

def verificar_transacoes():
    conn = sqlite3.connect('financas_ai.db')
    cursor = conn.cursor()
    
    print("🔍 === VERIFICANDO TRANSAÇÕES RECENTES ===")
    
    # Buscar transações mais recentes
    cursor.execute('''
        SELECT 
            id, descricao, valor, tipo, 
            categoria_id, conta_id, cartao_id,
            created_at, processado_por_ia
        FROM transacoes 
        WHERE processado_por_ia = 1
        ORDER BY created_at DESC 
        LIMIT 3
    ''')
    
    transacoes = cursor.fetchall()
    
    if transacoes:
        print("✅ Transações criadas pela IA:")
        for t in transacoes:
            id_trans, desc, valor, tipo, cat_id, conta_id, cartao_id, data, ia = t
            conta_cartao = f"Cartão ID: {cartao_id}" if cartao_id else f"Conta ID: {conta_id}" if conta_id else "N/A"
            print(f"  💰 R$ {valor} - {desc} ({tipo})")
            print(f"     {conta_cartao} | Categoria: {cat_id} | {data[:16]}")
            print()
    else:
        print("❌ Nenhuma transação encontrada!")
    
    # Contar total
    cursor.execute('SELECT COUNT(*) FROM transacoes WHERE processado_por_ia = 1')
    total = cursor.fetchone()[0]
    print(f"📊 Total de transações via IA: {total}")
    
    conn.close()

if __name__ == "__main__":
    verificar_transacoes() 