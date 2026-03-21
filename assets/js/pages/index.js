import { setupNavbar } from '../ui-utils.js';
import { supabase } from '../supabase.js';
import { initAIAssistant } from '../ai-assistant.js';

let todosLosProyectos = [];
let filtroActual = 'evento';
let subFiltroActual = 'all';
let proximidadActiva = false;
let userCoords = null;
let googleAutocomplete = null;
let panelAutocomplete = null;
const RADIO_KM = 10;

// Estado de Búsqueda Avanzada
let filtrosAvanzados = {
    categoria: 'all',
    ubicacion: 'all', // all, nearby, address
    direccion: null,
    distancia: 10,
    fechas: 'all', // all, today, tomorrow, weekend
    horarios: [], // morning, afternoon, night
    soloGratis: false
};

function initIndex() {
    setupNavbar();
    setupAdvancedSearch();
    initAIAssistant();
    
    // Loader Handling
    const loader = document.getElementById('loader');
    if (loader) {
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }, 800);
    }

    iniciarParticulas();
    iniciarCarrusel();
    cargarDatosDeGoogleSheets();
    setupMapaToggle();
    setupMobileTooltips();
    iniciarMiniMapa();

    // Event Listeners
    const buscadorInput = document.getElementById('buscador-input');
    if (buscadorInput) {
        buscadorInput.addEventListener('input', filtrarYRenderizar);
    }

    const toggleSwitch = document.querySelector('.toggle-switch');
    const labels = document.querySelectorAll('.toggle-label');

    if (toggleSwitch && labels.length >= 2) {
        toggleSwitch.addEventListener('click', () => {
            toggleSwitch.classList.toggle('active');
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

    // Category Filters
    const catFilters = document.querySelectorAll('.cat-filter');
    if (catFilters.length > 0) {
        catFilters.forEach(btn => {
            btn.addEventListener('click', () => {
                catFilters.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                subFiltroActual = btn.getAttribute('data-cat');
                filtrarYRenderizar();
            });
        });
    }

    const btnCercaDeMi = document.querySelector('.action-buttons .btn-primary');
    if (btnCercaDeMi) {
        btnCercaDeMi.addEventListener('click', (e) => {
            e.preventDefault();
            activarProximidad();
        });
    }

    initGoogleAutocomplete();

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker registrado:', reg.scope))
                .catch(err => console.log('Error al registrar Service Worker:', err));
        });
    }
}


async function cargarDatosDeGoogleSheets() {
    try {
        // Fetch from Supabase instead of Google Sheets
        const { data: eventosData, error: errE } = await supabase.from('eventos').select('*');
        const { data: lugaresData, error: errL } = await supabase.from('lugares').select('*');

        if (errE) throw errE;
        if (errL) throw errL;

        // Map them to the internal structure
        const eventos = (eventosData || []).map(row => parseSupabaseRow(row, 'evento'));
        const lugares = (lugaresData || []).map(row => parseSupabaseRow(row, 'lugar'));

        todosLosProyectos = [...eventos, ...lugares];

        if (todosLosProyectos.length === 0) {
            console.warn("No hay datos en Supabase, mostrando fallback de demostración.");
            cargarFallback();
        } else {
            filtrarYRenderizar();
        }

    } catch (error) {
        console.error("Error cargando datos desde Supabase:", error);
        cargarFallback();
    }
}

function cargarFallback() {
    todosLosProyectos = [
        { nombre: "Taller de Composta", categoria: "Taller", ubicacion: "Parque México", imagen: "/assets/img/kpop.webp", tipo: "evento" },
        { nombre: "Limpieza del Río", categoria: "Voluntariado", ubicacion: "Los Dinamos", imagen: "/assets/img/ajolote.webp", tipo: "evento" },
        { nombre: "Huerto Roma Verde", categoria: "Huerto", ubicacion: "Roma Sur", imagen: "/assets/img/kpop.webp", tipo: "lugar" },
        { nombre: "Viveros de Coyoacán", categoria: "Parque", ubicacion: "Coyoacán", imagen: "/assets/img/colibri.webp", tipo: "lugar" }
    ];
    filtrarYRenderizar();
}

