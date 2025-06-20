#!/usr/bin/env python3
"""
Script para processar notificações automáticas
Deve ser executado a cada hora pelo cron
"""

import sys
import os
import asyncio
import logging
from datetime import datetime

# Adicionar o diretório pai ao path para importar o módulo da aplicação
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db
from app.services.notification_service import notification_service

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/notifications_cron.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

async def main():
    """Função principal do cron job"""
    try:
        logger.info("🔔 Iniciando processamento de notificações via cron")
        start_time = datetime.now()
        
        # Obter sessão do banco
        db = next(get_db())
        
        try:
            # Processar notificações
            await notification_service.process_notifications(db)
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            logger.info(f"✅ Processamento concluído em {duration:.2f} segundos")
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Erro no processamento de notificações: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 