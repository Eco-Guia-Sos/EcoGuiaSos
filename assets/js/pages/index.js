import { setupNavbar, setupAuthObserver, sanitize } from '../ui-utils.js';
import { supabase, supabaseUrl, supabaseKey } from '../supabase.js';
import { setupFAB } from '../components/fab-menu.js';
import { setupCalendar } from '../calendar-logic.js';

let todosLosProyectos = [];
let filtroActual = 'evento';
let subFiltroActual = 'all';
let proximidadActiva = false;
let userCoords = null;
const RADIO_KM = 100;

// Cache de sesión y perfil del usuario (para no consultarlos repetidamente)
let _cachedSession = null;
let _cachedProfile = null;
async function getCachedProfile() {
    if (_cachedProfile) return _cachedProfile;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        _cachedSession = session;
        if (!session) return null;
        
        // Usar fetchRawSupabaseTable para evitar problemas con el cliente de Supabase
        const profileData = await fetchRawSupabaseTable(`perfiles?id=eq.${session.user.id}&select=rol,imagen,nombre_completo`);
        const profile = profileData && profileData.length > 0 ? profileData[0] : null;
        
        _cachedProfile = profile ? { ...profile, id: session.user.id } : null;
    } catch (e) { 
        // Silenciar advertencias inofensivas de locks inter-pestañas de Supabase
        if (e?.name !== 'AbortError' && !e?.message?.includes('Lock') && !e?.message?.includes('steal')) {
            console.warn('[Index] Error obteniendo perfil:', e);
        }
        _cachedProfile = null; 
    }
    return _cachedProfile;
}

// Paginación
let maxRendered = window.innerWidth <= 600 ? 4 : 9; // 4 en móvil, 9 en escritorio (3x3)
let currentPage = 1;

// Ajustar maxRendered si cambian de tamaño (opcional pero recomendado)
window.addEventListener('resize', () => {
    const newMax = window.innerWidth <= 600 ? 4 : 9;
    if (newMax !== maxRendered) {
        maxRendered = newMax;
        filtrarYRenderizar();
    }
});

// Estado de Búsqueda Avanzada
let filtrosAvanzados = {
    categoria: 'all',
    ubicacion: 'all', 
    distancia: 100,
    fechas: 'all', 
    fechaExacta: null,
    soloGratis: false,
    ninos: false,
    mascotas: false
};

let _indexInitialized = false;
function initIndex() {
    if (_indexInitialized) return;
    _indexInitialized = true;
    console.log('[Inicio] 🚀 Inicializando página...');
    
    // 1. Critical Initialization (Auth/Navbar first)
    try {
        setupNavbar();
        setupAuthObserver();

        console.log('[Inicio] 🟢 Cargando datos y perfil (Mapa)...');
        cargarDatosDeSupabase();
        getCachedProfile().then(p => console.log('[Inicio] 👤 Perfil para mapa listo:', p?.rol || 'visitante')); 

        // setupAuthObserver en ui-utils.js ya maneja la sesión y la campanita.
        // Escuchamos activamente el cambio de estado para disparar el GPS al entrar
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                if (session) {
                    console.log(`[Auth] Evento ${event} detectado. Iniciando radar GPS...`);
                    // Un pequeño delay para asegurar que el perfil en caché esté listo
                    setTimeout(() => obtenerUbicacionSilenciosa(), 1000);
                }
            }
        });

    } catch (e) {
        console.error("EcoGuía: Error inicializando Navbar/Auth:", e);
    }

    // 2. Secondary Components
    try {
        setupFAB();
        setupHomeMapaToggle();
        setupHomeCalendarioToggle();
        setupAdvancedSearch();
    } catch (e) {
        console.error("EcoGuía: Error inicializando componentes secundarios:", e);
    }
    
    // 3. System Loaders
    const loader = document.getElementById('loader');
    if (loader) {
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }, 800);
    }

    // 4. Background Processes
    iniciarParticulas();
    iniciarCarrusel();
    
    // cargarDatosDeSupabase(); // Se movió al observador de Auth arriba

    setupMobileTooltips();
    // iniciarMiniMapa(); // M4: Removido — ahora es lazy al presionar el botón

    // 5. Global Search Support
    const buscadorInput = document.getElementById('buscador-input');
    if (buscadorInput) {
        buscadorInput.addEventListener('input', filtrarYRenderizar);
    }

    const toggleSwitch = document.querySelector('.toggle-switch');
    const labels = document.querySelectorAll('.toggle-label');

    if (toggleSwitch && labels.length >= 2) {
        toggleSwitch.addEventListener('click', () => {
            toggleSwitch.classList.toggle('active');
            maxRendered = 9; // Reiniciar paginación al cambiar tab
            if (toggleSwitch.classList.contains('active')) {
                labels[0].classList.remove('active'); // Eventos OFF
                labels[1].classList.add('active');    // Lugares ON
                filtroActual = 'lugar';
            } else {
                labels[0].classList.add('active');    // Eventos ON
                labels[1].classList.remove('active'); // Lugares OFF
                filtroActual = 'evento';
            }
            filtrarYRenderizar();
        });

        labels.forEach(label => {
            label.addEventListener('click', () => {
                const target = label.getAttribute('data-filter');
                if (target !== filtroActual) toggleSwitch.click();
            });
        });
    }

    /* Los filtros de categoría ahora se gestionan dentro de setupAdvancedSearch */

    // El botón cerca de mí fue movido al panel de búsqueda avanzada.
    
    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker registrado:', reg.scope))
                .catch(err => console.log('Error al registrar Service Worker:', err));
        });
    }
}

