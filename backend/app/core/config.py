from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import Optional
import os

class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env")
    
    # Database - PostgreSQL Azure
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./financas_ai.db")
    
    # Azure PostgreSQL (primary database)
    AZURE_POSTGRESQL_HOST: Optional[str] = os.getenv("AZURE_POSTGRESQL_HOST")
    AZURE_POSTGRESQL_DATABASE: Optional[str] = os.getenv("AZURE_POSTGRESQL_DATABASE")
    AZURE_POSTGRESQL_USERNAME: Optional[str] = os.getenv("AZURE_POSTGRESQL_USERNAME")
    AZURE_POSTGRESQL_PASSWORD: Optional[str] = os.getenv("AZURE_POSTGRESQL_PASSWORD")
    AZURE_POSTGRESQL_PORT: str = os.getenv("AZURE_POSTGRESQL_PORT", "5432")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # OpenAI
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_PROJECT_ID: Optional[str] = os.getenv("OPENAI_PROJECT_ID")
    
    # Telegram Bot
    TELEGRAM_BOT_TOKEN: Optional[str] = os.getenv("TELEGRAM_BOT_TOKEN")
    TELEGRAM_WEBHOOK_URL: Optional[str] = os.getenv("TELEGRAM_WEBHOOK_URL")
    
    # WhatsApp Business API
    WHATSAPP_APP_ID: Optional[str] = os.getenv("WHATSAPP_APP_ID")
    WHATSAPP_APP_SECRET: Optional[str] = os.getenv("WHATSAPP_APP_SECRET")
    WHATSAPP_ACCESS_TOKEN: Optional[str] = os.getenv("WHATSAPP_ACCESS_TOKEN")
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    WHATSAPP_VERIFY_TOKEN: Optional[str] = os.getenv("WHATSAPP_VERIFY_TOKEN")
    
    # CORS - Production ready with Azure Static Web Apps support
    BACKEND_CORS_ORIGINS: list = [
        "http://localhost:3000", 
        "http://localhost:3001",
        "http://localhost:5173",
        "https://jolly-bay-0a0f6890f.6.azurestaticapps.net",
        "https://financas-ai.azurestaticapps.net"
    ]
    
    # Admin
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@financas-ai.com")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")
    
    # Azure Storage
    AZURE_STORAGE_CONNECTION_STRING: Optional[str] = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    AZURE_STORAGE_CONTAINER_NAME: str = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "uploads")
    
    # Cron Job
    CRON_SECRET_KEY: str = os.getenv("CRON_SECRET_KEY", "cron-secret-key-change-in-production")
    
    def get_database_url(self) -> str:
        """Get PostgreSQL connection string if available, fallback to DATABASE_URL"""
        if all([
            self.AZURE_POSTGRESQL_HOST,
            self.AZURE_POSTGRESQL_DATABASE,
            self.AZURE_POSTGRESQL_USERNAME,
            self.AZURE_POSTGRESQL_PASSWORD
        ]):
            password = self.AZURE_POSTGRESQL_PASSWORD.replace('@', '%40').replace('#', '%23')
            return f"postgresql://{self.AZURE_POSTGRESQL_USERNAME}:{password}@{self.AZURE_POSTGRESQL_HOST}:{self.AZURE_POSTGRESQL_PORT}/{self.AZURE_POSTGRESQL_DATABASE}?sslmode=require"
        return self.DATABASE_URL

settings = Settings()

# Production configuration
if settings.AZURE_POSTGRESQL_HOST:
    pass  # Production mode 