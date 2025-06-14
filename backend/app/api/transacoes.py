from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func, extract
from typing import List, Optional
from datetime import datetime, date
import logging
from ..database import get_db
from ..models.financial import Transacao, Categoria, Conta, Cartao, TipoTransacao

logger = logging.getLogger(__name__)
from ..schemas.financial import (
    TransacaoCreate, 
    TransacaoUpdate, 
    TransacaoResponse,
    TipoTransacaoEnum
)
from ..core.security import get_current_tenant_user
from ..models.user import User
from ..services.fatura_service import FaturaService
from fastapi.responses import Response
import pandas as pd
import io

router = APIRouter()

def criar_transacao_interna(
    db: Session,
    tenant_id: int,
    conta_id: int,
    categoria_id: int,
    valor: float,
    descricao: str,
    data_transacao: date,
    created_by_name: str = "Sistema"
) -> Transacao:
    """Função auxiliar para criar transações internas"""
    transacao = Transacao(
        conta_id=conta_id,
        categoria_id=categoria_id,
        valor=valor,
        descricao=descricao,
        data_transacao=data_transacao,
        tenant_id=tenant_id,
        created_by_name=created_by_name
    )
    db.add(transacao)
    db.flush()  # Para obter o ID sem fazer commit
    return transacao

@router.post("/", response_model=TransacaoResponse)
def create_transacao(
    transacao_data: TransacaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Criar nova transação"""
    
    # Validar se categoria existe e pertence ao tenant
    categoria = db.query(Categoria).filter(
        Categoria.id == transacao_data.categoria_id,
        Categoria.tenant_id == current_user.tenant_id
    ).first()
    
    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Categoria not found or not accessible"
        )
    
    # Validar conta se fornecida
    if transacao_data.conta_id:
        conta = db.query(Conta).filter(
            Conta.id == transacao_data.conta_id,
            Conta.tenant_id == current_user.tenant_id
        ).first()
        
        if not conta:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conta not found or not accessible"
            )
    
    # Validar cartão se fornecido
    if transacao_data.cartao_id:
        cartao = db.query(Cartao).filter(
            Cartao.id == transacao_data.cartao_id,
            Cartao.tenant_id == current_user.tenant_id
        ).first()
        
        if not cartao:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cartão not found or not accessible"
            )
    
    # Validar data (permitir até 30 dias no futuro para extratos de cartão)
    from datetime import date as date_type, datetime, timedelta
    hoje = date_type.today()
    limite_futuro = hoje + timedelta(days=30)
    
    # Converter datetime para date para comparação
    data_transacao = transacao_data.data.date() if isinstance(transacao_data.data, datetime) else transacao_data.data
    
    if data_transacao > limite_futuro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Data não pode ser superior a 30 dias no futuro. Data informada: {data_transacao}, Limite: {limite_futuro}"
        )
    
    # Criar transação
    transacao_dict = transacao_data.model_dump()
    
    # Se o created_by_name não foi fornecido, usar o nome do usuário atual
    if not transacao_dict.get("created_by_name"):
        transacao_dict["created_by_name"] = current_user.full_name or current_user.email
    
    # Log para debug
    logger.info(f"📝 Criando transação: {transacao_dict}")
    
    transacao = Transacao(
        **transacao_dict,
        tenant_id=current_user.tenant_id
    )
    
    db.add(transacao)
    db.flush()  # Para obter o ID antes do commit
    
    # Se é uma transação no cartão (saída), vincular à fatura automaticamente
    if transacao.cartao_id and transacao.tipo == TipoTransacao.SAIDA:
        try:
            FaturaService.adicionar_transacao_fatura(db, transacao)
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao processar fatura: {str(e)}"
            )
    
    db.commit()
    db.refresh(transacao)
    
    # Log para debug
    logger.info(f"✅ Transação criada: ID={transacao.id}, created_by_name={transacao.created_by_name}")
    
    return transacao

@router.get("/", response_model=List[TransacaoResponse])
def list_transacoes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tipo: Optional[TipoTransacaoEnum] = None,
    categoria_id: Optional[int] = None,
    conta_id: Optional[int] = None,
    cartao_id: Optional[int] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    busca: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Listar transações com filtros"""
    
    query = db.query(Transacao).filter(
        Transacao.tenant_id == current_user.tenant_id
    )
    
    # Aplicar filtros
    if tipo:
        query = query.filter(Transacao.tipo == tipo)
    
    if categoria_id:
        query = query.filter(Transacao.categoria_id == categoria_id)
    
    if conta_id:
        query = query.filter(Transacao.conta_id == conta_id)
    
    if cartao_id:
        query = query.filter(Transacao.cartao_id == cartao_id)
    
    if data_inicio:
        query = query.filter(Transacao.data >= data_inicio)
    
    if data_fim:
        # Incluir todo o dia final
        data_fim_completa = datetime.combine(data_fim, datetime.max.time())
        query = query.filter(Transacao.data <= data_fim_completa)
    
    if busca:
        search_pattern = f"%{busca}%"
        query = query.filter(
            or_(
                Transacao.descricao.ilike(search_pattern),
                Transacao.observacoes.ilike(search_pattern)
            )
        )
    
    # Ordenar por data mais recente
    query = query.order_by(desc(Transacao.data))
    
    # Aplicar paginação
    transacoes = query.offset(skip).limit(limit).all()
    
    return transacoes

@router.get("/resumo")
def get_resumo_transacoes(
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    tipo: Optional[TipoTransacaoEnum] = None,
    categoria_id: Optional[int] = None,
    conta_id: Optional[int] = None,
    cartao_id: Optional[int] = None,
    busca: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter resumo das transações por período"""
    
    query = db.query(Transacao).filter(
        Transacao.tenant_id == current_user.tenant_id
    )
    
    # Aplicar todos os filtros
    if data_inicio:
        query = query.filter(Transacao.data >= data_inicio)
    
    if data_fim:
        data_fim_completa = datetime.combine(data_fim, datetime.max.time())
        query = query.filter(Transacao.data <= data_fim_completa)
    
    if tipo:
        query = query.filter(Transacao.tipo == tipo)
    
    if categoria_id:
        query = query.filter(Transacao.categoria_id == categoria_id)
    
    if conta_id:
        query = query.filter(Transacao.conta_id == conta_id)
    
    if cartao_id:
        query = query.filter(Transacao.cartao_id == cartao_id)
    
    if busca:
        search_pattern = f"%{busca}%"
        query = query.filter(
            or_(
                Transacao.descricao.ilike(search_pattern),
                Transacao.observacoes.ilike(search_pattern)
            )
        )
    
    # Calcular totais
    entradas = query.filter(Transacao.tipo == TipoTransacao.ENTRADA).with_entities(
        func.sum(Transacao.valor)
    ).scalar() or 0.0
    
    saidas = query.filter(Transacao.tipo == TipoTransacao.SAIDA).with_entities(
        func.sum(Transacao.valor)
    ).scalar() or 0.0
    
    total_transacoes = query.count()
    
    saldo = entradas - saidas
    
    return {
        "total_entradas": entradas,
        "total_saidas": saidas,
        "saldo": saldo,
        "total_transacoes": total_transacoes,
        "data_inicio": data_inicio,
        "data_fim": data_fim
    }

@router.get("/por-categoria")
def get_transacoes_por_categoria(
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter totais por categoria"""
    
    query = db.query(
        Categoria.nome,
        Categoria.cor,
        Categoria.icone,
        func.sum(Transacao.valor).label('total'),
        func.count(Transacao.id).label('quantidade'),
        Transacao.tipo
    ).join(
        Transacao, Categoria.id == Transacao.categoria_id
    ).filter(
        Transacao.tenant_id == current_user.tenant_id
    )
    
    # Aplicar filtros de data
    if data_inicio:
        query = query.filter(Transacao.data >= data_inicio)
    
    if data_fim:
        data_fim_completa = datetime.combine(data_fim, datetime.max.time())
        query = query.filter(Transacao.data <= data_fim_completa)
    
    resultados = query.group_by(
        Categoria.nome, 
        Categoria.cor, 
        Categoria.icone, 
        Transacao.tipo
    ).all()
    
    # Organizar por tipo
    entradas = []
    saidas = []
    
    for resultado in resultados:
        item = {
            "categoria": resultado.nome,
            "cor": resultado.cor,
            "icone": resultado.icone,
            "total": resultado.total,
            "quantidade": resultado.quantidade
        }
        
        if resultado.tipo == TipoTransacao.ENTRADA:
            entradas.append(item)
        else:
            saidas.append(item)
    
    return {
        "entradas": entradas,
        "saidas": saidas
    }

@router.get("/{transacao_id}", response_model=TransacaoResponse)
def get_transacao(
    transacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Obter transação específica"""
    
    transacao = db.query(Transacao).filter(
        Transacao.id == transacao_id,
        Transacao.tenant_id == current_user.tenant_id
    ).first()
    
    if not transacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação not found"
        )
    
    return transacao

@router.put("/{transacao_id}", response_model=TransacaoResponse)
def update_transacao(
    transacao_id: int,
    transacao_data: TransacaoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Atualizar transação"""
    
    transacao = db.query(Transacao).filter(
        Transacao.id == transacao_id,
        Transacao.tenant_id == current_user.tenant_id
    ).first()
    
    if not transacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação not found"
        )
    
    # Validar categoria se fornecida
    if transacao_data.categoria_id:
        categoria = db.query(Categoria).filter(
            Categoria.id == transacao_data.categoria_id,
            Categoria.tenant_id == current_user.tenant_id
        ).first()
        
        if not categoria:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Categoria not found"
            )
    
    # Atualizar campos
    for field, value in transacao_data.model_dump(exclude_unset=True).items():
        setattr(transacao, field, value)
    
    db.commit()
    db.refresh(transacao)
    
    return transacao

@router.delete("/{transacao_id}")
def delete_transacao(
    transacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tenant_user)
):
    """Deletar transação"""
    
    transacao = db.query(Transacao).filter(
        Transacao.id == transacao_id,
        Transacao.tenant_id == current_user.tenant_id
    ).first()
    
    if not transacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação not found"
        )
    
    db.delete(transacao)
    db.commit()
    
    return {"message": "Transação deleted successfully"}

