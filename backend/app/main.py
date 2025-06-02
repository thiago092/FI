from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from .core.config import settings
    from .database import engine, get_db
    from .models import *  # Import all models
    from .models.telegram_user import TelegramUser  # Importar modelo do Telegram explicitamente
    from .core.security import get_password_hash
    from .api import auth, categorias, cartoes, contas, transacoes, faturas, planejamento, chat, telegram
    
    logger.info("✅ All imports successful")
except Exception as e:
    logger.error(f"❌ Import error: {e}")
    import traceback
    logger.error(traceback.format_exc())
    raise

# Criar tabelas - with error handling
try:
    from .models.user import Base
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created successfully")
except Exception as e:
    logger.error(f"❌ Database error: {e}")
    # Don't fail startup for database issues in some cases
    pass

app = FastAPI(title="FinançasAI API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Incluir rotas
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(categorias.router, prefix="/api/categorias", tags=["categorias"])
app.include_router(cartoes.router, prefix="/api/cartoes", tags=["cartoes"])
app.include_router(contas.router, prefix="/api/contas", tags=["contas"])
app.include_router(transacoes.router, prefix="/api/transacoes", tags=["transacoes"])
app.include_router(faturas.router, prefix="/api/faturas", tags=["faturas"])
app.include_router(planejamento.router, prefix="/api/planejamento", tags=["planejamento"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(telegram.router, prefix="/api/telegram", tags=["telegram"])

@app.on_event("startup")
async def startup_event():
    """Criar usuário admin global na inicialização"""
    try:
        db = next(get_db())
        
        # Verificar se admin já existe
        from .models.user import User
        admin_user = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        
        if not admin_user:
            # Criar usuário admin
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
        else:
            logger.info(f"✅ Admin user already exists: {settings.ADMIN_EMAIL}")
        
        db.close()
    except Exception as e:
        logger.error(f"❌ Startup event error: {e}")
        # Don't fail startup for admin user creation issues

@app.get("/")
def read_root():
    return {"message": "FinançasAI API is running!", "status": "healthy"}

@app.get("/health")
def health_check():
    """Health check endpoint for Azure App Service"""
    return {"status": "healthy", "service": "FinançasAI API"} 