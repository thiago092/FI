#!/usr/bin/env python3
import sys
import os
import traceback
import logging
from datetime import datetime

# Create logs directory if it doesn't exist
LOGS_DIR = "logs"
if not os.path.exists(LOGS_DIR):
    os.makedirs(LOGS_DIR)

# Configure file logging
log_file_path = os.path.join(LOGS_DIR, "debug_azure.log")
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file_path),
        logging.StreamHandler(sys.stdout) # Keep printing to stdout as well
    ]
)

logger = logging.getLogger(__name__)

def log_message(message, level="info"):
    print(message) # Keep printing to stdout
    if level == "info":
        logger.info(message)
    elif level == "debug":
        logger.debug(message)
    elif level == "error":
        logger.error(message)
    elif level == "warning":
        logger.warning(message)

log_message(f"--- DEBUG SCRIPT STARTED AT {datetime.now()} ---")
log_message(f"🔍 DEBUG - Starting diagnostic script...")
log_message(f"Python version: {sys.version}")
log_message(f"Current working directory: {os.getcwd()}")
log_message(f"Files in current directory: {os.listdir('.')}")

try:
    log_message("📁 Checking if app directory exists...")
    if os.path.exists('app'):
        log_message("✅ app directory found")
        log_message(f"Contents: {os.listdir('app')}")
        
        log_message("🐍 Testing Python imports...")
        try:
            import pydantic
            log_message(f"✅ pydantic {pydantic.VERSION} imported")
        except Exception as e_imp:
            log_message(f"❌ ERROR importing pydantic: {e_imp}", level="error")
            log_message(traceback.format_exc(), level="error")
            sys.exit(1)

        try:
            import fastapi
            log_message(f"✅ fastapi {fastapi.__version__} imported")
        except Exception as e_imp:
            log_message(f"❌ ERROR importing fastapi: {e_imp}", level="error")
            log_message(traceback.format_exc(), level="error")
            sys.exit(1)

        try:
            import uvicorn
            log_message(f"✅ uvicorn imported")
        except Exception as e_imp:
            log_message(f"❌ ERROR importing uvicorn: {e_imp}", level="error")
            log_message(traceback.format_exc(), level="error")
            sys.exit(1)

        log_message("🚀 Testing app import...")
        from app.main import app
        log_message("✅ FastAPI app imported successfully!")
        
        log_message("🎯 All checks passed! Attempting to start server (this part will likely not run if script exits)...")
        # This part likely won't run if there's an issue above, 
        # but included for completeness if script somehow proceeds.
        # uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

    else:
        log_message("❌ app directory not found", level="error")
        sys.exit(1)
    
    log_message(f"--- DEBUG SCRIPT FINISHED SUCCESSFULLY AT {datetime.now()} ---")

except Exception as e:
    log_message(f"❌ UNHANDLED ERROR in debug script: {e}", level="error")
    log_message("📋 Full traceback:", level="error")
    log_message(traceback.format_exc(), level="error")
    sys.exit(1) 