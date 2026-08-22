# Fase 3 - Dashboard essencial para barbearia

Data: 2026-06-30

## Resumo executivo

A Fase 3 consolida o produto como uma dashboard operacional vendavel para barbearias, sem criar novos segmentos nesta etapa.

O foco foi melhorar a primeira tela, deixar agenda, WhatsApp, clientes, servicos e checklist mais claros para o dono da barbearia, e preservar o multi-tenant usando os endpoints existentes, todos dependentes do tenant logado ou do contexto de superadmin.

## Checkpoint pos-Fase 1 e Fase 2

### Superadmin

O superadmin ja possui o fluxo central para:

- criar loja por `/api/superadmin/stores`;
- editar nome, slug, plano, status e URLs tecnicas por `PATCH /api/superadmin/stores/{id}`;
- listar status, receita, usuarios e contagens por loja;
- abrir detalhes por `GET /api/superadmin/stores/{id}`;
- listar usuarios por `GET /api/superadmin/stores/{id}/users`;
- suspender e reativar loja por `toggleStoreActive`, que envia `IsActive`;
- criar barbearia como tipo padrao no modal.

Os botoes comerciais de `CarWash`, `Pizzeria` e `ComputerOptimization` permanecem no HTML apenas como estrutura futura, mas ficam ocultos na criacao de loja. Isso respeita a expansao futura sem vender outros segmentos agora.

### Release

O script principal `scripts/build-release.ps1` publica backend, copia dashboard, bridge, superadmin, scripts e docs, prepara pastas operacionais limpas e valida sintaxe JS antes de compactar.

Nesta fase a validacao do ZIP foi reforcada para barrar:

- banco SQLite operacional e arquivos WAL/SHM;
- `.env` e variantes;
- `CREDENCIAIS-ACESSO.txt`;
- sessoes persistidas do dashboard;
- metadados locais de lojas;
- exports/exportacoes;
- arquivos dentro de logs e backups;
- sessoes/cache/tokens do WhatsApp Bridge.

## Diagnostico da dashboard antes dos ajustes

| Area | Situacao encontrada |
| --- | --- |
| Primeira tela | A agenda era a primeira tela e ja tinha metricas, mas faltava resumo executivo para o dono. |
| Agenda | Ja carregava hoje, futuros, filtros, bloqueios e agendamento manual com `/api/horarios-livres`. |
| WhatsApp/bot | Ja tinha status, QR, pareamento, pausar/ativar, limpeza segura e simulacao. |
| Relatorios | Ja usava `/api/stats` e `/api/reports/appointments`, com filtros, graficos e exportacao. |
| Clientes/CRM | Nao havia uma tela simples para historico e recorrencia. |
| Servicos | O endpoint `/api/servicos` existia, mas a dashboard nao oferecia CRUD operacional direto. |
| Onboarding | Havia checklist em documentacao, mas nao um checklist vivo dentro da tela inicial. |

## O que foi implementado

### Primeira tela util para o dono

Foi criado um bloco "Painel do dono" no topo da agenda com:

- atendimentos de hoje;
- proximo horario;
- receita estimada de hoje;
- pendentes/concluidos;
- status do WhatsApp;
- status do bot;
- servico mais marcado;
- acoes rapidas para agendar, ver clientes, editar servicos, conectar WhatsApp e ir para agenda do dia.

### Checklist de implantacao vivo

O checklist na dashboard calcula o preparo da loja com base em:

- nome da loja;
- horarios de funcionamento;
- servicos ativos;
- profissionais ativos;
- WhatsApp conectado;
- bot ativo;
- agenda validada com teste;
- mensagens automaticas configuradas.

### Clientes / CRM basico

Foi adicionada a aba `Clientes`, derivada de agendamentos reais via `/api/reports/appointments`.

Ela mostra:

- total de clientes;
- recorrentes;
- inativos;
- receita historica;
- busca por nome, telefone ou servico;
- filtro por novo, recorrente e inativo;
- historico recente por cliente.

Nao foi criada uma tabela nova de CRM nesta fase para evitar risco e duplicacao de dados.

### Servicos da barbearia

Foi adicionado um gerenciador operacional de servicos em Ajustes usando o catalogo real:

- listar servicos;
- criar servico;
- editar nome, preco, duracao e ativo/inativo;
- pausar/ativar;
- remover quando o backend permitir.

As operacoes usam `GET/POST/PATCH/DELETE /api/servicos`, que aplica `StoreId` do tenant atual no backend.

### WhatsApp, bot e estabilidade

O cockpit da primeira tela reaproveita `loadBotStatus()` e se atualiza quando o status muda. Nao foi criado endpoint novo nem polling adicional fora do intervalo ja existente.

### Multi-tenant

As mudancas de dashboard continuam usando:

- token do usuario logado;
- proxy local com `Authorization`;
- endpoints existentes do tenant atual;
- backend com `ITenantService` e filtros por `StoreId`.

Nenhuma alteracao global de entidade, tabela ou contrato multi-tenant foi feita.

## Arquivos alterados

- `dashboard-improved.html`
- `script-dashboard.js`
- `scripts/build-release.ps1`
- `tests/api-security.test.js`
- `docs/FASE3-DASHBOARD-ESSENCIAL.md`

## O que nao foi feito nesta etapa

- Desenvolvimento de lavajato, pizzaria ou otimizacao de computador.
- Refatoracao gigante de `Barbeiro` para `Profissional`.
- Nova tabela de clientes/CRM.
- Alteracao estrutural do banco de dados.
- Mudanca do contrato multi-tenant.

## Criterios de aceite da Fase 3

- A primeira tela explica o dia da barbearia sem depender de relatorio externo.
- O dono consegue criar agendamento, ver proximos horarios e acompanhar status do WhatsApp.
- A dashboard possui uma visao basica de clientes baseada em dados reais.
- Servicos podem ser ajustados pela dashboard e continuam disponiveis para bot/agendamento manual.
- O superadmin continua focado em criar barbearias.
- O release nao deve empacotar dados operacionais reais.
- Build e testes devem permanecer verdes.

## Validacao

Resultados executados localmente:

| Comando | Resultado |
| --- | --- |
| `node --check api-nythar.js` | OK |
| `node --check script-dashboard.js` | OK |
| `node --check WhatsAppBridge/index.js` | OK |
| `node --check scripts/supervisor.js` | OK |
| `node --check scripts/gerar-segredos.js` | OK |
| `npm test` | 52 aprovados, 1 teste HTTP vivo opcional pulado |
| `dotnet build WhatsAppBotSolution.sln` | Compilacao com exito, 0 avisos, 0 erros |
| `dotnet test WhatsAppBotSolution.sln` | Exit code 0; a solucao atual referencia apenas `WhatsAppBot.Worker` |
| `dotnet test WhatsAppBot.Tests/WhatsAppBot.Tests.csproj` | 61 aprovados, 0 falhas |
| Smoke HTTP em backend temporario | Criou loja Barbershop, editou plano para Premium, suspendeu, reativou, consultou usuarios e confirmou 6 servicos |
| Smoke HTTP pelo proxy Node | Login superadmin, criacao de loja, edicao, suspensao, reativacao, detalhes e usuarios passaram |
| `powershell -File scripts/build-release.ps1` | ZIP gerado em `release/NytharDashboard-2.0.zip` |
| Verificacao externa do ZIP | 175 entradas, 22 MB, 0 arquivos proibidos |

Observacao: os smokes usaram `BARBEARIA_DATA_DIR` temporario em `%TEMP%`, portanto nao tocaram no banco real do cliente. O smoke do proxy fez backup e restauracao de `data/dashboard-sessions.json`.
