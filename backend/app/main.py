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
from .api import auth, categorias, cartoes, contas, transacoes, faturas, planejamento, chat, telegram, admin, dashboard, users, parcelas, migration, assistente_planejamento, transacoes_recorrentes

app = FastAPI(
    title="FinançasAI API", 
    version="1.0.0",
    description="API de gestão financeira pessoal com IA"
)



# CORS middleware - Enhanced for Azure production
logger.info(f"🌐 CORS origins configured: {settings.BACKEND_CORS_ORIGINS}")

# CORS middleware - Configuração específica para Azure
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://jolly-bay-0a0f6890f.6.azurestaticapps.net", 
        "https://jolly-bay-0a0f6890f.azurestaticapps.net",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost",
        "*"  # Mantém compatibilidade com outros ambientes
    ],
    allow_credentials=True,  # Permite credenciais
    allow_methods=["*"],  # Permite todos os métodos
    allow_headers=["*"],  # Permite todos os headers
    max_age=86400,
)



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
        "cors_origins": settings.BACKEND_CORS_ORIGINS,
        "message": "CORS configuration active"
    }

@app.get("/test-resumo", include_in_schema=False)
async def test_resumo():
    """Endpoint de teste para resumo de transações recorrentes"""
    # Adicionar headers CORS explícitos
    response = JSONResponse(content={
        "total_transacoes": 5,
        "ativas": 4,
        "inativas": 1,
        "valor_mes_entradas": 3000.0,
        "valor_mes_saidas": 1500.0,
        "saldo_mes_estimado": 1500.0,
        "mes_referencia": date.today().month,
        "ano_referencia": date.today().year
    })
    
    # Adicionar headers CORS explícitos
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    return response

# Endpoint para obter detalhes de transação recorrente com CORS explícito
@app.get("/transacao-recorrente/{transacao_id}", include_in_schema=False)
async def get_transacao_recorrente_cors(transacao_id: int, db: Session = Depends(get_db)):
    """Endpoint com CORS explícito para obter detalhes de uma transação recorrente"""
    from app.models.transacao_recorrente import TransacaoRecorrente
    from datetime import datetime
    
    try:
        # Buscar a transação no banco de dados
        transacao = db.query(TransacaoRecorrente).filter(
            TransacaoRecorrente.id == transacao_id
        ).first()
        
        if not transacao:
            content = {"detail": "Transação recorrente não encontrada"}
            response = JSONResponse(content=content, status_code=404)
        else:
            # Converter para dicionário e serializar datas
            result = {
                "id": transacao.id,
                "descricao": transacao.descricao,
                "valor": float(transacao.valor),
                "tipo": transacao.tipo,
                "categoria_id": transacao.categoria_id,
                "conta_id": transacao.conta_id,
                "cartao_id": transacao.cartao_id,
                "frequencia": transacao.frequencia,
                "data_inicio": transacao.data_inicio.isoformat() if transacao.data_inicio else None,
                "data_fim": transacao.data_fim.isoformat() if transacao.data_fim else None,
                "ativa": transacao.ativa,
                "tenant_id": transacao.tenant_id,
                "created_at": transacao.created_at.isoformat() if transacao.created_at else None,
                "updated_at": transacao.updated_at.isoformat() if transacao.updated_at else None
            }
            response = JSONResponse(content=result)
    except Exception as e:
        content = {"detail": f"Erro ao buscar transação: {str(e)}"}
        response = JSONResponse(content=content, status_code=500)
    
    # Adicionar headers CORS explícitos
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    return response

# Endpoint para atualizar transação recorrente com CORS explícito
@app.put("/transacao-recorrente/{transacao_id}", include_in_schema=False)
async def update_transacao_recorrente_cors(
    transacao_id: int, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Endpoint com CORS explícito para atualizar uma transação recorrente"""
    from app.models.transacao_recorrente import TransacaoRecorrente
    from datetime import datetime
    import json
    
    # Configurar resposta CORS para preflight
    if request.method == "OPTIONS":
        response = JSONResponse(content={})
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "PUT, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response
    
    try:
        # Obter dados do corpo da requisição
        body_bytes = await request.body()
        body_str = body_bytes.decode('utf-8')
        data = json.loads(body_str)
        
        # Buscar a transação no banco de dados
        transacao = db.query(TransacaoRecorrente).filter(
            TransacaoRecorrente.id == transacao_id
        ).first()
        
        if not transacao:
            content = {"detail": "Transação recorrente não encontrada"}
            response = JSONResponse(content=content, status_code=404)
        else:
            # Atualizar campos fornecidos
            if "descricao" in data:
                transacao.descricao = data["descricao"]
            if "valor" in data:
                transacao.valor = data["valor"]
            if "tipo" in data:
                transacao.tipo = data["tipo"]
            if "categoria_id" in data:
                transacao.categoria_id = data["categoria_id"]
            if "conta_id" in data:
                transacao.conta_id = data["conta_id"]
            if "cartao_id" in data:
                transacao.cartao_id = data["cartao_id"]
            if "frequencia" in data:
                transacao.frequencia = data["frequencia"]
            if "data_inicio" in data and data["data_inicio"]:
                from datetime import date
                try:
                    transacao.data_inicio = date.fromisoformat(data["data_inicio"].split('T')[0])
                except:
                    pass
            if "data_fim" in data:
                if data["data_fim"]:
                    from datetime import date
                    try:
                        transacao.data_fim = date.fromisoformat(data["data_fim"].split('T')[0])
                    except:
                        pass
                else:
                    transacao.data_fim = None
            if "ativa" in data:
                transacao.ativa = data["ativa"]
            
            transacao.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(transacao)
            
            # Retorno compatível com PostgreSQL types
            result = {
                "id": int(transacao.id),
                "descricao": str(transacao.descricao),
                "valor": float(transacao.valor) if transacao.valor is not None else 0.0,
                "tipo": str(transacao.tipo),
                "categoria_id": int(transacao.categoria_id),
                "conta_id": int(transacao.conta_id) if transacao.conta_id is not None else None,
                "cartao_id": int(transacao.cartao_id) if transacao.cartao_id is not None else None,
                "frequencia": str(transacao.frequencia),
                "data_inicio": transacao.data_inicio.isoformat() if transacao.data_inicio else None,
                "data_fim": transacao.data_fim.isoformat() if transacao.data_fim else None,
                "ativa": bool(transacao.ativa) if transacao.ativa is not None else True,
                "tenant_id": int(transacao.tenant_id),
                "created_at": transacao.created_at.isoformat() if transacao.created_at else None,
                "updated_at": transacao.updated_at.isoformat() if transacao.updated_at else None
            }
            response = JSONResponse(content=result)
    except Exception as e:
        content = {"detail": f"Erro ao atualizar transação: {str(e)}"}
        response = JSONResponse(content=content, status_code=500)
    
    # Adicionar headers CORS explícitos
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "PUT, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    return response

 