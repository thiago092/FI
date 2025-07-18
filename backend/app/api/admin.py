from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, text, and_, or_
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging
import psutil
import os

from ..database import get_db
from ..models.user import User, Tenant
from ..models.telegram_user import TelegramUser
from ..models.financial import Transacao, Cartao, Conta, Categoria
from ..core.security import get_current_admin_user
from ..core.config import settings
from ..services.telegram_service import TelegramService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/dashboard/overview")
async def get_admin_overview(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obter visão geral do sistema para administradores"""
    try:
        # Contadores básicos
        total_users = db.query(User).count()
        total_tenants = db.query(Tenant).count()
        active_users = db.query(User).filter(User.is_active == True).count()
        active_tenants = db.query(Tenant).filter(Tenant.is_active == True).count()
        
        # Usuários por período
        hoje = datetime.now().date()
        ontem = hoje - timedelta(days=1)
        esta_semana = hoje - timedelta(days=7)
        este_mes = hoje.replace(day=1)
        
        usuarios_hoje = db.query(User).filter(
            func.date(User.created_at) == hoje
        ).count()
        
        usuarios_esta_semana = db.query(User).filter(
            User.created_at >= esta_semana
        ).count()
        
        usuarios_este_mes = db.query(User).filter(
            User.created_at >= este_mes
        ).count()
        
        # Telegram stats
        telegram_conectados = db.query(TelegramUser).filter(
            TelegramUser.is_authenticated == True
        ).count()
        
        telegram_pendentes = db.query(TelegramUser).filter(
            and_(
                TelegramUser.auth_code.isnot(None),
                TelegramUser.auth_code_expires > datetime.utcnow()
            )
        ).count()
        
        # Atividade recente (últimas 24h)
        atividade_24h = db.query(TelegramUser).filter(
            TelegramUser.last_interaction >= datetime.utcnow() - timedelta(hours=24)
        ).count()
        
        # Transações e dados financeiros
        total_transacoes = db.query(Transacao).count()
        transacoes_hoje = db.query(Transacao).filter(
            func.date(Transacao.data) == hoje
        ).count()
        
        # Volume financeiro total
        volume_total = db.query(func.sum(func.abs(Transacao.valor))).scalar() or 0
        
        # Performance do sistema
        system_info = get_system_performance()
        
        return {
            "users": {
                "total": total_users,
                "active": active_users,
                "hoje": usuarios_hoje,
                "esta_semana": usuarios_esta_semana,
                "este_mes": usuarios_este_mes,
                "growth_percentage": calculate_growth_percentage(usuarios_este_mes, total_users)
            },
            "tenants": {
                "total": total_tenants,
                "active": active_tenants,
                "ocupacao_percentage": round((active_tenants / total_tenants * 100) if total_tenants > 0 else 0, 1)
            },
            "telegram": {
                "conectados": telegram_conectados,
                "pendentes": telegram_pendentes,
                "atividade_24h": atividade_24h,
                "taxa_conexao": round((telegram_conectados / total_users * 100) if total_users > 0 else 0, 1)
            },
            "financeiro": {
                "total_transacoes": total_transacoes,
                "transacoes_hoje": transacoes_hoje,
                "volume_total": float(volume_total),
                "volume_formatado": f"R$ {volume_total:,.2f}" if volume_total > 0 else "Sem movimentação"
            },
            "sistema": system_info,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter overview admin: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.get("/users/detailed")
async def get_users_detailed(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    page: int = 1,
    per_page: int = 50
):
    """Obter lista detalhada de usuários com métricas"""
    try:
        offset = (page - 1) * per_page
        
        # Query principal com joins
        users_query = db.query(User).outerjoin(Tenant).outerjoin(TelegramUser)
        
        total_users = users_query.count()
        
        users = users_query.offset(offset).limit(per_page).all()
        
        users_detailed = []
        for user in users:
            # Contar transações do usuário
            transacoes_count = db.query(Transacao).filter(
                Transacao.tenant_id == user.tenant_id
            ).count() if user.tenant_id else 0
            
            # Volume financeiro
            volume_financeiro = db.query(func.sum(func.abs(Transacao.valor))).filter(
                Transacao.tenant_id == user.tenant_id
            ).scalar() or 0 if user.tenant_id else 0
            
            # Info do Telegram
            telegram_user = db.query(TelegramUser).filter(
                TelegramUser.user_id == user.id
            ).first()
            
            # Última atividade
            ultima_atividade = telegram_user.last_interaction if telegram_user else user.created_at
            
            users_detailed.append({
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "is_global_admin": user.is_global_admin,
                "created_at": user.created_at.isoformat(),
                "tenant": {
                    "id": user.tenant.id,
                    "name": user.tenant.name,
                    "subdomain": user.tenant.subdomain
                } if user.tenant else None,
                "telegram": {
                    "connected": telegram_user.is_authenticated if telegram_user else False,
                    "username": telegram_user.telegram_username if telegram_user else None,
                    "last_interaction": telegram_user.last_interaction.isoformat() if telegram_user and telegram_user.last_interaction else None
                },
                "metrics": {
                    "total_transacoes": transacoes_count,
                    "volume_financeiro": float(volume_financeiro),
                    "dias_desde_criacao": (datetime.utcnow() - user.created_at).days,
                    "ultima_atividade": ultima_atividade.isoformat() if ultima_atividade else None
                }
            })
        
        return {
            "users": users_detailed,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total_users,
                "pages": (total_users + per_page - 1) // per_page
            }
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter usuários detalhados: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Excluir usuário e todos os dados relacionados"""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado"
            )
        
        if user.is_global_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Não é possível excluir administradores globais"
            )
        
        # Contar dados que serão excluídos
        tenant_id = user.tenant_id
        dados_removidos = {
            "transacoes": 0,
            "cartoes": 0,
            "contas": 0,
            "categorias": 0,
            "telegram": 0
        }
        
        if tenant_id:
            dados_removidos["transacoes"] = db.query(Transacao).filter(Transacao.tenant_id == tenant_id).count()
            dados_removidos["cartoes"] = db.query(Cartao).filter(Cartao.tenant_id == tenant_id).count()
            dados_removidos["contas"] = db.query(Conta).filter(Conta.tenant_id == tenant_id).count()
            dados_removidos["categorias"] = db.query(Categoria).filter(Categoria.tenant_id == tenant_id).count()
        
        # Excluir dados do Telegram
        telegram_user = db.query(TelegramUser).filter(TelegramUser.user_id == user_id).first()
        if telegram_user:
            dados_removidos["telegram"] = 1
            db.delete(telegram_user)
        
        # Se for o único usuário do tenant, excluir todos os dados do tenant
        if tenant_id:
            outros_usuarios = db.query(User).filter(
                and_(User.tenant_id == tenant_id, User.id != user_id)
            ).count()
            
            if outros_usuarios == 0:
                # Excluir todos os dados do tenant
                db.query(Transacao).filter(Transacao.tenant_id == tenant_id).delete()
                db.query(Cartao).filter(Cartao.tenant_id == tenant_id).delete()
                db.query(Conta).filter(Conta.tenant_id == tenant_id).delete()
                db.query(Categoria).filter(Categoria.tenant_id == tenant_id).delete()
        
        # Excluir usuário
        db.delete(user)
        db.commit()
        
        logger.info(f"Admin {current_admin.email} excluiu usuário {user.email} (ID: {user_id})")
        
        return {
            "success": True,
            "message": f"Usuário {user.email} excluído com sucesso",
            "dados_removidos": dados_removidos
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao excluir usuário {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: int,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Excluir tenant e todos os dados relacionados"""
    try:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant não encontrado"
            )
        
        # Contar dados que serão excluídos
        dados_removidos = {
            "usuarios": db.query(User).filter(User.tenant_id == tenant_id).count(),
            "transacoes": db.query(Transacao).filter(Transacao.tenant_id == tenant_id).count(),
            "cartoes": db.query(Cartao).filter(Cartao.tenant_id == tenant_id).count(),
            "contas": db.query(Conta).filter(Conta.tenant_id == tenant_id).count(),
            "categorias": db.query(Categoria).filter(Categoria.tenant_id == tenant_id).count()
        }
        
        # Excluir dados do Telegram dos usuários do tenant
        usuarios_tenant = db.query(User).filter(User.tenant_id == tenant_id).all()
        for user in usuarios_tenant:
            telegram_user = db.query(TelegramUser).filter(TelegramUser.user_id == user.id).first()
            if telegram_user:
                db.delete(telegram_user)
        
        # Excluir todos os dados relacionados
        db.query(Transacao).filter(Transacao.tenant_id == tenant_id).delete()
        db.query(Cartao).filter(Cartao.tenant_id == tenant_id).delete()
        db.query(Conta).filter(Conta.tenant_id == tenant_id).delete()
        db.query(Categoria).filter(Categoria.tenant_id == tenant_id).delete()
        
        # Excluir usuários
        db.query(User).filter(User.tenant_id == tenant_id).delete()
        
        # Excluir tenant
        db.delete(tenant)
        db.commit()
        
        logger.info(f"Admin {current_admin.email} excluiu tenant {tenant.name} (ID: {tenant_id})")
        
        return {
            "success": True,
            "message": f"Tenant {tenant.name} excluído com sucesso",
            "dados_removidos": dados_removidos
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao excluir tenant {tenant_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.get("/metrics/tokens")
async def get_token_metrics(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obter métricas de uso de tokens da OpenAI"""
    try:
        # Esta é uma estimativa baseada na atividade
        # Em uma implementação real, você salvaria os logs de uso
        
        hoje = datetime.now().date()
        esta_semana = hoje - timedelta(days=7)
        este_mes = hoje.replace(day=1)
        
        # Contar atividades que usam tokens
        telegram_atividades = db.query(TelegramUser).filter(
            TelegramUser.last_interaction >= este_mes
        ).count()
        
        # Estimativa de tokens (valores aproximados)
        # Cada interação de áudio ≈ 100-500 tokens
        # Cada interação de texto ≈ 50-200 tokens
        # Cada imagem ≈ 300-800 tokens
        
        estimativa_tokens_mes = telegram_atividades * 300  # Média aproximada
        
        # Calcular custo usando preços reais do GPT Batch API
        # Input: $0.15 per 1M tokens, Output: $0.60 per 1M tokens
        # Assumindo proporção 60% input, 40% output
        input_tokens = estimativa_tokens_mes * 0.6
        output_tokens = estimativa_tokens_mes * 0.4
        
        custo_input = (input_tokens / 1_000_000) * 0.15  # $0.15 per 1M tokens
        custo_output = (output_tokens / 1_000_000) * 0.60  # $0.60 per 1M tokens
        custo_total_usd = custo_input + custo_output
        
        return {
            "periodo": "este_mes",
            "atividades_telegram": telegram_atividades,
            "estimativa_tokens": estimativa_tokens_mes,
            "input_tokens": int(input_tokens),
            "output_tokens": int(output_tokens),
            "custo_input_usd": round(custo_input, 4),
            "custo_output_usd": round(custo_output, 4),
            "custo_estimado_usd": round(custo_total_usd, 2),
            "custo_estimado_brl": round(custo_total_usd * 5.5, 2),  # Aproximação
            "tokens_por_dia": round(estimativa_tokens_mes / 30, 0),
            "preco_por_1m_input": "$0.15",
            "preco_por_1m_output": "$0.60",
            "observacao": "Valores baseados em GPT Batch API: Input $0.15/1M, Output $0.60/1M tokens. Proporção estimada 60% input, 40% output."
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter métricas de tokens: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.get("/metrics/performance")
async def get_performance_metrics(
    current_admin: User = Depends(get_current_admin_user)
):
    """Obter métricas de performance do sistema"""
    try:
        return get_system_performance()
        
    except Exception as e:
        logger.error(f"Erro ao obter métricas de performance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

def get_system_performance() -> Dict[str, Any]:
    """Obter informações de performance do sistema"""
    try:
        # Verificar se está rodando no Azure
        is_azure = os.environ.get('WEBSITE_SITE_NAME') is not None
        
        if is_azure:
            # Versão simplificada para Azure
            try:
                cpu_percent = psutil.cpu_percent(interval=0.1)
                cpu_count = psutil.cpu_count()
                memory = psutil.virtual_memory()
                
                return {
                    "cpu": {
                        "percent": round(cpu_percent, 1),
                        "cores": cpu_count,
                        "status": "normal" if cpu_percent < 80 else "alto"
                    },
                    "memory": {
                        "percent": round(memory.percent, 1),
                        "used_gb": round(memory.used / (1024**3), 2),
                        "total_gb": round(memory.total / (1024**3), 2),
                        "available_gb": round((memory.total - memory.used) / (1024**3), 2),
                        "status": "normal" if memory.percent < 85 else "alto"
                    },
                    "disk": {
                        "percent": 0,
                        "used_gb": 0,
                        "total_gb": 0,
                        "available_gb": 0,
                        "status": "unknown"
                    },
                    "process": {
                        "memory_mb": 0,
                        "pid": 0
                    },
                    "status_geral": "healthy"
                }
            except Exception:
                return {
                    "cpu": {"percent": 0, "cores": 0, "status": "unknown"},
                    "memory": {"percent": 0, "used_gb": 0, "total_gb": 0, "status": "unknown"},
                    "disk": {"percent": 0, "used_gb": 0, "total_gb": 0, "status": "unknown"},
                    "process": {"memory_mb": 0, "pid": 0},
                    "status_geral": "unknown"
                }
        
        # CPU
        try:
            cpu_percent = psutil.cpu_percent(interval=0.5)  # Reduzir tempo de espera
            cpu_count = psutil.cpu_count()
        except Exception:
            cpu_percent = 0
            cpu_count = 0
        
        # Memória
        try:
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            memory_used_gb = memory.used / (1024**3)
            memory_total_gb = memory.total / (1024**3)
        except Exception:
            memory_percent = 0
            memory_used_gb = 0
            memory_total_gb = 0
        
        # Disco - compatível com Windows Azure
        try:
            import platform
            if platform.system().lower() == 'windows':
                disk = psutil.disk_usage('C:')
            else:
                disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            disk_used_gb = disk.used / (1024**3)
            disk_total_gb = disk.total / (1024**3)
        except Exception:
            disk_percent = 0
            disk_used_gb = 0
            disk_total_gb = 0
        
        # Processo atual
        try:
            process = psutil.Process()
            process_memory = process.memory_info().rss / (1024**2)  # MB
            process_pid = process.pid
        except Exception:
            process_memory = 0
            process_pid = 0
        
        return {
            "cpu": {
                "percent": round(cpu_percent, 1),
                "cores": cpu_count,
                "status": "normal" if cpu_percent < 80 else "alto"
            },
            "memory": {
                "percent": round(memory_percent, 1),
                "used_gb": round(memory_used_gb, 2),
                "total_gb": round(memory_total_gb, 2),
                "available_gb": round(memory_total_gb - memory_used_gb, 2),
                "status": "normal" if memory_percent < 85 else "alto"
            },
            "disk": {
                "percent": round(disk_percent, 1),
                "used_gb": round(disk_used_gb, 2),
                "total_gb": round(disk_total_gb, 2),
                "available_gb": round(disk_total_gb - disk_used_gb, 2),
                "status": "normal" if disk_percent < 90 else "alto"
            },
            "process": {
                "memory_mb": round(process_memory, 1),
                "pid": process_pid
            },
            "status_geral": "healthy" if cpu_percent < 80 and memory_percent < 85 and disk_percent < 90 else "warning"
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter performance: {e}")
        return {
            "cpu": {"percent": 0, "cores": 0, "status": "unknown"},
            "memory": {"percent": 0, "used_gb": 0, "total_gb": 0, "status": "unknown"},
            "disk": {"percent": 0, "used_gb": 0, "total_gb": 0, "status": "unknown"},
            "process": {"memory_mb": 0, "pid": 0},
            "status_geral": "unknown"
        }

def calculate_growth_percentage(current: int, total: int) -> float:
    """Calcular percentual de crescimento"""
    if total == 0:
        return 0.0
    return round((current / total) * 100, 1)

@router.post("/telegram/broadcast")
async def send_broadcast_message(
    message_data: dict,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Enviar mensagem broadcast para usuários conectados ao Telegram"""
    try:
        message = message_data.get("message", "").strip()
        target_type = message_data.get("target_type", "all")  # all, active, specific
        target_users = message_data.get("target_users", [])  # Lista de user_ids para target_type=specific
        
        if not message:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mensagem não pode estar vazia"
            )
        
        # Obter usuários conectados ao Telegram baseado no target_type
        query = db.query(TelegramUser).filter(
            TelegramUser.is_authenticated == True
        )
        
        if target_type == "active":
            # Apenas usuários ativos nas últimas 24 horas
            last_24h = datetime.utcnow() - timedelta(hours=24)
            query = query.filter(TelegramUser.last_interaction >= last_24h)
        elif target_type == "specific" and target_users:
            # Apenas usuários específicos
            query = query.filter(TelegramUser.user_id.in_(target_users))
        
        telegram_users = query.all()
        
        if not telegram_users:
            return {
                "success": False,
                "message": "Nenhum usuário conectado encontrado para enviar a mensagem",
                "enviadas": 0,
                "falharam": 0
            }
        
        # Preparar mensagem com cabeçalho administrativo
        admin_message = f"""🔔 **Mensagem da Administração - FinançasAI**

{message}

---
_Data: {datetime.now().strftime('%d/%m/%Y às %H:%M')}_"""
        
        # Inicializar serviço do Telegram
        telegram_service = TelegramService()
        
        # Enviar mensagens
        enviadas = 0
        falharam = 0
        
        for telegram_user in telegram_users:
            try:
                success = await telegram_service.send_message(
                    telegram_user.telegram_id, 
                    admin_message
                )
                if success:
                    enviadas += 1
                else:
                    falharam += 1
            except Exception as e:
                logger.error(f"Erro ao enviar mensagem para {telegram_user.telegram_id}: {e}")
                falharam += 1
        
        # Log da ação
        logger.info(f"Admin {current_admin.email} enviou broadcast: {enviadas} enviadas, {falharam} falharam")
        
        return {
            "success": True,
            "message": f"Mensagem broadcast enviada com sucesso",
            "enviadas": enviadas,
            "falharam": falharam,
            "total_usuarios": len(telegram_users)
        }
        
    except Exception as e:
        logger.error(f"Erro ao enviar broadcast: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.get("/telegram/users")
async def get_telegram_users(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obter lista de usuários conectados ao Telegram para seleção"""
    try:
        telegram_users = db.query(TelegramUser).join(User).filter(
            TelegramUser.is_authenticated == True
        ).all()
        
        users_list = []
        for telegram_user in telegram_users:
            user = db.query(User).filter(User.id == telegram_user.user_id).first()
            if user:
                # Verificar última atividade
                last_activity = telegram_user.last_interaction
                is_recent = False
                if last_activity:
                    is_recent = (datetime.utcnow() - last_activity).days < 7
                
                users_list.append({
                    "user_id": user.id,
                    "full_name": user.full_name,
                    "email": user.email,
                    "telegram_username": telegram_user.telegram_username,
                    "telegram_first_name": telegram_user.telegram_first_name,
                    "last_interaction": last_activity.isoformat() if last_activity else None,
                    "is_recent_active": is_recent,
                    "days_since_last_activity": (datetime.utcnow() - last_activity).days if last_activity else None
                })
        
        return {
            "users": users_list,
            "total": len(users_list),
            "active_24h": len([u for u in users_list if u.get("days_since_last_activity", float('inf')) < 1]),
            "active_week": len([u for u in users_list if u.get("is_recent_active", False)])
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter usuários do Telegram: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )

@router.post("/migrar-tabelas-parcelamento")
async def migrar_tabelas_parcelamento(
    db: Session = Depends(get_db)
):
    """ENDPOINT TEMPORÁRIO - Cria tabelas de parcelamento se não existirem"""
    try:
        comandos_sql = [
            # Criar tabela compras_parceladas com IF NOT EXISTS
            """
            CREATE TABLE IF NOT EXISTS compras_parceladas (
                id SERIAL PRIMARY KEY,
                descricao VARCHAR NOT NULL,
                valor_total FLOAT NOT NULL,
                total_parcelas INTEGER NOT NULL,
                valor_parcela FLOAT NOT NULL,
                cartao_id INTEGER NOT NULL REFERENCES cartoes(id),
                data_primeira_parcela DATE NOT NULL,
                ativa BOOLEAN DEFAULT TRUE,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """,
            
            # Criar tabela parcelas_cartao com IF NOT EXISTS
            """
            CREATE TABLE IF NOT EXISTS parcelas_cartao (
                id SERIAL PRIMARY KEY,
                compra_parcelada_id INTEGER NOT NULL REFERENCES compras_parceladas(id),
                numero_parcela INTEGER NOT NULL,
                valor_parcela FLOAT NOT NULL,
                data_vencimento DATE NOT NULL,
                paga BOOLEAN DEFAULT FALSE,
                data_pagamento DATE,
                transacao_id INTEGER REFERENCES transacoes(id),
                tenant_id INTEGER NOT NULL REFERENCES tenants(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """,
            
            # Índices para performance
            "CREATE INDEX IF NOT EXISTS idx_compras_parceladas_cartao ON compras_parceladas(cartao_id);",
            "CREATE INDEX IF NOT EXISTS idx_compras_parceladas_tenant ON compras_parceladas(tenant_id);",
            "CREATE INDEX IF NOT EXISTS idx_parcelas_cartao_compra ON parcelas_cartao(compra_parcelada_id);",
            "CREATE INDEX IF NOT EXISTS idx_parcelas_cartao_tenant ON parcelas_cartao(tenant_id);"
        ]
        
        resultados = []
        for comando in comandos_sql:
            try:
                db.execute(text(comando.strip()))
                db.commit()
                resultados.append("✅ CREATE TABLE executado")
            except Exception as e:
                if "already exists" in str(e).lower():
                    resultados.append("⚠️ Tabela já existe")
                else:
                    logger.error(f"Erro SQL: {e}")
                    resultados.append(f"❌ Erro: {str(e)[:100]}")
        
        # Verificar se tabelas existem
        tabelas_existentes = []
        for tabela in ["compras_parceladas", "parcelas_cartao"]:
            try:
                resultado = db.execute(text(f"SELECT COUNT(*) FROM {tabela}")).fetchone()
                tabelas_existentes.append(tabela)
            except:
                pass
        
        return {
            "message": "Migração de tabelas de parcelamento concluída",
            "resultados": resultados,
            "tabelas_verificadas": tabelas_existentes
        }
        
    except Exception as e:
        logger.error(f"Erro na migração: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro na migração: {str(e)}"
        )

@router.post("/verificar-estrutura-tabelas")
async def verificar_estrutura_tabelas(db: Session = Depends(get_db)):
    """ENDPOINT TEMPORÁRIO - Verificar estrutura real das tabelas no banco"""
    try:
        # Verificar qual banco está sendo usado
        db_info = db.execute(text("SELECT version()")).fetchone()
        db_version = db_info[0] if db_info else "Desconhecido"
        
        # Verificar URL do banco (mascarar senha)
        db_url = str(db.get_bind().url).replace(str(db.get_bind().url.password), "***") if db.get_bind().url.password else str(db.get_bind().url)
        
        # Verificar estrutura da tabela compras_parceladas
        result_compras = db.execute(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'compras_parceladas' 
            ORDER BY ordinal_position;
        """)).fetchall()
        
        # Verificar estrutura da tabela parcelas_cartao
        result_parcelas = db.execute(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'parcelas_cartao' 
            ORDER BY ordinal_position;
        """)).fetchall()
        
        # Verificar se tabelas existem
        result_tables = db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name IN ('compras_parceladas', 'parcelas_cartao')
              AND table_type = 'BASE TABLE';
        """)).fetchall()
        
        # Verificar todas as tabelas do schema
        all_tables = db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)).fetchall()
        
        return {
            "database_info": {
                "version": db_version,
                "url": db_url,
                "dialect": str(db.get_bind().dialect.name)
            },
            "todas_tabelas": [row[0] for row in all_tables],
            "tabelas_parcelamento_existentes": [row[0] for row in result_tables],
            "estrutura_compras_parceladas": [
                {
                    "column_name": row[0],
                    "data_type": row[1], 
                    "is_nullable": row[2],
                    "column_default": row[3]
                } 
                for row in result_compras
            ],
            "estrutura_parcelas_cartao": [
                {
                    "column_name": row[0],
                    "data_type": row[1],
                    "is_nullable": row[2], 
                    "column_default": row[3]
                }
                for row in result_parcelas
            ]
        }
        
    except Exception as e:
        logger.error(f"Erro ao verificar estrutura: {e}")
        # Se falhou com information_schema (SQLite não suporta), tentar alternativa
        try:
            # Alternativa para SQLite
            result_pragmas_compras = db.execute(text("PRAGMA table_info(compras_parceladas)")).fetchall()
            result_pragmas_parcelas = db.execute(text("PRAGMA table_info(parcelas_cartao)")).fetchall()
            
            return {
                "database_info": {
                    "version": "SQLite (PRAGMA fallback)",
                    "url": str(db.get_bind().url),
                    "dialect": str(db.get_bind().dialect.name)
                },
                "estrutura_compras_parceladas_sqlite": [
                    {
                        "cid": row[0],
                        "name": row[1],
                        "type": row[2],
                        "notnull": row[3],
                        "dflt_value": row[4],
                        "pk": row[5]
                    }
                    for row in result_pragmas_compras
                ],
                "estrutura_parcelas_cartao_sqlite": [
                    {
                        "cid": row[0], 
                        "name": row[1],
                        "type": row[2],
                        "notnull": row[3],
                        "dflt_value": row[4],
                        "pk": row[5]
                    }
                    for row in result_pragmas_parcelas
                ]
            }
        except Exception as e2:
            raise HTTPException(
                status_code=500,
                detail=f"Erro PostgreSQL: {str(e)} | Erro SQLite: {str(e2)}"
            )

@router.post("/diagnostico-banco-completo")
async def diagnostico_banco_completo(db: Session = Depends(get_db)):
    """ENDPOINT TEMPORÁRIO - Diagnóstico completo do banco de dados"""
    try:
        from ..core.config import settings
        import platform
        
        # Informações do ambiente
        ambiente_info = {
            "sistema_operacional": platform.system(),
            "python_version": platform.python_version(),
            "ambiente": "Azure" if os.environ.get('WEBSITE_SITE_NAME') else "Local"
        }
        
        # Informações das configurações
        config_info = {
            "DATABASE_URL": settings.DATABASE_URL.replace(settings.AZURE_POSTGRESQL_PASSWORD or "", "***") if hasattr(settings, 'AZURE_POSTGRESQL_PASSWORD') and settings.AZURE_POSTGRESQL_PASSWORD else settings.DATABASE_URL,
            "has_azure_postgresql_host": bool(settings.AZURE_POSTGRESQL_HOST),
            "azure_postgresql_host": settings.AZURE_POSTGRESQL_HOST[:20] + "..." if settings.AZURE_POSTGRESQL_HOST else None,
            "azure_postgresql_database": settings.AZURE_POSTGRESQL_DATABASE,
            "azure_postgresql_username": settings.AZURE_POSTGRESQL_USERNAME,
            "database_url_from_method": settings.get_database_url().replace(settings.AZURE_POSTGRESQL_PASSWORD or "", "***") if hasattr(settings, 'AZURE_POSTGRESQL_PASSWORD') and settings.AZURE_POSTGRESQL_PASSWORD else settings.get_database_url()
        }
        
        # Informações do banco atual
        try:
            db_version = db.execute(text("SELECT version()")).fetchone()[0]
            db_dialect = str(db.get_bind().dialect.name)
            db_url = str(db.get_bind().url)
            
            # Mascarar senha na URL
            if "@" in db_url and ":" in db_url:
                parts = db_url.split("@")
                if len(parts) > 1:
                    auth_part = parts[0]
                    if ":" in auth_part:
                        user_pass = auth_part.split(":")
                        if len(user_pass) >= 3:  # protocolo:usuario:senha
                            user_pass[-1] = "***"
                            parts[0] = ":".join(user_pass)
                            db_url = "@".join(parts)
            
            database_info = {
                "version": db_version,
                "dialect": db_dialect,
                "url": db_url,
                "is_postgresql": "postgresql" in db_dialect.lower() or "PostgreSQL" in db_version,
                "is_sqlite": "sqlite" in db_dialect.lower() or "SQLite" in db_version
            }
        except Exception as e:
            database_info = {"error": str(e)}
        
        # Verificar tabelas existentes
        try:
            if database_info.get("is_postgresql", False):
                # PostgreSQL
                all_tables = db.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                    ORDER BY table_name;
                """)).fetchall()
                
                # Verificar estrutura das tabelas de parcelamento
                compras_cols = db.execute(text("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'compras_parceladas' 
                    ORDER BY ordinal_position;
                """)).fetchall()
                
                parcelas_cols = db.execute(text("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'parcelas_cartao' 
                    ORDER BY ordinal_position;
                """)).fetchall()
                
            else:
                # SQLite
                all_tables_result = db.execute(text("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name NOT LIKE 'sqlite_%' 
                    ORDER BY name;
                """)).fetchall()
                all_tables = [(row[0],) for row in all_tables_result]
                
                # Verificar estrutura das tabelas
                try:
                    compras_cols = db.execute(text("PRAGMA table_info(compras_parceladas)")).fetchall()
                    compras_cols = [(row[1], row[2]) for row in compras_cols]  # nome, tipo
                except:
                    compras_cols = []
                
                try:
                    parcelas_cols = db.execute(text("PRAGMA table_info(parcelas_cartao)")).fetchall()
                    parcelas_cols = [(row[1], row[2]) for row in parcelas_cols]  # nome, tipo
                except:
                    parcelas_cols = []
            
            tabelas_info = {
                "todas_tabelas": [row[0] for row in all_tables],
                "compras_parceladas_exists": any("compras_parceladas" in str(row) for row in all_tables),
                "parcelas_cartao_exists": any("parcelas_cartao" in str(row) for row in all_tables),
                "compras_parceladas_columns": [{"name": row[0], "type": row[1]} for row in compras_cols],
                "parcelas_cartao_columns": [{"name": row[0], "type": row[1]} for row in parcelas_cols]
            }
            
        except Exception as e:
            tabelas_info = {"error": str(e)}
        
        # Verificar arquivos SQLite locais
        arquivos_sqlite = []
        try:
            import glob
            sqlite_files = glob.glob("*.db") + glob.glob("**/*.db", recursive=True)
            for file in sqlite_files:
                try:
                    size = os.path.getsize(file)
                    arquivos_sqlite.append({"file": file, "size_bytes": size})
                except:
                    pass
        except:
            pass
        
        return {
            "ambiente": ambiente_info,
            "configuracoes": config_info,
            "banco_atual": database_info,
            "tabelas": tabelas_info,
            "arquivos_sqlite_locais": arquivos_sqlite,
            "recomendacoes": {
                "deve_usar_postgresql": ambiente_info["ambiente"] == "Azure",
                "conflito_detectado": database_info.get("is_sqlite", False) and config_info["has_azure_postgresql_host"],
                "tabelas_parcelamento_ok": tabelas_info.get("compras_parceladas_exists", False) and tabelas_info.get("parcelas_cartao_exists", False)
            }
        }
        
    except Exception as e:
        logger.error(f"Erro no diagnóstico completo: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro no diagnóstico: {str(e)}"
        )

@router.post("/migrar-colunas-parcelamento")
async def migrar_colunas_parcelamento(db: Session = Depends(get_db)):
    """ENDPOINT TEMPORÁRIO - Migrar colunas das tabelas de parcelamento para formato correto"""
    try:
        comandos_sql = [
            # Alterar tabela compras_parceladas - renomear e adicionar colunas
            "ALTER TABLE compras_parceladas RENAME COLUMN numero_parcelas TO total_parcelas;",
            "ALTER TABLE compras_parceladas RENAME COLUMN data_compra TO data_primeira_parcela;",
            "ALTER TABLE compras_parceladas DROP COLUMN IF EXISTS categoria_id;",
            "ALTER TABLE compras_parceladas DROP COLUMN IF EXISTS status;", 
            "ALTER TABLE compras_parceladas DROP COLUMN IF EXISTS parcelas_pagas;",
            "ALTER TABLE compras_parceladas ADD COLUMN IF NOT EXISTS ativa BOOLEAN DEFAULT TRUE;",
            
            # Alterar tabela parcelas_cartao - renomear colunas
            "ALTER TABLE parcelas_cartao RENAME COLUMN parcela_processada TO paga;",
            "ALTER TABLE parcelas_cartao ADD COLUMN IF NOT EXISTS data_pagamento DATE;",
            "ALTER TABLE parcelas_cartao ADD COLUMN IF NOT EXISTS compra_parcelada_id INTEGER;",
            
            # Atualizar foreign key se necessário
            "UPDATE parcelas_cartao SET compra_parcelada_id = transacao_id WHERE compra_parcelada_id IS NULL;",
        ]
        
        resultados = []
        for comando in comandos_sql:
            try:
                db.execute(text(comando.strip()))
                db.commit()
                resultados.append(f"✅ {comando[:50]}...")
            except Exception as e:
                error_msg = str(e).lower()
                if "does not exist" in error_msg or "already exists" in error_msg:
                    resultados.append(f"⚠️ {comando[:50]}... (já existe/não existe)")
                else:
                    logger.error(f"Erro SQL: {e}")
                    resultados.append(f"❌ {comando[:50]}... ERRO: {str(e)[:100]}")
        
        # Verificar estrutura final
        try:
            compras_cols = db.execute(text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'compras_parceladas' 
                ORDER BY ordinal_position;
            """)).fetchall()
            
            parcelas_cols = db.execute(text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'parcelas_cartao' 
                ORDER BY ordinal_position;
            """)).fetchall()
            
            estrutura_final = {
                "compras_parceladas": [{"name": row[0], "type": row[1]} for row in compras_cols],
                "parcelas_cartao": [{"name": row[0], "type": row[1]} for row in parcelas_cols]
            }
        except Exception as e:
            estrutura_final = {"error": str(e)}
        
        return {
            "message": "Migração de colunas concluída",
            "resultados": resultados,
            "estrutura_final": estrutura_final
        }
        
    except Exception as e:
        logger.error(f"Erro na migração de colunas: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro na migração: {str(e)}"
        )

# Fim do arquivo - rotas de migração removidas por segurança 