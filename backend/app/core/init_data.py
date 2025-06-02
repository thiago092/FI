"""
Módulo para inicialização de dados básicos da aplicação
"""
from sqlalchemy.orm import Session
from ..models.financial import Categoria
from ..models.user import Tenant
import logging

logger = logging.getLogger(__name__)

def create_default_categories(db: Session, tenant_id: int = None) -> None:
    """Criar categorias padrão para o sistema"""
    
    default_categories = [
        {"nome": "Alimentação", "cor": "#FF6B6B", "icone": "🍽️"},
        {"nome": "Transporte", "cor": "#4ECDC4", "icone": "🚗"},
        {"nome": "Moradia", "cor": "#45B7D1", "icone": "🏠"},
        {"nome": "Saúde", "cor": "#96CEB4", "icone": "🏥"},
        {"nome": "Educação", "cor": "#FFEAA7", "icone": "📚"},
        {"nome": "Lazer", "cor": "#DDA0DD", "icone": "🎮"},
        {"nome": "Vestuário", "cor": "#98D8C8", "icone": "👕"},
        {"nome": "Serviços", "cor": "#F7DC6F", "icone": "🔧"},
        {"nome": "Investimentos", "cor": "#85C1E9", "icone": "📈"},
        {"nome": "Outros", "cor": "#D5DBDB", "icone": "📦"},
        {"nome": "Salário", "cor": "#58D68D", "icone": "💰"},
        {"nome": "Freelance", "cor": "#F8C471", "icone": "💼"},
        {"nome": "Vendas", "cor": "#BB8FCE", "icone": "💵"},
    ]
    
    try:
        # Create default tenant if none exists
        if not tenant_id:
            default_tenant = db.query(Tenant).first()
            if not default_tenant:
                default_tenant = Tenant(
                    name="Sistema",
                    subdomain="sistema",
                    is_active=True
                )
                db.add(default_tenant)
                db.commit()
                db.refresh(default_tenant)
            tenant_id = default_tenant.id
        
        # Check if categories already exist
        existing_categories = db.query(Categoria).filter(Categoria.tenant_id == tenant_id).count()
        
        if existing_categories == 0:
            logger.info("Creating default categories...")
            
            for cat_data in default_categories:
                categoria = Categoria(
                    nome=cat_data["nome"],
                    cor=cat_data["cor"],
                    icone=cat_data["icone"],
                    tenant_id=tenant_id
                )
                db.add(categoria)
            
            db.commit()
            logger.info(f"✅ Created {len(default_categories)} default categories")
        else:
            logger.info("✅ Categories already exist, skipping creation")
            
    except Exception as e:
        logger.error(f"❌ Error creating default categories: {e}")
        db.rollback()

def initialize_basic_data(db: Session) -> None:
    """Inicializar todos os dados básicos necessários"""
    try:
        create_default_categories(db)
        logger.info("✅ Basic data initialization completed")
    except Exception as e:
        logger.error(f"❌ Basic data initialization failed: {e}") 