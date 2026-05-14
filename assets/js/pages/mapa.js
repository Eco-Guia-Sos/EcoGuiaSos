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
    const drawerSelectEstado = document.getElementById('drawer-select-estado');
    const drawerSelectMunicipio = document.getElementById('drawer-select-municipio');
    
    try {
        const estados = await TerritoryService.getStates();
        if (estados) {
            estados.forEach(est => {
                const opt = document.createElement('option');
                opt.value = est.key;
                opt.textContent = est.name;
                opt.dataset.id = est.id;
                if (est.centroid) opt.dataset.centroid = JSON.stringify(est.centroid);
                
                if (selectEstado) selectEstado.appendChild(opt.cloneNode(true));
                if (drawerSelectEstado) drawerSelectEstado.appendChild(opt);
            });
        }

        const handleEstadoChange = async (targetSelect, syncSelect) => {
            const stateKey = targetSelect.value;
            if (syncSelect) syncSelect.value = stateKey; // Sincronizar el otro select
            
            // Limpiar municipios en ambos
            if (selectMunicipio) {
                selectMunicipio.innerHTML = '<option value="">Municipio / Delegación</option>';
                selectMunicipio.disabled = true;
            }
            if (drawerSelectMunicipio) {
                drawerSelectMunicipio.innerHTML = '<option value="">Selecciona un estado primero</option>';
                drawerSelectMunicipio.disabled = true;
            }

            if (!stateKey) {
                map.flyTo({ center: defaultLocation, zoom: 5 });
                highlightTerritory(null);
                refreshMarkers('');
                return;
            }

            const selectedOpt = targetSelect.options[targetSelect.selectedIndex];
            const territoryId = selectedOpt.dataset.id;
            const territoryName = selectedOpt.textContent;
            
            // Limpiar regiones activas si el usuario elige un estado a mano
            document.querySelectorAll('.region-chip').forEach(c => c.classList.remove('active'));
            
            // Volar a las coordenadas del estado garantizado
            if (selectedOpt.dataset.centroid) {
                try {
                    const centroid = JSON.parse(selectedOpt.dataset.centroid);
                    if (centroid && centroid.coordinates) {
                        map.flyTo({ center: centroid.coordinates, zoom: 7, essential: true });
                    }
                } catch (e) { console.warn('[Atlas] Error parseando centroid de estado:', e); }
            }

            // Si es un ID real de BD, pintar polígono y filtrar en servidor
            if (territoryId && territoryId !== 'null' && territoryId !== 'undefined') {
                highlightTerritory(territoryId, territoryName);
                try {
                    const localData = await TerritoryService.fetchEventsByTerritory(territoryId);
                    refreshMarkers('', localData);
                } catch (e) { 
                    console.error('Error filtrando eventos por territorio:', e); 
                    refreshMarkers(territoryName);
                }
            } else {
                // Estado de fallback local: intentar dibujar polígono desde GeoJSON local
                highlightTerritory(null, territoryName);
                refreshMarkers(territoryName);
            }

            // Cargar municipios lazy
            const municipios = await TerritoryService.getMunicipalities(stateKey);
            if (municipios && municipios.length > 0) {
                municipios.forEach(mun => {
                    const opt = document.createElement('option');
                    opt.value = mun.key;
                    opt.textContent = mun.name;
                    opt.dataset.id = mun.id || 'null';
                    if (mun.centroid) opt.dataset.centroid = JSON.stringify(mun.centroid);
                    
                    if (selectMunicipio) selectMunicipio.appendChild(opt.cloneNode(true));
                    if (drawerSelectMunicipio) drawerSelectMunicipio.appendChild(opt);
                });
                if (selectMunicipio) selectMunicipio.disabled = false;
                if (drawerSelectMunicipio) drawerSelectMunicipio.disabled = false;
            }
        };

        if (selectEstado) {
            selectEstado.addEventListener('change', () => handleEstadoChange(selectEstado, drawerSelectEstado));
        }
        if (drawerSelectEstado) {
            drawerSelectEstado.addEventListener('change', () => handleEstadoChange(drawerSelectEstado, selectEstado));
        }

        const handleMunicipioChange = async (targetMunSelect, syncMunSelect, parentSelectEstado) => {
            if (syncMunSelect) syncMunSelect.value = targetMunSelect.value;
            const selectedOpt = targetMunSelect.options[targetMunSelect.selectedIndex];
            
            if (!selectedOpt || !selectedOpt.value) {
                // Si deselecciona municipio, volver al estado si hay uno
                if (parentSelectEstado && parentSelectEstado.value) {
                    const stateOpt = parentSelectEstado.options[parentSelectEstado.selectedIndex];
                    const stateId = stateOpt.dataset.id;
                    if (stateOpt.dataset.centroid) {
                        try {
                            const centroid = JSON.parse(stateOpt.dataset.centroid);
                            if (centroid && centroid.coordinates) {
                                map.flyTo({ center: centroid.coordinates, zoom: 7 });
                            }
                        } catch (_) {}
                    }
                    if (stateId && stateId !== 'null' && stateId !== 'undefined') {
                        highlightTerritory(stateId);
                        const localData = await TerritoryService.fetchEventsByTerritory(stateId);
                        refreshMarkers('', localData);
                    } else {
                        highlightTerritory(null);
                        refreshMarkers(document.getElementById('map-search-input')?.value || '');
                    }
                } else {
                    highlightTerritory(null);
                    refreshMarkers(document.getElementById('map-search-input')?.value || '');
                }
                return;
            }

            const territoryId = selectedOpt.dataset.id;

            // Volar hacia el municipio o hacer zoom estimado
            if (selectedOpt.dataset.centroid && selectedOpt.dataset.centroid !== 'undefined') {
                try {
                    const centroid = JSON.parse(selectedOpt.dataset.centroid);
                    if (centroid && centroid.coordinates) {
                        map.flyTo({ center: centroid.coordinates, zoom: 11, essential: true });
                    }
                } catch (_) {}
            } else if (territoryId && territoryId !== 'null' && territoryId !== 'undefined') {
                // Municipio en BD sin centroide cacheado — obtener geometría y centrar en ella
                try {
                    const geoData = await TerritoryService.getGeometry(territoryId);
                    if (geoData?.geometry?.coordinates) {
                        const coords = geoData.geometry.coordinates[0][0];
                        if (Array.isArray(coords) && coords.length >= 2) {
                            map.flyTo({ center: coords, zoom: 11, essential: true });
                        }
                    }
                } catch (_) {
                    console.info('[Atlas] Sin centroide para municipio, manteniendo vista actual.');
                }
            } else if (parentSelectEstado && parentSelectEstado.value) {
                // Municipio de fallback estático sin centroide: acercar al estado con zoom 10 para dar feedback
                const stateOpt = parentSelectEstado.options[parentSelectEstado.selectedIndex];
                if (stateOpt && stateOpt.dataset.centroid) {
                    try {
                        const centroid = JSON.parse(stateOpt.dataset.centroid);
                        if (centroid && centroid.coordinates) {
                            map.flyTo({ center: centroid.coordinates, zoom: 10, essential: true });
                        }
                    } catch (_) {}
                }
            }

            const munName = selectedOpt.textContent;
            if (territoryId && territoryId !== 'null' && territoryId !== 'undefined') {
                highlightTerritory(territoryId);
                try {
                    const localData = await TerritoryService.fetchEventsByTerritory(territoryId);
                    refreshMarkers('', localData);
                } catch (e) { 
                    console.error('Error filtrando eventos por municipio:', e);
                    refreshMarkers(munName);
                }
            } else {
                highlightTerritory(null);
                refreshMarkers(munName);
            }
        };

        if (selectMunicipio) {
            selectMunicipio.addEventListener('change', () => handleMunicipioChange(selectMunicipio, drawerSelectMunicipio, selectEstado));
        }
        if (drawerSelectMunicipio) {
            drawerSelectMunicipio.addEventListener('change', () => handleMunicipioChange(drawerSelectMunicipio, selectMunicipio, drawerSelectEstado));
        }

    } catch (err) {
        console.error('[Atlas] Error configurando selectores:', err);
    }
}

