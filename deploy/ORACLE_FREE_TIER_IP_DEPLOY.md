# Deploy Oracle Free Tier por IP Publico

Guia operacional para Ubuntu ARM64 na Oracle Cloud Free Tier, sem dominio, com Nginx publico na porta 80 e todos os processos da aplicacao em `127.0.0.1`.

Use este modo apenas para bootstrap, teste inicial e pareamento. Para producao comercial, configure dominio e TLS conforme `deploy/ORACLE_ARM64.md`.

## Arquitetura

```text
Internet
  |
  | http://IP_PUBLICO
  v
nginx :80
  |-- arquivos estaticos -> /opt/barbearia
  |-- /api/* e /health* -> dashboard Node :4000
  |-- /hubs/* -> dashboard Node :4000 -> backend SignalR :5000

localhost apenas:
  dashboard Node :4000
  backend .NET :5000
  bridge factory :2999
  WhatsApp loja 1 :3001

persistencia:
  /opt/barbearia/data/agendamentos.db
  /opt/barbearia/backups
  /opt/barbearia/WhatsAppBridge/.wwebjs_auth_<storeId>
  /opt/barbearia/data/whatsapp-queue-<storeId>.json
```

## Shape recomendado

- Shape: `VM.Standard.A1.Flex`.
- Premissa Always Free atual para contas Always Free: ate 2 OCPUs e 12 GB RAM.
- Boot volume: 50 GB minimo, 80 GB a 100 GB recomendado dentro dos 200 GB de Block Volume Always Free.
- Sistema: Ubuntu ARM64 22.04 LTS ou 24.04 LTS.

Observacao: instancias Always Free ociosas podem ser reclamadas pela Oracle. Use monitor externo em `/health/deep`, backups offsite e algum trafego/uso real do sistema.

## 1. Criar VM

1. Crie uma instancia `VM.Standard.A1.Flex`.
2. Escolha Ubuntu ARM64.
3. Libere no Security List ou Network Security Group:
   - `22/tcp` para SSH, de preferencia restrito ao seu IP.
   - `80/tcp` para bootstrap por IP.
   - `443/tcp` para quando ativar TLS.
4. Conecte:

```bash
ssh ubuntu@IP_PUBLICO
```

## 2. Preparar e publicar

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo timedatectl set-timezone America/Sao_Paulo
sudo apt-get install -y git rsync

cd /tmp
git clone SEU_REPOSITORIO barbearia
cd /tmp/barbearia

sudo bash deploy/scripts/install-oracle-arm64.sh
sudo bash deploy/scripts/publish-to-opt.sh
sudo nano /opt/barbearia/.env
```

## 3. Configurar `.env`

Use valores longos e unicos. `BRIDGE_URL` e apenas fallback legado; em producao a factory gerencia as bridges.

```env
API_KEY=COLE_UMA_CHAVE_GRANDE_ALEATORIA_AQUI
ApiKey=COLE_A_MESMA_CHAVE_GRANDE_ALEATORIA_AQUI
JWT_SECRET=COLE_UM_SEGREDO_COM_MAIS_DE_32_CARACTERES
Jwt__Secret=COLE_O_MESMO_SEGREDO_COM_MAIS_DE_32_CARACTERES

SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=COLE_UMA_SENHA_FORTE_AQUI
DEFAULT_ADMIN_PASSWORD=COLE_UMA_SENHA_FORTE_AQUI
DEFAULT_OWNER_USERNAME=dono
DEFAULT_OWNER_PASSWORD=COLE_UMA_SENHA_FORTE_AQUI
DEFAULT_STAFF_PASSWORD=
DEFAULT_STAFF_USERNAME=profissional2

BACKEND_URL=http://127.0.0.1:5000
BRIDGE_URL=http://127.0.0.1:3001
CORS_ORIGINS=http://IP_PUBLICO,http://localhost,http://127.0.0.1

ASPNETCORE_URLS=http://127.0.0.1:5000
DASHBOARD_HOST=127.0.0.1
PORT=4000
BRIDGE_HOST=127.0.0.1
BRIDGE_BASE_PORT=3000
BRIDGE_PORT=3001
FACTORY_PORT=2999

