# Inventário de dependências

Este inventário resume as dependências operacionais do sistema Nythar - Dashboard & Chatbot para facilitar manutenção, auditoria básica e diagnóstico.

## Frontend dashboard

- `dashboard-improved.html`, `script-dashboard.js`, `style-dashboard.css`
- Tailwind CDN para utilitários de layout.
- Chart.js CDN para gráficos e relatórios.
- Font Awesome CDN para ícones.
- `@microsoft/signalr` via CDN para notificações em tempo real.
- `sw.js` para clique de notificações nativas em desktop e celular.

## API Node da dashboard

- Node.js executando `api-nythar.js`.
- `express` para rotas HTTP e arquivos públicos.
- `helmet`, `cors`, `express-rate-limit` e autenticação por sessão para proteção local.
- `node-fetch` para proxy até backend .NET e bridge.
- `bcryptjs` para validação de senha.
- `morgan` disponível para logging HTTP.

## Backend .NET

- .NET 8 em `WhatsAppBot.Worker`.
- Entity Framework Core com SQLite como armazenamento local.
- `Npgsql.EntityFrameworkCore.PostgreSQL` disponível para Postgres.
- ASP.NET Core SignalR para eventos em tempo real.
- JWT Bearer, Memory Cache e HealthChecks.
- ClosedXML para relatórios/exportações.
- QRCoder para QR Code.
- SendGrid para email opcional.
- Polly e Serilog para resiliência e logs.
- Swashbuckle para documentação OpenAPI.

## WhatsApp Bridge

- Node.js em `WhatsAppBridge`.
- `whatsapp-web.js` para sessão WhatsApp Web.
- Puppeteer é dependência transitiva do `whatsapp-web.js`.
- `qrcode` e `qrcode-terminal` para geração e exibição de QR Code.
- `axios` e `axios-retry` para comunicação com backend.
- `express`, `cors`, `express-rate-limit` e `pino` para API local e logs.

## Armazenamento e integrações

- SQLite local via EF Core.
- Google Sheets por webhook/App Script configurado na dashboard.
- SignalR com LongPolling pelo proxy Node para manter compatibilidade local.
- Browser Notifications, som de alerta e vibração para novos agendamentos.

## Observações de compatibilidade

- O inventário foi mantido sem remover dependências porque há uso direto ou operacional em dashboard, bridge, backend, relatórios, notificações ou exportações.
- Auditoria online de vulnerabilidades depende de acesso à rede (`npm audit`/feeds NuGet). Em ambiente restrito, a verificação feita aqui é estática e por consistência de versões declaradas.
