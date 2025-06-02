#!/usr/bin/env python3
"""
Main ASGI application entry point for Azure App Service.
This file is required for Gunicorn to find the FastAPI app.
"""

import os
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the current directory to Python path
current_dir = os.path.dirname(__file__)
sys.path.insert(0, current_dir)

try:
    # Import the FastAPI app
    from app.main import app
    logger.info("✅ FastAPI app imported successfully")
    
except Exception as e:
    logger.error(f"❌ Failed to import FastAPI app: {e}")
    import traceback
    logger.error(traceback.format_exc())
    raise 