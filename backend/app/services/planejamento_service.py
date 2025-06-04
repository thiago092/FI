from sqlalchemy.orm import Session
from sqlalchemy import and_, func, extract
from datetime import datetime, date
from typing import List, Optional
import calendar

from ..models.financial import (
    PlanejamentoMensal, PlanoCategoria, Categoria, Transacao, 
    TipoTransacao, StatusPlano
)
from ..schemas.financial import (
    PlanejamentoMensalCreate, PlanejamentoMensalUpdate,
    PlanoCategoriaCreate, PlanoCategoriaUpdate
)

class PlanejamentoService:
    
    @staticmethod
    def calcular_valores_gasto_real(db: Session, planejamento: PlanejamentoMensal) -> None:
        """Atualiza os valores gastos reais baseado nas transações do mês"""
        
        # Calcular gastos por categoria no período do planejamento
        for plano_categoria in planejamento.planos_categoria:
            # Buscar transações de saída da categoria no mês/ano do planejamento
            valor_gasto = db.query(func.sum(Transacao.valor)).filter(
                and_(
                    Transacao.categoria_id == plano_categoria.categoria_id,
                    Transacao.tipo == TipoTransacao.SAIDA,
                    Transacao.tenant_id == planejamento.tenant_id,
                    extract('month', Transacao.data) == planejamento.mes,
                    extract('year', Transacao.data) == planejamento.ano
                )
            ).scalar() or 0.0
            
            plano_categoria.valor_gasto = valor_gasto
        
        # Calcular totais do planejamento
        planejamento.total_planejado = sum(p.valor_planejado for p in planejamento.planos_categoria)
        planejamento.total_gasto = sum(p.valor_gasto for p in planejamento.planos_categoria)
        
        db.commit()
    
    @staticmethod
    def criar_planejamento(
        db: Session, 
        planejamento_data: PlanejamentoMensalCreate, 
        tenant_id: int
    ) -> PlanejamentoMensal:
        """Criar um novo planejamento mensal"""
        
        # Verificar se já existe planejamento para este mês/ano
        planejamento_existente = db.query(PlanejamentoMensal).filter(
            and_(
                PlanejamentoMensal.mes == planejamento_data.mes,
                PlanejamentoMensal.ano == planejamento_data.ano,
                PlanejamentoMensal.tenant_id == tenant_id
            )
        ).first()
        
        if planejamento_existente:
            raise ValueError(f"Já existe um planejamento para {planejamento_data.mes}/{planejamento_data.ano}")
        
        # Criar planejamento
        planejamento = PlanejamentoMensal(
            nome=planejamento_data.nome,
            descricao=planejamento_data.descricao,
            mes=planejamento_data.mes,
            ano=planejamento_data.ano,
            renda_esperada=planejamento_data.renda_esperada,
            tenant_id=tenant_id
        )
        
        db.add(planejamento)
        db.flush()  # Para obter o ID
        
        # Criar planos por categoria
        for plano_data in planejamento_data.planos_categoria:
            plano_categoria = PlanoCategoria(
                planejamento_id=planejamento.id,
                categoria_id=plano_data.categoria_id,
                valor_planejado=plano_data.valor_planejado,
                prioridade=plano_data.prioridade,
                observacoes=plano_data.observacoes,
                tenant_id=tenant_id
            )
            db.add(plano_categoria)
        
        db.commit()
        db.refresh(planejamento)
        
        # Calcular valores reais
        PlanejamentoService.calcular_valores_gasto_real(db, planejamento)
        
        return planejamento
    
    @staticmethod
    def atualizar_planejamento(
        db: Session,
        planejamento_id: int,
        planejamento_data: PlanejamentoMensalUpdate,
        tenant_id: int
    ) -> Optional[PlanejamentoMensal]:
        """Atualizar planejamento existente"""
        
        planejamento = db.query(PlanejamentoMensal).filter(
            and_(
                PlanejamentoMensal.id == planejamento_id,
                PlanejamentoMensal.tenant_id == tenant_id
            )
        ).first()
        
        if not planejamento:
            return None
        
        # Atualizar campos
        for field, value in planejamento_data.dict(exclude_unset=True).items():
            setattr(planejamento, field, value)
        
        # Recalcular valores reais
        PlanejamentoService.calcular_valores_gasto_real(db, planejamento)
        
        return planejamento
    
    @staticmethod
    def get_planejamento_atual(db: Session, tenant_id: int) -> Optional[PlanejamentoMensal]:
        """Buscar planejamento do mês atual"""
        agora = datetime.now()
        return db.query(PlanejamentoMensal).filter(
            and_(
                PlanejamentoMensal.mes == agora.month,
                PlanejamentoMensal.ano == agora.year,
                PlanejamentoMensal.tenant_id == tenant_id,
                PlanejamentoMensal.status == StatusPlano.ATIVO
            )
        ).first()
    
    @staticmethod
    def get_estatisticas_categoria(
        db: Session, 
        planejamento_id: int, 
        tenant_id: int
    ) -> List[dict]:
        """Calcular estatísticas detalhadas por categoria"""
        
        planejamento = db.query(PlanejamentoMensal).filter(
            and_(
                PlanejamentoMensal.id == planejamento_id,
                PlanejamentoMensal.tenant_id == tenant_id
            )
        ).first()
        
        if not planejamento:
            return []
        
        estatisticas = []
        for plano in planejamento.planos_categoria:
            percentual_gasto = (plano.valor_gasto / plano.valor_planejado * 100) if plano.valor_planejado > 0 else 0
            saldo_restante = plano.valor_planejado - plano.valor_gasto
            
            # Determinar status
            if percentual_gasto > 100:
                status = "excedido"
            elif percentual_gasto > 80:
                status = "proximo_limite"
            else:
                status = "dentro_limite"
            
            estatisticas.append({
                "categoria_id": plano.categoria_id,
                "categoria_nome": plano.categoria.nome,
                "categoria_icone": plano.categoria.icone,
                "valor_planejado": plano.valor_planejado,
                "valor_gasto": plano.valor_gasto,
                "percentual_gasto": round(percentual_gasto, 2),
                "saldo_restante": round(saldo_restante, 2),
                "status": status,
                "cor_categoria": plano.categoria.cor,
                "prioridade": plano.prioridade
            })
        
        return estatisticas
    
    @staticmethod
    def duplicar_planejamento(
        db: Session,
        planejamento_id: int,
        novo_mes: int,
        novo_ano: int,
        tenant_id: int
    ) -> PlanejamentoMensal:
        """Duplicar planejamento existente para outro mês"""
        
        planejamento_origem = db.query(PlanejamentoMensal).filter(
            and_(
                PlanejamentoMensal.id == planejamento_id,
                PlanejamentoMensal.tenant_id == tenant_id
            )
        ).first()
        
        if not planejamento_origem:
            raise ValueError("Planejamento não encontrado")
        
        # Verificar se já existe planejamento para o novo período
        planejamento_existente = db.query(PlanejamentoMensal).filter(
            and_(
                PlanejamentoMensal.mes == novo_mes,
                PlanejamentoMensal.ano == novo_ano,
                PlanejamentoMensal.tenant_id == tenant_id
            )
        ).first()
        
        if planejamento_existente:
            raise ValueError(f"Já existe um planejamento para {novo_mes}/{novo_ano}")
        
        # Criar novo planejamento
        nome_mes = calendar.month_name[novo_mes]
        novo_planejamento = PlanejamentoMensal(
            nome=f"Planejamento {nome_mes} {novo_ano}",
            descricao=f"Baseado no planejamento de {calendar.month_name[planejamento_origem.mes]} {planejamento_origem.ano}",
            mes=novo_mes,
            ano=novo_ano,
            renda_esperada=planejamento_origem.renda_esperada,
            tenant_id=tenant_id
        )
        
        db.add(novo_planejamento)
        db.flush()
        
        # Duplicar planos de categoria
        for plano_origem in planejamento_origem.planos_categoria:
            novo_plano = PlanoCategoria(
                planejamento_id=novo_planejamento.id,
                categoria_id=plano_origem.categoria_id,
                valor_planejado=plano_origem.valor_planejado,
                prioridade=plano_origem.prioridade,
                observacoes=plano_origem.observacoes,
                tenant_id=tenant_id
            )
            db.add(novo_plano)
        
        db.commit()
        db.refresh(novo_planejamento)
        
        # Calcular valores reais para o novo período
        PlanejamentoService.calcular_valores_gasto_real(db, novo_planejamento)
        
        return novo_planejamento 