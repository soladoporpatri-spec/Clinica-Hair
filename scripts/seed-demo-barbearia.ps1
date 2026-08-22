param(
    [string]$BackendUrl = "http://127.0.0.1:5000",
    [string]$ApiKey = $env:API_KEY,
    [string]$DemoFile = "data/demo-barbearia.json"
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

    try {
        Invoke-RestMethod @params
    }
    catch {
        throw "Falha em $Method ${Path}: $($_.Exception.Message)"
    }
}

function Get-Prop {
    param([object]$Obj, [string[]]$Names)
    if ($null -eq $Obj) { return $null }

    if ($Obj -is [System.Collections.IDictionary]) {
        foreach ($name in $Names) {
            if ($Obj.Contains($name) -and $null -ne $Obj[$name]) { return $Obj[$name] }
        }
    }

    foreach ($name in $Names) {
        $prop = @($Obj.PSObject.Properties | Where-Object { $_.Name -ieq $name } | Select-Object -First 1)
        if ($prop.Count -gt 0 -and $null -ne $prop[0].Value) {
            $value = $prop[0].Value
            if ($value -is [array]) { return $value[0] }
            return $value
        }
    }
    return $null
}

function Normalize-Text([string]$Value) {
    if ($null -eq $Value) { return "" }
    return $Value.Trim().ToLowerInvariant()
}

function Get-DemoList {
    param([object]$Value)
    if ($null -eq $Value) { return @() }

    $data = Get-Prop $Value @("data", "Data")
    if ($null -ne $data) { return @(Get-DemoList $data) }

    $items = @()
    foreach ($item in @($Value)) {
        if ($null -eq $item) { continue }
        if ($item -is [System.Array]) {
            $items += @(Get-DemoList $item)
        } else {
            $items += $item
        }
    }

    return $items
}

Write-Host "== Demo Nythar =="
Write-Host "Backend: $base"

$stores = Get-DemoList (Invoke-DemoApi -Method GET -Path "/api/superadmin/stores")
$store = @($stores | Where-Object { (Get-Prop $_ @("slug", "Slug")) -eq $demo.store.slug }) | Select-Object -First 1

