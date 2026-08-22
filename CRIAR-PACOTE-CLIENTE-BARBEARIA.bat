@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Criar Pacote Barbearia
color 0B
cd /d "%~dp0"

echo ======================================================
echo   NYTHAR - DASHBOARD ^& CHATBOT - PACOTE BARBEARIA (dados redefinidos)
echo ======================================================
echo.
echo Isso vai:
echo   - Compilar o backend (versao mais recente)
echo   - Filtrar o banco: manter barbeiros, horarios,
echo     servicos, planos e configuracoes
echo   - Remover: agendamentos, clientes, sessoes,
echo     dias bloqueados e logs operacionais
echo   - Gerar ZIP pronto para o cliente
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-release-cliente.ps1"
if errorlevel 1 (
    color 0C
    echo.
    echo Falha ao gerar pacote. Veja as mensagens acima.
    pause
    exit /b 1
)

color 0A
echo.
echo Pacote gerado! Veja a pasta release.
pause
