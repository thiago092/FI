#!/usr/bin/env python3
"""
Script para gerar uma chave secreta forte para o cron job
"""

import secrets
import string

def generate_cron_secret_key(length=32):
    """Gera uma chave secreta forte para o cron job"""
    alphabet = string.ascii_letters + string.digits + "-_"
    key = ''.join(secrets.choice(alphabet) for _ in range(length))
    return key

if __name__ == "__main__":
    key = generate_cron_secret_key()
    print("="*60)
    print("🔐 CHAVE SECRETA PARA CRON JOB GERADA:")
    print("="*60)
    print(f"CRON_SECRET_KEY={key}")
    print("="*60)
    print()
    print("📋 PASSOS PARA CONFIGURAR:")
    print("1. Copie a chave acima")
    print("2. Configure no Azure: App Service > Configuration > Application Settings")
    print("3. Use no cron-job.org como header: X-Cron-Secret: [CHAVE]")
    print("4. Reinicie o App Service após configurar")
    print()
    print("🧪 TESTE COM CURL:")
    print(f"curl -X POST \"https://SEU_APP.azurewebsites.net/api/notifications/cron-process\" \\")
    print(f"  -H \"X-Cron-Secret: {key}\"")
    print("="*60) 