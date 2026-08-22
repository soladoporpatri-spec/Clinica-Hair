@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Testar Login Local
color 0B

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ====================================================
echo      NYTHAR - DASHBOARD ^& CHATBOT - TESTE DE LOGIN LOCAL
echo ====================================================
echo.
echo Este teste deve ser executado com o sistema ja iniciado.
echo Ele usa as credenciais ativas de .env.local.
echo.

if not exist "%ROOT%.env.local" (
    color 0C
    echo ERRO: .env.local nao encontrado.
    echo Execute INSTALAR-CLIENTE.bat ou MOSTRAR-CREDENCIAIS.bat.
    pause
    exit /b 1
)

node "%ROOT%scripts\local-smoke.js"
if errorlevel 1 (
    color 0C
    echo.
    echo FALHA: o login local nao passou.
    echo Confirme se o sistema esta iniciado e veja os logs em %ROOT%logs.
    pause
    exit /b 1
)

color 0A
echo.
echo Login local testado com sucesso.
pause
