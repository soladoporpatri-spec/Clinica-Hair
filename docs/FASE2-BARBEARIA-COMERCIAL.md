# Fase 2 - Barbearia como primeiro segmento comercial

## Posicionamento

A primeira versao comercial deve ser vendida como um SaaS operacional para barbearias: agenda por profissional, WhatsApp com bot de agendamento, dashboard diario, relatorios, lembretes automaticos e clube de fidelidade.

O produto nao deve ser apresentado como sistema generico multi-segmento nesta fase. A arquitetura continua multi-tenant e preparada para outros ramos, mas a oferta, demo, onboarding e telas principais devem falar com dono de barbearia.

## O que fica para depois

- Landing pages e pacotes comerciais para lavajato, pizzaria e otimizacao de computador.
- UX especifica para segmentos sem profissional por horario.
- Templates comerciais de mensagens para outros segmentos.
- Seeds e demos oficiais para outros segmentos.
- Renomeacao estrutural de entidades historicas como `Barbeiro` para `Profissional`.
- Migracoes de banco para neutralizar nomes internos legados.

## Nucleo generico x segmento barbearia

| Area | Tipo | Onde aparece hoje |
| --- | --- | --- |
| Loja/empresa | Nucleo generico | `Store`, `SuperAdminEndpoints`, `TenantService`, superadmin |
| Usuarios e permissoes | Nucleo generico | `User`, `AuthEndpoints`, login, superadmin usuarios |
| Clientes | Nucleo generico | `Appointment.ContactName/PhoneNumber`, assinaturas, relatorios |
| Agenda | Nucleo generico | `SchedulingEndpoints`, `AgendaService`, dashboard agenda |
| Servicos | Nucleo generico | `ServicoItem`, `ServiceCatalogService`, `/api/servicos` |
| WhatsApp | Nucleo generico | `WhatsAppBridge`, `WhatsAppClient`, bot status/QR |
| Chatbot | Nucleo generico com textos por segmento | `ConversationStateBase`, estados de conversa, `BusinessLabels` |
| Relatorios | Nucleo generico | `AnalyticsEndpoints`, dashboard relatorios, exportacao |
| Configuracoes | Nucleo generico | `SettingsEndpoints`, `SettingsKeyPolicy`, dashboard ajustes |
| Planos comerciais SaaS | Nucleo generico | `PlanCatalog`, `ModuleCatalog`, superadmin financeiro |
| Logs, backup e release | Nucleo generico | `AuditLog`, `BackupService`, scripts de release |
| Barbeiros/profissionais | Especifico de barbearia hoje | `Barbeiro`, `BarberEndpoints`, `BarbeiroHorario` |
| Servicos de corte/barba | Especifico de barbearia | `ServicoInfo`, seed de barbearia, demo barbearia |
| Agenda por profissional | Especifico de barbearia | `SchedulerService`, `AgendaService`, `usesProfessionalScheduling()` |
| Clube de fidelidade | Especifico da oferta barbearia inicial | `SubscriptionService`, `SubscriptionEndpoints`, tela Fidelidade |
| Textos comerciais de barbearia | Especifico de barbearia | `dashboard-improved.html`, `script-dashboard.js`, `DefaultAutomationSeeder` |
| Mensagens automaticas de barbearia | Especifico de barbearia | `DefaultAutomationSeeder`, `data/demo-barbearia.json` |

## Arquivos onde a separacao ja aparece

- `WhatsAppBot.Worker/Models/BusinessType.cs`: enum estrutural para segmentos.
- `WhatsAppBot.Worker/Services/BusinessLabels.cs`: textos adaptaveis por tipo de negocio.
- `script-dashboard.js`: `BIZ_LABELS` separa rotulos por ramo, mas a oferta comercial agora privilegia `Barbershop`.
- `SuperAdminEndpoints.cs`: cria loja e servicos padrao por `BusinessType`.
- `ServiceCatalogService.cs`: evita fallback de servicos de barbearia para outros segmentos.
- `SubscriptionService.cs`: ainda e fortemente orientado a barbearia/fidelidade.

## Ajustes executados nesta fase

