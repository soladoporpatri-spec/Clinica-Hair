# Analise - Segmento loja de tecnologia

Data: 2026-06-30

## 1. Resumo executivo

O segmento "loja de tecnologia" cabe na arquitetura atual, mas hoje ele esta apenas parcialmente previsto. O sistema ja tem `BusinessType.ComputerOptimization`, servicos padrao de otimizacao, rotulos basicos no bot/dashboard, capacidade de agenda por loja e isolamento multi-tenant. Isso permite um primeiro experimento controlado de agendamento de pacotes fixos de otimizacao.

Ainda nao existe um produto vendavel completo para lojas de tecnologia. O processo real desse negocio depende de leads, diagnostico, equipamento, orcamento, ordem de servico, status de atendimento, anexos/fotos, historico tecnico e comunicacao de andamento. Hoje o sistema principal e orientado a agendamento, nao a pipeline tecnico.

Recomendacao: nao transformar o modulo de tecnologia em ERP. O melhor caminho e criar um MVP enxuto: captar leads pelo WhatsApp, registrar cliente/equipamento, criar atendimento com status, gerar orcamento simples, acompanhar servico e manter historico. A agenda atual deve ser reaproveitada para diagnostico, suporte remoto, retirada/entrega e visitas presenciais, nao como unica fonte de verdade do atendimento tecnico.

## 2. Estado atual do suporte a lojas de tecnologia

### Arquivos analisados

| Area | Arquivos |
| --- | --- |
| Tipos de negocio | `WhatsAppBot.Worker/Models/BusinessType.cs`, `WhatsAppBot.Worker/Models/Store.cs` |
| Criacao de loja | `WhatsAppBot.Worker/Endpoints/SuperAdminEndpoints.cs`, `superadmin/index.html`, `api-nythar.js` |
| Servicos | `WhatsAppBot.Worker/Models/ServicoItem.cs`, `WhatsAppBot.Worker/Endpoints/ServicosEndpoints.cs`, `WhatsAppBot.Worker/Services/ServiceCatalogService.cs` |
| Agenda | `WhatsAppBot.Worker/Services/AgendaService.cs`, `WhatsAppBot.Worker/Services/SchedulerService.cs`, `WhatsAppBot.Worker/Endpoints/SchedulingEndpoints.cs` |
| Bot | `WhatsAppBot.Worker/Models/BusinessLabels.cs`, `ConversationStateBase.cs`, `AwaitingMenuSelectionState.cs`, `AwaitingVehicleState.cs`, `ConfirmingAppointmentState.cs` |
| CRM | `script-dashboard.js`, `dashboard-improved.html`, `AnalyticsEndpoints.cs` |
| Dashboard | `dashboard-improved.html`, `script-dashboard.js` |
| Relatorios | `WhatsAppBot.Worker/Endpoints/AnalyticsEndpoints.cs`, `WhatsAppBot.Worker/Services/AnalyticsService.cs` |
| Multi-tenant | `WhatsAppBot.Worker/Data/AppDbContext.cs`, `TenantService`, `EndpointTenantGuard` |

### Tipos de negocio existentes

O enum atual possui:

| Tipo | Status atual |
| --- | --- |
| `Barbershop` | Produto comercial atual. |
| `CarWash` | Estrutura futura/parcial. |
| `Pizzeria` | Estrutura futura/parcial. |
| `ComputerOptimization` | Estrutura futura/parcial para tecnologia/otimizacao. |

`ComputerOptimization` existe em:

- `BusinessType.cs`: valor formal do enum.
- `SuperAdminEndpoints.cs`: aceito no backend e com servicos padrao.
- `script-dashboard.js`: rotulos basicos de dashboard.
- `BusinessLabels.cs`: textos basicos do bot.
- `AgendaService.cs`: capacidade padrao da loja.
- `superadmin/index.html`: botao existe, mas esta oculto.

Conclusao: existe suporte estrutural, mas nao existe produto final.

### Criacao de loja

O backend aceita criar loja com `BusinessType = ComputerOptimization`. Na criacao, ele cria quatro servicos padrao:

| Servico | Duracao | Preco |
| --- | ---: | ---: |
| Otimizacao de console | 30 min | R$ 20 |
| Otimizacao pro | 45 min | R$ 40 |
| Otimizacao elite | 60 min | R$ 60 |
| Otimizacao Premium | 90 min | R$ 100 |

O superadmin, porem, esta visualmente focado em barbearia: os botoes de `CarWash`, `Pizzeria` e `ComputerOptimization` existem no HTML, mas ficam com classe `hidden`. Isso esta correto para a fase comercial atual.

Fluxo de criacao:

- valida nome, slug, usuario admin e senha;
- normaliza plano;
- cria `Store`;
- gera `ApiKey` quando nao enviada;
- define `BridgeUrl` por convencao `3000 + storeId`;
- cria usuario admin;
- cria servicos padrao por segmento;
- registra log.

Multi-tenant:

- `StoreId` fica na loja, usuario, servicos e agendamentos;
- `AppDbContext` usa filtros globais por `TenantId`;
- endpoints de servicos, agenda e relatorios usam tenant atual.