async function fetchRawSupabaseTable(table) {
    // Buscar el token en localStorage para saltarnos el "bloqueo" de supabase-js
    let token = null;
    try {
        let projectId = '';
        if (supabaseUrl) projectId = new URL(supabaseUrl).hostname.split('.')[0];
        
        const rawStorage = localStorage.getItem('ecoguia-auth-token') 
                        || localStorage.getItem(`sb-${projectId}-auth-token`);
                        
        if (rawStorage) {
            token = JSON.parse(rawStorage).access_token;
        }
    } catch(e) { console.warn('[Datos] Error extrayendo token crudo:', e); }

    const headers = {
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, { 
        headers,
        cache: 'no-store' // Previene fuertemente que el navegador devuelva respuestas viejas tras actualizaciones
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
}

async function cargarDatosDeSupabase() {
    console.log('[Datos] 🔄 Iniciando carga desde Supabase (Petición directa/Fetch)...');
    
    try {
        const eventosData = await fetchRawSupabaseTable('eventos?select=*');
        console.log('[Datos] 🟢 Eventos respondieron (Directo)');

        const lugaresData = await fetchRawSupabaseTable('lugares?select=*,eventos(count)');
        console.log('[Datos] 🟢 Lugares respondieron (Directo)');

        // --- NUEVO: Cargar perfiles por separado para evitar errores de join ---
        let profilesMap = {};
        const allRows = [...(eventosData || []), ...(lugaresData || [])];
        const ownerIds = [...new Set(allRows.map(r => r.owner_id).filter(id => id))];

        if (ownerIds.length > 0) {
            try {
                // Filtramos perfiles por los IDs que necesitamos
                const filter = `id=in.(${ownerIds.join(',')})`;
                const pData = await fetchRawSupabaseTable(`perfiles?${filter}&select=id,nombre_completo`);
                if (pData) {
                    pData.forEach(p => { profilesMap[p.id] = p.nombre_completo; });
                }
            } catch (pErr) {
                console.warn('[Datos] ⚠️ No se pudieron obtener los nombres de los actores:', pErr);
            }
        }

        const eventos = (eventosData || []).map(row => {
            const p = parseSupabaseRow(row, 'evento');
            if (p && row.owner_id) p.actor_nombre = profilesMap[row.owner_id] || null;
            return p;
        }).filter(x => x);

        const lugares = (lugaresData || []).map(row => {
            const p = parseSupabaseRow(row, 'lugar');
            if (p && row.owner_id) p.actor_nombre = profilesMap[row.owner_id] || null;
            return p;
        }).filter(x => x);

        console.log('[Datos] ✅ Parseados — Eventos:', eventos.length, '| Lugares:', lugares.length);

        todosLosProyectos = [...eventos, ...lugares];
        setupCalendar(todosLosProyectos); // Inicializar calendario con los datos
        filtrarYRenderizar();
    } catch (error) {
        console.error("[Datos] ❌ Error cargando datos desde Supabase (Fetch directo):", error);
        // Intentar limpiar cargadores si falla
        const gL = document.getElementById('grid-lugares');
        const gE = document.getElementById('grid-eventos');
        if(gL) gL.innerHTML = '<p class="error">Error al conectar con la base de datos.</p>';
        if(gE) gE.innerHTML = '<p class="error">Error al conectar con la base de datos.</p>';
    }
}

// Fallback removed as requested by user to start real content dev

function parseSupabaseRow(row, tipo) {
    if (!row.nombre) return null;
    
    let conteo = 0;
    if (tipo === 'lugar' && row.eventos && row.eventos.length > 0) {
        conteo = row.eventos[0].count || 0;
    }
    
    let firstImg = row.imagen_url || row.imagen;
    if (row.imagenes && Array.isArray(row.imagenes) && row.imagenes.length > 0) {
        firstImg = row.imagenes[0];
    }

    return {
        id: row.id,
        nombre: row.nombre,
        categoria: row.categoria || 'General',
        ubicacion: row.ubicacion || 'CDMX',
        mapa_url: row.mapa_url || null,
        imagen: firstImg || '/assets/img/kpop.webp',
        descripcion: row.descripcion || 'Sin descripción.',
        tipo: tipo,
        coordenadas: (row.lat && row.lng) ? { lat: row.lat, lng: row.lng } : null,
        conteo_eventos: conteo,
        fecha: row.fecha_inicio || row.fecha || row.created_at, // Fallback para que fechas tengan algo
        es_gratuito: row.es_gratuito,
        pet_friendly: row.pet_friendly,
        apto_ninos: row.apto_ninos,
        owner_id: row.owner_id
    };
}

let miniMapHandle = null;
let currentMarkers = [];

async function iniciarMiniMapa() {
    const mapContainer = document.getElementById('mini-map');
    if (!mapContainer) return;

    try {
        miniMapHandle = new maplibregl.Map({
            container: 'mini-map',
            style: {
                version: 8,
                sources: {
                    'osm': {
                        type: 'raster',
                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '&copy; OpenStreetMap Contributors'
                    }
                },
                layers: [{
                    id: 'osm',
                    type: 'raster',
                    source: 'osm'
                }]
            },
            center: [-99.1332, 19.4326], // CDMX
            zoom: 10,
            scrollZoom: false
        });
        miniMapHandle.addControl(new maplibregl.NavigationControl(), 'top-right');
        
        // M4: Forzar resize inicial cuando cargue el estilo
        miniMapHandle.on('load', () => {
            miniMapHandle.resize();
        });
        
        // Añadir Botón de Relocalización Manual
        const relocateBtn = document.createElement('button');
        relocateBtn.className = 'map-relocate-btn';
        relocateBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
        relocateBtn.title = 'Refrescar mi ubicación';
        relocateBtn.onclick = (e) => {
            e.stopPropagation();
            relocateBtn.classList.add('loading');
            activarProximidad().finally(() => {
                setTimeout(() => relocateBtn.classList.remove('loading'), 1000);
            });
        };
        mapContainer.appendChild(relocateBtn);

        const checkData = setInterval(() => {
            if (todosLosProyectos.length > 0) {
                clearInterval(checkData);
                actualizarMiniMapaConFiltros(todosLosProyectos.filter(p => p.tipo === filtroActual));
            }
        }, 500);
    } catch (err) {
        console.error("Error initializing mini-map:", err);
    }
}

function actualizarMiniMapaConFiltros(datos) {
    if (!miniMapHandle) return;
    currentMarkers.forEach(m => m.remove());
    currentMarkers = [];
    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;

    // 1. Marcador de Usuario ("Tú" - Estilo Premium)
    if (userCoords) {
        const el = document.createElement('div');
        el.className = 'user-marker-premium';
        
        // Intentar usar el avatar del perfil real
        let avatarSrc = '/assets/img/kpop.webp';
        if (_cachedProfile && _cachedProfile.imagen) {
            avatarSrc = _cachedProfile.imagen;
        }

        el.innerHTML = `
            <div class="user-marker-avatar">
                <img src="${avatarSrc}" alt="Tú" onerror="this.src='/assets/img/kpop.webp'">
            </div>
            <div class="user-marker-label">
                Tú <span class="status">Ahora</span>
            </div>
        `;
        
        const popupHtml = `
            <div style="text-align: center; color: #72B04D; padding: 8px;">
                <h4 style="margin: 0; font-weight: 800; font-size: 16px; letter-spacing: -0.5px;">📍 Tu ubicación</h4>
                <p style="margin: 5px 0 0; font-size: 12px; color: #444; font-weight: 600;">Estás explorando cerca de aquí</p>
            </div>
        `;

        const userMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([userCoords.lng, userCoords.lat])
            .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(popupHtml))
            .addTo(miniMapHandle);
            
        currentMarkers.push(userMarker);
        bounds.extend([userCoords.lng, userCoords.lat]);
        hasCoords = true;
    }

    // 2. Lógica de Agrupamiento (Clustering) Simplificada
    // Agrupamos puntos que estén a menos de ~0.001 grados (~100m) de distancia
    const clusters = [];
    const CLUSTER_THRESHOLD = 0.002; 

    datos.forEach(p => {
        if (!p.coordenadas || !p.coordenadas.lat || !p.coordenadas.lng) return;
        
        let foundCluster = clusters.find(c => {
            const dLat = Math.abs(c.lat - p.coordenadas.lat);
            const dLng = Math.abs(c.lng - p.coordenadas.lng);
            return dLat < CLUSTER_THRESHOLD && dLng < CLUSTER_THRESHOLD;
        });

        if (foundCluster) {
            foundCluster.items.push(p);
        } else {
            clusters.push({
                lat: p.coordenadas.lat,
                lng: p.coordenadas.lng,
                items: [p]
            });
        }
    });

    // 3. Renderizar Clusters o Puntos Individuales
    clusters.forEach(c => {
        const count = c.items.length;
        const p = c.items[0]; // Primer item para la imagen
        const el = document.createElement('div');

        if (count > 1) {
            // Es un grupo (Cluster) con imagen + número
            el.className = `map-cluster-marker type-${p.tipo}`;
            el.innerHTML = `
                <img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='/assets/img/kpop.webp'">
                <div class="cluster-count-badge">${count > 2 ? '2+' : count}</div>
            `;
            
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const currentZoom = miniMapHandle.getZoom();
                
                // Si el zoom ya es alto, abrir el primer evento del grupo
                if (currentZoom >= 15) {
                    abrirPanelDetalleHome(p);
                } else {
                    // Si no, hacer zoom para expandir
                    miniMapHandle.flyTo({ 
                        center: [c.lng, c.lat], 
                        zoom: currentZoom + 3,
                        essential: true 
                    });
                }
            });
        } else {
            // Es un punto único
            el.className = `map-card-marker type-${p.tipo}`;
            el.innerHTML = `<img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='/assets/img/kpop.webp'">`;
            
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                abrirPanelDetalleHome(p);
            });
        }

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([c.lng, c.lat])
            .addTo(miniMapHandle);

        currentMarkers.push(marker);
        bounds.extend([c.lng, c.lat]);
        hasCoords = true;
    });

    // 4. Centrado Inteligente
    if (proximidadActiva && userCoords) {
        // Si estamos buscando "Cerca de mí", forzar centrado en el usuario
        miniMapHandle.flyTo({ 
            center: [userCoords.lng, userCoords.lat], 
            zoom: 14,
            essential: true 
        });
    } else if (hasCoords) {
        // Si no, ajustar vista para ver todos los puntos
        miniMapHandle.fitBounds(bounds, { padding: 80, maxZoom: 15 });
    }
}

