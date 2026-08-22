@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Inicializacao Local
color 0B

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ====================================================
echo        NYTHAR - DASHBOARD ^& CHATBOT - INICIAR SISTEMA LOCAL
echo ====================================================
echo.

rem ================================================================
rem  Secrets e ambiente gerenciados pelo supervisor via .env.local
rem  Nao definir API_KEY, JWT_SECRET, ASPNETCORE_ENVIRONMENT aqui
rem  para que o supervisor.js carregue os valores unicos por cliente
rem ================================================================
set "BACKEND_URL=http://127.0.0.1:5000"
set "BRIDGE_URL=http://127.0.0.1:3000"
set "BRIDGE_HOST=127.0.0.1"
set "BRIDGE_PORT=3000"
set "DASHBOARD_HOST=127.0.0.1"
set "PORT=4000"
set "ASPNETCORE_URLS=http://127.0.0.1:5000"
set "CORS_ORIGINS=http://localhost:4000,http://127.0.0.1:4000,http://localhost:4040,http://127.0.0.1:4040"
set "START_NGROK=1"
set "OPEN_BROWSER=1"

if not exist "%ROOT%logs" mkdir "%ROOT%logs"
if not exist "%ROOT%data" mkdir "%ROOT%data"
if not exist "%ROOT%backups" mkdir "%ROOT%backups"

rem Permite iniciar diretamente após extrair o ZIP, sem sobrescrever os dados
rem e as credenciais já existentes em atualizações posteriores.
if not exist "%ROOT%data\agendamentos.db" if exist "%ROOT%data\agendamentos.seed.db" (
    copy /Y "%ROOT%data\agendamentos.seed.db" "%ROOT%data\agendamentos.db" >nul
    echo Banco inicial criado a partir do modelo do pacote.
)

if not exist "%ROOT%.env.local" (
    echo [Credenciais] .env.local ausente. Gerando credenciais desta instalacao...
    node "%ROOT%scripts\gerar-segredos.js"
    if errorlevel 1 (
        color 0C
        echo ERRO: falha ao gerar credenciais. Execute INSTALAR-CLIENTE.bat novamente.
        pause
        exit /b 1
    )
) else if not exist "%ROOT%CREDENCIAIS-ACESSO.txt" (
    echo [Credenciais] Atualizando arquivo CREDENCIAIS-ACESSO.txt...
    node "%ROOT%scripts\gerar-segredos.js" >nul
)

rem ── Guard: detectar sistema ja em execucao ────────────────────────────────
netstat -aon | findstr LISTENING | findstr :4000 >nul 2>&1
if not errorlevel 1 (
    color 0E
    echo.
    echo AVISO: A porta 4000 ja esta em uso.
    echo O sistema pode ja estar rodando — iniciar novamente pode causar conflitos.
    echo Para reiniciar corretamente, use PARAR-SISTEMA-LOCAL.bat antes.
    echo.
    echo Pressione qualquer tecla para continuar mesmo assim ^(ou feche esta janela^)...
    pause >nul
    color 0B
)

rem ── Limpeza preventiva de logs ^(leve, antes de iniciar^) ──────────────────
if exist "%ROOT%scripts\cleanup-logs.ps1" (
    echo [Manutencao] Verificando logs antigos...
    powershell -NoProfile -NonInteractive -WindowStyle Hidden -File "%ROOT%scripts\cleanup-logs.ps1" -DaysToKeep 30 -MaxFileSizeMB 20
)

echo [1/7] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo ERRO: Node.js nao encontrado no PATH.
    echo Instale Node.js 20 LTS e execute novamente.
    pause
    exit /b 1
)

echo [2/7] Verificando .NET / ASP.NET Core...
dotnet --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo ERRO: .NET nao encontrado no PATH.
    echo Execute INSTALAR-CLIENTE.bat ou instale o ASP.NET Core Runtime 8.
    pause
    exit /b 1
)