Ponto de atencao: no superadmin, mudar o tipo de uma loja existente pode recriar servicos se nao houver agendamentos futuros. Para tecnologia, isso deve continuar restrito a operadores tecnicos ate o segmento estar pronto.

### Servicos

O modelo `ServicoItem` ja serve para catalogo inicial:

- `StoreId`;
- `Nome`;
- `DuracaoMinutos`;
- `Preco`;
- `Ativo`;
- `Ordem`;
- `OcupaHorario`.

Ele representa bem servicos fixos como:

- otimizacao de console;
- otimizacao de PC;
- formatacao com preco base;
- instalacao de programas;
- suporte remoto rapido;
- diagnostico inicial.

Ele nao representa bem:

- orcamento variavel;
- valor minimo e valor final;
- garantia;
- equipamento vinculado;
- pecas envolvidas;
- status de orcamento;
- complexidade;
- tipo remoto/presencial;
- checklist tecnico;
- anexos/fotos.

Recomendacao: manter `ServicoItem` como catalogo comercial/base de preco. Criar entidades separadas para lead, equipamento, orcamento e ordem de servico.

### Agenda

A agenda atual serve para:

- marcar diagnostico;
- marcar suporte remoto;
- marcar visita presencial;
- marcar entrega/retirada;
- reservar horario de atendimento;
- limitar capacidade simultanea da loja.

Para `ComputerOptimization`, `AgendaService` usa capacidade da loja quando nao ha profissional especifico. O default atual e 4 atendimentos simultaneos.

Limites:

- agenda nao representa status tecnico longo;
- agenda nao representa fila de bancada;
- agenda nao representa "aguardando peca";
- agenda nao separa atendimento remoto/presencial;
- agenda nao permite duracao estimada versus duracao real;
- agenda nao guarda SLA, prazo prometido ou prioridade.

Recomendacao: agenda deve ser uma camada de compromisso de horario, nao o objeto central do processo tecnico. O objeto central deve ser `TechTicket` ou `TechServiceOrder`.

### Clientes e CRM

O CRM atual e calculado por agendamentos:

- agrupa por telefone/nome;
- mostra visitas;
- receita;
- ultimo atendimento;
- proximo horario;
- servico preferido;
- recorrencia simples.

Isso ajuda para uma loja de tecnologia, mas nao basta.

Falta:

- cadastro formal de cliente;
- equipamentos por cliente;
- historico tecnico por equipamento;
- problemas recorrentes;
- observacoes tecnicas;
- garantia;
- anexos;
- status de atendimento em aberto.

Existe `ClientVehicle`, criado para lavajato, que prova um caminho possivel de "equipamentos por cliente". Mas ele e especifico de veiculo/placa e nao deve ser reaproveitado diretamente para tecnologia. A ideia de modelo, isolamento por tenant e lookup por telefone e util.

### Bot WhatsApp

O bot atual e muito orientado a agendamento. Menu base:

- agendar;
- meus agendamentos;
- cancelar;
- reagendar;
- clube de fidelidade apenas para barbearia;
- walk-in apenas para lavajato.

Para `ComputerOptimization`, o bot ja altera labels:

- pergunta "Qual pacote de otimizacao deseja agendar?";
- pede equipamento/objetivo;
- salva detalhe em `SelectedVehicle`;
- grava detalhe em `Appointment.Notes` e `VehicleInfo`;
- agenda por capacidade da loja.

Isso e suficiente para um fluxo simples de "agendar otimizacao". Nao e suficiente para loja de tecnologia real.

Falta o bot:

- identificar intencao sem forcar agendamento;
- coletar problema;
- coletar equipamento estruturado;
- coletar modelo e evidencias;
- pedir fotos/anexos;
- perguntar urgencia;
- separar remoto/presencial;
- criar lead sem horario;
- criar orcamento;
- consultar status;
- transferir para humano;
- evitar promessa de preco fixo para servicos variaveis.

### Dashboard

Telas atuais reaproveitaveis:

- painel inicial;
- agenda;
- clientes;
- WhatsApp/bot;
- automacoes;
- relatorios;
- ajustes;
- servicos.

Telas atuais com textos estranhos para tecnologia:

- "Clientes da barbearia";
- "Equipe profissional" e estrutura `Barbeiro`;
- fidelidade/clube;
- metricas de presenca;
- relatorios por barbeiro/profissional;
- checklist de implantacao focado em servicos/profissionais/agenda.

O dashboard atual serve para vender uma versao muito simples de agendamento de otimizacao. Nao serve ainda para uma operacao tecnica com pipeline.

### Relatorios

Relatorios atuais que servem:

- receita;
- quantidade de atendimentos;
- servicos mais usados;
- clientes novos;
- clientes recorrentes;
- receita estimada/realizada por periodo.

Relatorios que faltam:

- taxa de conversao de orcamento;
- tempo medio de diagnostico;
- tempo medio em cada status;
- quantidade em andamento;
- quantidade aguardando peca;
- quantidade aguardando retirada;
- remoto vs presencial;
- servicos mais lucrativos;
- orcamentos aprovados/recusados;
- reincidencia por equipamento.

### Pontos que ja funcionam

