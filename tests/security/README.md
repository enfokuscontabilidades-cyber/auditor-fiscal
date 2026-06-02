# Testes de Segurança — Isolamento Multi-Tenant

## Visão Geral

Esta pasta contém a suíte de testes automatizados e o script guiado para validar
o isolamento entre organizações (multi-tenancy) da plataforma.

**Runner utilizado:** Vitest (via `npx vitest`) ou Jest (`npx jest`)

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `multi-tenant.test.ts` | Suíte automatizada de 20+ testes via fetch para a API Next.js |
| `run-multi-tenant-manual.ps1` | Script PowerShell interativo para execução manual no Windows |
| `run-multi-tenant-manual.example.ps1` | Exemplo preenchido com dados fictícios (para referência) |
| `results/` | Relatórios gerados pelas execuções (ignorado pelo git) |

## Pré-requisitos

1. **Banco de homologação configurado** (ver `docs/HOMOLOGACAO_SUPABASE_PASSO_A_PASSO.md`)
2. **Preview Deployment da Vercel rodando** (ver `docs/HOMOLOGACAO_VERCEL_PASSO_A_PASSO.md`)
3. **Usuários fictícios criados** (ver `docs/HOMOLOGACAO_TESTES_VISUAIS.md`)

## Suíte Automatizada (`multi-tenant.test.ts`)

### Configuração

Crie o arquivo `.env.test` na raiz do projeto (nunca comitar):

```env
NEXT_PUBLIC_APP_URL=https://SUA-PREVIEW.vercel.app
TOKEN_ADMIN_A=eyJhbGciOiJIUzI1NiJ9...   # JWT do admin_a@test.com
TOKEN_MEMBRO_A=eyJhbGciOiJIUzI1NiJ9...  # JWT do membro_a@test.com
TOKEN_ADMIN_B=eyJhbGciOiJIUzI1NiJ9...   # JWT do admin_b@test.com
EMPRESA_A_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
EMPRESA_B_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SESSAO_A_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SESSAO_B_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MEMBRO_A_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MEMBRO_B_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Obter JWTs

No Supabase Studio do projeto de homologação:

1. Acesse **Authentication > Users**
2. Clique no usuário desejado
3. Copie o **Access Token** (válido por 1 hora — você precisa de um token recente)

Alternativamente, na Preview Deployment:
1. Abra o DevTools (F12) > Aba Application > Cookies
2. Copie o valor do cookie `sb-PROJETO-auth-token`

### Execução

```bash
# Com Vitest (recomendado)
npx vitest tests/security/multi-tenant.test.ts --reporter=verbose

# Com Jest
npx jest tests/security/multi-tenant.test.ts --verbose
```

## Script Manual (`run-multi-tenant-manual.ps1`)

Execute no PowerShell do Windows:

```powershell
cd C:\caminho\para\sistema-controle-V3
.\tests\security\run-multi-tenant-manual.ps1
```

O script perguntará interativamente todas as informações necessárias e
gerará um relatório em `tests/security/results/multi-tenant-manual-report.txt`.

## O que é testado

### Suíte Automatizada
- **Grupo 1 — Leitura**: Admin A não acessa dados da Org B
- **Grupo 2 — Escrita (POST)**: Admin A não injeta registros com empresa/sessão da Org B
- **Grupo 3 — Deleção (DELETE)**: Admin A não exclui dados da Org B
- **Grupo 4 — Controle de membros**: Membro comum não gerencia membros; sem auth → 401
- **Grupo 5 — Fluxos legítimos**: Operações válidas continuam funcionando

### Script Manual (Supabase REST direto)
- INSERT direto em `membros_organizacao` com org_id errado → 403
- DELETE em `membros_organizacao` de outra org → 403
- INSERT em `fa_regras_fiscais` (tabela protegida) → 403
- INSERT em `fa_sessoes_analise` com org_id de outra org → 403

## Interpretação dos Resultados

- **APROVADO**: O sistema bloqueou corretamente a ação indevida
- **FALHOU**: A ação indevida foi aceita — FALHA DE SEGURANÇA, não aplicar em produção
- **FALHA CRÍTICA**: O script interrompeu porque dados foram alterados indevidamente

## Atenção

- Execute APENAS no ambiente de homologação (banco separado)
- Nunca use service_role_key para simular ataques de usuários comuns
- Os testes podem criar registros temporários — verifique o relatório para limpeza
