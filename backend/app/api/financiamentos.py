from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, and_, func, text
from typing import List, Optional, Dict, Any
from datetime import date, datetime, timedelta
from pydantic import BaseModel
import traceback

from ..database import get_db
from ..core.security import get_current_tenant_user
from ..models.user import User
from ..models.financiamento import (
    Financiamento, ParcelaFinanciamento, ConfirmacaoFinanciamento, 
    SimulacaoFinanciamento, TipoFinanciamento, SistemaAmortizacao, 
    StatusFinanciamento, StatusParcela
)
from ..services.financiamento_service import FinanciamentoService

router = APIRouter()

# Endpoint de debug
@router.get("/debug/status")
def debug_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Debug: Verificar status das tabelas de financiamentos"""
    
    status_info = {
        'tenant_id': current_user.tenant_id,
        'user_email': current_user.email,
        'tabelas': {},
        'imports': {},
        'erros': []
    }
    
    # Testar imports
    try:
        from ..models.financiamento import Financiamento, ParcelaFinanciamento, StatusFinanciamento
        status_info['imports']['models'] = 'OK'
    except Exception as e:
        status_info['imports']['models'] = f'ERRO: {str(e)}'
        status_info['erros'].append(f'Import models: {str(e)}')
    
    try:
        from ..services.financiamento_service import FinanciamentoService
        status_info['imports']['service'] = 'OK'
    except Exception as e:
        status_info['imports']['service'] = f'ERRO: {str(e)}'
        status_info['erros'].append(f'Import service: {str(e)}')
    
    # Testar tabelas
    tabelas_teste = [
        'financiamentos',
        'parcelas_financiamento', 
        'confirmacoes_financiamento',
        'simulacoes_financiamento'
    ]
    
    for tabela in tabelas_teste:
        try:
            result = db.execute(text(f"SELECT COUNT(*) FROM {tabela}"))
            count = result.scalar()
            status_info['tabelas'][tabela] = f'OK - {count} registros'
        except Exception as e:
            status_info['tabelas'][tabela] = f'ERRO: {str(e)}'
            status_info['erros'].append(f'Tabela {tabela}: {str(e)}')
    
    return status_info

# NOVO: Endpoint de debug mais específico
@router.get("/debug/banco-completo")
def debug_banco_completo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Debug completo: Verificar todos os aspectos do banco de financiamentos"""
    
    debug_info = {
        'timestamp': datetime.now().isoformat(),
        'user_info': {
            'id': current_user.id,
            'email': current_user.email,
            'tenant_id': current_user.tenant_id,
            'full_name': current_user.full_name
        },
        'banco_status': {},
        'query_tests': {},
        'dados_raw': {},
        'erros': []
    }
    
    try:
        # 1. Testar conexão básica
        debug_info['banco_status']['conexao'] = 'OK'
        
        # 2. Contar todos os financiamentos
        try:
            result = db.execute(text("SELECT COUNT(*) FROM financiamentos"))
            total_financiamentos = result.scalar()
            debug_info['banco_status']['total_financiamentos'] = total_financiamentos
        except Exception as e:
            debug_info['banco_status']['total_financiamentos'] = f'ERRO: {str(e)}'
            debug_info['erros'].append(f'Count total: {str(e)}')
        
        # 3. Contar financiamentos do tenant
        try:
            result = db.execute(
                text("SELECT COUNT(*) FROM financiamentos WHERE tenant_id = :tenant_id"),
                {"tenant_id": current_user.tenant_id}
            )
            financiamentos_tenant = result.scalar()
            debug_info['banco_status']['financiamentos_tenant'] = financiamentos_tenant
        except Exception as e:
            debug_info['banco_status']['financiamentos_tenant'] = f'ERRO: {str(e)}'
            debug_info['erros'].append(f'Count tenant: {str(e)}')
        
        # 4. Buscar dados reais do tenant
        try:
            result = db.execute(
                text("""SELECT id, descricao, valor_total, status, tenant_id, created_at 
                   FROM financiamentos 
                   WHERE tenant_id = :tenant_id 
                   ORDER BY created_at DESC 
                   LIMIT 10"""),
                {"tenant_id": current_user.tenant_id}
            )
            financiamentos_raw = result.fetchall()
            debug_info['dados_raw']['financiamentos'] = [
                {
                    'id': row[0],
                    'descricao': row[1], 
                    'valor_total': float(row[2]) if row[2] else None,
                    'status': row[3],
                    'tenant_id': row[4],
                    'created_at': row[5].isoformat() if row[5] else None
                }
                for row in financiamentos_raw
            ]
        except Exception as e:
            debug_info['dados_raw']['financiamentos'] = f'ERRO: {str(e)}'
            debug_info['erros'].append(f'Select raw: {str(e)}')
        
        # 5. Testar query ORM
        try:
            financiamentos_orm = db.query(Financiamento).filter(
                Financiamento.tenant_id == current_user.tenant_id
            ).limit(5).all()
            
            debug_info['query_tests']['orm_count'] = len(financiamentos_orm)
            debug_info['query_tests']['orm_data'] = [
                {
                    'id': f.id,
                    'descricao': f.descricao,
                    'valor_total': float(f.valor_total) if f.valor_total else None,
                    'status': f.status,
                    'tenant_id': f.tenant_id
                }
                for f in financiamentos_orm
            ]
        except Exception as e:
            debug_info['query_tests']['orm_error'] = str(e)
            debug_info['erros'].append(f'ORM query: {str(e)}')
        
        # 6. Verificar outros tenants
        try:
            result = db.execute(
                text("SELECT tenant_id, COUNT(*) FROM financiamentos GROUP BY tenant_id")
            )
            tenants_data = result.fetchall()
            debug_info['banco_status']['todos_tenants'] = {
                str(row[0]): row[1] for row in tenants_data
            }
        except Exception as e:
            debug_info['banco_status']['todos_tenants'] = f'ERRO: {str(e)}'
            debug_info['erros'].append(f'Tenants: {str(e)}')
        
    except Exception as e:
        debug_info['erros'].append(f'Erro geral: {str(e)}')
        debug_info['banco_status']['erro_geral'] = str(e)
    
    return debug_info

