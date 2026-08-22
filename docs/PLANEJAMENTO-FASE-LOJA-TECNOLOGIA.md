# Planejamento futuro - Loja de tecnologia

## 1. Resumo executivo

Esta fase deve permanecer apenas planejada por enquanto. O produto comercial atual continua sendo SaaS para barbearias, e o segmento de tecnologia nao deve ser liberado no superadmin antes de existir um MVP validado.

O sistema ja possui uma base inicial para tecnologia:

- `BusinessType.ComputerOptimization`;
- criacao backend de loja com esse tipo;
- servicos padrao de otimizacao;
- labels basicos no bot;
- agenda por capacidade da loja;
- isolamento multi tenant por `StoreId`;
- dashboard com alguns textos parciais para tecnologia.

Mesmo assim, isso ainda representa apenas agendamento simples. Uma loja de tecnologia real precisa funcionar como pipeline tecnico: entrada do cliente, equipamento, problema, diagnostico, orcamento, aprovacao, execucao, entrega e historico.

Decisao recomendada: manter o segmento como planejamento futuro e preparar uma implementacao incremental, tenant-scoped e protegida por feature flag. Nao implementar agora.

## 2. Arquitetura proposta

### Principio

Nao transformar o sistema inteiro em generico demais. A base deve continuar com um nucleo SaaS comum e modulos especificos por segmento.

### Nucleo existente que pode ser reaproveitado

| Nucleo | Uso no segmento de tecnologia | Observacao |
| --- | --- | --- |
| Store/loja | Define a empresa e o `BusinessType` | Manter `StoreId` como chave de isolamento |
| Usuarios | Admin/dono e equipe interna | Role de tecnico pode vir depois |
| Clientes | Pode iniciar por telefone/nome do WhatsApp | Cadastro formal pode ser evoluido depois |
| Servicos | Catalogo de servicos de tecnologia | Ja tem nome, preco, duracao e ativo |
| Agenda | Compromissos, recebimento, remoto, visita | Nao deve ser a ordem de servico |
| WhatsApp Bridge | Canal de entrada e notificacao | Fluxo precisa ser segmentado |
| Chatbot | Triagem inicial e acompanhamento | Nao deve afetar bot de barbearia |
| Dashboard shell | Navegacao, login, chamadas API | Telas de tecnologia devem aparecer so neste segmento |
| Relatorios | Base para metricas | Precisa de indicadores tecnicos novos |
| Superadmin | Criacao e ativacao controlada | Segmento deve continuar oculto ate pronto |
| Logs/release | Auditoria e entrega | Manter padrao atual |

### Modulo especifico de tecnologia

O modulo de tecnologia deve ficar separado do fluxo de barbearia e nao deve reaproveitar campos de lavajato, como `VehicleInfo`, para representar equipamento tecnico.

Componentes planejados:

- entidades `TechDevice`, `TechTicket`, `TechQuote`, `TechTicketEvent`;
- enum `TechTicketStatus`;
- endpoints `/api/tech/*`;
- servico de negocio `TechTicketService`;
- fluxo de bot especifico para `ComputerOptimization`;
- tela de fila tecnica no dashboard;
- relatorios tecnicos;
- feature flag por loja.

### Regra de ativacao

Mesmo que `BusinessType.ComputerOptimization` exista no backend, o produto deve exigir uma flag adicional antes de mostrar ou permitir uso completo:

- `TechnologyModuleEnabled = true` por loja, ou configuracao equivalente em `SystemConfig`;
- dashboard de tecnologia visivel apenas quando `BusinessType == ComputerOptimization` e a flag estiver ativa;
- endpoints de tecnologia bloqueados para lojas de barbearia;
- superadmin mantendo o botao/segmento oculto ate a fase de release controlado.

## 3. Estado atual encontrado no codigo

