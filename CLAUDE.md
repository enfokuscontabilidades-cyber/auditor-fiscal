# Instruções para o Claude Code — Plataforma SaaS Contábil

## Projeto

**sistema-controle** — plataforma SaaS contábil multiempresa e multiusuário para escritórios de contabilidade. O módulo fiscal é o núcleo principal e o primeiro disponibilizado comercialmente (Founder Access).

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
- `app/(fiscal)/(full-platform)/` — subgrupo de rotas que só orgs `produto_escopo='full_platform'` podem acessar (auditor_fiscal, editor_sped, validador_entradas, simples_nacional, inconsistencias, planejamento, obrigacoes, cobrancas, leads-reforma-tributaria, admin-reforma-tributaria); grupo de rotas do Next.js — não altera a URL, só agrupa o gate de acesso em `layout.tsx`
- `app/cadastro/` — cadastro de novo usuário (público); aceita `?produto=reforma_tributaria&plano=<codigo>` para o funil de planos pagos
- `app/aguardando-ativacao/` — tela de assinatura/ativação de plano (público); dinâmica conforme `?produto=`
- `app/configuracoes/novo-escritorio/` — onboarding: criar org ou aceitar convite (público)
- `app/planos-reforma-tributaria/` — página pública de preços dos planos de Reforma Tributária
- `app/api/` — rotas de API que se comunicam com o banco Supabase
- `app/api/rt/` — assinatura, uso e upgrade do produto Reforma Tributária (org autenticada)
- `app/api/admin/rt/` — área administrativa de assinaturas/CNPJ (staff Enfokus, allowlist `LEADS_ADMIN_EMAILS`)
- `lib/supabase/` — clientes Supabase: `client.ts` (browser), `server.ts` (SSR), `admin.ts` (service-role), `org.ts` (helper), `fetchAll.ts` (paginação completa)
- `lib/planos/` — camada de planos pagos de Reforma Tributária: `reformaTributariaPlanos.ts` (catálogo central de preços/limites), `acessoReformaTributaria.ts` (`getContextoAcesso`, `canAccessModule`, `canCreateCompany`, `canProcessXml`, `canGenerateReport` — único ponto de verdade de permissão), `auditoria.ts` (`registrarEventoRt`), `quotaXml.ts` (serviço centralizado de quota de XMLs: `reservarQuotaXml`/`liberarQuotaXml`/`reconciliarUsoXml`, reserva atômica via RPC — único ponto de verdade sobre saldo de XMLs; nunca reimplementar a checagem localmente)
- `lib/rules/` — motor de regras fiscais: `engine.ts`, `types.ts`, `executores/` (icms, cfop, pis_cofins, ncm)
- `lib/fiscal/` — biblioteca compartilhada de classificação fiscal: `classificacao.ts` (NCM_UC/IMOB/COMB, famCFOP, analisarProduto, validarItemSped); `parametrosReforma2026.ts` (parâmetros de referência versionados de IBS/CBS do período de teste); `analiseReformaTributaria.ts` (motor único de IBS/CBS — adequado/atenção/crítico —, usado pelo diagnóstico público e pela área autenticada); `resumoReformaTributaria.ts` (agregação de situação a partir de itens brutos)
- `lib/sped/` — tipos e parsers do SPED: `types.ts`, `parsers.ts`, `validators.ts`
- `lib/simples/` — lógica do Simples Nacional: `calcularSimples.ts`, `cfopReceita.ts`, `tabelasAnexos.ts`
- `lib/nfe/` — parsing de XML de NF-e (`parseNfeParaDocumento`, reaproveitado pelo importador de Reforma Tributária)
- `lib/types.ts` — tipos TypeScript compartilhados
- `components/reforma/ImportadorXmlReforma.tsx` — upload de XML reaproveitado pela página `/reforma_tributaria` (grava em `fa_documentos_fiscais`/`fa_documentos_itens` via `/api/documentos-fiscais/importar-nfe`)
- `middleware.ts` — guarda de autenticação (protege todas as rotas exceto `/login`, `/cadastro`, `/auth`, `/api/stripe/webhook`)
- `supabase_setup.sql` — DDL completo do banco de dados
- `supabase_migration_fase_a.sql` — migração idempotente: coluna `competencia` em `fa_arquivos_xml` + tabelas `fa_documentos_fiscais`, `fa_documentos_itens`, `sn_receitas_mensais`, `sn_apuracoes`, `sn_apuracoes_receitas`
- `supabase_migration_cnpj_cache.sql` — migração idempotente: tabela `cnpj_cache` (cache de consultas CNPJ)
- `supabase_migration_reforma_tributaria_planos.sql` — migração idempotente: coluna `produto_escopo` em `organizacoes` + tabelas `rt_assinaturas`, `rt_cnpj_slots`, `rt_correcoes_cnpj`, `rt_uso_mensal`, `rt_documentos_processados`, `rt_auditoria`, `rt_webhook_eventos`
- `supabase_migration_rt_quota_atomica.sql` — migração idempotente: funções `rt_reservar_quota_xml`/`rt_liberar_quota_xml`/`rt_reconciliar_uso_xml` (reserva de quota de XML atômica via advisory lock, chamáveis só por service role) + tabela `rt_reconciliacoes_uso`
- `components/SessionGuard.tsx` — guard client-side de sessão de browser
- `components/ModalCnpj.tsx` — modal de resultado de consulta CNPJ (6 seções + botão cadastrar empresa)
- `components/ui/` — componentes visuais compartilhados: `PageHeader`, `GlassCard`, `MetricCard`, `EmptyState`

