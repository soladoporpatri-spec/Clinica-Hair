[CmdletBinding()]
param()

$repository = [Environment]::GetEnvironmentVariable('CH_UPDATER_REPO')
$token = [Environment]::GetEnvironmentVariable('CH_UPDATER_TOKEN')

if ([string]::IsNullOrWhiteSpace($repository)) {
    Write-Output 'ERRO:Repositorio GitHub nao configurado.'
    exit 1
}

$headers = @{ 'User-Agent' = 'NytharDashboard-Updater' }
if (-not [string]::IsNullOrWhiteSpace($token) -and $token -notmatch '^ghp_COLE') {
    $headers['Authorization'] = "token $token"
}

try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repository/releases/latest" -Headers $headers -ErrorAction Stop
    $asset = $release.assets | Where-Object { $_.name -like 'NytharDashboard*.zip' } | Select-Object -First 1

    if ($null -eq $asset -or [string]::IsNullOrWhiteSpace($asset.browser_download_url)) {
        Write-Output 'ERRO:Release sem pacote NytharDashboard ZIP.'
        exit 1
    }

    Write-Output ("{0}|{1}" -f $release.tag_name, $asset.browser_download_url)
}
catch {
    Write-Output ("ERRO:{0}" -f $_.Exception.Message)
    exit 1
}
