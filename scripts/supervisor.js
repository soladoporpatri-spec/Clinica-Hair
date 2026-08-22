const { execFile, spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..');
const logsDir = path.join(root, 'logs');
const dataDir = path.join(root, 'data');
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

// A identidade persistida mantém a mesma pasta de sessão do WhatsApp mesmo
// se a instalação for movida/renomeada depois. Na primeira atualização,
// usamos o hash legado do caminho atual para reaproveitar a sessão existente.
const installationIdFile = path.join(dataDir, 'installation-id');
const legacyInstallationId = crypto.createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 16);

function loadOrCreateInstallationId() {
    const configured = String(process.env.RUNTIME_INSTANCE_ID || '').trim();
    if (configured) return configured;

    try {
        const persisted = fs.readFileSync(installationIdFile, 'utf8').trim();
        if (/^[a-zA-Z0-9_-]{8,64}$/.test(persisted)) return persisted;
    } catch {}

    fs.writeFileSync(installationIdFile, legacyInstallationId, { encoding: 'utf8', mode: 0o600 });
    return legacyInstallationId;
}

const runtimeInstanceId = loadOrCreateInstallationId();
const publishedBackendDir = path.join(root, 'runtime', 'backend');
const publishedBackendDll = path.join(publishedBackendDir, 'WhatsAppBot.Worker.dll');
const runtimeFile = path.join(dataDir, 'local-runtime.json');

// Uma instalação deve possuir apenas um supervisor. Sem esta trava, dois
// cliques no BAT podem iniciar factories e Chromiums concorrentes usando a
// mesma sessão do WhatsApp.
const supervisorLockFile = path.join(dataDir, 'supervisor.lock');
let ownsSupervisorLock = false;

function isPidAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function acquireSupervisorLock() {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const fd = fs.openSync(supervisorLockFile, 'wx');
            fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, instanceId: runtimeInstanceId, startedAt: new Date().toISOString() }));
            fs.closeSync(fd);
            ownsSupervisorLock = true;
            return true;
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
            let ownerPid = null;
            try { ownerPid = Number(JSON.parse(fs.readFileSync(supervisorLockFile, 'utf8')).pid); } catch {}
            if (ownerPid !== process.pid && isPidAlive(ownerPid)) {
                console.log(`[supervisor] Esta instalação já está sendo supervisionada pelo PID ${ownerPid}. Nenhum processo duplicado foi iniciado.`);
                return false;
            }
            try { fs.unlinkSync(supervisorLockFile); } catch {}
        }
    }
    throw new Error('Não foi possível adquirir a trava exclusiva do supervisor.');
}

function releaseSupervisorLock() {
    if (!ownsSupervisorLock) return;
    try {
        const current = JSON.parse(fs.readFileSync(supervisorLockFile, 'utf8'));
        if (Number(current.pid) === process.pid) fs.unlinkSync(supervisorLockFile);
    } catch {}
    ownsSupervisorLock = false;
}

if (!acquireSupervisorLock()) process.exit(0);

// Carregar segredos locais gerados na instalacao (.env.local).
// Popula process.env ANTES de stableSecrets para que os fallbacks abaixo usem os valores certos.
const envLocalPath = path.join(root, '.env.local');
if (fs.existsSync(envLocalPath)) {
    const envLines = fs.readFileSync(envLocalPath, 'utf8').split(/\r?\n/);
    for (const raw of envLines) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx < 1) continue;
        const key = line.substring(0, eqIdx).trim();
        const val = line.substring(eqIdx + 1).trim();
        if (key && val && !process.env[key]) process.env[key] = val;
    }
    console.log('[supervisor] .env.local carregado â€” usando segredos unicos desta instalacao.');
} else {
    console.warn('[supervisor] AVISO: .env.local nao encontrado. Execute: node scripts/gerar-segredos.js');
}

const missingSecrets = [];
if (!process.env.API_KEY) missingSecrets.push('API_KEY');
if (!process.env.Jwt__Secret && !process.env.JWT_SECRET) missingSecrets.push('Jwt__Secret/JWT_SECRET');
if (!process.env.DEFAULT_ADMIN_PASSWORD) missingSecrets.push('DEFAULT_ADMIN_PASSWORD');
if (!process.env.SUPERADMIN_PASSWORD && !process.env.DEFAULT_ADMIN_PASSWORD) missingSecrets.push('SUPERADMIN_PASSWORD');

