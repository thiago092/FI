#!/usr/bin/env python3
"""
Debug específico para áudio do Telegram
"""

import asyncio
import httpx
import logging
import os
from datetime import datetime

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_telegram_bot():
    """Testar se o bot está respondendo"""
    
    # Configurações
    BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
    
    if not BOT_TOKEN:
        print("❌ TELEGRAM_BOT_TOKEN não configurado!")
        return
    
    base_url = f"https://api.telegram.org/bot{BOT_TOKEN}"
    
    try:
        async with httpx.AsyncClient() as client:
            # Testar se bot está funcionando
            response = await client.get(f"{base_url}/getMe")
            
            if response.status_code == 200:
                bot_info = response.json()
                if bot_info.get("ok"):
                    print(f"✅ Bot está online: {bot_info['result']['first_name']}")
                    print(f"🆔 Username: @{bot_info['result']['username']}")
                else:
                    print("❌ Bot não está respondendo corretamente")
                    return
            else:
                print(f"❌ Erro ao conectar com bot: {response.status_code}")
                return
            
            # Verificar últimas mensagens
            print("\n📱 Verificando últimas mensagens...")
            updates_response = await client.get(f"{base_url}/getUpdates?limit=5")
            
            if updates_response.status_code == 200:
                updates_data = updates_response.json()
                
                if updates_data.get("ok"):
                    updates = updates_data.get("result", [])
                    print(f"📊 Encontradas {len(updates)} mensagens recentes")
                    
                    for update in updates:
                        if "message" in update:
                            message = update["message"]
                            message_type = "texto"
                            
                            if "photo" in message:
                                message_type = "foto"
                            elif "voice" in message:
                                message_type = "voice"
                            elif "audio" in message:
                                message_type = "audio"
                            elif "document" in message:
                                message_type = "documento"
                            
                            # Converter timestamp
                            timestamp = datetime.fromtimestamp(message.get("date", 0))
                            
                            print(f"  • {timestamp.strftime('%H:%M:%S')} - {message_type}")
                            
                            # Se for áudio, mostrar detalhes
                            if "voice" in message:
                                voice = message["voice"]
                                print(f"    🎤 Voice: {voice.get('duration', 0)}s, {voice.get('file_size', 0)} bytes")
                                print(f"    📁 File ID: {voice.get('file_id', 'N/A')}")
                            
                            elif "audio" in message:
                                audio = message["audio"]
                                print(f"    🎵 Audio: {audio.get('duration', 0)}s, {audio.get('file_size', 0)} bytes")
                                print(f"    📁 File ID: {audio.get('file_id', 'N/A')}")
                
                else:
                    print("❌ Erro ao obter updates")
            else:
                print(f"❌ Erro ao verificar mensagens: {updates_response.status_code}")
                
    except Exception as e:
        print(f"❌ Erro geral: {e}")

async def test_audio_processing():
    """Testar processamento de áudio específico"""
    
    print("\n🔧 Testando processamento de áudio...")
    
    # Verificar se OpenAI está configurado
    openai_key = os.getenv('OPENAI_API_KEY')
    if openai_key:
        print(f"✅ OpenAI API Key configurada: {openai_key[:10]}...{openai_key[-5:]}")
    else:
        print("❌ OpenAI API Key não configurada!")
        return
    
    try:
        from openai import OpenAI
        client = OpenAI(api_key=openai_key)
        print("✅ Cliente OpenAI criado com sucesso")
        
        # Testar se consegue acessar a API
        # (não vamos fazer requisição real sem arquivo)
        print("✅ Configuração do Whisper parece OK")
        
    except Exception as e:
        print(f"❌ Erro ao configurar OpenAI: {e}")

async def main():
    """Função principal de debug"""
    print("🐛 Debug do Áudio Telegram - FinançasAI")
    print("=" * 50)
    
    await test_telegram_bot()
    await test_audio_processing()
    
    print("\n" + "=" * 50)
    print("🔍 Debug concluído!")
    print("\n💡 Dicas para debug:")
    print("1. Verifique se o bot está recebendo as mensagens")
    print("2. Confirme se OPENAI_API_KEY está configurada no Azure")
    print("3. Teste enviar áudio pelo Telegram e verificar logs")
    print("4. Use /help no bot para ver se está respondendo")

if __name__ == "__main__":
    asyncio.run(main()) 