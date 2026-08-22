@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Parar Sistema Local
color 0E

echo Parando servicos locais da Nythar - Dashboard ^& Chatbot...

set "ROOT=%~dp0"
if exist "%ROOT%scripts\stop-local.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\stop-local.ps1"
) else (
    for %%P in (2999 3000 3001 4000 5000 4040) do (
        for /f "tokens=5" %%A in ('netstat -aon ^| findstr LISTENING ^| findstr :%%P') do (
            echo Encerrando processo na porta %%P PID %%A
            taskkill /F /T /PID %%A >nul 2>&1
        )
    )
)

echo.
echo Processos encerrados. Se alguma janela antiga continuar aberta, pode fecha-la manualmente.
pause