# Schemas de resposta
class FinanciamentoResponse(BaseModel):
    id: int
    descricao: str
    instituicao: Optional[str]
    numero_contrato: Optional[str]
    tipo_financiamento: str
    sistema_amortizacao: str
    valor_total: float
    valor_financiado: float
    valor_entrada: float
    taxa_juros_mensal: float
    taxa_juros_anual: Optional[float]
    numero_parcelas: int
    parcelas_pagas: int
    valor_parcela: float
    valor_parcela_atual: Optional[float]
    saldo_devedor: float
    data_contratacao: date
    data_primeira_parcela: date
    dia_vencimento: Optional[int]
    status: str
    porcentagem_paga: float
    auto_debito: bool
    observacoes: Optional[str]
    
    class Config:
        from_attributes = True

class ParcelaResponse(BaseModel):
    id: int
    numero_parcela: int
    data_vencimento: date
    valor_parcela: float
    valor_juros: float
    valor_amortizacao: float
    saldo_devedor: float
    valor_parcela_simulado: Optional[float]
    saldo_devedor_pos: Optional[float]
    status: Optional[str]
    data_pagamento: Optional[date]
    valor_pago: Optional[float]
    saldo_inicial_simulado: Optional[float]
    amortizacao_simulada: Optional[float]
    juros_simulados: Optional[float]
    saldo_final_simulado: Optional[float]
    seguro_simulado: Optional[float]
    valor_pago_real: Optional[float]
    dias_atraso: Optional[int]
    
    class Config:
        from_attributes = True

class FinanciamentoCreate(BaseModel):
    descricao: str
    instituicao: Optional[str] = None
    numero_contrato: Optional[str] = None
    tipo_financiamento: str = "pessoal"
    sistema_amortizacao: str = "PRICE"
    valor_total: float
    valor_entrada: float = 0
    valor_financiado: float
    taxa_juros_anual: float
    numero_parcelas: int
    data_contratacao: date
    data_primeira_parcela: date
    dia_vencimento: Optional[int] = None
    categoria_id: int
    conta_id: Optional[int] = None
    conta_debito_id: Optional[int] = None
    auto_debito: bool = False
    taxa_seguro_mensal: float = 0
    taxa_administrativa: float = 0
    observacoes: Optional[str] = None

class SimulacaoRequest(BaseModel):
    valor_financiado: float
    prazo_meses: int
    taxa_juros_anual: float
    sistema_amortizacao: str = "PRICE"
    data_inicio: date
    taxa_seguro_mensal: float = 0
    taxa_administrativa: float = 0

# NOVO: Schema para pagamento de parcela
class PagamentoParcelaRequest(BaseModel):
    parcela_id: int
    valor_pago: float
    data_pagamento: date
    categoria_id: int
    conta_id: Optional[int] = None
    cartao_id: Optional[int] = None
    observacoes: Optional[str] = None
    comprovante_path: Optional[str] = None

class DashboardResponse(BaseModel):
    total_financiado: float
    total_ja_pago: float
    saldo_devedor: float
    financiamentos_ativos: int
    financiamentos_quitados: int
    valor_mes_atual: float
    proximos_vencimentos: List[Dict[str, Any]]
    media_juros_carteira: float

