/* assets/js/pages/cursos.js */
import { fetchSheetData, getCellValue } from '../fetching.js';
import { setupNavbar, showLoader, showErrorState, showEmptyState } from '../ui-utils.js';

async function initCursos() {
    setupNavbar();
    const container = document.getElementById('cursos-container');
    if (!container) return;

    showLoader('cursos-container', 'Buscando ofertas educativas...');

    try {
        const rows = await fetchSheetData('Cursos');
        container.innerHTML = '';

        if (!rows || rows.length === 0) {
            showEmptyState('cursos-container', 'Aún no hay cursos programados.');
            return;
        }

        // A:Nombre, B:Organiza, C:Fecha, D:Modalidad, E:Descripción, F:Imagen, G:Link
        rows.forEach(row => {
            if (!row || !row.c) return;

            const nombre = getCellValue(row, 0);
            if (!nombre) return;

            const organiza = getCellValue(row, 1, 'EcoGuía SOS');
            // Nota: Para la fecha usamos el valor formateado si existe (f)
            const fecha = (row.c[2] && row.c[2].f) ? row.c[2].f : getCellValue(row, 2, 'Por definir');
            const modalidad = getCellValue(row, 3, 'Presencial');
            const desc = getCellValue(row, 4);
            const img = getCellValue(row, 5, '../assets/img/colibri.webp');
            const link = getCellValue(row, 6, '#');

            const cardHtml = `
                <article class="curso-card generic-card fade-in">
                    <img src="${img}" alt="${nombre}" class="c-img" onerror="this.src='/assets/img/colibri.webp'">
                    <div class="c-content">
                        <h3>${nombre}</h3>
                        <div class="c-info">
                            <span><i class="fa-solid fa-graduation-cap"></i> ${organiza}</span>
                        </div>
                        <div class="c-info">
                            <span><i class="fa-regular fa-calendar"></i> ${fecha}</span>
                            <span><i class="fa-solid fa-laptop-code"></i> ${modalidad}</span>
                        </div>
                        <p class="c-desc">${desc}</p>
                        <a href="${link}" class="btn-action-main" target="_blank">Inscribirse</a>
                    </div>
                </article>
            `;
            container.innerHTML += cardHtml;
        });
    } catch (error) {
        showErrorState('cursos-container', 'Error al cargar cursos. Verifica la pestaña "Cursos".');
    }
}

document.addEventListener('DOMContentLoaded', initCursos);
