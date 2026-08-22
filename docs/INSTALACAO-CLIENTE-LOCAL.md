# Instalacao do Sistema no Notebook do Cliente

Este guia deixa o sistema funcionando localmente, com dashboard, WhatsApp, Excel e Google Sheets.

## 1. Instalar programas obrigatorios

Se o cliente recebeu a pasta em `.zip`, extraia tudo primeiro. Depois clique duas vezes:

```text
INSTALAR-DEPENDENCIAS-WINDOWS.bat
```

Esse arquivo usa `winget` para instalar:

- Google Chrome ou Microsoft Edge.
- Node.js 20 LTS.
- .NET SDK 8.
- ngrok, se quiser acesso externo pelo link publico.

Ele tambem roda:

```bat
npm install
cd WhatsAppBridge
npm install
```

Se o `winget` nao existir, instale manualmente:

```text
Node.js 20 LTS: https://nodejs.org
.NET SDK 8: https://dotnet.microsoft.com/download
ngrok: https://ngrok.com/download
```

Depois reinicie o notebook.

## 2. Colocar o sistema em uma pasta fixa

Sugestao:

```text
C:\NytharDashboard
```

Evite deixar em pasta de downloads, area de trabalho sincronizada ou pendrive.

## 3. Iniciar o sistema

Clique duas vezes:

```text
INICIAR-SISTEMA-LOCAL.bat
```

Na primeira execucao, ele pode instalar dependencias. Aguarde.

O sistema vai abrir o dashboard local:

```text
http://127.0.0.1:4000/dashboard-improved.html
```

Deixe a janela preta aberta. Ela e o monitor do sistema.

## 4. Login

As credenciais ativas tambem ficam salvas no arquivo `CREDENCIAIS-ACESSO.txt`.
Se precisar consultar novamente, execute `MOSTRAR-CREDENCIAIS.bat`.

Admin da loja:

```text
Usuario: exibido pelo instalador em "Loja"
Senha: exibida pelo instalador em "Loja"
```

Superadmin:

```text
Usuario: exibido pelo instalador em "Super"
Senha: exibida pelo instalador em "Super"
```

## 5. Conectar WhatsApp

1. Abra a aba `Bot`.
2. Clique em `QR`.
3. No celular da barbearia, abra WhatsApp.
4. Toque em `Aparelhos conectados`.
5. Toque em `Conectar aparelho`.
6. Escaneie o QR.
7. Aguarde o painel mostrar online.

Nao apague esta pasta:

```text
WhatsAppBridge\.wwebjs_auth
```

Ela guarda a sessao do WhatsApp.

## 6. Excel automatico

O sistema gera e atualiza automaticamente:

```text
data\exports\agendamentos.xlsx
```

A planilha e atualizada:

- quando o sistema inicia;
- quando o sistema e encerrado corretamente;
- todos os dias pelo worker;
- quando clicar em `Exportar`;
- quando clicar em `Sheets`.

Abas do Excel:

- `Resumo`
- `Agendamentos`
- `Financeiro`
- `Profissionais`
- `Clientes`
- `Semana XX`

Para baixar pelo navegador, clique em:

```text
Exportar
```

## 7. Google Sheets

O Google Sheets funciona via Webhook do Google Apps Script.

### Criar Apps Script

1. Abra uma planilha Google.
2. Clique em `Extensoes`.
3. Clique em `Apps Script`.
4. Apague o conteudo padrao e cole o codigo abaixo.
5. Clique em `Implantar`.
6. Escolha `App da Web`.
7. Executar como: `Eu`.
8. Quem tem acesso: `Qualquer pessoa`.
9. Clique em `Implantar`, autorize e copie a URL terminada em `/exec`.

Codigo completo do Apps Script:

```javascript
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      service: 'Nythar - Dashboard & Chatbot Google Sheets Webhook',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = payload.sheets || {};

    writeSheet_(ss, 'Agendamentos', sheets.Agendamentos || sheets.agendamentos || []);
    writeSheet_(ss, 'Clientes', sheets.Clientes || sheets.clientes || []);
    writeSheet_(ss, 'Financeiro', sheets.Financeiro || sheets.financeiro || []);
    writeSheet_(ss, 'Profissionais', sheets.Profissionais || sheets.profissionais || []);
    writeSheet_(ss, 'Logs', sheets.Logs || sheets.logs || []);

    const resumo = getOrCreateSheet_(ss, 'Resumo');
    resumo.clear();
    resumo.getRange(1, 1, 1, 2).setValues([['Campo', 'Valor']]);
    resumo.getRange(2, 1, 6, 2).setValues([
      ['Atualizado em', new Date()],
      ['Agendamentos', count_(sheets.Agendamentos || sheets.agendamentos)],
      ['Clientes', count_(sheets.Clientes || sheets.clientes)],
      ['Profissionais', count_(sheets.Profissionais || sheets.profissionais)],
      ['Logs', count_(sheets.Logs || sheets.logs)],
      ['Origem', 'Nythar - Dashboard & Chatbot Local']
    ]);
    formatHeader_(resumo, 1, 2);
    resumo.autoResizeColumns(1, 2);

    return json_({
      ok: true,
      synced: true,
      message: 'Google Sheets atualizado com sucesso.',
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    return json_({
      ok: false,
      synced: false,
      error: String(err && err.message ? err.message : err)
    });
  } finally {
    lock.releaseLock();
  }
}

function writeSheet_(ss, name, rows) {
  const sheet = getOrCreateSheet_(ss, name);
  sheet.clear();

  rows = Array.isArray(rows) ? rows : [];
  if (rows.length === 0) {
    sheet.getRange(1, 1).setValue('Sem dados');
    return;
  }

  const headers = collectHeaders_(rows);
  const values = rows.map(row => headers.map(header => normalizeValue_(row[header])));

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  formatHeader_(sheet, 1, headers.length);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  const filter = sheet.getFilter();
  if (filter) filter.remove();
  sheet.getRange(1, 1, values.length + 1, headers.length).createFilter();
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function collectHeaders_(rows) {
  const seen = {};
  const headers = [];
  rows.forEach(row => {
    Object.keys(row || {}).forEach(key => {
      if (!seen[key]) {
        seen[key] = true;
        headers.push(key);
      }
    });
  });
  return headers;
}

function normalizeValue_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function formatHeader_(sheet, row, cols) {
  sheet.getRange(row, 1, 1, cols)
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#172033');
}

function count_(value) {
  return Array.isArray(value) ? value.length : 0;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Configurar no sistema

1. Abra a dashboard.
2. Va em `Configuracoes`.
3. Cole a URL no campo `Google Sheets`.
4. Clique em `Salvar`.
5. Clique em `Sheets`.

Se a URL estiver correta, o sistema envia:

- agendamentos;
- clientes;
- financeiro;
- profissionais;
- logs.

## 8. Ngrok

Se quiser acesso externo:

```bat
ngrok config add-authtoken SEU_TOKEN
```

Depois rode:

```text
INICIAR-SISTEMA-LOCAL.bat
```

A URL publica fica salva em:

```text
data\local-runtime.json
```

No plano gratuito, o ngrok pode mostrar uma pagina de aviso. Clique em `Visit Site`.

## 9. Como parar

Use:

```text
PARAR-SISTEMA-LOCAL.bat
```

Ou pressione `Ctrl+C` na janela do sistema.

Ao encerrar corretamente, o sistema tenta atualizar Excel e Google Sheets antes de parar.

## 10. Como verificar se esta tudo certo

Clique:

```text
STATUS-SISTEMA-LOCAL.bat
```

Verifique:

- Backend online.
- Dashboard online.
- Bridge online.
- Ngrok online, se usado.

Tambem confira:

```text
logs\
data\exports\agendamentos.xlsx
```

## 11. Checklist final

- [ ] Dashboard abre.
- [ ] Login funciona.
- [ ] WhatsApp mostra QR.
- [ ] WhatsApp fica online.
- [ ] Cliente envia `oi` e recebe resposta.
- [ ] Agendamento aparece na agenda.
- [ ] Botao `Exportar` baixa Excel.
- [ ] Arquivo `data\exports\agendamentos.xlsx` existe.
- [ ] Botao `Sheets` sincroniza ou informa que Google Sheets nao esta configurado.
- [ ] Ao fechar e abrir de novo, a agenda continua salva.
- [ ] Ao fechar e abrir de novo, o WhatsApp continua pareado.

## 12. O que nao apagar

```text
data\
data\exports\
WhatsAppBridge\.wwebjs_auth\
logs\
```

## 13. Suporte

Se der erro, envie:

- print da tela;
- conteudo da pasta `logs`;
- arquivo `data\local-runtime.json`;
- mensagem exibida no `STATUS-SISTEMA-LOCAL.bat`.
