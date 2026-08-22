$ErrorActionPreference = "Stop"

$root      = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$parent    = Split-Path $root -Parent
$staging   = Join-Path $env:TEMP "NytharDashboard-DevBackup-$timestamp"
$zipPath   = Join-Path $parent "NytharDashboard-DEV-BACKUP-$timestamp.zip"

Write-Host ""
Write-Host "======================================================"
Write-Host "  BACKUP DO AMBIENTE DE DESENVOLVIMENTO"
Write-Host "  Origem: $root"
Write-Host "  Timestamp: $timestamp"
Write-Host "======================================================"
Write-Host ""

# Pastas regeneraveis / pesadas / sensiveis a EXCLUIR (por nome, em qualquer nivel)
$excludeDirs = @(
    "node_modules",        # deps npm - regenerar com npm install
    "bin", "obj",          # artefatos de build .NET
    "logs",                # logs de runtime
    "runtime",             # backend publicado - regenerar com dotnet publish
    "publish",             # saida de publish antiga
    ".wwebjs_auth",        # sessao WhatsApp (sensivel + pesada)
    ".wwebjs_auth_1",
    ".wwebjs_auth_8",
    ".wwebjs_cache",       # cache do navegador Puppeteer
    "release",             # staging/zips gerados (dbfilter tool copiado a parte)
    ".claude", ".sixth", ".git"
)

# Arquivos a EXCLUIR
$excludeFiles = @("*.zip")

Write-Host "[1/4] Copiando codigo-fonte e dados (excluindo regeneraveis)..."
$rcArgs = @($root, $staging, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/R:1", "/W:1")
$rcArgs += "/XD"; $rcArgs += $excludeDirs
$rcArgs += "/XF"; $rcArgs += $excludeFiles
# robocopy retorna 0-7 como sucesso; >=8 e erro real
& robocopy @rcArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy falhou com codigo $LASTEXITCODE" }

Write-Host "[2/4] Incluindo fonte do DbFilterTool (sem bin/obj)..."
$dbToolSrc = Join-Path $root "release\_dbfilter_tool"
if (Test-Path $dbToolSrc) {
    $dbToolDst = Join-Path $staging "release\_dbfilter_tool"
    New-Item -ItemType Directory -Force -Path $dbToolDst | Out-Null
    foreach ($f in @("Program.cs", "DbFilterTool.csproj")) {
        $src = Join-Path $dbToolSrc $f
        if (Test-Path $src) { Copy-Item -LiteralPath $src -Destination (Join-Path $dbToolDst $f) -Force }
    }
}

Write-Host "[3/4] Escrevendo manifesto do backup..."
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$incluido = (Get-ChildItem $staging -Recurse -File | Measure-Object).Count
$tamMB = [math]::Round((Get-ChildItem $staging -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 1)
$manifesto = @"
BACKUP DO AMBIENTE DE DESENVOLVIMENTO - Nythar - Dashboard & Chatbot
Gerado em: $timestamp
Arquivos: $incluido  |  Tamanho descompactado: $tamMB MB

INCLUI:
  - Codigo-fonte completo (.NET backend, dashboard, WhatsApp Bridge)
  - Banco de dados (data/agendamentos.db + json de configuracao)
  - scripts, tests, docs, assets, superadmin, Lavajato (fonte)
  - Arquivos .bat, package.json, fonte do DbFilterTool

NAO INCLUI (regeneravel/sensivel):
  - node_modules        -> restaurar: npm install (raiz e WhatsAppBridge)
  - bin/ obj/           -> recompilam no build
  - runtime/ publish/   -> restaurar: dotnet publish WhatsAppBot.Worker -c Release -o runtime/backend
  - logs/               -> recriados em runtime
  - .wwebjs_auth*/.wwebjs_cache -> sessao WhatsApp (reescanear QR)
  - release/ zips e staging
  - .git

RESTAURACAO RAPIDA:
  1) Extrair o zip
  2) npm install                 (na raiz)
  3) cd WhatsAppBridge && npm install
  4) dotnet publish WhatsAppBot.Worker/WhatsAppBot.Worker.csproj -c Release -o runtime/backend --self-contained false
  5) INICIAR-SISTEMA-LOCAL.bat
"@
[System.IO.File]::WriteAllText((Join-Path $staging "_BACKUP-MANIFESTO.txt"), $manifesto, $utf8NoBom)

Write-Host "[4/4] Compactando ZIP..."
if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force

# Limpa staging temporario
Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue

$zipMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "======================================================"
Write-Host "  Backup pronto!"
Write-Host "======================================================"
Write-Host "  Arquivos : $incluido"
Write-Host "  ZIP      : $zipPath ($zipMB MB)"
Write-Host "======================================================"
