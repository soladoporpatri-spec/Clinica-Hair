const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("pagina publica encaminha para a landing page real", () => {
    const page = read("index.html");
    assert.match(page, /Nythar\/landing-page\.html/);
    assert.match(page, /Produtos digitais/i);
});

test("rota de demonstracao abre a dashboard oficial em modo seguro", () => {
    const page = read("demo/index.html");
    assert.match(page, /dashboard-improved\.html\?demo=1/);
});

test("dashboard real carrega adaptador local somente quando demo=1", () => {
    const page = read("dashboard-improved.html");
    const script = read("demo/demo-runtime.js");
    assert.match(page, /demo\/demo-runtime\.js/);
    assert.match(page, /dashboardDemoMode/);
    assert.match(script, /localStorage/);
    assert.match(script, /NytharDemoApi/);
    assert.match(script, /WhatsApp não está conectado/);
    assert.doesNotMatch(script, /api\.whatsapp|wa\.me|127\.0\.0\.1/);
});

test("configuracao do Vercel publica os arquivos estaticos com cabecalhos seguros", () => {
    const config = JSON.parse(read("vercel.json"));
    assert.equal(config.cleanUrls, true);
    assert.equal(config.trailingSlash, true);
    const headers = config.headers.flatMap((entry) => entry.headers.map((header) => header.key));
    assert.ok(headers.includes("X-Content-Type-Options"));
    assert.ok(headers.includes("Permissions-Policy"));
});

