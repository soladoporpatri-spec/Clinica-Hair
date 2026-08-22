#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root: sudo bash /opt/barbearia/deploy/scripts/restart-all.sh" >&2
  exit 1
fi

systemctl daemon-reload
systemctl restart barbearia-backend
systemctl restart barbearia-bridge
systemctl restart barbearia-dashboard
nginx -t
systemctl reload nginx

/opt/barbearia/deploy/scripts/healthcheck.sh
