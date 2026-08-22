@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Nythar - Remover Inicializacao Automatica
color 0B

set "TASK_NAME=NytharAutoStart"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=!STARTUP_FOLDER!\Nythar-Autostart.vbs"
set "OLD_TASK_NAME=SistemaAgendamentoAutoStart"
set "OLD_SHORTCUT_PATH=!STARTUP_FOLDER!\NytharDashboard-Autostart.bat"
set "REMOVED_SOMETHING=0"

echo =====================================================
echo   NYTHAR - REMOVER INICIO AUTOMATICO
echo =====================================================
echo.

rem ── Remover tarefa do Agendador (requer Admin) ────────────────────────────
net session >nul 2>&1
if not errorlevel 1 (
    schtasks /query /tn "!TASK_NAME!" >nul 2>&1
    if not errorlevel 1 (
        echo  Removendo tarefa agendada: !TASK_NAME!...
        schtasks /delete /tn "!TASK_NAME!" /f >nul 2>&1
        if errorlevel 1 (
            color 0C
            echo ERRO: Nao foi possivel remover a tarefa agendada.
            echo  Tente executar este script como Administrador.
            echo.
        ) else (
            echo  Tarefa agendada removida.
            set "REMOVED_SOMETHING=1"
        )
    )
    schtasks /query /tn "!OLD_TASK_NAME!" >nul 2>&1
    if not errorlevel 1 (
        echo  Removendo tarefa antiga: !OLD_TASK_NAME!...
        schtasks /delete /tn "!OLD_TASK_NAME!" /f >nul 2>&1
        if not errorlevel 1 set "REMOVED_SOMETHING=1"
    )
) else (
    rem Sem admin — apenas informa se a tarefa existe, mas nao pode remover
    schtasks /query /tn "!TASK_NAME!" >nul 2>&1
    if not errorlevel 1 (
        color 0E
        echo  AVISO: A tarefa '!TASK_NAME!' existe no Agendador de Tarefas,
        echo  mas remocao requer permissao de Administrador.
        echo  Execute este script como Administrador para remove-la,
        echo  ou use: Painel de Controle ^> Agendador de Tarefas.
        echo.
        color 0B
    )
)

rem ── Remover atalho da pasta Startup (nao requer Admin) ────────────────────
if exist "!SHORTCUT_PATH!" (
    echo  Removendo atalho da pasta Startup...
    del /q "!SHORTCUT_PATH!" >nul 2>&1
    if errorlevel 1 (
        color 0C
        echo ERRO: Nao foi possivel remover: !SHORTCUT_PATH!
        echo.
        color 0B
    ) else (
        echo  Atalho da pasta Startup removido.
        set "REMOVED_SOMETHING=1"
    )
)

if exist "!OLD_SHORTCUT_PATH!" (
    echo  Removendo atalho antigo da pasta Startup...
    del /q "!OLD_SHORTCUT_PATH!" >nul 2>&1
    if not errorlevel 1 set "REMOVED_SOMETHING=1"
)

rem ── Resultado ─────────────────────────────────────────────────────────────
echo.
if "!REMOVED_SOMETHING!"=="1" (
    color 0A
    echo =====================================================
    echo  INICIO AUTOMATICO REMOVIDO COM SUCESSO!
    echo.
    echo  O sistema Nythar nao iniciara mais
    echo  automaticamente com o Windows.
    echo.
    echo  Para reativar, execute:
    echo  INSTALAR-INICIO-AUTOMATICO.bat
    echo =====================================================
) else (
    color 0E
    echo  Nenhuma configuracao de inicio automatico encontrada.
    echo  O inicio automatico ja estava desativado ou nao configurado.
)

echo.
pause
