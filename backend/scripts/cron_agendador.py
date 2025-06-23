#!/usr/bin/env python3
"""
Script de Cron Job para Agendador de Transações Recorrentes
Executa diariamente para processar transações que vencem no dia
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
        logging.FileHandler(log_dir / f"agendador_{date.today().strftime('%Y%m')}.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("cron_agendador")

def main():
    """Função principal do cron job"""
    try:
        logger.info("🚀 Iniciando execução do agendador via cron job")
        
        # Importar serviços após configurar o path
        from app.services.agendador_service import AgendadorService
        
        # Processar transações do dia (mantendo sistema original)
        resultado = AgendadorService.processar_transacoes_do_dia()
        
        # Log dos resultados
        logger.info(f"✅ Processamento concluído:")
        logger.info(f"   📊 Total recorrentes ativas: {resultado['total_recorrentes_ativas']}")
        logger.info(f"   🔄 Processadas: {resultado['processadas']}")
        logger.info(f"   ✨ Criadas: {resultado['criadas']}")
        logger.info(f"   ❌ Erros: {resultado['erros']}")
        
        # Detalhar transações criadas
        if resultado['criadas'] > 0:
            logger.info("💰 Transações criadas:")
            for detalhe in resultado['detalhes']:
                if detalhe.get('criada'):
                    logger.info(f"   - {detalhe['descricao']} (ID: {detalhe['transacao_id']})")
        
        # Verificar se houve erros
        if resultado['erros'] > 0:
            logger.warning(f"⚠️ {resultado['erros']} erro(s) durante o processamento:")
            for detalhe in resultado['detalhes']:
                if 'erro' in detalhe:
                    logger.error(f"   - {detalhe['descricao']}: {detalhe['erro']}")
        
        # Retornar código de saída baseado no resultado
        if resultado['erros'] > 0:
            logger.warning("🔶 Processamento concluído com erros")
            sys.exit(1)  # Código de erro para o cron
        else:
            logger.info("🎉 Processamento concluído com sucesso")
            sys.exit(0)  # Sucesso
            
    except Exception as e:
        logger.error(f"💥 Erro crítico no agendador: {e}")
        logger.exception("Stack trace completo:")
        sys.exit(2)  # Erro crítico

if __name__ == "__main__":
    main() 