function abrirPanelDetalleHome(p) {
    const panel = document.getElementById('home-event-detail-panel');
    if(panel) {
        document.getElementById('home-side-panel-img').src = p.imagen || '/assets/img/kpop.webp';
        document.getElementById('home-side-panel-badge').innerText = p.tipo.toUpperCase();
        document.getElementById('home-side-panel-title').innerText = p.nombre;
        document.getElementById('home-side-panel-location').innerText = p.ubicacion || 'Ubicación seleccionada';
        const detailPage = p.tipo === 'evento' ? 'eventos.html' : 'lugares.html';
        document.getElementById('home-side-panel-link').href = `/pages/${detailPage}?id=${p.id}`;
        panel.classList.remove('hidden');
        
        miniMapHandle.flyTo({
            center: [p.coordenadas.lng, p.coordenadas.lat],
            zoom: 16,
            essential: true
        });

        // --- SINCRONIZACIÓN CON EL SLIDER ---
        const allCards = document.querySelectorAll('.nearby-slider-card');
        allCards.forEach(c => c.classList.remove('active'));

        const targetCard = document.querySelector(`.nearby-slider-card[data-id="${p.id}"]`);
        if (targetCard) {
            targetCard.classList.add('active');
            // Auto-scroll suave de la tarjeta seleccionada
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
}

function filtrarYRenderizar() {
    const buscadorInput = document.getElementById('buscador-input');
    const textoBuscador = buscadorInput ? buscadorInput.value.toLowerCase() : '';
    let datosFiltrados = todosLosProyectos.filter(p => p.tipo === filtroActual);

    const catFinal = filtrosAvanzados.categoria;
    if (catFinal !== 'all') {
        datosFiltrados = datosFiltrados.filter(p => p.categoria === catFinal);
    }

    if (textoBuscador) {
        datosFiltrados = datosFiltrados.filter(p =>
            p.nombre.toLowerCase().includes(textoBuscador) ||
            p.categoria.toLowerCase().includes(textoBuscador) ||
            p.ubicacion.toLowerCase().includes(textoBuscador)
        );
    }

    // Filtro por Proximidad (GPS + Slider)
    if (proximidadActiva && userCoords) {
        datosFiltrados = datosFiltrados.filter(p => {
            if (!p.coordenadas || !p.coordenadas.lat || !p.coordenadas.lng) {
                p.distancia_calculada = Infinity; // Distancia desconocida
                return true; // No lo ocultamos, lo mostramos al final
            }
            const dist = calcularDistancia(userCoords.lat, userCoords.lng, p.coordenadas.lat, p.coordenadas.lng);
            p.distancia_calculada = dist;
            // Si tiene coordenadas, validamos la distancia. Si no, lo dejamos pasar.
            return dist <= filtrosAvanzados.distancia;
        });
        // Ordenar por distancia (los Infinity irán al final)
        datosFiltrados.sort((a, b) => a.distancia_calculada - b.distancia_calculada);
    }

    // Filtro por Fecha (Píldoras y Calendario)
    if (filtrosAvanzados.fechaExacta) {
        datosFiltrados = datosFiltrados.filter(p => p.fecha === filtrosAvanzados.fechaExacta);
    } else if (filtrosAvanzados.fechas !== 'all') {
        const hoy = new Date();
        datosFiltrados = datosFiltrados.filter(p => {
            if (!p.fecha) return true; // Si no tiene fecha, mostrar siempre (parques, etc)
            const fechaE = new Date(p.fecha);
            if (filtrosAvanzados.fechas === 'today') return fechaE.toDateString() === hoy.toDateString();
            if (filtrosAvanzados.fechas === 'tomorrow') {
                const manana = new Date(hoy);
                manana.setDate(hoy.getDate() + 1);
                return fechaE.toDateString() === manana.toDateString();
            }
            if (filtrosAvanzados.fechas === 'weekend') {
                const dia = fechaE.getDay();
                return dia === 0 || dia === 6; // Domingo o Sábado
            }
            return true;
        });
    }

    // Filtros de Audiencia y Preferencias
    if (filtrosAvanzados.soloGratis) {
        datosFiltrados = datosFiltrados.filter(p => p.es_gratuito === true || p.es_gratuito === undefined);
    }
    if (filtrosAvanzados.mascotas) {
        datosFiltrados = datosFiltrados.filter(p => p.pet_friendly === true);
    }
    if (filtrosAvanzados.ninos) {
        datosFiltrados = datosFiltrados.filter(p => p.apto_ninos === true);
    }

    // Aplicar paginación (Slicing por página)
    const totalResultados = datosFiltrados.length;
    const totalPaginas = Math.ceil(totalResultados / maxRendered);
    
    // Asegurar que la página actual no exceda el total si los filtros cambian
    if (currentPage > totalPaginas && totalPaginas > 0) currentPage = totalPaginas;

    const inicio = (currentPage - 1) * maxRendered;
    const fin = inicio + maxRendered;
    const datosPaginados = datosFiltrados.slice(inicio, fin);

    renderCards(datosPaginados);
    actualizarMiniMapaConFiltros(datosFiltrados); // El mapa muestra todos
    renderNearbySlider(datosFiltrados); // Carrusel de navegación por mapa
    renderPagination(totalResultados); 
}

/**
 * Renderiza los botones de paginación numérica estilo Cartelera CDMX.
 */
function renderPagination(totalResultados) {
    const contenedor = document.getElementById('pagination-container');
    if (!contenedor) return;

    const totalPaginas = Math.ceil(totalResultados / maxRendered) || 1;
    
    let html = '';

    // Botón Anterior
    html += `
        <button class="pagination-btn pagination-arrow ${currentPage === 1 ? 'disabled' : ''}" 
                onclick="cambiarPagina(${currentPage - 1})">
            <i class="fa-solid fa-chevron-left"></i> <span>Anterior</span>
        </button>
    `;

    // Números de Página
    for (let i = 1; i <= totalPaginas; i++) {
        // Lógica para no mostrar demasiados números si hay muchas páginas
        if (totalPaginas > 5) {
            if (i > 1 && i < totalPaginas && Math.abs(i - currentPage) > 1) {
                if (i === 2 || i === totalPaginas - 1) html += '<span class="pagination-dots">...</span>';
                continue;
            }
        }

        html += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}" 
                    onclick="cambiarPagina(${i})">
                ${i}
            </button>
        `;
    }

    // Botón Siguiente
    html += `
        <button class="pagination-btn pagination-arrow ${currentPage === totalPaginas ? 'disabled' : ''}" 
                onclick="cambiarPagina(${currentPage + 1})">
            <span>Siguiente</span> <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    contenedor.innerHTML = html;
}

// Función global para que funcione con onclick
window.cambiarPagina = function(num) {
    currentPage = num;
    filtrarYRenderizar();
    // Scroll suave hacia arriba de la sección
    document.getElementById('contenedor-tarjetas').scrollIntoView({ behavior: 'smooth', block: 'start' });
};


/**
 * Habilita el desplazamiento por arrastre (drag-to-scroll) para el slider en desktop.
 */
function habilitarDragScroll(el) {
    let isDown = false;
    let startX;
    let scrollLeft;
    let isDragging = false;

    el.addEventListener('mousedown', (e) => {
        isDown = true;
        isDragging = false;
        el.classList.add('active');
        const rect = el.getBoundingClientRect();
        startX = e.clientX - rect.left;
        scrollLeft = el.scrollLeft;
    });

    el.addEventListener('mouseleave', () => {
        isDown = false;
        el.classList.remove('active');
    });

    el.addEventListener('mouseup', () => {
        isDown = false;
        el.classList.remove('active');
    });

    el.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const walk = (x - startX) * 2;
        
        if (Math.abs(x - startX) > 5) {
            isDragging = true;
        }

        if (isDragging) {
            e.preventDefault();
            el.scrollLeft = scrollLeft - walk;
        }
    });

    // Función auxiliar para saber si estamos arrastrando
    el.isDragging = () => isDragging;
}

