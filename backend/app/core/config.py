from pydantic_settings import BaseSettings
from typing import Optional
import os

# Tentar importar configurações locais
try:
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
    from config_local import *
    USE_LOCAL_CONFIG = True
    print("✅ Usando configurações do config_local.py")
except ImportError:
    USE_LOCAL_CONFIG = False
    print("⚠️ config_local.py não encontrado, usando .env")

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = globals().get('DATABASE_URL', os.getenv("DATABASE_URL", "sqlite:///./financas_ai.db")) if USE_LOCAL_CONFIG else os.getenv("DATABASE_URL", "sqlite:///./financas_ai.db")
    
    # Azure specific database (PostgreSQL)
    AZURE_POSTGRESQL_HOST: Optional[str] = None
    AZURE_POSTGRESQL_DATABASE: Optional[str] = None
    AZURE_POSTGRESQL_USERNAME: Optional[str] = None
    AZURE_POSTGRESQL_PASSWORD: Optional[str] = None
    AZURE_POSTGRESQL_PORT: str = "5432"
    
    # Security
    SECRET_KEY: str = globals().get('SECRET_KEY', os.getenv("SECRET_KEY", "your-secret-key-change-in-production")) if USE_LOCAL_CONFIG else os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = globals().get('ALGORITHM', "HS256") if USE_LOCAL_CONFIG else "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = globals().get('ACCESS_TOKEN_EXPIRE_MINUTES', 30) if USE_LOCAL_CONFIG else 30
    
    # OpenAI
    OPENAI_API_KEY: Optional[str] = globals().get('OPENAI_API_KEY', os.getenv("OPENAI_API_KEY")) if USE_LOCAL_CONFIG else os.getenv("OPENAI_API_KEY")
    OPENAI_PROJECT_ID: Optional[str] = globals().get('OPENAI_PROJECT_ID', os.getenv("OPENAI_PROJECT_ID")) if USE_LOCAL_CONFIG else os.getenv("OPENAI_PROJECT_ID")
    
    # Telegram Bot
    TELEGRAM_BOT_TOKEN: Optional[str] = globals().get('TELEGRAM_BOT_TOKEN', os.getenv("TELEGRAM_BOT_TOKEN")) if USE_LOCAL_CONFIG else os.getenv("TELEGRAM_BOT_TOKEN")
    TELEGRAM_WEBHOOK_URL: Optional[str] = globals().get('TELEGRAM_WEBHOOK_URL', os.getenv("TELEGRAM_WEBHOOK_URL")) if USE_LOCAL_CONFIG else os.getenv("TELEGRAM_WEBHOOK_URL")
    
    # CORS - Updated for Azure
    BACKEND_CORS_ORIGINS: list = globals().get('BACKEND_CORS_ORIGINS', [
        "http://localhost:3000", 
        "http://localhost:3001",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001", 
        "http://127.0.0.1:5173",
        "https://*.azurestaticapps.net",
        "https://*.azurewebsites.net"
    ]) if USE_LOCAL_CONFIG else [
        "http://localhost:3000", 
        "http://localhost:3001",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001", 
        "http://127.0.0.1:5173",
        "https://*.azurestaticapps.net",
        "https://*.azurewebsites.net"
    ]
    
    # Admin
    ADMIN_EMAIL: str = globals().get('ADMIN_EMAIL', os.getenv("ADMIN_EMAIL", "admin@financas-ai.com")) if USE_LOCAL_CONFIG else os.getenv("ADMIN_EMAIL", "admin@financas-ai.com")
    ADMIN_PASSWORD: str = globals().get('ADMIN_PASSWORD', os.getenv("ADMIN_PASSWORD", "admin123")) if USE_LOCAL_CONFIG else os.getenv("ADMIN_PASSWORD", "admin123")
    
    # Azure Storage (for file uploads)
    AZURE_STORAGE_CONNECTION_STRING: Optional[str] = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    AZURE_STORAGE_CONTAINER_NAME: str = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "uploads")
    
    @property
    def get_database_url(self) -> str:
        """Get the appropriate database URL based on environment"""
        if all([
            self.AZURE_POSTGRESQL_HOST,
            self.AZURE_POSTGRESQL_DATABASE,
            self.AZURE_POSTGRESQL_USERNAME,
            self.AZURE_POSTGRESQL_PASSWORD
        ]):
            return f"postgresql://{self.AZURE_POSTGRESQL_USERNAME}:{self.AZURE_POSTGRESQL_PASSWORD}@{self.AZURE_POSTGRESQL_HOST}:{self.AZURE_POSTGRESQL_PORT}/{self.AZURE_POSTGRESQL_DATABASE}?sslmode=require"
        return self.DATABASE_URL
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Debug: Mostrar configurações carregadas
print(f"🔧 Configurações finais:")
print(f"📊 Database URL: {settings.DATABASE_URL}")
print(f"🔐 Admin Email: {settings.ADMIN_EMAIL}")
print(f"🌐 CORS Origins: {settings.BACKEND_CORS_ORIGINS}")
print(f"🔑 OpenAI API Key: {'Configurada' if settings.OPENAI_API_KEY else 'Não configurada'}")
print(f"🤖 OpenAI Project ID: {settings.OPENAI_PROJECT_ID if settings.OPENAI_PROJECT_ID else 'Não configurado'}") 