- Multi-tenant por `StoreId`.
- Criacao backend de `ComputerOptimization`.
- Servicos padrao de otimizacao.
- Catalogo de servicos configuravel.
- Agenda por capacidade da loja.
- Bot com labels basicos de tecnologia.
- Captura livre de equipamento/objetivo no bot.
- Dashboard com servicos, agenda, clientes basicos e relatorios basicos.
- Superadmin exibe lojas de tecnologia se existirem.

### Pontos parcialmente prontos

- "Equipamento" existe apenas como texto livre em `Notes`/`VehicleInfo`.
- "Cliente" existe como agrupamento de agendamentos, nao como cadastro formal.
- "Status" existe apenas como ativo/cancelado e presenca confirmada.
- "Equipe tecnica" usa a estrutura historica de barbeiros/profissionais.
- "Orcamento" pode ser improvisado em observacoes, mas nao existe como fluxo.
- "Suporte remoto" pode ser um servico/agenda, mas nao tem entidade propria.

### Pontos inexistentes

- Leads.
- Orcamentos.
- Ordens de servico.
- Equipamentos tecnicos.
- Status tecnico.
- Historico de status.
- Anexos/fotos.
- Pecas.
- Garantia.
- Checklist tecnico.
- Consulta de status pelo cliente.
- Transferencia humana controlada por pipeline.

### Riscos tecnicos

- Forcar todos os atendimentos de tecnologia dentro de `Appointment`.
- Usar `Notes` para dados estruturados.
- Misturar "agendamento" com "ordem de servico".
- Reaproveitar `ClientVehicle` como `TechDevice` sem modelagem propria.
- Expor `ComputerOptimization` no superadmin antes de bot/dashboard estarem prontos.
- Criar campos genericos demais que atrapalhem relatorios.
- Quebrar barbearia ao tentar neutralizar nomes internos como `Barbeiro`.

### Reaproveitamento possivel da base atual

| Base atual | Como reaproveitar |
| --- | --- |
| Store/multi-tenant | Manter loja de tecnologia isolada por `StoreId`. |
| Usuarios | Dono, atendente e tecnico podem usar roles atuais no inicio. |
| Servicos | Catalogo base de ofertas e preco inicial. |
| Agenda | Diagnostico, suporte, visita, retirada e entrega. |
| WhatsApp Bridge | Canal de entrada e notificacoes. |
| Bot base | Estado conversacional e menus. |
| Relatorios basicos | Receita, volume, recorrencia e servicos. |
| Dashboard | Estrutura visual, auth, rotas e componentes. |
| Superadmin | Criacao de loja e plano. |
| Logs/release | Operacao e auditoria. |

## 3. Processo ideal para loja de tecnologia

### Fluxo completo

1. Cliente chama no WhatsApp.
2. Bot identifica a intencao: orcamento, suporte, otimizacao, formatacao, montagem, upgrade, manutencao, duvida ou humano.
3. Bot coleta dados basicos:
   - nome;
   - telefone;
   - tipo de equipamento;
   - modelo;
   - problema principal;
   - urgencia;
   - remoto ou presencial;
   - melhor horario;
   - fotos/evidencias quando aplicavel.
4. Sistema cria `TechLead` ou `TechTicket`.
5. Atendente/tecnico classifica.
6. Se for servico fixo, pode virar agendamento ou ordem de servico.
7. Se exigir avaliacao, vai para diagnostico.
8. Tecnico gera orcamento.
9. Cliente aprova ou recusa.
10. Se aprovado, sistema cria ou avanca uma ordem de servico.
11. Status muda durante execucao.
12. Cliente recebe atualizacoes automaticas.
13. Servico finaliza.
14. Cliente recebe orientacao/garantia.
15. Historico fica vinculado ao cliente e equipamento.
16. Relatorios alimentam gestao.

### Status necessarios

| Status | Uso |
| --- | --- |
| Novo | Lead acabou de chegar. |
| Aguardando analise | Precisa ser visto por atendente/tecnico. |
| Em diagnostico | Equipamento/problema em avaliacao. |
| Orcamento enviado | Cliente recebeu proposta. |
| Aguardando aprovacao | Aguardando resposta do cliente. |
| Aprovado | Cliente aceitou. |
| Recusado | Cliente recusou. |
| Agendado | Horario marcado. |
| Em execucao | Servico em andamento. |
| Aguardando peca | Depende de compra/entrega de peca. |
| Aguardando cliente | Precisa de resposta, senha, acesso remoto, confirmacao. |
| Pronto | Servico finalizado, aguardando entrega/retirada. |
| Entregue | Encerrado. |
| Cancelado | Encerrado sem conclusao. |

### Dados que precisam ser coletados

- Nome do cliente.
- Telefone/WhatsApp.
- Tipo de atendimento: remoto, presencial, loja, retirada/entrega.
- Tipo de equipamento: PC, notebook, console, celular, periferico, rede.
- Marca/modelo.
- Numero de serie, se aplicavel.
- Problema relatado.
- Objetivo do cliente.
- Urgencia.
- Fotos/evidencias.
- Sistema operacional.
- Senha temporaria ou acesso remoto, se aplicavel, com cuidado de seguranca.
- Servico desejado.
- Valor estimado.
- Valor final.
- Prazo.
- Garantia.
- Tecnico responsavel.

### Fluxos alternativos

#### Atendimento remoto

