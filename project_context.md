# Project Context — Plataforma SaaS Contábil | Enfokus

> Arquivo de referência para novas conversas com Claude Code.
> Mantido manualmente. Atualizar sempre que houver mudança estrutural significativa.
> Última atualização: 2026-05-19 (Fase 0 SaaS concluída)

---

## 1. Visão Geral do Sistema

### Objetivo

Plataforma SaaS contábil multiempresa e multiusuário para escritórios de contabilidade de pequeno e médio porte. Permite que contadores importem, validem e cruzem dados de SPED Fiscal, SPED Contribuições, XMLs de NF-e e PGDAS-D para identificar inconsistências fiscais, tributárias e obrigações acessórias pendentes.

O módulo fiscal é o núcleo principal e o primeiro disponibilizado comercialmente em modelo **Founder Access** (pré-acesso, assinatura mensal simbólica). O foco inicial é auditoria fiscal inteligente, cruzamento de dados e ganho operacional para escritórios — não é um ERP completo.

### Tipo de sistema

- **SaaS por assinatura** — multiempresa, multiusuário, multi-tenant
- Auditoria fiscal inteligente (SPED, NF-e, cruzamento de dados)
- Planejamento tributário (comparação de regimes, simulação de carga)
- Controle de obrigações acessórias (REINF, DCTFWeb, eSocial, DCTF, ECF)
- Voltado para escritórios de contabilidade (não uso exclusivo interno)

### Pilares do sistema

| # | Pilar | Status |
|---|-------|--------|
| 1 | **Fiscal** | Núcleo — em produção (Founder Access) |
| 2 | **Planejamento Tributário** | Stub criado |
| 3 | **Obrigações Acessórias** | Stub criado |
| 4 | **Contábil** | Planejado |
| 5 | **Departamento Pessoal** | Planejado |
| 6 | **Financeiro** | Planejado |

### Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| UI | React 19 + TypeScript 5 |
| Estilo | Tailwind CSS 4 + CSS vars customizadas (inline styles) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Exportação | xlsx (SheetJS) |
| Ícones | lucide-react |

### Estrutura de diretórios

```
app/
  login/                ← Login (+ "Continuar logado" + link cadastro)
  cadastro/             ← Cadastro de novo usuário
  aguardando-ativacao/  ← Tela de assinatura/ativação de plano
  configuracoes/
    novo-escritorio/    ← Criar org ou aceitar convite (onboarding)
  (fiscal)/             ← Todas as páginas autenticadas
    layout.tsx          ← Auth check + check de org + check de plano + sidebar
    page.tsx            ← Dashboard principal
    SidebarFiscal.tsx   ← Sidebar com nome da org + logout
    configuracoes/      ← Gestão de membros, plano, convites
    auditor_fiscal/     ← Módulo SPED
    validador_entradas/ ← Módulo NF-e (mais completo)
    inconsistencias/    ← Módulo de alertas
    simples_nacional/   ← Módulo PGDAS-D (Simples Nacional)
    empresas/           ← Cadastro e seleção de empresa
    planejamento/       ← Em desenvolvimento (stub criado)
    obrigacoes/         ← Em desenvolvimento (stub criado)
  api/
    organizacoes/       ← GET org do usuário; POST criar org
    membros/            ← GET/POST/DELETE membros da org
    convites/           ← GET convite pendente; POST aceitar convite
    stripe/
      checkout/         ← POST criar sessão Stripe Checkout
      webhook/          ← POST webhook Stripe (ativar/suspender plano)
    empresas/           ← GET/POST; [id] GET/PUT
    sessoes/ alertas/ arquivos-sped/ arquivos-xml/ simples_nacional/
components/
  SessionGuard.tsx      ← Guard client-side de sessão de browser
lib/
  supabase/
    client.ts           ← Browser client
    server.ts           ← Server client (SSR)
    admin.ts            ← Service-role client (bypassa RLS)
    org.ts              ← Helper getOrgId(supabase, userId)
  hooks/                ← useEmpresaAtiva
  rules/                ← Motor de regras fiscais
  simples/              ← Parser PGDAS-D (parsePgdas.ts)
  types.ts              ← Tipos TypeScript globais
```

---

## 1b. Arquitetura de Dados Compartilhados

Princípio central: **dados importados uma vez alimentam todos os módulos**. Nenhum módulo importa o mesmo documento de forma isolada.

| Fonte de dados | Módulos alimentados |
|----------------|---------------------|
| XML de NF-e | Fiscal · Simples Nacional · Contábil (futuro) · Financeiro (futuro) |
| SPED Fiscal | Auditoria Fiscal · Planejamento Tributário · cruzamentos automáticos |
| SPED Contribuições | Módulo Fiscal · cálculos PIS/COFINS · cruzamento com NF-e |
| PGDAS-D | Simples Nacional · confronto com XMLs e faturamento apurado |
| Extrato bancário | Financeiro · Contábil (futuro) |
| eSocial / DCTFWeb | Departamento Pessoal (futuro) |

---

## 1c. Requisitos SaaS — Segurança Multi-tenant ✅ Implementado

