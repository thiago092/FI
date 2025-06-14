from fastapi import FastAPI, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import date
from fastapi.responses import JSONResponse

# Configure logging for production
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import configuration and database
from .core.config import settings
from .database import engine, get_db, Base
from .core.security import get_password_hash
from .core.init_data import initialize_basic_data

# Import all models to ensure they are registered
from .models import *
from .models.user import User
from .models.telegram_user import TelegramUser

# Import API routes
from .api import auth, categorias, cartoes, contas, transacoes, faturas, planejamento, chat, telegram, admin, dashboard, users, parcelas, migration, assistente_planejamento, transacoes_recorrentes, agendador

app = FastAPI(
    title="FinançasAI API", 
    version="1.0.0",
    description="API de gestão financeira pessoal com IA"
)

# CORS - Configuração mais permissiva para resolver problemas
origins = [
    "http://localhost:3000",
    "http://localhost:3001", 
    "http://localhost:5173",
    "https://jolly-bay-0a0f6890f.6.azurestaticapps.net",
    "https://jolly-bay-0a0f6890f.azurestaticapps.net",
    "https://financas-ai.azurestaticapps.net",
    "https://*.azurestaticapps.net"  # Permitir todos os subdomínios do Azure Static Web Apps
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Permitir todos os métodos
    allow_headers=["*"],  # Permitir todos os headers
    expose_headers=["*"],  # Expor todos os headers
    max_age=3600,
)

# Middleware para adicionar headers CORS manualmente em todas as respostas
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    # Para requisições OPTIONS (preflight), retornar resposta vazia com headers CORS
    if request.method == "OPTIONS":
        response = Response()
        response.headers["Access-Control-Allow-Origin"] = request.headers.get("origin", "*")
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Max-Age"] = "3600"
        return response
    
    # Para outras requisições, processar normalmente
    response = await call_next(request)
    
    # Adicionar headers CORS na resposta
    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

logger.info(f"🌐 CORS configurado para origens: {origins}")

# Include API routes
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(categorias.router, prefix="/api/categorias", tags=["categorias"])
app.include_router(cartoes.router, prefix="/api/cartoes", tags=["cartoes"])
app.include_router(contas.router, prefix="/api/contas", tags=["contas"])
app.include_router(transacoes.router, prefix="/api/transacoes", tags=["transacoes"])
app.include_router(faturas.router, prefix="/api/faturas", tags=["faturas"])
app.include_router(planejamento.router, prefix="/api/planejamento", tags=["planejamento"])
app.include_router(assistente_planejamento.router, prefix="/api/assistente-planejamento", tags=["assistente-planejamento"])
app.include_router(parcelas.router, prefix="/api/parcelas", tags=["parcelas"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(telegram.router, prefix="/api/telegram", tags=["telegram"])
app.include_router(admin.router, prefix="/api", tags=["admin"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(migration.router, prefix="/api/migration", tags=["migration"])
app.include_router(transacoes_recorrentes.router, prefix="/api/transacoes-recorrentes", tags=["transacoes-recorrentes"])
app.include_router(agendador.router, prefix="/api", tags=["agendador"])

@app.on_event("startup")
async def startup_event():
    """Initialize database and create admin user"""
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created successfully")
        
        # Initialize database with admin user and basic data
        db = next(get_db())
        
        # Create admin user if doesn't exist
        admin_user = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        if not admin_user:
            admin_user = User(
                email=settings.ADMIN_EMAIL,
                full_name="Administrador Global",
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                is_global_admin=True,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            logger.info(f"✅ Admin user created: {settings.ADMIN_EMAIL}")
        
        # Initialize basic data (categories, etc.)
        initialize_basic_data(db)
        
        db.close()
        logger.info("🚀 Application startup completed successfully")
        
    except Exception as e:
        logger.error(f"❌ Startup error: {e}")
        # Don't crash the application for non-critical startup issues

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    try:
        # Stop telegram polling if running
        from .services.telegram_polling_service import telegram_polling
        if telegram_polling.is_running:
            await telegram_polling.stop_polling()
            logger.info("🛑 Telegram polling stopped on shutdown")
    except Exception as e:
        logger.error(f"❌ Shutdown error: {e}")

@app.get("/")
def read_root():
    """Root endpoint"""
    return {
        "message": "FinançasAI API is running!",
        "status": "healthy",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    """Health check endpoint for Azure App Service"""
    return {
        "status": "healthy",
        "service": "FinançasAI API",
        "database": "PostgreSQL" if settings.AZURE_POSTGRESQL_HOST else "SQLite"
    }

@app.get("/cors-debug")
def cors_debug():
    """Debug endpoint to check CORS configuration"""
    return {
        "cors_origins": origins,
        "message": "CORS configuration active"
    }

@app.post("/test-post")
def test_post(data: dict = {}):
    """Test POST endpoint to verify CORS"""
    return {
        "message": "POST request successful",
        "data_received": data,
        "cors_status": "working"
    }

# Todos os endpoints de transações recorrentes foram movidos para backend/app/api/transacoes_recorrentes.py
# e são acessados através do router registrado em app.include_router(transacoes_recorrentes.router, ...)

 