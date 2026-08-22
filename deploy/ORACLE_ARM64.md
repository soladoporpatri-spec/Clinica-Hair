# Deploy Oracle Cloud Free Tier ARM64 com Dominio e TLS

Este guia e o caminho recomendado para producao comercial. Para bootstrap sem dominio, use primeiro `deploy/ORACLE_FREE_TIER_IP_DEPLOY.md`.

## Arquitetura

- Nginx publico: portas `80/443`.
- Dashboard Node: `127.0.0.1:4000`.
- Backend ASP.NET Core: `127.0.0.1:5000`.
- Bridge factory: `127.0.0.1:2999`.
- WhatsApp loja 1: `127.0.0.1:3001`.
- SQLite: `/opt/barbearia/data/agendamentos.db`.
- Sessao WhatsApp por loja: `/opt/barbearia/WhatsAppBridge/.wwebjs_auth_<storeId>`.
- Backups: `/opt/barbearia/backups`.

## Oracle Free Tier

Use `VM.Standard.A1.Flex` com Ubuntu ARM64. Para contas Always Free atuais, planeje a aplicacao para 2 OCPUs e 12 GB RAM. A cota de Block Volume Always Free e 200 GB somando boot e volumes.

Recomendacao para uma barbearia:

- OCPU: `2`.
- RAM: `12 GB`.
- Boot volume: `80 GB` ou `100 GB`.
- Ubuntu: `22.04 LTS` ou `24.04 LTS`.

Instancias Always Free ociosas podem ser reclamadas. Configure monitor externo em `/health/deep`, mantenha backups offsite e valide reboot periodicamente.

## Publicar

```bash
ssh ubuntu@IP_DA_ORACLE
sudo apt update
sudo apt install -y git rsync
git clone SEU_REPOSITORIO /tmp/barbearia
cd /tmp/barbearia
sudo bash deploy/scripts/install-oracle-arm64.sh
sudo bash deploy/scripts/publish-to-opt.sh
sudo nano /opt/barbearia/.env
```

Variaveis minimas:

```env
API_KEY=uma-chave-longa-aleatoria
ApiKey=uma-chave-longa-aleatoria
JWT_SECRET=um-segredo-com-mais-de-32-caracteres
Jwt__Secret=um-segredo-com-mais-de-32-caracteres

SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=troque-essa-senha
DEFAULT_ADMIN_PASSWORD=troque-essa-senha
DEFAULT_OWNER_USERNAME=dono
DEFAULT_OWNER_PASSWORD=troque-essa-senha

CORS_ORIGINS=https://app.seudominio.com
BACKEND_URL=http://127.0.0.1:5000
BRIDGE_URL=http://127.0.0.1:3001
BRIDGE_BASE_PORT=3000
BRIDGE_PORT=3001
FACTORY_PORT=2999
ASPNETCORE_URLS=http://127.0.0.1:5000
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
BARBEARIA_DATA_DIR=/opt/barbearia/data
BACKUP_DIR=/opt/barbearia/backups
BACKUP_RETENTION_DAYS=14
LOG_DIR=/opt/barbearia/logs
```

## Nginx, systemd e TLS

Instale o bootstrap:

```bash
sudo bash /opt/barbearia/deploy/scripts/install-systemd-nginx.sh
```

Aponte o DNS:

```text
app.seudominio.com -> IP_DA_ORACLE
```

Edite `server_name` no Nginx:

```bash
sudo nano /etc/nginx/sites-available/barbearia
sudo nginx -t
sudo systemctl reload nginx
```

Instale certificado:

```bash
sudo snap install certbot --classic
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d app.seudominio.com
sudo certbot renew --dry-run
```

Se quiser substituir manualmente por um bloco HTTPS completo, use `deploy/nginx-barbearia-https.conf.example` como referencia, trocando o dominio e os caminhos do certificado.

## Validacao

```bash
sudo /opt/barbearia/deploy/scripts/healthcheck.sh
curl -fsS https://app.seudominio.com/health/deep
curl -fsS http://127.0.0.1:5000/health
curl -fsS -H "X-API-KEY: $(grep '^API_KEY=' /opt/barbearia/.env | cut -d= -f2-)" http://127.0.0.1:2999/health
curl -fsS -H "X-API-KEY: $(grep '^API_KEY=' /opt/barbearia/.env | cut -d= -f2-)" http://127.0.0.1:3001/status
ss -ltnp | grep -E ':(80|443|4000|5000|2999|3001)\b'
```

## Operacao

```bash
sudo systemctl restart barbearia-backend barbearia-bridge barbearia-dashboard
sudo systemctl restart barbearia-bridge
sudo journalctl -u barbearia-bridge -f
sudo /opt/barbearia/deploy/scripts/production-status.sh
```

Pareamento:

1. Acesse `https://app.seudominio.com`.
2. Faca login.
3. Abra Bot > QR.
4. Leia o QR Code.
5. Confirme loja 1 em `http://127.0.0.1:3001/status`.

## Backup e restore

```bash
sudo systemctl start barbearia-backup.service
sudo /opt/barbearia/deploy/scripts/restore-test-sqlite.sh
```

Para offsite, configure no `.env`:

```env
OFFSITE_BACKUP_METHOD=rsync
OFFSITE_BACKUP_TARGET=usuario@servidor:/caminho/backups-barbearia
```

ou:

```env
OFFSITE_BACKUP_METHOD=rclone
OFFSITE_BACKUP_TARGET=remote:barbearia/backups
```

## PIX operacional

Configure a chave pelo dashboard da loja em `Assinaturas -> Chave PIX da loja`. Para repasse direto ao profissional, configure `Funcionarios -> Editar -> Chave PIX do profissional`.

O sistema gera o PIX copia-e-cola no backend com BR Code, valor do plano, identificador da assinatura e CRC16. A assinatura permanece `Pending` ate o operador conferir o comprovante e confirmar no painel.

Fallbacks opcionais no `.env`:

```env
PIX_MERCHANT_NAME=Nome Recebedor
PIX_MERCHANT_CITY=Cidade
```

Preserve sempre:

- `/opt/barbearia/.env`
- `/opt/barbearia/data`
- `/opt/barbearia/backups`
- `/opt/barbearia/WhatsAppBridge/.wwebjs_auth_*`

## Banco

SQLite continua sendo a recomendacao para uma barbearia pequena nesta VPS. PostgreSQL fica para uma etapa futura de SaaS multi-loja real, com migracao planejada, backup e testes de isolamento. Nao troque para PostgreSQL apenas definindo uma connection string em producao sem uma rodada propria de migracao e validacao.

Antes de qualquer mudanca em schema/startup:

```bash
sudo systemctl start barbearia-backup.service
sudo /opt/barbearia/deploy/scripts/restore-test-sqlite.sh
```

## Docker

Ha Dockerfiles e `docker-compose.prod.yml`, mas para a primeira producao recomendo systemd. Use Docker apenas quando quiser padronizar ambientes ou crescer para uma estrutura maior.
