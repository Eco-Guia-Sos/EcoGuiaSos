/* assets/js/pages/cursos.js */
import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver, showLoader, showErrorState, showEmptyState } from '../ui-utils.js';
import { initDynamicSection } from '../dynamic-section-handler.js';

async function initCursos() {
    setupNavbar();
    setupAuthObserver();
    const container = document.getElementById('cursos-container');
    if (!container) return;

    // Inicializar contenido dinámico
    await initDynamicSection('cursos', 'colibri');

    showLoader('cursos-container', 'Buscando ofertas educativas...');

    try {
        const { data: cursos, error } = await supabase
            .from('cursos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        container.innerHTML = '';

        if (!cursos || cursos.length === 0) {
            showEmptyState('cursos-container', 'Aún no hay cursos programados.');
            return;
        }

        cursos.forEach(curso => {
            const organiza = curso.organiza || 'EcoGuía SOS';
            const fecha = curso.fecha || 'Por definir';
            const modalidad = curso.modalidad || 'Presencial';
            const img = curso.imagen || '/assets/img/colibri.webp';
            const link = curso.link || '#';
            const descHtml = curso.descripcion ? `<p class="c-desc">${curso.descripcion}</p>` : '';

            const cardHtml = `
                <article class="curso-card generic-card fade-in">
                    <img src="${img}" alt="${curso.nombre}" class="c-img" onerror="this.src='/assets/img/colibri.webp'">
                    <div class="c-content">
                        <h3>${curso.nombre}</h3>
                        <div class="c-info">
                            <span><i class="fa-solid fa-graduation-cap"></i> ${organiza}</span>
                        </div>
                        <div class="c-info">
                            <span><i class="fa-regular fa-calendar"></i> ${fecha}</span>
                            <span><i class="fa-solid fa-laptop-code"></i> ${modalidad}</span>
                        </div>
                        ${descHtml}
                        <a href="${link}" class="btn-action-main" target="_blank">Inscribirse</a>
                    </div>
                </article>
            `;
            container.innerHTML += cardHtml;
        });
    } catch (error) {
        console.error('Error fetching cursos:', error);
        showErrorState('cursos-container', 'Error al cargar cursos. Verifica tu conexión a la base de datos.');
    }
}

document.addEventListener('DOMContentLoaded', initCursos);
