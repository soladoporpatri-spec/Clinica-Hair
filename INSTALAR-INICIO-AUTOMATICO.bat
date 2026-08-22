@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Nythar - Inicializacao Automatica com Windows
color 0B

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo =====================================================
echo   NYTHAR - INSTALAR INICIO AUTOMATICO
echo =====================================================
echo.
echo  Esta configuracao faz o sistema iniciar automaticamente
echo  toda vez que o computador for ligado e o usuario fizer login.
echo.

rem ── Caminhos absolutos ───────────────────────────────────────────────────
set "BAT_PATH=%ROOT%INICIAR-AUTOMATICO.bat"
set "TASK_NAME=NytharAutoStart"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=!STARTUP_FOLDER!\Nythar-Autostart.vbs"

if not exist "!BAT_PATH!" (
    color 0C
    echo ERRO: INICIAR-AUTOMATICO.bat nao encontrado em:
    echo  !BAT_PATH!
    echo.
    echo Verifique se este arquivo esta na pasta correta do sistema.
    pause & exit /b 1
)

echo  Sistema encontrado em:
echo  !BAT_PATH!
echo.

rem ── Verificar permissoes de administrador ────────────────────────────────
net session >nul 2>&1
if not errorlevel 1 (
    echo  Permissoes de administrador: OK
    goto :install_task_scheduler
) else (
    echo  Sem permissao de administrador.
    echo  Usando metodo alternativo (pasta Startup)...
    echo.
    goto :install_startup_folder
)

rem ════════════════════════════════════════════════════════════════════════
:install_task_scheduler
rem ════════════════════════════════════════════════════════════════════════
echo  Configurando tarefa no Agendador de Tarefas do Windows...
echo.

powershell -NoProfile -NonInteractive -Command ^
    "$ErrorActionPreference = 'Stop'; try { $cmd = '/c \"\"!BAT_PATH!\"\"'; $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $cmd -WorkingDirectory '!ROOT!'; $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME; $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable $true; $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest; Register-ScheduledTask -TaskName '!TASK_NAME!' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null; Write-Output 'OK' } catch { Write-Output ('ERRO:' + $_.Exception.Message) }" ^
    > "%TEMP%\ch_task_result.txt" 2>&1

set /p TASK_RESULT=<"%TEMP%\ch_task_result.txt"
del /q "%TEMP%\ch_task_result.txt" >nul 2>&1

if "!TASK_RESULT!"=="OK" (
    color 0A
    echo =====================================================
    echo  INICIO AUTOMATICO CONFIGURADO COM SUCESSO!
    echo  (Metodo: Agendador de Tarefas do Windows)
    echo.
    echo  Tarefa : !TASK_NAME!
    echo  Disparo: Login do usuario !USERNAME!
    echo.
    echo  A partir de agora o sistema Nythar iniciara
    echo  automaticamente quando o computador for ligado.
    echo.
    echo  Para remover, execute: REMOVER-INICIO-AUTOMATICO.bat
    echo =====================================================
    echo.
    pause
    exit /b 0
) else (
    echo  Agendador de Tarefas falhou: !TASK_RESULT!
    echo  Tentando metodo alternativo (pasta Startup)...
    echo.
    goto :install_startup_folder
)

rem ════════════════════════════════════════════════════════════════════════
:install_startup_folder
rem ════════════════════════════════════════════════════════════════════════
echo  Instalando na pasta de Inicializacao do Windows...
echo  (Nao requer permissao de administrador)
echo.

if not exist "!STARTUP_FOLDER!" (
    color 0C
    echo ERRO: Pasta Startup nao encontrada:
    echo  !STARTUP_FOLDER!
    echo.
    echo  Solucao manual: adicione INICIAR-AUTOMATICO.bat
    echo  na pasta  shell:startup  do Windows Explorer.
    pause & exit /b 1
)

rem Criar launcher oculto na pasta Startup
(
    echo Set shell = CreateObject("WScript.Shell"^)
    echo shell.Run "cmd.exe /c ""!BAT_PATH!""", 0, False
) > "!SHORTCUT_PATH!"

if errorlevel 1 (
    color 0C
    echo ERRO: Nao foi possivel criar arquivo em:
    echo  !SHORTCUT_PATH!
    echo.
    echo  Solucao manual: adicione INICIAR-AUTOMATICO.bat
    echo  na pasta  shell:startup  do Windows Explorer.
    pause & exit /b 1
)

color 0A
echo =====================================================
echo  INICIO AUTOMATICO CONFIGURADO COM SUCESSO!
echo  (Metodo: Pasta de Inicializacao do Windows)
echo.
echo  Arquivo: !SHORTCUT_PATH!
echo.
echo  A partir de agora o sistema Nythar iniciara
echo  automaticamente quando o computador for ligado.
echo.
echo  Para remover, execute: REMOVER-INICIO-AUTOMATICO.bat
echo =====================================================
echo.
pause
exit /b 0
