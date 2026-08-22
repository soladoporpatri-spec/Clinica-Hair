# Analise de features essenciais - Nythar - Dashboard & Chatbot

## Diagnostico atual

O sistema ja tem uma base utilizavel para uma barbearia local: dashboard, agenda, bot WhatsApp, bridge, planilhas, notificacoes, multiusuario e operacao por supervisor. A maior fragilidade nao esta em falta de telas grandes, mas em detalhes de produto real: impedir operacoes erradas, dar feedback claro quando algo esta offline, evitar requests travados e manter o notebook estavel por horas.

## Melhorias essenciais implementadas

- Agenda manual na dashboard com cliente, telefone, servico, profissional, data, horario e observacoes.
- Dias indisponiveis por loja/profissional, com tipos `fechado`, `feriado`, `folga` e `manutencao`.
- Bloqueios de dia refletem automaticamente em horarios livres, criacao manual e fluxo do bot, porque a regra fica no `AgendaService`.
- Validacao contra agendamento/reagendamento no passado.
- Normalizacao e validacao de telefone antes de salvar agendamento.
- Protecao contra bloquear um dia que ja possui agendamentos, evitando sumir horario com cliente marcado.
- Timeout no `apiFetch` da dashboard para evitar tela travada quando backend/proxy para de responder.
- Status lateral agora diferencia backend, bridge e WhatsApp conectado/QR pendente.
- Sincronizacao silenciosa de planilhas apos criacao, edicao ou cancelamento manual.
- Polling da dashboard reduzido quando a aba esta em segundo plano.

## Riscos atuais que ainda merecem atencao

- A inicializacao/schema ainda vive majoritariamente no `Program.cs`; funciona, mas precisa virar bootstrap/migration dedicado.
- A bridge usa WhatsApp Web, que e sensivel a desconexao pelo app, atualizacoes do WhatsApp e bloqueios de sessao.
- O sistema local depende de o cliente nao fechar a janela/supervisor; ideal criar atalho claro de iniciar/parar e talvez tarefa de inicializacao do Windows.
- Notificacoes em celular dependem do navegador permitir notificacoes e a dashboard estar aberta.
- Logs existem, mas ainda podem crescer bastante em uso continuo; precisa politica de rotacao mais visivel para o cliente.

## Roadmap essencial

1. Separar bootstrap de banco/schema do `Program.cs`.
2. Criar tela simples de diagnostico local: backend, bridge, WhatsApp, ngrok, banco, planilhas, ultimo backup.
3. Melhorar notificacoes push/PWA para computador e celular quando a dashboard estiver aberta.
4. Adicionar tela de clientes simples com historico por telefone.
5. Criar backup/restauracao guiada para o cliente.
6. Migrar regras de permissao para um servico central.
7. Preparar migrations reais para PostgreSQL/SaaS sem quebrar SQLite local.
