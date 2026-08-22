# Guia de Uso Local no Notebook

Este modo roda tudo no notebook do cliente, sem VPS:

- Backend .NET: `http://127.0.0.1:5000`
- WhatsApp Bridge: `http://127.0.0.1:3000`
- Dashboard Node/API: `http://127.0.0.1:4000`
- Ngrok, quando instalado: URL publica apontando para o Dashboard

## Arquitetura local

```text
Navegador local ou URL ngrok
  |
  v
Dashboard Node :4000
  |-- arquivos da dashboard
  |-- /api/* autenticado
  |-- /hubs/* proxy SignalR
  |
  |-- Backend .NET :5000
  |-- Bridge WhatsApp :3000

Persistencia:
  data/agendamentos.db
  data/whatsapp-queue.json
  data/bot-state.json
  WhatsAppBridge/.wwebjs_auth
  logs/
```

O WhatsApp Web usa a pasta `WhatsAppBridge/.wwebjs_auth`. Nao apague essa pasta se quiser manter a sessao pareada.

## Como iniciar

Clique duas vezes:

```text
INICIAR-SISTEMA-LOCAL.bat
```

O script:

1. verifica Node.js;
2. verifica .NET SDK;
3. instala dependencias se faltarem;
4. inicia backend;
5. inicia bridge WhatsApp;
6. inicia dashboard;
7. inicia ngrok se estiver instalado;
8. captura a URL publica do ngrok;
9. abre o navegador automaticamente;
10. monitora e reinicia servicos com problema.

Deixe a janela aberta enquanto o sistema estiver em uso.

## Login padrao local

As credenciais ativas ficam no arquivo `CREDENCIAIS-ACESSO.txt`.
Para exibir novamente, execute `MOSTRAR-CREDENCIAIS.bat`.

Superadmin:

```text
Usuario: exibido pelo instalador em "Super"
Senha: exibida pelo instalador em "Super"
```

Admin da loja:

```text
Usuario: exibido pelo instalador em "Loja"
Senha: exibida pelo instalador em "Loja"
```

## Como parar

Feche a janela do `INICIAR-SISTEMA-LOCAL.bat` ou pressione `Ctrl+C`.

Se quiser forcar parada:

```text
PARAR-SISTEMA-LOCAL.bat
```

Ele encerra processos nas portas `3000`, `4000`, `5000` e `4040`.

## Como reiniciar

1. Execute `PARAR-SISTEMA-LOCAL.bat`.
2. Aguarde alguns segundos.
3. Execute `INICIAR-SISTEMA-LOCAL.bat`.

## Como verificar status

Clique:

```text
STATUS-SISTEMA-LOCAL.bat
```

Ou abra:

```text
http://127.0.0.1:4000/health
http://127.0.0.1:4000/health/deep
http://127.0.0.1:4000/health/local
```

## Ngrok

Para usar ngrok:

1. instale o ngrok;
2. configure o token uma vez:

```bat
ngrok config add-authtoken SEU_TOKEN
```

Depois rode `INICIAR-SISTEMA-LOCAL.bat`. O supervisor vai:

- iniciar `ngrok http 4000`;
- ler `http://127.0.0.1:4040/api/tunnels`;
- capturar a URL publica;
- salvar em `data/local-runtime.json`;
- abrir o navegador na URL publica.

Por padrao, o sistema abre o painel local (`127.0.0.1`) para evitar a tela de aviso do plano gratuito do ngrok. A URL publica continua salva em `data/local-runtime.json` para voce enviar a outra pessoa.

No plano gratuito, o ngrok pode mostrar uma tela dizendo `You are about to visit...`. Isso e normal. Clique em `Visit Site`. Visitantes costumam ver esse aviso uma vez. As chamadas internas da dashboard ja enviam o header `ngrok-skip-browser-warning`, mas a primeira navegacao digitada no navegador nao permite enviar esse header.

