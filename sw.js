const CACHE_VERSION = 'nythar-pwa-v14';

// App Shell: apenas arquivos locais críticos para funcionamento offline.
// Cada arquivo é cacheado individualmente — uma falha não cancela todo o install.
const APP_SHELL = [
    '/dashboard-improved.html',
    '/login.html',
    '/style-dashboard.css',
    '/script-dashboard.js',
    '/manifest.json',
    '/assets/pwa-192.png',
    '/assets/pwa-512.png',
    '/assets/pwa-maskable-512.png',
    '/assets/signalr.min.js',
    '/assets/notification.mp3'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_VERSION);
        // Promise.allSettled: cacheia cada arquivo individualmente.
        // Se um CDN externo ou arquivo estiver indisponível, o SW ainda instala corretamente.
        const results = await Promise.allSettled(
            APP_SHELL.map(url => cache.add(url))
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
            console.warn(`[SW v14] ${failed} arquivo(s) não cacheados — funcionará parcialmente offline.`);
        }
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // API, SignalR e health: sempre tenta rede, com fallback offline
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/hubs/') || url.pathname.startsWith('/health')) {
        event.respondWith(
            fetch(request).catch(() => new Response(
                JSON.stringify({ offline: true, error: 'Sem conexão com o servidor.' }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
            ))
        );
        return;
    }

    // Recursos externos (CDN): tenta rede, usa cache se falhar, não bloqueia SW
    if (url.origin !== self.location.origin) {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    const cache = await caches.open(CACHE_VERSION);
                    cache.put(request, response.clone()).catch(() => {});
                }
                return response;
            } catch {
                const cached = await caches.match(request);
                return cached || new Response('', { status: 503 });
            }
        })());
        return;
    }

    if (request.mode === 'navigate' || /\.(?:html|js|css)$/i.test(url.pathname)) {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok && url.origin === self.location.origin) {
                    const cache = await caches.open(CACHE_VERSION);
                    cache.put(request, response.clone());
                }
                return response;
            } catch {
                return await caches.match(request) || await caches.match('/dashboard-improved.html');
            }
        })());
        return;
    }

    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) {
            event.waitUntil(fetch(request).then(response => {
                if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
            }).catch(() => {}));
            return cached;
        }

        try {
            const response = await fetch(request);
            if (response.ok && url.origin === self.location.origin) {
                const cache = await caches.open(CACHE_VERSION);
                cache.put(request, response.clone());
            }
            return response;
        } catch {
            if (request.mode === 'navigate') {
                return caches.match('/dashboard-improved.html') || caches.match('/login.html');
            }
            throw new Error('offline');
        }
    })());
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/dashboard-improved.html';

    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const dashboard = windows.find(client => client.url.includes('/dashboard-improved.html'));
        if (dashboard) return dashboard.focus();
        return self.clients.openWindow(targetUrl);
    })());
});

self.addEventListener('push', event => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { title: 'Nythar', body: event.data?.text() || 'Nova atualização recebida.' };
    }

    const title = payload.title || payload.Title || 'Nythar';
    const body = payload.body || payload.Message || payload.message || 'Nova atualização recebida.';
    event.waitUntil(self.registration.showNotification(title, {
        body,
        icon: '/assets/pwa-192.png',
        badge: '/assets/pwa-192.png',
        tag: payload.tag || payload.eventKey || payload.id || 'nythar-push',
        renotify: true,
        data: { url: '/dashboard-improved.html', payload }
    }));
});

self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
