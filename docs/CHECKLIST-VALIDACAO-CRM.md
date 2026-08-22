# Checklist de validacao do CRM

## Backend

- `GET /api/customers` retorna apenas clientes da loja logada.
- `GET /api/customers/{telefone}` nao retorna cliente de outra loja.
- `PATCH /api/customers/{telefone}` salva observacoes e preferencias da loja correta.
- `GET /api/customer-tags` cria/lista tags padrao da loja.
- `POST /api/customers/{telefone}/tags` adiciona tag somente ao cliente da loja.
- `DELETE /api/customers/{telefone}/tags/{tagId}` remove tag sem afetar outra loja.
- `POST /api/customer-reminders` cria lembrete com `StoreId` correto.
- `PATCH /api/customer-reminders/{id}` conclui/cancela apenas lembrete da loja.
- `GET /api/customers/reports/summary` respeita periodo e tenant.

## Dashboard

- Login como admin de barbearia abre a aba Clientes sem erro.
- KPIs de clientes, recorrentes, sumidos, VIP/fieis, receita, sem proximo horario e lembretes carregam.
- Busca por nome, telefone, servico ou profissional funciona.
- Filtro por status funciona.
- Filtro por tag funciona.
- Filtro por retorno funciona: sumidos/risco, sem proximo horario, com falta e com lembrete.
- Filtro por servico preferido funciona.
- Perfil do cliente abre em modal.
- Historico de atendimentos aparece no perfil.
- Timeline aparece no perfil.
- Observacao interna salva e volta ao abrir o perfil.
- Preferencias salvam e voltam ao abrir o perfil.
- Tag pode ser adicionada e removida.
- Lembrete pode ser criado e concluido.
- Botao WhatsApp pede confirmacao e abre conversa manual.
- Botao Agendar abre o modal de agendamento com nome/telefone preenchidos.
- Modo claro/escuro nao quebra contraste dos cards, tags, modal e filtros.

## Regressao

- Agenda continua carregando.
- Agendamento manual continua salvando.
- Cancelamento de agendamento continua funcionando.
- Bot WhatsApp e QR Code continuam respondendo.
- Relatorios existentes continuam carregando.
- Superadmin continua criando e excluindo lojas.

## Comandos

```powershell
dotnet build .\WhatsAppBotSolution.sln --no-restore
dotnet test .\WhatsAppBot.Tests\WhatsAppBot.Tests.csproj --no-restore --logger "console;verbosity=minimal"
node --check .\api-nythar.js
node --check .\script-dashboard.js
node --test .\tests\api-security.test.js
```
