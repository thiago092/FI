#!/usr/bin/env python3
"""
FinançasAI - FastAPI Server
Run with: python app.py
"""

import uvicorn
from app.main import app

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app", 
        host="127.0.0.1", 
        port=8000, 
        reload=True,
        log_level="info"
    ) 