BARBEARIA_DATA_DIR=/opt/barbearia/data
BACKUP_DIR=/opt/barbearia/backups
BACKUP_RETENTION_DAYS=14
OFFSITE_BACKUP_TARGET=
PIX_MERCHANT_NAME=
PIX_MERCHANT_CITY=BRASIL
LOG_DIR=/opt/barbearia/logs
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ASPNETCORE_ENVIRONMENT=Production
NODE_ENV=production
DOTNET_GCHeapHardLimitPercent=60
NODE_OPTIONS=--max-old-space-size=768
```

Gerar segredos:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Proteger arquivo:

```bash
sudo chown barbearia:barbearia /opt/barbearia/.env
sudo chmod 600 /opt/barbearia/.env
```

## 4. Instalar Nginx, systemd e firewall

```bash
sudo bash /opt/barbearia/deploy/scripts/install-systemd-nginx.sh
sudo ufw status
```

O script instala servicos, timer de backup, Nginx, fail2ban quando disponivel, retencao do journald, logrotate e habilita UFW com OpenSSH, 80 e 443.

Confirme tambem no painel da Oracle que `80/tcp` e `443/tcp` estao liberados.

## 5. Validar servidor

```bash
sudo /opt/barbearia/deploy/scripts/healthcheck.sh
curl -i http://127.0.0.1/health
curl -i http://127.0.0.1/health/deep
curl -i http://127.0.0.1:5000/health
curl -i -H "X-API-KEY: $(grep '^API_KEY=' /opt/barbearia/.env | cut -d= -f2-)" http://127.0.0.1:2999/health
curl -i -H "X-API-KEY: $(grep '^API_KEY=' /opt/barbearia/.env | cut -d= -f2-)" http://127.0.0.1:3001/status
ss -ltnp | grep -E ':(80|443|4000|5000|2999|3001)\b'
```

Portas esperadas:

- Publica: `80` no modo IP.
- Internas: `4000`, `5000`, `2999` e `3001`.
- Nenhum app Node/.NET deve escutar em `0.0.0.0`.

## 6. Acessar e parear

1. Abra `http://IP_PUBLICO`.
2. Entre com o superadmin configurado.
3. Abra Bot > QR.
4. Escaneie com o WhatsApp da barbearia.
5. Envie `oi` para o numero e acompanhe logs:

```bash
sudo /opt/barbearia/deploy/scripts/logs.sh
```

## 7. Backup, offsite e restore testavel

Backup manual:

```bash
sudo systemctl start barbearia-backup.service
ls -lh /opt/barbearia/backups
```

Teste de restauracao sem tocar no banco real:

```bash
sudo /opt/barbearia/deploy/scripts/restore-test-sqlite.sh
```

Backup offsite opcional por rsync:

```env
OFFSITE_BACKUP_METHOD=rsync
OFFSITE_BACKUP_TARGET=usuario@servidor:/caminho/backups-barbearia
```

Backup offsite opcional por rclone:

```env
OFFSITE_BACKUP_METHOD=rclone
OFFSITE_BACKUP_TARGET=remote:barbearia/backups
```

Depois rode:

```bash
sudo systemctl start barbearia-backup.service
```

## 8. Recuperacao

Restart completo:

```bash
sudo /opt/barbearia/deploy/scripts/restart-all.sh
```

Restart so da bridge/factory:

```bash
sudo systemctl restart barbearia-bridge
sudo journalctl -u barbearia-bridge -n 100 --no-pager
```

Reboot:

```bash
sudo reboot
```

Depois:

```bash
ssh ubuntu@IP_PUBLICO
sudo /opt/barbearia/deploy/scripts/healthcheck.sh
```

## 9. Restaurar banco real

Pare os servicos que usam SQLite:

```bash
sudo systemctl stop barbearia-backend barbearia-dashboard
cd /tmp
sudo tar -xzf /opt/barbearia/backups/agendamentos_YYYYMMDD_HHMMSS.tar.gz
sudo cp agendamentos.db /opt/barbearia/data/agendamentos.db
sudo chown barbearia:barbearia /opt/barbearia/data/agendamentos.db
sudo systemctl start barbearia-backend barbearia-dashboard
sudo /opt/barbearia/deploy/scripts/healthcheck.sh
```

## 10. Colocar PIX em operacao

No dashboard da loja, abra `Assinaturas` e salve a `Chave PIX da loja`. Se cada profissional recebe direto, abra `Funcionarios -> Editar` e preencha a chave PIX individual.

O backend gera o BR Code/PIX copia-e-cola com `br.gov.bcb.pix`, valor do plano, identificador `S{loja}SUB{assinatura}` e CRC16. A assinatura fica pendente ate o operador conferir o comprovante e clicar `PIX -> Confirmar`.

Campos opcionais de recebedor:

```env
PIX_MERCHANT_NAME=Nome Recebedor
PIX_MERCHANT_CITY=Cidade
```

Nunca apague:

- `/opt/barbearia/.env`
- `/opt/barbearia/data`
- `/opt/barbearia/backups`
- `/opt/barbearia/WhatsAppBridge/.wwebjs_auth_*`

## Checklist final

- [ ] `npm audit --omit=dev` sem vulnerabilidades altas no root e em `WhatsAppBridge`.
- [ ] `dotnet publish -r linux-arm64 --self-contained false` validado.
- [ ] `healthcheck.sh` passa com factory `2999` e loja 1 `3001`.
- [ ] QR aparece no dashboard.
- [ ] WhatsApp fica online.
- [ ] Fluxo `oi -> servico -> profissional -> data -> horario -> confirmacao` funciona.
- [ ] Backup local criado.
- [ ] `restore-test-sqlite.sh` passa.
- [ ] Offsite configurado ou decisao documentada.
- [ ] Reboot sobe todos os servicos.
- [ ] `production-status.sh` mostra memoria e disco estaveis.
