# Plataforma SaaS Contábil — Plano Técnico

## Objetivo

Evoluir o `sistema-controle` de ferramenta interna de auditoria para uma **plataforma SaaS contábil multiempresa e multiusuário**, voltada a escritórios de contabilidade de pequeno e médio porte.

O módulo fiscal é o núcleo principal e o primeiro a ser disponibilizado comercialmente em modelo **Founder Access** (pré-acesso com valor simbólico mensal). O foco inicial não é construir um ERP completo — é entregar auditoria fiscal inteligente, cruzamento de dados, validação tributária automatizada e ganho operacional real para escritórios contábeis.

### Pilares do sistema

| # | Pilar | Status |
|---|-------|--------|
| 1 | **Fiscal** | Núcleo — em produção |
| 2 | **Planejamento Tributário** | Stub criado |
| 3 | **Obrigações Acessórias** | Stub criado |
| 4 | **Contábil** | Planejado |
| 5 | **Departamento Pessoal** | Planejado |
| 6 | **Financeiro** | Planejado |

---

## Decisões de Arquitetura

- **Parsing no browser:** os parsers de SPED e XML já existem e funcionam. O backend salva apenas o resultado (JSON) — não reprocessa o arquivo.
- **Banco próprio:** projeto Supabase exclusivo do sistema-controle. Sem dependência de outros sistemas.
- **Motor de regras:** função TypeScript pura que recebe dados parseados e devolve lista de alertas. Sem chamadas externas.
- **Multi-tenant por organização:** o isolamento é feito por `org_id` (não por `user_id`). Vários usuários do mesmo escritório compartilham o mesmo `org_id`. O Supabase RLS usa a função `is_member_of(org_id)` para verificar pertencimento.
- **Admin client:** operações que precisam contornar o RLS (criação de org, aceitação de convite) usam `createAdminClient()` com `SUPABASE_SERVICE_ROLE_KEY`.
- **Plano por organização:** nova org começa com `plano='pendente'`. O pagamento via Stripe ativa o plano para `'founder_access'`. O webhook do Stripe chama `POST /api/stripe/webhook`.

---

## Arquitetura SaaS — Requisitos Obrigatórios

| Requisito | Implementação |
|-----------|--------------|
| Multi-tenant seguro | Supabase RLS em todas as tabelas |
| Isolamento por escritório | `org_id UUID` em tabelas críticas + política `is_member_of(org_id)` |
| Isolamento por empresa | `empresa_id` + validação de CNPJ em toda importação |
| Storage privado | Buckets sem acesso público; URLs assinadas com `createSignedUrl` |
| Auth obrigatória | Toda API route verifica `supabase.auth.getUser()` e retorna 401 se ausente |
| Validação de empresa | Toda importação (SPED, XML, PGDAS) valida empresa ativa e CNPJ |
| Controle de plano | Layout fiscal redireciona para `/aguardando-ativacao` se `plano='pendente'` |

---

## Núcleo Central de Dados — Integração entre Módulos

Princípio: **dados importados uma vez, reutilizados por todos os módulos**. Nenhum módulo importa o mesmo dado de forma isolada.

| Fonte | Alimenta |
|-------|----------|
| XML de NF-e | Fiscal, Simples Nacional, Contábil (futuro), Financeiro (futuro) |
| SPED Fiscal | Auditoria Fiscal, Planejamento Tributário, cruzamentos automáticos |
| SPED Contribuições | Módulo Fiscal, cálculos PIS/COFINS, cruzamento com NF-e |
| PGDAS-D | Simples Nacional, confronto com XMLs e faturamento apurado |
| Extrato bancário | Financeiro, Contábil (futuro) |
| eSocial / DCTFWeb | Departamento Pessoal (futuro) |

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16.2 + React 19 + TypeScript 5 |
| Estilo | Tailwind CSS 4 + estilos inline dark glass |
| Banco | Supabase PostgreSQL (projeto próprio) |
| Auth | Supabase Auth SSR |
| Storage | Supabase Storage (bucket `sped-files`) |
| Ícones | Lucide React |
| Exportação | XLSX |

---

## Estrutura de Arquivos

```
app/
├── login/page.tsx                         login (+ "Continuar logado" + link cadastro)
├── cadastro/page.tsx                      cadastro de novo usuário
├── aguardando-ativacao/page.tsx           tela de assinatura / ativação de plano
├── auth/callback/route.ts                 callback OAuth
├── configuracoes/novo-escritorio/page.tsx onboarding: criar org ou aceitar convite
├── (fiscal)/
│   ├── layout.tsx                         sidebar + auth guard + check de plano
│   ├── page.tsx                           dashboard
│   ├── SidebarFiscal.tsx                  sidebar com nome da org
│   ├── configuracoes/page.tsx             membros, plano, convites
│   ├── empresas/page.tsx                  cadastro de empresas
│   ├── auditor_fiscal/page.tsx            SPED Fiscal × Contribuições
│   ├── validador_entradas/page.tsx        XML + SPED C170
│   ├── inconsistencias/page.tsx           alertas consolidados
│   ├── simples_nacional/page.tsx          PGDAS-D
│   ├── planejamento/page.tsx              stub
│   └── obrigacoes/page.tsx               stub
└── api/
    ├── organizacoes/route.ts              GET org do usuário; POST criar org
    ├── membros/route.ts                   GET/POST/DELETE membros
    ├── convites/route.ts                  GET convite pendente; POST aceitar
    ├── stripe/checkout/route.ts           POST criar sessão Stripe Checkout
    ├── stripe/webhook/route.ts            POST webhook Stripe (ativar/suspender plano)
    ├── empresas/route.ts
    ├── empresas/[id]/route.ts
    ├── sessoes/route.ts
    ├── alertas/route.ts
    ├── alertas/[id]/route.ts
    ├── arquivos-sped/route.ts
    ├── arquivos-xml/route.ts
    └── simples_nacional/route.ts

lib/
├── supabase/client.ts
├── supabase/server.ts
├── supabase/admin.ts                      cliente service-role (bypassa RLS)
├── supabase/org.ts                        helper getOrgId(supabase, userId)
├── rules/types.ts
├── rules/engine.ts
├── rules/executores/icms.ts
├── rules/executores/pis_cofins.ts
├── rules/executores/cfop.ts
├── rules/executores/ncm.ts
└── types.ts

components/
└── SessionGuard.tsx                       guard de sessão client-side

middleware.ts
supabase_setup.sql
```

---

## Banco de Dados

Arquivo `supabase_setup.sql` contém DDL completo para:

**Tabelas de organização (SaaS):**
- `organizacoes` — escritórios; `plano` = `'pendente'` | `'founder_access'`
- `membros_organizacao` — vínculo usuário × org; `papel` = `'admin'` | `'membro'`
- `convites_organizacao` — convites por e-mail para orgs existentes

**Tabelas de dados fiscais** (todas com `org_id`):
- `empresas` — cadastro de empresas auditadas
- `fa_sessoes_analise` — agrupa arquivos por empresa+período
- `fa_arquivos_sped` — metadados + resultado parseado do SPED
- `fa_arquivos_xml` — metadados + resultado parseado de NF-e
- `fa_apuracoes_icms` — resultado E110
- `fa_apuracoes_contrib` — resultado M200/M600
- `fa_regras_fiscais` — catálogo de regras com seed inicial (compartilhado)
- `fa_alertas` — alertas gerados pelo motor
- `fa_obrigacoes_acessorias` — controle de entrega de obrigações
- `fa_planejamento_tributario` — simulações salvas
- `sn_declaracoes` — declarações PGDAS-D

**RLS — padrão por tabela de dados:**
- SELECT/UPDATE/DELETE: `public.is_member_of(org_id)`
- INSERT: `auth.role() = 'authenticated'` (workaround JWT Next.js 16.2 + `@supabase/ssr` 0.4.1)
- Função `is_member_of(p_org_id)` SECURITY DEFINER — evita recursão em `membros_organizacao`

