# 📱 Sistema de Notificações Automáticas - Guia de Configuração

## 🎯 Visão Geral

O sistema de notificações automáticas permite enviar resumos financeiros via Telegram em horários personalizados pelos usuários.

## 🏗️ Componentes

### 1. **Backend**
- ✅ `NotificationService` - Processa e envia notificações
- ✅ `notification_preferences` - API CRUD para configurações
- ✅ `notifications` - API para testes e controle
- ✅ Banco de dados com preferências dos usuários

### 2. **Frontend**
- ✅ Interface em Settings > Notificações
- ✅ Configuração de horários e conteúdo
- ✅ Testes de notificação
- ✅ Status do Telegram automático

## 🔧 Configuração do Cron Job

### Método 1: Cron Unix/Linux
```bash
# Editar crontab
crontab -e

# Adicionar linha para executar a cada hora
0 * * * * cd /caminho/para/projeto && python backend/scripts/cron_notifications.py

# Ver logs
tail -f /tmp/notifications_cron.log
```

### Método 2: Webhook HTTP (Recomendado para Cloud)
```bash
# Configurar webhook externo (ex: cron-job.org)
# URL: https://seu-app.azurewebsites.net/api/notifications/process-now
# Método: POST
# Headers: Authorization: Bearer SEU_ADMIN_TOKEN
# Frequência: A cada hora (0 */1 * * *)
```

### Método 3: Azure Functions (Para Azure)
```yaml
# function.json
{
  "bindings": [
    {
      "name": "myTimer",
      "type": "timerTrigger",
      "direction": "in",
      "schedule": "0 0 * * * *"
    }
  ]
}
```

## 🧪 Como Testar

### 1. **Teste via Frontend**
1. Acesse Settings > Notificações
2. Configure uma notificação
3. Clique em "🧪 Testar"
4. Verifique no Telegram

### 2. **Teste via API**
```bash
# Testar notificação específica
curl -X POST "https://seu-app.com/api/notifications/test/daily" \
  -H "Authorization: Bearer SEU_TOKEN"

# Processar notificações agora (admin)
curl -X POST "https://seu-app.com/api/notifications/process-now" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 3. **Teste Manual do Cron**
```bash
# Executar script manualmente
cd backend
python scripts/cron_notifications.py
```

## 📊 Como Funciona

### Fluxo de Notificações:

1. **⏰ Trigger (a cada hora)**
   - Cron job ou webhook executa
   - `NotificationService.process_notifications()`

2. **🔍 Busca de Notificações**
   - Busca preferências ativas
   - Filtra por hora/dia/mês atual
   - Valida usuários autenticados

3. **📝 Geração de Conteúdo**
   - Saldo atual (se habilitado)
   - Transações do período (se habilitado)
   - Gastos por categoria (se habilitado)
   - Insights automáticos (se habilitado)

4. **📱 Envio via Telegram**
   - Utiliza `TelegramService.send_message()`
   - Log de sucesso/falha

### Tipos de Notificação:

- **🌅 Diária:** Todo dia no horário escolhido
- **📊 Semanal:** Dia da semana + horário específico
- **📈 Mensal:** Dia do mês + horário específico

## 🔧 Configurações Disponíveis

### Por Usuário:
- **Horário:** 0-23h
- **Dia da semana:** Domingo (0) a Sábado (6)
- **Dia do mês:** 1-28
- **Conteúdo:**
  - 💰 Saldo atual
  - 💳 Transações do período
  - 📊 Gastos por categoria
  - 💡 Insights automáticos

### Globais (admin):
- Intervalo de execução (padrão: 1 hora)
- Logs e monitoramento

## 📈 Monitoramento

### Logs:
```bash
# Cron logs
tail -f /tmp/notifications_cron.log

# App logs
tail -f backend/logs/app.log | grep notification

# Azure logs
az webapp log tail --name SEU_APP --resource-group SEU_RG
```

### Métricas:
- Número de notificações enviadas
- Taxa de sucesso/falha
- Usuários ativos
- Tipos mais usados

## 🚨 Solução de Problemas

### Problema: Notificações não chegam
1. ✅ Verificar se Telegram está vinculado
2. ✅ Verificar se preferência está ativa
3. ✅ Verificar horário/dia configurado
4. ✅ Verificar logs do cron
5. ✅ Testar endpoint manualmente

### Problema: Cron não executa
1. ✅ Verificar se crontab está configurado
2. ✅ Verificar permissões do script
3. ✅ Verificar path do Python
4. ✅ Usar webhook como alternativa

### Problema: Erro de banco
1. ✅ Verificar conexão DATABASE_URL
2. ✅ Verificar tabelas notification_preferences
3. ✅ Verificar dados de teste

## 🎉 Status Atual

✅ **Completamente Funcional:**
- Backend com NotificationService
- API endpoints para CRUD e teste
- Frontend com interface completa
- Scripts de cron job
- Sistema de teste integrado

🔄 **Próximos Passos (Opcionais):**
- Analytics de notificações
- Templates personalizados
- Notificações por email
- Integração com outros bots

## 📞 Suporte

- **Logs:** `/tmp/notifications_cron.log`
- **Teste:** Settings > Notificações > 🧪 Testar
- **Debug:** `/api/notifications/process-now` (admin) 