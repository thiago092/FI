#!/bin/bash

echo "🔧 Building FinançasAI application..."

# Upgrade pip
echo "📦 Upgrading pip..."
python3 -m pip install --upgrade pip

# Install dependencies
echo "📋 Installing dependencies from requirements.txt..."
python3 -m pip install -r requirements.txt

# Verify uvicorn installation
echo "✅ Verifying uvicorn installation..."
python3 -c "import uvicorn; print(f'Uvicorn version: {uvicorn.__version__}')"

# Verify gunicorn installation
echo "✅ Verifying gunicorn installation..."
python3 -c "import gunicorn; print(f'Gunicorn version: {gunicorn.__version__}')"

echo "🚀 Build completed successfully!" 