from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .core.config import settings
from .database import engine, get_db
from .models import *  # Import all models
from .models.telegram_user import TelegramUser  # Importar modelo do Telegram explicitamente
from .core.security import get_password_hash
from .api import auth, categorias, cartoes, contas, transacoes, faturas, planejamento, chat, telegram

# Criar tabelas
Base.metadata.create_all(bind=engine)

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
    db = next(get_db())
    
    # Verificar se admin já existe
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
        print(f"Admin user created: {settings.ADMIN_EMAIL}")
    
    db.close()

@app.get("/")
def read_root():
    return {"message": "FinançasAI API is running!"} 