@router.get("/template/excel")
async def download_excel_template(
    current_user: User = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """Download template Excel para importação em lote"""
    try:
        # Buscar dados do usuário para o template
        cartoes = db.query(Cartao).filter(
            Cartao.tenant_id == current_user.tenant_id,
            Cartao.ativo == True
        ).all()
        
        contas = db.query(Conta).filter(
            Conta.tenant_id == current_user.tenant_id
        ).all()
        
        categorias = db.query(Categoria).filter(
            Categoria.tenant_id == current_user.tenant_id
        ).all()
        
        # Criar DataFrame com dados de exemplo
        dados_exemplo = [
            {
                'Data': '2024-01-15',
                'Descrição': 'Almoço no restaurante',
                'Valor': 45.50,
                'Categoria': 'Alimentação',
                'Cartão': 'Nubank' if cartoes else '',
                'Tipo': 'SAIDA'
            },
            {
                'Data': '2024-01-16', 
                'Descrição': 'Salário recebido',
                'Valor': 3500.00,
                'Categoria': 'Renda',
                'Cartão': '',
                'Tipo': 'ENTRADA'
            }
        ]
        
        # Criar sheets
        with pd.ExcelWriter(io.BytesIO(), engine='openpyxl') as writer:
            # Sheet principal com template
            df_template = pd.DataFrame(dados_exemplo)
            df_template.to_excel(writer, sheet_name='Transações', index=False)
            
            # Sheet com cartões disponíveis
            if cartoes:
                df_cartoes = pd.DataFrame([{
                    'ID': c.id,
                    'Nome': c.nome,
                    'Bandeira': c.bandeira,
                    'Limite': c.limite
                } for c in cartoes])
                df_cartoes.to_excel(writer, sheet_name='Cartões', index=False)
            
            # Sheet com contas disponíveis
            if contas:
                df_contas = pd.DataFrame([{
                    'ID': c.id,
                    'Nome': c.nome,
                    'Banco': c.banco,
                    'Tipo': c.tipo
                } for c in contas])
                df_contas.to_excel(writer, sheet_name='Contas', index=False)
            
            # Sheet com categorias disponíveis
            if categorias:
                df_categorias = pd.DataFrame([{
                    'ID': c.id,
                    'Nome': c.nome,
                    'Cor': c.cor
                } for c in categorias])
                df_categorias.to_excel(writer, sheet_name='Categorias', index=False)
            
            # Sheet com instruções
            instrucoes = [
                {'Campo': 'Data', 'Formato': 'YYYY-MM-DD', 'Exemplo': '2024-01-15', 'Obrigatório': 'Sim'},
                {'Campo': 'Descrição', 'Formato': 'Texto livre', 'Exemplo': 'Almoço no restaurante', 'Obrigatório': 'Não*'},
                {'Campo': 'Valor', 'Formato': 'Número decimal', 'Exemplo': '45.50', 'Obrigatório': 'Sim'},
                {'Campo': 'Categoria', 'Formato': 'Nome da categoria', 'Exemplo': 'Alimentação', 'Obrigatório': 'Não*'},
                {'Campo': 'Cartão', 'Formato': 'Nome do cartão', 'Exemplo': 'Nubank', 'Obrigatório': 'Não**'},
                {'Campo': 'Tipo', 'Formato': 'ENTRADA ou SAIDA', 'Exemplo': 'SAIDA', 'Obrigatório': 'Sim'}
            ]
            df_instrucoes = pd.DataFrame(instrucoes)
            df_instrucoes.to_excel(writer, sheet_name='Instruções', index=False)
            
            excel_buffer = writer.book.save(io.BytesIO())
            
        excel_buffer.seek(0)
        
        # Retornar arquivo Excel
        return Response(
            content=excel_buffer.read(),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': 'attachment; filename=template_transacoes.xlsx'}
        )
        
    except Exception as e:
        logger.error(f"Erro ao gerar template: {e}")
        raise HTTPException(
            status_code=500,
            detail="Erro ao gerar template Excel"
        )

@router.post("/upload/excel")
async def upload_excel_transacoes(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """Upload e processamento de arquivo Excel com transações"""
    try:
        # Validar arquivo
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail="Arquivo deve ser Excel (.xlsx ou .xls)"
            )
        
        # Ler arquivo Excel
        content = await file.read()
        df = pd.read_excel(io.BytesIO(content), sheet_name='Transações')
        
        if df.empty:
            raise HTTPException(
                status_code=400,
                detail="Arquivo Excel está vazio"
            )
        
        # Validar colunas obrigatórias
        colunas_obrigatorias = ['Data', 'Valor', 'Tipo']
        colunas_faltando = [col for col in colunas_obrigatorias if col not in df.columns]
        
        if colunas_faltando:
            raise HTTPException(
                status_code=400,
                detail=f"Colunas obrigatórias faltando: {', '.join(colunas_faltando)}"
            )
        
        # Buscar dados de referência
        cartoes = {c.nome: c.id for c in db.query(Cartao).filter(
            Cartao.tenant_id == current_user.tenant_id
        ).all()}
        
        contas = {c.nome: c.id for c in db.query(Conta).filter(
            Conta.tenant_id == current_user.tenant_id
        ).all()}
        
        categorias = {c.nome: c.id for c in db.query(Categoria).filter(
            Categoria.tenant_id == current_user.tenant_id
        ).all()}
        
        # Processar transações
        transacoes_criadas = []
        transacoes_com_erro = []
        
        from ..services.chat_ai_service import ChatAIService
        chat_service = ChatAIService()
        chat_service.tenant_id = current_user.tenant_id
        chat_service.db = db
        
        for index, row in df.iterrows():
            try:
                # Validar linha
                if pd.isna(row['Valor']) or pd.isna(row['Tipo']):
                    transacoes_com_erro.append({
                        'linha': index + 2,
                        'erro': 'Valor ou Tipo não informado'
                    })
                    continue
                
                # Processar data
                try:
                    if pd.isna(row['Data']):
                        data_transacao = datetime.now().date()
                    else:
                        data_transacao = pd.to_datetime(row['Data']).date()
                        
                    # Validar data (não pode ser futura)
                    hoje = datetime.now().date()
                    if data_transacao > hoje:
                        transacoes_com_erro.append({
                            'linha': index + 2,
                            'erro': f'Data futura não permitida: {data_transacao}. Use data de hoje ou anterior.'
                        })
                        continue
                        
                except Exception as e:
                    data_transacao = datetime.now().date()
                
                # Descrição - usar IA se não informada
                descricao = row.get('Descrição', '')
                if pd.isna(descricao) or not descricao.strip():
                    descricao = f"Transação importada - R$ {row['Valor']:.2f}"
                
                # Categoria - usar IA se não informada
                categoria_id = None
                categoria_nome = row.get('Categoria', '')
                
                if pd.isna(categoria_nome) or not categoria_nome.strip():
                    # Usar IA para sugerir categoria
                    categoria_nome = chat_service._determinar_categoria_automatica(descricao)
                    categoria_id = chat_service._criar_categoria_automatica(categoria_nome)
                else:
                    # Tentar encontrar categoria existente
                    categoria_id = categorias.get(categoria_nome)
                    if not categoria_id:
                        categoria_id = chat_service._criar_categoria_automatica(categoria_nome)
                
                # Cartão/Conta
                cartao_id = None
                conta_id = None
                
                cartao_nome = row.get('Cartão', '')
                if not pd.isna(cartao_nome) and cartao_nome.strip():
                    cartao_id = cartoes.get(cartao_nome.strip())
                
                # Se não tem cartão, usar primeira conta disponível
                if not cartao_id and contas:
                    conta_id = list(contas.values())[0]
                
                # Tipo
                tipo = row['Tipo'].upper() if not pd.isna(row['Tipo']) else 'SAIDA'
                if tipo not in ['ENTRADA', 'SAIDA']:
                    tipo = 'SAIDA'
                
                # Criar transação
                transacao = Transacao(
                    descricao=descricao,
                    valor=float(row['Valor']),
                    tipo=TipoTransacao(tipo),
                    data=data_transacao,
                    categoria_id=categoria_id,
                    cartao_id=cartao_id,
                    conta_id=conta_id,
                    tenant_id=current_user.tenant_id,
                    processado_por_ia=True,
                    prompt_original=f"Importação Excel - linha {index + 2}",
                    created_by_name=f"Importação Excel ({current_user.first_name} {current_user.last_name})".strip() or f"Importação Excel ({current_user.email})"
                )
                
                db.add(transacao)
                db.flush()
                
                transacoes_criadas.append({
                    'linha': index + 2,
                    'descricao': descricao,
                    'valor': row['Valor'],
                    'categoria': categoria_nome,
                    'id': transacao.id
                })
                
            except Exception as e:
                logger.error(f"Erro ao processar linha {index + 2}: {e}")
                transacoes_com_erro.append({
                    'linha': index + 2,
                    'erro': str(e)
                })
        
        # Commit final
        db.commit()
        
        return {
            "message": f"Processamento concluído: {len(transacoes_criadas)} transações criadas",
            "transacoes_criadas": len(transacoes_criadas),
            "transacoes_com_erro": len(transacoes_com_erro),
            "detalhes": {
                "sucessos": transacoes_criadas,
                "erros": transacoes_com_erro
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro no upload Excel: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar arquivo: {str(e)}"
        ) 