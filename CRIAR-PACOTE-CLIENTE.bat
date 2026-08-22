@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Criar Pacote do Cliente
color 0B

cd /d "%~dp0"

echo ====================================================
echo      NYTHAR - DASHBOARD ^& CHATBOT - CRIAR PACOTE PROFISSIONAL
echo ====================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-release.ps1"
if errorlevel 1 (
    color 0C
    echo.
    echo Falha ao gerar pacote.
    pause
    exit /b 1
)

color 0A
echo.
echo Pacote gerado com sucesso.
echo Veja a pasta release.
pause
