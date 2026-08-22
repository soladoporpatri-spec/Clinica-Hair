#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/barbearia}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

DASHBOARD_URL="${DASHBOARD_URL:-http://127.0.0.1:4000/health/deep}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:5000/health}"
FACTORY_HEALTH_URL="${FACTORY_HEALTH_URL:-http://127.0.0.1:${FACTORY_PORT:-2999}/health}"
BRIDGE_STORE_ID="${BRIDGE_STORE_ID:-1}"
BRIDGE_BASE_PORT="${BRIDGE_BASE_PORT:-3000}"
BRIDGE_HEALTH_URL="${BRIDGE_HEALTH_URL:-http://127.0.0.1:$((BRIDGE_BASE_PORT + BRIDGE_STORE_ID))/status}"

echo "== systemd =="
systemctl --no-pager --quiet is-active barbearia-backend && echo "backend: active" || { echo "backend: inactive"; exit 1; }
systemctl --no-pager --quiet is-active barbearia-dashboard && echo "dashboard: active" || { echo "dashboard: inactive"; exit 1; }
systemctl --no-pager --quiet is-active barbearia-bridge && echo "bridge: active" || { echo "bridge: inactive"; exit 1; }

echo "== http =="
curl -fsS "$BACKEND_HEALTH_URL" >/dev/null && echo "backend health: OK"
curl -fsS "$DASHBOARD_URL" >/dev/null && echo "dashboard deep health: OK"
curl -fsS -H "X-API-KEY: ${API_KEY:-}" "$FACTORY_HEALTH_URL" >/dev/null && echo "bridge factory health: OK"
curl -fsS -H "X-API-KEY: ${API_KEY:-}" "$BRIDGE_HEALTH_URL" >/dev/null && echo "bridge store ${BRIDGE_STORE_ID} status: OK"

echo "== ports =="
ss -ltnp | grep -E ':(80|443|4000|5000|2999|3001)\b' || true

echo "OK"