| Area | Arquivos atuais | Estado |
| --- | --- | --- |
| Tipo de negocio | `WhatsAppBot.Worker/Models/BusinessType.cs` | Existe `ComputerOptimization = 3` |
| Criacao de loja | `WhatsAppBot.Worker/Endpoints/SuperAdminEndpoints.cs` | Cria servicos padrao de otimizacao |
| Agenda | `WhatsAppBot.Worker/Services/AgendaService.cs`, `WhatsAppBot.Worker/Endpoints/SchedulingEndpoints.cs` | Tecnologia usa capacidade da loja, sem profissional obrigatorio |
| Bot | `WhatsAppBot.Worker/Models/BusinessLabels.cs`, `WhatsAppBot.Worker/Services/*State.cs` | Tem labels e pergunta basica de equipamento |
| Dashboard | `script-dashboard.js`, `dashboard-improved.html` | Tem rotulos parciais, mas nao fluxo tecnico |
| Multi tenant | `WhatsAppBot.Worker/Data/AppDbContext.cs` | Query filters por `StoreId` existem para entidades atuais |
| Servicos | `WhatsAppBot.Worker/Models/ServicoItem.cs`, `WhatsAppBot.Worker/Endpoints/ServicosEndpoints.cs` | Catalogo reaproveitavel |
| Agendamento atual | `WhatsAppBot.Worker/Models/Appointment.cs` | Nao substitui ticket tecnico |
| Lavajato/veiculos | `WhatsAppBot.Worker/Models/ClientVehicle.cs` | Nao reaproveitar para tecnologia |

## 4. Fluxo tecnico completo

1. Cliente chama no WhatsApp.
2. Bot identifica a demanda: otimizacao de PC, otimizacao de console, formatacao, limpeza, manutencao, diagnostico ou outro problema.
3. Bot coleta dados minimos:
   - nome;
   - telefone;
   - tipo de equipamento;
   - modelo, se souber;
   - problema/sintoma;
   - urgencia;
   - preferencia de horario;
   - tipo de atendimento: remoto, presencial ou entrega do equipamento.
4. Sistema cria um `TechTicket` com status `Novo`.
5. Se o cliente precisa levar o equipamento, status pode ir para `AguardandoEquipamento`.
6. Operador agenda recebimento, diagnostico remoto, visita ou analise.
7. Quando o equipamento chega ou o atendimento comeca, status vai para `Recebido` ou `EmDiagnostico`.
8. Tecnico registra diagnostico.
9. Sistema cria `TechQuote`.
10. Ticket vai para `AguardandoAprovacao`.
11. Cliente aprova ou recusa manualmente pelo operador.
12. Se aprovado, ticket vai para `EmExecucao`.
13. Quando finalizado, ticket vai para `Pronto`.
14. Quando entregue ou finalizado com o cliente, ticket vai para `Entregue`.
15. Historico do cliente/equipamento fica disponivel para proximos atendimentos.

## 5. MVP minimo vendavel

O menor escopo vendavel deve permitir que uma loja de tecnologia controle atendimento real, sem virar ERP.

### Obrigatorio no MVP

- Cadastro simples de equipamento do cliente.
- Ticket tecnico com status.
- Diagnostico.
- Orcamento simples.
- Aprovacao manual.
- Fila tecnica no dashboard.
- Bot de triagem tecnica.
- Historico por cliente e equipamento.
- Relatorios basicos.
- Integracao opcional com agenda.
- Feature flag de ativacao.
- Testes de isolamento multi tenant.

### Fora do MVP

- Estoque de pecas.
- Controle financeiro completo.
- Pagamento online.
- App mobile.
- IA avancada.
- Marketplace.
- Automacoes complexas.
- Multi-segmento novo em paralelo.
- Refatoracao gigante.
- Microservicos.
- Reuso de `ClientVehicle` ou `VehicleInfo` para tecnologia.

## 6. Entidades sugeridas

### `TechDevice`

