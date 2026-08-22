/**
 * DASHBOARD NYTHAR v2.1
 * Lógica desacoplada e modularizada
 */

// --- CONFIGURAÇÕES E ESTADO GLOBAL ---
(function applyStoredThemeEarly() {
    const savedDarkMode = localStorage.getItem('hair_dark_mode');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const isDark = savedDarkMode !== null ? savedDarkMode === 'true' : !!prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
})();

const CONFIG = {
    API_BASE: window.location.origin + '/api',
    AUTH_API: window.location.origin + '/api/auth',
    HUB_URL: window.location.origin + '/hubs/notifications',
    REFRESH_INTERVAL: 15000,
    // 12s (era 7s): reduz chamadas à bridge em ~40% sem impacto perceptível na UI.
    // A bridge responde ao backend via HTTP local; 7s era agressivo demais para algo que muda raramente.
    BOT_STATUS_INTERVAL: 12000,
    HEALTH_INTERVAL: 15000,
    API_TIMEOUT_MS: 15000
};

let SERVICE_OPTIONS = [
    { value: 'Corte', label: 'Corte' },
    { value: 'Barba', label: 'Barba' },
    { value: 'Sobrancelha', label: 'Sobrancelha' },
    { value: 'CorteBarba', label: 'Corte + Barba' },
    { value: 'CorteSobrancelha', label: 'Corte + Sobrancelha' },
    { value: 'CorteBarbasobrancelha', label: 'Corte + Barba + Sobrancelha' }
];

// --- CACHE DE ELEMENTOS DOM (Performance) ---
const UI = {
    hojeContainer: () => document.getElementById('hoje'),
    futurosContainer: () => document.getElementById('futuros'),
    stats: {
        hoje: () => document.getElementById('countHoje'),
        futuros: () => document.getElementById('countFuturos'),
        faturamento: () => document.getElementById('totalFaturamento'),
        tempo: () => document.getElementById('tempoTotal')
    },
    lastUpdate: () => document.getElementById('last-update')
};

let analyticsChartInstance = null;
let reportCharts = {};
let reportAutoRefreshTimer = null;
let dashboardIntervalsStarted = false;
let deferredPwaInstallPrompt = null;

let state = {
    token: localStorage.getItem('hair_token'),
    user: { 
        role: localStorage.getItem('hair_role') || 'admin', 
        barberId: localStorage.getItem('hair_barberId') 
    },
    activeView: 'agenda',
    agenda: { today: [], future: [], all: [] },
    unavailableDays: [],
    bot: null,
    modules: {},
    clientes: [],
    crm: { summary: null, tags: [], segments: null, currentCustomer: null },
    notifications: [],
    seenNotificationIds: new Set(JSON.parse(localStorage.getItem('hair_seen_notifications') || sessionStorage.getItem('hair_seen_notifications') || '[]')),
    notificationConnection: null,
    notificationReconnectTimer: null,
    realtimeStatus: 'offline',
    health: { backend: false, bridge: false },
    diagnostics: null,
    isLoading: false,
    pendingDataReload: false,
    currentEditId: null,
    storeName: localStorage.getItem('hair_store_name') || 'Painel',
    businessType: localStorage.getItem('hair_business_type') || 'Barbershop',
    barbeiros: [],
    servicos: [],
    servicosAll: [],
    settings: {},
    stores: [],
    currentStoreId: null,
    optimization: { tickets: [], devices: [], summary: null, currentTicket: null },
    reports: { rows: [], stats: null, filtersLoaded: false },
    serviceEditId: null,
    agendaDensity: localStorage.getItem('hair_agenda_density') || (window.innerWidth <= 640 ? 'compact' : 'detailed')
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    // Proteção de Rota: Redirecionamento inteligente
    const isLoginPage = window.location.pathname.includes('login.html');
    if (!state.token && !isLoginPage) {
        window.location.href = 'login.html';
        return;
    } else if (state.token && isLoginPage) {
        window.location.href = 'dashboard-improved.html';
    }

    initUI();
    updateDensityUI();
    if (state.token) {
        mostrarDashboard();
    }
    ensureServiceWorkerRegistration().catch(() => {});
    updateNotificationPermissionButton();
    updatePwaInstallButton();
});

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPwaInstallPrompt = event;
    updatePwaInstallButton();
    updatePwaSettingsCard(); // atualiza card na aba Ajustes se estiver aberta
});

window.addEventListener('appinstalled', () => {
    deferredPwaInstallPrompt = null;
    localStorage.setItem('hair_pwa_installed', '1');
    updatePwaInstallButton();
    updatePwaSettingsCard();
    showToast('Aplicativo instalado com sucesso! 🎉', 'success');
});

function initUI() {
    // Logo persistido
    if (localStorage.logo) {
        const img = document.getElementById('logoImg');
        img.src = localStorage.logo;
        img.classList.remove('hidden');
        document.getElementById('logoIcon').classList.add('hidden');
    }

    // Data de hoje formatada
    const dateLabel = document.getElementById('todayDateLabel');
    if (dateLabel) {
        dateLabel.textContent = new Date().toLocaleDateString('pt-BR', {
            weekday: 'long', day: '2-digit', month: 'short'
        });
    }

    // Estado inicial do Dark Mode
    const savedDarkMode = localStorage.getItem('hair_dark_mode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isInitialDark = savedDarkMode !== null ? savedDarkMode === 'true' : prefersDark;

    document.documentElement.classList.toggle('dark', isInitialDark);
    document.documentElement.dataset.theme = isInitialDark ? 'dark' : 'light';
    updateDarkModeUI(isInitialDark);

    // Listener para mudanças no sistema (só aplica se o usuário não tiver uma preferência fixa)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (localStorage.getItem('hair_dark_mode') === null) {
            document.documentElement.classList.toggle('dark', e.matches);
            document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
            updateDarkModeUI(e.matches);
            if (state.activeView === 'relatorios') loadDetailedStats();
        }
    });

    const darkToggle = document.getElementById('darkModeToggle');
    if (darkToggle) darkToggle.onclick = toggleDarkMode;

    populateServiceSelects();
    
    // Configura botões de ação global
    // Removido o override manual para não conflitar com o onclick do HTML
    // O loadData() já é chamado diretamente pelo botão de atualizar

    // Fechar modais ao clicar fora
    ['editModal', 'manualAppointmentModal', 'serviceModal', 'unavailableDayModal', 'notificationCenter', 'confirmationModal', 'barberModal', 'storeModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', e => { if (e.target.id === id) el.classList.add('hidden'); });
    });

    // Re-renderiza o calendário ao girar o dispositivo ou redimensionar a janela
    // (o número de dias exibidos muda entre mobile/desktop)
    window.addEventListener('resize', debounce(() => {
        if (state.activeView === 'calendario') renderCalendar();
    }, 250));
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('hair_dark_mode', isDark);
    updateDarkModeUI(isDark);
    if (state.activeView === 'relatorios') loadDetailedStats(); // Recarrega estatísticas para atualizar cores do gráfico
}

function updateDarkModeUI(isDark) {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    const icon = btn.querySelector('i');
    const label = btn.querySelector('.nav-copy > span');
    const help = btn.querySelector('.nav-copy > small');
    
    if (isDark) {
        icon.className = 'fas fa-sun w-5 text-yellow-400';
        if (label) label.textContent = 'Modo claro';
        if (help) help.textContent = 'Tema escuro ativo';
        btn.setAttribute('aria-pressed', 'true');
    } else {
        icon.className = 'fas fa-moon w-5 text-slate-400';
        if (label) label.textContent = 'Modo escuro';
        if (help) help.textContent = 'Conforto visual';
        btn.setAttribute('aria-pressed', 'false');
    }
}

// --- AUTENTICAÇÃO ---
async function doLogin() {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const errorEl = document.getElementById('loginError');
    const btn = document.querySelector('#loginScreen button');
    
    if (!user || !pass) {
        triggerShake(btn);
        return showUIError(errorEl, 'Campos obrigatórios');
    }

    try {
        const res = await fetch(`${CONFIG.AUTH_API}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ 
                Username: user, 
                Password: pass 
            })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Falha no login');

        state.token = data.token;
        state.user.role = data.role || 'admin';
        state.user.barberId = data.barberId;
        state.user.storeId = data.storeId;
        state.storeName = data.storeName || 'Painel';
        state.businessType = data.businessType || 'Barbershop';

        localStorage.setItem('hair_token', data.token);
        localStorage.setItem('hair_role', state.user.role);
        localStorage.setItem('hair_store_name', state.storeName);
        localStorage.setItem('hair_business_type', state.businessType);
        if (data.barberId) localStorage.setItem('hair_barberId', data.barberId);
        if (data.storeId) localStorage.setItem('hair_storeId', data.storeId);

        mostrarDashboard();
    } catch (e) {
        showUIError(errorEl, e.message);
    }
}

async function forgotPassword() {
    const user = prompt("Digite seu nome de usuário para receber uma nova senha no WhatsApp:");
    if (!user) return;

    try {
        showToast('Solicitando recuperação...', 'info');
        const res = await fetch(`${CONFIG.AUTH_API}/recover`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ Username: user })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        showToast('Erro ao solicitar recuperação', 'error');
    }
}

async function doLogout() {
    try {
        if (state.token) {
            await fetch(`${CONFIG.AUTH_API}/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${state.token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });
        }
    } catch (_) {}

    const keepDark = localStorage.getItem('hair_dark_mode');
    const keepPwa = localStorage.getItem('hair_pwa_installed');
    ['hair_token', 'hair_role', 'hair_barberId', 'hair_storeId', 'hair_store_name', 'hair_business_type', 'hair_bridge_url'].forEach(key => localStorage.removeItem(key));
    if (keepDark !== null) localStorage.setItem('hair_dark_mode', keepDark);
    if (keepPwa !== null) localStorage.setItem('hair_pwa_installed', keepPwa);
    window.location.reload();
}

function atualizarDashboard() {
    showToast('Atualizando dados...', 'info');
    loadData();
    loadBotStatus(true);
    carregarBarbeiros();
    loadServicesManager();
    updateHealthStatus();
}

// --- CORE ENGINE ---
/* ════════════════════════════════════════
   RÓTULOS POR TIPO DE NEGÓCIO (barbearia × lava-jato)
   A dashboard adapta termos conforme o businessType da loja logada.
════════════════════════════════════════ */
const BIZ_LABELS = {
    Barbershop: {
        emoji: '💈',
        icon: 'fa-scissors',
        proximos: 'Próximos cortes',
        agendamentosDoDia: 'Cortes de hoje',
        atendimento: 'em atendimentos',
        agendamentosFuturos: 'agendamentos futuros',
        agendamentoVazio: 'nenhum agendamento',
        agendamentoPlural: 'agendamentos',
        equipe: 'Equipe profissional',
        novoProfissional: 'Novo profissional',
        profissionalSingular: 'Profissional',
        profissionalPlural: 'profissionais',
        subtitleAgenda: 'Controle os cortes do dia, próximos horários e bloqueios.',
        semEquipe: 'Nenhum profissional cadastrado.',
        filtroTodos: 'Todos os profissionais',
        tituloAssinaturas: 'Clube de fidelidade',
        limitLabel1: 'Corte',
        limitLabel2: 'Barba',
        limitLabel3: 'Sobrancelha',
        limitLabelCombos: 'Combos',
        reportBarberTitle: 'Cortes por profissional',
        planIcon: 'fa-scissors',
        planServicosHtml: `
            <option value="*">Todos os serviços</option>
            <option value="Corte">Somente Corte</option>
            <option value="Barba">Somente Barba</option>
            <option value="Corte,Barba,CorteBarba,CorteSobrancelha,CorteBarbasobrancelha">Corte &amp; Barba (todos com corte ou barba)</option>
            <option value="Corte,CorteBarba,CorteSobrancelha,CorteBarbasobrancelha">Corte (simples e combos)</option>
            <option value="CorteBarba">Somente Corte + Barba</option>`,
        calLegenda: [
            { cor: '#dc2626', label: 'Corte' },
            { cor: '#d9901a', label: 'Barba' },
            { cor: '#2563eb', label: 'Sob.' },
            { cor: '#4f46e5', label: 'Combos' }
        ]
    },
    CarWash: {
        emoji: '🚗',
        icon: 'fa-car',
        proximos: 'Próximas lavagens',
        agendamentosDoDia: 'Lavagens de hoje',
        atendimento: 'em lavagens',
        agendamentosFuturos: 'lavagens futuras',
        agendamentoVazio: 'nenhuma lavagem',
        agendamentoPlural: 'lavagens',
        equipe: 'Boxes / Vagas',
        novoProfissional: 'Cadastrar box',
        profissionalSingular: 'Box',
        profissionalPlural: 'boxes',
        subtitleAgenda: 'Controle as lavagens do dia, horários por box e bloqueios de capacidade.',
        semEquipe: 'Nenhum box cadastrado. Cada box representa uma vaga de atendimento simultâneo — cadastre ao menos um para habilitar o agendamento.',
        filtroTodos: 'Todos os boxes',
        tituloAssinaturas: 'Clube Mensal',
        limitLabel1: 'Simples',
        limitLabel2: 'Completa',
        limitLabel3: 'Premium',
        limitLabelCombos: 'Polimento',
        reportBarberTitle: 'Lavagens por box',
        planIcon: 'fa-car',
        planServicosHtml: `
            <option value="*">Todos os serviços</option>
            <option value="Simples">Somente Simples</option>
            <option value="Completa">Somente Completa</option>
            <option value="Premium">Somente Premium</option>
            <option value="Polimento">Somente Polimento</option>`,
        calLegenda: [
            { cor: '#0ea5e9', label: 'Simples' },
            { cor: '#0369a1', label: 'Completa' },
            { cor: '#7c3aed', label: 'Premium' },
            { cor: '#059669', label: 'Polimento' }
        ]
    },
    Pizzeria: {
        emoji: '🍕',
        icon: 'fa-pizza-slice',
        proximos: 'Próximos pedidos',
        agendamentosDoDia: 'Pedidos de hoje',
        atendimento: 'em pedidos',
        agendamentosFuturos: 'pedidos futuros',
        agendamentoVazio: 'nenhum pedido',
        agendamentoPlural: 'pedidos',
        equipe: 'Equipe',
        novoProfissional: 'Adicionar à equipe',
        profissionalSingular: 'Colaborador',
        profissionalPlural: 'colaboradores',
        subtitleAgenda: 'Controle pedidos, horários de entrega/retirada e bloqueios.',
        semEquipe: 'Nenhum colaborador cadastrado (a pizzaria atende por capacidade da loja).',
        filtroTodos: 'Toda a equipe',
        tituloAssinaturas: 'Programa de Fidelidade',
        limitLabel1: 'Pizza',
        limitLabel2: 'Bebida',
        limitLabel3: 'Combo',
        limitLabelCombos: 'Outros',
        reportBarberTitle: 'Pedidos por colaborador',
        planIcon: 'fa-pizza-slice',
        planServicosHtml: `
            <option value="*">Todos os pedidos</option>
            <option value="Pizza">Somente Pizzas</option>
            <option value="Bebida">Somente Bebidas</option>
            <option value="Combo">Somente Combos</option>`,
        calLegenda: [
            { cor: '#ef4444', label: 'Pizza' },
            { cor: '#f59e0b', label: 'Bebida' },
            { cor: '#4f46e5', label: 'Combo' },
            { cor: '#10b981', label: 'Outros' }
        ]
    },
    ComputerOptimization: {
        emoji: '🖥️',
        icon: 'fa-desktop',
        proximos: 'Próximos atendimentos',
        agendamentosDoDia: 'Atendimentos de hoje',
        atendimento: 'em otimização',
        agendamentosFuturos: 'atendimentos futuros',
        agendamentoVazio: 'nenhuma otimização',
        agendamentoPlural: 'atendimentos',
        equipe: 'Operadores',
        novoProfissional: 'Novo operador',
        profissionalSingular: 'Operador',
        profissionalPlural: 'operadores',
        subtitleAgenda: 'Controle fila, checklist e status das otimizações.',
        semEquipe: 'Nenhum operador cadastrado (a loja atende por capacidade da unidade).',
        filtroTodos: 'Todos os operadores',
        tituloAssinaturas: 'Pós-atendimento',
        limitLabel1: 'Windows',
        limitLabel2: 'Gamer',
        limitLabel3: 'Formatação',
        limitLabelCombos: 'Completo',
        reportBarberTitle: 'Otimizações por operador',
        planIcon: 'fa-desktop',
        planServicosHtml: `
            <option value="*">Todos os pacotes</option>
            <option value="Windows">Windows</option>
            <option value="Gamer">Gamer</option>
            <option value="Formatacao">Formatação</option>
            <option value="Completo">Completo</option>`,
        calLegenda: [
            { cor: '#3b82f6', label: 'Windows' },
            { cor: '#8b5cf6', label: 'Gamer' },
            { cor: '#06b6d4', label: 'Formatação' },
            { cor: '#10b981', label: 'Completo' }
        ]
    }
};

function biz() {
    return BIZ_LABELS[state.businessType] || BIZ_LABELS.Barbershop;
}

function usesProfessionalScheduling() {
    return state.businessType === 'Barbershop';
}

function isComputerOptimization() {
    return state.businessType === 'ComputerOptimization';
}

function applyTechNavigation() {
    const tech = isComputerOptimization();
    document.body.classList.toggle('business-tech', tech);
    document.querySelectorAll('[data-tech-nav="true"]').forEach(el => el.classList.toggle('hidden', !tech));
    ['agenda', 'calendario', 'assinaturas', 'automacoes', 'relatorios'].forEach(view => {
        document.querySelectorAll(`[data-view-button="${view}"]`).forEach(el => el.classList.toggle('hidden', tech));
    });
    document.getElementById('btnAgendar')?.classList.toggle('hidden', tech);
    document.getElementById('barberFilter')?.classList.toggle('hidden', tech || !usesProfessionalScheduling());
    if (tech && ['agenda', 'calendario', 'assinaturas', 'automacoes', 'relatorios'].includes(state.activeView)) {
        showView('tech-overview');
    }
}

// Aplica os rótulos do ramo em todos os elementos marcados com data-biz="<chave>".
function applyBusinessLabels() {
    const labels = biz();
    document.querySelectorAll('[data-biz]').forEach(el => {
        const key = el.getAttribute('data-biz');
        if (labels[key] != null) el.textContent = labels[key];
    });
    // Filtro de profissionais (opção "Todos")
    document.querySelectorAll('#barberFilter option[value=""], #reportBarber option[value=""]').forEach(o => o.textContent = labels.filtroTodos);
    document.querySelectorAll('#reportBarber, #calBarberFilter').forEach(el => {
        el.classList.toggle('hidden', !usesProfessionalScheduling());
    });
    // Subtítulo da agenda (se estiver na view agenda)
    if (state.activeView === 'agenda') updateText('pageSubtitle', labels.subtitleAgenda);

    // Ícone do sidebar (tesoura → carro → computador etc.)
    const logoIconEl = document.getElementById('logoIcon');
    if (logoIconEl && !logoIconEl.classList.contains('hidden')) {
        logoIconEl.className = `fas ${labels.icon} text-lg`;
    }

    // Ícone no template de card de agendamento (detail pill de serviço)
    const tplServicePill = document.querySelector('#tpl-appointment-card .appointment-detail-pill:first-child i');
    if (tplServicePill) tplServicePill.className = `fas ${labels.icon}`;

    // Legenda inline do calendário
    const calLegendaEl = document.getElementById('calLegendaInline');
    if (calLegendaEl && labels.calLegenda) {
        calLegendaEl.innerHTML = labels.calLegenda
            .map(l => `<span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm" style="background:${l.cor}"></span>${l.label}</span>`)
            .join('');
    }

    // Opções de serviços permitidos no modal de criação/edição de planos
    const planServSel = document.getElementById('planModalServicos');
    if (planServSel && labels.planServicosHtml) {
        // Preserva opção personalizada aberta se houver
        const customOpt = Array.from(planServSel.options).find(o => o.dataset.custom);
        planServSel.innerHTML = labels.planServicosHtml;
        if (customOpt) planServSel.appendChild(customOpt);
    }
    applyTechNavigation();
}

function mostrarDashboard() {
    // Removido loginScreen pois agora usamos login.html independente
    applyBusinessLabels();
    initSubscriptionNav();
    switchAgendaTab('hoje'); // garante "Hoje" ativo por padrão no mobile

    // Restrições de interface para Barbeiros
    if (state.user.role === 'barbeiro') {
        document.getElementById('sectionBarbeiros')?.classList.add('hidden');
        document.querySelectorAll('[data-view-button="automacoes"], [data-view-button="configuracoes"]').forEach(el => el.classList.add('hidden'));
        document.getElementById('barberFilter')?.classList.add('hidden');
        document.getElementById('safeCleanupBtn')?.classList.add('hidden');
        updateText('pageTitle', 'Minha Agenda');
    } else if (usesProfessionalScheduling()) {
        document.getElementById('barberFilter')?.classList.remove('hidden');
    } else {
        document.getElementById('barberFilter')?.classList.add('hidden');
    }

    // Aplica o nome do estabelecimento na UI
    const sidebarName = document.getElementById('sidebarStoreName');
    if (sidebarName) sidebarName.textContent = state.storeName;

    loadModuleAccess().then(() => applyModuleVisibility()).catch(() => applyModuleVisibility());

    // Escalonamento do burst inicial: evita que 5 requests concorrentes travem o SQLite
    // e a bridge logo no carregamento. loadData tem prioridade máxima (agenda visível primeiro).
    loadData();
    setTimeout(() => loadBotStatus(true),     400);
    setTimeout(() => carregarBarbeiros(),      700);
    setTimeout(() => loadServicesManager(),    900);
    setTimeout(() => loadDiagnostics(),        1000);
    setTimeout(() => updateHealthStatus(),    1100);
    setTimeout(() => initSignalR(),           1300);

    // Timers de sincronização são criados apenas uma vez
    if (!dashboardIntervalsStarted) {
        dashboardIntervalsStarted = true;
        setInterval(() => { if (!document.hidden) loadData(); }, CONFIG.REFRESH_INTERVAL);
        setInterval(() => { if (!document.hidden) loadBotStatus(); }, CONFIG.BOT_STATUS_INTERVAL);
        setInterval(() => updateHealthStatus(), CONFIG.HEALTH_INTERVAL);
    }
}

async function apiFetch(path, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || CONFIG.API_TIMEOUT_MS);
    const headers = {
        // Padrão de segurança Authorization Bearer
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...options.headers
    };

    try {
        const { timeoutMs, ...fetchOptions } = options;
        const res = await fetch(`${CONFIG.API_BASE}${path}`, { ...fetchOptions, headers, signal: controller.signal });
        
        if (res.status === 401) {
            doLogout();
            throw new Error('Sessão expirada');
        }

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Erro ${res.status}`);
        }

        return res;
    } catch (e) {
        if (e.name === 'AbortError') {
            throw new Error('Tempo limite excedido. Verifique se o sistema local esta aberto.');
        }
        console.error(`API Error [${path}]:`, e);
        throw e;
    } finally {
        clearTimeout(timeoutId);
    }
}

// --- REAL-TIME (SIGNALR) ---
function initSignalR() {
    if (typeof signalR === 'undefined') {
        console.warn('SignalR não carregado. Notificações em tempo real desativadas.');
        setRealtimeStatusUI('offline');
        return;
    }
    if (state.notificationConnection) return;
    if (state.notificationReconnectTimer) {
        clearTimeout(state.notificationReconnectTimer);
        state.notificationReconnectTimer = null;
    }
    setRealtimeStatusUI('loading');

    const connection = new signalR.HubConnectionBuilder()
        .withUrl(CONFIG.HUB_URL, {
            transport: signalR.HttpTransportType.LongPolling
        })
        .withAutomaticReconnect()
        .build();
    state.notificationConnection = connection;

    connection.on("ReceiveNotification", (notification) => {
        console.debug("Notificação recebida:", notification);
        handleRealtimeNotification(notification);
    });

    connection.onreconnecting(() => {
        setRealtimeStatusUI('loading');
        console.info('[Realtime] Reconectando notificações em tempo real.');
    });
    connection.onreconnected(() => {
        setRealtimeStatusUI('online');
        console.info('[Realtime] Notificações em tempo real reconectadas.');
        loadData();
        if (state.activeView === 'relatorios') loadReports(false);
    });
    connection.onclose(() => {
        setRealtimeStatusUI('offline');
        state.notificationConnection = null;
        state.notificationReconnectTimer = setTimeout(initSignalR, 5000);
    });
    connection.start()
        .then(() => setRealtimeStatusUI('online'))
        .catch(err => {
            console.error("Erro ao conectar SignalR:", err);
            setRealtimeStatusUI('offline');
            state.notificationConnection = null;
            state.notificationReconnectTimer = setTimeout(initSignalR, 5000);
        });
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.token) {
        loadData();
        if (state.activeView === 'relatorios') loadReports(false);
        if (typeof signalR !== 'undefined' && state.notificationConnection?.state === signalR.HubConnectionState.Disconnected) {
            initSignalR();
        }
    }
});

function handleRealtimeNotification(notification) {
    // 4.8: filtra alertas por loja — cada dashboard mostra apenas os próprios eventos.
    // Superadmin vê tudo; notificações sem storeId (sistema/global) também passam.
    const data = notification.Data || notification.data || {};
    const notifStoreId = data.storeId ?? data.StoreId;
    const role = state.user?.role || localStorage.getItem('hair_role');
    const myStoreId = state.user?.storeId ?? localStorage.getItem('hair_storeId');
    if (notifStoreId && role !== 'superadmin' && String(notifStoreId) !== String(myStoreId)) {
        return; // alerta de outra loja — ignora
    }

    const id = getNotificationId(notification);
    if (id && state.seenNotificationIds.has(id)) return;
    rememberNotificationId(id);

    state.notifications.unshift(notification);
    state.notifications = state.notifications.slice(0, 50);
    updateNotificationBadge();
    renderNotificationCenter();

    displayWebNotification(notification).catch(err => console.warn('Notificação nativa indisponível:', err));

    const details = getNotificationDetails(notification);
    showToast(`<strong>${escapeHtml(details.title)}</strong><br>${escapeHtml(details.body).replace(/\n/g, '<br>')}`, 'info');

    const type = notification.Type ?? notification.type;
    if (isNewAppointmentNotification(notification)) {
        playNotificationSound();
        if (navigator.vibrate) navigator.vibrate([160, 80, 160]);
    }

    if ([0, 1, 2, 5, "NewAppointment", "ConfirmedAppointment", "CancelledAppointment", "RescheduledAppointment"].includes(type)) {
        loadData();
        if (state.activeView === 'relatorios') loadReports(false);
    }
}

function getNotificationId(notification) {
    const data = notification.Data || notification.data || {};
    return data.eventKey || notification.Id || notification.id || [
        notification.Type ?? notification.type,
        data.appointmentId,
        data.clientName,
        data.service,
        data.dateTime || data.newDateTime,
        data.phoneNumber,
        data.barberName
    ].filter(Boolean).join('|');
}

function rememberNotificationId(id) {
    if (!id) return;
    state.seenNotificationIds.add(id);
    const lastIds = Array.from(state.seenNotificationIds).slice(-300);
    state.seenNotificationIds = new Set(lastIds);
    localStorage.setItem('hair_seen_notifications', JSON.stringify(lastIds));
    sessionStorage.setItem('hair_seen_notifications', JSON.stringify(lastIds));
}

function isNewAppointmentNotification(notification) {
    const type = notification.Type ?? notification.type;
    const data = notification.Data || notification.data || {};
    return type === 0
        || type === "NewAppointment"
        || String(data.eventKey || '').startsWith('new:');
}

function getNotificationDetails(notification) {
    const data = notification.Data || notification.data || {};
    const title = notification.Title || notification.title || 'Notificação';
    const client = data.clientName || 'Cliente';
    const service = data.service || 'Serviço';
    const barber = data.barberName || 'Profissional';
    const time = data.time || (data.dateTime ? formatTime(new Date(data.dateTime)) : '');
    const phone = data.phoneNumber || data.phone || '';
    const origin = data.origin || 'Sistema';
    const message = notification.Message || notification.message || `${client} - ${service}`;
    const body = `${message}${barber ? `\nProfissional: ${barber}` : ''}${time ? `\nHorário: ${time}` : ''}${phone ? `\nTelefone: ${phone}` : ''}\nOrigem: ${origin}`;
    return { title, body, tag: data.eventKey || getNotificationId(notification) || 'hair-notification' };
}

// Popula o select de serviço do agendamento manual com os SERVIÇOS REAIS DA LOJA
// (via /api/servicos), usando o ID numérico como value — barbearia mostra cortes,
// lava-jato mostra lavagens/polimentos, cada um com seu ID correto.
async function populateServiceSelects() {
    const select = document.getElementById('manualService');
    if (!select) return;
    select.innerHTML = '<option value="">Carregando serviços...</option>';
    try {
        const res = await apiFetch('/servicos');
        const items = await res.json();
        const actives = (Array.isArray(items) ? items : []).filter(s => (s.active ?? s.Active) !== false);
        state.servicos = actives;
        state.servicosAll = (Array.isArray(items) ? items : []).map(normalizeServiceItem);
        renderOnboardingChecklist();
        if (!actives.length) {
            select.innerHTML = '<option value="">Nenhum serviço cadastrado</option>';
            return;
        }
        select.innerHTML = actives.map(s => {
            const id = s.id ?? s.Id;
            const name = s.name ?? s.Name;
            const price = s.price ?? s.Price;
            const priceTxt = price != null ? ` — R$${Number(price).toFixed(0)}` : '';
            return `<option value="${id}">${escapeHtml(String(name))}${priceTxt}</option>`;
        }).join('');
        // Carrega os horários do primeiro serviço já selecionado
        updateManualAvailableSlots();
    } catch (e) {
        select.innerHTML = '<option value="">Erro ao carregar serviços</option>';
    }
}

function normalizeServiceItem(item = {}) {
    return {
        id: item.id ?? item.Id,
        name: item.name ?? item.Name ?? item.nome ?? item.Nome ?? 'Serviço',
        price: Number(item.price ?? item.Price ?? item.preco ?? item.Preco ?? 0),
        duration: Number(item.durationMinutes ?? item.DurationMinutes ?? item.duracaoMinutos ?? item.DuracaoMinutos ?? 30),
        active: (item.active ?? item.Active ?? item.ativo ?? item.Ativo ?? true) !== false,
        order: Number(item.order ?? item.Order ?? item.ordem ?? item.Ordem ?? 0),
        occupiesSlot: (item.occupiesSlot ?? item.OccupiesSlot ?? item.ocupaHorario ?? item.OcupaHorario ?? true) !== false
    };
}

async function loadServicesManager() {
    const lists = ['servicesManagerList', 'techServicesManagerList'].map(id => document.getElementById(id)).filter(Boolean);
    lists.forEach(list => {
        list.innerHTML = '<div class="col-span-full flex items-center gap-2 py-3 text-gray-400 text-sm font-semibold"><i class="fas fa-spinner fa-spin text-xs"></i> Carregando serviços...</div>';
    });
    try {
        const res = await apiFetch('/servicos');
        const items = await res.json();
        state.servicosAll = (Array.isArray(items) ? items : []).map(normalizeServiceItem)
            .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name), 'pt-BR'));
        state.servicos = state.servicosAll.filter(s => s.active);
        renderServicesManager();
        renderOnboardingChecklist();
        if (isComputerOptimization()) renderOptimizationOverview();
    } catch (e) {
        lists.forEach(list => { list.innerHTML = emptyStateUI('fa-triangle-exclamation', e.message || 'Erro ao carregar serviços.'); });
    }
}

function renderServicesManager() {
    const lists = ['servicesManagerList', 'techServicesManagerList'].map(id => document.getElementById(id)).filter(Boolean);
    if (!lists.length) return;
    if (!state.servicosAll.length) {
        lists.forEach(list => { list.innerHTML = emptyStateUI(isComputerOptimization() ? 'fa-screwdriver-wrench' : 'fa-scissors', 'Nenhum serviço cadastrado.'); });
        return;
    }
    const html = state.servicosAll.map(service => {
        const statusClass = service.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500';
        const statusText = service.active ? 'Ativo' : 'Inativo';
        if (isComputerOptimization()) {
            const normalizedName = service.name.toLowerCase();
            const focus = normalizedName.includes('gamer') || normalizedName.includes('fps')
                ? 'Jogos, FPS e estabilidade'
                : normalizedName.includes('format')
                    ? 'Sistema limpo e drivers ajustados'
                    : normalizedName.includes('premium') || normalizedName.includes('complet')
                        ? 'Revisão completa de desempenho'
                        : 'Windows mais rápido e responsivo';
            return `
                <article class="tech-service-card ${service.active ? '' : 'is-inactive'}">
                    <div class="tech-service-card__top">
                        <span class="tech-service-icon"><i class="fas fa-gauge-high"></i></span>
                        <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase ${statusClass}">${statusText}</span>
                    </div>
                    <h5>${escapeHtml(service.name)}</h5>
                    <p>${escapeHtml(focus)}</p>
                    <div class="tech-service-facts">
                        <span><i class="fas fa-wifi"></i> Remoto</span>
                        <span><i class="fas fa-clock"></i> ${service.duration} min</span>
                    </div>
                    <strong>${formatCurrency(service.price)}</strong>
                    <div class="tech-service-actions">
                        <button type="button" onclick="openOptimizationTicketFromService(${service.id})" class="btn btn-primary"><i class="fas fa-bolt"></i> Atender agora</button>
                        <button type="button" onclick="openServiceModal(${service.id})" class="btn btn-light" title="Editar pacote"><i class="fas fa-pen"></i></button>
                        <button type="button" onclick="toggleServiceActive(${service.id})" class="btn btn-light" title="${service.active ? 'Pausar pacote' : 'Ativar pacote'}"><i class="fas ${service.active ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                    </div>
                </article>`;
        }
        return `
            <article class="soft-panel p-4 border border-slate-100">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <h5 class="font-black text-gray-950 truncate">${escapeHtml(service.name)}</h5>
                        <p class="text-xs font-semibold text-gray-500 mt-1">${formatCurrency(service.price)} · ${service.duration} min</p>
                    </div>
                    <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase ${statusClass}">${statusText}</span>
                </div>
                <div class="grid grid-cols-3 gap-2 mt-4">
                    <button type="button" onclick="openServiceModal(${service.id})" class="btn btn-light text-xs px-2 py-2"><i class="fas fa-pen"></i> Editar</button>
                    <button type="button" onclick="toggleServiceActive(${service.id})" class="btn btn-light text-xs px-2 py-2"><i class="fas ${service.active ? 'fa-eye-slash' : 'fa-eye'}"></i> ${service.active ? 'Pausar' : 'Ativar'}</button>
                    <button type="button" onclick="deleteService(${service.id})" class="btn btn-light text-xs px-2 py-2 text-red-600"><i class="fas fa-trash"></i> Remover</button>
                </div>
            </article>
        `;
    }).join('');
    lists.forEach(list => { list.innerHTML = html; });
}

function openServiceModal(id = null) {
    const modal = document.getElementById('serviceModal');
    if (!modal) return;
    const service = id ? state.servicosAll.find(s => String(s.id) === String(id)) : null;
    state.serviceEditId = service?.id || null;
    updateText('serviceModalTitle', service ? (isComputerOptimization() ? 'Editar pacote' : 'Editar serviço') : (isComputerOptimization() ? 'Novo pacote de otimização' : 'Novo serviço'));
    document.getElementById('serviceModalId').value = service?.id || '';
    document.getElementById('serviceModalName').value = service?.name || '';
    document.getElementById('serviceModalPrice').value = service ? service.price : '';
    document.getElementById('serviceModalDuration').value = service ? service.duration : '30';
    document.getElementById('serviceModalActive').checked = service ? service.active : true;
    document.getElementById('serviceModalName').placeholder = isComputerOptimization() ? 'Ex: Otimização gamer' : 'Ex: Corte masculino';
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('serviceModalName')?.focus(), 50);
}

function closeServiceModal() {
    document.getElementById('serviceModal')?.classList.add('hidden');
    state.serviceEditId = null;
}

async function saveServiceModal() {
    const id = document.getElementById('serviceModalId')?.value || '';
    const name = document.getElementById('serviceModalName')?.value?.trim();
    const price = Number(document.getElementById('serviceModalPrice')?.value || 0);
    const duration = Number(document.getElementById('serviceModalDuration')?.value || 0);
    const active = !!document.getElementById('serviceModalActive')?.checked;

    if (!name) return showToast('Nome do serviço é obrigatório.', 'error');
    if (duration < 5 || duration > 480) return showToast('Duração deve ficar entre 5 e 480 minutos.', 'error');
    if (price < 0) return showToast('Preço não pode ser negativo.', 'error');

    const body = JSON.stringify({ Nome: name, Preco: price, DuracaoMinutos: duration, Ativo: active });
    try {
        await apiFetch(id ? `/servicos/${id}` : '/servicos', {
            method: id ? 'PATCH' : 'POST',
            body
        });
        showToast(id ? 'Serviço atualizado.' : 'Serviço criado.', 'success');
        closeServiceModal();
        await loadServicesManager();
        await populateServiceSelects();
        updateManualAvailableSlots();
    } catch (e) {
        showToast(e.message || 'Erro ao salvar serviço.', 'error');
    }
}

async function toggleServiceActive(id) {
    const service = state.servicosAll.find(s => String(s.id) === String(id));
    if (!service) return;
    try {
        await apiFetch(`/servicos/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ Nome: service.name, Preco: service.price, DuracaoMinutos: service.duration, Ativo: !service.active })
        });
        showToast(!service.active ? 'Serviço ativado.' : 'Serviço pausado.', 'success');
        await loadServicesManager();
        await populateServiceSelects();
    } catch (e) {
        showToast(e.message || 'Erro ao alterar serviço.', 'error');
    }
}