/**
 * Renderiza el carrusel horizontal debajo del mapa para navegación rápida.
 */
function renderNearbySlider(items) {
    const slider = document.getElementById('nearby-events-slider');
    if (!slider) return;

    slider.innerHTML = '';

    // Si no hay ítems o no hay coordenadas de usuario, no mostrar nada
    if (!items || items.length === 0) {
        slider.innerHTML = '<p style="color: #666; font-size: 0.8rem; padding: 20px;">No hay eventos cercanos para mostrar en el radar.</p>';
        return;
    }

    items.forEach(p => {
        const card = document.createElement('div');
        card.className = 'nearby-slider-card';
        card.setAttribute('data-id', p.id); // Guardar ID para sincronización
        
        // Distancia depurada y en color amarillo
        const distText = (p.distancia_calculada && isFinite(p.distancia_calculada)) ? `a ${p.distancia_calculada.toFixed(1)} km` : '';
        const distHtml = distText ? `<div class="nearby-card-dist" style="color:#fde047; font-size:0.75rem; font-weight:700; margin-top:2px;"><i class="fa-solid fa-route"></i> ${distText}</div>` : '';
        
        // Fecha en la esquina superior izquierda flotando elegantemente
        let dateSmallBadge = '';
        const fTarget = p.fecha || p.fecha_inicio;
        if (fTarget) {
            try {
                const d = new Date(fTarget);
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                dateSmallBadge = `<span style="position:absolute; top:4px; left:4px; background:rgba(15,20,25,0.85); color:#5bc2f7; font-size:0.65rem; font-weight:700; padding:2px 6px; border-radius:10px; border:1px solid rgba(91,194,247,0.3); z-index:2;"><i class="fa-regular fa-calendar"></i> ${d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}</span>`;
            } catch(e){}
        }

        card.innerHTML = `
            <div class="nearby-card-img" style="position:relative;">
                <img src="${p.imagen || '/assets/img/kpop.webp'}" alt="${sanitize(p.nombre)}" onerror="this.src='/assets/img/kpop.webp'">
                ${dateSmallBadge}
            </div>
            <div class="nearby-card-info">
                <div class="nearby-card-title" style="font-weight:700; line-height:1.1;">${sanitize(p.nombre)}</div>
                ${distHtml}
            </div>
        `;

        // Al hacer clic, "volamos" hacia el marcador Y abrimos el panel de detalles
        card.addEventListener('click', (e) => {
            // Solo disparamos el clic si NO estábamos arrastrando el slider
            if (slider.isDragging && slider.isDragging()) return;

            e.stopPropagation();
            if (miniMapHandle && p.coordenadas) {
                // 1. Mover el mapa
                miniMapHandle.flyTo({
                    center: [p.coordenadas.lng, p.coordenadas.lat],
                    zoom: 16,
                    essential: true
                });

                // 2. Abrir el panel de detalles lateral
                abrirPanelDetalleHome(p);
            }
        });

        slider.appendChild(card);
    });

    // Habilitar el arrastre con el mouse
    habilitarDragScroll(slider);
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function abrirMapaAutomaticamente() {
    const wrapper = document.getElementById('mapa-home-wrapper');
    const btn = document.getElementById('btn-toggle-mapa-home');
    if (wrapper && (wrapper.classList.contains('hidden-map') || window.getComputedStyle(wrapper).display === 'none')) {
        wrapper.classList.remove('hidden-map');
        if (btn) btn.innerText = 'Ocultar mapa';
        // Hacer scroll suave hacia el mapa si no es visible
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { if (miniMapHandle) miniMapHandle.resize(); }, 400);
    }
}

