# backup-windows.ps1 — Backup automatico do banco SQLite da Nythar - Dashboard & Chatbot
# Agendado pelo Task Scheduler via INSTALAR-CLIENTE.bat (diariamente as 03:15)
# Uso manual: powershell -ExecutionPolicy Bypass -File scripts\backup-windows.ps1

param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$DbSource  = Join-Path $Root "data\agendamentos.db"
$BackupDir = Join-Path $Root "backups"
$LogFile   = Join-Path $Root "logs\backup.log"
$MaxBackups = 14

function Write-Log {
    param([string]$Msg)
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Msg"
    Write-Host $line
    try {
        Add-Content -Path $LogFile -Value $line -Encoding UTF8 -ErrorAction Stop
    } catch {
        # Nao falhar se o log nao puder ser escrito
    }
}

# Garantir que as pastas existam
foreach ($dir in @($BackupDir, (Split-Path $LogFile))) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

Write-Log "=== Backup iniciado ==="

# Verificar se o banco existe
if (-not (Test-Path $DbSource)) {
    Write-Log "ERRO: Banco de dados nao encontrado em $DbSource"
    exit 1
}

# Nome do arquivo de destino com timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$destName  = "agendamentos_$timestamp.db"
$Dest      = Join-Path $BackupDir $destName

# Copiar o banco (SQLite suporta hot-copy quando nao ha write exclusivo)
try {
    Copy-Item -Path $DbSource -Destination $Dest -Force -ErrorAction Stop
    $sizeKB = [math]::Round((Get-Item $Dest).Length / 1KB, 1)
    Write-Log "Backup criado: $destName ($sizeKB KB)"
} catch {
    Write-Log "ERRO ao copiar banco: $_"
    exit 1
}

# Remover backups antigos — manter apenas os ultimos $MaxBackups
$existing = Get-ChildItem -Path $BackupDir -Filter "agendamentos_*.db" |
            Sort-Object LastWriteTime -Descending

if ($existing.Count -gt $MaxBackups) {
    $toDelete = $existing | Select-Object -Skip $MaxBackups
    foreach ($f in $toDelete) {
        try {
            Remove-Item $f.FullName -Force -ErrorAction Stop
            Write-Log "Backup antigo removido: $($f.Name)"
        } catch {
            Write-Log "AVISO: nao foi possivel remover $($f.Name): $_"
        }
    }
}

$kept = [math]::Min($existing.Count, $MaxBackups)
Write-Log "Backup concluido. Backups mantidos: $kept de $MaxBackups maximos."
Write-Log "=== Backup finalizado ==="
exit 0
