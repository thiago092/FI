from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from ..database import get_db
from ..models.financial import Categoria, Transacao
from ..schemas.financial import CategoriaCreate, CategoriaUpdate, CategoriaResponse
from ..core.security import get_current_tenant_user
from ..models.user import User
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/", response_model=CategoriaResponse)
def create_categoria(
    categoria_data: CategoriaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Criar nova categoria para o tenant do usuário"""
    # Verificar se já existe categoria com mesmo nome no tenant
    existing = db.query(Categoria).filter(
        Categoria.tenant_id == current_user.tenant_id,
        Categoria.nome == categoria_data.nome
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Categoria with this name already exists"
        )
    
    categoria = Categoria(
        **categoria_data.dict(),
        tenant_id=current_user.tenant_id
    )
    
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    
    return CategoriaResponse.from_orm(categoria)

@router.get("/", response_model=List[CategoriaResponse])
def list_categorias(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar todas as categorias do tenant"""
    categorias = db.query(Categoria).filter(
        Categoria.tenant_id == current_user.tenant_id
    ).all()
    
    return [CategoriaResponse.from_orm(cat) for cat in categorias]

@router.get("/estatisticas")
def get_categorias_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter estatísticas das categorias"""
    try:
        # Total de categorias
        total_categorias = db.query(Categoria).filter(
            Categoria.tenant_id == current_user.tenant_id
        ).count()
        
        # Total de transações
        total_transacoes = db.query(Transacao).filter(
            Transacao.tenant_id == current_user.tenant_id
        ).count()
        
        # Estatísticas por categoria
        categoria_stats = db.query(
            Categoria.id,
            Categoria.nome,
            Categoria.icone,
            Categoria.cor,
            func.count(Transacao.id).label('total_transacoes'),
            func.sum(Transacao.valor).label('total_valor')
        ).outerjoin(
            Transacao, Categoria.id == Transacao.categoria_id
        ).filter(
            Categoria.tenant_id == current_user.tenant_id
        ).group_by(
            Categoria.id, Categoria.nome, Categoria.icone, Categoria.cor
        ).all()
        
        # Categoria mais utilizada
        categoria_mais_usada = None
        max_transacoes = 0
        
        categorias_com_stats = []
        for stat in categoria_stats:
            transacoes_count = int(stat.total_transacoes or 0)
            total_valor = float(stat.total_valor or 0.0)
            percentual = (transacoes_count / total_transacoes * 100) if total_transacoes > 0 else 0.0
            
            categoria_info = {
                'id': int(stat.id),
                'nome': str(stat.nome),
                'icone': str(stat.icone),
                'cor': str(stat.cor),
                'total_transacoes': transacoes_count,
                'total_valor': total_valor,
                'percentual_uso': round(percentual, 1)
            }
            categorias_com_stats.append(categoria_info)
            
            if transacoes_count > max_transacoes:
                max_transacoes = transacoes_count
                categoria_mais_usada = categoria_info
        
        # Categorias criadas este mês
        primeiro_dia_mes = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        categorias_mes = db.query(Categoria).filter(
            Categoria.tenant_id == current_user.tenant_id,
            Categoria.created_at >= primeiro_dia_mes
        ).count()
        
        return {
            'total_categorias': int(total_categorias),
            'categorias_este_mes': int(categorias_mes),
            'categoria_mais_usada': categoria_mais_usada,
            'categorias_com_stats': categorias_com_stats,
            'todas_ativas': True
        }
        
    except Exception as e:
        print(f"Erro nas estatísticas: {e}")
        # Retornar estatísticas básicas em caso de erro
        total_categorias = db.query(Categoria).filter(
            Categoria.tenant_id == current_user.tenant_id
        ).count()
        
        return {
            'total_categorias': int(total_categorias),
            'categorias_este_mes': 0,
            'categoria_mais_usada': None,
            'categorias_com_stats': [],
            'todas_ativas': True
        }

@router.get("/{categoria_id}", response_model=CategoriaResponse)
def get_categoria(
    categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter categoria específica"""
    categoria = db.query(Categoria).filter(
        Categoria.id == categoria_id,
        Categoria.tenant_id == current_user.tenant_id
    ).first()
    
    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria not found"
        )
    
    return CategoriaResponse.from_orm(categoria)

