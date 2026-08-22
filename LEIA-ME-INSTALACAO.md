# Nythar - Dashboard & Chatbot - Instalação no computador do cliente

## Instalação rápida

1. Extraia o `.zip` em uma pasta fixa, por exemplo `C:\NytharDashboard`.
2. Clique duas vezes em `INSTALAR-CLIENTE.bat`.
3. Quando terminar, clique em `INICIAR-SISTEMA-LOCAL.bat` ou use o atalho criado na área de trabalho.
4. Abra a dashboard em `http://127.0.0.1:4000/dashboard-improved.html`.
5. Na aba do bot, leia o QR Code do WhatsApp quando solicitado.

## Requisitos instalados automaticamente quando possível

- Node.js LTS.
- ASP.NET Core Runtime 8.
- Dependências da dashboard.
- Dependências do WhatsApp Bridge.

Se o Windows não tiver `winget`, instale manualmente:

- Node.js LTS: https://nodejs.org
- ASP.NET Core Runtime 8: https://dotnet.microsoft.com/download/dotnet/8.0

## Operação diária

- Iniciar: `INICIAR-SISTEMA-LOCAL.bat`
- Parar: `PARAR-SISTEMA-LOCAL.bat`
- Ver status: `STATUS-SISTEMA-LOCAL.bat`
- Verificar instalação: `VERIFICAR-INSTALACAO.bat`
- Ver credenciais: `MOSTRAR-CREDENCIAIS.bat` ou `CREDENCIAIS-ACESSO.txt`
- Testar login com o sistema aberto: `TESTAR-LOGIN-LOCAL.bat`
- Recuperar uma queda do WhatsApp: `REPARAR-WHATSAPP.bat`

## Primeiro pareamento do WhatsApp

1. Inicie o sistema.
2. Entre na dashboard.
3. Abra a aba `Bot WhatsApp`.
4. Clique em `QR`.
5. Aguarde alguns segundos enquanto o Chromium inicia.
6. Escaneie o QR Code com o WhatsApp da barbearia.
7. Depois que conectar, o status muda para online.

Se o status aparecer como `OFFLINE` logo após iniciar, isso significa apenas que ainda não existe sessão pareada. Clique em `QR` para gerar a primeira sessão.

Depois do primeiro pareamento, o sistema reutiliza a sessão ao ligar o computador. Em uma queda comum, não reinstale o sistema e não gere outro QR imediatamente: execute `REPARAR-WHATSAPP.bat`, aguarde até 60 segundos e confira o painel. Um novo QR só é necessário se o aparelho tiver sido removido em `WhatsApp > Aparelhos conectados` ou se o próprio WhatsApp invalidar definitivamente a sessão.

## Ngrok e acesso externo

O sistema funciona localmente sem ngrok em `http://127.0.0.1:4000`.

Use ngrok somente se precisar abrir a dashboard fora do computador da barbearia, por exemplo em outro celular/rede.

Passos:

1. Crie conta em https://ngrok.com
2. Instale o ngrok no Windows.
3. Configure o authtoken no Prompt:

```bat
ngrok config add-authtoken SEU_TOKEN_AQUI
```

4. Inicie o sistema normalmente.
5. O supervisor tentará abrir um túnel para a porta `4000`.
6. A URL pública fica registrada em `data\local-runtime.json` e também aparece na janela de inicialização.

Sem authtoken ou sem internet, o ngrok pode falhar, mas o sistema local continua funcionando.

## Observações importantes

- Não mova a pasta depois da instalação. Se mover, rode `INSTALAR-CLIENTE.bat` novamente.
- O banco local fica na pasta `data`.
- Logs ficam na pasta `logs`.
- Backups ficam na pasta `backups`.
- Para acesso externo por link público, instale/configure `ngrok`; sem isso o sistema funciona localmente no computador.