---

## Motor de Regras (lib/rules/)

Regras seed incluídas no banco:

| Código | Risco | Fundamento |
|--------|-------|-----------|
| ICMS_CFOP_SAIDA_EM_ENTRADA | alto | SPED Auditoria |
| ICMS_CFOP_ENTRADA_EM_SAIDA | alto | SPED Auditoria |
| ICMS_UC_COM_CREDITO | alto | Art. 33 LC 87/1996 |
| ICMS_IMOB_SEM_CIAP | alto | Art. 20 §5º LC 87/1996 |
| NCM_ST_SEM_TRATAMENTO | alto | RICMS/GO Anexo VIII |
| OBRIG_SPED_ZERADO_COM_RECEITA | alto | IN RFB 1252/2012 |
| ICMS_ALIQUOTA_EFETIVA_BAIXA | médio | Art. 28 RCTE/GO |
| ICMS_DIVERGENCIA_FISCAL_CONTRIB | médio | IN RFB 1252/2012 |
| CFOP_INCOMPAT_CNAE | médio | RIPI/2010 |
| CFOP_DEVOLUCAO_INCORRETA | médio | SINIEF 1970 |
| NCM_BENEFICIO_NAO_APLICADO | médio | IN 1518/2022-GSE |
| CONTRIB_EXCLUSAO_INDEVIDA | médio | RE 841979 STJ |
| ICMS_SEM_PARTICIPANTE | baixo | — |

---

## Roadmap

---

## Fase PRÉ-BETA — Segurança, Integridade e Liberação Controlada

**Status: BLOQUEANTE — não liberar usuários externos antes de concluir os itens P0 e P1.**
Auditoria técnica realizada em 2026-06-02.

---

### Resumo Executivo

O sistema possui uma arquitetura multi-tenant bem estruturada com Supabase RLS como principal barreira de isolamento. A camada de autenticação (middleware + `getUser()`) está correta e consistente em todas as rotas de API. O design de "parse no browser, salvar no servidor" é adequado para o modelo SaaS.

Porém, foram identificadas **6 vulnerabilidades P0** que devem ser corrigidas antes de qualquer liberação a usuários externos. As mais críticas envolvem políticas RLS de INSERT excessivamente permissivas, que permitem contaminação cruzada de dados entre organizações, e um bug no webhook Stripe que impede o bloqueio de acesso após cancelamento de assinatura.

**Não há exposição de chaves em código versionado atual.** O antigo `debug-env` endpoint (que expôs fragmentos de chaves) foi removido e deve-se avaliar rotação das chaves Supabase e Stripe se ele chegou a ser acessado em produção.

---

### Inventário de Superfícies de Ataque

**Tabelas no banco (total: 17)**

| Tabela | RLS | INSERT policy | SELECT policy | DELETE policy | Risco |
|--------|-----|---------------|---------------|---------------|-------|
| `organizacoes` | ✅ | ❌ (sem policy — só service role via API) | is_member_of | is_member_of (admin) | Baixo |
| `membros_organizacao` | ✅ | ⚠️ `auth.role()='authenticated'` | user_id=uid OR is_member_of | ⚠️ `auth.role()='authenticated'` | **P0** |
| `convites_organizacao` | ✅ | ⚠️ `auth.role()='authenticated'` | ❌ Sem SELECT policy | is_member_of | **P0** |
| `empresas` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `fa_sessoes_analise` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `fa_arquivos_sped` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `fa_arquivos_xml` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `fa_apuracoes_icms` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `fa_apuracoes_contrib` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `fa_regras_fiscais` | ✅ | ⚠️ `auth.role()='authenticated'` + ALL | is_member_of | ⚠️ ALL policy | **P1** |
| `fa_alertas` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `fa_obrigacoes_acessorias` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `fa_planejamento_tributario` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `sn_declaracoes` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `fa_documentos_fiscais` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `fa_documentos_itens` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `sn_receitas_mensais` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `sn_apuracoes` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `sn_apuracoes_receitas` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |
| `cnpj_cache` | ✅ | ⚠️ `auth.role()='authenticated'` | `auth.role()='authenticated'` | ❌ Sem DELETE | Baixo |
| `cobrancas` | ✅ | ⚠️ `auth.role()='authenticated'` | is_member_of | is_member_of | P1 |

**Rotas de API (total: 29)**

| Rota | Método | Autenticação | Validação de org | Validação empresa_id vs org | Risco |
|------|---------|--------------|------------------|-----------------------------|-------|
| `GET /api/organizacoes` | GET | ✅ | ✅ (user_id filter) | — | OK |
| `POST /api/organizacoes` | POST | ✅ | ✅ (criação) | — | OK |
| `GET /api/membros` | GET | ✅ | ✅ | — | OK |
| `POST /api/membros` | POST | ✅ | ✅ (admin check) | — | OK |
| `DELETE /api/membros` | DELETE | ✅ | ✅ (org_id filter) | — | OK* |
| `GET /api/convites` | GET | ✅ | ✅ (email user) | — | OK |
| `POST /api/convites` | POST | ✅ | ✅ | — | OK |
| `POST /api/stripe/checkout` | POST | ✅ | ✅ | — | OK |
| `POST /api/stripe/webhook` | POST | Stripe sig | N/A | — | **P0 bug** |
| `GET /api/empresas` | GET | ✅ | ✅ (RLS) | — | OK |
| `POST /api/empresas` | POST | ✅ | ✅ | — | OK |
| `PUT /api/empresas/[id]` | PUT | ✅ | ✅ (RLS UPDATE) | — | OK |
| `DELETE /api/empresas/[id]` | DELETE | ✅ | ✅ (RLS UPDATE) | — | OK |
| `POST /api/empresas/cadastrar-por-cnpj` | POST | ✅ | ✅ | — | OK |
| `GET /api/sessoes` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `POST /api/sessoes` | POST | ✅ | ✅ | ⚠️ empresa_id não validado | **P1** |
| `GET /api/alertas` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `POST /api/alertas` | POST | ✅ | ✅ | ⚠️ empresa_id não validado | **P1** |
| `PATCH /api/alertas/[id]` | PATCH | ✅ | ✅ (RLS UPDATE) | — | OK |
| `GET /api/arquivos-sped` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `POST /api/arquivos-sped` | POST | ✅ | ✅ | ⚠️ empresa_id/sessao_id não validados | **P1** |
| `GET /api/arquivos-xml` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `POST /api/arquivos-xml` | POST | ✅ | ✅ | ⚠️ empresa_id/sessao_id não validados | **P1** |
| `GET /api/documentos-fiscais` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `POST /api/documentos-fiscais/importar-nfe` | POST | ✅ | ✅ | ⚠️ empresa_id não validado | **P1** |
| `PATCH /api/documentos-fiscais/importar-nfe` | PATCH | ✅ | ✅ (RLS UPDATE) | — | OK |
| `GET /api/documentos-fiscais/itens` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `PATCH /api/documentos-fiscais/itens/[id]` | PATCH | ✅ | ✅ (RLS UPDATE) | — | OK |
| `DELETE /api/fiscal/limpar-competencia` | DELETE | ✅ | ✅ (getOrgId) | ⚠️ empresa_id não validado | **P1** |
| `GET /api/fiscal/periodos-importados` | GET | ✅ | ✅ (getOrgId) | ⚠️ empresa_id não validado | P2 |
| `GET /api/simples_nacional` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `POST /api/simples_nacional` | POST | ✅ | ✅ | ⚠️ empresa_id não validado | **P1** |
| `DELETE /api/simples_nacional` | DELETE | ✅ | ✅ (RLS DELETE) | — | OK |
| `GET /api/simples/receitas-mensais` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `POST /api/simples/receitas-mensais` | POST | ✅ | ✅ | ⚠️ empresa_id não validado | **P1** |
| `GET /api/cnpj-cache` | GET | ✅ | — | — | OK |
| `GET /api/cnpj-debug` | GET | ✅ | — | — | **P1 remover** |
| `GET /api/cnpj/[cnpj]` | GET | ✅ | — | — | OK |
| `GET /api/relatorios/documentos` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `GET /api/relatorios/participantes` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `GET /api/relatorios/produtos` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `GET /api/relatorios/cfop` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `GET /api/relatorios/ncm` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `GET /api/cobrancas` | GET | ✅ | ✅ (RLS SELECT) | — | OK |
| `POST /api/cobrancas` | POST | ✅ | ✅ | ⚠️ empresa_id não validado | P2 |
| `PUT /api/cobrancas` | PUT | ✅ | ✅ (RLS UPDATE) | — | OK |
| `DELETE /api/cobrancas` | DELETE | ✅ | ✅ (RLS DELETE) | — | OK |

