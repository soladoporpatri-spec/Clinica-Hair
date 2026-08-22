# Checklist de implantacao de nova barbearia

Use esta ordem para implantar uma barbearia real sem misturar dados entre lojas.

## 1. Cadastro comercial

- Nome publico da barbearia.
- Slug unico da loja.
- Plano comercial.
- Dono/admin responsavel.
- Telefone/WhatsApp principal.
- Endereco e observacoes internas, se houver.

## 2. Agenda e funcionamento

- Horario de abertura.
- Horario de fechamento.
- Dias de funcionamento.
- Pausa de almoco, quando existir.
- Regras de feriado, folga e bloqueios.
- Politica de cancelamento e reagendamento.

## 3. Servicos

- Nome de cada servico.
- Preco.
- Duracao.
- Ordem de exibicao no bot.
- Se ocupa horario da agenda.
- Servicos ativos e inativos.

## 4. Profissionais

- Nome de cada profissional.
- Especialidade.
- Cor na agenda.
- Jornada semanal.
- Pausa/almoco.
- Usuario e senha, se o profissional acessa o painel.
- Chave PIX da loja configurada em Assinaturas.
- Chave PIX individual, se a barbearia usa fidelidade por profissional.
- Testar `PIX` em uma assinatura pendente: QR, copia-e-cola, identificador e ativacao apos comprovante.

## 5. WhatsApp e bot

- Conectar WhatsApp pela tela de QR Code.
- Validar status conectado no painel.
- Enviar mensagem de teste.
- Testar fluxo do bot: boas-vindas, servico, profissional, data, horario e confirmacao.
- Testar cancelamento e reagendamento.
- Validar mensagens automaticas de lembrete e retorno.

## 6. Dashboard

- Criar agendamento manual.
- Confirmar presenca.
- Cancelar agendamento.
- Bloquear dia ou horario.
- Conferir relatorios.
- Exportar planilha.
- Validar notificacoes em tempo real.

## 7. Entrega ao dono

- Entregar URL local ou publica.
- Entregar usuario e senha do admin.
- Mostrar como conectar/reconectar WhatsApp.
- Mostrar como alterar servicos, precos e horarios.
- Mostrar como cadastrar profissional.
- Mostrar onde ver relatorios e planilhas.

## Criterio de pronta para uso

A loja esta pronta quando:

- admin consegue entrar no painel;
- WhatsApp esta conectado ou o modo de demo esta combinado;
- pelo menos 3 servicos ativos existem;
- pelo menos 1 profissional ativo existe;
- horario de funcionamento foi revisado;
- agendamento manual funciona;
- bot consegue criar um agendamento de teste;
- relatorio e exportacao abrem sem erro;
- dono recebeu acesso e instrucoes basicas.