| Item | Planejamento |
| --- | --- |
| Finalidade | Representar o equipamento do cliente: PC, notebook, console ou periferico relevante |
| Campos principais | `Id`, `StoreId`, `PhoneNumber`, `CustomerName`, `Type`, `Brand`, `Model`, `SerialNumber`, `Notes`, `CreatedAt`, `UpdatedAt`, `IsActive` |
| Relacao com `StoreId` | Obrigatoria; deve ter query filter `TenantId == 0 || StoreId == TenantId` |
| Relacao com cliente | Inicialmente por `PhoneNumber` e `CustomerName`; futuro pode ligar a entidade `Client` formal |
| Relacao com agendamento | Nao obrigatoria; ticket pode ter agendamento associado |
| Relacao com servicos | Indireta via `TechTicket` |
| Riscos multi tenant | Vazamento se buscar por telefone sem `StoreId`; telefone pode repetir em lojas diferentes |
| MVP ou futuro | Obrigatoria no MVP |

### `TechTicket`

| Item | Planejamento |
| --- | --- |
| Finalidade | Controlar o atendimento tecnico de ponta a ponta |
| Campos principais | `Id`, `StoreId`, `TicketNumber`, `PhoneNumber`, `ContactName`, `TechDeviceId`, `AppointmentId`, `ServiceId`, `DemandType`, `ServiceMode`, `Urgency`, `Symptom`, `Status`, `DiagnosticSummary`, `QuoteId`, `Source`, `AssignedUserId`, `CreatedAt`, `UpdatedAt`, `ClosedAt` |
| Relacao com `StoreId` | Obrigatoria; toda query deve filtrar por loja |
| Relacao com cliente | Por telefone/nome no MVP; cliente formal pode vir depois |
| Relacao com agendamento | Opcional; agenda representa compromisso, nao o ticket inteiro |
| Relacao com servicos | `ServiceId` opcional para pacote principal; varios servicos podem virar futuro `TechTicketServiceItem` |
| Riscos multi tenant | Alterar status por `Id` sem `StoreId`; listar tickets de outra loja; usar `AppointmentId` de outro tenant |
| MVP ou futuro | Obrigatoria no MVP |

### `TechQuote`

| Item | Planejamento |
| --- | --- |
| Finalidade | Registrar orcamento tecnico e aprovacao manual |
| Campos principais | `Id`, `StoreId`, `TechTicketId`, `Status`, `ServiceId`, `Description`, `LaborAmount`, `PartsEstimateAmount`, `TotalAmount`, `ValidUntil`, `ApprovedAt`, `RejectedAt`, `ApprovalNotes`, `CreatedAt`, `UpdatedAt` |
| Relacao com `StoreId` | Obrigatoria e deve bater com `TechTicket.StoreId` |
| Relacao com cliente | Indireta via ticket |
| Relacao com agendamento | Indireta via ticket |
| Relacao com servicos | Pode apontar para servico principal; itens detalhados ficam para depois |
| Riscos multi tenant | Aprovar orcamento de outra loja; criar orcamento com ticket de outro tenant |
| MVP ou futuro | Obrigatoria no MVP |

### `TechTicketStatus`

| Item | Planejamento |
| --- | --- |
| Finalidade | Padronizar etapas do atendimento tecnico |
| Valores MVP | `Novo`, `AguardandoEquipamento`, `Recebido`, `EmDiagnostico`, `AguardandoAprovacao`, `EmExecucao`, `Pronto`, `Entregue`, `Cancelado`, `Recusado` |
| Relacao com `StoreId` | Enum nao tem `StoreId`; quem guarda o status e o ticket |
| Relacao com cliente | Define mensagens automaticas e visibilidade no dashboard |
| Relacao com agendamento | Pode bloquear/reagendar compromisso conforme estado |
| Relacao com servicos | Ajuda relatorios por servico e etapa |
| Riscos multi tenant | Baixo no enum; alto se endpoint de status nao filtrar por loja |
| MVP ou futuro | Obrigatoria no MVP |

### `TechTicketEvent`

| Item | Planejamento |
| --- | --- |
| Finalidade | Historico/auditoria do atendimento |
| Campos principais | `Id`, `StoreId`, `TechTicketId`, `Type`, `FromStatus`, `ToStatus`, `Message`, `CreatedBy`, `CreatedAt`, `VisibleToCustomer` |
| Relacao com `StoreId` | Obrigatoria e igual ao ticket |
| Relacao com cliente | Permite historico no dashboard e mensagens resumidas ao cliente |
| Relacao com agendamento | Pode registrar agendamento criado/reagendado |
| Relacao com servicos | Pode registrar troca de servico/orcamento |
| Riscos multi tenant | Historico e um dos pontos mais sensiveis; sempre filtrar por `StoreId` |
| MVP ou futuro | Obrigatoria no MVP, mas simples |

