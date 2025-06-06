from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date
from ..database import get_db
from ..models.financial import Cartao
from ..core.security import get_current_tenant_user
from ..models.user import User

router = APIRouter()

@router.get("/cards-debug")
def debug_cards_calculation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Debug endpoint to check card calculations"""
    
    cartoes = db.query(Cartao).filter(
        Cartao.tenant_id == current_user.tenant_id,
        Cartao.ativo == True
    ).all()
    
    hoje = date.today()
    debug_info = []
    
    for cartao in cartoes:
        # Calcular informações de debug
        dia_fechamento = cartao.dia_fechamento or (cartao.vencimento - 5 if cartao.vencimento > 5 else 25)
        
        # Período atual
        if hoje.day <= dia_fechamento:
            status_periodo = "ABERTA - Período de compras"
            data_vencimento = date(hoje.year, hoje.month, cartao.vencimento)
        else:
            status_periodo = "FECHADA - Aguardando pagamento"
            data_vencimento = date(hoje.year, hoje.month, cartao.vencimento)
            
            # Se já passou do vencimento, próximo mês
            if hoje.day > cartao.vencimento:
                if hoje.month == 12:
                    data_vencimento = date(hoje.year + 1, 1, cartao.vencimento)
                else:
                    data_vencimento = date(hoje.year, hoje.month + 1, cartao.vencimento)
        
        dias_para_vencimento = (data_vencimento - hoje).days
        
        debug_info.append({
            "cartao_nome": cartao.nome,
            "hoje": str(hoje),
            "dia_atual": hoje.day,
            "dia_fechamento": dia_fechamento,
            "dia_vencimento": cartao.vencimento,
            "status_periodo": status_periodo,
            "data_vencimento_calculada": str(data_vencimento),
            "dias_para_vencimento": dias_para_vencimento,
            "status_final": "VENCIDA" if dias_para_vencimento < 0 else ("FECHADA" if hoje.day > dia_fechamento else "ABERTA")
        })
    
    return {
        "data_atual": str(hoje),
        "debug_cartoes": debug_info
    } 