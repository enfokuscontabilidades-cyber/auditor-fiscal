# Project Context — Plataforma SaaS Contábil | Enfokus

> Arquivo de referência para novas conversas com Claude Code.
> Mantido manualmente. Atualizar sempre que houver mudança estrutural significativa.
> Última atualização: 2026-05-27 (Fase E — reorganização UI: menu do usuário na topbar)

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
    page.tsx            ← Dashboard principal (Client Component + Recharts + card CNPJ)
    SidebarFiscal.tsx   ← Sidebar com nome da org (apenas navegação)
    configuracoes/      ← Gestão de membros, plano, convites
    auditor_fiscal/     ← Módulo SPED (4 abas: Cruzamento | Apuração | Itens | Inconsistências)
    validador_entradas/ ← Módulo NF-e (mais completo)
    inconsistencias/    ← Módulo Relatórios (6 abas: Inconsistências, Documentos, Produtos, Participantes, CFOP, NCM)
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
    empresas/
      route.ts          ← GET/POST empresas
      [id]/route.ts     ← GET/PUT empresa
      cadastrar-por-cnpj/ ← POST cadastrar empresa a partir de dados CNPJ (com checagem de duplicatas)
    cnpj-cache/         ← GET consulta CNPJ (API-first + cache Supabase fallback)
    cnpj-debug/         ← GET debug — retorna JSON bruto da publica.cnpj.ws (temporário)
    sessoes/ alertas/ arquivos-sped/ arquivos-xml/ simples_nacional/
    documentos-fiscais/ ← GET (lista); POST importar-nfe; itens/ GET/PATCH/[id]
    fiscal/
      limpar-competencia/ ← DELETE (remove XMLs + documentos da competência)
      periodos-importados/ ← GET períodos com XMLs
    simples/
      receitas-mensais/ ← GET/POST receitas por competência
    relatorios/
      documentos/       ← GET documentos fiscais agrupados por empresa/período
      participantes/    ← GET fornecedores/clientes com totais
      produtos/         ← GET produtos por NCM/CFOP
      cfop/             ← GET análise de CFOPs utilizados
      ncm/             ← GET análise de NCMs (com contagem de produtos)
components/
  SessionGuard.tsx      ← Guard client-side de sessão de browser
  TopbarFiscal.tsx      ← Topbar global: título, seletor de empresa, avatar + dropdown de usuário
  ModalCnpj.tsx         ← Modal de resultado de consulta CNPJ (6 seções + cadastrar empresa)
  ui/
    PageHeader.tsx      ← Cabeçalho padronizado com título, subtitle, badge, actions
    GlassCard.tsx       ← Card glassmorphism
    MetricCard.tsx      ← Card de métrica com valor e label
    EmptyState.tsx      ← Estado vazio padronizado
lib/
  supabase/
    client.ts           ← Browser client (exporta createClient — NÃO createBrowserClient)
    server.ts           ← Server client (SSR)
    admin.ts            ← Service-role client (bypassa RLS)
    org.ts              ← Helper getOrgId(supabase, userId)
    fetchAll.ts         ← Paginação completa (lotes de 1000, supera limite PostgREST)
  hooks/                ← useEmpresaAtiva
  rules/
    engine.ts           ← executarMotorRegras() — orquestra todos os executores
    types.ts            ← ContextoAnalise, AlertaGerado, ExecutorRegra
    executores/
      icms.ts           ← UC_COM_CREDITO, IMOB_SEM_CIAP, DIVERGENCIA_FISCAL_CONTRIB
      cfop.ts           ← CFOP_SAIDA_EM_ENTRADA, CFOP_ENTRADA_EM_SAIDA, INCOMPAT_CNAE
      pis_cofins.ts     ← CONTRIB_EXCLUSAO_INDEVIDA
      ncm.ts            ← BENEFICIO_NAO_APLICADO, NCM_ST_SEM_TRATAMENTO, SPED_ZERADO_COM_RECEITA
  fiscal/
    classificacao.ts    ← NCM_UC/IMOB/COMB, famCFOP, analisarProduto, validarItemSped (uso no SPED)
  sped/
    types.ts            ← SpedFiscalParsed, SpedContribParsed, SpedC170Item, SpedC170Contrib, etc.
    parsers.ts          ← parseFiscal (C170 + CIAP), parseContrib, mergeFiscalDatasets
    validators.ts       ← validarTudo (8 validações V01–V08), cruzarDocumentos
  simples/              ← calcularSimples.ts, cfopReceita.ts, tabelasAnexos.ts, parsePgdas.ts
  nfe/                  ← Parser XML de NF-e
  types.ts              ← Tipos TypeScript globais
```

---

## 1b. Arquitetura de Dados Compartilhados

Princípio central: **dados importados uma vez alimentam todos os módulos**. O Validador NF-e é o único ponto de importação de XMLs — salva em `fa_arquivos_xml` (metadados) E em `fa_documentos_fiscais`/`fa_documentos_itens` (dados completos). Módulos consomem via API, sem reimportar.

| Fonte de dados | Módulos alimentados |
|----------------|---------------------|
| XML de NF-e (via Validador) | `fa_arquivos_xml` + `fa_documentos_fiscais` + `fa_documentos_itens` → Simples Nacional · Contábil (futuro) · Financeiro (futuro) |
| SPED Fiscal | Auditoria Fiscal · Planejamento Tributário · cruzamentos automáticos |
| SPED Contribuições | Módulo Fiscal · cálculos PIS/COFINS · cruzamento com NF-e |
| PGDAS-D | Simples Nacional · confronto com XMLs e faturamento apurado |
| Extrato bancário | Financeiro · Contábil (futuro) |
| eSocial / DCTFWeb | Departamento Pessoal (futuro) |

**Fluxo de dados NF-e (implementado):**
```
Usuário importa XMLs no Validador NF-e
  → fa_arquivos_xml (chave, emitente, valor, competencia)
  → fa_documentos_fiscais (cabeçalho do documento)
  → fa_documentos_itens (NCM, CFOP, valor, CST, alíquotas)

