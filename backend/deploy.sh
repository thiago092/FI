#!/bin/bash

# Exit on any failure
set -e

# Azure App Service deployment script
echo "🚀 Starting FinançasAI deployment..."

# Stop any running processes
echo "🛑 Stopping any running processes..."
pkill -f "python" || true
pkill -f "gunicorn" || true
sleep 2

# Install dependencies
echo "📦 Installing dependencies..."
python -m pip install --upgrade pip
pip install -r requirements.txt

echo "✅ FinançasAI deployment completed successfully!"
echo "🔧 Application will be started with startup command from Azure settings" 