## Variáveis de ambiente

Arquivo `.env.local` na raiz do projeto:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # cliente admin (bypassa RLS)
STRIPE_SECRET_KEY=...              # chave Stripe (sk_live_ ou sk_test_)
STRIPE_PRICE_ID=...                # ID do produto Founder Access no Stripe
STRIPE_WEBHOOK_SECRET=...          # segredo do webhook Stripe
NEXT_PUBLIC_APP_URL=...            # URL pública (sem trailing slash)

# Planos pagos de Reforma Tributária (produto tax_reform_only) — opcionais;
# sem eles o checkout desses planos retorna erro amigável, mas a ativação
# manual pelo admin continua funcionando.
STRIPE_PRICE_ID_RT_ESSENCIAL=...
STRIPE_PRICE_ID_RT_PROFISSIONAL=...
STRIPE_PRICE_ID_RT_ILIMITADO=...
LEADS_ADMIN_EMAILS=...             # allowlist (CSV) de /leads-reforma-tributaria e /admin-reforma-tributaria
```

## Padrões de código

### Visual (estilo dark glass)
- As páginas fiscais usam estilos inline com fundo escuro (`#0a0f1a`, `rgba(...)`)
- Cor de destaque principal: `rgba(39,199,216,...)` (azul ciano)
- NÃO usar classes Tailwind para layout das páginas fiscais — manter consistência com o estilo já existente
- Novos componentes de UI (botões, cards, tabelas) devem seguir o mesmo padrão visual das páginas `auditor_fiscal` e `validador_entradas`

### Multi-tenant (SaaS)
- O isolamento é por **organização** (`org_id`), não por usuário. Vários usuários do mesmo escritório compartilham o mesmo `org_id`.
- Sempre incluir `org_id` ao inserir registros em tabelas de dados. Obter via `getOrgId(supabase, user.id)` de `lib/supabase/org.ts`.
- Nunca filtrar dados apenas por `empresa_id` como única barreira de segurança — o RLS por `org_id` é a camada principal.
- Confiar no RLS do Supabase para isolamento entre escritórios — não duplicar a lógica no código.
- Usar `createAdminClient()` (de `lib/supabase/admin.ts`) apenas onde genuinamente necessário (criação de org, aceitação de convite).
- Verificar `supabase.auth.getUser()` antes de qualquer operação de escrita.
- Nunca criar tabela sem RLS habilitado.
- Nunca expor URLs de Storage sem autenticação (`createSignedUrl` obrigatório).

