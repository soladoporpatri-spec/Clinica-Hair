@echo off
setlocal EnableExtensions
title Nythar - Dashboard ^& Chatbot - Instalacao Profissional
color 0B

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ====================================================
echo      NYTHAR - DASHBOARD ^& CHATBOT - INSTALACAO PROFISSIONAL
echo ====================================================
echo.

if not exist "%ROOT%logs" mkdir "%ROOT%logs"
if not exist "%ROOT%data" mkdir "%ROOT%data"
if not exist "%ROOT%backups" mkdir "%ROOT%backups"

rem O ZIP traz somente um banco-modelo sem credenciais. Nunca sobrescrever o
rem banco operacional: ele guarda usuários, senhas e dados desta instalação.
if not exist "%ROOT%data\agendamentos.db" if exist "%ROOT%data\agendamentos.seed.db" (
    copy /Y "%ROOT%data\agendamentos.seed.db" "%ROOT%data\agendamentos.db" >nul
    echo Banco inicial criado a partir do modelo do pacote.
)

echo [1/6] Verificando Node.js 20 LTS...
node --version >nul 2>&1
if errorlevel 1 (
    where winget >nul 2>&1
    if errorlevel 1 (
        color 0C
        echo ERRO: Node.js nao encontrado e winget indisponivel.
        echo Instale Node.js 20 LTS manualmente: https://nodejs.org
        pause
        exit /b 1
    )
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
)
node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo ERRO: Node.js ainda nao esta disponivel. Reinicie o computador e rode este instalador novamente.
    pause
    exit /b 1
)

echo.
echo [1b] Gerando segredos unicos para esta instalacao...
node "%ROOT%scripts\gerar-segredos.js"
if errorlevel 1 (
    color 0C
    echo ERRO: falha ao gerar segredos. Verifique se Node.js esta no PATH.
    pause
    exit /b 1
)
echo.
echo Credenciais ativas salvas em:
echo   %ROOT%CREDENCIAIS-ACESSO.txt
if exist "%ROOT%CREDENCIAIS-ACESSO.txt" (
    echo.
    type "%ROOT%CREDENCIAIS-ACESSO.txt"
)

echo.
echo [2/6] Verificando ASP.NET Core Runtime 8...
dotnet --list-runtimes | findstr /I "Microsoft.AspNetCore.App 8." >nul 2>&1
if errorlevel 1 (
    where winget >nul 2>&1
    if errorlevel 1 (
        color 0C
        echo ERRO: ASP.NET Core Runtime 8 nao encontrado e winget indisponivel.
        echo Instale manualmente: https://dotnet.microsoft.com/download/dotnet/8.0
        pause
        exit /b 1
    )
    winget install Microsoft.DotNet.AspNetCore.8 --accept-source-agreements --accept-package-agreements
)
dotnet --list-runtimes | findstr /I "Microsoft.AspNetCore.App 8." >nul 2>&1
if errorlevel 1 (
    color 0C
    echo ERRO: Runtime .NET 8 ainda nao esta disponivel. Reinicie o computador e rode este instalador novamente.
    pause
    exit /b 1
)

echo.
echo [3/6] Conferindo backend publicado...
if not exist "%ROOT%runtime\backend\WhatsAppBot.Worker.dll" (
    if exist "%ROOT%WhatsAppBot.Worker\WhatsAppBot.Worker.csproj" (
        echo Backend publicado nao encontrado, mas o codigo-fonte existe.
        echo Publicando backend localmente em runtime\backend...
        dotnet --list-sdks >nul 2>&1
        if errorlevel 1 (
            color 0C
            echo ERRO: .NET SDK nao encontrado para publicar o backend.
            echo No computador do cliente, use o ZIP gerado por CRIAR-PACOTE-CLIENTE.bat.
            pause
            exit /b 1
        )
        if not exist "%ROOT%runtime\backend" mkdir "%ROOT%runtime\backend"
        dotnet publish "%ROOT%WhatsAppBot.Worker\WhatsAppBot.Worker.csproj" -c Release -o "%ROOT%runtime\backend" --self-contained false
        if errorlevel 1 (
            color 0C
            echo ERRO: falha ao publicar o backend localmente.
            pause
            exit /b 1
        )
    ) else (
        color 0C
        echo ERRO: runtime\backend\WhatsAppBot.Worker.dll nao encontrado.
        echo Este instalador precisa ser executado dentro da pasta extraida do ZIP profissional.
        echo Extraia o NytharDashboard-Instalador.zip em C:\NytharDashboard e execute INSTALAR-CLIENTE.bat de la.
        pause
        exit /b 1
    )
)