async function activarProximidad() {
    if (!navigator.geolocation) return alert("Tu navegador no soporta geolocalización.");
    
    // Auto-abrir mapa al pedir proximidad (Acción Manual)
    abrirMapaAutomaticamente();

    const loader = document.getElementById('loader');
    if (loader) { loader.style.display = 'flex'; loader.style.opacity = '1'; }
    
    console.log('[GPS] Solicitando ubicación precisa...');

    return new Promise((resolve) => {
        console.log('[GPS] Llamando a navigator.geolocation.getCurrentPosition (Manual)...');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('[GPS] ¡getCurrentPosition respondió exitosamente!');
                userCoords = { lat: position.coords.latitude, lng: position.coords.longitude, isGPS: true };
                localStorage.setItem('eco_user_coords', JSON.stringify(userCoords));
                proximidadActiva = true;
                
                if (loader) { loader.style.opacity = '0'; setTimeout(() => { loader.style.display = 'none'; }, 500); }
                
                filtrarYRenderizar();

                // Centrar y Zoom en el usuario (Solo en acción manual)
                if (miniMapHandle) {
                    miniMapHandle.flyTo({
                        center: [userCoords.lng, userCoords.lat],
                        zoom: 14,
                        essential: true
                    });
                }
                resolve(userCoords);
            },
            (error) => {
                console.error("[GPS] Error:", error);
                alert("No pudimos obtener tu ubicación precisa actual. Revisa los permisos de tu navegador o si el tiempo de espera expiró.");
                if (loader) { loader.style.opacity = '0'; setTimeout(() => { loader.style.display = 'none'; }, 500); }
                resolve(null);
            },
            // Aumentamos el timeout a 30s por si el usuario tarda en aceptar el permiso o Windows es lento
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
        );
    });
}

async function obtenerUbicacionSilenciosa() {
    if (!navigator.geolocation) {
        console.warn('[GPS] Geolocation no soportado en este navegador.');
        return;
    }
    
    console.log('[GPS] Solicitando ubicación silenciosa (login)... Llamando a getCurrentPosition...');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            console.log('[GPS] Ubicación silenciosa obtenida con éxito.');
            userCoords = { lat: position.coords.latitude, lng: position.coords.longitude, isGPS: true };
            localStorage.setItem('eco_user_coords', JSON.stringify(userCoords));
            
            // ACTIVAR proximidad por defecto (silencioso, sin mover el scroll/mapa)
            // Lo ponemos al máximo (100km) para que se vean todos los eventos pero con km
            proximidadActiva = true;
            filtrosAvanzados.distancia = 100;
            
            // Sincronizar UI del slider si existe
            const slider = document.getElementById('distance-slider');
            const valLabel = document.getElementById('distance-value');
            if (slider) slider.value = 100;
            if (valLabel) valLabel.innerText = 100;

            console.log('[GPS] Ubicación inicial registrada. Radar activado a 100km.');
            
            // Renderizamos para que aparezcan los km en las tarjetas
            filtrarYRenderizar();
        },
        (error) => {
            console.log("[GPS] Ubicación silenciosa falló o fue denegada:", error);
        },
        // enableHighAccuracy en false para que sea MUY rápido (ideal para el radar de 100km)
        // timeout de 30s para dar tiempo a aceptar el permiso si aparece.
        { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
    );
}

