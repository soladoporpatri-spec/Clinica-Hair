@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Credenciais de Acesso
color 0B

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ====================================================
echo      NYTHAR - DASHBOARD ^& CHATBOT - CREDENCIAIS DE ACESSO
echo ====================================================
echo.

node "%ROOT%scripts\gerar-segredos.js"
if errorlevel 1 (
    color 0C
    echo.
    echo ERRO: nao foi possivel ler ou gerar as credenciais.
    echo Verifique se Node.js esta instalado e tente novamente.
    pause
    exit /b 1
)

echo.
echo As mesmas credenciais foram salvas em:
echo %ROOT%CREDENCIAIS-ACESSO.txt
echo.
pause
