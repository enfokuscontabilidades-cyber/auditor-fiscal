# Vercel Preview — Passo a Passo

## O que é a Preview Deployment?

É uma versão do sistema publicada automaticamente pela Vercel a partir de um branch específico
(`homologacao`), em uma URL diferente da produção. Qualquer push na branch `homologacao`
gera um novo deploy na Preview URL.

---

## Parte 1 — Acessar o Projeto na Vercel

1. Abra o navegador e acesse [vercel.com](https://vercel.com)
2. Faça login com sua conta
3. Localize o projeto `sistema-controle-V3` (ou similar) na lista de projetos
4. Clique no nome do projeto para abrir o painel

---

## Parte 2 — Configurar Variáveis de Ambiente para Preview

### Passo 2.1 — Acessar as Configurações

1. No painel do projeto, clique em **Settings** (aba superior)
2. No menu lateral, clique em **Environment Variables**

### Passo 2.2 — Adicionar as Variáveis

Para cada variável abaixo, clique em **Add New** e preencha:

#### Como preencher cada variável:

1. **Name:** o nome da variável (ex: `NEXT_PUBLIC_APP_ENV`)
2. **Value:** o valor correspondente do projeto de homologação
3. **Environments:** selecione **APENAS** `Preview`
   - Desmarque `Production`
   - Desmarque `Development`
4. **(Opcional) Branch:** se a interface permitir filtrar por branch, selecione `homologacao`
5. Clique em **Save**

#### Variáveis a configurar:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_APP_ENV` | `homologacao` |
| `NEXT_PUBLIC_APP_URL` | URL da Preview (preencha após o primeiro deploy) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase de homologação |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key do Supabase de homologação |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key do Supabase de homologação |
| `STRIPE_SECRET_KEY` | `sk_test_...` (chave de TESTE do Stripe) |
| `STRIPE_PRICE_ID` | Price ID de teste do Stripe |
| `STRIPE_WEBHOOK_SECRET` | Webhook secret de teste do Stripe |

> **Atenção:** Para variáveis marcadas com `NEXT_PUBLIC_`, o valor é visível no código do frontend.
> Para `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`, o valor fica
> apenas no servidor — nunca selecione o ambiente `Production` para essas chaves de homologação.

### Passo 2.3 — NÃO Alterar Variáveis de Production

Na listagem de variáveis, você verá as variáveis existentes marcadas com `Production`.
**Não modifique essas variáveis.** Elas são usadas pelo sistema em produção.

Se uma variável já existir com o mesmo nome mas marcada como `Production`, clique em
**Edit** e adicione um novo valor **somente para `Preview`**, sem alterar o valor de `Production`.

---

## Parte 3 — Gerar a Preview Deployment

### Passo 3.1 — Primeiro Deploy

O deploy da Preview é gerado automaticamente quando você faz push da branch `homologacao`:

```bash
git push -u origin homologacao
```

### Passo 3.2 — Acompanhar o Deploy

1. Na Vercel, acesse a aba **Deployments**
2. Você verá um novo deploy sendo construído com a tag `homologacao`
3. Aguarde até o status mudar para **Ready** (geralmente 1-3 minutos)
4. Se aparecer **Error**, clique no deploy para ver os logs de erro

### Passo 3.3 — Localizar a URL da Preview

1. Na aba **Deployments**, clique no deploy mais recente da branch `homologacao`
2. A URL da Preview aparece no topo da página do deploy (ex: `sistema-controle-v3-git-homologacao-SEUPROJETO.vercel.app`)
3. Clique na URL para abrir o sistema em homologação
4. Confirme que a **faixa laranja** aparece no topo

### Passo 3.4 — Atualizar `NEXT_PUBLIC_APP_URL`

Após o primeiro deploy bem-sucedido:
1. Copie a URL da Preview
2. Volte em **Settings > Environment Variables**
3. Edite a variável `NEXT_PUBLIC_APP_URL` (Preview) e cole a URL copiada
4. Salve e faça um novo push para regenerar o deploy com a URL correta:

```bash
git commit --allow-empty -m "chore: forçar redeploy com APP_URL correto"
git push
```

---

## Parte 4 — Confirmar que a Preview Usa o Banco de Homologação

### Método 1: Verificação Visual

Acesse a Preview URL e faça login. Na tela de **Configurações**:
- O nome da organização deve ser o que você criou no banco de homologação
- Não deve aparecer nenhum dado real de clientes

### Método 2: Verificação Técnica

1. Abra o DevTools (F12) no navegador
2. Vá em **Network** e faça qualquer requisição à API
3. Olhe os logs de erro — a URL do Supabase nas requisições deve conter o ID do projeto de homologação, não de produção

### Método 3: Criar Usuário de Teste

Tente cadastrar um novo usuário na Preview. Se a criação funcionar e você conseguir ver
o usuário no painel do Supabase de **homologação** (não de produção), está tudo correto.

---

## Parte 5 — Evitar Confundir Preview com Produção

| Indicador | Produção | Homologação |
|-----------|----------|-------------|
| URL | domínio oficial (ex: `sistema.enfokus.com.br`) | `...vercel.app` com `-homologacao-` na URL |
| Faixa laranja no topo | **NÃO aparece** | **APARECE** com texto de aviso |
| Dados | dados reais de clientes | somente dados fictícios |
| Supabase | projeto de produção | projeto `sistema-controle-homologacao` |

**Regra de ouro:** se não vir a faixa laranja, você está em produção. Saia sem fazer nada.

---

## Parte 6 — Novo Deploy Após Alterar Variáveis

Toda vez que alterar variáveis de ambiente na Vercel, é necessário re-deployar para aplicar:

```bash
# Opção 1: fazer um commit vazio e push
git commit --allow-empty -m "chore: redeployar preview"
git push

# Opção 2: na Vercel, clique em "Redeploy" no último deploy da branch homologacao
```
