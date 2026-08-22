#!/usr/bin/env bash
# =============================================================================
#  instalar-linux.sh — Instalador completo para Ubuntu 22.04 / Debian (ARM64)
#  Equivalente de INSTALAR-CLIENTE.bat para Linux / Oracle Free Tier.
#
#  O que faz:
#    1. Verifica/instala Node.js 20 LTS, .NET 8 Runtime, Chromium
#    2. Instala dependências npm (dashboard + WhatsApp Bridge)
#    3. Gera segredos únicos (.env.local)
#    4. Resolve Chrome e salva caminho
#    5. Configura serviço systemd (auto-start no reboot)
#    6. Imprime próximos passos (nginx/HTTPS)
#
#  Uso:
#    chmod +x instalar-linux.sh
#    sudo ./instalar-linux.sh          # recomendado (instala pacotes)
#    ./instalar-linux.sh               # sem root: pula instalação de pacotes
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HAS_SUDO=false
INSTALL_DIR="${INSTALL_DIR:-$ROOT}"  # permite sobrescrever via env
SERVICE_USER="${SERVICE_USER:-$(whoami)}"

# ── Cores ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}${BOLD}$*${NC}"; }
ok()      { echo -e "${GREEN}  ✓ $*${NC}"; }
warn()    { echo -e "${YELLOW}  ⚠ $*${NC}"; }
error()   { echo -e "${RED}ERRO: $*${NC}" >&2; }
step()    { echo -e "\n${BOLD}[$1] $2${NC}"; }

# ── Verificar sudo ───────────────────────────────────────────────────────────
if sudo -n true 2>/dev/null; then
    HAS_SUDO=true
fi

echo ""
echo "======================================================"
echo "   NYTHAR — INSTALACAO LINUX (Oracle/Ubuntu)"
echo "======================================================"
echo "  Diretório : $ROOT"
echo "  Usuário   : $SERVICE_USER"
echo "  Sudo      : $HAS_SUDO"
echo "======================================================"
echo ""

# ── [1/7] Node.js 20 LTS ─────────────────────────────────────────────────────
step "1/7" "Node.js 20 LTS"
if command -v node &>/dev/null && node --version | grep -q "^v2[0-9]"; then
    ok "Node.js $(node --version) já instalado"
