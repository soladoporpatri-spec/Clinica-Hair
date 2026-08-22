#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root: sudo bash /opt/barbearia/deploy/scripts/start-all.sh" >&2
  exit 1
fi

systemctl start nginx
systemctl start barbearia-backend
systemctl start barbearia-bridge
systemctl start barbearia-dashboard
systemctl start barbearia-backup.timer

systemctl --no-pager --full status barbearia-backend barbearia-bridge barbearia-dashboard --lines=5