function getNivelClass(categoria) {
    const cat = (categoria || '').toLowerCase();
    const colibri = ['agua', 'cursos', 'ecotecnias', 'lecturas', 'documentales', 'educación', 'naturaleza', 'ecología'];
    const ajolote = ['agentes', 'voluntariados', 'comunidad', 'social', 'convocatorias'];
    const lobo = ['fondos', 'normativa', 'legal', 'estrategia', 'finanzas'];

    if (colibri.some(c => cat.includes(c))) return 'card-colibri';
    if (ajolote.some(c => cat.includes(c))) return 'card-ajolote';
    if (lobo.some(c => cat.includes(c))) return 'card-lobo';
    return 'card-general';
}

function renderCards(data) {
    const contenedor = document.getElementById('contenedor-tarjetas');
    if (!contenedor) return;

    if (data.length === 0) {
        contenedor.innerHTML = '<p class="txt-loading">No se encontraron resultados.</p>';
        return;
    }

    // Generar todo el HTML en memoria primero
    const cardsHtml = data.map(p => {
        const nivelClass = getNivelClass(p.categoria);
        const distLabel = p.distancia_calculada ? `<span class="dist-badge" style="background:rgba(15,20,25,0.9); color:#fde047; border:1px solid rgba(253,224,71,0.4); font-weight:700;"><i class="fa-solid fa-route"></i> a ${p.distancia_calculada.toFixed(1)} km</span>` : '';
        const eventosBadge = (p.tipo === 'lugar') ? `<span class="place-event-badge"><i class="fa-solid fa-calendar-star"></i> ${p.conteo_eventos || 0}</span>` : '';
        const actorBadge = p.actor_nombre ? `<div class="actor-badge" title="Publicado por: ${sanitize(p.actor_nombre)}"><i class="fa-solid fa-user-pen"></i><span>${sanitize(p.actor_nombre)}</span></div>` : '';

        // Formato premium de la fecha debajo del título
        let dateSubtext = '';
        const fTarget = p.fecha || p.fecha_inicio;
        if (fTarget) {
            try {
                const d = new Date(fTarget);
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                const fTxtFull = d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                dateSubtext = `<span class="card-date-sub" style="color:#5bc2f7; font-size:0.8rem; display:block; margin-top:4px; font-weight:600;"><i class="fa-regular fa-calendar" style="margin-right:4px;"></i>${fTxtFull}</span>`;
            } catch(e){}
        }

        // Determinar archivo de detalles correcto
        const detailPage = p.tipo === 'evento' ? 'eventos.html' : 'lugares.html';

        return `
            <article class="card fade-in ${nivelClass}" data-owner="${p.owner_id || ''}" onclick="window.location.href='/pages/${detailPage}?id=${p.id}'" style="cursor: pointer;">
                <div class="card-image">
                    <img src="${p.imagen}" alt="${sanitize(p.nombre)}" onerror="this.src='/assets/img/kpop.webp'">
                    ${distLabel}
                    ${eventosBadge}
                    ${actorBadge}
                    <div class="card-actions-overlay"></div>
                </div>
                <div class="card-content">
                    <div class="card-header"><span class="card-category">${sanitize(p.categoria)}</span></div>
                    <h3 class="card-title" style="margin-bottom:2px;">${sanitize(p.nombre)}</h3>
                    ${dateSubtext}
                </div>
            </article>`;
    }).join('');

    // Insertar una sola vez al DOM (Mucho más rápido)
    contenedor.innerHTML = cardsHtml;
    checkCardPermissions();
}

async function checkCardPermissions() {
    // ✅ Usa el perfil cacheado — no hace consultas extra a Supabase en cada render
    const profile = await getCachedProfile();
    if (!profile) return;
    const isAdmin = profile.rol === 'admin';
    const isActor = profile.rol === 'actor';
    document.querySelectorAll('.card').forEach(card => {
        const ownerId = card.getAttribute('data-owner');
        if (isAdmin || (isActor && ownerId === profile.id)) {
            const overlay = card.querySelector('.card-actions-overlay');
            if (overlay) overlay.innerHTML = `<button class="btn-icon-glass"><i class="fa-solid fa-pen"></i></button>`;
        }
    });
}

function setupHomeMapaToggle() {
    const btn = document.getElementById('btn-toggle-mapa-home');
    const wrapper = document.getElementById('mapa-home-wrapper');
    const closePanelBtn = document.getElementById('close-home-side-panel');

    if (!btn || !wrapper) return;

    btn.addEventListener('click', () => {
        const isHidden = wrapper.classList.contains('hidden-map');
        
        if (isHidden) {
            wrapper.classList.remove('hidden-map');
            btn.innerText = 'Ocultar mapa';

            // M4: Inicialización Lazy
            if (!miniMapHandle) {
                console.log('[Mobile Opt] Inicializando mini-mapa bajo demanda...');
                iniciarMiniMapa();
            } else {
                // Si ya existe, forzamos un resize para que se ajuste al nuevo tamaño del contenedor
                setTimeout(() => {
                    miniMapHandle.resize();
                }, 100);
            }
        } else {
            wrapper.classList.add('hidden-map');
            btn.innerText = 'Ver mapa';
        }
    });

    if (closePanelBtn) {
        closePanelBtn.addEventListener('click', () => {
            document.getElementById('home-event-detail-panel')?.classList.add('hidden');
        });
    }
}

function setupHomeCalendarioToggle() {
    const btn = document.getElementById('btn-toggle-calendario-home');
    const calendarSection = document.getElementById('calendar-section');
    const gridContainer = document.getElementById('contenedor-tarjetas');
    const pagination = document.getElementById('pagination-container');
    const mapWrapper = document.getElementById('mapa-home-wrapper');
    const btnMap = document.getElementById('btn-toggle-mapa-home');

    if (!btn || !calendarSection) return;

    btn.addEventListener('click', () => {
        const isHidden = calendarSection.classList.contains('hidden');
        
        if (isHidden) {
            // Mostrar Calendario, ocultar Grid y Mapa
            calendarSection.classList.remove('hidden');
            if (gridContainer) gridContainer.classList.add('hidden');
            if (pagination) pagination.classList.add('hidden');
            if (mapWrapper) mapWrapper.classList.add('hidden-map');
            
            btn.innerText = 'Ver cuadrícula';
            if (btnMap) btnMap.innerText = 'Ver mapa';
            
            // Scroll al calendario
            calendarSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            // Ocultar Calendario, volver a Grid
            calendarSection.classList.add('hidden');
            if (gridContainer) gridContainer.classList.remove('hidden');
            if (pagination) pagination.classList.remove('hidden');
            
            btn.innerText = 'Ver calendario';
        }
    });
}

