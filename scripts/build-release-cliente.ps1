param(
    # Versao semantica para injetar no ZIP (ex: "v2.1.0").
    # Opcional: usado por publish-release.ps1. Se omitido, nenhum version.txt e gerado.
    [string]$Version = "",
    [string]$SuperAdminUsername = "",
    [string]$SuperAdminPassword = "",
    [string]$StoreAdminUsername = "",
    [string]$StoreAdminPassword = "",
    [int]$StoreId = 1,
    [string]$StoreName = "Minha barbearia",
    [string]$StoreSlug = "minha-barbearia"
)

$ErrorActionPreference = "Stop"

$root        = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseRoot = Join-Path $root "release"
$timestamp   = Get-Date -Format "yyyyMMdd-HHmmss"
$stagingRoot = Join-Path $releaseRoot "_staging_nythar_cliente_$timestamp"
$appDir      = Join-Path $stagingRoot "NytharDashboard"
$zipPath     = Join-Path $releaseRoot "NytharDashboard-Cliente-$timestamp.zip"

$backendPublish = Join-Path $appDir "runtime\backend"
# Banco principal com todos os dados operacionais (barbeiros, horarios, planos, configs).
# NÃO usar WhatsAppBot.Worker\agendamentos.db — aquele e uma copia velha de dev (36KB).
# O banco real fica em data\agendamentos.db (atualizado pelo backend em producao).
$sourceDb       = Join-Path $root "data\agendamentos.db"
$seedDb         = Join-Path $appDir "data\agendamentos.seed.db"
$dbToolDir      = Join-Path $releaseRoot "_dbfilter_tool"
$storeId        = $StoreId

Write-Host ""
Write-Host "======================================================"
Write-Host "  NYTHAR - DASHBOARD & CHATBOT - PACOTE CLIENTE (barbearia isolada)"
Write-Host "  Loja: $StoreName (StoreId=$storeId)   Timestamp: $timestamp"
Write-Host "======================================================"
Write-Host ""

# --- Sanidade ---
if (!(Test-Path $sourceDb)) {
    throw "Banco de dados fonte nao encontrado: $sourceDb"
}

# --- 1. Backend .NET ---
Write-Host "[1/7] Publicando backend .NET (Release)..."
New-Item -ItemType Directory -Force -Path $backendPublish | Out-Null
dotnet publish (Join-Path $root "WhatsAppBot.Worker\WhatsAppBot.Worker.csproj") -c Release -o $backendPublish --self-contained false
if (!(Test-Path (Join-Path $backendPublish "WhatsAppBot.Worker.dll"))) {
    throw "Backend publicado nao encontrado em $backendPublish"
}
Write-Host "  OK: backend publicado."

# --- 2. Dashboard e arquivos raiz ---
Write-Host "[2/7] Copiando dashboard, scripts e batches..."
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
    "ATUALIZAR-BACKEND.bat",
    "INSTALAR-INICIO-AUTOMATICO.bat",
    "REMOVER-INICIO-AUTOMATICO.bat",
    "LEIA-ME-INSTALACAO.md",
    "TUTORIAL-USO-CLIENTE.txt",
    "CRIAR-PACOTE-CLIENTE.bat",
    "iniciar-linux.sh",
    "instalar-linux.sh"
)
foreach ($file in $rootFiles) {
    $src = "$root\$file"
    if (Test-Path $src) {
        Copy-Item -LiteralPath $src -Destination "$appDir\$file" -Force
        Write-Host "  + $file"
    } else {
        Write-Warning "AVISO: $file nao encontrado - ignorado."
    }
}

foreach ($dir in @("assets", "superadmin", "docs")) {
    $src = "$root\$dir"
    if (Test-Path $src) {
        Copy-Item -LiteralPath $src -Destination "$appDir\$dir" -Recurse -Force
        Write-Host "  + $dir/"
    }
}

