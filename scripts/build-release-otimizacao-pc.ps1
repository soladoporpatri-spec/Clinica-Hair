param(
    [string]$Version = "",
    [string]$StoreName = "Synth Optimizer",
    [string]$StoreSlug = "synth-optimizer",
    [string]$StoreAdminUsername = "",
    [string]$StoreAdminPassword = ""
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseRoot = Join-Path $root "release"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stagingRoot = Join-Path $releaseRoot "_staging_synth_optimizer_$timestamp"
$appDir = Join-Path $stagingRoot "Synth Optimizer"
$zipPath = Join-Path $releaseRoot "Synth-Optimizer.zip"
$backendPublish = Join-Path $appDir "runtime\backend"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if ([string]::IsNullOrWhiteSpace($StoreAdminUsername) -or [string]::IsNullOrWhiteSpace($StoreAdminPassword)) {
    throw "Informe usuario e senha da conta administrativa da loja."
}

Write-Host ""
Write-Host "======================================================"
Write-Host "  SYNTH OPTIMIZER - PACOTE CLIENTE"
Write-Host "  Loja remota | ComputerOptimization"
Write-Host "======================================================"

New-Item -ItemType Directory -Force -Path $appDir, $backendPublish | Out-Null

Write-Host "[1/7] Publicando backend .NET..."
dotnet publish (Join-Path $root "WhatsAppBot.Worker\WhatsAppBot.Worker.csproj") `
    -c Release -o $backendPublish --self-contained false --nologo
if ($LASTEXITCODE -ne 0 -or !(Test-Path (Join-Path $backendPublish "WhatsAppBot.Worker.dll"))) {
    throw "Falha ao publicar o backend."
}

Write-Host "[2/7] Copiando dashboard e operacao local..."
$rootFiles = @(
    "api-nythar.js", "dashboard-improved.html", "login.html", "manifest.json",
    "package.json", "package-lock.json", "script-dashboard.js", "style-dashboard.css", "sw.js",
    "INICIAR-SISTEMA-LOCAL.bat", "INICIAR-AUTOMATICO.bat", "PARAR-SISTEMA-LOCAL.bat",
    "REPARAR-WHATSAPP.bat", "STATUS-SISTEMA-LOCAL.bat",
    "INSTALAR-CLIENTE.bat", "VERIFICAR-INSTALACAO.bat", "MOSTRAR-CREDENCIAIS.bat",
    "TESTAR-LOGIN-LOCAL.bat", "ATUALIZAR-SISTEMA.bat", "ATUALIZAR-BACKEND.bat",
    "INSTALAR-INICIO-AUTOMATICO.bat", "REMOVER-INICIO-AUTOMATICO.bat",
    "LEIA-ME-INSTALACAO.md", "TUTORIAL-USO-CLIENTE.txt", "iniciar-linux.sh", "instalar-linux.sh"
)
foreach ($file in $rootFiles) {
    $source = Join-Path $root $file
    if (Test-Path $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $appDir $file) -Force }
}
foreach ($dir in @("assets", "superadmin", "docs")) {
    $source = Join-Path $root $dir
    if (Test-Path $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $appDir $dir) -Recurse -Force }
}

$scriptsTarget = Join-Path $appDir "scripts"
New-Item -ItemType Directory -Force -Path $scriptsTarget | Out-Null
$scriptFiles = @(
    "supervisor.js", "local-smoke.js", "gerar-segredos.js", "backup-windows.ps1",
    "cleanup-logs.ps1", "instalar-chrome.js", "install-autostart.ps1", "stop-local.ps1"
)
foreach ($file in $scriptFiles) {
    $source = Join-Path $root "scripts\$file"
    if (Test-Path $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $scriptsTarget $file) -Force }
}

$updaterSource = Join-Path $root "config\updater.cfg"
if (Test-Path $updaterSource) {
    New-Item -ItemType Directory -Force -Path (Join-Path $appDir "config") | Out-Null
    Copy-Item -LiteralPath $updaterSource -Destination (Join-Path $appDir "config\updater.cfg") -Force
}

Write-Host "[3/7] Copiando WhatsApp Bridge..."
$bridgeTarget = Join-Path $appDir "WhatsAppBridge"
New-Item -ItemType Directory -Force -Path $bridgeTarget | Out-Null
foreach ($file in @("index.js", "bridge-factory.js", "package.json", "package-lock.json", "start-bridge.bat", "start-factory.bat")) {
    $source = Join-Path $root "WhatsAppBridge\$file"
    if (Test-Path $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $bridgeTarget $file) -Force }
}
$bridgeImages = Join-Path $root "WhatsAppBridge\Imagens"
if (Test-Path $bridgeImages) { Copy-Item -LiteralPath $bridgeImages -Destination (Join-Path $bridgeTarget "Imagens") -Recurse -Force }

Write-Host "[4/7] Preparando instalacao limpa e conta inicial..."
New-Item -ItemType Directory -Force -Path (Join-Path $appDir "data"), (Join-Path $appDir "logs"), (Join-Path $appDir "backups") | Out-Null
$bootstrap = @{
    storeAdmin = @{ username = $StoreAdminUsername; password = $StoreAdminPassword }
    store = @{ name = $StoreName; slug = $StoreSlug; businessType = "ComputerOptimization" }
} | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $appDir "data\bootstrap-accounts.json"), $bootstrap, $utf8NoBom)

$storesMetaObject = @{
    $StoreSlug = @{
        storeId = 1
        name = $StoreName
        businessType = "ComputerOptimization"
        bridgePort = 3001
        bridgeUrl = "http://127.0.0.1:3001"
        backendUrl = "http://127.0.0.1:5000"
        plan = "Professional"
        slug = $StoreSlug
    }
}
$storesMeta = $storesMetaObject | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $appDir "data\stores-meta.json"), $storesMeta, $utf8NoBom)
foreach ($file in @(
    "whatsapp-queue.json", "whatsapp-queue-1.json", "whatsapp-paused-pending.json",
    "whatsapp-paused-pending-1.json"
)) {
    [System.IO.File]::WriteAllText((Join-Path $appDir "data\$file"), "[]", $utf8NoBom)
}
foreach ($file in @("bot-state.json", "bot-state-1.json")) {
    [System.IO.File]::WriteAllText((Join-Path $appDir "data\$file"), "{}", $utf8NoBom)
}

Write-Host "[5/7] Validando arquivos executaveis..."
foreach ($file in @(
    "api-nythar.js", "script-dashboard.js", "scripts\supervisor.js",
    "scripts\gerar-segredos.js", "WhatsAppBridge\index.js", "WhatsAppBridge\bridge-factory.js"
)) {
    node --check (Join-Path $appDir $file)
    if ($LASTEXITCODE -ne 0) { throw "Erro de sintaxe em $file" }
}

$note = @"
SYNTH OPTIMIZER - PACOTE CLIENTE

Tipo de loja: Tecnologia / otimizacao de computadores
Atendimento: remoto
Conta administrativa: $StoreAdminUsername

Na primeira instalacao, execute INSTALAR-CLIENTE.bat.
As credenciais sao provisionadas uma unica vez e permanecem no banco.
"@
[System.IO.File]::WriteAllText((Join-Path $appDir "PACOTE-CLIENTE-FINAL.txt"), $note, $utf8NoBom)
if ($Version) { [System.IO.File]::WriteAllText((Join-Path $appDir "version.txt"), $Version, $utf8NoBom) }

Write-Host "[6/7] Compactando pacote final..."
if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path "$appDir\*" -DestinationPath $zipPath -Force

Write-Host "[7/7] Conferindo o ZIP..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $names = @($zip.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
    foreach ($required in @(
        "runtime/backend/WhatsAppBot.Worker.dll", "dashboard-improved.html",
        "data/bootstrap-accounts.json", "data/stores-meta.json", "WhatsAppBridge/index.js"
    )) {
        if (-not ($names -contains $required)) { throw "Arquivo obrigatorio ausente do ZIP: $required" }
    }
    $forbidden = $names | Where-Object { $_ -match '(^|/)(agendamentos\.db|\.env(\.local)?|CREDENCIAIS-ACESSO\.txt|\.wwebjs_auth)' }
    if ($forbidden) { throw "O ZIP contem estado sensivel indevido: $($forbidden -join ', ')" }
} finally {
    $zip.Dispose()
}

$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "Pacote pronto: $zipPath ($sizeMb MB)"
