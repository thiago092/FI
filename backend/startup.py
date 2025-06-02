#!/usr/bin/env python3
import os
import sys
import logging

# Configure logging for better debugging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the current directory to Python path
current_dir = os.path.dirname(__file__)
sys.path.insert(0, current_dir)

try:
    logger.info("Starting FinançasAI application...")
    
    # Import the FastAPI app
    from app.main import app
    
    logger.info("FastAPI app imported successfully")
    
    if __name__ == "__main__":
        import uvicorn
        
        # Get port from environment (Azure App Service uses PORT environment variable)
        port = int(os.environ.get("PORT", 8000))
        host = os.environ.get("HOST", "0.0.0.0")
        
        logger.info(f"Starting server on {host}:{port}")
        
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            reload=False,
            log_level="info"
        )
        
except Exception as e:
    logger.error(f"Failed to start application: {e}")
    import traceback
    logger.error(traceback.format_exc())
    sys.exit(1) 