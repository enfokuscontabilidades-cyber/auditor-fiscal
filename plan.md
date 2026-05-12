# Plataforma de Auditoria Fiscal — Plano Técnico

## Objetivo

Transformar o `sistema-controle` em uma plataforma profissional de auditoria fiscal com login, banco de dados próprio (Supabase), motor de regras automático, alertas classificados por risco e planejamento tributário. Os dois módulos já funcionando (Auditor SPED e Validador de Entradas) são preservados e integrados ao novo sistema.

---

## Decisões de Arquitetura

- **Parsing no browser:** os parsers de SPED e XML já existem e funcionam. O backend salva apenas o resultado (JSON) — não reprocessa o arquivo.
- **Banco próprio:** projeto Supabase exclusivo do sistema-controle. Sem dependência de outros sistemas.
- **Motor de regras:** função TypeScript pura que recebe dados parseados e devolve lista de alertas. Sem chamadas externas.

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
├── login/page.tsx                      login
├── auth/callback/route.ts              callback OAuth
├── (fiscal)/
│   ├── layout.tsx                      sidebar + auth guard
│   ├── page.tsx                        dashboard
│   ├── empresas/page.tsx               cadastro de empresas
│   ├── auditoria/page.tsx              lista de sessões
│   ├── auditoria/[sessaoId]/page.tsx   detalhe de sessão
│   ├── auditor_fiscal/page.tsx         SPED Fiscal × Contribuições (existente)
│   ├── validador_entradas/page.tsx     XML + SPED C170 (existente)
│   ├── inconsistencias/page.tsx        alertas consolidados
│   ├── planejamento/page.tsx           simulador de regime
│   └── obrigacoes/page.tsx             calendário de obrigações
└── api/
    ├── sessoes/route.ts
    ├── sessoes/[id]/route.ts
    ├── arquivos-sped/route.ts
    ├── arquivos-xml/route.ts
    ├── alertas/route.ts
    ├── alertas/[id]/route.ts
    ├── apuracoes/route.ts
    ├── planejamento/route.ts
    └── obrigacoes/route.ts

lib/
├── supabase/client.ts
├── supabase/server.ts
├── rules/types.ts
├── rules/engine.ts
├── rules/executores/icms.ts
├── rules/executores/pis_cofins.ts
├── rules/executores/cfop.ts
├── rules/executores/ncm.ts
└── types.ts

middleware.ts
supabase_setup.sql
```

---

## Banco de Dados

Arquivo `supabase_setup.sql` contém DDL completo para:

- `empresas` — cadastro de empresas auditadas
- `fa_sessoes_analise` — agrupa arquivos por empresa+período
- `fa_arquivos_sped` — metadados + resultado parseado do SPED
- `fa_arquivos_xml` — metadados + resultado parseado de NF-e
- `fa_apuracoes_icms` — resultado E110
- `fa_apuracoes_contrib` — resultado M200/M600
- `fa_regras_fiscais` — catálogo de regras com seed inicial
- `fa_alertas` — alertas gerados pelo motor
- `fa_obrigacoes_acessorias` — controle de entrega de obrigações
- `fa_planejamento_tributario` — simulações salvas

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

### Fase 3 — Simples Nacional (Fase 2) — Confronto com NF-e (próximo)

- [ ] Aba "Confronto NF-e" na página `/simples_nacional`
- [ ] Somar `valor_total` das NF-e de saída do Validador para o mesmo período
- [ ] Comparar com `receita_bruta_mes` do PGDAS — alerta se diferença > 1%
- [ ] Identificar notas não consideradas na apuração

### Fase 4 — Simples Nacional (Fase 3) — Simulação via XML

- [ ] Buscar XMLs do banco (`fa_arquivos_xml`) para o período
- [ ] Aplicar tabelas dos Anexos I–V conforme CNAE da empresa
- [ ] Calcular alíquota efetiva pela RBT12
- [ ] Gerar breakdown simulado de tributos
- [ ] Comparar com PGDAS declarado — destacar diferenças

### Fase 5 — Persistência NF-e + Cruzamento SPED × NF-e

- [ ] Salvar `parsed_data` do Validador NF-e no banco (`fa_arquivos_xml`)
- [ ] Restaurar estado ao recarregar (GET + PATCH `/api/arquivos-xml`)
- [ ] Cruzamento SPED × NF-e: verificar se todos os XMLs do período estão no SPED
- [ ] Exportação Excel no Auditor SPED
- [ ] Regras UC_COM_CREDITO, IMOB_SEM_CIAP, CONTRIB_EXCLUSAO_INDEVIDA, NCM_ST_SEM_TRATAMENTO

### Fase 6 — Inteligência (12+ semanas)

- [ ] Simulador de planejamento tributário (Simples × Presumido × Real)
- [ ] Calendário de obrigações com detecção automática
- [ ] Recomendações via API de IA
- [ ] Análise de tendência multi-período
- [ ] Suporte a IBS/CBS (Reforma Tributária EC 132/2023)
- [ ] Link de compartilhamento somente-leitura com cliente
