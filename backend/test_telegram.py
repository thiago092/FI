#!/usr/bin/env python3
"""
Script para testar integração com Telegram localmente
Usar polling em vez de webhook para desenvolvimento local
"""

import asyncio
import httpx
import sys
import os

# Adicionar o diretório atual ao path
sys.path.insert(0, os.path.dirname(__file__))

from app.services.telegram_polling_service import TelegramPollingService
from app.core.config import settings

async def main():
    print("🤖 Testando integração com Telegram")
    print(f"📱 Bot Token: {'Configurado' if settings.TELEGRAM_BOT_TOKEN else 'NÃO CONFIGURADO'}")
    
    if not settings.TELEGRAM_BOT_TOKEN:
        print("❌ Configure o TELEGRAM_BOT_TOKEN no config_local.py")
        return
    
    # Testar conexão com bot
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getMe")
            data = response.json()
            
            if data.get("ok"):
                bot_info = data["result"]
                print(f"✅ Bot conectado: @{bot_info['username']} ({bot_info['first_name']})")
            else:
                print(f"❌ Erro ao conectar bot: {data}")
                return
                
    except Exception as e:
        print(f"❌ Erro de conexão: {e}")
        return
    
    # Iniciar polling
    polling = TelegramPollingService()
    
    print("\n🚀 Iniciando polling...")
    print("📝 Instruções:")
    print("1. Acesse seu bot: https://t.me/Financeiro_app_bot")
    print("2. Digite /start")
    print("3. Pegue o código de 6 dígitos")
    print("4. No site (localhost:3001), vincule sua conta")
    print("5. Volte ao Telegram e teste enviando mensagens!")
    print("\n⏸️  Pressione Ctrl+C para parar")
    
    try:
        await polling.start_polling()
    except KeyboardInterrupt:
        print("\n🛑 Parando polling...")
        await polling.stop_polling()
        print("✅ Finalizado!")

if __name__ == "__main__":
    asyncio.run(main()) 