| Termo/problema | Ajuste |
| --- | --- |
| `Nythar - Dashboard & Chatbot` como marca do produto | Login, dashboard, PWA, service worker, package, superadmin, token de login, e-mail legado, template WhatsApp e seed default passaram a usar `Nythar`, `Minha loja` ou o nome real da loja. |
| `Clube VIP` | Navegacao, mensagens principais e confirmacao do bot passaram para `Fidelidade` / `Clube de fidelidade`. |
| `Barbeiro` em area generica de usuario | Label de funcao no superadmin passou para `Profissional`; valor interno `barbeiro` foi mantido. |
| Outros segmentos no cadastro comercial | Botoes de lavajato, pizzaria e otimizacao foram ocultados no superadmin; backend segue compatvel. |
| Demo ausente para venda | Criados `data/demo-barbearia.json` e `scripts/seed-demo-barbearia.ps1`. |
| Checklist de implantacao | Criado `docs/CHECKLIST-IMPLANTACAO-BARBEARIA.md`. |

## Arquivos alterados nesta fase

- `login.html`, `manifest.json`, `sw.js`, `package.json`, `package-lock.json`
- `dashboard-improved.html`, `script-dashboard.js`, `superadmin/index.html`
- `WhatsAppBot.Worker/Program.cs`
- `WhatsAppBot.Worker/Services/AuthService.cs`
- `WhatsAppBot.Worker/Services/ConversationStateBase.cs`
- `WhatsAppBot.Worker/Services/AwaitingMenuSelectionState.cs`
- `WhatsAppBot.Worker/Services/ConfirmingAppointmentState.cs`
- `WhatsAppBot.Worker/Services/SubscriptionService.cs`
- `WhatsAppBot.Worker/Services/NotificationService-Improved.cs`
- `WhatsAppBot.Worker/Startup/DefaultAutomationSeeder.cs`
- `WhatsAppBot.Worker/Endpoints/SubscriptionEndpoints.cs`
- `data/whatsapp-templates.json`
- `data/demo-barbearia.json`
- `scripts/seed-demo-barbearia.ps1`
- `docs/CHECKLIST-IMPLANTACAO-BARBEARIA.md`
- `docs/FASE2-BARBEARIA-COMERCIAL.md`
- `tests/api-security.test.js`

## Termos mantidos e motivo

- `Barbeiro`, `Barbeiros`, `BarbeiroHorario`, `BarberEndpoints`: nomes internos/tabelas/contratos historicos. Renomear agora exigiria migracao ampla e risco alto.
- O slug da primeira loja piloto continua reconhecido somente para compatibilidade e deduplicacao de instalacoes antigas; novas telas e seeds usam nomes genericos.
- `CarWash`, `Pizzeria`, `ComputerOptimization` no backend: mantidos como estrutura futura, sem desenvolvimento comercial nesta fase.
- `vip` em classes CSS/IDs como `vip-layout-grid`: mantido por ser detalhe tecnico visual, sem impacto direto para o cliente.

## Demo de barbearia

Arquivos:

- `data/demo-barbearia.json`
- `scripts/seed-demo-barbearia.ps1`

Conteudo da demo:

- loja ficticia `Barbearia Avenida`;
- 5 servicos;
- 3 profissionais;
- horario 09:00-19:00;
- 4 clientes ficticios;
- 4 agendamentos futuros;
- mensagens automaticas basicas;
- bot em modo simulado ou QR real, conforme ambiente.

Como iniciar:

1. Inicie o backend local.
2. Defina a API key usada pelo backend:

```powershell
$env:API_KEY="sua-chave-local"
```

3. Rode:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/seed-demo-barbearia.ps1 -BackendUrl http://127.0.0.1:5000
```

4. Entre com:

```text
Usuario: demo-dono
Senha: Demo@2026!
```

Limitacoes:

- A demo cria dados via API local; nao deve ser rodada em banco de cliente real sem confirmar o slug.
- O WhatsApp pode ficar simulado se a bridge nao estiver conectada.
- O script e idempotente para loja, profissionais e parte dos agendamentos, mas a demo ideal e em banco limpo.

## Sugestoes futuras sem executar agora

- Criar camada `Professionals` generica por cima de `Barbeiro`, mantendo compatibilidade de banco.
- Separar `SubscriptionService` em fidelidade generica + regras especificas de barbearia.
- Mover `BIZ_LABELS` para arquivo de configuracao versionado por segmento.
- Criar templates de demo por segmento apenas quando cada segmento virar produto comercial.
- Introduzir migrations para nomes neutros somente em uma release planejada e com backup.
