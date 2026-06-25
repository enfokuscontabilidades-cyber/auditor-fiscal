# Guia de Configuração do Ambiente de Homologação

## O que é o Ambiente de Homologação?

É uma cópia isolada do sistema, usando um **banco Supabase separado** e uma **URL diferente da produção**,
destinada exclusivamente a testes. Dados reais de clientes nunca devem ser inseridos aqui.

---

## Para o Desenvolvedor — Orientação sobre a Branch

### Como saber se está na branch `homologacao`

```bash
git branch --show-current
# Deve exibir: homologacao
```

### Como voltar para a branch principal (`master`) sem perder alterações

Se você tiver alterações não commitadas que quer preservar:

```bash
git stash             # salva as alterações temporariamente
git checkout master   # volta para master
git stash pop         # restaura as alterações salvas
```

Se você já commitou suas alterações na `homologacao`:

```bash
git checkout master   # simplesmente troca de branch
```

### Como fazer push da branch `homologacao`

```bash
git push -u origin homologacao
```

Após o primeiro push, nos subsequentes basta:

```bash
git push
```

### Como verificar se o push gerou a Preview Deployment na Vercel

1. Acesse [vercel.com](https://vercel.com) e entre no projeto `sistema-controle-V3`
2. Na aba **Deployments**, procure um deploy com a tag `homologacao`
3. Copie a URL exibida (exemplo: `https://sistema-controle-v3-git-homologacao-SEUPROJETO.vercel.app`)

---

## Como Confirmar Visualmente que Está em Homologação

Quando o sistema estiver corretamente configurado em homologação, **uma faixa laranja** aparecerá
no topo de todas as páginas com o texto:

> ⚠ AMBIENTE DE HOMOLOGAÇÃO — NÃO UTILIZAR DADOS REAIS ⚠

Essa faixa **não aparece em produção**. Se você acessar a URL do sistema e não ver a faixa laranja,
você está no ambiente de **produção** — saia imediatamente sem inserir dados fictícios.

---

## Variáveis de Ambiente Necessárias

Copie o arquivo `.env.homologacao.example` para `.env.homologacao` (nunca comitar):

```bash
cp .env.homologacao.example .env.homologacao
```

Preencha com as chaves do projeto Supabase de **homologação** (nunca de produção):

```env
NEXT_PUBLIC_APP_ENV=homologacao
NEXT_PUBLIC_APP_URL=https://URL-DA-PREVIEW.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://PROJETO-HOMOLOGACAO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...chave-anonima-de-homologacao
SUPABASE_SERVICE_ROLE_KEY=eyJ...chave-service-role-de-homologacao
STRIPE_SECRET_KEY=sk_test_...chave-stripe-de-teste
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Ordem de Execução (Checklist Rápido)

1. [ ] Criar projeto Supabase de homologação (ver `HOMOLOGACAO_SUPABASE_PASSO_A_PASSO.md`)
2. [ ] Executar os SQLs no banco de homologação (ver mesmo documento)
3. [ ] Configurar variáveis na Vercel (ver `HOMOLOGACAO_VERCEL_PASSO_A_PASSO.md`)
4. [ ] Fazer push da branch `homologacao` para gerar a Preview Deployment
5. [ ] Confirmar que a faixa laranja aparece ao acessar a Preview URL
6. [ ] Criar usuários fictícios no Supabase de homologação
7. [ ] Executar os testes (ver `tests/security/README.md`)

---

## O que Nunca Fazer

- Não copiar dados de clientes reais para homologação
- Não usar as chaves do projeto Supabase de **produção** nas variáveis de homologação
- Não usar `sk_live_` do Stripe — sempre `sk_test_`
- Não fazer push da branch `homologacao` para `master` sem revisão
- Não commitar arquivos `.env.homologacao` ou `.env.test` (estão no `.gitignore`)
