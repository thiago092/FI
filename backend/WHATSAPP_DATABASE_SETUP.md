# 📱 WhatsApp Database Setup - Azure PostgreSQL

## 🎯 O que precisa ser feito

Como adicionamos a integração WhatsApp Business API, precisamos criar a nova tabela `whatsapp_users` no banco de dados PostgreSQL de produção no Azure.

## 📋 Pré-requisitos

- ✅ DBeaver conectado ao PostgreSQL do Azure
- ✅ Permissões de administrador no banco
- ✅ Backup do banco em dia (sempre recomendado)

## 🚀 Passo a Passo no DBeaver

### 1. **Conectar ao Banco de Produção**
   - Abra o DBeaver
   - Conecte-se ao banco PostgreSQL do Azure
   - Certifique-se de estar no banco correto (o que tem as tabelas `users`, `tenants`, etc.)

### 2. **Executar a Migração**
   - Clique com botão direito na conexão → **SQL Editor** → **New SQL Script**
   - Copie e cole o conteúdo do arquivo `migrations/create_whatsapp_users_table.sql`
   - **Execute o script** (Ctrl+Enter ou botão Execute)

### 3. **Verificar se deu certo**
   Após executar, você deve ver:
   ```sql
   -- Deve aparecer a mensagem: "Tabela whatsapp_users criada com sucesso!"
   ```

### 4. **Validar a criação**
   - Atualize a lista de tabelas (F5)
   - Verifique se a tabela `whatsapp_users` apareceu
   - Clique na tabela para ver as colunas criadas

## 📊 Estrutura da Tabela Criada

A tabela `whatsapp_users` terá:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL PRIMARY KEY | ID único da tabela |
| `whatsapp_id` | VARCHAR UNIQUE | ID do usuário no WhatsApp |
| `phone_number` | VARCHAR | Número de telefone |
| `whatsapp_name` | VARCHAR | Nome no WhatsApp |
| `user_id` | INTEGER FK | Referência para `users.id` |
| `is_authenticated` | BOOLEAN | Se já autenticou na app |
| `auth_code` | VARCHAR | Código temporário |
| `auth_code_expires` | TIMESTAMP | Expiração do código |
| `is_active` | BOOLEAN | Se está ativo |
| `language` | VARCHAR | Idioma (pt-BR) |
| `profile_name` | VARCHAR | Nome do perfil |
| `created_at` | TIMESTAMP | Data de criação |
| `updated_at` | TIMESTAMP | Última atualização |
| `last_interaction` | TIMESTAMP | Última interação |

## 🔧 Funcionalidades Criadas

### **Índices para Performance:**
- `idx_whatsapp_users_whatsapp_id`
- `idx_whatsapp_users_user_id` 
- `idx_whatsapp_users_phone_number`
- `idx_whatsapp_users_is_authenticated`

### **Trigger Automático:**
- Atualiza `updated_at` automaticamente em cada UPDATE

### **Relacionamentos:**
- `whatsapp_users.user_id` → `users.id` (Foreign Key)

## ✅ Verificação Final

Após executar, teste se tudo está funcionando:

1. **No DBeaver:**
   ```sql
   -- Verificar se a tabela existe
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_name = 'whatsapp_users';
   
   -- Ver a estrutura da tabela
   SELECT column_name, data_type, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'whatsapp_users';
   ```

2. **Na Aplicação:**
   - Acesse https://jolly-bay-0a0f6890f.6.azurestaticapps.net/settings?tab=whatsapp
   - Teste o formulário de vinculação do WhatsApp

## 🆘 Se der algum erro

**Erro comum:** "relation already exists"
- ✅ Isso é normal! O script usa `CREATE TABLE IF NOT EXISTS`
- A tabela já existe e está tudo certo

**Erro de permissão:**
- Certifique-se de estar conectado com usuário administrador
- Verifique as credenciais do Azure PostgreSQL

**Erro de conexão:**
- Verifique se o firewall do Azure permite sua conexão
- Confirme as configurações de rede

## 📝 Notas Importantes

- ⚠️ **Sempre faça backup antes de executar migrações em produção**
- 🔒 Esta migração é **segura** - só adiciona nova tabela, não modifica dados existentes
- 🔄 O script pode ser executado múltiplas vezes sem problemas
- 🎯 Após executar, a integração WhatsApp estará 100% funcional

---

**🎉 Pronto!** Após executar esta migração, a funcionalidade WhatsApp estará completamente operacional no banco de produção! 