---

### Tabela de Vulnerabilidades

| # | Classificação | Título | Evidência | Impacto | Correção recomendada |
|---|---------------|--------|-----------|---------|----------------------|
| V01 | **P0** | INSERT RLS insuficiente: empresa_id cross-org via API | `supabase_setup.sql` todas as policies INSERT: `auth.role()='authenticated'`; sem restrição de org | Usuário autenticado de Org A pode criar sessões, alertas, arquivos SPED/XML apontando para empresa_id de Org B. Contaminação cruzada de dados entre escritórios. | Adicionar check `public.is_member_of(org_id)` a todas as policies INSERT de tabelas de dados. Ver V02 para complemento. |
| V02 | **P0** | empresa_id não validado contra org_id nas rotas POST | `app/api/sessoes/route.ts:46`, `app/api/alertas/route.ts:50`, `app/api/arquivos-sped/route.ts:38`, `app/api/arquivos-xml/route.ts:43`, `app/api/simples_nacional/route.ts:37`, `app/api/simples/receitas-mensais/route.ts:76`, `app/api/documentos-fiscais/importar-nfe/route.ts:47` | Antes de inserir, nenhuma rota verifica se `empresa_id` pertence à org do usuário autenticado. Combinado com V01, permite injeção de dados de Org A na empresa de Org B. | Antes de qualquer INSERT, validar: `const { count } = await supabase.from('empresas').select('id',{count:'exact',head:true}).eq('id',empresa_id).eq('org_id',orgId)` e retornar 403 se `count === 0`. |
| V03 | **P0** | membros_organizacao DELETE policy não restringe por org | `supabase_setup.sql:70`: `for delete using (auth.role() = 'authenticated')` | Usuário autenticado que conhece o UUID de um membro pode deletá-lo de qualquer org via chamada direta ao Supabase REST, sem passar pela API Next.js. | Trocar policy DELETE para `using (public.is_member_of(org_id))`. |
| V04 | **P0** | membros_organizacao INSERT policy não valida org | `supabase_setup.sql:68`: `for insert with check (auth.role() = 'authenticated')` | Usuário autenticado que conhece o `org_id` de outra organização pode inserir-se nela diretamente via Supabase REST, bypassando o sistema de convites. | Trocar policy INSERT para `with check (public.is_member_of(org_id))`. Operações legítimas de admin (criação de org, aceitação de convite) devem usar `createAdminClient()` que bypassa RLS. |
| V05 | **P0** | Cancelamento de assinatura Stripe não revoga acesso | `app/api/stripe/webhook/route.ts:34-46`: evento `customer.subscription.deleted` lê `subscription.metadata.org_id`, mas na criação do Checkout (`checkout/route.ts:17-26`) o `metadata` é definido apenas na `checkout.session`, não na `subscription`. Stripe não copia o metadata automaticamente. | O campo `orgId` será `undefined` no evento de cancelamento. O `if (orgId)` bloqueia silenciosamente. A org continuará com `plano='founder_access'` mesmo após cancelamento. | No checkout, adicionar `subscription_data: { metadata: { org_id: orgId } }` ao `stripe.checkout.sessions.create()`. Verificar também eventos `invoice.payment_failed` e `customer.subscription.updated`. |
| V06 | **P0** | Next.js com CVE de alta severidade (DoS) | `package.json`: `"next": "^16.2.1"` — CVE GHSA-q4gf-8mx6-v5v3 (CVSS 7.5, DoS em Server Components) e GHSA-v86f-89xz-kxfq | Atacante externo pode causar DoS enviando requisições malformadas para o servidor Next.js. | Atualizar para `next@^16.2.3` (mínimo) via `npm install next@latest`. |
| V07 | **P1** | fa_regras_fiscais: qualquer usuário pode alterar o catálogo global de regras | `supabase_setup.sql:330-333`: policies `regras_select` e `regras_all` com `auth.role()='authenticated'` sem restrição de org ou papel | Usuário autenticado pode inserir regras falsas, desativar regras existentes (`ativo=false`) ou modificar fundamentos legais do catálogo. | Remover policy `regras_all`. Restringir UPDATE/DELETE/INSERT a service_role (admin). Manter SELECT aberta para autenticados. |
| V08 | **P1** | Endpoint /api/cnpj-debug ainda ativo em produção | `app/api/cnpj-debug/route.ts` (arquivo existe, confirmado pelo glob) | Retorna JSON bruto da API pública de CNPJ, incluindo estrutura interna e chaves de diagnóstico. Superfície de ataque desnecessária. | Deletar o arquivo `app/api/cnpj-debug/route.ts`. |
| V09 | **P1** | Nenhum header de segurança HTTP configurado | `next.config.ts`: objeto vazio `{}`. Sem CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. | Exposição a clickjacking, MIME sniffing, XSS via inline scripts de terceiros, ausência de HTTPS enforced. | Adicionar `headers()` em `next.config.ts` com os headers de segurança padrão. Ver seção de correções. |
| V10 | **P1** | Verificação de plano ausente nas rotas de API | `app/(fiscal)/layout.tsx:26`: check de `plano='pendente'` apenas no layout. Nenhuma API route verifica o plano. | Usuário com `plano='pendente'` pode chamar diretamente qualquer `/api/*` (importar, listar, deletar dados) sem assinar. | Criar helper `checkPlano(supabase, orgId)` e chamar nas APIs relevantes, ou confiar no layout como única barreira (aceitável se o frontend não expõe as chamadas sem autenticação — discutir). |
| V11 | **P1** | xlsx Prototype Pollution (SheetJS) | `npm audit`: `xlsx` severity=high, GHSA-... Prototype Pollution. O xlsx é usado do lado do cliente (browser) para exportar dados. | Se dados de terceiros forem processados via xlsx (parsing de entrada), pode haver exploração. No uso atual (apenas escrita/exportação), o risco é menor, mas existe. | Avaliar substituição por `exceljs` (mantida ativamente) ou manter e garantir que xlsx nunca parse dados de entrada não confiáveis. |
| V12 | **P1** | Dado pessoal real (CPF/NF-e) no histórico Git | Commit `988741a` adicionou `xml_comdesconto.xml` com CPF `70824489101`, CNPJ, nome e endereço completos de pessoa física real. O arquivo permanece no histórico. | Violação da LGPD (Lei 13.709/2018): dados pessoais de pessoa física armazenados em repositório de código. Se o repositório for tornado público, expõe dados. | Remover da árvore de trabalho com `git rm xml_comdesconto.xml`. Discutir se é necessário reescrever o histórico com `git filter-repo`. Adicionar `*.xml` ao `.gitignore`. |
| V13 | **P1** | Debug-env endpoint expôs fragmentos de chaves | Commits `ee8df46` e `ee98a61` adicionaram e depois removeram `app/api/debug-env/route.ts` — endpoint SEM autenticação que retornava `SUPABASE_SERVICE_ROLE_KEY` parcialmente. | Se o endpoint chegou a ser deployado em produção (Vercel) antes da remoção, as chaves estão comprometidas mesmo que fragmentadas. | Verificar se o período de exposição coincidiu com um deploy ativo. Se sim, rotacionar `SUPABASE_SERVICE_ROLE_KEY` e `STRIPE_SECRET_KEY` imediatamente. |
| V14 | **P2** | Ausência de rate limiting no login/cadastro | `app/login/page.tsx` e Supabase Auth: sem rate limiting configurado explicitamente no lado da aplicação. | Ataques de força bruta contra contas de usuários. | Supabase Auth tem rate limiting interno (configurável no painel). Verificar e ajustar os limites no Supabase Studio > Auth > Rate Limits. Adicionar CAPTCHA no login como melhoria futura. |
| V15 | **P2** | @supabase/ssr com vulnerabilidade low na lib cookie | `npm audit`: `cookie < 0.7.0`, GHSA-pxg6-pf52-xh8x | Nomes de cookies com caracteres fora de faixa. Impacto prático baixo no contexto atual. | Atualizar `@supabase/ssr` para `>=0.10.3` quando estável e compatível com Next.js 16.2. |
| V16 | **P2** | sessao_id e empresa_id de outras orgs aceitos em arquivos SPED/XML sem validação | `app/api/arquivos-sped/route.ts:33` e `app/api/arquivos-xml/route.ts:21`: `sessao_id` e `empresa_id` vêm do body sem validação cruzada | Um usuário pode fornecer `sessao_id` de outra org e o INSERT (com RLS fraca) pode aceitar — criando arquivos vinculados a sessões de terceiros. | Validar que `sessao_id` pertence à `org_id` do usuário antes de inserir. Implementar em conjunto com V02. |
| V17 | **P2** | Nenhum limite de tamanho em uploads de SPED/XML via JSON | `app/api/arquivos-xml/route.ts:post`: aceita array de XMLs sem limite; `parsed_data` JSONB sem tamanho máximo. `app/api/arquivos-sped/route.ts`: `parsed_data` potencialmente gigante. | Um usuário mal-intencionado pode enviar payloads JSONB muito grandes (SPED com 500k registros = JSONB de dezenas de MB), sobrecarregando o banco. | Adicionar `Content-Length` check nas API routes críticas. Limitar `total_linhas` e tamanho de `parsed_data`. Considerar limitar o POST do Next.js via `next.config.ts` (`bodySizeLimit`). |
| V18 | **P2** | Enumeração de todos os usuários via `listUsers()` | `app/api/membros/route.ts:63`: `admin.auth.admin.listUsers()` busca TODOS os usuários para encontrar o e-mail convidado. | A cada convite, o servidor lista todos os usuários do projeto Supabase. Crescerá com o número de usuários. Também expõe todos os user IDs ao processo Node.js. | Substituir por `admin.auth.admin.listUsers({filter: 'email=...'})` com filtro, ou usar `getUserByEmail()` se disponível. |
| V19 | **P2** | Verificação de `empresa_id` ausente no DELETE limpar-competencia | `app/api/fiscal/limpar-competencia/route.ts:22-28`: valida `getOrgId` mas não verifica se `empresa_id` pertence à org. | Usuário pode deletar competência de empresa de outra org se souber o UUID. O RLS DELETE de `fa_documentos_fiscais` usa `is_member_of(org_id)` — mitiga parcialmente, mas `fa_arquivos_xml` DELETE também pode ser explorado. | Adicionar validação da empresa antes da deleção. |
| V20 | **P3** | Ausência de confirmação de e-mail no cadastro | `app/cadastro/page.tsx` + Supabase Auth: não há verificação se a confirmação de e-mail está habilitada no Supabase. | Usuários podem se cadastrar com e-mails de terceiros e ter acesso imediato ao sistema. | Habilitar "Email confirmation" no Supabase Studio > Auth > Providers > Email. |
| V21 | **P3** | Sem política mínima de senha | Login/cadastro: não há validação do lado da aplicação além do Supabase padrão. | Usuários podem criar senhas muito fracas (depende da configuração do Supabase). | Configurar senha mínima de 8 caracteres no Supabase Studio > Auth > Password. |
| V22 | **P3** | Sem estratégia de backup/monitoramento/resposta a incidentes | Não foi identificado nenhum mecanismo de backup de banco, alertas de erro, ou runbook de incidente. | Em caso de falha, perda de dados ou comprometimento, não há plano de resposta. | Habilitar Point-in-Time Recovery (PITR) no Supabase. Configurar Sentry ou similar para erros em produção. Documentar runbook mínimo. |
| V23 | **P3** | `competencia` não validada como MM/YYYY nas rotas | Múltiplas rotas recebem `competencia` como string sem validação de formato. | Dados malformados podem quebrar filtragens e cálculos que assumem o formato MM/YYYY. | Adicionar regex de validação `/^\d{2}\/\d{4}$/` nas rotas que recebem `competencia`. |