| Requisito | Como garantir |
|-----------|---------------|
| Isolamento entre escritórios | RLS com `public.is_member_of(org_id)` — só membros da org acessam |
| `org_id` obrigatório | Todas as tabelas críticas têm `org_id UUID REFERENCES organizacoes(id)` |
| INSERT protegido | Políticas INSERT usam `auth.role() = 'authenticated'` (workaround JWT Next.js 16.2) |
| `empresa_id` obrigatório | Toda importação valida empresa ativa + CNPJ |
| Storage privado | Buckets privados; URLs via `createSignedUrl` — sem acesso público |
| Auth em toda API | Cada route verifica `supabase.auth.getUser()` e retorna 401 se ausente |
| Validação de empresa | SPED: raiz CNPJ; XML terceiros: destinatário; XML próprios: emitente |
| Controle de plano | `organizacoes.plano` — `'pendente'` bloqueia acesso ao sistema fiscal |

**Modelo de organização:**
- Cada escritório cria uma `organizacao`. O fundador vira `admin`.
- Membros adicionais: admin convida por e-mail → `convites_organizacao` → novo usuário aceita em `/configuracoes/novo-escritorio`.
- `is_member_of(p_org_id UUID)` é SECURITY DEFINER para evitar recursão no RLS de `membros_organizacao`.
- Operações que contornam RLS (criação de org, aceitação de convite) usam `createAdminClient()` com `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Funcionalidades Já Implementadas

### Autenticação e SaaS

- Login com e-mail e senha via Supabase Auth; "Continuar logado" (checkbox) persiste sessão em `localStorage`; por padrão sessão expira ao fechar o browser (`sessionStorage`)
- Cadastro de novo usuário em `/cadastro` — após signup, redireciona para `/configuracoes/novo-escritorio`
- Middleware Next.js protege todas as rotas exceto `/login`, `/cadastro`, `/auth` e `/api/stripe/webhook`
- `SessionGuard` (client component no root layout) detecta browser fechado sem "Continuar logado" e desloga
- Redirect automático: não autenticado → `/login`; autenticado sem org → `/configuracoes/novo-escritorio`; autenticado com org mas plano pendente → `/aguardando-ativacao`
- Logout disponível na sidebar (limpa `sessionStorage` + `localStorage` + Supabase session)

### Controle de Plano (Stripe)

- Novas orgs criadas com `plano='pendente'` — acesso fiscal bloqueado
- `/aguardando-ativacao`: mostra card de assinatura com preço; botão "Assinar agora" chama `POST /api/stripe/checkout`
- Stripe Checkout cria sessão com `org_id` em `metadata`; modo `subscription`
- Webhook `POST /api/stripe/webhook`: `checkout.session.completed` → `plano='founder_access'`; `customer.subscription.deleted` → `plano='pendente'`
- Após pagamento aprovado, página verifica ativação polling `/api/organizacoes` a cada 2s (até 10 tentativas)

### Gestão de Membros (`/configuracoes`)

- Lista membros com e-mails e papéis (admin/membro); ícone coroa para admin
- Adicionar membro por e-mail: se usuário existe → insert direto em `membros_organizacao`; se não existe → cria convite em `convites_organizacao`
- Remover membro (admin only, não pode remover a si mesmo)
- Novo usuário que recebe convite: ao acessar `/configuracoes/novo-escritorio`, detecta convite pendente e exibe opção "Entrar no escritório X"

### Dashboard (`/`)

- KPIs em tempo real: alertas por nível (Crítico/Alto/Médio/Baixo) e total de empresas
- Acesso rápido para todos os módulos
- Tabela de sessões de análise recentes (empresa + competência)
- Banner de empresa ativa com seleção inline

### Gestão de Empresas (`/empresas`)

- Listagem de todas as empresas ativas com filtro por nome/CNPJ
- Cadastro de nova empresa (razão social, nome fantasia, CNPJ, regime, CNAE, IE, UF, tipo)
- Edição de empresa existente
- Suporte a Matriz / Filial / Autônoma (vinculação de filial à matriz)
- Regimes suportados: Simples Nacional, Lucro Presumido, Lucro Real, MEI, CPF
- Chips visuais de regime e tipo para identificação rápida

### Seleção de Empresa Ativa

- Empresa ativa persiste em `localStorage` (chave: `enfokus:empresaAtiva`)
- Sincronizada entre abas via `CustomEvent` + `storage` event
- Exibida na sidebar (com seletor dropdown + busca por nome/CNPJ)
- Exibida no dashboard via `EmpresaAtivaBanner`
- Pode ser alterada pela sidebar, pelo banner do dashboard e pela página de empresas
- Hook reutilizável: `lib/hooks/useEmpresaAtiva.ts` — exporta `{ empresaAtiva, ... }`

### Tema Claro / Escuro (global)

- ThemeProvider em `components/ThemeProvider.tsx`
- Persiste em `localStorage` (chave: `af-theme`)
- Alterna com botão na sidebar (com indicador "Global")
- Aplica `data-theme="claro"` ou `data-theme="escuro"` no `<html>`
- CSS vars completas para ambos os temas em `app/globals.css`

---

## 3. Módulos Existentes

### 3.1 Auditor SPED (`/auditor_fiscal`) — Refatorado em 2026-05-06

**Arquitetura (após refatoração):**
- Lógica de parsing extraída para `lib/sped/parsers.ts`
- Validações fiscais em `lib/sped/validators.ts`
- Tipos compartilhados em `lib/sped/types.ts`
- Página limpa com 3 abas: Cruzamento | Apuração | Inconsistências

**O que faz:**
- Importa e parseia SPED Fiscal e SPED Contribuições no browser (sem servidor)
- Valida CNPJ: arquivo deve pertencer ao grupo empresarial da empresa ativa
- Detecta automaticamente tipo (Fiscal ou Contribuições) pelo conteúdo (bloco M/E)
- Suporta múltiplos arquivos por tipo (matriz + filiais, múltiplos períodos)
- Salva sessão + arquivo no banco via `POST /api/sessoes` e `POST /api/arquivos-sped`
- `parsed_data` salvo: Fiscal = { company, e110, c190_count } | Contrib = { company, isZeroed, m200, m600 }

**Registros parseados — SPED Fiscal:**
- `0000`: identificação, CNPJ, período, UF, IE
- `0150`: participantes (fornecedores e clientes)
- `0200`: cadastro de produtos
- `C100`: documentos fiscais (NF-e e outros)
- `C190`: resumo por CFOP do documento (com base ICMS e valor ICMS)
- `E110`: apuração ICMS (débitos, créditos, saldo apurado, ICMS a recolher, saldo credor)

**Registros parseados — SPED Contribuições:**
- `0000`: identificação (parsing heurístico por posição de CNPJ)
- `0150` / `0200`: participantes e produtos
- `C100`: documentos
- `C170`: itens com campos PIS/COFINS: CST_PIS, VL_BC_PIS, ALIQ_PIS, VL_PIS, CST_COFINS, VL_BC_COFINS, ALIQ_COFINS, VL_COFINS
- `M200`: apuração PIS (VL_REC_BRT, VL_BC_CONT, VL_CONT_NC, VL_CONT_PER, VL_CONT_PAGAR)
- `M600`: apuração COFINS (mesma estrutura M200)

**Validações automáticas (8 regras):**

| ID | Descrição | Nível |
|----|-----------|-------|
| V01 | Notas de saída no Fiscal ausentes no Contrib | Alto |
| V02 | Notas no Contrib ausentes no Fiscal | Médio |
| V03 | ICMS possivelmente incluso na base PIS/COFINS (RE 574.706 STF) | Alto |
| V04 | CST não tributável (04-09) com valor PIS/COFINS > 0 | Alto |
| V05 | CST tributável (01/02) com alíquota zero — possível erro de classificação | Médio |
| V06 | CFOP invertido (saída em entrada ou vice-versa) | Alto |
| V07 | E110 diverge > 5% da soma dos C190 de saída | Médio |
| V08 | Alíquota efetiva ICMS < 1% sobre o total de saídas | Médio |

**Limitações atuais:**
- Cruzamento com NF-e (XMLs) ainda não implementado — planejado para Fase 3
- Sem exportação para Excel
- `parsed_data` no banco é resumo — dados completos ficam apenas em memória

### 3.2 Validador de NF-e (`/validador_entradas`)

**O que faz:**
- **Dois fluxos de importação separados:**
  - "Terceiros (Entradas)": XMLs emitidos por fornecedores para a empresa — tratados como entradas
  - "Próprios (Saídas)": XMLs emitidos pela própria empresa — tratados como saídas
- **Validação de CNPJ na importação:**
  - Terceiros: rejeita se o destinatário (dest) ≠ CNPJ da empresa ativa
  - Próprios: rejeita se o emitente (emit) ≠ CNPJ da empresa ativa
- **Aviso de notas entrada de terceiro** (`tpNF=0`): banner com alerta para notas onde o fornecedor classificou como entrada (possível devolução) — com botão para fechar
- **Sugestão de classificação por perfil:** Empresa Geral / Supermercado / Bar e Restaurante / Construção Civil
  - Ao trocar perfil, itens sem classificação manual são recalculados automaticamente
  - Itens com classificação manual (`classificacaoManual=true`) são preservados
- **NCM_UC ampliado** com itens domésticos: têxteis de cama/mesa/banho (6301/6302/6304), vidros domésticos (7013), utensílios inox (7323), cutelaria (8211/8215), louças (6911/6912), plásticos domésticos (3922)
- **Palavras-chave ampliadas**: toalha, lençol, fronha, prato, talher, panela, frigideira, etc.
- **CFOP de entrada sugerido** para notas de terceiros:
  - `MAPA_CFOP`: mapeamento explícito para 18 CFOPs comuns (5101, 5102, 5401, 5403, 6101, 6102, etc.)
  - `sugerirCfopEntrada`: sugere CFOP principal com base no mapeamento + natureza do produto
  - Retorna `""` quando não há equivalente válido na tabela oficial (aciona modal)
  - `getOpcoesEntrada`: lista completa de opções para dropdown por item
- **Modal de seleção de CFOP** (antes de finalizar importação):
  - Aparece quando algum CFOP do fornecedor não tem equivalente de entrada na tabela oficial
  - Exibe uma linha por nota com: número da NF, fornecedor, produtos da nota, dropdown de CFOP de entrada
  - Após confirmar, aplica as seleções e finaliza a importação
  - Seleções do modal são preservadas mesmo ao trocar perfil
- **Resumo por CFOP (tela):** usa `cfopEfetivo` — terceiros mostram CFOP de entrada (1xxx/2xxx), não o CFOP do fornecedor (5xxx/6xxx); ordenado crescente
- **Exportação Excel:**
  - Sheet "Itens Entradas": colunas "CFOP Forn." + "CFOP Entrada"
  - Sheet "Resumo CFOP Entradas": usa CFOP de entrada (cfopEfetivo), ordenado crescente
  - Sheets: Notas Entradas, Itens Entradas, Notas Saídas, Itens Saídas, Resumo CFOP Entradas, Resumo CFOP Saídas, Classificação
- **DESC_CFOP completa**: ~300+ entradas cobrindo a tabela oficial completa (1xxx–7xxx)
- Classificação manual por item e por nota inteira
- Validação de CST/CSOSN, CFOP, NCM
- Vinculação de UC: se qualquer item de uma nota for UC, os demais recebem alerta

**Tipos principais:**
- `LinhaEntrada.classificacaoManual?: boolean` — flag que distingue classificação manual de automática
- `LinhaEntrada.tipo_nfe?: "terceiro" | "proprio" | null`
- `LinhaEntrada.cfop_entrada_sugerido?: string` — CFOP de lançamento no SPED (apenas terceiros)

**Limitações atuais:**
- XMLs não são persistidos no banco (somente em memória; sessão de NF-e salva mas parsed_data=null)
- Não há cruzamento automático com SPED
- Sem agrupamento por competência/período

### 3.3 Módulo de Inconsistências (`/inconsistencias`)

**O que faz:**
- Lista alertas da tabela `fa_alertas` do Supabase
- **Filtro por empresa ativa** (usando `useEmpresaAtiva`) — exibe apenas alertas da empresa selecionada
- Banner informativo quando nenhuma empresa está selecionada
- Filtros por nível de risco (Crítico, Alto, Médio, Baixo) e status
- Exibição expansível: título, empresa, competência, descrição, detalhe JSON, impacto estimado
- Ações: marcar como "Em análise", "Resolvido" ou "Descartado"

**Limitações atuais:**
- Alertas gerados manualmente — não há integração automática com SPED nem NF-e
- Motor de regras (`lib/rules/engine.ts`) existe mas não está conectado ao fluxo de importação

### 3.4 Planejamento Tributário (`/planejamento`) — Em desenvolvimento

Página stub criada. Funcionalidades planejadas: simulador de regime, análise de desenquadramento,
comparação de carga tributária e impacto da Reforma Tributária (IBS/CBS).

### 3.5 Obrigações Acessórias (`/obrigacoes`) — Em desenvolvimento

Página stub criada. Funcionalidades planejadas: calendário de obrigações, controle de entregas
(REINF, DCTFWeb, eSocial, DCTF, ECF), alertas de prazo e histórico por competência.

### 3.6 Simples Nacional (`/simples_nacional`) — Implementado em 2026-05-12

**O que faz:**
- Importa PDFs do PGDAS-D (browser-side via `pdfjs-dist`) — sem upload para servidor
- Extrai e persiste na tabela `sn_declaracoes`: CNPJ, razão social, período, tipo declaração, atividade, anexo, receitas, tributos individuais, histórico mensal, total devido, nº recibo
- Detecta múltiplas atividades (seção 2.8 do PDF): separa Comércio × Serviços quando a empresa tem os dois
- Tabela multi-período: linhas = períodos ordenados decrescente; colunas = Receita Bruta | Total Impostos | Alíquota Efetiva
- Linhas expansíveis: atividade única → chips de tributos; múltiplas atividades → cards por atividade com total individual e tributos específicos
- Chip "Retificadora" (âmbar) para declarações retificadoras; chip "Anexo X" (ciano) com tooltip da atividade
- KPIs: Receita/Imposto do último período, totais acumulados, alíquota média, acumulado 12m
- Botão "Limpar tudo" (remove todas as declarações da empresa, com confirmação)
- Exportação Excel: planilha "PGDAS-D" (1 linha por período) + planilha "Por Atividade" (gerada automaticamente se houver dados multi-atividade)
- Upsert por `(empresa_id, competencia)` — reimportar um período sobrescreve o anterior (retificadora substitui original)
- Alerta visual de CNPJ divergente no modal (compara raiz — 8 primeiros dígitos)

**Arquivos:**
- `lib/simples/parsePgdas.ts` — parser PDF (extração por janela de texto para resistir a rodapés de página)
- `app/api/simples_nacional/route.ts` — POST / GET / DELETE
- `app/(fiscal)/simples_nacional/page.tsx` — página principal
- `public/pdf.worker.min.mjs` — worker do pdfjs-dist servido como asset estático

**Tipos adicionados a `lib/types.ts`:**
```typescript
SnTributo      { nome, valor }
SnHistoricoMes { mes, receita }
SnAtividade    { nome, anexo, tributos[], total }
SnParsedData   { cnpj, razao_social, periodo, tipo_declaracao, atividade, anexo,
                  limite_receita, receita_bruta_mes, receita_bruta_acumulada_12m,
                  receita_bruta_ano, tributos[], historico_mensal[], total_devido,
                  numero_recibo, atividades? }
