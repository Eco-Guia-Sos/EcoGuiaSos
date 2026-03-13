/* assets/js/pages/agentes.js */
import { fetchSheetData, getCellValue } from '../fetching.js';
import { setupNavbar, showLoader, showErrorState, showEmptyState } from '../ui-utils.js';

async function initAgentes() {
    setupNavbar();
    const container = document.getElementById('agentes-container');
    if (!container) return;

    showLoader('agentes-container', 'Buscando líderes ambientales comunitarios...');

    try {
        const rows = await fetchSheetData('Agentes');
        container.innerHTML = '';

        if (!rows || rows.length === 0) {
            showEmptyState('agentes-container', 'Aún no hay agentes registrados.');
            return;
        }

        // Columnas estandarizadas del nuevo Sheet (A-Q):
        // 0:Nombre, 1:Especialidad, 2:Org, 3:Foto, 4:Zona, 5:Alcaldia, 6:Estado, 
        // 7:Ig, 8:Fb, 9:Web, 10:Desc, 11:X, 12:LinkedIn, 13:YT, 14:TikTok, 15:WhatsApp, 16:Maps
        rows.forEach(row => {
            if (!row || !row.c) return;

            const nombre = getCellValue(row, 0);
            if (!nombre) return;

            const especialidad = getCellValue(row, 1, 'Ambientalista');
            const organizacion = getCellValue(row, 2, 'Independiente');
            const imgUrl = getCellValue(row, 3, '/assets/img/kpop.webp');
            const zona = getCellValue(row, 4);
            const alcaldia = getCellValue(row, 5);
            const descripcion = getCellValue(row, 10);
            const mapsUrl = getCellValue(row, 16);

            // Redes Sociales
            const redes = {
                ig: getCellValue(row, 7),
                fb: getCellValue(row, 8),
                web: getCellValue(row, 9),
                x: getCellValue(row, 11),
                li: getCellValue(row, 12),
                wa: getCellValue(row, 15)
            };

            let redesHtml = '';
            if (redes.ig) redesHtml += `<a href="${redes.ig}" target="_blank" title="Instagram"><i class="fa-brands fa-instagram"></i></a>`;
            if (redes.fb) redesHtml += `<a href="${redes.fb}" target="_blank" title="Facebook"><i class="fa-brands fa-facebook"></i></a>`;
            if (redes.x) redesHtml += `<a href="${redes.x}" target="_blank" title="X"><i class="fa-brands fa-x-twitter"></i></a>`;
            if (redes.li) redesHtml += `<a href="${redes.li}" target="_blank" title="LinkedIn"><i class="fa-brands fa-linkedin"></i></a>`;
            if (redes.wa) redesHtml += `<a href="https://wa.me/${redes.wa}" target="_blank" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`;
            if (redes.web) redesHtml += `<a href="${redes.web}" target="_blank" title="Web"><i class="fa-solid fa-globe"></i></a>`;

            const locText = mapsUrl
                ? `<a href="${mapsUrl}" target="_blank" class="agente-org" style="text-decoration:underline;"><i class="fa-solid fa-location-dot"></i> ${alcaldia || zona || 'Ver Mapa'}</a>`
                : `<div class="agente-org"><i class="fa-solid fa-location-dot"></i> ${alcaldia || zona || 'Varias zonas'}</div>`;

            const cardHtml = `
                <article class="agente-card generic-card fade-in" data-alcaldia="${alcaldia}" data-categoria="${especialidad}">
                    <img src="${imgUrl}" alt="${nombre}" class="agente-img" onerror="this.src='/assets/img/kpop.webp'">
                    <h3>${nombre}</h3>
                    <div class="agente-especialidad">${especialidad}</div>
                    <div class="agente-org"><i class="fa-solid fa-users"></i> ${organizacion}</div>
                    ${locText}
                    ${descripcion ? `<p class="agente-mini-desc">${descripcion}</p>` : ''}
                    <div class="agente-socials">
                        ${redesHtml}
                    </div>
                </article>
            `;
            container.innerHTML += cardHtml;
        });
    } catch (error) {
        showErrorState('agentes-container', 'Error al cargar agentes. Verifica el origen de datos.');
    }
}

document.addEventListener('DOMContentLoaded', initAgentes);