### Supabase
- Sempre usar `createClient` (de `lib/supabase/server.ts`) nas API routes e Server Components
- Sempre usar `createClient` (de `lib/supabase/client.ts`) em Client Components (`"use client"`) — **atenção: a função exportada chama-se `createClient` em ambos os arquivos, não `createBrowserClient`**
- Usar `createAdminClient` (de `lib/supabase/admin.ts`) apenas para operações que precisam contornar RLS — nunca expor ao browser
- Nunca acessar o banco diretamente no browser fora de componentes com `"use client"`

### Motor de regras
- Cada regra é uma função pura em `lib/rules/executores/`
- A função recebe `ContextoAnalise` e retorna `AlertaGerado[]`
- Nunca lançar exceção dentro de um executor — capturar o erro e retornar array vazio
- O código da regra (ex: `ICMS_UC_COM_CREDITO`) deve ser idêntico ao campo `codigo` na tabela `fa_regras_fiscais`
- Regras registradas no engine: `ICMS_DIVERGENCIA_FISCAL_CONTRIB`, `ICMS_UC_COM_CREDITO`, `ICMS_IMOB_SEM_CIAP`, `ICMS_CFOP_SAIDA_EM_ENTRADA`, `ICMS_CFOP_ENTRADA_EM_SAIDA`, `CFOP_INCOMPAT_CNAE`, `NCM_BENEFICIO_NAO_APLICADO`, `NCM_ST_SEM_TRATAMENTO`, `OBRIG_SPED_ZERADO_COM_RECEITA`, `CONTRIB_EXCLUSAO_INDEVIDA`

### Lib de classificação fiscal (`lib/fiscal/classificacao.ts`)
- Constantes NCM: `NCM_UC`, `NCM_IMOB`, `NCM_COMB` — prefixos de NCM por destinação
- `famCFOP(cfop)` → `'revenda' | 'industrializacao' | 'uso_consumo' | 'imobilizado' | 'outro'`
- `analisarProduto(desc, ncm)` → `AnaliseSugestao` (sem perfil de empresa — versão SPED)
- `sugerirClassificacao(ncm, desc, cfop, ehIndustrial?)` → `ClassificacaoItem`
- `validarItemSped(item, temCiap, ehIndustrial)` → `{ classificacao, alertas: AlertaItemSped[] }`
- **NÃO modifica** `validador_entradas/page.tsx` — essa lib é cópia independente para uso no SPED

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

Tabelas SaaS:
- `organizacoes` — escritórios; `plano` = `'pendente'` | `'founder_access'`; `produto_escopo` = `'full_platform'` | `'tax_reform_only'` (coluna adicionada via `supabase_migration_reforma_tributaria_planos.sql`, default `'full_platform'` — não afeta orgs existentes)
- `membros_organizacao` — vínculo usuário × org; `papel` = `'admin'` | `'membro'`
- `convites_organizacao` — convites por e-mail para orgs existentes

Tabelas de planos pagos de Reforma Tributária (criadas via `supabase_migration_reforma_tributaria_planos.sql`, todas com RLS habilitado — só `select` liberado ao papel `authenticated` via `is_member_of(org_id)`; toda escrita passa por `createAdminClient()` nas API routes):
- `rt_assinaturas` — 1 por org (`unique(org_id)`); `status` = `pending|active|past_due|canceled|expired|suspended|manual`; guarda `stripe_customer_id`/`stripe_subscription_id` e as datas de ciclo
- `rt_cnpj_slots` — vaga permanente de CNPJ por assinatura; `unique(empresa_id)` e `unique(org_id, cnpj_normalizado)`; nunca é removida ao arquivar/excluir empresa — é isso que impede a substituição de CNPJ
- `rt_correcoes_cnpj` — trilha de auditoria da correção administrativa de CNPJ (exclusiva do admin, via `/api/admin/rt/cnpj-correcao`)
- `rt_uso_mensal` — contador de XMLs processados por ciclo (`assinatura_id` + `periodo_inicio`)
- `rt_documentos_processados` — chaves de acesso já contabilizadas no ciclo (evita contar 2x um reprocessamento; `unique(assinatura_id, chave_acesso)`)
- `rt_auditoria` — log de eventos comerciais (criação/ativação/cancelamento de assinatura, CNPJ vinculado/corrigido, limite atingido) — nunca grava XML ou dado fiscal
- `rt_webhook_eventos` — idempotência dos eventos do Stripe (`id` = `event.id`), sem policy de RLS (só service role)