async function deleteService(id) {
    if (!confirm('Remover este serviço? Se houver agendamentos futuros, o sistema bloqueará a exclusão.')) return;
    try {
        await apiFetch(`/servicos/${id}`, { method: 'DELETE' });
        showToast('Serviço removido.', 'success');
        await loadServicesManager();
        await populateServiceSelects();
    } catch (e) {
        showToast(e.message || 'Erro ao remover serviço. Se ele já foi usado, desative-o em vez de excluir.', 'error');
    }
}

async function loadModuleAccess() {
    const res = await apiFetch('/modules');
    const data = await res.json();
    const modules = Array.isArray(data.modules) ? data.modules : [];
    state.modules = modules.reduce((acc, item) => {
        acc[item.Key || item.key] = item.Enabled ?? item.enabled ?? true;
        return acc;
    }, {});
}

function isModuleEnabled(key) {
    if (!state.modules || Object.keys(state.modules).length === 0) return true;
    return state.modules[key] !== false;
}

function applyModuleVisibility() {
    const moduleByView = {
        bot: 'whatsapp_bot',
        diagnostico: 'dashboard_analytics',
        automacoes: 'automations',
        relatorios: 'dashboard_analytics',
        configuracoes: 'multi_professionals'
    };

    Object.entries(moduleByView).forEach(([view, moduleKey]) => {
        const visible = isModuleEnabled(moduleKey) && !(state.user.role === 'barbeiro' && ['automacoes', 'configuracoes'].includes(view));
        document.querySelectorAll(`[data-view-button="${view}"]`).forEach(el => el.classList.toggle('hidden', !visible));
    });

    // ATENÇÃO: 'multi_professionals' controla a seção de equipe para TODOS os tamanhos de equipe,
    // inclusive lojas com 1 único funcionário (que precisa desta seção para configurar horários e PIX).
    // Não desative este módulo em lojas com 1 barbeiro.
    document.getElementById('sectionBarbeiros')?.classList.toggle('hidden', !isModuleEnabled('multi_professionals') || state.user.role === 'barbeiro');
    applyTechNavigation();
}

async function loadDiagnostics(showFeedback = false) {
    const checklist = document.getElementById('diagChecklist');
    if (checklist && showFeedback) checklist.innerHTML = '<div class="text-sm font-bold text-gray-400">Atualizando diagnóstico...</div>';
    try {
        const res = await apiFetch('/diagnostics');
        state.diagnostics = await res.json();
        renderDiagnostics();
        if (showFeedback) showToast('Diagnóstico atualizado.', 'success');
    } catch (e) {
        if (checklist) checklist.innerHTML = `<div class="text-sm font-bold text-red-500">Falha ao carregar diagnóstico: ${escapeHtml(e.message || 'erro')}</div>`;
        if (showFeedback) showToast(e.message || 'Erro ao carregar diagnóstico.', 'error');
    }
}

function renderDiagnostics() {
    const data = state.diagnostics || {};
    const health = data.health || {};
    const billing = data.billing || {};
    const whatsapp = data.whatsapp || {};
    const activity = data.activity || {};
    const checklist = Array.isArray(data.checklist) ? data.checklist : [];
    const modules = Array.isArray(data.modules) ? data.modules : [];
    const counts = data.counts || {};

    updateText('diagScore', `${Math.round(Number(health.score || 0))}%`);
    updateText('diagStatus', diagnosticStatusLabel(health.status));
    updateText('diagBilling', billing.daysUntilExpiry == null ? 'Sem vencimento' : `${billing.daysUntilExpiry} dia(s)`);
    updateText('diagBillingSub', billing.lastPayment ? `Último pagamento ${formatDiagDate(billing.lastPayment.confirmedAt || billing.lastPayment.ConfirmedAt)}` : 'Sem histórico pago');
    updateText('diagWhatsapp', whatsapp.needsReconnect ? 'Atenção' : 'Conectado');
    updateText('diagWhatsappSub', whatsapp.status || 'sem leitura');
    updateText('diagActivity', `${activity.recentAppointments ?? 0} agend.`);
    updateText('diagActivitySub', `${formatCurrencyBR(activity.revenue30d || 0)} em 30 dias`);
    updateText('diagChecklistCount', `${checklist.length} itens`);
    updateText('diagModuleCount', `${modules.filter(m => (m.Enabled ?? m.enabled) === true).length}/${modules.length} ativos`);

    const checklistEl = document.getElementById('diagChecklist');
    if (checklistEl) {
        checklistEl.innerHTML = checklist.length ? checklist.map(item => {
            const severity = (item.severity || item.Severity || 'info').toLowerCase();
            const ok = item.ok ?? item.Ok;
            const icon = ok ? 'fa-circle-check text-green-600' : severity === 'critical' ? 'fa-circle-xmark text-red-500' : 'fa-triangle-exclamation text-amber-500';
            return `<div class="soft-panel p-3 flex items-start gap-3">
                <i class="fas ${icon} mt-0.5"></i>
                <div class="min-w-0">
                    <div class="font-black text-gray-950 text-sm">${escapeHtml(item.label || item.Label || 'Item')}</div>
                    <div class="text-xs font-semibold text-gray-500">${escapeHtml(item.message || item.Message || '')}</div>
                </div>
            </div>`;
        }).join('') : '<div class="text-sm font-bold text-gray-400">Nenhum item de checklist retornado.</div>';
    }

    const modulesEl = document.getElementById('diagModules');
    if (modulesEl) {
        modulesEl.innerHTML = modules.length ? modules.slice(0, 12).map(module => {
            const enabled = (module.Enabled ?? module.enabled) === true;
            const segmentSupported = (module.SegmentSupported ?? module.segmentSupported) !== false;
            const badge = !segmentSupported ? 'bg-slate-100 text-slate-500' : enabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
            const label = !segmentSupported ? 'Não aplicável' : enabled ? 'Ativo' : 'Preparado';
            return `<div class="soft-panel p-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                    <div class="font-black text-gray-950 text-sm truncate">${escapeHtml(module.Name || module.name || module.Key || module.key)}</div>
                    <div class="text-xs font-semibold text-gray-500 truncate">${escapeHtml(module.Description || module.description || '')}</div>
                </div>
                <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${badge}">${label}</span>
            </div>`;
        }).join('') : '<div class="text-sm font-bold text-gray-400">Nenhum módulo retornado.</div>';
    }

    const countsEl = document.getElementById('diagCounts');
    if (countsEl) {
        const cards = [
            ['Usuários', counts.users ?? 0],
            ['Admins', counts.admins ?? 0],
            ['Profissionais', counts.professionals ?? 0],
            ['Serviços', counts.services ?? 0],
            ['Agendamentos', counts.appointments ?? 0],
            ['Sessões bot', counts.botSessions ?? 0],
            ['Assinaturas ativas', counts.activeClientSubscriptions ?? 0],
            ['Tickets abertos', counts.openTechTickets ?? 0]
        ];
        countsEl.innerHTML = cards.map(([label, value]) =>
            `<div class="soft-panel p-3"><small class="font-black text-gray-400 uppercase text-[10px]">${label}</small><strong class="block text-lg font-black text-gray-950">${value}</strong></div>`
        ).join('');
    }
}

function diagnosticStatusLabel(status) {
    return ({ ready: 'Pronta para uso', attention: 'Exige atenção', critical: 'Crítica' })[status] || 'Sem leitura';
}

