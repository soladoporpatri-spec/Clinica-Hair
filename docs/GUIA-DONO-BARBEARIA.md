# Guia rapido para o dono da barbearia

## Todo dia

1. Abra a dashboard.
2. Confira se o indicador do WhatsApp esta online.
3. Veja a agenda de hoje e os proximos cortes.
4. Confirme presenca quando o cliente chegar.
5. Use Relatorios para ver faturamento previsto, agendamentos e servicos mais vendidos.

## Conectar o WhatsApp

1. Entre na aba Bot.
2. Clique em QR.
3. No celular da barbearia, abra WhatsApp > Aparelhos conectados > Conectar aparelho.
4. Leia o QR Code.
5. Aguarde o status ficar online.

## Configurar profissionais

1. Na agenda, abra Equipe de Barbeiros.
2. Cadastre cada profissional.
3. Defina horario de inicio, fim, almoco, dias trabalhados e bloqueios.
4. O bot usa essas regras automaticamente para oferecer horarios.

## Google Sheets

1. Crie uma planilha no Google Sheets.
2. Abra Extensoes > Apps Script.
3. Cole o script abaixo e publique como App da Web.
4. Copie a URL gerada.
5. Na dashboard, va em Configuracoes > Google Sheets, cole a URL, salve e clique em Testar.

```javascript
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(payload.sheets || {}).forEach(function(name) {
    const rows = payload.sheets[name] || [];
    let sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    sheet.clear();
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    sheet.appendRow(headers);
    rows.forEach(function(row) {
      sheet.appendRow(headers.map(function(header) { return row[header] ?? ""; }));
    });
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.autoResizeColumns(1, headers.length);
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
```

## Quando algo parecer errado

- WhatsApp offline: entre na aba Bot e leia o QR de novo.
- Agenda sem horario: confira horarios e bloqueios do profissional.
- Sheets nao atualiza: confirme se a URL do Apps Script esta publicada como App da Web e com acesso permitido.
- Dashboard lenta: clique em Atualizar e evite manter muitas abas abertas.
