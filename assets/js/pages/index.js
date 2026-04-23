import { setupNavbar, setupAuthObserver, sanitize } from '../ui-utils.js';
import { supabase, supabaseUrl, supabaseKey } from '../supabase.js';
import { setupFAB } from '../components/fab-menu.js';

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
        const { data: profile } = await supabase.from('perfiles').select('rol, imagen, nombre_completo').eq('id', session.user.id).single();
        _cachedProfile = profile ? { ...profile, id: session.user.id } : null;
    } catch (e) { _cachedProfile = null; }
    return _cachedProfile;
}

// Paginación
let maxRendered = 9;

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

function initIndex() {
    console.log('[Inicio] 🚀 Inicializando página...');
    
    // 1. Critical Initialization (Auth/Navbar first)
    try {
        setupNavbar();
        setupAuthObserver();

        // ✅ OPTIMIZACIÓN: Cargar datos inmediatamente sin esperar Auth.
        cargarDatosDeSupabase();
        getCachedProfile(); // Pre-cargar perfil para el mapa

        // Escuchar cambios de Auth solo para actualizar la UI (permisos en cards)
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                _cachedSession = session;
                _cachedProfile = null; // Limpiar cache al cambiar de sesión
                await getCachedProfile(); // Forzar carga de nuevo perfil
                if (session) {
                    console.log('[Auth] Sesión detectada, obteniendo ubicación silenciosa...');
                    setTimeout(() => obtenerUbicacionSilenciosa(), 1500);
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
    iniciarMiniMapa();

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

    const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, { headers });
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
    
    return {
        id: row.id,
        nombre: row.nombre,
        categoria: row.categoria || 'General',
        ubicacion: row.ubicacion || 'CDMX',
        mapa_url: row.mapa_url || null,
        imagen: row.imagen || '/assets/img/kpop.webp',
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
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: [-99.1332, 19.4326], // CDMX
            zoom: 10,
            scrollZoom: false
        });
        miniMapHandle.addControl(new maplibregl.NavigationControl(), 'top-right');
        
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
            if (!p.coordenadas || !p.coordenadas.lat || !p.coordenadas.lng) return false;
            const dist = calcularDistancia(userCoords.lat, userCoords.lng, p.coordenadas.lat, p.coordenadas.lng);
            p.distancia_calculada = dist;
            return dist <= filtrosAvanzados.distancia;
        });
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

    // Aplicar paginación (mostrar solo maxRendered)
    const datosPaginados = datosFiltrados.slice(0, maxRendered);

    renderCards(datosPaginados);
    actualizarMiniMapaConFiltros(datosFiltrados); // El mapa muestra todos
    // renderizarControlFiltros(); // Eliminado por ReferenceError
    renderizarBotonCargarMas(datosFiltrados.length);
}

function renderizarBotonCargarMas(totalFiltrados) {
    const contenedor = document.getElementById('contenedor-tarjetas');
    let btnContainer = document.getElementById('btn-cargar-mas-container');
    
    if (totalFiltrados > maxRendered) {
        if (!btnContainer) {
            btnContainer = document.createElement('div');
            btnContainer.id = 'btn-cargar-mas-container';
            btnContainer.style.cssText = 'text-align: center; margin-top: 30px; width: 100%; display: flex; justify-content: center;';
            
            const btn = document.createElement('button');
            btn.className = 'btn-primary';
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> Cargar más';
            btn.onclick = () => {
                maxRendered += 9;
                filtrarYRenderizar();
            };
            
            btnContainer.appendChild(btn);
            contenedor.parentNode.insertBefore(btnContainer, contenedor.nextSibling);
        }
    } else {
        if (btnContainer) btnContainer.remove();
    }
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
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userCoords = { lat: position.coords.latitude, lng: position.coords.longitude, isGPS: true };
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
                alert("No pudimos obtener tu ubicación precisa actual. Revisa los permisos de tu navegador.");
                if (loader) { loader.style.opacity = '0'; setTimeout(() => { loader.style.display = 'none'; }, 500); }
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    });
}

async function obtenerUbicacionSilenciosa() {
    if (!navigator.geolocation) return;
    
    console.log('[GPS] Solicitando ubicación silenciosa (login)...');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            userCoords = { lat: position.coords.latitude, lng: position.coords.longitude, isGPS: true };
            
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
        // Permitimos usar un caché reciente (hasta 1 minuto) para que sea súper rápido en el login
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
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
    contenedor.innerHTML = '';
    if (data.length === 0) {
        contenedor.innerHTML = '<p class="txt-loading">No se encontraron resultados.</p>';
        return;
    }
    data.forEach(p => {
        const nivelClass = getNivelClass(p.categoria);
        const distLabel = p.distancia_calculada ? `<span class="dist-badge">a ${p.distancia_calculada.toFixed(1)} km</span>` : '';
        const eventosBadge = (p.tipo === 'lugar') ? `<span class="place-event-badge"><i class="fa-solid fa-calendar-star"></i> ${p.conteo_eventos || 0}</span>` : '';
        const actorBadge = p.actor_nombre ? `<div class="actor-badge" title="Publicado por: ${sanitize(p.actor_nombre)}"><i class="fa-solid fa-user-pen"></i><span>${sanitize(p.actor_nombre)}</span></div>` : '';

        // Determinar archivo de detalles correcto
        const detailPage = p.tipo === 'evento' ? 'eventos.html' : 'lugares.html';

        const html = `
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
                    <h3 class="card-title">${sanitize(p.nombre)}</h3>
                </div>
            </article>`;
        contenedor.innerHTML += html;
    });
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
            // Forzar recálculo del mapa
            setTimeout(() => {
                if (miniMapHandle) miniMapHandle.resize();
            }, 300);
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
        particlesJS("particles-js", {
            "particles": {
                "number": { "value": 60, "density": { "enable": true, "value_area": 800 } },
                "color": { "value": ["#72B04D", "#0077b6", "#FFD700", "#E74C3C"] },
                "shape": { "type": "circle" },
                "opacity": { "value": 0.6, "random": true },
                "size": { "value": 8, "random": true },
                "line_linked": { "enable": true, "distance": 180, "color": "#cccccc", "opacity": 0.4, "width": 1 },
                "move": { "enable": true, "speed": 3.5, "direction": "out", "random": true, "out_mode": "out" }
            },
            "interactivity": { "detect_on": "canvas", "events": { "onhover": { "enable": false }, "onclick": { "enable": false }, "resize": true } },
            "retina_detect": true
        });
    }
}

function iniciarCarrusel() {
    if (typeof Swiper !== 'undefined') {
        new Swiper('.hero-carousel', { 
            loop: true, 
            autoplay: { delay: 5000 }, 
            pagination: { el: '.swiper-pagination', clickable: true }, 
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            effect: 'fade'
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

// Initialization (Immediate for type="module")
initIndex();
