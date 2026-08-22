#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-barbearia}"
APP_DIR="${APP_DIR:-/opt/barbearia}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root a partir do servidor: sudo bash deploy/scripts/publish-to-opt.sh" >&2
  exit 1
fi

cd "$ROOT_DIR"

mkdir -p "$APP_DIR"/{publish,data,backups,logs,assets,superadmin,deploy}

dotnet publish WhatsAppBot.Worker/WhatsAppBot.Worker.csproj \
  -c Release \
  -r linux-arm64 \
  --self-contained false \
  -o "$APP_DIR/publish"

rsync -a --delete \
  --exclude node_modules \
  --exclude .wwebjs_auth \
  WhatsAppBridge "$APP_DIR/"

rsync -a --delete assets "$APP_DIR/"
rsync -a --delete superadmin "$APP_DIR/"
rsync -a --delete deploy "$APP_DIR/"

cp api-nythar.js package.json package-lock.json dashboard-improved.html script-dashboard.js style-dashboard.css login.html manifest.json "$APP_DIR/"

if [ ! -f "$APP_DIR/.env" ]; then
  cp deploy/.env.example "$APP_DIR/.env"
  echo "Criado $APP_DIR/.env. Edite segredos e dominios antes de iniciar."
fi

cd "$APP_DIR"
npm ci --omit=dev
cd "$APP_DIR/WhatsAppBridge"
npm ci --omit=dev

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod +x "$APP_DIR"/deploy/scripts/*.sh

echo "Publicacao concluida em $APP_DIR"
