#!/usr/bin/env node
/**
 * gerar-segredos.js - cria .env.local com segredos unicos por instalacao.
 * Execute UMA VEZ durante a instalacao: node scripts/gerar-segredos.js
 * Se .env.local ja existir, nada e feito; segredos sao preservados.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env.local');
const credentialsFile = path.join(root, 'CREDENCIAIS-ACESSO.txt');
const bootstrapAccountsFile = path.join(root, 'data', 'bootstrap-accounts.json');

function randomHex(bytes) {
    return crypto.randomBytes(bytes).toString('hex');
}

function randomBase64url(bytes) {
    return crypto.randomBytes(bytes).toString('base64url');
}

function randomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    const rand = crypto.randomBytes(12);
    for (const byte of rand) {
        pwd += chars[byte % chars.length];
    }
    return `Adm${pwd}@`;
}

function readEnvFile(file) {
    const values = {};
    if (!fs.existsSync(file)) return values;

    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx < 1) continue;
        values[line.substring(0, eqIdx).trim()] = line.substring(eqIdx + 1).trim();
    }
    return values;
}

function readBootstrapAccounts() {
    if (!fs.existsSync(bootstrapAccountsFile)) return {};
    try {
        return JSON.parse(fs.readFileSync(bootstrapAccountsFile, 'utf8')) || {};
    } catch {
        console.warn('[gerar-segredos] Arquivo de contas iniciais invalido; usando credenciais aleatorias.');
        return {};
    }
}

function buildContent(secrets) {
    return [
        '# Segredos unicos gerados na instalacao - NAO compartilhe este arquivo',
        `# Gerado/atualizado em: ${new Date().toISOString()}`,
        '# Para regenerar tudo: apague este arquivo manualmente e execute: node scripts/gerar-segredos.js',
        '',
        `API_KEY=${secrets.API_KEY}`,
        `Jwt__Secret=${secrets.JWT_SECRET}`,
        `JWT_SECRET=${secrets.JWT_SECRET}`,
        `DEFAULT_ADMIN_PASSWORD=${secrets.DEFAULT_ADMIN_PASSWORD}`,
        `SUPERADMIN_USERNAME=${secrets.SUPERADMIN_USERNAME}`,
        `SUPERADMIN_PASSWORD=${secrets.SUPERADMIN_PASSWORD}`,
        `DEFAULT_OWNER_USERNAME=${secrets.DEFAULT_OWNER_USERNAME}`,
        `DEFAULT_OWNER_PASSWORD=${secrets.DEFAULT_OWNER_PASSWORD}`,
        `DEFAULT_STORE_NAME=${secrets.DEFAULT_STORE_NAME}`,
        `DEFAULT_STORE_SLUG=${secrets.DEFAULT_STORE_SLUG}`,
        `DEFAULT_BUSINESS_TYPE=${secrets.DEFAULT_BUSINESS_TYPE}`,
        ''
    ].join('\r\n');
}

function buildCredentialsText(secrets) {
    return [
        `${secrets.DEFAULT_STORE_NAME.toUpperCase()} - CREDENCIAIS DE ACESSO`,
        `Atualizado em: ${new Date().toLocaleString('pt-BR')}`,
        '',
        'Painel local:',
        'http://127.0.0.1:4000/dashboard-improved.html',
        '',
        'Admin da loja:',
        `Usuario: ${secrets.DEFAULT_OWNER_USERNAME}`,
        `Senha: ${secrets.DEFAULT_OWNER_PASSWORD}`,
        '',
        'Admin tecnico:',
        'Usuario: admin',
        `Senha: ${secrets.DEFAULT_ADMIN_PASSWORD}`,
        '',
        'Superadmin:',
        `Usuario: ${secrets.SUPERADMIN_USERNAME}`,
        `Senha: ${secrets.SUPERADMIN_PASSWORD}`,
        '',
        'Observacao:',
        'Estas sao as credenciais ativas desta pasta instalada.',
        'Se o login falhar, pare o sistema, inicie novamente e use estes dados.',
        ''
    ].join('\r\n');
}

function normalizeSecrets(existing, bootstrap) {
    const jwt = existing.JWT_SECRET || existing.Jwt__Secret || randomBase64url(48);
    const superadmin = bootstrap.superadmin || {};
    const storeAdmin = bootstrap.storeAdmin || {};
    const store = bootstrap.store || {};
    return {
        API_KEY: existing.API_KEY || `ch_${randomHex(24)}`,
        JWT_SECRET: jwt,
        DEFAULT_ADMIN_PASSWORD: existing.DEFAULT_ADMIN_PASSWORD || randomPassword(),
        SUPERADMIN_USERNAME: existing.SUPERADMIN_USERNAME || superadmin.username || 'superadmin',
        SUPERADMIN_PASSWORD: existing.SUPERADMIN_PASSWORD || superadmin.password || randomPassword(),
        DEFAULT_OWNER_USERNAME: existing.DEFAULT_OWNER_USERNAME || storeAdmin.username || 'dono',
        DEFAULT_OWNER_PASSWORD: existing.DEFAULT_OWNER_PASSWORD || storeAdmin.password || randomPassword(),
        DEFAULT_STORE_NAME: existing.DEFAULT_STORE_NAME || store.name || 'Minha loja',
        DEFAULT_STORE_SLUG: existing.DEFAULT_STORE_SLUG || store.slug || 'minha-loja',
        DEFAULT_BUSINESS_TYPE: existing.DEFAULT_BUSINESS_TYPE || store.businessType || 'Barbershop'
    };
}

function printCredentials(secrets) {
    console.log('[gerar-segredos] Credenciais ativas desta instalacao:');
    console.log(`[gerar-segredos] Admin    : admin / ${secrets.DEFAULT_ADMIN_PASSWORD}`);
    console.log(`[gerar-segredos] Loja     : ${secrets.DEFAULT_OWNER_USERNAME} / ${secrets.DEFAULT_OWNER_PASSWORD}`);
    console.log(`[gerar-segredos] Super    : ${secrets.SUPERADMIN_USERNAME} / ${secrets.SUPERADMIN_PASSWORD}`);
    console.log(`[gerar-segredos] Arquivo  : ${credentialsFile}`);
}

try {
    fs.mkdirSync(root, { recursive: true });
    const existed = fs.existsSync(envFile);
    const secrets = normalizeSecrets(readEnvFile(envFile), readBootstrapAccounts());

    fs.writeFileSync(envFile, buildContent(secrets), { encoding: 'utf8', mode: 0o600 });
    fs.writeFileSync(credentialsFile, buildCredentialsText(secrets), { encoding: 'utf8', mode: 0o600 });
    // Credenciais de provisionamento são usadas uma única vez e nunca devem
    // permanecer no disco depois que .env.local foi criado.
    if (!existed && fs.existsSync(bootstrapAccountsFile)) fs.rmSync(bootstrapAccountsFile, { force: true });

    if (existed) {
        console.log('[gerar-segredos] .env.local ja existia; credenciais preservadas e reexibidas.');
    } else {
        console.log('[gerar-segredos] .env.local criado com segredos unicos para esta instalacao.');
    }
    console.log(`[gerar-segredos] API_KEY  : ${secrets.API_KEY.substring(0, 10)}...`);
    console.log(`[gerar-segredos] JWT      : ${secrets.JWT_SECRET.substring(0, 10)}...`);
    printCredentials(secrets);
    console.log('[gerar-segredos] Guarde estas senhas; elas serao necessarias no primeiro acesso.');
} catch (err) {
    console.error('[gerar-segredos] ERRO ao criar .env.local:', err.message);
    process.exit(1);
}