### Entidades futuras, nao MVP

| Entidade | Motivo para deixar depois |
| --- | --- |
| `TechQuoteItem` | So entrar se orcamento precisar de multiplos itens estruturados |
| `TechPart` | Evita transformar MVP em estoque |
| `TechWarranty` | Pode iniciar como campo simples no ticket ou orcamento |
| `TechChecklist` | Util quando houver padronizacao operacional |
| `TechAttachment` | Fotos e anexos podem vir depois, com cuidado de armazenamento |
| `Client` formal | O CRM atual pode iniciar por telefone/nome; cadastro dedicado pode ser fase posterior |

## 7. Status do atendimento tecnico

### Status recomendados para MVP

| Status | Significado | Proximo passo comum |
| --- | --- | --- |
| `Novo` | Ticket criado pelo bot ou dashboard | Qualificar, agendar ou pedir equipamento |
| `AguardandoEquipamento` | Cliente ainda precisa entregar/enviar equipamento | Receber equipamento |
| `Recebido` | Equipamento chegou ou atendimento foi iniciado | Diagnosticar |
| `EmDiagnostico` | Tecnico esta analisando problema | Gerar orcamento |
| `AguardandoAprovacao` | Orcamento enviado ou informado ao cliente | Aprovar, recusar ou revisar |
| `EmExecucao` | Servico aprovado e em andamento | Finalizar servico |
| `Pronto` | Servico concluido, aguardando retirada/entrega | Entregar ou encerrar |
| `Entregue` | Atendimento concluido e entregue ao cliente | Fim |
| `Cancelado` | Ticket encerrado por erro, desistancia antes do orcamento ou duplicidade | Fim |
| `Recusado` | Cliente recusou orcamento | Fim |

### Simplificacao proposta

Nao usar `Aprovado` como status persistente no MVP. A aprovacao deve ficar em `TechQuote.Status = Approved`; o ticket muda de `AguardandoAprovacao` para `EmExecucao`. Isso reduz um estado intermediario e evita fila confusa.

### Transicoes validas

| De | Para |
| --- | --- |
| `Novo` | `AguardandoEquipamento`, `Recebido`, `EmDiagnostico`, `Cancelado` |
| `AguardandoEquipamento` | `Recebido`, `Cancelado` |
| `Recebido` | `EmDiagnostico`, `Cancelado` |
| `EmDiagnostico` | `AguardandoAprovacao`, `EmExecucao`, `Cancelado` |
| `AguardandoAprovacao` | `EmExecucao`, `Recusado`, `Cancelado` |
| `EmExecucao` | `Pronto`, `Cancelado` |
| `Pronto` | `Entregue`, `Cancelado` |
| `Entregue` | Estado final |
| `Cancelado` | Estado final |
| `Recusado` | Estado final |

## 8. Backend MVP

### Endpoints necessarios

| Endpoint | Metodo | Finalidade |
| --- | --- | --- |
| `/api/tech/devices` | `GET` | Listar equipamentos da loja |
| `/api/tech/devices` | `POST` | Criar equipamento |
| `/api/tech/devices/{id}` | `GET` | Ver detalhe do equipamento |
| `/api/tech/devices/{id}` | `PATCH` | Atualizar equipamento |
| `/api/tech/tickets` | `GET` | Listar fila tecnica com filtros |
| `/api/tech/tickets` | `POST` | Criar ticket pelo dashboard ou bot |
| `/api/tech/tickets/{id}` | `GET` | Ver detalhe completo do atendimento |
| `/api/tech/tickets/{id}` | `PATCH` | Editar dados gerais do ticket |
| `/api/tech/tickets/{id}/status` | `PATCH` | Mudar status com validacao de transicao |
| `/api/tech/tickets/{id}/diagnostico` | `PATCH` | Registrar diagnostico |
| `/api/tech/tickets/{id}/quote` | `POST` | Criar ou substituir orcamento ativo |
| `/api/tech/quotes/{id}/approve-manual` | `PATCH` | Registrar aprovacao manual |
| `/api/tech/quotes/{id}/reject-manual` | `PATCH` | Registrar recusa manual |
| `/api/tech/tickets/{id}/events` | `GET` | Listar historico |
| `/api/tech/tickets/{id}/events` | `POST` | Adicionar nota/evento manual |
| `/api/tech/reports/summary` | `GET` | Indicadores basicos do modulo |

