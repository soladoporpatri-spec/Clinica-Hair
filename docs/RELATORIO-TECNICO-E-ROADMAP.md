# Relatório técnico e roadmap - Nythar - Dashboard & Chatbot

Data da revisão: 2026-05-20

## 1. Visão geral do sistema atual

O projeto hoje funciona como uma aplicação local composta por três processos principais:

- **Dashboard local Node/Express**: `api-nythar.js`, servindo `dashboard-improved.html`, `script-dashboard.js`, PWA, assets estáticos e proxy autenticado para o backend e a Bridge.
- **Backend .NET 8**: `WhatsAppBot.Worker`, contendo APIs de agenda, autenticação, configurações, relatórios, barbeiros, notificações, planilhas, multi-tenant inicial e worker em background.
- **WhatsApp Bridge Node**: `WhatsAppBridge/index.js`, usando `whatsapp-web.js`, Puppeteer/Chromium, sessão local do WhatsApp, QR Code, fila de mensagens, anti-spam e webhook para o backend.

O banco principal local é SQLite, normalmente em `data/agendamentos.db`. A sessão do WhatsApp fica em `WhatsAppBridge/.wwebjs_auth`. Exportações e planilhas são geradas em `data/exports`.

## 2. Dashboard

Arquivos principais:

- `dashboard-improved.html`
- `script-dashboard.js`
- `style-dashboard.css`
- `manifest.json`
- `sw.js`

Funções atuais:

- Login e persistência local de token.
- Agenda de hoje e agenda futura.
- Agendamento manual.
- Confirmação, cancelamento e remarcação.
- Gestão de profissionais.
- Bloqueio de dias indisponíveis.
- Status do bot WhatsApp, QR Code e toggle do bot.
- Central de notificações, som, browser notifications e PWA.
- Relatórios com filtros, KPIs, gráficos e CSV.
- Configurações de horário, limites, serviços, Google Sheets e retenção.

Melhorias aplicadas nesta revisão:

- Correção de textos com encoding quebrado no JS e HTML.
- Padronização de labels visíveis: "profissionais" em vez de "barbeiros" em pontos de filtro/tabela.
- Correção de mensagens com acentos: notificações, relatórios, horários, sessões, configurações e erros.
- Recuperação de identificadores internos acidentalmente acentuados, mantendo IDs seguros como `relatorios`, `automacoes`, `configuracoes`.
- Correção de classe `truncate`, que havia sido afetada por substituição textual.

Pontos de atenção:

- `script-dashboard.js` ainda concentra muitas responsabilidades: auth, agenda, bot, notificações, relatórios, configurações, modais, exports e PWA.
- A dashboard usa estado global mutável (`state`) e muitos acessos diretos ao DOM; isso é viável no MVP local, mas dificulta testes finos e evolução SaaS.
- Parte das strings e regras ainda fica no frontend, embora regras críticas de agenda já estejam centralizadas no backend.

## 3. Chatbot WhatsApp

Arquivos principais:

- `ConversationStateManager.cs`
- `ConversationSessionStore.cs`
- `ConversationStateBase.cs`
- Estados: `IdleState`, `AwaitingNameState`, `AwaitingServiceSelectionState`, `AwaitingBarberSelectionState`, `AwaitingDateSelectionState`, `AwaitingTimeSelectionState`, `ConfirmingAppointmentState`
- `WhatsAppClient.cs`
- `WebhookEndpoints.cs`
- `WhatsAppBridge/index.js`

Funcionamento:

1. Cliente envia mensagem no WhatsApp.
2. Bridge captura mensagem via `whatsapp-web.js`.
3. Bridge aplica filtros: grupos, mensagens antigas, dedupe, rate limit e cache de enquetes.
4. Bridge envia webhook para `/api/webhook/whatsapp`.
5. Backend resolve tenant, carrega sessão da conversa e executa a máquina de estados.
6. Bot envia enquetes e mensagens via Bridge.
7. Ao confirmar, `SchedulerService` salva o agendamento e dispara notificações.

Proteções atuais:

- Lock por telefone em `ConversationStateManager`.
- Deduplicação por `messageId`.
- Persistência de sessão em `ConversationSessions`.
- Contador de respostas inválidas com reset após 3 erros.
- Timeout de fluxo e retry leve.
- Cache/fila no Bridge com TTL e limites.
- Pausa do bot com armazenamento da última mensagem pendente por contato.

