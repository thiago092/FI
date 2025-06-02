#!/bin/bash

# Azure App Service deployment script
echo "🚀 Starting FinançasAI deployment..."

# Install dependencies
echo "📦 Installing Python dependencies..."
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo "✅ Deployment completed successfully!"
echo "🔧 Application will be started with startup command from Azure settings" 