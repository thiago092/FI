from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, extract
from typing import List
from datetime import datetime, date
from ..database import get_db
from ..models.financial import Cartao, Transacao, Conta, CompraParcelada
from ..schemas.financial import CartaoCreate, CartaoUpdate, CartaoResponse, CartaoComFatura, FaturaInfo, CartaoComParcelamentos
from ..core.security import get_current_tenant_user
from ..models.user import User
from ..models.financial import TipoTransacao
from ..services.fatura_service import FaturaService

router = APIRouter()

def calcular_fatura_cartao(cartao: Cartao, db: Session) -> FaturaInfo:
    """Calcular informações da fatura do cartão com lógica correta de fechamento"""
    hoje = date.today()
    hoje_datetime = datetime.combine(hoje, datetime.min.time())
    
    # Usar a nova lógica de período da FaturaService
    inicio_periodo, fim_periodo = FaturaService.calcular_periodo_fatura(cartao, hoje_datetime)
    data_vencimento = FaturaService.calcular_data_vencimento(cartao, inicio_periodo, fim_periodo)
    
    # Definir dia de fechamento
    dia_fechamento = cartao.dia_fechamento or (cartao.vencimento - 5 if cartao.vencimento and cartao.vencimento > 5 else 25)
    
    # Determinar status da fatura atual
    if hoje.day <= dia_fechamento:
        # PERÍODO DE COMPRAS - Fatura ainda aberta
        # Buscar transações do período atual
        inicio_busca = inicio_periodo
        fim_busca = hoje  # Até hoje
        status_fatura = "ABERTA"
    else:
        # PERÍODO DE PAGAMENTO - Fatura fechada
        # Buscar transações do período que já fechou
        inicio_busca = inicio_periodo  
        fim_busca = fim_periodo  # Até o fechamento
        status_fatura = "FECHADA"
        
        # Se já passou do vencimento, é vencida
        if hoje > data_vencimento:
            status_fatura = "VENCIDA"
    
    # Buscar transações do período calculado
    transacoes_periodo = db.query(Transacao).filter(
        and_(
            Transacao.cartao_id == cartao.id,
            Transacao.data >= inicio_busca,
            Transacao.data <= fim_busca,
            Transacao.tipo == TipoTransacao.SAIDA
        )
    ).all()
    
    # Calcular valor total da fatura
    valor_total_fatura = sum(transacao.valor for transacao in transacoes_periodo)
    
    # Calcular dias para vencimento
    dias_para_vencimento = (data_vencimento - hoje).days
    
    # Se já venceu, mostrar dias em atraso como número negativo
    if dias_para_vencimento < 0:
        dias_para_vencimento = abs(dias_para_vencimento) * -1
    
    # Calcular percentual do limite usado
    percentual_limite_usado = (valor_total_fatura / cartao.limite * 100) if cartao.limite > 0 else 0
    
    return FaturaInfo(
        valor_atual=valor_total_fatura,
        valor_total_mes=valor_total_fatura,
        dias_para_vencimento=dias_para_vencimento,
        data_vencimento=datetime.combine(data_vencimento, datetime.min.time()),
        percentual_limite_usado=round(percentual_limite_usado, 2),
        status=status_fatura,  # Adicionar status se não existe no modelo
        periodo_inicio=inicio_periodo,
        periodo_fim=fim_periodo,
        dia_fechamento=dia_fechamento
    )

