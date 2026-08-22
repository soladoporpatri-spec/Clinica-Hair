# Arquitetura SaaS modular - Nythar - Dashboard & Chatbot

Este documento registra a analise da estrutura atual e o plano de evolucao para transformar o projeto em uma base SaaS modular, sem quebrar o funcionamento local atual.

## Estado atual

O sistema hoje funciona como um produto local/hibrido com quatro blocos principais:

- Dashboard Node/Express: `api-nythar.js`, `dashboard-improved.html`, `script-dashboard.js`, `style-dashboard.css`.
- Backend .NET: `WhatsAppBot.Worker/Program.cs`, services, models e SQLite.
- Bridge WhatsApp Web: `WhatsAppBridge/index.js`.
- Operacao local/deploy: `.bat`, `scripts/supervisor.js`, `deploy/systemd`, `deploy/nginx-barbearia.conf`.

Pontos fortes:

- Ja existe separacao fisica entre backend, dashboard e bridge.
- Ja existe Store/Tenant, roles, barbeiros, dashboard admin/barbeiro, bridge por loja e SignalR.
- Ja existe exportacao Excel, Google Sheets, backup, healthchecks e scripts locais.
- Ja existe caminho para Oracle Free Tier com nginx/systemd.

Pontos de divida tecnica:

- `Program.cs` concentra seed, auth, rotas, superadmin, agenda, settings, stats, export, webhook e manutencao.
- `script-dashboard.js` concentra UI, login, SignalR, agenda, bot, configuracoes, relatorios, barbeiros, automacoes e export.
- `api-nythar.js` mistura servidor estatico, proxy, auth, bridge, superadmin, settings e manutencao.
- `WhatsAppBridge/index.js` mistura HTTP API, ciclo WhatsApp, fila, bot toggle, sessao, QR, pendencias e reconexao.
- Configuracoes estao espalhadas entre `.env`, appsettings, banco `SystemConfigs`, scripts e defaults no codigo.
- Multi-tenant existe, mas ainda depende de disciplina manual para `TenantService.SetTenantId` e query filters.
- Modulos ainda eram implicitos: a dashboard mostrava tudo para quem tinha role, nao por assinatura.

## Base modular adicionada

Foi criada uma primeira base compativel:

- `WhatsAppBot.Worker/Services/Modules/ModuleCatalog.cs`
- `WhatsAppBot.Worker/Services/Modules/FeatureAccessService.cs`
- `WhatsAppBot.Worker/Endpoints/SaasEndpoints.cs`
- `WhatsAppBot.Worker/Endpoints/SpreadsheetEndpoints.cs`
- `WhatsAppBot.Worker/Endpoints/SettingsEndpoints.cs`
- `WhatsAppBot.Worker/Endpoints/OperationalEndpoints.cs`
- `WhatsAppBot.Worker/Endpoints/BarberEndpoints.cs`
- `WhatsAppBot.Worker/Endpoints/SchedulingEndpoints.cs`
- `WhatsAppBot.Worker/Endpoints/AnalyticsEndpoints.cs`
- `WhatsAppBot.Worker/Endpoints/AuthEndpoints.cs`
- `WhatsAppBot.Worker/Endpoints/WebhookEndpoints.cs`
- `WhatsAppBot.Worker/Endpoints/SuperAdminEndpoints.cs`
- `WhatsAppBot.Worker/Endpoints/EndpointAuth.cs`
- `WhatsAppBot.Worker/Services/Notifications/NotificationHub.cs`
- `WhatsAppBot.Worker/Services/Notifications/NotificationModels.cs`
- `WhatsAppBot.Worker/Startup/DefaultAutomationSeeder.cs`
- endpoint `GET /api/modules` no backend
- proxy `GET /api/modules` no dashboard Node
- dashboard passa a carregar `state.modules` e aplicar visibilidade por modulo

Modulos catalogados:

