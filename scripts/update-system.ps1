[CmdletBinding()]
param(
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$configPath = Join-Path $root 'config\updater.cfg'

function Stop-WithError([string]$message) {
    Write-Host "ERRO: $message" -ForegroundColor Red
    if (-not $Check) { Read-Host 'Pressione Enter para sair' | Out-Null }
    exit 1
}

function Copy-StateItem([string]$source, [string]$destination) {
    if (Test-Path -LiteralPath $source) {
        $parent = Split-Path -Parent $destination
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
        return $true
    }
    return $false
}

if (-not (Test-Path -LiteralPath $configPath)) {
    Stop-WithError 'Arquivo config\updater.cfg nao encontrado.'
}

$config = @{}
Get-Content -LiteralPath $configPath | ForEach-Object {
    if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)\s*$') {
        $config[$matches[1]] = $matches[2]
    }
}
$repository = $config['GITHUB_REPO']
$token = $config['GITHUB_TOKEN']
if ([string]::IsNullOrWhiteSpace($repository) -or $repository -eq 'SEU_USUARIO/SEU_REPO') {
    Stop-WithError 'GITHUB_REPO nao configurado em config\updater.cfg.'
}

$env:CH_UPDATER_REPO = $repository
$env:CH_UPDATER_TOKEN = $token
$checkScript = Join-Path $PSScriptRoot 'check-github-update.ps1'
if (-not (Test-Path -LiteralPath $checkScript)) {
    Stop-WithError 'Componente de consulta ao GitHub nao encontrado.'
}

$response = & $checkScript
if (($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) -or [string]::IsNullOrWhiteSpace($response) -or $response -like 'ERRO:*') {
    Stop-WithError ("Nao foi possivel consultar a release no GitHub. {0}" -f $response)
}
$parts = $response -split '\|', 2
$latestVersion = $parts[0]
$downloadUrl = $parts[1]
$versionPath = Join-Path $root 'version.txt'
$currentVersion = if (Test-Path -LiteralPath $versionPath) { (Get-Content -LiteralPath $versionPath -Raw).Trim() } else { 'nao-instalada' }

Write-Host "Repositorio: $repository"
Write-Host "Instalada : $currentVersion"
Write-Host "Disponivel: $latestVersion"
if ($Check) {
    Write-Host 'Atualizador GitHub configurado e acessivel.' -ForegroundColor Green
    exit 0
}
if ($currentVersion -eq $latestVersion) {
    Write-Host 'Sistema ja esta na versao mais recente.' -ForegroundColor Green
    Read-Host 'Pressione Enter para sair' | Out-Null
    exit 0
}

$confirmation = Read-Host "Nova versao disponivel. Digite S para atualizar"
if ($confirmation -notmatch '^[sS]$') { exit 0 }

if ((Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue)) {
    $stopScript = Join-Path $root 'PARAR-SISTEMA-LOCAL.bat'
    if (-not (Test-Path -LiteralPath $stopScript)) { Stop-WithError 'Sistema em execucao e script de parada nao encontrado.' }
    & $stopScript | Out-Null
    Start-Sleep -Seconds 5
    if (Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue) {
        Stop-WithError 'Nao foi possivel parar o sistema automaticamente.'
    }
}

$backup = Join-Path $root ("backups\pre-update-{0}-{1}" -f $latestVersion, (Get-Date -Format 'yyyyMMddHHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$state = @(
    @{ Source = (Join-Path $root '.env.local'); Destination = (Join-Path $backup '.env.local') },
    @{ Source = (Join-Path $root '.env'); Destination = (Join-Path $backup '.env') },
    @{ Source = (Join-Path $root 'config\updater.cfg'); Destination = (Join-Path $backup 'config\updater.cfg') },
    @{ Source = (Join-Path $root 'data\agendamentos.db'); Destination = (Join-Path $backup 'data\agendamentos.db') },
    @{ Source = (Join-Path $root 'runtime\backend\agendamentos.db'); Destination = (Join-Path $backup 'runtime\backend\agendamentos.db') }
)
foreach ($item in $state) { [void](Copy-StateItem $item.Source $item.Destination) }
Get-ChildItem -LiteralPath (Join-Path $root 'WhatsAppBridge') -Directory -Filter '.wwebjs_auth*' -ErrorAction SilentlyContinue | ForEach-Object {
    [void](Copy-StateItem $_.FullName (Join-Path $backup (Join-Path 'WhatsAppBridge' $_.Name)))
}

$tempZip = Join-Path $env:TEMP 'NytharDashboard-update.zip'
$tempDir = Join-Path $env:TEMP 'NytharDashboard-update'
Remove-Item -LiteralPath $tempZip, $tempDir -Recurse -Force -ErrorAction SilentlyContinue
$headers = @{ 'User-Agent' = 'NytharDashboard-Updater' }
if (-not [string]::IsNullOrWhiteSpace($token)) { $headers['Authorization'] = "token $token" }
try {
    Invoke-WebRequest -Uri $downloadUrl -Headers $headers -OutFile $tempZip
    if ((Get-Item -LiteralPath $tempZip).Length -lt 1024) { throw 'Arquivo de atualizacao invalido ou incompleto.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($tempZip)
    try {
        if ($zip.Entries.FullName -match '(^|[\\/])\.\.([\\/]|$)') { throw 'Pacote contem caminho invalido.' }
    } finally { $zip.Dispose() }
    Expand-Archive -LiteralPath $tempZip -DestinationPath $tempDir -Force
    if (-not (Test-Path -LiteralPath (Join-Path $tempDir 'INICIAR-SISTEMA-LOCAL.bat'))) { throw 'Estrutura do pacote invalida.' }
    Get-ChildItem -LiteralPath $tempDir -Force | Copy-Item -Destination $root -Recurse -Force
} catch {
    Stop-WithError $_.Exception.Message
} finally {
    Remove-Item -LiteralPath $tempZip, $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

foreach ($item in $state) { [void](Copy-StateItem $item.Destination $item.Source) }
Get-ChildItem -LiteralPath (Join-Path $backup 'WhatsAppBridge') -Directory -Filter '.wwebjs_auth*' -ErrorAction SilentlyContinue | ForEach-Object {
    [void](Copy-StateItem $_.FullName (Join-Path $root (Join-Path 'WhatsAppBridge' $_.Name)))
}
[System.IO.File]::WriteAllText($versionPath, $latestVersion, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Atualizacao concluida. Versao instalada: $latestVersion" -ForegroundColor Green
Write-Host 'Execute INICIAR-SISTEMA-LOCAL.bat para reiniciar.'
Read-Host 'Pressione Enter para sair' | Out-Null
