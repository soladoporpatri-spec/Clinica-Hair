# Plano de Producao e Roadmap

## Estado alvo para vender a uma barbearia

O produto deve operar com tres processos persistentes:

- `barbearia-backend`: ASP.NET Core, banco SQLite, regras de agenda, bot e APIs.
- `barbearia-dashboard`: Node/Express, dashboard, login, proxy seguro para backend.
- `barbearia-bridge`: WhatsApp Web.js, Chromium, sessao persistida e envio/recebimento.

Para uma barbearia, SQLite e systemd sao suficientes se houver backup diario, restart automatico e monitoramento basico.

## Essencial antes da primeira venda

Prioridade critica:

- Rodar 7 dias seguidos em Oracle com uma conta WhatsApp real sem perder sessao.
- Validar fluxo completo: oi, servico, profissional, data, horario, confirmacao, cancelamento e reagendamento.
- Testar queda e retorno: `systemctl restart barbearia-bridge`, reboot da VPS e reconexao do WhatsApp.
- Confirmar backup diario, backup offsite e `restore-test-sqlite.sh`.
- Trocar todos os segredos do `.env`.
- Ativar SSL valido em `app.seudominio.com`.

Prioridade alta:

- Tela clara de status: backend, bridge, WhatsApp conectado, ultimo webhook, ultima mensagem recebida.
- Google Sheets com retorno visual mostrando registros enviados.
- Logs de erro acessiveis pelo SuperAdmin.
- Manual curto para o dono da barbearia.

Prioridade media:

- Monitor externo simples, como UptimeRobot/Better Stack, batendo em `/health/deep`.
- Exportacao mensal automatica.
- Politica de retencao de logs/backups, journald e sessoes WhatsApp.

## Riscos atuais

- WhatsApp Web.js depende do comportamento do WhatsApp Web e pode exigir reautenticacao.
- Sessao do WhatsApp pode cair se o numero for usado intensamente em outro aparelho.
- SQLite e adequado para uma loja, mas exige backup e cuidado em futuras multiplas lojas.
- Multi-tenant ainda deve ser auditado com testes automatizados antes de vender para varias barbearias.
- Oracle Free Tier pode ter falta de capacidade na criacao de A1 em algumas regioes e pode reclamar instancias ociosas.

## Decisoes de infraestrutura atuais

- Producao systemd usa `WhatsAppBridge/bridge-factory.js`, com factory em `127.0.0.1:2999`.
- Cada loja usa `bridgePort = 3000 + storeId`; loja 1 em `127.0.0.1:3001`.
- A1 Always Free deve ser planejado como `2 OCPUs / 12 GB RAM` para contas Always Free atuais.
- SQLite e o banco de producao para uma barbearia pequena.
- PostgreSQL fica para SaaS multi-loja real, em migracao planejada com testes e backup, nao por simples troca de connection string.

## Roadmap

Fase 1: primeira barbearia

- Deploy systemd na Oracle.
- Backup diario validado.
- Painel de status confiavel.
- Manual do dono.
- Fluxos do bot estabilizados.

Fase 2: produto mais polido

- Onboarding guiado com QR, horario, profissionais e servicos.
- Relatorios financeiros com filtros por periodo/profissional.
- Notificacoes de bot offline no dashboard.
- Google Sheets com setup guiado e diagnostico.

Fase 3: SaaS multi-barbearia

- Migrar de SQLite para PostgreSQL.
- Testes automatizados de isolamento por `StoreId`.
- Provisionamento de loja pelo SuperAdmin.
- Bridge por loja ou fila centralizada por tenant.
- Billing/assinatura e suspensao automatica.

Fase 4: escala

- Observabilidade centralizada.
- Jobs separados do backend web.
- Fila persistente para mensagens.
- Deploy por container ou orquestracao simples.

## Recomendacoes baratas

Dominio:

- Registro.br para `.com.br`.
- Cloudflare Registrar para dominios internacionais quando disponivel.
- Namecheap/Porkbun como opcoes baratas.

DNS:

- Cloudflare DNS gratuito, mesmo que o dominio seja comprado em outro lugar.

Monitoramento:

- UptimeRobot gratuito ou Better Stack plano gratuito.

Email:

- Para comecar, evite email transacional complexo. Use WhatsApp e dashboard.
