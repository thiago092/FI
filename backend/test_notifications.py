#!/usr/bin/env python3
"""
Script de teste para sistema de notificações
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.database import get_db
from app.models.notification import NotificationPreference

def test_notification_model():
    """Testa se o modelo de notificação funciona"""
    print("🧪 Testando modelo de notificação...")
    
    db = next(get_db())
    try:
        # Buscar preferências de teste
        preferences = db.query(NotificationPreference).all()
        
        print(f"✅ Encontradas {len(preferences)} preferências de notificação:")
        for pref in preferences:
            print(f"   - ID {pref.id}: {pref.notification_type} às {pref.notification_hour}h (Tenant: {pref.tenant_id})")
        
        # Testar criação de nova preferência
        if len(preferences) == 0:
            print("📝 Criando preferência de teste...")
            test_pref = NotificationPreference(
                tenant_id=1,
                telegram_user_id=123456789,
                notification_type='daily',
                notification_hour=10,
                include_balance=True,
                include_transactions=True,
                include_categories=False,
                include_insights=True
            )
            
            db.add(test_pref)
            db.commit()
            db.refresh(test_pref)
            
            print(f"✅ Preferência criada: ID {test_pref.id}")
        
        print("🎉 Teste do modelo concluído com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro no teste: {e}")
        db.rollback()
    finally:
        db.close()

def test_database_structure():
    """Testa se a estrutura do banco está correta"""
    print("🏗️ Testando estrutura do banco...")
    
    try:
        from app.models.notification import NotificationPreference
        
        # Verificar se todas as colunas existem
        required_fields = [
            'id', 'tenant_id', 'telegram_user_id', 'notification_type',
            'notification_hour', 'day_of_week', 'day_of_month',
            'include_balance', 'include_transactions', 'include_categories',
            'include_insights', 'is_active', 'created_at', 'updated_at'
        ]
        
        model_fields = [column.name for column in NotificationPreference.__table__.columns]
        
        print("📋 Campos no modelo:")
        for field in required_fields:
            if field in model_fields:
                print(f"   ✅ {field}")
            else:
                print(f"   ❌ {field} - FALTANDO")
        
        print("🎉 Estrutura verificada!")
        
    except Exception as e:
        print(f"❌ Erro na verificação da estrutura: {e}")

if __name__ == "__main__":
    print("🚀 Iniciando testes do sistema de notificações...\n")
    
    test_database_structure()
    print()
    test_notification_model()
    
    print("\n✅ Testes concluídos!")
    print("\n📝 Próximos passos:")
    print("   1. Verificar se a API funciona: http://localhost:8000/docs")
    print("   2. Testar endpoints: GET /api/notification-preferences/")
    print("   3. Criar interface no frontend") 