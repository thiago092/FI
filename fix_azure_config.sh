#!/bin/bash

# Script para corrigir configuração do Azure App Service

echo "🔧 Configurando Azure App Service para FinançasAI..."

# Configurar o startup command
echo "📝 Configurando startup command..."
az webapp config set \
  --name financeiro \
  --resource-group rg-financas-ai-v2 \
  --startup-file "gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker --bind=0.0.0.0:\$PORT --timeout 600"

# Desabilitar auto-build do Oryx
echo "🛠️ Desabilitando auto-build do Oryx..."
az webapp config appsettings set \
  --name financeiro \
  --resource-group rg-financas-ai-v2 \
  --settings \
    SCM_DO_BUILD_DURING_DEPLOYMENT=false \
    ENABLE_ORYX_BUILD=false \
    POST_BUILD_COMMAND="echo 'Custom deployment completed'" \
    WEBSITES_ENABLE_APP_SERVICE_STORAGE=true

# Configurar Python runtime
echo "🐍 Configurando Python runtime..."
az webapp config set \
  --name financeiro \
  --resource-group rg-financas-ai-v2 \
  --linux-fx-version "PYTHON|3.11"

echo "✅ Configuração concluída!"
echo "🚀 Reinicie o App Service para aplicar as mudanças:"
echo "   az webapp restart --name financeiro --resource-group rg-financas-ai-v2" 