- `whatsapp_bot`
- `dashboard_analytics`
- `automations`
- `google_sheets`
- `notifications`
- `reports`
- `multi_professionals`
- `crm`
- `meta_whatsapp_api`

Planos previstos:

- `Local`
- `Starter`
- `Standard`
- `Premium`
- `Enterprise`

Compatibilidade:

- lojas sem configuracao continuam em `Standard`;
- o comportamento atual permanece habilitado por padrao;
- overrides podem ser feitos por `SystemConfigs` usando `Module_<module_key>_Enabled`.

Exemplo:

```text
Module_google_sheets_Enabled = false
Module_automations_Enabled = true
```

## Arquitetura alvo

```text
apps/
  dashboard-web/
  superadmin-web/
  whatsapp-bridge/
services/
  api/
    Barbearia.Api/
    Barbearia.Application/
    Barbearia.Domain/
    Barbearia.Infrastructure/
  workers/
    Barbearia.Workers.Reminders/
    Barbearia.Workers.Spreadsheets/
    Barbearia.Workers.Backups/
modules/
  WhatsAppBot/
  Scheduling/
  Analytics/
  Automations/
  GoogleSheets/
  Notifications/
  Reports/
  CRM/
  MultiProfessionals/
deploy/
  oracle/
  docker/
  nginx/
  systemd/
docs/
  cliente/
  tecnico/
tests/
  api/
  dashboard/
  bridge/
```

Essa estrutura deve ser migrada aos poucos. Nao mover tudo de uma vez.

## Separacao futura por responsabilidade

Backend:

- `Api`: controllers/endpoints, auth, tenancy, DTOs.
- `Application`: casos de uso, regras de agenda, assinatura, permissoes, notificacoes.
- `Domain`: entidades puras, enums, regras sem infraestrutura.
- `Infrastructure`: EF Core, SQLite/PostgreSQL, WhatsApp client, Google Sheets, email, arquivos.
- `Workers`: jobs recorrentes e filas.

Dashboard:

- `features/agenda`
- `features/bot`
- `features/automations`
- `features/reports`
- `features/settings`
- `features/barbers`
- `features/modules`
- `shared/api`
- `shared/ui`
- `shared/auth`

Bridge:

- `http/routes`
- `whatsapp/client`
- `queue/messageQueue`
- `queue/pausedPending`
- `session/sessionRecovery`
- `health/status`
- `config/env`

## Permissoes e assinaturas

Camadas recomendadas:

1. Tenant ativo: loja existe, ativa e nao suspensa.
2. Plano valido: `Store.Plan`, `ExpiresAt` ou `SubscriptionExpiry`.
3. Modulo habilitado: `FeatureAccessService`.
4. Role do usuario: `superadmin`, `admin`, `barbeiro`.
5. Escopo do recurso: barbeiro so ve agenda dele.

Exemplo de regra:

```text
admin + modulo google_sheets ativo -> pode configurar planilha
barbeiro + modulo multi_professionals ativo -> ve apenas propria agenda
tenant suspenso -> bloqueia dashboard operacional
```

## Riscos atuais

Urgentes:

- Arquivos grandes aumentam risco de regressao em qualquer ajuste.
- Bridge ainda depende de WhatsApp Web, que pode mudar sem aviso.
- SignalR via proxy Node esta em Long Polling por estabilidade; WebSocket real precisa proxy de upgrade.
- SQLite atende bem local/baixo custo, mas exige backup disciplinado.
- `Program.cs` muito grande dificulta testes finos.
- Configuracoes espalhadas podem gerar divergencia entre local e Oracle.

Medios:

- Superadmin e dashboard operacional estao no mesmo servidor Node.
- Alguns recursos usam defaults de desenvolvimento se env nao estiver completo.
- Google Sheets depende de Apps Script externo.
- Notificacoes nativas dependem do navegador permitir notificacao.

Futuros:

