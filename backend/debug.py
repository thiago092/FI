#!/usr/bin/env python3
import sys
import os
import traceback

print("🔍 DEBUG - Starting diagnostic script...")
print(f"Python version: {sys.version}")
print(f"Current working directory: {os.getcwd()}")
print(f"Files in current directory: {os.listdir('.')}")

try:
    print("📁 Checking if app directory exists...")
    if os.path.exists('app'):
        print("✅ app directory found")
        print(f"Contents: {os.listdir('app')}")
    else:
        print("❌ app directory not found")
    
    print("🐍 Testing Python imports...")
    import pydantic
    print(f"✅ pydantic {pydantic.VERSION} imported")
    
    import fastapi
    print(f"✅ fastapi {fastapi.__version__} imported")
    
    import uvicorn
    print(f"✅ uvicorn imported")
    
    print("🚀 Testing app import...")
    from app.main import app
    print("✅ FastAPI app imported successfully!")
    
    print("🎯 All checks passed! Starting server...")
    
    # Simple HTTP server test
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
    
except Exception as e:
    print(f"❌ ERROR: {e}")
    print("📋 Full traceback:")
    traceback.print_exc()
    sys.exit(1) 