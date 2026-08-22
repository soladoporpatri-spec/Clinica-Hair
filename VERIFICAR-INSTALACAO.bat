@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Verificar Instalacao

set "ROOT=%~dp0"
cd /d "%ROOT%"
set "SILENT=%~1"

echo Verificando instalacao da Nythar - Dashboard ^& Chatbot...
echo.

set "FAIL=0"

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado.
    set "FAIL=1"
) else (
    for /f "delims=" %%V in ('node --version') do echo [OK] Node.js %%V
)

dotnet --list-runtimes | findstr /I "Microsoft.AspNetCore.App 8." >nul 2>&1
if errorlevel 1 (
    echo [ERRO] ASP.NET Core Runtime 8 nao encontrado.
    set "FAIL=1"
) else (
    echo [OK] ASP.NET Core Runtime 8 encontrado.
)

if not exist "%ROOT%runtime\backend\WhatsAppBot.Worker.dll" (
    if exist "%ROOT%WhatsAppBot.Worker\WhatsAppBot.Worker.csproj" (
        dotnet --list-sdks >nul 2>&1
        if errorlevel 1 (
            echo [ERRO] Backend publicado ausente e .NET SDK nao encontrado.
            set "FAIL=1"
        ) else (
            echo [OK] Backend publicado ausente, mas codigo-fonte e SDK permitem execucao em modo desenvolvimento.
        )
    ) else (
        echo [ERRO] Backend publicado ausente em runtime\backend.
        set "FAIL=1"
    )
) else (
    echo [OK] Backend publicado encontrado.
)

if not exist "%ROOT%node_modules" (
    echo [ERRO] Dependencias da dashboard ausentes.
    set "FAIL=1"
) else (
    echo [OK] Dependencias da dashboard instaladas.
)

if not exist "%ROOT%WhatsAppBridge\node_modules" (
    echo [ERRO] Dependencias do WhatsApp Bridge ausentes.
    set "FAIL=1"
) else (
    echo [OK] Dependencias do WhatsApp Bridge instaladas.
)

if not exist "%ROOT%data" mkdir "%ROOT%data"
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
if not exist "%ROOT%backups" mkdir "%ROOT%backups"
echo [OK] Pastas operacionais prontas.

if not exist "%ROOT%.env.local" (
    echo [ERRO] Credenciais ausentes: .env.local nao encontrado.
    echo       Execute INSTALAR-CLIENTE.bat ou MOSTRAR-CREDENCIAIS.bat.
    set "FAIL=1"
) else (
    echo [OK] Arquivo de credenciais .env.local encontrado.
    if not exist "%ROOT%CREDENCIAIS-ACESSO.txt" (
        node "%ROOT%scripts\gerar-segredos.js" >nul 2>&1
    )
    if exist "%ROOT%CREDENCIAIS-ACESSO.txt" (
        echo [OK] CREDENCIAIS-ACESSO.txt pronto.
    ) else (
        echo [ERRO] Nao foi possivel gerar CREDENCIAIS-ACESSO.txt.
        set "FAIL=1"
    )
)

node --check "%ROOT%api-nythar.js" >nul 2>&1
if errorlevel 1 (
    echo [ERRO] api-nythar.js com erro de sintaxe.
    set "FAIL=1"
) else (
    echo [OK] Dashboard API com sintaxe valida.
)

node --check "%ROOT%script-dashboard.js" >nul 2>&1
if errorlevel 1 (
    echo [ERRO] script-dashboard.js com erro de sintaxe.
    set "FAIL=1"
) else (
    echo [OK] Dashboard frontend com sintaxe valida.
)

node --check "%ROOT%WhatsAppBridge\index.js" >nul 2>&1
if errorlevel 1 (
    echo [ERRO] WhatsAppBridge\index.js com erro de sintaxe.
    set "FAIL=1"
) else (
    echo [OK] WhatsApp Bridge com sintaxe valida.
)

echo.
if "%FAIL%"=="0" (
    echo Verificacao concluida: instalacao pronta.
) else (
    echo Verificacao encontrou problemas.
)

if /I not "%SILENT%"=="/silent" pause
exit /b %FAIL%