1. Bot identifica suporte remoto.
2. Coleta problema, sistema operacional, urgencia e disponibilidade.
3. Cria lead/ticket.
4. Atendente confirma se e remoto.
5. Gera link/instrucao de acesso remoto fora do bot ou por mensagem segura.
6. Tecnico inicia atendimento.
7. Status: em execucao, aguardando cliente, pronto, entregue.

#### Atendimento presencial

1. Bot coleta equipamento e problema.
2. Pergunta se o cliente quer levar ate a loja ou receber visita.
3. Agenda diagnostico/entrega/visita.
4. Cria ticket.
5. Tecnico avalia.
6. Orcamento e aprovado ou recusado.

#### Orcamento antes do servico

1. Cliente pede preco.
2. Bot explica que valor final depende de analise quando necessario.
3. Coleta dados suficientes para estimativa.
4. Cria lead com status `Aguardando analise`.
5. Atendente envia orcamento.

#### Servico com valor fixo

1. Cliente escolhe pacote fixo.
2. Bot mostra preco base e duracao estimada.
3. Agenda horario.
4. Cria ticket simples ou agendamento.
5. Finaliza com status e historico.

#### Servico com diagnostico

1. Cliente descreve problema.
2. Bot cria ticket sem prometer valor.
3. Agenda diagnostico.
4. Tecnico avalia.
5. Orcamento e enviado.
6. Cliente aprova.

#### Servico que depende de peca

1. Tecnico identifica peca necessaria.
2. Status vira `Aguardando peca`.
3. Cliente recebe aviso.
4. Ao receber peca, status volta para `Em execucao`.
5. Finaliza e registra garantia.

#### Suporte rapido

1. Bot coleta problema.
2. Se for simples, cria atendimento remoto ou agenda curta.
3. Tecnico resolve.
4. Sistema registra historico e valor.

#### Cliente recorrente

1. Bot reconhece telefone.
2. Mostra equipamentos recentes.
3. Cliente escolhe equipamento ou cadastra novo.
4. Atendimento ja nasce com historico.

### Telas necessarias

- Painel inicial de atendimentos.
- Leads.
- Clientes.
- Equipamentos.
- Orcamentos.
- Ordens de servico.
- Agenda.
- Servicos.
- WhatsApp/Bot.
- Relatorios.
- Configuracoes.

### Automacoes possiveis

- Confirmacao de lead recebido.
- Lembrete de diagnostico.
- Aviso de orcamento enviado.
- Lembrete de aprovacao pendente.
- Aviso de status: em diagnostico, aguardando peca, pronto.
- Mensagem de retirada.
- Mensagem de garantia.
- Retorno pos-servico.

### Mensagens importantes do bot

- "Recebi sua solicitacao. Vou coletar alguns dados para nossa equipe avaliar."
- "Esse servico pode precisar de diagnostico. O valor final sera confirmado antes de iniciar."
- "Voce prefere atendimento remoto ou presencial?"
- "Qual equipamento sera atendido?"
- "Descreva o problema principal em poucas palavras."
- "Se puder, envie fotos ou prints depois desta mensagem."
- "Seu atendimento foi registrado. Protocolo: #{id}."
- "Seu orcamento esta pronto. Deseja aprovar, recusar ou falar com atendente?"
- "Seu servico esta pronto para retirada."

## 4. Fluxos principais do negocio

### Fluxo 1 - Otimizacao de PC

- Entrada: cliente quer melhorar desempenho.
- Bot pergunta objetivo: jogos, trabalho, travamentos, inicializacao lenta.
- Bot pergunta equipamento e Windows/versao se souber.
- Se pacote fixo: agenda horario.
- Se problema incerto: cria diagnostico.
- Dados salvos: cliente, equipamento, objetivo, urgencia, servico, horario.

### Fluxo 2 - Otimizacao de console

- Entrada: cliente informa PS4, PS5, Xbox ou outro console.
- Bot pergunta problema: lentidao, travamento, limpeza, atualizacao.
- Pode usar preco fixo quando o pacote for claro.
- Pode pedir avaliacao quando houver defeito fisico.

### Fluxo 3 - Formatacao

- Bot pergunta tipo de equipamento, backup necessario e programas desejados.
- Deve alertar que backup/licencas precisam ser confirmados.
- Pode agendar entrega ou atendimento remoto/presencial.

### Fluxo 4 - Diagnostico de problema

- Bot nao promete preco.
- Coleta sintomas, quando comecou, fotos/prints e urgencia.
- Cria ticket `Aguardando analise`.
- Agenda diagnostico se necessario.

### Fluxo 5 - Montagem ou upgrade

- Bot coleta objetivo, pecas existentes, pecas desejadas e orcamento aproximado.
- Cria lead/orcamento.
- Tecnico avalia compatibilidade.
- Status pode virar `Aguardando peca`.

### Fluxo 6 - Suporte remoto

- Bot coleta problema, sistema, disponibilidade e autorizacao.
- Cria ticket remoto.
- Tecnico assume.
- Finaliza com historico e valor.

### Fluxo 7 - Falar com atendente

- Bot coleta nome e motivo.
- Cria lead ou marca conversa como humana.
- Pausa automacao para aquele cliente.
- Notifica dashboard.

## 5. Modulos necessarios