Simples Nacional / Apuração do Sistema
  → lê fa_arquivos_xml (via GET /api/arquivos-xml?empresa_id=...&competencia=...)
  → lê fa_documentos_itens (via GET /api/documentos-fiscais?incluir_itens=true)
  → calcula apuração pelos Anexos I–V sem reimportar XMLs
```

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
- Logout disponível no **dropdown do avatar na topbar** (limpa `sessionStorage` + `localStorage` + Supabase session)

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
- Alterna pelo **dropdown do avatar na topbar** (ícone sol/lua conforme tema atual)
- Aplica `data-theme="claro"` ou `data-theme="escuro"` no `<html>`
- CSS vars completas para ambos os temas em `app/globals.css`

---

## 3. Módulos Existentes

### 3.1 Auditor SPED (`/auditor_fiscal`) — Atualizado em 2026-05-27

**Arquitetura:**
- Lógica de parsing extraída para `lib/sped/parsers.ts`
- Validações fiscais em `lib/sped/validators.ts`
- Tipos compartilhados em `lib/sped/types.ts`
- Classificação de itens em `lib/fiscal/classificacao.ts`
- Página com **4 abas**: Cruzamento | Apuração | Itens | Inconsistências

**O que faz:**
- Importa e parseia SPED Fiscal e SPED Contribuições no browser (sem servidor)
- Valida CNPJ: arquivo deve pertencer ao grupo empresarial da empresa ativa
- Detecta automaticamente tipo (Fiscal ou Contribuições) pelo conteúdo (bloco M/E)
- Suporta múltiplos arquivos por tipo (matriz + filiais, múltiplos períodos)
- Salva sessão + arquivo no banco via `POST /api/sessoes` e `POST /api/arquivos-sped`
- **Botão "Executar análise automática"**: busca regras ativas (`fa_regras_fiscais`), monta `ContextoAnalise`, executa motor de regras, persiste alertas via `POST /api/alertas`
- **Botão "Exportar Excel"**: gera arquivo com sheets: Cruzamento SPED, Apuração, Inconsistências SPED, Validação de Itens SPED

**Registros parseados — SPED Fiscal:**
- `0000`: identificação, CNPJ, período, UF, IE
- `0150`: participantes (fornecedores e clientes)
- `0200`: cadastro de produtos
- `C100`: documentos fiscais (NF-e e outros)
- `C170`: **itens individuais** — NCM, CFOP, CST ICMS, quantidades, valores, base/alíq/vlr ICMS, base/vlr ST, IPI → `SpedC170Item[]`
- `C190`: resumo por CFOP do documento (com base ICMS e valor ICMS)
- `E110`: apuração ICMS (débitos, créditos, saldo apurado, ICMS a recolher, saldo credor)
- `G125`: detecção de CIAP — `temCiap = true` quando presente

**Registros parseados — SPED Contribuições:**
- `0000`: identificação (parsing heurístico por posição de CNPJ)
- `0150` / `0200`: participantes e produtos
- `C100`: documentos
- `C170`: itens com campos PIS/COFINS: CST_PIS, VL_BC_PIS, ALIQ_PIS, VL_PIS, CST_COFINS, VL_BC_COFINS, ALIQ_COFINS, VL_COFINS
- `M200`: apuração PIS (VL_REC_BRT, VL_BC_CONT, VL_CONT_NC, VL_CONT_PER, VL_CONT_PAGAR)
- `M600`: apuração COFINS (mesma estrutura M200)

**Validações automáticas (8 regras — aba Inconsistências):**

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

**Aba "Itens" — Validação analítica de itens C170 (Fase 5.4):**
- Tabela com 20 colunas: nota, data, CNPJ/nome participante, cód. produto, descrição, NCM, CFOP, CST, qtd, valor, desconto, base/alíq/vlr ICMS, vlr ST, classificação, alerta, nível, sugestão
- Chips coloridos de classificação (`ChipClass`): Revenda (verde), Insumo (ciano), Uso e Consumo (amarelo), Imobilizado (lilás), Combustível (rosa), Serviço (azul)
- Alertas gerados por `validarItemSped()`: `UC_CREDITO_INDEVIDO`, `IMOB_SEM_CIAP`, `CFOP_CLASSIFICACAO_INCOMPATIVEL`, `NCM_ST_CLASSIFICACAO`, `IMOB_COM_ST`
- Filtros: busca por nota/produto/NCM, dropdown de classificação, checkbox "Somente com alertas"
- KPI "Itens C170" com contagem de alertas no painel de KPIs

**Pendente:**
- Cruzamento NF-e × SPED (Fase 5.6): comparar `fa_documentos_fiscais` com docs do SPED por chave de acesso

### 3.2 Validador de NF-e (`/validador_entradas`)

**O que faz:**
- **Dois fluxos de importação separados:**
  - "Terceiros (Entradas)": XMLs emitidos por fornecedores para a empresa — tratados como entradas
  - "Próprios (Saídas)": XMLs emitidos pela própria empresa — tratados como saídas
- **Validação de CNPJ na importação:**
  - Terceiros: rejeita se o destinatário (dest) ≠ CNPJ da empresa ativa
  - Próprios: rejeita se o emitente (emit) ≠ CNPJ da empresa ativa
- **Persistência completa no banco** ao confirmar sessão (`onConfirmarSessaoXml`):
  - Salva metadados em `fa_arquivos_xml` (competencia, chave, emitente, valor_total) — lotes de 500
  - Salva documentos + itens em `fa_documentos_fiscais`/`fa_documentos_itens` via `POST /api/documentos-fiscais/importar-nfe`
  - `replace_sessao=true`: limpa todas as sessões `apuracao_simples` da mesma empresa+competência antes de salvar
- **Recuperação de sessão** (`carregarSessaoAnterior`):
  - Se `parsed_data` existe em `fa_arquivos_xml`: restaura itens diretamente
  - Se não existe: busca de `fa_documentos_itens` via `GET /api/documentos-fiscais?incluir_itens=true` e mapeia para `LinhaEntrada[]`/`LinhaSaida[]`
- **Navegação para Apuração**: após salvar sessão, exibe banner verde "Sessão X/YYYY salva" com botão "Ver Apuração do Sistema →" que navega para `/simples_nacional?aba=apuracao_sistema&competencia=...`
- **Limpeza de competência** (`limparCompetenciaDb`): botão vermelho "Limpar MM/YYYY" (visível quando há sessão ativa) — chama `DELETE /api/fiscal/limpar-competencia` com `window.confirm`, depois limpa estado local
- **Sugestão de classificação por perfil:** Empresa Geral / Supermercado / Bar e Restaurante / Construção Civil
  - Ao trocar perfil, itens sem classificação manual são recalculados automaticamente
  - Itens com classificação manual (`classificacaoManual=true`) são preservados
- **CFOP de entrada sugerido** para notas de terceiros:
  - `MAPA_CFOP`: mapeamento explícito para 18 CFOPs comuns
  - Modal de seleção de CFOP para CFOPs sem equivalente na tabela oficial
- **Exportação Excel**: Notas Entradas, Itens Entradas (c/ CFOP Entrada), Notas Saídas, Itens Saídas, Resumos CFOP, Classificação
- **DESC_CFOP completa**: ~300+ entradas (1xxx–7xxx)
- Classificação manual por item e por nota inteira; NCM_UC ampliado com domésticos

**Tipos principais:**
- `LinhaEntrada.classificacaoManual?: boolean` — flag que distingue classificação manual de automática
- `LinhaEntrada.tipo_nfe?: "terceiro" | "proprio" | null`
- `LinhaEntrada.cfop_entrada_sugerido?: string` — CFOP de lançamento no SPED (apenas terceiros)

**Correção de desconto XML (2026-05-25):**
- `parseXml()` faz pré-scan de cada nota para calcular `somaDescItensNota` e `somaProdSemDescNota`
- `vDescRestante = max(0, vDescNota − somaDescItensNota)` — só o desconto não coberto pelos itens com vDesc individual é distribuído proporcionalmente
- Algoritmo idêntico ao `parseNfe.ts`; evita double-counting em XMLs com desconto misto (alguns itens com vDesc, outros sem)
- `LinhaSaida` ganhou campo `valor_total_nota` — fonte verdade do vNF da nota, independente da soma dos itens

**Limitações atuais:**
- Não há cruzamento automático com SPED
- Classificações manuais feitas no Validador não são refletidas em `fa_documentos_itens` (o banco guarda os dados originais do XML, não as classificações do Validador)

### 3.3 Módulo Relatórios (`/inconsistencias`) — Renomeado e ampliado em Fase C

**O que faz (6 abas):**

| Aba | Descrição |
|-----|-----------|
| Inconsistências | Lista alertas de `fa_alertas` com filtro por empresa ativa, nível de risco e status; ações: Em análise / Resolvido / Descartado |
| Documentos | Documentos fiscais por empresa/período com totais de valor e impostos |
| Produtos | Análise de produtos por NCM/CFOP com contagem e totais |
| Participantes | Fornecedores/Clientes com totais de entrada/saída; filtro Fornecedores ↔ Clientes independente |
| CFOP | CFOPs utilizados com contagens e valores |
| NCM | NCMs com `count_produtos` e análise de destinação |

**Alimentado por:**
- `GET /api/relatorios/documentos` — documentos fiscais com limites corrigidos
- `GET /api/relatorios/participantes` — com campo `tipo` para entrada/saída
- `GET /api/relatorios/produtos`
- `GET /api/relatorios/cfop`
- `GET /api/relatorios/ncm` — retorna `count_produtos`

**Motor de regras — integrado no Auditor SPED (Fase 5.5):**
- Alertas gerados pelo botão "Executar análise automática" no Auditor SPED
- Regras ativas buscadas de `fa_regras_fiscais`
- Resultado salvo em `fa_alertas` e visível nesta aba

### 3.7 Dashboard (`/`) — Atualizado em Fase C + Fase D

**O que faz:**
- Client Component com gráficos Recharts por empresa ativa
- KPIs: alertas por nível (Crítico/Alto/Médio/Baixo), total empresas, sessões recentes
- Acesso rápido para todos os módulos
- **Card de consulta de CNPJ** (Fase D.5):
  - Input com máscara progressiva automática `XX.XXX.XXX/XXXX-XX`
  - Chama `GET /api/cnpj-cache?cnpj=...` — API-first (publica.cnpj.ws), cache como fallback
  - Exibe `<ModalCnpj>` com dados normalizados em 6 seções
  - Botão "Cadastrar empresa" com checagem de duplicata (`POST /api/empresas/cadastrar-por-cnpj`)

**`/api/cnpj-cache`:**
- Sempre consulta `publica.cnpj.ws` primeiro; salva dado bruto no `cnpj_cache`
- Normalização acontece na leitura (função `normalizar(raw, fonte, consultado_em)`)
- Suporta Formato B (atual API, objeto `estabelecimento` aninhado) e Formato A (dados legados flat em cache)
- Fallback: se API falhar, retorna dado normalizado do cache

**`components/ModalCnpj.tsx`:**
- 6 seções: Dados Principais, Endereço, Contato, Atividade Principal, Atividades Secundárias, QSA
- Chip colorido de situação cadastral (ATIVA = verde, cancelada/baixada = vermelho, etc.)
- Rodapé: fonte (Receita Federal ao vivo / cache local) + data da consulta
- Botão "Cadastrar empresa" com estados: idle → ok/exists/error

### 3.4 Planejamento Tributário (`/planejamento`) — Em desenvolvimento

Página stub criada. Funcionalidades planejadas: simulador de regime, análise de desenquadramento,
comparação de carga tributária e impacto da Reforma Tributária (IBS/CBS).

### 3.5 Obrigações Acessórias (`/obrigacoes`) — Em desenvolvimento

Página stub criada. Funcionalidades planejadas: calendário de obrigações, controle de entregas
(REINF, DCTFWeb, eSocial, DCTF, ECF), alertas de prazo e histórico por competência.

### 3.6 Simples Nacional (`/simples_nacional`)

Página com 4 abas: **Declarações PGDAS-D** | **Apuração do Sistema** | **Confronto Apuração** | **Configurações**

#### Aba: Declarações PGDAS-D (implementada em 2026-05-12)

- Importa PDFs do PGDAS-D (browser-side via `pdfjs-dist`) — sem upload para servidor
- Extrai e persiste na tabela `sn_declaracoes`: CNPJ, razão social, período, tipo declaração, atividade, anexo, receitas, tributos individuais, histórico mensal, total devido, nº recibo
- Detecta múltiplas atividades (seção 2.8): separa Comércio × Serviços quando há dois CNAEs
- Tabela multi-período: linhas = períodos; colunas = Receita Bruta | Total Impostos | Alíquota Efetiva
- Linhas expansíveis: chips de tributos (atividade única) ou cards por atividade (múltiplas)
- KPIs: Receita/Imposto do último período, totais acumulados, alíquota média, acumulado 12m
- Botão "Limpar tudo" (remove todas as declarações da empresa, com confirmação)
- Exportação Excel: planilha "PGDAS-D" + planilha "Por Atividade"
- Upsert por `(empresa_id, competencia)` — retificadora substitui original

#### Aba: Apuração do Sistema (implementada em 2026-05-22 + melhorias 2026-05-23 + correções 2026-05-25)

- Busca XMLs de `fa_arquivos_xml` via `fetchAll` (paginado, sem limite) + itens de `fa_documentos_itens`
- Calcula apuração pelos Anexos I–V com base no RBT12 dos últimos 12 meses
- KPIs: Notas de Venda, Devoluções, Receita Líquida, RBT12 — sem tabela por-nota
- Auto-formato de competência: `012025` → `01/2025` conforme digitação
- **Navegação integrada**: lê `?aba=` e `?competencia=` da URL ao montar (vinda do Validador)
- **Empty state com ação**: botão "Ir para o Validador NF-e →" quando não há XMLs para a competência
- **RBT12 inteligente** (corrigido 2026-05-25):
  - `sn_receitas_mensais` carregada via `GET /api/simples/receitas-mensais` — aceita RBT12 completo apenas com ≥ 12 meses
  - Modal redesenhado: mostra meses faltantes individualmente + campo de total; salva com `origem: 'estimado'` nos 12 meses anteriores via `competenciasAnteriores()`
  - Empresas com < 12 meses: calcula média proporcional `(soma / n) * 12` com confirmação do usuário
  - Sugestão do PGDAS-D (`rbt12Sugestao`) disponível no modal mas não aplicada automaticamente
- **Extrato detalhado da apuração**: `BlocoAnexo` + `LinhaReceitaExtrato` + `ExtratoPgdasSimulado` mostram memória de cálculo por anexo (RBT12, alíquota nominal, parcela deduzir, alíquota efetiva, DAS)
- **Chips visuais**: `chipMovimento()` (Saída/Venda, Dev. Venda, Entrada, Remessa…) e `chipImpacto()` (+ Receita / − Receita / Sem impacto)
- **`AbaApuracaoSistema`** extraída como componente próprio com props explícitas

**Arquivos:**
- `lib/simples/parsePgdas.ts` — parser PDF
- `lib/simples/calcularSimples.ts` — apuração pelos Anexos
- `lib/simples/cfopReceita.ts` — mapeamento CFOP → tipo de receita
- `lib/simples/tabelasAnexos.ts` — tabelas dos Anexos I–V
- `app/api/simples_nacional/route.ts` — POST / GET / DELETE declarações PGDAS-D
- `app/api/simples/receitas-mensais/route.ts` — GET/POST receitas mensais
- `app/(fiscal)/simples_nacional/page.tsx` — página principal (~2000 linhas)
- `public/pdf.worker.min.mjs` — worker pdfjs-dist

**Tabelas banco:**
```
sn_declaracoes          — declarações PGDAS-D (empresa_id, competencia, receita_bruta_mes, parsed_data)
sn_receitas_mensais     — receita bruta por competência (empresa_id, competencia, receita_bruta_mes, origem)
sn_apuracoes            — resultado da apuração (empresa_id, competencia, rbt12, receita_liquida, valor_calculado, status)
sn_apuracoes_receitas   — breakdown por anexo (apuracao_id, anexo, valor_receita, aliquota_efetiva, valor_das)
```

---

## 3b. Biblioteca de Classificação Fiscal (`lib/fiscal/classificacao.ts`)

Criada na Fase 5.1. Usada pelo Auditor SPED (aba Itens). **Não modifica** `validador_entradas/page.tsx`.

**Constantes:**
- `NCM_UC`: 35 prefixos de NCM de uso e consumo (alimentos, bebidas, higiene, domésticos, etc.)
- `NCM_IMOB`: 27 prefixos de NCM de ativo imobilizado (máquinas, equipamentos, móveis)
- `NCM_COMB`: 5 prefixos de NCM de combustíveis/lubrificantes

**Funções:**
- `famCFOP(cfop)`: retorna `'revenda' | 'industrializacao' | 'uso_consumo' | 'imobilizado' | 'outro'` baseado nos 2 últimos dígitos do CFOP
- `analisarProduto(desc, ncm)`: retorna `AnaliseSugestao` (tipo + motivo + confiança) sem perfil de empresa
- `sugerirClassificacao(ncm, desc, cfop, ehIndustrial?)`: combina análise de NCM/descrição com família CFOP
- `validarItemSped(item, temCiap, ehIndustrial)`: aplica 5 regras e retorna `{ classificacao, alertas }`

**Regras de `validarItemSped`:**
| Código | Nível | Condição |
|--------|-------|----------|
| `UC_CREDITO_INDEVIDO` | Alto | classificacao=uso_consumo + vlIcms > 0 |
| `IMOB_SEM_CIAP` | Alto | classificacao=imobilizado + vlIcms > 0 + !temCiap |
| `CFOP_CLASSIFICACAO_INCOMPATIVEL` | Médio | CFOP incompatível com classificação sugerida |
| `NCM_ST_CLASSIFICACAO` | Médio | NCM do RICMS/GO Anexo VIII + CST ∉ {10,30,60,70} |
| `IMOB_COM_ST` | Baixo | classificacao=imobilizado + vlBcSt > 0 |

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

### Motor de regras (integrado ao Auditor SPED — Fase 5.5)

- `lib/rules/engine.ts`: `executarMotorRegras(ctx)` — orquestra todos os executores registrados
- `lib/rules/types.ts`: tipos `ContextoAnalise`, `AlertaGerado`, `ExecutorRegra`
- Cada regra é função pura em `lib/rules/executores/` — nunca lança exceção
- `ContextoAnalise.fiscalData` recebe `SpedFiscalParsed` (merged) para acesso a `c170Items`

**Regras registradas no engine:**
| Código | Arquivo | Descrição |
|--------|---------|-----------|
| `ICMS_DIVERGENCIA_FISCAL_CONTRIB` | icms.ts | Divergência Fiscal × Contrib |
| `ICMS_UC_COM_CREDITO` | icms.ts | Uso e consumo com crédito ICMS |
| `ICMS_IMOB_SEM_CIAP` | icms.ts | Imobilizado com crédito sem CIAP |
| `ICMS_CFOP_SAIDA_EM_ENTRADA` | cfop.ts | CFOP de saída em entrada |
| `ICMS_CFOP_ENTRADA_EM_SAIDA` | cfop.ts | CFOP de entrada em saída |
| `CFOP_INCOMPAT_CNAE` | cfop.ts | CFOP incompatível com CNAE |
| `NCM_BENEFICIO_NAO_APLICADO` | ncm.ts | Benefício fiscal sem cBenef |
| `NCM_ST_SEM_TRATAMENTO` | ncm.ts | NCM do RICMS/GO Anexo VIII sem CST de ST |
| `OBRIG_SPED_ZERADO_COM_RECEITA` | ncm.ts | SPED zerado com receita declarada |
| `CONTRIB_EXCLUSAO_INDEVIDA` | pis_cofins.ts | Exclusão indevida na base PIS/COFINS |

**Fluxo de execução no Auditor SPED:**
1. Usuário clica "Executar análise automática" (⚡)
2. Busca `fa_regras_fiscais` onde `ativo = true`
3. Monta `ContextoAnalise` com `fiscalMerged` + `contribMerged` + empresa
4. Chama `executarMotorRegras(ctx)` → `AlertaGerado[]`
5. Salva via `POST /api/alertas` com `empresa_id`, `competencia`, etc.
6. Exibe banner: "X alertas salvos → Ver em Relatórios"

---

## 5. Limitações Atuais

### Classificações manuais do Validador não persistidas em fa_documentos_itens

O Validador NF-e salva itens com os dados originais do XML (`fa_documentos_itens`). Quando o usuário muda a classificação manualmente (uso e consumo → revenda, etc.), essa mudança não é gravada no banco — fica apenas em memória. Ao recarregar, os itens voltam à classificação original.

### Motor de regras não acionado automaticamente na importação

O motor de regras está integrado ao Auditor SPED via botão explícito "Executar análise automática". Não é acionado automaticamente ao importar SPEDs — requer disparo manual. O fluxo de importação de XMLs (Validador NF-e) também não aciona o motor.

### Cruzamento NF-e × SPED pendente (Fase 5.6)

Não há comparação automática entre `fa_documentos_fiscais` (XMLs importados) e `SpedFiscalParsed.docs` (SPEDs importados) por chave de acesso. Planejado para próxima sessão.

### Módulos de Obrigações e Planejamento sem lógica

Existem apenas como páginas stub.

---

## 6. Próximos Passos Planejados

### 6.1 Cruzamento NF-e × SPED (Fase 5.6 — pendente)

Sub-seção na aba "Cruzamento" do Auditor SPED:
- Buscar `fa_documentos_fiscais` para a empresa + competência ativa
- Comparar `chave_acesso` com `fiscalMerged.docs[].key`
- Categorizar: ✅ Em ambos / ⚠️ Só no SPED / ⚠️ Só como XML
- Exibir contadores + tabelas expansíveis por categoria

### 6.2 Persistência de classificações do Validador NF-e

- Salvar `LinhaEntrada[]` com classificações no `parsed_data` do `fa_arquivos_xml`
- Restaurar estado via `GET /api/arquivos-xml?sessao_id=...` ao carregar a página
- Criar `PATCH /api/arquivos-xml/[id]` para persistir classificações ao alterar manualmente

### 6.3 Módulos de Obrigações e Planejamento

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
| `fa_arquivos_xml` | XMLs de NF-e importados; campo `competencia` (MM/YYYY) adicionado via migração Fase A |
| `fa_documentos_fiscais` | Cabeçalho centralizado de documentos (NF-e, NFC-e etc.) — migração Fase A |
| `fa_documentos_itens` | Itens dos documentos (1 por produto/serviço) — migração Fase A |
| `fa_alertas` | Alertas gerados pelo motor de regras |
| `fa_regras_fiscais` | Catálogo de regras configuráveis (compartilhado, sem org_id) |
| `sn_declaracoes` | Declarações PGDAS-D do Simples Nacional (parsed_data em JSONB) |
| `sn_receitas_mensais` | Receita bruta mensal por competência — migração Fase A |
| `sn_apuracoes` | Resultado da apuração simulada por competência — migração Fase A |
| `sn_apuracoes_receitas` | Breakdown por anexo dentro da apuração — migração Fase A |

> As tabelas marcadas "migração Fase A" são criadas por `supabase_migration_fase_a.sql`, não pelo `supabase_setup.sql` principal.

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
- `GET/POST /api/arquivos-xml` — POST aceita `replace_sessao=true` para limpar sessões anteriores
- `GET/POST/DELETE /api/simples_nacional`
- `GET /api/documentos-fiscais` — suporta `incluir_itens=true`, usa `fetchAll`
- `POST /api/documentos-fiscais/importar-nfe` — salva documento + itens com upsert idempotente
- `GET/PATCH /api/documentos-fiscais/itens` / `[id]`
- `DELETE /api/fiscal/limpar-competencia` — remove todos os XMLs + documentos da competência
- `GET /api/fiscal/periodos-importados`
- `GET/POST /api/simples/receitas-mensais`

---

## Arquivos Críticos

| Arquivo | Papel |
|---|---|
| `app/globals.css` | Tema, CSS vars, normalização visual (tokens glassmorphism) |
| `app/(fiscal)/SidebarFiscal.tsx` | Navegação principal (logo, nome da org, 9 links) |
| `components/TopbarFiscal.tsx` | Topbar global: título da página, seletor de empresa, avatar com dropdown (tema, configurações, logout) |
| `app/(fiscal)/layout.tsx` | Auth guard + org guard + plano guard |
| `components/ThemeProvider.tsx` | Context de tema claro/escuro |
| `components/SessionGuard.tsx` | Guard client-side de sessão de browser |
| `components/ModalCnpj.tsx` | Modal de resultado de consulta CNPJ (6 seções + cadastrar empresa) |
| `components/ui/PageHeader.tsx` | Cabeçalho padronizado — title, subtitle, badge, actions |
| `components/ui/GlassCard.tsx` | Card glassmorphism reutilizável |
| `lib/hooks/useEmpresaAtiva.ts` | Estado global da empresa selecionada (localStorage + CustomEvent) |
| `lib/types.ts` | Todos os tipos TypeScript do domínio |
| `lib/supabase/admin.ts` | Cliente service-role (bypassa RLS) |
| `lib/supabase/org.ts` | Helper `getOrgId(supabase, userId)` |
| `lib/supabase/client.ts` | Browser client — exporta `createClient` (não `createBrowserClient`) |
| `lib/fiscal/classificacao.ts` | NCM_UC/IMOB/COMB, famCFOP, analisarProduto, validarItemSped |
| `lib/sped/types.ts` | Tipos SPED: SpedFiscalParsed, SpedC170Item, SpedContribParsed, etc. |
| `lib/sped/parsers.ts` | parseFiscal (C170+CIAP), parseContrib, mergeFiscalDatasets |
| `lib/sped/validators.ts` | validarTudo (8 regras V01–V08), cruzarDocumentos |
| `lib/rules/engine.ts` | executarMotorRegras() — orquestra executores |
| `lib/rules/executores/ncm.ts` | Executores NCM: benefício, ST sem tratamento, SPED zerado |
| `middleware.ts` | Guard de autenticação (rotas públicas: `/login`, `/cadastro`, `/auth`, `/api/stripe/webhook`) |
| `supabase_setup.sql` | DDL completo do banco (tabelas base) |
| `supabase_migration_fase_a.sql` | Migração Fase A — idempotente |
| `supabase_migration_cnpj_cache.sql` | Migração cnpj_cache — idempotente |
| `lib/supabase/fetchAll.ts` | Paginação completa Supabase (supera limite PostgREST de 1000 rows) |
| `app/(fiscal)/page.tsx` | Dashboard principal (Client Component + Recharts + card CNPJ) |
| `app/(fiscal)/validador_entradas/page.tsx` | Módulo NF-e — importação, validação, persistência (~2400+ linhas) |
| `app/(fiscal)/auditor_fiscal/page.tsx` | Módulo SPED — 4 abas, motor de regras, Excel, validação itens |
| `app/(fiscal)/inconsistencias/page.tsx` | Módulo Relatórios — 6 abas |
| `app/(fiscal)/simples_nacional/page.tsx` | Módulo Simples Nacional — PGDAS-D + Apuração (~2000 linhas) |
| `app/api/cnpj-cache/route.ts` | GET consulta CNPJ (API-first + normalizador dual-format + cache fallback) |
| `app/api/empresas/cadastrar-por-cnpj/route.ts` | POST cadastrar empresa a partir de dados CNPJ |
| `app/api/relatorios/documentos/route.ts` | GET documentos fiscais para aba Relatórios |
| `lib/simples/parsePgdas.ts` | Parser PDF do PGDAS-D (browser-side, pdfjs-dist) |
| `lib/simples/calcularSimples.ts` | Cálculo de apuração Simples Nacional pelos Anexos I–V |
| `app/api/simples_nacional/route.ts` | API Simples Nacional PGDAS-D (GET/POST/DELETE) |
| `app/api/documentos-fiscais/importar-nfe/route.ts` | POST importar NF-e → fa_documentos_fiscais + itens |
| `app/api/stripe/webhook/route.ts` | Webhook Stripe (ativar/suspender plano) |
| `public/pdf.worker.min.mjs` | Worker pdfjs-dist (asset estático) |
| `project_context.md` | Este arquivo — referência de estado do projeto |

---

## Histórico de Sessões

### Sessão 2026-05-27 — Fase E: Reorganização UI — Menu do Usuário na Topbar

#### O que foi implementado

Reorganização das ações do usuário para tornar a sidebar mais limpa e o layout mais profissional (padrão SaaS).

**SidebarFiscal.tsx:**
- Removido `/configuracoes` da lista `LINKS` (9 links restantes)
- Removido bloco `af-sidebar-footer` com botão de tema, botão de logout
- Removidos imports desnecessários: `createClient`, `useTheme`, `LogOut`, `Moon`, `Sun`, `Settings`

**TopbarFiscal.tsx:**
- Avatar agora abre dropdown de usuário (`userMenuAberto` + `userMenuRef`)
- Dropdown fecha ao clicar fora (segundo `useEffect` com `mousedown`)
- 3 opções no dropdown:
  - **Alternar tema** — ícone sol (modo escuro) ou lua (modo claro), fecha ao clicar
  - **Configurações** — navega para `/configuracoes` via `router.push`, fecha o menu
  - **Sair** — separador visual + texto em `var(--af-danger)`, reutiliza `handleLogout` idêntico ao que estava na sidebar
- Avatar destacado quando menu aberto (`--af-primary-soft` + borda colorida)
- ChevronDown anima 180° quando aberto
- Visual do dropdown usa tokens CSS existentes para funcionar em ambos os temas

**globals.css:**
- Removidas classes: `.af-sidebar-footer`, `.af-theme-toggle`, `.af-theme-tag`, `.af-logout-button` e seus estados hover
- Ajustada media query que referenciava `.af-theme-tag`

#### Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `app/(fiscal)/SidebarFiscal.tsx` | Removidos link Configurações, footer de ações e imports desnecessários |
| `components/TopbarFiscal.tsx` | Avatar com dropdown: tema, configurações, logout |
| `app/globals.css` | Removidas classes de sidebar footer (tema/logout) |
| `plan.md` | Fase E marcada como concluída |
| `project_context.md` | Este arquivo |

---

### Sessão 2026-05-27 — Fase C, Fase D e Fase 5

#### O que foi implementado

**Fase C — Reforma Visual UI/UX:**
- Tokens glassmorphism em `app/globals.css` (`--af-glass-bg`, `--af-glass-border`, `--af-glass-blur`)
- 4 componentes em `components/ui/`: `PageHeader`, `GlassCard`, `MetricCard`, `EmptyState`
- Dashboard convertido para Client Component com gráficos Recharts por empresa ativa
- `/inconsistencias` → **Relatórios** com 6 abas + 5 novas rotas `/api/relatorios/*`
- `PageHeader` padronizado em todas as páginas
- `supabase_migration_cnpj_cache.sql` — tabela `cnpj_cache` criada e aplicada

**Fase D — Correções Dashboard e Relatórios:**
- D.1: `/api/relatorios/documentos` — limite corrigido para `200000`
- D.2: Aba Participantes — estado local `tipoParticipante` independente do filtro global
- D.3: Formatação CNPJ `XX.XXX.XXX/XXXX-XX` na aba Participantes
- D.4: Campo `count_produtos ?? count ?? 0` na aba NCM
- D.5: Card de consulta CNPJ no Dashboard + `components/ModalCnpj.tsx` + `/api/cnpj-cache` (API-first, normalizador dual-format) + `/api/empresas/cadastrar-por-cnpj`

**Fase 5 — Validação de Itens SPED + Motor de Regras:**
- 5.1: `lib/fiscal/classificacao.ts` — biblioteca compartilhada de classificação
- 5.2: `lib/sped/parsers.ts` — C170 parseado + CIAP detectado; `mergeFiscalDatasets` atualizado
- 5.3: `NCM_ST_SEM_TRATAMENTO` em `lib/rules/executores/ncm.ts` + registrado no engine
- 5.4: Aba "Itens" no Auditor SPED — tabela analítica C170 com ChipClass, alertas, filtros
- 5.5: Motor de regras integrado no Auditor SPED — botão "Executar análise automática"
- 5.7: Exportação Excel no Auditor SPED (4 sheets)

#### Arquivos criados/modificados

| Arquivo | O que mudou |
|---|---|
| `lib/fiscal/classificacao.ts` | **NOVO** — classificação fiscal compartilhada |
| `lib/sped/types.ts` | `SpedC170Item` + `c170Items`/`temCiap` em `SpedFiscalParsed` |
| `lib/sped/parsers.ts` | C170 parsing + CIAP detection + merge atualizado |
| `lib/rules/executores/ncm.ts` | `executarNcmStSemTratamento` adicionado |
| `lib/rules/engine.ts` | `NCM_ST_SEM_TRATAMENTO` registrado |
| `app/(fiscal)/auditor_fiscal/page.tsx` | 4ª aba Itens + motor de regras + Excel + ChipClass |
| `app/(fiscal)/page.tsx` | Card consulta CNPJ + ModalCnpj + estados |
| `app/(fiscal)/inconsistencias/page.tsx` | Módulo Relatórios (6 abas) + correções D.2/D.3/D.4 |
| `components/ModalCnpj.tsx` | **NOVO** — modal consulta CNPJ (6 seções) |
| `components/ui/PageHeader.tsx` | **NOVO** |
| `components/ui/GlassCard.tsx` | **NOVO** |
| `components/ui/MetricCard.tsx` | **NOVO** |
| `components/ui/EmptyState.tsx` | **NOVO** |
| `app/api/cnpj-cache/route.ts` | **NOVO** — API-first + normalizador dual-format |
| `app/api/cnpj-debug/route.ts` | **NOVO** — debug endpoint (temporário) |
| `app/api/empresas/cadastrar-por-cnpj/route.ts` | **NOVO** — cadastrar empresa pelo CNPJ |
| `app/api/relatorios/{documentos,participantes,produtos,cfop,ncm}/route.ts` | **NOVOS** |
| `supabase_migration_cnpj_cache.sql` | **NOVO** — tabela `cnpj_cache` |
| `plan.md` | Fases C, D e 5 marcadas como concluídas |
| `CLAUDE.md` | Estrutura e padrões atualizados |
| `project_context.md` | Este arquivo |

---

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

---

### Sessão 2026-05-25 — Fase B: Correções Críticas Apuração Simples + Desconto XML

#### Problemas resolvidos

**Bug 1 — RBT12 manual salvo na competência apurada:**
- `handleConfirmarRbt12` era `{ competencia: xmlCompetencia, receita_bruta_mes: val/12 }` — salvava 1 linha na competência apurada, nunca encontrada de volta no RBT12
- Corrigido: distribui pelos 12 meses anteriores via `competenciasAnteriores(xmlCompetencia)` com `origem: 'estimado'`

**Bug 2 — Meses faltantes não identificados:**
- Adicionado helper `competenciasAnteriores()` client-side no `page.tsx` (espelha a API)
- `mesesFaltantes` calculado via `useMemo` comparando os 12 meses esperados com os disponíveis em `sn_receitas_mensais`
- Modal RBT12 redesenhado: exibe meses ausentes com campo individual + opção de total via `rbt12MesesInputs`
- `handleSalvarMesesIndividuais` salva entradas individuais com `origem: 'manual'`

**Bug 3 — Empresas com <12 meses sem proporção:**
- `handleApurar` detecta `receitas12m.length > 0 && < 12`
- Calcula `rbt12 = (soma / n) * 12` com confirmação via `window.confirm` e `origem_rbt12: 'estimado'`

**Bug 4 — Desconto não deduzido na acumulação por anexo (`calcularSimples.ts`):**
- Linha 164 era `vItem = item.valor_total`; corrigido para `Math.max(0, valor_total - valor_desconto)`
- Garante que a DAS calculada usa valor líquido, igual a `receita_vendas_bruta` que usa `vNF`
- Base legal: LC 123/2006 art. 3º §1º — descontos incondicionais excluídos da receita bruta

**Bug 5 — Rateio de desconto com double-counting no Validador NF-e:**
- `parseXml()` usava `vDescNota * propSaida` para itens sem vDesc individual — double-counting quando itens com vDesc já cobriam 100% do desconto da nota
- Corrigido: pré-scan calcula `vDescRestante = max(0, vDescNota − somaDescItens)` e distribui APENAS entre itens `somaProdSemDescNota` (algoritmo idêntico ao `parseNfe.ts`)

#### O que foi implementado

- [x] Helpers client-side: `competenciasAnteriores()`, `fmtCompetencia()`, `MESES_PT`
- [x] `AbaApuracaoSistema` extraída como componente com props tipadas
- [x] `chipMovimento()` e `chipImpacto()` — chips visuais para documentos fiscais
- [x] `BlocoAnexo`, `LinhaReceitaExtrato`, `ExtratoPgdasSimulado` — extrato de cálculo por anexo
- [x] `xmlPreview` — preview de XMLs antes de confirmar importação na aba Apuração
- [x] `rbt12Sugestao` do PGDAS-D disponível no modal mas sem aplicação automática
- [x] Campo `valor_total_nota: vNFtotal` em `LinhaSaida` (fonte verdade independente dos itens)
- [x] Deduplicação por `chave_nfe` ao restaurar sessão anterior (`carregarSessaoAnterior`)
- [x] `POST /api/simples_nacional` popula `sn_receitas_mensais` com `historico_mensal` do PGDAS-D; respeita `origem='manual'`
- [x] Tipos TypeScript completos em `lib/types.ts`: `DocumentoFiscal`, `DocumentoFiscalItem`, `SnReceitaMensal`, `SnApuracao`, `SnApuracaoReceita` + 9 enums auxiliares

#### Arquivos modificados

| Arquivo | O que mudou |
|---------|------------|
| `lib/simples/calcularSimples.ts` | Linha 164 — dedução de desconto na acumulação por anexo |
| `lib/types.ts` | `DocumentoFiscal`, `DocumentoFiscalItem`, `SnReceitaMensal`, `SnApuracao`, `SnApuracaoReceita`, 9 enums; `competencia` em `ArquivoXml` |
| `app/(fiscal)/simples_nacional/page.tsx` | Helpers, estados, `handleApurar`, `handleConfirmarRbt12`, modal meses individuais, `AbaApuracaoSistema`, chips, extrato detalhado |
| `app/(fiscal)/validador_entradas/page.tsx` | Algoritmo desconto `parseXml`, campo `valor_total_nota`, deduplicação sessão, `salvouComSucesso`, `router` |
| `app/api/simples_nacional/route.ts` | POST popula `sn_receitas_mensais`; upsert com proteção `origem='manual'` |

---

### Sessão 2026-05-22/23 — Fase A: Base Fiscal Central, Persistência XML e Navegação

#### Problemas resolvidos

**Persistência e recuperação de XMLs (bug crítico):**
- Limite PostgREST de 1000 rows causava query truncada: ~900 XMLs retornavam ~40 ao recarregar
- `range(0, 9999)` era ignorado silenciosamente — criado `lib/supabase/fetchAll.ts` (lotes de 1000)
- `replace_sessao` só limpava 1 sessão — expandido para limpar todas as sessões `apuracao_simples` da empresa+competência

**Migração SQL (`supabase_migration_fase_a.sql`):**
- `to_char` causava syntax error no Supabase Studio → substituído por `lpad(extract(...)::text, 2, '0') || '/' || extract(...)::text`
- `CREATE POLICY` sem `IF NOT EXISTS` falha na segunda execução → adicionado `DROP POLICY IF EXISTS` antes de cada policy

#### O que foi implementado

**Banco:**
- `supabase_migration_fase_a.sql` — migração idempotente com 5 novas tabelas + coluna `competencia` em `fa_arquivos_xml`

**API:**
- `lib/supabase/fetchAll.ts` — utilitário de paginação (lotes de 1000, loop até esgotar)
- `GET/POST /api/arquivos-xml` — usa `fetchAll`; POST com `replace_sessao=true` limpa todas as sessões
- `GET /api/documentos-fiscais` — usa `fetchAll`; suporta `incluir_itens=true`
- `DELETE /api/fiscal/limpar-competencia` — remove `fa_documentos_fiscais` (cascade → itens) + `fa_arquivos_xml` da empresa+competência

**Validador NF-e:**
- `onConfirmarSessaoXml` → salva em `fa_arquivos_xml` + `fa_documentos_fiscais`/`fa_documentos_itens`
- `carregarSessaoAnterior` → fallback para `fa_documentos_itens` quando `parsed_data` não tem itens
- Banner de sucesso pós-save com botão "Ver Apuração do Sistema →" (navega via `router.push` com URL params)
- Botão "Limpar MM/YYYY" (vermelho) com `window.confirm` + `DELETE /api/fiscal/limpar-competencia`

**Simples Nacional — Aba Apuração do Sistema:**
- `carregarXmlDocumentos` usa `fetchAll` + carrega `xmlItens` de `fa_documentos_itens`
- `useEffect` on mount lê `?aba=` e `?competencia=` via `window.location.search`
- Auto-formato competência no input
- Removida tabela por-nota (apenas KPIs)
- Removida UI de importação (centralizada no Validador)
- Empty state com botão "Ir para o Validador NF-e →"

#### Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `supabase_migration_fase_a.sql` | Criado — migração idempotente Fase A |
| `lib/supabase/fetchAll.ts` | Criado — paginação completa |
| `app/api/arquivos-xml/route.ts` | `fetchAll` + `replace_sessao` expandido + fallback `competencia=NULL` |
| `app/api/documentos-fiscais/route.ts` | `fetchAll` no GET |
| `app/api/fiscal/limpar-competencia/route.ts` | Criado — DELETE competência completa |
| `app/(fiscal)/validador_entradas/page.tsx` | Persistência completa + banner + limpeza DB + fallback itens |
| `app/(fiscal)/simples_nacional/page.tsx` | `fetchAll` + `xmlItens` + URL params + auto-format + sem tabela + sem import UI + navegação |
