# Resumo de planejamento - Loja de tecnologia

## Objetivo

Planejar, sem implementar agora, como o sistema atual pode evoluir para atender uma loja/empresa de tecnologia focada em otimizacao de computadores, consoles e manutencao tecnica.

O objetivo e orientar uma futura fase de desenvolvimento sem comprometer:

- a estabilidade atual do produto para barbearias;
- o multi tenant existente;
- o bot e a dashboard ja em funcionamento;
- a possibilidade de outros segmentos no futuro.

## Conclusao principal

O sistema ja possui base estrutural para o segmento de tecnologia, mas ainda nao esta pronto para ser vendido como loja de tecnologia.

Hoje, o suporte existente permite cadastrar uma loja do tipo `ComputerOptimization`, criar servicos padrao de otimizacao e usar agenda por capacidade da loja. Isso cobre um fluxo simples de agendamento, mas nao cobre o funcionamento real de uma assistencia ou empresa de tecnologia.

Para uma operacao vendavel, o segmento precisa de modulos especificos para lead, equipamento, diagnostico, orcamento, ordem de servico, status do atendimento e comunicacao de acompanhamento.

## Estado atual encontrado

| Area | Estado atual |
| --- | --- |
| Criacao de loja | Ja aceita `ComputerOptimization` no backend |
| Servicos padrao | Ja existem 4 pacotes de otimizacao |
| Bot | Ja possui textos basicos para escolher pacote e informar equipamento |
| Agenda | Funciona por capacidade da loja, sem profissional/tecnico obrigatorio |
| Dashboard | Possui alguns rotulos para tecnologia, mas ainda e generica/barbearia-first |
| CRM | Baseado em clientes e agendamentos, sem funil tecnico |
| Relatorios | Mostram agenda, receita e atendimento, sem metricas tecnicas |
| Multi tenant | A base existente e favoravel, desde que novas tabelas usem `StoreId` e filtros por tenant |

## O que falta para ser vendavel

- Cadastro de equipamentos do cliente.
- Registro de sintomas/problemas relatados.
- Diagnostico tecnico.
- Orcamento com aprovacao do cliente.
- Ordem de servico.
- Status do atendimento, como recebido, em diagnostico, aguardando aprovacao, em execucao, pronto, entregue e cancelado.
- Historico de mensagens e atualizacoes para o cliente.
- Dashboard de fila tecnica.
- Relatorios de conversao, ticket medio, tempo medio de resolucao e servicos por tipo de equipamento.

## Processo ideal da loja de tecnologia

1. Cliente chama no WhatsApp.
2. Bot identifica se e otimizacao, formatacao, limpeza, reparo ou diagnostico.
3. Cliente informa equipamento, problema, urgencia e melhor horario.
4. Sistema cria lead ou atendimento tecnico.
5. Operador agenda atendimento ou recebimento do equipamento.
6. Tecnico registra diagnostico.
7. Sistema gera orcamento.
8. Cliente aprova ou recusa.
9. Servico entra em execucao.
10. Cliente recebe atualizacoes automaticas.
11. Atendimento e concluido e entregue.
12. Sistema gera relatorio e historico do cliente/equipamento.

## MVP recomendado

O MVP deve ser pequeno e comercialmente utilizavel:

- manter cadastro de loja, clientes, servicos, agenda, WhatsApp e relatorios como nucleo generico;
- adicionar cadastro simples de equipamentos;
- adicionar atendimento tecnico com status;
- adicionar anotacoes de diagnostico e orcamento;
- adaptar dashboard para fila de atendimentos;
- adaptar bot para triagem tecnica;
- manter agenda por capacidade da loja na primeira versao;
- nao desenvolver controle de pecas/estoque no inicio.

## Roadmap sugerido

### Fase 1 - Preparacao tecnica

- Definir entidades `TechDevice`, `TechTicket`, `TechQuote` e `TechTicketStatus`.
- Garantir `StoreId` em todas as novas entidades.
- Planejar migracoes sem alterar o fluxo de barbearia.
- Criar feature flag para esconder o segmento ate estar pronto.

### Fase 2 - Backend MVP

- Criar endpoints tenant-scoped para equipamentos, atendimentos e orcamentos.
- Integrar tickets com clientes e agendamentos.
- Manter servicos existentes como catalogo comercial.
- Criar regras basicas de status.

### Fase 3 - Bot MVP

- Criar fluxo de triagem tecnica.
- Coletar equipamento, problema, urgencia e preferencia de horario.
- Criar lead/ticket.
- Enviar mensagens de confirmacao e status.

### Fase 4 - Dashboard MVP

- Criar visao de fila tecnica.
- Criar tela de detalhes do atendimento.
- Permitir diagnostico, orcamento, aprovacao manual e mudanca de status.
- Adaptar textos visiveis para tecnologia apenas quando a loja for deste segmento.

### Fase 5 - Validacao e release

- Testar isolamento entre lojas.
- Testar bot de barbearia e bot de tecnologia separadamente.
- Testar criacao de loja pelo superadmin em ambiente controlado.
- Validar relatorios.
- Liberar segmento apenas depois dos testes.

## Riscos principais

- Expor `ComputerOptimization` agora pode gerar expectativa maior do que o sistema entrega.
- Reutilizar campos de lavajato, como `VehicleInfo`, para tecnologia aumenta acoplamento e confusao.
- Misturar textos de barbearia e tecnologia pode prejudicar a percepcao comercial.
- Criar tabelas sem `StoreId` ou sem filtro de tenant quebraria o multi tenant.
- Desenvolver tecnologia junto com pizzaria/lavajato dilui foco e aumenta risco.

## Decisoes recomendadas

- Nao liberar a loja de tecnologia comercialmente agora.
- Manter o segmento escondido no superadmin ate existir MVP real.
- Evoluir por modulos pequenos, sem refatoracao gigante.
- Tratar tecnologia como segmento futuro, nao como prioridade comercial atual.
- Continuar posicionando a primeira versao vendavel como SaaS para barbearias.

## O que enviar ao planner

Use este direcionamento:

> Planejar uma futura Fase de Loja de Tecnologia sem implementar agora. O sistema ja possui `BusinessType.ComputerOptimization`, servicos padrao e bot basico de agendamento, mas nao possui fluxo tecnico completo. O MVP deve adicionar equipamentos, tickets, status, diagnostico, orcamento, fila tecnica e bot de triagem, mantendo multi tenant por `StoreId`, sem alterar o fluxo de barbearia e sem reativar o segmento no superadmin ate os testes finais.

## Criterio para considerar pronto no futuro

A loja de tecnologia so deve ser considerada pronta quando:

- uma loja puder ser criada sem afetar barbearias;
- servicos puderem ser cadastrados e agendados;
- bot conseguir abrir atendimento tecnico;
- dashboard mostrar fila e status;
- operador conseguir registrar diagnostico e orcamento;
- cliente puder receber atualizacoes;
- relatorios basicos funcionarem;
- testes confirmarem isolamento multi tenant;
- o segmento estiver oculto por padrao ate ativacao controlada.
