@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
cd /d "%ROOT%"

if not exist "%ROOT%logs" mkdir "%ROOT%logs"
if not exist "%ROOT%data" mkdir "%ROOT%data"
if not exist "%ROOT%backups" mkdir "%ROOT%backups"

set "LOG_FILE=%ROOT%logs\autostart.log"

echo [%date% %time%] Iniciando Nythar em modo automatico...>> "%LOG_FILE%"

rem Se o dashboard ja estiver de pe, nao inicia outra instancia.
netstat -aon | findstr LISTENING | findstr :4000 >nul 2>&1
if not errorlevel 1 (
    echo [%date% %time%] Porta 4000 ja em uso; sistema provavelmente ja esta rodando.>> "%LOG_FILE%"
    exit /b 0
)

if not exist "%ROOT%.env.local" (
    echo [%date% %time%] .env.local ausente; gerando segredos locais.>> "%LOG_FILE%"
    node "%ROOT%scripts\gerar-segredos.js" >> "%LOG_FILE%" 2>&1
    if errorlevel 1 exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERRO: Node.js nao encontrado no PATH.>> "%LOG_FILE%"
    exit /b 1
)

where dotnet >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERRO: .NET nao encontrado no PATH.>> "%LOG_FILE%"
    exit /b 1
)

if not exist "%ROOT%node_modules\express" (
    echo [%date% %time%] Instalando dependencias do dashboard.>> "%LOG_FILE%"
    call npm install >> "%LOG_FILE%" 2>&1
    if errorlevel 1 exit /b 1
)

if not exist "%ROOT%WhatsAppBridge\node_modules\whatsapp-web.js" (
    echo [%date% %time%] Instalando dependencias do WhatsApp Bridge.>> "%LOG_FILE%"
    pushd "%ROOT%WhatsAppBridge"
    call npm install >> "%LOG_FILE%" 2>&1
    if errorlevel 1 (
        popd
        exit /b 1
    )
    popd
)

if exist "%ROOT%scripts\cleanup-logs.ps1" (
    powershell -NoProfile -NonInteractive -WindowStyle Hidden -File "%ROOT%scripts\cleanup-logs.ps1" -DaysToKeep 30 -MaxFileSizeMB 20 >> "%LOG_FILE%" 2>&1
)

set "START_NGROK=0"
set "OPEN_BROWSER=0"
set "OPEN_PUBLIC_DASHBOARD=0"

echo [%date% %time%] Subindo supervisor local sem navegador/ngrok.>> "%LOG_FILE%"
node "%ROOT%scripts\supervisor.js" >> "%LOG_FILE%" 2>&1

echo [%date% %time%] Supervisor encerrado.>> "%LOG_FILE%"
exit /b 0
