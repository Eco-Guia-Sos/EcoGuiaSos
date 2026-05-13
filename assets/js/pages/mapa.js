/* assets/js/pages/mapa.js */
import { supabase } from '../supabase.js';
import { TerritoryService } from '../services/territory-service.js';

// Exponer para comandos de consola administrativos
window.supabase = supabase;

const ARCGIS_API_KEY = 'AAPK63c1a8519cc64746b19a008c37d6e4990L-8UuS9XnO0mO9q60Q7oXoXoXoXoXoXoXoXo'; // Llave de acceso para mapas vectoriales
let map;
let markers = [];
let userMarker = null;
const defaultLocation = [-102.5528, 23.6345]; // Centro de México [lng, lat] for MapLibre

// Nueva función para inicializar los selectores de territorio (INEGI)
async function setupTerritorySelectors() {
    const selectEstado = document.getElementById('select-estado');
    const selectMunicipio = document.getElementById('select-municipio');
    
    if (!selectEstado || !selectMunicipio) return;

    try {
        // 1. Cargar Estados desde el Servicio Interno
        const estados = await TerritoryService.getStates();

        if (estados) {
            estados.forEach(est => {
                const opt = document.createElement('option');
                opt.value = est.key; // Usamos 'key' (INEGI code)
                opt.textContent = est.name;
                opt.dataset.id = est.id;
                // Si el servicio nos da el centroide, lo guardamos
                if (est.centroid) opt.dataset.centroid = JSON.stringify(est.centroid);
                selectEstado.appendChild(opt);
            });
        }

        // 2. Evento al cambiar Estado
        selectEstado.addEventListener('change', async () => {
            const stateKey = selectEstado.value;
            
            // Limpiar municipios
            selectMunicipio.innerHTML = '<option value="">Municipio / Delegación</option>';
            selectMunicipio.disabled = true;

            if (!stateKey) {
                map.flyTo({ center: defaultLocation, zoom: 5 });
                highlightTerritory(null);
                refreshMarkers(''); // Carga inicial
                return;
            }

            const selectedOpt = selectEstado.options[selectEstado.selectedIndex];
            const territoryId = selectedOpt.dataset.id;
            
            // Pintar área
            highlightTerritory(territoryId);

            // Volar al estado
            if (selectedOpt.dataset.centroid) {
                const centroid = JSON.parse(selectedOpt.dataset.centroid);
                if (centroid && centroid.coordinates) {
                    map.flyTo({ center: centroid.coordinates, zoom: 7 });
                }
            }

            // --- FILTRO ESPACIAL ---
            try {
                const localData = await TerritoryService.fetchEventsByTerritory(territoryId);
                refreshMarkers('', localData); // Actualiza mapa y carrusel
            } catch (e) { console.error('Error filtrando eventos:', e); }

            // 3. Cargar Municipios usando el Servicio
            const municipios = await TerritoryService.getMunicipalities(stateKey);

            if (municipios && municipios.length > 0) {
                municipios.forEach(mun => {
                    const opt = document.createElement('option');
                    opt.value = mun.key;
                    opt.textContent = mun.name;
                    opt.dataset.id = mun.id;
                    if (mun.centroid) opt.dataset.centroid = JSON.stringify(mun.centroid);
                    selectMunicipio.appendChild(opt);
                });
                selectMunicipio.disabled = false;
            }
        });

        // 4. Evento al cambiar Municipio
        selectMunicipio.addEventListener('change', async () => {
            const selectedOpt = selectMunicipio.options[selectMunicipio.selectedIndex];
            
            if (!selectedOpt.value) {
                const stateOpt = selectEstado.options[selectEstado.selectedIndex];
                if (stateOpt.value) {
                    const stateId = stateOpt.dataset.id;
                    highlightTerritory(stateId);
                    const localData = await TerritoryService.fetchEventsByTerritory(stateId);
                    refreshMarkers('', localData);
                } else {
                    refreshMarkers();
                }
                return;
            }

            const territoryId = selectedOpt.dataset.id;
            highlightTerritory(territoryId);

            if (selectedOpt.dataset.centroid) {
                const centroid = JSON.parse(selectedOpt.dataset.centroid);
                if (centroid && centroid.coordinates) {
                    map.flyTo({ center: centroid.coordinates, zoom: 11 });
                }
            }

            // --- FILTRO ESPACIAL ---
            try {
                const localData = await TerritoryService.fetchEventsByTerritory(territoryId);
                refreshMarkers('', localData); // Actualiza mapa y carrusel
            } catch (e) { console.error('Error filtrando eventos:', e); }
        });

    } catch (err) {
        console.error('[Atlas] Error configurando selectores:', err);
    }
}

