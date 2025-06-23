#!/usr/bin/env python3
"""
Script de Cron Job SEPARADO para Débitos Automáticos de Financiamentos
Executa diariamente para processar parcelas que vencem no dia
"""

import os
import sys
import logging
from datetime import date, datetime
from pathlib import Path

# Adicionar o diretório pai ao path para importar módulos da aplicação
script_dir = Path(__file__).parent
app_dir = script_dir.parent
sys.path.insert(0, str(app_dir))

# Configurar logging
log_dir = app_dir / "logs"
log_dir.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / f"financiamentos_{date.today().strftime('%Y%m')}.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("cron_financiamentos")

def main():
    """Função principal do cron job para financiamentos"""
    try:
        logger.info("💳 Iniciando execução de débitos automáticos de financiamentos via cron job")
        
        # Importar serviços após configurar o path
        from app.services.agendador_service import AgendadorService
        
        # Processar débitos automáticos de financiamentos
        resultado = AgendadorService.processar_financiamentos_do_dia()
        
        # Log dos resultados
        logger.info(f"✅ Processamento de financiamentos concluído:")
        logger.info(f"   🏦 Total financiamentos com débito automático: {resultado['total_financiamentos_auto_debito']}")
        logger.info(f"   🔄 Processados: {resultado['processados']}")
        logger.info(f"   💳 Parcelas pagas: {resultado['parcelas_pagas']}")
        logger.info(f"   💰 Transações criadas: {resultado['transacoes_criadas']}")
        logger.info(f"   ❌ Erros: {resultado['erros']}")
        
        # Detalhar parcelas pagas
        if resultado['parcelas_pagas'] > 0:
            logger.info("💳 Débitos automáticos processados:")
            for detalhe in resultado['detalhes']:
                if detalhe.get('parcela_paga'):
                    logger.info(f"   - {detalhe['descricao']} - R$ {detalhe['valor_pago']:.2f} (ID: {detalhe['transacao_id']})")
        
        # Verificar se houve erros
        if resultado['erros'] > 0:
            logger.warning(f"⚠️ {resultado['erros']} erro(s) durante o processamento:")
            for detalhe in resultado['detalhes']:
                if 'erro' in detalhe:
                    logger.error(f"   - {detalhe['descricao']}: {detalhe['erro']}")
        
        # Retornar código de saída baseado no resultado
        if resultado['erros'] > 0:
            logger.warning("🔶 Processamento de financiamentos concluído com erros")
            sys.exit(1)  # Código de erro para o cron
        else:
            logger.info("🎉 Processamento de financiamentos concluído com sucesso")
            sys.exit(0)  # Sucesso
            
    except Exception as e:
        logger.error(f"💥 Erro crítico no processamento de financiamentos: {e}")
        logger.exception("Stack trace completo:")
        sys.exit(2)  # Erro crítico

if __name__ == "__main__":
    main() 