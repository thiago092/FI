#!/usr/bin/env python3
"""
Teste direto do endpoint de confirmação para identificar o erro 500
"""

import os
import sys
import requests
import json
from datetime import datetime

# Configurações
API_BASE_URL = "https://financas-ai-backend.azurewebsites.net"
# Substitua pelos seus dados de login
EMAIL = "YOUR_EMAIL_HERE"  # Coloque seu email aqui
PASSWORD = "YOUR_PASSWORD_HERE"  # Coloque sua senha aqui

def fazer_login():
    """Fazer login e obter token"""
    try:
        login_data = {
            "username": EMAIL,
            "password": PASSWORD
        }
        
        print("🔐 Fazendo login...")
        response = requests.post(f"{API_BASE_URL}/auth/login", data=login_data)
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('access_token')
            print(f"✅ Login bem-sucedido! Token: {token[:20]}...")
            return token
        else:
            print(f"❌ Erro no login: {response.status_code}")
            print(f"Resposta: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Erro no login: {e}")
        return None

def testar_endpoint_confirmacao(token):
    """Testar o endpoint de confirmação que está falhando"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("\n🔍 Testando GET /telegram/config/confirmacao-recorrentes")
    try:
        response = requests.get(
            f"{API_BASE_URL}/telegram/config/confirmacao-recorrentes",
            headers=headers
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            print("✅ Sucesso!")
            print(f"Resposta: {json.dumps(response.json(), indent=2)}")
        else:
            print("❌ Erro!")
            print(f"Texto da resposta: {response.text}")
            
    except Exception as e:
        print(f"❌ Exceção: {e}")

    print("\n🔍 Testando PATCH /telegram/config/confirmacao-recorrentes")
    try:
        patch_data = {
            "ativar": True,
            "timeout_horas": 2
        }
        
        response = requests.patch(
            f"{API_BASE_URL}/telegram/config/confirmacao-recorrentes",
            headers=headers,
            params=patch_data  # Como query params
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Sucesso!")
            print(f"Resposta: {json.dumps(response.json(), indent=2)}")
        else:
            print("❌ Erro!")
            print(f"Texto da resposta: {response.text}")
            
    except Exception as e:
        print(f"❌ Exceção: {e}")

def main():
    print("=" * 60)
    print("🚀 TESTE DIRETO DO ENDPOINT DE CONFIRMAÇÃO")
    print("=" * 60)
    
    # Verificar se as credenciais foram configuradas
    if EMAIL == "YOUR_EMAIL_HERE" or PASSWORD == "YOUR_PASSWORD_HERE":
        print("❌ CONFIGURE SEU EMAIL E SENHA NO SCRIPT ANTES DE EXECUTAR!")
        print("Edite as linhas 12-13 com suas credenciais.")
        return
    
    # Fazer login
    token = fazer_login()
    if not token:
        print("❌ Não foi possível fazer login. Verifique suas credenciais.")
        return
    
    # Testar endpoints
    testar_endpoint_confirmacao(token)
    
    print("\n" + "=" * 60)
    print("✅ TESTE CONCLUÍDO")
    print("=" * 60)

if __name__ == "__main__":
    main() 