// Función para pintar el área del territorio seleccionado
async function highlightTerritory(territoryId) {
    if (!map.getSource('selected-territory')) return;

    if (!territoryId) {
        map.getSource('selected-territory').setData({ 'type': 'FeatureCollection', 'features': [] });
        return;
    }

    try {
        const data = await TerritoryService.getGeometry(territoryId);
        if (data) {
            map.getSource('selected-territory').setData(data);
        }
    } catch (err) {
        console.error('[Atlas] Error al resaltar territorio:', err);
    }
}

// Nueva función para cargar las capas del INEGI (Estados/Municipios)
async function loadTerritoryLayers() {
    try {
        console.log('[Atlas] Verificando capas territoriales disponibles...');
        
        // 1. Obtener los IDs de las capas de estados y municipios
        const { data: layers, error: layerErr } = await supabase
            .from('territory_layers')
            .select('id, level, name');
            
        if (layerErr || !layers || layers.length === 0) {
            console.log('[Atlas] No hay capas territoriales instaladas aún.');
            return;
        }

        // 2. Extraer polígonos por capa
        for (const layer of layers) {
            console.log(`[Atlas] Cargando capa: ${layer.name} (${layer.level})`);
            
            const { data: features } = await supabase
                .from('territories')
                .select('code, name, properties')
                .eq('layer_id', layer.id)
                .limit(50);
                
            /* EJEMPLO DE INTEGRACIÓN FUTURA:
            map.addSource(`territorio-${layer.level}`, {
                'type': 'geojson',
                'data': `https://tu-proyecto.supabase.co/rest/v1/rpc/get_geojson_layer?layer=${layer.id}`
            });

            map.addLayer({
                'id': `fill-${layer.level}`,
                'type': 'fill',
                'source': `territorio-${layer.level}`,
                'paint': {
                    'fill-color': layer.level === 'estado' ? '#ffffff' : '#72b04d',
                    'fill-opacity': 0.05
                }
            });

            map.addLayer({
                'id': `line-${layer.level}`,
                'type': 'line',
                'source': `territorio-${layer.level}`,
                'paint': {
                    'line-color': layer.level === 'estado' ? 'rgba(255,255,255,0.4)' : 'rgba(114,176,77,0.3)',
                    'line-width': layer.level === 'estado' ? 2 : 1
                }
            });
            */
        }
        
    } catch (err) {
        console.error('[Atlas] Error al cargar capas territoriales:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupControls();
    setupTerritorySelectors();
});

function initMap() {
    map = new maplibregl.Map({
        container: 'map-container',
        // Estilo Plano con Color (ArcGIS Streets) - Público y muy fluido
        style: {
            'version': 8,
            'sources': {
                'osm-tiles': {
                    'type': 'raster',
                    'tiles': [
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                    ],
                    'tileSize': 256,
                    'attribution': '&copy; OpenStreetMap contributors'
                }
            },
            'layers': [
                {
                    'id': 'osm-layer',
                    'type': 'raster',
                    'source': 'osm-tiles',
                    'minzoom': 0,
                    'maxzoom': 18
                }
            ]
        },
        center: defaultLocation,
        zoom: 5,
        antialias: true
    });

    map.on('load', () => {
        refreshMarkers(); // Usar la misma función centralizada.

        // Preparar fuentes para resaltado de territorios
        map.addSource('selected-territory', {
            'type': 'geojson',
            'data': { 'type': 'FeatureCollection', 'features': [] }
        });

        // Capa de Relleno (Sutil)
        map.addLayer({
            'id': 'selected-territory-fill',
            'type': 'fill',
            'source': 'selected-territory',
            'paint': {
                'fill-color': '#72b04d',
                'fill-opacity': 0.15
            }
        });

        // Capa de Borde (Brillante/Neón)
        map.addLayer({
            'id': 'selected-territory-line',
            'type': 'line',
            'source': 'selected-territory',
            'paint': {
                'line-color': '#72b04d',
                'line-width': 3,
                'line-blur': 1
            }
        });

        // Cargar capas territoriales si existen en la BD
        loadTerritoryLayers();

        // Auto-locate on start
        setTimeout(() => {
            const locateBtn = document.getElementById('locate-btn');
            if (locateBtn) locateBtn.click();
        }, 1000);
    });

    // Mover controles a la parte superior derecha (se ajustará con CSS para quedar bajo el texto)
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Botón de resetear filtros
    const resetBtn = document.getElementById('reset-filter-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            refreshMarkers(); // Carga todo de nuevo
        });
    }
}

