#!/usr/bin/env python3
"""
Telegram Bot usando localtunnel (sem ngrok, 100% Python)
"""

import asyncio
import httpx
import sys
import os
import json
import subprocess
import time
from threading import Thread

# Adicionar o diretório atual ao path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import settings

class LocalTunnelManager:
    def __init__(self, port: int = 8000):
        self.port = port
        self.tunnel_url = None
        self.process = None
        
    async def start_tunnel(self):
        """Iniciar túnel usando localtunnel"""
        try:
            # Verificar se localtunnel está disponível
            result = subprocess.run(
                ["npx", "localtunnel", "--version"], 
                capture_output=True, 
                text=True
            )
            
            if result.returncode != 0:
                print("📦 Instalando localtunnel...")
                subprocess.run(["npm", "install", "-g", "localtunnel"], check=True)
            
            print(f"🌐 Criando túnel para porta {self.port}...")
            
            # Iniciar localtunnel
            self.process = subprocess.Popen(
                ["npx", "localtunnel", "--port", str(self.port)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Aguardar URL do túnel
            await asyncio.sleep(3)
            
            if self.process.poll() is None:  # Processo ainda rodando
                # Tentar obter URL do túnel
                stdout, stderr = self.process.communicate(timeout=10)
                
                # Procurar URL na saída
                for line in stdout.split('\n'):
                    if 'https://' in line and 'loca.lt' in line:
                        self.tunnel_url = line.strip()
                        break
                
                if self.tunnel_url:
                    print(f"✅ Túnel criado: {self.tunnel_url}")
                    return True
                else:
                    print(f"❌ Falha ao obter URL do túnel")
                    print(f"Stdout: {stdout}")
                    print(f"Stderr: {stderr}")
                    return False
            else:
                print(f"❌ Processo localtunnel falhou")
                return False
                
        except subprocess.CalledProcessError as e:
            print(f"❌ Erro ao instalar/usar localtunnel: {e}")
            return False
        except Exception as e:
            print(f"❌ Erro inesperado: {e}")
            return False
    
    def stop_tunnel(self):
        """Parar túnel"""
        if self.process:
            self.process.terminate()
            self.process = None
            print("🛑 Túnel localtunnel fechado")

async def setup_telegram_webhook_localtunnel():
    """Configurar Telegram usando localtunnel"""
    print("🚀 Configurando Telegram com LocalTunnel")
    
    if not settings.TELEGRAM_BOT_TOKEN:
        print("❌ TELEGRAM_BOT_TOKEN não configurado!")
        return False
    
    tunnel_manager = LocalTunnelManager()
    
    try:
        # Criar túnel
        success = await tunnel_manager.start_tunnel()
        
        if not success:
            return False
        
        # Configurar webhook
        webhook_url = f"{tunnel_manager.tunnel_url}/api/telegram/webhook"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/setWebhook",
                json={"url": webhook_url}
            )
            
            data = response.json()
            
            if data.get("ok"):
                print(f"✅ Webhook configurado: {webhook_url}")
                print(f"📱 Bot: https://t.me/Financeiro_app_bot")
                print(f"📊 Logs aparecerão no terminal do uvicorn")
                
                # Manter túnel aberto
                print("\n⏸️ Pressione Ctrl+C para parar")
                
                try:
                    while True:
                        await asyncio.sleep(1)
                        
                except KeyboardInterrupt:
                    print("\n🛑 Parando...")
                    
                    # Remover webhook
                    await client.post(
                        f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/deleteWebhook"
                    )
                    
                    tunnel_manager.stop_tunnel()
                    print("✅ Telegram desconfigurado!")
                
                return True
            else:
                print(f"❌ Erro ao configurar webhook: {data}")
                tunnel_manager.stop_tunnel()
                return False
                
    except Exception as e:
        print(f"❌ Erro: {e}")
        tunnel_manager.stop_tunnel()
        return False

if __name__ == "__main__":
    asyncio.run(setup_telegram_webhook_localtunnel()) 