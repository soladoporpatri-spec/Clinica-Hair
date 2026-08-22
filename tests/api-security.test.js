const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(file) {
    return fs.readFileSync(path.join(root, file), 'utf8');
}

test('proxy nao publica a raiz inteira do projeto', () => {
    const api = read('api-nythar.js');
    assert.equal(api.includes("express.static('.')"), false);
    assert.match(api, /publicFiles/);
});

test('tokens de sessao do proxy usam crypto', () => {
    const api = read('api-nythar.js');
    assert.match(api, /crypto\.randomBytes/);
    assert.equal(api.includes('Math.random().toString(36)'), false);
});

test('dashboard persiste sessoes locais apos reinicio do servico', () => {
    const api = read('api-nythar.js');
    assert.match(api, /dashboard-sessions\.json/);
    assert.match(api, /function loadSessionsFromDisk/);
    assert.match(api, /function saveSessionsToDisk/);
    assert.match(api, /SESSION_TTL_MS/);
});

test('health profundo diferencia bridge acessivel de WhatsApp conectado', () => {
    const api = read('api-nythar.js');
    assert.match(api, /whatsappConnected/);
    assert.match(api, /bridge\.reachable/);
    assert.match(api, /state: data\.connectionState/);
    assert.match(api, /available = backendOk && bridge\.reachable/);
    assert.match(api, /ready = available && bridge\.whatsappConnected/);
});