let currentMarkers = [];

/**
 * Refresca los marcadores usando elementos DOM con imágenes (Estilo Home)
 * Optimizados con clustering manual para mantener la fluidez.
 */
async function refreshMarkers(filterText = '', manualData = null) {
    // 1. Limpiar marcadores anteriores
    currentMarkers.forEach(m => m.remove());
    currentMarkers = [];

    // Mostrar/Ocultar botón de reset si hay datos manuales (cluster)
    const resetBtn = document.getElementById('reset-filter-btn');
    if (manualData) {
        if (resetBtn) resetBtn.style.display = 'flex';
    } else {
        if (resetBtn) resetBtn.style.display = 'none';
    }

    try {
        let allData = [];
        if (manualData) {
            allData = manualData;
        } else {
            const { data: lugares } = await supabase.from('lugares').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion');
            const { data: eventos } = await supabase.from('eventos').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion');
            allData = [
                ...(lugares || []).map(l => ({ ...l, tipo: 'lugar' })),
                ...(eventos || []).map(e => ({ ...e, tipo: 'evento' }))
            ];
        }

        if (filterText) {
            allData = allData.filter(item => 
                item.nombre.toLowerCase().includes(filterText.toLowerCase()) ||
                (item.categoria && item.categoria.toLowerCase().includes(filterText.toLowerCase()))
            );
        }

        // 2. Lógica de Agrupamiento (Clustering) para no saturar el DOM
        const clusters = [];
        const THRESHOLD = map.getZoom() > 10 ? 0.0005 : 0.005; // Ajustar según el zoom

        allData.forEach(p => {
            if (!p.lat || !p.lng) return;
            
            let found = clusters.find(c => {
                const dLat = Math.abs(c.lat - p.lat);
                const dLng = Math.abs(c.lng - p.lng);
                return dLat < THRESHOLD && dLng < THRESHOLD;
            });

            if (found) {
                found.items.push(p);
            } else {
                clusters.push({ lat: p.lat, lng: p.lng, items: [p] });
            }
        });

        // 3. Renderizar cada cluster/punto como elemento DOM
        clusters.forEach(c => {
            const p = c.items[0]; // Referencia para el estilo
            const count = c.items.length;
            const el = document.createElement('div');
            
            if (count > 1) {
                // Estilo Cluster (Imagen + Contador)
                el.className = `map-cluster-marker type-${p.tipo}`;
                el.innerHTML = `
                    <img src="${p.imagen_url || '/assets/img/ajolote.webp'}" alt="${p.nombre}" onerror="this.src='/assets/img/ajolote.webp'">
                    <div class="cluster-count-badge">${count > 9 ? '9+' : count}</div>
                `;
                el.onclick = () => {
                    const currentZoom = map.getZoom();
                    if (currentZoom < 17) {
                        map.flyTo({ center: [c.lng, c.lat], zoom: currentZoom + 2 });
                    } else {
                        // Si ya estamos muy cerca y siguen juntos, mostramos la lista en el carrusel
                        refreshMarkers('', c.items); 
                        renderEventsCarousel(c.items);
                    }
                };
            } else {
                // Estilo Punto Único (Igual que en la Home)
                el.className = `map-card-marker type-${p.tipo}`;
                el.innerHTML = `
                    <div class="marker-card-pulse"></div>
                    <img src="${p.imagen_url || '/assets/img/ajolote.webp'}" alt="${p.nombre}" onerror="this.src='/assets/img/ajolote.webp'">
                `;
                el.onclick = () => abrirPanelDetalle(p);
            }

            const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([c.lng, c.lat])
                .addTo(map);
            
            currentMarkers.push(marker);
        });

        renderEventsCarousel(allData);

    } catch (err) {
        console.error('[Atlas] Error en refreshMarkers:', err);
    }
}

