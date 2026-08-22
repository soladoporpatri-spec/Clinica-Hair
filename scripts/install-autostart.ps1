param(
    [Parameter(Mandatory = $true)]
    [string]$RootPath,
    [string]$DestinationPath = ""
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path -LiteralPath $RootPath).Path
$startBatch = Join-Path $root "INICIAR-AUTOMATICO.bat"

if (!(Test-Path -LiteralPath $startBatch)) {
    throw "INICIAR-AUTOMATICO.bat nao encontrado em: $root"
}

if ([string]::IsNullOrWhiteSpace($DestinationPath)) {
    $startup = [Environment]::GetFolderPath("Startup")
    $DestinationPath = Join-Path $startup "NytharDashboard-Autostart.vbs"
}

$destinationDirectory = Split-Path -Parent $DestinationPath
New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
$escapedBatch = $startBatch.Replace('"', '""')
$content = @"
Set shell = CreateObject("WScript.Shell")
shell.Run "cmd.exe /c ""$escapedBatch""", 0, False
"@

# VBScript aceita UTF-16 LE; isso preserva caminhos Windows com acentos.
[System.IO.File]::WriteAllText($DestinationPath, $content, [System.Text.Encoding]::Unicode)

# Remove somente o launcher da marca antiga. O pareamento do WhatsApp, o banco
# e os demais dados da instalacao nao sao tocados.
$startupDirectory = Split-Path -Parent $DestinationPath
$legacyLauncherName = ("Clinica", "Hair-Autostart.vbs" -join "")
$legacyLauncher = Join-Path $startupDirectory $legacyLauncherName
if ($legacyLauncher -ne $DestinationPath -and (Test-Path -LiteralPath $legacyLauncher)) {
    Remove-Item -LiteralPath $legacyLauncher -Force
}

Write-Host "Inicio automatico configurado: $DestinationPath"
