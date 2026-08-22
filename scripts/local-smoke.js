const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const envLocalPath = path.join(root, '.env.local');

if (fs.existsSync(envLocalPath)) {
    const envLines = fs.readFileSync(envLocalPath, 'utf8').split(/\r?\n/);
    for (const raw of envLines) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx < 1) continue;
        const key = line.substring(0, eqIdx).trim();
        const value = line.substring(eqIdx + 1).trim();
        if (key && value && !process.env[key]) process.env[key] = value;
    }
}

const base = process.env.DASHBOARD_URL || 'http://127.0.0.1:4000';
const username = process.env.SMOKE_USER || process.env.DEFAULT_OWNER_USERNAME || 'admin';
const password = process.env.SMOKE_PASS || process.env.DEFAULT_OWNER_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD;

if (!password) {
    throw new Error('Senha do smoke nao encontrada. Execute node scripts/gerar-segredos.js ou defina SMOKE_PASS.');
}

async function request(path, options = {}) {
    const res = await fetch(`${base}${path}`, options);
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { res, body };
}

async function main() {
    console.log(`Smoke local: ${base}`);

    let out = await request('/health');
    assert.equal(out.res.status, 200, '/health deve responder 200');

    out = await request('/health/deep');
    assert.ok([200, 503].includes(out.res.status), '/health/deep deve responder JSON');
    console.log('/health/deep:', out.body);

    out = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Username: username, Password: password })
    });
    assert.equal(out.res.status, 200, 'login deve responder 200');
    assert.ok(out.body?.token, 'login deve retornar token');

    const headers = { Authorization: `Bearer ${out.body.token}` };
    const protectedPaths = [
        '/api/hoje',
        '/api/agendamentos',
        '/api/semana',
        '/api/stats',
        '/api/settings',
        '/api/barbeiros',
        '/api/bot/status'
    ];

    for (const route of protectedPaths) {
        const result = await request(route, { headers });
        assert.ok(result.res.status < 500, `${route} nao deve retornar 5xx`);
        console.log(`${route}: HTTP ${result.res.status}`);
    }

    console.log('Smoke local concluido.');
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