# Endpoints

@router.get("/dashboard/resumo", response_model=DashboardResponse)
def obter_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter dashboard dos financiamentos"""
    
    print(f"📊 GERANDO DASHBOARD:")
    print(f"  Tenant ID: {current_user.tenant_id}")
    print(f"  User: {current_user.email}")
    
    try:
        # Verificar se a tabela existe
        try:
            result = db.execute(text("SELECT COUNT(*) FROM financiamentos"))
            total_registros = result.scalar()
            print(f"✅ Tabela financiamentos existe - Total: {total_registros}")
        except Exception as table_error:
            print(f"❌ Erro ao acessar tabela financiamentos: {table_error}")
            # Tabela não existe, retornar dados vazios
            return {
                'total_financiado': 0.0,
                'total_ja_pago': 0.0,
                'saldo_devedor': 0.0,
                'financiamentos_ativos': 0,
                'financiamentos_quitados': 0,
                'valor_mes_atual': 0.0,
                'proximos_vencimentos': [],
                'media_juros_carteira': 0.0
            }
        
        print("🔧 Chamando FinanciamentoService.obter_dashboard_financiamentos...")
        dashboard = FinanciamentoService.obter_dashboard_financiamentos(
            db=db,
            tenant_id=current_user.tenant_id
        )
        
        print(f"✅ Dashboard gerado: {dashboard}")
        return dashboard
        
    except Exception as e:
        print(f"🔥 ERRO CRÍTICO no dashboard de financiamentos: {str(e)}")
        print(f"🔥 Tipo do erro: {type(e).__name__}")
        print(f"🔥 Traceback completo:")
        print(traceback.format_exc())
        
        # Retornar dados vazios em caso de erro
        return {
            'total_financiado': 0.0,
            'total_ja_pago': 0.0,
            'saldo_devedor': 0.0,
            'financiamentos_ativos': 0,
            'financiamentos_quitados': 0,
            'valor_mes_atual': 0.0,
            'proximos_vencimentos': [],
            'media_juros_carteira': 0.0
        }

@router.get("/proximos-vencimentos", response_model=List[Dict[str, Any]])
def proximos_vencimentos(
    dias: int = Query(30, ge=1, le=365, description="Próximos X dias"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter próximos vencimentos de parcelas"""
    
    print(f"📅 PRÓXIMOS VENCIMENTOS:")
    print(f"  Tenant ID: {current_user.tenant_id}")
    print(f"  User: {current_user.email}")
    print(f"  Dias: {dias}")
    
    try:
        # Verificar se as tabelas existem
        try:
            db.execute(text("SELECT 1 FROM financiamentos LIMIT 1"))
            db.execute(text("SELECT 1 FROM parcelas_financiamento LIMIT 1"))
            print("✅ Tabelas financiamentos e parcelas existem")
        except Exception as table_error:
            print(f"❌ Erro ao acessar tabelas: {table_error}")
            return []
        
        hoje = date.today()
        data_limite = hoje + timedelta(days=dias)
        print(f"📊 Buscando parcelas entre {hoje} e {data_limite}")
        
        # Verificar se existem parcelas no banco
        try:
            result = db.execute(text("SELECT COUNT(*) FROM parcelas_financiamento"))
            total_parcelas = result.scalar()
            print(f"📋 Total de parcelas no banco: {total_parcelas}")
            
            result = db.execute(
                text("SELECT COUNT(*) FROM parcelas_financiamento p JOIN financiamentos f ON p.financiamento_id = f.id WHERE f.tenant_id = :tenant_id"),
                {"tenant_id": current_user.tenant_id}
            )
            parcelas_tenant = result.scalar()
            print(f"📋 Parcelas do tenant: {parcelas_tenant}")
        except Exception as count_error:
            print(f"❌ Erro ao contar parcelas: {count_error}")
        
        # Query mais flexível - buscar todas as parcelas não pagas do tenant
        parcelas = db.query(ParcelaFinanciamento).join(Financiamento).filter(
            Financiamento.tenant_id == current_user.tenant_id,
            # Aceitar parcelas sem status (None) ou com status pendente
            func.coalesce(ParcelaFinanciamento.status, 'pendente').in_(['pendente', 'PENDENTE', 'PARCIAL', 'vencida', 'VENCIDA']),
            ParcelaFinanciamento.data_vencimento.between(hoje, data_limite)
        ).order_by(ParcelaFinanciamento.data_vencimento).all()
        
        print(f"📋 Parcelas encontradas na query: {len(parcelas)}")
        
        # Se não encontrou nada, buscar TODAS as parcelas para debug
        if not parcelas:
            print("🔍 Buscando TODAS as parcelas para debug...")
            todas_parcelas = db.query(ParcelaFinanciamento).join(Financiamento).filter(
                Financiamento.tenant_id == current_user.tenant_id
            ).limit(5).all()
            
            for i, p in enumerate(todas_parcelas):
                print(f"  Parcela {i+1}: ID={p.id}, Data={p.data_vencimento}, Status='{p.status}', Financiamento={p.financiamento_id}")
        
        resultado = []
        for parcela in parcelas:
            dias_para_vencimento = (parcela.data_vencimento - hoje).days
            
            resultado.append({
                'financiamento_id': parcela.financiamento_id,
                'financiamento_nome': parcela.financiamento.descricao,
                'instituicao': parcela.financiamento.instituicao or 'Não informado',
                'numero_parcela': parcela.numero_parcela,
                'data_vencimento': parcela.data_vencimento.isoformat(),
                'valor_parcela': float(parcela.valor_parcela),
                'dias_para_vencimento': dias_para_vencimento,
                'status': parcela.status or 'pendente'
            })
        
        print(f"✅ Retornando {len(resultado)} próximos vencimentos")
        return resultado
        
    except Exception as e:
        print(f"🔥 ERRO CRÍTICO nos próximos vencimentos: {str(e)}")
        print(f"🔥 Tipo do erro: {type(e).__name__}")
        print(f"🔥 Traceback completo:")
        print(traceback.format_exc())
        
        # NÃO retornar lista vazia - lançar exceção para debugging
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno nos vencimentos: {str(e)}"
        )

