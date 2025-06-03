#!/usr/bin/env python3
"""
Teste rápido do bot Telegram configurado no Azure
"""

import requests
import json

def teste_bot_telegram():
    # Token já configurado no Azure
    token = "7381178901:AAFX06jZftWyRLnFxgmzBPHlKa6utiUwd3s"
    webhook_url = "https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/telegram/webhook"
    
    print("🤖 TESTE RÁPIDO - BOT TELEGRAM")
    print("=" * 50)
    
    # 1. Testar bot
    print("\n1️⃣ Testando bot...")
    try:
        response = requests.get(f"https://api.telegram.org/bot{token}/getMe")
        if response.status_code == 200:
            bot_info = response.json()
            if bot_info.get('ok'):
                bot = bot_info['result']
                print(f"✅ Bot funcionando!")
                print(f"   • Nome: {bot.get('first_name')}")
                print(f"   • Username: @{bot.get('username')}")
                print(f"   • ID: {bot.get('id')}")
                bot_username = bot.get('username')
            else:
                print("❌ Erro na resposta do bot")
                return
        else:
            print("❌ Token inválido!")
            return
    except Exception as e:
        print(f"❌ Erro: {e}")
        return
    
    # 2. Configurar webhook
    print("\n2️⃣ Configurando webhook...")
    try:
        # Remover webhook existente
        requests.post(f"https://api.telegram.org/bot{token}/deleteWebhook")
        
        # Configurar novo webhook
        webhook_response = requests.post(
            f"https://api.telegram.org/bot{token}/setWebhook",
            json={"url": webhook_url}
        )
        
        if webhook_response.status_code == 200:
            result = webhook_response.json()
            if result.get('ok'):
                print("✅ Webhook configurado!")
            else:
                print(f"❌ Erro webhook: {result}")
        else:
            print("❌ Falha ao configurar webhook")
    except Exception as e:
        print(f"❌ Erro webhook: {e}")
    
    # 3. Verificar webhook
    print("\n3️⃣ Verificando webhook...")
    try:
        info_response = requests.get(f"https://api.telegram.org/bot{token}/getWebhookInfo")
        if info_response.status_code == 200:
            info = info_response.json()
            if info.get('ok'):
                webhook_info = info['result']
                print(f"📡 URL: {webhook_info.get('url')}")
                print(f"📊 Pendentes: {webhook_info.get('pending_update_count', 0)}")
                if webhook_info.get('last_error_message'):
                    print(f"⚠️  Último erro: {webhook_info.get('last_error_message')}")
                else:
                    print("✅ Sem erros!")
    except Exception as e:
        print(f"❌ Erro verificação: {e}")
    
    print(f"\n🎯 COMO TESTAR:")
    print(f"1. Procure por @{bot_username} no Telegram")
    print(f"2. Envie /start")
    print(f"3. O bot deve responder")
    print(f"\n✅ Configuração concluída!")

if __name__ == "__main__":
    teste_bot_telegram() 