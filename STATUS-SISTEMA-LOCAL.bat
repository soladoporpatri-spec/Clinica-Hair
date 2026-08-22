@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Status Local
color 0F

set "ROOT=%~dp0"
set "API_KEY="
if exist "%ROOT%.env.local" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%.env.local") do (
        if /I "%%A"=="API_KEY" set "API_KEY=%%B"
    )
)

echo ====================================================
echo        NYTHAR - DASHBOARD ^& CHATBOT - STATUS LOCAL
echo ====================================================
echo.

echo [Portas]
netstat -aon | findstr LISTENING | findstr ":2999 :3001 :3002 :4000 :5000 :4040"
echo.

echo [Backend]
curl -s http://127.0.0.1:5000/health
echo.
echo.

echo [Dashboard]
curl -s http://127.0.0.1:4000/health
echo.
echo.

echo [Dashboard profundo]
curl -s http://127.0.0.1:4000/health/deep
echo.
echo.

echo [Bridge Factory]
curl -s http://127.0.0.1:2999/health
echo.
echo.

echo [Bridge Loja 1]
if defined API_KEY (
    curl -s -H "X-API-KEY: %API_KEY%" http://127.0.0.1:3001/status
) else (
    echo API_KEY ausente em .env.local; rode INSTALAR-CLIENTE.bat ou scripts\gerar-segredos.js.
)
echo.
echo.

echo [Ngrok]
curl -s http://127.0.0.1:4040/api/tunnels
echo.
echo.

echo Logs disponiveis na pasta logs.
pause
