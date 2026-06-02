# Supabase de Homologação — Passo a Passo

## Parte 1 — Criar o Projeto Supabase de Homologação

### Passo 1.1 — Acessar o Supabase

1. Abra o navegador e acesse [supabase.com](https://supabase.com)
2. Clique em **Sign In** e entre com sua conta
3. Você será direcionado para o **Dashboard** (painel com seus projetos)

### Passo 1.2 — Criar Novo Projeto

1. Clique no botão **New Project** (canto superior direito ou centro da tela)
2. Selecione a **organização** onde o projeto será criado (a mesma da produção está bem)
3. Preencha os campos:
   - **Name:** `sistema-controle-homologacao`
   - **Database Password:** crie uma senha forte e **salve em local seguro** (você precisará dela depois)
   - **Region:** escolha a mesma região do projeto de produção (ex: `South America (São Paulo)`)
4. Clique em **Create new project**
5. Aguarde 1-2 minutos até o projeto ser criado (aparecerá como "Setting up your project")

---

## Parte 2 — Localizar as Chaves do Projeto

### Passo 2.1 — Acessar as Configurações de API

1. No painel do projeto recém-criado, clique em **Project Settings** (ícone de engrenagem no menu lateral)
2. Clique em **API** no submenu

### Passo 2.2 — Identificar as Chaves

Você verá três informações importantes:

| Campo na tela do Supabase | Variável no sistema | Onde usar |
|--------------------------|--------------------|-----------| 
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` | Código do frontend (público) |
| **Project API Keys > anon / public** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Código do frontend (público) |
| **Project API Keys > service_role / secret** | `SUPABASE_SERVICE_ROLE_KEY` | Apenas no servidor (secreto) |

### Chave `anon` (pública)
- Pode ser exposta no código do frontend (`NEXT_PUBLIC_`)
- Usada pelo Supabase para autenticação de usuários comuns
- O RLS (Row Level Security) se aplica quando esta chave é usada

### Chave `service_role` (secreta — NUNCA expor)
- Bypassa o RLS — tem acesso total ao banco
- Deve ficar **apenas** no servidor (variáveis sem prefixo `NEXT_PUBLIC_`)
- Nunca incluir em arquivos versionados nem exibir em logs ou telas

---

## Parte 3 — Criar o Banco de Dados (Executar SQLs)

### Passo 3.1 — Acessar o SQL Editor

1. No menu lateral do projeto, clique em **SQL Editor**
2. Clique em **New query** para abrir uma aba de consulta

### Passo 3.2 — Executar os Arquivos em Ordem

Execute **um arquivo por vez**, na seguinte ordem:

#### Arquivo 1: `supabase_setup.sql` (estrutura principal)

1. Abra o arquivo `supabase_setup.sql` na raiz do projeto em seu computador
2. Selecione todo o conteúdo (Ctrl+A) e copie (Ctrl+C)
3. Cole no SQL Editor do Supabase
4. Clique em **Run** (ou pressione Ctrl+Enter)
5. Aguarde a execução. Deve aparecer uma mensagem de sucesso.
6. Se aparecer erro vermelho, leia a seção "Como identificar e reportar erros" abaixo.

#### Arquivo 2: `supabase_migration_fase_a.sql`

Repita o mesmo processo com este arquivo.

#### Arquivo 3: `supabase_migration_cnpj_cache.sql`

Repita o mesmo processo com este arquivo.

#### Arquivo 4: `supabase_migration_pre_beta_rls.sql` ← **Mais importante**

Este arquivo contém as melhorias de segurança do PRÉ-BETA BLOCO 1.
Repita o mesmo processo.

### Passo 3.3 — Confirmar que Tudo Foi Criado

Execute o arquivo `HOMOLOGACAO_SQL_VERIFICACAO.sql` (neste diretório `docs/`).
Cada consulta deve retornar resultados (não pode estar vazio em itens obrigatórios).

---

## Parte 4 — Verificações Pós-Instalação

### 4.1 — Tabelas Criadas

Execute no SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deve conter ao menos: `organizacoes`, `membros_organizacao`, `convites_organizacao`,
`empresas`, `fa_sessoes_analise`, `fa_arquivos_xml`, `fa_arquivos_sped`,
`fa_documentos_fiscais`, `fa_documentos_itens`, `fa_alertas`, `fa_regras_fiscais`,
`sn_declaracoes`, `sn_receitas_mensais`, `sn_apuracoes`, `cnpj_cache`.

### 4.2 — Funções RLS Criadas

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_member_of', 'is_admin_of');
```

Deve retornar exatamente 2 linhas.

### 4.3 — RLS Habilitado em Tabelas Críticas

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizacoes', 'membros_organizacao', 'empresas',
    'fa_sessoes_analise', 'fa_alertas', 'fa_regras_fiscais'
  )