### Regras de tenant

- Toda entidade nova deve ter `StoreId`.
- Toda query deve usar o `TenantId` atual.
- `TenantId == 0` deve continuar reservado para superadmin.
- Endpoints devem validar que ticket, equipamento, orcamento e agendamento pertencem ao mesmo `StoreId`.
- Criacao por bot deve usar o `StoreId` da sessao/conversa.
- Criacao por dashboard deve usar `tenantService.GetTenantId()`.
- Nenhum endpoint deve aceitar `StoreId` livre no corpo para usuario comum.
- Se o superadmin criar ou auditar, a loja deve ser informada explicitamente e registrada em log.

### Validacoes

- Loja deve ser `BusinessType.ComputerOptimization`.
- Feature flag de tecnologia deve estar ativa.
- `PhoneNumber` obrigatorio.
- `Symptom` obrigatorio no ticket.
- `TechDevice.Type` obrigatorio.
- `Status` so pode mudar por transicao valida.
- `TechQuote.TotalAmount` deve ser maior ou igual a zero.
- Orcamento so pode ser aprovado se pertencer ao ticket da mesma loja.
- `AppointmentId`, se informado, deve existir na mesma loja.
- `ServiceId`, se informado, deve existir, estar ativo e pertencer a loja.

### Integracoes

| Integracao | Planejamento |
| --- | --- |
| Clientes | Usar telefone/nome no MVP; futuro pode consolidar cliente formal |
| Agenda | Usar para compromissos: diagnostico, visita, remoto, recebimento, entrega |
| Servicos | Usar catalogo atual para pacote principal e preco base |
| Orcamento | Criado a partir do ticket e opcionalmente de um servico |
| Bot | Bot cria ticket e eventos; nao deve criar somente agendamento |
| Dashboard | Dashboard lista, filtra e muda status |
| Relatorios | Consultar tickets e quotes, nao apenas appointments |

### Testes obrigatorios de backend

- Criar ticket em loja A e garantir que loja B nao lista.
- Criar equipamento com mesmo telefone em duas lojas e garantir isolamento.
- Impedir `AppointmentId` de outro tenant.
- Impedir `ServiceId` de outro tenant.
- Validar transicoes de status permitidas e bloqueadas.
- Criar orcamento, aprovar manualmente e mudar ticket para `EmExecucao`.
- Recusar orcamento e mudar ticket para `Recusado`.
- Garantir que loja barbearia nao acessa `/api/tech/*`.
- Garantir que feature flag desligada bloqueia o modulo.

## 9. Bot MVP

### Fluxo de triagem

1. Saudacao segmentada para tecnologia.
2. Pergunta de intencao:
   - Otimizacao de PC.
   - Otimizacao de console.
   - Formatacao.
   - Limpeza.
   - Manutencao.
   - Diagnostico.
   - Outro problema.
   - Falar com atendente.
3. Coleta de equipamento:
   - PC, notebook, console, outro.
   - Modelo se souber.
4. Coleta de problema/sintoma.
5. Coleta de urgencia.
6. Coleta de modalidade:
   - remoto;
   - presencial;
   - entrega do equipamento.
7. Coleta de preferencia de horario.
8. Cria `TechTicket`.
9. Se houver horario definido, cria ou sugere agendamento vinculado.
10. Envia confirmacao e informa que a equipe vai acompanhar.

### Perguntas obrigatorias