- Multi-tenant com SQLite unico pode virar gargalo se muitos clientes usarem a mesma instancia.
- WhatsApp Web nao e ideal para SaaS formal; Meta WhatsApp API deve virar modulo Enterprise.

## Gargalos atuais

- `Program.cs`: deve ser quebrado em grupos de endpoints.
- `script-dashboard.js`: deve virar frontend modular.
- `api-nythar.js`: deve virar BFF/proxy pequeno ou ser eliminado quando dashboard consumir backend direto.
- `WhatsAppBridge/index.js`: deve ser quebrado antes de crescer mais.
- `SystemConfigs`: precisa ser tipado por tenant/modulo.

## Roadmap tecnico

### Fase 0 - Entrega segura

- Manter estrutura atual.
- Corrigir bugs criticos.
- Garantir `.bat`, logs, backup, QR, planilhas, notificacoes e dashboard.
- Nao migrar banco nem mover arquivos grandes antes da entrega.

### Fase 1 - Modularizacao interna

- Criar `EndpointGroups` no backend:
  - `AgendaEndpoints`
  - `BotEndpoints`
  - `SettingsEndpoints`
  - `ReportsEndpoints`
  - `SuperAdminEndpoints`
  - `MaintenanceEndpoints`
- Criar DTOs por area.
- Mover `NotificationHub` para arquivo proprio.
- Mover records finais de `Program.cs` para `Models/Requests`.
- Quebrar `script-dashboard.js` em arquivos por feature.

### Fase 2 - Assinaturas reais

- Criar tabelas:
  - `Plans`
  - `PlanModules`
  - `TenantModules`
  - `Subscriptions`
  - `FeatureUsage`
- Trocar overrides em `SystemConfigs` por entidade tipada.
- Bloquear APIs por modulo no backend, nao apenas esconder menu.
- Adicionar tela superadmin para ativar/desativar modulos por loja.

### Fase 3 - SaaS operacional

- Migrar de SQLite para PostgreSQL quando houver multiplos clientes em uma instancia.
- Separar dashboard web e backend em deploys independentes.
- Adicionar filas para notificacoes, planilhas e automacoes.
- Criar auditoria por modulo.
- Criar metricas por tenant.

### Fase 4 - WhatsApp profissional

- Manter WhatsApp Web como modulo local/baixo custo.
- Criar modulo `meta_whatsapp_api` com provedor separado.
- Abstrair interface:
  - `IMessageChannel`
  - `WhatsAppWebChannel`
  - `MetaWhatsAppChannel`

## Estrutura ideal de deploy

Oracle Free Tier:

```text
/opt/barbearia/
  app/
  data/
    agendamentos.db
    exports/
    whatsapp-queue.json
    whatsapp-paused-pending.json
  logs/
    backend/
    bridge/
    dashboard/
  backups/
  deploy/
```

systemd:

- `barbearia-backend.service`
- `barbearia-dashboard.service`
- `barbearia-bridge.service`
- `barbearia-backup.timer`

nginx:

- `/` dashboard
- `/api/*` dashboard BFF
- `/hubs/*` notificacoes
- bridge sempre interna

Docker futuro:

- `dashboard`
- `backend`
- `bridge`
- `postgres`
- `redis` opcional para filas/cache

## O que fazer agora

1. Congelar entrega atual.
2. Criar backup do projeto entregue.
3. Usar `docs/ENTREGA-ZIP-CLIENTE.md` para pacote local.
4. Comecar Fase 1 em branch separada.
5. So depois criar migrations de assinatura/modulos.

## O que pode esperar

- Kubernetes.
- Microservicos reais.
- Redis obrigatorio.
- PostgreSQL obrigatorio para cliente local.
- Meta WhatsApp API.
- Billing automatico.
- Marketplace de plugins.

## Regra de ouro

Toda nova funcionalidade deve responder:

- qual modulo habilita?
- qual plano inclui?
- qual role pode usar?
- qual tenant e dono dos dados?
- qual job/servico executa?
- qual log/auditoria registra?