elif $HAS_SUDO; then
    info "  Instalando Node.js 20 LTS via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | grep -E "^(##|deb)" || true
    sudo apt-get install -y nodejs
    ok "Node.js $(node --version) instalado"
else
    error "Node.js não encontrado e sem sudo para instalar."
    echo  "  Execute como root ou instale manualmente:"
    echo  "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo  "  sudo apt-get install -y nodejs"
    exit 1
fi

# ── [2/7] .NET 8 ASP.NET Core Runtime ────────────────────────────────────────
step "2/7" ".NET 8 ASP.NET Core Runtime"
if dotnet --list-runtimes 2>/dev/null | grep -qi "Microsoft.AspNetCore.App 8\."; then
    ok ".NET 8 Runtime já instalado"
elif $HAS_SUDO; then
    info "  Instalando .NET 8 Runtime..."
    # Método universal: Microsoft feed via apt
    if ! grep -r "packages.microsoft.com" /etc/apt/sources.list* &>/dev/null; then
        curl -fsSL https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb \
            -o /tmp/packages-microsoft-prod.deb
        sudo dpkg -i /tmp/packages-microsoft-prod.deb
        sudo apt-get update -q
    fi
    sudo apt-get install -y dotnet-aspnetcore-runtime-8.0
    ok ".NET 8 Runtime instalado"
else
    error ".NET 8 Runtime não encontrado e sem sudo."
    echo  "  Instale manualmente: sudo apt-get install -y dotnet-aspnetcore-runtime-8.0"
    exit 1
fi

# ── [3/7] Chromium ───────────────────────────────────────────────────────────
step "3/7" "Chromium (para WhatsApp Bridge)"
CHROME_BIN=""
for candidate in /usr/bin/chromium-browser /usr/bin/chromium /usr/bin/google-chrome /snap/bin/chromium; do
    if [ -f "$candidate" ]; then
        CHROME_BIN="$candidate"
        break
    fi
done

if [ -n "$CHROME_BIN" ]; then
    ok "Chromium já instalado: $CHROME_BIN"
elif $HAS_SUDO; then
    info "  Instalando Chromium..."
    sudo apt-get install -y chromium-browser || sudo apt-get install -y chromium
    # Re-detectar após instalar
    for candidate in /usr/bin/chromium-browser /usr/bin/chromium; do
        if [ -f "$candidate" ]; then
            CHROME_BIN="$candidate"
            break
        fi
    done
    ok "Chromium instalado: $CHROME_BIN"
else
    warn "Chromium não encontrado e sem sudo para instalar."
    warn "Instale manualmente: sudo apt-get install -y chromium-browser"
    warn "Depois adicione ao .env.local: PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser"
fi

# ── [4/7] Dependências npm ───────────────────────────────────────────────────
step "4/7" "Dependências npm"

info "  Dashboard..."
cd "$ROOT"
npm ci --omit=dev 2>&1 | tail -3
ok "Dashboard: dependências instaladas"

info "  WhatsApp Bridge..."
cd "$ROOT/WhatsAppBridge"
PUPPETEER_SKIP_DOWNLOAD=1 npm ci --omit=dev 2>&1 | tail -3
ok "WhatsApp Bridge: dependências instaladas"
cd "$ROOT"

# ── [5/7] Segredos e Chrome ──────────────────────────────────────────────────
step "5/7" "Segredos e configuração de Chrome"

info "  Gerando segredos únicos (.env.local)..."
node "$ROOT/scripts/gerar-segredos.js"

# Injetar PUPPETEER_EXECUTABLE_PATH no .env.local se encontramos Chrome
if [ -n "$CHROME_BIN" ]; then
    ENV_FILE="$ROOT/.env.local"
    # Remover linha existente (se houver) e adicionar nova
    if grep -q "^PUPPETEER_EXECUTABLE_PATH=" "$ENV_FILE" 2>/dev/null; then
        # Substituição portável sem sed -i (compatibilidade POSIX)
        tmp=$(mktemp)
        grep -v "^PUPPETEER_EXECUTABLE_PATH=" "$ENV_FILE" > "$tmp"
        echo "PUPPETEER_EXECUTABLE_PATH=$CHROME_BIN" >> "$tmp"
        mv "$tmp" "$ENV_FILE"
    else
        echo "PUPPETEER_EXECUTABLE_PATH=$CHROME_BIN" >> "$ENV_FILE"
    fi
    # Desativar ngrok na VPS
    if ! grep -q "^START_NGROK=" "$ENV_FILE" 2>/dev/null; then
        echo "START_NGROK=0" >> "$ENV_FILE"
    fi
    if ! grep -q "^OPEN_BROWSER=" "$ENV_FILE" 2>/dev/null; then
        echo "OPEN_BROWSER=0" >> "$ENV_FILE"
    fi
    ok ".env.local atualizado com Chrome e START_NGROK=0"
fi

info "  Resolvendo Chrome para o bridge..."
node "$ROOT/scripts/instalar-chrome.js" && ok "Chrome resolvido" || warn "Chrome não resolvido automaticamente (verifique acima)"

# ── [6/7] Systemd ────────────────────────────────────────────────────────────
step "6/7" "Serviço systemd (auto-start)"

SERVICE_SRC="$ROOT/docs/barbearia.service"
SERVICE_DST="/etc/systemd/system/barbearia.service"

if $HAS_SUDO && [ -f "$SERVICE_SRC" ]; then
    # Substituir INSTALL_DIR e SERVICE_USER no template
    tmp=$(mktemp)
    sed "s|__INSTALL_DIR__|$ROOT|g; s|__SERVICE_USER__|$SERVICE_USER|g" "$SERVICE_SRC" > "$tmp"
    sudo cp "$tmp" "$SERVICE_DST"
    rm "$tmp"
    sudo chown root:root "$SERVICE_DST"
    sudo chmod 644 "$SERVICE_DST"
    sudo systemctl daemon-reload
    sudo systemctl enable barbearia
    ok "Serviço barbearia instalado e habilitado (auto-start no reboot)"
    echo ""
    echo "  Iniciar agora   : sudo systemctl start barbearia"
    echo "  Status          : sudo systemctl status barbearia"
    echo "  Logs em tempo real: journalctl -u barbearia -f"
elif ! $HAS_SUDO; then
    warn "Sem sudo — serviço systemd não configurado automaticamente."
    warn "Execute como root:"
    echo "  sudo cp $SERVICE_SRC $SERVICE_DST"
    echo "  sudo sed -i 's|__INSTALL_DIR__|$ROOT|g' $SERVICE_DST"
    echo "  sudo sed -i 's|__SERVICE_USER__|$SERVICE_USER|g' $SERVICE_DST"
    echo "  sudo systemctl daemon-reload && sudo systemctl enable --now barbearia"
elif [ ! -f "$SERVICE_SRC" ]; then
    warn "docs/barbearia.service não encontrado no ZIP — configure systemd manualmente."
fi

# ── [7/7] Resumo e próximos passos ──────────────────────────────────────────
step "7/7" "Instalação concluída"

echo ""
echo -e "${GREEN}${BOLD}======================================================"
echo  "  INSTALACAO CONCLUIDA COM SUCESSO!"
echo -e "======================================================${NC}"
echo ""
echo "  Próximos passos:"
echo ""
echo "  1. Iniciar o sistema:"
echo "       sudo systemctl start barbearia"
echo "       journalctl -u barbearia -f"
echo ""
echo "  2. Configurar nginx + HTTPS (recomendado):"
echo "       sudo apt-get install -y nginx certbot python3-certbot-nginx"
echo "       # Copiar configuração nginx de docs/nginx-barbearia.conf"
echo "       sudo certbot --nginx -d seudominio.com"
echo ""
echo "  3. Ajustar CORS no .env.local:"
echo "       CORS_ORIGINS=https://seudominio.com"
echo "       sudo systemctl restart barbearia"
echo ""
echo "  Dashboard: http://$(hostname -I | awk '{print $1}'):4000/dashboard-improved.html"
echo ""