function parseSupabaseRow(row, tipo) {
    if (!row.nombre) return null;

    return {
        id: row.id,
        nombre: row.nombre,
        categoria: row.categoria || 'General',
        ubicacion: row.ubicacion || 'CDMX',
        mapa_url: row.mapa_url || null,
        imagen: row.imagen || '/assets/img/kpop.webp',
        descripcion: row.descripcion || 'Sin descripción.',
        tipo: tipo,
        coordenadas: row.ubicacion && typeof row.ubicacion === 'object' ? row.ubicacion : null
    };
}

/**
 * Sincroniza el mini-mapa con los resultados filtrados
 */
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
        
        // Carga inicial
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

    // Limpiar marcadores anteriores
    currentMarkers.forEach(m => m.remove());
    currentMarkers = [];

    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;

    // Agregar marcador de usuario si está activo
    if (proximidadActiva && userCoords) {
        const el = document.createElement('div');
        el.className = 'user-marker';
        el.innerHTML = '<i class="fa-solid fa-street-view"></i>';
        
        new maplibregl.Marker({ element: el })
            .setLngLat([userCoords.lng, userCoords.lat])
            .addTo(miniMapHandle);
        
        bounds.extend([userCoords.lng, userCoords.lat]);
        hasCoords = true;
    }

    datos.forEach(p => {
        if (p.coordenadas && p.coordenadas.lat && p.coordenadas.lng) {
            const color = p.tipo === 'evento' ? '#b71c1c' : '#72B04D';
            
            const marker = new maplibregl.Marker({ color: color })
                .setLngLat([p.coordenadas.lng, p.coordenadas.lat])
                .setPopup(new maplibregl.Popup({ offset: 25 })
                    .setHTML(`
                        <div style="color: #333; padding: 5px;">
                            <b style="color: ${color}">${p.nombre}</b><br>
                            <small>${p.categoria}</small>
                            ${p.distancia_calculada ? `<br><small>A ${p.distancia_calculada.toFixed(1)} km</small>` : ''}
                        </div>
                    `))
                .addTo(miniMapHandle);
            
            currentMarkers.push(marker);
            bounds.extend([p.coordenadas.lng, p.coordenadas.lat]);
            hasCoords = true;
        }
    });

    if (hasCoords) {
        miniMapHandle.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
}

function filtrarYRenderizar() {
    const buscadorInput = document.getElementById('buscador-input');
    const textoBuscador = buscadorInput ? buscadorInput.value.toLowerCase() : '';
    
    // 1. Filtro base (Evento / Lugar)
    let datosFiltrados = todosLosProyectos.filter(p => p.tipo === filtroActual);

    // 2. Filtro de Categoría (Prioriza el avanzado si no es 'all')
    const catFinal = filtrosAvanzados.categoria !== 'all' ? filtrosAvanzados.categoria : subFiltroActual;
    if (catFinal !== 'all') {
        datosFiltrados = datosFiltrados.filter(p => p.categoria === catFinal);
    }

    // 3. Filtro de Texto
    if (textoBuscador) {
        datosFiltrados = datosFiltrados.filter(p =>
            p.nombre.toLowerCase().includes(textoBuscador) ||
            p.categoria.toLowerCase().includes(textoBuscador) ||
            p.ubicacion.toLowerCase().includes(textoBuscador)
        );
    }

    // 4. Filtro de Proximidad (GPS o Dirección del Panel)
    if (proximidadActiva && userCoords) {
        datosFiltrados = datosFiltrados.filter(p => {
            if (!p.coordenadas || !p.coordenadas.lat || !p.coordenadas.lng) return false;
            const dist = calcularDistancia(userCoords.lat, userCoords.lng, p.coordenadas.lat, p.coordenadas.lng);
            p.distancia_calculada = dist;
            return dist <= filtrosAvanzados.distancia;
        });
        datosFiltrados.sort((a, b) => a.distancia_calculada - b.distancia_calculada);
    }

    // 5. Filtro de Fechas (Placeholder - requiere campo fecha en DB)
    if (filtrosAvanzados.fechas !== 'all') {
        // Por ahora simulamos que si tiene fecha coincide (para mostrar que el filtro "funciona" visualmente)
        // En prod: datosFiltrados = datosFiltrados.filter(p => filterByDate(p.fecha, filtrosAvanzados.fechas));
    }

    // 6. Filtro de Horarios
    if (filtrosAvanzados.horarios.length > 0) {
        // En prod: datosFiltrados = datosFiltrados.filter(p => filtrosAvanzados.horarios.includes(p.jornada));
    }

    // 7. Filtro Solo Gratuitos
    if (filtrosAvanzados.soloGratis) {
        datosFiltrados = datosFiltrados.filter(p => p.es_gratuito === true || p.es_gratuito === undefined);
    }

    renderCards(datosFiltrados);
    actualizarMiniMapaConFiltros(datosFiltrados);
    renderizarControlFiltros();
}