@router.get("/", response_model=List[FinanciamentoResponse])
def listar_financiamentos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filtrar por status"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar financiamentos do tenant"""
    
    print(f"🔍 LISTANDO FINANCIAMENTOS:")
    print(f"  Tenant ID: {current_user.tenant_id}")
    print(f"  User: {current_user.email}")
    print(f"  Filtros: status={status}, tipo={tipo}")
    print(f"  Paginação: skip={skip}, limit={limit}")
    
    try:
        # Verificar se a tabela existe
        try:
            result = db.execute(text("SELECT COUNT(*) FROM financiamentos"))
            total_registros = result.scalar()
            print(f"✅ Tabela financiamentos existe - Total de registros: {total_registros}")
        except Exception as table_error:
            print(f"❌ Erro ao acessar tabela financiamentos: {table_error}")
            return []
        
        # Verificar registros do tenant específico
        try:
            result = db.execute(
                text("SELECT COUNT(*) FROM financiamentos WHERE tenant_id = :tenant_id"),
                {"tenant_id": current_user.tenant_id}
            )
            registros_tenant = result.scalar()
            print(f"📊 Registros do tenant {current_user.tenant_id}: {registros_tenant}")
        except Exception as tenant_error:
            print(f"❌ Erro ao contar registros do tenant: {tenant_error}")
        
        # Construir query
        print("🔧 Construindo query...")
        query = db.query(Financiamento).filter(
            Financiamento.tenant_id == current_user.tenant_id
        )
        
        # REMOVER joinedload para testar se é o problema
        # .options(
        #     joinedload(Financiamento.categoria),
        #     joinedload(Financiamento.conta),
        #     joinedload(Financiamento.conta_debito)
        # )
        
        if status:
            query = query.filter(Financiamento.status == status)
            print(f"🔍 Filtro status aplicado: {status}")
        
        if tipo:
            query = query.filter(Financiamento.tipo_financiamento == tipo)
            print(f"🔍 Filtro tipo aplicado: {tipo}")
        
        print("📝 Executando query...")
        financiamentos = query.order_by(desc(Financiamento.created_at)).offset(skip).limit(limit).all()
        
        print(f"✅ Query executada - Encontrados: {len(financiamentos)} financiamentos")
        
        # Log dos financiamentos encontrados
        for i, f in enumerate(financiamentos):
            print(f"  {i+1}. ID: {f.id}, Descrição: {f.descricao}, Status: {f.status}")
        
        return financiamentos
        
    except Exception as e:
        print(f"🔥 ERRO CRÍTICO ao listar financiamentos: {str(e)}")
        print(f"🔥 Tipo do erro: {type(e).__name__}")
        print(f"🔥 Traceback completo:")
        print(traceback.format_exc())
        
        # NÃO retornar lista vazia - lançar exceção para debugging
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )

