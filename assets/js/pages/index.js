/* assets/js/pages/index.js */
import { setupNavbar } from '../ui-utils.js';
import { fetchSheetData, getCellValue } from '../fetching.js';

let todosLosProyectos = [];
let filtroActual = 'evento';

function initIndex() {
    setupNavbar();
    
    // Loader Handling
    const loader = document.getElementById('loader');
    if (loader) {
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }, 800);
    }

    iniciarParticulas();
    cargarDatosDeGoogleSheets();
    setupMapaToggle();
    setupMobileTooltips();

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

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker registrado:', reg.scope))
                .catch(err => console.log('Error al registrar Service Worker:', err));
        });
    }
}

import { supabase } from '../supabase.js';

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
        tipo: tipo
    };
}

function filtrarYRenderizar() {
    const buscadorInput = document.getElementById('buscador-input');
    const textoBuscador = buscadorInput ? buscadorInput.value.toLowerCase() : '';
    let datosFiltrados = todosLosProyectos.filter(p => p.tipo === filtroActual);

    if (textoBuscador) {
        datosFiltrados = datosFiltrados.filter(p =>
            p.nombre.toLowerCase().includes(textoBuscador) ||
            p.categoria.toLowerCase().includes(textoBuscador) ||
            p.ubicacion.toLowerCase().includes(textoBuscador)
        );
    }

    renderCards(datosFiltrados);
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
        const ubiHtml = p.mapa_url 
            ? `<a href="${p.mapa_url}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none;"><i class="fa-solid fa-location-dot"></i> ${p.ubicacion}</a>`
            : `<i class="fa-solid fa-location-dot"></i> ${p.ubicacion}`;

        const html = `
            <article class="card fade-in">
                <div class="card-image">
                    <img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='/assets/img/kpop.webp'">
                </div>
                <div class="card-content">
                    <span class="card-category">${p.categoria}</span>
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
    if (!btn || !mapaDiv) return;

    btn.addEventListener('click', () => {
        mapaDiv.classList.toggle('activo');
        if (mapaDiv.classList.contains('activo')) {
            btn.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> Ocultar Mapa de Actores';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> Mostrar Mapa de Actores';
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

document.addEventListener('DOMContentLoaded', initIndex);