function setupMobileTooltips() {
    const toggles = document.querySelectorAll('.mobile-info-toggle');
    toggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const tooltip = toggle.closest('.btn-wrapper')?.querySelector('.tooltip-list');
            if (tooltip) {
                document.querySelectorAll('.tooltip-list').forEach(el => { if (el !== tooltip) el.classList.remove('activo'); });
                tooltip.classList.toggle('activo');
            }
        });
    });
    document.addEventListener('click', () => document.querySelectorAll('.tooltip-list').forEach(el => el.classList.remove('activo')));
}

function iniciarParticulas() {
    if (typeof particlesJS !== 'undefined') {
        particlesJS("particles-main", {
            "particles": {
                "number": { "value": 30, "density": { "enable": true, "value_area": 800 } },
                "color": { "value": ["#72B04D", "#0077b6", "#FFD700", "#E74C3C"] },
                "shape": { "type": "circle" },
                "opacity": { "value": 0.4, "random": true },
                "size": { "value": 6, "random": true },
                "line_linked": { "enable": false }, // Desactivado para fluidez extrema
                "move": { "enable": true, "speed": 2, "direction": "out", "random": true, "out_mode": "out" }
            },
            "interactivity": { "detect_on": "canvas", "events": { "onhover": { "enable": false }, "onclick": { "enable": false }, "resize": true } },
            "retina_detect": true
        });
    }
}