# Scripts internos
$scriptsTarget = "$appDir\scripts"
New-Item -ItemType Directory -Force -Path $scriptsTarget | Out-Null
$scriptFiles = @("supervisor.js", "local-smoke.js", "gerar-segredos.js", "backup-windows.ps1", "build-release-cliente.ps1", "cleanup-logs.ps1", "instalar-chrome.js", "install-autostart.ps1", "stop-local.ps1")
foreach ($s in $scriptFiles) {
    $src = "$root\scripts\$s"
    if (Test-Path $src) {
        Copy-Item -LiteralPath $src -Destination "$scriptsTarget\$s" -Force
        Write-Host "  + scripts\$s"
    } else {
        Write-Warning "AVISO: scripts\$s nao encontrado - ignorado."
    }
}

# Config do atualizador automatico
$updaterCfgSrc = "$root\config\updater.cfg"
if (Test-Path $updaterCfgSrc) {
    $configTarget = "$appDir\config"
    New-Item -ItemType Directory -Force -Path $configTarget | Out-Null
    Copy-Item -LiteralPath $updaterCfgSrc -Destination "$configTarget\updater.cfg" -Force
    Write-Host "  + config\updater.cfg"
} else {
    Write-Warning "AVISO: config\updater.cfg nao encontrado - ATUALIZAR-SISTEMA.bat nao funcionara sem ele."
}

# --- 3. WhatsApp Bridge ---
Write-Host "[3/7] Copiando WhatsApp Bridge..."
$bridgeTarget = "$appDir\WhatsAppBridge"
New-Item -ItemType Directory -Force -Path $bridgeTarget | Out-Null
$bridgeFiles = @("index.js", "bridge-factory.js", "package.json", "package-lock.json", "start-bridge.bat", "start-factory.bat")
foreach ($f in $bridgeFiles) {
    $src = "$root\WhatsAppBridge\$f"
    if (Test-Path $src) {
        Copy-Item -LiteralPath $src -Destination "$bridgeTarget\$f" -Force
    }
}
$bridgeImages = "$root\WhatsAppBridge\Imagens"
if (Test-Path $bridgeImages) {
    Copy-Item -LiteralPath $bridgeImages -Destination "$bridgeTarget\Imagens" -Recurse -Force
}

# --- 4. Filtrar banco de dados ---
Write-Host "[4/7] Filtrando banco de dados (StoreId=$storeId, modo config-only)..."
New-Item -ItemType Directory -Force -Path "$appDir\data" | Out-Null

$dbToolBin = "$dbToolDir\bin\Release\net8.0\DbFilterTool.exe"
Write-Host "  Compilando DbFilterTool..."
dotnet build "$dbToolDir\DbFilterTool.csproj" -c Release --nologo -v q

& $dbToolBin filter-config $sourceDb $seedDb $storeId
if (!(Test-Path $seedDb)) {
    throw "Banco-modelo filtrado nao gerado em $seedDb"
}
Write-Host "  OK: banco-modelo filtrado gerado."

foreach ($wal in @("$seedDb-wal", "$seedDb-shm")) {
    if (Test-Path $wal) { Remove-Item -LiteralPath $wal -Force }
}

# --- 5. JSON operacionais limpos ---
Write-Host "[5/7] Escrevendo arquivos JSON operacionais limpos..."
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (($SuperAdminUsername -or $SuperAdminPassword -or $StoreAdminUsername -or $StoreAdminPassword) -and
    !($SuperAdminUsername -and $SuperAdminPassword -and $StoreAdminUsername -and $StoreAdminPassword)) {
    throw "Informe usuario e senha completos para as duas contas de provisionamento."
}

if ($SuperAdminUsername) {
    $bootstrapAccounts = @{
        superadmin = @{ username = $SuperAdminUsername; password = $SuperAdminPassword }
        storeAdmin = @{ username = $StoreAdminUsername; password = $StoreAdminPassword }
    } | ConvertTo-Json -Depth 3
    [System.IO.File]::WriteAllText("$appDir\data\bootstrap-accounts.json", $bootstrapAccounts, $utf8NoBom)
    Write-Host "  + contas iniciais de provisionamento (uso unico)"
}

$templatesSrc = "$root\data\whatsapp-templates.json"
if (Test-Path $templatesSrc) {
    Copy-Item -LiteralPath $templatesSrc -Destination "$appDir\data\whatsapp-templates.json" -Force
    Write-Host "  + whatsapp-templates.json"
}

