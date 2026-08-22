# Google Sheets - setup guiado

## 1. Criar a planilha

1. Abra o Google Sheets.
2. Crie uma planilha vazia.
3. Dê um nome simples, por exemplo: `Nythar - Dashboard & Chatbot - Relatorios`.

## 2. Criar o Apps Script

1. Na planilha, clique em `Extensoes > Apps Script`.
2. Apague o conteúdo do editor.
3. Cole este código:

```javascript
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = payload.sheets || {};

    Object.keys(sheets).forEach(function(name) {
      const rows = sheets[name] || [];
      let sheet = ss.getSheetByName(name);
      if (!sheet) sheet = ss.insertSheet(name);

      sheet.clear();

      if (!rows.length) {
        sheet.getRange(1, 1).setValue("Sem dados");
        return;
      }

      const headers = Object.keys(rows[0]);
      const values = rows.map(function(row) {
        return headers.map(function(header) {
          return row[header] === null || row[header] === undefined ? "" : row[header];
        });
      });

      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(2, 1, values.length, headers.length).setValues(values);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
      sheet.autoResizeColumns(1, headers.length);
    });

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 3. Publicar como App da Web

1. Clique em `Implantar > Nova implantacao`.
2. Em `Selecionar tipo`, escolha `App da Web`.
3. Em `Executar como`, selecione `Eu`.
4. Em `Quem pode acessar`, selecione `Qualquer pessoa`.
5. Clique em `Implantar`.
6. Autorize a conta Google quando for solicitado.
7. Copie a URL terminada em `/exec`.

Importante: use a URL `/exec`, não a URL `/dev`.

## 4. Configurar na dashboard

1. Entre na dashboard como admin da loja.
2. Vá em `Configuracoes`.
3. Cole a URL no campo `Google Sheets`.
4. Clique em `Testar`.
5. A planilha deve criar/atualizar as abas:
   - Agendamentos
   - Clientes
   - Financeiro
   - Profissionais
   - Logs

## 5. Se não funcionar

- Se aparecer `Google Sheets nao configurado`, a URL não foi salva. Cole novamente e clique em `Testar`.
- Se aparecer erro de permissão, publique o Apps Script como `Qualquer pessoa`.
- Se nada mudar na planilha, confira se você colou o script na mesma planilha que quer atualizar.
- Se alterou o script, clique em `Implantar > Gerenciar implantacoes > Editar > Nova versao`.
