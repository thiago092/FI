#!/usr/bin/env python3

from app.services.chat_ai_service import ChatAIService

# Teste de detecção de parcelamento
def test_deteccao_parcelamento():
    """Testa a detecção de padrões de parcelamento"""
    
    # Criar service simplificado (apenas para teste da função)
    class MockChatAIService(ChatAIService):
        def __init__(self):
            pass  # Não chamar super().__init__ para evitar dependências
    
    service = MockChatAIService()
    
    # Testes de detecção
    testes = [
        'comprei um iphone 12x de 500 no nubank',
        'parcelei 10x de 200 reais', 
        'gastei 100 no mercado',
        'comprei uma tv 6x 300',
        'dividi em 4 parcelas de 250',
        'parcelei em 8x de 150',
        'iPhone 15 Pro em 24x de 200',
        'notebook 6 vezes de 800'
    ]
    
    print("🧪 TESTE DE DETECÇÃO DE PARCELAMENTO")
    print("=" * 50)
    
    for teste in testes:
        resultado = service._detectar_parcelamento(teste)
        print(f'📝 Entrada: "{teste}"')
        print(f'✅ Resultado: {resultado}')
        if resultado and resultado.get('detectado'):
            if not resultado.get('requer_detalhes'):
                print(f'   📊 {resultado["total_parcelas"]}x de R$ {resultado["valor_parcela"]:.2f} = R$ {resultado["valor_total"]:.2f}')
        print('-' * 40)

if __name__ == "__main__":
    test_deteccao_parcelamento() 