test('recuperacao do WhatsApp preserva sessao e possui fallback isolado por loja', () => {
    const api = read('api-nythar.js');
    const bridge = read('WhatsAppBridge/index.js');
    const dashboard = read('script-dashboard.js');

    assert.match(bridge, /app\.post\('\/reconnect'/);
    assert.match(bridge, /preserveSession: true/);
    assert.match(api, /app\.post\('\/api\/bot\/reconnect'/);
    assert.match(api, /factoryFetch\(`\/bridge\/\$\{storeId\}\/restart`/);
    assert.match(dashboard, /function reconnectBot/);
});

test('factory evita bridges duplicadas, informa contagem real e encerra lojas inativas', () => {
    const factory = read('WhatsAppBridge/bridge-factory.js');

    assert.match(factory, /this\.startPromise/);
    assert.match(factory, /instances: factory\.instances\.size/);
    assert.match(factory, /Promise\.all\(\[\.\.\.this\.instances\.entries\(\)\]/);
    assert.match(factory, /activeStoreIds/);
    assert.match(factory, /await factory\.stop\(storeId\)/);
    assert.match(factory, /BRIDGE_STORE_SYNC_MS/);
});

test('supervisor nao assume servicos de outra instalacao nas mesmas portas', () => {
    const supervisor = read('scripts/supervisor.js');
    const api = read('api-nythar.js');
    const factory = read('WhatsAppBridge/bridge-factory.js');

    assert.match(supervisor, /RUNTIME_INSTANCE_ID/);
    assert.match(supervisor, /processo externo preservado/);
    assert.match(api, /instanceId: process\.env\.RUNTIME_INSTANCE_ID/);
    assert.match(factory, /instanceId: process\.env\.RUNTIME_INSTANCE_ID/);
});

test('bridge evita bloqueio de sessao no OneDrive e encerra somente seu Chromium orfao', () => {
    const bridge = read('WhatsAppBridge/index.js');

    assert.match(bridge, /isOneDriveInstall/);
    assert.match(bridge, /LOCALAPPDATA/);
    assert.match(bridge, /WhatsAppSessions/);
    assert.match(bridge, /function destroyClientSafely/);
    assert.match(bridge, /taskkill\.exe/);
    assert.match(bridge, /maxRetries: 5/);
});

test('supervisor usa trava exclusiva para impedir factories e Chromiums duplicados', () => {
    const supervisor = read('scripts/supervisor.js');

    assert.match(supervisor, /supervisor\.lock/);
    assert.match(supervisor, /fs\.openSync\(supervisorLockFile, 'wx'\)/);
    assert.match(supervisor, /Nenhum processo duplicado foi iniciado/);
    assert.match(supervisor, /process\.on\('exit', releaseSupervisorLock\)/);
});

test('supervisor persiste identidade da instalacao para manter a sessao apos mover ou reiniciar', () => {
    const supervisor = read('scripts/supervisor.js');

    assert.match(supervisor, /installation-id/);
    assert.match(supervisor, /function loadOrCreateInstallationId/);
    assert.match(supervisor, /fs\.readFileSync\(installationIdFile/);
    assert.match(supervisor, /fs\.writeFileSync\(installationIdFile, legacyInstallationId/);
    assert.match(supervisor, /const runtimeInstanceId = loadOrCreateInstallationId\(\)/);
});

test('parada local encerra supervisor antes das portas e limpa Chromium exclusivo da bridge', () => {
    const batch = read('PARAR-SISTEMA-LOCAL.bat');
    const stopScript = read('scripts/stop-local.ps1');
    const release = read('scripts/build-release-cliente.ps1');

    assert.match(batch, /scripts\\stop-local\.ps1/);
    assert.match(stopScript, /scripts\[\\\\\/\]supervisor\\\.js/);
    assert.match(stopScript, /\.wwebjs_auth_/);
    assert.match(stopScript, /WhatsAppSessions/);
    assert.match(stopScript, /2999/);
    assert.match(stopScript, /3001\.\.3010/);
    assert.match(release, /stop-local\.ps1/);
});

test('status do bot degrada para offline sem devolver 5xx quando bridge cai', () => {
    const api = read('api-nythar.js');
    const routeStart = api.indexOf("app.get('/api/bot/status'");
    const routeEnd = api.indexOf("// Rota para simular mensagem recebida", routeStart);
    const route = api.slice(routeStart, routeEnd);

    assert.match(route, /status: 'offline'/);
    assert.match(route, /whatsappConnected: false/);
    assert.equal(route.includes('res.status(503)'), false);
});

test('segredos padrao conhecidos nao permanecem configurados', () => {
    const legacyApiKey = ['clinica', 'hair-secret-2024'].join('');
    const files = [
        'api-nythar.js',
        'WhatsAppBridge/index.js',
        'WhatsAppBot.Worker/appsettings.json',
        'WhatsAppBot.Worker/Program.cs'
    ];

    for (const file of files) {
        const content = read(file);
        assert.equal(content.includes(legacyApiKey), false, `${file} contem API key padrao`);
        assert.equal(content.includes('superadmin123'), false, `${file} contem superadmin hardcoded`);
        assert.equal(content.includes('barbeiro123'), false, `${file} contem senha padrao`);
        assert.equal(content.includes('recepcao123'), false, `${file} contem senha padrao`);
    }
});

test('artefatos de release nao carregam credenciais conhecidas', () => {
    const files = [
        'scripts/supervisor.js',
        'scripts/local-smoke.js',
        'STATUS-SISTEMA-LOCAL.bat',
        'WhatsAppBridge/start-bridge.bat',
        'WhatsAppBridge/start-factory.bat',
        'docs/INSTALACAO-CLIENTE-LOCAL.md',
        'docs/GUIA-USO-LOCAL-NOTEBOOK.md'
    ];
    const forbidden = [
        ['clinica', 'hair-secret-2024'].join(''),
        'legacy_master_key_do_not_use',
        'legacy_local_jwt_secret_do_not_use',
        'superadmin123',
        'dono123',
        'profissional123',
        'admin123local',
        'Lavajato@2026!'
    ];

    for (const file of files) {
        const content = read(file);
        for (const secret of forbidden) {
            assert.equal(content.includes(secret), false, `${file} contem credencial conhecida`);
        }
    }
});

test('backend exige segredo JWT e API key por configuracao externa', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const endpointAuth = read('WhatsAppBot.Worker/Endpoints/EndpointAuth.cs');
    const saasEndpoints = read('WhatsAppBot.Worker/Endpoints/SaasEndpoints.cs');
    assert.match(program, /ApiKey\/API_KEY ausente/);
    assert.match(program, /change-in-production/);
    assert.match(endpointAuth, /IsLoopback/);
});

test('startup cria usuarios padrao sem sobrescrever senhas alteradas no painel', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    assert.match(program, /Credenciais DEFAULT_\* servem somente para criar contas ausentes/);
    assert.equal(program.includes('adminUser.PasswordHash = auth.HashPassword(defaultAdminPassword)'), false);
    assert.equal(program.includes('superUser.PasswordHash = auth.HashPassword(superadminPassword)'), false);
    assert.equal(program.includes('ownerUser.PasswordHash = auth.HashPassword(defaultOwnerPassword)'), false);
    assert.equal(program.includes('staffUser.PasswordHash = auth.HashPassword(configuredStaffPassword)'), false);
    assert.equal(program.includes('Senha do Superadmin'), false);
});

test('atualizador GitHub preserva estado operacional e o pacote cliente o inclui', () => {
    const updater = read('ATUALIZAR-SISTEMA.bat');
    const checkScript = read('scripts/check-github-update.ps1');
    const updateScript = read('scripts/update-system.ps1');
    const release = read('scripts/build-release.ps1');
    assert.match(updater, /update-system\.ps1/);
    assert.match(checkScript, /releases\/latest/);
    assert.match(updateScript, /\[switch\]\$Check/);
    assert.match(updateScript, /\.env\.local/);
    assert.match(updateScript, /runtime\\backend\\agendamentos\.db/);
    assert.match(updateScript, /\.wwebjs_auth\*/);
    assert.match(updateScript, /version\.txt/);
    assert.match(release, /"ATUALIZAR-SISTEMA\.bat"/);
    assert.match(release, /"version\.txt"/);
    assert.match(release, /config\\updater\.cfg/);
    assert.match(release, /"update-system\.ps1"/);
});

test('bridge usa ack para nao apagar mensagens antes do processamento', () => {
    const bridge = read('WhatsAppBridge/index.js');
    assert.match(bridge, /app\.post\('\/messages\/ack'/);
    assert.match(bridge, /deliveredAt/);
    const messagesRoute = bridge.slice(bridge.indexOf("app.get('/messages'"), bridge.indexOf("app.post('/messages/ack'"));
    assert.equal(messagesRoute.includes('messageQueue.length = 0'), false);
});

test('bridge guarda somente a ultima mensagem por cliente quando bot esta pausado', () => {
    const bridge = read('WhatsAppBridge/index.js');
    // Em modo multi-loja o arquivo inclui o STORE_ID no nome (whatsapp-paused-pending-<id>.json).
    assert.match(bridge, /whatsapp-paused-pending.*\.json/);
    assert.match(bridge, /function storePausedPending/);
    assert.match(bridge, /pausedPending\.set\(key, pending\)/);
    assert.match(bridge, /function flushPausedPending/);
    assert.match(bridge, /flushedPausedPending/);
    assert.match(bridge, /app\.get\('\/messages\/pending'/);
});

test('bridge aplica anti-spam, dedupe e limpeza de cache de polls', () => {
    const bridge = read('WhatsAppBridge/index.js');
    assert.match(bridge, /incomingDedupe/);
    assert.match(bridge, /incomingRate/);
    assert.match(bridge, /function isDuplicateIncoming/);
    assert.match(bridge, /function isRateLimitedIncoming/);
    assert.match(bridge, /function pruneRuntimeCaches/);
    assert.match(bridge, /queueMaxSize/);
    assert.match(bridge, /pollCacheTtlMs/);
    assert.match(bridge, /pollRequestCache/);
    assert.match(bridge, /cachedRequest\.promise/);
    assert.match(bridge, /waitUntilMsgSent: true/);
    assert.match(bridge, /unresolvedPollsByChat/);
    assert.match(bridge, /recoverSentPollMessage/);
    assert.match(bridge, /function serializeMessageKey/);
    assert.match(bridge, /key\.fromMe \? 'true' : 'false'/);
    assert.match(bridge, /function savePollState/);
    assert.match(bridge, /function loadPollState/);
    assert.match(bridge, /whatsapp-polls-\$\{STORE_ID_RESOLVED\}\.json/);
    assert.match(bridge, /client\.getChatById\(jid\)/);
    assert.match(bridge, /chat\.fetchMessages\(\{ limit: 8, fromMe: true \}\)/);
    assert.match(bridge, /remoteUser === expectedUser/);
    assert.match(bridge, /function getPollVotesById/);
    assert.match(bridge, /WAWebPollsVotesSchema/);
    assert.match(bridge, /getPollVotesById\(pollId\)/);
    assert.match(bridge, /typeof table\.getModelsArray === 'function'/);
    assert.match(bridge, /Consulta global de votos indisponivel/);
    assert.match(bridge, /serializeMessageKey\(recoveredMessage\?\.id\)/);
    assert.equal(bridge.includes('message.id._serialized'), false);
});

test('chatbot separa saudacao do menu e aceita fallback textual de enquete', () => {
    const idle = read('WhatsAppBot.Worker/Services/IdleState.cs');
    const seeder = read('WhatsAppBot.Worker/Startup/DefaultAutomationSeeder.cs');
    const client = read('WhatsAppBot.Worker/Services/WhatsAppClient.cs');
    const stateBase = read('WhatsAppBot.Worker/Services/ConversationStateBase.cs');

    assert.match(idle, /ExtractGreetingOnly/);
    assert.equal(/\["Msg_Welcome"\].*Escolha uma opcao/.test(seeder), false);
    assert.match(client, /requestId = Guid\.NewGuid/);
    assert.match(client, /requestId,/);
    assert.match(stateBase, /session\.LastPollId = menuPoll\?\.Id/);
    assert.equal(stateBase.includes('if (menuPoll != null) session.LastPollId'), false);
});

test('deploy linux usa bridge-factory e portas por loja', () => {
    const service = read('deploy/systemd/barbearia-bridge.service');
    const healthcheck = read('deploy/scripts/healthcheck.sh');
    const env = read('deploy/.env.example');
    const oracleIp = read('deploy/ORACLE_FREE_TIER_IP_DEPLOY.md');
    const oracleDomain = read('deploy/ORACLE_ARM64.md');

    assert.match(service, /bridge-factory\.js/);
    assert.equal(service.includes('/WhatsAppBridge/index.js'), false);
    assert.match(healthcheck, /FACTORY_HEALTH_URL/);
    assert.match(healthcheck, /2999/);
    assert.match(healthcheck, /3001/);
    assert.match(env, /FACTORY_PORT=2999/);
    assert.match(env, /BRIDGE_BASE_PORT=3000/);
    assert.match(env, /BRIDGE_URL=http:\/\/127\.0\.0\.1:3001/);
    assert.match(oracleIp, /bridge factory :2999/);
    assert.match(oracleIp, /WhatsApp loja 1 :3001/);
    assert.match(oracleDomain, /Bridge factory: `127\.0\.0\.1:2999`/);
    assert.match(oracleDomain, /WhatsApp loja 1: `127\.0\.0\.1:3001`/);
});

test('pix operacional gera cobranca no backend e painel usa endpoint autenticado', () => {
    const pix = read('WhatsAppBot.Worker/Services/PixService.cs');
    const pixEndpoints = read('WhatsAppBot.Worker/Endpoints/PixEndpoints.cs');
    const subs = read('WhatsAppBot.Worker/Services/SubscriptionService.cs');
    const api = read('api-nythar.js');
    const dashboard = read('script-dashboard.js');
    const model = read('WhatsAppBot.Worker/Models/ClientSubscription.cs');

    assert.match(pix, /br\.gov\.bcb\.pix/);
    assert.match(pix, /Crc16Ccitt/);
    assert.match(pix, /CreateSubscriptionChargeAsync/);
    assert.match(pixEndpoints, /\/api\/pix\/subscription\/\{id:int\}/);
    assert.match(pixEndpoints, /EndpointAuth\.IsAuthenticated/);
    assert.match(api, /\/api\/pix\/subscription\/:id/);
    assert.match(dashboard, /openSubscriptionPixModal/);
    assert.match(dashboard, /subscriptionPixPayload/);
    assert.match(subs, /PaymentConfirmedAt/);
    assert.match(model, /PixPayload/);
    assert.match(model, /PaymentReference/);
});

test('documentacao oracle usa cota always free atual e nao promete 4 ocpu', () => {
    const oracleIp = read('deploy/ORACLE_FREE_TIER_IP_DEPLOY.md');
    const oracleDomain = read('deploy/ORACLE_ARM64.md');
    const combined = `${oracleIp}\n${oracleDomain}`;

    assert.match(combined, /2 OCPUs/);
    assert.match(combined, /12 GB/);
    assert.match(combined, /200 GB/);
    assert.match(combined, /ociosas podem ser reclamadas/);
    assert.equal(combined.includes('4 OCPUs'), false);
    assert.equal(combined.includes('24 GB'), false);
});

test('operacao de producao documenta backup offsite restore e hardening', () => {
    const backup = read('deploy/scripts/backup-sqlite.sh');
    const offsite = read('deploy/scripts/backup-offsite.sh');
    const restore = read('deploy/scripts/restore-test-sqlite.sh');
    const nginx = read('deploy/nginx-barbearia.conf');
    const install = read('deploy/scripts/install-systemd-nginx.sh');

    assert.match(backup, /OFFSITE_BACKUP_TARGET/);
    assert.match(offsite, /OFFSITE_BACKUP_METHOD/);
    assert.match(offsite, /rsync/);
    assert.match(offsite, /rclone/);
    assert.match(restore, /PRAGMA integrity_check/);
    assert.match(nginx, /limit_req_zone/);
    assert.match(nginx, /X-Frame-Options/);
    assert.match(nginx, /X-Content-Type-Options/);
    assert.match(install, /journald\.conf\.d/);
    assert.match(install, /logrotate\.d/);
    assert.match(install, /fail2ban/);
    assert.match(install, /ufw --force enable/);
});

test('bridge recupera sessao invalida sem concorrencia e preserva sessao em falha transitoria', () => {
    const bridge = read('WhatsAppBridge/index.js');
    assert.match(bridge, /function requestSessionReset/);
    assert.match(bridge, /auth_failure[\s\S]*requestSessionReset/);
    assert.match(bridge, /shouldClearSessionOnDisconnect/);
    assert.match(bridge, /scheduleInitWatchdog/);
    assert.match(bridge, /cleanupAndRestart\(true, \{ force: true \}\)/);
    assert.match(bridge, /authFailureClearThreshold/);
    assert.match(bridge, /WHATSAPP_AUTH_FAILURE_CLEAR_THRESHOLD \|\| 3/);
    assert.match(bridge, /authFailureCount < authFailureClearThreshold/);
    assert.match(bridge, /cleanupAndRestart\(false, \{ force: true \}\)/);
    assert.match(bridge, /normalized === 'LOGOUT'/);
    assert.match(bridge, /normalized\.startsWith\('UNPAIRED'\)/);
    assert.match(bridge, /confirmed: true/);
    assert.match(bridge, /newClient\.on\('qr',[\s\S]*clearSessionResetTimer\(\)/);
    assert.doesNotMatch(bridge, /logout\|unpaired\|unlaunched\|invalid\|auth\|not authorized\|401/);
    assert.match(bridge, /if \(restartPromise\) return restartPromise/);
    assert.match(bridge, /queuedSessionClear/);
    assert.match(bridge, /Reciclando o cliente sem apagar a sessao/);
});

test('pacote oferece reparo nao destrutivo e inicio automatico apos logon do Windows', () => {
    const installer = read('INSTALAR-CLIENTE.bat');
    const repair = read('REPARAR-WHATSAPP.bat');
    const autostart = read('scripts/install-autostart.ps1');
    const release = read('scripts/build-release-cliente.ps1');

    assert.match(installer, /Nythar - Dashboard \^& Chatbot - Reparar WhatsApp\.lnk/);
    assert.match(installer, /install-autostart\.ps1/);
    assert.match(repair, /preserva o QR, as credenciais e os dados/);
    assert.match(repair, /stop-local\.ps1/);
    assert.match(repair, /INICIAR-SISTEMA-LOCAL\.bat/);
    assert.doesNotMatch(repair, /\.wwebjs_auth|WhatsAppSessions|Remove-Item|rmdir|del \/[sq]/i);
    assert.match(autostart, /INICIAR-AUTOMATICO\.bat/);
    assert.match(autostart, /GetFolderPath\("Startup"\)/);
    assert.match(release, /REPARAR-WHATSAPP\.bat/);
    assert.match(release, /INICIAR-AUTOMATICO\.bat/);
    assert.match(release, /install-autostart\.ps1/);
});

test('dashboard le agendamentos futuros retornados em data', () => {
    const dashboard = read('script-dashboard.js');
    assert.match(dashboard, /Array\.isArray\(agendRes\?\.data\)/);
    assert.match(dashboard, /futureData/);
});

test('dashboard usa notificacoes em long polling atras do proxy local', () => {
    const dashboard = read('script-dashboard.js');
    const html = read('dashboard-improved.html');
    const sw = read('sw.js');
    const api = read('api-nythar.js');
    assert.match(dashboard, /HttpTransportType\.LongPolling/);
    assert.match(dashboard, /setRealtimeStatusUI/);
    assert.match(dashboard, /ConfirmedAppointment/);
    assert.match(dashboard, /RescheduledAppointment/);
    assert.match(dashboard, /renderNotificationCenter/);
    assert.match(html, /status-realtime/);
    assert.match(html, /\/assets\/signalr\.min\.js\?v=\d+/);
    assert.match(sw, /\/assets\/signalr\.min\.js/);
    assert.match(api, /function proxySignalRRequest/);
    assert.match(api, /upstreamRes\.pipe\(res\)/);
});

test('bot ignora voto antigo quando conversa ja esta finalizada', () => {
    const manager = read('WhatsAppBot.Worker/Services/ConversationStateManager.cs');
    const confirmation = read('WhatsAppBot.Worker/Services/ConfirmingAppointmentState.cs');
    assert.match(manager, /session\.State == ConversationState\.Idle && !string\.IsNullOrWhiteSpace\(pollId\)/);
    assert.match(confirmation, /session\.LastPollId = null/);
});

test('confirmacao final nao reutiliza template de pergunta nem duplica o rotulo de servico', () => {
    const confirmation = read('WhatsAppBot.Worker/Services/ConfirmingAppointmentState.cs');
    const conversationBase = read('WhatsAppBot.Worker/Services/ConversationStateBase.cs');
    const labels = read('WhatsAppBot.Worker/Models/BusinessLabels.cs');
    const defaults = read('WhatsAppBot.Worker/Startup/DefaultAutomationSeeder.cs');

    assert.equal(confirmation.includes('Settings.GetString("Msg_Confirmation")'), false);
    assert.match(confirmation, /\*Agendamento confirmado!\*/);
    assert.match(conversationBase, /\{serviceEmoji\} Serviço: \{service\}/);
    assert.match(labels, /ServiceEmoji:\s+"✂️"/);
    assert.match(defaults, /%\{\{preco\}\}%/);
});

test('backend ignora webhook duplicado pelo id da mensagem', () => {
    const manager = read('WhatsAppBot.Worker/Services/ConversationStateManager.cs');
    const webhook = read('WhatsAppBot.Worker/Endpoints/WebhookEndpoints.cs');
    const worker = read('WhatsAppBot.Worker/Worker.cs');
    assert.match(manager, /ProcessedMessageIds/);
    assert.match(manager, /IsDuplicateMessage/);
    assert.match(webhook, /msg\.Id/);
    assert.match(worker, /HandleAsync\(msg\.Phone, msg\.Text, msg\.PollId, msg\.Id/);
});

test('backend tambem ignora duplicidade de webhook sem id confiavel', () => {
    const manager = read('WhatsAppBot.Worker/Services/ConversationStateManager.cs');
    const webhook = read('WhatsAppBot.Worker/Endpoints/WebhookEndpoints.cs');
    const client = read('WhatsAppBot.Worker/Services/WhatsAppClient.cs');

    assert.match(manager, /ProcessedMessageFingerprints/);
    assert.match(manager, /BuildFingerprint/);
    assert.match(manager, /FingerprintTtl = TimeSpan\.FromSeconds\(8\)/);
    // A mensagem de log foi atualizada quando o fingerprint passou a ser restrito a votos de enquete.
    assert.match(manager, /Voto de enquete duplicado ignorado/);
    assert.match(webhook, /Source: \{Source\}/);
    assert.match(client, /string\? Source = null/);
});

test('pausa do profissional e aplicada mesmo usando expediente global', () => {
    const agenda = read('WhatsAppBot.Worker/Services/AgendaService.cs');
    const session = read('WhatsAppBot.Worker/Models/ConversationSession.cs');

    // O almoço deixou de ser configurável por profissional e passou a ser uma constante universal
    // (UniversalLunchStart / UniversalLunchEnd), aplicada globalmente a todos os barbeiros.
    assert.match(agenda, /UniversalLunchStart/);
    assert.match(agenda, /UniversalLunchEnd/);
    assert.match(agenda, /OverlapsLunch/);
    assert.equal(/\[NotMapped\]\s*public int InvalidResponseCount/.test(session), false);
});

test('limpeza segura preserva dados essenciais', () => {
    const api = read('api-nythar.js');
    const program = read('WhatsAppBot.Worker/Program.cs');
    const saasEndpoints = read('WhatsAppBot.Worker/Endpoints/SaasEndpoints.cs');
    const dashboard = read('script-dashboard.js');
    const html = read('dashboard-improved.html');

    assert.match(api, /\/api\/maintenance\/safe-cleanup/);
    assert.match(api, /messages\/pending\/clear/);
    assert.match(program, /MapSaasEndpoints/);
    assert.match(saasEndpoints, /\/api\/maintenance\/safe-cleanup/);
    assert.match(saasEndpoints, /MemoryCache/);
    assert.match(dashboard, /function runSafeCleanup/);
    assert.match(dashboard, /Nao sera apagado/);
    assert.match(html, /safeCleanupBtn/);
});

test('base modular SaaS expoe catalogo de modulos sem quebrar dashboard atual', () => {
    const catalog = read('WhatsAppBot.Worker/Services/Modules/ModuleCatalog.cs');
    const access = read('WhatsAppBot.Worker/Services/Modules/FeatureAccessService.cs');
    const program = read('WhatsAppBot.Worker/Program.cs');
    const saasEndpoints = read('WhatsAppBot.Worker/Endpoints/SaasEndpoints.cs');
    const api = read('api-nythar.js');
    const dashboard = read('script-dashboard.js');

    assert.match(catalog, /whatsapp_bot/);
    assert.match(catalog, /google_sheets/);
    assert.match(catalog, /meta_whatsapp_api/);
    assert.match(access, /Module_.*_Enabled/);
    assert.match(program, /MapSaasEndpoints/);
    assert.match(saasEndpoints, /\/api\/modules/);
    assert.match(api, /\/api\/modules/);
    assert.match(dashboard, /loadModuleAccess/);
    assert.match(dashboard, /applyModuleVisibility/);
});

test('diagnostico pagamentos SaaS e modulos por loja ficam protegidos por tenant e superadmin', () => {
    const db = read('WhatsAppBot.Worker/Data/AppDbContext.cs');
    const saasEndpoints = read('WhatsAppBot.Worker/Endpoints/SaasEndpoints.cs');
    const superadmin = read('WhatsAppBot.Worker/Endpoints/SuperAdminEndpoints.cs');
    const featureAccess = read('WhatsAppBot.Worker/Services/Modules/FeatureAccessService.cs');
    const proxy = read('api-nythar.js');
    const dashboard = read('script-dashboard.js');
    const superadminUi = read('superadmin/index.html');

    assert.match(db, /DbSet<StorePaymentRecord>/);
    assert.match(db, /HasQueryFilter\(p => TenantId == 0 \|\| p\.StoreId == TenantId\)/);
    assert.match(saasEndpoints, /\/api\/diagnostics/);
    assert.match(saasEndpoints, /StoreAccessPolicy\.Evaluate/);
    assert.match(saasEndpoints, /FeatureAccessService/);
    assert.match(superadmin, /\/api\/superadmin\/stores\/\{id\}\/payments/);
    assert.match(superadmin, /\/api\/superadmin\/stores\/\{id\}\/modules\/\{moduleKey\}/);
    assert.match(superadmin, /StorePaymentRecords/);
    assert.match(superadmin, /MARK_STORE_SUBSCRIPTION_PAID/);
    assert.match(featureAccess, /Store_\{storeId\}_Module_/);
    assert.match(proxy, /\/api\/diagnostics/);
    assert.match(proxy, /\/api\/superadmin\/stores\/:id\/payments/);
    assert.match(proxy, /\/api\/superadmin\/stores\/:id\/modules\/:moduleKey/);
    assert.match(dashboard, /loadDiagnostics/);
    assert.match(superadminUi, /toggleStoreModule/);
    assert.match(superadminUi, /payHistory/);
});

test('supervisor nao usa backend publicado obsoleto sem conferir fonte', () => {
    const supervisor = read('scripts/supervisor.js');

    assert.match(supervisor, /newestMtimeMs/);
    assert.match(supervisor, /backendSourceMtime/);
    assert.match(supervisor, /backendDllMtime >= backendSourceMtime/);
    assert.match(supervisor, /runtime\/backend esta desatualizado/);
    assert.match(supervisor, /backendSourceDir/);
});

test('notificacoes estao separadas entre servico hub e modelos', () => {
    const service = read('WhatsAppBot.Worker/Services/NotificationService-Improved.cs');
    const hub = read('WhatsAppBot.Worker/Services/Notifications/NotificationHub.cs');
    const models = read('WhatsAppBot.Worker/Services/Notifications/NotificationModels.cs');

    assert.match(service, /class NotificationService/);
    assert.equal(/class NotificationHub/.test(service), false);
    assert.equal(/enum NotificationType/.test(service), false);
    assert.match(hub, /class NotificationHub/);
    assert.match(models, /enum NotificationType/);
    assert.match(models, /class NotificationMessage/);
});

test('endpoints de planilhas foram extraidos do Program', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const endpoints = read('WhatsAppBot.Worker/Endpoints/SpreadsheetEndpoints.cs');
    const auth = read('WhatsAppBot.Worker/Endpoints/EndpointAuth.cs');

    assert.match(program, /MapSpreadsheetEndpoints/);
    assert.equal(/app\.MapPost\(\"\/api\/google-sheets\/sync\"/.test(program), false);
    assert.match(endpoints, /\/api\/google-sheets\/sync/);
    assert.match(endpoints, /\/api\/spreadsheets\/update/);
    assert.match(endpoints, /\/api\/export/);
    assert.match(auth, /IsAuthenticated/);
});

test('planilhas respeitam tenant da loja e nao usam Store 1 fixa', () => {
    const service = read('WhatsAppBot.Worker/Services/SpreadsheetMaintenanceService.cs');
    const endpoints = read('WhatsAppBot.Worker/Endpoints/SpreadsheetEndpoints.cs');
    const worker = read('WhatsAppBot.Worker/Worker.cs');

    assert.equal(service.includes('SetTenantId(1)'), false);
    assert.match(service, /UpdateAsync\(int storeId/);
    assert.match(service, /GetExportPath\(storeId\)/);
    assert.match(service, /store-\{storeId\.Value\}/);
    assert.match(endpoints, /RequireOperationalStoreAsync/);
    assert.match(endpoints, /spreadsheets\.UpdateAsync\(guard\.StoreId/);
    assert.match(worker, /spreadsheets\.UpdateAsync\(storeId/);
});

test('status comercial da loja bloqueia login bot agendamento e superadmin local key', () => {
    const policy = read('WhatsAppBot.Worker/Services/StoreAccessPolicy.cs');
    const authEndpoints = read('WhatsAppBot.Worker/Endpoints/AuthEndpoints.cs');
    const base = read('WhatsAppBot.Worker/Services/ConversationStateBase.cs');
    const scheduling = read('WhatsAppBot.Worker/Endpoints/SchedulingEndpoints.cs');
    const superadmin = read('WhatsAppBot.Worker/Endpoints/SuperAdminEndpoints.cs');

    assert.match(policy, /IsSuspended/);
    assert.match(policy, /SubscriptionExpiry/);
    assert.match(authEndpoints, /StoreAccessPolicy\.Evaluate/);
    assert.match(base, /StoreAccessPolicy\.Evaluate/);
    assert.match(scheduling, /RequireOperationalStoreAsync/);
    assert.match(superadmin, /EndpointAuth\.IsLoopback/);
    assert.match(superadmin, /IsSuspended/);
});

test('planos comerciais usam catalogo unico e mantem compatibilidade legacy', () => {
    const planCatalog = read('WhatsAppBot.Worker/Services/Modules/PlanCatalog.cs');
    const moduleCatalog = read('WhatsAppBot.Worker/Services/Modules/ModuleCatalog.cs');
    const superadmin = read('WhatsAppBot.Worker/Endpoints/SuperAdminEndpoints.cs');
    const ui = read('superadmin/index.html');

    assert.match(planCatalog, /"standard"[\s\S]*Professional/);
    assert.match(moduleCatalog, /Professional/);
    assert.match(superadmin, /PlanCatalog\.Normalize/);
    assert.match(superadmin, /PlanCatalog\.MonthlyPrice/);
    assert.match(ui, /option value="Professional"/);
    assert.match(ui, /normalizeCommercialPlan/);
    assert.equal(ui.includes('option value="Free"'), false);
});

test('fase 2 posiciona produto comercialmente para barbearias', () => {
    const login = read('login.html');
    const manifest = JSON.parse(read('manifest.json'));
    const dashboard = read('dashboard-improved.html');
    const dashboardJs = read('script-dashboard.js');
    const sw = read('sw.js');
    const pkg = JSON.parse(read('package.json'));
    const superadmin = read('superadmin/index.html');
    const auth = read('WhatsAppBot.Worker/Services/AuthService.cs');
    const program = read('WhatsAppBot.Worker/Program.cs');
    const menuState = read('WhatsAppBot.Worker/Services/AwaitingMenuSelectionState.cs');
    const confirmState = read('WhatsAppBot.Worker/Services/ConfirmingAppointmentState.cs');
    const notification = read('WhatsAppBot.Worker/Services/NotificationService-Improved.cs');
    const templates = read('data/whatsapp-templates.json');

    assert.match(login, /Nythar/);
    assert.match(login, /Dashboard &amp; Chatbot/);
    assert.equal(manifest.name, 'Nythar - Dashboard & Chatbot');
    assert.match(manifest.description, /negócios locais/i);
    assert.match(dashboard, /Minha loja/);
    assert.match(dashboard, />Fidelidade</);
    assert.match(sw, /Nythar/);
    assert.equal(pkg.name, 'nythar-dashboard');
    assert.match(dashboardJs, /DASHBOARD NYTHAR/);
    assert.match(dashboardJs, /profissional espec/);
    assert.match(superadmin, /Nythar/);
    assert.match(superadmin, /btype-btn carwash hidden/);
    assert.match(superadmin, /btype-btn pizzeria hidden/);
    assert.match(superadmin, /btype-btn computer"/);
    assert.match(auth, /new Claim\("StoreName", storeName\)/);
    assert.equal(auth.includes('new Claim("StoreName", "Nythar - Dashboard & Chatbot")'), false);
    assert.equal(program.includes('Name = "Nythar - Dashboard & Chatbot"'), false);
    assert.equal(menuState.includes('Plano VIP'), false);
    assert.equal(confirmState.includes('Clube VIP utilizado'), false);
    assert.match(confirmState, /clube de fidelidade/);
    assert.match(notification, /Nythar Bot/);
    assert.match(templates, /Bem-vindo a \{loja\}/);
});

test('identidade publica usa Nythar Dashboard e Chatbot sem depender do nome antigo', () => {
    const legacyBrand = ['Clinica', 'Hair'].join(' ');
    const legacyApiFile = ['api', 'clinica', 'hair.js'].join('-');
    const pkg = JSON.parse(read('package.json'));
    const manifest = JSON.parse(read('manifest.json'));
    const dockerfile = read('Dockerfile.dashboard');
    const readme = read('README.md');
    const installer = read('INSTALAR-CLIENTE.bat');
    const updater = read('config/updater.cfg');

    assert.equal(fs.existsSync(path.join(root, legacyApiFile)), false);
    assert.equal(pkg.main, 'api-nythar.js');
    assert.equal(manifest.name, 'Nythar - Dashboard & Chatbot');
    assert.match(dockerfile, /api-nythar\.js/);
    assert.match(readme, /^# Nythar - Dashboard & Chatbot/m);
    assert.match(installer, /NYTHAR - DASHBOARD \^& CHATBOT/);
    assert.match(updater, /Nythar-Dashboard-Chatbot/);
    assert.equal([dockerfile, readme, installer].some(content => content.includes(legacyBrand)), false);
});

test('repositorio publico ignora credenciais bancos sessoes e artefatos gerados', () => {
    const gitignore = read('.gitignore');
    const dockerignore = read('.dockerignore');

    for (const pattern of ['.env.*', 'CREDENCIAIS-ACESSO.txt', '*.db', 'data/*', 'release/', 'runtime/', '.wwebjs_auth']) {
        assert.match(gitignore, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(dockerignore, /CREDENCIAIS-ACESSO\.txt/);
    assert.match(dockerignore, /\.wwebjs_auth\*/);
    assert.match(dockerignore, /release/);
});

test('fase 2 possui demo e checklist de implantacao para barbearia', () => {
    const report = read('docs/FASE2-BARBEARIA-COMERCIAL.md');
    const checklist = read('docs/CHECKLIST-IMPLANTACAO-BARBEARIA.md');
    const demo = JSON.parse(read('data/demo-barbearia.json'));
    const seed = read('scripts/seed-demo-barbearia.ps1');

    assert.match(report, /Nucleo generico x segmento barbearia/);
    assert.match(report, /Barbearia Avenida/);
    assert.match(report, /O que fica para depois/);
    assert.match(checklist, /Criterio de pronta para uso/);
    assert.equal(demo.store.businessType, 'Barbershop');
    assert.ok(demo.services.length >= 3 && demo.services.length <= 5);
    assert.ok(demo.professionals.length >= 2 && demo.professionals.length <= 3);
    assert.ok(demo.appointments.length >= 3);
    assert.match(seed, /api\/superadmin\/stores/);
    assert.match(seed, /api\/agendamentos/);
});

test('endpoints de settings foram extraidos do Program', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const endpoints = read('WhatsAppBot.Worker/Endpoints/SettingsEndpoints.cs');

    assert.match(program, /MapSettingsEndpoints/);
    assert.equal(/app\.MapGet\(\"\/api\/settings\"/.test(program), false);
    assert.match(endpoints, /\/api\/settings/);
    assert.match(endpoints, /MapPut\(\"\/api\/settings\"/);
    assert.match(endpoints, /cache\.Remove\(\"BusinessHours\"\)/);
    assert.match(endpoints, /Horario de fechamento precisa ser maior/);
    assert.match(endpoints, /X-User-Role/);
    assert.match(endpoints, /UPDATE_SETTINGS/);
});

test('horarios livres explicam expediente duracao e ultimo inicio possivel', () => {
    const scheduling = read('WhatsAppBot.Worker/Endpoints/SchedulingEndpoints.cs');
    const agenda = read('WhatsAppBot.Worker/Services/AgendaService.cs');
    const dashboard = read('script-dashboard.js');

    assert.match(agenda, /GetScheduleWindow/);
    assert.match(agenda, /_hours\.OpeningTime/);
    assert.match(agenda, /HasProfessionalScheduleOverride/);
    assert.match(scheduling, /UltimoInicioPossivel/);
    assert.match(scheduling, /ExpedienteFim/);
    assert.match(dashboard, /ultimo inicio/);
    assert.match(dashboard, /scheduleRule/);
});

test('carga horaria do profissional e validada no frontend e backend', () => {
    const dashboard = read('script-dashboard.js');
    const barbers = read('WhatsAppBot.Worker/Endpoints/BarberEndpoints.cs');
    const html = read('dashboard-improved.html');

    assert.match(dashboard, /isValidTimeRange/);
    assert.match(dashboard, /getGlobalScheduleDefaults/);
    assert.match(dashboard, /Carga horaria invalida/);
    assert.equal(html.includes('barberWorkEnd" type="time" class="input-field" value='), false);
    assert.match(barbers, /BusinessHours hours/);
    assert.match(barbers, /ValidateSchedule/);
    assert.match(barbers, /Pausa\/almoco precisa ficar dentro da carga horaria/);
});

test('catalogo de servicos usa novos precos no backend e chatbot', () => {
    const servico = read('WhatsAppBot.Worker/Models/Servico.cs');
    const autoResponder = read('WhatsAppBot.Worker/Services/AutoResponder.cs');
    const catalog = read('WhatsAppBot.Worker/Services/ServiceCatalogService.cs');
    const settings = read('WhatsAppBot.Worker/Endpoints/SettingsEndpoints.cs');
    const scheduling = read('WhatsAppBot.Worker/Endpoints/SchedulingEndpoints.cs');
    const dashboard = read('script-dashboard.js');
    const html = read('dashboard-improved.html');

    assert.match(servico, /CorteBarba[\s\S]*60\.00m/);
    assert.match(servico, /CorteSobrancelha[\s\S]*45\.00m/);
    assert.match(servico, /CorteBarbasobrancelha[\s\S]*75\.00m/);
    // AutoResponder.cs contém apenas strings de mensagem — ServicoInfo.Servicos foi movido para
    // ServiceCatalogService (verificado pela asserção `catalog` acima). Confirmamos que o chatbot
    // ainda inclui mensagens de lembrete com o nome do serviço (parâmetro `servico`).
    assert.match(autoResponder, /ReminderDayBefore/);
    assert.match(catalog, /ServiceCatalogService/);
    assert.match(catalog, /Service_.*_Price/);
    assert.match(catalog, /Service_.*_Active/);
    assert.match(settings, /\/api\/services/);
    assert.match(scheduling, /ServiceCatalogService catalog/);
    assert.match(html, /serviceName_1/);
    assert.match(dashboard, /applyServiceSettings/);
    assert.equal(servico.includes('55.00m'), false);
    assert.equal(servico.includes('65.00m'), false);
});

test('horarios avancados por barbeiro suportam turnos semanais e folga', () => {
    const agenda = read('WhatsAppBot.Worker/Services/AgendaService.cs');
    const html = read('dashboard-improved.html');

    assert.match(agenda, /GetScheduleSegments/);
    assert.match(agenda, /TryReadCustomSegments/);
    assert.match(agenda, /shifts/);
    assert.match(agenda, /closed/);
    // A grade de horários passou de textarea JSON para grade visual (scheduleGrid/scheduleRows).
    assert.match(html, /scheduleGrid/);
});

test('endpoints operacionais e de barbeiros foram extraidos do Program', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const operational = read('WhatsAppBot.Worker/Endpoints/OperationalEndpoints.cs');
    const barbers = read('WhatsAppBot.Worker/Endpoints/BarberEndpoints.cs');

    assert.match(program, /MapOperationalEndpoints/);
    assert.match(program, /MapBarberEndpoints/);
    assert.equal(/app\.MapGet\(\"\/health\"/.test(program), false);
    assert.equal(/app\.MapGet\(\"\/api\/barbeiros\"/.test(program), false);
    assert.match(operational, /\/api\/bot\/status/);
    assert.match(operational, /\/api\/bot\/qr/);
    assert.match(barbers, /\/api\/barbeiros/);
    assert.match(barbers, /CriarBarbeiroRequest/);
});

test('endpoints de agenda foram extraidos do Program', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const scheduling = read('WhatsAppBot.Worker/Endpoints/SchedulingEndpoints.cs');

    assert.match(program, /MapSchedulingEndpoints/);
    assert.equal(/app\.MapGet\(\"\/api\/agendamentos\"/.test(program), false);
    assert.equal(/app\.MapPost\(\"\/api\/agendamentos\"/.test(program), false);
    assert.match(scheduling, /\/api\/agendamentos/);
    assert.match(scheduling, /\/api\/hoje/);
    assert.match(scheduling, /\/api\/semana/);
    assert.match(scheduling, /\/api\/horarios-livres/);
    assert.match(scheduling, /\/api\/dias-indisponiveis/);
    assert.match(scheduling, /NormalizePhone/);
    assert.match(scheduling, /data e horario futuros/);
    assert.match(scheduling, /ja possui agendamentos/);
    assert.match(scheduling, /CanAccessAppointment/);
});

test('dashboard permite agendamento manual e bloqueio de dias', () => {
    const html = read('dashboard-improved.html');
    const dashboard = read('script-dashboard.js');
    const api = read('api-nythar.js');
    const agenda = read('WhatsAppBot.Worker/Services/AgendaService.cs');
    const model = read('WhatsAppBot.Worker/Models/UnavailableDay.cs');

    assert.match(html, /manualAppointmentModal/);
    assert.match(html, /unavailableDayModal/);
    assert.match(dashboard, /saveManualAppointment/);
    assert.match(dashboard, /updateManualAvailableSlots/);
    assert.match(dashboard, /normalizePhoneInput/);
    assert.match(dashboard, /Tempo limite excedido/);
    assert.match(dashboard, /saveUnavailableDay/);
    assert.match(api, /\/api\/dias-indisponiveis/);
    assert.match(agenda, /IsDateUnavailable/);
    assert.match(model, /class UnavailableDay/);
});

test('agenda manual busca horarios livres na rota correta e le payload sem acentos', () => {
    const dashboard = read('script-dashboard.js');
    const css = read('style-dashboard.css');
    const sw = read('sw.js');

    assert.match(dashboard, /apiFetch\(`\/horarios-livres\?\$\{params\.toString\(\)\}`\)/);
    assert.match(dashboard, /data\.HorariosLivres/);
    assert.match(dashboard, /data\.UltimoInicioPossivel/);
    assert.equal(dashboard.includes('/horários-livres'), false);
    assert.match(css, /Dark blue polish/);
    assert.match(css, /#071426/);
    assert.match(sw, /nythar-pwa-v\d+/);
});

test('startup remove coluna legada Servico que bloqueava agendamento manual', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const scheduler = read('WhatsAppBot.Worker/Services/SchedulerService.cs');

    assert.match(program, /UPDATE Appointments SET ServiceId = Servico/);
    assert.match(program, /ALTER TABLE Appointments DROP COLUMN Servico/);
    assert.match(program, /throw new InvalidOperationException/);
    assert.match(scheduler, /ServiceId\s*=\s*serviceId/);
});

test('agendamento manual usa datas locais e timezone do Brasil', () => {
    const dashboard = read('script-dashboard.js');
    const agenda = read('WhatsAppBot.Worker/Services/AgendaService.cs');
    const scheduling = read('WhatsAppBot.Worker/Endpoints/SchedulingEndpoints.cs');

    assert.match(dashboard, /function todayInputValue/);
    assert.match(dashboard, /getFullYear/);
    assert.equal(dashboard.includes("toISOString().split('T')"), false);
    assert.match(dashboard, /new Date\(year, month - 1, day, hour, minute, 0\)/);
    assert.match(agenda, /GetBrazilNow/);
    assert.match(agenda, /NormalizeBusinessDateTime/);
    assert.match(scheduling, /TryParseLocalDateTime/);
    assert.match(scheduling, /AgendaService\.GetBrazilNow\(\)\.AddMinutes\(1\)/);
});

test('notificacoes reais incluem payload completo, dedupe e service worker', () => {
    const service = read('WhatsAppBot.Worker/Services/NotificationService-Improved.cs');
    const scheduler = read('WhatsAppBot.Worker/Services/SchedulerService.cs');
    const scheduling = read('WhatsAppBot.Worker/Endpoints/SchedulingEndpoints.cs');
    const dashboard = read('script-dashboard.js');
    const api = read('api-nythar.js');
    const sw = read('sw.js');

    assert.match(service, /eventKey/);
    assert.match(service, /appointmentId/);
    assert.match(service, /Notificacao enviada via SignalR/);
    assert.match(service, /phoneNumber/);
    assert.match(service, /barberName/);
    assert.match(service, /origin/);
    assert.match(scheduler, /origin = "WhatsApp\/Bot"/);
    assert.match(scheduling, /"Dashboard"/);
    assert.match(dashboard, /seenNotificationIds/);
    assert.match(dashboard, /sessionStorage\.setItem\('hair_seen_notifications'/);
    assert.match(dashboard, /ensureServiceWorkerRegistration/);
    assert.match(dashboard, /showNotification/);
    assert.match(api, /'sw\.js'/);
    assert.match(sw, /notificationclick/);
    assert.match(sw, /clients\.openWindow/);
});

test('chatbot tem retorno seguro ao menu, etapas e voltar etapa', () => {
    const base = read('WhatsAppBot.Worker/Services/ConversationStateBase.cs');
    const manager = read('WhatsAppBot.Worker/Services/ConversationStateManager.cs');
    const session = read('WhatsAppBot.Worker/Models/ConversationSession.cs');
    const sessionStore = read('WhatsAppBot.Worker/Services/ConversationSessionStore.cs');
    const program = read('WhatsAppBot.Worker/Program.cs');
    const name = read('WhatsAppBot.Worker/Services/AwaitingNameState.cs');
    const confirm = read('WhatsAppBot.Worker/Services/ConfirmingAppointmentState.cs');
    const scheduler = read('WhatsAppBot.Worker/Services/SchedulerService.cs');

    assert.match(session, /InvalidResponseCount/);
    assert.match(sessionStore, /InvalidResponseCount = session\.InvalidResponseCount/);
    assert.match(sessionStore, /RemoveExpiredAsync/);
    assert.match(program, /ADD COLUMN InvalidResponseCount/);
    assert.match(base, /RegisterInvalidResponseAsync/);
    assert.match(base, /InvalidResponseCount >= 3/);
    assert.match(base, /ResetToMainMenuAsync/);
    assert.match(base, /Nao consegui entender sua resposta/);
    assert.match(base, /StepLabel/);
    assert.match(base, /Etapa \{step\}\/5/);
    assert.match(base, /BackOption/);
    assert.match(base, /voltar_etapa/);
    assert.match(manager, /PhoneLocks/);
    assert.match(manager, /RateLimitMaxMessages/);
    assert.match(manager, /IsRateLimited/);
    assert.match(manager, /PruneRuntimeCaches/);
    // Execução ÚNICA do handler: retry de handler foi removido de propósito porque
    // re-executar um fluxo com efeitos colaterais (envio de mensagem, consumo de
    // crédito VIP) duplicava a confirmação e descontava crédito duas vezes.
    assert.match(manager, /ExecuteOnceAsync/);
    assert.doesNotMatch(manager, /ExecuteWithLightRetryAsync/);
    assert.match(manager, /CancelAfter\(TimeSpan\.FromSeconds\(35\)\)/);
    assert.match(scheduler, /existingDuplicate/);
    assert.match(scheduler, /tratado de forma idempotente/);
    assert.match(name, /IsBackCommand/);
    assert.match(confirm, /Voltar ou Cancelar/);
});

test('qr code tem janela de exibicao renovacao e feedback de idade', () => {
    const bridge = read('WhatsAppBridge/index.js');
    const dashboard = read('script-dashboard.js');

    assert.match(bridge, /QR_DISPLAY_TTL_MS/);
    assert.match(bridge, /QR_RENEW_AFTER_MS/);
    assert.match(bridge, /qrAgeMs/);
    assert.match(bridge, /qrDisplayTtlMs/);
    assert.match(dashboard, /ageSeconds/);
    assert.match(dashboard, /Gerando QR Code/);
});

test('notificacoes em segundo plano tem permissao explicita, som destravado e mensagens do whatsapp', () => {
    const dashboard = read('script-dashboard.js');
    const html = read('dashboard-improved.html');
    const service = read('WhatsAppBot.Worker/Services/NotificationService-Improved.cs');
    const webhook = read('WhatsAppBot.Worker/Endpoints/WebhookEndpoints.cs');
    const models = read('WhatsAppBot.Worker/Services/Notifications/NotificationModels.cs');

    assert.match(html, /notificationPermissionBtn/);
    assert.match(dashboard, /enablePersistentNotifications/);
    assert.match(dashboard, /unlockNotificationSound/);
    assert.match(dashboard, /visibilitychange/);
    assert.match(dashboard, /showNotification/);
    assert.match(service, /NotifyIncomingMessage/);
    assert.match(webhook, /NotifyIncomingMessage/);
    assert.match(webhook, /NotifySystemAlert/);
    assert.match(models, /IncomingMessage/);
});

test('pwa instalavel tem manifest completo service worker cache e icones', () => {
    const manifest = JSON.parse(read('manifest.json'));
    const html = read('dashboard-improved.html');
    const sw = read('sw.js');
    const dashboard = read('script-dashboard.js');
    const api = read('api-nythar.js');

    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, '/dashboard-improved.html');
    assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
    assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
    assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
    assert.match(html, /rel="manifest"/);
    assert.match(html, /apple-mobile-web-app-capable/);
    assert.match(html, /pwaInstallBtn/);
    assert.match(sw, /CACHE_VERSION/);
    // sw.js usa Promise.allSettled + cache.add() individual (mais robusto que cache.addAll:
    // uma falha num recurso CDN nao cancela o install do SW nem impede caching dos demais).
    assert.match(sw, /Promise\.allSettled/);
    assert.match(sw, /notificationclick/);
    assert.match(sw, /self\.addEventListener\('push'/);
    assert.match(dashboard, /beforeinstallprompt/);
    assert.match(dashboard, /installPwaApp/);
    assert.match(api, /pwa:/);
    assert.match(api, /serviceWorker/);
});

test('inventario de dependencias cobre frontend backend bridge e operacao', () => {
    const html = read('dashboard-improved.html');
    const doc = read('docs/DEPENDENCIAS.md');

    for (const text of ['Inventário de dependências', 'Frontend dashboard', 'Backend .NET', 'WhatsApp Bridge', 'SignalR LongPolling']) {
        assert.match(html + doc, new RegExp(text));
    }
    for (const text of ['whatsapp-web.js', 'Puppeteer', 'SQLite', 'ClosedXML', 'SendGrid', 'Polly', 'Serilog']) {
        assert.match(doc, new RegExp(text));
    }
});

test('endpoints de analytics foram extraidos do Program', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const analytics = read('WhatsAppBot.Worker/Endpoints/AnalyticsEndpoints.cs');

    assert.match(program, /MapAnalyticsEndpoints/);
    assert.equal(/app\.MapGet\(\"\/api\/stats\"/.test(program), false);
    assert.equal(/app\.MapGet\(\"\/api\/analytics\"/.test(program), false);
    assert.match(analytics, /\/api\/analytics/);
    assert.match(analytics, /\/api\/stats/);
    assert.match(analytics, /ServicosMaisPopulares/);
    assert.match(analytics, /TaxaPresenca/);
});

test('relatorios operacionais expoem filtros, graficos e exportacao', () => {
    const analytics = read('WhatsAppBot.Worker/Endpoints/AnalyticsEndpoints.cs');
    const api = read('api-nythar.js');
    const dashboard = read('dashboard-improved.html');
    const script = read('script-dashboard.js');

    assert.match(analytics, /\/api\/reports\/appointments/);
    assert.match(analytics, /Cancelamentos/);
    assert.match(analytics, /AgendaService\.GetBrazilNow\(\)\.Date/);
    assert.match(analytics, /FormaAgendamento/);
    assert.match(api, /\/api\/reports\/appointments/);
    assert.match(dashboard, /weeklyReportTableBody/);
    assert.match(dashboard, /barberReportChart/);
    assert.match(dashboard, /exportReportsCsv/);
    assert.match(script, /calculateReportMetrics/);
    assert.match(script, /renderReportCharts/);
    assert.match(script, /loadReports\(false\)/);
    assert.match(script, /localStorage\.setItem\('hair_report_filters'/);
});

test('endpoints de auth foram extraidos do Program', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const authEndpoints = read('WhatsAppBot.Worker/Endpoints/AuthEndpoints.cs');

    assert.match(program, /MapAuthEndpoints/);
    assert.equal(/app\.MapPost\(\"\/api\/auth\/login\"/.test(program), false);
    assert.equal(/app\.MapPost\(\"\/api\/auth\/recover\"/.test(program), false);
    assert.match(authEndpoints, /\/api\/auth\/login/);
    assert.match(authEndpoints, /\/api\/auth\/recover/);
    assert.match(authEndpoints, /GenerateJwtToken/);
    assert.match(authEndpoints, /PhoneNumber/);
});

test('endpoint webhook foi extraido do Program', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const webhook = read('WhatsAppBot.Worker/Endpoints/WebhookEndpoints.cs');

    assert.match(program, /MapWebhookEndpoints/);
    assert.equal(/app\.MapPost\(\"\/api\/webhook\/whatsapp\"/.test(program), false);
    assert.match(webhook, /\/api\/webhook\/whatsapp/);
    assert.match(webhook, /EndpointAuth\.IsAuthenticated/);
    assert.match(webhook, /SetTenantId/);
    assert.match(webhook, /HandleAsync/);
    assert.match(webhook, /DbUpdateException/);
});

test('endpoints de superadmin foram extraidos do Program', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const superadmin = read('WhatsAppBot.Worker/Endpoints/SuperAdminEndpoints.cs');

    assert.match(program, /MapSuperAdminEndpoints/);
    assert.equal(/app\.MapGet\(\"\/api\/superadmin\/stores\"/.test(program), false);
    assert.equal(/app\.MapPost\(\"\/api\/superadmin\/stores\"/.test(program), false);
    assert.equal(/record CreateStoreRequest/.test(program), false);
    assert.match(superadmin, /\/api\/superadmin\/global-stats/);
    assert.match(superadmin, /\/api\/superadmin\/stores/);
    assert.match(superadmin, /CreateStoreRequest/);
    assert.match(superadmin, /UpdateStoreRequest/);
    assert.match(superadmin, /LogAction/);
});

test('seed de automacoes padrao fica isolado do Program', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const seeder = read('WhatsAppBot.Worker/Startup/DefaultAutomationSeeder.cs');

    assert.match(program, /DefaultAutomationSeeder\.EnsureSeededAsync/);
    assert.equal(/new Dictionary<string, string>/.test(program), false);
    assert.match(seeder, /Msg_Welcome/);
    assert.match(seeder, /Active_Retention/);
    assert.match(seeder, /INSERT INTO SystemConfigs/);
});

test('fase 3 expõe dashboard essencial para barbearia', () => {
    const html = read('dashboard-improved.html');
    const script = read('script-dashboard.js');

    assert.match(html, /Painel do dono/);
    assert.match(html, /ownerSummaryText/);
    assert.match(html, /onboardingChecklist/);
    assert.match(html, /data-view-button="clientes"/);
    assert.match(html, /id="view-clientes"/);
    assert.match(html, /clientsList/);
    assert.match(html, /servicesManagerList/);
    assert.match(html, /serviceModal/);

    assert.match(script, /function renderOwnerCockpit/);
    assert.match(script, /function renderOnboardingChecklist/);
    assert.match(script, /async function loadClients/);
    assert.match(script, /\/reports\/appointments/);
    assert.match(script, /async function loadServicesManager/);
    assert.match(script, /async function saveServiceModal/);
    assert.match(script, /\/servicos/);
});

test('crm avancado usa endpoints tenant scoped e dashboard integrada', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const db = read('WhatsAppBot.Worker/Data/AppDbContext.cs');
    const endpoints = read('WhatsAppBot.Worker/Endpoints/CustomerCrmEndpoints.cs');
    const proxy = read('api-nythar.js');
    const html = read('dashboard-improved.html');
    const script = read('script-dashboard.js');

    assert.match(program, /MapCustomerCrmEndpoints/);
    assert.match(program, /CustomerProfiles/);
    assert.match(db, /DbSet<CustomerProfile>/);
    assert.match(db, /HasQueryFilter\(c => TenantId == 0 \|\| c\.StoreId == TenantId\)/);
    assert.match(endpoints, /\/api\/customers/);
    assert.match(endpoints, /\/api\/customer-tags/);
    assert.match(endpoints, /\/api\/customer-reminders/);
    assert.match(endpoints, /RequireOperationalStoreAsync/);
    assert.match(endpoints, /CustomerKeyFor/);
    assert.match(proxy, /app\.use\('\/api\/customers'/);
    assert.match(proxy, /app\.use\('\/api\/customer-tags'/);
    assert.match(proxy, /app\.use\('\/api\/customer-reminders'/);
    assert.match(html, /CRM avançado/);
    assert.match(html, /crmTagFilter/);
    assert.match(script, /apiFetch\('\/customers\?inactiveDays=60'\)/);
    assert.match(script, /openCustomerProfile/);
    assert.match(script, /openCustomerWhatsApp/);
    assert.match(script, /addCustomerReminder/);
    assert.equal(script.includes('/api/customers?mock'), false);
});

test('modulo de otimizacao possui entidades endpoints flag e tenant guard', () => {
    const program = read('WhatsAppBot.Worker/Program.cs');
    const db = read('WhatsAppBot.Worker/Data/AppDbContext.cs');
    const endpoints = read('WhatsAppBot.Worker/Endpoints/OptimizationEndpoints.cs');
    const modules = read('WhatsAppBot.Worker/Services/Modules/ModuleCatalog.cs');

    assert.match(program, /MapOptimizationEndpoints/);
    assert.match(program, /OptimizationDevices/);
    assert.match(program, /OptimizationTickets/);
    assert.match(db, /DbSet<OptimizationDevice>/);
    assert.match(db, /HasQueryFilter\(d => TenantId == 0 \|\| d\.StoreId == TenantId\)/);
    assert.match(db, /HasQueryFilter\(t => TenantId == 0 \|\| t\.StoreId == TenantId\)/);
    assert.match(endpoints, /BusinessType\.ComputerOptimization/);
    assert.match(endpoints, /ModuleKey = "computer_optimization"/);
    assert.match(endpoints, /ValidateServiceAsync/);
    assert.match(endpoints, /CanTransition/);
    assert.match(endpoints, /\/api\/optimization\/tickets\/\{id:int\}\/quote/);
    assert.match(endpoints, /\/api\/tech\/\{\*\*path\}/);
    assert.match(modules, /computer_optimization/);
    assert.equal(endpoints.includes('VehicleInfo'), false);
});

test('dashboard de tecnologia tem experiencia propria sem textos de barbearia na fila', () => {
    const html = read('dashboard-improved.html');
    const script = read('script-dashboard.js');
    const techBlock = script.slice(script.indexOf('ComputerOptimization:'), script.indexOf('function biz()'));

    assert.match(html, /data-view-button="tech-overview"/);
    assert.match(html, /data-view-button="tech-queue"/);
    assert.match(html, /data-view-button="tech-devices"/);
    assert.match(html, /optimizationTicketModal/);
    assert.match(script, /loadOptimizationData/);
    assert.match(script, /renderOptimizationQueue/);
    assert.match(script, /saveOptimizationChecklist/);
    assert.match(techBlock, /Operadores/);
    assert.match(techBlock, /pacote/i);
    for (const forbidden of ['corte', 'barbeiro', 'clube VIP', 'agenda de cortes', 'Console']) {
        assert.equal(techBlock.toLowerCase().includes(forbidden.toLowerCase()), false, `bloco ComputerOptimization contem ${forbidden}`);
    }
});

test('proxy e bot encaminham fluxo real de otimizacao', () => {
    const api = read('api-nythar.js');
    const confirm = read('WhatsAppBot.Worker/Services/ConfirmingAppointmentState.cs');
    const labels = read('WhatsAppBot.Worker/Models/BusinessLabels.cs');

    assert.match(api, /app\.use\('\/api\/optimization'/);
    assert.match(api, /app\.use\('\/api\/tech'/);
    assert.match(confirm, /CreateTicketFromBotAsync/);
    assert.match(confirm, /BusinessType\.ComputerOptimization/);
    assert.match(labels, /Iniciar atendimento/);
    assert.match(labels, /computador/i);
    assert.equal(labels.includes('PS4'), false);
});

test('demo de otimizacao contem loja servicos computadores e cinco tickets', () => {
    const demo = JSON.parse(read('data/demo-otimizacao-pc.json'));
    const seed = read('scripts/seed-demo-otimizacao-pc.ps1');

    assert.equal(demo.store.businessType, 'ComputerOptimization');
    assert.equal(demo.store.name, 'CoreBoost Otimizacoes');
    assert.ok(demo.services.length >= 4 && demo.services.length <= 6);
    assert.equal(demo.devices.length, 4);
    assert.equal(demo.tickets.length, 5);
    for (const status of ['Pronto', 'EmOtimizacao', 'AguardandoCliente', 'Novo', 'Concluido']) {
        assert.ok(demo.tickets.some(t => t.status === status), `faltou status ${status}`);
    }
    assert.match(seed, /api\/optimization\/devices/);
    assert.match(seed, /api\/optimization\/tickets/);
});

test('superadmin prioriza barbearia e esconde segmentos futuros na criação', () => {
    const superadmin = read('superadmin/index.html');

    assert.match(superadmin, /data-value="Barbershop"/);
    assert.match(superadmin, /selectBusinessType\('Barbershop'\)/);
    assert.match(superadmin, /btype-btn carwash hidden/);
    assert.match(superadmin, /btype-btn pizzeria hidden/);
    assert.match(superadmin, /btype-btn computer"/);
    assert.match(superadmin, /toggleStoreActive/);
});

test('superadmin provisiona e remove loja tech sem deixar dados tecnicos orfaos', () => {
    const superadminEndpoints = read('WhatsAppBot.Worker/Endpoints/SuperAdminEndpoints.cs');
    const api = read('api-nythar.js');

    assert.match(superadminEndpoints, /BridgePortFor/);
    assert.match(superadminEndpoints, /bridgePort = 3000 \+ storeId/);
    assert.match(superadminEndpoints, /Diagnostico remoto/);
    assert.match(superadminEndpoints, /Preco = 50m/);
    assert.match(superadminEndpoints, /Otimizacao completa Premium/);
    assert.match(superadminEndpoints, /Preco = 220m/);
    assert.match(superadminEndpoints, /OptimizationTicketEvents\.IgnoreQueryFilters\(\)/);
    assert.match(superadminEndpoints, /OptimizationTickets\.IgnoreQueryFilters\(\)/);
    assert.match(superadminEndpoints, /OptimizationDevices\.IgnoreQueryFilters\(\)/);

    assert.match(api, /syncStoresMetaFromBackend/);
    assert.match(api, /bridgeStopped/);
    assert.match(api, /storesMetaSynced/);
    assert.match(api, /bridgePortForStoreId/);
});

test('release limpo barra dados operacionais e credenciais sensiveis no zip', () => {
    const release = read('scripts/build-release.ps1');

    for (const text of [
        'agendamentos\\.db',
        'agendamentos\\.db-wal',
        'agendamentos\\.db-shm',
        'dashboard-sessions\\.json',
        'stores-meta\\.json',
        'CREDENCIAIS-ACESSO\\.txt',
        '\\.env',
        '\\.wwebjs_auth',
        '\\.wwebjs_cache',
        'logs|backups',
        'exports|exportacoes'
    ]) {
        assert.ok(release.includes(text), `build-release.ps1 deve conter ${text}`);
    }
});

test('testes HTTP vivos opcionais', async t => {
    if (process.env.RUN_LIVE_API_TESTS !== '1') {
        t.skip('Defina RUN_LIVE_API_TESTS=1 para testar servicos locais em execucao.');
        return;
    }

    const base = process.env.DASHBOARD_URL || 'http://127.0.0.1:4000';
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);

    const protectedRes = await fetch(`${base}/api/agendamentos`);
    assert.equal(protectedRes.status, 401);

    const forbiddenFile = await fetch(`${base}/WhatsAppBot.Worker/appsettings.json`);
    assert.equal(forbiddenFile.status, 404);
});
