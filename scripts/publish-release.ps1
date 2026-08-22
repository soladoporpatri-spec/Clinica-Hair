<#
.SYNOPSIS
    Gera o pacote cliente, injeta a versao e publica no GitHub Releases.

.EXAMPLE
    .\scripts\publish-release.ps1 -Version "v2.1.0"

.NOTES
    Prerequisito: gh CLI instalado e autenticado (https://cli.github.com)
    Ou crie a release manualmente no GitHub e faca upload do ZIP gerado.
#>
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^v\d+\.\d+\.\d+$')]
    [string]$Version   # ex: "v2.1.0"
)

$ErrorActionPreference = "Stop"
$root        = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseRoot = Join-Path $root "release"

Write-Host ""
Write-Host "======================================================"
Write-Host "  NYTHAR - DASHBOARD & CHATBOT - PUBLICAR RELEASE $Version"
Write-Host "======================================================"
Write-Host ""

# ── Validar config\updater.cfg ─────────────────────────
$updaterCfg = Join-Path $root "config\updater.cfg"
if (!(Test-Path $updaterCfg)) {
    throw "config\updater.cfg nao encontrado. Crie e configure antes de publicar."
}
$githubRepo = ""
foreach ($line in (Get-Content $updaterCfg)) {
    if ($line -match "^GITHUB_REPO=(.+)") { $githubRepo = $Matches[1].Trim() }
}
if (!$githubRepo -or $githubRepo -match "SEU_USUARIO") {
    throw "Preencha GITHUB_REPO em config\updater.cfg antes de publicar."
}
Write-Host "  Repositorio : $githubRepo"
Write-Host "  Versao      : $Version"
Write-Host ""

# ── [1/4] Build do pacote cliente ─────────────────────
Write-Host "[1/4] Gerando pacote cliente (build-release-cliente.ps1)..."
& (Join-Path $PSScriptRoot "build-release-cliente.ps1") -Version $Version
Write-Host ""

# ── [2/4] Localizar ZIP gerado ────────────────────────
Write-Host "[2/4] Localizando ZIP gerado..."
$latestZip = Get-ChildItem (Join-Path $releaseRoot "NytharDashboard-Cliente-*.zip") |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (!$latestZip) { throw "Nenhum ZIP encontrado em $releaseRoot" }

# Copiar para nome fixo (asset do GitHub)
$releaseZip = Join-Path $releaseRoot "NytharDashboard.zip"
Copy-Item $latestZip.FullName $releaseZip -Force

$sizeMB = [math]::Round((Get-Item $releaseZip).Length / 1MB, 1)
Write-Host "  ZIP pronto : NytharDashboard.zip ($sizeMB MB)"
Write-Host ""

# ── [3/4] Verificar gh CLI ────────────────────────────
Write-Host "[3/4] Verificando gh CLI..."

# Busca gh no PATH e tambem nos caminhos padrao de instalacao do Windows
$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
$ghExe = if ($ghCmd) { $ghCmd.Source } else { $null }
if (!$ghExe) {
    $candidates = @(
        "C:\Program Files\GitHub CLI\gh.exe",
        "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe",
        "$env:ProgramFiles\GitHub CLI\gh.exe"
    )
    $ghExe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($ghExe) { Write-Host "  gh encontrado em: $ghExe" }
}
$ghAvailable = $null -ne $ghExe

if (!$ghAvailable) {
    Write-Host ""
    Write-Host "  ATENCAO: gh CLI nao encontrado."
    Write-Host "  Instale em: https://cli.github.com"
    Write-Host ""
    Write-Host "  Para publicar manualmente:"
    Write-Host "  1. Acesse: https://github.com/$githubRepo/releases/new"
    Write-Host "  2. Tag   : $Version"
    Write-Host "  3. Titulo: Nythar - Dashboard & Chatbot $Version"
    Write-Host "  4. Upload: $releaseZip"
    Write-Host ""
    Write-Host "======================================================"
    Write-Host "  Pacote pronto. Publique manualmente no GitHub."
    Write-Host "======================================================"
    return
}

# Verificar autenticacao
$ghStatus = & $ghExe auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  gh CLI nao autenticado."
    Write-Host "  Execute no terminal: & '$ghExe' auth login"
    Write-Host ""
    Write-Host "  Ou publique manualmente: https://github.com/$githubRepo/releases/new"
    return
}
Write-Host "  gh CLI disponivel e autenticado."
Write-Host ""

# ── [4/4] Criar release no GitHub ─────────────────────
Write-Host "[4/4] Publicando release $Version no GitHub..."
Write-Host "  Repositorio: $githubRepo"
Write-Host ""

# Verificar se a tag ja existe (stderr suprimido localmente; ErrorActionPreference nao para no NativeCommandError)
$releaseExists = $false
$savedEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$null = & $ghExe release view $Version --repo $githubRepo 2>&1
$releaseExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $savedEAP

if ($releaseExists) {
    Write-Host "  AVISO: Release $Version ja existe. Atualizando assets..."
    & $ghExe release upload $Version $releaseZip --repo $githubRepo --clobber
    if ($LASTEXITCODE -ne 0) { throw "Falha ao fazer upload do asset." }
} else {
    $notes = "## Nythar - Dashboard & Chatbot $Version`n`nAtualizacao automatica do sistema.`n`nPara atualizar: execute **ATUALIZAR-SISTEMA.bat** no computador do cliente."
    & $ghExe release create $Version $releaseZip `
        --repo $githubRepo `
        --title "Nythar - Dashboard & Chatbot $Version" `
        --notes $notes
}

if ($LASTEXITCODE -ne 0) {
    throw "Falha ao publicar release no GitHub."
}

Write-Host ""
Write-Host "======================================================"
Write-Host "  Release $Version publicada com sucesso!"
Write-Host ""
Write-Host "  O cliente executa ATUALIZAR-SISTEMA.bat e recebe"
Write-Host "  a atualizacao automaticamente, sem precisar de"
Write-Host "  acesso remoto (AnyDesk)."
Write-Host "======================================================"
