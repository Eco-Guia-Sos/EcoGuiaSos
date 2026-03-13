/* assets/js/pages/voluntariados.js */
import { fetchSheetData, getCellValue, getCellFormattedValue } from '../fetching.js';
import { setupNavbar, showLoader, showErrorState, showEmptyState } from '../ui-utils.js';

async function initVoluntariados() {
    setupNavbar();
    const container = document.getElementById('voluntariados-container');
    if (!container) return;

    showLoader('voluntariados-container', 'Cargando voluntariados desde la base de datos...');

    try {
        const rows = await fetchSheetData('Voluntariados');
        container.innerHTML = '';

        if (!rows || rows.length === 0) {
            showEmptyState('voluntariados-container', 'Aún no hay voluntariados registrados. ¡Vuelve pronto!');
            return;
        }

        // A:Nombre_Actividad, B:Lugar, C:Fecha (date), D:Imagen_URL, E:Link_Registro, F:Maps_URL
        rows.forEach(row => {
            if (!row || !row.c) return;

            const nombre = getCellValue(row, 0);
            if (!nombre) return;

            const lugar = getCellValue(row, 1, 'Ubicación por confirmar');
            const fecha = getCellFormattedValue(row, 2, 'Próximamente');
            const imgUrl = getCellValue(row, 3, '/assets/img/ajolote.webp');
            const link = getCellValue(row, 4, '#');
            const mapsUrl = getCellValue(row, 5);

            const lugarHtml = mapsUrl
                ? `<a href="${mapsUrl}" target="_blank" style="color:#ccc; text-decoration:underline;">${lugar}</a>`
                : lugar;

            const cardHtml = `
                <article class="voluntariado-card generic-card fade-in">
                    <img src="${imgUrl}" alt="${nombre}" class="v-img" onerror="this.src='/assets/img/ajolote.webp'">
                    <div class="v-content">
                        <h3>${nombre}</h3>
                        <div class="v-tag"><i class="fa-solid fa-location-dot"></i> ${lugarHtml}</div>
                        <div class="v-tag"><i class="fa-regular fa-calendar"></i> ${fecha}</div>
                        <a href="${link}" class="btn-action-main" target="_blank" style="align-self: flex-start; margin-top: 15px;">Participar</a>
                    </div>
                </article>
            `;
            container.innerHTML += cardHtml;
        });
    } catch (error) {
        showErrorState('voluntariados-container', 'Hubo un error cargando los datos de voluntariados.');
    }
}

document.addEventListener('DOMContentLoaded', initVoluntariados);
