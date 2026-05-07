# Instruções para o Claude Code — Plataforma de Auditoria Fiscal

## Projeto

**sistema-controle** — plataforma de auditoria fiscal e tributária da Enfokus Contabilidade.

Stack: Next.js 16.2 + React 19 + TypeScript 5 + Tailwind CSS 4 + Supabase PostgreSQL.

## Comandos

```bash
npm run dev      # servidor local (porta 3000)
npm run build    # compilar para produção
npm run lint     # verificar erros de lint
npx tsc --noEmit # verificar erros de TypeScript sem compilar
```

## Estrutura do projeto

- `app/(fiscal)/` — todas as páginas autenticadas do sistema
- `app/api/` — rotas de API que se comunicam com o banco Supabase
- `lib/supabase/` — clientes Supabase (browser e servidor)
- `lib/rules/` — motor de regras fiscais
- `lib/types.ts` — tipos TypeScript compartilhados
- `middleware.ts` — guarda de autenticação (protege todas as rotas exceto `/login`)
- `supabase_setup.sql` — DDL completo do banco de dados

## Variáveis de ambiente

Arquivo `.env.local` na raiz do projeto:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Padrões de código

### Visual (estilo dark glass)
- As páginas fiscais usam estilos inline com fundo escuro (`#0a0f1a`, `rgba(...)`)
- Cor de destaque principal: `rgba(39,199,216,...)` (azul ciano)
- NÃO usar classes Tailwind para layout das páginas fiscais — manter consistência com o estilo já existente
- Novos componentes de UI (botões, cards, tabelas) devem seguir o mesmo padrão visual das páginas `auditor_fiscal` e `validador_entradas`

### Supabase
- Sempre usar `createServerClient` (de `lib/supabase/server.ts`) nas API routes e Server Components
- Sempre usar `createBrowserClient` (de `lib/supabase/client.ts`) em Client Components (`"use client"`)
- Nunca acessar o banco diretamente no browser fora de componentes com `"use client"`

### Motor de regras
- Cada regra é uma função pura em `lib/rules/executores/`
- A função recebe `ContextoAnalise` e retorna `AlertaGerado[]`
- Nunca lançar exceção dentro de um executor — capturar o erro e retornar array vazio
- O código da regra (ex: `ICMS_UC_COM_CREDITO`) deve ser idêntico ao campo `codigo` na tabela `fa_regras_fiscais`

### API routes
- Sempre verificar autenticação no início: `const { data: { user } } = await supabase.auth.getUser()`
- Retornar `401` se não autenticado
- Usar `NextResponse.json()` para todas as respostas
- Validar campos obrigatórios antes de inserir no banco

### TypeScript
- Nunca usar `any` — usar tipos específicos de `lib/types.ts` ou `unknown` quando inevitável
- Todas as interfaces de dados do banco devem estar em `lib/types.ts`

## Banco de dados

O arquivo `supabase_setup.sql` contém o DDL completo. Para aplicar em um novo projeto Supabase:
1. Acessar o Supabase Studio do projeto
2. Abrir SQL Editor
3. Colar e executar o conteúdo de `supabase_setup.sql`

Tabelas principais:
- `empresas` — cadastro das empresas clientes
- `fa_sessoes_analise` — sessões de auditoria por empresa+período
- `fa_arquivos_sped` — arquivos SPED importados (resultado parseado em JSONB)
- `fa_arquivos_xml` — XMLs de NF-e importados
- `fa_alertas` — alertas gerados pelo motor de regras
- `fa_regras_fiscais` — catálogo de regras configuráveis

## Legislação de referência (Goiás)

- RCTE/GO (Decreto 4.852/97) — regras gerais de ICMS
- IN 1518/2022-GSE — CBenef (códigos de benefícios fiscais)
- RICMS/GO Anexo VIII — produtos sujeitos a substituição tributária
- LC 87/1996 (Lei Kandir) — crédito de ICMS, uso e consumo, ativo imobilizado
- IN RFB 1252/2012 — obrigatoriedade do SPED Contribuições

## O que NÃO fazer

- Não alterar o projeto `enfokus-app` (é um sistema separado)
- Não mover lógica de parsing para o servidor (continua no browser)
- Não criar componentes novos desnecessários — reutilizar padrões já existentes nas páginas
- Não usar `console.log` em produção — remover antes do build