| Modulo | Reaproveita algo atual? | Precisa criar? | Prioridade | Motivo | Risco |
| --- | --- | --- | --- | --- | --- |
| Lojas/multi-tenant | Sim | Nao | MVP | Base ja isola por `StoreId`. | Baixo |
| Usuarios | Sim | Adaptar roles depois | MVP | Admin e tecnico podem iniciar com roles atuais. | Medio se `barbeiro` vazar na UI |
| Servicos | Sim | Adaptar campos depois | MVP | Catalogo atual ja tem nome, preco, duracao e ativo. | Medio para preco variavel |
| Agenda | Sim | Adaptar uso | MVP | Serve para diagnostico e compromissos. | Alto se virar OS |
| WhatsApp Bridge | Sim | Nao | MVP | Canal ja existe. | Baixo |
| Chatbot base | Sim | Criar fluxo especifico | MVP | Estados atuais ajudam, mas menu e perguntas mudam. | Alto |
| Clientes | Parcial | Criar cadastro formal depois | MVP | CRM atual e derivado de agendamentos. | Medio |
| Leads | Nao | Sim | MVP | Entrada sem horario e sem preco fechado. | Alto |
| Equipamentos | Parcial via `ClientVehicle` | Sim | MVP | Historico tecnico depende disso. | Alto |
| Orcamentos | Nao | Sim | MVP | Processo de tecnologia exige aprovacao. | Alto |
| Ordens de servico | Nao | Sim | MVP | Status tecnico nao cabe em agendamento. | Alto |
| Status historico | Nao | Sim | MVP | Cliente precisa acompanhar andamento. | Alto |
| Anexos/fotos | Nao | Sim, simples | Importante | Evidencias ajudam diagnostico. | Alto por seguranca |
| Suporte remoto | Parcial como servico | Sim, depois | Importante | Precisa link, responsavel e controle. | Medio |
| Pecas | Nao | Depois | Futuro | Nao e essencial no piloto. | Alto se virar estoque |
| Garantia | Nao | Depois | Futuro | Importante, mas pode ser campo simples no MVP. | Medio |
| Checklist tecnico | Nao | Depois | Futuro | Melhora qualidade, mas nao bloqueia piloto. | Medio |
| Relatorios tecnicos | Parcial | Sim | Importante | Conversao, status e prazos nao existem. | Medio |
| Superadmin | Sim | Manter oculto | MVP | Backend aceita, UI comercial deve continuar focada. | Alto se expor cedo |

## 6. MVP vendavel para empresa de tecnologia

### Recursos obrigatorios

- Loja com tipo `ComputerOptimization` habilitavel por configuracao controlada.
- Captacao de leads pelo WhatsApp.
- Cadastro minimo de cliente.
- Cadastro de equipamento.
- Catalogo de servicos configuraveis.
- Criacao de atendimento/ticket.
- Status basicos.
- Orcamento simples.
- Aprovacao/recusa de orcamento.
- Agenda para diagnostico, suporte, visita, entrega ou retirada.
- Dashboard com atendimentos em aberto.
- Historico por cliente e equipamento.
- Transferencia para humano.
- Relatorios basicos de receita, volume e conversao.

### Recursos importantes

- Anexos/fotos.
- Notificacoes automaticas de status.
- Filtros por tecnico e status.
- SLA/prazo prometido.
- Campos de tipo remoto/presencial.
- Garantia simples.

### Recursos futuros

- Estoque de pecas.
- Financeiro complexo.
- Pagamento online.
- Emissao fiscal.
- App mobile.
- IA avancada.
- Marketplace.
- Controle multiunidade empresarial.
- Checklist tecnico avancado.
- Integracao nativa com ferramenta de acesso remoto.

### O que nao fazer agora

- Nao criar ERP completo.
- Nao criar estoque completo.
- Nao automatizar orcamento complexo com IA.
- Nao misturar todos os dados em `Appointment.Notes`.
- Nao reativar segmento visualmente para clientes reais antes do MVP.
- Nao renomear `Barbeiro` para `Tecnico` em massa agora.
- Nao quebrar a versao de barbearia.

### Criterios para vender piloto

- Um lead chega pelo WhatsApp e vira ticket.
- O dono ve tickets em aberto no dashboard.
- O tecnico registra equipamento e status.
- O atendente envia orcamento simples.
- Cliente recebe atualizacao de status.
- Historico fica salvo por cliente/equipamento.
- Relatorios basicos mostram volume, receita e conversao.
- Multi-tenant testado com pelo menos duas lojas.

### Criterios para nao vender ainda

- Se tudo ainda depender de agendamento simples.
- Se nao houver status tecnico.
- Se nao houver orcamento.
- Se nao houver equipamento por cliente.
- Se o bot prometer preco sem diagnostico.
- Se a UI ainda falar barbearia em telas centrais.

## 7. Dashboard ideal