Pontos frágeis:

- `ConversationSessionStore` usa cache em memória mais persistência em SQLite. Em multi-instância SaaS, isso precisa virar Redis ou armazenamento transacional.
- Fluxos com WhatsApp Web dependem de estabilidade do Chromium, internet local e política do WhatsApp.
- Polls/enquetes são sensíveis a votos antigos e cache expirado; já existe mitigação, mas precisa de testes vivos recorrentes.
- O worker ainda assume `DefaultTenantId = 1` para rotinas sem contexto HTTP, o que limita SaaS real.

## 4. APIs e backend

Entradas principais:

- `/api/auth/*`: login, logout e recuperacao.
- `/api/agendamentos`, `/api/hoje`, `/api/semana`, `/api/horários-livres`.
- `/api/barbeiros`.
- `/api/settings` e `/api/services`.
- `/api/reports/appointments`, `/api/stats`, `/api/analytics`.
- `/api/bot/status`, `/api/bot/qr`, `/api/bot/toggle`, `/api/bot/logout`.
- `/api/spreadsheets/*`, `/api/google-sheets/*`, `/api/export`.
- `/hubs/notifications` via SignalR.
- `/api/webhook/whatsapp`.
- `/api/superadmin/*`.

Services centrais:

- `AgendaService`: disponibilidade, horários, bloqueios, almoco, turnos, data local do Brasil.
- `SchedulerService`: criação atômica de agendamentos, validação de slot e notificações.
- `ServiceCatalogService`: catalogo dinamico de serviços, preço, duração e status.
- `NotificationService`: SignalR, email e alertas.
- `SpreadsheetMaintenanceService`: Excel e Google Sheets.
- `BackupService`: backup e limpeza.
- `AuthService`: hash, JWT e autenticação.

Pontos positivos:

- Regras críticas de agenda estao no backend.
- O catalogo de serviços agora e dinamico.
- O backend já tem separação parcial por endpoints.
- Há SignalR para notificações em tempo real.
- Há base multi-tenant com `StoreId`, filtros globais e superadmin.

Pontos frágeis:

- Muitas migrações/schema fixes são feitas manualmente em `Program.cs`, misturando bootstrap, seed e runtime.
- Alguns endpoints fazem agregações em memória após `ToList`, o que pode pesar em SaaS.
- SQLite atende bem MVP local, mas não é ideal para alto volume multi-cliente.
- Ainda existe um proxy Node local entre dashboard e backend; ele e util no MVP, mas vira complexidade em cloud.

## 5. Banco de dados

Tabelas principais:

- `Appointments`: agenda, cliente, servico, preço, profissional, status e lembretes.
- `Barbeiros`: profissionais, horários, dias trabalhados, bloqueios e customizacoes.
- `Users`: usuários, roles, telefone, 2FA e vinculo com profissional.
- `Stores`: lojas/tenants, plano, URLs e status.
- `ConversationSessions`: estado do chatbot.
- `SystemConfigs`: configurações dinâmicas.
- `UnavailableDays`: bloqueios/folgas/feriados.
- `AuditLogs`: trilha de eventos.

Riscos:

- `SystemConfigs` e flexivel, mas sem tipagem forte ou versionamento de schema.
- Horários customizados por JSON são rápidos para MVP, mas exigem validação mais formal para SaaS.
- Auditoria existe, mas não substitui event sourcing ou histórico completo de mudancas.
- SQLite local exige rotina clara de backup, WAL e manutencao.

## 6. Autenticacao e sessões

Camadas atuais:

- Login no backend .NET com JWT.
- Proxy local guarda sessões em `data/dashboard-sessions.json`.
- Frontend guarda token no `localStorage`.
- Roles: `superadmin`, `admin`, `barbeiro`.
- Filtro por `StoreId` e por `BarberId` para barbeiros.

Riscos:

- `localStorage` e simples, mas mais vulneravel a XSS do que cookie httpOnly.
- Sessao local em arquivo funciona no MVP, mas não escala horizontalmente.
- Superadmin e multi-tenant ainda precisam de hardening antes de SaaS comercial.
- Ngrok exposto deve ser usado com cautela e API keys fortes.