- "Qual tipo de atendimento voce precisa?"
- "Qual e o equipamento?"
- "Qual problema ou objetivo da otimizacao?"
- "E urgente ou pode ser no proximo horario disponivel?"
- "Voce prefere atendimento remoto, presencial ou entregar o equipamento?"
- "Qual melhor periodo para atendimento?"

### Perguntas opcionais

- "Sabe o modelo do equipamento?"
- "Ja tentou alguma solucao?"
- "O equipamento liga?"
- "Tem backup dos arquivos importantes?"
- "Existe prazo especifico?"

### Fallback para humano

Acionar humano quando:

- cliente envia texto confuso repetidamente;
- cliente pede preco fechado para diagnostico incerto;
- cliente informa perda de dados;
- cliente relata dano fisico, cheiro de queimado, agua ou risco eletrico;
- cliente pede prazo impossivel;
- cliente escolhe "outro problema";
- cliente pede falar com atendente.

### Mensagens de confirmacao

Mensagem apos criar ticket:

> Atendimento tecnico registrado. Recebemos os dados do seu equipamento e a equipe vai analisar a melhor forma de atendimento.

Mensagem com agendamento:

> Seu atendimento ficou previsto para {data} as {hora}. Se precisar alterar, responda esta mensagem.

Mensagem para entrega de equipamento:

> Para continuar, leve o equipamento ate a loja no horario combinado. Ao recebermos, atualizaremos o status do atendimento.

### Mensagens de status

| Status | Mensagem sugerida |
| --- | --- |
| `Recebido` | "Recebemos seu equipamento e ele entrou na fila tecnica." |
| `EmDiagnostico` | "A equipe iniciou o diagnostico do seu equipamento." |
| `AguardandoAprovacao` | "O diagnostico foi concluido e o orcamento esta aguardando sua aprovacao." |
| `EmExecucao` | "O servico foi aprovado e esta em execucao." |
| `Pronto` | "Seu equipamento esta pronto. Combine a retirada ou entrega com a equipe." |
| `Entregue` | "Atendimento concluido. Obrigado pela confianca." |
| `Recusado` | "Orcamento recusado. O atendimento foi encerrado sem execucao do servico." |
| `Cancelado` | "Atendimento cancelado." |

### Diferencas por modalidade

| Modalidade | Dados extras | Comportamento |
| --- | --- | --- |
| Remoto | Preferencia de horario e canal | Agenda horario remoto; nao exige equipamento recebido |
| Presencial | Endereco/local ou visita na loja | Agenda atendimento presencial |
| Entrega do equipamento | Horario de entrega e identificacao | Status pode ir para `AguardandoEquipamento` |

## 10. Dashboard MVP

### Visao de fila tecnica

Elementos minimos:

- contadores por status;
- tickets novos;
- tickets aguardando aprovacao;
- tickets parados ha muito tempo;
- filtro por status;
- filtro por tipo de equipamento;
- filtro por urgencia;
- busca por nome, telefone, modelo ou numero do ticket.

### Tela de detalhe do atendimento

Deve mostrar:

- dados do cliente;
- dados do equipamento;
- problema/sintoma;
- modalidade;
- status atual;
- servico principal;
- agendamento vinculado, se existir;
- diagnostico;
- orcamento;
- historico de eventos;
- botoes de mudar status;
- botao de enviar/registrar atualizacao manual.

### Cadastro de equipamento

Campos:

- tipo;
- marca;
- modelo;
- numero de serie opcional;
- observacoes;
- cliente/telefone.

### Diagnostico

Campos:

- resumo do diagnostico;
- recomendacao tecnica;
- risco/observacao;
- prazo estimado;
- tecnico responsavel opcional.

### Orcamento

Campos:

- descricao;
- servico principal;
- valor de mao de obra;
- estimativa de pecas, sem estoque;
- valor total;
- validade;
- status do orcamento.

### Indicadores basicos

- tickets abertos;
- tickets concluidos;
- tickets aguardando aprovacao;
- orcamentos aprovados;
- orcamentos recusados;
- ticket medio;
- tempo medio de resolucao.

## 11. Relatorios minimos

