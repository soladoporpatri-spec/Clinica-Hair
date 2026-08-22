$ErrorActionPreference = 'SilentlyContinue'

function Stop-ProcessTree([int]$ProcessId) {
    if ($ProcessId -le 0 -or $ProcessId -eq $PID) { return }
    & taskkill.exe /PID $ProcessId /T /F *> $null
}

# Encerra todos os supervisores deste produto antes dos filhos. Isso impede
# que um supervisor antigo recrie factory/bridge enquanto a parada acontece.
$supervisors = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -ieq 'node.exe' -and $_.CommandLine -match 'scripts[\\/]supervisor\.js'
}
foreach ($process in $supervisors) {
    Write-Host "Encerrando supervisor PID $($process.ProcessId)..."
    Stop-ProcessTree ([int]$process.ProcessId)
}

# Limpa qualquer serviço remanescente nas portas locais do produto.
$ports = @(2999, 3000, 4000, 5000, 4040) + (3001..3010)
$owners = Get-NetTCPConnection -State Listen | Where-Object {
    $ports -contains $_.LocalPort
} | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($ownerPid in $owners) {
    Write-Host "Encerrando processo remanescente PID $ownerPid..."
    Stop-ProcessTree ([int]$ownerPid)
}

# Chromiums órfãos da bridge não devem sobreviver a uma parada completa.
# O filtro usa apenas os diretórios exclusivos de sessão do produto.
$orphanBrowsers = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match '^(chrome|chromium)\.exe$' -and
    $_.CommandLine -match '(\.wwebjs_auth_|Nythar[\\/]WhatsAppSessions)'
}
foreach ($browser in $orphanBrowsers) {
    Write-Host "Encerrando Chromium órfão da bridge PID $($browser.ProcessId)..."
    Stop-ProcessTree ([int]$browser.ProcessId)
}

$root = Split-Path -Parent $PSScriptRoot
$lockFile = Join-Path $root 'data\supervisor.lock'
if (Test-Path -LiteralPath $lockFile) {
    Remove-Item -LiteralPath $lockFile -Force
}

Write-Host 'Serviços locais e Chromiums da bridge foram encerrados.'
