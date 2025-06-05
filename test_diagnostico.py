import requests
import json

# URLs para testar
urls = [
    "http://localhost:8000/api/admin/diagnostico-banco-completo",
    "https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/admin/diagnostico-banco-completo",
    "https://jolly-bay-0a0f6890f.6.azurestaticapps.net/api/admin/diagnostico-banco-completo"
]

for url in urls:
    print(f"\n🔍 Testando: {url}")
    try:
        response = requests.post(url, timeout=15)
        print(f"✅ Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("📊 RESULTADO DO DIAGNÓSTICO:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            break
        else:
            print(f"❌ Erro: {response.text[:200]}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Erro de conexão: {e}")

print("\n🏁 Teste concluído!") 