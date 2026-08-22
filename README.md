# Nythar - Dashboard & Chatbot

Projeto de software criado para facilitar o atendimento e a organização de negócios locais. Ele reúne agenda, clientes, profissionais, serviços, relatórios e atendimento pelo WhatsApp em uma única dashboard.

O funcionamento é simples: o cliente conversa com o chatbot, escolhe o que precisa e o projeto ajuda a organizar essas informações para a equipe responsável pelo atendimento.

## O que o sistema faz

- **Agenda completa:** mostra horários marcados, horários livres, bloqueios e calendário.
- **Agendamento pelo WhatsApp:** o cliente consegue marcar um horário sem precisar ligar para a loja.
- **Consulta de agendamentos:** cada cliente pode conferir os próprios horários.
- **Cancelamento e reagendamento:** permite trocar ou cancelar um atendimento pelo chatbot.
- **Serviços e profissionais:** organiza preços, duração, expediente, pausas, folgas e disponibilidade.
- **Clientes e CRM:** guarda histórico de visitas e ajuda a acompanhar clientes frequentes.
- **Clube de fidelidade:** controla benefícios e usos do clube da loja.
- **Relatórios:** apresenta informações sobre atendimentos, faturamento, clientes e serviços.
- **Notificações em tempo real:** avisa a equipe quando acontece uma mudança importante.
- **Exportação:** permite trabalhar com Excel, CSV e Google Sheets.
- **Várias lojas:** cada empresa acessa somente os próprios dados.
- **Superadmin:** administra lojas, planos, módulos e o funcionamento geral da plataforma.

## Como funciona

1. O cliente envia uma mensagem para o WhatsApp da loja.
2. O chatbot apresenta as opções disponíveis.
3. O cliente escolhe serviço, profissional, data e horário.
4. O backend confere se o horário ainda está livre.
5. O agendamento é salvo e aparece na dashboard.
6. A equipe recebe a atualização em tempo real.

O mesmo fluxo atende consultas, cancelamentos e reagendamentos. Quando o bot é pausado, a equipe pode continuar a conversa manualmente.

## Partes do projeto

- **Dashboard:** interface usada pela loja para acompanhar a operação.
- **Backend:** aplica as regras, controla horários, contas e dados de cada empresa.
- **Chatbot:** conduz a conversa e transforma escolhas em ações.
- **WhatsApp Bridge:** liga o WhatsApp Web ao backend.
- **Superadmin:** painel geral da plataforma SaaS.
- **Supervisor local:** inicia, acompanha e recupera os serviços no Windows.

## Tecnologias usadas

### Backend

- **C# e .NET 8** para as APIs e regras do sistema.
- **ASP.NET Core** para autenticação, endpoints e serviços em tempo real.
- **Entity Framework Core** para acesso aos dados.
- **SQLite** no funcionamento local e **PostgreSQL** como opção de servidor.
- **SignalR** para notificações instantâneas.
- **JWT e BCrypt** para proteger acessos e senhas.
- **Serilog e Polly** para logs, tentativas automáticas e recuperação de falhas.

### Dashboard

- **HTML, CSS e JavaScript** na interface.
- **Tailwind CSS** para os componentes e o visual responsivo.
- **Chart.js** para os gráficos.
- **Font Awesome** para os ícones.
- **PWA e Service Worker** para instalação no dispositivo e notificações.

### WhatsApp e integrações

- **Node.js e Express** no proxy local e nos serviços de integração.
- **whatsapp-web.js e Puppeteer** na conexão com o WhatsApp Web.
- **ClosedXML** na geração de planilhas Excel.
- **Google Sheets** por webhook configurável.

### Testes

- **xUnit** para o backend em C#.
- **Node Test Runner** para dashboard, proxy, segurança e empacotamento.
- **Health checks** para conferir backend, dashboard e WhatsApp Bridge.

## Estrutura principal

```text
WhatsAppBot.Worker/   Backend .NET, regras e APIs
WhatsAppBot.Tests/    Testes automatizados do backend
WhatsAppBridge/       Integração com o WhatsApp Web
superadmin/           Painel do superadministrador
tests/                Testes do Node.js e dos arquivos de entrega
scripts/              Inicialização, backup, atualização e releases
deploy/               Arquivos para Docker, Linux e servidor
docs/                 Guias e explicações técnicas
api-nythar.js          Servidor local e proxy da dashboard
dashboard-improved.html Interface operacional
```

## Rodando em desenvolvimento

### Requisitos

- Node.js 20 LTS ou mais recente.
- .NET 8 SDK.
- Google Chrome ou Chromium para o WhatsApp Bridge.

### Preparar o projeto

```powershell
npm install
Set-Location WhatsAppBridge
npm install
Set-Location ..
dotnet restore WhatsAppBotSolution.sln
node scripts/gerar-segredos.js
```

### Iniciar

```powershell
npm run supervise
```

A dashboard local fica disponível em `http://127.0.0.1:4000/dashboard-improved.html`.

### Testar

```powershell
npm test
dotnet test WhatsAppBot.Tests/WhatsAppBot.Tests.csproj -c Release
```

## Segurança

- Dados de cada loja são separados pelo identificador da empresa autenticada.
- Senhas são protegidas antes de serem salvas.
- Chaves, bancos reais, logs e sessões do WhatsApp não devem entrar no GitHub.
- Os exemplos de configuração não possuem credenciais reais.
- O projeto aplica limitação de requisições e validação de acesso.

## Observação sobre o WhatsApp

A integração usa automação do WhatsApp Web. Ela depende do funcionamento da plataforma e pode precisar de ajustes quando o WhatsApp muda. Use com responsabilidade e respeite as regras do serviço.

## Objetivo

O objetivo da Nythar é diminuir tarefas manuais, evitar conflitos de horário e deixar o atendimento mais rápido para clientes e equipes.

O projeto continua recebendo melhorias, testes e ajustes de estabilidade.
