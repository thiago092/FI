#!/usr/bin/env python3
"""
Script simples para testar Telegram
"""

import asyncio
import httpx
import sys

async def testar_telegram():
    print('🤖 Testando integração Telegram...')
    
    # 1. Testar bot
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get('https://api.telegram.org/bot7381178901:AAFX06jZftWyRLnFxgmzBPHlKa6utiUwd3s/getMe')
            bot_info = response.json()
            print(f'✅ Bot: @{bot_info["result"]["username"]} ({bot_info["result"]["first_name"]})')
        except Exception as e:
            print(f'❌ Erro no bot: {e}')
            return
        
        # 2. Testar backend
        try:
            response = await client.get('http://localhost:8000/')
            print(f'✅ Backend: {response.status_code}')
        except Exception as e:
            print(f'❌ Backend offline: {e}')
            return
        
        # 3. Testar webhook do Telegram via pyngrok
        print('\n🌐 Testando com pyngrok...')
        try:
            from pyngrok import ngrok
            
            # Criar túnel
            tunnel = ngrok.connect(8000)
            public_url = tunnel.public_url
            print(f'✅ Túnel ngrok: {public_url}')
            
            # Configurar webhook
            webhook_url = f"{public_url}/api/telegram/webhook"
            response = await client.post(
                f"https://api.telegram.org/bot7381178901:AAFX06jZftWyRLnFxgmzBPHlKa6utiUwd3s/setWebhook",
                json={"url": webhook_url}
            )
            
            webhook_result = response.json()
            if webhook_result.get("ok"):
                print(f'✅ Webhook configurado: {webhook_url}')
                print('\n🎉 TELEGRAM FUNCIONANDO!')
                print('\n📱 Para testar:')
                print('1. Acesse: https://t.me/Financeiro_app_bot')
                print('2. Digite: /start')
                print('3. Pegue o código de 6 dígitos')
                print('4. Vincule no site: http://localhost:3001')
                print('5. Volte ao Telegram e teste: "Gastei R$ 10 no Nubank"')
                print('\n⏸️ Mantenha este script rodando...')
                print('🔍 Logs aparecerão no terminal do uvicorn')
                
                # Manter túnel aberto
                try:
                    while True:
                        await asyncio.sleep(1)
                except KeyboardInterrupt:
                    print('\n🛑 Parando...')
                    ngrok.disconnect(tunnel.public_url)
                    
                    # Remover webhook
                    await client.post(
                        f"https://api.telegram.org/bot7381178901:AAFX06jZftWyRLnFxgmzBPHlKa6utiUwd3s/deleteWebhook"
                    )
                    print('✅ Webhook removido!')
            else:
                print(f'❌ Erro webhook: {webhook_result}')
                ngrok.disconnect(tunnel.public_url)
                
        except ImportError:
            print('❌ pyngrok não instalado')
            print('💡 Execute: pip install pyngrok')
        except Exception as e:
            print(f'❌ Erro ngrok: {e}')
            print('💡 Tente usar polling em vez de webhook')

if __name__ == "__main__":
    try:
        asyncio.run(testar_telegram())
    except KeyboardInterrupt:
        print('\n👋 Até logo!') 