@router.get("/{financiamento_id}", response_model=FinanciamentoResponse)
def obter_financiamento(
    financiamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter financiamento específico"""
    
    financiamento = db.query(Financiamento).options(
        joinedload(Financiamento.categoria),
        joinedload(Financiamento.conta),
        joinedload(Financiamento.conta_debito)
    ).filter(
        Financiamento.id == financiamento_id,
        Financiamento.tenant_id == current_user.tenant_id
    ).first()
    
    if not financiamento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financiamento não encontrado"
        )
    
    return financiamento

@router.get("/{financiamento_id}/parcelas", response_model=List[ParcelaResponse])
def listar_parcelas(
    financiamento_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status_parcela: Optional[str] = Query(None, description="Filtrar por status da parcela"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar parcelas de um financiamento"""
    
    # Verificar se o financiamento existe e pertence ao tenant
    financiamento = db.query(Financiamento).filter(
        Financiamento.id == financiamento_id,
        Financiamento.tenant_id == current_user.tenant_id
    ).first()
    
    if not financiamento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financiamento não encontrado"
        )
    
    query = db.query(ParcelaFinanciamento).filter(
        ParcelaFinanciamento.financiamento_id == financiamento_id,
        ParcelaFinanciamento.tenant_id == current_user.tenant_id
    )
    
    if status_parcela:
        query = query.filter(ParcelaFinanciamento.status == status_parcela)
    
    parcelas = query.order_by(ParcelaFinanciamento.numero_parcela).offset(skip).limit(limit).all()
    
    return parcelas

@router.post("/", response_model=FinanciamentoResponse)
def criar_financiamento(
    financiamento_data: FinanciamentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Criar novo financiamento com parcelas"""
    
    try:
        # CORREÇÃO 1: NÃO calcular taxa mensal aqui - deixar para o service
        # Para garantir consistência, passamos a taxa anual e deixamos o service calcular
        
        # CORREÇÃO 2: Validar campos obrigatórios
        if not financiamento_data.taxa_juros_anual:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Taxa de juros anual é obrigatória"
            )
        
        if financiamento_data.valor_financiado <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Valor financiado deve ser maior que zero"
            )
        
        if financiamento_data.numero_parcelas <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Número de parcelas deve ser maior que zero"
            )
        
        # CORREÇÃO 3: Preparar dados com nomes corretos e calculados
        dados_financiamento = {
            "descricao": financiamento_data.descricao,
            "instituicao": financiamento_data.instituicao,
            "numero_contrato": financiamento_data.numero_contrato,
            "tipo_financiamento": financiamento_data.tipo_financiamento,
            "sistema_amortizacao": financiamento_data.sistema_amortizacao,
            "valor_total": financiamento_data.valor_total,
            "valor_entrada": financiamento_data.valor_entrada,
            "valor_financiado": financiamento_data.valor_financiado,
            # CORREÇÃO: Passar taxa anual direto - service calculará a mensal
            "taxa_juros_anual": financiamento_data.taxa_juros_anual,
            # CORREÇÃO: Calcular taxa mensal CORRETAMENTE (em decimal, não percentual)
            "taxa_juros_mensal": (1 + financiamento_data.taxa_juros_anual / 100) ** (1/12) - 1,
            "numero_parcelas": financiamento_data.numero_parcelas,
            "data_contratacao": financiamento_data.data_contratacao,
            "data_primeira_parcela": financiamento_data.data_primeira_parcela,
            "dia_vencimento": financiamento_data.dia_vencimento,
            "categoria_id": financiamento_data.categoria_id,
            "conta_id": financiamento_data.conta_id,
            "conta_debito_id": financiamento_data.conta_debito_id,
            "auto_debito": financiamento_data.auto_debito,
            # CORREÇÃO: Converter percentual para decimal
            "taxa_seguro_mensal": financiamento_data.taxa_seguro_mensal / 100 if financiamento_data.taxa_seguro_mensal else 0,
            "taxa_administrativa": financiamento_data.taxa_administrativa or 0,
            "observacoes": financiamento_data.observacoes,
            "status": "ativo"
        }
        
        # CORREÇÃO 4: Usar service corrigido para criar com parcelas
        financiamento = FinanciamentoService.criar_financiamento_com_parcelas(
            db=db,
            dados_financiamento=dados_financiamento,
            tenant_id=current_user.tenant_id,
            user_name=current_user.full_name or "Usuario"
        )
        
        return financiamento
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Erro ao criar financiamento: {str(e)}")
        print(f"🔥 Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao criar financiamento: {str(e)}"
        )

@router.post("/simular", response_model=Dict[str, Any])
def simular_financiamento(
    simulacao_data: SimulacaoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Simular financiamento com diferentes sistemas de amortização"""
    
    try:
        sistema = SistemaAmortizacao(simulacao_data.sistema_amortizacao)
        
        simulacao = FinanciamentoService.simular_financiamento(
            valor_financiado=simulacao_data.valor_financiado,
            prazo_meses=simulacao_data.prazo_meses,
            taxa_juros_anual=simulacao_data.taxa_juros_anual,
            sistema_amortizacao=sistema,
            data_inicio=simulacao_data.data_inicio,
            taxa_seguro_mensal=simulacao_data.taxa_seguro_mensal,
            taxa_administrativa=simulacao_data.taxa_administrativa
        )
        
        return simulacao
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro na simulação: {str(e)}"
        )

