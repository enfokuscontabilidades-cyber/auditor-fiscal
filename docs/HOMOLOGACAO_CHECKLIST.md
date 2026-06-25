# Checklist de Homologação — PRÉ-BETA BLOCO 1

## Instruções

Marque cada item com [x] após validar. Registre a data e o responsável ao final.

---

## BLOCO A — Preparação do Ambiente

- [ ] Projeto Supabase de homologação criado com nome `sistema-controle-homologacao`
- [ ] SQL principal (`supabase_setup.sql`) executado sem erros
- [ ] Migration Fase A (`supabase_migration_fase_a.sql`) executada sem erros
- [ ] Migration CNPJ cache (`supabase_migration_cnpj_cache.sql`) executada sem erros
- [ ] Migration PRÉ-BETA RLS (`supabase_migration_pre_beta_rls.sql`) executada sem erros
- [ ] Consultas de verificação (`HOMOLOGACAO_SQL_VERIFICACAO.sql`) executadas e aprovadas
- [ ] Variáveis de ambiente configuradas na Vercel para Preview (branch `homologacao`)
- [ ] Push realizado na branch `homologacao`
- [ ] Preview Deployment da Vercel acessível
- [ ] Faixa laranja de homologação visível no topo do sistema
- [ ] Usuários fictícios criados (admin_a, membro_a, admin_b, membro_b)
- [ ] Organizações fictícias criadas (Org A e Org B)
- [ ] Empresas fictícias criadas (Empresa A e Empresa B)
- [ ] Sessões de análise criadas para ambas as organizações

---

## BLOCO B — Testes Automáticos

- [ ] Arquivo `.env.test` criado com tokens e IDs dos usuários fictícios
- [ ] Suíte `multi-tenant.test.ts` executada via `npx vitest` ou `npx jest`
- [ ] **Grupo 1 (Leitura)**: todos os 5 testes passaram
- [ ] **Grupo 2 (Escrita/POST)**: todos os 9 testes passaram
- [ ] **Grupo 3 (Deleção/DELETE)**: 1 teste passou
- [ ] **Grupo 4 (Membros/Auth)**: todos os 3 testes passaram
- [ ] **Grupo 5 (Fluxos legítimos)**: todos os 3 testes passaram
- [ ] Zero falhas críticas reportadas

---

## BLOCO C — Script PowerShell Manual

- [ ] Script `run-multi-tenant-manual.ps1` executado no Windows PowerShell
- [ ] T01: Admin A não se insere na Org B → APROVADO
- [ ] T02: Admin A não exclui membro da Org B → APROVADO
- [ ] T03: Membro comum A não insere membro → APROVADO
- [ ] T04: Membro comum A não exclui membro → APROVADO
- [ ] T05: Usuário autenticado não altera `fa_regras_fiscais` → APROVADO
- [ ] T06: Admin A não insere sessão com Empresa B → APROVADO
- [ ] T07: Admin A não consulta períodos da Empresa B via API → APROVADO
- [ ] T08: Admin A não apaga competência da Empresa B → APROVADO
- [ ] T09: Chamada sem autenticação retorna 401 → APROVADO
- [ ] Relatório gerado em `tests/security/results/multi-tenant-manual-report.txt`

---

## BLOCO D — Testes Visuais (Interface)

- [ ] Admin A não visualiza empresas da Org B no painel
- [ ] Admin A não visualiza membros da Org B em Configurações
- [ ] Membro A não vê botões de "Convidar" ou "Excluir membro"
- [ ] Admin A consegue convidar e excluir membros da Org A
- [ ] Importação de XML funciona normalmente na Org A
- [ ] Importação de SPED funciona normalmente na Org A
- [ ] Limpeza de competência funciona somente na Org A
- [ ] Relatórios carregam para empresas da Org A
- [ ] Tela de aguardando-ativação aparece para org com plano='pendente'

---

## BLOCO E — Testes Manuais Supabase REST

Execute os testes T-M-01 a T-M-05 descritos em `tests/security/multi-tenant.test.ts` (seção TESTES MANUAIS).

- [ ] T-M-01: INSERT em membros_organizacao com org_id errado → 403
- [ ] T-M-02: DELETE em membros_organizacao de outra org → 403
- [ ] T-M-03: INSERT em fa_regras_fiscais → 403
- [ ] T-M-04: INSERT em fa_sessoes_analise com org_id errado → 403
- [ ] T-M-05: INSERT em fa_sessoes_analise com empresa_id de outra org (documentado como limitação da camada API)

---

## RESULTADO FINAL

| Bloco | Total de Itens | Aprovados | Reprovados |
|-------|---------------|-----------|-----------|
| A — Preparação | 14 | | |
| B — Automáticos | 19 | | |
| C — PowerShell | 10 | | |
| D — Visual | 9 | | |
| E — REST Manual | 5 | | |
| **TOTAL** | **57** | | |

**Data de execução:** ___/___/______
**Responsável:** _________________________________
**Aprovado para PRÉ-BETA BLOCO 2:** [ ] SIM [ ] NÃO

**Observações:**

```
(escreva aqui qualquer divergência, limitação conhecida ou item que precisa de atenção)
```