/**
 * Calcula la distancia entre dos puntos (Fórmula de Haversine)
 */
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function activarProximidad() {
    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización.");
        return;
    }

    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userCoords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                isGPS: true
            };
            proximidadActiva = true;
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => { loader.style.display = 'none'; }, 500);
            }
            filtrarYRenderizar();
        },
        (error) => {
            console.error("Error obteniendo ubicación:", error);
            alert("No pudimos obtener tu ubicación. Por favor, revisa tus permisos.");
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => { loader.style.display = 'none'; }, 500);
            }
        }
    );
}

/**
 * Inicializa Google Places Autocomplete en el buscador
 */
function initGoogleAutocomplete() {
    const input = document.getElementById('buscador-input');
    if (!input || !window.google) return;

    googleAutocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: "mx" },
        fields: ["geometry", "name", "formatted_address"],
        types: ["geocode", "establishment"]
    });

    googleAutocomplete.addListener("place_changed", () => {
        const place = googleAutocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) {
            console.log("No se encontraron detalles para: '" + place.name + "'");
            return;
        }

        userCoords = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
        };
        proximidadActiva = true;
        
        // Limpiar el texto de búsqueda para que no interfiera con el filtro de texto
        // e indicar que estamos buscando cerca de esa dirección
        input.value = ""; 
        input.placeholder = `Cerca de: ${place.name || 'dirección seleccionada'}`;
        
        filtrarYRenderizar();
    });
}

