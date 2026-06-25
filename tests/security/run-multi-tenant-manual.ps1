#Requires -Version 5.1
<#
.SYNOPSIS
    Script de testes manuais de isolamento multi-tenant — PRÉ-BETA BLOCO 1
.DESCRIPTION
    Realiza chamadas à API REST do Supabase e à API Next.js para verificar
    se o isolamento entre organizações está funcionando corretamente.

    IMPORTANTE:
    - Execute APENAS no ambiente de homologação
    - Nunca use service_role_key neste script
    - Dados fictícios apenas
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# =============================================================================
# CONFIGURAÇÃO — COLETA INTERATIVA DE DADOS
# =============================================================================

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  TESTES DE SEGURANÇA — ISOLAMENTO MULTI-TENANT" -ForegroundColor Cyan
Write-Host "  PRE-BETA BLOCO 1 — Ambiente de Homologacao" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este script realiza testes de segurança no banco de HOMOLOGACAO." -ForegroundColor Yellow
Write-Host "Execute APENAS na Preview URL da Vercel com o banco de homologacao." -ForegroundColor Yellow
Write-Host ""

# Verificação de segurança
$confirm = Read-Host "Confirma que esta testando no ambiente de HOMOLOGACAO? (s/N)"
if ($confirm -ne 's' -and $confirm -ne 'S') {
    Write-Host "Execucao cancelada pelo usuario." -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "----------------------------------------------------------------------"
Write-Host "DADOS DO AMBIENTE DE HOMOLOGACAO"
Write-Host "----------------------------------------------------------------------"
Write-Host "Informe os dados do projeto Supabase de HOMOLOGACAO."
Write-Host "Nao use chaves de producao."
Write-Host ""

$SUPABASE_URL   = Read-Host "URL do Supabase de homologacao (ex: https://XXXX.supabase.co)"
$ANON_KEY       = Read-Host "Anon key (chave publica) de homologacao"
$APP_URL        = Read-Host "URL da Preview Deployment (ex: https://sistema-controle-v3-git-homologacao-XXX.vercel.app)"

Write-Host ""
Write-Host "----------------------------------------------------------------------"
Write-Host "CREDENCIAIS DOS USUARIOS FICTICIOSS (Admin A — Organizacao A)"
Write-Host "----------------------------------------------------------------------"
$EMAIL_ADMIN_A  = Read-Host "E-mail do Admin A (ex: admin_a@homologacao.test)"
$SENHA_ADMIN_A  = Read-Host "Senha do Admin A"

Write-Host ""
Write-Host "----------------------------------------------------------------------"
Write-Host "CREDENCIAIS — Membro A (membro comum da Organizacao A)"
Write-Host "----------------------------------------------------------------------"
$EMAIL_MEMBRO_A = Read-Host "E-mail do Membro A (ex: membro_a@homologacao.test)"
$SENHA_MEMBRO_A = Read-Host "Senha do Membro A"

Write-Host ""
Write-Host "----------------------------------------------------------------------"
Write-Host "IDs DA ORGANIZACAO B (alvos dos testes de tentativa de acesso)"
Write-Host "Obtenha esses UUIDs no Supabase Studio > Table Editor"
Write-Host "----------------------------------------------------------------------"
$ORG_B_ID      = Read-Host "UUID da Organizacao B"
$EMPRESA_B_ID  = Read-Host "UUID da Empresa B"
$SESSAO_B_ID   = Read-Host "UUID de uma sessao de analise da Org B"
$MEMBRO_B_ID   = Read-Host "UUID de um registro em membros_organizacao da Org B"

Write-Host ""
Write-Host "----------------------------------------------------------------------"
Write-Host "ID DA PROPRIA ORGANIZACAO (para testes de fluxo legitimo)"
Write-Host "----------------------------------------------------------------------"
$EMPRESA_A_ID  = Read-Host "UUID da Empresa A (da Org A)"

# =============================================================================
# FUNÇÕES AUXILIARES
# =============================================================================

$resultados = [System.Collections.Generic.List[hashtable]]::new()
$falha_critica = $false

function Invoke-TesteSupabase {
    param(
        [string]$NomeTeste,
        [string]$Descricao,
        [string]$ResultadoEsperado,
        [string]$Metodo,
        [string]$Endpoint,
        [string]$Token,
        [hashtable]$Body = $null
    )

    Write-Host ""
    Write-Host "  TESTE: $NomeTeste" -ForegroundColor Cyan
    Write-Host "  Acao:  $Descricao"

    $headers = @{
        'apikey'        = $ANON_KEY
        'Authorization' = "Bearer $Token"
        'Content-Type'  = 'application/json'
        'Prefer'        = 'return=minimal'
    }

    $statusCode = $null
    $resposta   = $null

    try {
        $params = @{
            Method  = $Metodo
            Uri     = "$SUPABASE_URL/rest/v1/$Endpoint"
            Headers = $headers
        }
        if ($null -ne $Body) {
            $params.Body = ($Body | ConvertTo-Json -Compress)
        }

        $response  = Invoke-WebRequest @params -SkipHttpErrorCheck
        $statusCode = $response.StatusCode
        $resposta   = $response.Content
    }
    catch {
        $statusCode = 0
        $resposta   = $_.Exception.Message
    }

    $passou = ($statusCode -eq 403) -or ($statusCode -eq 401)
    if ($ResultadoEsperado -eq 'bloqueio') {
        $passou = ($statusCode -eq 403) -or ($statusCode -eq 401)
    }
    elseif ($ResultadoEsperado -eq '200_vazio') {
        $passou = ($statusCode -eq 200 -and $resposta -eq '[]') -or ($statusCode -eq 403)
    }
    elseif ($ResultadoEsperado -eq 'sucesso') {
        $passou = ($statusCode -ge 200 -and $statusCode -lt 300)
    }

    $resultado = if ($passou) { 'APROVADO' } else { 'FALHOU' }
    $cor       = if ($passou) { 'Green' } else { 'Red' }

    Write-Host "  Esperado:  $ResultadoEsperado (HTTP 403 ou 401)"
    Write-Host "  Obtido:    HTTP $statusCode"
    Write-Host "  Resultado: $resultado" -ForegroundColor $cor

    $resultados.Add(@{
        Teste    = $NomeTeste
        Acao     = $Descricao
        Esperado = $ResultadoEsperado
        Status   = $statusCode
        Resultado = $resultado
    })

    if (-not $passou -and $ResultadoEsperado -eq 'bloqueio') {
        Write-Host ""
        Write-Host "  !!! FALHA CRITICA detectada !!!" -ForegroundColor Red -BackgroundColor DarkRed
        Write-Host "  Dados podem ter sido modificados indevidamente." -ForegroundColor Red
        $script:falha_critica = $true
    }

    return $passou
}

function Invoke-TesteAPI {
    param(
        [string]$NomeTeste,
        [string]$Descricao,
        [string]$Metodo,
        [string]$Path,
        [string]$Token,
        [hashtable]$Body = $null
    )

    Write-Host ""
    Write-Host "  TESTE: $NomeTeste" -ForegroundColor Cyan
    Write-Host "  Acao:  $Descricao"

    $headers = @{
        'Content-Type' = 'application/json'
        'Cookie'       = "sb-access-token=$Token"
    }

    $statusCode = $null

    try {
        $params = @{
            Method  = $Metodo
            Uri     = "$APP_URL$Path"
            Headers = $headers
        }
        if ($null -ne $Body) {
            $params.Body = ($Body | ConvertTo-Json -Compress)
        }

        $response  = Invoke-WebRequest @params -SkipHttpErrorCheck
        $statusCode = $response.StatusCode
    }
    catch {
        $statusCode = 0
    }

    $passou    = ($statusCode -eq 403) -or ($statusCode -eq 401)
    $resultado = if ($passou) { 'APROVADO' } else { 'FALHOU' }
    $cor       = if ($passou) { 'Green' } else { 'Red' }

    Write-Host "  Esperado:  HTTP 403 ou 401"
    Write-Host "  Obtido:    HTTP $statusCode"
    Write-Host "  Resultado: $resultado" -ForegroundColor $cor

    $resultados.Add(@{
        Teste    = $NomeTeste
        Acao     = $Descricao
        Esperado = 'HTTP 403 ou 401'
        Status   = $statusCode
        Resultado = $resultado
    })

    if (-not $passou) {
        $script:falha_critica = $true
        Write-Host ""
        Write-Host "  !!! FALHA CRITICA detectada !!!" -ForegroundColor Red -BackgroundColor DarkRed
    }

    return $passou
}

# =============================================================================
# AUTENTICAÇÃO — OBTER TOKENS
# =============================================================================

Write-Host ""
Write-Host "======================================================================"
Write-Host "ETAPA 1 — AUTENTICANDO USUARIOS"
Write-Host "======================================================================"

function Get-SupabaseToken {
    param([string]$Email, [string]$Senha)
    $body = @{ email = $Email; password = $Senha } | ConvertTo-Json
    try {
        $resp = Invoke-RestMethod `
            -Method POST `
            -Uri "$SUPABASE_URL/auth/v1/token?grant_type=password" `
            -Headers @{ 'apikey' = $ANON_KEY; 'Content-Type' = 'application/json' } `
            -Body $body
        return $resp.access_token
    }
    catch {
        Write-Host "  ERRO ao autenticar $Email : $_" -ForegroundColor Red
        return $null
    }
}

Write-Host ""
Write-Host "  Autenticando Admin A..." -NoNewline
$TOKEN_ADMIN_A = Get-SupabaseToken -Email $EMAIL_ADMIN_A -Senha $SENHA_ADMIN_A
if ($TOKEN_ADMIN_A) { Write-Host " OK" -ForegroundColor Green } else { Write-Host " FALHOU" -ForegroundColor Red; exit 1 }

Write-Host "  Autenticando Membro A..." -NoNewline
$TOKEN_MEMBRO_A = Get-SupabaseToken -Email $EMAIL_MEMBRO_A -Senha $SENHA_MEMBRO_A
if ($TOKEN_MEMBRO_A) { Write-Host " OK" -ForegroundColor Green } else { Write-Host " FALHOU" -ForegroundColor Red; exit 1 }

# =============================================================================
# GRUPO 1 — INSERT direto em membros_organizacao (RLS Supabase REST)
# =============================================================================

Write-Host ""
Write-Host "======================================================================"
Write-Host "GRUPO 1 — Protecao de membros_organizacao (Supabase REST direto)"
Write-Host "======================================================================"

Invoke-TesteSupabase `
    -NomeTeste "T01: Admin A nao insere na Org B" `
    -Descricao "Admin A tenta inserir-se diretamente na Org B via REST" `
    -ResultadoEsperado "bloqueio" `
    -Metodo "POST" `
    -Endpoint "membros_organizacao" `
    -Token $TOKEN_ADMIN_A `
    -Body @{ org_id = $ORG_B_ID; user_id = "00000000-0000-0000-0000-000000000001"; papel = "membro" }

if ($falha_critica) {
    Write-Host ""
    Write-Host "FALHA CRITICA — NÃO APLICAR EM PRODUCAO" -ForegroundColor White -BackgroundColor Red
    Write-Host "Interrompendo execucao. Verifique manualmente se dados foram inseridos." -ForegroundColor Red
    exit 2
}

Invoke-TesteSupabase `
    -NomeTeste "T02: Admin A nao exclui membro da Org B" `
    -Descricao "Admin A tenta deletar membro B via REST" `
    -ResultadoEsperado "bloqueio" `
    -Metodo "DELETE" `
    -Endpoint "membros_organizacao?id=eq.$MEMBRO_B_ID" `
    -Token $TOKEN_ADMIN_A

if ($falha_critica) {
    Write-Host ""
    Write-Host "FALHA CRITICA — NÃO APLICAR EM PRODUCAO" -ForegroundColor White -BackgroundColor Red
    exit 2
}

# =============================================================================
# GRUPO 2 — Controle de membros por papel (Membro comum)
# =============================================================================

Write-Host ""
Write-Host "======================================================================"
Write-Host "GRUPO 2 — Membro comum nao gerencia membros"
Write-Host "======================================================================"

Invoke-TesteSupabase `
    -NomeTeste "T03: Membro A nao insere membro" `
    -Descricao "Membro comum A tenta inserir membro via REST" `
    -ResultadoEsperado "bloqueio" `
    -Metodo "POST" `
    -Endpoint "membros_organizacao" `
    -Token $TOKEN_MEMBRO_A `
    -Body @{ org_id = "00000000-0000-0000-0000-000000000099"; user_id = "00000000-0000-0000-0000-000000000002"; papel = "membro" }

Invoke-TesteSupabase `
    -NomeTeste "T04: Membro A nao exclui membro" `
    -Descricao "Membro comum A tenta deletar membro via REST" `
    -ResultadoEsperado "bloqueio" `
    -Metodo "DELETE" `
    -Endpoint "membros_organizacao?id=eq.$MEMBRO_B_ID" `
    -Token $TOKEN_MEMBRO_A

# =============================================================================
# GRUPO 3 — Proteção de fa_regras_fiscais
# =============================================================================

Write-Host ""
Write-Host "======================================================================"
Write-Host "GRUPO 3 — fa_regras_fiscais protegida contra escrita"
Write-Host "======================================================================"

Invoke-TesteSupabase `
    -NomeTeste "T05: Usuario nao altera fa_regras_fiscais" `
    -Descricao "Admin A tenta inserir regra fiscal via REST" `
    -ResultadoEsperado "bloqueio" `
    -Metodo "POST" `
    -Endpoint "fa_regras_fiscais" `
    -Token $TOKEN_ADMIN_A `
    -Body @{ codigo = "REGRA_FAKE"; categoria = "icms"; titulo = "Regra falsa de teste"; nivel_risco = "alto"; descricao = "Teste de segurança" }

# =============================================================================
# GRUPO 4 — API Next.js (cross-org via headers de autenticação)
# =============================================================================

Write-Host ""
Write-Host "======================================================================"
Write-Host "GRUPO 4 — API Next.js: bloqueio cross-org"
Write-Host "======================================================================"

Invoke-TesteAPI `
    -NomeTeste "T06: Admin A nao cria sessao com Empresa B" `
    -Descricao "Admin A tenta criar sessao com empresa_id da Org B via API Next.js" `
    -Metodo "POST" `
    -Path "/api/sessoes" `
    -Token $TOKEN_ADMIN_A `
    -Body @{ empresa_id = $EMPRESA_B_ID; competencia = "01/2025" }

if ($falha_critica) {
    Write-Host ""
    Write-Host "FALHA CRITICA — NÃO APLICAR EM PRODUCAO" -ForegroundColor White -BackgroundColor Red
    exit 2
}

Invoke-TesteAPI `
    -NomeTeste "T07: Admin A nao consulta periodos da Empresa B" `
    -Descricao "Admin A tenta GET periodos-importados com empresa_id da Org B" `
    -Metodo "GET" `
    -Path "/api/fiscal/periodos-importados?empresa_id=$EMPRESA_B_ID" `
    -Token $TOKEN_ADMIN_A

Invoke-TesteAPI `
    -NomeTeste "T08: Admin A nao apaga competencia da Empresa B" `
    -Descricao "Admin A tenta DELETE limpar-competencia com empresa_id da Org B" `
    -Metodo "DELETE" `
    -Path "/api/fiscal/limpar-competencia?empresa_id=$EMPRESA_B_ID&competencia=01/2025" `
    -Token $TOKEN_ADMIN_A

if ($falha_critica) {
    Write-Host ""
    Write-Host "FALHA CRITICA — NÃO APLICAR EM PRODUCAO" -ForegroundColor White -BackgroundColor Red
    exit 2
}

# =============================================================================
# GRUPO 5 — Sem autenticação
# =============================================================================

Write-Host ""
Write-Host "======================================================================"
Write-Host "GRUPO 5 — Chamadas sem autenticacao retornam 401"
Write-Host "======================================================================"

$rotasProtegidas = @(
    @{ Metodo = 'GET';    Path = '/api/empresas' }
    @{ Metodo = 'POST';   Path = '/api/sessoes' }
    @{ Metodo = 'DELETE'; Path = "/api/fiscal/limpar-competencia?empresa_id=$EMPRESA_A_ID&competencia=01/2025" }
    @{ Metodo = 'POST';   Path = '/api/alertas' }
)

$t09_passou = $true
foreach ($rota in $rotasProtegidas) {
    try {
        $resp = Invoke-WebRequest -Method $rota.Metodo -Uri "$APP_URL$($rota.Path)" -SkipHttpErrorCheck
        if ($resp.StatusCode -ne 401) {
            $t09_passou = $false
            Write-Host "  FALHA em $($rota.Metodo) $($rota.Path) — obteve HTTP $($resp.StatusCode)" -ForegroundColor Red
        }
    }
    catch { $t09_passou = $false }
}

$resultado_t09 = if ($t09_passou) { 'APROVADO' } else { 'FALHOU' }
$cor_t09 = if ($t09_passou) { 'Green' } else { 'Red' }

Write-Host ""
Write-Host "  TESTE: T09: Chamadas sem autenticacao retornam 401"
Write-Host "  Resultado: $resultado_t09" -ForegroundColor $cor_t09

$resultados.Add(@{
    Teste    = 'T09: Sem autenticacao'
    Acao     = 'GET/POST/DELETE em rotas protegidas sem token'
    Esperado = 'HTTP 401 em todas'
    Status   = 'variado'
    Resultado = $resultado_t09
})

# =============================================================================
# RELATÓRIO FINAL
# =============================================================================

Write-Host ""
Write-Host "======================================================================"
Write-Host "RELATORIO FINAL"
Write-Host "======================================================================"

$aprovados = ($resultados | Where-Object { $_.Resultado -eq 'APROVADO' }).Count
$falhos    = ($resultados | Where-Object { $_.Resultado -eq 'FALHOU' }).Count
$total     = $resultados.Count

Write-Host ""
Write-Host "  Total de testes:  $total"
Write-Host "  Aprovados:        $aprovados" -ForegroundColor Green
Write-Host "  Falhos:           $falhos" -ForegroundColor (if ($falhos -eq 0) { 'Green' } else { 'Red' })
Write-Host ""

# Gerar arquivo de relatório
$resultsDir = Join-Path $PSScriptRoot "results"
if (-not (Test-Path $resultsDir)) { New-Item -ItemType Directory -Path $resultsDir | Out-Null }
$reportPath = Join-Path $resultsDir "multi-tenant-manual-report.txt"

$linhas = [System.Collections.Generic.List[string]]::new()
$linhas.Add("RELATORIO DE TESTES — ISOLAMENTO MULTI-TENANT")
$linhas.Add("Data: $(Get-Date -Format 'dd/MM/yyyy HH:mm')")
$linhas.Add("Preview URL: $APP_URL")
$linhas.Add("Supabase URL: $SUPABASE_URL")
$linhas.Add("")
$linhas.Add("Total: $total | Aprovados: $aprovados | Falhos: $falhos")
$linhas.Add("")
$linhas.Add(("{0,-50} {1,-10} {2,-8}" -f "TESTE", "HTTP", "RESULTADO"))
$linhas.Add("-" * 75)

foreach ($r in $resultados) {
    $linhas.Add(("{0,-50} {1,-10} {2,-8}" -f $r.Teste, $r.Status, $r.Resultado))
}

if ($falha_critica) {
    $linhas.Add("")
    $linhas.Add("!!! FALHA CRITICA DETECTADA — NAO APLICAR EM PRODUCAO !!!")
}

$linhas | Out-File -FilePath $reportPath -Encoding UTF8

Write-Host "  Relatorio salvo em: $reportPath" -ForegroundColor Cyan

if ($falha_critica) {
    Write-Host ""
    Write-Host "  FALHA CRITICA — NAO APLICAR EM PRODUCAO" -ForegroundColor White -BackgroundColor Red
    Write-Host "  Corrija as falhas antes de avancar para o Bloco 2." -ForegroundColor Red
    exit 2
}
elseif ($falhos -eq 0) {
    Write-Host ""
    Write-Host "  TODOS OS TESTES APROVADOS" -ForegroundColor Green
    Write-Host "  Ambiente pronto para revisao final antes do Bloco 2." -ForegroundColor Green
    exit 0
}
else {
    Write-Host ""
    Write-Host "  Existem $falhos teste(s) com falha. Revise antes de prosseguir." -ForegroundColor Yellow
    exit 1
}
