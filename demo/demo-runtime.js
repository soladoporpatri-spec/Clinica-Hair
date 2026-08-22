(function bootstrapDashboardDemo() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') !== '1') return;

    const STORAGE_KEY = 'patricio_dashboard_demo_v2';
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const isoAt = (days, time) => {
        const date = new Date();
        date.setDate(date.getDate() + days);
        const [hours, minutes] = time.split(':').map(Number);
        date.setHours(hours, minutes, 0, 0);
        return date.toISOString();
    };

    const seed = () => ({
        nextAppointmentId: 105,
        nextServiceId: 6,
        botEnabled: true,
        services: [
            { id: 1, name: 'Corte masculino', price: 35, durationMinutes: 30, active: true, order: 1 },
            { id: 2, name: 'Barba alinhada', price: 30, durationMinutes: 25, active: true, order: 2 },
            { id: 3, name: 'Corte + barba', price: 60, durationMinutes: 55, active: true, order: 3 },
            { id: 4, name: 'Sobrancelha', price: 15, durationMinutes: 15, active: true, order: 4 },
            { id: 5, name: 'Acabamento', price: 20, durationMinutes: 20, active: true, order: 5 }
        ],
        professionals: [
            { Id: 1, Nome: 'Rafael Lima', Especialidade: 'Cortes clássicos', Cor: '#2563eb', Ativo: true },
            { Id: 2, Nome: 'Bruno Santos', Especialidade: 'Barba e acabamento', Cor: '#16a34a', Ativo: true },
            { Id: 3, Nome: 'Caio Martins', Especialidade: 'Degradê e finalização', Cor: '#f59e0b', Ativo: true }
        ],
        appointments: [
            { Id: 101, ContactName: 'Lucas Mendes', PhoneNumber: '5511991001001', Servico: 'Corte masculino', BarberId: 1, BarberName: 'Rafael Lima', BarberColor: '#2563eb', DateTime: isoAt(0, '10:00'), Preco: 35, DuracaoMinutos: 30, PresencaConfirmada: true, Status: 'Confirmado', FormaAgendamento: 'WhatsApp/Bot' },
            { Id: 102, ContactName: 'André Oliveira', PhoneNumber: '5511991001002', Servico: 'Corte + barba', BarberId: 2, BarberName: 'Bruno Santos', BarberColor: '#16a34a', DateTime: isoAt(0, '14:30'), Preco: 60, DuracaoMinutos: 55, PresencaConfirmada: false, Status: 'Pendente', FormaAgendamento: 'Dashboard' },
            { Id: 103, ContactName: 'Mateus Rocha', PhoneNumber: '5511991001003', Servico: 'Barba alinhada', BarberId: 3, BarberName: 'Caio Martins', BarberColor: '#f59e0b', DateTime: isoAt(1, '11:00'), Preco: 30, DuracaoMinutos: 25, PresencaConfirmada: false, Status: 'Pendente', FormaAgendamento: 'WhatsApp/Bot' },
            { Id: 104, ContactName: 'Pedro Almeida', PhoneNumber: '5511991001004', Servico: 'Acabamento', BarberId: 1, BarberName: 'Rafael Lima', BarberColor: '#2563eb', DateTime: isoAt(2, '16:00'), Preco: 20, DuracaoMinutos: 20, PresencaConfirmada: true, Status: 'Confirmado', FormaAgendamento: 'Dashboard' }
        ]
    });

    const load = () => {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (stored?.appointments && stored?.services && stored?.professionals) return stored;
        } catch (_) {}
        const initial = seed();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
        return initial;
    };
    let data = load();
    const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
    const requestBody = (options) => {
        try { return JSON.parse(options?.body || '{}'); } catch (_) { return {}; }
    };
    const pathOnly = (path) => String(path || '').split('?')[0];
    const findService = (value) => data.services.find((item) => String(item.id) === String(value) || item.name === value);
    const findProfessional = (value) => data.professionals.find((item) => String(item.Id) === String(value));
    const sameLocalDay = (value, target = new Date()) => new Date(value).toDateString() === target.toDateString();
    const customerPayload = () => {
        const grouped = new Map();
        data.appointments.forEach((item) => {
            const key = item.PhoneNumber || item.ContactName;
            const current = grouped.get(key) || {
                customerKey: key,
                name: item.ContactName,
                phoneNumber: item.PhoneNumber,
                completedAppointments: 0,
                totalAppointments: 0,
                totalSpent: 0,
                lastAppointmentAt: null,
                nextAppointmentAt: null,
                topService: item.Servico,
                status: 'novo',
                statusLabel: 'Novo',
                tags: [], events: [], reminders: []
            };
            current.totalAppointments += 1;
            current.completedAppointments += item.PresencaConfirmada ? 1 : 0;
            current.totalSpent += Number(item.Preco || 0);
            const when = new Date(item.DateTime);
            if (!current.lastAppointmentAt || when > new Date(current.lastAppointmentAt)) current.lastAppointmentAt = item.DateTime;
            if (when >= new Date() && (!current.nextAppointmentAt || when < new Date(current.nextAppointmentAt))) current.nextAppointmentAt = item.DateTime;
            grouped.set(key, current);
        });
        const customers = [...grouped.values()].map((item) => ({
            ...item,
            averageTicket: item.totalAppointments ? item.totalSpent / item.totalAppointments : 0,
            status: item.totalAppointments > 1 ? 'recorrente' : item.status,
            statusLabel: item.totalAppointments > 1 ? 'Recorrente' : item.statusLabel
        }));
        return {
            data: customers,
            summary: {
                total: customers.length,
                recurring: customers.filter((item) => item.totalAppointments > 1).length,
                inactive: 0,
                vip: 1,
                noNext: customers.filter((item) => !item.nextAppointmentAt).length,
                revenue: customers.reduce((sum, item) => sum + item.totalSpent, 0),
                pendingReminders: 0
            },
            tags: [], segments: {}
        };
    };

    const handleServices = (route, method, options) => {
        const match = route.match(/^\/servicos\/(\d+)$/);
        if (method === 'GET' && route === '/servicos') return jsonResponse(clone(data.services));
        if (method === 'POST' && route === '/servicos') {
            const body = requestBody(options);
            const service = {
                id: data.nextServiceId++,
                name: body.Nome || body.name || 'Novo serviço',
                price: Number(body.Preco ?? body.price ?? 0),
                durationMinutes: Number(body.DuracaoMinutos ?? body.durationMinutes ?? 30),
                active: (body.Ativo ?? body.active ?? true) !== false,
                order: data.services.length + 1
            };
            data.services.push(service); save();
            return jsonResponse(service, 201);
        }
        if (match && method === 'PATCH') {
            const service = findService(match[1]);
            if (!service) return jsonResponse({ error: 'Serviço não encontrado' }, 404);
            const body = requestBody(options);
            service.name = body.Nome ?? body.name ?? service.name;
            service.price = Number(body.Preco ?? body.price ?? service.price);
            service.durationMinutes = Number(body.DuracaoMinutos ?? body.durationMinutes ?? service.durationMinutes);
            service.active = (body.Ativo ?? body.active ?? service.active) !== false;
            save(); return jsonResponse(service);
        }
        if (match && method === 'DELETE') {
            data.services = data.services.filter((item) => String(item.id) !== match[1]); save();
            return jsonResponse({ message: 'Serviço removido na demonstração.' });
        }
        return null;
    };

    const handleAppointments = (route, method, options) => {
        if (method === 'GET' && route === '/hoje') return jsonResponse(clone(data.appointments.filter((item) => sameLocalDay(item.DateTime))));
        if (method === 'GET' && route === '/agendamentos') return jsonResponse({ data: clone(data.appointments.filter((item) => !sameLocalDay(item.DateTime))), total: data.appointments.length });
        if (method === 'POST' && route === '/agendamentos') {
            const body = requestBody(options);
            const service = findService(body.Servico);
            const professional = findProfessional(body.BarberId) || data.professionals[0];
            const appointment = {
                Id: data.nextAppointmentId++, ContactName: body.ContactName || 'Cliente presencial', PhoneNumber: body.PhoneNumber || '',
                Servico: service?.name || body.Servico || 'Serviço', BarberId: professional?.Id || null,
                BarberName: body.BarberName || professional?.Nome || 'Profissional', BarberColor: professional?.Cor || '#64748b',
                DateTime: body.DateTime, Notes: body.Notes || '', Preco: Number(service?.price || 0),
                DuracaoMinutos: Number(service?.durationMinutes || 30), PresencaConfirmada: false,
                Status: 'Pendente', FormaAgendamento: 'Dashboard'
            };
            data.appointments.push(appointment); save();
            return jsonResponse({ message: 'Agendamento criado na demonstração.', dateTime: appointment.DateTime, serviceName: appointment.Servico, barberName: appointment.BarberName, price: appointment.Preco }, 201);
        }
        const confirmMatch = route.match(/^\/agendamentos\/(\d+)\/confirmar$/);
        if (confirmMatch && method === 'PATCH') {
            const appointment = data.appointments.find((item) => String(item.Id) === confirmMatch[1]);
            if (appointment) { appointment.PresencaConfirmada = true; appointment.Status = 'Confirmado'; save(); }
            return jsonResponse(appointment || { error: 'Agendamento não encontrado' }, appointment ? 200 : 404);
        }
        const itemMatch = route.match(/^\/agendamentos\/(\d+)$/);
        if (itemMatch && method === 'DELETE') {
            data.appointments = data.appointments.filter((item) => String(item.Id) !== itemMatch[1]); save();
            return jsonResponse({ message: 'Agendamento removido na demonstração.' });
        }
        if (itemMatch && method === 'PATCH') {
            const appointment = data.appointments.find((item) => String(item.Id) === itemMatch[1]);
            if (!appointment) return jsonResponse({ error: 'Agendamento não encontrado' }, 404);
            Object.assign(appointment, requestBody(options)); save();
            return jsonResponse(appointment);
        }
        return null;
    };

    window.NytharDemoApi = {
        active: true,
        reset() { data = seed(); save(); window.location.reload(); },
        async handle(path, options = {}) {
            const route = pathOnly(path);
            const method = String(options.method || 'GET').toUpperCase();
            const response = handleServices(route, method, options) || handleAppointments(route, method, options);
            if (response) return response;
            if (route === '/modules') return jsonResponse({ modules: [
                { Key: 'whatsapp_bot', Enabled: true }, { Key: 'dashboard_analytics', Enabled: true },
                { Key: 'automations', Enabled: true }, { Key: 'multi_professionals', Enabled: true }
            ] });
            if (route === '/barbeiros') return jsonResponse(clone(data.professionals));
            if (route === '/horarios-livres') return jsonResponse({ HorariosLivres: ['09:00', '10:00', '11:30', '13:30', '15:00', '16:30', '18:00'], DuracaoMinutos: 30, ExpedienteFim: '19:00', UltimoInicioPossivel: '18:30' });
            if (route === '/dias-indisponiveis') return jsonResponse([]);
            if (route === '/customers') return jsonResponse(customerPayload());
            if (route.startsWith('/customers/')) return jsonResponse({ message: 'Alteração salva somente nesta demonstração.' });
            if (route.startsWith('/customer-reminders')) return jsonResponse({ message: 'Lembrete atualizado na demonstração.' });
            if (route === '/reports/appointments') return jsonResponse({ data: clone(data.appointments), total: data.appointments.length, summary: {} });
            if (route === '/stats') return jsonResponse({});
            if (route === '/bot/status' || route === '/bot/qr') return jsonResponse({ connectionState: 'OFFLINE', whatsappConnected: false, botEnabled: data.botEnabled, status: 'demo', phone: null, pausedPendingCount: 0, demoMode: true });
            if (route === '/bot/toggle' && method === 'POST') { data.botEnabled = !data.botEnabled; save(); return jsonResponse({ botEnabled: data.botEnabled, demoMode: true }); }
            if (route.startsWith('/bot/')) return jsonResponse({ message: 'WhatsApp indisponível no GitHub Pages.', demoMode: true });
            if (route === '/diagnostics') return jsonResponse({
                health: { score: 100, status: 'ready' }, billing: { daysUntilExpiry: null },
                whatsapp: { needsReconnect: false, status: 'Demonstração sem conexão real' },
                activity: { recentAppointments: data.appointments.length, revenue30d: data.appointments.reduce((sum, item) => sum + Number(item.Preco || 0), 0) },
                checklist: [{ ok: true, label: 'Interface real carregada', message: 'Os dados desta página ficam somente no navegador.' }],
                modules: [{ Key: 'agenda', Name: 'Agenda', Enabled: true }, { Key: 'dashboard_analytics', Name: 'Relatórios', Enabled: true }],
                counts: { users: 1, admins: 1, professionals: data.professionals.length, services: data.services.length, appointments: data.appointments.length, botSessions: 0, activeClientSubscriptions: 0, openTechTickets: 0 }
            });
            if (route === '/settings') return jsonResponse({ HorarioAbertura: '09:00', HorarioFechamento: '19:00', Msg_Welcome: 'Olá! Esta é uma demonstração da agenda.' });
            if (route === '/bot/templates') return jsonResponse({});
            if (route === '/assinaturas/stats') return jsonResponse({ active: 0, revenue: 0, pending: 0 });
            if (route.startsWith('/assinaturas')) return jsonResponse([]);
            if (route.startsWith('/pix/')) return jsonResponse({ error: 'Pagamento indisponível na demonstração.' }, 400);
            if (route.startsWith('/spreadsheets/')) return jsonResponse({ message: 'Sincronização simulada', appointments: data.appointments.length });
            if (route.startsWith('/maintenance/')) return jsonResponse({ message: 'Nenhuma limpeza necessária na demonstração.' });
            return jsonResponse({ message: 'Ação disponível apenas na instalação completa.', demoMode: true });
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('demo-mode');
        const ribbon = document.createElement('div');
        ribbon.className = 'dashboard-demo-ribbon';
        ribbon.innerHTML = '<div><strong>Modo demonstração</strong><span>Dashboard real com dados fictícios salvos somente neste navegador. O WhatsApp não está conectado.</span></div><nav><a href="Nythar/landing-page.html">Ver landing page</a><button type="button" id="resetDashboardDemo">Reiniciar dados</button></nav>';
        document.body.prepend(ribbon);
        document.getElementById('resetDashboardDemo')?.addEventListener('click', () => window.NytharDemoApi.reset());
    });
})();