| Tela | Objetivo | Dados necessarios | Acoes principais | Prioridade | Reaproveita atual? | Precisa nova tela? |
| --- | --- | --- | --- | --- | --- | --- |
| Painel inicial | Visao operacional do dia e fila | Tickets por status, leads, orcamentos, receita prevista | Abrir ticket, filtrar urgentes, chamar cliente | MVP | Parcial | Adaptar |
| Leads | Captar e qualificar contatos | Nome, telefone, origem, problema, urgencia | Converter em ticket, descartar, chamar humano | MVP | Nao | Sim |
| Clientes | Historico comercial e tecnico | Cliente, telefones, equipamentos, tickets | Ver historico, criar equipamento/ticket | MVP | Parcial | Adaptar |
| Equipamentos | Controlar patrimonio do cliente | Tipo, modelo, serie, observacoes, cliente | Editar, abrir atendimento, ver historico | MVP | Parcial por `ClientVehicle` | Sim |
| Orcamentos | Controlar proposta | Itens, valor estimado/final, validade, status | Enviar, aprovar, recusar, revisar | MVP | Nao | Sim |
| Ordens de servico | Executar trabalho | Cliente, equipamento, tecnico, status, prazo, checklist | Atualizar status, finalizar, adicionar nota | MVP | Nao | Sim |
| Agenda | Compromissos | Horario, tipo, cliente, tecnico, local/remoto | Agendar, reagendar, bloquear | MVP | Sim | Adaptar |
| Servicos | Catalogo | Nome, preco base, duracao, remoto/presencial, ativo | Criar, editar, pausar | MVP | Sim | Adaptar |
| WhatsApp/Bot | Canal e automacao | Status, QR, conversas, templates, fallback | Conectar, testar, pausar bot, assumir humano | MVP | Sim | Adaptar |
| Relatorios | Gestao | Receita, conversao, status, tecnico, prazos | Filtrar, exportar, analisar | Importante | Parcial | Adaptar |
| Configuracoes | Parametros | Horarios, status, mensagens, regras | Editar regras | Importante | Sim | Adaptar |

Cards ideais do painel inicial:

- Novos leads.
- Atendimentos aguardando analise.
- Orcamentos pendentes.
- Servicos em execucao.
- Aguardando peca.
- Prontos para retirada.
- Receita prevista.
- Alertas de prazo.
- WhatsApp conectado.

## 8. Bot ideal

### Mapa de intencoes

| Intencao | Acao |
| --- | --- |
| Otimizacao de PC | Coletar objetivo/equipamento e agendar ou criar ticket. |
| Otimizacao de console | Coletar console/problema e agendar ou criar ticket. |
| Formatacao | Coletar backup/programas e avisar sobre licencas. |
| Diagnostico | Criar ticket sem prometer preco. |
| Montagem/upgrade | Criar lead/orcamento. |
| Suporte remoto | Criar ticket remoto e disponibilidade. |
| Consultar status | Pedir telefone/protocolo e retornar status. |
| Falar com humano | Pausar automacao e notificar dashboard. |

### Menu inicial sugerido

```text
Ola! Sou o atendimento da {loja}.
Como podemos ajudar?

1 - Otimizacao de PC
2 - Otimizacao de console
3 - Formatacao ou instalacao
4 - Diagnostico de problema
5 - Montagem ou upgrade
6 - Suporte remoto
7 - Consultar status
8 - Falar com atendente
```

### Perguntas por fluxo

| Fluxo | Perguntas |
| --- | --- |
| Otimizacao de PC | Qual seu objetivo? Qual equipamento? E remoto ou presencial? Tem urgencia? |
| Otimizacao de console | Qual console? Qual problema ou objetivo? Deseja limpeza/otimizacao/diagnostico? |
| Formatacao | Qual equipamento? Precisa backup? Quais programas deseja? Tem chave/licenca? |
| Diagnostico | O que aconteceu? Quando comecou? Aparece erro? Pode enviar foto/print? |
| Montagem/upgrade | Qual objetivo? Ja tem pecas? Qual orcamento aproximado? |
| Suporte remoto | Qual problema? Qual sistema? Melhor horario? Autoriza acesso remoto? |
| Humano | Qual assunto? Deseja aguardar atendente? |

### Mensagens do bot

```text
Esse atendimento pode precisar de analise tecnica. O valor final sera confirmado antes de iniciar.
```

```text
Perfeito. Registrei sua solicitacao. Protocolo: #{ticketId}. Nossa equipe vai analisar e retornar.
```

```text
Seu orcamento esta pronto. Valor estimado: R$ {valor}. Deseja aprovar, recusar ou falar com atendente?
```

```text
Atualizacao do atendimento #{ticketId}: {status}. {observacao}
```

### Regras de fallback

- Depois de 3 respostas invalidas, voltar ao menu.
- Se cliente pedir humano, pausar bot para aquele contato.
- Se servico exigir diagnostico, nao prometer valor final.
- Se cliente enviar midia, salvar como anexo ou marcar para analise manual.
- Se status nao existir, orientar a falar com atendente.

### Quando chamar humano

- Cliente pede atendente.
- Cliente envia problema complexo.
- Orcamento acima de limite configurado.
- Necessidade de senha/acesso remoto.
- Reclamacao ou garantia.
- Mensagem fora do fluxo por mais de 3 tentativas.

### Dados que o bot precisa salvar

- Intencao.
- Nome.
- Telefone.
- Equipamento.
- Problema.
- Urgencia.
- Atendimento remoto/presencial.
- Melhor horario.
- Anexos.
- Protocolo.
- Status inicial.
- Observacoes de atendimento.

## 9. Modelo de dados sugerido

