@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Atualizar Sistema

set "UPDATER=%~dp0scripts\update-system.ps1"
if not exist "%UPDATER%" (
    color 0C
    echo ERRO: Componente de atualizacao nao encontrado.
    echo Reinstale o pacote Nythar - Dashboard ^& Chatbot completo.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%UPDATER%" %*
exit /b %ERRORLEVEL%
