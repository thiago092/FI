# ⚡ Configuração Cron Job - Resumo Executivo

## 🎯 O que fazer (2 minutos)

**1. No cron-job.org, criar job com esta URL:**
```
https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/notifications/webhook/executar?webhook_key=financas-ai-webhook-2024
```

**2. Configurações:**
- Método: POST
- Frequência: A cada hora (0 */1 * * *)
- Timeout: 30 segundos

**3. Testar:**
- Clique "Execute now" no cron-job.org
- Deve retornar status 200 (verde)

**Pronto! ✅**

---

## 🔧 URL da sua aplicação

**Substituir por sua URL real:**
```
https://SUA_URL_AQUI.azurewebsites.net/api/notifications/webhook/executar?webhook_key=financas-ai-webhook-2024
```

**Exemplo com sua URL atual:**
```
https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net/api/notifications/webhook/executar?webhook_key=financas-ai-webhook-2024
```

---

## ✅ Como saber se está funcionando

1. **Status 200 OK** no cron-job.org
2. **Notificações chegando** no Telegram nos horários configurados
3. **Igual ao agendador** que já está funcionando diariamente

**Só isso! 🎉** 