if (missingSecrets.length > 0) {
    console.error(`[supervisor] ERRO: segredos ausentes: ${missingSecrets.join(', ')}.`);
    console.error('[supervisor] Execute primeiro: node scripts/gerar-segredos.js');
    process.exit(1);
}

const stableSecrets = {
    API_KEY: process.env.API_KEY,
    Jwt__Secret: process.env.Jwt__Secret || process.env.JWT_SECRET,
    SUPERADMIN_USERNAME: process.env.SUPERADMIN_USERNAME || 'superadmin',
    SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD
};

const commonEnv = {
    ...process.env,
    API_KEY: stableSecrets.API_KEY,
    ApiKey: stableSecrets.API_KEY,
    Jwt__Secret: stableSecrets.Jwt__Secret,
    JWT_SECRET: stableSecrets.Jwt__Secret,
    SUPERADMIN_USERNAME: stableSecrets.SUPERADMIN_USERNAME,
    SUPERADMIN_PASSWORD: stableSecrets.SUPERADMIN_PASSWORD,
    ASPNETCORE_ENVIRONMENT: 'Production',
    DOTNET_ENVIRONMENT: 'Production',
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
    NODE_ENV: 'production',
    RUNTIME_INSTANCE_ID: runtimeInstanceId,
    NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=768',
    BACKEND_URL: 'http://127.0.0.1:5000',
    // Arquitetura multi-instÃ¢ncia: cada loja usa porta 3000+storeId (Store 1 â†’ 3001, Store 2 â†’ 3002)
    // BRIDGE_URL Ã© mantido como fallback para cÃ³digo legado; a factory gerencia as bridges reais
    BRIDGE_URL: 'http://127.0.0.1:3001',
    // WhatsAppBridge__BaseUrl usa notaÃ§Ã£o .NET (__ = :) para ser lido por IConfiguration
    // Aponta para a bridge da Store 1 como default; cada store tem sua prÃ³pria bridge via factory
    'WhatsAppBridge__BaseUrl': 'http://127.0.0.1:3001',
    BRIDGE_HOST: '127.0.0.1',
    BRIDGE_BASE_PORT: '3000',
    FACTORY_PORT: '2999',
    DASHBOARD_HOST: '127.0.0.1',
    PORT: '4000',
    ASPNETCORE_URLS: 'http://127.0.0.1:5000',
    BARBEARIA_DATA_DIR: dataDir,
    BACKUP_DIR: path.join(root, 'backups'),
    LOG_DIR: logsDir,
    CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:4000,http://127.0.0.1:4000,http://localhost:4040,http://127.0.0.1:4040',
    DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD,
    DEFAULT_OWNER_USERNAME: process.env.DEFAULT_OWNER_USERNAME || 'dono',
    DEFAULT_OWNER_PASSWORD: process.env.DEFAULT_OWNER_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD,
    BACKEND_WEBHOOK_TIMEOUT_MS: process.env.BACKEND_WEBHOOK_TIMEOUT_MS || '45000',
    QUEUE_MAX_AGE_MS: process.env.QUEUE_MAX_AGE_MS || String(15 * 60 * 1000),
    QUEUE_MAX_ATTEMPTS: process.env.QUEUE_MAX_ATTEMPTS || '10'
};

function newestMtimeMs(dir, extensions = new Set(['.cs', '.csproj', '.json'])) {
    let newest = 0;
    if (!fs.existsSync(dir)) return newest;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (['bin', 'obj'].includes(entry.name)) continue;
            newest = Math.max(newest, newestMtimeMs(fullPath, extensions));
            continue;
        }
        if (!extensions.has(path.extname(entry.name))) continue;
        newest = Math.max(newest, fs.statSync(fullPath).mtimeMs);
    }

    return newest;
}

