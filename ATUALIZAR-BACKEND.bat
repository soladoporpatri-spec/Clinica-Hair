@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Atualizar Backend
color 0B

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ====================================================
echo    NYTHAR - DASHBOARD ^& CHATBOT - ATUALIZAR BACKEND PARA NOVA VERSAO
echo ====================================================
echo.

rem ────────────────────────────────────────────────────
rem [1/4] Sistema deve estar parado antes de atualizar
rem ────────────────────────────────────────────────────
echo [1/4] Verificando se o sistema esta parado...
netstat -aon | findstr LISTENING | findstr :5000 >nul 2>&1
if not errorlevel 1 (
    color 0C
    echo ERRO: O backend ainda esta rodando na porta 5000.
    echo Execute PARAR-SISTEMA-LOCAL.bat primeiro e depois rode este arquivo.
    pause
    exit /b 1
)
echo OK - Backend parado.

rem ────────────────────────────────────────────────────
rem [2/4] Compilar e publicar na pasta de staging
rem ────────────────────────────────────────────────────
echo.
echo [2/4] Compilando e publicando nova versao...
echo       (isso pode levar alguns segundos)

if exist "%ROOT%runtime\backend_staging" rmdir /s /q "%ROOT%runtime\backend_staging"

dotnet publish "%ROOT%WhatsAppBot.Worker\WhatsAppBot.Worker.csproj" ^
    -c Release ^
    -o "%ROOT%runtime\backend_staging" ^
    --self-contained false ^
    --no-restore ^
    -v minimal

if errorlevel 1 (
    color 0C
    echo.
    echo ERRO: Falha na compilacao do backend.
    echo Verifique os erros acima, corrija e tente novamente.
    pause
    exit /b 1
)

rem ────────────────────────────────────────────────────
rem [3/4] Verificar que o build gerou o DLL esperado
rem ────────────────────────────────────────────────────
echo.
echo [3/4] Verificando integridade do build...
if not exist "%ROOT%runtime\backend_staging\WhatsAppBot.Worker.dll" (
    color 0C
    echo ERRO: DLL nao encontrado em runtime\backend_staging\.
    echo O build pode ter falhado silenciosamente.
    pause
    exit /b 1
)
echo OK - Build verificado.

rem ────────────────────────────────────────────────────
rem [4/4] Substituir backend antigo pela nova versao
rem ────────────────────────────────────────────────────
echo.
echo [4/4] Substituindo backend antigo pela nova versao...
if exist "%ROOT%runtime\backend_old" rmdir /s /q "%ROOT%runtime\backend_old"
if exist "%ROOT%runtime\backend" (
    ren "%ROOT%runtime\backend" "backend_old"
    echo Versao antiga salva em runtime\backend_old\ como backup.
)
ren "%ROOT%runtime\backend_staging" "backend"
echo Nova versao ativa em runtime\backend\

echo.
echo ====================================================
echo  Backend atualizado com sucesso!
echo  Execute INICIAR-SISTEMA-LOCAL.bat para iniciar.
echo ====================================================
echo.
pause
