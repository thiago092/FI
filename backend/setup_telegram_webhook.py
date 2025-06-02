#!/usr/bin/env python3
"""
Script para configurar webhook do Telegram usando ngrok
"""

import httpx
import asyncio
import sys
import os
import re

# Adicionar o diretório atual ao path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import settings

async def get_ngrok_url():
    """Obter URL pública do ngrok"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://127.0.0.1:4040/api/tunnels")
            data = response.json()
            
            for tunnel in data.get("tunnels", []):
                if tunnel.get("proto") == "https":
                    return tunnel["public_url"]
            
            print("❌ Nenhum túnel HTTPS encontrado no ngrok")
            return None
            
    except Exception as e:
        print(f"❌ Erro ao conectar com ngrok: {e}")
        print("💡 Certifique-se que o ngrok está rodando: ngrok http 8000")
        return None

async def set_telegram_webhook(webhook_url: str):
    """Configurar webhook do Telegram"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/setWebhook",
                json={"url": webhook_url}
            )
            
            data = response.json()
            
            if data.get("ok"):
                print(f"✅ Webhook configurado: {webhook_url}")
                return True
            else:
                print(f"❌ Erro ao configurar webhook: {data}")
                return False
                
    except Exception as e:
        print(f"❌ Erro ao configurar webhook: {e}")
        return False

async def get_webhook_info():
    """Obter informações do webhook atual"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getWebhookInfo"
            )
            
            data = response.json()
            
            if data.get("ok"):
                webhook_info = data["result"]
                return webhook_info
            else:
                print(f"❌ Erro ao obter info do webhook: {data}")
                return None
                
    except Exception as e:
        print(f"❌ Erro ao obter info do webhook: {e}")
        return None

async def delete_webhook():
    """Remover webhook (para usar polling)"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/deleteWebhook"
            )
            
            data = response.json()
            
            if data.get("ok"):
                print("✅ Webhook removido")
                return True
            else:
                print(f"❌ Erro ao remover webhook: {data}")
                return False
                
    except Exception as e:
        print(f"❌ Erro ao remover webhook: {e}")
        return False

async def main():
    print("🤖 Configurador de Webhook do Telegram")
    print(f"📱 Bot Token: {'Configurado' if settings.TELEGRAM_BOT_TOKEN else 'NÃO CONFIGURADO'}")
    
    if not settings.TELEGRAM_BOT_TOKEN:
        print("❌ Configure o TELEGRAM_BOT_TOKEN no config_local.py")
        return
    
    # Verificar webhook atual
    print("\n📋 Verificando webhook atual...")
    webhook_info = await get_webhook_info()
    
    if webhook_info:
        current_url = webhook_info.get("url", "")
        pending_updates = webhook_info.get("pending_update_count", 0)
        
        if current_url:
            print(f"🔗 Webhook atual: {current_url}")
            print(f"📊 Updates pendentes: {pending_updates}")
        else:
            print("📭 Nenhum webhook configurado")
    
    print("\n🔧 Opções:")
    print("1. Configurar webhook com ngrok")
    print("2. Remover webhook (usar polling)")
    print("3. Apenas verificar status")
    
    choice = input("\nEscolha uma opção (1-3): ").strip()
    
    if choice == "1":
        print("\n🌐 Procurando URL do ngrok...")
        ngrok_url = await get_ngrok_url()
        
        if ngrok_url:
            webhook_url = f"{ngrok_url}/api/telegram/webhook"
            print(f"🔗 URL do webhook: {webhook_url}")
            
            success = await set_telegram_webhook(webhook_url)
            
            if success:
                print("\n🎉 Webhook configurado com sucesso!")
                print("📝 Instruções:")
                print("1. Acesse seu bot: https://t.me/Financeiro_app_bot")
                print("2. Digite /start")
                print("3. O bot agora responderá via webhook!")
                print(f"4. Logs aparecerão no terminal do uvicorn")
                
                # Verificar se backend está rodando
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.get(f"{ngrok_url}/")
                        if response.status_code == 200:
                            print("✅ Backend acessível via ngrok")
                        else:
                            print("⚠️ Backend pode não estar acessível")
                except:
                    print("⚠️ Não foi possível verificar o backend")
            
    elif choice == "2":
        await delete_webhook()
        print("💡 Agora você pode usar o polling: python test_telegram.py")
        
    elif choice == "3":
        if webhook_info:
            print(f"\n📊 Status do webhook:")
            for key, value in webhook_info.items():
                print(f"  {key}: {value}")
    else:
        print("❌ Opção inválida")

if __name__ == "__main__":
    asyncio.run(main()) 