| Relatorio | Fonte principal | Observacao |
| --- | --- | --- |
| Quantidade de tickets | `TechTicket` | Por periodo e status |
| Conversao de orcamento | `TechQuote` | Aprovados / enviados |
| Ticket medio | `TechQuote.TotalAmount` aprovado | Ignorar recusados/cancelados |
| Tempo medio de resolucao | `TechTicket.CreatedAt` ate `ClosedAt` | Separar por tipo de demanda |
| Servicos mais solicitados | `TechTicket.ServiceId` | Cruzar com `ServicoItem` |
| Tipos de equipamentos | `TechDevice.Type` | PC, notebook, console, outro |
| Atendimentos concluidos | `TechTicket.Status = Entregue` | Por periodo |
| Atendimentos cancelados/recusados | `Cancelado`, `Recusado` | Ajuda qualidade comercial |

## 12. Seguranca e isolamento

Regras obrigatorias:

- todas as novas tabelas com `StoreId`;
- query filter no `AppDbContext`;
- indices por `StoreId` nos campos de busca frequente;
- endpoints sempre validando tenant;
- bot sempre usando `StoreId` da conversa;
- dashboard so renderizando tecnologia para loja habilitada;
- feature flag obrigatoria;
- nenhum dado tecnico em `Appointment.VehicleInfo`;
- nenhum ticket aparece em outra loja;
- nenhum fluxo de tecnologia muda estados de barbearia;
- logs de status e orcamento em `TechTicketEvent`;
- dados sensiveis, como senha de equipamento, devem ser evitados no MVP.

## 13. Roadmap detalhado

### Fase 1 - Preparacao tecnica

| Item | Plano |
| --- | --- |
| Objetivo | Definir base tecnica, contratos e limites sem ativar o segmento |
| Tarefas praticas | Fechar nomes das entidades; definir status; definir feature flag; revisar impacto em multi tenant; desenhar migracoes futuras |
| Arquivos provaveis | `WhatsAppBot.Worker/Models/*`, `WhatsAppBot.Worker/Data/AppDbContext.cs`, `WhatsAppBot.Worker/Program.cs`, `docs/*` |
| Riscos | Criar abstracao generica demais; misturar ticket com appointment |
| Testes necessarios | Nenhum teste de produto se for so planejamento; quando codar, testar migration e query filters |
| Criterio de conclusao | Escopo fechado, entidades aprovadas, feature flag definida |
| Nao fazer | Nao criar tela, nao liberar superadmin, nao mexer no bot de barbearia |

### Fase 2 - Backend MVP

| Item | Plano |
| --- | --- |
| Objetivo | Criar entidades, servicos e endpoints tenant-scoped |
| Tarefas praticas | Adicionar modelos; DbSets; migrations; endpoints `/api/tech/*`; validacoes; eventos; relatorio basico |
| Arquivos provaveis | `WhatsAppBot.Worker/Models/Tech*.cs`, `WhatsAppBot.Worker/Endpoints/TechEndpoints.cs`, `WhatsAppBot.Worker/Services/TechTicketService.cs`, `WhatsAppBot.Worker/Data/AppDbContext.cs`, `WhatsAppBot.Worker/Program.cs` |
| Riscos | Vazamento entre tenants; endpoint aceitar IDs de outra loja; status sem validacao |
| Testes necessarios | CRUD tenant-scoped; status; quote approval; feature flag; bloqueio para barbearia |
| Criterio de conclusao | API funcionando em ambiente controlado, sem expor UI publica |
| Nao fazer | Nao criar estoque, pagamento, app mobile ou automacao complexa |

### Fase 3 - Bot MVP

| Item | Plano |
| --- | --- |
| Objetivo | Criar fluxo de triagem tecnica sem afetar o bot atual |
| Tarefas praticas | Separar menu de tecnologia; coletar equipamento/problema/modalidade; criar ticket; enviar confirmacao; notificar status |
| Arquivos provaveis | `WhatsAppBot.Worker/Models/BusinessLabels.cs`, `WhatsAppBot.Worker/Models/ConversationSession.cs`, `WhatsAppBot.Worker/Services/ConversationStateBase.cs`, `WhatsAppBot.Worker/Services/AwaitingMenuSelectionState.cs`, novos states de tecnologia |
| Riscos | Quebrar fluxo de barbearia; armazenar dados tecnicos em campos improvisados; loops de conversa |
| Testes necessarios | Fluxo completo por WhatsApp simulado; fallback; criacao de ticket; loja barbearia sem regressao |
| Criterio de conclusao | Bot cria ticket tecnico e nao cria apenas agendamento simples |
| Nao fazer | Nao usar IA avancada; nao pedir dados sensiveis desnecessarios |

