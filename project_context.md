# Project Context — Auditor Fiscal | Enfokus Contabilidade

> Arquivo de referência para novas conversas com Claude Code.
> Mantido manualmente. Atualizar sempre que houver mudança estrutural significativa.
> Última atualização: 2026-05-06

---

## 1. Visão Geral do Sistema

### Objetivo

Plataforma interna de auditoria fiscal e planejamento tributário da Enfokus Contabilidade.
Permite que contadores e auditores importem, validem e cruzem dados de SPED Fiscal,
SPED Contribuições e XMLs de NF-e para identificar inconsistências fiscais, tributárias
e obrigações acessórias pendentes.

### Tipo de sistema

- Auditoria fiscal (SPED, NF-e, cruzamento de dados)
- Planejamento tributário (comparação de regimes, simulação de carga)
- Controle de obrigações acessórias (REINF, DCTFWeb, eSocial, DCTF, ECF)
- Uso interno (Enfokus Contabilidade) — não é SaaS público

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
  (fiscal)/             ← Todas as páginas autenticadas
    page.tsx            ← Dashboard principal
    SidebarFiscal.tsx   ← Sidebar global (compartilhada)
    layout.tsx          ← Layout com auth check + sidebar
    auditor_fiscal/     ← Módulo SPED
    validador_entradas/ ← Módulo NF-e (mais completo)
    inconsistencias/    ← Módulo de alertas
    empresas/           ← Cadastro e seleção de empresa
    planejamento/       ← Em desenvolvimento (stub criado)
    obrigacoes/         ← Em desenvolvimento (stub criado)
  api/                  ← Rotas de API (Supabase server-side)
  login/                ← Tela de login
components/             ← Componentes compartilhados
lib/
  supabase/             ← Clientes browser e server
  hooks/                ← useEmpresaAtiva
  rules/                ← Motor de regras fiscais
  types.ts              ← Tipos TypeScript globais
```

---

## 2. Funcionalidades Já Implementadas

### Autenticação

- Login com e-mail e senha via Supabase Auth
- Middleware Next.js protege todas as rotas exceto `/login` e `/auth`
- Redirect automático: usuário não autenticado vai para `/login`; autenticado vai para `/`
- Logout disponível na sidebar (apaga sessão e redireciona)

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

### 6.1 Persistência do Validador NF-e

- Salvar `LinhaEntrada[]` com classificações no `parsed_data` do `fa_arquivos_xml`
- Restaurar estado via `GET /api/arquivos-xml?sessao_id=...` ao carregar a página
- Criar `PATCH /api/arquivos-xml/[id]` para persistir classificações ao alterar manualmente

### 6.2 Evolução do Auditor SPED

- Exportação Excel com totais de ICMS, PIS/COFINS, receita
- Cruzamento com NF-e: divergência entre SPED e XMLs importados
- Visualização por período/competência

### 6.3 Integração entre Módulos (pipeline)

1. Usuário importa SPED ou NF-e
2. Sistema salva no banco via API route
3. Motor de regras executa automaticamente
4. Alertas gerados aparecem em `/inconsistencias`

### 6.4 Regras de Inconsistência (motor)

- Divergência entre SPED Fiscal e XMLs de NF-e
- CFOP de entrada incompatível com natureza do produto
- Crédito de ICMS indevido (uso e consumo sem benefício)
- SPED com apuração zerada mas com faturamento
- Divergência entre base de cálculo declarada e apurada

### 6.5 Módulos de Obrigações e Planejamento

- Calendário de obrigações com controle de REINF / DCTFWeb / eSocial / DCTF / ECF
- Simulador de carga tributária por regime (Simples × Presumido × Real)

---

## 7. Diretrizes Técnicas

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

| Tabela | Finalidade |
|---|---|
| `empresas` | Cadastro de clientes (matriz, filial, regime) |
| `fa_sessoes_analise` | Sessões de análise por empresa + competência |
| `fa_arquivos_sped` | SPED importados (parsed_data em JSONB) |
| `fa_arquivos_xml` | XMLs de NF-e importados |
| `fa_alertas` | Alertas gerados pelo motor de regras |
| `fa_regras_fiscais` | Catálogo de regras configuráveis |

API routes disponíveis:
- `GET/POST /api/empresas`
- `GET/PUT /api/empresas/[id]`
- `GET/POST /api/sessoes`
- `GET/POST /api/alertas`
- `PATCH /api/alertas/[id]`
- `GET/POST /api/arquivos-sped`
- `GET/POST /api/arquivos-xml`

---

## Arquivos Críticos

| Arquivo | Papel |
|---|---|
| `app/globals.css` | Tema, CSS vars, normalização visual |
| `app/(fiscal)/SidebarFiscal.tsx` | Navegação + seletor de empresa |
| `components/ThemeProvider.tsx` | Context de tema claro/escuro |
| `lib/hooks/useEmpresaAtiva.ts` | Estado global da empresa selecionada |
| `lib/types.ts` | Todos os tipos TypeScript do domínio |
| `middleware.ts` | Guard de autenticação |
| `supabase_setup.sql` | DDL completo do banco |
| `app/login/page.tsx` | Tela de login |
| `app/(fiscal)/page.tsx` | Dashboard principal |
| `app/(fiscal)/validador_entradas/page.tsx` | Módulo NF-e (arquivo principal, ~2400 linhas) |
| `app/(fiscal)/auditor_fiscal/page.tsx` | Módulo SPED |
| `app/(fiscal)/inconsistencias/page.tsx` | Módulo de alertas |
| `eslint.config.js` | Configuração ESLint v9 (flat config) |
| `project_context.md` | Este arquivo — referência de estado do projeto |

---

## Histórico de Sessões

### Sessão 2026-04-29 — Validação pós-redesign + correções pré-desenvolvimento

#### Problemas encontrados e corrigidos

- `/planejamento` e `/obrigacoes` retornavam 404 → criadas páginas stub
- ESLint sem configuração → criado `eslint.config.js` (flat config v9)
- Login em modo escuro com fundo branco → substituído por `#071527` fixo
- Regra CSS global sobrescrevia fundos inline → restritas a classes Tailwind legadas
- Cores hardcoded em Inconsistências → substituídas por CSS vars
- CSS duplicado e artefatos órfãos → removidos

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
