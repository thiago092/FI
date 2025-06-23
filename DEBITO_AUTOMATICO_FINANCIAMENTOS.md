# 💳 Débito Automático de Financiamentos

## 📋 Resumo

Sistema completo de débito automático para parcelas de financiamentos, integrado ao agendador de transações existente.

## ✅ Funcionalidades Implementadas

### 🏦 Vinculação com Contas
- **`conta_id`**: Conta principal/original do financiamento
- **`conta_debito_id`**: Conta específica para débito automático
- **`auto_debito`**: Flag para ativar/desativar débito automático

### 🔄 Processamento Automático
- **Integração com AgendadorService**: Débitos processados junto com transações recorrentes
- **Cálculo inteligente de vencimentos**: Baseado no `dia_vencimento` configurado
- **Validações completas**: Verifica conta, parcela, transação existente
- **Tratamento de erros**: Logs detalhados e rollback em caso de falha

### 📊 Monitoramento e Logs
- **Estatísticas detalhadas**: Parcelas pagas, transações criadas, erros
- **Logs estruturados**: Para debug e auditoria
- **Endpoint de teste**: `/financiamentos/processar-debitos-automaticos`

## 🛠️ Implementação Técnica

### Backend

#### 1. Modelo de Dados
```python
# Financiamento
conta_debito_id = Column(Integer, ForeignKey("contas.id"), nullable=True)
auto_debito = Column(Boolean, default=False)
dia_vencimento = Column(Integer, nullable=True)
```

#### 2. Serviço de Agendamento
```python
# AgendadorService
@staticmethod
def processar_financiamentos_do_dia(data_processamento: date = None)
def _processar_financiamento_individual(db, financiamento, data_processamento)
```

#### 3. Integração com Cron
- Script `cron_agendador.py` atualizado
- Execução diária automática
- Logs detalhados no arquivo mensal

### Frontend

#### Interface de Criação
- ✅ Checkbox para ativar débito automático
- ✅ Seleção de conta para débito (aparece quando ativado)
- ✅ Validação: obriga seleção de conta se débito automático estiver ativo
- ✅ Aviso quando não há contas disponíveis

## 🚀 Como Usar

### 1. Criar Financiamento com Débito Automático
1. Acesse **Financiamentos** → **Novo Financiamento**
2. Preencha os dados normais
3. Marque **"Débito Automático"**
4. Selecione a **conta para débito**
5. Salve o financiamento

### 2. O Sistema Automaticamente:
- 📅 Verifica diariamente os vencimentos
- 💳 Debita da conta configurada
- 📝 Cria transação automática
- ✅ Marca parcela como paga
- 🔄 Atualiza saldo devedor

### 3. Monitoramento
- **Logs**: `backend/logs/agendador_YYYY-MM.log`
- **Teste manual**: `POST /financiamentos/processar-debitos-automaticos`

## 📋 Validações e Regras

### ✅ Quando Processa
- Financiamento com `auto_debito = true`
- Status `ativo`
- Conta de débito configurada
- Data de vencimento = hoje
- Parcela pendente disponível
- Transação não existe para hoje

### ❌ Quando NÃO Processa
- Débito automático desativado
- Conta de débito não encontrada
- Financiamento quitado
- Parcela já paga
- Transação já existe para hoje

## 🔧 Configuração do Cron Job

O sistema utiliza **dois scripts separados** para não interferir com transações recorrentes existentes:

### 1. Transações Recorrentes (existente)
```bash
# Script original - executa às 06:00
0 6 * * * cd /path/to/project && python backend/scripts/cron_agendador.py
```

### 2. Débitos Automáticos de Financiamentos (novo)
```bash
# Script específico para financiamentos - executa às 06:30
30 6 * * * cd /path/to/project && python backend/scripts/cron_financiamentos.py
```

### Estratégia de Separação
- **`cron_agendador.py`**: Mantém sistema original de recorrentes
- **`cron_financiamentos.py`**: Novo script específico para financiamentos
- **Logs separados**: `agendador_YYYY-MM.log` e `financiamentos_YYYY-MM.log`
- **Não há interferência** entre os sistemas

## 📊 Estatísticas Retornadas

```json
{
  "data_processamento": "2024-01-15",
  "total_financiamentos_auto_debito": 5,
  "processados": 5,
  "parcelas_pagas": 3,
  "transacoes_criadas": 3,
  "erros": 0,
  "detalhes": [...]
}
```

## 🎯 Status da Implementação

### ✅ Concluído
- [x] Modelo de dados
- [x] Lógica de processamento
- [x] Integração com agendador
- [x] Interface frontend
- [x] Validações completas
- [x] Logs e monitoramento
- [x] Endpoint de teste
- [x] Documentação

### 🚀 Pronto para Produção

O sistema está **100% funcional** e pronto para uso em produção. A vinculação de financiamentos com contas está completamente implementada e integrada.

## 📝 Exemplo de Log

```
2024-01-15 06:00:01 - INFO - 💳 Iniciando processamento de débitos automáticos para 2024-01-15
2024-01-15 06:00:02 - INFO - 💳 Débito automático processado: Financiamento Casa - R$ 1850.00
2024-01-15 06:00:03 - INFO - ✅ Processamento de financiamentos concluído: 2 parcelas pagas, 0 erros
``` 