ORDER BY tablename;
```

Todas devem ter `rowsecurity = true`.

### 4.4 — Policies Criadas

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Deve haver policies para todas as tabelas com RLS habilitado.

---

## Parte 5 — Cadastrar Usuários Fictícios

### Passo 5.1 — Via Painel do Supabase

1. No menu lateral, clique em **Authentication > Users**
2. Clique em **Add user > Create new user**
3. Crie os seguintes usuários (todos com senha fictícia, ex: `Teste@1234`):

| E-mail | Papel |
|--------|-------|
| `admin_a@homologacao.test` | Admin da Org A |
| `membro_a@homologacao.test` | Membro da Org A |
| `admin_b@homologacao.test` | Admin da Org B |
| `membro_b@homologacao.test` | Membro da Org B |

### Passo 5.2 — Criar as Organizações

Após criar os usuários, acesse o sistema pela Preview URL e:

1. Faça login como `admin_a@homologacao.test`
2. Na tela de onboarding, crie a **Organização A** (ex: `Escritório Alfa Homologação`)
3. Faça logout
4. Faça login como `admin_b@homologacao.test`
5. Crie a **Organização B** (ex: `Escritório Beta Homologação`)

### Passo 5.3 — Adicionar Membros via Interface

1. Como `admin_a`, vá em **Configurações > Membros**
2. Convide `membro_a@homologacao.test`
3. Faça logout, login como `membro_a` e aceite o convite
4. Repita o processo para `admin_b` convidar `membro_b`

---

## Parte 6 — Como Identificar e Reportar Erros

Quando um SQL falhar, o Supabase mostra uma caixa vermelha com a mensagem de erro.

### O que copiar

Copie **apenas a mensagem de texto do erro**, por exemplo:
```
ERROR:  relation "fa_documentos_fiscais" already exists
```

### O que NÃO incluir

- Não compartilhe a URL do projeto Supabase
- Não compartilhe as chaves (`anon key`, `service_role key`)
- Não faça print da tela inteira com informações do projeto

### Erros Comuns

| Mensagem | Causa | Solução |
|----------|-------|---------|
| `relation "X" already exists` | SQL executado duas vezes | Normal — os scripts são idempotentes |
| `function "is_member_of" does not exist` | Setup SQL não foi executado | Execute `supabase_setup.sql` primeiro |
| `permission denied` | Tentando usar service_role para simular usuário | Use anon key + JWT do usuário |

---

## Parte 7 — Excluir Dados Fictícios Após os Testes

Para limpar completamente o banco de homologação após os testes:

```sql
-- Excluir todos os dados de teste (NÃO executar em produção)
-- Execute na seguinte ordem para respeitar as foreign keys:

DELETE FROM fa_alertas;
DELETE FROM fa_documentos_itens;
DELETE FROM fa_documentos_fiscais;
DELETE FROM fa_arquivos_xml;
DELETE FROM fa_arquivos_sped;
DELETE FROM fa_sessoes_analise;
DELETE FROM sn_apuracoes_receitas;
DELETE FROM sn_apuracoes;
DELETE FROM sn_receitas_mensais;
DELETE FROM sn_declaracoes;
DELETE FROM empresas;
DELETE FROM convites_organizacao;
DELETE FROM membros_organizacao;
DELETE FROM organizacoes;
```

Para excluir os usuários fictícios: **Authentication > Users > selecionar > Delete**.

> **Atenção:** Esses comandos são irreversíveis. Execute apenas no banco de **homologação**.
> Nunca execute no banco de produção.
