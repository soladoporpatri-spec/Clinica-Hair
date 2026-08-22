(() => {
    "use strict";

    const STORAGE_KEY = "nythar-demo-state-v1";
    const services = [
        { name: "Corte", duration: 40, price: 40, icon: "✂" },
        { name: "Barba", duration: 30, price: 30, icon: "♢" },
        { name: "Corte + Barba", duration: 70, price: 65, icon: "✦" },
        { name: "Sobrancelha", duration: 20, price: 20, icon: "⌁" },
        { name: "Pezinho", duration: 15, price: 15, icon: "⌄" },
        { name: "Combo completo", duration: 90, price: 80, icon: "★" }
    ];

    const pad = (value) => String(value).padStart(2, "0");
    const toIsoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const shiftedDate = (days) => {
        const value = new Date();
        value.setDate(value.getDate() + days);
        return toIsoDate(value);
    };
    const seedState = () => ({
        appointments: [
            { id: crypto.randomUUID(), client: "Ana Souza", phone: "(62) 99921-3040", service: "Corte", professional: "Itamar", date: shiftedDate(0), time: "09:00", status: "Confirmado", price: 40 },
            { id: crypto.randomUUID(), client: "Carlos Lima", phone: "(62) 99877-1422", service: "Corte + Barba", professional: "Marcos", date: shiftedDate(0), time: "10:30", status: "Confirmado", price: 65 },
            { id: crypto.randomUUID(), client: "Rafael Alves", phone: "(62) 99215-8801", service: "Barba", professional: "Itamar", date: shiftedDate(0), time: "15:00", status: "Pendente", price: 30 },
            { id: crypto.randomUUID(), client: "Bruno Rocha", phone: "(62) 99631-7254", service: "Combo completo", professional: "Camila", date: shiftedDate(1), time: "13:30", status: "Confirmado", price: 80 },
            { id: crypto.randomUUID(), client: "João Pedro", phone: "(62) 99102-3487", service: "Corte", professional: "Marcos", date: shiftedDate(2), time: "16:30", status: "Confirmado", price: 40 },
            { id: crypto.randomUUID(), client: "Marina Costa", phone: "(62) 99540-6620", service: "Sobrancelha", professional: "Camila", date: shiftedDate(4), time: "10:30", status: "Pendente", price: 20 }
        ]
    });

    const loadState = () => {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (Array.isArray(parsed?.appointments)) return parsed;
        } catch (_) { /* usa os dados iniciais */ }
        return seedState();
    };
    let state = loadState();
    const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const money = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const shortDate = (value) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`));
    const longDate = (value) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
    const byDateTime = (a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);

    const toast = document.getElementById("toast");
    let toastTimer;
    const showToast = (message) => {
        toast.textContent = message;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
    };

    const renderOverview = () => {
        const today = shiftedDate(0);
        const todayItems = state.appointments.filter((item) => item.date === today).sort(byDateTime);
        const clients = new Set(state.appointments.map((item) => item.phone || item.client));
        document.getElementById("metricToday").textContent = todayItems.length;
        document.getElementById("metricConfirmed").textContent = state.appointments.filter((item) => item.status === "Confirmado").length;
        document.getElementById("metricClients").textContent = clients.size;
        document.getElementById("metricRevenue").textContent = money(state.appointments.reduce((total, item) => total + item.price, 0));
        document.getElementById("todayAppointments").innerHTML = todayItems.length ? todayItems.map((item) => `
            <div class="appointment-item">
                <time>${escapeHtml(item.time)}</time>
                <div><strong>${escapeHtml(item.client)}</strong><small>${escapeHtml(item.service)} • ${escapeHtml(item.professional)}</small></div>
                <span class="status ${item.status.toLowerCase()}">${escapeHtml(item.status)}</span>
            </div>`).join("") : '<div class="empty-state">Nenhum atendimento para hoje.</div>';

        const labels = ["Hoje", "Amanhã", "+2", "+3", "+4", "+5", "+6"];
        const counts = labels.map((_, index) => state.appointments.filter((item) => item.date === shiftedDate(index)).length);
        const max = Math.max(...counts, 1);
        document.getElementById("miniChart").innerHTML = counts.map((count, index) => `<div class="chart-column"><i style="height:${Math.max(8, count / max * 92)}%"></i><small>${labels[index]}</small></div>`).join("");
        document.getElementById("weekTotal").textContent = `${counts.reduce((sum, count) => sum + count, 0)} na semana`;
    };

    const renderAgenda = () => {
        const rows = [...state.appointments].sort(byDateTime);
        document.getElementById("appointmentsTable").innerHTML = rows.map((item) => `
            <tr><td><strong>${shortDate(item.date)} • ${escapeHtml(item.time)}</strong><small>${escapeHtml(longDate(item.date))}</small></td><td><strong>${escapeHtml(item.client)}</strong><small>${escapeHtml(item.phone || "Sem telefone")}</small></td><td>${escapeHtml(item.service)}</td><td>${escapeHtml(item.professional)}</td><td>${money(item.price)}</td><td><span class="status ${item.status.toLowerCase()}">${escapeHtml(item.status)}</span></td></tr>`).join("");
        document.getElementById("agendaEmpty").hidden = rows.length > 0;
    };

    const getClients = () => {
        const result = new Map();
        state.appointments.forEach((item) => {
            const key = item.phone || item.client;
            const current = result.get(key) || { name: item.client, phone: item.phone, visits: 0, spent: 0 };
            current.visits += 1;
            current.spent += item.price;
            result.set(key, current);
        });
        return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
    };
    const renderClients = (search = "") => {
        const normalized = search.trim().toLocaleLowerCase("pt-BR");
        const clients = getClients().filter((item) => `${item.name} ${item.phone}`.toLocaleLowerCase("pt-BR").includes(normalized));
        document.getElementById("clientsGrid").innerHTML = clients.map((item) => `
            <article class="client-card"><div class="client-top"><span class="client-avatar">${escapeHtml(item.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join(""))}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.phone || "Sem telefone")}</small></div></div><div class="client-stats"><span>${item.visits} atendimento(s)</span><strong>${money(item.spent)}</strong></div></article>`).join("") || '<div class="empty-state">Nenhum cliente encontrado.</div>';
    };
    const renderServices = () => {
        document.getElementById("servicesGrid").innerHTML = services.map((item) => `<article class="service-card"><span class="service-icon">${item.icon}</span><h3>${escapeHtml(item.name)}</h3><p>Serviço disponível no fluxo demonstrativo do chatbot e da agenda.</p><div class="service-meta"><span>${item.duration} min</span><strong>${money(item.price)}</strong></div></article>`).join("");
    };
    const renderReports = () => {
        const counts = services.map((service) => ({ name: service.name, count: state.appointments.filter((item) => item.service === service.name).length })).sort((a, b) => b.count - a.count);
        const max = Math.max(...counts.map((item) => item.count), 1);
        document.getElementById("serviceReport").innerHTML = counts.map((item) => `<div class="report-row"><span>${escapeHtml(item.name)}</span><div class="report-track"><i style="width:${item.count / max * 100}%"></i></div><strong>${item.count}</strong></div>`).join("");
        const confirmed = state.appointments.filter((item) => item.status === "Confirmado").length;
        const percent = state.appointments.length ? Math.round(confirmed / state.appointments.length * 100) : 0;
        document.getElementById("statusReport").innerHTML = `<div class="donut" style="background:conic-gradient(var(--green) 0 ${percent}%,#f0eaf2 ${percent}% 100%)"><div class="donut-label"><strong>${percent}%</strong><small>confirmados</small></div></div>`;
    };
    const renderAll = () => { renderOverview(); renderAgenda(); renderClients(document.getElementById("clientSearch").value); renderServices(); renderReports(); };

    const titles = { inicio: "Visão geral", agenda: "Agenda", clientes: "Clientes", servicos: "Serviços", chatbot: "Chatbot", relatorios: "Relatórios" };
    const setView = (view) => {
        document.querySelectorAll(".view").forEach((element) => element.classList.toggle("active", element.id === `view-${view}`));
        document.querySelectorAll(".nav-item").forEach((element) => element.classList.toggle("active", element.dataset.view === view));
        document.getElementById("pageTitle").textContent = titles[view];
        document.body.classList.remove("menu-open");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
    document.querySelectorAll("[data-go-chatbot]").forEach((button) => button.addEventListener("click", () => setView("chatbot")));
    document.querySelectorAll("[data-go-agenda]").forEach((button) => button.addEventListener("click", () => setView("agenda")));
    document.querySelector(".menu-button").addEventListener("click", () => document.body.classList.toggle("menu-open"));
    document.addEventListener("click", (event) => { if (document.body.classList.contains("menu-open") && !event.target.closest(".sidebar,.menu-button")) document.body.classList.remove("menu-open"); });

    const dialog = document.getElementById("appointmentDialog");
    const form = document.getElementById("appointmentForm");
    document.getElementById("formService").innerHTML = services.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)} • ${money(item.price)}</option>`).join("");
    document.getElementById("formDate").min = shiftedDate(0);
    document.getElementById("formDate").value = shiftedDate(0);
    document.querySelectorAll("[data-open-appointment]").forEach((button) => button.addEventListener("click", () => dialog.showModal()));
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        const service = services.find((item) => item.name === data.service);
        state.appointments.push({ id: crypto.randomUUID(), client: data.client.trim(), phone: data.phone.trim(), service: data.service, professional: data.professional, date: data.date, time: data.time, status: "Confirmado", price: service?.price || 0 });
        saveState(); renderAll(); dialog.close(); form.reset(); document.getElementById("formDate").value = shiftedDate(0); showToast("Agendamento criado na demonstração."); setView("agenda");
    });
    document.getElementById("clientSearch").addEventListener("input", (event) => renderClients(event.target.value));
    document.getElementById("resetDemo").addEventListener("click", () => { state = seedState(); saveState(); renderAll(); startChat(); showToast("Dados da demonstração reiniciados."); });

    const chatMessages = document.getElementById("chatMessages");
    const chatOptions = document.getElementById("chatOptions");
    let chat = {};
    const addBubble = (text, type = "bot") => {
        const bubble = document.createElement("div");
        bubble.className = `bubble ${type}`;
        bubble.textContent = text;
        const time = document.createElement("small");
        time.textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        bubble.appendChild(time); chatMessages.appendChild(bubble); chatMessages.scrollTop = chatMessages.scrollHeight;
    };
    const setOptions = (items) => {
        chatOptions.replaceChildren(...items.map((item) => { const button = document.createElement("button"); button.type = "button"; button.textContent = item.label; button.addEventListener("click", () => item.action()); return button; }));
    };
    const choose = (label, next) => { addBubble(label, "user"); setOptions([]); setTimeout(next, 280); };
    const showMenu = () => {
        addBubble("Olá! Sou o chatbot da Clínica Modelo. O que você deseja fazer?\n\n1. Marcar horário\n2. Meus agendamentos\n3. Cancelar agendamento\n4. Reagendar\n5. Clube de fidelidade");
        setOptions([
            { label: "1 • Marcar horário", action: () => choose("Marcar horário", showServices) },
            { label: "2 • Meus agendamentos", action: () => choose("Meus agendamentos", () => { addBubble(`Você possui ${state.appointments.length} agendamento(s) nesta demonstração.`); setOptions([{ label: "Voltar ao menu", action: () => choose("Voltar", showMenu) }]); }) },
            { label: "3 • Cancelar agendamento", action: () => choose("Cancelar agendamento", () => { addBubble("Na demonstração, nenhum atendimento real será cancelado."); setOptions([{ label: "Voltar ao menu", action: () => choose("Voltar", showMenu) }]); }) },
            { label: "4 • Reagendar", action: () => choose("Reagendar", () => { addBubble("Essa opção é apresentada apenas como exemplo seguro."); setOptions([{ label: "Voltar ao menu", action: () => choose("Voltar", showMenu) }]); }) },
            { label: "5 • Clube de fidelidade", action: () => choose("Clube de fidelidade", () => { addBubble("Exemplo: a cada 5 atendimentos, o cliente recebe um benefício configurado pela loja."); setOptions([{ label: "Voltar ao menu", action: () => choose("Voltar", showMenu) }]); }) }
        ]);
    };
    const showServices = () => {
        addBubble("Qual serviço você deseja?");
        setOptions(services.slice(0, 4).map((service) => ({ label: `${service.name} • ${money(service.price)}`, action: () => choose(service.name, () => { chat.service = service; showProfessionals(); }) })));
    };
    const showProfessionals = () => {
        addBubble("Escolha um profissional:");
        setOptions(["Itamar", "Marcos", "Camila"].map((name) => ({ label: name, action: () => choose(name, () => { chat.professional = name; showDates(); }) })));
    };
    const showDates = () => {
        addBubble("Qual dia fica melhor?");
        setOptions([0, 1, 2].map((offset) => ({ label: offset === 0 ? `Hoje • ${shortDate(shiftedDate(offset))}` : longDate(shiftedDate(offset)), action: () => choose(longDate(shiftedDate(offset)), () => { chat.date = shiftedDate(offset); showTimes(); }) })));
    };
    const showTimes = () => {
        addBubble("Escolha um horário disponível:");
        setOptions(["10:30", "15:00", "17:00"].map((time) => ({ label: time, action: () => choose(time, () => { chat.time = time; showConfirmation(); }) })));
    };
    const showConfirmation = () => {
        addBubble(`Confirme os dados:\nServiço: ${chat.service.name}\nProfissional: ${chat.professional}\nData: ${shortDate(chat.date)}\nHorário: ${chat.time}\nValor: ${money(chat.service.price)}`);
        setOptions([{ label: "✓ Confirmar agendamento", action: () => choose("Confirmar", confirmChatAppointment) }, { label: "× Cancelar", action: () => choose("Cancelar", () => { addBubble("Fluxo cancelado. Você pode começar novamente."); setOptions([{ label: "Voltar ao menu", action: () => choose("Voltar", showMenu) }]); }) }]);
    };
    const confirmChatAppointment = () => {
        state.appointments.push({ id: crypto.randomUUID(), client: "Cliente da demonstração", phone: "(00) 00000-0000", service: chat.service.name, professional: chat.professional, date: chat.date, time: chat.time, status: "Confirmado", price: chat.service.price });
        saveState(); renderAll(); addBubble("Agendamento confirmado! Ele já apareceu na dashboard da demonstração."); setOptions([{ label: "Ver na agenda", action: () => setView("agenda") }, { label: "Novo atendimento", action: () => choose("Novo atendimento", showMenu) }]); showToast("Chatbot adicionou um agendamento à agenda.");
    };
    const startChat = () => { chat = {}; chatMessages.innerHTML = ""; chatOptions.innerHTML = ""; addBubble("Esta é uma conversa simulada. Nenhuma mensagem será enviada ao WhatsApp."); setTimeout(showMenu, 250); };
    document.getElementById("restartChat").addEventListener("click", startChat);

    const now = new Date();
    document.querySelector(".today-label").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(now);
    saveState(); renderAll(); startChat();
})();
