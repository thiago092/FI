#!/usr/bin/env python3
"""
Startup script for Azure App Service.
This ensures the FastAPI application is properly initialized.
"""

import os
import sys
import logging

# Configure logging for Azure
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Main startup function"""
    try:
        # Set the working directory to the script's directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        os.chdir(current_dir)
        
        # Add current directory to Python path
        if current_dir not in sys.path:
            sys.path.insert(0, current_dir)
        
        logger.info(f"🚀 Starting FinançasAI application from: {current_dir}")
        logger.info(f"📍 Python path: {sys.path[:3]}...")
        
        # Import and validate the app
        from app import app
        logger.info("✅ FastAPI app imported successfully")
        
        # Test if app is working
        if hasattr(app, 'router'):
            logger.info("✅ FastAPI app is properly configured")
        
        return app
        
    except Exception as e:
        logger.error(f"❌ Failed to start application: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise

if __name__ == "__main__":
    app = main()
    # For local testing
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 