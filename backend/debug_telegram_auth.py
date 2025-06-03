#!/usr/bin/env python3
"""
Script para diagnosticar problemas de autenticação do Telegram
"""

import requests
import json

def debug_telegram_auth():
    print("🔍 DIAGNÓSTICO - AUTENTICAÇÃO TELEGRAM")
    print("=" * 50)
    
    base_url = "https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net"
    
    # Pedir token de autenticação
    print("\n📝 Para diagnosticar, preciso do token de autenticação.")
    print("   1. Faça login no frontend: https://jolly-bay-0a0f6890f.6.azurestaticapps.net")
    print("   2. Abra o console do navegador (F12)")
    print("   3. Digite: localStorage.getItem('token')")
    print("   4. Copie o token (sem as aspas)")
    
    token = input("\n🔑 Cole o token aqui: ").strip()
    
    if not token:
        print("❌ Token não fornecido!")
        return
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print(f"\n🔍 Testando debug endpoint...")
    try:
        response = requests.get(f"{base_url}/api/telegram/debug/codes", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Debug endpoint funcionando!")
            print(f"\n👤 Usuário atual: {data['current_user']['full_name']} ({data['current_user']['email']})")
            
            print(f"\n📊 Estatísticas:")
            print(f"   • Códigos ativos: {data['stats']['total_active_codes']}")
            print(f"   • Códigos expirados: {data['stats']['total_expired_codes']}")
            print(f"   • Usuários autenticados: {data['stats']['total_authenticated']}")
            
            if data['active_codes']:
                print(f"\n🔥 Códigos ativos:")
                for code in data['active_codes']:
                    print(f"   • Código: {code['code']}")
                    print(f"     Telegram: {code['telegram_name']} (ID: {code['telegram_id']})")
                    print(f"     Expira em: {code['minutes_remaining']} minutos")
            
            if data['expired_codes']:
                print(f"\n⏰ Códigos expirados recentes:")
                for code in data['expired_codes']:
                    print(f"   • Código: {code['code']}")
                    print(f"     Telegram: {code['telegram_name']}")
                    print(f"     Expirou em: {code['expired_at']}")
            
            if data['authenticated_users']:
                print(f"\n✅ Usuários já autenticados:")
                for user in data['authenticated_users']:
                    print(f"   • Telegram: {user['telegram_name']} (ID: {user['telegram_id']})")
                    print(f"     Usuário: {user['user_id']}")
                    print(f"     Última interação: {user.get('last_interaction', 'N/A')}")
        
        elif response.status_code == 401:
            print("❌ Token inválido ou expirado!")
            print("   Faça login novamente no frontend.")
        
        else:
            print(f"❌ Erro: {response.status_code}")
            print(f"   Resposta: {response.text}")
    
    except Exception as e:
        print(f"❌ Erro na requisição: {e}")
    
    print(f"\n🤖 Próximo passo:")
    print("   1. Vá no Telegram")
    print("   2. Digite /start para o bot")
    print("   3. Copie o código gerado")
    print("   4. Tente vincular no frontend")

if __name__ == "__main__":
    debug_telegram_auth() 