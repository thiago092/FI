# Configurações locais para desenvolvimento
# Este arquivo substitui o .env para maior transparência

# Database
DATABASE_URL = "sqlite:///./financas_ai.db"

# Security
SECRET_KEY = "financas-ai-super-secret-key-change-in-production-123456789"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OpenAI
OPENAI_API_KEY = "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"
OPENAI_PROJECT_ID = "proj_w3OiDZcoYnmOMH9wA0yqCrku"

# Telegram Bot
TELEGRAM_BOT_TOKEN = "7381178901:AAFX06jZftWyRLnFxgmzBPHlKa6utiUwd3s"
TELEGRAM_WEBHOOK_URL = "https://seu-dominio.com/api/telegram/webhook"  # Atualizar quando em produção

# CORS - Configuração local para desenvolvimento
BACKEND_CORS_ORIGINS = [
    "http://localhost:3000", 
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001", 
    "http://127.0.0.1:5173",
]

# Admin
ADMIN_EMAIL = "admin@financas-ai.com"
ADMIN_PASSWORD = "admin123"

print("🔧 Configurações carregadas do config_local.py")
print(f"📊 Database: {DATABASE_URL}")
print(f"🔐 Admin: {ADMIN_EMAIL}")
print(f"🌐 CORS Origins: {BACKEND_CORS_ORIGINS}")
print(f"🤖 OpenAI Project ID: {OPENAI_PROJECT_ID}")
print(f"📱 Telegram Bot: {'Configurado' if TELEGRAM_BOT_TOKEN else 'Não configurado'}") 