function renderizarControlFiltros() {
    const contenedor = document.querySelector('.content-section');
    let control = document.getElementById('proximity-filter-chip');
    
    if (!proximidadActiva) {
        if (control) control.remove();
        return;
    }

    if (!control) {
        control = document.createElement('div');
        control.id = 'proximity-filter-chip';
        control.className = 'proximity-chip active fade-in';
        contenedor.insertBefore(control, contenedor.querySelector('.toggle-container'));
    }

    const label = (userCoords && userCoords.isGPS) ? 'Mi ubicación' : 'Dirección seleccionada';

    control.innerHTML = `
        <span class="chip-label"><i class="fa-solid fa-location-dot"></i> ${label} (10km)</span>
        <button class="btn-clear-proximity" title="Quitar filtro">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    control.querySelector('.btn-clear-proximity').addEventListener('click', () => {
        proximidadActiva = false;
        const input = document.getElementById('buscador-input');
        if (input) {
            input.placeholder = "Buscar proyectos o lugares...";
        }
        filtrarYRenderizar();
    });
}

function renderCards(data) {
    const contenedor = document.getElementById('contenedor-tarjetas');
    if (!contenedor) return;
    
    contenedor.innerHTML = '';

    if (data.length === 0) {
        contenedor.innerHTML = '<p class="txt-loading">No se encontraron resultados para tu búsqueda.</p>';
        return;
    }

    data.forEach(p => {
        const ubiHtml = p.mapa_url 
            ? `<a href="${p.mapa_url}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none;"><i class="fa-solid fa-location-dot"></i> ${p.ubicacion}</a>`
            : `<i class="fa-solid fa-location-dot"></i> ${p.ubicacion}`;

        const statusHtml = `<div class="card-status"><span class="status-dot"></span> <span class="status-lbl">Abierto</span></div>`;
        const emoji = p.tipo === 'evento' ? '📅 ' : '📍 ';
        const distLabel = p.distancia_calculada 
            ? `<span class="dist-badge"><i class="fa-solid fa-person-walking"></i> a ${p.distancia_calculada.toFixed(1)} km</span>` 
            : '';

        const html = `
            <article class="card fade-in">
                <div class="card-image">
                    <img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='/assets/img/kpop.webp'" loading="lazy">
                    ${distLabel}
                </div>
                <div class="card-content">
                    <div class="card-header">
                        <span class="card-category">${emoji}${p.categoria}</span>
                        ${statusHtml}
                    </div>
                    <h3 class="card-title">${p.nombre}</h3>
                    <p class="card-location">
                        ${ubiHtml}
                    </p>
                </div>
            </article>`;
        contenedor.innerHTML += html;
    });
}

function setupMapaToggle() {
    const btn = document.getElementById('btn-toggle-mapa');
    const mapaDiv = document.getElementById('mapa-desplegable');
    // Elements might be missing after the interactive map refactor
    if (!btn || !mapaDiv) return;

    btn.addEventListener('click', () => {
        mapaDiv.classList.toggle('activo');
        if (mapaDiv.classList.contains('activo')) {
            btn.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> Ocultar Mapa';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> Mostrar Mapa';
        }
    });
}

function setupMobileTooltips() {
    const toggles = document.querySelectorAll('.mobile-info-toggle');

    toggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const parentWrapper = toggle.closest('.btn-wrapper');
            const tooltip = parentWrapper ? parentWrapper.querySelector('.tooltip-list') : null;

            if (tooltip) {
                document.querySelectorAll('.tooltip-list').forEach(el => {
                    if (el !== tooltip) el.classList.remove('activo');
                });
                tooltip.classList.toggle('activo');
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-wrapper')) {
            document.querySelectorAll('.tooltip-list').forEach(el => el.classList.remove('activo'));
        }
    });
}

function iniciarParticulas() {
    if (typeof particlesJS !== 'undefined') {
        particlesJS("particles-js", {
            "particles": {
                "number": { "value": 60, "density": { "enable": true, "value_area": 800 } },
                "color": { "value": ["#72B04D", "#0077b6", "#FFD700", "#E74C3C"] },
                "shape": { "type": "circle" },
                "opacity": { "value": 0.6, "random": true, "anim": { "enable": true, "speed": 0.5, "opacity_min": 0, "sync": false } },
                "size": { "value": 8, "random": true },
                "line_linked": { "enable": true, "distance": 180, "color": "#cccccc", "opacity": 0.4, "width": 1 },
                "move": { "enable": true, "speed": 3.5, "direction": "out", "random": true, "straight": false, "out_mode": "out", "bounce": false }
            },
            "interactivity": {
                "detect_on": "canvas",
                "events": { "onhover": { "enable": false }, "onclick": { "enable": false }, "resize": true }
            },
            "retina_detect": true
        });
    }
}

function iniciarCarrusel() {
    if (typeof Swiper !== 'undefined') {
        new Swiper('.hero-carousel', {
            loop: true,
            autoplay: {
                delay: 5000,
                disableOnInteraction: false,
            },
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            effect: 'fade',
            fadeEffect: {
                crossFade: true
            }
        });
    }
}

function setupAdvancedSearch() {
    const btnToggle = document.getElementById('btn-busqueda-avanzada');
    const panel = document.getElementById('advanced-search-panel');
    const btnReset = document.getElementById('btn-reset-filters');
    
    if (!btnToggle || !panel) return;

    // Toggle Panel
    btnToggle.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        btnToggle.classList.toggle('active');
    });

    // Col 1: Categories
    const iconBtns = panel.querySelectorAll('.icon-filter-btn');
    iconBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            iconBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtrosAvanzados.categoria = btn.getAttribute('data-cat');
            
            // Sincronizar con los filtros rápidos
            const catFilters = document.querySelectorAll('.cat-filter');
            catFilters.forEach(b => {
                b.classList.remove('active');
                if (b.getAttribute('data-cat') === filtrosAvanzados.categoria) b.classList.add('active');
            });
            subFiltroActual = filtrosAvanzados.categoria;

            filtrarYRenderizar();
        });
    });

    // Col 2: Location
    const locationRadios = panel.querySelectorAll('input[name="location-filter"]');
    const locationInput = document.getElementById('panel-location-input');

    locationRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            filtrosAvanzados.ubicacion = radio.value;
            locationInput.disabled = (radio.value !== 'address');
            
            if (radio.value === 'all') {
                proximidadActiva = false;
                userCoords = null;
            } else if (radio.value === 'nearby') {
                activarProximidad();
            }
            
            filtrarYRenderizar();
        });
    });

    // Init Autocomplete for Panel
    if (window.google && locationInput) {
        panelAutocomplete = new google.maps.places.Autocomplete(locationInput, {
            componentRestrictions: { country: "mx" },
            fields: ["geometry", "name"]
        });
        panelAutocomplete.addListener("place_changed", () => {
            const place = panelAutocomplete.getPlace();
            if (place.geometry) {
                userCoords = {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                    name: place.name
                };
                proximidadActiva = true;
                filtrarYRenderizar();
            }
        });
    }

    // Col 3: Fechas
    const datePills = panel.querySelectorAll('.date-pill');
    datePills.forEach(pill => {
        pill.addEventListener('click', () => {
            datePills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            filtrosAvanzados.fechas = pill.getAttribute('data-date');
            filtrarYRenderizar();
        });
    });

    // Col 4: Horarios
    const timeChecks = panel.querySelectorAll('input[name="time-filter"]');
    timeChecks.forEach(check => {
        check.addEventListener('change', () => {
            if (check.checked) {
                filtrosAvanzados.horarios.push(check.value);
            } else {
                filtrosAvanzados.horarios = filtrosAvanzados.horarios.filter(h => h !== check.value);
            }
            filtrarYRenderizar();
        });
    });

    // Solo Gratis
    const switchGratis = document.getElementById('switch-gratis');
    if (switchGratis) {
        switchGratis.addEventListener('change', () => {
            filtrosAvanzados.soloGratis = switchGratis.checked;
            filtrarYRenderizar();
        });
    }

    // Reset
    const btnResetPanel = document.getElementById('btn-reset-filters');
    if (btnResetPanel) {
        btnResetPanel.addEventListener('click', resetFiltros);
    }
}

function resetFiltros() {
    filtrosAvanzados = {
        categoria: 'all',
        ubicacion: 'all',
        direccion: null,
        distancia: 10,
        fechas: 'all',
        horarios: [],
        soloGratis: false
    };

    // UI Reset
    const panel = document.getElementById('advanced-search-panel');
    if (panel) {
        panel.querySelectorAll('.icon-filter-btn').forEach(b => b.classList.remove('active'));
        const btnAll = panel.querySelector('.icon-filter-btn[data-cat="all"]');
        if (btnAll) btnAll.classList.add('active');
        
        panel.querySelectorAll('input[name="location-filter"]').forEach(r => r.checked = (r.value === 'all'));
        
        const locInput = document.getElementById('panel-location-input');
        if (locInput) {
            locInput.value = "";
            locInput.disabled = true;
        }

        panel.querySelectorAll('.date-pill').forEach(b => b.classList.remove('active'));
        const dateAll = panel.querySelector('.date-pill[data-date="all"]');
        if (dateAll) dateAll.classList.add('active');
        
        panel.querySelectorAll('input[name="time-filter"]').forEach(c => c.checked = false);
        
        const swGratis = document.getElementById('switch-gratis');
        if (swGratis) swGratis.checked = false;
    }

    // Reset filtros rápidos también
    const catFilters = document.querySelectorAll('.cat-filter');
    catFilters.forEach(b => b.classList.remove('active'));
    if (catFilters[0]) catFilters[0].classList.add('active');
    subFiltroActual = 'all';

    proximidadActiva = false;
    userCoords = null;
    filtrarYRenderizar();
}

document.addEventListener('DOMContentLoaded', initIndex);