const backendSourceDir = path.join(root, 'WhatsAppBot.Worker');
const backendDllMtime = fs.existsSync(publishedBackendDll) ? fs.statSync(publishedBackendDll).mtimeMs : 0;
const backendSourceMtime = newestMtimeMs(backendSourceDir);
const backendPublished = fs.existsSync(publishedBackendDll) && backendDllMtime >= backendSourceMtime;
const systemAlertFile = path.join(dataDir, 'system-alert.json');

if (fs.existsSync(publishedBackendDll) && !backendPublished) {
    console.warn('[supervisor] runtime/backend esta desatualizado; iniciando backend a partir da fonte.');
}

/** Escreve um alerta de sistema persistido em disco, lido pelo dashboard via /api/system-alert */
function writeSystemAlert(service, reason) {
    const alert = {
        service: typeof service === 'string' ? service : service.name,
        reason,
        since: new Date().toISOString(),
        restartCount: typeof service === 'object' ? service.restartCount : undefined
    };
    try {
        fs.writeFileSync(systemAlertFile, JSON.stringify(alert, null, 2));
        log(service, `[ALERTA] ${reason}`);
    } catch (e) {
        log(service, `Erro ao escrever alerta de sistema: ${e.message}`);
    }
}

/** Remove o alerta se ele pertencia a este servico (servico recuperado). */
function clearSystemAlert(service) {
    try {
        if (!fs.existsSync(systemAlertFile)) return;
        const existing = JSON.parse(fs.readFileSync(systemAlertFile, 'utf8'));
        const name = typeof service === 'string' ? service : service.name;
        if (existing.service === name) {
            fs.unlinkSync(systemAlertFile);
            log(service, 'Alerta de sistema removido â€” servico recuperado.');
        }
    } catch {}
}

const services = [
    {
        name: 'backend',
        command: 'dotnet',
        args: backendPublished
            ? [publishedBackendDll, '--urls', 'http://127.0.0.1:5000']
            : ['run', '--urls', 'http://127.0.0.1:5000'],
        cwd: backendPublished ? publishedBackendDir : backendSourceDir,
        healthUrl: 'http://127.0.0.1:5000/health',
        port: 5000,
        waitMs: 90000
    },
    {
        name: 'whatsapp-bridge',
        command: 'node',
        args: ['bridge-factory.js'],
        cwd: path.join(root, 'WhatsAppBridge'),
        healthUrl: 'http://127.0.0.1:2999/health',
        port: 2999,
        waitMs: 180000   // Bridge-factory + bridges filhas precisam de mais tempo
    },
    {
        name: 'dashboard-api',
        command: 'node',
        args: ['api-nythar.js'],
        cwd: root,
        healthUrl: 'http://127.0.0.1:4000/health',
        port: 4000,
        waitMs: 45000
    }
].map(service => ({
    ...service,
    process: null,
    restartCount: 0,
    failedHealthChecks: 0,
    starting: false,
    externalHealthy: false
}));

let ngrokProcess = null;
let ngrokPublicUrl = null;
let shuttingDown = false;

function now() {
    return new Date().toISOString();
}

function logName(serviceName) {
    return path.join(logsDir, `${serviceName}.log`);
}

/**
 * Rotaciona um arquivo de log se ele ultrapassar maxSizeMB.
 * Renomeia para .1 (sobrescreve backup anterior).
 * Silencioso em caso de erro (ex.: arquivo em uso no Windows).
 */
function rotateLogIfNeeded(filePath, maxSizeMB = 20) {
    try {
        if (!fs.existsSync(filePath)) return;
        const stat = fs.statSync(filePath);
        if (stat.size <= maxSizeMB * 1024 * 1024) return;
        const backup = filePath + '.1';
        if (fs.existsSync(backup)) fs.unlinkSync(backup);
        fs.renameSync(filePath, backup);
    } catch (_) {
        // Arquivo em uso ou sem permissao â€” ignora
    }
}

function log(service, message) {
    const name = typeof service === 'string' ? service : service.name;
    const line = `[${now()}] [${name}] ${message}`;
    console.log(line);
    fs.appendFileSync(logName(name), `${line}\n`);
}