function formatCurrencyBR(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatDiagDate(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// --- LOADING STATE HELPER ---
// Exibe spinner temporário em listas para evitar que o operador ache que "sumiu"
// em conexões lentas. Substituído automaticamente pelo conteúdo real após o fetch.
function showListLoading(elementId, colspan = null) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const spinner = '<i class="fas fa-spinner fa-spin text-xs mr-1.5"></i> Carregando...';
    if (colspan) {
        el.innerHTML = `<tr><td colspan="${colspan}" class="py-8 text-center text-gray-400 text-sm font-semibold">${spinner}</td></tr>`;
    } else {
        el.innerHTML = `<div class="col-span-full flex items-center gap-2 py-4 text-gray-400 text-sm font-semibold">${spinner}</div>`;
    }
}

// --- GESTÃO DE DADOS ---
async function loadData() {
    if (isComputerOptimization()) {
        await loadOptimizationData();
        return;
    }

    if (state.isLoading) {
        state.pendingDataReload = true;
        return;
    }
    state.isLoading = true;
    setApiStatusUI('loading');

    // Mostra spinners nos containers da agenda enquanto os dados chegam
    const loadingHtml = '<div class="flex items-center gap-2 py-8 px-3 text-gray-400 text-sm font-semibold"><i class="fas fa-spinner fa-spin text-xs mr-1"></i> Carregando...</div>';
    [UI.hojeContainer(), UI.futurosContainer()].forEach(el => { if (el && !el.children.length) el.innerHTML = loadingHtml; });

    const barberId = usesProfessionalScheduling() ? document.getElementById('barberFilter')?.value : '';
    const queryString = barberId ? `?barberId=${barberId}` : '';

    try {
        const [hojeRes, agendRes] = await Promise.all([
            apiFetch(`/hoje${queryString}`).then(r => r.json()),
            apiFetch(`/agendamentos${queryString}`).then(r => r.json())
        ]);

        // Processamento de dados otimizado
        const futureData = Array.isArray(agendRes?.data) ? agendRes.data : (Array.isArray(agendRes) ? agendRes : []);
        const rawData = [...(Array.isArray(hojeRes) ? hojeRes : []), ...futureData];
        const normalized = rawData.map(normalizeAppointment);
        const merged = uniqueAppointments(normalized)
            .sort((a, b) => getAppointmentDate(a) - getAppointmentDate(b));
            
        const now = new Date();
        state.agenda.all = merged.filter(a => getAppointmentDate(a) >= new Date(now.getTime() - 86400000));
        state.agenda.today = state.agenda.all.filter(a => isSameDay(getAppointmentDate(a), now));
        state.agenda.future = state.agenda.all.filter(a => getAppointmentDate(a) > endOfDay(now));

        renderAgenda();
        loadUnavailableDays();
        setApiStatusUI('online');
    } catch (e) {
        setApiStatusUI('offline');
        showToast('Erro ao atualizar dados', 'error');
    } finally {
        state.isLoading = false;
        UI.lastUpdate().textContent = `Atualizado às ${new Date().toLocaleTimeString()}`;
        if (state.pendingDataReload) {
            state.pendingDataReload = false;
            setTimeout(loadData, 250);
        }
    }
}

// --- DENSIDADE DA AGENDA (detalhado / compacto) ---

function toggleAgendaDensity() {
    state.agendaDensity = state.agendaDensity === 'detailed' ? 'compact' : 'detailed';
    localStorage.setItem('hair_agenda_density', state.agendaDensity);
    updateDensityUI();
    renderAgenda();
}

function updateDensityUI() {
    const isCompact = state.agendaDensity === 'compact';
    const icon  = document.getElementById('agendaDensityIcon');
    const label = document.getElementById('agendaDensityLabel');
    const btn   = document.getElementById('agendaDensityBtn');
    if (icon)  icon.className  = isCompact ? 'fas fa-expand-alt' : 'fas fa-compress-alt';
    if (label) label.textContent = isCompact ? 'Detalhado' : 'Compacto';
    if (btn)   btn.title = isCompact ? 'Voltar para modo detalhado' : 'Alternar para modo compacto';
}

// --- RENDERIZAÇÃO ---
function renderAgenda() {
    const search = document.getElementById('agendaSearch')?.value.toLowerCase() || '';
    renderStats();

    const filterFn = a => !search
        || a.ContactName?.toLowerCase().includes(search)
        || a.PhoneNumber?.includes(search)
        || a.Servico?.toLowerCase().includes(search)
        || a.BarberName?.toLowerCase().includes(search);

    // Renderização usando Fragmentos de Documento (Melhor performance)
    const hojeItems = state.agenda.today.filter(filterFn);
    const futureItems = state.agenda.future.filter(filterFn);
    const emptyHoje = search ? 'Nenhum resultado para esta busca' : 'Nenhum agendamento hoje 🎉';
    const emptyFuturos = search ? 'Nenhum resultado para esta busca' : `Sem ${biz().proximos.toLowerCase()} no período`;
    renderList(UI.hojeContainer(), hojeItems, true, 'fa-calendar-check', emptyHoje);
    renderList(UI.futurosContainer(), futureItems, false, 'fa-calendar-days', emptyFuturos);
    if (state.activeView === 'calendario') renderCalendar();
}

function renderList(container, items, isToday, icon, emptyMsg) {
    if (!items.length) {
        container.innerHTML = emptyStateUI(icon, emptyMsg);
        container.classList.remove('agenda-compact');
        return;
    }
    const isCompact = state.agendaDensity === 'compact';
    container.classList.toggle('agenda-compact', isCompact);
    container.classList.toggle('space-y-3', !isCompact);
    container.classList.toggle('space-y-0', isCompact);
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    items.forEach(item => fragment.appendChild(createAppointmentElement(item, isToday)));
    container.appendChild(fragment);
}

function serviceTheme(service = '') {
    const normalized = String(service)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const hasCorte = normalized.includes('corte');
    const hasBarba = normalized.includes('barba');
    const hasSobrancelha = normalized.includes('sobrancelha') || normalized.includes('sombrancelha');

    if (hasCorte && hasBarba && hasSobrancelha) return { className: 'appointment-service--complete', accent: '#4f46e5', wash: 'rgba(79, 70, 229, 0.34)' };
    if (hasCorte && hasBarba) return { className: 'appointment-service--corte-barba', accent: '#ea580c', wash: 'rgba(234, 88, 12, 0.34)' };
    if (hasCorte && hasSobrancelha) return { className: 'appointment-service--corte-sobrancelha', accent: '#7c3aed', wash: 'rgba(124, 58, 237, 0.34)' };
    if (hasBarba && hasSobrancelha) return { className: 'appointment-service--barba-sobrancelha', accent: '#0f766e', wash: 'rgba(15, 118, 110, 0.34)' };
    if (hasBarba) return { className: 'appointment-service--barba', accent: '#d9901a', wash: 'rgba(217, 144, 26, 0.38)' };
    if (hasSobrancelha) return { className: 'appointment-service--sobrancelha', accent: '#2563eb', wash: 'rgba(37, 99, 235, 0.34)' };
    if (hasCorte) return { className: 'appointment-service--corte', accent: '#dc2626', wash: 'rgba(220, 38, 38, 0.34)' };
    return { className: 'appointment-service--default', accent: '#0e8f7e', wash: 'rgba(14, 143, 126, 0.28)' };
}

function createAppointmentElement(a, isToday) {
    if (state.agendaDensity === 'compact') return createAppointmentElementCompact(a, isToday);
    const template = document.getElementById('tpl-appointment-card');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('article');
    const date = getAppointmentDate(a);
    const confirmed = isAppointmentConfirmed(a);

    card.classList.add(confirmed ? 'appointment-card--confirmed' : 'appointment-card--pending');
    const theme = serviceTheme(a.Servico);
    card.classList.add(theme.className);
    card.style.setProperty('--service-accent', theme.accent);
    card.style.setProperty('--service-wash', theme.wash);
    card.style.setProperty('border-left-color', theme.accent, 'important');
    card.style.setProperty('background', `linear-gradient(90deg, ${theme.wash} 0%, color-mix(in srgb, ${theme.accent} 16%, transparent) 58%, transparent 100%), var(--surface)`, 'important');
    if (a.BarberColor) card.style.setProperty('--barber-color', a.BarberColor);
    clone.querySelector('.js-name').textContent = a.ContactName;
    clone.querySelector('.js-service').textContent = a.Servico;
    clone.querySelector('.js-barber').textContent = a.BarberName || `${biz().profissionalSingular} não definido`;
    clone.querySelector('.js-barber-dot').style.backgroundColor = a.BarberColor || 'var(--barber-color, #64748b)';
    clone.querySelector('.js-phone').textContent = a.PhoneNumber || 'Sem telefone';
    clone.querySelector('.js-time').textContent = formatTime(date);
    clone.querySelector('.js-date').textContent = isToday
        ? 'Hoje'
        : date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
    clone.querySelector('.js-price').textContent = formatCurrency(a.Preco);

    // Duração: preenche pill se disponível
    const durMin = a.DuracaoMinutos || a.duracaoMinutos;
    const durPill = clone.querySelector('.js-duration-pill');
    if (durMin && durMin > 0) {
        const h = Math.floor(durMin / 60);
        const m = durMin % 60;
        clone.querySelector('.js-duration').textContent = h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`;
    } else if (durPill) {
        durPill.style.display = 'none';
    }

    if (a.Notes) {
        const note = document.createElement('p');
        note.className = 'appointment-note';
        note.textContent = `Obs: ${a.Notes}`;
        card.querySelector('.js-actions')?.before(note);
    }

    const badge = clone.querySelector('.js-status-badge');
    badge.textContent = confirmed ? 'Confirmado' : 'Pendente';
    badge.classList.add(confirmed ? 'bg-green-100' : 'bg-yellow-100', confirmed ? 'text-green-700' : 'text-yellow-700');

    const confirmButton = clone.querySelector('.js-btn-confirm');
    if (confirmed) {
        confirmButton.innerHTML = '<i class="fas fa-check-double"></i><span>Confirmado</span>';
        confirmButton.disabled = true;
        confirmButton.classList.add('opacity-70', 'cursor-not-allowed');
    } else {
        confirmButton.onclick = () => confirmarPresença(a.Id, confirmButton);
    }
    
    clone.querySelector('.js-btn-edit').onclick = () => editarAgendamento(a.Id);
    clone.querySelector('.js-btn-cancel').onclick = () => cancelarAgendamento(a.Id);

    return clone;
}

function createAppointmentElementCompact(a, isToday) {
    const template = document.getElementById('tpl-appointment-card-compact');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('article');
    const date = getAppointmentDate(a);
    const confirmed = isAppointmentConfirmed(a);
    const theme = serviceTheme(a.Servico);

    // Classes e cores de serviço (preservadas do modo detalhado)
    card.classList.add(
        confirmed ? 'appointment-card--confirmed' : 'appointment-card--pending',
        theme.className
    );
    card.style.setProperty('--service-accent', theme.accent);
    card.style.setProperty('border-left-color', theme.accent, 'important');
    // Wash mais sutil que no modo detalhado (card menor)
    card.style.setProperty(
        'background',
        `linear-gradient(90deg, ${theme.wash} 0%, color-mix(in srgb, ${theme.accent} 8%, transparent) 40%, transparent 100%), var(--surface, #fff)`,
        'important'
    );
    if (a.BarberColor) card.style.setProperty('--barber-color', a.BarberColor);

    // Horário e data
    clone.querySelector('.js-time').textContent = formatTime(date);
    const dateEl = clone.querySelector('.js-date');
    if (isToday) {
        dateEl.textContent = '';
    } else {
        dateEl.textContent = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }

    // Status dot title (acessibilidade)
    const statusDot = clone.querySelector('.js-status-dot');
    statusDot.title = confirmed ? 'Confirmado' : 'Pendente';

    // Informações principais
    clone.querySelector('.js-name').textContent = a.ContactName;
    clone.querySelector('.js-service').textContent = a.Servico;
    clone.querySelector('.js-price').textContent = formatCurrency(a.Preco);

    // Bolinha do barbeiro
    const barberDot = clone.querySelector('.js-barber-dot');
    barberDot.style.backgroundColor = a.BarberColor || '#64748b';
    barberDot.title = a.BarberName || 'Profissional';

    // Botões de ação (ícone apenas)
    const confirmButton = clone.querySelector('.js-btn-confirm');
    if (confirmed) {
        confirmButton.innerHTML = '<i class="fas fa-check-double"></i>';
        confirmButton.disabled = true;
    } else {
        confirmButton.onclick = () => confirmarPresença(a.Id, confirmButton);
    }
    clone.querySelector('.js-btn-edit').onclick = () => editarAgendamento(a.Id);
    clone.querySelector('.js-btn-cancel').onclick = () => cancelarAgendamento(a.Id);

    return clone;
}

function renderStats() {
    const totalRevenue = state.agenda.all.reduce((s, a) => s + (a.Preco || 0), 0);
    const totalTime = state.agenda.today.reduce((s, a) => s + (a.DuracaoMinutos || 30), 0);
    const confirmedToday = state.agenda.today.filter(a => isAppointmentConfirmed(a)).length;
    const pendingToday = state.agenda.today.length - confirmedToday;

    UI.stats.hoje().textContent = state.agenda.today.length;
    UI.stats.futuros().textContent = state.agenda.future.length;
    UI.stats.faturamento().textContent = formatCurrency(totalRevenue);

    // Formato do tempo: 90min → "1h 30min"
    const totalH = Math.floor(totalTime / 60);
    const totalM = totalTime % 60;
    const tempoLabel = totalH > 0 ? `${totalH}h${totalM > 0 ? ` ${totalM}min` : ''}` : `${totalTime}min`;
    UI.stats.tempo().textContent = tempoLabel;

    // Sub-labels dos metric cards
    const subHoje = document.getElementById('countHojeConfirmados');
    if (subHoje) {
        if (state.agenda.today.length === 0) {
            subHoje.textContent = biz().agendamentoVazio;
        } else {
            subHoje.textContent = `${confirmedToday} confirmado${confirmedToday !== 1 ? 's' : ''} · ${pendingToday} pendente${pendingToday !== 1 ? 's' : ''}`;
        }
    }
    const subFuturos = document.getElementById('countFuturosLabel');
    if (subFuturos) {
        const days = [...new Set(state.agenda.future.map(a => {
            const d = getAppointmentDate(a);
            return d ? d.toDateString() : null;
        }).filter(Boolean))].length;
        subFuturos.textContent = days > 0 ? `em ${days} dia${days !== 1 ? 's' : ''}` : biz().agendamentoPlural;
    }

    // Atualiza badges das abas mobile
    const badgeHoje    = document.getElementById('agendaTabHojeCount');
    const badgeFuturos = document.getElementById('agendaTabFuturosCount');
    if (badgeHoje)    badgeHoje.textContent    = state.agenda.today.length;
    if (badgeFuturos) badgeFuturos.textContent = state.agenda.future.length;

    renderOwnerCockpit();
    if (state.activeView === 'clientes' && state.clientes.length) renderClientsView();
}

function renderOwnerCockpit() {
    const today = [...state.agenda.today].sort((a, b) => getAppointmentDate(a) - getAppointmentDate(b));
    const future = [...state.agenda.future].sort((a, b) => getAppointmentDate(a) - getAppointmentDate(b));
    const now = new Date();
    const next = today.find(a => getAppointmentDate(a) >= now) || future[0];
    const confirmed = today.filter(isAppointmentConfirmed).length;
    const pending = today.length - confirmed;
    const revenueToday = today.reduce((sum, a) => sum + Number(a.Preco || 0), 0);
    const servicesByName = [...today, ...future].reduce((acc, a) => {
        const name = a.Servico || 'Serviço';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
    }, {});
    const topService = Object.entries(servicesByName).sort((a, b) => b[1] - a[1])[0];
    const connected = !!(state.bot?.whatsappConnected || state.bot?.connectionState === 'ONLINE' || state.bot?.state === 'ONLINE');
    const botEnabled = !!state.bot?.botEnabled;

    updateText('cockpitTodayCount', today.length);
    updateText('cockpitNextTime', next ? `Próximo: ${formatTime(getAppointmentDate(next))} · ${next.ContactName || 'Cliente'}` : 'sem próximo horário');
    updateText('cockpitTodayRevenue', formatCurrency(revenueToday));
    updateText('cockpitPendingCount', `${pending} pendente${pending !== 1 ? 's' : ''} · ${confirmed} concluído${confirmed !== 1 ? 's' : ''}`);
    updateText('cockpitWhatsAppStatus', connected ? 'Conectado' : 'Desconectado');
    updateText('cockpitBotStatus', botEnabled ? 'Bot respondendo' : 'Bot pausado ou aguardando');
    updateText('cockpitTopService', topService ? topService[0] : '-');
    updateText('cockpitTopServiceCount', topService ? `${topService[1]} marcação${topService[1] !== 1 ? 'ões' : ''}` : 'sem dados');

    const summary = today.length
        ? `${today.length} atendimento${today.length !== 1 ? 's' : ''} hoje, ${pending} pendente${pending !== 1 ? 's' : ''} e receita estimada de ${formatCurrency(revenueToday)}.`
        : 'Sem atendimentos hoje. Use as ações rápidas para criar agenda manual ou testar o bot.';
    updateText('ownerSummaryText', summary);

    renderOnboardingChecklist();
}

function renderOnboardingChecklist() {
    const activeServices = (state.servicosAll.length ? state.servicosAll : state.servicos)
        .filter(s => (s.active ?? s.Active ?? s.ativo ?? s.Ativo) !== false);
    const activePros = (state.barbeiros || []).filter(b => (b.Ativo ?? b.ativo ?? true) !== false);
    const connected = !!(state.bot?.whatsappConnected || state.bot?.connectionState === 'ONLINE' || state.bot?.state === 'ONLINE');
    const botEnabled = !!state.bot?.botEnabled;
    const hasHours = !!(state.settings.HorárioAbertura || state.settings.HorarioAbertura) && !!(state.settings.HorárioFechamento || state.settings.HorarioFechamento);
    const hasAutomations = !!(state.settings.Msg_Welcome || state.settings.Msg_Confirmation);
    const hasAgendaValidation = state.agenda.all.length > 0;

    const items = [
        { label: 'Dados da loja definidos', done: !!state.storeName && state.storeName !== 'Painel' },
        { label: 'Horários de funcionamento revisados', done: hasHours },
        { label: 'Serviços ativos cadastrados', done: activeServices.length >= 3 },
        { label: 'Profissionais ativos cadastrados', done: activePros.length >= 1 },
        { label: 'WhatsApp conectado', done: connected },
        { label: 'Bot automático ativo', done: connected && botEnabled },
        { label: 'Agenda validada com teste real', done: hasAgendaValidation },
        { label: 'Mensagens automáticas revisadas', done: hasAutomations }
    ];
    const done = items.filter(i => i.done).length;
    const list = document.getElementById('onboardingChecklist');
    const badge = document.getElementById('ownerReadinessBadge');
    updateText('onboardingProgress', `${done}/${items.length}`);
    if (badge) {
        badge.textContent = done === items.length ? 'Pronta para uso' : `Faltam ${items.length - done}`;
        badge.className = `px-3 py-1 rounded-full text-xs font-black uppercase whitespace-nowrap ${done === items.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`;
    }
    if (!list) return;
    list.innerHTML = items.map(item => `
        <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
            <span class="font-bold text-gray-700">${escapeHtml(item.label)}</span>
            <span class="text-xs font-black ${item.done ? 'text-green-600' : 'text-amber-600'}">
                <i class="fas ${item.done ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i>
                ${item.done ? 'feito' : 'pendente'}
            </span>
        </div>
    `).join('');
}

async function loadClients() {
    const list = document.getElementById('clientsList');
    if (list) {
        list.innerHTML = '<div class="col-span-full flex items-center gap-2 py-6 text-gray-400 text-sm font-semibold"><i class="fas fa-spinner fa-spin text-xs"></i> Carregando clientes...</div>';
    }
    try {
        const res = await apiFetch('/customers?inactiveDays=60');
        const payload = await res.json();
        state.clientes = (Array.isArray(payload?.data) ? payload.data : []).map(normalizeCrmCustomer);
        state.crm.summary = payload?.summary || null;
        state.crm.tags = Array.isArray(payload?.tags) ? payload.tags : [];
        state.crm.segments = payload?.segments || null;
    } catch (e) {
        const from = dateInput(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
        const to = dateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
        try {
            const res = await apiFetch(`/reports/appointments?from=${from}&to=${to}&pageSize=500`);
            const payload = await res.json();
            const rows = Array.isArray(payload?.data) ? payload.data : [];
            state.clientes = buildClientsFromAppointments(rows.map(normalizeAppointment));
        } catch {
            state.clientes = buildClientsFromAppointments(state.agenda.all);
        }
        state.crm.summary = null;
        state.crm.tags = [];
        state.crm.segments = null;
        showToast('CRM avançado indisponível; clientes carregados pela agenda visível.', 'info');
    }
    renderClientsView();
}

function buildClientsFromAppointments(rows = []) {
    const groups = new Map();
    rows.forEach(a => {
        const phone = (a.PhoneNumber || '').replace(/\D/g, '');
        const name = (a.ContactName || 'Cliente').trim();
        const key = phone || name.toLowerCase();
        if (!key) return;
        if (!groups.has(key)) groups.set(key, { name, phone, visits: 0, revenue: 0, last: null, next: null, services: new Map(), history: [] });
        const client = groups.get(key);
        client.name = name !== 'Cliente' ? name : client.name;
        client.phone = phone || client.phone;
        client.visits += 1;
        client.revenue += Number(a.Preco || 0);
        const dt = getAppointmentDate(a);
        if (dt) {
            if (!client.last || dt > client.last) client.last = dt;
            if (dt >= new Date() && (!client.next || dt < client.next)) client.next = dt;
        }
        if (a.Servico) client.services.set(a.Servico, (client.services.get(a.Servico) || 0) + 1);
        client.history.push(a);
    });
    const now = new Date();
    return Array.from(groups.values()).map(client => {
        const daysSinceLast = client.last ? Math.floor((now - client.last) / 86400000) : null;
        const topService = Array.from(client.services.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
        const status = daysSinceLast != null && daysSinceLast > 60 ? 'sumido' : client.visits > 1 ? 'recorrente' : 'novo';
        const customerKey = client.phone || `walkin-${client.name.toLowerCase().replace(/\W+/g, '-')}`;
        return normalizeCrmCustomer({
            customerKey,
            name: client.name,
            phoneNumber: client.phone,
            completedAppointments: client.visits,
            totalAppointments: client.visits,
            totalSpent: client.revenue,
            averageTicket: client.visits ? client.revenue / client.visits : 0,
            lastAppointmentAt: client.last,
            nextAppointmentAt: client.next,
            topService,
            status,
            statusLabel: crmStatusLabel(status),
            daysSinceLast,
            tags: [],
            history: client.history,
            events: [],
            reminders: []
        });
    }).sort((a, b) => (b.last?.getTime() || 0) - (a.last?.getTime() || 0));
}

function normalizeCrmCustomer(raw = {}) {
    const last = raw.lastAppointmentAt ? new Date(raw.lastAppointmentAt) : raw.last || null;
    const next = raw.nextAppointmentAt ? new Date(raw.nextAppointmentAt) : raw.next || null;
    const first = raw.firstAppointmentAt ? new Date(raw.firstAppointmentAt) : null;
    const status = raw.status || 'novo';
    return {
        ...raw,
        customerKey: raw.customerKey || raw.CustomerKey || raw.phoneNumber || raw.phone || '',
        name: raw.name || raw.Name || 'Cliente',
        phoneNumber: raw.phoneNumber || raw.PhoneNumber || raw.phone || '',
        firstAppointmentAt: first,
        lastAppointmentAt: last,
        nextAppointmentAt: next,
        last,
        next,
        completedAppointments: Number(raw.completedAppointments ?? raw.CompletedAppointments ?? raw.visits ?? 0),
        totalAppointments: Number(raw.totalAppointments ?? raw.TotalAppointments ?? raw.visits ?? 0),
        noShows: Number(raw.noShows ?? raw.NoShows ?? 0),
        cancellations: Number(raw.cancellations ?? raw.Cancellations ?? 0),
        totalSpent: Number(raw.totalSpent ?? raw.TotalSpent ?? raw.revenue ?? 0),
        averageTicket: Number(raw.averageTicket ?? raw.AverageTicket ?? 0),
        topService: raw.topService || raw.TopService || '-',
        preferredProfessional: raw.preferredProfessional || raw.PreferredProfessional || raw.manualPreferredProfessional || '-',
        commonTime: raw.commonTime || raw.CommonTime || '-',
        daysSinceLast: raw.daysSinceLast ?? raw.DaysSinceLast ?? null,
        averageReturnDays: raw.averageReturnDays ?? raw.AverageReturnDays ?? null,
        status,
        statusLabel: raw.statusLabel || raw.StatusLabel || crmStatusLabel(status),
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        internalNotes: raw.internalNotes ?? raw.InternalNotes ?? '',
        preferences: raw.preferences ?? raw.Preferences ?? '',
        preferredService: raw.preferredService ?? raw.PreferredService ?? '',
        manualPreferredProfessional: raw.manualPreferredProfessional ?? raw.ManualPreferredProfessional ?? '',
        bestTime: raw.bestTime ?? raw.BestTime ?? '',
        returnFrequencyDays: raw.returnFrequencyDays ?? raw.ReturnFrequencyDays ?? '',
        contactPreference: raw.contactPreference ?? raw.ContactPreference ?? '',
        birthday: raw.birthday ?? raw.Birthday ?? '',
        source: raw.source ?? raw.Source ?? '',
        pendingReminders: Number(raw.pendingReminders ?? raw.PendingReminders ?? 0),
        suggestedMessages: raw.suggestedMessages || raw.SuggestedMessages || {},
        history: Array.isArray(raw.history) ? raw.history : [],
        events: Array.isArray(raw.events) ? raw.events : [],
        reminders: Array.isArray(raw.reminders) ? raw.reminders : []
    };
}

function renderClientsView() {
    const list = document.getElementById('clientsList');
    if (!list) return;
    renderCrmFilterOptions();
    const search = (document.getElementById('crmSearch')?.value || '').toLowerCase();
    const status = document.getElementById('crmStatusFilter')?.value || '';
    const tagId = document.getElementById('crmTagFilter')?.value || '';
    const returnFilter = document.getElementById('crmReturnFilter')?.value || '';
    const serviceFilter = document.getElementById('crmServiceFilter')?.value || '';
    const clients = state.clientes.filter(c => {
        const haystack = `${c.name} ${c.phoneNumber} ${c.topService} ${c.preferredProfessional} ${(c.tags || []).map(t => t.name || t.Name).join(' ')}`.toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        const matchesStatus = !status || c.status === status;
        const matchesTag = !tagId || (c.tags || []).some(t => String(t.id ?? t.Id) === String(tagId));
        const matchesService = !serviceFilter || c.topService === serviceFilter;
        const matchesReturn = !returnFilter
            || (returnFilter === 'inactive' && ['sumido', 'em_risco', 'inativo'].includes(c.status))
            || (returnFilter === 'no-next' && !c.nextAppointmentAt)
            || (returnFilter === 'no-show' && c.noShows > 0)
            || (returnFilter === 'reminder' && c.pendingReminders > 0);
        return matchesSearch && matchesStatus && matchesTag && matchesService && matchesReturn;
    });
    const summary = state.crm.summary || {
        total: state.clientes.length,
        recurring: state.clientes.filter(c => c.completedAppointments >= 2).length,
        inactive: state.clientes.filter(c => ['sumido', 'em_risco', 'inativo'].includes(c.status)).length,
        vip: state.clientes.filter(c => ['vip', 'fiel'].includes(c.status)).length,
        noNext: state.clientes.filter(c => !c.nextAppointmentAt).length,
        revenue: state.clientes.reduce((sum, c) => sum + c.totalSpent, 0),
        pendingReminders: state.clientes.reduce((sum, c) => sum + c.pendingReminders, 0)
    };
    updateText('crmTotalClients', summary.total ?? state.clientes.length);
    updateText('crmRecurringClients', summary.recurring ?? 0);
    updateText('crmInactiveClients', summary.inactive ?? 0);
    updateText('crmVipClients', summary.vip ?? summary.faithful ?? 0);
    updateText('crmRevenue', formatCurrency(summary.revenue ?? 0));
    updateText('crmNoNextClients', summary.noNext ?? 0);
    updateText('crmPendingReminders', summary.pendingReminders ?? 0);
    if (!clients.length) {
        list.innerHTML = emptyStateUI('fa-address-book', state.clientes.length ? 'Nenhum cliente encontrado para o filtro.' : 'Ainda não há clientes com histórico de agendamento.');
        return;
    }
    list.innerHTML = clients.map(c => {
        const key = encodeURIComponent(c.customerKey);
        const lastLabel = c.lastAppointmentAt ? c.lastAppointmentAt.toLocaleDateString('pt-BR') : 'sem atendimento';
        const nextLabel = c.nextAppointmentAt ? `${c.nextAppointmentAt.toLocaleDateString('pt-BR')} às ${formatTime(c.nextAppointmentAt)}` : 'sem próximo horário';
        const statusClass = crmStatusClass(c.status);
        const tagChips = (c.tags || []).slice(0, 4).map(crmTagChip).join('') || '<span class="text-xs font-bold text-gray-400">Sem tags</span>';
        const alert = crmClientAlert(c);
        return `
            <article class="panel p-5">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <h4 class="text-lg font-black text-gray-950">${escapeHtml(c.name)}</h4>
                        <p class="text-sm font-semibold text-gray-500">${c.phoneNumber ? '+' + escapeHtml(c.phoneNumber) : 'Sem telefone cadastrado'}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-black uppercase ${statusClass}">${escapeHtml(c.statusLabel)}</span>
                </div>
                <div class="mt-3 flex flex-wrap gap-1.5">${tagChips}</div>
                ${alert ? `<div class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"><i class="fas fa-circle-exclamation mr-1"></i>${escapeHtml(alert)}</div>` : ''}
                <div class="grid grid-cols-3 gap-2 mt-4">
                    <div class="soft-panel p-3"><small class="text-[10px] font-black uppercase text-gray-500">Visitas</small><strong class="block text-lg font-black">${c.completedAppointments}</strong></div>
                    <div class="soft-panel p-3"><small class="text-[10px] font-black uppercase text-gray-500">Gasto</small><strong class="block text-lg font-black">${formatCurrency(c.totalSpent)}</strong></div>
                    <div class="soft-panel p-3"><small class="text-[10px] font-black uppercase text-gray-500">Preferência</small><strong class="block text-sm font-black truncate">${escapeHtml(c.topService)}</strong></div>
                </div>
                <div class="mt-4 text-sm font-semibold text-gray-600 space-y-1">
                    <p><strong>Último atendimento:</strong> ${lastLabel}</p>
                    <p><strong>Próximo horário:</strong> ${nextLabel}</p>
                    <p><strong>Profissional:</strong> ${escapeHtml(c.preferredProfessional || '-')} · <strong>Ticket médio:</strong> ${formatCurrency(c.averageTicket)}</p>
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                    <button class="btn btn-blue text-xs py-2" onclick="openCustomerProfile('${key}')"><i class="fas fa-address-card"></i> Perfil</button>
                    <button class="btn btn-light text-xs py-2" onclick="startAppointmentForCustomer('${key}')"><i class="fas fa-calendar-plus"></i> Agendar</button>
                    <button class="btn btn-green text-xs py-2" onclick="openCustomerWhatsApp('${key}', 'reactivation')"><i class="fab fa-whatsapp"></i> WhatsApp</button>
                    <button class="btn btn-light text-xs py-2" onclick="markCustomerVip('${key}')"><i class="fas fa-star"></i> VIP</button>
                    <button class="btn btn-light text-xs py-2 text-red-600" onclick="deleteCustomerHistory('${key}')"><i class="fas fa-trash"></i> Remover antigo</button>
                </div>
            </article>
        `;
    }).join('');
}

async function deleteCustomerHistory(encodedKey) {
    const customer = findCustomerByKey(encodedKey);
    const name = customer?.name || 'este cliente';
    const visits = customer?.totalAppointments || customer?.completedAppointments || 0;
    const ok = confirm(`Remover ${name} da aba de clientes?\n\nIsso apaga os agendamentos e o histórico CRM deste cliente nesta loja (${visits} registro(s) de agenda encontrados). Esta ação não remove outros clientes nem configurações da loja.`);
    if (!ok) return;

    try {
        const response = await apiFetch(`/customers/${encodeURIComponent(decodeURIComponent(encodedKey || ''))}`, { method: 'DELETE' });
        const payload = await response.json().catch(() => ({}));
        const deleted = payload.deleted || {};
        showToast(`Cliente removido. Agendamentos apagados: ${deleted.appointments ?? 0}.`, 'success');
        await Promise.allSettled([loadClients(), loadAgenda()]);
    } catch (e) {
        showToast(e.message || 'Erro ao remover cliente antigo.', 'error');
    }
}

function renderCrmFilterOptions() {
    const tagSelect = document.getElementById('crmTagFilter');
    if (tagSelect && tagSelect.dataset.loadedTags !== JSON.stringify((state.crm.tags || []).map(t => t.id ?? t.Id))) {
        const current = tagSelect.value;
        tagSelect.innerHTML = '<option value="">Todas as tags</option>' + (state.crm.tags || [])
            .map(t => `<option value="${t.id ?? t.Id}">${escapeHtml(t.name ?? t.Name)}</option>`)
            .join('');
        tagSelect.value = current;
        tagSelect.dataset.loadedTags = JSON.stringify((state.crm.tags || []).map(t => t.id ?? t.Id));
    }
    const serviceSelect = document.getElementById('crmServiceFilter');
    if (serviceSelect) {
        const services = [...new Set((state.clientes || []).map(c => c.topService).filter(s => s && s !== '-'))].sort();
        const signature = JSON.stringify(services);
        if (serviceSelect.dataset.loadedServices !== signature) {
            const current = serviceSelect.value;
            serviceSelect.innerHTML = '<option value="">Todos os serviços</option>' + services.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
            serviceSelect.value = current;
            serviceSelect.dataset.loadedServices = signature;
        }
    }
}

function crmStatusLabel(status) {
    return ({ auto: 'Automático', novo: 'Novo', recorrente: 'Recorrente', fiel: 'Fiel', vip: 'VIP', sumido: 'Sumido', em_risco: 'Em risco', inativo: 'Inativo', bloqueado: 'Bloqueado' })[status] || 'Novo';
}

function crmStatusClass(status) {
    return ({
        novo: 'bg-blue-100 text-blue-700',
        recorrente: 'bg-emerald-100 text-emerald-700',
        fiel: 'bg-green-100 text-green-700',
        vip: 'bg-purple-100 text-purple-700',
        sumido: 'bg-amber-100 text-amber-700',
        em_risco: 'bg-orange-100 text-orange-700',
        inativo: 'bg-slate-200 text-slate-700',
        bloqueado: 'bg-red-100 text-red-700'
    })[status] || 'bg-blue-100 text-blue-700';
}

function crmTagChip(tag) {
    const name = tag.name ?? tag.Name ?? 'Tag';
    const color = tag.color ?? tag.Color ?? '#64748b';
    return `<span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black border" style="color:${escapeAttr(color)};border-color:${escapeAttr(color)}33;background:${escapeAttr(color)}14">${escapeHtml(name)}</span>`;
}

function crmClientAlert(c) {
    if (c.status === 'bloqueado') return 'Cliente bloqueado manualmente.';
    if (c.status === 'em_risco') return 'Recorrente passou do intervalo comum de retorno.';
    if (c.status === 'sumido' || c.status === 'inativo') return `${c.daysSinceLast || 0} dias sem voltar.`;
    if (c.noShows > 0) return `${c.noShows} falta(s) registrada(s).`;
    if (c.pendingReminders > 0) return `${c.pendingReminders} lembrete(s) pendente(s).`;
    return '';
}

function findCustomerByKey(encodedKey) {
    const key = decodeURIComponent(encodedKey || '');
    return state.clientes.find(c => String(c.customerKey) === key);
}

async function openCustomerProfile(encodedKey) {
    ensureCustomerProfileModal();
    const key = decodeURIComponent(encodedKey || '');
    const modal = document.getElementById('customerProfileModal');
    modal.classList.remove('hidden');
    document.getElementById('customerProfileBody').innerHTML = '<div class="p-8 text-center text-gray-400 font-bold"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando perfil...</div>';
    try {
        const res = await apiFetch(`/customers/${encodeURIComponent(key)}`);
        const data = normalizeCrmCustomer(await res.json());
        state.crm.currentCustomer = data;
        renderCustomerProfileModal(data);
    } catch (e) {
        const fallback = findCustomerByKey(encodedKey);
        if (fallback) {
            state.crm.currentCustomer = fallback;
            renderCustomerProfileModal(fallback);
            showToast('Perfil detalhado carregado com dados locais.', 'info');
        } else {
            document.getElementById('customerProfileBody').innerHTML = emptyStateUI('fa-triangle-exclamation', 'Não foi possível carregar este cliente.');
        }
    }
}

function closeCustomerProfile() {
    document.getElementById('customerProfileModal')?.classList.add('hidden');
}

function ensureCustomerProfileModal() {
    if (document.getElementById('customerProfileModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="customerProfileModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden p-4 backdrop-blur-sm">
            <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
                <div class="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
                    <div>
                        <p class="text-xs font-black text-emerald-600 uppercase tracking-widest">Perfil CRM</p>
                        <h3 id="customerProfileTitle" class="text-2xl font-black text-gray-950">Cliente</h3>
                        <p id="customerProfileSubtitle" class="text-sm font-semibold text-gray-500 mt-1"></p>
                    </div>
                    <button onclick="closeCustomerProfile()" class="btn btn-light px-3 py-2"><i class="fas fa-times"></i></button>
                </div>
                <div id="customerProfileBody" class="overflow-y-auto p-5"></div>
            </div>
        </div>
    `);
}

function renderCustomerProfileModal(c) {
    updateText('customerProfileTitle', c.name);
    updateText('customerProfileSubtitle', `${c.phoneNumber ? '+' + c.phoneNumber : 'Sem telefone'} · ${c.statusLabel}`);
    const tagChips = (c.tags || []).map(t => `${crmTagChip(t)} <button class="text-xs font-black text-red-500" onclick="removeCustomerTag('${encodeURIComponent(c.customerKey)}', ${t.id ?? t.Id})">×</button>`).join('') || '<span class="text-sm font-bold text-gray-400">Sem tags</span>';
    const events = (c.events || []).slice(0, 30).map(ev => `
        <li class="relative pl-6 pb-4 border-l border-slate-200">
            <span class="absolute -left-2 top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></span>
            <p class="text-sm font-black text-gray-900">${escapeHtml(ev.title ?? ev.Title ?? 'Evento')}</p>
            <p class="text-xs font-semibold text-gray-500">${new Date(ev.createdAt ?? ev.CreatedAt).toLocaleString('pt-BR')} · ${escapeHtml(ev.type ?? ev.Type ?? 'crm')}</p>
            ${ev.description || ev.Description ? `<p class="text-sm text-gray-600 mt-1">${escapeHtml(ev.description ?? ev.Description)}</p>` : ''}
        </li>
    `).join('');
    const history = (c.history || []).slice(0, 12).map(h => `
        <tr>
            <td class="py-2 pr-3 text-sm font-bold text-gray-800">${new Date(h.dateTime ?? h.DateTime).toLocaleDateString('pt-BR')}</td>
            <td class="py-2 pr-3 text-sm text-gray-600">${escapeHtml(h.service ?? h.Servico ?? 'Serviço')}</td>
            <td class="py-2 pr-3 text-sm text-gray-600">${escapeHtml(h.professional ?? h.BarberName ?? 'Profissional')}</td>
            <td class="py-2 pr-3 text-sm font-bold text-gray-900">${formatCurrency(Number(h.price ?? h.Preco ?? 0))}</td>
            <td class="py-2 text-xs font-black uppercase text-gray-500">${escapeHtml(h.status ?? h.Status ?? '')}</td>
        </tr>
    `).join('');
    const reminders = (c.reminders || []).map(r => `
        <div class="rounded-xl border border-slate-100 p-3 flex items-start justify-between gap-3">
            <div>
                <p class="font-black text-gray-900">${escapeHtml(r.title ?? r.Title)}</p>
                <p class="text-xs font-semibold text-gray-500">${new Date(r.dueDate ?? r.DueDate).toLocaleDateString('pt-BR')} · ${escapeHtml(r.status ?? r.Status)}</p>
                ${r.description || r.Description ? `<p class="text-sm text-gray-600 mt-1">${escapeHtml(r.description ?? r.Description)}</p>` : ''}
            </div>
            ${(r.status ?? r.Status) === 'pendente' ? `<button class="btn btn-light text-xs py-1" onclick="completeCustomerReminder(${r.id ?? r.Id})">Concluir</button>` : ''}
        </div>
    `).join('');
    document.getElementById('customerProfileBody').innerHTML = `
        <div class="grid xl:grid-cols-[1.1fr_.9fr] gap-5">
            <div class="space-y-5">
                <div class="grid sm:grid-cols-4 gap-3">
                    <div class="soft-panel p-3"><small class="font-black text-gray-500 uppercase text-[10px]">Atendimentos</small><strong class="block text-xl font-black">${c.completedAppointments}</strong></div>
                    <div class="soft-panel p-3"><small class="font-black text-gray-500 uppercase text-[10px]">Gasto total</small><strong class="block text-xl font-black">${formatCurrency(c.totalSpent)}</strong></div>
                    <div class="soft-panel p-3"><small class="font-black text-gray-500 uppercase text-[10px]">Ticket médio</small><strong class="block text-xl font-black">${formatCurrency(c.averageTicket)}</strong></div>
                    <div class="soft-panel p-3"><small class="font-black text-gray-500 uppercase text-[10px]">Sem voltar</small><strong class="block text-xl font-black">${c.daysSinceLast ?? 0}d</strong></div>
                </div>
                <div class="panel p-4">
                    <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <h4 class="font-black text-gray-950">Tags e ações</h4>
                        <div class="flex flex-wrap gap-2">
                            <button class="btn btn-green text-xs py-2" onclick="openCustomerWhatsApp('${encodeURIComponent(c.customerKey)}', 'reactivation')"><i class="fab fa-whatsapp"></i> Chamar</button>
                            <button class="btn btn-light text-xs py-2" onclick="startAppointmentForCustomer('${encodeURIComponent(c.customerKey)}')"><i class="fas fa-calendar-plus"></i> Agendar</button>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2 mb-3">${tagChips}</div>
                    <div class="flex gap-2">
                        <input id="customerTagInput" class="input-field" placeholder="Nova tag ou tag existente">
                        <button class="btn btn-blue whitespace-nowrap" onclick="addCustomerTagFromProfile()">Adicionar</button>
                    </div>
                </div>
                <div class="panel p-4">
                    <h4 class="font-black text-gray-950 mb-3">Histórico de atendimentos</h4>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left"><tbody>${history || '<tr><td class="py-4 text-gray-400 font-bold">Sem histórico.</td></tr>'}</tbody></table>
                    </div>
                </div>
                <div class="panel p-4">
                    <h4 class="font-black text-gray-950 mb-3">Timeline</h4>
                    <ul>${events || '<li class="text-gray-400 font-bold">Sem eventos registrados.</li>'}</ul>
                    <div class="mt-4 flex gap-2">
                        <input id="customerEventNote" class="input-field" placeholder="Adicionar observação na timeline">
                        <button class="btn btn-light whitespace-nowrap" onclick="addCustomerEventNote()">Salvar</button>
                    </div>
                </div>
            </div>
            <div class="space-y-5">
                <div class="panel p-4">
                    <h4 class="font-black text-gray-950 mb-3">Preferências e observações</h4>
                    <div class="space-y-3">
                        <input id="customerDisplayName" class="input-field" placeholder="Nome exibido" value="${escapeAttr(c.name)}">
                        <select id="customerManualStatus" class="input-field font-bold">
                            ${['auto','novo','recorrente','fiel','vip','sumido','em_risco','inativo','bloqueado'].map(s => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${crmStatusLabel(s)}</option>`).join('')}
                        </select>
                        <textarea id="customerInternalNotes" class="input-field min-h-24" placeholder="Observações internas">${escapeHtml(c.internalNotes || '')}</textarea>
                        <textarea id="customerPreferences" class="input-field min-h-20" placeholder="Preferências do cliente">${escapeHtml(c.preferences || '')}</textarea>
                        <div class="grid sm:grid-cols-2 gap-2">
                            <input id="customerPreferredService" class="input-field" placeholder="Serviço preferido" value="${escapeAttr(c.preferredService || c.topService || '')}">
                            <input id="customerPreferredProfessional" class="input-field" placeholder="Profissional preferido" value="${escapeAttr(c.manualPreferredProfessional || c.preferredProfessional || '')}">
                            <input id="customerBestTime" class="input-field" placeholder="Melhor horário" value="${escapeAttr(c.bestTime || c.commonTime || '')}">
                            <input id="customerReturnFrequency" class="input-field" type="number" min="1" max="365" placeholder="Retorno em dias" value="${escapeAttr(c.returnFrequencyDays || '')}">
                            <input id="customerContactPreference" class="input-field" placeholder="Preferência de contato" value="${escapeAttr(c.contactPreference || 'WhatsApp')}">
                            <input id="customerSource" class="input-field" placeholder="Como conheceu" value="${escapeAttr(c.source || '')}">
                        </div>
                        <button class="btn btn-blue w-full justify-center" onclick="saveCustomerProfile()">Salvar perfil</button>
                    </div>
                </div>
                <div class="panel p-4">
                    <h4 class="font-black text-gray-950 mb-3">Lembretes internos</h4>
                    <div class="space-y-2 mb-3">${reminders || '<p class="text-sm font-bold text-gray-400">Sem lembretes.</p>'}</div>
                    <div class="space-y-2">
                        <input id="customerReminderTitle" class="input-field" placeholder="Lembrar de...">
                        <input id="customerReminderDate" class="input-field" type="date">
                        <textarea id="customerReminderDesc" class="input-field min-h-16" placeholder="Detalhe opcional"></textarea>
                        <button class="btn btn-light w-full justify-center" onclick="addCustomerReminder()">Criar lembrete</button>
                    </div>
                </div>
                <div class="panel p-4">
                    <h4 class="font-black text-gray-950 mb-2">Sugestões WhatsApp</h4>
                    <div class="space-y-2">
                        ${Object.entries(c.suggestedMessages || {}).filter(([k]) => k !== 'whatsappUrl').slice(0, 5).map(([key, value]) => `<button class="w-full text-left rounded-xl border border-slate-100 p-3 text-sm font-semibold text-gray-600 hover:border-emerald-300" onclick="openCustomerWhatsApp('${encodeURIComponent(c.customerKey)}', '${key}')">${escapeHtml(value || '')}</button>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function saveCustomerProfile() {
    const c = state.crm.currentCustomer;
    if (!c?.customerKey || !c.phoneNumber) return showToast('Cliente sem telefone não pode salvar dados persistentes.', 'error');
    const payload = {
        DisplayName: document.getElementById('customerDisplayName')?.value,
        ManualStatus: document.getElementById('customerManualStatus')?.value,
        InternalNotes: document.getElementById('customerInternalNotes')?.value,
        Preferences: document.getElementById('customerPreferences')?.value,
        PreferredService: document.getElementById('customerPreferredService')?.value,
        PreferredProfessional: document.getElementById('customerPreferredProfessional')?.value,
        BestTime: document.getElementById('customerBestTime')?.value,
        ReturnFrequencyDays: Number(document.getElementById('customerReturnFrequency')?.value) || null,
        ContactPreference: document.getElementById('customerContactPreference')?.value,
        Source: document.getElementById('customerSource')?.value,
        IsBlocked: document.getElementById('customerManualStatus')?.value === 'bloqueado'
    };
    await apiFetch(`/customers/${encodeURIComponent(c.customerKey)}`, { method: 'PATCH', body: JSON.stringify(payload) });
    showToast('Perfil do cliente salvo.', 'success');
    await loadClients();
    await openCustomerProfile(encodeURIComponent(c.customerKey));
}

async function addCustomerTagFromProfile() {
    const c = state.crm.currentCustomer;
    const name = document.getElementById('customerTagInput')?.value?.trim();
    if (!c?.customerKey || !name) return;
    await apiFetch(`/customers/${encodeURIComponent(c.customerKey)}/tags`, { method: 'POST', body: JSON.stringify({ Name: name }) });
    showToast('Tag adicionada.', 'success');
    await loadClients();
    await openCustomerProfile(encodeURIComponent(c.customerKey));
}

async function removeCustomerTag(encodedKey, tagId) {
    const key = decodeURIComponent(encodedKey || '');
    await apiFetch(`/customers/${encodeURIComponent(key)}/tags/${tagId}`, { method: 'DELETE' });
    showToast('Tag removida.', 'success');
    await loadClients();
    await openCustomerProfile(encodeURIComponent(key));
}

async function markCustomerVip(encodedKey) {
    const c = findCustomerByKey(encodedKey);
    if (!c?.phoneNumber) return showToast('Cliente sem telefone não pode receber tag persistente.', 'error');
    await apiFetch(`/customers/${encodeURIComponent(c.customerKey)}/tags`, { method: 'POST', body: JSON.stringify({ Name: 'VIP', Color: '#a855f7' }) });
    showToast('Cliente marcado como VIP.', 'success');
    await loadClients();
}

async function addCustomerEventNote() {
    const c = state.crm.currentCustomer;
    const note = document.getElementById('customerEventNote')?.value?.trim();
    if (!c?.customerKey || !note) return;
    await apiFetch(`/customers/${encodeURIComponent(c.customerKey)}/events`, { method: 'POST', body: JSON.stringify({ Type: 'note', Title: 'Observação adicionada', Description: note }) });
    showToast('Evento registrado.', 'success');
    await openCustomerProfile(encodeURIComponent(c.customerKey));
}

async function addCustomerReminder() {
    const c = state.crm.currentCustomer;
    const title = document.getElementById('customerReminderTitle')?.value?.trim();
    const due = document.getElementById('customerReminderDate')?.value;
    if (!c?.customerKey || !title || !due) return showToast('Informe título e data do lembrete.', 'error');
    await apiFetch('/customer-reminders', { method: 'POST', body: JSON.stringify({ CustomerKey: c.customerKey, Title: title, Description: document.getElementById('customerReminderDesc')?.value, DueDate: due }) });
    showToast('Lembrete criado.', 'success');
    await loadClients();
    await openCustomerProfile(encodeURIComponent(c.customerKey));
}

async function completeCustomerReminder(id) {
    const c = state.crm.currentCustomer;
    await apiFetch(`/customer-reminders/${id}`, { method: 'PATCH', body: JSON.stringify({ Status: 'concluido' }) });
    showToast('Lembrete concluído.', 'success');
    if (c?.customerKey) {
        await loadClients();
        await openCustomerProfile(encodeURIComponent(c.customerKey));
    }
}

function openCustomerWhatsApp(encodedKey, messageKey = 'reactivation') {
    const c = state.crm.currentCustomer?.customerKey === decodeURIComponent(encodedKey || '') ? state.crm.currentCustomer : findCustomerByKey(encodedKey);
    if (!c?.phoneNumber) return showToast('Cliente sem telefone cadastrado.', 'error');
    const suggestions = c.suggestedMessages || {};
    const message = suggestions[messageKey] || suggestions.reactivation || `Oi, ${c.name}! Tudo bem?`;
    const ok = confirm(`Abrir WhatsApp com mensagem sugerida?\n\n${message}`);
    if (!ok) return;
    window.open(`https://wa.me/${c.phoneNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

function startAppointmentForCustomer(encodedKey) {
    const c = findCustomerByKey(encodedKey) || state.crm.currentCustomer;
    showView('agenda');
    setTimeout(() => {
        openManualAppointmentModal();
        setTimeout(() => {
            const name = document.getElementById('manualClient');
            const phone = document.getElementById('manualPhone');
            if (name) name.value = c?.name || '';
            if (phone) phone.value = c?.phoneNumber || '';
        }, 80);
    }, 120);
}

// ── Abas mobile da agenda ─────────────────────────────────────────────────────
function switchAgendaTab(tab) {
    const isHoje = tab === 'hoje';

    // Atualiza visual das abas
    document.getElementById('agendaTabHoje')   ?.classList.toggle('active',  isHoje);
    document.getElementById('agendaTabFuturos')?.classList.toggle('active', !isHoje);

    // Mostra/oculta painéis (apenas em mobile — em desktop ambos ficam visíveis via CSS)
    document.getElementById('agendaPanelHoje')   ?.classList.toggle('tab-active',  isHoje);
    document.getElementById('agendaPanelFuturos')?.classList.toggle('tab-active', !isHoje);

    state.agendaTab = tab;
}

function todayInputValue(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return dateInput(d);
}

function applyServiceSettings(settings = {}) {
    const enumById = ['Corte', 'Barba', 'Sobrancelha', 'CorteBarba', 'CorteSobrancelha', 'CorteBarbasobrancelha'];
    SERVICE_OPTIONS = enumById.map((value, index) => {
        const id = index + 1;
        const name = settings[`Service_${id}_Name`] || document.getElementById(`serviceName_${id}`)?.placeholder || value;
        const active = settings[`Service_${id}_Active`] !== 'false';
        return { id, value, label: name, active };
    }).filter(s => s.active);
    populateServiceSelects();
}

function dateInput(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function openManualAppointmentModal() {
    const modal = document.getElementById('manualAppointmentModal');
    if (!modal) return;
    populateServiceSelects();
    populateBarberSelect('manualBarber', state.barbeiros);
    document.getElementById('manualBarber')?.classList.toggle('hidden', !usesProfessionalScheduling());
    const optionalToggle = document.getElementById('manualOptionalToggle');
    if (optionalToggle) {
        optionalToggle.innerHTML = usesProfessionalScheduling()
            ? '<i class="fas fa-chevron-right transition-transform" id="manualOptionalChevron"></i> Dados do cliente / profissional (opcional)'
            : '<i class="fas fa-chevron-right transition-transform" id="manualOptionalChevron"></i> Dados do cliente / observacoes (opcional)';
    }
    document.getElementById('manualClient').value = '';
    document.getElementById('manualPhone').value = '';
    document.getElementById('manualDate').value = todayInputValue();
    document.getElementById('manualTime').value = '';
    document.getElementById('manualNotes').value = '';
    // Bloco opcional sempre recolhido ao abrir (foco em serviço + horário)
    document.getElementById('manualOptionalFields')?.classList.add('hidden');
    document.getElementById('manualOptionalChevron')?.classList.remove('rotate-90');
    updateManualAvailableSlots();
    modal.classList.remove('hidden');
}

function toggleManualOptional() {
    const fields = document.getElementById('manualOptionalFields');
    const chevron = document.getElementById('manualOptionalChevron');
    if (!fields) return;
    const willShow = fields.classList.contains('hidden');
    fields.classList.toggle('hidden', !willShow);
    chevron?.classList.toggle('rotate-90', willShow);
}

function closeManualAppointmentModal() {
    document.getElementById('manualAppointmentModal')?.classList.add('hidden');
}

async function updateManualAvailableSlots() {
    const date = document.getElementById('manualDate')?.value;
    const service = document.getElementById('manualService')?.value;
    const barberId = usesProfessionalScheduling() ? document.getElementById('manualBarber')?.value : '';
    const select = document.getElementById('manualTime');
    const hint = document.getElementById('manualSlotsHint');
    if (!select || !date || !service) return;

    select.innerHTML = '<option value="">Carregando...</option>';
    if (hint) hint.textContent = '';

    try {
        const params = new URLSearchParams({ data: date, servico: service });
        if (barberId) params.set('barberId', barberId);
        const res = await apiFetch(`/horarios-livres?${params.toString()}`);
        const data = await res.json();
        const slots = data.HorariosLivres || data.horariosLivres || data.HoráriosLivres || data.horáriosLivres || [];
        const duration = data.DuracaoMinutos ?? data.duracaoMinutos;
        const scheduleEnd = data.ExpedienteFim ?? data.expedienteFim;
        const lastStart = data.UltimoInicioPossivel ?? data.ultimoInicioPossivel ?? data.UltimoInícioPossivel ?? data.ultimoInícioPossivel;
        const barberName = data.Profissional ?? data.profissional;
        const scheduleRule = scheduleEnd && lastStart
            ? ` Expediente até ${scheduleEnd}; como o serviço dura ${duration}min, o ultimo inicio e ${lastStart}.`
            : '';

        if (data.Indisponivel || data.indisponivel) {
            select.innerHTML = '<option value="">Dia indisponível</option>';
            if (hint) hint.textContent = data.Observacao || data.observacao || data.Observação || data.observação || data.Motivo || data.motivo || 'Dia fechado para agendamentos.';
            return;
        }

        select.innerHTML = slots.length
            ? '<option value="">Selecione um horário</option>' + slots.map(h => `<option value="${h}">${h}</option>`).join('')
            : '<option value="">Sem horários livres</option>';
        if (hint) hint.textContent = slots.length ? `${slots.length} horários disponíveis.` : 'Nenhum horário livre para essa combinação.';
        if (hint && scheduleRule) {
            hint.textContent = slots.length
                ? `${slots.length} horários disponíveis.${barberName ? ` Profissional: ${barberName}.` : ''}${scheduleRule}`
                : `Nenhum horário livre para essa combinação.${scheduleRule}`;
        }
    } catch (e) {
        select.innerHTML = '<option value="">Erro ao carregar</option>';
        if (hint) hint.textContent = e.message || 'Falha ao buscar horarios.';
    }
}

async function saveManualAppointment() {
    const client = document.getElementById('manualClient')?.value.trim();
    const phone = document.getElementById('manualPhone')?.value.trim();
    const service = document.getElementById('manualService')?.value;
    const barberId = usesProfessionalScheduling() ? document.getElementById('manualBarber')?.value : '';
    const date = document.getElementById('manualDate')?.value;
    const time = document.getElementById('manualTime')?.value;
    const notes = document.getElementById('manualNotes')?.value.trim();

    // Agendamento rápido: só serviço + data + horário são obrigatórios.
    // Nome/telefone/profissional são opcionais — o backend cria "Cliente presencial"
    // e auto-seleciona um profissional disponível (na barbearia) quando não informados.
    if (!service || !date || !time) {
        return showToast('Selecione serviço, data e horário.', 'error');
    }
    if (!isFutureLocalDateTime(date, time)) {
        return showToast('Escolha uma data e horário futuros.', 'error');
    }

    const cleanPhone = normalizePhoneInput(phone); // null se vazio/ inválido → enviado como vazio (cliente presencial)
    try {
        const selectedBarber = barberId ? state.barbeiros.find(b => String(b.Id ?? b.id) === String(barberId)) : null;
        const res = await apiFetch('/agendamentos', {
            method: 'POST',
            body: JSON.stringify({
                ContactName: client || null,
                PhoneNumber: cleanPhone || null,
                Servico: service,
                BarberId: barberId ? Number(barberId) : null,
                BarberName: selectedBarber?.Nome ?? selectedBarber?.nome ?? null,
                DateTime: `${date}T${time}:00`,
                Notes: notes || null
            })
        });
        const data = await res.json();
        closeManualAppointmentModal();
        // Mensagem clara com serviço, horário, profissional e preço (quando o backend retorna)
        const hora = (data.dateTime || `${date}T${time}`).slice(11, 16);
        const partes = [data.serviceName, hora && `às ${hora}`, data.barberName, data.price != null && `R$${data.price}`].filter(Boolean);
        showToast(partes.length ? `Agendado: ${partes.join(' · ')}` : (data.message || 'Agendamento criado'), 'success');
        await loadData();
        if (state.activeView === 'relatorios') loadReports(false);
        syncSpreadsheetsQuietly();
    } catch (e) {
        showToast(e.message || 'Erro ao criar agendamento', 'error');
    }
}

function normalizePhoneInput(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) return '';
    return digits;
}

function timeToMinutes(value) {
    const [hour, minute] = String(value || '').split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return -1;
    return hour * 60 + minute;
}

function isValidTimeRange(start, end) {
    if (!start || !end) return false;
    return timeToMinutes(end) > timeToMinutes(start);
}

function getGlobalScheduleDefaults() {
    return {
        open: document.getElementById('setOpening')?.value || '',
        close: document.getElementById('setClosing')?.value || ''
    };
}

function isFutureLocalDateTime(date, time) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const selected = new Date(year, month - 1, day, hour, minute, 0);
    return selected.getTime() > Date.now() + 60 * 1000;
}

async function loadUnavailableDays() {
    const list = document.getElementById('unavailableDaysList');
    if (!list) return;
    showListLoading('unavailableDaysList');
    try {
        const params = new URLSearchParams({ inicio: todayInputValue(-7), fim: todayInputValue(45) });
        const barberId = usesProfessionalScheduling()
            ? (state.user.role === 'barbeiro' ? state.user.barberId : document.getElementById('barberFilter')?.value)
            : '';
        if (barberId) params.set('barberId', barberId);
        const res = await apiFetch(`/dias-indisponiveis?${params.toString()}`);
        state.unavailableDays = await res.json();
        renderUnavailableDays();
    } catch (e) {
        list.innerHTML = '<p class="text-xs text-red-600 font-bold">Erro ao carregar dias indisponíveis.</p>';
    }
}

function renderUnavailableDays() {
    const list = document.getElementById('unavailableDaysList');
    if (!list) return;
    const days = Array.isArray(state.unavailableDays) ? state.unavailableDays : [];
    if (!days.length) {
        list.innerHTML = '<p class="text-xs text-slate-500 font-bold">Nenhum dia bloqueado nos pr\u00f3ximos 45 dias.</p>';
        return;
    }

    list.innerHTML = days.slice(0, 8).map(day => {
        const barber = day.BarberId ? state.barbeiros.find(b => String(b.Id ?? b.id) === String(day.BarberId)) : null;
        return `
            <div class="unavailable-card flex items-center justify-between gap-3 border rounded-lg px-3 py-2">
                <div>
                    <p class="text-sm font-black text-slate-900">${formatDateOnly(day.Data || day.data)} - ${escapeHtml(day.Type || day.type)}</p>
                    <p class="text-xs text-slate-500 font-bold">${escapeHtml(day.Reason || day.reason || 'Sem observa\u00e7\u00e3o')} ${barber ? `&middot; ${escapeHtml(barber.Nome ?? barber.nome)}` : '&middot; Todos'}</p>
                </div>
                <button onclick="removeUnavailableDay(${day.Id ?? day.id})" class="btn btn-light text-xs"><i class="fas fa-trash"></i></button>
            </div>
        `;
    }).join('');
}
function openUnavailableDayModal() {
    const modal = document.getElementById('unavailableDayModal');
    if (!modal) return;
    populateBarberSelect('unavailableBarber', state.barbeiros, true);
    document.getElementById('unavailableBarber')?.classList.toggle('hidden', !usesProfessionalScheduling());
    document.getElementById('unavailableDate').value = todayInputValue();
    document.getElementById('unavailableType').value = 'fechado';
    document.getElementById('unavailableReason').value = '';
    modal.classList.remove('hidden');
}

function closeUnavailableDayModal() {
    document.getElementById('unavailableDayModal')?.classList.add('hidden');
}

async function saveUnavailableDay() {
    const date = document.getElementById('unavailableDate')?.value;
    const type = document.getElementById('unavailableType')?.value;
    const reason = document.getElementById('unavailableReason')?.value.trim();
    const barberId = usesProfessionalScheduling() ? document.getElementById('unavailableBarber')?.value : '';
    if (!date || !type) return showToast('Informe data e tipo do bloqueio.', 'error');

    try {
        await apiFetch('/dias-indisponiveis', {
            method: 'POST',
            body: JSON.stringify({
                Data: date,
                Type: type,
                Reason: reason,
                BarberId: barberId ? Number(barberId) : null
            })
        });
        closeUnavailableDayModal();
        showToast('Dia indisponível salvo', 'success');
        loadUnavailableDays();
    } catch (e) {
        showToast(e.message || 'Erro ao salvar bloqueio', 'error');
    }
}

async function removeUnavailableDay(id) {
    if (!confirm('Remover este bloqueio de dia?')) return;
    try {
        await apiFetch(`/dias-indisponiveis/${id}`, { method: 'DELETE' });
        showToast('Bloqueio removido', 'success');
        loadUnavailableDays();
    } catch (e) {
        showToast(e.message || 'Erro ao remover bloqueio', 'error');
    }
}

async function syncSpreadsheetsQuietly() {
    try { await apiFetch('/spreadsheets/update', { method: 'POST' }); } catch {}
}

// --- BOT E WHATSAPP ---
async function loadBotStatus(includeQr = false) {
    try {
        const res = await apiFetch(includeQr ? '/bot/qr' : '/bot/status');
        const data = await res.json();
        state.bot = data;
        
        const connectionState = data.connectionState || data.state || (data.whatsappConnected ? 'ONLINE' : 'OFFLINE');
        const connected = connectionState === 'ONLINE' || !!data.whatsappConnected;
        const enabled = !!data.botEnabled;
        const stateLabels = {
            ONLINE: 'WhatsApp ativo',
            OFFLINE: 'WhatsApp offline',
            RECONNECTING: 'Reconectando WhatsApp',
            QR_REQUIRED: 'Aguardando QR Code'
        };
        
        // Status Principal
        const badge = document.getElementById('botStatusBadge');
        if (badge) {
            badge.textContent = connected ? 'Conectado' : (stateLabels[connectionState] || 'Desconectado');
            badge.className = `px-3 py-1 rounded-full text-xs font-black uppercase ${connected ? 'bg-green-100 text-green-700' : (connectionState === 'RECONNECTING' || connectionState === 'QR_REQUIRED' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}`;
        }
        
        updateText('botStatusText', connected 
            ? `WhatsApp ativo como ${data.pushname || state.storeName}`
            : (data.status === 'qr' ? 'Aguardando leitura do QR Code' : 'WhatsApp desconectado ou em inicialização'));

        // Saúde do Canal
        updateText('botHealthStatus', connected ? 'Operacional' : (stateLabels[connectionState] || 'Offline'));
        updateText('botPhoneStatus', data.phone ? `+${data.phone}` : 'Não vinculado');
        updateText('botEnabledStatus', enabled ? 'Ativo (Respondendo)' : 'Pausado');
        const pendingCount = Number(data.pausedPendingCount || 0);
        updateText('botPendingStatus', pendingCount === 0 ? 'Nenhuma' : `${pendingCount} cliente${pendingCount === 1 ? '' : 's'}`);

        // Banner de bot pausado: aparece em destaque quando botEnabled = false
        const pausedBanner = document.getElementById('botPausedBanner');
        if (pausedBanner) pausedBanner.classList.toggle('hidden', enabled);

        // Botão de Toggle (Ativar/Pausar)
        const toggleBtn = document.getElementById('botToggleBtn');
        if (toggleBtn) {
            toggleBtn.innerHTML = enabled ? '<i class="fas fa-pause"></i> Pausar' : '<i class="fas fa-play"></i> Ativar';
            toggleBtn.className = `btn ${enabled ? 'btn-yellow' : 'btn-green'} px-4 py-3`;
        }

        // Painel de conexão: mostrar se não conectado ou se há QR/código pendente
        const qrPanel = document.getElementById('botQrPanel');
        if (data.qrImage) {
            document.getElementById('botQrImage').src = data.qrImage;
            qrPanel.classList.remove('hidden');
            const time = data.qrUpdatedAt ? new Date(data.qrUpdatedAt).toLocaleTimeString() : 'Agora';
            const ageSeconds = data.qrAgeMs ? Math.max(0, Math.round(Number(data.qrAgeMs) / 1000)) : 0;
            const ttlSeconds = data.qrDisplayTtlMs ? Math.round(Number(data.qrDisplayTtlMs) / 1000) : 300;
            updateText('botQrTime', `Gerado às ${time} · ${ageSeconds}s de ${ttlSeconds}s`);
        } else if (!connected) {
            if (includeQr) updateText('botQrTime', 'Gerando QR Code. Aguarde alguns segundos...');
        } else {
            qrPanel.classList.add('hidden');
        }

        // Se há um código de pareamento gerado, exibe-o (independente da aba ativa)
        if (data.pairingCode && !data.pairingCodeExpired) {
            renderPairingCode(data.pairingCode, data.pairingCodeAgeMs, data.pairingCodeTtlMs);
            qrPanel.classList.remove('hidden');
        } else if (data.pairingCodePending) {
            showPairingMsg('⏳ Aguardando geração do código...', 'info');
            startPairingPoll();
        }
        renderOwnerCockpit();
    } catch (e) {
        console.warn('Erro ao checar status do Bot');
    }
}

// ── Pareamento por código ─────────────────────────────────────────────────────

let _pairingPollTimer = null;

function switchConnectTab(tab) {
    const isQr = tab === 'qr';
    document.getElementById('connectTabQr').classList.toggle('hidden', !isQr);
    document.getElementById('connectTabCode').classList.toggle('hidden', isQr);
    document.getElementById('tabQr').className = isQr
        ? 'px-5 py-2 text-sm font-black border-b-2 border-gray-950 text-gray-950 -mb-px'
        : 'px-5 py-2 text-sm font-bold text-gray-400 -mb-px border-b-2 border-transparent';
    document.getElementById('tabCode').className = !isQr
        ? 'px-5 py-2 text-sm font-black border-b-2 border-gray-950 text-gray-950 -mb-px'
        : 'px-5 py-2 text-sm font-bold text-gray-400 -mb-px border-b-2 border-transparent';
}

async function requestPairingCode() {
    const phone = document.getElementById('pairingPhoneInput')?.value?.replace(/\D/g, '') || '';
    if (!phone || phone.length < 7) {
        showPairingMsg('❌ Informe um número válido no formato internacional. Ex: 5511999999999', 'error');
        return;
    }

    const btn = document.getElementById('pairingBtn');
    btn.disabled = true;
    btn.textContent = 'Aguardando...';
    showPairingMsg('', '');
    hidePairingCode();

    try {
        const res = await apiFetch('/bot/pairing-code', {
            method: 'POST',
            body: JSON.stringify({ phone })
        });
        const data = await res.json();

        if (data.code) {
            renderPairingCode(data.code, 0, 180000);
            showPairingMsg('✅ Código gerado! Digite-o no WhatsApp.', 'success');
            document.getElementById('botQrPanel').classList.remove('hidden');
        } else if (data.pending) {
            showPairingMsg('⏳ Iniciando conexão — o código aparece em instantes...', 'info');
            startPairingPoll();
        } else {
            showPairingMsg(`❌ ${data.error || 'Erro desconhecido'}`, 'error');
        }
    } catch (e) {
        showPairingMsg(`❌ ${e.message || 'Erro ao gerar código'}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Gerar código';
    }
}

function startPairingPoll() {
    stopPairingPoll();
    _pairingPollTimer = setInterval(async () => {
        try {
            const res = await apiFetch('/bot/pairing-code/status');
            const data = await res.json();
            if (data.code && !data.expired) {
                stopPairingPoll();
                renderPairingCode(data.code, data.codeAgeMs || 0, 180000);
                showPairingMsg('✅ Código gerado! Digite-o no WhatsApp.', 'success');
                document.getElementById('botQrPanel').classList.remove('hidden');
            } else if (data.connectionStatus === 'connected') {
                stopPairingPoll();
                hidePairingCode();
                showPairingMsg('✅ WhatsApp conectado com sucesso!', 'success');
                loadBotStatus();
            }
        } catch { /* silencioso */ }
    }, 2000);
    // Para de fazer polling após 2 min
    setTimeout(stopPairingPoll, 120000);
}

function stopPairingPoll() {
    if (_pairingPollTimer) { clearInterval(_pairingPollTimer); _pairingPollTimer = null; }
}

// Exibe o código com countdown de expiração
let _pairingCountdownTimer = null;
function renderPairingCode(code, ageMs, ttlMs) {
    const box = document.getElementById('pairingCodeBox');
    const display = document.getElementById('pairingCodeDisplay');
    const timer = document.getElementById('pairingCodeTimer');
    if (!box || !display) return;

    display.textContent = code;
    box.classList.remove('hidden');
    switchConnectTab('code');

    if (_pairingCountdownTimer) clearInterval(_pairingCountdownTimer);
    const startedAt = Date.now() - (ageMs || 0);
    _pairingCountdownTimer = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, Math.ceil((ttlMs - elapsed) / 1000));
        if (timer) timer.textContent = remaining > 0 ? `Expira em ${remaining}s` : '⚠️ Código expirado — gere um novo';
        if (remaining === 0) {
            clearInterval(_pairingCountdownTimer);
            display.textContent = '----';
            display.style.opacity = '0.4';
        }
    }, 1000);
    display.style.opacity = '1';
}

function hidePairingCode() {
    document.getElementById('pairingCodeBox')?.classList.add('hidden');
    if (_pairingCountdownTimer) { clearInterval(_pairingCountdownTimer); _pairingCountdownTimer = null; }
}

function showPairingMsg(text, type) {
    const el = document.getElementById('pairingMsg');
    if (!el) return;
    if (!text) { el.classList.add('hidden'); return; }
    const colors = { success: 'text-green-600', error: 'text-red-500', info: 'text-blue-500' };
    el.textContent = text;
    el.className = `text-sm font-bold mt-3 ${colors[type] || 'text-gray-600'}`;
    el.classList.remove('hidden');
}

async function toggleBot() {
    const currentlyEnabled = state.bot?.botEnabled;
    try {
        const res = await apiFetch('/bot/toggle', {
            method: 'POST',
            body: JSON.stringify({ enabled: !currentlyEnabled })
        });
        
        const data = await res.json();
        if (res.ok) {
            state.bot = data;
            const isNowEnabled = !!data.botEnabled;
            
            // Atualização visual imediata
            updateText('botEnabledStatus', isNowEnabled ? 'Ativo (Respondendo)' : 'Pausado');
            const flushed = Number(data.flushedPausedPending || 0);
            const suffix = isNowEnabled && flushed > 0 ? ` (${flushed} pendencia${flushed === 1 ? '' : 's'} retomada${flushed === 1 ? '' : 's'})` : '';
            showToast(`Bot ${isNowEnabled ? 'ativado' : 'pausado'} com sucesso${suffix}`, 'success');
            
            loadBotStatus(); // Sincroniza o restante da UI
        } else { throw new Error(data.error); }
    } catch (e) { showToast('Falha ao alterar estado do bot', 'error'); }
}

async function disconnectBot(btn) {
    if (!confirm('Tem certeza que deseja desconectar o WhatsApp? Isso encerrará a sessão atual.')) return;
    
    const originalHtml = btn.innerHTML;
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Desconectando...';
        const res = await apiFetch('/bot/logout', { method: 'POST' });
        if (res.ok) {
            showToast('Sessão encerrada. Gere um novo QR Code para conectar.', 'info');
            loadBotStatus(true);
        }
    } catch (e) { showToast('Erro ao desconectar', 'error'); }
    finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

async function reconnectBot(btn) {
    const originalHtml = btn.innerHTML;
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recuperando...';
        const res = await apiFetch('/bot/reconnect', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao recuperar WhatsApp');

        const mode = data.mode === 'process' ? 'processo da loja reiniciado' : 'cliente WhatsApp reconectando';
        showToast(`${mode}, sem apagar a sessão.`, 'info');
        setTimeout(() => loadBotStatus(false), 3000);
        setTimeout(() => loadBotStatus(false), 10000);
    } catch (e) {
        showToast(e.message || 'Não foi possível recuperar o WhatsApp', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

// --- BARBEIROS ---
async function carregarBarbeiros() {
    try {
        const res = await apiFetch('/barbeiros');
        const data = await res.json();
        state.barbeiros = Array.isArray(data) ? data : [];
        const barbeiros = state.barbeiros;

        const container = document.getElementById('barber-list');
        if (!container) return;

        if (!barbeiros.length) {
            container.innerHTML = emptyStateUI('fa-users', biz().semEquipe);
            return;
        }

        container.innerHTML = barbeiros.map(b => {
            // Normalização de propriedades (trata Nome vs nome, etc)
            const id = b.Id ?? b.id;
            const nome = b.Nome ?? b.nome ?? 'Sem nome';
            const ativo = b.Ativo ?? b.ativo;
            const especialidade = b.Especialidade ?? b.especialidade ?? 'Profissional';
            const cor = b.Cor ?? b.cor ?? '#ccc';

            return `
                <div class="panel p-5 border-l-8" style="border-color: ${cor}">
                    <div class="flex justify-between items-center mb-3">
                        <h4 class="font-black text-slate-950">${escapeHtml(nome)}</h4>
                        <span class="text-[10px] font-bold uppercase ${ativo ? 'text-green-600' : 'text-red-600'}">${ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    <p class="text-xs text-slate-500 font-bold mb-4">${escapeHtml(especialidade)}</p>
                    <div class="flex gap-2">
                        <button onclick="editarBarbeiro(${id})" class="btn btn-light text-xs flex-1"><i class="fas fa-edit"></i> Editar</button>
                        <button onclick="removerBarbeiro(${id})" class="btn btn-light text-xs flex-1"><i class="fas fa-trash"></i> Remover</button>
                    </div>
                </div>
            `;
        }).join('');

        // Popula o filtro administrativo
        const filterSelect = document.getElementById('barberFilter');
        if (filterSelect && state.user.role === 'admin') {
            const currentVal = filterSelect.value;
            filterSelect.innerHTML = `<option value="">${biz().filtroTodos}</option>`;
            barbeiros.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.Id ?? b.id;
                opt.textContent = b.Nome ?? b.nome;
                filterSelect.appendChild(opt);
            });
            filterSelect.value = currentVal;
        }

        populateBarberSelect('manualBarber', barbeiros);
        populateBarberSelect('unavailableBarber', barbeiros, true);
        renderOnboardingChecklist();
    } catch (e) {
        console.error('Erro barbeiros:', e);
    }
}

function populateBarberSelect(id, barbeiros, includeAll = false) {
    const select = document.getElementById(id);
    if (!select) return;
    const currentVal = select.value;
    const options = [];
    if (includeAll && state.user.role === 'admin') options.push(`<option value="">${biz().filtroTodos}</option>`);
    barbeiros.forEach(b => {
        const barberId = b.Id ?? b.id;
        const name = b.Nome ?? b.nome;
        const active = b.Ativo ?? b.ativo;
        if (active === false) return;
        if (state.user.role === 'barbeiro' && String(state.user.barberId) !== String(barberId)) return;
        options.push(`<option value="${barberId}">${escapeHtml(name)}</option>`);
    });
    select.innerHTML = options.join('');
    if ([...select.options].some(opt => opt.value === currentVal)) select.value = currentVal;
}

// --- GESTÃO DE BARBEIROS (Ações) ---
function toTimeInput(value, fallback) {
    if (!value) return fallback;
    const text = String(value);
    return text.length >= 5 ? text.slice(0, 5) : fallback;
}

function parseWorkingDays(value) {
    if (!value) return [1, 2, 3, 4, 5, 6];
    return String(value).split(',').map(v => Number(v.trim())).filter(v => Number.isInteger(v));
}

function setSelectedWorkingDays(days) {
    const selected = new Set(days);
    document.querySelectorAll('.barber-day').forEach(input => {
        input.checked = selected.has(Number(input.value));
    });
}

function getSelectedWorkingDays() {
    return Array.from(document.querySelectorAll('.barber-day:checked')).map(input => Number(input.value));
}

function prettyJson(value) {
    if (!value) return '';
    try { return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2); }
    catch { return String(value); }
}

function parseJsonField(id) {
    const raw = document.getElementById(id)?.value.trim();
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : false;
    } catch {
        return false;
    }
}

// ── Grade de horário semanal ─────────────────────────────────────────────────

const SCHEDULE_DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// Ordem de exibição: Seg→Dom (0=Dom fica por último visualmente)
const SCHEDULE_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Constrói as 7 linhas da grade semanal a partir de dados da API ou defaults.
 * Usa DocumentFragment para uma única mutação no DOM (evita 7 reflows separados).
 * @param {Array|null} apiData - Array de {diaSemana, folga, entrada, saida, inicioAlmoco, fimAlmoco}
 *                               Se null, usa defaults (Seg-Sáb com horário da loja, Dom folga).
 */
function buildScheduleGrid(apiData) {
    const container = document.getElementById('scheduleRows');
    if (!container) return;

    const defaults = getGlobalScheduleDefaults();
    const map = {};
    if (apiData) apiData.forEach(d => { map[d.diaSemana] = d; });

    const COLS = '64px 40px 1fr 1fr';
    const frag = document.createDocumentFragment();

    SCHEDULE_DAY_ORDER.forEach(day => {
        const rec    = map[day];
        const isDom  = day === 0;
        const folga  = rec ? rec.folga : isDom;
        const entrada = rec?.entrada || (!folga ? defaults.open  : '');
        const saida   = rec?.saida   || (!folga ? defaults.close : '');
        const dis     = folga ? ' disabled' : '';

        const row = document.createElement('div');
        row.className = `schedule-row grid border-b border-slate-100 last:border-0${folga ? ' schedule-row--off' : ''}`;
        row.style.gridTemplateColumns = COLS;
        row.dataset.day = day;
        row.innerHTML =
            `<div class="px-2 py-2 flex items-center"><span class="text-xs font-black ${isDom ? 'text-rose-500' : 'text-slate-700'}">${SCHEDULE_DAY_LABELS[day]}</span></div>` +
            `<div class="flex items-center justify-center"><input type="checkbox" class="schedule-folga w-4 h-4 cursor-pointer accent-rose-500"${folga ? ' checked' : ''} onchange="toggleScheduleRow(this)"></div>` +
            `<div class="px-1 py-1"><input type="time" class="schedule-entrada input-field text-xs py-0.5 px-1.5 h-8 w-full" value="${entrada}"${dis}></div>` +
            `<div class="px-1 py-1"><input type="time" class="schedule-saida  input-field text-xs py-0.5 px-1.5 h-8 w-full" value="${saida}"${dis}></div>`;
        frag.appendChild(row);
    });

    container.innerHTML = '';       // uma limpeza
    container.appendChild(frag);    // uma inserção em batch
}

/** Mostra esqueleto animado enquanto a grade é carregada da API. */
function buildScheduleGridSkeleton() {
    const container = document.getElementById('scheduleRows');
    if (!container) return;
    container.innerHTML =
        '<div class="flex items-center justify-center gap-2 py-5 text-slate-400 text-xs font-bold">' +
        '<i class="fas fa-spinner fa-spin"></i> Carregando horários…</div>';
}

/** Habilita/desabilita os inputs de horário quando a checkbox Folga é alterada. */
function toggleScheduleRow(checkbox) {
    const row = checkbox.closest('.schedule-row');
    if (!row) return;
    const isOff = checkbox.checked;
    row.classList.toggle('schedule-row--off', isOff);
    row.querySelectorAll('input[type="time"]').forEach(inp => {
        inp.disabled = isOff;
        if (isOff) inp.value = '';
    });
}

/** Coleta dados da grade semanal para enviar à API. */
function getScheduleGridData() {
    const rows = document.querySelectorAll('#scheduleRows .schedule-row');
    return Array.from(rows).map(row => {
        const day   = Number(row.dataset.day);
        const folga = row.querySelector('.schedule-folga').checked;
        return {
            DiaSemana:    day,
            Folga:        folga,
            Entrada:      folga ? null : (row.querySelector('.schedule-entrada').value || null),
            Saida:        folga ? null : (row.querySelector('.schedule-saida').value   || null),
            InicioAlmoco: null, // almoço fixo universal — não configurável por profissional
            FimAlmoco:    null
        };
    });
}

/** Valida a grade: dias de trabalho precisam ter entrada < saída. */
function validateScheduleGrid() {
    const rows = document.querySelectorAll('#scheduleRows .schedule-row');
    for (const row of rows) {
        if (row.querySelector('.schedule-folga').checked) continue;
        const day    = Number(row.dataset.day);
        const label  = SCHEDULE_DAY_LABELS[day];
        const entrada = row.querySelector('.schedule-entrada').value;
        const saida   = row.querySelector('.schedule-saida').value;
        if (!entrada || !saida)
            return `${label}: entrada e saída são obrigatórias.`;
        if (!isValidTimeRange(entrada, saida))
            return `${label}: entrada deve ser antes da saída.`;
    }
    return null;
}

// ── Modal de barbeiro ────────────────────────────────────────────────────────

function openBarberModal() {
    const modal = document.getElementById('barberModal');
    if (!modal) return;

    document.getElementById('barberName').value = '';
    document.getElementById('barberSpecialty').value = '';
    document.getElementById('barberAdditional').value = '';
    document.getElementById('barberPassword').value = '';
    document.getElementById('barberColor').value = '#3498db';
    document.getElementById('barberBlockedSlots').value = '';
    document.getElementById('barberCustomHours').value = '';
    const pixField = document.getElementById('barberPixKey');
    if (pixField) pixField.value = '';

    buildScheduleGrid(null); // sem dados = defaults

    state.currentBarberId = null; // Reset para modo "Criação"
    const title = document.getElementById('barberModalTitle');
    if (title) title.textContent = `Novo ${biz().profissionalSingular}`;

    modal.classList.remove('hidden');
}

function closeBarberModal() {
    const modal = document.getElementById('barberModal');
    if (modal) modal.classList.add('hidden');
}

async function editarBarbeiro(id) {
    const b = state.barbeiros.find(p => (p.Id ?? p.id) == id);
    if (!b) return;

    state.currentBarberId = id;

    // ── Preenche os campos com dados já em cache (sem esperar rede) ──────────
    document.getElementById('barberName').value        = b.Nome ?? b.nome ?? '';
    document.getElementById('barberSpecialty').value   = b.Especialidade ?? b.especialidade ?? '';
    document.getElementById('barberAdditional').value  = b.Adicional ?? b.adicional ?? '';
    document.getElementById('barberPassword').value    = '';
    document.getElementById('barberColor').value       = b.Cor ?? b.cor ?? '#3498db';
    document.getElementById('barberBlockedSlots').value = prettyJson(b.BlockedSlotsJson ?? b.blockedSlotsJson);
    document.getElementById('barberCustomHours').value  = prettyJson(b.CustomHoursJson ?? b.customHoursJson);

    // Mostra esqueleto na grade enquanto a API responde
    buildScheduleGridSkeleton();

    // Limpa chave PIX enquanto carrega
    const pixField = document.getElementById('barberPixKey');
    if (pixField) pixField.value = '';

    const modal = document.getElementById('barberModal');
    const title = document.getElementById('barberModalTitle');
    if (title) title.textContent = `Editar ${biz().profissionalSingular}`;

    // ── Abre o modal imediatamente — sem esperar a rede ──────────────────────
    modal.classList.remove('hidden');

    // ── Carrega grade + chave PIX em background ───────────────────────────────
    try {
        const [scheduleRes, settingsRes] = await Promise.allSettled([
            apiFetch(`/barbeiros/${id}/horarios`),
            apiFetch('/settings')
        ]);

        // Grade semanal
        const scheduleData = scheduleRes.status === 'fulfilled' && scheduleRes.value.ok
            ? await scheduleRes.value.json()
            : null;
        buildScheduleGrid(Array.isArray(scheduleData) && scheduleData.length ? scheduleData : null);

        // Chave PIX do barbeiro
        if (settingsRes.status === 'fulfilled' && settingsRes.value.ok && pixField) {
            const settings = await settingsRes.value.json();
            pixField.value = settings[`Barbeiro_${id}_PixKey`] || '';
        }
    } catch {
        buildScheduleGrid(null);
    }
}

async function saveBarber() {
    const btn = document.getElementById('barberSaveBtn');
    if (btn?.disabled) return; // previne duplo-clique

    const nome          = document.getElementById('barberName')?.value.trim();
    const especialidade = document.getElementById('barberSpecialty')?.value.trim();
    const adicional     = document.getElementById('barberAdditional')?.value.trim();
    const password      = document.getElementById('barberPassword')?.value;
    const cor           = document.getElementById('barberColor')?.value;
    const pixKey        = document.getElementById('barberPixKey')?.value.trim() ?? '';
    const blockedSlots  = parseJsonField('barberBlockedSlots');
    const customHours   = parseJsonField('barberCustomHours');
    const id            = state.currentBarberId;

    // ── Validações síncronas antes de qualquer request ───────────────────────
    if (!nome) {
        triggerShake(btn);
        return showToast('O nome do profissional é obrigatório', 'error');
    }
    if (blockedSlots === false || customHours === false) {
        triggerShake(btn);
        return showToast('JSON de exceções inválido', 'error');
    }

    // Só valida a grade se o DOM tem as linhas reais (não está no estado de esqueleto)
    const gridReady = !!document.querySelector('#scheduleRows .schedule-row');
    if (gridReady) {
        const scheduleErr = validateScheduleGrid();
        if (scheduleErr) {
            triggerShake(btn);
            return showToast(scheduleErr, 'error');
        }
    }

    // ── Loading state — desativa botão e mostra spinner ──────────────────────
    const btnOriginal = btn?.innerHTML ?? 'Salvar';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Salvando…'; }

    try {
        const scheduleData = gridReady ? getScheduleGridData() : null;

        // Deriva campos legado do primeiro dia de trabalho (fallback retrocompat)
        const workingRows     = scheduleData?.filter(r => !r.Folga) ?? [];
        const firstWork       = workingRows[0];
        const legacyWorkStart = firstWork?.Entrada || '08:00';
        const legacyWorkEnd   = firstWork?.Saida   || '18:00';
        const legacyWorkDays  = workingRows.map(r => r.DiaSemana);

        // Almoço é fixo e universal (12:00–12:59) — campos legado sempre limpos.
        // String vazia é interpretada como null pelo backend (ParseNullableTime).
        const lunchFields = { LunchStart: '', LunchEnd: '' };

        const method = id ? 'PATCH' : 'POST';
        const path   = id ? `/barbeiros/${id}` : '/barbeiros';

        // apiFetch já lança uma Error com a mensagem do backend em caso de falha.
        // Não há necessidade de checar res.ok — se chegou aqui, a request foi bem-sucedida.
        const res = await apiFetch(path, {
            method,
            body: JSON.stringify({
                Nome: nome, Especialidade: especialidade, Adicional: adicional,
                Password: password, Cor: cor, Ativo: true,
                WorkStart: legacyWorkStart, WorkEnd: legacyWorkEnd,
                ...lunchFields,
                WorkingDays: legacyWorkDays,
                BlockedSlots: blockedSlots || {}, CustomHours: customHours || {}
            })
        });

        // ── Resolve o ID do barbeiro (existe ou recém-criado) ────────────────
        let barbId = id;
        if (!id) {
            const criado = await res.json();
            barbId = criado?.Id ?? criado?.id;
        }

        // ── Persiste grade semanal ────────────────────────────────────────────
        if (scheduleData && barbId) {
            try {
                await apiFetch(`/barbeiros/${barbId}/horarios`, {
                    method: 'PUT',
                    body: JSON.stringify(scheduleData)
                });
            } catch {
                showToast('Profissional salvo, mas o horário semanal não foi gravado. Edite novamente para retentar.', 'warning');
            }
        }

        // ── Persiste chave PIX individual (via SystemConfigs) ─────────────────
        // Armazena como "Barbeiro_{id}_PixKey" — mesma convenção do Store_{id}_PixKey.
        // Se vazio, salva string vazia para limpar uma chave anterior.
        if (barbId) {
            try {
                await apiFetch('/settings', {
                    method: 'PUT',
                    body: JSON.stringify({ [`Barbeiro_${barbId}_PixKey`]: pixKey })
                });
            } catch {
                // Falha silenciosa — o barbeiro foi salvo; admin pode retentar editando
                showToast('Profissional salvo, mas a chave PIX não foi gravada. Edite novamente para retentar.', 'warning');
            }
        }

        document.getElementById('barberModal').classList.add('hidden');
        showToast(id ? 'Dados atualizados!' : 'Profissional cadastrado!', 'success');
        await carregarBarbeiros();

    } catch (e) {
        // apiFetch lança com a mensagem real do backend (ex: "Carga horaria invalida…")
        // Exibimos diretamente em vez de uma mensagem genérica.
        showToast(e?.message || 'Erro de conexão com o servidor', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = btnOriginal; }
    }
}

async function removerBarbeiro(id) {
    if (!confirm('Tem certeza que deseja remover este profissional?')) return;
    try {
        const res = await apiFetch(`/barbeiros/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Profissional removido', 'success');
            carregarBarbeiros(); // Atualiza a lista
        } else {
            const data = await res.json();
            showToast(data.error || 'Erro ao remover profissional', 'error');
        }
    } catch (e) { showToast('Erro ao remover profissional', 'error'); }
}

async function saveGeneralSettings() {
    const btn = document.querySelector('#view-configuracoes button.btn-primary');
    const open = document.getElementById('setOpening')?.value;
    const close = document.getElementById('setClosing')?.value;
    const originalText = btn ? btn.innerHTML : '';
    
    if (!open || !close) {
        triggerShake(btn);
        return showToast('Horários de abertura e fechamento são obrigatórios', 'error');
    }

    if (!isValidTimeRange(open, close)) {
        triggerShake(btn);
        return showToast('Horário invalido: fechamento precisa ser maior que abertura.', 'error');
    }

    try {
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        
        // Envia chaves que o Backend e o Bot utilizam internamente
        const settings = {
            "HorárioAbertura": open,
            "HorárioFechamento": close,
            "LimitService_1": document.getElementById('limit_1')?.value || "0",
            "LimitService_2": document.getElementById('limit_2')?.value || "0",
            "LimitService_3": document.getElementById('limit_3')?.value || "0",
            "LimitService_4": document.getElementById('limit_combos')?.value || "0",
            "LimitService_5": document.getElementById('limit_combos')?.value || "0",
            "LimitService_6": document.getElementById('limit_combos')?.value || "0",
            "DurationService_1": document.getElementById('duration_1')?.value || "30",
            "DurationService_2": document.getElementById('duration_2')?.value || "20",
            "DurationService_3": document.getElementById('duration_3')?.value || "15",
            "DurationService_4": document.getElementById('duration_4')?.value || "50",
            "DurationService_5": document.getElementById('duration_5')?.value || "45",
            "DurationService_6": document.getElementById('duration_6')?.value || "65",
            "Retention_Days": document.getElementById('retentionDays')?.value || "15",
            "Msg_Retention": document.getElementById('retentionMessage')?.value || `Olá, {nome}! Sentimos sua falta na {loja}. Que tal agendar um novo ${biz().agendamentoPlural.replace(/s$/, '')} esta semana? Digite *oi* para agendar.`,
            "Active_Retention": "true",
            "GoogleSheets_WebhookUrl": document.getElementById('googleSheetsWebhook')?.value?.trim() || ""
        };

        [1, 2, 3, 4, 5, 6].forEach(id => {
            settings[`Service_${id}_Name`] = document.getElementById(`serviceName_${id}`)?.value?.trim() || document.getElementById(`serviceName_${id}`)?.placeholder || '';
            settings[`Service_${id}_Price`] = document.getElementById(`price_${id}`)?.value || '0';
            settings[`Service_${id}_Active`] = document.getElementById(`active_${id}`)?.checked ? 'true' : 'false';
        });

        const res = await apiFetch('/settings', { 
            method: 'PUT',
            body: JSON.stringify(settings)
        });

        if (res.ok) {
            showToast('Configurações salvas com sucesso!', 'success');
            state.settings = { ...state.settings, ...settings };
            await loadGeneralSettings();
            updateManualAvailableSlots();
            loadData();
        }
        else {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Erro ao salvar configurações');
        }
    } catch (e) {
        showToast(e.message || 'Erro ao salvar configurações', 'error');
    } finally {
        if (btn) btn.innerHTML = originalText;
    }
}

async function runSafeCleanup() {
    const btn = document.getElementById('safeCleanupBtn');
    const status = document.getElementById('safeCleanupStatus');

    // Marcador usado pelos testes de manutenção segura: Nao sera apagado.
    const ok = confirm([
        'Executar limpeza segura agora?',
        '',
        'Será limpo apenas:',
        '- cache temporário do backend',
        '- pendências do bot pausado',
        '- notificações visuais desta sessão',
        '',
        'Não será apagado: agenda, clientes, usuários, senhas, empresas, planilhas ou sessão do WhatsApp.'
    ].join('\n'));

    if (!ok) return;

    const original = btn ? btn.innerHTML : '';
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Limpando...';
        }
        if (status) status.textContent = 'Executando limpeza segura...';

        const res = await apiFetch('/maintenance/safe-cleanup', { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok && res.status !== 207) throw new Error(data.error || 'Falha na limpeza segura');

        const removedPending = data.bridge?.removed ?? 0;
        state.notifications = [];
        updateNotificationBadge();
        renderNotificationCenter();

        const message = `Limpeza concluida. Pendencias removidas: ${removedPending}. Dados principais preservados.`;
        if (status) status.textContent = message;
        showToast(message, data.ok ? 'success' : 'info');
        loadBotStatus();
    } catch (e) {
        if (status) status.textContent = e.message || 'Falha ao executar limpeza segura.';
        showToast(e.message || 'Falha ao executar limpeza segura', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }
}

async function loadGeneralSettings() {
    try {
        const res = await apiFetch('/settings');
        const settings = await res.json();
        state.settings = settings || {};
        
        if (settings.HorárioAbertura) document.getElementById('setOpening').value = settings.HorárioAbertura;
        if (settings.HorárioFechamento) document.getElementById('setClosing').value = settings.HorárioFechamento;
        
        if (settings.LimitService_1) document.getElementById('limit_1').value = settings.LimitService_1;
        if (settings.LimitService_2) document.getElementById('limit_2').value = settings.LimitService_2;
        if (settings.LimitService_3) document.getElementById('limit_3').value = settings.LimitService_3;
        if (settings.LimitService_4) document.getElementById('limit_combos').value = settings.LimitService_4;
        [1, 2, 3, 4, 5, 6].forEach(id => {
            if (settings[`DurationService_${id}`]) document.getElementById(`duration_${id}`).value = settings[`DurationService_${id}`];
            const nameInput = document.getElementById(`serviceName_${id}`);
            const priceInput = document.getElementById(`price_${id}`);
            const activeInput = document.getElementById(`active_${id}`);
            if (nameInput) nameInput.value = settings[`Service_${id}_Name`] || nameInput.placeholder || '';
            if (priceInput) priceInput.value = settings[`Service_${id}_Price`] || '';
            if (activeInput) activeInput.checked = settings[`Service_${id}_Active`] !== 'false';
        });
        applyServiceSettings(settings);
        const sheetsWebhook = document.getElementById('googleSheetsWebhook');
        if (sheetsWebhook) sheetsWebhook.value = settings.GoogleSheets_WebhookUrl || '';
        const retentionDays = document.getElementById('retentionDays');
        if (retentionDays) retentionDays.value = settings.Retention_Days || '15';
        const retentionMessage = document.getElementById('retentionMessage');
        if (retentionMessage) retentionMessage.value = settings.Msg_Retention || '';
        renderOnboardingChecklist();
    } catch (e) {
        console.error("Erro ao carregar configurações:", e);
    }
}

// --- GESTÃO DE AUTOMAÇÕES ---
async function loadAutomations() {
    const grid = document.getElementById('automationGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="col-span-full text-center py-10"><i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i></div>';

    try {
        const res = await apiFetch('/bot/templates');
        if (!res.ok) throw new Error('Falha ao buscar automações');
        const settings = await res.json();
        
        // Mapeamento amigável das chaves do banco para a UI.
        // noMessage:true → card compacto (só toggle + descrição, sem textarea/testar)
        const templates = [
            { key: 'Msg_Welcome', title: 'Mensagem de Boas-vindas', desc: 'Primeiro contato do cliente', icon: 'fa-hand-sparkles' },
            { key: 'Msg_Confirmation', title: 'Confirmação de Agendamento', desc: 'Enviada logo após marcar', icon: 'fa-calendar-check' },
            { key: 'Msg_Reminder24h', title: 'Lembrete (24 horas)', desc: 'Aviso um dia antes', icon: 'fa-clock', toggle: 'Active_Reminder24h' },
            { key: 'Msg_Reminder1h', title: 'Lembrete (1 hora)', desc: `Aviso imediato antes do ${biz().agendamentoPlural.replace(/s$/, '')}`, icon: 'fa-bolt', toggle: 'Active_Reminder1h' },
            { key: 'Msg_Thanks', title: `Agradecimento Pós-${biz().agendamentoPlural.replace(/[sS]$/, '')}`, desc: 'Enviada após o atendimento', icon: 'fa-heart', toggle: 'Active_Thanks' },
            { key: 'Msg_Retention', title: 'Retorno de Cliente', desc: 'Reengajamento após dias sem visita', icon: 'fa-rotate-left', toggle: 'Active_Retention' },
            // Comportamento do programa de fidelidade — toggle sem mensagem personalizável
            {
                key: null,
                title: `Qualquer ${biz().profissionalSingular} no Programa`,
                desc: `Exibe a opção "Sem preferência" ao assinar um plano`,
                icon: 'fa-users',
                toggle: 'Active_SubscriptionAnyBarber',
                noMessage: true,
                toggleOnLabel:  `Ativado — cliente escolhe ${biz().profissionalSingular.toLowerCase()} específico ou qualquer um`,
                toggleOffLabel: `Desativado — cliente deve escolher um ${biz().profissionalSingular.toLowerCase()} específico`
            }
        ];

        grid.innerHTML = templates.map(t => {
            const text = t.key ? (settings[t.key] || '') : '';
            const isActive = t.toggle ? settings[t.toggle] === 'true' : true;
            const retentionControls = t.key === 'Msg_Retention' ? `
                <label class="text-[10px] font-black text-gray-400 uppercase">Intervalo em dias</label>
                <input class="input-field text-xs" type="number" min="7" max="90" value="${settings.Retention_Days || '15'}"
                    onchange="saveSingleConfig('Retention_Days', this.value)">
            ` : '';

            // Card compacto para entradas sem mensagem (noMessage: true)
            if (t.noMessage) {
                const statusLabel = isActive
                    ? (t.toggleOnLabel  || 'Ativado')
                    : (t.toggleOffLabel || 'Desativado');
                return `
                    <div class="panel p-5 flex flex-col gap-3">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                                    <i class="fas ${t.icon}"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-gray-950 text-sm">${t.title}</h4>
                                    <p class="text-xs text-gray-500">${t.desc}</p>
                                </div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                <input type="checkbox" value="" class="sr-only peer" ${isActive ? 'checked' : ''}
                                    onchange="saveSubscriptionAnyBarberToggle(this.checked)">
                                <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                        <p class="text-xs font-semibold px-1 ${isActive ? 'text-purple-600' : 'text-gray-400'}" id="anyBarberStatusLabel">${statusLabel}</p>
                    </div>
                `;
            }

            return `
                <div class="panel p-5 flex flex-col gap-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                <i class="fas ${t.icon}"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-950 text-sm">${t.title}</h4>
                                <p class="text-xs text-gray-500">${t.desc}</p>
                            </div>
                        </div>
                        ${t.toggle ? `
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" value="" class="sr-only peer" ${isActive ? 'checked' : ''}
                                    onchange="saveSingleConfig('${t.toggle}', this.checked)">
                                <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        ` : ''}
                    </div>

                    <textarea class="input-field text-xs font-medium h-32 resize-none"
                        onfocus="state.lastTemplateField = this"
                        onchange="saveSingleConfig('${t.key}', this.value)">${text}</textarea>
                    ${retentionControls}

                    <button onclick="testAutomation('${t.key}')" class="btn btn-light w-full py-2 text-xs">
                        <i class="fas fa-vial"></i> Testar Fluxo
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) {
        grid.innerHTML = emptyStateUI('fa-exclamation-triangle', 'Erro ao carregar automações');
    }
}

async function saveSingleConfig(key, value) {
    try {
        const res = await apiFetch('/bot/templates', {
            method: 'PUT',
            body: JSON.stringify({ [key]: String(value) })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Erro ao salvar automação');
        showToast('Automação atualizada!', 'success');
    } catch (e) { showToast(e.message || 'Erro ao salvar', 'error'); }
}

async function saveSubscriptionAnyBarberToggle(checked) {
    try {
        const res = await apiFetch('/bot/templates', {
            method: 'PUT',
            body: JSON.stringify({ Active_SubscriptionAnyBarber: String(checked) })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
        // Atualiza o label de status sem recarregar a grid inteira
        const label = document.getElementById('anyBarberStatusLabel');
        if (label) {
            if (checked) {
                label.textContent = 'Ativado — cliente escolhe profissional específico ou qualquer um';
                label.className = 'text-xs font-semibold px-1 text-purple-600';
            } else {
                label.textContent = 'Desativado — cliente deve escolher um profissional específico';
                label.className = 'text-xs font-semibold px-1 text-gray-400';
            }
        }
        showToast('Configuração de fidelidade atualizada!', 'success');
    } catch (e) { showToast(e.message || 'Erro ao salvar', 'error'); }
}

async function testAutomation(key) {
    showToast('Simulando interação do cliente...', 'info');
    try {
        // Envia um "oi" simulado para o bot processar
        const res = await apiFetch('/bot/simulate', {
            method: 'POST',
            body: JSON.stringify({ from: '5511999999999', body: 'oi', pushname: 'Cliente Teste' })
        });
        if (res.ok) showToast('Simulação enviada! Verifique o log do Bot.', 'success');
    } catch (e) { showToast('Erro na simulação', 'error'); }
}

async function runDashboardFlowTest(key) {
    const resultBox = document.getElementById('flowTestResult');
    const phone = document.getElementById('flowTestPhone')?.value?.trim() || '5511999999999';
    const messages = {
        Msg_Welcome: 'oi',
        Msg_Confirmation: '1',
        Msg_Reminder24h: 'oi',
        Msg_Reminder1h: 'oi',
        Msg_Thanks: 'oi',
        Msg_Retention: 'oi'
    };
    const text = messages[key] || 'oi';

    showToast('Simulando interação do cliente...', 'info');
    if (resultBox) {
        resultBox.className = 'mt-6 panel p-4 text-sm font-semibold text-blue-700 bg-blue-50 border-blue-100';
        resultBox.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando teste para o backend...';
    }

    try {
        const res = await apiFetch('/bot/simulate', {
            method: 'POST',
            body: JSON.stringify({ phone, text, pushname: 'Cliente Teste Dashboard' })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.details || data.error || 'Falha no teste de fluxo');

        showToast('Teste enviado ao fluxo do bot!', 'success');
        if (resultBox) {
            resultBox.className = 'mt-6 panel p-4 text-sm font-semibold text-green-700 bg-green-50 border-green-100';
            resultBox.innerHTML = `
                <div class="font-black mb-1">Teste executado</div>
                <div>Modo: ${data.mode || 'backend-webhook'} · Telefone: ${data.phone || phone} · Entrada: "${data.text || text}"</div>
                <div class="text-xs text-green-600 mt-1">Se o bridge estiver conectado, a resposta aparece no WhatsApp de teste.</div>
            `;
        }
    } catch (e) {
        showToast(e.message || 'Erro na simulação', 'error');
        if (resultBox) {
            resultBox.className = 'mt-6 panel p-4 text-sm font-semibold text-red-700 bg-red-50 border-red-100';
            resultBox.textContent = e.message || 'Erro na simulação';
        }
    }
}

testAutomation = runDashboardFlowTest;

/* ════════════════════════════════════════
   AUTOMAÇÕES — CONTROLE EM TEMPO REAL
════════════════════════════════════════ */

// Status do bot dentro da aba Automações (reutiliza /bot/status)
async function loadAutomationStatus() {
    const dot = document.getElementById('autoBotDot');
    const statusText = document.getElementById('autoBotStatusText');
    const subText = document.getElementById('autoBotSubText');
    const toggleBtn = document.getElementById('autoBotToggleBtn');
    const pendingEl = document.getElementById('autoBotPending');
    if (!dot || !toggleBtn) return;

    try {
        const res = await apiFetch('/bot/status');
        const data = await res.json();
        state.bot = data;

        const connectionState = data.connectionState || data.state || (data.whatsappConnected ? 'ONLINE' : 'OFFLINE');
        const connected = connectionState === 'ONLINE' || !!data.whatsappConnected;
        const enabled = !!data.botEnabled;

        // Indicador de conexão
        dot.className = `w-3 h-3 rounded-full flex-shrink-0 ${connected ? 'bg-green-500 pulse' : (connectionState === 'RECONNECTING' || connectionState === 'QR_REQUIRED' ? 'bg-yellow-500 pulse' : 'bg-red-500')}`;

        if (!connected) {
            statusText.textContent = connectionState === 'QR_REQUIRED' ? 'Aguardando leitura do QR Code' : 'WhatsApp desconectado';
            subText.textContent = 'Conecte o WhatsApp na aba “Bot” para as automações funcionarem.';
        } else {
            statusText.textContent = enabled ? 'Atendimento automático ativo' : 'Atendimento automático pausado';
            subText.textContent = enabled
                ? 'O bot está respondendo e enviando mensagens automaticamente.'
                : 'O bot está pausado — nenhuma mensagem automática será enviada.';
        }

        // Botão de pausar/ativar
        toggleBtn.disabled = !connected;
        toggleBtn.innerHTML = enabled ? '<i class="fas fa-pause"></i> Pausar bot' : '<i class="fas fa-play"></i> Ativar bot';
        toggleBtn.className = `btn ${enabled ? 'btn-yellow' : 'btn-green'} px-4 py-2 text-sm`;

        // Pendências acumuladas durante a pausa
        const pending = Number(data.pausedPendingCount || 0);
        if (pendingEl) {
            if (pending > 0) {
                pendingEl.classList.remove('hidden');
                pendingEl.textContent = `${pending} cliente${pending === 1 ? '' : 's'} aguardando`;
            } else {
                pendingEl.classList.add('hidden');
            }
        }
    } catch (e) {
        dot.className = 'w-3 h-3 rounded-full flex-shrink-0 bg-red-500';
        statusText.textContent = 'Não foi possível verificar o bot';
        subText.textContent = 'Tente atualizar novamente em instantes.';
        toggleBtn.disabled = true;
    }
}

// Pausar/ativar a partir da aba Automações
async function toggleBotFromAutomations() {
    await toggleBot();
    await loadAutomationStatus();
}

// Variáveis suportadas nos templates — contextualizadas ao tipo da loja
const AUTOMATION_VARIABLES = [
    { token: '{nome}',        hint: 'Nome do cliente' },
    { token: '{serviço}',     hint: 'Serviço escolhido' },
    { token: '{data}',        hint: 'Data do agendamento' },
    { token: '{horário}',     hint: 'Horário do agendamento' },
    { token: '{preço}',       hint: 'Valor do serviço' },
    { token: '{profissional}',hint: () => biz().profissionalSingular },
    { token: '{veículo}',     hint: 'Veículo (lava-jato)' },
    { token: '{loja}',        hint: 'Nome da loja' }
];

function renderAutomationVariables() {
    const wrap = document.getElementById('automationVariables');
    if (!wrap) return;
    wrap.innerHTML = AUTOMATION_VARIABLES.map(v => `
        <button type="button" onclick="insertAutomationVariable('${v.token}')"
            title="${typeof v.hint === 'function' ? v.hint() : v.hint}"
            class="px-2 py-1 bg-white border border-blue-200 rounded text-xs font-mono text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer">
            ${escapeHtml(v.token)}
        </button>
    `).join('');
}

// Insere a variável no último campo de template focado (ou copia para a área de transferência)
function insertAutomationVariable(token) {
    const field = state.lastTemplateField;
    if (field && document.body.contains(field)) {
        const start = field.selectionStart ?? field.value.length;
        const end = field.selectionEnd ?? field.value.length;
        field.value = field.value.slice(0, start) + token + field.value.slice(end);
        const caret = start + token.length;
        field.focus();
        field.setSelectionRange(caret, caret);
        field.dispatchEvent(new Event('change')); // dispara o saveSingleConfig
        showToast(`Variável ${token} inserida e salva.`, 'success');
    } else {
        navigator.clipboard?.writeText(token).catch(() => {});
        showToast(`Selecione um campo de mensagem. ${token} copiado.`, 'info');
    }
}

function openNotificationCenter() {
    const center = document.getElementById('notificationCenter');
    renderNotificationCenter();
    if (center) center.classList.remove('hidden');
}

function closeNotificationCenter() {
    const center = document.getElementById('notificationCenter');
    if (center) center.classList.add('hidden');
}

function updateNotificationBadge() {
    const badge = document.querySelector('.notification-center-badge');
    if (badge) badge.dataset.count = String(state.notifications.length);
}

function renderNotificationCenter() {
    const list = document.getElementById('notificationList');
    if (!list) return;

    if (!state.notifications.length) {
        list.innerHTML = '<div class="text-center py-8 text-gray-500 font-bold">Nenhuma notificação recebida nesta sessão.</div>';
        return;
    }

    list.innerHTML = state.notifications.map(n => {
        const title = escapeHtml(n.Title || n.title || 'Notificação');
        const message = escapeHtml(n.Message || n.message || '');
        const rawDate = n.Timestamp || n.timestamp;
        const when = rawDate ? new Date(rawDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Agora';
        return `
            <div class="soft-panel p-4 border-l-4 border-blue-500">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="font-black text-gray-950">${title}</div>
                        <div class="text-sm text-gray-600 font-semibold mt-1">${message}</div>
                    </div>
                    <span class="text-xs font-bold text-gray-400">${when}</span>
                </div>
            </div>`;
    }).join('');
}

// --- NOTIFICAÇÕES (TOAST & SOUND) ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const colors = {
        success: 'bg-green-50 border-green-200 text-green-700',
        error: 'bg-red-50 border-red-200 text-red-700',
        info: 'bg-blue-50 border-blue-200 text-blue-700'
    };

    const toast = document.createElement('div');
    toast.className = `toast border px-4 py-3 rounded-lg font-bold text-sm shadow-lg ${colors[type]}`;
    toast.innerHTML = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('exit');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
    
}

let notificationAudioUnlocked = false;

async function unlockNotificationSound() {
    if (notificationAudioUnlocked) return true;
    const audio = document.getElementById('notificationSound');
    if (!audio) return false;
    try {
        audio.volume = 0.001;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
        notificationAudioUnlocked = true;
        return true;
    } catch {
        return false;
    }
}

function playNotificationSound() {
    const audio = document.getElementById('notificationSound');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {
            // Fallback sintético se o navegador bloquear o autoplay do MP3
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
            } catch (e) {}
        });
    }
}

async function requestNotificationPermission() {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "default") {
        return await Notification.requestPermission();
    }
    return Notification.permission;
}

async function enablePersistentNotifications() {
    await unlockNotificationSound();
    await ensureServiceWorkerRegistration().catch(() => null);
    const permission = await requestNotificationPermission();
    updateNotificationPermissionButton();
    if (permission === "granted") {
        showToast('Alertas ativados. A dashboard pode notificar mesmo em segundo plano.', 'success');
    } else if (permission === "denied") {
        showToast('Notificações bloqueadas no navegador. Libere nas permissões do site.', 'error');
    } else {
        showToast('Seu navegador não suporta notificações nativas neste modo.', 'info');
    }
}

function updateNotificationPermissionButton() {
    const btn = document.getElementById('notificationPermissionBtn');
    if (!btn) return;
    const permission = "Notification" in window ? Notification.permission : "unsupported";
    const enabled = permission === "granted";
    btn.innerHTML = enabled ? '<i class="fas fa-bell"></i> Alertas ON' : '<i class="fas fa-volume-high"></i> Alertas';
    btn.classList.toggle('btn-green', enabled);
    btn.classList.toggle('btn-light', !enabled);
}

document.addEventListener('click', () => {
    requestNotificationPermission();
    unlockNotificationSound();
    ensureServiceWorkerRegistration().catch(() => {});
    updateNotificationPermissionButton();
}, { once: true });

async function ensureServiceWorkerRegistration() {
    if (!('serviceWorker' in navigator)) return null;
    const registration = await navigator.serviceWorker.register('/sw.js');
    if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    return registration;
}

function isPwaStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

/** Retorna true se o dispositivo for iOS (iPhone, iPad, iPod) */
function isIosDevice() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Retorna true se o browser atual for Safari (iOS ou macOS) */
function isSafariBrowser() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * Atualiza o botão de instalação no header command-bar.
 * Só aparece em Android/Chrome quando beforeinstallprompt foi capturado.
 */
function updatePwaInstallButton() {
    const btn = document.getElementById('pwaInstallBtn');
    if (!btn) return;
    const canInstall = !!deferredPwaInstallPrompt && !isPwaStandalone() && !isIosDevice();
    btn.classList.toggle('hidden', !canInstall);
}

/**
 * Atualiza o card de instalação na aba Ajustes com base no dispositivo/browser.
 * Chamado quando a aba Ajustes é aberta.
 */
function updatePwaSettingsCard() {
    const standalone = isPwaStandalone();
    const ios = isIosDevice();
    const safari = isSafariBrowser();
    const canAndroidInstall = !!deferredPwaInstallPrompt;

    // Elementos do card
    const alreadyInstalled  = document.getElementById('pwaAlreadyInstalled');
    const androidInstall    = document.getElementById('pwaAndroidInstall');
    const iosInstall        = document.getElementById('pwaIosInstall');
    const iosNotSafari      = document.getElementById('pwaIosNotSafari');
    const genericInfo       = document.getElementById('pwaGenericInfo');

    if (!alreadyInstalled) return; // seção ainda não no DOM

    // Esconde tudo, depois mostra o estado correto
    [alreadyInstalled, androidInstall, iosInstall, genericInfo].forEach(el => el?.classList.add('hidden'));

    if (standalone) {
        // Já instalado como PWA
        alreadyInstalled?.classList.remove('hidden');
    } else if (ios) {
        // iPhone / iPad: sempre mostra instruções, com aviso se não for Safari
        iosInstall?.classList.remove('hidden');
        if (iosNotSafari) iosNotSafari.classList.toggle('hidden', safari);
    } else if (canAndroidInstall) {
        // Android/Chrome com beforeinstallprompt disponível
        androidInstall?.classList.remove('hidden');
    } else {
        // Outros browsers/situações
        genericInfo?.classList.remove('hidden');
    }
}

async function installPwaApp() {
    if (!deferredPwaInstallPrompt) {
        if (isIosDevice()) {
            showView('configuracoes'); // Navega para Ajustes onde as instruções iOS ficam
            showToast('Veja as instruções na aba Ajustes para instalar no iPhone.', 'info');
        } else {
            showToast('Para instalar, use o Chrome e aguarde o prompt de instalação aparecer.', 'info');
        }
        return;
    }

    deferredPwaInstallPrompt.prompt();
    const choice = await deferredPwaInstallPrompt.userChoice;
    deferredPwaInstallPrompt = null;
    updatePwaInstallButton();
    updatePwaSettingsCard();
    if (choice.outcome === 'accepted') {
        showToast('Instalação do aplicativo iniciada! 🎉', 'success');
    }
}

async function displayWebNotification(notification) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const details = getNotificationDetails(notification);
    const options = {
        body: details.body,
        icon: '/assets/pwa-192.png',
        badge: '/assets/pwa-192.png',
        tag: details.tag,
        renotify: true,
        data: { url: '/dashboard-improved.html', notification }
    };

    const registration = await ensureServiceWorkerRegistration();
    if (registration?.showNotification) {
        await registration.showNotification(details.title, options);
    } else {
        new Notification(details.title, options);
    }
}

// --- UTILS & FORMATTERS ---
function triggerShake(el) {
    if (!el) return;
    el.classList.remove('animate-shake');
    void el.offsetWidth; // Força reflow para reiniciar animação
    el.classList.add('animate-shake');
}

function formatCurrency(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); }
function formatTime(d) { return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function formatShortDate(d) { return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function formatDateOnly(value) { const d = new Date(`${String(value).slice(0, 10)}T00:00:00`); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
function getAppointmentDate(a) { return new Date(a.DateTime || a.dateTime); }
function isSameDay(d1, d2) { return d1.toDateString() === d2.toDateString(); }
function endOfDay(d) { const e = new Date(d); e.setHours(23, 59, 59, 999); return e; }
function updateText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function escapeHtml(str) { return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }
function escapeAttr(str) { return escapeHtml(str ?? '').replace(/`/g, '&#96;'); }
function normalizeAppointment(a) {
    const confirmed = a.PresencaConfirmada ?? a.presencaConfirmada ?? a.PresençaConfirmada ?? a.presençaConfirmada ?? false;
    return {
        Id: a.Id ?? a.id,
        DateTime: a.DateTime ?? a.dateTime,
        ContactName: a.ContactName ?? a.contactName ?? 'Cliente',
        Notes: a.Notes ?? a.notes ?? '',
        PhoneNumber: a.PhoneNumber ?? a.phoneNumber ?? '',
        Servico: a.Servico ?? a.servico ?? 'Corte',
        BarberId: a.BarberId ?? a.barberId ?? null,
        BarberName: a.BarberName ?? a.barberName ?? 'Profissional n\u00e3o definido',
        BarberColor: a.BarberColor ?? a.barberColor ?? '#64748b',
        Preco: a.Preco ?? a.preco ?? 0,
        PresençaConfirmada: !!confirmed,
        PresencaConfirmada: !!confirmed,
        DuracaoMinutos: a.DuracaoMinutos ?? a.duracaoMinutos ?? 30
    };
}

function isAppointmentConfirmed(a) {
    return !!(a?.PresencaConfirmada ?? a?.presencaConfirmada ?? a?.PresençaConfirmada ?? a?.presençaConfirmada);
}
function uniqueAppointments(items) {
    const seen = new Map();
    items.forEach(i => { if(i.Id) seen.set(String(i.Id), i); });
    return Array.from(seen.values());
}

// --- UI STATE HELPERS ---
function setApiStatusUI(status) {
    const dot = document.querySelector('#status-api .status-dot');
    if (!dot) return;
    const colors = { online: 'bg-green-500 pulse', loading: 'bg-yellow-500 pulse', offline: 'bg-red-500' };
    dot.className = `status-dot ${colors[status] || 'bg-gray-300'}`;
}

function setRealtimeStatusUI(status) {
    state.realtimeStatus = status;
    const wrapper = document.getElementById('status-realtime');
    const dot = wrapper?.querySelector('.status-dot');
    if (!wrapper || !dot) return;

    const colors = { online: 'bg-green-500 pulse', loading: 'bg-yellow-500 pulse', offline: 'bg-red-500' };
    const labels = { online: 'Tempo real', loading: 'Reconectando', offline: 'Sem tempo real' };
    dot.className = `status-dot ${colors[status] || 'bg-gray-300'}`;
    wrapper.lastChild.textContent = ` ${labels[status] || 'Tempo real'}`;
}

function showUIError(el, msg) {
    if (!el) return alert(msg);
    el.textContent = msg;
    el.classList.remove('hidden');
}

function emptyStateUI(icon, text) {
    return `
        <div class="text-center py-12 border border-dashed border-slate-200 rounded-lg text-slate-400">
            <i class="fas ${icon} text-3xl mb-2 animate-bounce"></i>
            <p class="font-bold animate-pulse">${text}</p>
        </div>`;
}

function showView(view) {
    if (view === state.activeView && view !== 'agenda') return;
    state.activeView = view;
    // Marca a view ativa no body para CSS poder ajustar header, subtítulo, etc.
    document.body.dataset.activeView = view;

    // Para o auto-refresh do status das automações ao sair da aba
    if (view !== 'automacoes' && state.automationStatusTimer) {
        clearInterval(state.automationStatusTimer);
        state.automationStatusTimer = null;
    }

    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`view-${view}`);
    if (target) {
        target.classList.add('active');
    }
    
    document.querySelectorAll('[data-view-button]').forEach(btn => 
        btn.classList.toggle('active', btn.dataset.viewButton === view)
    );
    
    const titles = { agenda: 'Agenda', clientes: 'Clientes', bot: 'Bot WhatsApp', diagnostico: 'Diagnóstico', automacoes: 'Automações', relatorios: 'Relatórios', configuracoes: 'Configurações' };
    const titlesV2 = {
        agenda: 'Agenda do dia',
        'tech-overview': 'Painel de otimizações',
        'tech-queue': 'Fila de otimizações',
        'tech-devices': 'Computadores',
        'tech-services': 'Serviços de otimização',
        'tech-reports': 'Relatórios de otimização',
        clientes: 'Clientes e CRM',
        bot: 'Central WhatsApp',
        diagnostico: 'Diagnóstico operacional',
        automacoes: 'Fluxos de mensagem',
        relatorios: 'Performance da loja',
        configuracoes: 'Preferências',
        calendario: 'Calendário visual',
        assinaturas: biz().tituloAssinaturas
    };
    updateText('pageTitle', titlesV2[view] || titles[view] || 'Painel');
    const subtitles = {
        agenda: biz().subtitleAgenda,
        'tech-overview': 'Controle triagem, sessões remotas, resultados e WhatsApp em um fluxo rápido.',
        'tech-queue': 'Acompanhe cada atendimento do novo ao concluído com status, pacote e checklist.',
        'tech-devices': 'Computadores dos clientes para histórico operacional, sem estoque ou hardware avançado.',
        'tech-services': 'Apresente benefícios, duração e valor de cada serviço remoto com clareza.',
        'tech-reports': 'Indicadores básicos de tickets, receita, status, modalidade e tempo médio.',
        clientes: 'CRM avançado com histórico, tags, preferências, retorno e ações assistidas.',
        bot: 'Acompanhe conexão, QR Code, atendimento e manutenção segura.',
        diagnostico: 'Veja assinatura, módulos, checklist do segmento e prontidão operacional.',
        automacoes: 'Edite fluxos e mensagens usadas pelo bot em tempo real.',
        relatorios: `Veja receita, volume de ${biz().agendamentoPlural}, presença e saúde do sistema.`,
        configuracoes: 'Configure horários, limites, durações e integrações.',
        calendario: `Visualize ${biz().agendamentoPlural} por semana ou mês. Clique em um horário para agendar.`,
        assinaturas: `Gerencie membros, planos e créditos do programa de fidelidade da loja.`
    };
    updateText('pageSubtitle', subtitles[view] || 'Visao geral do sistema.');

    if (view === 'automacoes') {
        loadAutomations();
        renderAutomationVariables();
        loadAutomationStatus();
        // Atualiza o status do bot a cada 15s enquanto a aba estiver aberta (tempo real)
        if (!state.automationStatusTimer) {
            state.automationStatusTimer = setInterval(loadAutomationStatus, 15000);
        }
    }

    if (view === 'relatorios') {
        loadDetailedStats();
    }

    if (view === 'clientes') {
        loadClients();
    }

    if (view === 'diagnostico') {
        loadDiagnostics();
    }

    if (view.startsWith('tech-')) {
        loadOptimizationData();
    }

    if (view === 'configuracoes') {
        loadGeneralSettings();
        loadServicesManager();
        updatePwaSettingsCard();
    }

    if (view === 'calendario') {
        renderCalendar();
    }

    if (view === 'assinaturas') {
        loadSubscriptionStats();
        loadSubscriptions();
        loadPlans();
        loadPixKey();
    }

    applyTechNavigation();
}

// ═══════════════════════════════════════════════════════════════════════════════
// OTIMIZACAO DE COMPUTADORES
// ═══════════════════════════════════════════════════════════════════════════════

const OPTIMIZATION_STATUSES = [
    'Novo', 'Triagem', 'Agendado', 'AguardandoCliente',
    'EmOtimizacao', 'EmRevisao', 'Pronto', 'Concluido', 'Cancelado'
];

const OPTIMIZATION_STATUS_LABELS = {
    Novo: 'Novo',
    Triagem: 'Triagem',
    Agendado: 'Agendado',
    AguardandoCliente: 'Aguardando cliente',
    EmOtimizacao: 'Em otimização',
    EmRevisao: 'Em revisão',
    Pronto: 'Pronto',
    Concluido: 'Concluído',
    Cancelado: 'Cancelado'
};

function optimizationStatusClass(status) {
    return {
        Novo: 'bg-blue-100 text-blue-700',
        Triagem: 'bg-slate-100 text-slate-700',
        Agendado: 'bg-sky-100 text-sky-700',
        AguardandoCliente: 'bg-orange-100 text-orange-700',
        EmOtimizacao: 'bg-teal-100 text-teal-700',
        EmRevisao: 'bg-yellow-100 text-yellow-800',
        Pronto: 'bg-green-100 text-green-700',
        Concluido: 'bg-emerald-100 text-emerald-700',
        Cancelado: 'bg-red-100 text-red-700'
    }[status] || 'bg-slate-100 text-slate-600';
}

function normalizeOptimizationTicket(item = {}) {
    const rawChecklist = item.Checklist ?? item.checklist;
    let checklist = Array.isArray(rawChecklist) ? rawChecklist : [];
    if (!checklist.length) {
        try {
            checklist = JSON.parse(item.OptimizationChecklistJson ?? item.optimizationChecklistJson ?? '[]');
        } catch { checklist = []; }
    }

    return {
        id: item.Id ?? item.id,
        ticketNumber: item.TicketNumber ?? item.ticketNumber ?? '-',
        customerName: item.CustomerName ?? item.customerName ?? 'Cliente',
        phoneNumber: item.PhoneNumber ?? item.phoneNumber ?? '',
        serviceName: item.ServiceName ?? item.serviceName ?? 'Pacote não definido',
        serviceId: item.ServiceId ?? item.serviceId ?? null,
        serviceMode: item.ServiceMode ?? item.serviceMode ?? 'Remoto',
        goal: item.Goal ?? item.goal ?? 'Melhorar desempenho geral',
        reportedProblem: item.ReportedProblem ?? item.reportedProblem ?? '',
        urgency: item.Urgency ?? item.urgency ?? 'Essa semana',
        status: item.Status ?? item.status ?? 'Novo',
        estimatedAmount: Number(item.EstimatedAmount ?? item.estimatedAmount ?? 0),
        finalAmount: Number(item.FinalAmount ?? item.finalAmount ?? 0),
        beforeNotes: item.BeforeNotes ?? item.beforeNotes ?? '',
        afterNotes: item.AfterNotes ?? item.afterNotes ?? '',
        resultSummary: item.ResultSummary ?? item.resultSummary ?? '',
        createdAt: item.CreatedAt ?? item.createdAt,
        updatedAt: item.UpdatedAt ?? item.updatedAt,
        startedAt: item.StartedAt ?? item.startedAt,
        completedAt: item.CompletedAt ?? item.completedAt,
        device: normalizeOptimizationDevice(item.Device ?? item.device ?? {}),
        checklist
    };
}

function normalizeOptimizationDevice(item = {}) {
    if (!item || Object.keys(item).length === 0) return null;
    return {
        id: item.Id ?? item.id,
        customerName: item.CustomerName ?? item.customerName ?? '',
        phoneNumber: item.PhoneNumber ?? item.phoneNumber ?? '',
        deviceType: item.DeviceType ?? item.deviceType ?? 'Desktop',
        operatingSystem: item.OperatingSystem ?? item.operatingSystem ?? 'Windows 11',
        processor: item.Processor ?? item.processor ?? '',
        gpu: item.Gpu ?? item.gpu ?? '',
        ramGb: item.RamGb ?? item.ramGb ?? '',
        storageType: item.StorageType ?? item.storageType ?? 'Não informado',
        mainUse: item.MainUse ?? item.mainUse ?? 'Uso geral',
        notes: item.Notes ?? item.notes ?? '',
        updatedAt: item.UpdatedAt ?? item.updatedAt
    };
}

async function loadOptimizationData() {
    if (!isComputerOptimization()) return;
    setApiStatusUI('loading');
    try {
        const [ticketsPayload, devicesPayload, summaryPayload] = await Promise.all([
            apiFetch('/optimization/tickets?pageSize=200').then(r => r.json()),
            apiFetch('/optimization/devices').then(r => r.json()),
            apiFetch('/optimization/reports/summary').then(r => r.json())
        ]);
        const rawTickets = Array.isArray(ticketsPayload?.data) ? ticketsPayload.data : [];
        state.optimization.tickets = rawTickets.map(normalizeOptimizationTicket);
        state.optimization.devices = (Array.isArray(devicesPayload) ? devicesPayload : []).map(normalizeOptimizationDevice).filter(Boolean);
        state.optimization.summary = summaryPayload || null;
        renderOptimizationExperience();
        setApiStatusUI('online');
    } catch (e) {
        setApiStatusUI('offline');
        showToast(e.message || 'Erro ao carregar otimizações.', 'error');
        ['techQuickQueue', 'techQueueList', 'techDeviceList'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = emptyStateUI('fa-triangle-exclamation', 'Não foi possível carregar o módulo de otimização.');
        });
    } finally {
        const last = UI.lastUpdate();
        if (last) last.textContent = `Atualizado às ${new Date().toLocaleTimeString()}`;
    }
}

function renderOptimizationExperience() {
    renderOptimizationOverview();
    renderOptimizationQueue();
    renderOptimizationDevices();
    renderOptimizationReports();
}

function renderOptimizationOverview() {
    const tickets = state.optimization.tickets || [];
    const today = new Date();
    const todayTickets = tickets.filter(t => t.createdAt && isSameDay(new Date(t.createdAt), today));
    const running = tickets.filter(t => t.status === 'EmOtimizacao').length;
    const ready = tickets.filter(t => t.status === 'Pronto').length;
    const revenue = tickets
        .filter(t => !['Cancelado'].includes(t.status))
        .reduce((sum, t) => sum + (t.finalAmount || t.estimatedAmount || 0), 0);

    updateText('techMetricToday', todayTickets.length);
    updateText('techMetricRunning', running);
    updateText('techMetricReady', ready);
    updateText('techMetricRevenue', formatCurrency(revenue));

    const quick = document.getElementById('techQuickQueue');
    if (quick) {
        const items = tickets.filter(t => !['Concluido', 'Cancelado'].includes(t.status)).slice(0, 5);
        quick.innerHTML = items.length ? items.map(renderOptimizationCompactCard).join('') : emptyStateUI('fa-list-check', 'Nenhum atendimento aberto.');
    }

    renderTechSetupChecklist();
    renderTechAlerts();
    const whats = state.bot?.connected || state.bot?.whatsappConnected;
    updateText('techWhatsAppStatus', whats ? 'Conectado — novos pedidos podem entrar na triagem.' : 'Desconectado — conecte para receber novos pedidos automaticamente.');
}

function renderTechSetupChecklist() {
    const checks = [
        ['Dados da loja', !!state.storeName && state.storeName !== 'Painel'],
        ['Serviços de otimização', (state.servicosAll || []).length > 0],
        ['WhatsApp', !!(state.bot?.connected || state.bot?.whatsappConnected)],
        ['Primeiro computador cadastrado', (state.optimization.devices || []).length > 0],
        ['Primeiro atendimento criado', (state.optimization.tickets || []).length > 0]
    ];
    const done = checks.filter(([, ok]) => ok).length;
    updateText('techReadinessBadge', `${done}/${checks.length}`);
    const el = document.getElementById('techSetupChecklist');
    if (!el) return;
    el.innerHTML = checks.map(([label, ok]) => `
        <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
            <span class="font-bold text-slate-700">${label}</span>
            <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase ${ok ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">${ok ? 'ok' : 'pendente'}</span>
        </div>
    `).join('');
}

function renderTechAlerts() {
    const tickets = state.optimization.tickets || [];
    const alerts = [];
    const waiting = tickets.filter(t => t.status === 'AguardandoCliente').length;
    const ready = tickets.filter(t => t.status === 'Pronto').length;
    const noDevice = tickets.filter(t => !t.device?.id).length;
    if (waiting) alerts.push(`${waiting} atendimento(s) aguardando retorno do cliente.`);
    if (ready) alerts.push(`${ready} atendimento(s) prontos para enviar o resultado ao cliente.`);
    if (noDevice) alerts.push(`${noDevice} atendimento(s) sem dados básicos do computador.`);
    const el = document.getElementById('techAlerts');
    if (!el) return;
    el.innerHTML = alerts.length
        ? alerts.map(a => `<div class="rounded-lg bg-orange-50 text-orange-800 px-3 py-2 text-sm font-bold">${escapeHtml(a)}</div>`).join('')
        : '<div class="rounded-lg bg-green-50 text-green-700 px-3 py-2 text-sm font-bold">Nenhum alerta operacional agora.</div>';
}

function renderOptimizationCompactCard(ticket) {
    return `
        <article class="soft-panel p-3 border border-slate-100">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-xs font-black text-slate-400">${escapeHtml(ticket.ticketNumber)}</p>
                    <h5 class="font-black text-gray-950 truncate">${escapeHtml(ticket.customerName)}</h5>
                    <p class="text-xs font-semibold text-gray-500 truncate"><i class="fas fa-wifi text-cyan-500 mr-1"></i>${escapeHtml(ticket.serviceName)} · ${escapeHtml(ticket.urgency)}</p>
                </div>
                <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${optimizationStatusClass(ticket.status)}">${OPTIMIZATION_STATUS_LABELS[ticket.status] || ticket.status}</span>
            </div>
        </article>
    `;
}

function renderOptimizationQueue() {
    const list = document.getElementById('techQueueList');
    if (!list) return;
    const status = document.getElementById('techQueueStatusFilter')?.value || '';
    const search = (document.getElementById('techQueueSearch')?.value || '').toLowerCase();
    const items = (state.optimization.tickets || []).filter(t => {
        if (status && t.status !== status) return false;
        if (!search) return true;
        return [t.ticketNumber, t.customerName, t.phoneNumber, t.serviceName, t.goal, t.reportedProblem, t.device?.deviceType, t.device?.operatingSystem]
            .filter(Boolean).some(v => String(v).toLowerCase().includes(search));
    });

    list.innerHTML = items.length ? items.map(renderOptimizationTicketCard).join('') : emptyStateUI('fa-computer', 'Nenhum atendimento nesta seleção.');
}

function renderOptimizationTicketCard(ticket) {
    const device = ticket.device;
    const amount = ticket.finalAmount || ticket.estimatedAmount;
    const statusOptions = OPTIMIZATION_STATUSES.map(s =>
        `<option value="${s}" ${s === ticket.status ? 'selected' : ''}>${OPTIMIZATION_STATUS_LABELS[s]}</option>`).join('');
    return `
        <article class="panel p-5 border border-slate-100">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-xs font-black text-cyan-600 uppercase">${escapeHtml(ticket.ticketNumber)}</p>
                    <h4 class="text-lg font-black text-gray-950 truncate">${escapeHtml(ticket.customerName)}</h4>
                    <p class="text-xs font-semibold text-gray-500 mt-1">${escapeHtml(ticket.phoneNumber || 'sem telefone')}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${optimizationStatusClass(ticket.status)}">${OPTIMIZATION_STATUS_LABELS[ticket.status] || ticket.status}</span>
            </div>
            <div class="grid md:grid-cols-2 gap-3 mt-4 text-sm">
                <div class="soft-panel p-3">
                    <small class="block text-[10px] font-black text-gray-400 uppercase">Computador</small>
                    <strong class="block text-gray-900">${escapeHtml(device?.deviceType || 'Não informado')}</strong>
                    <span class="text-xs text-gray-500 font-semibold">${escapeHtml(device?.operatingSystem || '')} ${device?.ramGb ? `· ${device.ramGb} GB RAM` : ''}</span>
                </div>
                <div class="soft-panel p-3">
                    <small class="block text-[10px] font-black text-gray-400 uppercase">Pacote</small>
                    <strong class="block text-gray-900">${escapeHtml(ticket.serviceName)}</strong>
                    <span class="text-xs text-gray-500 font-semibold">${escapeHtml(ticket.serviceMode)} · ${amount ? formatCurrency(amount) : 'valor pendente'}</span>
                </div>
            </div>
            <p class="text-sm text-gray-600 font-semibold mt-4">${escapeHtml(ticket.reportedProblem || ticket.goal || 'Sem descrição')}</p>
            <div class="grid md:grid-cols-[1fr_auto_auto] gap-2 mt-4">
                <select class="input-field py-2 text-sm font-bold" onchange="changeOptimizationStatus(${ticket.id}, this.value)">${statusOptions}</select>
                <button onclick="openOptimizationTicketModal(${ticket.id})" class="btn btn-light px-3 py-2 text-sm"><i class="fas fa-folder-open"></i>Abrir detalhe</button>
                <button onclick="markOptimizationReady(${ticket.id})" class="btn btn-green px-3 py-2 text-sm"><i class="fas fa-check"></i>Pronto</button>
            </div>
        </article>
    `;
}

function renderOptimizationDevices() {
    const list = document.getElementById('techDeviceList');
    if (!list) return;
    const search = (document.getElementById('techDeviceSearch')?.value || '').toLowerCase();
    const devices = (state.optimization.devices || []).filter(d => {
        if (!search) return true;
        return [d.customerName, d.phoneNumber, d.deviceType, d.operatingSystem, d.processor, d.gpu, d.mainUse]
            .filter(Boolean).some(v => String(v).toLowerCase().includes(search));
    });

    list.innerHTML = devices.length ? devices.map(d => `
        <article class="panel p-5 border border-slate-100">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <h4 class="font-black text-gray-950">${escapeHtml(d.customerName)}</h4>
                    <p class="text-xs font-semibold text-gray-500">${escapeHtml(d.phoneNumber)}</p>
                </div>
                <button onclick="openOptimizationDeviceModal(${d.id})" class="btn btn-light px-3 py-1.5 text-xs"><i class="fas fa-pen"></i>Editar</button>
            </div>
            <div class="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div><small class="font-black text-gray-400 uppercase text-[10px]">Tipo</small><strong class="block">${escapeHtml(d.deviceType)}</strong></div>
                <div><small class="font-black text-gray-400 uppercase text-[10px]">Sistema</small><strong class="block">${escapeHtml(d.operatingSystem)}</strong></div>
                <div><small class="font-black text-gray-400 uppercase text-[10px]">CPU</small><strong class="block truncate">${escapeHtml(d.processor || '-')}</strong></div>
                <div><small class="font-black text-gray-400 uppercase text-[10px]">GPU</small><strong class="block truncate">${escapeHtml(d.gpu || '-')}</strong></div>
            </div>
        </article>
    `).join('') : emptyStateUI('fa-computer', 'Nenhum computador cadastrado.');
}

function renderOptimizationReports() {
    const summary = state.optimization.summary || {};
    const grid = document.getElementById('techReportsGrid');
    if (grid) {
        const cards = [
            ['Atendimentos criados', summary.created ?? 0],
            ['Concluídos', summary.completed ?? 0],
            ['Cancelados', summary.cancelled ?? 0],
            ['Faturamento', formatCurrency(summary.revenue || 0)],
            ['Tempo médio', `${summary.averageCompletionHours || 0}h`],
            ['Pacote mais solicitado', summary.topPackage?.name || '-']
        ];
        grid.innerHTML = cards.map(([label, value]) => `
            <div class="panel p-5 soft-panel">
                <p class="text-[11px] font-black text-gray-500 uppercase tracking-wide">${escapeHtml(label)}</p>
                <strong class="block text-xl font-black text-gray-950 mt-1">${escapeHtml(String(value))}</strong>
            </div>
        `).join('');
    }
    renderOptimizationBreakdown('techReportStatusList', summary.byStatus || {}, OPTIMIZATION_STATUS_LABELS);
    renderOptimizationBreakdown('techReportModeList', summary.byMode || {}, {});
}

function renderOptimizationBreakdown(id, data, labels) {
    const el = document.getElementById(id);
    if (!el) return;
    const entries = Object.entries(data);
    el.innerHTML = entries.length ? entries.map(([key, value]) => `
        <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
            <span class="font-bold text-slate-700">${escapeHtml(labels[key] || key)}</span>
            <strong class="text-slate-950">${value}</strong>
        </div>
    `).join('') : '<p class="text-sm font-semibold text-gray-400">Sem dados no período.</p>';
}

async function ensureOptimizationServicesLoaded() {
    if ((state.servicosAll || []).length) return;
    const res = await apiFetch('/servicos');
    const items = await res.json();
    state.servicosAll = (Array.isArray(items) ? items : []).map(normalizeServiceItem);
    state.servicos = state.servicosAll.filter(s => s.active);
}

function fillOptimizationServiceSelect(selected = '') {
    const select = document.getElementById('optimizationService');
    if (!select) return;
    const options = (state.servicosAll || []).filter(s => s.active);
    select.innerHTML = '<option value="">Pacote não definido</option>' + options.map(s =>
        `<option value="${s.id}" ${String(s.id) === String(selected) ? 'selected' : ''}>${escapeHtml(s.name)} · ${formatCurrency(s.price)}</option>`).join('');
}

async function openOptimizationTicketModal(id = null) {
    await ensureOptimizationServicesLoaded().catch(() => {});
    const modal = document.getElementById('optimizationTicketModal');
    if (!modal) return;
    const ticket = id ? (state.optimization.tickets || []).find(t => String(t.id) === String(id)) : null;
    state.optimization.currentTicket = ticket || null;
    updateText('optimizationTicketModalTitle', ticket ? `Atendimento ${ticket.ticketNumber}` : 'Novo atendimento');
    document.getElementById('optimizationTicketId').value = ticket?.id || '';
    document.getElementById('optimizationCustomerName').value = ticket?.customerName || '';
    document.getElementById('optimizationPhone').value = ticket?.phoneNumber || '';
    fillOptimizationServiceSelect(ticket?.serviceId || '');
    document.getElementById('optimizationMode').value = 'Remoto';
    document.getElementById('optimizationGoal').value = ticket?.goal || 'Otimização geral do computador';
    document.getElementById('optimizationUrgency').value = ticket?.urgency || 'Essa semana';
    document.getElementById('optimizationProblem').value = ticket?.reportedProblem || '';
    document.getElementById('optimizationBeforeNotes').value = ticket?.beforeNotes || '';
    document.getElementById('optimizationEstimated').value = ticket?.estimatedAmount || '';
    document.getElementById('optimizationFinal').value = ticket?.finalAmount || '';
    document.getElementById('optimizationResult').value = ticket?.resultSummary || '';
    document.getElementById('optimizationQuoteBox')?.classList.toggle('hidden', !ticket);

    const d = ticket?.device || {};
    document.getElementById('optimizationDeviceType').value = d.deviceType || 'Desktop';
    document.getElementById('optimizationOs').value = d.operatingSystem || 'Windows 11';
    document.getElementById('optimizationProcessor').value = d.processor || '';
    document.getElementById('optimizationGpu').value = d.gpu || '';
    document.getElementById('optimizationRam').value = d.ramGb || '';
    document.getElementById('optimizationStorage').value = d.storageType || 'Não informado';
    document.getElementById('optimizationMainUse').value = d.mainUse || 'Uso geral';
    document.getElementById('optimizationDeviceNotes').value = d.notes || '';

    document.getElementById('optimizationChecklistBox')?.classList.toggle('hidden', !ticket);
    renderOptimizationChecklist(ticket);
    modal.classList.remove('hidden');
}

async function openOptimizationTicketFromService(serviceId) {
    await openOptimizationTicketModal();
    const select = document.getElementById('optimizationService');
    if (select) select.value = String(serviceId);
    document.getElementById('optimizationCustomerName')?.focus();
}

function closeOptimizationTicketModal() {
    document.getElementById('optimizationTicketModal')?.classList.add('hidden');
    state.optimization.currentTicket = null;
}

function getOptimizationDevicePayload(prefix = 'optimization') {
    return {
        CustomerName: document.getElementById(`${prefix}CustomerName`)?.value?.trim() || document.getElementById('optimizationCustomerName')?.value?.trim(),
        PhoneNumber: document.getElementById(`${prefix}Phone`)?.value?.trim() || document.getElementById('optimizationPhone')?.value?.trim(),
        DeviceType: document.getElementById(`${prefix}DeviceType`)?.value || document.getElementById('optimizationDeviceType')?.value,
        OperatingSystem: document.getElementById(`${prefix}Os`)?.value || document.getElementById('optimizationOs')?.value,
        Processor: document.getElementById(`${prefix}Processor`)?.value?.trim() || '',
        Gpu: document.getElementById(`${prefix}Gpu`)?.value?.trim() || '',
        RamGb: Number(document.getElementById(`${prefix}Ram`)?.value || 0) || null,
        StorageType: document.getElementById(`${prefix}Storage`)?.value || 'Não informado',
        MainUse: document.getElementById(`${prefix}MainUse`)?.value || 'Uso geral',
        Notes: document.getElementById(`${prefix}DeviceNotes`)?.value?.trim() || document.getElementById(`${prefix}Notes`)?.value?.trim() || ''
    };
}

function hasCredentialText(...values) {
    const joined = values.filter(Boolean).join(' ').toLowerCase();
    return joined.includes('senha') || joined.includes('password') || joined.includes('credencial');
}

async function saveOptimizationTicket() {
    const id = document.getElementById('optimizationTicketId')?.value || '';
    const customerName = document.getElementById('optimizationCustomerName')?.value?.trim();
    const phone = document.getElementById('optimizationPhone')?.value?.trim();
    const beforeNotes = document.getElementById('optimizationBeforeNotes')?.value?.trim();
    const problem = document.getElementById('optimizationProblem')?.value?.trim();
    const result = document.getElementById('optimizationResult')?.value?.trim();
    const device = getOptimizationDevicePayload('optimization');

    if (!customerName) return showToast('Informe o nome do cliente.', 'error');
    if (hasCredentialText(beforeNotes, problem, result, device.Notes)) return showToast('Não salve senhas ou credenciais do computador.', 'error');

    const payload = {
        CustomerName: customerName,
        PhoneNumber: phone,
        ServiceId: Number(document.getElementById('optimizationService')?.value || 0) || null,
        ServiceMode: document.getElementById('optimizationMode')?.value,
        Goal: document.getElementById('optimizationGoal')?.value,
        ReportedProblem: problem,
        Urgency: document.getElementById('optimizationUrgency')?.value,
        BeforeNotes: beforeNotes,
        ResultSummary: result,
        EstimatedAmount: Number(document.getElementById('optimizationEstimated')?.value || 0) || null,
        FinalAmount: Number(document.getElementById('optimizationFinal')?.value || 0) || null
    };
    if (!id) payload.Device = device;

    try {
        await apiFetch(id ? `/optimization/tickets/${id}` : '/optimization/tickets', {
            method: id ? 'PATCH' : 'POST',
            body: JSON.stringify(payload)
        });
        showToast(id ? 'Atendimento atualizado.' : 'Atendimento criado.', 'success');
        closeOptimizationTicketModal();
        await loadOptimizationData();
    } catch (e) {
        showToast(e.message || 'Erro ao salvar atendimento.', 'error');
    }
}

function renderOptimizationChecklist(ticket) {
    const box = document.getElementById('optimizationChecklistItems');
    if (!box || !ticket) return;
    box.innerHTML = (ticket.checklist || []).map(item => `
        <label class="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
            <input type="checkbox" class="mt-1 optimization-check-item" data-key="${escapeHtml(item.Key || item.key)}" ${(item.Done ?? item.done) ? 'checked' : ''}>
            <span>${escapeHtml(item.Label || item.label)}</span>
        </label>
    `).join('');
}

async function saveOptimizationChecklist() {
    const ticket = state.optimization.currentTicket;
    if (!ticket) return;
    const checked = new Set(Array.from(document.querySelectorAll('.optimization-check-item:checked')).map(el => el.dataset.key));
    const items = (ticket.checklist || []).map(item => ({
        Key: item.Key || item.key,
        Label: item.Label || item.label,
        Done: checked.has(item.Key || item.key),
        Notes: item.Notes || item.notes || null
    }));
    try {
        await apiFetch(`/optimization/tickets/${ticket.id}/checklist`, {
            method: 'PATCH',
            body: JSON.stringify({ Items: items })
        });
        showToast('Checklist atualizado.', 'success');
        await loadOptimizationData();
        state.optimization.currentTicket = state.optimization.tickets.find(t => String(t.id) === String(ticket.id)) || ticket;
    } catch (e) {
        showToast(e.message || 'Erro ao salvar checklist.', 'error');
    }
}

async function changeOptimizationStatus(id, status) {
    if (status === 'Pronto') {
        await markOptimizationReady(id);
        return;
    }
    try {
        await patchOptimizationStatus(id, status);
        showToast('Status atualizado.', 'success');
        await loadOptimizationData();
    } catch (e) {
        showToast(e.message || 'Transição de status não permitida.', 'error');
        renderOptimizationQueue();
    }
}

async function patchOptimizationStatus(id, status) {
    return apiFetch(`/optimization/tickets/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ Status: status, Message: `Status alterado para ${OPTIMIZATION_STATUS_LABELS[status] || status}.` })
    });
}

async function markOptimizationReady(id) {
    const ticket = (state.optimization.tickets || []).find(t => String(t.id) === String(id));
    const paths = {
        Novo: ['Triagem', 'EmOtimizacao', 'Pronto'],
        Triagem: ['EmOtimizacao', 'Pronto'],
        Agendado: ['EmOtimizacao', 'Pronto'],
        AguardandoCliente: ['EmOtimizacao', 'Pronto'],
        EmOtimizacao: ['Pronto'],
        EmRevisao: ['Pronto'],
        Pronto: []
    };
    const steps = paths[ticket?.status] || ['Pronto'];
    try {
        for (const nextStatus of steps) {
            await patchOptimizationStatus(id, nextStatus);
        }
        showToast('Atendimento marcado como pronto.', 'success');
        await loadOptimizationData();
    } catch (e) {
        showToast(e.message || 'Não foi possível marcar como pronto.', 'error');
        await loadOptimizationData();
    }
}

async function submitOptimizationQuote(approved = null) {
    const ticket = state.optimization.currentTicket;
    const id = ticket?.id || document.getElementById('optimizationTicketId')?.value;
    const amount = Number(document.getElementById('optimizationEstimated')?.value || 0);
    const resultNote = document.getElementById('optimizationResult')?.value?.trim();
    const beforeNote = document.getElementById('optimizationBeforeNotes')?.value?.trim();
    const message = resultNote || beforeNote || '';

    if (!id) return showToast('Salve o atendimento antes do orçamento.', 'error');
    if (!amount || amount <= 0) return showToast('Informe um valor estimado válido.', 'error');
    if (hasCredentialText(message)) return showToast('Não envie senhas ou credenciais no orçamento.', 'error');

    try {
        await apiFetch(`/optimization/tickets/${id}/quote`, {
            method: 'POST',
            body: JSON.stringify({
                Amount: amount,
                Approved: approved,
                Message: message || null,
                VisibleToCustomer: true
            })
        });
        showToast(approved === true ? 'Orçamento aprovado.' : approved === false ? 'Orçamento recusado.' : 'Orçamento registrado.', 'success');
        await loadOptimizationData();
        state.optimization.currentTicket = state.optimization.tickets.find(t => String(t.id) === String(id)) || ticket;
    } catch (e) {
        showToast(e.message || 'Erro ao registrar orçamento.', 'error');
    }
}

function openOptimizationDeviceModal(id = null) {
    const modal = document.getElementById('optimizationDeviceModal');
    if (!modal) return;
    const d = id ? (state.optimization.devices || []).find(x => String(x.id) === String(id)) : null;
    updateText('optimizationDeviceModalTitle', d ? 'Editar computador' : 'Novo computador');
    document.getElementById('optimizationDeviceId').value = d?.id || '';
    document.getElementById('deviceCustomerName').value = d?.customerName || '';
    document.getElementById('devicePhone').value = d?.phoneNumber || '';
    document.getElementById('deviceType').value = d?.deviceType || 'Desktop';
    document.getElementById('deviceOs').value = d?.operatingSystem || 'Windows 11';
    document.getElementById('deviceProcessor').value = d?.processor || '';
    document.getElementById('deviceGpu').value = d?.gpu || '';
    document.getElementById('deviceRam').value = d?.ramGb || '';
    document.getElementById('deviceStorage').value = d?.storageType || 'Não informado';
    document.getElementById('deviceMainUse').value = d?.mainUse || 'Uso geral';
    document.getElementById('deviceNotes').value = d?.notes || '';
    modal.classList.remove('hidden');
}

function closeOptimizationDeviceModal() {
    document.getElementById('optimizationDeviceModal')?.classList.add('hidden');
}

async function saveOptimizationDevice() {
    const id = document.getElementById('optimizationDeviceId')?.value || '';
    const payload = {
        CustomerName: document.getElementById('deviceCustomerName')?.value?.trim(),
        PhoneNumber: document.getElementById('devicePhone')?.value?.trim(),
        DeviceType: document.getElementById('deviceType')?.value,
        OperatingSystem: document.getElementById('deviceOs')?.value,
        Processor: document.getElementById('deviceProcessor')?.value?.trim(),
        Gpu: document.getElementById('deviceGpu')?.value?.trim(),
        RamGb: Number(document.getElementById('deviceRam')?.value || 0) || null,
        StorageType: document.getElementById('deviceStorage')?.value,
        MainUse: document.getElementById('deviceMainUse')?.value,
        Notes: document.getElementById('deviceNotes')?.value?.trim()
    };
    if (!payload.CustomerName) return showToast('Informe o nome do cliente.', 'error');
    if (hasCredentialText(payload.Notes)) return showToast('Não salve senhas ou credenciais do computador.', 'error');
    try {
        await apiFetch(id ? `/optimization/devices/${id}` : '/optimization/devices', {
            method: id ? 'PATCH' : 'POST',
            body: JSON.stringify(payload)
        });
        showToast(id ? 'Computador atualizado.' : 'Computador cadastrado.', 'success');
        closeOptimizationDeviceModal();
        await loadOptimizationData();
    } catch (e) {
        showToast(e.message || 'Erro ao salvar computador.', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSINATURAS
// ═══════════════════════════════════════════════════════════════════════════════

// Mostra a aba de assinaturas/fidelidade para todos os tipos de negócio
function initSubscriptionNav() {
    const nav = document.getElementById('navAssinaturas');
    if (!nav) return;
    nav.style.display = '';
}

async function loadSubscriptionStats() {
    try {
        const res = await apiFetch('/assinaturas/stats');
        const data = await res.json();
        const ativos = data.ativos ?? 0;
        updateText('subCountAtivos', ativos);
        updateText('subCountPendentes', data.pendentes ?? '–');
        updateText('subReceitaMes', `R$ ${Number(data.receitaMes || 0).toFixed(2)}`);
        // Sub-label do KPI card de membros ativos
        const badge = document.getElementById('subActiveBadge');
        if (badge) badge.textContent = ativos === 1 ? '1 assinatura' : `${ativos} assinaturas`;
    } catch (e) {
        console.warn('Erro ao carregar stats de assinaturas:', e);
    }
}

let _allSubscriptions = [];

async function loadSubscriptions() {
    const tbody = document.getElementById('subTableBody');
    if (!tbody) return;
    showListLoading('subTableBody', 8);
    try {
        const res = await apiFetch('/assinaturas');
        _allSubscriptions = await res.json();
        filterSubscriptionTable();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-red-400">Erro ao carregar assinantes.</td></tr>';
    }
}

function filterSubscriptionTable() {
    const tbody = document.getElementById('subTableBody');
    if (!tbody) return;
    const filterStatus = document.getElementById('subStatusFilter')?.value || '';
    const search = (document.getElementById('subSearchInput')?.value || '').toLowerCase();
    let items = _allSubscriptions;
    if (filterStatus) items = items.filter(s => s.status === filterStatus);
    if (search) items = items.filter(s =>
        (s.clientName || '').toLowerCase().includes(search) ||
        (s.clientPhone || '').toLowerCase().includes(search)
    );
    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="py-10 text-center text-gray-400 font-semibold">Nenhum membro encontrado.</td></tr>';
        return;
    }
    tbody.innerHTML = items.map(s => {
        const statusBadge = {
            'Active':    '<span class="sub-status-active">Ativo</span>',
            'Pending':   '<span class="sub-status-pending">Pendente</span>',
            'Expired':   '<span class="sub-status-expired">Expirado</span>',
            'Cancelled': '<span class="sub-status-cancelled">Cancelado</span>'
        }[s.status] || `<span class="sub-status-expired">${s.status}</span>`;

        const validade = s.endDate ? new Date(s.endDate).toLocaleDateString('pt-BR') : '–';
        const pct = s.creditosTotal > 0 ? Math.min(100, Math.round((s.creditosUsados / s.creditosTotal) * 100)) : 0;
        const barColor = pct >= 100 ? 'bg-gray-400' : pct >= 75 ? 'bg-amber-400' : 'bg-green-500';
        const initial = (s.clientName || '?')[0].toUpperCase();

        const actions = [];
        if (s.status === 'Pending') {
            actions.push(`<button class="btn btn-light text-xs px-2.5 py-1.5 sub-action" onclick="openSubscriptionPixModal(${s.id})" title="Ver PIX"><i class="fas fa-qrcode"></i><span class="sub-btn-text ml-1">PIX</span></button>`);
            actions.push(`<button class="btn btn-green text-xs px-2.5 py-1.5 sub-action" onclick="activateSubscription(${s.id})" title="Ativar assinatura"><i class="fas fa-check"></i><span class="sub-btn-text ml-1">Ativar</span></button>`);
        }
        if (s.status === 'Active' || s.status === 'Pending' || s.status === 'Expired')
            actions.push(`<button class="btn btn-red text-xs px-2.5 py-1.5 sub-action" onclick="cancelSubscription(${s.id})" title="Cancelar assinatura"><i class="fas fa-times"></i><span class="sub-btn-text ml-1">Cancelar</span></button>`);
        if (s.status === 'Cancelled')
            actions.push(`<button class="btn btn-red text-xs px-2.5 py-1.5 sub-action" onclick="deleteSubscription(${s.id})" title="Apagar assinatura cancelada"><i class="fas fa-trash"></i><span class="sub-btn-text ml-1">Apagar</span></button>`);
        actions.push(`<button class="btn btn-light text-xs px-2.5 py-1.5 sub-action" title="Observações" onclick="openSubNotesModal(${s.id}, ${JSON.stringify(s.notes || '')})"><i class="fas fa-note-sticky"></i></button>`);

        return `<tr class="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            <td class="py-3 pr-3">
                <div class="flex items-center gap-2">
                    <div class="sub-avatar flex-shrink-0">${initial}</div>
                    <div class="min-w-0">
                        <div class="font-semibold text-gray-900 text-sm leading-tight truncate max-w-[120px] sm:max-w-none">${escapeHtml(s.clientName || '–')}</div>
                        <div class="sub-plan-mobile text-xs text-gray-400 font-semibold truncate hidden">${escapeHtml(s.planNome || '')}</div>
                    </div>
                </div>
            </td>
            <td class="py-3 pr-3 text-gray-400 text-xs font-mono hidden sm:table-cell">${escapeHtml(s.clientPhone || '–')}</td>
            <td class="py-3 pr-3 sub-col-plan">
                <div class="text-gray-700 text-sm font-semibold">${escapeHtml(s.planNome || '–')}</div>
                <div class="text-xs text-gray-400 font-medium">${servicosPermitidosLabel(s.servicosPermitidos)}</div>
            </td>
            <td class="py-3 pr-3 hidden md:table-cell">
                ${s.barbeiroId > 0
                    ? `<div class="flex items-center gap-1.5">
                           <span class="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span>
                           <span class="text-gray-700 text-xs font-semibold">${escapeHtml(s.barbeiroNome || '')}</span>
                       </div>`
                    : `<span class="text-gray-400 text-xs">Qualquer</span>`}
            </td>
            <td class="py-3 pr-3 text-center">
                <span class="font-black text-gray-950 text-sm">${s.creditosUsados}/${s.creditosTotal}</span>
                <div class="sub-credit-bar"><div class="sub-credit-bar-fill ${barColor}" style="width:${pct}%"></div></div>
            </td>
            <td class="py-3 pr-3 text-gray-400 text-xs hidden md:table-cell">${validade}</td>
            <td class="py-3 pr-3">${statusBadge}</td>
            <td class="py-3"><div class="flex gap-1 flex-nowrap items-center">${actions.join('')}</div></td>
        </tr>`;
    }).join('');
}

async function activateSubscription(id, skipConfirm = false) {
    if (!skipConfirm && !confirm('Confirmar pagamento e ativar assinatura?')) return;
    try {
        await apiFetch(`/assinaturas/${id}/ativar`, { method: 'POST' });
        showToast('Assinatura ativada! O cliente pode usar seus créditos.', 'success');
        loadSubscriptions();
        loadSubscriptionStats();
    } catch (e) {
        showToast('Erro ao ativar assinatura.', 'error');
    }
}

function ensureSubscriptionPixModal() {
    let modal = document.getElementById('subscriptionPixModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'subscriptionPixModal';
    modal.className = 'fixed inset-0 bg-black/50 z-50 hidden items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative">
            <button class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl" onclick="closeSubscriptionPixModal()" title="Fechar"><i class="fas fa-times"></i></button>
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <i class="fas fa-qrcode"></i>
                </div>
                <div>
                    <h3 class="text-lg font-black text-gray-950">PIX da assinatura</h3>
                    <p class="text-xs text-gray-500 font-semibold" id="subscriptionPixSubtitle">Gerando cobranca...</p>
                </div>
            </div>
            <input type="hidden" id="subscriptionPixId">
            <div id="subscriptionPixBody" class="space-y-4"></div>
            <div class="flex gap-3 mt-5">
                <button class="btn btn-light flex-1 py-2" onclick="closeSubscriptionPixModal()">Fechar</button>
                <button class="btn btn-green flex-1 py-2" onclick="confirmSubscriptionPixPayment()">
                    <i class="fas fa-check"></i> Confirmar
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    return modal;
}

async function openSubscriptionPixModal(id) {
    const modal = ensureSubscriptionPixModal();
    const body = document.getElementById('subscriptionPixBody');
    const subtitle = document.getElementById('subscriptionPixSubtitle');
    document.getElementById('subscriptionPixId').value = id;
    subtitle.textContent = 'Gerando cobranca PIX...';
    body.innerHTML = '<div class="py-8 text-center text-gray-400 font-semibold">Carregando PIX...</div>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    try {
        const res = await apiFetch(`/pix/subscription/${id}`);
        const pix = await res.json();
        subtitle.textContent = `${formatCurrency(pix.amount)} · ${escapeHtml(pix.txId || '')}`;
        body.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-start">
                <div class="rounded-xl border border-gray-100 bg-gray-50 p-3 flex items-center justify-center">
                    <img src="${pix.qrCodeDataUrl}" alt="QR Code PIX" class="w-36 h-36 object-contain">
                </div>
                <div class="space-y-3 min-w-0">
                    <div>
                        <p class="text-[11px] font-black text-gray-400 uppercase">Chave</p>
                        <p class="text-sm font-bold text-gray-900 break-all">${escapeHtml(pix.pixKey || '')}</p>
                    </div>
                    <div>
                        <p class="text-[11px] font-black text-gray-400 uppercase">Recebedor</p>
                        <p class="text-sm font-bold text-gray-900">${escapeHtml(pix.merchantName || '')} · ${escapeHtml(pix.merchantCity || '')}</p>
                    </div>
                    <div>
                        <p class="text-[11px] font-black text-gray-400 uppercase">Identificador</p>
                        <p class="text-sm font-mono font-bold text-gray-900">${escapeHtml(pix.txId || '')}</p>
                    </div>
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-500 mb-1">PIX copia e cola</label>
                <textarea id="subscriptionPixPayload" class="input-field w-full h-28 text-xs font-mono" readonly>${escapeHtml(pix.payload || '')}</textarea>
                <button class="btn btn-primary w-full py-2 text-sm mt-2" onclick="copySubscriptionPixPayload()">
                    <i class="fas fa-copy"></i> Copiar PIX copia e cola
                </button>
            </div>`;
    } catch (e) {
        subtitle.textContent = 'PIX indisponivel';
        body.innerHTML = `<div class="rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-semibold p-4">${escapeHtml(e.message || 'Nao foi possivel gerar o PIX.')}</div>`;
    }
}

function closeSubscriptionPixModal() {
    const modal = document.getElementById('subscriptionPixModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function copySubscriptionPixPayload() {
    const payload = document.getElementById('subscriptionPixPayload')?.value || '';
    if (!payload) return;
    try {
        await navigator.clipboard.writeText(payload);
        showToast('PIX copia e cola copiado.', 'success');
    } catch {
        document.getElementById('subscriptionPixPayload')?.select();
        showToast('Selecione e copie o codigo PIX.', 'info');
    }
}

async function confirmSubscriptionPixPayment() {
    const id = document.getElementById('subscriptionPixId')?.value;
    if (!id || !confirm('Confirmar pagamento PIX e ativar assinatura?')) return;
    closeSubscriptionPixModal();
    await activateSubscription(Number(id), true);
}

async function cancelSubscription(id) {
    if (!confirm('Cancelar esta assinatura?')) return;
    try {
        await apiFetch(`/assinaturas/${id}/cancelar`, { method: 'POST' });
        showToast('Assinatura cancelada.', 'info');
        loadSubscriptions();
        loadSubscriptionStats();
    } catch (e) {
        showToast('Erro ao cancelar assinatura.', 'error');
    }
}

async function deleteSubscription(id) {
    if (!confirm('Apagar definitivamente esta assinatura cancelada?')) return;
    try {
        await apiFetch(`/assinaturas/${id}`, { method: 'DELETE' });
        showToast('Assinatura cancelada apagada.', 'success');
        loadSubscriptions();
        loadSubscriptionStats();
    } catch (e) {
        showToast(e.message || 'Erro ao apagar assinatura.', 'error');
    }
}

async function deleteCancelledSubscriptions() {
    const count = _allSubscriptions.filter(s => s.status === 'Cancelled').length;
    if (!count) {
        showToast('Nao ha assinaturas canceladas para apagar.', 'info');
        return;
    }

    if (!confirm(`Apagar definitivamente ${count} assinatura(s) cancelada(s)?`)) return;

    try {
        const res = await apiFetch('/assinaturas/canceladas', { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        const deleted = data.deleted ?? count;
        showToast(`${deleted} assinatura(s) cancelada(s) apagada(s).`, 'success');
        loadSubscriptions();
        loadSubscriptionStats();
    } catch (e) {
        showToast(e.message || 'Erro ao apagar assinaturas canceladas.', 'error');
    }
}

function openSubNotesModal(id, notes) {
    document.getElementById('subNotesId').value = id;
    document.getElementById('subNotesText').value = notes || '';
    document.getElementById('subNotesModal').classList.remove('hidden');
    document.getElementById('subNotesModal').classList.add('flex');
}
function closeSubNotesModal() {
    document.getElementById('subNotesModal').classList.add('hidden');
    document.getElementById('subNotesModal').classList.remove('flex');
}
async function saveSubNotes() {
    const id = document.getElementById('subNotesId').value;
    const notes = document.getElementById('subNotesText').value;
    try {
        await apiFetch(`/assinaturas/${id}/notas`, { method: 'PATCH', body: JSON.stringify({ notes }) });
        showToast('Observações salvas.', 'success');
        closeSubNotesModal();
        loadSubscriptions();
    } catch (e) {
        showToast('Erro ao salvar observações.', 'error');
    }
}

// ── Planos ────────────────────────────────────────────────────────────────────

/** Mapeia o valor de servicosPermitidos para um rótulo legível exibido no card do plano. */
function servicosPermitidosLabel(raw) {
    if (!raw || raw === '*') return 'Todos os serviços';
    const map = {
        'Corte': 'Corte',
        'Barba': 'Barba',
        'Sobrancelha': 'Sobrancelha',
        'CorteBarba': 'Corte + Barba',
        'CorteSobrancelha': 'Corte + Sobrancelha',
        'CorteBarbasobrancelha': 'Corte + Barba + Sobrancelha',
    };
    const parts = raw.split(',').map(s => map[s.trim()] || s.trim());
    if (parts.length === 1) return parts[0];
    if (parts.length <= 3) return parts.join(', ');
    return `${parts[0]}, ${parts[1]} +${parts.length - 2}`;
}

async function loadPlans() {
    const container = document.getElementById('plansList');
    if (!container) return;
    showListLoading('plansList');
    try {
        const res = await apiFetch('/assinaturas/planos');
        const plans = await res.json();

        // ── KPI: contagem de planos ativos ────────────────────────────
        const activePlans = plans.filter(p => p.ativo);
        updateText('subCountPlanos', plans.length || '–');

        // ── Sidebar: resumo compacto dos planos ───────────────────────
        const sidebar = document.getElementById('vipSidebarPlans');
        if (sidebar) {
            if (!plans.length) {
                sidebar.innerHTML = '<p class="text-xs text-gray-400 font-semibold py-2">Nenhum plano criado ainda.</p>';
            } else {
                sidebar.innerHTML = plans.map(p => `
                    <div class="vip-plan-row">
                        <div class="min-w-0">
                            <div class="vip-plan-row-name">${escapeHtml(p.nome)}</div>
                            <div class="text-[11px] text-gray-400 font-semibold">${p.creditos} uso${p.creditos !== 1 ? 's' : ''} · ${p.duracaoDias}d</div>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <span class="vip-plan-row-price">R$ ${Number(p.preco).toFixed(2)}</span>
                            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}">${p.ativo ? 'Ativo' : 'Off'}</span>
                        </div>
                    </div>
                `).join('');
            }
        }

        // ── Grid principal de planos (aba Planos) ─────────────────────
        if (!plans.length) {
            container.innerHTML = '<div class="text-center text-gray-400 py-10 col-span-2 font-semibold">Nenhum plano cadastrado. Crie o primeiro!</div>';
            return;
        }
        container.innerHTML = plans.map(p => `
            <div class="plan-card-vip ${p.ativo ? '' : 'opacity-55'}">
                <div class="flex items-start justify-between gap-2 mb-1">
                    <div class="text-base font-black text-gray-950 leading-tight">${escapeHtml(p.nome)}</div>
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0 ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${p.ativo ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div class="plan-price">R$ ${Number(p.preco).toFixed(2)}</div>
                ${p.descricao ? `<p class="text-xs text-gray-400 font-semibold mb-3">${escapeHtml(p.descricao)}</p>` : '<div class="mb-3"></div>'}
                <div class="border-t border-gray-100 pt-3 mb-4 space-y-0.5">
                    <div class="plan-feature"><i class="fas ${biz().planIcon}"></i><span>${p.creditos} uso${p.creditos !== 1 ? 's' : ''} incluído${p.creditos !== 1 ? 's' : ''}</span></div>
                    <div class="plan-feature"><i class="fas fa-list-check"></i><span>${servicosPermitidosLabel(p.servicosPermitidos)}</span></div>
                    <div class="plan-feature"><i class="fas fa-calendar-days"></i><span>Válido por ${p.duracaoDias} dias</span></div>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-light text-xs px-3 py-1.5 flex-1" onclick="openPlanModal(${p.id})"><i class="fas fa-pen mr-1"></i>Editar</button>
                    <button class="btn btn-light text-xs px-3 py-1.5" onclick="togglePlanActive(${p.id}, ${!p.ativo})">${p.ativo ? '<i class="fas fa-eye-slash mr-1"></i>Pausar' : '<i class="fas fa-check mr-1"></i>Ativar'}</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<div class="text-center text-red-400 py-8 col-span-2">Erro ao carregar planos.</div>';
    }
}

function openPlanModal(id) {
    document.getElementById('planModalId').value = id || '';
    document.getElementById('planModalTitle').textContent = id ? 'Editar Plano' : 'Novo Plano';
    document.getElementById('planModalNome').value = '';
    document.getElementById('planModalDesc').value = '';
    document.getElementById('planModalPreco').value = '';
    document.getElementById('planModalCreditos').value = '4';
    document.getElementById('planModalDias').value = '30';
    document.getElementById('planModalAtivo').checked = true;
    document.getElementById('planModalServicos').value = '*';
    document.getElementById('planModalMsg').classList.add('hidden');

    if (id) {
        apiFetch('/assinaturas/planos').then(r => r.json()).then(plans => {
            const p = plans.find(x => x.id == id);
            if (!p) return;
            document.getElementById('planModalNome').value = p.nome || '';
            document.getElementById('planModalDesc').value = p.descricao || '';
            document.getElementById('planModalPreco').value = p.preco || '';
            document.getElementById('planModalCreditos').value = p.creditos || 4;
            document.getElementById('planModalDias').value = p.duracaoDias || 30;
            document.getElementById('planModalAtivo').checked = p.ativo !== false;
            // Tenta selecionar a opção exata; se não existir, usa a opção personalizada
            const sel = document.getElementById('planModalServicos');
            const sv = p.servicosPermitidos || '*';
            const match = Array.from(sel.options).find(o => o.value === sv);
            if (match) {
                sel.value = sv;
            } else {
                // Valor personalizado não listado: adiciona opção temporária e seleciona
                const opt = document.createElement('option');
                opt.value = sv;
                opt.textContent = `Personalizado: ${servicosPermitidosLabel(sv)}`;
                opt.dataset.custom = '1';
                // Remove opção custom anterior se houver
                Array.from(sel.options).filter(o => o.dataset.custom).forEach(o => o.remove());
                sel.appendChild(opt);
                sel.value = sv;
            }
        });
    }
    document.getElementById('planModal').classList.remove('hidden');
    document.getElementById('planModal').classList.add('flex');
}
function closePlanModal() {
    document.getElementById('planModal').classList.add('hidden');
    document.getElementById('planModal').classList.remove('flex');
}
async function savePlan() {
    const id = document.getElementById('planModalId').value;
    const nome = document.getElementById('planModalNome').value.trim();
    const descricao = document.getElementById('planModalDesc').value.trim();
    const preco = parseFloat(document.getElementById('planModalPreco').value);
    const creditos = parseInt(document.getElementById('planModalCreditos').value);
    const duracaoDias = parseInt(document.getElementById('planModalDias').value);
    const ativo = document.getElementById('planModalAtivo').checked;
    const servicosPermitidos = document.getElementById('planModalServicos').value || '*';
    const msg = document.getElementById('planModalMsg');

    if (!nome) { msg.textContent = 'Nome é obrigatório.'; msg.className = 'text-xs mt-2 text-center text-red-500'; msg.classList.remove('hidden'); return; }
    if (!preco || preco < 0) { msg.textContent = 'Preço inválido.'; msg.className = 'text-xs mt-2 text-center text-red-500'; msg.classList.remove('hidden'); return; }
    if (!creditos || creditos < 1) { msg.textContent = 'Créditos deve ser ≥ 1.'; msg.className = 'text-xs mt-2 text-center text-red-500'; msg.classList.remove('hidden'); return; }
    if (!duracaoDias || duracaoDias < 1) { msg.textContent = 'Validade deve ser ≥ 1 dia.'; msg.className = 'text-xs mt-2 text-center text-red-500'; msg.classList.remove('hidden'); return; }

    try {
        const body = { nome, descricao, preco, creditos, duracaoDias, ativo, servicosPermitidos };
        if (id) {
            await apiFetch(`/assinaturas/planos/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
        } else {
            await apiFetch('/assinaturas/planos', { method: 'POST', body: JSON.stringify(body) });
        }
        closePlanModal();
        showToast(id ? 'Plano atualizado!' : 'Plano criado!', 'success');
        loadPlans();
    } catch (e) {
        msg.textContent = e?.message || 'Erro ao salvar plano.';
        msg.className = 'text-xs mt-2 text-center text-red-500';
        msg.classList.remove('hidden');
    }
}

async function togglePlanActive(id, newState) {
    try {
        await apiFetch(`/assinaturas/planos/${id}`, { method: 'PATCH', body: JSON.stringify({ ativo: newState }) });
        showToast(newState ? 'Plano ativado.' : 'Plano desativado.', 'info');
        loadPlans();
    } catch (e) {
        showToast('Erro ao atualizar plano.', 'error');
    }
}

function showSubTab(tab) {
    const isAssinantes = tab === 'assinantes';
    document.getElementById('subPanelAssinantes').classList.toggle('hidden', !isAssinantes);
    document.getElementById('subPanelPlanos').classList.toggle('hidden', isAssinantes);
    document.getElementById('subTabAssinantes').className = isAssinantes
        ? 'px-6 py-3 text-sm font-black border-b-2 border-gray-950 text-gray-950 flex items-center gap-2'
        : 'px-6 py-3 text-sm font-bold text-gray-400 flex items-center gap-2';
    document.getElementById('subTabPlanos').className = !isAssinantes
        ? 'px-6 py-3 text-sm font-black border-b-2 border-gray-950 text-gray-950 flex items-center gap-2'
        : 'px-6 py-3 text-sm font-bold text-gray-400 flex items-center gap-2';
}

// ── Chave PIX ─────────────────────────────────────────────────────────────────

async function loadPixKey() {
    try {
        // GET /api/settings devolve um dicionário flat { "PixKey": "...", ... }
        const res = await apiFetch('/settings');
        const configs = await res.json();
        // Prioridade: Store_N_PixKey (da loja atual) → PixKey (global).
        // NÃO usa Barbeiro_N_PixKey aqui — essas chaves são individuais dos profissionais.
        const storeId = state.currentStoreId;
        const pix = (storeId && configs[`Store_${storeId}_PixKey`])
            || configs['PixKey'] || configs['pixKey'] || '';
        document.getElementById('pixKeyInput').value = pix;
    } catch (e) { /* silencioso */ }
}

async function savePixKey() {
    const pixValue = document.getElementById('pixKeyInput')?.value?.trim() || '';
    const msg = document.getElementById('pixKeySaveMsg');
    try {
        // PUT /api/settings espera um dicionário flat, igual às outras configurações
        await apiFetch('/settings', {
            method: 'PUT',
            body: JSON.stringify({ PixKey: pixValue })
        });
        msg.textContent = '✅ Chave PIX salva!';
        msg.className = 'text-xs mt-2 text-green-600';
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 3000);
    } catch (e) {
        msg.textContent = `❌ ${e.message || 'Erro ao salvar.'}`;
        msg.className = 'text-xs mt-2 text-red-500';
        msg.classList.remove('hidden');
    }
}

// --- FUNÇÕES DE AÇÃO (MODAIS/EDIT) ---
async function loadDetailedStats() {
    try {
        renderReportsLoading();
        initReportControls();
        const barberId = usesProfessionalScheduling() ? document.getElementById('barberFilter')?.value : '';
        const query = barberId ? `&barberId=${barberId}` : '';
        const res = await apiFetch(`/stats?days=30${query}`);
        const stats = await res.json();
        state.reports.stats = stats;
        renderDetailedReports(stats);
        const chartData = stats.Grafico || stats.grafico || stats.Gráfico || stats.gráfico || stats['Gráfico'] || [];
        if (chartData.length > 0) {
            updateAnalyticsChart(chartData);
        } else {
            renderEmptyChart();
        }
        await loadReports(false);
    } catch (e) {
        console.error("Erro ao carregar estatísticas:", e);
    }
}

function renderReportsLoading() {
    ['statMonthRevenue', 'statMonthTotal', 'statAttendanceRate', 'statNewClients'].forEach(id => updateText(id, '...'));
    const list = document.getElementById('popularServicesList');
    if (list) {
        list.innerHTML = '<div class="skeleton h-10"></div><div class="skeleton h-10"></div><div class="skeleton h-10"></div>';
    }
}

function renderDetailedReports(stats) {
    const receita = stats.Receita || stats.receita || {};
    const agendamentos = stats.Agendamentos || stats.agendamentos || {};
    const presença = stats.Presença || stats.presença || {};
    const clientes = stats.Clientes || stats.clientes || {};
    const mes = stats.Mes || stats.mes || {};
    const popular = stats.ServicosMaisPopulares || stats.servicosMaisPopulares || [];

    updateText('statMonthRevenue', formatCurrency(receita.Valor ?? receita.valor ?? mes.Faturamento ?? mes.faturamento ?? 0));
    updateText('statMonthTotal', agendamentos.Total ?? agendamentos.total ?? mes.Total ?? mes.total ?? 0);
    updateText('statAttendanceRate', `${presença.Taxa ?? presença.taxa ?? stats.TaxaPresença ?? stats.taxaPresença ?? 0}%`);
    updateText('statNewClients', clientes.Novos ?? clientes.novos ?? stats.NovosClientes ?? stats.novosClientes ?? '--');

    updateText('statUptime', stats.uptime || '-');
    updateText('statMemory', stats.memoria || '-');
    updateText('statSessions', stats.sessoes_ativas || '-');

    const list = document.getElementById('popularServicesList');
    if (list && popular.length) {
        list.innerHTML = popular.map(s => `
            <div class="flex items-center justify-between p-2 soft-panel hover:bg-slate-100 transition-colors">
                <span class="font-bold text-gray-700">${escapeHtml(s.Servico || s.servico || 'Serviço')}</span>
                <span class="font-black text-gray-950">${s.Total ?? s.total ?? 0}</span>
            </div>
        `).join('');
    } else if (list) {
        list.innerHTML = '<p class="text-center text-gray-400 py-4 font-bold">Sem dados no periodo.</p>';
    }
}

function renderEmptyChart(message = 'Sem agendamentos no periodo selecionado.') {
    const canvas = document.getElementById('analyticsChart');
    if (!canvas) return;

    if (analyticsChartInstance) {
        analyticsChartInstance.destroy();
        analyticsChartInstance = null;
    }

    if (typeof Chart === 'undefined') {
        const parent = canvas.parentElement;
        if (parent) parent.innerHTML = `<div class="text-sm font-bold text-gray-500 p-6 text-center">${message}</div>`;
        return;
    }

    const ctx = canvas.getContext('2d');
    analyticsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Hoje'],
            datasets: [{
                label: 'Agendamentos',
                data: [0],
                borderColor: '#94a3b8',
                backgroundColor: 'rgba(148, 163, 184, 0.15)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function updateAnalyticsChart(data) {
    const canvas = document.getElementById('analyticsChart');
    if (!canvas) return;
    if (typeof Chart === 'undefined') {
        const parent = canvas.parentElement;
        if (parent) parent.innerHTML = '<div class="text-sm font-bold text-gray-500 p-6 text-center">Gráfico indisponível. Verifique a conexão com a internet para carregar Chart.js.</div>';
        return;
    }

    const ctx = canvas.getContext('2d');
    
    if (analyticsChartInstance) {
        analyticsChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b'; // slate-400 : slate-500
    const gridColor = isDark ? '#334155' : '#e2e8f0'; // slate-700 : slate-200
    const accentColor = isDark ? '#60a5fa' : '#2563eb'; // blue-400 : blue-600

    // Gradiente para o efeito "neon"
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(37, 99, 235, 0.2)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

    analyticsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.Data || d.data),
            datasets: [{
                label: 'Agendamentos',
                data: data.map(d => d.Quantidade ?? d.quantidade ?? 0),
                borderColor: accentColor,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#2563eb'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    titleColor: isDark ? '#f8fafc' : '#0f172a',
                    bodyColor: isDark ? '#cbd5e1' : '#475569',
                    borderColor: gridColor,
                    borderWidth: 1,
                    titleFont: { weight: 'bold' }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { weight: 'bold' } } },
                x: { grid: { display: false }, ticks: { color: textColor, font: { weight: 'bold' } } }
            }
        }
    });
}

function initReportControls() {
    if (state.reports.filtersLoaded) return;
    const saved = JSON.parse(localStorage.getItem('hair_report_filters') || '{}');
    populateBarberSelect('reportBarber', state.barbeiros, true);
    populateServiceSelects();
    const serviceSelect = document.getElementById('reportService');
    if (serviceSelect && serviceSelect.options.length <= 1) {
        SERVICE_OPTIONS.forEach(s => serviceSelect.appendChild(new Option(s.label, s.value)));
    }
    if (saved.period) document.getElementById('reportPeriod').value = saved.period;
    applyReportPreset(saved.from, saved.to, false);
    ['reportBarber', 'reportService', 'reportStatus'].forEach(id => {
        if (saved[id] && document.getElementById(id)) document.getElementById(id).value = saved[id];
    });
    document.getElementById('reportAutoRefresh').checked = localStorage.getItem('hair_report_auto_refresh') === '1';
    toggleReportAutoRefresh(false);
    state.reports.filtersLoaded = true;
}

function applyReportPreset(savedFrom, savedTo, reload = true) {
    const period = document.getElementById('reportPeriod')?.value || 'week';
    const now = new Date();
    let from = new Date(now);
    let to = new Date(now);
    if (period === 'week') {
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        from.setDate(now.getDate() + diff);
    } else if (period === 'last7') {
        from.setDate(now.getDate() - 6);
    } else if (period === 'month') {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'last30') {
        from.setDate(now.getDate() - 29);
    } else if (savedFrom && savedTo) {
        from = new Date(`${savedFrom}T00:00:00`);
        to = new Date(`${savedTo}T00:00:00`);
    }
    document.getElementById('reportFrom').value = dateInput(from);
    document.getElementById('reportTo').value = dateInput(to);
    persistReportFilters();
    if (reload) loadReports();
}

function persistReportFilters() {
    const data = {
        period: document.getElementById('reportPeriod')?.value || 'week',
        from: document.getElementById('reportFrom')?.value || '',
        to: document.getElementById('reportTo')?.value || '',
        reportBarber: document.getElementById('reportBarber')?.value || '',
        reportService: document.getElementById('reportService')?.value || '',
        reportStatus: document.getElementById('reportStatus')?.value || ''
    };
    localStorage.setItem('hair_report_filters', JSON.stringify(data));
}

async function loadReports(showLoader = true) {
    initReportControls();
    persistReportFilters();
    let from = document.getElementById('reportFrom')?.value;
    let to = document.getElementById('reportTo')?.value;
    if (!from || !to) {
        applyReportPreset(null, null, false);
        from = document.getElementById('reportFrom')?.value;
        to = document.getElementById('reportTo')?.value;
    }
    const params = new URLSearchParams({ from, to, pageSize: '500' });
    const barber = usesProfessionalScheduling() ? document.getElementById('reportBarber')?.value : '';
    const service = document.getElementById('reportService')?.value;
    const status = document.getElementById('reportStatus')?.value;
    if (barber) params.set('barberId', barber);
    if (service) params.set('servico', service);
    if (status) params.set('status', status);
    if (showLoader) renderReportLoading();
    try {
        const res = await apiFetch(`/reports/appointments?${params.toString()}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'Falha ao carregar relatórios');
        state.reports.rows = (payload.data || []).map(normalizeReportAppointment);
        renderReportsCenter(state.reports.rows, payload);
        updateText('reportStatusText', `Atualizado às ${new Date().toLocaleTimeString('pt-BR')} - ${payload.total || state.reports.rows.length} registros encontrados.`);
    } catch (e) {
        console.error('Erro ao carregar relatórios:', e);
        updateText('reportStatusText', e.message || 'Erro ao carregar relatórios.');
        state.reports.rows = [];
        renderReportsCenter([], {});
    }
}

function normalizeReportAppointment(a) {
    const confirmed = a.PresencaConfirmada ?? a.presencaConfirmada ?? a.PresençaConfirmada ?? a.presençaConfirmada ?? false;
    return {
        Id: a.Id ?? a.id,
        ContactName: a.ContactName ?? a.contactName ?? 'Cliente',
        PhoneNumber: a.PhoneNumber ?? a.phoneNumber ?? '',
        DateTime: a.DateTime ?? a.dateTime,
        Servico: a.Servico ?? a.servico ?? serviceLabel(a.ServicoCodigo ?? a.servicoCodigo) ?? 'Corte',
        ServicoCodigo: a.ServicoCodigo ?? a.servicoCodigo ?? a.Servico ?? a.servico,
        BarberName: a.BarberName ?? a.barberName ?? 'Profissional n\u00e3o definido',
        Preco: Number(a.Preco ?? a.preco ?? 0),
        DuracaoMinutos: Number(a.DuracaoMinutos ?? a.duracaoMinutos ?? 30),
        PresençaConfirmada: !!confirmed,
        Status: a.Status ?? a.status ?? (confirmed ? 'Conclu\u00eddo' : 'Pendente'),
        FormaAgendamento: a.FormaAgendamento ?? a.formaAgendamento ?? 'WhatsApp/Bot',
        CreatedAt: a.CreatedAt ?? a.createdAt
    };
}

function serviceLabel(value) {
    if (!value) return '';
    return SERVICE_OPTIONS.find(s => s.value === value || s.label === value)?.label || value;
}
function renderReportLoading() {
    updateText('reportStatusText', 'Carregando relatórios...');
    ['reportCompleted','reportCanceled','reportRealizedRevenue','reportRecurringClients','reportAvgPerDay','reportAvgGap','reportCancelRate','reportTopBarber'].forEach(id => updateText(id, '...'));
    const body = document.getElementById('weeklyReportTableBody');
    if (body) body.innerHTML = '<tr><td colspan="8"><div class="skeleton h-10"></div></td></tr>';
}

function renderReportsCenter(rows, payload) {
    const metrics = calculateReportMetrics(rows, payload);
    updateText('statMonthTotal', rows.length);
    updateText('reportCompleted', metrics.completed);
    updateText('reportCanceled', metrics.canceled);
    updateText('statMonthRevenue', formatCurrency(metrics.estimatedRevenue));
    updateText('reportRealizedRevenue', formatCurrency(metrics.realizedRevenue));
    updateText('statAttendanceRate', `${metrics.attendanceRate}%`);
    updateText('statNewClients', metrics.newClients);
    updateText('reportRecurringClients', metrics.recurringClients);
    updateText('reportAvgPerDay', metrics.avgPerDay);
    updateText('reportAvgGap', `${metrics.avgGap}min`);
    updateText('reportCancelRate', `${metrics.cancelRate}%`);
    updateText('reportTopBarber', metrics.topBarber);
    renderReportTable(rows);
    renderReportPopularServices(metrics.services);
    renderReportCharts(rows, metrics);
}

function calculateReportMetrics(rows, payload = {}) {
    const days = new Set(rows.map(r => dateInput(getAppointmentDate(r)))).size || 1;
    const summary = payload.summary || {};
    const completed = rows.filter(r => r.PresençaConfirmada).length;
    const canceled = Number(summary.Cancelamentos ?? summary.cancelamentos ?? rows.filter(r => /cancel/i.test(r.Status)).length);
    const estimatedRevenue = Number(summary.ReceitaEstimada ?? summary.receitaEstimada ?? rows.reduce((sum, r) => sum + r.Preco, 0));
    const realizedRevenue = Number(summary.ReceitaRealizada ?? summary.receitaRealizada ?? rows.filter(r => r.PresençaConfirmada).reduce((sum, r) => sum + r.Preco, 0));
    const byPhone = groupCount(rows, r => r.PhoneNumber || r.ContactName);
    const recurringClients = Object.values(byPhone).filter(v => v > 1).length;
    const newClients = Object.values(byPhone).filter(v => v === 1).length;
    const byBarber = groupCount(rows, r => r.BarberName || 'Sem profissional');
    const topBarber = Object.entries(byBarber).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const sortedTimes = rows.map(getAppointmentDate).sort((a, b) => a - b);
    const gaps = sortedTimes.slice(1).map((d, i) => Math.max(0, Math.round((d - sortedTimes[i]) / 60000))).filter(v => v < 720);
    const services = groupSum(rows, r => r.Servico, r => r.Preco);
    return {
        completed,
        canceled,
        estimatedRevenue,
        realizedRevenue,
        attendanceRate: rows.length ? Math.round((completed / rows.length) * 100) : 0,
        cancelRate: rows.length ? Math.round((canceled / rows.length) * 100) : 0,
        recurringClients,
        newClients,
        avgPerDay: (rows.length / days).toFixed(1),
        avgGap: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0,
        topBarber,
        byBarber,
        services
    };
}

function groupCount(items, keyFn) {
    return items.reduce((acc, item) => {
        const key = keyFn(item) || '-';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

function groupSum(items, keyFn, valueFn) {
    return items.reduce((acc, item) => {
        const key = keyFn(item) || '-';
        acc[key] = (acc[key] || 0) + Number(valueFn(item) || 0);
        return acc;
    }, {});
}

function renderReportTable(rows) {
    const body = document.getElementById('weeklyReportTableBody');
    const empty = document.getElementById('reportEmptyState');
    updateText('reportTableCount', `${rows.length} registros`);
    if (!body) return;
    if (!rows.length) {
        body.innerHTML = '';
        empty?.classList.remove('hidden');
        return;
    }
    empty?.classList.add('hidden');
    body.innerHTML = rows.map(r => {
        const date = getAppointmentDate(r);
        const statusClass = r.PresençaConfirmada ? 'report-status-ok' : 'report-status-pending';
        return `<tr>
            <td>${date.toLocaleDateString('pt-BR')}</td>
            <td><strong>${escapeHtml(r.ContactName)}</strong><br><small>${escapeHtml(r.PhoneNumber)}</small></td>
            <td>${escapeHtml(r.BarberName)}</td>
            <td>${escapeHtml(r.Servico)}</td>
            <td>${formatTime(date)}</td>
            <td><span class="report-status ${statusClass}">${escapeHtml(r.Status)}</span></td>
            <td>${formatCurrency(r.Preco)}</td>
            <td>${escapeHtml(r.FormaAgendamento)}</td>
        </tr>`;
    }).join('');
}

function renderReportPopularServices(services) {
    const list = document.getElementById('popularServicesList');
    if (!list) return;
    const entries = Object.entries(services).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!entries.length) {
        list.innerHTML = '<p class="text-center text-gray-400 py-4 font-bold">Sem dados no periodo.</p>';
        return;
    }
    list.innerHTML = entries.map(([name, value]) => `
        <div class="report-summary-row">
            <span>${escapeHtml(name)}</span>
            <strong>${formatCurrency(value)}</strong>
        </div>
    `).join('');
}

function renderReportCharts(rows, metrics) {
    if (typeof Chart === 'undefined') return;
    const byDate = groupCount(rows, r => getAppointmentDate(r).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    const revenueByDate = groupSum(rows, r => getAppointmentDate(r).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), r => r.Preco);
    const labels = Object.keys(byDate);
    renderChart('analyticsChart', 'bar', labels, [
        { label: 'Agendamentos', data: labels.map(l => byDate[l]), backgroundColor: '#2fb7a4' },
        { label: 'Faturamento', data: labels.map(l => revenueByDate[l]), backgroundColor: '#df5b4f', yAxisID: 'y1' }
    ]);
    renderChartFromObject('barberReportChart', 'bar', metrics.byBarber, biz().agendamentoPlural, '#146c94');
    renderChartFromObject('servicesReportChart', 'bar', metrics.services, 'Faturamento', '#087f5b');
    renderChartFromObject('busyHoursChart', 'bar', groupCount(rows, r => `${getAppointmentDate(r).getHours().toString().padStart(2, '0')}h`), 'Horários', '#d9901a');
    renderChartFromObject('weekdayReportChart', 'bar', groupCount(rows, r => getAppointmentDate(r).toLocaleDateString('pt-BR', { weekday: 'short' })), 'Dias', '#5b5f97');
    renderChart('clientsReportChart', 'doughnut', ['Novos', 'Recorrentes'], [{ data: [metrics.newClients, metrics.recurringClients], backgroundColor: ['#2fb7a4', '#df5b4f'] }]);
    const weekGroups = groupCount(rows, r => {
        const d = getAppointmentDate(r);
        const first = new Date(d.getFullYear(), 0, 1);
        return `S${Math.ceil((((d - first) / 86400000) + first.getDay() + 1) / 7)}`;
    });
    renderChartFromObject('weekCompareChart', 'line', weekGroups, 'Agendamentos', '#2fb7a4');
}

function renderChartFromObject(id, type, obj, label, color) {
    const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 8);
    renderChart(id, type, entries.map(e => e[0]), [{ label, data: entries.map(e => e[1]), backgroundColor: color, borderColor: color, tension: 0.35 }]);
}

function renderChart(id, type, labels, datasets) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    if (id === 'analyticsChart' && analyticsChartInstance) {
        analyticsChartInstance.destroy();
        analyticsChartInstance = null;
    }
    if (reportCharts[id]) reportCharts[id].destroy();
    const textColor = document.documentElement.classList.contains('dark') ? '#cad6d0' : '#425049';
    reportCharts[id] = new Chart(canvas.getContext('2d'), {
        type,
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: datasets.length > 1 } },
            scales: type === 'doughnut' ? {} : {
                y: { beginAtZero: true, ticks: { color: textColor } },
                y1: { beginAtZero: true, position: 'right', display: datasets.length > 1, grid: { drawOnChartArea: false }, ticks: { color: textColor } },
                x: { ticks: { color: textColor } }
            }
        }
    });
}

function exportReportsCsv() {
    const rows = state.reports.rows || [];
    if (!rows.length) return showToast('Não ha dados filtrados para exportar.', 'info');
    const headers = ['Data','Cliente','Telefone',biz().profissionalSingular,'Serviço','Horário','Status','Valor','Forma'];
    const csvRows = rows.map(r => {
        const d = getAppointmentDate(r);
        return [d.toLocaleDateString('pt-BR'), r.ContactName, r.PhoneNumber, r.BarberName, r.Servico, formatTime(d), r.Status, String(r.Preco).replace('.', ','), r.FormaAgendamento]
            .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';');
    });
    const blob = new Blob(['\ufeff' + [headers.join(';'), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_filtrado_${todayInputValue()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV filtrado gerado.', 'success');
}

function toggleReportAutoRefresh(save = true) {
    const enabled = !!document.getElementById('reportAutoRefresh')?.checked;
    if (save) localStorage.setItem('hair_report_auto_refresh', enabled ? '1' : '0');
    if (reportAutoRefreshTimer) clearInterval(reportAutoRefreshTimer);
    reportAutoRefreshTimer = enabled ? setInterval(() => {
        if (state.activeView === 'relatorios') loadReports(false);
    }, 60000) : null;
}

function markAppointmentConfirmed(id) {
    let changed = false;
    ['all', 'today', 'future'].forEach(bucket => {
        state.agenda[bucket] = state.agenda[bucket].map(item => {
            if (Number(item.Id) !== Number(id)) return item;
            changed = true;
            return {
                ...item,
                PresençaConfirmada: true,
                PresencaConfirmada: true
            };
        });
    });
    if (changed) renderAgenda();
}

async function confirmarPresença(id, button = null) {
    if (!id) return;
    const originalHtml = button?.innerHTML;
    try {
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Confirmando</span>';
        }
        const res = await apiFetch(`/agendamentos/${id}/confirmar`, { method: 'PATCH' });
        if (res.ok) {
            showToast('Presença confirmada!', 'success');
            markAppointmentConfirmed(id);
            await loadData();
            if (state.activeView === 'relatorios') await loadReports(false);
        }
    } catch (e) {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalHtml || '<i class="fas fa-check"></i><span>Presença</span>';
        }
        showToast(e.message || 'Falha ao confirmar presença', 'error');
    }
}

async function cancelarAgendamento(id) {
    if (!confirm('Deseja realmente cancelar este agendamento?')) return;
    try {
        const res = await apiFetch(`/agendamentos/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Agendamento removido', 'success');
            loadData();
            syncSpreadsheetsQuietly();
        }
    } catch (e) { showToast('Erro ao excluir', 'error'); }
}

function editarAgendamento(id) {
    const appt = state.agenda.all.find(a => Number(a.Id) === Number(id));
    if (!appt) return;
    state.currentEditId = id;
    const dt = getAppointmentDate(appt);
    document.getElementById('editName').value = appt.ContactName;
    document.getElementById('editDate').value = dateInput(dt);
    document.getElementById('editTime').value = dt.toTimeString().slice(0, 5);
    document.getElementById('editModal').classList.remove('hidden');
}

function fecharModal() {
    document.getElementById('editModal').classList.add('hidden');
}

async function salvarEdicao() {
    const id = state.currentEditId;
    const date = document.getElementById('editDate').value;
    const time = document.getElementById('editTime').value;
    
    try {
        const res = await apiFetch(`/agendamentos/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ NovaData: `${date}T${time}:00` })
        });
        if (res.ok) {
            document.getElementById('editModal').classList.add('hidden');
            showToast('Agendamento atualizado', 'success');
            loadData();
            syncSpreadsheetsQuietly();
        }
    } catch (e) { showToast('Erro ao salvar', 'error'); }
}

async function updateHealthStatus() {
    try {
        const headers = { 'ngrok-skip-browser-warning': 'true' };
        if (state.token) headers.Authorization = `Bearer ${state.token}`;

        const res = await fetch(`${window.location.origin}/health/deep`, {
            headers
        });
        const data = await res.json();
        const dot = document.getElementById('sidebarStatusDot');
        const text = document.getElementById('sidebarStatusText');
        
        const backendOk = !!data.dependencies?.backend;
        const bridgeOk = !!data.dependencies?.bridge;
        const whatsappOk = !!data.dependencies?.whatsappConnected;
        const systemOk = backendOk && bridgeOk;
        const overallOk = systemOk && whatsappOk;
        dot.className = `status-dot ${overallOk ? 'bg-green-500' : (systemOk ? 'bg-yellow-500' : 'bg-red-500')}`;
        text.textContent = overallOk ? 'Sistema Online' : (systemOk ? 'WhatsApp exige QR' : (!backendOk ? 'Backend Offline' : 'Bridge Offline'));
    } catch (e) {
        console.warn('Health check failed:', e);
    }
}

// Debounce para busca
function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// Exportação Excel
async function exportExcel() {
    try {
        showToast('Atualizando planilha Excel...', 'info');
        const res = await apiFetch('/export?refresh=true');
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agendamentos_${todayInputValue()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Planilha Excel baixada.', 'success');
    } catch (e) { showToast('Erro ao exportar Excel', 'error'); }
}

async function syncGoogleSheets() {
    try {
        const webhook = document.getElementById('googleSheetsWebhook')?.value?.trim();
        if (webhook) {
            await apiFetch('/settings', {
                method: 'PUT',
                body: JSON.stringify({ "GoogleSheets_WebhookUrl": webhook })
            });
        }

        showToast('Atualizando Excel e sincronizando Google Sheets...', 'info');
        const res = await apiFetch('/spreadsheets/update', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha na sincronização');
        const sheets = data.googleSheets || {};
        const detail = sheets.synced
            ? `${sheets.message || 'Google Sheets sincronizado'}: ${sheets.appointments || 0} agendamentos, ${sheets.clients || 0} clientes, ${sheets.professionals || 0} profissionais e ${sheets.logs || 0} logs enviados.`
            : (sheets.message || 'Excel atualizado. Google Sheets não configurado');
        showToast(detail, sheets.synced ? 'success' : 'info');
    } catch (e) {
        showToast(e.message || 'Erro ao sincronizar Google Sheets', 'error');
    }
}

// ═══════════════════════ CALENDÁRIO VISUAL ═══════════════════════

const CAL_START_HOUR = 8;
const CAL_END_HOUR   = 20;
const CAL_SLOT_PX    = 48; // px por slot de 30 minutos → 1h = 96px, 12h = 1152px total

// Converte minutos desde CAL_START_HOUR para px
function calMinsToPx(minsFromStart) { return (minsFromStart / 30) * CAL_SLOT_PX; }
// Converte duração em minutos para px (mínimo 1 slot = 48px)
function calDurToPx(dur) { return Math.max(dur / 30, 0.8) * CAL_SLOT_PX; }
// Altura total da grade
const CAL_TOTAL_H = (CAL_END_HOUR - CAL_START_HOUR) * 2 * CAL_SLOT_PX;

const calState = { view: 'week', anchor: new Date() };

function setCalView(v) {
    calState.view = v;
    const btnW = document.getElementById('calBtnWeek');
    const btnM = document.getElementById('calBtnMonth');
    if (btnW) { btnW.classList.toggle('btn-primary', v === 'week'); btnW.classList.toggle('btn-light', v !== 'week'); }
    if (btnM) { btnM.classList.toggle('btn-primary', v === 'month'); btnM.classList.toggle('btn-light', v !== 'month'); }
    document.getElementById('calWeekView')?.classList.toggle('hidden', v !== 'week');
    document.getElementById('calMonthView')?.classList.toggle('hidden', v !== 'month');
    renderCalendar();
}

function calNav(dir) {
    const d = new Date(calState.anchor);
    if (calState.view === 'week') {
        // Mobile (3-day view): avança 1 dia por vez para controle fino
        const step = window.innerWidth < 640 ? 1 : 7;
        d.setDate(d.getDate() + dir * step);
    } else {
        d.setMonth(d.getMonth() + dir);
    }
    calState.anchor = d;
    renderCalendar();
}

function calToday() { calState.anchor = new Date(); renderCalendar(); }

function renderCalendar() {
    populateBarberSelect('calBarberFilter', state.barbeiros, true);
    calState.view === 'week' ? renderWeekCal() : renderMonthCal();
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}

function calFilteredAppts() {
    const calBarber = usesProfessionalScheduling() ? (document.getElementById('calBarberFilter')?.value || '') : '';
    return calBarber ? state.agenda.all.filter(a => String(a.BarberId) === calBarber) : state.agenda.all;
}

function renderWeekCal() {
    const container = document.getElementById('calWeekView');
    if (!container) return;

    // ── Adaptação mobile: 3-day view centrado no anchor ──────────────────
    const isMobile = window.innerWidth < 640;
    const GUTTER   = isMobile ? 36 : 52; // px — coluna de horários
    const allDayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

    let days, rangeStart, rangeEnd;
    if (isMobile) {
        const anchor = new Date(calState.anchor); anchor.setHours(0,0,0,0);
        days = [-1, 0, 1].map(offset => {
            const d = new Date(anchor); d.setDate(anchor.getDate() + offset); return d;
        });
        rangeStart = days[0];
        rangeEnd   = new Date(days[2]); rangeEnd.setHours(23, 59, 59, 999);
    } else {
        rangeStart = getWeekStart(calState.anchor);
        rangeEnd   = new Date(rangeStart); rangeEnd.setDate(rangeStart.getDate() + 6);
        rangeEnd.setHours(23, 59, 59, 999);
        days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(rangeStart); d.setDate(d.getDate() + i); return d;
        });
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const fmt = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const lbl = document.getElementById('calRangeLabel');
    if (lbl) {
        lbl.textContent = isMobile
            ? `${fmt(rangeStart)} – ${fmt(rangeEnd)}`
            : `${fmt(rangeStart)} – ${fmt(rangeEnd)} ${rangeEnd.getFullYear()}`;
    }

    const appts = calFilteredAppts().filter(a => {
        const d = getAppointmentDate(a);
        if (!d || isNaN(d)) return false;
        const day = new Date(d); day.setHours(0, 0, 0, 0);
        return day >= rangeStart && day <= rangeEnd;
    });

    const cols     = days.length;
    const gridCols = `${GUTTER}px repeat(${cols}, 1fr)`;

    // ── Cabeçalho (dias da semana) ──────────────────────────────
    let headHTML = `<div class="cal-gutter" style="width:${GUTTER}px"></div>`;
    days.forEach(d => {
        const isToday = d.getTime() === today.getTime();
        headHTML += `<div class="cal-day-hd${isToday ? ' is-today' : ''}">
            <span class="cal-day-name">${allDayNames[d.getDay()]}</span>
            <span class="cal-day-num">${d.getDate()}</span>
        </div>`;
    });

    // ── Eixo de tempo (a cada 30 minutos) ──────────────────────
    let timeHTML = `<div class="cal-time-col" style="height:${CAL_TOTAL_H}px;width:${GUTTER}px">`;
    for (let h = CAL_START_HOUR; h < CAL_END_HOUR; h++) {
        const topHour = calMinsToPx((h - CAL_START_HOUR) * 60);
        const topHalf = calMinsToPx((h - CAL_START_HOUR) * 60 + 30);
        timeHTML += `<div class="cal-tick cal-tick-hour" style="top:${topHour}px">${String(h).padStart(2,'0')}:00</div>`;
        timeHTML += `<div class="cal-tick cal-tick-half" style="top:${topHalf}px">${String(h).padStart(2,'0')}:30</div>`;
    }
    // Última hora (20:00)
    timeHTML += `<div class="cal-tick cal-tick-hour" style="top:${CAL_TOTAL_H}px">${String(CAL_END_HOUR).padStart(2,'0')}:00</div>`;
    timeHTML += `</div>`;

    // ── Colunas dos dias ────────────────────────────────────────
    let colsHTML = '';
    days.forEach(d => {
        const dateStr = d.toISOString().slice(0, 10);
        const isToday = d.getTime() === today.getTime();
        const dayAppts = appts.filter(a => {
            const dt = getAppointmentDate(a);
            return dt && dt.toISOString().slice(0, 10) === dateStr;
        }).sort((a, b) => getAppointmentDate(a) - getAppointmentDate(b));

        // Linhas de grade (hora = sólida, meia hora = tracejada suave)
        let linesHTML = '';
        for (let h = CAL_START_HOUR; h <= CAL_END_HOUR; h++) {
            linesHTML += `<div class="cal-hour-line" style="top:${calMinsToPx((h - CAL_START_HOUR) * 60)}px"></div>`;
            if (h < CAL_END_HOUR) {
                linesHTML += `<div class="cal-hour-line half" style="top:${calMinsToPx((h - CAL_START_HOUR) * 60 + 30)}px"></div>`;
            }
        }

        // Linha "agora"
        if (isToday) {
            const now = new Date();
            const minsFromStart = now.getHours() * 60 + now.getMinutes() - CAL_START_HOUR * 60;
            if (minsFromStart >= 0 && minsFromStart <= (CAL_END_HOUR - CAL_START_HOUR) * 60) {
                linesHTML += `<div class="cal-now-line" style="top:${calMinsToPx(minsFromStart)}px"></div>`;
            }
        }

        // Detecção de sobreposição de eventos (colunas paralelas)
        const slots = [];
        dayAppts.forEach(a => {
            const dt = getAppointmentDate(a);
            if (!dt) return;
            const startMin = dt.getHours() * 60 + dt.getMinutes();
            const endMin = startMin + Math.max(a.DuracaoMinutos || 30, 15);
            let col = 0;
            while (slots[col] && slots[col] > startMin) col++;
            slots[col] = endMin;
            a._calCol = col;
        });
        const maxCol = dayAppts.reduce((m, a) => Math.max(m, a._calCol || 0), 0) + 1;

        // Eventos
        let eventsHTML = '';
        dayAppts.forEach(a => {
            const dt = getAppointmentDate(a);
            if (!dt) return;
            const minsFromStart = dt.getHours() * 60 + dt.getMinutes() - CAL_START_HOUR * 60;
            if (minsFromStart < 0 || minsFromStart >= (CAL_END_HOUR - CAL_START_HOUR) * 60) return;
            const dur = Math.max(a.DuracaoMinutos || 30, 15);
            const top    = calMinsToPx(minsFromStart);
            const height = calDurToPx(dur);
            const theme  = serviceTheme(a.Servico);
            const confirmed = isAppointmentConfirmed(a);
            const colFrac   = 1 / maxCol;
            const leftPct   = (a._calCol || 0) * colFrac * 100;
            const widthPct  = colFrac * 100;
            const showSub   = height >= CAL_SLOT_PX; // mostrar subtítulo se >= 1 slot (48px)

            eventsHTML += `<div class="cal-event"
                style="top:${top}px;height:${height}px;left:calc(${leftPct}% + 3px);width:calc(${widthPct}% - 6px);background:${theme.wash};border-left-color:${theme.accent};color:${theme.accent};"
                title="${escapeHtml(a.ContactName)} — ${escapeHtml(a.Servico)} — ${formatTime(dt)}"
                onclick="calEventClick(event,${a.Id})">
                <span class="cal-event-name">${confirmed ? '✓ ' : ''}${escapeHtml(a.ContactName)}</span>
                ${showSub ? `<span class="cal-event-sub">${formatTime(dt)} · ${escapeHtml(a.Servico)}</span>` : ''}
            </div>`;
        });

        colsHTML += `<div class="cal-day-col${isToday ? ' is-today' : ''}" style="height:${CAL_TOTAL_H}px" data-date="${dateStr}" onclick="calDayClick(event,'${dateStr}')">
            ${linesHTML}${eventsHTML}
        </div>`;
    });

    container.innerHTML = `
        <div class="cal-week-head" style="display:grid;grid-template-columns:${gridCols}">${headHTML}</div>
        <div class="cal-body-scroll">
            <div class="cal-body-grid" style="display:grid;grid-template-columns:${gridCols}">
                ${timeHTML}${colsHTML}
            </div>
        </div>`;

    // Auto-scroll para o horário atual (mostrando 1h antes)
    const scroll = container.querySelector('.cal-body-scroll');
    if (scroll && scroll.scrollTop === 0) {
        const now = new Date();
        const minsOffset = Math.max(0, now.getHours() * 60 + now.getMinutes() - CAL_START_HOUR * 60 - 60);
        scroll.scrollTop = calMinsToPx(minsOffset);
    }
}

function renderMonthCal() {
    const container = document.getElementById('calMonthView');
    if (!container) return;

    const anchor = calState.anchor;
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const lbl = document.getElementById('calRangeLabel');
    if (lbl) lbl.textContent = `${monthNames[month]} ${year}`;

    const appts = calFilteredAppts().filter(a => {
        const d = getAppointmentDate(a);
        return d && !isNaN(d) && d.getFullYear() === year && d.getMonth() === month;
    });

    const byDate = {};
    appts.forEach(a => {
        const d = getAppointmentDate(a);
        if (!d) return;
        const key = d.toISOString().slice(0, 10);
        (byDate[key] = byDate[key] || []).push(a);
    });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const endPad   = lastDay.getDay()  === 0 ? 0 : 7 - lastDay.getDay();

    const dayNames = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
    let headHTML = dayNames.map(n => `<div class="cal-month-head-day">${n}</div>`).join('');

    let gridHTML = '';
    for (let i = 0; i < startPad; i++) {
        const d = new Date(firstDay); d.setDate(d.getDate() - (startPad - i));
        gridHTML += `<div class="cal-month-cell other-month"><span class="cal-mcell-num">${d.getDate()}</span></div>`;
    }
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const d = new Date(year, month, day);
        const dateStr = d.toISOString().slice(0, 10);
        const isToday = d.getTime() === today.getTime();
        const dayAppts = (byDate[dateStr] || []).sort((a, b) => getAppointmentDate(a) - getAppointmentDate(b));
        const maxShow = 3;
        let evHTML = dayAppts.slice(0, maxShow).map(a => {
            const theme = serviceTheme(a.Servico);
            const dt = getAppointmentDate(a);
            return `<span class="cal-mcell-event" style="background:${theme.wash};border-left-color:${theme.accent};color:${theme.accent}" onclick="event.stopPropagation();calEventClick(event,${a.Id})">${dt ? formatTime(dt) + ' ' : ''}${escapeHtml(a.ContactName)}</span>`;
        }).join('');
        if (dayAppts.length > maxShow) evHTML += `<span class="cal-mcell-more">+${dayAppts.length - maxShow} mais</span>`;
        gridHTML += `<div class="cal-month-cell${isToday ? ' is-today' : ''}" onclick="calMonthDayClick('${dateStr}')">
            <span class="cal-mcell-num">${day}</span>${evHTML}
        </div>`;
    }
    for (let i = 1; i <= endPad; i++) {
        gridHTML += `<div class="cal-month-cell other-month"><span class="cal-mcell-num">${i}</span></div>`;
    }

    container.innerHTML = `<div class="cal-month-head">${headHTML}</div><div class="cal-month-grid">${gridHTML}</div>`;
}

function calEventClick(e, id) {
    e.stopPropagation();
    editarAgendamento(id);
}

function calDayClick(e, dateStr) {
    if (e.target.closest('.cal-event')) return;
    const scroll = document.querySelector('#calWeekView .cal-body-scroll');
    if (!scroll) return;
    const scrollRect = scroll.getBoundingClientRect();
    const y = (e.clientY - scrollRect.top) + scroll.scrollTop;
    const clampedY = Math.max(0, Math.min(y, CAL_TOTAL_H));
    // Snap para o slot de 30min mais próximo
    const slotIndex = Math.round(clampedY / CAL_SLOT_PX);
    const snappedMin = slotIndex * 30;
    const totalMins  = CAL_START_HOUR * 60 + snappedMin;
    const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
    const mm = String(totalMins % 60).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    openManualAppointmentModal();
    setTimeout(() => {
        const dateInput = document.getElementById('manualDate');
        if (dateInput) dateInput.value = dateStr;
        const timeSelect = document.getElementById('manualTime');
        if (timeSelect) {
            const opts = Array.from(timeSelect.options);
            const closest = opts.find(o => o.value >= timeStr) || opts[opts.length - 1];
            if (closest) timeSelect.value = closest.value;
        }
        updateManualAvailableSlots();
    }, 120);
}

function calMonthDayClick(dateStr) {
    calState.anchor = new Date(dateStr + 'T12:00:00');
    setCalView('week');
}