let _mexicoGeoJSON = null;

// Función para pintar el área del territorio seleccionado de forma segura
async function highlightTerritory(territoryId, territoryName = null) {
    if (!map || !map.getSource('selected-territory')) return;

    if (!territoryName && (!territoryId || territoryId === 'null' || territoryId === 'undefined')) {
        map.getSource('selected-territory').setData({ 'type': 'FeatureCollection', 'features': [] });
        return;
    }

    try {
        // 1. Intentar con el GeoJSON local (super rápido y sin costo de BD)
        if (territoryName) {
            if (!_mexicoGeoJSON) {
                try {
                    const res = await fetch('./assets/data/mexico-estados.geojson').catch(() => fetch('/assets/data/mexico-estados.geojson'));
                    if (res && res.ok) {
                        const text = await res.text();
                        if (text && text.startsWith('{')) {
                            _mexicoGeoJSON = JSON.parse(text);
                        }
                    }
                } catch (e) {
                    console.info('[Atlas] GeoJSON local no resuelto en esta ruta, usando fallback a Supabase.');
                }
            }
            if (_mexicoGeoJSON && _mexicoGeoJSON.features) {
                // Buscar por nombre parcial o exacto
                const normalizedName = territoryName.toLowerCase().trim();
                const feature = _mexicoGeoJSON.features.find(f => {
                    const propName = (f.properties.name || f.properties.nomgeo || '').toLowerCase();
                    return propName === normalizedName || 
                           normalizedName.includes(propName) || 
                           propName.includes(normalizedName.replace(' de ', ' '));
                });
                if (feature) {
                    map.getSource('selected-territory').setData({
                        'type': 'FeatureCollection',
                        'features': [feature]
                    });
                    return; // Listo, no necesitamos BD
                }
            }
        }

        // 2. Fallback a Supabase si tenemos un ID real y no lo encontró en el GeoJSON local
        if (territoryId && territoryId !== 'null' && territoryId !== 'undefined') {
            const data = await TerritoryService.getGeometry(territoryId);
            if (data) {
                map.getSource('selected-territory').setData(data);
                return;
            }
        }
        
        // Limpiar si no se encontró nada
        map.getSource('selected-territory').setData({ 'type': 'FeatureCollection', 'features': [] });

    } catch (err) {
        console.warn('[Atlas] Geometría no disponible para este territorio:', err.message);
        map.getSource('selected-territory').setData({ 'type': 'FeatureCollection', 'features': [] });
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

let _mapaInitialized = false;
function initMapaPage() {
    if (_mapaInitialized) return;
    _mapaInitialized = true;
    initMap();
    setupControls();
    setupTerritorySelectors();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMapaPage);
} else {
    initMapaPage();
}

function initMap() {
    map = new maplibregl.Map({
        container: 'map-container',
        // Estilo Plano CartoDB Voyager - Público, con soporte CORS nativo y alta disponibilidad
        style: {
            'version': 8,
            'sources': {
                'carto-tiles': {
                    'type': 'raster',
                    'tiles': [
                        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
                    ],
                    'tileSize': 256,
                    'attribution': '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                }
            },
            'layers': [
                {
                    'id': 'carto-layer',
                    'type': 'raster',
                    'source': 'carto-tiles',
                    'minzoom': 0,
                    'maxzoom': 20
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
            if (window.resetMapFilters) {
                window.resetMapFilters();
            } else {
                refreshMarkers();
                map.flyTo({ center: defaultLocation, zoom: 5 });
                highlightTerritory(null);
            }
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
            const { data: eventos } = await supabase.from('eventos').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion, fecha_inicio');
            allData = [
                ...(lugares || []).map(l => ({ ...l, tipo: 'lugar' })),
                ...(eventos || []).map(e => ({ ...e, tipo: 'evento' }))
            ];
        }

        if (filterText) {
            allData = allData.filter(item => 
                item.nombre.toLowerCase().includes(filterText.toLowerCase()) ||
                (item.categoria && item.categoria.toLowerCase().includes(filterText.toLowerCase())) ||
                (item.ubicacion && item.ubicacion.toLowerCase().includes(filterText.toLowerCase()))
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
            async (position) => {
                const { latitude, longitude } = position.coords;
                const pos = [longitude, latitude];

                map.flyTo({ center: pos, zoom: 13, speed: 1.5, curve: 1 });

                if (userMarker) {
                    userMarker.setLngLat(pos);
                } else {
                    userMarker = new maplibregl.Marker({ color: '#0077b6', scale: 0.8 })
                        .setLngLat(pos)
                        .addTo(map);
                }

                // Guardar coordenadas globales para el carrusel
                userCoords = { lat: latitude, lng: longitude };

                // === AUTO-DETECCIÓN DE ESTADO POR UBICACIÓN ===
                try {
                    const detectedState = await TerritoryService.detectStateFromCoords(latitude, longitude);
                    if (detectedState) {
                        console.log(`[Atlas] 📍 Estado detectado: ${detectedState.name} (${detectedState.code})`);

                        // Sincronizar ambos selectores (barra superior y cajón móvil)
                        const selEst = document.getElementById('select-estado');
                        const dSelEst = document.getElementById('drawer-select-estado');
                        if (selEst) selEst.value = detectedState.code;
                        if (dSelEst) dSelEst.value = detectedState.code;

                        // Cargar municipios lazy para este estado
                        const municipios = await TerritoryService.getMunicipalities(detectedState.code);
                        const selMun = document.getElementById('select-municipio');
                        const dSelMun = document.getElementById('drawer-select-municipio');

                        [selMun, dSelMun].forEach(sel => {
                            if (!sel) return;
                            sel.innerHTML = '<option value="">Municipio / Delegación</option>';
                            municipios.forEach(mun => {
                                const opt = document.createElement('option');
                                opt.value = mun.key;
                                opt.textContent = mun.name;
                                opt.dataset.id = mun.id || '';
                                if (mun.centroid) opt.dataset.centroid = JSON.stringify(mun.centroid);
                                sel.appendChild(opt);
                            });
                            sel.disabled = municipios.length === 0;
                        });

                        // Resaltar polígono instantáneamente con el GeoJSON local
                        highlightTerritory(detectedState.id || null, detectedState.name);

                        // Refrescar marcadores filtrados por estado si tiene ID en BD, o textualmente por nombre si es fallback
                        if (detectedState.id) {
                            try {
                                const localData = await TerritoryService.fetchEventsByTerritory(detectedState.id);
                                refreshMarkers('', localData);
                            } catch (_) {
                                refreshMarkers(detectedState.name);
                            }
                        } else {
                            refreshMarkers(detectedState.name);
                        }
                    } else {
                        refreshMarkers(document.getElementById('map-search-input')?.value || '');
                    }
                } catch (err) {
                    console.warn('[Atlas] Error detectando estado:', err);
                    refreshMarkers(document.getElementById('map-search-input')?.value || '');
                }

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
        card.style.position = 'relative'; // Garantizar contención del badge absoluto
        
        let distHtml = '';
        if (userCoords && item.lat && item.lng) {
            const d = calcularDistancia(userCoords.lat, userCoords.lng, item.lat, item.lng);
            if (isFinite(d)) {
                distHtml = `<p class="map-event-dist" style="color:#fde047; font-weight:700; margin-top:2px;"><i class="fa-solid fa-person-walking"></i> A ${d.toFixed(1)} km</p>`;
            }
        }

        // Fecha en la esquina superior izquierda flotando
        let dateBadge = '';
        const fTarget = item.fecha_inicio || item.fecha;
        if (fTarget) {
            try {
                const d = new Date(fTarget);
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                dateBadge = `<span style="position:absolute; top:4px; left:4px; background:rgba(15,20,25,0.85); color:#5bc2f7; font-size:0.65rem; font-weight:700; padding:2px 6px; border-radius:10px; border:1px solid rgba(91,194,247,0.3); z-index:2;"><i class="fa-regular fa-calendar"></i> ${d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}</span>`;
            } catch(e){}
        }

        card.innerHTML = `
            ${dateBadge}
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

let _uiEventsInitialized = false;
function setupUIEventsMapa() {
    if (_uiEventsInitialized) return;
    _uiEventsInitialized = true;

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
        prevBtn.addEventListener('click', () => {
            const amt = window.innerWidth <= 768 ? 155 : 310;
            carousel.scrollBy({ left: -amt, behavior: 'smooth' });
        });
        nextBtn.addEventListener('click', () => {
            const amt = window.innerWidth <= 768 ? 155 : 310;
            carousel.scrollBy({ left: amt, behavior: 'smooth' });
        });
    }

    // --- PANEL DE FILTROS (abrir/cerrar) ---
    const filterBtn = document.getElementById('filter-btn');
    const filterPanel = document.getElementById('filter-panel');
    const filterBackdrop = document.getElementById('filter-backdrop');
    const drawerCloseBtn = document.getElementById('drawer-close-btn');

    if (filterBtn && filterPanel) {
        filterBtn.addEventListener('click', () => filterPanel.classList.toggle('open'));
        if (filterBackdrop) filterBackdrop.addEventListener('click', () => filterPanel.classList.remove('open'));
        if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', () => filterPanel.classList.remove('open'));
    }

    // Función auxiliar para limpiar selectores duales
    const resetDualSelects = () => {
        const selEst = document.getElementById('select-estado');
        const selMun = document.getElementById('select-municipio');
        const dSelEst = document.getElementById('drawer-select-estado');
        const dSelMun = document.getElementById('drawer-select-municipio');

        if (selEst) selEst.value = '';
        if (dSelEst) dSelEst.value = '';
        
        if (selMun) {
            selMun.innerHTML = '<option value="">Municipio / Delegación</option>';
            selMun.disabled = true;
        }
        if (dSelMun) {
            dSelMun.innerHTML = '<option value="">Selecciona un estado primero</option>';
            dSelMun.disabled = true;
        }
    };

    // --- CHIPS DE REGIÓN ---
    document.querySelectorAll('.region-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
            const isActive = chip.classList.contains('active');
            document.querySelectorAll('.region-chip').forEach(c => c.classList.remove('active'));

            if (isActive) {
                refreshMarkers('');
                return;
            }

            chip.classList.add('active');
            const regionId = chip.dataset.region;

            try {
                const regionData = await TerritoryService.fetchEventsByRegion(regionId);
                refreshMarkers(null, regionData);
                resetDualSelects();
                highlightTerritory(null);
            } catch (e) {
                console.error('Error filtrando por región:', e);
            }
        });
    });

    // Función global para resetear el mapa
    window.resetMapFilters = () => {
        document.querySelectorAll('.region-chip').forEach(c => c.classList.remove('active'));
        resetDualSelects();
        highlightTerritory(null);
        if (map) map.flyTo({ center: defaultLocation, zoom: 5 });
        refreshMarkers('');
        if (filterPanel) filterPanel.classList.remove('open');
    };

    // --- LIMPIAR FILTROS ---
    const clearBtn = document.getElementById('filter-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', window.resetMapFilters);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUIEventsMapa);
} else {
    setupUIEventsMapa();
}