if ($null -eq $store) {
    Write-Host "Criando loja demo..."
    $store = Invoke-DemoApi -Method POST -Path "/api/superadmin/stores" -Body @{
        Name = $demo.store.name
        Slug = $demo.store.slug
        Plan = $demo.store.plan
        BusinessType = "Barbershop"
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

$settings = @{}
foreach ($prop in $demo.businessHours.PSObject.Properties) { $settings[$prop.Name] = [string]$prop.Value }
foreach ($prop in $demo.messages.PSObject.Properties) { $settings[$prop.Name] = [string]$prop.Value }
Invoke-DemoApi -Method POST -Path "/api/settings" -Headers $tenantHeaders -Body $settings | Out-Null
Write-Host "Configuracoes e mensagens aplicadas."

$existingServices = Get-DemoList (Invoke-DemoApi -Method GET -Path "/api/servicos" -Headers $tenantHeaders)
$desiredNames = @($demo.services | ForEach-Object { Normalize-Text $_.nome })

foreach ($svc in $demo.services) {
    $found = @($existingServices | Where-Object { (Normalize-Text (Get-Prop $_ @("name", "Name", "nome", "Nome"))) -eq (Normalize-Text $svc.nome) }) | Select-Object -First 1
    $body = @{
        Nome = $svc.nome
        DuracaoMinutos = [int]$svc.duracaoMinutos
        Preco = [decimal]$svc.preco
        Ativo = [bool]$svc.ativo
        Ordem = [int]$svc.ordem
        OcupaHorario = $true
    }

    if ($found) {
        $id = Get-Prop $found @("id", "Id")
        if ($null -ne $id -and [string]$id -ne "") {
            Invoke-DemoApi -Method PATCH -Path "/api/servicos/$id" -Headers $tenantHeaders -Body $body | Out-Null
        } else {
            Invoke-DemoApi -Method POST -Path "/api/servicos" -Headers $tenantHeaders -Body $body | Out-Null
        }
    } else {
        Invoke-DemoApi -Method POST -Path "/api/servicos" -Headers $tenantHeaders -Body $body | Out-Null
    }
}

$existingServices = Get-DemoList (Invoke-DemoApi -Method GET -Path "/api/servicos" -Headers $tenantHeaders)
foreach ($svc in $existingServices) {
    $name = Get-Prop $svc @("name", "Name", "nome", "Nome")
    if ($desiredNames -notcontains (Normalize-Text $name)) {
        $id = Get-Prop $svc @("id", "Id")
        if ($null -eq $id -or [string]$id -eq "") { continue }

        $duration = Get-Prop $svc @("durationMinutes", "DurationMinutes", "duracaoMinutos", "DuracaoMinutos")
        $price = Get-Prop $svc @("price", "Price", "preco", "Preco")
        $order = Get-Prop $svc @("ordem", "Ordem", "id", "Id")

        Invoke-DemoApi -Method PATCH -Path "/api/servicos/$id" -Headers $tenantHeaders -Body @{
            Nome = $name
            DuracaoMinutos = if ($null -ne $duration) { [int]$duration } else { 30 }
            Preco = if ($null -ne $price) { [decimal]$price } else { 0 }
            Ativo = $false
            Ordem = if ($null -ne $order) { [int]$order } else { [int]$id }
            OcupaHorario = $true
        } | Out-Null
    }
}
Write-Host "Servicos demo aplicados."

$existingPros = Get-DemoList (Invoke-DemoApi -Method GET -Path "/api/barbeiros" -Headers $tenantHeaders)
foreach ($pro in $demo.professionals) {
    $found = @($existingPros | Where-Object { (Normalize-Text (Get-Prop $_ @("nome", "Nome"))) -eq (Normalize-Text $pro.nome) }) | Select-Object -First 1
    if ($found) { continue }

    Invoke-DemoApi -Method POST -Path "/api/barbeiros" -Headers $tenantHeaders -Body @{
        Nome = $pro.nome
        Cor = $pro.cor
        Especialidade = $pro.especialidade
        Adicional = ""
        WorkStart = $pro.workStart
        WorkEnd = $pro.workEnd
        LunchStart = $pro.lunchStart
        LunchEnd = $pro.lunchEnd
        WorkingDays = @($pro.workingDays)
    } | Out-Null
}
Write-Host "Profissionais demo aplicados."

$services = Get-DemoList (Invoke-DemoApi -Method GET -Path "/api/servicos" -Headers $tenantHeaders)
$professionals = Get-DemoList (Invoke-DemoApi -Method GET -Path "/api/barbeiros" -Headers $tenantHeaders)
$existingAppointments = Invoke-DemoApi -Method GET -Path "/api/agendamentos?pageSize=200" -Headers $tenantHeaders
$existingData = Get-DemoList (Get-Prop $existingAppointments @("data", "Data"))

foreach ($appt in $demo.appointments) {
    $service = @($services | Where-Object { (Normalize-Text (Get-Prop $_ @("name", "Name", "nome", "Nome"))) -eq (Normalize-Text $appt.servico) }) | Select-Object -First 1
    $professional = @($professionals | Where-Object { (Normalize-Text (Get-Prop $_ @("nome", "Nome"))) -eq (Normalize-Text $appt.profissional) }) | Select-Object -First 1
    if (-not $service -or -not $professional) { continue }

    $date = (Get-Date).Date.AddDays([int]$appt.daysFromToday)
    $hourParts = ([string]$appt.hora).Split(":")
    $dateTime = $date.AddHours([int]$hourParts[0]).AddMinutes([int]$hourParts[1]).ToString("yyyy-MM-ddTHH:mm:ss")
    $alreadyExists = @($existingData | Where-Object {
        (Get-Prop $_ @("ContactName", "contactName")) -eq $appt.cliente -and
        ([string](Get-Prop $_ @("DateTime", "dateTime"))).StartsWith($dateTime.Substring(0, 16))
    }).Count -gt 0
    if ($alreadyExists) { continue }

    Invoke-DemoApi -Method POST -Path "/api/agendamentos" -Headers $tenantHeaders -Body @{
        ContactName = $appt.cliente
        PhoneNumber = $appt.telefone
        DateTime = $dateTime
        Servico = [string](Get-Prop $service @("id", "Id"))
        BarberId = [int](Get-Prop $professional @("id", "Id"))
        BarberName = $appt.profissional
        Notes = $appt.notes
    } | Out-Null
}
Write-Host "Agendamentos demo aplicados."

if ($demo.crm -and $demo.crm.profiles) {
    Invoke-DemoApi -Method GET -Path "/api/customer-tags" -Headers $tenantHeaders | Out-Null
    foreach ($crm in $demo.crm.profiles) {
        $phone = ([string]$crm.telefone) -replace "\D", ""
        if ([string]::IsNullOrWhiteSpace($phone)) { continue }

        Invoke-DemoApi -Method PATCH -Path "/api/customers/$phone" -Headers $tenantHeaders -Body @{
            DisplayName = $crm.nome
            ManualStatus = $crm.status
            InternalNotes = $crm.observacoes
            Preferences = $crm.preferencias
            ContactPreference = "WhatsApp"
        } | Out-Null

        foreach ($tagName in @($crm.tags)) {
            if ([string]::IsNullOrWhiteSpace([string]$tagName)) { continue }
            Invoke-DemoApi -Method POST -Path "/api/customers/$phone/tags" -Headers $tenantHeaders -Body @{
                Name = [string]$tagName
            } | Out-Null
        }

        Invoke-DemoApi -Method POST -Path "/api/customers/$phone/events" -Headers $tenantHeaders -Body @{
            Type = "demo"
            Title = "Cliente preparado para demo CRM"
            Description = "Perfil enriquecido com tags, observacoes e preferencias."
            VisibleToCustomer = $false
        } | Out-Null

        if (-not [string]::IsNullOrWhiteSpace([string]$crm.lembrete)) {
            Invoke-DemoApi -Method POST -Path "/api/customer-reminders" -Headers $tenantHeaders -Body @{
                CustomerKey = $phone
                Title = [string]$crm.lembrete
                Description = "Lembrete criado pelo seed da demo CRM."
                DueDate = (Get-Date).Date.AddDays(2).ToString("yyyy-MM-dd")
            } | Out-Null
        }
    }
    Write-Host "CRM demo aplicado: perfis, tags, eventos e lembretes."
}

Write-Host ""
Write-Host "Demo pronta:"
Write-Host "  Loja: $($demo.store.name)"
Write-Host "  Slug: $($demo.store.slug)"
Write-Host "  Usuario admin: $($demo.store.adminUsername)"
Write-Host "  Senha admin: $($demo.store.adminPassword)"
Write-Host "  Bot: $($demo.botScenario.mode) / $($demo.botScenario.bridgeUrl)"
