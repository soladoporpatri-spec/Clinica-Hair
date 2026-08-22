#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-barbearia}"
APP_DIR="${APP_DIR:-/opt/barbearia}"
DOTNET_DIR="${DOTNET_DIR:-/opt/dotnet}"
NODE_MAJOR="${NODE_MAJOR:-20}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root: sudo bash deploy/scripts/install-oracle-arm64.sh" >&2
  exit 1
fi

apt-get update
apt-get install -y \
  ca-certificates curl git unzip tar gzip rsync sqlite3 nginx snapd ufw jq \
  fontconfig fonts-liberation libnss3 libatk-bridge2.0-0 libgtk-3-0 \
  libgbm1 libasound2t64 xdg-utils

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "v${NODE_MAJOR}."; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

if ! command -v chromium >/dev/null 2>&1; then
  snap install chromium
fi

CHROMIUM_BIN="$(command -v chromium || command -v chromium-browser || true)"
if [ -n "$CHROMIUM_BIN" ] && [ ! -x /usr/bin/chromium ]; then
  ln -sf "$CHROMIUM_BIN" /usr/bin/chromium
fi

if [ ! -x "$DOTNET_DIR/dotnet" ]; then
  mkdir -p "$DOTNET_DIR"
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
  bash /tmp/dotnet-install.sh --channel 8.0 --architecture arm64 --install-dir "$DOTNET_DIR"
  ln -sf "$DOTNET_DIR/dotnet" /usr/bin/dotnet
fi

id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_DIR" "$APP_USER"
mkdir -p "$APP_DIR"/{data,backups,logs,publish,WhatsAppBridge}
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "Base pronta. Dotnet: $(dotnet --version). Node: $(node --version). Chromium: $(command -v chromium || true)"
