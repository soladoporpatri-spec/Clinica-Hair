# Fase 1 - Operacao Oracle ARM64

## Servicos

```bash
sudo systemctl status barbearia-backend
sudo systemctl status barbearia-bridge
sudo systemctl status barbearia-dashboard
sudo systemctl status barbearia-backup.timer
```

`barbearia-bridge` inicia `WhatsAppBridge/bridge-factory.js`. A factory roda em `127.0.0.1:2999` e cada loja usa `3000 + storeId`; a loja 1 usa `127.0.0.1:3001`.

## Logs

```bash
journalctl -u barbearia-backend -f
journalctl -u barbearia-bridge -f
journalctl -u barbearia-dashboard -f
```

O instalador configura journald com limite de 200 MB e retencao de 14 dias, alem de logrotate para `/opt/barbearia/logs`.

## Restart automatico

Os servicos principais usam `Restart=always`, `RestartSec=5` e `StartLimitIntervalSec=0`. Em reboot ou crash, o systemd tenta subir novamente.

## Backup

```bash
sudo systemctl start barbearia-backup.service
ls -lh /opt/barbearia/backups
sudo /opt/barbearia/deploy/scripts/restore-test-sqlite.sh
```

O timer roda diariamente e usa `/opt/barbearia/data/agendamentos.db`. Para offsite, configure `OFFSITE_BACKUP_TARGET` e, opcionalmente, `OFFSITE_BACKUP_METHOD=rsync|rclone`.

## Healthcheck

```bash
curl -fsS http://127.0.0.1:4000/health/deep
curl -fsS http://127.0.0.1:5000/health
curl -H "X-API-KEY: $(grep '^API_KEY=' /opt/barbearia/.env | cut -d= -f2-)" http://127.0.0.1:2999/health
curl -H "X-API-KEY: $(grep '^API_KEY=' /opt/barbearia/.env | cut -d= -f2-)" http://127.0.0.1:3001/status
```

## Google Sheets

Configure pela dashboard ou via `.env`:

```env
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/SEU_ID/exec
```

Na dashboard, clique em sincronizar. O retorno deve exibir quantos agendamentos, clientes, profissionais e logs foram enviados.

## Atualizacao segura

```bash
cd /tmp/barbearia
git pull
sudo systemctl start barbearia-backup.service
sudo /opt/barbearia/deploy/scripts/restore-test-sqlite.sh
sudo bash deploy/scripts/publish-to-opt.sh
sudo systemctl restart barbearia-backend barbearia-dashboard barbearia-bridge
sudo /opt/barbearia/deploy/scripts/healthcheck.sh
```

Nunca apague:

- `/opt/barbearia/.env`
- `/opt/barbearia/data`
- `/opt/barbearia/backups`
- `/opt/barbearia/WhatsAppBridge/.wwebjs_auth_*`
