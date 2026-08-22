# PWA Nythar - Dashboard & Chatbot

O painel pode ser instalado como aplicativo pelo navegador, sem Apple Store ou Play Store.

## Requisitos

- Acesso por HTTPS para celulares. O link do ngrok cumpre esse papel.
- Dashboard aberta pelo Chrome/Edge no Android ou Safari no iPhone.
- Permissão de notificações liberada pelo usuário.

## Android

1. Abra o link HTTPS do ngrok no Chrome.
2. Entre na dashboard.
3. Toque em `Instalar` quando o botão aparecer ou use o menu do Chrome.
4. Toque em `Alertas` para liberar som e notificações.

## iPhone

1. Abra o link HTTPS do ngrok no Safari.
2. Toque em compartilhar.
3. Toque em `Adicionar à Tela de Início`.
4. Abra pelo ícone criado.

## Observações

- O notebook precisa ficar ligado e com internet.
- Se a URL gratuita do ngrok mudar, o app instalado no celular pode apontar para a URL antiga.
- Para produção, prefira domínio fixo do ngrok ou túnel com domínio próprio.
- O PWA cacheia a tela e arquivos estáticos, mas agenda, bot e relatórios precisam do notebook online.
