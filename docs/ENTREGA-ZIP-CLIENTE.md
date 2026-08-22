# Entrega do sistema local ao cliente

Este projeto deve ser entregue como uma pasta unica compactada em `.zip`, para rodar nativamente no computador do cliente.

## O que enviar no ZIP

Inclua a pasta do sistema com estes itens principais:

- `INICIAR-SISTEMA-LOCAL.bat`
- `PARAR-SISTEMA-LOCAL.bat`
- `STATUS-SISTEMA-LOCAL.bat`
- `INSTALAR-DEPENDENCIAS-WINDOWS.bat`
- `api-nythar.js`
- `dashboard-improved.html`
- `login.html`
- `script-dashboard.js`
- `style-dashboard.css`
- `package.json`
- `package-lock.json`
- `WhatsAppBot.Worker/`
- `WhatsAppBridge/`
- `assets/`
- `docs/`
- `superadmin/`
- `scripts/`

## O que nao enviar

Nao inclua arquivos temporarios, builds e dados sensiveis de outro cliente:

- `.git/`
- `node_modules/`
- `WhatsAppBridge/node_modules/`
- `tmpbuild/`
- `logs/`
- `bin/`
- `obj/`
- `dist/`
- backups antigos
- banco `agendamentos.db` de outro cliente
- pasta `WhatsAppBridge/.wwebjs_auth` de outro cliente

Se for entregar para um cliente novo, comece sem banco e sem sessao WhatsApp. O sistema cria banco local e gera QR Code no primeiro uso.

## Estrutura recomendada no computador do cliente

Use uma pasta fixa, fora de Downloads, pendrive ou area sincronizada:

```text
C:\BarbeariaSistema\
  INICIAR-SISTEMA-LOCAL.bat
  PARAR-SISTEMA-LOCAL.bat
  STATUS-SISTEMA-LOCAL.bat
  INSTALAR-DEPENDENCIAS-WINDOWS.bat
  api-nythar.js
  dashboard-improved.html
  script-dashboard.js
  style-dashboard.css
  data\
  logs\
  WhatsAppBot.Worker\
  WhatsAppBridge\
  assets\
  docs\
  scripts\
```

## Instalacao no computador do cliente

1. Extraia o `.zip` para `C:\BarbeariaSistema`.
2. Clique com o botao direito em `INSTALAR-DEPENDENCIAS-WINDOWS.bat`.
3. Execute como administrador.
4. Aguarde instalar Node.js, .NET, ngrok e dependencias npm.
5. Execute `INICIAR-SISTEMA-LOCAL.bat`.
6. Abra o painel pelo navegador.
7. Va ate a aba Bot e escaneie o QR Code do WhatsApp.
8. Cadastre barbeiros, horarios e Google Sheets se for usar.

## Limpeza segura

A dashboard possui o botao `Limpeza segura`.

Ele limpa somente:

- cache temporario do backend;
- pendencias do bot pausado;
- notificacoes visuais da sessao atual da dashboard.

Ele nao apaga:

- banco de dados;
- agendamentos;
- clientes;
- usuarios;
- senhas;
- empresas;
- configuracoes;
- planilhas;
- sessao do WhatsApp.

Use quando o painel parecer desatualizado, apos muitos testes, ou antes de validar o sistema com o cliente.

## Como compactar corretamente

Antes de compactar:

1. Feche o sistema com `PARAR-SISTEMA-LOCAL.bat`.
2. Apague `node_modules`, `tmpbuild`, `logs` e pastas `bin/obj`.
3. Confirme que `INSTALAR-DEPENDENCIAS-WINDOWS.bat` esta na raiz.
4. Clique com o botao direito na pasta `BarbeariaSistema`.
5. Escolha `Enviar para > Pasta compactada`.

## Modelo comercial sugerido

Como o sistema vai rodar no computador do cliente, sem VPS e sem custo mensal de hospedagem, faz sentido nao cobrar mensalidade fixa do software.

Modelo simples:

- Implementacao/instalacao: valor combinado no fechamento.
- Suporte opcional: R$ 50,00 por chamado ou por periodo combinado.

Deixe claro que o suporte cobre ajuda operacional, reinstalacao, ajuste de planilha, QR Code, ngrok, pequenos ajustes e verificacao de erro. Mudancas novas de funcionalidade devem ser cobradas separadamente.

## Checklist antes de entregar

- [ ] `INSTALAR-DEPENDENCIAS-WINDOWS.bat` existe na raiz.
- [ ] `INICIAR-SISTEMA-LOCAL.bat` abre o sistema.
- [ ] Login funciona.
- [ ] Dashboard mostra agendamentos de hoje e futuros.
- [ ] Aba Bot mostra QR Code quando necessario.
- [ ] WhatsApp conecta.
- [ ] Bot cria agendamento.
- [ ] Novo agendamento aparece na dashboard.
- [ ] Notificacao aparece no computador com a dashboard aberta.
- [ ] Excel exporta.
- [ ] Google Sheets sincroniza, se configurado.
- [ ] `PARAR-SISTEMA-LOCAL.bat` encerra tudo.
- [ ] Reiniciar o PC e abrir novamente preserva banco e sessao WhatsApp.