---

### Ordem Sugerida de Correção

**Semana 1 — P0 críticos (pré-condição absoluta para beta):**

1. **V05** — Corrigir webhook Stripe: adicionar `subscription_data: { metadata: { org_id: orgId } }` ao checkout. **Testar com Stripe CLI.**
2. **V06** — Atualizar Next.js para `>=16.2.3`.
3. **V01 + V04** — Fortalecer RLS INSERT de `membros_organizacao`: `with check (public.is_member_of(org_id))`. Criar migração SQL.
4. **V03** — Fortalecer RLS DELETE de `membros_organizacao`: `using (public.is_member_of(org_id))`.
5. **V02 + V16** — Validar `empresa_id` pertence à org do usuário em todas as rotas POST que recebem esse campo. Criar helper `validarEmpresaDaOrg(supabase, empresaId, orgId)`.
6. **V07** — Restringir policies de `fa_regras_fiscais` a service_role.
7. **V13** — Avaliar rotação de chaves (ver seção de dúvidas externas).

**Semana 2 — P1 importantes (antes de beta):**

8. **V08** — Deletar `app/api/cnpj-debug/route.ts`.
9. **V09** — Adicionar headers de segurança no `next.config.ts`.
10. **V12** — Remover `xml_comdesconto.xml` do working tree. Adicionar `*.xml` ao `.gitignore`.
11. **V10** — Adicionar verificação de plano nas rotas de API mais críticas (importação, deleção).

**Semana 3 — P2 (antes de crescimento de usuários):**

12. **V14** — Verificar rate limiting no Supabase Studio.
13. **V17** — Adicionar limites de payload nas rotas de importação.
14. **V18** — Substituir `listUsers()` por filtro de e-mail.
15. **V19** — Validar empresa antes do delete de competência.

**P3 — Acumular no backlog:**

16. V20, V21, V22, V23 — Melhorias de longo prazo.

---

### Correções Recomendadas Detalhadas

#### V09 — Headers de Segurança (`next.config.ts`)

```typescript
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // necessário pois Next.js usa inline scripts
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://publica.cnpj.ws",
      "frame-ancestors 'none'",
    ].join('; '),
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}
```

#### V01/V04 — RLS INSERT `membros_organizacao`

```sql
-- Migração: fortalecer policies de membros_organizacao
DROP POLICY IF EXISTS "membros_insert" ON public.membros_organizacao;
DROP POLICY IF EXISTS "membros_delete" ON public.membros_organizacao;

CREATE POLICY "membros_insert" ON public.membros_organizacao
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

CREATE POLICY "membros_delete" ON public.membros_organizacao
  FOR DELETE USING (public.is_member_of(org_id));
```

> **Atenção:** Esta mudança quebrará a criação de org (chicken-and-egg). A API `POST /api/organizacoes` já usa `createAdminClient()` para o INSERT em `membros_organizacao`, então continua funcionando. A aceitação de convite em `POST /api/convites` também usa `createAdminClient()`. Confirmar que nenhum outro INSERT em `membros_organizacao` passa pelo cliente normal.

#### V02 — Validação de empresa_id (helper sugerido)

