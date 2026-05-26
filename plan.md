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

### Fase 5 — Cruzamento SPED × NF-e

- [ ] Cruzamento SPED × NF-e: verificar se todos os XMLs do período estão no SPED
- [ ] Exportação Excel no Auditor SPED
- [ ] Regras UC_COM_CREDITO, IMOB_SEM_CIAP, CONTRIB_EXCLUSAO_INDEVIDA, NCM_ST_SEM_TRATAMENTO automáticas

### Fase 6 — Inteligência (12+ semanas)

- [ ] Simulador de planejamento tributário (Simples × Presumido × Real)
- [ ] Calendário de obrigações com detecção automática
- [ ] Recomendações via API de IA
- [ ] Análise de tendência multi-período
- [ ] Suporte a IBS/CBS (Reforma Tributária EC 132/2023)
- [ ] Link de compartilhamento somente-leitura com cliente
