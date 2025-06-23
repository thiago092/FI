from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func, extract
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import math

from ..models.financiamento import (
    Financiamento, 
    ParcelaFinanciamento, 
    ConfirmacaoFinanciamento, 
    SimulacaoFinanciamento,
    TipoFinanciamento, 
    SistemaAmortizacao, 
    StatusFinanciamento, 
    StatusParcela
)
from ..models.financial import Transacao, Categoria, Conta, TipoTransacao

class FinanciamentoService:
    """
    Service para gerenciamento completo de financiamentos
    Inclui simulações, cálculos de amortização e controle de pagamentos
    """
    
    @staticmethod
    def calcular_price(valor_financiado: float, taxa_mensal: float, parcelas: int, 
                      data_inicio: date, seguro_mensal: float = 0) -> List[Dict]:
        """
        Calcula tabela de amortização pelo sistema PRICE (Francês)
        Parcelas fixas com amortização crescente e juros decrescentes
        ATENÇÃO: taxa_mensal vem em PERCENTUAL (ex: 1.0 para 1%)
        """
        taxa = taxa_mensal / 100  # Converter percentual para decimal
        
        # PMT - Cálculo da parcela fixa
        if taxa == 0:
            parcela_fixa = valor_financiado / parcelas
        else:
            parcela_fixa = valor_financiado * (taxa * (1 + taxa)**parcelas) / ((1 + taxa)**parcelas - 1)
        
        tabela = []
        saldo = valor_financiado
        data_atual = data_inicio
        
        for i in range(1, parcelas + 1):
            juros = saldo * taxa
            amortizacao = parcela_fixa - juros
            saldo_final = saldo - amortizacao
            
            # Garantir que última parcela quite exatamente
            if i == parcelas:
                amortizacao = saldo
                saldo_final = 0
                parcela_total = juros + amortizacao
            else:
                parcela_total = parcela_fixa
            
            tabela.append({
                'numero': i,
                'data_vencimento': data_atual,
                'saldo_inicial': round(saldo, 2),
                'amortizacao': round(amortizacao, 2),
                'juros': round(juros, 2),
                'seguro': round(seguro_mensal, 2),
                'valor_parcela': round(parcela_total + seguro_mensal, 2),
                'saldo_final': round(saldo_final, 2),
                'porcentagem_amortizada': round(((valor_financiado - saldo_final) / valor_financiado) * 100, 2)
            })
            
            saldo = saldo_final
            data_atual = FinanciamentoService._adicionar_mes(data_atual)
        
        return tabela
    
    @staticmethod
    def calcular_sac(valor_financiado: float, taxa_mensal: float, parcelas: int, 
                     data_inicio: date, seguro_mensal: float = 0) -> List[Dict]:
        """
        Calcula tabela de amortização pelo sistema SAC
        Amortização constante com parcelas decrescentes
        """
        taxa = taxa_mensal / 100
        amortizacao_fixa = valor_financiado / parcelas
        
        tabela = []
        saldo = valor_financiado
        data_atual = data_inicio
        
        for i in range(1, parcelas + 1):
            juros = saldo * taxa
            
            # Garantir que última parcela quite exatamente
            if i == parcelas:
                amortizacao = saldo
                saldo_final = 0
            else:
                amortizacao = amortizacao_fixa
                saldo_final = saldo - amortizacao
            
            parcela_total = amortizacao + juros
            
            tabela.append({
                'numero': i,
                'data_vencimento': data_atual,
                'saldo_inicial': round(saldo, 2),
                'amortizacao': round(amortizacao, 2),
                'juros': round(juros, 2),
                'seguro': round(seguro_mensal, 2),
                'valor_parcela': round(parcela_total + seguro_mensal, 2),
                'saldo_final': round(saldo_final, 2),
                'porcentagem_amortizada': round(((valor_financiado - saldo_final) / valor_financiado) * 100, 2)
            })
            
            saldo = saldo_final
            data_atual = FinanciamentoService._adicionar_mes(data_atual)
        
        return tabela
    
    @staticmethod
    def calcular_sacre(valor_financiado: float, taxa_mensal: float, parcelas: int, 
                       data_inicio: date, seguro_mensal: float = 0) -> List[Dict]:
        """
        Calcula tabela de amortização pelo sistema SACRE (Misto)
        Combina características do PRICE e SAC
        """
        # Para SACRE, fazemos uma média ponderada entre PRICE e SAC
        # Primeiro terço: mais parecido com PRICE
        # Segundo terço: transição
        # Último terço: mais parecido com SAC
        
        tabela_price = FinanciamentoService.calcular_price(valor_financiado, taxa_mensal, parcelas, data_inicio, seguro_mensal)
        tabela_sac = FinanciamentoService.calcular_sac(valor_financiado, taxa_mensal, parcelas, data_inicio, seguro_mensal)
        
        tabela = []
        for i in range(parcelas):
            if i < parcelas // 3:  # Primeiro terço - 70% PRICE, 30% SAC
                peso_price = 0.7
            elif i < 2 * parcelas // 3:  # Segundo terço - 50% cada
                peso_price = 0.5
            else:  # Último terço - 30% PRICE, 70% SAC
                peso_price = 0.3
            
            peso_sac = 1 - peso_price
            
            amortizacao = (tabela_price[i]['amortizacao'] * peso_price + 
                          tabela_sac[i]['amortizacao'] * peso_sac)
            juros = (tabela_price[i]['juros'] * peso_price + 
                    tabela_sac[i]['juros'] * peso_sac)
            valor_parcela = amortizacao + juros + seguro_mensal
            
            # Recalcular saldo baseado na amortização
            if i == 0:
                saldo_inicial = valor_financiado
            else:
                saldo_inicial = tabela[i-1]['saldo_final']
            
            saldo_final = saldo_inicial - amortizacao
            
            tabela.append({
                'numero': i + 1,
                'data_vencimento': tabela_price[i]['data_vencimento'],
                'saldo_inicial': round(saldo_inicial, 2),
                'amortizacao': round(amortizacao, 2),
                'juros': round(juros, 2),
                'seguro': round(seguro_mensal, 2),
                'valor_parcela': round(valor_parcela, 2),
                'saldo_final': round(saldo_final, 2),
                'porcentagem_amortizada': round(((valor_financiado - saldo_final) / valor_financiado) * 100, 2)
            })
        
        return tabela
    
    @staticmethod
    def calcular_americano(valor_financiado: float, taxa_mensal: float, parcelas: int, 
                          data_inicio: date, seguro_mensal: float = 0) -> List[Dict]:
        """
        Calcula tabela de amortização pelo sistema AMERICANO
        Só juros durante o período + principal no final
        """
        taxa = taxa_mensal / 100
        juros_fixos = valor_financiado * taxa
        
        tabela = []
        data_atual = data_inicio
        
        for i in range(1, parcelas + 1):
            if i == parcelas:  # Última parcela - principal + juros
                amortizacao = valor_financiado
                saldo_final = 0
                valor_parcela = amortizacao + juros_fixos + seguro_mensal
            else:  # Parcelas intermediárias - só juros
                amortizacao = 0
                saldo_final = valor_financiado
                valor_parcela = juros_fixos + seguro_mensal
            
            tabela.append({
                'numero': i,
                'data_vencimento': data_atual,
                'saldo_inicial': valor_financiado,
                'amortizacao': round(amortizacao, 2),
                'juros': round(juros_fixos, 2),
                'seguro': round(seguro_mensal, 2),
                'valor_parcela': round(valor_parcela, 2),
                'saldo_final': round(saldo_final, 2),
                'porcentagem_amortizada': round(((valor_financiado - saldo_final) / valor_financiado) * 100, 2)
            })
            
            data_atual = FinanciamentoService._adicionar_mes(data_atual)
        
        return tabela
    
    @staticmethod
    def simular_financiamento(
        valor_financiado: float,
        prazo_meses: int,
        taxa_juros_anual: float,
        sistema_amortizacao: SistemaAmortizacao,
        data_inicio: date,
        carencia_meses: int = 0,
        taxa_seguro_mensal: float = 0,
        taxa_administrativa: float = 0,
        renda_comprovada: float = None
    ) -> Dict[str, Any]:
        """
        Simula um financiamento completo com diferentes sistemas de amortização
        ENTRADA: taxa_juros_anual em PERCENTUAL (ex: 12.5 para 12.5% ao ano)
        """
        print(f"🔢 Simulação iniciada: valor={valor_financiado}, taxa_anual={taxa_juros_anual}%, prazo={prazo_meses} meses")
        
        # CORREÇÃO: Converter taxa anual para mensal CORRETAMENTE
        # A API já passa a taxa anual em percentual, precisamos converter para mensal em percentual também
        taxa_mensal_percentual = ((1 + taxa_juros_anual/100)**(1/12) - 1) * 100
        
        print(f"📊 Taxa mensal calculada: {taxa_mensal_percentual:.4f}%")
        
        # Aplicar taxa administrativa no valor financiado
        valor_com_taxa = valor_financiado + taxa_administrativa
        
        # Calcular tabela de amortização baseada no sistema
        # IMPORTANTE: Passamos taxa_mensal_percentual (já em %) para os métodos de cálculo
        if sistema_amortizacao == SistemaAmortizacao.PRICE:
            tabela = FinanciamentoService.calcular_price(valor_com_taxa, taxa_mensal_percentual, prazo_meses, data_inicio, taxa_seguro_mensal)
        elif sistema_amortizacao == SistemaAmortizacao.SAC:
            tabela = FinanciamentoService.calcular_sac(valor_com_taxa, taxa_mensal_percentual, prazo_meses, data_inicio, taxa_seguro_mensal)
        elif sistema_amortizacao == SistemaAmortizacao.SACRE:
            tabela = FinanciamentoService.calcular_sacre(valor_com_taxa, taxa_mensal_percentual, prazo_meses, data_inicio, taxa_seguro_mensal)
        elif sistema_amortizacao == SistemaAmortizacao.AMERICANO:
            tabela = FinanciamentoService.calcular_americano(valor_com_taxa, taxa_mensal_percentual, prazo_meses, data_inicio, taxa_seguro_mensal)
        else:  # BULLET - pagamento único no final
            taxa_mensal_decimal = taxa_mensal_percentual / 100
            tabela = [{
                'numero': 1,
                'data_vencimento': FinanciamentoService._adicionar_meses(data_inicio, prazo_meses),
                'saldo_inicial': valor_com_taxa,
                'amortizacao': valor_com_taxa,
                'juros': valor_com_taxa * taxa_mensal_decimal * prazo_meses,
                'seguro': taxa_seguro_mensal * prazo_meses,
                'valor_parcela': valor_com_taxa * (1 + taxa_mensal_decimal * prazo_meses) + (taxa_seguro_mensal * prazo_meses),
                'saldo_final': 0,
                'porcentagem_amortizada': 100
            }]
        
        # Calcular resumo
        valores_parcelas = [p['valor_parcela'] for p in tabela]
        total_juros = sum(p['juros'] for p in tabela)
        total_seguros = sum(p['seguro'] for p in tabela)
        valor_total_pago = sum(valores_parcelas)
        
        resumo = {
            'valor_financiado': valor_financiado,
            'valor_com_taxas': valor_com_taxa,
            'valor_total_pago': round(valor_total_pago, 2),
            'total_juros': round(total_juros, 2),
            'total_seguros': round(total_seguros, 2),
            'primeira_parcela': round(valores_parcelas[0], 2),
            'ultima_parcela': round(valores_parcelas[-1], 2),
            'parcela_menor': round(min(valores_parcelas), 2),
            'parcela_maior': round(max(valores_parcelas), 2),
            'taxa_mensal_efetiva': round(taxa_mensal_percentual, 4),
            'taxa_administrativa': taxa_administrativa
        }
        
        # Calcular comprometimento de renda se informado
        if renda_comprovada:
            comprometimento = (resumo['parcela_maior'] / renda_comprovada) * 100
            resumo['comprometimento_renda'] = round(comprometimento, 2)
            resumo['renda_minima_sugerida'] = round(resumo['parcela_maior'] / 0.30, 2)  # Máximo 30% da renda
        
        print(f"✅ Simulação concluída: {len(tabela)} parcelas, valor total: R$ {valor_total_pago:.2f}")
        
        return {
            'sistema_amortizacao': sistema_amortizacao,
            'resumo': resumo,
            'parcelas': tabela,
            'parametros': {
                'valor_financiado': valor_financiado,
                'prazo_meses': prazo_meses,
                'taxa_juros_anual': taxa_juros_anual,
                'taxa_juros_mensal': round(taxa_mensal_percentual, 4),
                'carencia_meses': carencia_meses,
                'taxa_seguro_mensal': taxa_seguro_mensal,
                'taxa_administrativa': taxa_administrativa,
                'data_inicio': data_inicio.isoformat()
            }
        }
    
    @staticmethod
    def comparar_sistemas(
        valor_financiado: float,
        prazo_meses: int,
        taxa_juros_anual: float,
        data_inicio: date,
        sistemas: List[SistemaAmortizacao] = None
    ) -> Dict[str, Any]:
        """
        Compara diferentes sistemas de amortização para o mesmo financiamento
        """
        if sistemas is None:
            sistemas = [SistemaAmortizacao.PRICE, SistemaAmortizacao.SAC, SistemaAmortizacao.SACRE]
        
        comparacao = {}
        simulacoes = {}
        
        for sistema in sistemas:
            simulacao = FinanciamentoService.simular_financiamento(
                valor_financiado, prazo_meses, taxa_juros_anual, sistema, data_inicio
            )
            simulacoes[sistema.value] = simulacao
            comparacao[sistema.value] = simulacao['resumo']
        
        # Encontrar o melhor sistema (menor valor total pago)
        melhor_sistema = min(comparacao.keys(), key=lambda k: comparacao[k]['valor_total_pago'])
        
        # Calcular economia em relação ao PRICE (referência)
        if SistemaAmortizacao.PRICE in sistemas:
            valor_price = comparacao[SistemaAmortizacao.PRICE.value]['valor_total_pago']
            for sistema in comparacao:
                if sistema != SistemaAmortizacao.PRICE.value:
                    economia = valor_price - comparacao[sistema]['valor_total_pago']
                    comparacao[sistema]['economia_vs_price'] = round(economia, 2)
        
        return {
            'comparacao_resumo': comparacao,
            'simulacoes_completas': simulacoes,
            'melhor_sistema': melhor_sistema,
            'parametros_base': {
                'valor_financiado': valor_financiado,
                'prazo_meses': prazo_meses,
                'taxa_juros_anual': taxa_juros_anual,
                'data_inicio': data_inicio.isoformat()
            }
        }
    
    @staticmethod
    def criar_financiamento_com_parcelas(
        db: Session,
        dados_financiamento: Dict[str, Any],
        tenant_id: int,
        user_name: str = "Sistema"
    ) -> Financiamento:
        """
        Cria um financiamento completo com todas as parcelas calculadas
        Baseado na simulação aprovada
        """
        try:
            # CORREÇÃO 1: Validar dados essenciais antes de prosseguir
            required_fields = ['valor_financiado', 'numero_parcelas', 'taxa_juros_anual', 'data_primeira_parcela']
            for field in required_fields:
                if field not in dados_financiamento or dados_financiamento[field] is None:
                    raise ValueError(f"Campo obrigatório '{field}' não foi fornecido")
            
            # CORREÇÃO 2: Garantir que temos taxa_juros_mensal em decimal (não percentual)
            taxa_mensal_decimal = dados_financiamento.get('taxa_juros_mensal')
            if taxa_mensal_decimal is None or taxa_mensal_decimal == 0:
                # Recalcular se não foi fornecida ou está zerada
                taxa_anual = dados_financiamento['taxa_juros_anual']
                taxa_mensal_decimal = (1 + taxa_anual / 100) ** (1/12) - 1
                dados_financiamento['taxa_juros_mensal'] = taxa_mensal_decimal
            
            # CORREÇÃO 3: Calcular valor da primeira parcela corretamente
            valor_financiado = float(dados_financiamento['valor_financiado'])
            numero_parcelas = int(dados_financiamento['numero_parcelas'])
            sistema = dados_financiamento.get('sistema_amortizacao', 'PRICE')
            
            # CORREÇÃO 4: Usar taxa em decimal (não percentual) para cálculo
            valor_parcela = FinanciamentoService._calcular_valor_parcela_inicial(
                valor_financiado=valor_financiado,
                taxa_mensal=taxa_mensal_decimal,  # DECIMAL, não percentual
                numero_parcelas=numero_parcelas,
                sistema_amortizacao=sistema
            )
            
            # Adicionar valor_parcela aos dados
            dados_financiamento['valor_parcela'] = valor_parcela
            
            # CORREÇÃO 5: Criar registro principal com validação
            financiamento = Financiamento(
                **dados_financiamento,
                tenant_id=tenant_id,
                saldo_devedor=dados_financiamento['valor_financiado']
            )
            
            db.add(financiamento)
            db.flush()  # Para obter o ID
            
            # CORREÇÃO 6: Simular usando os mesmos parâmetros da criação
            print(f"📊 Iniciando simulação para financiamento ID {financiamento.id}")
            simulacao = FinanciamentoService.simular_financiamento(
                valor_financiado=float(financiamento.valor_financiado),
                prazo_meses=int(financiamento.numero_parcelas),
                taxa_juros_anual=float(financiamento.taxa_juros_anual),
                sistema_amortizacao=SistemaAmortizacao(financiamento.sistema_amortizacao),
                data_inicio=financiamento.data_primeira_parcela,
                taxa_seguro_mensal=float(financiamento.taxa_seguro_mensal or 0),
                taxa_administrativa=float(financiamento.taxa_administrativa or 0)
            )
            
            # CORREÇÃO 7: Criar parcelas com nomes de campos CORRETOS
            print(f"📝 Criando {len(simulacao['parcelas'])} parcelas...")
            for i, parcela_data in enumerate(simulacao['parcelas']):
                try:
                    parcela = ParcelaFinanciamento(
                        financiamento_id=financiamento.id,
                        numero_parcela=parcela_data['numero'],
                        data_vencimento=parcela_data['data_vencimento'],
                        # CORREÇÃO: Usar nomes corretos dos campos
                        saldo_inicial_simulado=parcela_data.get('saldo_inicial', 0),
                        amortizacao_simulada=parcela_data.get('amortizacao', 0),
                        juros_simulados=parcela_data.get('juros', 0),
                        seguro_simulado=parcela_data.get('seguro', 0),
                        valor_parcela_simulado=parcela_data.get('valor_parcela', 0),
                        saldo_final_simulado=parcela_data.get('saldo_final', 0),
                        tenant_id=tenant_id
                    )
                    db.add(parcela)
                    
                except Exception as e:
                    print(f"🔥 Erro ao criar parcela {i+1}: {str(e)}")
                    print(f"🔥 Dados da parcela: {parcela_data}")
                    raise
            
            db.commit()
            db.refresh(financiamento)
            
            print(f"✅ Financiamento criado com sucesso: ID {financiamento.id}")
            return financiamento
            
        except Exception as e:
            print(f"🔥 Erro na criação do financiamento: {str(e)}")
            db.rollback()
            raise
    
    @staticmethod
    def registrar_pagamento_parcela(
        db: Session,
        parcela_id: int,
        valor_pago: float,
        data_pagamento: date,
        tenant_id: int,
        categoria_id: int,
        conta_id: int = None,
        cartao_id: int = None,
        observacoes: str = None,
        comprovante_path: str = None
    ) -> Tuple[ParcelaFinanciamento, Transacao]:
        """
        Registra o pagamento de uma parcela de financiamento
        Cria transação automática e atualiza status
        """
        # Buscar a parcela
        parcela = db.query(ParcelaFinanciamento).filter(
            ParcelaFinanciamento.id == parcela_id,
            ParcelaFinanciamento.tenant_id == tenant_id
        ).first()
        
        if not parcela:
            raise ValueError("Parcela não encontrada")
        
        if parcela.status == StatusParcela.PAGA:
            raise ValueError("Parcela já foi paga")
        
        # Calcular juros de atraso se necessário
        hoje = date.today()
        juros_atraso = 0
        dias_atraso = 0
        
        if data_pagamento > parcela.data_vencimento:
            dias_atraso = (data_pagamento - parcela.data_vencimento).days
            # Juros de atraso: 1% ao mês (0.033% ao dia)
            juros_atraso = float(parcela.valor_parcela_simulado) * 0.0033 * dias_atraso
        
        # Verificar desconto para quitação antecipada
        desconto_quitacao = 0
        if data_pagamento < parcela.data_vencimento:
            # Desconto de 0.5% para pagamento antecipado
            desconto_quitacao = float(parcela.valor_parcela_simulado) * 0.005
        
        valor_final = valor_pago + juros_atraso - desconto_quitacao
        
        # Criar transação
        transacao = Transacao(
            descricao=f"Pagamento parcela {parcela.numero_parcela}/{parcela.financiamento.numero_parcelas} - {parcela.financiamento.descricao}",
            valor=valor_final,
            tipo=TipoTransacao.SAIDA,
            data=datetime.combine(data_pagamento, datetime.min.time()),
            categoria_id=categoria_id,
            conta_id=conta_id,
            cartao_id=cartao_id,
            observacoes=observacoes,
            tenant_id=tenant_id,
            is_financiamento=True,
            parcela_financiamento_id=parcela_id
        )
        
        db.add(transacao)
        db.flush()
        
        # Atualizar parcela
        parcela.data_pagamento = data_pagamento
        parcela.valor_pago_real = valor_pago
        parcela.juros_multa_atraso = juros_atraso
        parcela.desconto_quitacao = desconto_quitacao
        parcela.status = StatusParcela.PAGA
        parcela.dias_atraso = dias_atraso
        parcela.comprovante_path = comprovante_path
        parcela.transacao_id = transacao.id
        
        # Atualizar financiamento
        financiamento = parcela.financiamento
        financiamento.saldo_devedor -= parcela.amortizacao_simulada
        financiamento.parcelas_pagas += 1
        
        # Verificar se foi quitado
        if financiamento.parcelas_pagas >= financiamento.numero_parcelas:
            financiamento.status = StatusFinanciamento.QUITADO
        
        db.commit()
        
        return parcela, transacao
    
    @staticmethod
    def simular_quitacao_antecipada(
        db: Session,
        financiamento_id: int,
        data_quitacao: date,
        tenant_id: int
    ) -> Dict[str, Any]:
        """
        Simula quitação antecipada de um financiamento
        """
        financiamento = db.query(Financiamento).filter(
            Financiamento.id == financiamento_id,
            Financiamento.tenant_id == tenant_id
        ).first()
        
        if not financiamento:
            raise ValueError("Financiamento não encontrado")
        
        # Buscar parcelas pendentes
        parcelas_pendentes = db.query(ParcelaFinanciamento).filter(
            ParcelaFinanciamento.financiamento_id == financiamento_id,
            ParcelaFinanciamento.status == StatusParcela.PENDENTE,
            ParcelaFinanciamento.data_vencimento >= data_quitacao
        ).all()
        
        if not parcelas_pendentes:
            return {
                'ja_quitado': True,
                'mensagem': 'Financiamento já está quitado'
            }
        
        # Calcular valor para quitação
        saldo_devedor_atual = float(financiamento.saldo_devedor)
        
        # Desconto para quitação antecipada (5% sobre juros futuros)
        juros_futuros = sum(float(p.juros_simulados) for p in parcelas_pendentes)
        desconto_juros = juros_futuros * 0.05
        
        valor_quitacao = saldo_devedor_atual - desconto_juros
        
        # Economia total
        valor_sem_quitacao = sum(float(p.valor_parcela_simulado) for p in parcelas_pendentes)
        economia_total = valor_sem_quitacao - valor_quitacao
        
        return {
            'financiamento_id': financiamento_id,
            'data_quitacao': data_quitacao.isoformat(),
            'saldo_devedor_atual': saldo_devedor_atual,
            'valor_quitacao': round(valor_quitacao, 2),
            'economia_juros': round(economia_total, 2),
            'valor_total_sem_quitacao': round(valor_sem_quitacao, 2),
            'porcentagem_economia': round((economia_total / valor_sem_quitacao) * 100, 2),
            'parcelas_quitadas': len(parcelas_pendentes),
            'desconto_aplicado': round(desconto_juros, 2)
        }
    
    @staticmethod
    def obter_dashboard_financiamentos(db: Session, tenant_id: int) -> Dict[str, Any]:
        """
        Gera dashboard completo dos financiamentos do tenant
        """
        # Buscar todos os financiamentos
        financiamentos = db.query(Financiamento).filter(
            Financiamento.tenant_id == tenant_id
        ).all()
        
        if not financiamentos:
            return {
                'total_financiado': 0,
                'total_ja_pago': 0,
                'saldo_devedor': 0,
                'financiamentos_ativos': 0,
                'financiamentos_quitados': 0,
                'valor_mes_atual': 0,
                'proximos_vencimentos': [],
                'media_juros_carteira': 0
            }
        
        # Calcular métricas
        ativos = [f for f in financiamentos if f.status == StatusFinanciamento.ATIVO]
        quitados = [f for f in financiamentos if f.status == StatusFinanciamento.QUITADO]
        
        total_financiado = sum(float(f.valor_financiado) for f in financiamentos)
        saldo_devedor = sum(float(f.saldo_devedor) for f in ativos)
        total_ja_pago = total_financiado - saldo_devedor
        
        # Parcelas do mês atual
        hoje = date.today()
        inicio_mes = hoje.replace(day=1)
        fim_mes = (inicio_mes + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        
        parcelas_mes = db.query(ParcelaFinanciamento).filter(
            ParcelaFinanciamento.tenant_id == tenant_id,
            ParcelaFinanciamento.data_vencimento.between(inicio_mes, fim_mes),
            ParcelaFinanciamento.status.in_([StatusParcela.PENDENTE, StatusParcela.VENCIDA])
        ).all()
        
        valor_mes_atual = sum(float(p.valor_parcela_simulado) for p in parcelas_mes)
        
        # Próximos vencimentos (próximos 30 dias)
        limite_vencimentos = hoje + timedelta(days=30)
        proximos_vencimentos = db.query(ParcelaFinanciamento).filter(
            ParcelaFinanciamento.tenant_id == tenant_id,
            ParcelaFinanciamento.data_vencimento.between(hoje, limite_vencimentos),
            ParcelaFinanciamento.status.in_([StatusParcela.PENDENTE, StatusParcela.VENCIDA])
        ).order_by(ParcelaFinanciamento.data_vencimento).limit(10).all()
        
        # Média de juros da carteira
        if ativos:
            media_juros = sum(float(f.taxa_juros_anual) for f in ativos) / len(ativos)
        else:
            media_juros = 0
        
        return {
            'total_financiado': round(total_financiado, 2),
            'total_ja_pago': round(total_ja_pago, 2),
            'saldo_devedor': round(saldo_devedor, 2),
            'financiamentos_ativos': len(ativos),
            'financiamentos_quitados': len(quitados),
            'valor_mes_atual': round(valor_mes_atual, 2),
            'proximos_vencimentos': [
                {
                    'financiamento_id': p.financiamento_id,
                    'financiamento_nome': p.financiamento.descricao,
                    'numero_parcela': p.numero_parcela,
                    'valor': float(p.valor_parcela_simulado),
                    'data_vencimento': p.data_vencimento.isoformat(),
                    'status': p.status.value,
                    'dias_para_vencimento': (p.data_vencimento - hoje).days
                }
                for p in proximos_vencimentos
            ],
            'media_juros_carteira': round(media_juros, 2)
        }
    
    @staticmethod
    def _adicionar_mes(data: date) -> date:
        """Adiciona um mês à data, mantendo o mesmo dia"""
        if data.month == 12:
            return data.replace(year=data.year + 1, month=1)
        else:
            try:
                return data.replace(month=data.month + 1)
            except ValueError:  # Para casos como 31/01 -> 28/02
                next_month = data.replace(month=data.month + 1, day=1)
                return next_month.replace(day=min(data.day, 
                    (next_month.replace(month=next_month.month + 1) - timedelta(days=1)).day))
    
    @staticmethod
    def _adicionar_meses(data: date, meses: int) -> date:
        """Adiciona múltiplos meses à data"""
        result = data
        for _ in range(meses):
            result = FinanciamentoService._adicionar_mes(result)
        return result
    
    @staticmethod
    def _calcular_valor_parcela_inicial(
        valor_financiado: float,
        taxa_mensal: float,
        numero_parcelas: int,
        sistema_amortizacao: str
    ) -> float:
        """
        Calcula o valor da primeira parcela baseado no sistema de amortização
        ATENÇÃO: taxa_mensal deve estar em decimal (ex: 0.01 para 1%), não em percentual
        """
        print(f"📊 Calculando parcela inicial: valor={valor_financiado}, taxa={taxa_mensal}, parcelas={numero_parcelas}, sistema={sistema_amortizacao}")
        
        if sistema_amortizacao == "PRICE":
            # PRICE: Parcelas fixas
            if taxa_mensal == 0:
                resultado = valor_financiado / numero_parcelas
            else:
                # taxa_mensal já está em decimal (0.01 para 1%)
                resultado = valor_financiado * (taxa_mensal * (1 + taxa_mensal)**numero_parcelas) / ((1 + taxa_mensal)**numero_parcelas - 1)
        
        elif sistema_amortizacao == "SAC":
            # SAC: Primeira parcela (maior valor)
            amortizacao = valor_financiado / numero_parcelas
            # taxa_mensal já está em decimal
            juros = valor_financiado * taxa_mensal
            resultado = amortizacao + juros
        
        elif sistema_amortizacao == "SACRE":
            # SACRE: Simplificado como PRICE
            if taxa_mensal == 0:
                resultado = valor_financiado / numero_parcelas
            else:
                # taxa_mensal já está em decimal
                resultado = valor_financiado * (taxa_mensal * (1 + taxa_mensal)**numero_parcelas) / ((1 + taxa_mensal)**numero_parcelas - 1)
        
        elif sistema_amortizacao == "AMERICANO":
            # AMERICANO: Só juros (exceto última parcela)
            # taxa_mensal já está em decimal
            resultado = valor_financiado * taxa_mensal
        
        elif sistema_amortizacao == "BULLET":
            # BULLET: Sem pagamentos durante o período
            resultado = 0
        
        else:
            # Default: PRICE
            if taxa_mensal == 0:
                resultado = valor_financiado / numero_parcelas
            else:
                # taxa_mensal já está em decimal
                resultado = valor_financiado * (taxa_mensal * (1 + taxa_mensal)**numero_parcelas) / ((1 + taxa_mensal)**numero_parcelas - 1)
        
        print(f"✅ Parcela inicial calculada: R$ {resultado:.2f}")
        return round(resultado, 2)