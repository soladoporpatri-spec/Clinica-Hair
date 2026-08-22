#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/barbearia}"
NGINX_SITE="${NGINX_SITE:-barbearia}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root: sudo bash deploy/scripts/install-systemd-nginx.sh" >&2
  exit 1
fi

cp "$APP_DIR"/deploy/systemd/*.service /etc/systemd/system/
cp "$APP_DIR"/deploy/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload

cp "$APP_DIR/deploy/nginx-barbearia.conf" "/etc/nginx/sites-available/$NGINX_SITE"
ln -sf "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-enabled/$NGINX_SITE"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

mkdir -p /etc/systemd/journald.conf.d
cat >/etc/systemd/journald.conf.d/barbearia.conf <<'EOF'
[Journal]
SystemMaxUse=200M
MaxRetentionSec=14day
Compress=yes
EOF
systemctl restart systemd-journald

cat >/etc/logrotate.d/barbearia <<'EOF'
/opt/barbearia/logs/*.log /opt/barbearia/logs/*.err.log /opt/barbearia/publish/logs/*.txt {
  daily
  rotate 14
  compress
  missingok
  notifempty
  copytruncate
}
EOF

systemctl enable --now barbearia-backend barbearia-bridge barbearia-dashboard barbearia-backup.timer

if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null || true
  ufw allow 80/tcp >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
  ufw --force enable >/dev/null || true
fi

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y fail2ban >/dev/null || true
  systemctl enable --now fail2ban >/dev/null 2>&1 || true
fi

echo "Servicos e Nginx instalados."