SnDeclaracao   { id, empresa_id, competencia, receita_bruta_mes, ..., parsed_data? }
```

**Tabela banco:**
```sql
sn_declaracoes (
  id UUID PK,
  empresa_id UUID FK empresas,
  competencia TEXT,         -- "03/2026"
  receita_bruta_mes NUMERIC(15,2),
  receita_bruta_acumulada_12m NUMERIC(15,2),
  receita_bruta_ano NUMERIC(15,2),
  valor_total_devido NUMERIC(15,2),
  numero_recibo TEXT,
  nome_arquivo TEXT,
  parsed_data JSONB,        -- tributos[], atividades[]?, historico_mensal[], etc.
  created_at TIMESTAMPTZ,
  UNIQUE(empresa_id, competencia)
)
```

**Fases futuras planejadas:**
- Fase 2: Confronto com NF-e — somar notas do Validador e comparar com receita declarada no PGDAS
- Fase 3: Simulação via XML — calcular tributos pelos Anexos I–V e comparar com PGDAS

---

## 4. Regras Já Implementadas

### Validação de CNPJ (importação)

- SPED: verifica se CNPJ do registro 0000 pertence ao grupo da empresa ativa (8 primeiros dígitos)
- XML Terceiros: verifica se destinatário do XML = empresa ativa
- XML Próprios: verifica se emitente do XML = empresa ativa
- Arquivo de outra empresa é bloqueado com mensagem de erro

### Filtro por empresa ativa

- `useEmpresaAtiva()` retorna `{ empresaAtiva, ... }` — empresa ativa vem do localStorage
- Usado em: Inconsistências (query `fa_alertas`), Validador NF-e (validação CNPJ), Auditor SPED (validação CNPJ)

### Classificação por perfil (Validador NF-e)

- `analisarProduto(desc, perfil, ncm)` → `AnaliseSugestao` com tipo + motivo + confiança
- `sugerirClass(item, ehIndustrial)` → `ClassificacaoManual` com base na sugestão e no CFOP
- `reproc(linhas, perfil, ehIndustrial)` → recalcula toda a lista ao trocar perfil, preservando classificações manuais
- `vinculoUC(linhas)` → propaga alerta de UC para todos os itens de notas com ao menos um UC

### CFOP de entrada (Validador NF-e)

- `MAPA_CFOP`: 18 CFOPs de saída → opções de entrada (revenda/insumo/imobilizado/UC)
- `sugerirCfopEntrada(cfopForn, natureza, ehIndustrial)` → melhor CFOP de entrada
- `getOpcoesEntrada(cfopForn, natureza, ehIndustrial)` → lista completa para dropdown
- `cfopEfetivo(item)` → usa `cfop_entrada_sugerido` para terceiros, `cfop` para os demais

### Motor de regras (estrutura base)

- `lib/rules/engine.ts`: executor central
- `lib/rules/types.ts`: tipos `ContextoAnalise`, `AlertaGerado`
- Cada regra é função pura em `lib/rules/executores/`
- Retorna `AlertaGerado[]` — nunca lança exceção

---

## 5. Limitações Atuais

### XMLs de NF-e não persistidos

O Validador NF-e salva a sessão no banco mas `parsed_data` é null. Quando o usuário recarrega a página, as classificações são perdidas.

### Motor de regras não integrado automaticamente

Os alertas em `fa_alertas` precisam ser inseridos manualmente. O fluxo de importação não aciona o motor de regras.

### Ausência de exportação no Auditor SPED

O Validador NF-e exporta para Excel. O Auditor SPED ainda não tem essa funcionalidade.

### Ausência de cruzamento SPED × NF-e

Não há comparação automática entre totais do SPED e os XMLs importados.

### Módulos de Obrigações e Planejamento sem lógica

Existem apenas como páginas stub.

---

## 6. Próximos Passos Planejados

### 6.1 Persistência do Validador NF-e (Fase 5)

- Salvar `LinhaEntrada[]` com classificações no `parsed_data` do `fa_arquivos_xml`
- Restaurar estado via `GET /api/arquivos-xml?sessao_id=...` ao carregar a página
- Criar `PATCH /api/arquivos-xml/[id]` para persistir classificações ao alterar manualmente

### 6.2 Cruzamento SPED × NF-e + Motor de regras automático

- Cruzamento automático entre SPED e XMLs importados para o mesmo período
- Motor de regras acionado automaticamente após importação (sem disparo manual)
- Alertas gerados aparecem em `/inconsistencias` sem intervenção do usuário
- Exportação Excel no Auditor SPED

### 6.3 Confronto PGDAS × NF-e — Simples Nacional Fase 2

- Aba "Confronto NF-e" na página `/simples_nacional`
- Somar `valor_total` das NF-e de saída para o mesmo período
- Comparar com `receita_bruta_mes` do PGDAS — alerta se diferença > 1%

### 6.4 Módulos de Obrigações e Planejamento

- Calendário de obrigações com controle de REINF / DCTFWeb / eSocial / DCTF / ECF
- Simulador de carga tributária por regime (Simples × Presumido × Real)
- Suporte a IBS/CBS (Reforma Tributária EC 132/2023)

---

## 7. Diretrizes Técnicas

### Multi-tenant SaaS

- Sempre incluir `org_id` ao inserir qualquer registro nas tabelas de dados; obtê-lo via `getOrgId(supabase, user.id)`
- Confiar no RLS do Supabase para isolamento — não duplicar filtros `org_id` no código como segurança extra
- Verificar `user` (via `supabase.auth.getUser()`) antes de qualquer operação de escrita
- Nunca criar tabela sem RLS habilitado
- Nunca expor URLs de Storage sem autenticação (usar `createSignedUrl`)
- Usar `createAdminClient()` apenas onde genuinamente necessário (criação de org, aceitação de convite)

### Sistema multiempresa

- Sempre verificar empresa ativa com `useEmpresaAtiva()` — retorna `{ empresaAtiva, ... }`
- Filtrar por `empresa_id` em todas as queries ao banco
- Validar CNPJ na importação de arquivos (SPED e XML)

### Estilo visual

- **Não usar classes Tailwind** para layout das páginas fiscais
- Usar **inline styles com CSS vars** (`var(--af-primary)`, `var(--af-surface)`, etc.)
- CSS vars definidas em `app/globals.css` para temas claro e escuro
- Seguir padrão visual das páginas `auditor_fiscal` e `validador_entradas`
- Sidebar sempre escura (usa `--af-sidebar-bg`), independente do tema

### Supabase

- **Server Components / API routes**: `createClient` de `lib/supabase/server.ts`
- **Client Components**: `createClient` de `lib/supabase/client.ts`
- Sempre verificar autenticação no início das API routes (retornar 401 se não autenticado)

### Performance para arquivos grandes

- Parse de SPED e XML ocorre no browser (sem upload para servidor)
- Usar `useMemo` para cálculos derivados pesados

### TypeScript

- Nunca usar `any` — usar tipos de `lib/types.ts` ou `unknown`
- Todas as interfaces do banco devem estar em `lib/types.ts`

---

## 8. Preparação Futura — Reforma Tributária (IBS e CBS)

EC 132/2023 substitui PIS/COFINS/IPI por CBS e ICMS/ISS por IBS.
Vigência progressiva: 2026 (testes), 2027-2028 (fase dual), 2033 (plena).

Ações previstas:
1. Simulador de regime com suporte a "IBS/CBS"
2. Regras comparativas: carga atual vs. estimativa pós-reforma
3. Identificar benefícios de ICMS sem equivalente no IBS
4. Sinalizar empresas do Simples Nacional sobre Simples permanente pós-reforma

---

## Banco de Dados (referência rápida)

DDL completo: `supabase_setup.sql`

**Tabelas SaaS:**
| Tabela | Finalidade |
|---|---|
| `organizacoes` | Escritórios; `plano` = `pendente` / `founder_access` |
| `membros_organizacao` | Vínculo usuário × org; `papel` = `admin` / `membro` |
| `convites_organizacao` | Convites por e-mail para orgs existentes |

**Tabelas fiscais** (todas com `org_id`):
| Tabela | Finalidade |
|---|---|
| `empresas` | Cadastro de clientes (matriz, filial, regime) |
| `fa_sessoes_analise` | Sessões de análise por empresa + competência |
| `fa_arquivos_sped` | SPED importados (parsed_data em JSONB) |
| `fa_arquivos_xml` | XMLs de NF-e importados |
| `fa_alertas` | Alertas gerados pelo motor de regras |
| `fa_regras_fiscais` | Catálogo de regras configuráveis (compartilhado, sem org_id) |
| `sn_declaracoes` | Declarações PGDAS-D do Simples Nacional (parsed_data em JSONB) |

API routes disponíveis:
- `GET/POST /api/organizacoes`
- `GET/POST/DELETE /api/membros`
- `GET/POST /api/convites`
- `POST /api/stripe/checkout`
- `POST /api/stripe/webhook`
- `GET/POST /api/empresas`
- `GET/PUT /api/empresas/[id]`
- `GET/POST /api/sessoes`
- `GET/POST /api/alertas`
- `PATCH /api/alertas/[id]`
- `GET/POST /api/arquivos-sped`
- `GET/POST /api/arquivos-xml`
- `GET/POST/DELETE /api/simples_nacional`

---

## Arquivos Críticos

| Arquivo | Papel |
|---|---|
| `app/globals.css` | Tema, CSS vars, normalização visual |
| `app/(fiscal)/SidebarFiscal.tsx` | Navegação + seletor de empresa + nome da org |
| `app/(fiscal)/layout.tsx` | Auth guard + org guard + plano guard |
| `components/ThemeProvider.tsx` | Context de tema claro/escuro |
| `components/SessionGuard.tsx` | Guard client-side de sessão de browser |
| `lib/hooks/useEmpresaAtiva.ts` | Estado global da empresa selecionada |
| `lib/types.ts` | Todos os tipos TypeScript do domínio |
| `lib/supabase/admin.ts` | Cliente service-role (bypassa RLS) |
| `lib/supabase/org.ts` | Helper `getOrgId(supabase, userId)` |
| `middleware.ts` | Guard de autenticação (rotas públicas: `/login`, `/cadastro`, `/auth`, `/api/stripe/webhook`) |
| `supabase_setup.sql` | DDL completo do banco |
| `app/login/page.tsx` | Tela de login (+ "Continuar logado" + link cadastro) |
| `app/cadastro/page.tsx` | Cadastro de novo usuário |
| `app/aguardando-ativacao/page.tsx` | Tela de assinatura / ativação de plano |
| `app/configuracoes/novo-escritorio/page.tsx` | Onboarding: criar org ou aceitar convite |
| `app/(fiscal)/configuracoes/page.tsx` | Gestão de membros e plano |
| `app/(fiscal)/page.tsx` | Dashboard principal |
| `app/(fiscal)/validador_entradas/page.tsx` | Módulo NF-e (arquivo principal, ~2400 linhas) |
| `app/(fiscal)/auditor_fiscal/page.tsx` | Módulo SPED |
| `app/(fiscal)/inconsistencias/page.tsx` | Módulo de alertas |
| `app/(fiscal)/simples_nacional/page.tsx` | Módulo Simples Nacional — PGDAS-D |
| `lib/simples/parsePgdas.ts` | Parser PDF do PGDAS-D (browser-side, pdfjs-dist) |
| `app/api/simples_nacional/route.ts` | API Simples Nacional (GET/POST/DELETE) |
| `app/api/organizacoes/route.ts` | API org (GET org do usuário; POST criar org) |
| `app/api/membros/route.ts` | API membros (GET/POST/DELETE) |
| `app/api/convites/route.ts` | API convites (GET pendente; POST aceitar) |
| `app/api/stripe/checkout/route.ts` | Criar sessão Stripe Checkout |
| `app/api/stripe/webhook/route.ts` | Webhook Stripe (ativar/suspender plano) |
| `public/pdf.worker.min.mjs` | Worker pdfjs-dist (asset estático) |
| `eslint.config.js` | Configuração ESLint v9 (flat config) |
| `project_context.md` | Este arquivo — referência de estado do projeto |

---

## Histórico de Sessões

### Sessão 2026-05-19 — Fase 0 SaaS: org model, Stripe, convites, deploy

#### O que foi implementado

**Multi-tenant por organização:**
- Tabelas `organizacoes`, `membros_organizacao`, `convites_organizacao`
- Todas as tabelas de dados com `org_id` + RLS via `is_member_of(org_id)` SECURITY DEFINER
- `lib/supabase/admin.ts` — service-role client; `lib/supabase/org.ts` — helper `getOrgId`
- Bug crítico resolvido: `membros_organizacao` com policy circular → fixado com `user_id = auth.uid() OR is_member_of(org_id)`

**Fluxo de usuário:**
- `/cadastro` — signup; após sucesso redireciona para `/configuracoes/novo-escritorio`
- `/configuracoes/novo-escritorio` — cria org (admin) ou aceita convite (novo membro)
- Layout `(fiscal)` verifica org → redireciona para `/configuracoes/novo-escritorio` se ausente
- Layout `(fiscal)` verifica plano → redireciona para `/aguardando-ativacao` se `pendente`

**Controle de sessão:**
- "Continuar logado" (checkbox no login) persiste em `localStorage.stay_logged_in`
- Por padrão sessão expira ao fechar browser (`sessionStorage.session_active`)
- `SessionGuard` client component no root layout aplica a lógica

**Stripe:**
- `POST /api/stripe/checkout` — cria sessão Checkout com `org_id` em metadata, modo `subscription`
- `POST /api/stripe/webhook` — `checkout.session.completed` → `plano='founder_access'`; `customer.subscription.deleted` → `plano='pendente'`
- `/aguardando-ativacao` com card de assinatura e polling pós-pagamento

**Gestão de membros:**
- `GET/POST/DELETE /api/membros` — lista, convida (ou cria invite), remove
- `/configuracoes` — lista membros com e-mails, papéis, ícone coroa para admin

**Deployment:**
- Código no GitHub; Vercel auto-deploy; domínio `auditor.enfokus.com.br`
- `.env.local` com `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`

#### Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `supabase_setup.sql` | Reescrito completo: tabelas org, membros, convites, todas as tabelas com `org_id`, RLS org-based |
| `lib/types.ts` | Interfaces `Organizacao`, `MembroOrganizacao`, `ConviteOrganizacao`; `org_id` nas interfaces de dados |
| `lib/supabase/admin.ts` | Criado — service-role client |
| `lib/supabase/org.ts` | Criado — helper `getOrgId` |
| `middleware.ts` | Adicionado `/cadastro` e `/api/stripe/webhook` às rotas públicas |
| `app/(fiscal)/layout.tsx` | Adicionado check de org e check de plano |
| `app/(fiscal)/SidebarFiscal.tsx` | Nome da org + logout limpa storage |
| `app/(fiscal)/configuracoes/page.tsx` | Criado — gestão de membros |
| `app/login/page.tsx` | "Continuar logado" + link "Criar conta" |
| `app/cadastro/page.tsx` | Criado — signup |
| `app/aguardando-ativacao/page.tsx` | Criado — assinatura + polling |
| `app/configuracoes/novo-escritorio/page.tsx` | Criado — onboarding |
| `components/SessionGuard.tsx` | Criado — guard client-side |
| `app/api/organizacoes/route.ts` | Criado |
| `app/api/membros/route.ts` | Criado |
| `app/api/convites/route.ts` | Criado |
| `app/api/stripe/checkout/route.ts` | Criado |
| `app/api/stripe/webhook/route.ts` | Criado |
| `app/api/empresas/route.ts` e `[id]/route.ts` | `org_id` nas inserções |

---

### Sessão 2026-04-29 — Validação pós-redesign + correções pré-desenvolvimento

#### Problemas encontrados e corrigidos

- `/planejamento` e `/obrigacoes` retornavam 404 → criadas páginas stub
- ESLint sem configuração → criado `eslint.config.js` (flat config v9)
- Login em modo escuro com fundo branco → substituído por `#071527` fixo
- Regra CSS global sobrescrevia fundos inline → restritas a classes Tailwind legadas
- Cores hardcoded em Inconsistências → substituídas por CSS vars
- CSS duplicado e artefatos órfãos → removidos

