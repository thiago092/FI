#!/usr/bin/env python3
"""
Script para configurar o Bot do Telegram no Azure App Service
Execute este script após criar o bot no @BotFather
"""

import requests
import json

def configurar_telegram_bot():
    """
    Configuração do Bot do Telegram para FinançasAI
    """
    print("🤖 CONFIGURAÇÃO DO BOT TELEGRAM - FinançasAI")
    print("=" * 50)
    
    # Solicitar informações do bot
    print("\n1️⃣ INFORMAÇÕES DO BOT:")
    print("   • Acesse @BotFather no Telegram")
    print("   • Use /newbot para criar um novo bot")
    print("   • Escolha um nome: 'FinançasAI Bot'")
    print("   • Escolha um username: 'financasai_bot' (ou similar)")
    print("   • Copie o TOKEN fornecido")
    
    token = input("\n📝 Cole o TOKEN do bot aqui: ").strip()
    
    if not token:
        print("❌ Token não fornecido!")
        return
    
    # Configurações
    webhook_url = "https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/telegram/webhook"
    
    print(f"\n2️⃣ CONFIGURAÇÕES:")
    print(f"   • Token: {token[:10]}...")
    print(f"   • Webhook URL: {webhook_url}")
    
    # Testar o bot
    print("\n3️⃣ TESTANDO BOT...")
    try:
        response = requests.get(f"https://api.telegram.org/bot{token}/getMe")
        if response.status_code == 200:
            bot_info = response.json()
            if bot_info.get('ok'):
                bot_data = bot_info['result']
                print(f"✅ Bot encontrado!")
                print(f"   • Nome: {bot_data.get('first_name')}")
                print(f"   • Username: @{bot_data.get('username')}")
                print(f"   • ID: {bot_data.get('id')}")
            else:
                print("❌ Erro na resposta do bot")
                return
        else:
            print("❌ Token inválido!")
            return
    except Exception as e:
        print(f"❌ Erro ao testar bot: {e}")
        return
    
    # Configurar webhook
    print("\n4️⃣ CONFIGURANDO WEBHOOK...")
    try:
        webhook_response = requests.post(
            f"https://api.telegram.org/bot{token}/setWebhook",
            json={"url": webhook_url}
        )
        if webhook_response.status_code == 200:
            webhook_result = webhook_response.json()
            if webhook_result.get('ok'):
                print("✅ Webhook configurado com sucesso!")
            else:
                print(f"❌ Erro ao configurar webhook: {webhook_result}")
        else:
            print("❌ Falha ao configurar webhook")
    except Exception as e:
        print(f"❌ Erro ao configurar webhook: {e}")
    
    # Comandos Azure CLI
    print("\n5️⃣ COMANDOS PARA AZURE CLI:")
    print("Execute estes comandos no terminal (Azure CLI):")
    print(f"""
# Configurar token do bot
az webapp config appsettings set --resource-group rg-financas-ai-v2 --name financeiro --settings TELEGRAM_BOT_TOKEN="{token}"

# Configurar webhook URL
az webapp config appsettings set --resource-group rg-financas-ai-v2 --name financeiro --settings TELEGRAM_WEBHOOK_URL="{webhook_url}"

# Reiniciar aplicação
az webapp restart --resource-group rg-financas-ai-v2 --name financeiro
""")
    
    # Arquivo .env local (para desenvolvimento)
    print("\n6️⃣ ARQUIVO .env LOCAL:")
    print("Crie um arquivo .env na pasta backend com:")
    print(f"""
TELEGRAM_BOT_TOKEN={token}
TELEGRAM_WEBHOOK_URL={webhook_url}
ADMIN_EMAIL=admin@financas-ai.com
ADMIN_PASSWORD=admin123
""")
    
    print("\n✅ CONFIGURAÇÃO CONCLUÍDA!")
    print("🚀 Após executar os comandos Azure CLI, o bot estará funcionando!")

if __name__ == "__main__":
    configurar_telegram_bot() 