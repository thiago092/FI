# 🤖 Assistente de Planejamento IA

## Visão Geral

O Assistente de Planejamento IA é uma funcionalidade inteligente que analisa o perfil financeiro do usuário e gera sugestões personalizadas de orçamento baseadas em dados socioeconômicos brasileiros e inteligência artificial.

## 🎯 Objetivo

Simplificar a criação de planejamentos financeiros oferecendo:
- **Análise inteligente** do perfil do usuário
- **Sugestões personalizadas** baseadas em classe social e composição familiar
- **Integração com categorias existentes** do usuário
- **Criação automática** de categorias essenciais faltantes
- **Percentuais otimizados** para cada categoria

## 🧠 Como Funciona

### 1. Coleta de Dados do Usuário
O assistente coleta informações essenciais:
- **Renda Mensal Líquida**: Base para todos os cálculos
- **Composição Familiar**: Solteiro, casal, família pequena/grande
- **Tipo de Moradia**: Própria, financiada, aluguel, familiar
- **Estilo de Vida**: Econômico, moderado, confortável

### 2. Análise Inteligente

#### Determinação da Classe Social
Baseado na renda mensal, o sistema classifica em:
- **Classe Baixa**: ≤ R$ 2.640 (até 2 salários mínimos)
- **Classe Média Baixa**: R$ 2.641 - R$ 6.600 (3-5 salários)
- **Classe Média**: R$ 6.601 - R$ 13.200 (6-10 salários)
- **Classe Média Alta**: R$ 13.201 - R$ 26.400 (11-20 salários)
- **Classe Alta**: > R$ 26.400 (20+ salários)

#### Distribuição Socioeconômica Brasileira
Cada classe social possui distribuição percentual recomendada:

**Classe Baixa:**
- Alimentação: 30-40%
- Moradia: 25-35%
- Transporte: 15-20%
- Saúde: 8-12%
- Educação: 3-8%
- Lazer: 2-5%
- Vestuário: 3-6%
- Economia: 0-2%

**Classe Média:**
- Alimentação: 15-25%
- Moradia: 20-30%
- Transporte: 8-15%
- Saúde: 8-15%
- Educação: 8-15%
- Lazer: 8-15%
- Vestuário: 3-8%
- Investimentos: 5-10%
- Economia: 10-15%

**Classe Alta:**
- Alimentação: 8-15%
- Moradia: 10-20%
- Transporte: 5-10%
- Saúde: 5-10%
- Educação: 8-15%
- Lazer: 15-25%
- Vestuário: 3-8%
- Investimentos: 20-40%
- Economia: 15-30%

### 3. Integração com OpenAI

O sistema utiliza **GPT-4O-Mini** para:
- Analisar categorias existentes do usuário
- Sugerir valores personalizados para cada categoria
- Identificar categorias essenciais faltantes
- Ajustar percentuais baseado no perfil familiar
- Gerar dicas financeiras personalizadas

### 4. Fallback Inteligente

Caso a IA não esteja disponível, o sistema possui:
- **Algoritmo de regras** baseado em análise semântica
- **Mapeamento automático** de categorias por palavras-chave
- **Sugestões essenciais** de categorias faltantes

## 🎨 Interface do Usuário

### Etapa 1: Questionário Inteligente
- **Formulário responsivo** com validações
- **Visualização das categorias existentes** do usuário
- **Indicação clara** de que a IA analisará as categorias

### Etapa 2: Apresentação das Sugestões
- **Resumo do perfil** analisado pela IA
- **Classificação da classe social** estimada
- **Lista detalhada** de sugestões por categoria:
  - ✅ **Categorias Existentes**: Valores sugeridos para categorias já criadas
  - 🆕 **Categorias Novas**: Categorias essenciais que serão criadas
  - 💰 **Valor e Percentual**: Para cada categoria
  - 📝 **Justificativa**: Explicação da IA para cada sugestão

