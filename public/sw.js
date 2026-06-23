const CACHE_NAME = 'ecoguiasos-v13';

// URLs que NO deben ser interceptadas por el SW (APIs dinámicas y recursos externos CDN/imágenes/fuentes/CSP)
const BYPASS_PATTERNS = [
    'supabase.co',           // Supabase API - AUTH y DB
    'googleapis.com',        // Google Maps / Gemini / Fonts
    'maps.gstatic.com',      // Google Maps assets
    'fonts.gstatic.com',     // Google Fonts files
    'fonts.googleapis.com',  // Google Fonts CSS
    'unpkg.com',             // CDN dinámico
    'cdn.jsdelivr.net',      // CDN dinámico
    'cdnjs.cloudflare.com',  // Font Awesome / CDNs
    'unsplash.com',          // Unsplash Images
    'cloudflareinsights.com',// Cloudflare Analytics
    'wa.me',                 // WhatsApp
    'tile.openstreetmap.org', // OpenStreetMap Tiles
    'basemaps.cartocdn.com', // CartoDB Tiles
    'server.arcgisonline.com', // ArcGIS Tiles
    'gofundme.com',          // GoFundMe Images (evita error CSP connect-src)
    'cloudfront.net',        // CloudFront CDN
];

// Recursos estáticos locales para cachear
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/assets/img/logo-navbar.webp',
    '/assets/img/logo-carga.webp',
    '/logo-app.webp'
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

// Forzar activación inmediata al recibir mensaje
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
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
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;
                    return new Response('Recurso no disponible offline', { status: 404, statusText: 'Offline' });
                });
            })
    );
});
