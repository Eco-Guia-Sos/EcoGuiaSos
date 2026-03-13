/* assets/js/pages/ecotecnias.js */
import { fetchSheetData, getCellValue } from '../fetching.js';
import { setupNavbar, showLoader, showErrorState, showEmptyState } from '../ui-utils.js';

async function initEcotecnias() {
    setupNavbar();
    const container = document.getElementById('ecotecnias-container');
    if (!container) return;

    showLoader('ecotecnias-container', 'Cargando tecnologías sustentables...');

    try {
        const rows = await fetchSheetData('Ecotecnias');
        container.innerHTML = '';

        if (!rows || rows.length === 0) {
            showEmptyState('ecotecnias-container', 'Aún no hay ecotecnias registradas.');
            return;
        }

        // A:Nombre, B:Categoría, C:Icono_FA, D:Descripción, E:Beneficio
        rows.forEach(row => {
            if (!row || !row.c) return;

            const nombre = getCellValue(row, 0);
            if (!nombre) return;

            const categoria = getCellValue(row, 1, 'Ecotecnología');
            const icono = getCellValue(row, 2, 'fa-seedling');
            const desc = getCellValue(row, 3);
            const beneficio = getCellValue(row, 4);

            const cardHtml = `
                <article class="ecotecnia-card generic-card fade-in">
                    <div class="e-header">
                        <i class="fa-solid ${icono} e-icon"></i>
                        <h3 class="e-title">${nombre}</h3>
                    </div>
                    <p class="e-desc">${desc}</p>
                    <div class="e-tags">
                        <span class="e-tag">${categoria}</span>
                        ${beneficio ? `<span class="e-tag">${beneficio}</span>` : ''}
                    </div>
                </article>
            `;
            container.innerHTML += cardHtml;
        });
    } catch (error) {
        showErrorState('ecotecnias-container', 'Error al cargar ecotecnias.');
    }
}

document.addEventListener('DOMContentLoaded', initEcotecnias);