@router.post("/{financiamento_id}/quitar")
def simular_quitacao(
    financiamento_id: int,
    data_quitacao: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Simular quitação antecipada"""
    
    try:
        simulacao = FinanciamentoService.simular_quitacao_antecipada(
            db=db,
            financiamento_id=financiamento_id,
            data_quitacao=data_quitacao,
            tenant_id=current_user.tenant_id
        )
        
        return simulacao
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro na simulação de quitação: {str(e)}"
        )

@router.post("/processar-debitos-automaticos")
def processar_debitos_automaticos(
    data_processamento: Optional[date] = Query(None, description="Data para processamento (padrão: hoje)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Endpoint para processar débitos automáticos de financiamentos manualmente (teste)"""
    
    try:
        # Importar o AgendadorService
        from ..services.agendador_service import AgendadorService
        
        # Processar débitos automáticos
        resultado = AgendadorService.processar_financiamentos_do_dia(data_processamento)
        
        return {
            "sucesso": True,
            "resultado": resultado,
            "mensagem": f"Processamento concluído: {resultado['parcelas_pagas']} parcelas pagas, {resultado['erros']} erros"
        }
        
    except Exception as e:
        print(f"🔥 Erro no processamento de débitos automáticos: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro no processamento: {str(e)}"
        )

# NOVO: Endpoint para registrar pagamento de parcela
@router.post("/pagar-parcela")
def registrar_pagamento_parcela(
    pagamento_data: PagamentoParcelaRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Registrar pagamento de uma parcela de financiamento"""
    
    try:
        # Verificar se a parcela existe e pertence ao tenant
        parcela = db.query(ParcelaFinanciamento).filter(
            ParcelaFinanciamento.id == pagamento_data.parcela_id,
            ParcelaFinanciamento.tenant_id == current_user.tenant_id
        ).first()
        
        if not parcela:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parcela não encontrada"
            )
        
        if parcela.status == StatusParcela.PAGA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parcela já foi paga"
            )
        
        # Registrar pagamento usando o service
        parcela_atualizada, transacao = FinanciamentoService.registrar_pagamento_parcela(
            db=db,
            parcela_id=pagamento_data.parcela_id,
            valor_pago=pagamento_data.valor_pago,
            data_pagamento=pagamento_data.data_pagamento,
            tenant_id=current_user.tenant_id,
            categoria_id=pagamento_data.categoria_id,
            conta_id=pagamento_data.conta_id,
            cartao_id=pagamento_data.cartao_id,
            observacoes=pagamento_data.observacoes,
            comprovante_path=pagamento_data.comprovante_path
        )
        
        return {
            "sucesso": True,
            "mensagem": "Pagamento registrado com sucesso",
            "parcela": {
                "id": parcela_atualizada.id,
                "numero_parcela": parcela_atualizada.numero_parcela,
                "valor_pago": float(parcela_atualizada.valor_pago_real or 0),
                "juros_atraso": float(parcela_atualizada.juros_multa_atraso or 0),
                "desconto": float(parcela_atualizada.desconto_quitacao or 0),
                "dias_atraso": parcela_atualizada.dias_atraso or 0,
                "status": parcela_atualizada.status,
                "data_pagamento": parcela_atualizada.data_pagamento.isoformat() if parcela_atualizada.data_pagamento else None
            },
            "transacao": {
                "id": transacao.id,
                "valor": float(transacao.valor),
                "descricao": transacao.descricao,
                "data": transacao.data.isoformat() if transacao.data else None
            },
            "financiamento": {
                "id": parcela_atualizada.financiamento.id,
                "saldo_devedor": float(parcela_atualizada.financiamento.saldo_devedor),
                "parcelas_pagas": parcela_atualizada.financiamento.parcelas_pagas,
                "status": parcela_atualizada.financiamento.status
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Erro ao registrar pagamento: {str(e)}")
        print(f"🔥 Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao registrar pagamento: {str(e)}"
        )

# NOVO: Endpoint para obter próxima parcela pendente
@router.get("/{financiamento_id}/proxima-parcela")
def obter_proxima_parcela(
    financiamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter próxima parcela pendente de um financiamento"""
    
    try:
        # Verificar se o financiamento existe e pertence ao tenant
        financiamento = db.query(Financiamento).filter(
            Financiamento.id == financiamento_id,
            Financiamento.tenant_id == current_user.tenant_id
        ).first()
        
        if not financiamento:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Financiamento não encontrado"
            )
        
        # Buscar próxima parcela pendente
        proxima_parcela = db.query(ParcelaFinanciamento).filter(
            ParcelaFinanciamento.financiamento_id == financiamento_id,
            ParcelaFinanciamento.tenant_id == current_user.tenant_id,
            ParcelaFinanciamento.status.in_(['pendente', 'PENDENTE', 'vencida', 'VENCIDA'])
        ).order_by(ParcelaFinanciamento.numero_parcela).first()
        
        if not proxima_parcela:
            return {
                "proxima_parcela": None,
                "mensagem": "Não há parcelas pendentes"
            }
        
        # Calcular se está em atraso
        hoje = date.today()
        dias_atraso = (hoje - proxima_parcela.data_vencimento).days if hoje > proxima_parcela.data_vencimento else 0
        
        return {
            "proxima_parcela": {
                "id": proxima_parcela.id,
                "numero_parcela": proxima_parcela.numero_parcela,
                "data_vencimento": proxima_parcela.data_vencimento.isoformat(),
                "valor_parcela": float(proxima_parcela.valor_parcela_simulado or proxima_parcela.valor_parcela),
                "valor_juros": float(proxima_parcela.juros_simulados or 0),
                "valor_amortizacao": float(proxima_parcela.amortizacao_simulada or 0),
                "status": proxima_parcela.status,
                "dias_atraso": dias_atraso,
                "em_atraso": dias_atraso > 0
            },
            "financiamento": {
                "id": financiamento.id,
                "descricao": financiamento.descricao,
                "instituicao": financiamento.instituicao,
                "total_parcelas": financiamento.numero_parcelas,
                "parcelas_pagas": financiamento.parcelas_pagas
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Erro ao buscar próxima parcela: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar próxima parcela: {str(e)}"
        )

# NOVO: Schema para adiantamento
class AdiantamentoRequest(BaseModel):
    financiamento_id: int
    valor_adiantamento: float
    tipo_adiantamento: str = "amortizacao_extraordinaria"  # ou "parcela_especifica"
    parcela_numero: Optional[int] = 1
    categoria_id: int
    conta_id: Optional[int] = None
    data_aplicacao: date
    observacoes: Optional[str] = None

# NOVO: Endpoint para aplicar adiantamento
@router.post("/aplicar-adiantamento")
def aplicar_adiantamento(
    adiantamento_data: AdiantamentoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Aplicar adiantamento em um financiamento - reduz saldo devedor e cria transação"""
    
    try:
        # Verificar se o financiamento existe e pertence ao tenant
        financiamento = db.query(Financiamento).filter(
            Financiamento.id == adiantamento_data.financiamento_id,
            Financiamento.tenant_id == current_user.tenant_id
        ).first()
        
        if not financiamento:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Financiamento não encontrado"
            )
        
        if financiamento.status not in ['ativo', 'ATIVO']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Só é possível aplicar adiantamento em financiamentos ativos"
            )
        
        if adiantamento_data.valor_adiantamento <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Valor do adiantamento deve ser positivo"
            )
        
        if adiantamento_data.valor_adiantamento > financiamento.saldo_devedor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Valor do adiantamento não pode ser maior que o saldo devedor"
            )
        
        # Importar necessários para transações
        from ..models.financial import Transacao, Categoria
        
        # Verificar se categoria existe
        categoria = db.query(Categoria).filter(
            Categoria.id == adiantamento_data.categoria_id,
            Categoria.tenant_id == current_user.tenant_id
        ).first()
        
        if not categoria:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Categoria não encontrada"
            )
        
        # Criar transação de débito (saída de dinheiro)
        transacao = Transacao(
            tenant_id=current_user.tenant_id,
            conta_id=adiantamento_data.conta_id,
            categoria_id=adiantamento_data.categoria_id,
            valor=-adiantamento_data.valor_adiantamento,  # Negativo = débito
            descricao=f"Adiantamento {adiantamento_data.tipo_adiantamento}: {financiamento.descricao}",
            data=adiantamento_data.data_aplicacao,
            tipo="debito",
            observacoes=adiantamento_data.observacoes
        )
        
        db.add(transacao)
        db.flush()  # Para obter o ID da transação
        
        # Atualizar saldo devedor do financiamento
        saldo_anterior = financiamento.saldo_devedor
        financiamento.saldo_devedor -= adiantamento_data.valor_adiantamento
        
        # Se saldo chegou a zero ou negativo, marcar como quitado
        if financiamento.saldo_devedor <= 0:
            financiamento.saldo_devedor = 0
            financiamento.status = 'quitado'
            financiamento.data_quitacao = adiantamento_data.data_aplicacao
        
        # NOVO: Recalcular tabela de parcelas com novo saldo
        parcelas_atualizadas = 0
        parcelas_removidas = 0
        
        if financiamento.saldo_devedor > 0:
            # Buscar parcelas pendentes para recalcular
            parcelas_pendentes = db.query(ParcelaFinanciamento).filter(
                ParcelaFinanciamento.financiamento_id == financiamento.id,
                ParcelaFinanciamento.tenant_id == current_user.tenant_id,
                ParcelaFinanciamento.status.in_(['pendente', 'PENDENTE'])
            ).order_by(ParcelaFinanciamento.numero_parcela).all()
            
            if parcelas_pendentes:
                # Recalcular parcelas com novo saldo devedor
                novo_saldo = financiamento.saldo_devedor
                taxa_mensal = (financiamento.taxa_juros_anual / 100) / 12
                parcelas_restantes = len(parcelas_pendentes)
                
                # Calcular novo valor da parcela com sistema PRICE
                if financiamento.sistema_amortizacao == 'PRICE':
                    if taxa_mensal > 0:
                        novo_valor_parcela = (novo_saldo * taxa_mensal * (1 + taxa_mensal)**parcelas_restantes) / ((1 + taxa_mensal)**parcelas_restantes - 1)
                    else:
                        novo_valor_parcela = novo_saldo / parcelas_restantes
                else:  # SAC
                    amortizacao_mensal = novo_saldo / parcelas_restantes
                
                saldo_atual = novo_saldo
                
                for i, parcela in enumerate(parcelas_pendentes):
                    if saldo_atual <= 0.01:
                        # Remover parcelas desnecessárias
                        db.delete(parcela)
                        parcelas_removidas += 1
                        continue
                    
                    # Recalcular valores da parcela
                    juros = saldo_atual * taxa_mensal
                    
                    if financiamento.sistema_amortizacao == 'PRICE':
                        valor_parcela = novo_valor_parcela
                        amortizacao = valor_parcela - juros
                    else:  # SAC
                        amortizacao = novo_saldo / parcelas_restantes
                        valor_parcela = amortizacao + juros
                    
                    # Ajustar se amortização for maior que saldo
                    if amortizacao > saldo_atual:
                        amortizacao = saldo_atual
                        valor_parcela = amortizacao + juros
                    
                    # Atualizar parcela
                    parcela.valor_parcela = valor_parcela
                    parcela.valor_juros = juros
                    parcela.valor_amortizacao = amortizacao
                    parcela.saldo_devedor = saldo_atual - amortizacao
                    
                    # Atualizar campos simulados também
                    parcela.valor_parcela_simulado = valor_parcela
                    parcela.juros_simulados = juros
                    parcela.amortizacao_simulada = amortizacao
                    parcela.saldo_devedor_pos = saldo_atual - amortizacao
                    
                    saldo_atual -= amortizacao
                    parcelas_atualizadas += 1
                
                # Atualizar número de parcelas no financiamento
                financiamento.numero_parcelas = financiamento.parcelas_pagas + parcelas_atualizadas
        
        db.commit()
        
        return {
            "sucesso": True,
            "mensagem": "Adiantamento aplicado com sucesso",
            "adiantamento": {
                "valor_aplicado": adiantamento_data.valor_adiantamento,
                "tipo": adiantamento_data.tipo_adiantamento,
                "data_aplicacao": adiantamento_data.data_aplicacao.isoformat(),
                "transacao_id": transacao.id
            },
            "financiamento": {
                "id": financiamento.id,
                "descricao": financiamento.descricao,
                "saldo_anterior": float(saldo_anterior),
                "saldo_atual": float(financiamento.saldo_devedor),
                "reducao_saldo": float(adiantamento_data.valor_adiantamento),
                "status": financiamento.status,
                "quitado": financiamento.status == 'quitado',
                "numero_parcelas_anterior": financiamento.numero_parcelas + parcelas_removidas,
                "numero_parcelas_atual": financiamento.numero_parcelas
            },
            "parcelas_recalculadas": {
                "parcelas_atualizadas": parcelas_atualizadas,
                "parcelas_removidas": parcelas_removidas,
                "total_parcelas_restantes": parcelas_atualizadas,
                "nova_tabela_calculada": financiamento.saldo_devedor > 0
            },
            "economia_real": {
                "reducao_saldo_devedor": float(adiantamento_data.valor_adiantamento),
                "parcelas_economizadas": parcelas_removidas,
                "tempo_economizado_meses": parcelas_removidas,
                "financiamento_quitado": financiamento.status == 'quitado'
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"🔥 Erro ao aplicar adiantamento: {str(e)}")
        print(f"🔥 Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao aplicar adiantamento: {str(e)}"
        )