```typescript
// lib/supabase/validateEmpresa.ts
export async function validarEmpresaDaOrg(
  supabase: SupabaseClient,
  empresaId: string,
  orgId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('empresas')
    .select('id', { count: 'exact', head: true })
    .eq('id', empresaId)
    .eq('org_id', orgId)
  return (count ?? 0) > 0
}
```

Chamar antes de qualquer INSERT que receba `empresa_id` do body:
```typescript
const valida = await validarEmpresaDaOrg(supabase, empresa_id, orgId)
if (!valida) return NextResponse.json({ error: 'empresa_id inválido' }, { status: 403 })
```

#### V05 — Stripe webhook cancellation fix

```typescript
// app/api/stripe/checkout/route.ts
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  subscription_data: {
    metadata: { org_id: orgId },  // ← adicionar isto
  },
  metadata: { org_id: orgId },
  // ... resto igual
})
```

#### V07 — Restringir fa_regras_fiscais

```sql
DROP POLICY IF EXISTS "regras_all" ON public.fa_regras_fiscais;
DROP POLICY IF EXISTS "regras_select" ON public.fa_regras_fiscais;

-- Somente leitura para autenticados
CREATE POLICY "regras_select" ON public.fa_regras_fiscais
  FOR SELECT USING (auth.role() = 'authenticated');
-- Modificações apenas via service_role (admin) — sem policy = service_role bypassa
```

---

### Dúvidas que Dependem de Configuração Externa

| # | Sistema | Questão | Impacto |
|---|---------|---------|---------|
| D1 | **Supabase** | O endpoint `debug-env` (commits `ee8df46`/`ee98a61`) foi deployado no Vercel antes de ser removido? Se sim, o `SUPABASE_SERVICE_ROLE_KEY` foi acessado por alguém? | Se sim: rotacionar service_role key imediatamente no Supabase Studio > Project Settings > API. |
| D2 | **Supabase** | Rate limiting de autenticação está configurado? (Auth > Rate Limits no Studio) | Brute-force de login se não configurado. |
| D3 | **Supabase** | "Confirm email" está habilitado em Auth > Providers > Email? | Usuários com e-mails de terceiros se o não estiver. |
| D4 | **Supabase** | Point-in-Time Recovery (PITR) está habilitado no plano? | Risco de perda de dados sem backup configurado. |
| D5 | **Supabase** | Há alguma regra de firewall ou allowlist de IPs no banco? | Conexões diretas ao banco pela anon_key ficam expostas sem isso. |
| D6 | **Vercel** | Os logs de deploy/runtime estão sendo retidos? Existe algum dado sensível sendo logado? | Sem visibilidade de incidentes. |
| D7 | **Stripe** | O Stripe Dashboard mostra assinaturas canceladas com `org_id` no metadata da subscription (não só da session)? | Confirma se V05 já ocorre ou ainda não. |
| D8 | **Stripe** | O webhook está configurado para receber também `invoice.payment_failed` e `customer.subscription.updated`? | Falha de cobrança não revogaria acesso sem esses eventos. |
| D9 | **GitHub** | O repositório é público ou privado? | Se público, o arquivo `xml_comdesconto.xml` e dados pessoais estão completamente expostos. |

---

### Suíte de Testes Multi-Tenant Proposta

Criar duas organizações de teste com tokens JWT distintos:
- **Org A**: admin_a@test.com, empresa_A_id = UUID-A, sessao_A_id = UUID-SA
- **Org B**: admin_b@test.com, empresa_B_id = UUID-B, sessao_B_id = UUID-SB

**Testes de isolamento GET:**
- [ ] GET /api/empresas com token de A → não retorna empresa B
- [ ] GET /api/sessoes?empresa_id=UUID-B com token de A → lista vazia
- [ ] GET /api/alertas?empresa_id=UUID-B com token de A → lista vazia
- [ ] GET /api/arquivos-xml?empresa_id=UUID-B com token de A → lista vazia
- [ ] GET /api/simples_nacional?empresa_id=UUID-B com token de A → lista vazia
- [ ] GET /api/relatorios/documentos?empresa_id=UUID-B com token de A → lista vazia ou 403

**Testes de IDOR POST (tentar injetar empresa de outra org):**
- [ ] POST /api/sessoes com token de A, body `{empresa_id: UUID-B, competencia: "01/2025"}` → deve retornar 403
- [ ] POST /api/alertas com token de A, body `[{empresa_id: UUID-B, ...}]` → deve retornar 403
- [ ] POST /api/arquivos-xml com token de A, body `{empresa_id: UUID-B, ...}` → deve retornar 403
- [ ] POST /api/simples_nacional com token de A, body `{empresa_id: UUID-B, ...}` → deve retornar 403
- [ ] POST /api/simples/receitas-mensais com token de A, body `{empresa_id: UUID-B, ...}` → deve retornar 403
- [ ] DELETE /api/fiscal/limpar-competencia?empresa_id=UUID-B&competencia=01/2025 com token de A → deve retornar 403

**Testes de IDOR UPDATE/DELETE:**
- [ ] PUT /api/empresas/UUID-B com token de A → deve retornar 404 ou erro
- [ ] PATCH /api/alertas/UUID-alerta-B com token de A → deve retornar erro (RLS)
- [ ] DELETE /api/membros?id=UUID-membro-B com token de A → deve retornar 404 (não encontrar)
- [ ] DELETE /api/simples_nacional?id=UUID-declaracao-B com token de A → deve retornar erro (RLS)

**Testes de usuário não autenticado:**
- [ ] GET /api/empresas sem token → deve retornar 401
- [ ] POST /api/sessoes sem token → deve retornar 401
- [ ] GET /api/relatorios/documentos sem token → deve retornar 401
- [ ] DELETE /api/fiscal/limpar-competencia sem token → deve retornar 401

**Testes com usuário de plano pendente:**
- [ ] Criar usuário com plano='pendente' e tentar acessar layout fiscal → deve redirecionar
- [ ] Com plano='pendente', chamar POST /api/sessoes com token válido → verificar se aceita (atual: aceita — V10)
- [ ] Com plano='pendente', chamar POST /api/arquivos-xml → verificar se aceita

**Testes de injeção via Supabase REST (bypass da API):**
- [ ] INSERT direto em membros_organizacao via anon key + JWT de A, com org_id=UUID-org-B → deve ser bloqueado pelo RLS
- [ ] DELETE direto em membros_organizacao via anon key + JWT, por UUID conhecido → deve ser bloqueado pelo RLS (após V03)
- [ ] INSERT direto em fa_regras_fiscais via anon key → deve ser bloqueado (após V07)

---

### Checklist Final — Liberar Beta

**Segurança (P0 — OBRIGATÓRIO):**
- [ ] V01/V04: RLS INSERT `membros_organizacao` fortalecido com `is_member_of`
- [ ] V02/V16: `empresa_id` validado contra org em todas as rotas POST de dados fiscais
- [ ] V03: RLS DELETE `membros_organizacao` corrigido
- [ ] V05: Webhook Stripe corrigido — cancelamento revoga acesso (testar com Stripe CLI)
- [ ] V06: Next.js atualizado para `>=16.2.3`
- [ ] V07: `fa_regras_fiscais` restrita a service_role para escrita
- [ ] V13: Decisão tomada sobre rotação de chaves pós-debug-env

**Segurança (P1 — RECOMENDADO):**
- [ ] V08: `/api/cnpj-debug` removido
- [ ] V09: Headers de segurança HTTP configurados no `next.config.ts`
- [ ] V10: Verificação de plano nas APIs críticas ou decisão documentada de aceitar
- [ ] V12: `xml_comdesconto.xml` removido do working tree
- [ ] V11: Avaliação do xlsx (uso somente para escrita = baixo risco)

