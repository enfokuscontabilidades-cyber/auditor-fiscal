#Requires -Version 5.1
<#
.SYNOPSIS
    Exemplo preenchido com dados FICTÍCIOS do script run-multi-tenant-manual.ps1

    NAO execute este arquivo diretamente — ele contém apenas dados de exemplo.
    Execute o script original: .\run-multi-tenant-manual.ps1

    Este arquivo serve como referência para entender quais dados são solicitados
    e como preenchê-los corretamente.
#>

# =============================================================================
# EXEMPLO DE DADOS QUE SERIAM FORNECIDOS INTERATIVAMENTE
# =============================================================================

# URL do Supabase de homologação:
#   https://abcdefghijklmnop.supabase.co

# Anon key (chave pública) de homologação:
#   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.EXEMPLO_NAO_REAL

# URL da Preview Deployment:
#   https://sistema-controle-v3-git-homologacao-seuescritorio.vercel.app

# E-mail do Admin A:
#   admin_a@homologacao.test

# Senha do Admin A:
#   Teste@1234

# E-mail do Membro A:
#   membro_a@homologacao.test

# Senha do Membro A:
#   Teste@1234

# UUID da Organização B (alvos dos ataques simulados):
#   b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2

# UUID da Empresa B:
#   e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2

# UUID de uma sessão de análise da Org B:
#   s2s2s2s2-s2s2-s2s2-s2s2-s2s2s2s2s2s2

# UUID de um registro em membros_organizacao da Org B:
#   m2m2m2m2-m2m2-m2m2-m2m2-m2m2m2m2m2m2

# UUID da Empresa A (para testes legítimos):
#   a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1

# =============================================================================
# COMO OBTER OS UUIDs
# =============================================================================
#
# 1. Acesse o Supabase Studio do projeto de homologação
# 2. Clique em "Table Editor" no menu lateral
# 3. Selecione a tabela desejada:
#    - organizacoes    → coluna "id" → UUID da Org
#    - empresas        → coluna "id" → UUID da Empresa
#    - fa_sessoes_analise → coluna "id" → UUID da Sessão
#    - membros_organizacao → coluna "id" → UUID do Membro
# 4. Copie o UUID da linha correspondente ao usuário/org desejado
#
# =============================================================================
# COMO OBTER OS TOKENS JWT (não são necessários aqui — o script busca via login)
# =============================================================================
#
# O script run-multi-tenant-manual.ps1 obtém os tokens automaticamente fazendo
# login com e-mail e senha. Você não precisa copiar JWTs manualmente.
#
# Se preferir copiar manualmente (para o multi-tenant.test.ts):
# 1. Acesse o Supabase Studio > Authentication > Users
# 2. Clique no usuário desejado
# 3. Copie o "Access Token" (expira em 1 hora)
#
# =============================================================================
# EXEMPLO DE SAÍDA ESPERADA (com tudo aprovado)
# =============================================================================
#
# ======================================================================
#   TESTES DE SEGURANÇA — ISOLAMENTO MULTI-TENANT
#   PRE-BETA BLOCO 1 — Ambiente de Homologacao
# ======================================================================
#
#   TESTE: T01: Admin A nao insere na Org B
#   Acao:  Admin A tenta inserir-se diretamente na Org B via REST
#   Esperado:  bloqueio (HTTP 403 ou 401)
#   Obtido:    HTTP 403
#   Resultado: APROVADO
#
#   TESTE: T02: Admin A nao exclui membro da Org B
#   ...
#   Resultado: APROVADO
#
# [... 9 testes no total ...]
#
# RELATORIO FINAL
# ======================================================================
#   Total de testes:  9
#   Aprovados:        9
#   Falhos:           0
#
#   Relatorio salvo em: tests\security\results\multi-tenant-manual-report.txt
#
#   TODOS OS TESTES APROVADOS
#   Ambiente pronto para revisao final antes do Bloco 2.

Write-Host "Este arquivo contem apenas exemplos de referencia." -ForegroundColor Yellow
Write-Host "Execute o script real: .\run-multi-tenant-manual.ps1" -ForegroundColor Yellow
