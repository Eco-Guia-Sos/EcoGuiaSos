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
        // Estilo oscuro tipo MapCN/Shadcn
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: defaultLocation,
        zoom: 11,
        antialias: true
    });

    map.on('load', () => {
        loadMarkers();
    });

    // Add navigation controls (zoom, orientation)
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
}

async function loadMarkers() {
    try {
        const { data: lugares, error: e1 } = await supabase.from('lugares').select('*');
        const { data: eventos, error: e2 } = await supabase.from('eventos').select('*');

        if (e1 || e2) throw e1 || e2;

        const allData = [
            ...(lugares || []).map(l => ({ ...l, tipo: 'lugar' })),
            ...(eventos || []).map(e => ({ ...e, tipo: 'evento' }))
        ];

        allData.forEach(item => {
            if (item.ubicacion && item.ubicacion.lat && item.ubicacion.lng) {
                addMarker(item);
            }
        });

    } catch (err) {
        console.error('Error cargando marcadores:', err);
    }
}

function addMarker(item) {
    const isEvento = item.tipo === 'evento';
    const markerColor = isEvento ? '#ff4757' : '#2ed573';
    
    // Create a custom DOM element for the marker
    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.style.backgroundColor = markerColor;
    el.style.width = '14px';
    el.style.height = '14px';
    el.style.borderRadius = '50%';
    el.style.border = '2px solid rgba(255,255,255,0.8)';
    el.style.boxShadow = `0 0 15px ${markerColor}`;
    el.style.cursor = 'pointer';

    // Popup logic with "MapCN" style
    const popupHtml = `
        <div class="popup-card">
            <span class="badge" style="background: ${markerColor}22; color: ${markerColor}; margin-bottom: 8px; display: inline-block;">
                ${item.tipo.toUpperCase()}
            </span>
            <h3>${item.nombre}</h3>
            <p>${item.categoria || 'Sin categoría'}</p>
            <div style="display: flex; gap: 8px; margin-top: 10px;">
                <button class="popup-btn" onclick="window.location.href='/pages/${item.tipo}s.html?id=${item.id}'">
                    Ver más
                </button>
            </div>
        </div>
    `;

    const popup = new maplibregl.Popup({ offset: 25, closeButton: false })
        .setHTML(popupHtml);

    new maplibregl.Marker(el)
        .setLngLat([item.ubicacion.lng, item.ubicacion.lat])
        .setPopup(popup)
        .addTo(map);
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

            allData.forEach(item => {
                if (item.ubicacion && typeof item.ubicacion === 'object' && item.ubicacion.lat && item.ubicacion.lng) {
                    const m = addMarker(item);
                    markers.push(m);
                }
            });
        } catch (err) {
            console.error(err);
        }
    }

    searchInput.addEventListener('input', (e) => {
        const text = e.target.value;
        refreshMarkers(text);
    });

    // Initial load through this logic
    refreshMarkers();
}

function addMarker(item) {
    const isEvento = item.tipo === 'evento';
    const markerColor = isEvento ? '#ff4757' : '#2ed573';
    
    const el = document.createElement('div');
    el.className = 'custom-marker';
    // ... same style as before ...
    el.style.backgroundColor = markerColor;
    el.style.width = '14px';
    el.style.height = '14px';
    el.style.borderRadius = '50%';
    el.style.border = '2px solid rgba(255,255,255,0.8)';
    el.style.boxShadow = `0 0 15px ${markerColor}`;
    el.style.cursor = 'pointer';

    const popupHtml = `
        <div class="popup-card">
            <span class="badge" style="background: ${markerColor}22; color: ${markerColor}; margin-bottom: 8px; display: inline-block;">
                ${item.tipo.toUpperCase()}
            </span>
            <h3>${item.nombre}</h3>
            <p>${item.categoria || 'Sin categoría'}</p>
            <div style="display: flex; gap: 8px; margin-top: 10px;">
                <button class="popup-btn" onclick="window.location.href='/pages/${item.tipo}s.html?id=${item.id}'">
                    Ver más
                </button>
            </div>
        </div>
    `;

    const popup = new maplibregl.Popup({ offset: 25, closeButton: false })
        .setHTML(popupHtml);

    return new maplibregl.Marker(el)
        .setLngLat([item.ubicacion.lng, item.ubicacion.lat])
        .setPopup(popup)
        .addTo(map);
}