## 7. Notificacoes

Camadas atuais:

- SignalR LongPolling/WebSocket.
- Browser Notifications.
- Service Worker/PWA.
- Som e vibracao quando suportado.
- Central interna de notificações.
- Email via SendGrid quando configurado.

Limitacoes:

- Push com aba totalmente fechada depende do navegador, PWA instalada e suporte do sistema operacional.
- iPhone tem suporte mais restrito e depende de instalacao PWA/Safari.
- Não ha servidor Web Push com VAPID/subscriptions persistidas por usuário; hoje o melhor caminho e dashboard/PWA ativa ou em segundo plano.

## 8. Relatórios

Dados atuais:

- Total de agendamentos.
- Receita estimada e realizada.
- Presenca.
- Clientes novos/recorrentes.
- Servicos populares.
- Receita por dia.
- Profissionais.
- Horarios e dias mais movimentados.
- Cancelamentos via `AuditLogs`.

Pontos fortes:

- Relatórios consultam banco real.
- Filtros persistem no navegador.
- Recarregam ao abrir a aba, ao reconectar e em eventos de agenda.

Riscos:

- Em bases grandes, agregações devem ser movidas para queries SQL otimizadas.
- Status de cancelamento ainda depende de auditoria, pois agendamento cancelado e removido da tabela principal.
- Faltam snapshots históricos para comparativos comerciais mais robustos.

## 9. Integracoes

Existentes:

- WhatsApp Web via `whatsapp-web.js`.
- Google Sheets via webhook Apps Script.
- Excel via ClosedXML.
- SendGrid opcional.
- SignalR.
- PWA/browser notifications.
- Ngrok para HTTPS/tunelamento local.

Riscos:

- WhatsApp Web não e API oficial; pode quebrar por mudancas do WhatsApp.
- Google Sheets por Apps Script depende de URL correta e limites do Google.
- Ngrok gratuito troca URL e não é ideal para operação permanente.

## 10. Gargalos e riscos estruturais

Prioridade alta:

- Separar bootstrap/migracao/seed do `Program.cs`.
- Evitar `ToList` antes de agregações em endpoints de relatorio.
- Substituir cache de sessão em memória por Redis/SQLite transacional para multi-instância.
- Formalizar schema para horários por profissional.
- Melhorar proteção de tokens e cookies para ambiente web público.
- Criar testes vivos de fluxo do bot com ambiente controlado.

Prioridade media:

- Dividir `script-dashboard.js` por modulos.
- Criar camada de client API no frontend.
- Padronizar DTOs e nomes de propriedades.
- Melhorar observabilidade por tenant, loja e telefone.
- Adicionar jobs de manutencao para compactar SQLite e limpar logs antigos.

Possiveis memory leaks:

- Dashboard cria timers uma vez, mas deve continuar evitando recriação em troca de views.
- Bridge mantém caches de dedupe, polls e rate limit; já possui prune, mas limites devem ser monitorados.
- Chromium/Puppeteer pode crescer em memória após dias; supervisor/restart controlado e recomendado no MVP local.

## 11. Roadmap etapa 1 - MVP local no cliente

Objetivo: sistema estavel rodando em notebook, desktop ou VPS simples para uma barbearia.

Requisitos minimos:

- Windows 10/11 ou VPS simples.
- Node.js homologado.
- .NET Runtime 8.
- Porta local para dashboard, backend e bridge.
- Pasta `data` persistente.
- Backup automático de `agendamentos.db`, `dashboard-sessions.json`, `bot-state.json` e configurações.
- Sessao WhatsApp preservada em `WhatsAppBridge/.wwebjs_auth`.

Operacao recomendada:

- Usar `INSTALAR-CLIENTE.bat` para preparar.
- Usar `INICIAR-SISTEMA-LOCAL.bat` para operar.
- Usar `STATUS-SISTEMA-LOCAL.bat` para diagnostico.
- Usar `PARAR-SISTEMA-LOCAL.bat` para parada segura.
- Evitar apagar `data` e `.wwebjs_auth`.

Estabilidade:

- Supervisor local para reiniciar processos.
- Health check de backend, dashboard e Bridge.
- Logs separados por componente.
- Backup diario e retenção dos ultimos backups.
- Limpeza segura de cache sem apagar dados.
- QR Code com feedback de idade/estado.

Manutencao:

- Checklist semanal: backup, logs, espaÃ§o em disco, status WhatsApp, teste de agendamento.
- Atualizacao por ZIP versionado.
- Nunca sobrescrever `data` do cliente durante atualizacao.
- Validar Google Sheets após atualizacao.

Limites do MVP local:

- Dependencia do notebook ligado.
- Internet local instavel afeta WhatsApp.
- Ngrok gratuito não é ideal para URL permanente.
- Sem alta disponibilidade.
- Sem isolamento forte para multiplos clientes no mesmo processo.

## 12. Roadmap etapa 2 - SaaS multiusuário/cloud

Objetivo: produto comercial escalavel para varias barbearias.

Arquitetura recomendada:

- Frontend web separado, idealmente React/Next.js ou SPA modular.
- Backend API .NET em containers.
- Banco PostgreSQL gerenciado.
- Redis para cache, sessões, locks e filas leves.
- Fila dedicada para eventos: RabbitMQ, SQS, Azure Service Bus ou equivalente.
- Worker separado para mensagens, lembretes, planilhas e notificações.
- WebSocket/SignalR escalado com backplane Redis.
- Storage para arquivos/exportacoes.
- Observabilidade centralizada: logs, métricas, traces e alertas.

Multi-tenant:

- `StoreId` obrigatorio em todas as entidades.
- Indices por tenant e data.
- Testes de isolamento de dados.
- Políticas de autorizacao centralizadas.
- Auditoria por usuário, loja e IP.
- Plano/assinatura vinculados a permissoes e limites.

Autenticacao:

- Cookies httpOnly ou provedor de identidade.
- Refresh token seguro.
- 2FA real para administradores.
- RBAC: superadmin, dono, gerente, barbeiro, recepcao.
- Convites e recuperacao de senha auditados.

WhatsApp:

- Para escala comercial, avaliar API oficial Meta WhatsApp Cloud.
- Se mantiver WhatsApp Web, isolar uma Bridge por loja/tenant.
- Sessao por tenant em storage isolado.
- Health check e restart por tenant.
- Filas por tenant para evitar bloqueio global.

Banco e dados:

- Migracoes formais EF Core.
- PostgreSQL com backups automáticos e PITR.
- Particionamento/indices para `Appointments`, `AuditLogs` e mensagens.
- Historico de cancelamentos/remarcacoes sem deletar fatos.
- Relatórios baseados em views/materialized views quando crescer.

Notificacoes:

- Web Push real com VAPID e subscriptions persistidas por usuário/dispositivo.
- SignalR escalavel.
- Preferencias por usuário.
- Fallback por email/WhatsApp interno.
- Dedupe por evento.

Billing e comercial:

- Planos por loja, profissionais, mensagens, modulos e integraÃ§Ãµes.
- Stripe/Mercado Pago/Asaas para cobranca.
- Bloqueio gracioso por inadimplencia.
- Trial, cupons e upgrade/downgrade.
- Painel superadmin com MRR, churn, uso e saúde por cliente.

Seguranca:

- HTTPS obrigatorio.
- WAF/rate limiting.
- Secrets em vault.
- Backups criptografados.
- Logs sem dados sensiveis excessivos.
- LGPD: exportacao, exclusao e retenção de dados.
- Pentest antes de vender em escala.

Alta disponibilidade:

- Deploy blue/green ou rolling.
- Health checks por container.
- Banco gerenciado com replicas/backups.
- Workers idempotentes.
- Filas persistentes.
- Runbooks de incidente.

## 13. Proximos passos recomendados

1. Congelar o MVP local como versão entregavel.
2. Criar checklist de QA por release.
3. Modularizar `script-dashboard.js`.
4. Formalizar migracoes EF Core e reduzir schema manual no `Program.cs`.
5. Criar tabela de histórico de eventos de agendamento.
6. Adicionar testes vivos opcionais para fluxo de agenda e bot.
7. Planejar SaaS com PostgreSQL, Redis, filas, Web Push real e deploy containerizado.



