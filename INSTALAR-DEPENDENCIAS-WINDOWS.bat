@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Instalar Dependencias
color 0B

echo ====================================================
echo      NYTHAR - DASHBOARD ^& CHATBOT - INSTALAR DEPENDENCIAS
echo ====================================================
echo.

where winget >nul 2>&1
if errorlevel 1 (
    color 0C
    echo ERRO: winget nao encontrado.
    echo Instale manualmente:
    echo - Node.js 20 LTS: https://nodejs.org
    echo - .NET SDK 8: https://dotnet.microsoft.com/download
    echo - ngrok: https://ngrok.com/download
    pause
    exit /b 1
)

echo [1/4] Instalando Node.js 20 LTS...
winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements

echo.
echo [2/4] Instalando .NET SDK 8...
winget install Microsoft.DotNet.SDK.8 --accept-source-agreements --accept-package-agreements

echo.
echo [3/4] Instalando ngrok...
winget install Ngrok.Ngrok --accept-source-agreements --accept-package-agreements

echo.
echo [4/4] Instalando dependencias do projeto...
cd /d "%~dp0"
call npm install
if errorlevel 1 (
    color 0C
    echo ERRO: falha no npm install da dashboard.
    pause
    exit /b 1
)

pushd "%~dp0WhatsAppBridge"
call npm install
if errorlevel 1 (
    popd
    color 0C
    echo ERRO: falha no npm install da bridge.
    pause
    exit /b 1
)
popd

color 0A
echo.
echo Dependencias instaladas.
echo Reinicie o computador antes de executar INICIAR-SISTEMA-LOCAL.bat.
pause