**Funcional:**
- [ ] Suíte de testes multi-tenant executada manualmente com os dois usuários de teste
- [ ] Webhook Stripe testado com Stripe CLI (checkout + cancelamento + falha de pagamento)
- [ ] Fluxo completo de cadastro → onboarding → assinatura → uso → cancelamento testado

**Configurações externas (confirmar antes do beta):**
- [ ] D1: Avaliar rotação de service_role key (se debug-env chegou ao Vercel)
- [ ] D2: Rate limiting de Auth configurado no Supabase Studio
- [ ] D3: Confirm email habilitado
- [ ] D7/D8: Webhook Stripe configurado para os eventos corretos
- [ ] D9: Repositório GitHub verificado como privado

---

### Fase PRÉ-BETA — Próximas Ações

- [x] PRÉ-BETA.1: Criar migração SQL para corrigir RLS de `membros_organizacao` e `fa_regras_fiscais` — `supabase_migration_pre_beta_rls.sql` criado (aplicar manualmente no Supabase Studio)
- [x] PRÉ-BETA.2: Criar helper `validarEmpresaDaOrg` e aplicar em todas as rotas POST — `lib/supabase/validation.ts` criado; 16 rotas de API corrigidas
- [x] PRÉ-BETA.HOMOLOGACAO: Preparar ambiente de homologação isolado da produção — branch `homologacao` criada; banner de aviso; docs em `docs/HOMOLOGACAO_*.md`; script PowerShell em `tests/security/run-multi-tenant-manual.ps1`; `.env.homologacao.example` criado (2026-06-02)
- [ ] **PRÉ-BETA.APLICAR-BANCO**: Aplicar SQLs no banco de homologação (etapa obrigatória antes de testes) — executar em ordem: `supabase_setup.sql` → `supabase_migration_fase_a.sql` → `supabase_migration_cnpj_cache.sql` → `supabase_migration_pre_beta_rls.sql`; verificar com `docs/HOMOLOGACAO_SQL_VERIFICACAO.sql`
- [ ] **PRÉ-BETA.VERCEL-PREVIEW**: Configurar variáveis de ambiente na Vercel (Preview only, branch `homologacao`) e confirmar que a faixa laranja aparece na Preview URL
- [ ] PRÉ-BETA.3: Corrigir webhook Stripe (subscription_data.metadata)
- [ ] PRÉ-BETA.4: Atualizar Next.js
- [ ] PRÉ-BETA.5: Adicionar headers HTTP no next.config.ts
- [ ] PRÉ-BETA.6: Remover cnpj-debug e xml_comdesconto.xml
- [ ] PRÉ-BETA.7: Executar suíte de testes multi-tenant — suíte em `tests/security/multi-tenant.test.ts`; script manual em `tests/security/run-multi-tenant-manual.ps1`; **depende de APLICAR-BANCO e VERCEL-PREVIEW**
- [ ] PRÉ-BETA.8: Verificar configurações no Supabase Studio e Stripe Dashboard

---

### Ambiente de Homologação — Estrutura Criada (2026-06-02)

**Branch:** `homologacao` (criada a partir do master com todas as correções do BLOCO 1)

**Arquivos criados na branch `homologacao`:**

| Arquivo | Finalidade |
|---------|-----------|
| `.env.homologacao.example` | Template de variáveis (sem chaves reais) |
| `docs/HOMOLOGACAO_SETUP.md` | Guia rápido para o desenvolvedor |
| `docs/HOMOLOGACAO_CHECKLIST.md` | Checklist completo de 57 itens de validação |
| `docs/HOMOLOGACAO_SUPABASE_PASSO_A_PASSO.md` | Criar projeto Supabase de homologação |
| `docs/HOMOLOGACAO_SQL_VERIFICACAO.sql` | Queries de verificação pós-instalação |
| `docs/HOMOLOGACAO_VERCEL_PASSO_A_PASSO.md` | Configurar Preview Deployment na Vercel |
| `docs/HOMOLOGACAO_TESTES_VISUAIS.md` | Testes pela interface (12 passos) |
| `docs/HOMOLOGACAO_RESULTADOS_MODELO.md` | Template para registrar resultados |
| `tests/security/README.md` | Instruções da suíte de testes |
| `tests/security/run-multi-tenant-manual.ps1` | Script interativo (9 testes, relatório automático) |
| `tests/security/run-multi-tenant-manual.example.ps1` | Exemplo com dados fictícios |

**Indicador visual:** banner laranja fixo no topo de todas as páginas quando `NEXT_PUBLIC_APP_ENV=homologacao`.

**Regra crítica:** nenhum arquivo desta lista contém chaves reais ou dados de produção.

---

### Fase 0 — Fundação SaaS ✅ CONCLUÍDA (2026-05-19)

**Implementação real:** multi-tenant por organização (`org_id`), não por usuário individual. Escritórios têm múltiplos usuários no mesmo `org_id`.

- [x] Tabelas `organizacoes`, `membros_organizacao`, `convites_organizacao`
- [x] Todas as tabelas de dados com `org_id` + RLS via `is_member_of(org_id)`
- [x] Função SECURITY DEFINER `is_member_of()` — evita recursão circular
- [x] Fluxo de cadastro: `/cadastro` → `/configuracoes/novo-escritorio` → `/(fiscal)/`
- [x] Controle de plano: org criada com `plano='pendente'`; layout redireciona para `/aguardando-ativacao`
- [x] Stripe Checkout (`POST /api/stripe/checkout`) + webhook (`POST /api/stripe/webhook`) ativando `plano='founder_access'`
- [x] Sistema de convites: admin convida por e-mail → `convites_organizacao` → aceito em `/configuracoes/novo-escritorio`
- [x] Gestão de membros: página `/configuracoes` lista, adiciona e remove membros
- [x] Sessão de browser: `sessionStorage` (expira ao fechar) + opt-in `localStorage` "Continuar logado"
- [x] `lib/supabase/admin.ts` — cliente service-role para operações que contornam RLS
- [x] `lib/supabase/org.ts` — helper `getOrgId(supabase, userId)`
- [x] Deployment: GitHub → Vercel → `auditor.enfokus.com.br`

---

### Fase 1 — MVP ✅ CONCLUÍDA

- [x] Login e logout com Supabase Auth
- [x] Seletor de empresa antes de iniciar análise
- [x] Persistência de sessões e arquivos SPED no banco (parsed_data não-nulo)
- [x] Dashboard com KPIs de alertas
- [x] Tela de inconsistências com filtros e filtro por empresa ativa

### Fase 1.5 — Validador NF-e avançado ✅ CONCLUÍDA

- [x] Dois fluxos de importação XML (terceiros/próprios) com validação de CNPJ
- [x] CFOP de entrada sugerido com MAPA_CFOP + regra geral
- [x] Modal de seleção de CFOP por nota para CFOPs sem equivalente oficial
- [x] NCM_UC ampliado com itens domésticos
- [x] DESC_CFOP completa (~300 entradas)
- [x] Resumo por CFOP usando CFOP de entrada (não de saída do fornecedor)
- [x] Exportação Excel com coluna CFOP Entrada e resumo corrigido
- [x] Flag `classificacaoManual` para preservar seleções manuais ao trocar perfil
- [x] Aviso de nota entrada de terceiro com botão fechar

### Fase 2.5 — Auditor SPED Refatorado ✅ CONCLUÍDA

- [x] Extrair parsers para `lib/sped/parsers.ts` (funções existentes movidas + estendidas)
- [x] Criar `lib/sped/types.ts` com interfaces limpas
- [x] Estender `parseContrib` com campos PIS/COFINS do C170 e registros M200/M600
- [x] Criar `lib/sped/validators.ts` com 8 validações automáticas (V01–V08)
- [x] Nova página com 3 abas: Cruzamento | Apuração | Inconsistências
- [x] KPIs: docs fiscal, docs contrib, divergências, ICMS/PIS/COFINS a recolher

### Fase 2 — Simples Nacional (Fase 1) ✅ CONCLUÍDA

