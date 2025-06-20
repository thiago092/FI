# 🕒 Configuração do Cron Job Online - Guia Simplificado

## 🎯 Objetivo
Configurar notificações automáticas do FinançasAI usando o **mesmo padrão** do agendador que já está funcionando.

## 📋 Pré-requisitos
- ✅ Sistema de notificações implementado (backend + frontend)
- ✅ App funcionando no Azure
- ✅ URL do seu app Azure (ex: https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net)

## 🚀 Método Simplificado (Sem configuração extra!)

### Usando o mesmo padrão do agendador que já funciona

**URL para configurar no cron-job.org:**
```
https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/notifications/webhook/executar?webhook_key=financas-ai-webhook-2024
```

## 🌐 Passo 1: Configurar no Cron-Job.org

### 1.1 Criar Cron Job
1. **Acesse seu painel:** https://cron-job.org/en/
2. **Clique em:** "Create cronjob"
3. **Preencha os campos:**

```
Title: FinançasAI - Notificações Automáticas
URL: https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/notifications/webhook/executar?webhook_key=financas-ai-webhook-2024
Method: POST
Schedule: Every hour (0 */1 * * *)
Timeout: 30 seconds
```

4. **Salve o cron job**

⚠️ **IMPORTANTE:** Use a MESMA URL do seu app (substitua pela sua URL real)

### 1.2 Configuração de Schedule (Horário)
- **A cada hora:** `0 */1 * * *` (recomendado)
- **A cada 30 min:** `*/30 * * * *`
- **Apenas de dia (7h-22h):** `0 7-22 * * *`

## 🧪 Passo 2: Testar

### 2.1 Teste Manual via Navegador/Curl
```bash
# Teste via curl
curl -X POST "https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/notifications/webhook/executar?webhook_key=financas-ai-webhook-2024"

# Ou copie e cole no navegador (método POST)
https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/notifications/webhook/executar?webhook_key=financas-ai-webhook-2024
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Webhook de notificações executado com sucesso",
  "data": {
    "webhook_execution": true,
    "data_execucao": "2024-01-15T10:30:00",
    "tipo": "notificacoes_automaticas"
  }
}
```

### 2.2 Teste no Cron-Job.org
1. **No painel do cron-job.org**
2. **Clique no seu job**
3. **Clique em:** "Execute now"
4. **Verifique** se o status fica verde (success - 200 OK)

### 2.3 Teste no App
1. **Configure uma notificação** no frontend
2. **Aguarde** a próxima execução
3. **Verifique** se chegou no Telegram

## 📊 Passo 3: Monitoramento

### 3.1 Logs do Cron-Job.org
- **Dashboard:** Mostra últimas execuções (igual ao agendador)
- **History:** Histórico detalhado
- **Status codes:** 200 = sucesso, 4xx/5xx = erro

### 3.2 Verificar no Telegram
- **Notificações** devem chegar nos horários configurados
- **Teste** com diferentes tipos (daily, weekly, monthly)

### 3.3 Status do Sistema
```bash
# Verificar status das notificações
https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/notifications/webhook/status?webhook_key=financas-ai-webhook-2024
```

## 🚨 Solução de Problemas

### Problema: Status 401 (Unauthorized)
**Causa:** webhook_key incorreta
**Solução:** 
1. Verificar se a URL está com `?webhook_key=financas-ai-webhook-2024`
2. Usar exatamente a mesma chave do agendador

### Problema: Status 500 (Internal Server Error)
**Causa:** Erro interno na aplicação
**Solução:**
1. Verificar se todos os usuários têm telegram_id
2. Testar endpoint de status primeiro
3. Verificar logs do Azure

### Problema: Notificações não chegam
**Causa:** Usuários sem configuração ou Telegram desconectado
**Solução:**
1. Verificar se usuários têm `telegram_id`
2. Testar notificação manual no frontend
3. Verificar se há notificações configuradas e ativas

## ✅ Checklist Simplificado

- [ ] Cron job criado no cron-job.org com a URL webhook
- [ ] URL contém `?webhook_key=financas-ai-webhook-2024`
- [ ] Teste manual funcionando (Status 200 OK)
- [ ] Teste via cron-job.org funcionando
- [ ] Notificação de teste chegou no Telegram
- [ ] Status verde no painel do cron-job.org

## 🎉 Resultado Esperado

Após a configuração, o sistema:
1. **Executa automaticamente** a cada hora
2. **Busca usuários** com notificações agendadas
3. **Gera conteúdo** personalizado
4. **Envia via Telegram** nos horários corretos
5. **Registra logs** de sucesso/falha

## 🔄 Próximos Passos Opcionais

1. **Analytics:** Dashboards de notificações enviadas
2. **Alertas:** Notificação se cron job falhar
3. **Otimização:** Horários específicos por fuso horário
4. **Expansão:** Notificações por email ou WhatsApp

---

**📞 Suporte:** Se tiver problemas, verifique os logs do Azure e do cron-job.org primeiro! 