O acesso externo passa pelo Dashboard, entao a Bridge fica protegida: o cliente remoto acessa `/api/bot/*` autenticado, e o Dashboard conversa com a Bridge local.

## Bot pausado sem spam

Quando o bot for pausado pelo painel, a Bridge nao responde mensagens novas. Ela guarda em `data/whatsapp-paused-pending.json` somente a ultima mensagem de cada contato.

Ao reativar o bot, o sistema envia para processamento apenas uma mensagem por contato: a ultima que chegou durante a pausa. Isso evita que o cliente receba varias respostas acumuladas se mandou `oi`, `tem horario?`, `alguem responde?` enquanto o atendimento automatico estava desligado.

Para conferir ou limpar pendencias tecnicamente:

```text
GET  http://127.0.0.1:3000/messages/pending
POST http://127.0.0.1:3000/messages/pending/clear
```

Essas rotas exigem o header `X-API-KEY` configurado no `.env`. Por padrao, pendencias com mais de 24 horas sao descartadas. Para alterar esse prazo, configure `PAUSED_PENDING_MAX_AGE_MS`.

## Logs

Pasta:

```text
logs/
```

Arquivos principais:

- `logs/backend.out.log`
- `logs/backend.err.log`
- `logs/whatsapp-bridge.out.log`
- `logs/whatsapp-bridge.err.log`
- `logs/dashboard-api.out.log`
- `logs/dashboard-api.err.log`
- `logs/ngrok.out.log`
- `logs/ngrok.err.log`

## Checklist final

- [ ] `INICIAR-SISTEMA-LOCAL.bat` abre sem erro.
- [ ] Dashboard abre no navegador.
- [ ] Login funciona.
- [ ] Aba Agenda carrega.
- [ ] Aba Bot mostra status.
- [ ] QR Code aparece quando WhatsApp nao esta pareado.
- [ ] WhatsApp fica online apos escanear QR.
- [ ] Enviar `oi` para o numero inicia o fluxo.
- [ ] Agendamento criado pelo bot aparece na dashboard.
- [ ] Criar agendamento manual funciona.
- [ ] Editar/cancelar/confirmar agendamento funciona.
- [ ] Aba Barbeiros permite criar/editar profissional.
- [ ] Aba Relatorios carrega graficos.
- [ ] Aba Automacoes salva templates.
- [ ] Google Sheets mostra status e sincroniza quando webhook estiver configurado.
- [ ] `STATUS-SISTEMA-LOCAL.bat` mostra backend, dashboard e bridge respondendo.
- [ ] Reiniciar o notebook e rodar a BAT novamente preserva banco e sessao WhatsApp.

## Problemas comuns

### Porta ocupada

Execute:

```text
PARAR-SISTEMA-LOCAL.bat
```

Depois inicie novamente.

### Ngrok nao abre

Verifique:

```bat
ngrok version
ngrok config add-authtoken SEU_TOKEN
```

Se nao houver ngrok, o sistema continua funcionando localmente.

### QR nao aparece

Abra a aba Bot e clique em `QR`. Se ainda nao aparecer, veja:

```text
logs/whatsapp-bridge.err.log
logs/whatsapp-bridge.out.log
```

### WhatsApp desconecta

Execute `REPARAR-WHATSAPP.bat`, aguarde ate 60 segundos e confira o painel. O reparo encerra processos antigos e reinicia o Bridge sem apagar o pareamento. Nao execute `INSTALAR-CLIENTE.bat` para uma queda comum.

Em instalacoes dentro do OneDrive, a sessao fica protegida em `%LOCALAPPDATA%\Nythar\WhatsAppSessions`, fora da pasta sincronizada. Nao apague essa pasta.

Se o aparelho for removido em `WhatsApp > Aparelhos conectados`, a Bridge confirma a invalidacao antes de limpar a sessao e entao gera um novo QR Code. Abra a aba Bot para escanear o novo QR somente nesse caso.