Tabelas fiscais (todas com `org_id`):
- `empresas` — cadastro das empresas clientes
- `fa_sessoes_analise` — sessões de auditoria por empresa+período
- `fa_arquivos_sped` — arquivos SPED importados (resultado parseado em JSONB)
- `fa_arquivos_xml` — XMLs de NF-e importados; coluna `competencia` adicionada via `supabase_migration_fase_a.sql`
- `fa_documentos_fiscais` — cabeçalho centralizado de todos os documentos fiscais (NF-e, NFC-e, etc.) — criado via migração Fase A
- `fa_documentos_itens` — itens dos documentos fiscais (1 linha por produto/serviço) — criado via migração Fase A
- `fa_alertas` — alertas gerados pelo motor de regras
- `fa_regras_fiscais` — catálogo de regras configuráveis (compartilhado, sem org_id)
- `sn_declaracoes` — declarações PGDAS-D do Simples Nacional
- `sn_receitas_mensais` — histórico de receita bruta mensal por competência — criado via migração Fase A
- `sn_apuracoes` — resultado da apuração simulada do Simples Nacional por competência — criado via migração Fase A
- `sn_apuracoes_receitas` — breakdown por anexo/tipo dentro de cada apuração — criado via migração Fase A
- `cnpj_cache` — cache de consultas à API pública CNPJ (publica.cnpj.ws) — criado via `supabase_migration_cnpj_cache.sql`

Atenção: as tabelas marcadas "via migração" não estão no `supabase_setup.sql` principal — aplicar as migrações separadamente no SQL Editor do Supabase Studio. Os scripts são idempotentes (podem ser executados múltiplas vezes).

### Padrão de paginação Supabase

O PostgREST retorna no máximo 1000 registros por query. Para buscar todos os registros, usar `fetchAll` de `lib/supabase/fetchAll.ts`:

```typescript
import { fetchAll } from '@/lib/supabase/fetchAll'
const data = await fetchAll((from, to) =>
  supabase.from('fa_arquivos_xml').select('*').eq('empresa_id', id).range(from, to)
)
```

Nunca usar `.range(0, 9999)` — ignora o limite mas retorna dados inconsistentes em conjuntos maiores.

### Navegação entre páginas fiscais (URL params)

Para passar contexto entre `/validador_entradas` e `/simples_nacional`, usar `router.push` com query string:

```typescript
router.push(`/simples_nacional?aba=apuracao_sistema&competencia=${encodeURIComponent(competencia)}`)
```

Na página de destino, ler os params em `useEffect` via `window.location.search` (não `useSearchParams`, que exige `<Suspense>` e causa warnings no Next.js 16):

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const aba = params.get('aba')
  const comp = params.get('competencia')
  if (aba) setAbaAtiva(aba as AbaAtiva)
  if (comp) setXmlCompetencia(comp)
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

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
- Não criar tabelas sem RLS habilitado
- Não expor URLs de Storage sem autenticação (nunca `getPublicUrl` em buckets de dados do usuário)
- Não inserir registros sem `org_id` em tabelas de dados fiscais
- Não usar `createAdminClient()` em Client Components nem expô-lo ao browser
- Não usar chave `sk_live_` do Stripe com cartões de teste — usar `sk_test_` para desenvolvimento local
- Não checar plano/permissão de Reforma Tributária "na mão" em uma página nova — sempre usar `getContextoAcesso`/`canAccessModule`/`canCreateCompany`/`canProcessXml`/`canGenerateReport` de `lib/planos/acessoReformaTributaria.ts`
- Não liberar vaga de CNPJ ao arquivar ou excluir empresa — a regra de negócio é que `rt_cnpj_slots` nunca é removida por ação do cliente
- Não adicionar módulo novo à plataforma completa sem colocar a pasta dentro de `app/(fiscal)/(full-platform)/` — é o único gate central para orgs `tax_reform_only`
