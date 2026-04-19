/* assets/js/pages/mapa.js */
import { supabase } from '../supabase.js';

let map;
let userMarker;
const defaultLocation = [-99.1332, 19.4326]; // CDMX [lng, lat] for MapLibre

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupControls();
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

        allData.forEach((item, index) => {
            if (item.lat && item.lng) {
                const m = addMarker(item, index + 1);
                markers.push(m);
            }
        });
    } catch (err) {
        console.error(err);
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
                locateBtn.classList.remove('active');
            },
            (err) => {
                console.error(err);
                alert('No se pudo obtener su ubicación.');
                locateBtn.classList.remove('active');
            }
        );
    });

    const searchInput = document.getElementById('map-search');

    // La función refreshMarkers se movió al scope global

    searchInput.addEventListener('input', (e) => {
        const text = e.target.value;
        refreshMarkers(text);
    });

    // Carga inicial manejada en map.on('load')
}

function addMarker(item, index) {
    const isEvento = item.tipo === 'evento';
    
    const el = document.createElement('div');
    el.className = `numbered-marker ${isEvento ? 'type-evento' : ''}`;
    el.innerHTML = `<span>${index}</span>`;

    const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.lng, item.lat])
        .addTo(map);

    // Evento Click para abrir Panel Lateral
    el.addEventListener('click', (e) => {
        e.stopPropagation(); // Evitar que el clic se pase al mapa o cierre algo
        
        // Animación suave al marcador
        map.flyTo({
            center: [item.lng, item.lat],
            zoom: 16,
            essential: true,
            offset: [0, 0] // Puedes ajustar si quieres que no quede justo al centro
        });

        // Actualizar datos del Panel Lateral
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
    });

    return marker;
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