function abrirPanelDetalle(item) {
    // Obtener coordenadas de forma segura (soportar ambos formatos)
    const lng = item.lng || (item.coordenadas ? item.coordenadas.lng : null);
    const lat = item.lat || (item.coordenadas ? item.coordenadas.lat : null);

    if (lng && lat) {
        map.flyTo({
            center: [lng, lat],
            zoom: 16,
            essential: true
        });
    }

    // Abrir panel lateral derecho
    const panel = document.getElementById('event-detail-panel');
    const img = document.getElementById('side-panel-img');
    const badge = document.getElementById('side-panel-badge');
    const title = document.getElementById('side-panel-title');
    const category = document.getElementById('side-panel-category');
    const location = document.getElementById('side-panel-location');
    const link = document.getElementById('side-panel-link');

    if (panel) {
        img.src = item.imagen_url || item.imagen || '/assets/img/ajolote.webp';
        badge.innerText = item.tipo.toUpperCase();
        title.innerText = item.nombre;
        category.innerText = item.categoria || 'Sin categoría';
        location.innerText = item.ubicacion_texto || item.direccion || item.ubicacion || 'Ubicación seleccionada';
        link.href = `/pages/${item.tipo}s.html?id=${item.id}`;
        panel.classList.remove('hidden');
    }

    // Destacar la tarjeta del carrusel correspondiente
    const carousel = document.getElementById('map-events-carousel');
    if (carousel) {
        const cards = carousel.querySelectorAll('.map-event-card');
        cards.forEach(c => c.classList.remove('card--active'));
        const activeCard = carousel.querySelector(`[data-id="${item.id}"]`);
        if (activeCard) {
            activeCard.classList.add('card--active');
            // Scroll suave hacia la tarjeta
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
}

function setupControls() {
    const locateBtn = document.getElementById('locate-btn');
    
    locateBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert('Geolocalización no soportada por su navegador.');
            return;
        }

        locateBtn.classList.add('active');
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const pos = [longitude, latitude];

                map.flyTo({
                    center: pos,
                    zoom: 15,
                    speed: 1.5,
                    curve: 1
                });

                if (userMarker) {
                    userMarker.setLngLat(pos);
                } else {
                    userMarker = new maplibregl.Marker({
                        color: "#0077b6",
                        scale: 0.8
                    })
                    .setLngLat(pos)
                    .addTo(map);
                }

                // Guardar coordenadas globales para el carrusel
                userCoords = { lat: latitude, lng: longitude };
                
                // Refrescar carrusel para mostrar distancias
                refreshMarkers(document.getElementById('map-search-input')?.value || '');

                locateBtn.classList.remove('active');
            },
            (err) => {
                console.error(err);
                alert('No se pudo obtener su ubicación.');
                locateBtn.classList.remove('active');
            }
        );
    });

    const searchInput = document.getElementById('map-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const text = e.target.value;
            refreshMarkers(text);
        });
    }
}

let userCoords = null;

