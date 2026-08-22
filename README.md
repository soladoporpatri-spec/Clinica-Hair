# Clínica Hair

Sistema de atendimento e gestão criado para facilitar a rotina de barbearias. Ele junta agenda, clientes, profissionais, serviços, relatórios e atendimento pelo WhatsApp em um só lugar.

A ideia é simples: o cliente conversa com o bot, escolhe o que precisa e o sistema organiza tudo na dashboard da barbearia.

## O que o sistema faz

- **Agenda completa:** mostra horários marcados, horários livres, bloqueios e calendário.
- **Agendamento pelo WhatsApp:** o cliente consegue marcar um horário sem precisar ligar para a barbearia.
- **Meus agendamentos:** consulta os horários que já foram marcados pelo cliente.
- **Cancelamento e reagendamento:** permite trocar ou cancelar um horário direto pelo atendimento automático.
- **Cadastro de serviços:** organiza nome, duração e preço de cada serviço oferecido.
- **Gestão de profissionais:** controla barbeiros, horários de trabalho, pausas, folgas e disponibilidade.
- **Clientes e CRM:** guarda histórico de visitas e ajuda a acompanhar os clientes mais frequentes.
- **Clube de fidelidade:** oferece vantagens para clientes cadastrados no clube da barbearia.
- **Relatórios:** apresenta informações sobre atendimentos, faturamento, clientes e serviços.
- **Notificações em tempo real:** avisa a equipe quando acontece um novo agendamento ou alguma alteração importante.
- **Exportação de dados:** permite trabalhar com Excel, CSV e integração com Google Sheets.
- **Painel administrativo:** cada loja acessa somente os próprios dados, enquanto o superadmin cuida do sistema inteiro.

## Como funciona

1. O cliente manda uma mensagem para o WhatsApp da barbearia.
2. O bot apresenta um menu com as opções disponíveis.
3. O cliente escolhe o serviço, profissional, data e horário.
4. O sistema verifica se o horário está realmente livre e salva o agendamento.
5. A dashboard é atualizada e a equipe recebe a informação do novo atendimento.

O mesmo fluxo também serve para consultar, cancelar ou reagendar um horário. Se o bot for pausado, a equipe pode continuar atendendo a pessoa manualmente.

## Partes do projeto

- **Dashboard:** tela usada pela barbearia para acompanhar agenda, clientes, serviços e resultados.
- **Backend:** cuida das regras do sistema, contas, segurança, horários e dados de cada loja.
- **Chatbot:** conduz a conversa e transforma as escolhas do cliente em ações no sistema.
- **WhatsApp Bridge:** faz a ligação entre o WhatsApp Web e o backend.
- **Superadmin:** área usada para administrar lojas, planos, módulos e funcionamento geral.
- **Supervisor local:** mantém os serviços funcionando e tenta recuperar automaticamente uma queda.

## Tecnologias usadas

### Backend

- **C# e .NET 8:** base principal das regras e APIs do sistema.
- **ASP.NET Core:** recebe e responde as chamadas da dashboard e do bot.
- **Entity Framework Core:** faz a comunicação entre o sistema e o banco de dados.
- **SQLite e PostgreSQL:** opções de banco para uso local ou em servidor.
- **SignalR:** envia notificações e atualizações em tempo real.
- **JWT e BCrypt:** ajudam a proteger logins, senhas e acessos.
- **Serilog e Polly:** cuidam de logs, tentativas automáticas e recuperação de falhas.

### Dashboard

- **HTML, CSS e JavaScript:** formam a interface usada no navegador.
- **Tailwind CSS:** ajuda a criar uma tela organizada e responsiva.
- **Chart.js:** monta os gráficos dos relatórios.
- **Font Awesome:** fornece os ícones da interface.

### WhatsApp e integrações

- **Node.js e Express:** executam a dashboard local e os serviços de integração.
- **whatsapp-web.js e Puppeteer:** conectam o sistema ao WhatsApp Web.
- **ClosedXML:** cria arquivos do Excel.
- **Google Sheets:** recebe dados por integração configurável.

### Qualidade

- **xUnit:** testa as regras do backend em C#.
- **Node Test Runner:** testa o proxy, a dashboard e os arquivos de instalação.
- **Health checks:** conferem se backend, dashboard e WhatsApp estão funcionando.

## Segurança e organização

- Cada loja possui acesso separado aos próprios clientes e agendamentos.
- Senhas são protegidas antes de serem salvas.
- Chaves, sessões do WhatsApp e bancos reais não devem ser publicados no GitHub.
- O sistema possui controle contra requisições em excesso e acessos não autorizados.
- Backups e logs ajudam na manutenção sem misturar os dados das lojas.

## Objetivo

O Clínica Hair foi criado para diminuir o trabalho manual da barbearia, evitar conflito de horários e deixar o atendimento mais rápido para o cliente e para a equipe.

O foco é ter uma ferramenta simples de usar no dia a dia, mas com uma estrutura preparada para crescer e atender mais de uma loja.

## Status do projeto

Projeto em desenvolvimento e melhoria contínua, com testes automatizados e versões preparadas para instalação local no Windows ou publicação em servidor.