echo.
echo [4/6] Instalando dependencias da dashboard...
if exist "%ROOT%package-lock.json" (
    call npm ci --omit=dev
) else (
    call npm install --omit=dev
)
if errorlevel 1 (
    color 0C
    echo ERRO: falha ao instalar dependencias da dashboard.
    pause
    exit /b 1
)

echo.
echo [5/6] Instalando dependencias do WhatsApp Bridge...
rem PUPPETEER_SKIP_DOWNLOAD=1 impede que o puppeteer baixe o Chrome durante o npm install.
rem O Chrome sera resolvido no passo 5b abaixo (sistema ou download dedicado).
set "PUPPETEER_SKIP_DOWNLOAD=1"
pushd "%ROOT%WhatsAppBridge"
if exist "package-lock.json" (
    call npm ci --omit=dev
) else (
    call npm install --omit=dev
)
if errorlevel 1 (
    popd
    set "PUPPETEER_SKIP_DOWNLOAD="
    color 0C
    echo ERRO: falha ao instalar dependencias do WhatsApp Bridge.
    pause
    exit /b 1
)
popd
set "PUPPETEER_SKIP_DOWNLOAD="

echo.
echo [5b] Configurando Chrome para WhatsApp Bridge...
node "%ROOT%scripts\instalar-chrome.js"
if errorlevel 1 (
    color 0E
    echo   AVISO: Chrome nao configurado automaticamente.
    echo   O bot tentara usar o Google Chrome instalado no computador.
    echo   Se falhar ao conectar ao WhatsApp, instale o Google Chrome e reinicie.
    color 0B
) else (
    echo   Chrome OK.
)

echo.
echo [6/6] Criando atalhos na area de trabalho...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell); $l=$s.CreateShortcut((Join-Path $d 'Nythar - Dashboard ^& Chatbot - Iniciar.lnk')); $l.TargetPath=(Join-Path '%ROOT%' 'INICIAR-SISTEMA-LOCAL.bat'); $l.WorkingDirectory='%ROOT%'; $l.Save(); $l=$s.CreateShortcut((Join-Path $d 'Nythar - Dashboard ^& Chatbot - Status.lnk')); $l.TargetPath=(Join-Path '%ROOT%' 'STATUS-SISTEMA-LOCAL.bat'); $l.WorkingDirectory='%ROOT%'; $l.Save(); $l=$s.CreateShortcut((Join-Path $d 'Nythar - Dashboard ^& Chatbot - Reparar WhatsApp.lnk')); $l.TargetPath=(Join-Path '%ROOT%' 'REPARAR-WHATSAPP.bat'); $l.WorkingDirectory='%ROOT%'; $l.Save()"

echo.
echo [+] Configurando inicio automatico apos entrar no Windows...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\install-autostart.ps1" -RootPath "%ROOT%"
if errorlevel 1 (
    color 0E
    echo   AVISO: nao foi possivel ativar o inicio automatico.
    echo   Use o atalho "Nythar - Dashboard ^& Chatbot - Iniciar" apos ligar o computador.
    color 0B
) else (
    echo   Inicio automatico configurado.
)

echo.
echo [+] Configurando backup automatico diario (03:15)...
set "LEGACY_BACKUP_TASK=Clinica"
set "LEGACY_BACKUP_TASK=%LEGACY_BACKUP_TASK%Hair-Backup"
schtasks /query /tn "%LEGACY_BACKUP_TASK%" >nul 2>&1
if not errorlevel 1 schtasks /delete /tn "%LEGACY_BACKUP_TASK%" /f >nul 2>&1
schtasks /query /tn "NytharDashboard-Backup" >nul 2>&1
if errorlevel 1 (
    schtasks /create /tn "NytharDashboard-Backup" /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%ROOT%scripts\backup-windows.ps1\"" /sc daily /st 03:15 /f >nul 2>&1
    if errorlevel 1 (
        color 0E
        echo   AVISO: sem permissao para criar tarefa agendada.
        echo   Para ativar backup automatico, execute este instalador como Administrador,
        echo   ou crie a tarefa manualmente no Agendador de Tarefas do Windows.
        color 0B
    ) else (
        echo   Backup automatico configurado: diario as 03:15.
    )
) else (
    echo   Tarefa de backup ja existente — mantida sem alteracoes.
)

call "%ROOT%VERIFICAR-INSTALACAO.bat" /silent
if errorlevel 1 (
    color 0C
    echo.
    echo A instalacao terminou, mas a verificacao encontrou problema.
    echo Veja as mensagens acima.
    pause
    exit /b 1
)

color 0A
echo.
echo Instalacao concluida com sucesso.
echo Para iniciar, use o atalho "Nythar - Dashboard ^& Chatbot - Iniciar" ou rode INICIAR-SISTEMA-LOCAL.bat.
echo Dashboard local: http://127.0.0.1:4000/dashboard-improved.html
pause