async function iniciarCarrusel() {
    const wrapper = document.getElementById('main-hero-swiper-wrapper');
    if (!wrapper) return;

    let slideCount = 0;

    try {
        // Consultar slides activos usando fetchRawSupabaseTable para evitar bloqueos
        const slides = await fetchRawSupabaseTable('carrusel_principal?select=*&activo=eq.true&order=orden.asc');
        
        if (slides && slides.length > 0) {
            console.log(`[Inicio] 🎞️ Cargando ${slides.length} diapositivas en el carrusel...`);
            slideCount = slides.length;
            wrapper.innerHTML = slides.map(sl => {
                const isClickable = sl.sin_boton && sl.enlace_url;
                const clickAttr = isClickable ? `style="cursor: pointer;" onclick="window.open('${sanitize(sl.enlace_url)}', '_blank')"` : '';
                const overlayPointer = isClickable ? 'style="pointer-events: none;"' : '';
                const btnPointer = isClickable ? 'style="pointer-events: auto;"' : '';

                // Normalización ULTRA-SIMPLE: Si ya es absoluta, usarla. Si no, asumir bucket.
                const resolveImg = (url) => {
                    if (!url) return '';
                    if (url.startsWith('http')) return url;
                    return `${supabaseUrl}/storage/v1/object/public/imagenes-plataforma/${url.startsWith('/') ? url.slice(1) : url}`;
                };

                const imgUrl = resolveImg(sl.imagen_url);
                const pcUrl = resolveImg(sl.imagen_pc_url);
                const tabletUrl = resolveImg(sl.imagen_tablet_url);

                let contentHtml = '';
                if (sl.badge || sl.titulo || sl.subtitulo || (!sl.sin_boton && sl.btn_texto)) {
                    contentHtml = `
                        <div class="slide-content-overlay" ${overlayPointer}>
                            ${sl.badge ? `<span class="slide-badge" style="background: var(--color-colibri);">${sanitize(sl.badge)}</span>` : ''}
                            ${sl.titulo ? `<h2>${sanitize(sl.titulo)}</h2>` : ''}
                            ${sl.subtitulo ? `<p>${sanitize(sl.subtitulo)}</p>` : ''}
                            ${!sl.sin_boton ? `
                                <a ${sl.enlace_url ? `href="${sanitize(sl.enlace_url)}" target="_blank"` : ''} class="btn btn-primary shimmer-btn" ${btnPointer}>
                                    ${sl.btn_texto ? sanitize(sl.btn_texto) : 'Ver Detalles'}
                                </a>
                            ` : ''}
                        </div>
                    `;
                }

                // Renderizado condicional Multi-Formato sin sanitize en los src para evitar roturas
                let mediaHtml = '';
                if (pcUrl || tabletUrl) {
                    mediaHtml = `
                        <picture class="hero-picture-full">
                            ${pcUrl ? `<source srcset="${pcUrl}" media="(min-width: 1024px)">` : ''}
                            ${tabletUrl ? `<source srcset="${tabletUrl}" media="(min-width: 768px)">` : ''}
                            <img src="${imgUrl}" alt="${sanitize(sl.titulo || 'EcoGuía SOS Portada')}" class="slide-bg" loading="lazy" onerror="console.error('[Carrusel] Error crítico:', this.src)">
                        </picture>
                    `;
                } else {
                    mediaHtml = `<img src="${imgUrl}" alt="${sanitize(sl.titulo || 'EcoGuía SOS Portada')}" class="slide-bg" loading="lazy" onerror="console.error('[Carrusel] Error crítico:', this.src)">`;
                }

                return `
                    <div class="swiper-slide custom-slide" ${clickAttr}>
                        ${contentHtml}
                        ${mediaHtml}
                        <div class="swiper-lazy-preloader swiper-lazy-preloader-white"></div>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.warn('[Inicio] No se pudo cargar el carrusel dinámico, usando fallback estático.', err);
    }

    if (typeof Swiper !== 'undefined') {
        new Swiper('.hero-carousel', { 
            loop: slideCount > 1, 
            autoplay: { 
                delay: 6000,
                disableOnInteraction: false 
            }, 
            pagination: { el: '.swiper-pagination', clickable: true }, 
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            effect: 'fade',
            fadeEffect: {
                crossFade: true
            },
            watchSlidesProgress: true,
            observer: true,
            observeParents: true
        });
    }
}

function setupAdvancedSearch() {
    const btnToggle = document.getElementById('btn-busqueda-avanzada');
    const panel = document.getElementById('advanced-search-panel');
    if (!btnToggle || !panel) return;

    btnToggle.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        btnToggle.classList.toggle('active');
        if (!panel.classList.contains('hidden')) {
            actualizarConteoResultados();
        }
    });

    // Categorías (Píldoras)
    panel.querySelectorAll('.cat-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            panel.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtrosAvanzados.categoria = btn.getAttribute('data-cat');
            actualizarConteoResultados();
        });
    });

    // Ubicación (Píldoras + Slider)
    const distanceBox = document.getElementById('distance-slider-container');
    const distanceSlider = document.getElementById('distance-slider');
    const distanceValue = document.getElementById('distance-value');

    panel.querySelectorAll('.loc-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            panel.querySelectorAll('.loc-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const locType = btn.getAttribute('data-loc');
            filtrosAvanzados.ubicacion = locType;
            
            if (locType === 'nearby') {
                distanceBox.classList.remove('hidden');
                activarProximidad();
            } else {
                distanceBox.classList.add('hidden');
                proximidadActiva = false;
                userCoords = null;
            }
            actualizarConteoResultados();
        });
    });

    if (distanceSlider) {
        distanceSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            distanceValue.innerText = val;
            filtrosAvanzados.distancia = parseInt(val);
            actualizarConteoResultados();
        });
    }

    // Fechas (Píldoras + Calendario)
    const calendarInput = document.getElementById('calendar-input');
    panel.querySelectorAll('.date-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            panel.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            filtrosAvanzados.fechas = pill.getAttribute('data-date');
            filtrosAvanzados.fechaExacta = null;
            if (calendarInput) calendarInput.value = '';
            actualizarConteoResultados();
        });
    });

    if (calendarInput) {
        calendarInput.addEventListener('change', (e) => {
            filtrosAvanzados.fechaExacta = e.target.value;
            panel.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
            actualizarConteoResultados();
        });
    }

    // Audiencia (Chips)
    document.getElementById('filter-pets')?.addEventListener('change', (e) => {
        filtrosAvanzados.mascotas = e.target.checked;
        actualizarConteoResultados();
    });
    document.getElementById('filter-kids')?.addEventListener('change', (e) => {
        filtrosAvanzados.ninos = e.target.checked;
        actualizarConteoResultados();
    });
    document.getElementById('switch-gratis')?.addEventListener('change', (e) => {
        filtrosAvanzados.soloGratis = e.target.checked;
        actualizarConteoResultados();
    });

    // Botones de Acción
    document.getElementById('btn-apply-filters')?.addEventListener('click', () => {
        panel.classList.add('hidden');
        btnToggle.classList.remove('active');
        filtrarYRenderizar();
    });

    document.getElementById('btn-reset-filters')?.addEventListener('click', resetFiltros);
}

function actualizarConteoResultados() {
    // Esta función solo cuenta, no renderiza las tarjetas para evitar lag mientras se mueven sliders
    let filtrados = todosLosProyectos.filter(p => p.tipo === filtroActual);
    
    if (filtrosAvanzados.categoria !== 'all') {
        filtrados = filtrados.filter(p => p.categoria === filtrosAvanzados.categoria);
    }

    if (proximidadActiva && userCoords) {
        filtrados = filtrados.filter(p => {
            if (!p.coordenadas || !p.coordenadas.lat || !p.coordenadas.lng) return false;
            const dist = calcularDistancia(userCoords.lat, userCoords.lng, p.coordenadas.lat, p.coordenadas.lng);
            return dist <= filtrosAvanzados.distancia;
        });
    }

    // Fechas
    if (filtrosAvanzados.fechaExacta) {
        filtrados = filtrados.filter(p => p.fecha === filtrosAvanzados.fechaExacta);
    } else if (filtrosAvanzados.fechas !== 'all') {
        const hoy = new Date();
        filtrados = filtrados.filter(p => {
            if (!p.fecha) return true;
            const fechaE = new Date(p.fecha);
            if (filtrosAvanzados.fechas === 'today') return fechaE.toDateString() === hoy.toDateString();
            if (filtrosAvanzados.fechas === 'tomorrow') {
                const manana = new Date(hoy);
                manana.setDate(hoy.getDate() + 1);
                return fechaE.toDateString() === manana.toDateString();
            }
            if (filtrosAvanzados.fechas === 'weekend') {
                const dia = fechaE.getDay();
                return dia === 0 || dia === 6;
            }
            return true;
        });
    }

    // Audiencia / Preferencias
    if (filtrosAvanzados.soloGratis) {
        filtrados = filtrados.filter(p => p.es_gratuito === true || p.es_gratuito === undefined);
    }
    if (filtrosAvanzados.mascotas) {
        filtrados = filtrados.filter(p => p.pet_friendly === true);
    }
    if (filtrosAvanzados.ninos) {
        filtrados = filtrados.filter(p => p.apto_ninos === true);
    }

    const countSpan = document.getElementById('results-count');
    if (countSpan) countSpan.innerText = filtrados.length;
}

function resetFiltros() {
    filtrosAvanzados = { 
        categoria: 'all', ubicacion: 'all', distancia: 10, 
        fechas: 'all', fechaExacta: null, soloGratis: false, 
        ninos: false, mascotas: false 
    };
    
    const panel = document.getElementById('advanced-search-panel');
    if (panel) {
        panel.querySelectorAll('.cat-pill, .loc-pill, .date-pill').forEach(b => {
            b.classList.remove('active');
            if (b.getAttribute('data-cat') === 'all' || b.getAttribute('data-loc') === 'all' || b.getAttribute('data-date') === 'all') {
                b.classList.add('active');
            }
        });
        document.getElementById('distance-slider-container')?.classList.add('hidden');
        document.getElementById('calendar-input').value = '';
        document.getElementById('filter-pets').checked = false;
        document.getElementById('filter-kids').checked = false;
        document.getElementById('switch-gratis').checked = false;
    }
    
    proximidadActiva = false;
    userCoords = null;
    maxRendered = 9;
    filtrarYRenderizar();
}

// Initialization with safe readyState check
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIndex);
} else {
    initIndex();
}