function healthCheck(url, timeoutMs = 3500, headers = {}, expectedInstanceId = null) {
    return new Promise(resolve => {
        const req = http.get(url, { headers }, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) return resolve(false);
                if (!expectedInstanceId) return resolve(true);
                try {
                    const data = JSON.parse(body);
                    return resolve(data.instanceId === expectedInstanceId);
                } catch {
                    return resolve(false);
                }
            });
        });
        req.setTimeout(timeoutMs, () => {
            req.destroy();
            resolve(false);
        });
        req.on('error', () => resolve(false));
    });
}

function getJson(url, timeoutMs = 3500) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(error);
                }
            });
        });
        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error('timeout'));
        });
        req.on('error', reject);
    });
}

function postJson(url, payload = {}, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const target = new URL(url);
        const req = http.request({
            hostname: target.hostname,
            port: target.port,
            path: `${target.pathname}${target.search}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'X-API-KEY': stableSecrets.API_KEY
            }
        }, res => {
            let response = '';
            res.setEncoding('utf8');
            res.on('data', chunk => response += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = response ? JSON.parse(response) : null; } catch { parsed = response; }
                resolve({ statusCode: res.statusCode, body: parsed });
            });
        });
        req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function execFileAsync(command, args) {
    return new Promise(resolve => {
        execFile(command, args, { windowsHide: true }, (error, stdout) => {
            resolve(error ? '' : stdout.trim());
        });
    });
}

async function commandExists(command) {
    const finder = process.platform === 'win32' ? 'where.exe' : 'which';
    const output = await execFileAsync(finder, [command]);
    return Boolean(output);
}

async function findPidByPort(port) {
    if (process.platform === 'win32') {
        const script = `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess`;
        const output = await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script]);
        const pid = Number(output);
        return Number.isInteger(pid) && pid > 0 ? pid : null;
    }

    const output = await execFileAsync('sh', ['-c', `lsof -ti tcp:${port} -sTCP:LISTEN | head -n 1`]);
    const pid = Number(output);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
}

async function stopProcessOnPort(service) {
    const pid = await findPidByPort(service.port);
    if (!pid || pid === process.pid) return false;

    log(service, `encerrando processo externo na porta ${service.port} pid=${pid}.`);
    if (process.platform === 'win32') {
        await execFileAsync('taskkill.exe', ['/PID', String(pid), '/T', '/F']);
    } else {
        try {
            process.kill(pid, 'SIGTERM');
        } catch {}
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    return true;
}

async function waitForHealthy(service) {
    const deadline = Date.now() + service.waitMs;
    while (Date.now() < deadline) {
        if (await healthCheck(service.healthUrl, 3500, {}, runtimeInstanceId)) {
            service.failedHealthChecks = 0;
            log(service, `saudavel em ${service.healthUrl}.`);
            clearSystemAlert(service);
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    const msg = `${service.name} nao ficou saudavel em ${Math.round(service.waitMs / 1000)}s apos reinicializacao.`;
    log(service, msg);
    writeSystemAlert(service, msg);
    return false;
}

async function startService(service) {
    if (service.process || service.starting) return;
    service.starting = true;

    if (await healthCheck(service.healthUrl, 3500, {}, runtimeInstanceId)) {
        service.externalHealthy = true;
        service.failedHealthChecks = 0;
        service.starting = false;
        log(service, 'ja estava saudavel; monitorando processo existente.');
        return;
    }

    if (await healthCheck(service.healthUrl)) {
        service.starting = false;
        const msg = `porta ${service.port} pertence a outra instalacao; processo externo preservado.`;
        log(service, msg);
        writeSystemAlert(service, msg);
        return;
    }

    await stopProcessOnPort(service);

    const backoffMs = Math.min(30000, service.restartCount * 3000);
    if (backoffMs > 0) {
        log(service, `aguardando ${Math.round(backoffMs / 1000)}s antes de reiniciar.`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
    }

    const outPath = path.join(logsDir, `${service.name}.out.log`);
    const errPath = path.join(logsDir, `${service.name}.err.log`);
    rotateLogIfNeeded(outPath);
    rotateLogIfNeeded(errPath);
    const out = fs.createWriteStream(outPath, { flags: 'a' });
    const err = fs.createWriteStream(errPath, { flags: 'a' });

    log(service, `iniciando: ${service.command} ${service.args.join(' ')}`);
    const child = spawn(service.command, service.args, {
        cwd: service.cwd,
        shell: false,
        windowsHide: true,
        env: commonEnv
    });

    service.process = child;
    service.externalHealthy = false;
    service.starting = false;

    child.stdout.pipe(out);
    child.stderr.pipe(err);

    child.on('exit', (code, signal) => {
        log(service, `processo encerrou code=${code ?? '-'} signal=${signal ?? '-'}.`);
        service.process = null;
        if (shuttingDown) return;
        service.restartCount++;
        setTimeout(() => startService(service), 1500);
    });

    await waitForHealthy(service);
}

async function monitorService(service) {
    const healthy = await healthCheck(service.healthUrl, 3500, {}, runtimeInstanceId);

    if (healthy) {
        if (service.failedHealthChecks > 0) clearSystemAlert(service);
        service.failedHealthChecks = 0;
        return;
    }

    service.failedHealthChecks++;
    log(service, `health check falhou (${service.failedHealthChecks}/3).`);

    if (service.failedHealthChecks < 3) return;

    if (!service.process && await healthCheck(service.healthUrl)) {
        service.failedHealthChecks = 0;
        const msg = `porta ${service.port} passou a pertencer a outra instalacao; processo externo preservado.`;
        log(service, msg);
        writeSystemAlert(service, msg);
        return;
    }

    writeSystemAlert(service, `${service.name} nao respondeu a 3 verificacoes consecutivas de saude. Reiniciando.`);
    service.failedHealthChecks = 0;
    service.restartCount++;

    if (service.process) {
        log(service, 'reiniciando por falha de health check.');
        service.process.kill();
        return;
    }

    service.externalHealthy = false;
    await stopProcessOnPort(service);
    await startService(service);
}

async function startNgrok() {
    if (process.env.START_NGROK === '0') {
        log('ngrok', 'desativado por START_NGROK=0.');
        return null;
    }

    if (!await commandExists('ngrok')) {
        log('ngrok', 'ngrok nao encontrado no PATH. Continuando apenas local em http://127.0.0.1:4000.');
        return null;
    }

    const targetPort = process.env.NGROK_TARGET_PORT || '4000';
    const args = ['http', targetPort, '--log=stdout'];
    const outNgrok = path.join(logsDir, 'ngrok.out.log');
    const errNgrok = path.join(logsDir, 'ngrok.err.log');
    rotateLogIfNeeded(outNgrok);
    rotateLogIfNeeded(errNgrok);
    const out = fs.createWriteStream(outNgrok, { flags: 'a' });
    const err = fs.createWriteStream(errNgrok, { flags: 'a' });

    log('ngrok', `iniciando: ngrok ${args.join(' ')}`);
    ngrokProcess = spawn('ngrok', args, {
        cwd: root,
        shell: false,
        windowsHide: true,
        env: commonEnv
    });

    ngrokProcess.stdout.pipe(out);
    ngrokProcess.stderr.pipe(err);
    ngrokProcess.on('exit', (code, signal) => {
        log('ngrok', `processo encerrou code=${code ?? '-'} signal=${signal ?? '-'}.`);
        ngrokProcess = null;
        ngrokPublicUrl = null;
    });

    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
        try {
            const tunnels = await getJson('http://127.0.0.1:4040/api/tunnels');
            const publicTunnel = (tunnels.tunnels || []).find(t => t.proto === 'https') || (tunnels.tunnels || [])[0];
            if (publicTunnel?.public_url) {
                ngrokPublicUrl = publicTunnel.public_url;
                log('ngrok', `URL publica capturada: ${ngrokPublicUrl}`);
                return ngrokPublicUrl;
            }
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    log('ngrok', 'nao foi possivel capturar URL publica. Verifique logs/ngrok.err.log e se o authtoken esta configurado.');
    return null;
}

function writeRuntime(publicUrl) {
    const payload = {
        generatedAt: new Date().toISOString(),
        localDashboard: 'http://127.0.0.1:4000/dashboard-improved.html',
        publicDashboard: publicUrl ? `${publicUrl}/dashboard-improved.html` : null,
        publicBaseUrl: publicUrl,
        backend: 'http://127.0.0.1:5000',
        bridge: 'http://127.0.0.1:2999',
        ngrokApi: 'http://127.0.0.1:4040/api/tunnels',
        runId: crypto.randomBytes(8).toString('hex')
    };
    fs.writeFileSync(runtimeFile, JSON.stringify(payload, null, 2));
    return payload;
}

function openBrowser(url) {
    if (process.env.OPEN_BROWSER === '0') return;
    const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

async function printStatus(publicUrl) {
    const bridgeOk = await healthCheck('http://127.0.0.1:2999/health', 3500, { 'X-API-KEY': stableSecrets.API_KEY }, runtimeInstanceId);
    const lines = [
        '',
        '====================================================',
        ' NYTHAR - DASHBOARD & CHATBOT LOCAL - SISTEMA EM EXECUCAO',
        '====================================================',
        `Backend:       http://127.0.0.1:5000/health`,
        `Bridge Factory:http://127.0.0.1:2999/health (${bridgeOk ? 'OK' : 'verificar WhatsApp/QR'})`,
        `Bridge Store1: http://127.0.0.1:3001/status`,
        `Bridge Store2: http://127.0.0.1:3002/status`,
        `Dashboard:     http://127.0.0.1:4000/dashboard-improved.html`,
        `Ngrok:         ${publicUrl ? `${publicUrl}/dashboard-improved.html` : 'indisponivel/desativado'}`,
        `Runtime file:  ${runtimeFile}`,
        `Logs:          ${logsDir}`,
        'Credenciais de acesso:',
        `  Usuario admin  : admin`,
        `  Senha admin    : ${commonEnv.DEFAULT_ADMIN_PASSWORD}`,
        `  Superadmin     : ${stableSecrets.SUPERADMIN_USERNAME}`,
        `  Admin loja     : ${commonEnv.DEFAULT_OWNER_USERNAME}`,
        `  Senha loja     : ${commonEnv.DEFAULT_OWNER_PASSWORD}`,
        '====================================================',
        ''
    ];
    console.log(lines.join('\n'));
}

async function updateSpreadsheets(reason) {
    try {
        log('spreadsheets', `atualizando planilhas (${reason}).`);
        const result = await postJson('http://127.0.0.1:5000/api/spreadsheets/update?syncGoogleSheets=true', {});
        if (result.statusCode >= 200 && result.statusCode < 300) {
            log('spreadsheets', `ok: ${JSON.stringify(result.body)}`);
            return true;
        }
        log('spreadsheets', `falhou HTTP ${result.statusCode}: ${JSON.stringify(result.body)}`);
        return false;
    } catch (error) {
        log('spreadsheets', `erro ao atualizar: ${error.message}`);
        return false;
    }
}

async function boot() {
    console.log('Nythar - Dashboard & Chatbot supervisor local iniciado.');
    console.log('Mantendo segredos estaveis para sobreviver a reinicializacoes locais.');

    for (const service of services) {
        await startService(service);
    }

    await updateSpreadsheets('startup-local');

    const publicUrl = await startNgrok();
    const runtime = writeRuntime(publicUrl);
    const browserUrl = process.env.OPEN_PUBLIC_DASHBOARD === '1'
        ? (runtime.publicDashboard || runtime.localDashboard)
        : runtime.localDashboard;
    openBrowser(browserUrl);
    await printStatus(publicUrl);

    setInterval(() => {
        services.forEach(service => monitorService(service));
    }, 10000);
}

async function shutdown(signal) {
    shuttingDown = true;
    console.log(`${signal} recebido. Encerrando supervisor local...`);

    await updateSpreadsheets('shutdown-local');

    if (ngrokProcess) {
        log('ngrok', 'encerrando processo filho.');
        ngrokProcess.kill();
    }

    for (const service of services.slice().reverse()) {
        if (service.process) {
            log(service, 'encerrando processo filho.');
            service.process.kill();
        }
    }

    setTimeout(() => {
        releaseSupervisorLock();
        process.exit(0);
    }, 1500).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', releaseSupervisorLock);

boot().catch(error => {
    console.error('Supervisor falhou:', error);
    process.exit(1);
});

