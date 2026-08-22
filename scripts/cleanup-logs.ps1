<#
.SYNOPSIS
    Limpeza e rotacao segura de logs do sistema Nythar - Dashboard & Chatbot.

.PARAMETER DaysToKeep
    Arquivos diarios com mais que este numero de dias serao removidos (default: 30).

.PARAMETER MaxFileSizeMB
    Logs persistentes (*.out.log, *.err.log, *.log) maiores que este limite serao
    rotacionados: renomeados para .1 e um novo arquivo vazio sera criado no proximo start.
    Default: 20 MB.

.NOTES
    - Nunca remove o log do dia atual.
    - Nunca trava se um arquivo estiver em uso (supervisor rodando) — pula silenciosamente.
    - Seguro para rodar enquanto o sistema esta parado OU antes de iniciar.
    - Exibe resumo de tudo que foi feito.
#>
param(
    [int]$DaysToKeep        = 30,
    [int]$MaxFileSizeMB     = 20,
    [int]$DaysToKeepBackups = 7
)

$logsDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")) "logs"

if (!(Test-Path $logsDir)) {
    Write-Host "  Pasta de logs nao encontrada. Nada a fazer."
    exit 0
}

$cutoffDate   = (Get-Date).AddDays(-$DaysToKeep)
$today        = (Get-Date).ToString("yyyyMMdd")
$removedCount = 0
$rotatedCount = 0
$skippedCount = 0
$freedBytes   = [long]0

# ── 1. Arquivos diarios antigos ─────────────────────────────────────────────
# Padroes: general-YYYYMMDD.txt | appointments-YYYYMMDD.txt | webhooks-YYYYMMDD.txt
# Exclui qualquer arquivo com a data de hoje no nome.
$dailyPatterns = @("general-*.txt", "appointments-*.txt", "webhooks-*.txt",
                   "spreadsheets.log")

foreach ($pattern in $dailyPatterns) {
    $files = Get-ChildItem -Path $logsDir -Filter $pattern -ErrorAction SilentlyContinue |
             Where-Object {
                 # Nao remove se contem a data de hoje no nome
                 $_.Name -notmatch $today -and
                 $_.LastWriteTime -lt $cutoffDate
             }

    foreach ($f in $files) {
        try {
            $freedBytes += $f.Length
            Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop
            $removedCount++
        } catch {
            $skippedCount++   # Em uso ou sem permissao — pula
        }
    }
}

# ── 2. Rotacao de logs persistentes grandes ─────────────────────────────────
# *.out.log e *.err.log crescem indefinidamente (supervisor abre com 'flags: a').
# *.log pode incluir supervisor.log, backend-manual-run.log, etc.
# Estrategia: se > MaxFileSizeMB → renomeia para .1 (sobrescreve .1 anterior).
# O supervisor criara um novo arquivo vazio na proxima inicializacao.
$maxBytes       = [long]$MaxFileSizeMB * 1MB
$logPatterns    = @("*.out.log", "*.err.log", "*.log")

foreach ($pattern in $logPatterns) {
    $files = Get-ChildItem -Path $logsDir -Filter $pattern -ErrorAction SilentlyContinue |
             Where-Object { $_.Length -gt $maxBytes }

    foreach ($f in $files) {
        # Pular arquivos ja rotacionados (.log.1)
        if ($f.Extension -eq ".1") { continue }

        $backupPath = $f.FullName + ".1"
        try {
            # Remover backup anterior se existir
            if (Test-Path -LiteralPath $backupPath) {
                $bk = Get-Item -LiteralPath $backupPath
                $freedBytes += $bk.Length
                Remove-Item -LiteralPath $backupPath -Force -ErrorAction Stop
            }
            Rename-Item -LiteralPath $f.FullName -NewName ($f.Name + ".1") -ErrorAction Stop
            $rotatedCount++
        } catch {
            # Arquivo em uso (supervisor rodando) — pula sem quebrar
            $skippedCount++
        }
    }
}

# ── 3. Remover backups de rotacao muito antigos (.log.1 com > DaysToKeepBackups dias) ──
$cutoffBackup = (Get-Date).AddDays(-$DaysToKeepBackups)
$backups = Get-ChildItem -Path $logsDir -Filter "*.1" -ErrorAction SilentlyContinue |
           Where-Object { $_.LastWriteTime -lt $cutoffBackup }
foreach ($b in $backups) {
    try {
        $freedBytes += $b.Length
        Remove-Item -LiteralPath $b.FullName -Force -ErrorAction Stop
        $removedCount++
    } catch {
        $skippedCount++
    }
}

# ── Resumo ───────────────────────────────────────────────────────────────────
$freedMB = [math]::Round($freedBytes / 1MB, 1)

if ($removedCount -eq 0 -and $rotatedCount -eq 0) {
    Write-Host '  Logs OK - nenhuma acao necessaria.'
} else {
    if ($removedCount -gt 0) { Write-Host "  Removidos   : $removedCount arquivo(s)" }
    if ($rotatedCount -gt 0) { Write-Host "  Rotacionados: $rotatedCount arquivo(s)" }
    if ($skippedCount -gt 0) { Write-Host "  Pulados     : $skippedCount (em uso)" }
    if ($freedBytes   -gt 0) { Write-Host "  Liberado    : $freedMB MB" }
}