$storesMeta = @{
    $StoreSlug = @{
        storeId = $storeId
        name = $StoreName
        businessType = "Barbershop"
        bridgePort = 3000 + $storeId
        bridgeUrl = "http://127.0.0.1:$($storeId + 3000)"
        backendUrl = "http://127.0.0.1:5000"
        plan = "Premium"
        slug = $StoreSlug
    }
} | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText("$appDir\data\stores-meta.json",           $storesMeta, $utf8NoBom)
[System.IO.File]::WriteAllText("$appDir\data\whatsapp-queue.json",         "[]",        $utf8NoBom)
[System.IO.File]::WriteAllText("$appDir\data\whatsapp-queue-1.json",       "[]",        $utf8NoBom)
[System.IO.File]::WriteAllText("$appDir\data\bot-state.json",              "{}",        $utf8NoBom)
[System.IO.File]::WriteAllText("$appDir\data\bot-state-1.json",            "{}",        $utf8NoBom)
[System.IO.File]::WriteAllText("$appDir\data\whatsapp-paused-pending.json", "[]",       $utf8NoBom)
[System.IO.File]::WriteAllText("$appDir\data\whatsapp-paused-pending-1.json","[]",      $utf8NoBom)
Write-Host "  + stores-meta.json (barbearia isolada)"
Write-Host "  + filas e estado do bot (vazios)"

foreach ($dir in @("logs", "backups")) {
    New-Item -ItemType Directory -Force -Path "$appDir\$dir" | Out-Null
}

# --- 6. Validacao JS ---
Write-Host "[6/7] Validando sintaxe dos arquivos JS..."
$jsChecks = @("api-nythar.js", "script-dashboard.js", "scripts\supervisor.js", "scripts\gerar-segredos.js", "WhatsAppBridge\index.js")
foreach ($js in $jsChecks) {
    $full = "$appDir\$js"
    if (Test-Path $full) {
        node --check $full
        if ($LASTEXITCODE -ne 0) { throw "Erro de sintaxe JS: $js" }
        Write-Host "  OK: $js"
    }
}

# --- 7. Compactar ---
Write-Host "[7/7] Compactando ZIP..."
if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path "$appDir\*" -DestinationPath $zipPath -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipCheck = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $walEntries = $zipCheck.Entries | Where-Object {
        $_.FullName -match '(^|/)data[\\/](agendamentos(\.seed)?\.db-wal|agendamentos(\.seed)?\.db-shm)$'
    }
    if ($walEntries) {
        throw "ZIP contem artefato SQLite WAL/SHM indevido: $($walEntries.FullName -join ', ')"
    }
} finally {
    $zipCheck.Dispose()
}

$zipSizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)

# Injetar version.txt no ZIP (so quando chamado via publish-release.ps1)
if ($Version -ne "") {
    Write-Host "  Injetando version.txt ($Version)..."
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Update')
    $existing = $zip.Entries | Where-Object { $_.FullName -eq "version.txt" }
    if ($existing) { $existing.Delete() }
    $entry  = $zip.CreateEntry("version.txt")
    $writer = New-Object System.IO.StreamWriter($entry.Open(), [System.Text.Encoding]::UTF8)
    $writer.Write($Version)
    $writer.Close()
    $zip.Dispose()
}

$nota = "Pacote Nythar gerado em $timestamp.`nInclui somente a loja $StoreName (StoreId $storeId).`nMantido: loja, profissionais, horarios, servicos, planos e configuracoes.`nRemovido: agendamentos, assinaturas, sessoes, dias bloqueados, logs e filas do WhatsApp."
[System.IO.File]::WriteAllText("$appDir\PACOTE-CLIENTE-FINAL.txt", $nota, $utf8NoBom)

Write-Host ""
Write-Host "======================================================"
Write-Host "  Pacote pronto!"
Write-Host "======================================================"
Write-Host "  Pasta : $appDir"
Write-Host "  ZIP   : $zipPath ($zipSizeMB MB)"
Write-Host "======================================================"