| Entidade | Finalidade | Campos principais | StoreId | Relacao cliente | Relacao servico | MVP |
| --- | --- | --- | --- | --- | --- | --- |
| `TechLead` | Entrada comercial antes do ticket | Id, StoreId, Phone, Name, Source, Intent, Problem, Urgency, Status, CreatedAt | Obrigatorio | Phone/CustomerId futuro | Opcional | Sim |
| `TechCustomer` | Cadastro formal do cliente | Id, StoreId, Name, Phone, Email, Notes, CreatedAt | Obrigatorio | Entidade principal | Nao | Sim |
| `TechDevice` | Equipamento do cliente | Id, StoreId, CustomerId, Type, Brand, Model, Serial, Notes | Obrigatorio | CustomerId | Nao | Sim |
| `TechTicket` | Atendimento/pipeline | Id, StoreId, CustomerId, DeviceId, ServiceId, Status, Priority, Channel, DueAt | Obrigatorio | CustomerId | ServiceId opcional | Sim |
| `TechQuote` | Orcamento | Id, StoreId, TicketId, EstimatedValue, FinalValue, Status, ValidUntil, Notes | Obrigatorio | Via ticket | Via ticket | Sim |
| `TechServiceOrder` | Execucao do servico | Id, StoreId, TicketId, TechnicianId, StartedAt, FinishedAt, Status, InternalNotes | Obrigatorio | Via ticket | Via ticket | Sim |
| `TechServiceStatusHistory` | Auditoria de status | Id, StoreId, TicketId, FromStatus, ToStatus, UserId, Note, CreatedAt | Obrigatorio | Via ticket | Nao | Sim |
| `TechAttachment` | Fotos/prints/laudos | Id, StoreId, TicketId, FilePath, Type, UploadedBy, CreatedAt | Obrigatorio | Via ticket | Nao | Importante |
| `TechChecklistItem` | Checklist tecnico | Id, StoreId, ServiceOrderId, Label, Done, DoneAt | Obrigatorio | Via OS | Via OS | Depois |
| `TechRemoteSession` | Controle de suporte remoto | Id, StoreId, TicketId, Tool, LinkRef, StartedAt, EndedAt | Obrigatorio | Via ticket | Nao | Depois |
| `TechPart` | Pecas usadas ou solicitadas | Id, StoreId, TicketId, Name, Cost, Price, Status | Obrigatorio | Via ticket | Nao | Depois |
| `TechWarranty` | Garantia do atendimento | Id, StoreId, TicketId, StartsAt, EndsAt, Terms, Status | Obrigatorio | Via ticket | Nao | Depois |

Observacao: se ja existir `Appointment` ligado ao atendimento, `TechTicket` pode ter `AppointmentId`. A agenda vira complemento, nao substituto do ticket.

## 10. Roadmap de desenvolvimento

### Fase T1 - Analise e base do segmento

- Objetivo: preparar definicao sem expor comercialmente.
- Tarefas: confirmar nomenclatura, fluxos, status, MVP, riscos.
- Arquivos provaveis: docs, testes de arquitetura.
- Endpoints: nenhum.
- Telas: nenhuma.
- Riscos: escopo crescer demais.
- Testes: apenas validacao documental/build.
- Conclusao: documento aprovado e escopo fechado.

### Fase T2 - Leads e CRM tecnico

- Objetivo: criar entrada sem agendamento obrigatorio.
- Tarefas: entidade `TechLead`, endpoints CRUD, dashboard simples de leads.
- Arquivos provaveis: Models, Endpoints, AppDbContext, script/dashboard.
- Endpoints: `GET/POST/PATCH /api/tech/leads`.
- Telas: Leads.
- Riscos: duplicar cliente.
- Testes: multi-tenant, CRUD, auth.
- Conclusao: lead criado pelo painel e isolado por loja.

### Fase T3 - Equipamentos

- Objetivo: vincular historico ao equipamento.
- Tarefas: entidade `TechDevice`, CRUD, relacao com cliente/telefone.
- Endpoints: `/api/tech/devices`.
- Telas: Equipamentos e detalhe do cliente.
- Riscos: reaproveitar placa/veiculo de forma errada.
- Testes: cliente com multiplos equipamentos.
- Conclusao: equipamento aparece no historico do cliente.

### Fase T4 - Orcamentos simples

- Objetivo: registrar proposta aprovada/recusada.
- Tarefas: `TechQuote`, status, envio manual pelo WhatsApp.
- Endpoints: `/api/tech/quotes`.
- Telas: Orcamentos.
- Riscos: financeiro complexo.
- Testes: aprovar/recusar e filtrar.
- Conclusao: orcamento vira status do ticket.

### Fase T5 - Ordens de servico e status

- Objetivo: criar pipeline tecnico.
- Tarefas: `TechTicket`, `TechServiceOrder`, historico de status.
- Endpoints: `/api/tech/tickets`, `/api/tech/orders`, `/api/tech/status`.
- Telas: Ordens de servico.
- Riscos: conflito com agenda.
- Testes: transicoes de status e isolamento tenant.
- Conclusao: atendimento percorre status ate entregue/cancelado.

### Fase T6 - Bot especifico de tecnologia

