@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Reparar WhatsApp
color 0B

set "ROOT=%~dp0"
echo ====================================================
echo       NYTHAR - DASHBOARD ^& CHATBOT - REPARAR WHATSAPP
echo ====================================================
echo.
echo Este reparo preserva o QR, as credenciais e os dados da loja.
echo Nao execute o instalador novamente para recuperar uma queda comum.
echo.

echo [1/4] Encerrando processos antigos com seguranca...
if exist "%ROOT%scripts\stop-local.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\stop-local.ps1"
)

echo.
echo [2/4] Conferindo arquivos necessarios...
if not exist "%ROOT%WhatsAppBridge\index.js" goto :missing
if not exist "%ROOT%scripts\supervisor.js" goto :missing
if not exist "%ROOT%.env.local" goto :missing

echo.
echo [3/4] Conferindo dependencias do WhatsApp...
if not exist "%ROOT%node_modules\express\package.json" (
    pushd "%ROOT%"
    call npm ci --omit=dev
    if errorlevel 1 goto :npm_error_root
    popd
)
if not exist "%ROOT%WhatsAppBridge\node_modules\whatsapp-web.js\package.json" (
    set "PUPPETEER_SKIP_DOWNLOAD=1"
    pushd "%ROOT%WhatsAppBridge"
    call npm ci --omit=dev
    if errorlevel 1 goto :npm_error_bridge
    popd
    set "PUPPETEER_SKIP_DOWNLOAD="
)
if exist "%ROOT%scripts\instalar-chrome.js" node "%ROOT%scripts\instalar-chrome.js"

echo.
echo [4/4] Reiniciando o sistema e restaurando a sessao salva...
start "Nythar - Dashboard ^& Chatbot" "%ROOT%INICIAR-SISTEMA-LOCAL.bat"
echo.
echo Reparo concluido. Aguarde ate 60 segundos e confira o WhatsApp no painel.
echo Um novo QR so sera mostrado se o WhatsApp tiver encerrado o pareamento.
pause
exit /b 0

:npm_error_root
popd
goto :npm_error

:npm_error_bridge
popd
set "PUPPETEER_SKIP_DOWNLOAD="

:npm_error
color 0C
echo ERRO: nao foi possivel reparar as dependencias. Confira a internet e tente novamente.
pause
exit /b 1

:missing
color 0C
echo ERRO: a instalacao esta incompleta. Somente neste caso execute INSTALAR-CLIENTE.bat.
pause
exit /b 1