---

### Sessão 2026-05-12 — Módulo Simples Nacional (PGDAS-D)

#### O que foi implementado

**Novo módulo `/simples_nacional`** — importação e análise de declarações PGDAS-D:

1. **Instalação `pdfjs-dist`** — parser PDF browser-side; worker servido como asset estático em `public/pdf.worker.min.mjs`
2. **Tabela `sn_declaracoes`** no Supabase — DDL adicionado ao `supabase_setup.sql`
3. **Tipos** adicionados a `lib/types.ts`: `SnTributo`, `SnHistoricoMes`, `SnAtividade`, `SnParsedData`, `SnDeclaracao`
4. **`lib/simples/parsePgdas.ts`** — extração robusta com janela de texto para resistir a rodapés inseridos pelo PDF entre cabeçalho e valores; campos extraídos: CNPJ, razão social, período, tipo declaração, atividade, anexo, receitas (mês/12m/ano), tributos individuais (seção 2.8), histórico mensal (seção 2.2), total devido, nº recibo, múltiplas atividades
5. **`app/api/simples_nacional/route.ts`** — GET / POST (upsert por empresa+competência) / DELETE
6. **`app/(fiscal)/simples_nacional/page.tsx`** — página completa com:
   - Modal de confirmação com detecção de CNPJ divergente (compara raiz — 8 dígitos)
   - Tabela: linhas = períodos, colunas = Tipo | Anexo | Receita Bruta | Total Impostos | Alíquota Efetiva
   - Chips: "Retificadora" (âmbar) e "Anexo X" (ciano com tooltip)
   - Linhas expansíveis: atividade única (chips de tributos) ou múltiplas atividades (card por atividade)
   - KPIs: último período + totais acumulados + alíquota média + acumulado 12m
   - Botão "Limpar tudo" (remove todas as declarações com confirmação)
   - Botão "Exportar Excel" (sheets: PGDAS-D + Por Atividade se houver multi-atividade)
