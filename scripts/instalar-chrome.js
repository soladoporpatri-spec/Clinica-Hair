/**
 * Resolve o Chrome para o WhatsApp Bridge (cross-platform: Windows e Linux).
 *
 * Ordem de resolução:
 *   1. PUPPETEER_EXECUTABLE_PATH (variável de ambiente — mais alta prioridade)
 *   2. Caminhos do sistema (Windows: Program Files / AppData; Linux: /usr/bin)
 *   3. which/where para encontrar chromium no PATH
 *   4. Download via puppeteer browsers API (com limpeza de cache corrompido)
 *      — Windows: baixa Chrome automaticamente
 *      — Linux:   orienta apt install chromium-browser e sai com erro acionável
 *
 * Grava o caminho resolvido em WhatsAppBridge/.chrome-path.
 * O index.js lê esse arquivo em resolveChromePath() na inicialização.
 */

'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const IS_WIN  = process.platform === 'win32';
const IS_LIN  = process.platform === 'linux';
const IS_MAC  = process.platform === 'darwin';

const root          = path.resolve(__dirname, '..');
const chromePathFile = path.join(root, 'WhatsAppBridge', '.chrome-path');

// ── Candidatos por plataforma ────────────────────────────────────────────────

const WIN_PATHS = [
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Chromium', 'Application', 'chrome.exe'),
];

const LINUX_PATHS = [
    '/usr/bin/chromium-browser',      // Ubuntu/Debian (apt install chromium-browser)
    '/usr/bin/chromium',              // Debian minimal / Arch
    '/usr/bin/google-chrome',         // Google Chrome
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium',             // Ubuntu snap
    '/usr/local/bin/chromium',        // compilado manualmente
    '/usr/local/bin/chrome',
];

const MAC_PATHS = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

function getSystemPaths() {
    if (IS_WIN)  return WIN_PATHS;
    if (IS_LIN)  return LINUX_PATHS;
    if (IS_MAC)  return MAC_PATHS;
    return [];
}

// ── Utilitários ──────────────────────────────────────────────────────────────

function fileExists(p) {
    try { return fs.existsSync(p); } catch { return false; }
}

function whichChrome() {
    const candidates = IS_WIN
        ? ['chrome.exe', 'chromium.exe']
        : ['chromium-browser', 'chromium', 'google-chrome', 'google-chrome-stable'];
    const cmd = IS_WIN ? 'where' : 'which';
    for (const bin of candidates) {
        try {
            const result = execSync(`${cmd} ${bin}`, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 })
                .toString().trim().split(/\r?\n/)[0].trim();
            if (result && fileExists(result)) return result;
        } catch { /* não está no PATH */ }
    }
    return null;
}

function cleanCorruptedPuppeteerCache() {
    const cacheDir = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
    try {
        if (!fs.existsSync(cacheDir)) return;
        for (const entry of fs.readdirSync(cacheDir)) {
            const dir = path.join(cacheDir, entry);
            if (!fs.statSync(dir).isDirectory()) continue;
            // Pasta criada mas executável ausente = cache corrompido
            const exes = [
                path.join(dir, 'chrome-win64', 'chrome.exe'),
                path.join(dir, 'chrome-win32', 'chrome.exe'),
                path.join(dir, 'chrome-linux', 'chrome'),
                path.join(dir, 'chrome', 'chrome'),
            ];
            if (!exes.some(fileExists)) {
                console.log(`[instalar-chrome] Removendo cache corrompido: ${dir}`);
                fs.rmSync(dir, { recursive: true, force: true });
            }
        }
    } catch (e) {
        console.warn('[instalar-chrome] Nao foi possivel limpar cache puppeteer:', e.message);
    }
}

async function downloadPuppeteerChrome() {
    const browsersModulePath = path.join(root, 'WhatsAppBridge', 'node_modules', '@puppeteer', 'browsers');
    try {
        const { install, resolveBuildId, Browser, detectBrowserPlatform } = require(browsersModulePath);
        const cacheDir  = path.join(os.homedir(), '.cache', 'puppeteer');
        const platform  = detectBrowserPlatform();
        const buildId   = await resolveBuildId(Browser.CHROME, platform, 'stable');
        console.log(`[instalar-chrome] Baixando Chrome ${buildId} para ${platform}...`);
        const result = await install({ browser: Browser.CHROME, cacheDir, buildId });
        return result.executablePath;
    } catch (e) {
        console.warn('[instalar-chrome] Download via puppeteer falhou:', e.message);
        return null;
    }
}

function save(chromePath) {
    fs.writeFileSync(chromePathFile, chromePath, 'utf8');
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
    // 1. Variável de ambiente explícita
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (envPath && fileExists(envPath)) {
        save(envPath);
        console.log('[instalar-chrome] Usando PUPPETEER_EXECUTABLE_PATH:', envPath);
        process.exit(0);
    }

    // 2. Caminhos conhecidos do sistema
    for (const p of getSystemPaths()) {
        if (fileExists(p)) {
            save(p);
            console.log('[instalar-chrome] Chrome do sistema encontrado:', p);
            process.exit(0);
        }
    }

    // 3. which/where — Chrome no PATH mas em localização não padrão
    const fromPath = whichChrome();
    if (fromPath) {
        save(fromPath);
        console.log('[instalar-chrome] Chrome encontrado via PATH:', fromPath);
        process.exit(0);
    }

    // 4. Sem Chrome no sistema
    if (IS_LIN) {
        // No Linux não fazemos download automático — o Chrome deve vir do gerenciador de pacotes
        console.error('\n[instalar-chrome] ERRO: Chromium nao encontrado no sistema Linux.');
        console.error('Execute o seguinte comando para instalar:');
        console.error('\n  sudo apt-get install -y chromium-browser\n');
        console.error('Ou, se preferir Google Chrome:');
        console.error('  wget -qO- https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/chrome.deb');
        console.error('  sudo apt install /tmp/chrome.deb\n');
        console.error('Depois defina no .env.local:');
        console.error('  PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser\n');
        if (fileExists(chromePathFile)) fs.unlinkSync(chromePathFile);
        process.exit(1);
    }

    // 5. Windows/Mac: tentar download automático via puppeteer
    console.log('[instalar-chrome] Chrome nao encontrado. Baixando automaticamente...');
    cleanCorruptedPuppeteerCache();
    const downloaded = await downloadPuppeteerChrome();
    if (downloaded) {
        save(downloaded);
        console.log('[instalar-chrome] Chrome baixado com sucesso:', downloaded);
        process.exit(0);
    }

    // Falhou em tudo — index.js tentará sem executablePath explícito
    console.warn('[instalar-chrome] Nao foi possivel resolver o Chrome. O bot tentara iniciar sem caminho explicito.');
    if (fileExists(chromePathFile)) fs.unlinkSync(chromePathFile);
    process.exit(1);
})();