@router.put("/{categoria_id}", response_model=CategoriaResponse)
def update_categoria(
    categoria_id: int,
    categoria_data: CategoriaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Atualizar categoria"""
    categoria = db.query(Categoria).filter(
        Categoria.id == categoria_id,
        Categoria.tenant_id == current_user.tenant_id
    ).first()
    
    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria not found"
        )
    
    # Verificar nome duplicado se está mudando
    if categoria_data.nome and categoria_data.nome != categoria.nome:
        existing = db.query(Categoria).filter(
            Categoria.tenant_id == current_user.tenant_id,
            Categoria.nome == categoria_data.nome,
            Categoria.id != categoria_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Categoria with this name already exists"
            )
    
    # Atualizar campos
    for field, value in categoria_data.dict(exclude_unset=True).items():
        setattr(categoria, field, value)
    
    db.commit()
    db.refresh(categoria)
    
    return CategoriaResponse.from_orm(categoria)

@router.delete("/{categoria_id}")
def delete_categoria(
    categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Deletar categoria"""
    categoria = db.query(Categoria).filter(
        Categoria.id == categoria_id,
        Categoria.tenant_id == current_user.tenant_id
    ).first()
    
    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria not found"
        )
    
    # Verificar se há transações usando esta categoria
    transacoes_count = db.query(Transacao).filter(
        Transacao.categoria_id == categoria_id,
        Transacao.tenant_id == current_user.tenant_id
    ).count()
    
    if transacoes_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete category. {transacoes_count} transactions are using this category."
        )
    
    db.delete(categoria)
    db.commit()
    
    return {"message": "Categoria deleted successfully"}

@router.get("/{categoria_id}/transacoes-info")
def get_categoria_transacoes_info(
    categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter informações sobre transações da categoria"""
    categoria = db.query(Categoria).filter(
        Categoria.id == categoria_id,
        Categoria.tenant_id == current_user.tenant_id
    ).first()
    
    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria not found"
        )
    
    # Contar transações
    transacoes_count = db.query(Transacao).filter(
        Transacao.categoria_id == categoria_id,
        Transacao.tenant_id == current_user.tenant_id
    ).count()
    
    # Calcular valor total
    valor_total = db.query(func.sum(Transacao.valor)).filter(
        Transacao.categoria_id == categoria_id,
        Transacao.tenant_id == current_user.tenant_id
    ).scalar() or 0.0
    
    # Buscar algumas transações de exemplo (últimas 5)
    transacoes_exemplo = db.query(Transacao).filter(
        Transacao.categoria_id == categoria_id,
        Transacao.tenant_id == current_user.tenant_id
    ).order_by(Transacao.data.desc()).limit(5).all()
    
    return {
        "categoria": {
            "id": categoria.id,
            "nome": categoria.nome,
            "cor": categoria.cor,
            "icone": categoria.icone
        },
        "transacoes_count": transacoes_count,
        "valor_total": valor_total,
        "transacoes_exemplo": [
            {
                "id": t.id,
                "descricao": t.descricao,
                "valor": t.valor,
                "data": t.data.isoformat(),
                "tipo": t.tipo
            } for t in transacoes_exemplo
        ]
    }

@router.post("/{categoria_id}/mover-transacoes")
def mover_transacoes_categoria(
    categoria_id: int,
    nova_categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Mover todas as transações de uma categoria para outra"""
    # Verificar se categoria origem existe
    categoria_origem = db.query(Categoria).filter(
        Categoria.id == categoria_id,
        Categoria.tenant_id == current_user.tenant_id
    ).first()
    
    if not categoria_origem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria origem not found"
        )
    
    # Verificar se categoria destino existe
    categoria_destino = db.query(Categoria).filter(
        Categoria.id == nova_categoria_id,
        Categoria.tenant_id == current_user.tenant_id
    ).first()
    
    if not categoria_destino:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria destino not found"
        )
    
    # Contar transações que serão movidas
    transacoes_count = db.query(Transacao).filter(
        Transacao.categoria_id == categoria_id,
        Transacao.tenant_id == current_user.tenant_id
    ).count()
    
    if transacoes_count == 0:
        return {
            "message": "Nenhuma transação para mover",
            "transacoes_movidas": 0
        }
    
    # Mover todas as transações
    db.query(Transacao).filter(
        Transacao.categoria_id == categoria_id,
        Transacao.tenant_id == current_user.tenant_id
    ).update({"categoria_id": nova_categoria_id})
    
    db.commit()
    
    return {
        "message": f"Transações movidas com sucesso de '{categoria_origem.nome}' para '{categoria_destino.nome}'",
        "transacoes_movidas": transacoes_count,
        "categoria_origem": categoria_origem.nome,
        "categoria_destino": categoria_destino.nome
    }

@router.delete("/{categoria_id}/forcar-exclusao")
def forcar_exclusao_categoria(
    categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Excluir categoria forçadamente, removendo todas as transações"""
    categoria = db.query(Categoria).filter(
        Categoria.id == categoria_id,
        Categoria.tenant_id == current_user.tenant_id
    ).first()
    
    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria not found"
        )
    
    # Contar transações que serão excluídas
    transacoes_count = db.query(Transacao).filter(
        Transacao.categoria_id == categoria_id,
        Transacao.tenant_id == current_user.tenant_id
    ).count()
    
    # Excluir todas as transações da categoria
    db.query(Transacao).filter(
        Transacao.categoria_id == categoria_id,
        Transacao.tenant_id == current_user.tenant_id
    ).delete()
    
    # Excluir a categoria
    db.delete(categoria)
    db.commit()
    
    return {
        "message": f"Categoria '{categoria.nome}' e {transacoes_count} transações excluídas com sucesso",
        "categoria_excluida": categoria.nome,
        "transacoes_excluidas": transacoes_count
    } 