- Objetivo: criar fluxo de captura tecnica.
- Tarefas: menu de intencoes, coleta de equipamento/problema, cria lead/ticket, consulta status.
- Arquivos: estados do bot, labels, templates.
- Endpoints: chamadas internas para leads/tickets.
- Telas: Bot/automacoes.
- Riscos: prometer preco fixo indevido.
- Testes: fluxos principais e fallback humano.
- Conclusao: bot cria lead/ticket e consulta status.

### Fase T7 - Dashboard operacional

- Objetivo: tornar o painel usavel para a operacao diaria.
- Tarefas: painel inicial, kanban/lista por status, filtros.
- Telas: Painel, Leads, Tickets, OS.
- Riscos: UI confusa.
- Testes: fluxo completo pelo painel.
- Conclusao: dono consegue operar sem abrir banco.

### Fase T8 - Relatorios e automacoes

- Objetivo: medir performance.
- Tarefas: conversao, tempo medio, status, receita prevista, remoto/presencial.
- Endpoints: `/api/tech/reports`.
- Telas: Relatorios.
- Riscos: metricas erradas se status nao for bem definido.
- Testes: datasets pequenos e periodos.
- Conclusao: relatorios batem com tickets reais.

### Fase T9 - Piloto real

- Objetivo: validar com uma loja.
- Tarefas: criar demo, seed, checklist, treinamento, monitoramento.
- Riscos: fluxo real fugir do MVP.
- Testes: smoke diario, backup, restore.
- Conclusao: uma loja usa por uma semana sem bloqueio critico.

### Fase T10 - Expansoes futuras

- Objetivo: crescer sem virar ERP pesado.
- Tarefas: pecas, garantia avancada, anexos robustos, integrações, pagamentos.
- Riscos: complexidade operacional.
- Testes: performance, seguranca de arquivos, permissao.
- Conclusao: expansoes priorizadas por demanda real.

## 11. Riscos e decisoes importantes

| Risco | Impacto | Como evitar | Prioridade |
| --- | --- | --- | --- |
| Virar ERP completo | Atrasa venda e aumenta suporte | MVP enxuto, sem estoque/financeiro complexo | Alta |
| Usar agenda como OS | Perde status e historico | Criar ticket/OS separado | Alta |
| Orcamento automatico indevido | Promessa comercial errada | Bot sempre avisar que depende de analise | Alta |
| Acoplamento com barbearia | UI/textos confusos | Camada de labels e telas por segmento | Alta |
| Dados em `Notes` | Relatorios ruins | Campos estruturados para equipamento/status | Alta |
| Dashboard com muitas telas cedo | Dificulta uso | Comecar com Leads, Tickets, Equipamentos, Orcamentos | Media |
| Falta de status claro | Cliente cobra manualmente | Historico de status e notificacoes | Alta |
| Anexos inseguros | Vazamento de dados | Regras de upload, tamanho, tipo e armazenamento | Alta |
| Suporte remoto sem controle | Risco operacional | Registrar sessao e responsavel | Media |
| Precificacao variavel | Cliente espera valor fixo | Separar preco base de valor final | Alta |
| Expor botao no superadmin cedo | Loja criada sem fluxo pronto | Manter oculto ate piloto | Alta |
| Quebrar barbearia | Perda do produto atual | Mudancas isoladas em namespace tech | Alta |

## 12. O que nao implementar agora

- Migrations de tecnologia.
- Entidades novas no banco.
- Endpoints reais.
- Telas reais.
- Reativacao visual do segmento no superadmin.
- Mudancas no dashboard principal de barbearia.
- Estoque completo.
- Financeiro completo.
- Emissao fiscal.
- Pagamento online.
- IA avancada.
- Marketplace.
- Multiunidade empresarial.
- Controle profundo de pecas.
- App mobile.

## 13. Perguntas estrategicas para proxima etapa

1. A primeira loja piloto trabalha mais com suporte remoto, presencial ou bancada?
2. O cliente normalmente pede preco antes ou aceita diagnostico primeiro?
3. A loja cobra diagnostico?
4. Quais status sao realmente usados no dia a dia?
5. O atendimento tem prazo/SLA?
6. O dono quer controlar pecas ja no piloto ou depois?
7. Fotos/prints precisam ser armazenados no sistema ou basta link/manual?
8. O bot deve consultar status automaticamente ou apenas abrir chamado humano?
9. O tecnico precisa de login proprio no MVP?
10. O orcamento sera enviado pelo bot ou apenas registrado no dashboard?
11. O segmento deve se chamar "Loja de tecnologia", "Assistencia tecnica" ou "Servicos de TI"?
12. O produto sera vendido para assistencia tecnica fisica, prestador remoto ou ambos?

## 14. Recomendacao final

O segmento de tecnologia deve ser planejado como um pipeline de atendimento tecnico, nao como simples agenda de servicos. A base atual e boa para comecar porque ja tem multi-tenant, WhatsApp, bot, servicos, agenda, dashboard, relatorios e superadmin. Mas o MVP vendavel precisa de pelo menos leads, equipamento, ticket, orcamento e status.

Proxima etapa recomendada: criar um documento de especificacao da Fase T2/T3 com modelos `TechLead`, `TechCustomer` e `TechDevice`, sem mexer em barbearia. Depois validar com uma loja real antes de escrever migrations.
