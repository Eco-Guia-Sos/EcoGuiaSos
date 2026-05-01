/* assets/js/pages/mapa.js */
import { supabase } from '../supabase.js';

// Exponer para comandos de consola administrativos
window.supabase = supabase;

let map;
let userMarker;
const defaultLocation = [-99.1332, 19.4326]; // CDMX [lng, lat] for MapLibre

// Nueva función para inicializar los selectores de territorio (INEGI)
async function setupTerritorySelectors() {
    const selectEstado = document.getElementById('select-estado');
    const selectMunicipio = document.getElementById('select-municipio');
    
    if (!selectEstado || !selectMunicipio) return;

    try {
        // 1. Obtener la capa de estados
        const { data: layers } = await supabase
            .from('territory_layers')
            .select('id, level')
            .in('level', ['estado', 'municipio']);

        const stateLayer = layers?.find(l => l.level === 'estado');
        const munLayer = layers?.find(l => l.level === 'municipio');

        if (!stateLayer) return;

        // 2. Cargar Estados
        const { data: estados } = await supabase
            .from('territories')
            .select('id, name, code, centroid')
            .eq('layer_id', stateLayer.id)
            .order('name');

        if (estados) {
            estados.forEach(est => {
                const opt = document.createElement('option');
                opt.value = est.code;
                opt.textContent = est.name;
                opt.dataset.id = est.id;
                opt.dataset.centroid = JSON.stringify(est.centroid);
                selectEstado.appendChild(opt);
            });
        }

        // 3. Evento al cambiar Estado
        selectEstado.addEventListener('change', async () => {
            const stateCode = selectEstado.value;
            
            // Limpiar municipios
            selectMunicipio.innerHTML = '<option value="">Municipio / Delegación</option>';
            selectMunicipio.disabled = true;

            if (!stateCode) {
                map.flyTo({ center: defaultLocation, zoom: 5 });
                highlightTerritory(null);
                return;
            }

            // Volar al estado y resaltarlo
            const selectedOpt = selectEstado.options[selectEstado.selectedIndex];
            if (selectedOpt.dataset.id) {
                highlightTerritory(selectedOpt.dataset.id);
            }

            if (selectedOpt.dataset.centroid) {
                const centroid = JSON.parse(selectedOpt.dataset.centroid);
                // MapLibre usa [lng, lat], PostGIS ST_AsGeoJSON/centroid suele ser {type: "Point", coordinates: [lng, lat]}
                if (centroid && centroid.coordinates) {
                    map.flyTo({ center: centroid.coordinates, zoom: 7 });
                }
            }

            // Cargar Municipios del estado seleccionado
            if (munLayer) {
                const { data: municipios } = await supabase
                    .from('territories')
                    .select('id, name, code, centroid')
                    .eq('layer_id', munLayer.id)
                    .eq('parent_code', stateCode)
                    .order('name');

                if (municipios && municipios.length > 0) {
                    municipios.forEach(mun => {
                        const opt = document.createElement('option');
                        opt.value = mun.code;
                        opt.textContent = mun.name;
                        opt.dataset.id = mun.id;
                        opt.dataset.centroid = JSON.stringify(mun.centroid);
                        selectMunicipio.appendChild(opt);
                    });
                    selectMunicipio.disabled = false;
                }
            }
        });

        // 4. Evento al cambiar Municipio
        selectMunicipio.addEventListener('change', () => {
            const munCode = selectMunicipio.value;
            if (!munCode) return;

            const selectedOpt = selectMunicipio.options[selectMunicipio.selectedIndex];
            if (selectedOpt.dataset.id) {
                highlightTerritory(selectedOpt.dataset.id);
            }

            if (selectedOpt.dataset.centroid) {
                const centroid = JSON.parse(selectedOpt.dataset.centroid);
                if (centroid && centroid.coordinates) {
                    map.flyTo({ center: centroid.coordinates, zoom: 11 });
                }
            }
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
        const { data, error } = await supabase.rpc('get_territory_geojson', { t_id: territoryId });
        
        if (error) throw error;

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
        // Estilo SATELITAL (ArcGIS World Imagery)
        style: {
            'version': 8,
            'sources': {
                'raster-tiles': {
                    'type': 'raster',
                    'tiles': [
                        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    ],
                    'tileSize': 256,
                    'attribution': 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                }
            },
            'layers': [
                {
                    'id': 'simple-tiles',
                    'type': 'raster',
                    'source': 'raster-tiles',
                    'minzoom': 0,
                    'maxzoom': 22
                }
            ]
        },
        center: defaultLocation,
        zoom: 11,
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

    // Add navigation controls (zoom, orientation)
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
}

let markers = [];

async function refreshMarkers(filterText = '') {
    // Clear existing markers from DOM/Map
    markers.forEach(m => m.remove());
    markers = [];

    try {
        const { data: lugares } = await supabase.from('lugares').select('*');
        const { data: eventos } = await supabase.from('eventos').select('*');

        const allData = [
            ...(lugares || []).map(l => ({ ...l, tipo: 'lugar' })),
            ...(eventos || []).map(e => ({ ...e, tipo: 'evento' }))
        ].filter(item => 
            item.nombre.toLowerCase().includes(filterText.toLowerCase()) ||
            (item.categoria && item.categoria.toLowerCase().includes(filterText.toLowerCase()))
        );

        // Lógica de Agrupamiento (Clustering) Simplificada
        const clusters = [];
        const CLUSTER_THRESHOLD = 0.002; 

        allData.forEach(p => {
            if (!p.lat || !p.lng) return;
            
            p.coordenadas = { lat: p.lat, lng: p.lng };

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

        const bounds = new maplibregl.LngLatBounds();
        let hasCoords = false;

        clusters.forEach(c => {
            const count = c.items.length;
            const p = c.items[0]; // Primer item para la imagen
            const el = document.createElement('div');

            if (count > 1) {
                // Es un grupo (Cluster) con imagen + número
                el.className = `map-cluster-marker type-${p.tipo}`;
                el.innerHTML = `
                    <img src="${p.imagen || '/assets/img/kpop.webp'}" alt="${p.nombre}" onerror="this.src='/assets/img/kpop.webp'">
                    <div class="cluster-count-badge">${count > 2 ? '2+' : count}</div>
                `;
                
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentZoom = map.getZoom();
                    if (currentZoom >= 15) {
                        abrirPanelDetalle(p);
                    } else {
                        map.flyTo({ center: [c.lng, c.lat], zoom: currentZoom + 3, essential: true });
                    }
                });
            } else {
                // Punto único
                el.className = `map-card-marker type-${p.tipo}`;
                el.innerHTML = `<img src="${p.imagen || '/assets/img/kpop.webp'}" alt="${p.nombre}" onerror="this.src='/assets/img/kpop.webp'">`;
                
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    abrirPanelDetalle(p);
                });
            }

            const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([c.lng, c.lat])
                .addTo(map);

            markers.push(marker);
            bounds.extend([c.lng, c.lat]);
            hasCoords = true;
        });

        // Si es la carga inicial y hay coordenadas, ajustar la vista
        if (hasCoords && !filterText) {
            map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
        }

        // Renderizar el carrusel inferior con los datos actuales
        renderEventsCarousel(allData);

    } catch (err) {
        console.error(err);
    }
}

function abrirPanelDetalle(item) {
    map.flyTo({
        center: [item.coordenadas.lng, item.coordenadas.lat],
        zoom: 16,
        essential: true
    });

    const panel = document.getElementById('event-detail-panel');
    const img = document.getElementById('side-panel-img');
    const badge = document.getElementById('side-panel-badge');
    const title = document.getElementById('side-panel-title');
    const category = document.getElementById('side-panel-category');
    const location = document.getElementById('side-panel-location');
    const link = document.getElementById('side-panel-link');

    if(panel) {
        img.src = item.imagen || '/assets/img/kpop.webp';
        badge.innerText = item.tipo.toUpperCase();
        title.innerText = item.nombre;
        category.innerText = item.categoria || 'Sin categoría';
        location.innerText = item.ubicacion_texto || item.direccion || 'Ubicación seleccionada';
        link.href = `/pages/${item.tipo}s.html?id=${item.id}`;
        
        panel.classList.remove('hidden');
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
            <img src="${item.imagen_url || item.imagen || './assets/img/kpop.webp'}" alt="${item.nombre}">
            <div class="map-event-info">
                <h4>${item.nombre}</h4>
                <p><i class="fa-solid fa-calendar"></i> ${item.fecha || 'Próximamente'}</p>
                ${distHtml}
            </div>
        `;

        card.addEventListener('click', () => {
            if (item.lat && item.lng) {
                map.flyTo({ center: [item.lng, item.lat], zoom: 14 });
                abrirPanelDetalle(item);
            }
        });

        carousel.appendChild(card);
    });
}

// Configurar botón para cerrar el Panel
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-side-panel');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const panel = document.getElementById('event-detail-panel');
            if(panel) panel.classList.add('hidden');
        });
    }
});