7. **SidebarFiscal** — adicionado link "Simples Nacional" com ícone `Receipt`

#### Correções e melhorias incrementais nesta sessão

- **Falha silenciosa no save**: captura e exibe erros de API no modal via `saveError`; reload via `carregarDeclaracoes()` após salvar em vez de atualizar estado local
- **CNPJ divergente**: compara raiz (8 dígitos) — funciona para matriz/filial; aviso âmbar no modal sem bloquear importação
- **Múltiplas atividades**: `extractAtividades()` processa seção 2.8 linha a linha (cada linha com exatamente 9 números BRL = 1 atividade); retorna `[]` para empresa com atividade única

#### Arquivos modificados nesta sessão

| Arquivo | O que mudou |
|---|---|
| `supabase_setup.sql` | Tabela `sn_declaracoes` + RLS + índices |
| `lib/types.ts` | Novos tipos Simples Nacional |
| `lib/simples/parsePgdas.ts` | Criado — parser completo |
| `app/api/simples_nacional/route.ts` | Criado — GET/POST/DELETE |
| `app/(fiscal)/simples_nacional/page.tsx` | Criado — página completa |
| `app/(fiscal)/SidebarFiscal.tsx` | Link Simples Nacional |
| `public/pdf.worker.min.mjs` | Worker pdfjs-dist |

