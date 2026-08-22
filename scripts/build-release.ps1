$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseRoot = Join-Path $root "release"
$stagingRoot = Join-Path $releaseRoot ("_staging_" + (Get-Date -Format "yyyyMMddHHmmss"))
$appDir = Join-Path $stagingRoot "NytharDashboard"
$zipPath = Join-Path $releaseRoot "NytharDashboard-2.0.zip"
$backendPublish = Join-Path $appDir "runtime\backend"

Write-Host "Nythar - Dashboard & Chatbot 2.0 - gerando pacote profissional..."

if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

if (Test-Path $appDir) {
    $resolvedApp = (Resolve-Path $appDir).Path
    $resolvedRelease = (Resolve-Path $releaseRoot).Path
    if (!$resolvedApp.StartsWith($resolvedRelease, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Caminho de staging inseguro: $resolvedApp"
    }
    Remove-Item -LiteralPath $appDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $appDir, $backendPublish | Out-Null

Write-Host "[1/6] Publicando backend .NET..."
dotnet publish (Join-Path $root "WhatsAppBot.Worker\WhatsAppBot.Worker.csproj") `
    -c Release `
    -o $backendPublish `
    --self-contained false

Write-Host "[2/6] Copiando dashboard e scripts..."
$rootFiles = @(
    "api-nythar.js",
    "dashboard-improved.html",
    "login.html",
    "manifest.json",
    "package.json",
    "package-lock.json",
    "script-dashboard.js",
    "style-dashboard.css",
    "sw.js",
    "INICIAR-SISTEMA-LOCAL.bat",
    "INICIAR-AUTOMATICO.bat",
    "PARAR-SISTEMA-LOCAL.bat",
    "REPARAR-WHATSAPP.bat",
    "STATUS-SISTEMA-LOCAL.bat",
    "INSTALAR-CLIENTE.bat",
    "VERIFICAR-INSTALACAO.bat",
    "MOSTRAR-CREDENCIAIS.bat",
    "TESTAR-LOGIN-LOCAL.bat",
    "ATUALIZAR-SISTEMA.bat",
    "INSTALAR-INICIO-AUTOMATICO.bat",
    "REMOVER-INICIO-AUTOMATICO.bat",
    "version.txt",
    "LEIA-ME-INSTALACAO.md",
    "TUTORIAL-USO-CLIENTE.txt"
)

foreach ($file in $rootFiles) {
    Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $appDir $file) -Force
}

foreach ($dir in @("assets", "superadmin", "docs")) {
    $source = Join-Path $root $dir
    if (Test-Path $source) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $appDir $dir) -Recurse -Force
    }
}

$updaterConfig = Join-Path $root "config\updater.cfg"
if (Test-Path $updaterConfig) {
    New-Item -ItemType Directory -Force -Path (Join-Path $appDir "config") | Out-Null
    Copy-Item -LiteralPath $updaterConfig -Destination (Join-Path $appDir "config\updater.cfg") -Force
}

New-Item -ItemType Directory -Force -Path (Join-Path $appDir "scripts") | Out-Null
$scriptsToCopy = @(
    "supervisor.js",
    "local-smoke.js",
    "gerar-segredos.js",
    "instalar-chrome.js",
    "install-autostart.ps1",
    "backup-windows.ps1",
    "cleanup-logs.ps1",
    "stop-local.ps1",
    "check-github-update.ps1",
    "update-system.ps1"
)
foreach ($script in $scriptsToCopy) {
    $src = Join-Path $root "scripts\$script"
    if (Test-Path $src) {
        Copy-Item -LiteralPath $src -Destination (Join-Path $appDir "scripts\$script") -Force
        Write-Host "  + scripts\$script"
    } else {
        Write-Warning "scripts\$script nao encontrado - ignorado"
    }
}

Write-Host "[3/6] Copiando WhatsApp Bridge..."
$bridgeTarget = Join-Path $appDir "WhatsAppBridge"
New-Item -ItemType Directory -Force -Path $bridgeTarget | Out-Null
$bridgeFiles = @("index.js", "bridge-factory.js", "package.json", "package-lock.json", "start-bridge.bat", "start-factory.bat")
foreach ($file in $bridgeFiles) {
    $source = Join-Path $root "WhatsAppBridge\$file"
    if (Test-Path $source) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $bridgeTarget $file) -Force
    }
}
$bridgeImages = Join-Path $root "WhatsAppBridge\Imagens"
if (Test-Path $bridgeImages) {
    Copy-Item -LiteralPath $bridgeImages -Destination (Join-Path $bridgeTarget "Imagens") -Recurse -Force
}

Write-Host "[4/6] Preparando pastas operacionais limpas..."
foreach ($dir in @("data", "logs", "backups")) {
    New-Item -ItemType Directory -Force -Path (Join-Path $appDir $dir) | Out-Null
}

$templates = Join-Path $root "data\whatsapp-templates.json"
if (Test-Path $templates) {
    Copy-Item -LiteralPath $templates -Destination (Join-Path $appDir "data\whatsapp-templates.json") -Force
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $appDir "data\whatsapp-queue.json"), "[]", $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $appDir "data\bot-state.json"), "{}", $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $appDir "data\whatsapp-paused-pending.json"), "[]", $utf8NoBom)

$dbArtifacts = @(
    (Join-Path $appDir "data\agendamentos.db"),
    (Join-Path $appDir "data\agendamentos.db-wal"),
    (Join-Path $appDir "data\agendamentos.db-shm")
)
foreach ($dbArtifact in $dbArtifacts) {
    if (Test-Path $dbArtifact) {
        Remove-Item -LiteralPath $dbArtifact -Force
    }
}

Write-Host "[5/6] Validando sintaxe dos arquivos JS..."
node --check (Join-Path $appDir "api-nythar.js")
node --check (Join-Path $appDir "script-dashboard.js")
node --check (Join-Path $appDir "scripts\supervisor.js")
node --check (Join-Path $appDir "scripts\gerar-segredos.js")
node --check (Join-Path $appDir "WhatsAppBridge\index.js")

if (!(Test-Path (Join-Path $backendPublish "WhatsAppBot.Worker.dll"))) {
    throw "Backend publicado nao encontrado no pacote."
}

Write-Host "[6/6] Compactando ZIP..."
Compress-Archive -Path (Join-Path $appDir "*") -DestinationPath $zipPath -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $forbiddenPatterns = @(
        '(^|/)(\.env|\.env\..+|CREDENCIAIS-ACESSO\.txt)$',
        '(^|/)data[\\/](agendamentos\.db|agendamentos\.db-wal|agendamentos\.db-shm|dashboard-sessions\.json|stores-meta\.json)$',
        '(^|/)data[\\/](exports|exportacoes)([\\/]|$)',
        '(^|/)(logs|backups)[\\/].+',
        '(^|/)WhatsAppBridge[\\/](\.wwebjs_auth|\.wwebjs_cache|\.wwebjs_auth_[^\\/]+)([\\/]|$)',
        '(^|/)WhatsAppBridge[\\/].*(session|token|auth).*\.json$'
    )
    $forbiddenEntries = $zip.Entries | Where-Object {
        $entry = $_.FullName -replace '\\', '/'
        foreach ($pattern in $forbiddenPatterns) {
            if ($entry -match $pattern) { return $true }
        }
        return $false
    }
    if ($forbiddenEntries) {
        throw "ZIP contem arquivo operacional/sensivel indevido: $($forbiddenEntries.FullName -join ', ')"
    }
} finally {
    $zip.Dispose()
}

if (Test-Path (Join-Path $releaseRoot "NytharDashboard")) {
    Write-Host "Pasta release\NytharDashboard antiga preservada. Entregue o ZIP atualizado."
}

Write-Host ""
Write-Host "  Versao: Nythar - Dashboard & Chatbot 2.0"

$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "======================================================"
Write-Host " Pacote pronto!"
Write-Host "======================================================"
Write-Host "  Pasta : $appDir"
Write-Host "  ZIP   : $zipPath ($zipSize MB)"
Write-Host "======================================================"