**Arquivos criados/modificados:**

| Arquivo | Ação |
|---|---|
| `supabase_setup.sql` | Adicionada tabela `sn_declaracoes` (seção 11) |
| `lib/types.ts` | Adicionados `SnTributo`, `SnHistoricoMes`, `SnAtividade`, `SnParsedData`, `SnDeclaracao` |
| `lib/simples/parsePgdas.ts` | Criado — parser PDF browser-side via `pdfjs-dist` |
| `app/api/simples_nacional/route.ts` | Criado — POST/GET/DELETE declarações |
| `app/(fiscal)/simples_nacional/page.tsx` | Criado — página principal |
| `app/(fiscal)/SidebarFiscal.tsx` | Adicionado link Simples Nacional (ícone Receipt) |
| `public/pdf.worker.min.mjs` | Copiado de `node_modules/pdfjs-dist/build/` |

**Funcionalidades implementadas:**

- [x] Importação de PDFs do PGDAS-D (browser-side, sem servidor)
- [x] Extração de: CNPJ, razão social, período, tipo (Original/Retificadora), atividade, anexo, receitas, tributos individuais, histórico mensal, total devido, nº recibo
- [x] Extração de múltiplas atividades (seção 2.8) — breakdown por atividade quando empresa tem Comércio + Serviços
- [x] Modal de confirmação antes de salvar, com alerta de CNPJ divergente (comparação por raiz — 8 primeiros dígitos)
- [x] Persistência na tabela `sn_declaracoes` via upsert (`onConflict: empresa_id,competencia`)
- [x] Tabela multi-período: linhas = períodos, colunas = Receita Bruta | Total Impostos | Alíquota Efetiva
- [x] Chip "Retificadora" (âmbar) para declarações retificadoras
- [x] Chip "Anexo X" (ciano) com tooltip da atividade completa
- [x] Linhas expansíveis: atividade única → chips de tributos; múltiplas atividades → cards por atividade com total individual
- [x] Botão "Limpar tudo" (remove todas as declarações da empresa)
- [x] Botão "Exportar Excel": planilha "PGDAS-D" + planilha "Por Atividade" (gerada se houver dados multi-atividade)
- [x] KPIs: Receita/Imposto último período, Receita/Imposto total acumulado, Alíquota média, Acumulado 12m
- [x] Drag & drop de PDFs quando a lista está vazia

**Tabela `sn_declaracoes`:**
```sql
CREATE TABLE sn_declaracoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  competencia TEXT NOT NULL,
  receita_bruta_mes NUMERIC(15,2),
  receita_bruta_acumulada_12m NUMERIC(15,2),
  receita_bruta_ano NUMERIC(15,2),
  valor_total_devido NUMERIC(15,2),
  numero_recibo TEXT,
  nome_arquivo TEXT,
  parsed_data JSONB,   -- inclui tributos[], atividades[]?, historico_mensal[], etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, competencia)
);
```

### Fase 3 — Simples Nacional (Fase 2) — Confronto PGDAS × NF-e ✅ CONCLUÍDA (2026-05-22)

- [x] Aba "Confronto NF-e" na página `/simples_nacional`
- [x] Somar `valor_total` das NF-e de saída por período e comparar com PGDAS declarado
- [x] Apuração do Sistema: calcular tributos pelos Anexos I–V com RBT12 real
- [x] Comparar apuração calculada vs. PGDAS — destacar diferenças

### Fase A — Base Fiscal Central + Apuração Simples Nacional ✅ CONCLUÍDA (2026-05-23)

Implementação da camada de dados centralizada para documentos fiscais e apuração do Simples.

**Banco (migração `supabase_migration_fase_a.sql` — idempotente):**
- [x] Coluna `competencia` (MM/YYYY) em `fa_arquivos_xml` + backfill de registros antigos
- [x] Tabela `fa_documentos_fiscais` — cabeçalho central dos documentos (NF-e, NFC-e, etc.)
- [x] Tabela `fa_documentos_itens` — itens dos documentos (1 linha por produto/serviço)
- [x] Tabela `sn_receitas_mensais` — histórico de receita bruta por competência
- [x] Tabela `sn_apuracoes` — resultado da apuração simulada por competência
- [x] Tabela `sn_apuracoes_receitas` — breakdown por anexo dentro da apuração
- [x] RLS + índices em todas as tabelas novas

**API:**
- [x] `GET /api/documentos-fiscais` — busca com paginação via `fetchAll`, suporte a `incluir_itens=true`
- [x] `POST /api/documentos-fiscais/importar-nfe` — salva documento + itens em `fa_documentos_fiscais`/`fa_documentos_itens`
- [x] `DELETE /api/fiscal/limpar-competencia` — remove todos os documentos e XMLs de uma competência

**`lib/supabase/fetchAll.ts`:**
- [x] Utilitário de paginação: busca todos os registros em lotes de 1000, supera o limite PostgREST

**Validador NF-e (`/validador_entradas`):**
- [x] `onConfirmarSessaoXml` salva em `fa_arquivos_xml` E em `fa_documentos_fiscais`/`fa_documentos_itens`
- [x] `carregarSessaoAnterior` — fallback: se `parsed_data` não tem itens, busca de `fa_documentos_itens` via API e mapeia para `LinhaEntrada[]`/`LinhaSaida[]`
- [x] Estado `salvouComSucesso` + banner de sucesso com botão "Ver Apuração do Sistema →"
- [x] Função `limparCompetenciaDb()` — deleta do banco via `DELETE /api/fiscal/limpar-competencia` + `window.confirm`
- [x] Botão "Limpar MM/YYYY" (vermelho) na toolbar, visível apenas quando há sessão ativa
- [x] `useRouter` para navegação para `/simples_nacional?aba=apuracao_sistema&competencia=...`

**Simples Nacional (`/simples_nacional`) — Aba "Apuração do Sistema":**
- [x] `carregarXmlDocumentos` usa `fetchAll` (supera limite de 1000) + carrega `xmlItens` de `fa_documentos_itens`
- [x] `useEffect` on mount lê `?aba=` e `?competencia=` via `window.location.search` (sem `useSearchParams`)
- [x] Auto-formato do input de competência: `012025` → `01/2025` conforme digitação
- [x] Removida tabela por-nota (apenas KPIs de faturamento permanecem)
- [x] Removida UI de importação da aba Apuração (centralizada no Validador)
- [x] Botão "Ir para o Validador NF-e →" no empty state (quando sem XMLs para competência buscada)
- [x] `replace_sessao=true` no POST de arquivos-xml limpa XMLs de todas as sessões `apuracao_simples` da mesma empresa+competência

### Fase B — Correções Críticas + Evolução da Apuração Simples Nacional ✅ CONCLUÍDA (2026-05-25)

**Problemas corrigidos:**

| # | Bug | Arquivo | Detalhe |
|---|-----|---------|---------|
| 1 | RBT12 manual salvo na competência apurada (jamais encontrado de volta) | `simples_nacional/page.tsx` | `handleConfirmarRbt12` agora distribui pelos 12 meses anteriores via `competenciasAnteriores()` com `origem: 'estimado'` |
| 2 | Meses faltantes não identificados | `simples_nacional/page.tsx` | `mesesFaltantes` calculado via `useMemo`; modal RBT12 redesenhado com campo individual por mês + opção de total |
| 3 | Empresas com <12 meses sem média proporcional | `simples_nacional/page.tsx` | `handleApurar` detecta `receitas12m.length > 0 && < 12` e calcula `rbt12 = (soma/n) * 12` com confirmação |
| 4 | Desconto não deduzido na acumulação por anexo | `lib/simples/calcularSimples.ts:164` | Era `vItem = valor_total`; corrigido para `Math.max(0, valor_total - valor_desconto)` — base legal LC 123/2006 art. 3º §1º |
| 5 | Rateio de desconto XML com double-counting | `validador_entradas/page.tsx` (`parseXml`) | Pré-scan calcula `vDescRestante = max(0, vDescNota − somaDescItens)` e distribui APENAS entre itens sem vDesc próprio (algoritmo igual ao `parseNfe.ts`) |

