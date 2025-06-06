from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date
from ..database import get_db
import logging

router = APIRouter()

logger = logging.getLogger(__name__)

@router.post("/add-dia-fechamento")
async def add_dia_fechamento_column(db: Session = Depends(get_db)):
    """
    Endpoint de migração para adicionar campo dia_fechamento na tabela cartoes
    Deve ser chamado UMA VEZ após o deploy
    """
    try:
        # Verificar se a coluna já existe
        check_column_query = text("""
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = 'cartoes' 
            AND column_name = 'dia_fechamento'
        """)
        
        result = db.execute(check_column_query).scalar()
        
        if result > 0:
            return {
                "status": "success",
                "message": "Coluna dia_fechamento já existe na tabela cartoes",
                "already_exists": True
            }
        
        # Adicionar a coluna
        add_column_query = text("""
            ALTER TABLE cartoes 
            ADD COLUMN dia_fechamento INTEGER NULL
        """)
        
        db.execute(add_column_query)
        db.commit()
        
        logger.info("Coluna dia_fechamento adicionada com sucesso à tabela cartoes")
        
        return {
            "status": "success", 
            "message": "Coluna dia_fechamento adicionada com sucesso à tabela cartoes",
            "migration_applied": True
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao adicionar coluna dia_fechamento: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao executar migração: {str(e)}"
        )

@router.post("/update-cartoes-dia-fechamento")
async def update_cartoes_dia_fechamento(db: Session = Depends(get_db)):
    """
    Endpoint para atualizar cartões existentes com dia_fechamento baseado no vencimento
    Por padrão: dia_fechamento = vencimento - 5 dias (ou 25 se < 5)
    """
    try:
        # Atualizar cartões que não têm dia_fechamento definido
        update_query = text("""
            UPDATE cartoes 
            SET dia_fechamento = CASE 
                WHEN vencimento > 5 THEN vencimento - 5
                ELSE 25
            END
            WHERE dia_fechamento IS NULL AND vencimento IS NOT NULL
        """)
        
        result = db.execute(update_query)
        db.commit()
        
        rows_affected = result.rowcount
        
        logger.info(f"Atualizados {rows_affected} cartões com dia_fechamento padrão")
        
        return {
            "status": "success",
            "message": f"Atualizados {rows_affected} cartões com dia_fechamento padrão",
            "rows_affected": rows_affected
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao atualizar dia_fechamento dos cartões: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao atualizar cartões: {str(e)}"
        )

@router.get("/migration-status")
async def check_migration_status(db: Session = Depends(get_db)):
    """
    Verificar status das migrações
    """
    try:
        # Verificar se a coluna dia_fechamento existe
        check_column_query = text("""
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = 'cartoes' 
            AND column_name = 'dia_fechamento'
        """)
        
        column_exists = db.execute(check_column_query).scalar() > 0
        
        # Contar cartões com dia_fechamento definido
        if column_exists:
            count_with_fechamento = db.execute(text("""
                SELECT COUNT(*) FROM cartoes WHERE dia_fechamento IS NOT NULL
            """)).scalar()
            
            count_total = db.execute(text("""
                SELECT COUNT(*) FROM cartoes WHERE ativo = true
            """)).scalar()
        else:
            count_with_fechamento = 0
            count_total = 0
        
        return {
            "status": "success",
            "migration_status": {
                "column_exists": column_exists,
                "cartoes_with_dia_fechamento": count_with_fechamento,
                "total_cartoes_ativos": count_total,
                "migration_complete": column_exists and count_with_fechamento == count_total
            }
        }
        
    except Exception as e:
        logger.error(f"Erro ao verificar status da migração: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao verificar status: {str(e)}"
        )

@router.get("/debug-cards")
async def debug_cards_calculation(db: Session = Depends(get_db)):
    """
    Debug endpoint to check card calculations (NO AUTH)
    """
    try:
        # Buscar todos os cartões
        cartoes_query = text("""
            SELECT nome, vencimento, dia_fechamento, limite 
            FROM cartoes 
            WHERE ativo = true
            ORDER BY nome
        """)
        
        result = db.execute(cartoes_query).fetchall()
        
        hoje = date.today()
        debug_info = []
        
        for row in result:
            nome, vencimento, dia_fechamento, limite = row
            
            # Calcular informações de debug
            fechamento_calculado = dia_fechamento or (vencimento - 5 if vencimento > 5 else 25)
            
            # Período atual
            if hoje.day <= fechamento_calculado:
                status_periodo = "ABERTA - Período de compras"
                data_vencimento = date(hoje.year, hoje.month, vencimento)
            else:
                status_periodo = "FECHADA - Aguardando pagamento"
                data_vencimento = date(hoje.year, hoje.month, vencimento)
                
                # Se já passou do vencimento, próximo mês
                if hoje.day > vencimento:
                    if hoje.month == 12:
                        data_vencimento = date(hoje.year + 1, 1, vencimento)
                    else:
                        data_vencimento = date(hoje.year, hoje.month + 1, vencimento)
            
            dias_para_vencimento = (data_vencimento - hoje).days
            
            debug_info.append({
                "cartao_nome": nome,
                "limite": limite,
                "dia_vencimento": vencimento,
                "dia_fechamento": dia_fechamento,
                "fechamento_calculado": fechamento_calculado,
                "hoje": str(hoje),
                "dia_atual": hoje.day,
                "status_periodo": status_periodo,
                "data_vencimento_calculada": str(data_vencimento),
                "dias_para_vencimento": dias_para_vencimento,
                "status_final": "VENCIDA" if dias_para_vencimento < 0 else ("FECHADA" if hoje.day > fechamento_calculado else "ABERTA")
            })
        
        return {
            "data_atual": str(hoje),
            "dia_atual": hoje.day,
            "debug_cartoes": debug_info
        }
        
    except Exception as e:
        logger.error(f"Erro no debug de cartões: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro no debug: {str(e)}"
        ) 