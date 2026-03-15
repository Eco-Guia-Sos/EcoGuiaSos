const CACHE_NAME = 'ecoguiasos-v2';
const urlsToCache = [
    './',
    './index.html',
    './Efectos.html',
    './pages/nosotros.html',
    './assets/css/global.css',
    './assets/css/style.css',
    './assets/css/nosotros.css',
    './assets/js/script.js',
    './assets/gif/EGSlg.webp'
];

// Instalar el Service Worker y almacenar en caché los recursos básicos
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Archivos cacheados exitosamente');
                return cache.addAll(urlsToCache);
            })
    );
});

// Interceptar las peticiones usando "Network First, falling back to cache"
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Si hay red, actualizamos el caché de la petición y devolvemos la respuesta de red
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fallback: Si no hay red (offline), buscar en el caché
                return caches.match(event.request);
            })
    );
});

// Actualizar el caché si hay versiones nuevas
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName); // Borrar caché antigua
                    }
                })
            );
        })
    );
});