**Melhorias implementadas:**

- [x] `AbaApuracaoSistema` extraída como componente separado com props bem definidas (antes era inline na página)
- [x] Helpers client-side: `competenciasAnteriores()`, `fmtCompetencia()`, `MESES_PT`
- [x] Chips visuais `chipMovimento()` e `chipImpacto()` para os documentos fiscais
- [x] `BlocoAnexo`, `LinhaReceitaExtrato`, `ExtratoPgdasSimulado` — componentes para extrato detalhado da apuração
- [x] `xmlPreview` — preview dos XMLs antes de confirmar importação
- [x] `rbt12Sugestao` — PGDAS-D sugere RBT12 mas não aplica automaticamente; exige confirmação no modal
- [x] Campo `valor_total_nota` em `LinhaSaida` — fonte verdade vNF da nota (evita divergências com somas de itens)
- [x] Deduplicação por `chave_nfe` ao restaurar sessão anterior no Validador NF-e
- [x] `POST /api/simples_nacional` agora popula `sn_receitas_mensais` com o histórico mensal do PGDAS-D (sem sobrescrever entradas `origem='manual'`)
- [x] Tipos TypeScript completos em `lib/types.ts`: `DocumentoFiscal`, `DocumentoFiscalItem`, `SnReceitaMensal`, `SnApuracao`, `SnApuracaoReceita` + enums auxiliares

**Arquivos afetados:**

| Arquivo | O que mudou |
|---------|------------|
| `lib/simples/calcularSimples.ts` | Linha 164 — dedução de desconto na acumulação por anexo |
| `app/(fiscal)/simples_nacional/page.tsx` | Helpers, estados, `handleApurar`, `handleConfirmarRbt12`, modal meses individuais, `AbaApuracaoSistema`, chips, extrato |
| `app/(fiscal)/validador_entradas/page.tsx` | Algoritmo de desconto `parseXml`, campo `valor_total_nota`, deduplicação, `salvouComSucesso`, `router` |
| `app/api/simples_nacional/route.ts` | Popula `sn_receitas_mensais` no POST; respeita `origem='manual'` |
| `lib/types.ts` | `DocumentoFiscal`, `DocumentoFiscalItem`, `SnReceitaMensal`, `SnApuracao`, `SnApuracaoReceita`, enums |

---

### Fase C — Reforma Visual UI/UX ✅ CONCLUÍDA (2026-05-27)

- [x] Tokens glassmorphism em `app/globals.css` (`--af-glass-bg`, `--af-glass-border`, `--af-glass-blur`)
- [x] 4 componentes compartilhados em `components/ui/`: `PageHeader`, `GlassCard`, `MetricCard`, `EmptyState`
- [x] Dashboard (`app/(fiscal)/page.tsx`) convertido para Client Component + gráficos Recharts por empresa ativa
- [x] `/inconsistencias` → **Relatórios** com 6 abas: Inconsistências, Documentos, Produtos, Participantes, CFOP, NCM
- [x] 6 novas API routes: `/api/relatorios/documentos`, `/produtos`, `/participantes`, `/cfop`, `/ncm`, `/cnpj-cache`
- [x] `PageHeader` padronizado em todas as páginas (`auditor_fiscal`, `validador_entradas`, `simples_nacional`, `empresas`, `obrigacoes`, `planejamento`, `configuracoes`, `editor_sped`)
- [x] Sidebar: label "Inconsistências" → "Relatórios", ícone `TriangleAlert` → `BarChart3`
- [x] Simples Nacional: aba padrão trocada para "Apuração pelo Sistema"
- [x] Validador NF-e: cabeçalho simplificado, barra de ações separada, remoção de redundâncias
- [x] `supabase_migration_cnpj_cache.sql` criado e executado — tabela `cnpj_cache` ativa

---

### Fase D — Correções Dashboard e Relatórios ✅ CONCLUÍDA (2026-05-27)

- [x] D.1: `/api/relatorios/documentos` — corrigir limite de documentos por mês
- [x] D.2: Aba Participantes — seletor próprio "Fornecedores / Clientes" (independente do filtro global)
- [x] D.3: Formatação CNPJ como `XX.XXX.XXX/XXXX-XX` na aba Participantes
- [x] D.4: Campo `count_produtos` NCM — corrigir mapeamento na aba NCM
- [x] D.5: Dashboard — card de consulta de CNPJ + `components/ModalCnpj.tsx` (6 seções) + `/api/cnpj-cache` API-first com normalizador para formato publica.cnpj.ws (`estabelecimento`) + `/api/empresas/cadastrar-por-cnpj`

---

### Fase 5 — Cruzamento NF-e × SPED + Validação de Itens + Motor de Regras ✅ CONCLUÍDA (2026-05-27)

- [x] 5.1: Criar `lib/fiscal/classificacao.ts` — constantes e funções de classificação compartilhadas (NCM_UC, NCM_IMOB, NCM_COMB, analisarProduto, famCFOP, validarItemSped, AlertaItemSped)
- [x] 5.2: Estender parser SPED Fiscal: parsear C170 (itens) e detectar bloco G (CIAP) → `SpedC170Item[]` + `temCiap` em `parseFiscal()` e `mergeFiscalDatasets()`
- [x] 5.3: Executor `NCM_ST_SEM_TRATAMENTO` em `lib/rules/executores/ncm.ts` + registro no engine (NCMs RICMS/GO Anexo VIII)
- [x] 5.4: Nova aba **"Itens"** no Auditor SPED — tabela analítica dos C170 com classificação sugerida (ChipClass), alertas, filtros (busca, classificação, somente-alertas)
- [x] 5.5: Integrar motor de regras no Auditor SPED — botão "Executar análise automática" (`<Zap>`) busca regras ativas, monta `ContextoAnalise`, chama `executarMotorRegras`, persiste alertas via `POST /api/alertas`
- [ ] 5.6: Cruzamento NF-e × SPED — comparar `fa_documentos_fiscais` com `SpedFiscalParsed.docs` por chave de acesso (pendente)
- [x] 5.7: Exportação Excel no Auditor SPED — sheets: Cruzamento SPED, Apuração, Inconsistências SPED, Validação de Itens SPED

### Fase E — Reorganização UI: Menu do Usuário na Topbar ✅ CONCLUÍDA (2026-05-27)

- [x] Removidos da sidebar: botão de alternância de tema, botão de logout, link de Configurações
- [x] Sidebar mantém apenas navegação principal: logo, nome da org, 9 links operacionais
- [x] `TopbarFiscal.tsx` — avatar agora abre dropdown de usuário ao clicar
- [x] Dropdown com 3 opções: Alternar tema (sol/lua), Configurações, Sair (em vermelho com separador)
- [x] Dropdown fecha ao clicar fora, ao selecionar opção e ao navegar
- [x] Lógicas reaproveitadas: `useTheme()` (ThemeProvider), `router.push('/configuracoes')`, `supabase.auth.signOut()`
- [x] CSS limpo em `globals.css`: removidas classes `.af-sidebar-footer`, `.af-theme-toggle`, `.af-logout-button`
- [x] Visual do dropdown respeita tokens CSS de ambos os temas (`--af-elevated`, `--af-border`, `--af-surface-2`, `--af-danger`, `--af-danger-soft`)

---

### Fase 6 — Inteligência (12+ semanas)

- [ ] Simulador de planejamento tributário (Simples × Presumido × Real)
- [ ] Calendário de obrigações com detecção automática
- [ ] Recomendações via API de IA
- [ ] Análise de tendência multi-período
- [ ] Suporte a IBS/CBS (Reforma Tributária EC 132/2023)
- [ ] Link de compartilhamento somente-leitura com cliente
