# 🛡️ Estratégia de Backup e Rollback

## 📝 **Como Funciona**

Usamos **tags Git** para marcar versões estáveis da aplicação. Se algum deploy der problema, podemos reverter rapidamente para uma versão anterior.

## 🏷️ **Criar Nova Versão Estável**

Sempre que a aplicação estiver funcionando perfeitamente:

```bash
# 1. Criar tag da versão atual
git tag -a v1.1.0 -m "Release v1.1.0: Descrição das mudanças"

# 2. Enviar tag para o repositório
git push origin v1.1.0
```

## ⚡ **Rollback de Emergência**

Se algo der errado após um deploy:

### **Opção 1: Rollback Simples**
```bash
# 1. Ver versões disponíveis
git tag | cat

# 2. Voltar para versão anterior
git checkout v1.0.0

# 3. Forçar deploy da versão anterior
git checkout -b rollback-v1.0.0
git push origin rollback-v1.0.0

# 4. Fazer merge na main
git checkout main
git merge rollback-v1.0.0
git push origin main
```

### **Opção 2: Reset Completo (Mais Rápido)**
```bash
# 1. Reset da main para tag estável
git checkout main
git reset --hard v1.0.0
git push --force origin main
```

## 📋 **Histórico de Versões**

| Versão | Data | Descrição | Status |
|--------|------|-----------|--------|
| v1.0.0 | 2024-01-XX | Sistema completo com configurações otimizadas | ✅ Estável |

## 🎯 **Boas Práticas**

1. **Sempre criar tag** antes de mudanças grandes
2. **Testar localmente** antes do commit
3. **Documentar mudanças** na mensagem da tag
4. **Manter pelo menos 3 versões** estáveis
5. **Fazer rollback imediato** se detectar problema

## 🚨 **Em Caso de Emergência**

**Se o site estiver fora do ar:**

1. Execute: `git reset --hard v1.0.0`
2. Execute: `git push --force origin main`
3. O deploy automático irá restaurar a versão estável
4. **Tempo estimado**: 2-3 minutos

## 🔄 **Versionamento Sugerido**

- **v1.x.x** - Versões principais (mudanças grandes)
- **v1.1.x** - Versões secundárias (novas funcionalidades)
- **v1.1.1** - Patches (correções de bugs) 