### Fase 4 - Dashboard MVP

| Item | Plano |
| --- | --- |
| Objetivo | Dar operacao diaria para a loja de tecnologia |
| Tarefas praticas | Fila tecnica; detalhe do ticket; equipamento; diagnostico; orcamento; status; eventos; filtros e indicadores |
| Arquivos provaveis | `dashboard-improved.html`, `script-dashboard.js`, estilos compartilhados, endpoints `/api/tech/*` |
| Riscos | Vazar termos de barbearia; criar tela pesada demais; misturar profissional/barbeiro com tecnico |
| Testes necessarios | Browser smoke test; filtros; status; quote; tenant; responsividade basica |
| Criterio de conclusao | Operador consegue tocar um atendimento do inicio ao fim pelo dashboard |
| Nao fazer | Nao reescrever dashboard inteiro; nao adicionar segmentos paralelos |

### Fase 5 - Testes, validacao e release controlado

| Item | Plano |
| --- | --- |
| Objetivo | Validar estabilidade antes de liberar comercialmente |
| Tarefas praticas | Criar loja piloto; simular bot; testar dashboard; testar tenant; rodar build; gerar release controlado; documentar implantacao |
| Arquivos provaveis | `docs/*`, scripts de release, testes, `superadmin/index.html`, arquivos de configuracao |
| Riscos | Liberar antes do fluxo estar completo; regressao em barbearia; pacote conter configuracao indevida |
| Testes necessarios | E2E bot + dashboard + API; regressao de barbearia; build; validacao de release |
| Criterio de conclusao | Piloto completo aprovado e modulo ativavel por flag |
| Nao fazer | Nao liberar o botao no superadmin sem checklist final |

## 14. Testes obrigatorios gerais

- Build do backend.
- Testes de endpoint `/api/tech/*`.
- Testes de query filter por `StoreId`.
- Testes de mesmo telefone em lojas diferentes.
- Testes de status e transicoes invalidas.
- Testes de aprovacao/recusa de orcamento.
- Testes de bot de tecnologia em loja de tecnologia.
- Testes de bot de barbearia sem alteracao.
- Testes de dashboard com feature flag ligada e desligada.
- Testes de dashboard em loja barbearia para garantir que tecnologia nao aparece.
- Testes de criacao de loja no superadmin em ambiente controlado.
- Testes de relatorio tecnico.
- Teste de release para garantir que configuracoes e dados operacionais indevidos nao vazem.

## 15. Criterio para liberar no superadmin

O segmento so pode aparecer para criacao/ativacao no superadmin quando:

- feature flag estiver implementada;
- entidade de equipamento estiver pronta;
- ticket tecnico estiver pronto;
- orcamento e aprovacao manual estiverem prontos;
- bot conseguir criar ticket tecnico;
- dashboard conseguir listar e operar fila tecnica;
- relatorios minimos estiverem prontos;
- isolamento multi tenant estiver testado;
- barbearia estiver sem regressao;
- existir loja demo/piloto validada;
- existir checklist de implantacao do segmento;
- release controlado tiver sido validado.

Antes disso, o botao de `ComputerOptimization` deve continuar oculto.

## 16. Decisao final

Nao esta pronto para implementar imediatamente como fase comercial. O caminho correto e manter apenas planejado agora, preservar o foco comercial em barbearias e transformar este documento em backlog futuro quando a base atual estiver estabilizada.

Quando chegar a hora, a implementacao deve comecar pelo backend MVP tenant-scoped, nao pela interface. O dashboard e o bot devem vir depois que entidades, status, feature flag e testes de isolamento estiverem definidos.
