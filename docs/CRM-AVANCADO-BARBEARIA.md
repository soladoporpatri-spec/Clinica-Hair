# CRM avancado para barbearias

## Objetivo

O CRM da dashboard evolui a lista basica de clientes para uma area de relacionamento pratica para barbearias pequenas e medias. Ele usa dados reais de agendamentos da loja e adiciona apenas metadados operacionais: tags, observacoes, preferencias, eventos e lembretes.

## Fonte dos dados

- Clientes e historico sao calculados a partir de `Appointments`.
- Notas, preferencias e status manual ficam em `CustomerProfiles`.
- Tags ficam em `CustomerTags` e `CustomerTagAssignments`.
- Timeline manual fica em `CustomerEvents`.
- Lembretes ficam em `CustomerReminders`.
- Todos os dados novos possuem `StoreId` e usam filtros globais do tenant.

## Perfil do cliente

O perfil mostra nome, telefone, primeiro atendimento, ultimo atendimento, proximo atendimento, total de atendimentos, faltas, cancelamentos, gasto total, ticket medio, servico preferido, profissional preferido, horario comum, status, tags, observacoes, preferencias, timeline, historico e lembretes.

## Status

Os status automaticos sao:

- Novo: ate 1 atendimento concluido.
- Recorrente: 2 ou mais atendimentos.
- Fiel: 5 ou mais atendimentos.
- VIP: tag VIP ou alto valor gasto.
- Sumido: sem retorno no periodo configurado.
- Em risco: recorrente que passou do intervalo comum de retorno.
- Inativo: sem retorno por periodo maior.
- Bloqueado: marcado manualmente.

## Tags

Tags padrao sao criadas por loja quando o CRM e acessado: VIP, Cliente fiel, Sumido, Prefere WhatsApp, Barba, Corte, Sobrancelha, Atencao especial, Nao compareceu, Promocao e Aniversariante.

Tags podem ser adicionadas ou removidas pelo perfil do cliente. Tags personalizadas sao criadas na propria loja.

## WhatsApp

O CRM nao dispara campanha em massa. A dashboard apenas abre uma conversa manual no WhatsApp com mensagem sugerida e confirmacao do operador.

## Relatorios

`GET /api/customers/reports/summary` retorna indicadores de relacionamento: total de clientes, novos no periodo, recorrentes, inativos, VIPs, maiores gastos, mais visitas, taxa de retorno, tempo medio entre atendimentos, clientes sem proximo agendamento, faltas e receita recorrente.

## Limitacoes atuais

- Clientes sem telefone aparecem na lista quando existem na agenda, mas nao recebem tags/notas persistentes.
- Fidelidade aparece preparada por status/tags; ainda nao existe sistema complexo de pontos no CRM.
- Mensagens WhatsApp sao assistidas, nao automaticas em massa.
