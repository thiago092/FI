#!/usr/bin/env python3
"""
Gerenciador completo do Bot Telegram usando pyngrok
Não precisa instalar ngrok separadamente!
"""

import asyncio
import httpx
import sys
import os
from threading import Thread
import time

# Adicionar o diretório atual ao path
sys.path.insert(0, os.path.dirname(__file__))

try:
    from pyngrok import ngrok, conf
    from pyngrok.conf import PyngrokConfig
except ImportError:
    print("❌ pyngrok não instalado. Execute: pip install pyngrok")
    sys.exit(1)

from app.core.config import settings
from app.services.telegram_polling_service import TelegramPollingService

class TelegramBotManager:
    def __init__(self):
        self.tunnel = None
        self.webhook_url = None
        self.polling_service = None
        self.use_webhook = True  # True = webhook, False = polling
        
    async def start_with_webhook(self, port: int = 8000):
        """Iniciar bot com webhook usando ngrok automático"""
        print("🚀 Iniciando Telegram Bot com Webhook (ngrok automático)")
        
        if not settings.TELEGRAM_BOT_TOKEN:
            print("❌ TELEGRAM_BOT_TOKEN não configurado!")
            return False
        
        try:
            # Configurar ngrok
            print("🔧 Configurando ngrok...")
            conf.get_default().auth_token = None  # Usar versão gratuita
            
            # Criar túnel HTTP
            print(f"🌐 Criando túnel para porta {port}...")
            self.tunnel = ngrok.connect(port)
            public_url = self.tunnel.public_url
            
            print(f"✅ Túnel criado: {public_url}")
            
            # Configurar webhook
            self.webhook_url = f"{public_url}/api/telegram/webhook"
            
            success = await self._set_webhook(self.webhook_url)
            
            if success:
                print(f"🎉 Bot configurado com sucesso!")
                print(f"🔗 Webhook URL: {self.webhook_url}")
                print(f"📱 Bot: https://t.me/Financeiro_app_bot")
                print(f"📊 Logs aparecerão no terminal do uvicorn")
                return True
            else:
                self.stop()
                return False
                
        except Exception as e:
            print(f"❌ Erro ao configurar webhook: {e}")
            print("💡 Tentando com polling...")
            return await self.start_with_polling()
    
    async def start_with_polling(self):
        """Iniciar bot com polling (sem ngrok)"""
        print("🔄 Iniciando Telegram Bot com Polling")
        
        if not settings.TELEGRAM_BOT_TOKEN:
            print("❌ TELEGRAM_BOT_TOKEN não configurado!")
            return False
        
        try:
            # Remover webhook se existir
            await self._delete_webhook()
            
            # Iniciar polling em thread separada
            self.polling_service = TelegramPollingService()
            
            def run_polling():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(self.polling_service.start_polling())
            
            polling_thread = Thread(target=run_polling, daemon=True)
            polling_thread.start()
            
            print(f"✅ Polling iniciado!")
            print(f"📱 Bot: https://t.me/Financeiro_app_bot")
            print(f"🔄 Verificando mensagens a cada 1 segundo")
            
            self.use_webhook = False
            return True
            
        except Exception as e:
            print(f"❌ Erro ao iniciar polling: {e}")
            return False
    
    async def _set_webhook(self, webhook_url: str) -> bool:
        """Configurar webhook do Telegram"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/setWebhook",
                    json={"url": webhook_url}
                )
                
                data = response.json()
                return data.get("ok", False)
                
        except Exception as e:
            print(f"❌ Erro ao configurar webhook: {e}")
            return False
    
    async def _delete_webhook(self) -> bool:
        """Remover webhook do Telegram"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/deleteWebhook"
                )
                
                data = response.json()
                return data.get("ok", False)
                
        except Exception as e:
            print(f"❌ Erro ao remover webhook: {e}")
            return False
    
    async def get_bot_info(self):
        """Obter informações do bot"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getMe"
                )
                
                data = response.json()
                
                if data.get("ok"):
                    bot_info = data["result"]
                    print(f"🤖 Bot: @{bot_info['username']} ({bot_info['first_name']})")
                    return bot_info
                else:
                    print(f"❌ Erro ao obter info do bot: {data}")
                    return None
                    
        except Exception as e:
            print(f"❌ Erro ao conectar com bot: {e}")
            return None
    
    def stop(self):
        """Parar bot e limpar recursos"""
        try:
            if self.tunnel:
                ngrok.disconnect(self.tunnel.public_url)
                self.tunnel = None
                print("🛑 Túnel ngrok fechado")
            
            if self.polling_service:
                asyncio.create_task(self.polling_service.stop_polling())
                print("🛑 Polling parado")
                
        except Exception as e:
            print(f"⚠️ Erro ao parar: {e}")
    
    def get_status(self):
        """Obter status atual"""
        if self.use_webhook and self.tunnel:
            return {
                "mode": "webhook",
                "url": self.webhook_url,
                "tunnel": self.tunnel.public_url,
                "active": True
            }
        elif not self.use_webhook and self.polling_service:
            return {
                "mode": "polling", 
                "active": self.polling_service.is_running,
                "last_update": self.polling_service.last_update_id
            }
        else:
            return {"mode": "stopped", "active": False}

async def main():
    print("🤖 Gerenciador do Telegram Bot")
    print("=" * 50)
    
    manager = TelegramBotManager()
    
    # Verificar bot
    bot_info = await manager.get_bot_info()
    if not bot_info:
        return
    
    print("\n🔧 Escolha o modo:")
    print("1. 🌐 Webhook (ngrok automático) - Recomendado")
    print("2. 🔄 Polling (sem ngrok)")
    print("3. ❌ Sair")
    
    choice = input("\nEscolha (1-3): ").strip()
    
    if choice == "1":
        port = int(input("Porta do backend (padrão 8000): ") or "8000")
        success = await manager.start_with_webhook(port)
        
    elif choice == "2":
        success = await manager.start_with_polling()
        
    elif choice == "3":
        print("👋 Até logo!")
        return
    
    else:
        print("❌ Opção inválida")
        return
    
    if success:
        print("\n" + "=" * 50)
        print("✅ Bot configurado e rodando!")
        print("\n📝 Para testar:")
        print("1. Acesse: https://t.me/Financeiro_app_bot")
        print("2. Digite: /start")
        print("3. Pegue o código de 6 dígitos")
        print("4. Vincule no site: http://localhost:3001")
        print("5. Volte ao Telegram e teste!")
        
        print("\n⏸️ Pressione Ctrl+C para parar")
        
        try:
            while True:
                await asyncio.sleep(1)
                
        except KeyboardInterrupt:
            print("\n🛑 Parando bot...")
            manager.stop()
            print("✅ Bot parado!")
    
    else:
        print("❌ Falha ao configurar bot")

if __name__ == "__main__":
    asyncio.run(main()) 