### Etapa 3: Revisão e Aplicação
- **Resumo financeiro**: Total sugerido vs. renda
- **Percentual de reserva** calculado automaticamente
- **Dicas personalizadas** da IA
- **Botões de ação**:
  - "Gerar Novamente": Nova análise com os mesmos dados
  - "Aplicar Sugestões": Criar o planejamento

## ⚙️ Processo de Aplicação

Quando o usuário confirma as sugestões:

### 1. Criação de Categorias Novas
- **Categorias essenciais faltantes** são criadas automaticamente
- **Cores e ícones padrão** são atribuídos
- **Vinculação ao usuário** atual

### 2. Criação do Planejamento
- **Nome automático**: "Orçamento IA - [Mês Atual] [Ano]"
- **Período**: Mês/ano atuais
- **Renda esperada**: Valor informado pelo usuário
- **Status**: Ativo

### 3. Configuração dos Planos de Categoria
- **Valores sugeridos** para cada categoria (existentes + novas)
- **Prioridades** baseadas na análise da IA
- **Observações** com justificativas

### 4. Atualização da Interface
- **Recarregamento automático** dos dados
- **Exibição do novo planejamento** como atual
- **Mensagem de sucesso** com confirmação

## 🔧 Tecnologias Utilizadas

### Backend
- **FastAPI**: API REST para processamento
- **OpenAI GPT-4O-Mini**: Análise inteligente
- **SQLAlchemy**: Manipulação do banco de dados
- **Pydantic**: Validação de dados

### Frontend
- **React + TypeScript**: Interface responsiva
- **Tailwind CSS**: Estilização moderna
- **Lucide Icons**: Ícones consistentes
- **Axios**: Comunicação com API

## 📊 Dados Socioeconômicos

Os percentuais são baseados em:
- **Pesquisa de Orçamentos Familiares (POF)** do IBGE
- **Estudos de mercado** brasileiro
- **Boas práticas** de planejamento financeiro
- **Realidade socioeconômica** das classes sociais

## 🚀 Benefícios

### Para Usuários Iniciantes
- **Criação automática** de categorias essenciais
- **Percentuais otimizados** para sua classe social
- **Educação financeira** através das dicas

### Para Usuários Experientes
- **Análise das categorias existentes**
- **Sugestões de otimização** baseadas em IA
- **Validação** do planejamento atual

### Para Todos
- **Economia de tempo** na criação de orçamentos
- **Personalização inteligente** baseada no perfil
- **Fundamentação científica** dos percentuais

## 🔐 Segurança e Privacidade

- **Dados não armazenados** nas chamadas para OpenAI
- **Processamento local** quando possível (fallback)
- **Validações rigorosas** de entrada
- **Tratamento de erros** robusto

## 🎯 Casos de Uso

### Scenario 1: Usuário Novo
- **Renda**: R$ 5.000 (Classe Média Baixa)
- **Perfil**: Casal sem filhos, casa própria
- **Resultado**: Criação de 8-10 categorias essenciais com valores otimizados

### Scenario 2: Usuário com Categorias
- **Categorias existentes**: Alimentação, Transporte, Lazer
- **Resultado**: Valores sugeridos + criação de categorias faltantes (Moradia, Saúde, Poupança)

### Scenario 3: Usuário Classe Alta
- **Foco**: Investimentos e otimização fiscal
- **Resultado**: Maior percentual em investimentos e categorias de qualidade de vida

## 📈 Métricas e Monitoramento

- **Taxa de utilização** da funcionalidade
- **Tempo de criação** de planejamentos
- **Satisfação** com as sugestões
- **Taxa de aplicação** das sugestões geradas

## 🔮 Futuras Melhorias

- **Machine Learning** para personalização baseada em histórico
- **Análise de gastos** anteriores do usuário
- **Sugestões sazonais** (13º salário, férias, etc.)
- **Comparação** com média de usuários similares
- **Alertas inteligentes** de desvios orçamentários 