#!/usr/bin/env bash
# =============================================================================
#  iniciar-linux.sh — Inicia o sistema Nythar (Linux / Oracle Free Tier)
#  Equivalente de INICIAR-SISTEMA-LOCAL.bat para Ubuntu/Debian.
#
#  Uso:
#    chmod +x iniciar-linux.sh
#    ./iniciar-linux.sh
#
#  Em produção (VPS): o systemd usa supervisor.js diretamente via barbearia.service.
#  Este script é útil para inicializações manuais e debug.
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Cores ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}$*${NC}"; }
ok()    { echo -e "${GREEN}  ✓ $*${NC}"; }
warn()  { echo -e "${YELLOW}  ⚠ $*${NC}"; }
error() { echo -e "${RED}ERRO: $*${NC}" >&2; }

echo ""
echo "======================================================"
echo "       NYTHAR — INICIAR SISTEMA LINUX"
echo "======================================================"
echo ""

# ── Diretórios necessários ───────────────────────────────────────────────────
mkdir -p "$ROOT/logs" "$ROOT/data" "$ROOT/backups"

# ── Guard: sistema já em execução ───────────────────────────────────────────
if ss -tlnp 2>/dev/null | grep -q ':4000 ' || nc -z 127.0.0.1 4000 2>/dev/null; then
    warn "Porta 4000 já está em uso. O sistema pode já estar rodando."
    warn "Para reiniciar: sudo systemctl restart barbearia  (ou pare o processo manualmente)"
    echo ""
    read -rp "Continuar mesmo assim? [s/N] " resp
    [[ "${resp,,}" == "s" ]] || exit 0
fi

# ── [1/6] Node.js ────────────────────────────────────────────────────────────
info "[1/6] Verificando Node.js..."
if ! command -v node &>/dev/null; then
    error "Node.js não encontrado. Instale com:"
    echo  "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo  "  sudo apt-get install -y nodejs"
    exit 1
fi
NODE_VER=$(node --version)
ok "Node.js $NODE_VER"

# ── [2/6] .NET Runtime ───────────────────────────────────────────────────────
info "[2/6] Verificando .NET 8 Runtime..."
if ! dotnet --list-runtimes 2>/dev/null | grep -qi "Microsoft.AspNetCore.App 8\."; then
    error ".NET 8 Runtime não encontrado. Instale com:"
    echo  "  sudo apt-get install -y dotnet-aspnetcore-runtime-8.0"
    exit 1
fi
ok ".NET 8 encontrado"

# ── [3/6] Dependências da dashboard ─────────────────────────────────────────
info "[3/6] Verificando dependências da dashboard..."
if [ ! -d "$ROOT/node_modules/express" ]; then
    warn "Instalando dependências (primeira execução)..."
    cd "$ROOT"
    npm ci --omit=dev 2>&1 | tail -5
    if [ $? -ne 0 ]; then
        error "Falha ao instalar dependências da dashboard. Tente: npm install"
        exit 1
    fi
fi
ok "Dependências da dashboard OK"

# ── [4/6] Dependências do WhatsApp Bridge ───────────────────────────────────
info "[4/6] Verificando dependências do WhatsApp Bridge..."
if [ ! -d "$ROOT/WhatsAppBridge/node_modules/whatsapp-web.js" ]; then
    warn "Instalando dependências do WhatsApp Bridge..."
    cd "$ROOT/WhatsAppBridge"
    PUPPETEER_SKIP_DOWNLOAD=1 npm ci --omit=dev 2>&1 | tail -5
    if [ $? -ne 0 ]; then
        error "Falha ao instalar dependências do WhatsApp Bridge."
        exit 1
    fi
    cd "$ROOT"
fi
ok "Dependências do WhatsApp Bridge OK"

# ── [5/6] Chrome ─────────────────────────────────────────────────────────────
info "[5/6] Verificando Chrome para WhatsApp Bridge..."
CHROME_PATH="${PUPPETEER_EXECUTABLE_PATH:-}"

# Detectar se .chrome-path já foi resolvido anteriormente
if [ -z "$CHROME_PATH" ] && [ -f "$ROOT/WhatsAppBridge/.chrome-path" ]; then
    CHROME_PATH=$(cat "$ROOT/WhatsAppBridge/.chrome-path" | tr -d '[:space:]')
fi

# Tentar resolver agora
if [ -z "$CHROME_PATH" ] || [ ! -f "$CHROME_PATH" ]; then
    node "$ROOT/scripts/instalar-chrome.js"
    if [ $? -ne 0 ]; then
        warn "Chrome não resolvido automaticamente."
        warn "Instale: sudo apt-get install -y chromium-browser"
        warn "E adicione ao .env.local: PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser"
    else
        CHROME_PATH=$(cat "$ROOT/WhatsAppBridge/.chrome-path" 2>/dev/null || echo "")
    fi
fi

if [ -n "$CHROME_PATH" ] && [ -f "$CHROME_PATH" ]; then
    ok "Chrome: $CHROME_PATH"
    export PUPPETEER_EXECUTABLE_PATH="$CHROME_PATH"
else
    warn "Chrome sem caminho explícito — puppeteer tentará por conta própria"
fi

# ── Variáveis de ambiente para VPS ───────────────────────────────────────────
export START_NGROK="${START_NGROK:-0}"      # Sem ngrok na VPS
export OPEN_BROWSER="${OPEN_BROWSER:-0}"   # Sem abrir browser no servidor
export NODE_ENV="${NODE_ENV:-production}"

if [ "$START_NGROK" = "0" ]; then
    ok "ngrok desativado (VPS com IP público)"
fi

# ── [6/6] Iniciar supervisor ─────────────────────────────────────────────────
info "[6/6] Iniciando supervisor..."
echo ""
echo "  Dashboard local : http://127.0.0.1:4000/dashboard-improved.html"
echo "  Backend         : http://127.0.0.1:5000"
echo "  Logs            : $ROOT/logs/"
echo ""
echo "  Para parar: Ctrl+C  (ou: sudo systemctl stop barbearia)"
echo "======================================================"
echo ""

cd "$ROOT"
exec node scripts/supervisor.js