// Función para calcular distancia (Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Función para actualizar el carrusel inferior
function renderEventsCarousel(data) {
    const carousel = document.getElementById('map-events-carousel');
    if (!carousel) return;

    carousel.innerHTML = '';
    
    // Solo mostrar los primeros 10 para no saturar
    data.slice(0, 10).forEach(item => {
        const card = document.createElement('div');
        card.className = 'map-event-card';
        
        let distHtml = '';
        if (userCoords && item.lat && item.lng) {
            const d = calcularDistancia(userCoords.lat, userCoords.lng, item.lat, item.lng);
            distHtml = `<p class="map-event-dist"><i class="fa-solid fa-person-walking"></i> A ${d.toFixed(1)} km</p>`;
        }

        card.innerHTML = `
            <img src="${item.imagen_url || item.imagen || '/assets/img/ajolote.webp'}" alt="${item.nombre}" onerror="this.src='/assets/img/ajolote.webp'">
            <div class="map-event-info">
                <h4>${item.nombre}</h4>
                <p><i class="fa-solid fa-layer-group"></i> ${item.categoria || 'Iniciativa'}</p>
                ${distHtml}
            </div>
        `;
        card.dataset.id = item.id; // Para poder resaltarla luego

        card.addEventListener('click', () => {
            if (item.lat && item.lng) {
                map.flyTo({ center: [item.lng, item.lat], zoom: 14 });
                abrirPanelDetalle(item);
            }
        });

        carousel.appendChild(card);
    });
}

// Configurar botón para cerrar el Panel, Drag Scroll, Flechas y Panel de Filtros
document.addEventListener('DOMContentLoaded', () => {
    // --- Cerrar panel lateral ---
    const closeBtn = document.getElementById('close-side-panel');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const panel = document.getElementById('event-detail-panel');
            if (panel) panel.classList.add('hidden');
        });
    }

    // --- DRAG SCROLL PARA EL CARRUSEL ---
    const slider = document.getElementById('map-events-carousel');
    if (slider) {
        let isDown = false, startX, scrollLeft;
        slider.addEventListener('mousedown', (e) => { isDown = true; slider.classList.add('active-drag'); startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
        slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('active-drag'); });
        slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('active-drag'); });
        slider.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - slider.offsetLeft; slider.scrollLeft = scrollLeft - (x - startX) * 2; });
    }

    // --- FLECHAS DEL CARRUSEL ---
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    const carousel = document.getElementById('map-events-carousel');

    if (prevBtn && nextBtn && carousel) {
        const scrollAmount = 310; // Ancho de una tarjeta + gap
        prevBtn.addEventListener('click', () => carousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' }));
        nextBtn.addEventListener('click', () => carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' }));
    }

    // --- PANEL DE FILTROS (abrir/cerrar) ---
    const filterBtn = document.getElementById('filter-btn');
    const filterPanel = document.getElementById('filter-panel');
    const filterBackdrop = document.getElementById('filter-backdrop');

    if (filterBtn && filterPanel) {
        filterBtn.addEventListener('click', () => filterPanel.classList.toggle('open'));
        filterBackdrop.addEventListener('click', () => filterPanel.classList.remove('open'));
    }

    // --- CHIPS DE REGIÓN ---
    document.querySelectorAll('.region-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
            // Toggle activo
            const isActive = chip.classList.contains('active');
            document.querySelectorAll('.region-chip').forEach(c => c.classList.remove('active'));

            if (isActive) {
                // Desactivar: volver a vista completa
                refreshMarkers('');
                return;
            }

            chip.classList.add('active');
            const regionId = chip.dataset.region;

            try {
                const regionData = await TerritoryService.fetchEventsByRegion(regionId);
                refreshMarkers(null, regionData); // Actualiza mapa y carrusel
                
                // Limpiar selectores
                document.getElementById('select-estado').value = '';
                document.getElementById('select-municipio').innerHTML = '<option value="">Selecciona un estado primero</option>';
                document.getElementById('select-municipio').disabled = true;
                highlightTerritory(null);
            } catch (e) {
                console.error('Error filtrando por región:', e);
            }
        });
    });

    // --- LIMPIAR FILTROS ---
    const clearBtn = document.getElementById('filter-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.querySelectorAll('.region-chip').forEach(c => c.classList.remove('active'));
            document.getElementById('select-estado').value = '';
            document.getElementById('select-municipio').innerHTML = '<option value="">Selecciona un estado primero</option>';
            document.getElementById('select-municipio').disabled = true;
            highlightTerritory(null);
            map.flyTo({ center: defaultLocation, zoom: 5 });
            refreshMarkers('');
            filterPanel.classList.remove('open');
        });
    }
});