@router.post("/", response_model=CartaoResponse)
def create_cartao(
    cartao_data: CartaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Criar novo cartão para o tenant do usuário"""
    # Verificar se já existe cartão com mesmo nome no tenant
    existing = db.query(Cartao).filter(
        Cartao.tenant_id == current_user.tenant_id,
        Cartao.nome == cartao_data.nome
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cartão with this name already exists"
        )
    
    # Validar vencimento
    if cartao_data.vencimento and (cartao_data.vencimento < 1 or cartao_data.vencimento > 31):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vencimento must be between 1 and 31"
        )
    
    # Validar dia_fechamento
    if cartao_data.dia_fechamento and (cartao_data.dia_fechamento < 1 or cartao_data.dia_fechamento > 31):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dia de fechamento must be between 1 and 31"
        )
    
    # Validar numero_final
    if cartao_data.numero_final and (len(cartao_data.numero_final) != 4 or not cartao_data.numero_final.isdigit()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Numero final must be exactly 4 digits"
        )
    
    # Validar conta vinculada se fornecida
    if cartao_data.conta_vinculada_id:
        conta = db.query(Conta).filter(
            Conta.id == cartao_data.conta_vinculada_id,
            Conta.tenant_id == current_user.tenant_id,
            Conta.ativo == True
        ).first()
        
        if not conta:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conta vinculada not found or inactive"
            )
    
    cartao = Cartao(
        **cartao_data.dict(),
        tenant_id=current_user.tenant_id
    )
    
    db.add(cartao)
    db.commit()
    db.refresh(cartao)
    
    # Incluir dados da conta vinculada na resposta
    cartao_response = CartaoResponse.from_orm(cartao)
    if cartao.conta_vinculada:
        cartao_response.conta_vinculada = {
            "id": cartao.conta_vinculada.id,
            "nome": cartao.conta_vinculada.nome,
            "banco": cartao.conta_vinculada.banco
        }
    
    return cartao_response

@router.get("/", response_model=List[CartaoResponse])
def list_cartoes(
    ativo_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar todos os cartões do tenant"""
    query = db.query(Cartao).filter(
        Cartao.tenant_id == current_user.tenant_id
    )
    
    if ativo_only:
        query = query.filter(Cartao.ativo == True)
    
    cartoes = query.all()
    
    result = []
    for cartao in cartoes:
        cartao_response = CartaoResponse.from_orm(cartao)
        if cartao.conta_vinculada:
            cartao_response.conta_vinculada = {
                "id": cartao.conta_vinculada.id,
                "nome": cartao.conta_vinculada.nome,
                "banco": cartao.conta_vinculada.banco
            }
        result.append(cartao_response)
    
    return result

@router.get("/com-fatura", response_model=List[CartaoComFatura])
def list_cartoes_com_fatura(
    ativo_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar todos os cartões do tenant com informações de fatura"""
    query = db.query(Cartao).filter(
        Cartao.tenant_id == current_user.tenant_id
    )
    
    if ativo_only:
        query = query.filter(Cartao.ativo == True)
    
    cartoes = query.all()
    
    result = []
    for cartao in cartoes:
        fatura_info = calcular_fatura_cartao(cartao, db)
        cartao_com_fatura = CartaoComFatura(
            **cartao.__dict__,
            fatura=fatura_info
        )
        result.append(cartao_com_fatura)
    
    return result

@router.get("/{cartao_id}", response_model=CartaoResponse)
def get_cartao(
    cartao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter cartão específico"""
    cartao = db.query(Cartao).filter(
        Cartao.id == cartao_id,
        Cartao.tenant_id == current_user.tenant_id
    ).first()
    
    if not cartao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cartão not found"
        )
    
    return CartaoResponse.from_orm(cartao)

@router.put("/{cartao_id}", response_model=CartaoResponse)
def update_cartao(
    cartao_id: int,
    cartao_data: CartaoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Atualizar cartão"""
    cartao = db.query(Cartao).filter(
        Cartao.id == cartao_id,
        Cartao.tenant_id == current_user.tenant_id
    ).first()
    
    if not cartao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cartão not found"
        )
    
    # Verificar nome duplicado se está mudando
    if cartao_data.nome and cartao_data.nome != cartao.nome:
        existing = db.query(Cartao).filter(
            Cartao.tenant_id == current_user.tenant_id,
            Cartao.nome == cartao_data.nome,
            Cartao.id != cartao_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cartão with this name already exists"
            )
    
    # Validar vencimento se está mudando
    if cartao_data.vencimento and (cartao_data.vencimento < 1 or cartao_data.vencimento > 31):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vencimento must be between 1 and 31"
        )
    
    # Validar dia_fechamento se está mudando
    if cartao_data.dia_fechamento and (cartao_data.dia_fechamento < 1 or cartao_data.dia_fechamento > 31):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dia de fechamento must be between 1 and 31"
        )
    
    # Validar numero_final se está mudando
    if cartao_data.numero_final and (len(cartao_data.numero_final) != 4 or not cartao_data.numero_final.isdigit()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Numero final must be exactly 4 digits"
        )
    
    # Validar conta vinculada se está mudando
    if cartao_data.conta_vinculada_id is not None:
        if cartao_data.conta_vinculada_id:
            conta = db.query(Conta).filter(
                Conta.id == cartao_data.conta_vinculada_id,
                Conta.tenant_id == current_user.tenant_id,
                Conta.ativo == True
            ).first()
            
            if not conta:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Conta vinculada not found or inactive"
                )
    
    # Atualizar campos
    for field, value in cartao_data.dict(exclude_unset=True).items():
        setattr(cartao, field, value)
    
    db.commit()
    db.refresh(cartao)
    
    # Incluir dados da conta vinculada na resposta
    cartao_response = CartaoResponse.from_orm(cartao)
    if cartao.conta_vinculada:
        cartao_response.conta_vinculada = {
            "id": cartao.conta_vinculada.id,
            "nome": cartao.conta_vinculada.nome,
            "banco": cartao.conta_vinculada.banco
        }
    
    return cartao_response

@router.delete("/{cartao_id}")
def delete_cartao(
    cartao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Deletar cartão"""
    cartao = db.query(Cartao).filter(
        Cartao.id == cartao_id,
        Cartao.tenant_id == current_user.tenant_id
    ).first()
    
    if not cartao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cartão not found"
        )
    
    # Verificar se há transações usando este cartão
    # TODO: Implementar verificação quando criarmos transações
    
    db.delete(cartao)
    db.commit()
    
    return {"message": "Cartão deleted successfully"}

@router.get("/com-parcelamentos", response_model=List[CartaoComParcelamentos])
def list_cartoes_com_parcelamentos(
    ativo_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar cartões com informações de fatura e parcelamentos"""
    from ..api.parcelas import calcular_resumo_parcelamentos
    
    query = db.query(Cartao).filter(
        Cartao.tenant_id == current_user.tenant_id
    )
    
    if ativo_only:
        query = query.filter(Cartao.ativo == True)
    
    cartoes = query.all()
    
    result = []
    for cartao in cartoes:
        # Calcular fatura
        fatura_info = calcular_fatura_cartao(cartao, db)
        
        # Calcular resumo de parcelamentos
        resumo_parcelamentos = calcular_resumo_parcelamentos(cartao.id, db, current_user.tenant_id)
        
        # Buscar compras parceladas ativas
        compras_parceladas = db.query(CompraParcelada).filter(
            CompraParcelada.cartao_id == cartao.id,
            CompraParcelada.status == "ativa",
            CompraParcelada.tenant_id == current_user.tenant_id
        ).all()
        
        # Calcular campos adicionais para cada compra
        for compra in compras_parceladas:
            parcelas_pagas = sum(1 for p in compra.parcelas if p.paga)
            compra.parcelas_pagas = parcelas_pagas
            compra.parcelas_pendentes = compra.total_parcelas - parcelas_pagas
            compra.valor_pago = parcelas_pagas * compra.valor_parcela
            compra.valor_pendente = compra.valor_total - compra.valor_pago
            
            # Próxima parcela não paga
            proxima = next((p for p in sorted(compra.parcelas, key=lambda x: x.numero_parcela) if not p.paga), None)
            compra.proxima_parcela = proxima
        
        cartao_com_parcelamentos = CartaoComParcelamentos(
            **cartao.__dict__,
            fatura=fatura_info,
            compras_parceladas=compras_parceladas,
            resumo_parcelamentos=resumo_parcelamentos
        )
        
        result.append(cartao_com_parcelamentos)
    
    return result

@router.get("/{cartao_id}/debug-periodos")
def debug_periodos_fatura(
    cartao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """DEBUG: Verificar cálculos de período e fatura"""
    from ..services.fatura_service import FaturaService
    
    cartao = db.query(Cartao).filter(
        Cartao.id == cartao_id,
        Cartao.tenant_id == current_user.tenant_id
    ).first()
    
    if not cartao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cartão não encontrado"
        )
    
    hoje = datetime.now()
    
    # Calcular período atual
    inicio_periodo, fim_periodo = FaturaService.calcular_periodo_fatura(cartao, hoje)
    data_vencimento = FaturaService.calcular_data_vencimento(cartao, inicio_periodo, fim_periodo)
    
    # Calcular fatura usando a função atual
    fatura_info = calcular_fatura_cartao(cartao, db)
    
    # Buscar transações do período
    transacoes_periodo = db.query(Transacao).filter(
        and_(
            Transacao.cartao_id == cartao.id,
            Transacao.data >= inicio_periodo,
            Transacao.data <= datetime.now(),
            Transacao.tipo == TipoTransacao.SAIDA
        )
    ).all()
    
    return {
        "cartao": {
            "id": cartao.id,
            "nome": cartao.nome,
            "vencimento": cartao.vencimento,
            "dia_fechamento": cartao.dia_fechamento
        },
        "hoje": hoje.date(),
        "periodo_calculado": {
            "inicio": inicio_periodo,
            "fim": fim_periodo,
            "data_vencimento": data_vencimento
        },
        "fatura_info": {
            "valor_atual": fatura_info.valor_atual,
            "dias_para_vencimento": fatura_info.dias_para_vencimento,
            "status": fatura_info.status,
            "periodo_inicio": fatura_info.periodo_inicio,
            "periodo_fim": fatura_info.periodo_fim
        },
        "transacoes_periodo": [
            {
                "id": t.id,
                "descricao": t.descricao,
                "valor": t.valor,
                "data": t.data.date()
            } for t in transacoes_periodo
        ],
        "total_transacoes": len(transacoes_periodo),
        "valor_total": sum(t.valor for t in transacoes_periodo)
    } 