---

### Sessão 2026-05-06 — Validador NF-e: melhorias e correções

#### Contexto

Evolução significativa do Validador de NF-e com novos fluxos de importação,
melhorias de análise e correções de comportamento.

#### O que foi implementado

**Inconsistências (`/inconsistencias`):**
- Filtro por empresa ativa: query `fa_alertas` agora filtra por `empresa_id` quando empresa estiver ativa
- Banner informativo quando nenhuma empresa está selecionada

**Auditor SPED (`/auditor_fiscal`):**
- `salvarArquivoSped` agora envia `parsed_data` com dados reais (não null)
  - Fiscal: `{ company, e110, c190 }`
  - Contribuições: `{ company, isZeroed, debug }`

**Validador NF-e (`/validador_entradas`) — lista completa:**

1. **Dois fluxos de importação XML** — botões separados "Terceiros (Entradas)" e "Próprios (Saídas)"
2. **Validação de CNPJ** por tipo: terceiros verificam destinatário; próprios verificam emitente
3. **Aviso de nota entrada de terceiro** (`tpNF=0`) com botão fechar e formatação `pre-line`
4. **CFOP de entrada sugerido**: `MAPA_CFOP` (18 CFOPs) + `sugerirCfopEntrada` + `getOpcoesEntrada`
5. **DESC_CFOP completa**: ~300+ entradas (tabela oficial completa 1xxx–7xxx)
6. **NCM_UC ampliado**: têxteis domésticos, artigos de vidro, inox, cutelaria, louças, plásticos
7. **Palavras-chave ampliadas**: toalha, lençol, prato, talher, panela, frigideira, bacia, etc.
8. **Flag `classificacaoManual`** na `LinhaEntrada` — distingue manual de automática
9. **`reproc()` corrigido** — respeita flag; ao trocar perfil, só recalcula itens não editados manualmente
10. **`reproc()` preserva seleção do modal** — se `sugerirCfopEntrada` retorna `""`, mantém o CFOP existente
11. **Resumo CFOP na tela** — usa `cfopEfetivo` (CFOP de entrada para terceiros); ordem crescente
12. **Resumo CFOP no Excel** — corrigido para usar `cfopEfetivo` em vez de `i.cfop`; ordem crescente
13. **Excel: coluna "CFOP Entrada"** no sheet "Itens Entradas" (ao lado do "CFOP Forn.")
14. **Modal de seleção de CFOP por nota** — aparece quando CFOP do fornecedor não tem equivalente de entrada:
    - Uma linha por nota (agrupado por nota + CFOP)
    - Mostra: número da NF, fornecedor, produtos (até 3), dropdown de seleção
    - Container com scroll (max-height: 80vh) para muitas notas
    - Chave de mapeamento: `nota__cfopForn` (granularidade por nota, não por CFOP global)
15. **`finalizarImportacao()`** — função extraída de `processarXmls` para reutilização pós-modal

#### Arquivos modificados nesta sessão

| Arquivo | O que mudou |
|---|---|
| `app/(fiscal)/inconsistencias/page.tsx` | Filtro por empresa ativa + banner |
| `app/(fiscal)/auditor_fiscal/page.tsx` | `parsed_data` não-nulo na persistência |
| `app/(fiscal)/validador_entradas/page.tsx` | Todas as melhorias listadas acima |
