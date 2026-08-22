param(
    [string]$BackendUrl = "http://127.0.0.1:5000",
    [string]$ApiKey = $env:API_KEY,
    [string]$DemoFile = "data/demo-otimizacao-pc.json"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    throw "Informe -ApiKey ou defina a variavel de ambiente API_KEY."
}

if (-not (Test-Path -LiteralPath $DemoFile)) {
    throw "Arquivo de demo nao encontrado: $DemoFile"
}

$demo = Get-Content -LiteralPath $DemoFile -Raw | ConvertFrom-Json
$base = $BackendUrl.TrimEnd("/")
$superHeaders = @{ "X-API-KEY" = $ApiKey }

function Invoke-DemoApi {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [hashtable]$Headers = $superHeaders
    )

    $params = @{
        Method = $Method
        Uri = "$base$Path"
        Headers = $Headers
        TimeoutSec = 30
    }

    if ($null -ne $Body) {
        $params.ContentType = "application/json"
        $params.Body = ($Body | ConvertTo-Json -Depth 20)
    }

    Invoke-RestMethod @params
}

function Get-Prop {
    param([object]$Obj, [string[]]$Names)
    if ($null -eq $Obj) { return $null }
    foreach ($name in $Names) {
        $prop = @($Obj.PSObject.Properties | Where-Object { $_.Name -ieq $name } | Select-Object -First 1)
        if ($prop.Count -gt 0 -and $null -ne $prop[0].Value) { return $prop[0].Value }
    }
    return $null
}

function Normalize-Text([string]$Value) {
    if ($null -eq $Value) { return "" }
    return $Value.Trim().ToLowerInvariant()
}

function Get-List {
    param([object]$Value)
    if ($null -eq $Value) { return @() }
    $data = Get-Prop $Value @("data", "Data")
    if ($null -ne $data) { return @(Get-List $data) }
    return @($Value)
}

function Set-TicketStatus {
    param([int]$TicketId, [string]$TargetStatus)

    $paths = @{
        "Triagem" = @("Triagem")
        "Agendado" = @("Agendado")
        "AguardandoCliente" = @("Triagem", "AguardandoCliente")
        "EmOtimizacao" = @("Triagem", "EmOtimizacao")
        "EmRevisao" = @("Triagem", "EmOtimizacao", "EmRevisao")
        "Pronto" = @("Triagem", "EmOtimizacao", "Pronto")
        "Concluido" = @("Triagem", "EmOtimizacao", "Pronto", "Concluido")
        "Cancelado" = @("Cancelado")
    }

    if (-not $paths.ContainsKey($TargetStatus)) { return }
    foreach ($status in $paths[$TargetStatus]) {
        Invoke-DemoApi -Method PATCH -Path "/api/optimization/tickets/$TicketId/status" -Headers $tenantHeaders -Body @{
            Status = $status
            Message = "Status demo: $status"
        } | Out-Null
    }
}

Write-Host "== Demo CoreBoost Otimizacoes =="
Write-Host "Backend: $base"

$stores = Get-List (Invoke-DemoApi -Method GET -Path "/api/superadmin/stores")
$store = @($stores | Where-Object { (Get-Prop $_ @("slug", "Slug")) -eq $demo.store.slug }) | Select-Object -First 1

if ($null -eq $store) {
    Write-Host "Criando loja demo..."
    $store = Invoke-DemoApi -Method POST -Path "/api/superadmin/stores" -Body @{
        Name = $demo.store.name
        Slug = $demo.store.slug
        Plan = $demo.store.plan
        BusinessType = "ComputerOptimization"
        AdminUsername = $demo.store.adminUsername
        AdminPassword = $demo.store.adminPassword
    }
} else {
    Write-Host "Loja demo ja existe. Reutilizando."
}

$storeId = Get-Prop $store @("id", "Id")
if (-not $storeId) { throw "Nao foi possivel resolver o ID da loja demo." }

$tenantHeaders = @{
    "X-API-KEY" = $ApiKey
    "X-Store-Id" = [string]$storeId
    "X-User-Role" = "admin"
}

Write-Host "StoreId: $storeId"

$existingServices = Get-List (Invoke-DemoApi -Method GET -Path "/api/servicos" -Headers $tenantHeaders)
foreach ($svc in $demo.services) {
    $found = @($existingServices | Where-Object { (Normalize-Text (Get-Prop $_ @("name", "Name", "nome", "Nome"))) -eq (Normalize-Text $svc.name) }) | Select-Object -First 1
    $body = @{
        Nome = $svc.name
        DuracaoMinutos = [int]$svc.durationMinutes
        Preco = [decimal]$svc.price
        Ativo = $true
        OcupaHorario = $true
    }
    if ($found) {
        Invoke-DemoApi -Method PATCH -Path "/api/servicos/$(Get-Prop $found @('id','Id'))" -Headers $tenantHeaders -Body $body | Out-Null
    } else {
        Invoke-DemoApi -Method POST -Path "/api/servicos" -Headers $tenantHeaders -Body $body | Out-Null
    }
}
Write-Host "Servicos aplicados."

$services = Get-List (Invoke-DemoApi -Method GET -Path "/api/servicos" -Headers $tenantHeaders)
$deviceIds = @{}
foreach ($device in $demo.devices) {
    $created = Invoke-DemoApi -Method POST -Path "/api/optimization/devices" -Headers $tenantHeaders -Body @{
        CustomerName = $device.customerName
        PhoneNumber = $device.phoneNumber
        DeviceType = $device.deviceType
        OperatingSystem = $device.operatingSystem
        Processor = $device.processor
        Gpu = $device.gpu
        RamGb = [int]$device.ramGb
        StorageType = $device.storageType
        MainUse = $device.mainUse
        Notes = $device.notes
    }
    $deviceIds[$device.phoneNumber] = Get-Prop $created @("id", "Id")
}
Write-Host "Computadores aplicados."

foreach ($ticket in $demo.tickets) {
    $service = @($services | Where-Object { (Normalize-Text (Get-Prop $_ @("name", "Name", "nome", "Nome"))) -eq (Normalize-Text $ticket.serviceName) }) | Select-Object -First 1
    $created = Invoke-DemoApi -Method POST -Path "/api/optimization/tickets" -Headers $tenantHeaders -Body @{
        CustomerName = $ticket.customerName
        PhoneNumber = $ticket.phoneNumber
        OptimizationDeviceId = $deviceIds[$ticket.phoneNumber]
        ServiceId = Get-Prop $service @("id", "Id")
        ServiceMode = $ticket.serviceMode
        Goal = $ticket.goal
        ReportedProblem = $ticket.reportedProblem
        Urgency = $ticket.urgency
        EstimatedAmount = [decimal]$ticket.estimatedAmount
        FinalAmount = if ($ticket.finalAmount) { [decimal]$ticket.finalAmount } else { $null }
    }
    $ticketId = Get-Prop $created @("id", "Id")
    if ($ticket.status -and $ticket.status -ne "Novo") {
        try {
            Set-TicketStatus -TicketId ([int]$ticketId) -TargetStatus ([string]$ticket.status)
        } catch {
            Write-Warning "Status demo nao aplicado para ticket $ticketId: $($_.Exception.Message)"
        }
    }
}
Write-Host "Tickets aplicados."
Write-Host ""
Write-Host "Demo pronta:"
Write-Host "  Loja: $($demo.store.name)"
Write-Host "  Slug: $($demo.store.slug)"
Write-Host "  Usuario admin: $($demo.store.adminUsername)"
Write-Host "  Senha admin: $($demo.store.adminPassword)"
