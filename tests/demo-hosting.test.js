const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("pagina publica apresenta o projeto e abre a demonstracao", () => {
    const page = read("index.html");
    assert.match(page, /Projeto de software/i);
    assert.match(page, /href="demo\//);
    assert.match(page, /github\.com\/soladoporpatri-spec\/Nythar-Dashboard-Chatbot/);
});

test("demonstracao avisa que usa dados ficticios e oferece fluxo completo", () => {
    const page = read("demo/index.html");
    assert.match(page, /Modo demonstração/);
    assert.match(page, /nenhuma mensagem real será enviada/i);
    assert.match(page, /data-open-appointment/);
    assert.match(page, /id="chatMessages"/);
    assert.match(page, /id="appointmentsTable"/);
});

test("demo funciona apenas no navegador e nao chama APIs reais", () => {
    const script = read("demo/demo.js");
    assert.match(script, /localStorage/);
    assert.match(script, /confirmChatAppointment/);
    assert.doesNotMatch(script, /fetch\s*\(/);
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

