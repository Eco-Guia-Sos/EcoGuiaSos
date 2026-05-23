const CACHE_NAME = 'ecoguiasos-v10';

// URLs que NO deben ser interceptadas por el SW (APIs dinámicas)
const BYPASS_PATTERNS = [
    'supabase.co',           // Supabase API - AUTH y DB
    'googleapis.com',        // Google Maps / Gemini
    'maps.gstatic.com',      // Google Maps assets
    'unpkg.com',             // CDN dinámico
    'cdn.jsdelivr.net',      // CDN dinámico
    'wa.me',                 // WhatsApp
    'tile.openstreetmap.org', // OpenStreetMap Tiles
    'basemaps.cartocdn.com', // CartoDB Tiles
    'server.arcgisonline.com', // ArcGIS Tiles
];

// Recursos estáticos locales para cachear
const STATIC_ASSETS = [
    './',
    './index.html',
    './assets/css/global.css',
    './assets/css/style.css',
    './assets/img/logo-navbar.webp',
    './assets/img/logo-carga.webp',
    './assets/img/logo-app.webp',
    './assets/img/carrusel-hero.webp',
];

// ==========================================
// INSTALL: Pre-cachear recursos estáticos
// ==========================================
self.addEventListener('install', event => {
    self.skipWaiting(); // Activar inmediatamente sin esperar
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Intentamos cachear assets, ignorando errores individuales
            return Promise.allSettled(
                STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
            );
        })
    );
});

// ==========================================
// ACTIVATE: Limpiar cachés viejas
// ==========================================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim()) // Tomar control inmediato
    );
});

// ==========================================
// FETCH: Estrategia inteligente por tipo
// ==========================================
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // 1. IGNORAR peticiones no-HTTP (chrome-extension, etc.)
    if (!url.startsWith('http')) return;

    // 2. IGNORAR todas las APIs externas (Supabase, Google, CDNs)
    const isBypass = BYPASS_PATTERNS.some(pattern => url.includes(pattern));
    if (isBypass) return; // Dejar pasar directamente al navegador

    // 3. IGNORAR peticiones POST/PUT/DELETE (siempre van a red)
    if (event.request.method !== 'GET') return;

    // 4. Para recursos locales: Network-First con fallback a caché
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Solo cachear respuestas exitosas de origen propio
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Sin red: buscar en caché (modo offline)
                return caches.match(event.request);
            })
    );
});
