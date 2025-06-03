#!/usr/bin/env python3
"""
Script para testar e reconfigurar o Bot do Telegram já existente
Token: 7381178901:AAFX06jZftWyRLnFxgmzBPHlKa6utiUwd3s
"""

import requests
import json

def testar_bot_telegram():
    """
    Testar e reconfigurar o Bot do Telegram existente
    """
    # Configurações já existentes no Azure
    token = "7381178901:AAFX06jZftWyRLnFxgmzBPHlKa6utiUwd3s"
    webhook_url = "https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/telegram/webhook"
    
    print("🤖 TESTANDO BOT TELEGRAM EXISTENTE - FinançasAI")
    print("=" * 60)
    print(f"🔑 Token: {token[:10]}...")
    print(f"🌐 Webhook: {webhook_url}")
    
    # 1. Testar informações do bot
    print("\n1️⃣ TESTANDO INFORMAÇÕES DO BOT...")
    try:
        response = requests.get(f"https://api.telegram.org/bot{token}/getMe")
        if response.status_code == 200:
            bot_info = response.json()
            if bot_info.get('ok'):
                bot_data = bot_info['result']
                print(f"✅ Bot encontrado e funcionando!")
                print(f"   • Nome: {bot_data.get('first_name')}")
                print(f"   • Username: @{bot_data.get('username')}")
                print(f"   • ID: {bot_data.get('id')}")
                print(f"   • Pode juntar grupos: {bot_data.get('can_join_groups')}")
                print(f"   • Suporte a comandos inline: {bot_data.get('supports_inline_queries')}")
            else:
                print("❌ Erro na resposta do bot")
                return False
        else:
            print("❌ Token inválido ou bot inacessível!")
            return False
    except Exception as e:
        print(f"❌ Erro ao testar bot: {e}")
        return False
    
    # 2. Verificar webhook atual
    print("\n2️⃣ VERIFICANDO WEBHOOK ATUAL...")
    try:
        webhook_info_response = requests.get(f"https://api.telegram.org/bot{token}/getWebhookInfo")
        if webhook_info_response.status_code == 200:
            webhook_info = webhook_info_response.json()
            if webhook_info.get('ok'):
                info = webhook_info['result']
                current_url = info.get('url', '')
                
                print(f"📡 Status do webhook:")
                print(f"   • URL atual: {current_url}")
                print(f"   • Pendente: {info.get('pending_update_count', 0)} atualizações")
                print(f"   • Último erro: {info.get('last_error_date', 'Nenhum')}")
                print(f"   • Mensagem de erro: {info.get('last_error_message', 'Nenhuma')}")
                
                if current_url != webhook_url:
                    print(f"⚠️  Webhook URL diferente. Reconfigurar necessário.")
                    return "reconfig_needed"
                elif info.get('pending_update_count', 0) > 0:
                    print(f"⚠️  Há {info.get('pending_update_count')} atualizações pendentes.")
                else:
                    print("✅ Webhook configurado corretamente!")
                    
    except Exception as e:
        print(f"❌ Erro ao verificar webhook: {e}")
    
    # 3. Reconfigurar webhook
    print("\n3️⃣ RECONFIGURANDO WEBHOOK...")
    try:
        # Primeiro remover webhook existente
        delete_response = requests.post(f"https://api.telegram.org/bot{token}/deleteWebhook")
        if delete_response.status_code == 200:
            print("🗑️  Webhook anterior removido")
        
        # Configurar novo webhook
        webhook_response = requests.post(
            f"https://api.telegram.org/bot{token}/setWebhook",
            json={
                "url": webhook_url,
                "max_connections": 40,
                "allowed_updates": ["message", "callback_query"]
            }
        )
        
        if webhook_response.status_code == 200:
            webhook_result = webhook_response.json()
            if webhook_result.get('ok'):
                print("✅ Webhook reconfigurado com sucesso!")
            else:
                print(f"❌ Erro ao configurar webhook: {webhook_result}")
                return False
        else:
            print("❌ Falha ao configurar webhook")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao reconfigurar webhook: {e}")
        return False
    
    # 4. Verificar webhook após reconfiguração
    print("\n4️⃣ VERIFICANDO WEBHOOK APÓS RECONFIGURAÇÃO...")
    try:
        webhook_info_response = requests.get(f"https://api.telegram.org/bot{token}/getWebhookInfo")
        if webhook_info_response.status_code == 200:
            webhook_info = webhook_info_response.json()
            if webhook_info.get('ok'):
                info = webhook_info['result']
                print(f"✅ Webhook verificado:")
                print(f"   • URL: {info.get('url')}")
                print(f"   • Pendente: {info.get('pending_update_count', 0)} atualizações")
                print(f"   • Último erro: {info.get('last_error_date', 'Nenhum')}")
    except Exception as e:
        print(f"❌ Erro na verificação final: {e}")
    
    # 5. Instruções para teste
    print("\n5️⃣ COMO TESTAR O BOT:")
    print("=" * 40)
    print(f"👨‍💻 1. Procure por @{bot_data.get('username')} no Telegram")
    print("📱 2. Envie /start para o bot")
    print("💬 3. O bot deve responder com opções de autenticação")
    print("🔗 4. Siga as instruções para vincular sua conta")
    
    print("\n6️⃣ COMANDOS DISPONÍVEIS:")
    print("   • /start - Iniciar bot e vincular conta")
    print("   • /help - Ajuda e comandos")
    print("   • /status - Status da conta vinculada")
    print("   • Enviar fotos de comprovantes")
    print("   • Digitar comandos de voz para registrar gastos")
    
    print("\n✅ CONFIGURAÇÃO CONCLUÍDA!")
    print("🚀 Bot pronto para uso!")
    return True

def configurar_comandos_bot():
    """Configurar comandos do bot"""
    token = "7381178901:AAFX06jZftWyRLnFxgmzBPHlKa6utiUwd3s"
    
    commands = [
        {"command": "start", "description": "Iniciar bot e vincular conta"},
        {"command": "help", "description": "Ajuda e comandos disponíveis"},
        {"command": "status", "description": "Ver status da conta vinculada"},
        {"command": "saldo", "description": "Ver saldo das contas"},
        {"command": "gastos", "description": "Ver gastos recentes"},
        {"command": "relatorio", "description": "Gerar relatório financeiro"}
    ]
    
    try:
        response = requests.post(
            f"https://api.telegram.org/bot{token}/setMyCommands",
            json={"commands": commands}
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('ok'):
                print("✅ Comandos do bot configurados!")
            else:
                print(f"❌ Erro ao configurar comandos: {result}")
        else:
            print("❌ Falha ao configurar comandos")
            
    except Exception as e:
        print(f"❌ Erro ao configurar comandos: {e}")

if __name__ == "__main__":
    print("🤖 FinançasAI - Configuração do Bot Telegram")
    print("=" * 50)
    
    # Testar bot
    success = testar_bot_telegram()
    
    if success:
        print("\n" + "=" * 50)
        configurar_comandos_bot()
        
        print("\n🎉 TUDO PRONTO!")
        print("📱 Agora você pode usar o bot no Telegram!")
    else:
        print("\n❌ Falha na configuração. Verifique as configurações do Azure.") 