if exist "%ROOT%runtime\backend\WhatsAppBot.Worker.dll" (
    dotnet --list-runtimes | findstr /I "Microsoft.AspNetCore.App 8." >nul 2>&1
    if errorlevel 1 (
        color 0C
        echo ERRO: ASP.NET Core Runtime 8 nao encontrado.
        echo Execute INSTALAR-CLIENTE.bat ou instale o runtime da Microsoft.
        pause
        exit /b 1
    )
) else (
    if not exist "%ROOT%WhatsAppBot.Worker\WhatsAppBot.Worker.csproj" (
        color 0C
        echo ERRO: Backend publicado nao encontrado.
        echo Extraia o ZIP profissional novamente ou rode INSTALAR-CLIENTE.bat.
        pause
        exit /b 1
    )
    dotnet --list-sdks >nul 2>&1
    if errorlevel 1 (
        color 0C
        echo ERRO: Backend publicado nao encontrado e .NET SDK ausente.
        echo Rode INSTALAR-CLIENTE.bat pelo ZIP profissional ou instale o .NET SDK.
        pause
        exit /b 1
    )
)

echo [3/7] Verificando dependencias do Dashboard...
rem Checa express especificamente: node_modules pode existir mas estar vazia/incompleta
if not exist "%ROOT%node_modules\express" (
    echo   Instalando dependencias - primeira execucao ou instalacao incompleta...
    call npm install
    if errorlevel 1 (
        color 0C
        echo ERRO: falha ao instalar dependencias do Dashboard.
        echo Tente rodar manualmente: npm install
        pause
        exit /b 1
    )
)

echo [4/7] Verificando dependencias do WhatsApp Bridge...
rem Checa whatsapp-web.js especificamente pelo mesmo motivo
if not exist "%ROOT%WhatsAppBridge\node_modules\whatsapp-web.js" (
    echo   Instalando dependencias do WhatsApp Bridge...
    pushd "%ROOT%WhatsAppBridge"
    call npm install
    if errorlevel 1 (
        popd
        color 0C
        echo ERRO: falha ao instalar dependencias do WhatsApp Bridge.
        echo Tente rodar manualmente: entre na pasta WhatsAppBridge e rode npm install
        pause
        exit /b 1
    )
    popd
)

echo [5/7] Verificando ngrok...
where ngrok >nul 2>&1
if errorlevel 1 (
    echo AVISO: ngrok nao encontrado no PATH.
    echo O sistema abrira localmente em http://127.0.0.1:4000/dashboard-improved.html
    echo Para acesso externo, instale/configure ngrok e rode este arquivo novamente.
    set "START_NGROK=0"
) else (
    echo ngrok encontrado.
)

echo [6/7] Verificando integridade do codigo (testes automatizados)...
if exist "%ROOT%tests\api-security.test.js" (
    node --test "%ROOT%tests\api-security.test.js" > "%ROOT%logs\test-output.txt" 2>&1
    if errorlevel 1 (
        color 0C
        echo.
        echo ============================================================
        echo  FALHA NOS TESTES - SISTEMA NAO SERA INICIADO
        echo ============================================================
        echo.
        echo Um ou mais testes automatizados falharam.
        echo Isso indica um problema no codigo ou configuracao.
        echo.
        echo Detalhes completos em: %ROOT%logs\test-output.txt
        echo.
        echo --- Resumo dos testes ---
        findstr /I "pass\|fail\|skip\|error" "%ROOT%logs\test-output.txt"
        echo.
        echo Corrija os erros antes de iniciar o sistema.
        echo Se for um ambiente de desenvolvimento, rode:
        echo   node --test tests\api-security.test.js
        echo.
        pause
        exit /b 1
    ) else (
        for /f "tokens=*" %%L in ('findstr /I "pass\|fail\|skip" "%ROOT%logs\test-output.txt"') do echo   %%L
        echo   Todos os testes passaram. Prosseguindo...
    )
) else (
    echo   Pasta de testes nao encontrada. Pulando verificacao ^(ambiente publicado^).
)

echo [7/7] Iniciando supervisor local...
echo.
echo Feche esta janela apenas quando quiser parar o sistema.
echo Logs em: %ROOT%logs
echo.

node scripts\supervisor.js

echo.
echo Sistema encerrado.
pause
