/* assets/js/pages/agentes.js */
import { supabase } from '../supabase.js';
import { setupNavbar, showLoader, showErrorState, showEmptyState } from '../ui-utils.js';

async function initAgentes() {
    setupNavbar();
    const container = document.getElementById('agentes-container');
    if (!container) return;

    showLoader('agentes-container', 'Buscando líderes ambientales comunitarios...');

    try {
        const { data: agentes, error } = await supabase
            .from('agentes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        container.innerHTML = '';

        if (!agentes || agentes.length === 0) {
            showEmptyState('agentes-container', 'Aún no hay agentes registrados.');
            return;
        }

        agentes.forEach(agente => {
            const nombre = agente.nombre;
            const especialidad = agente.categoria || agente.especialidad || 'Ambientalista';
            const organizacion = agente.organizacion || 'Independiente';
            const imgUrl = agente.imagen || '/assets/img/kpop.webp';
            const zona = agente.zona || '';
            const alcaldia = agente.alcaldia || '';
            const descripcion = agente.descripcion || '';
            const mapsUrl = agente.mapa_url || '';

            // Redes Sociales
            let redesHtml = '';
            if (agente.redes_ig) redesHtml += `<a href="${agente.redes_ig}" target="_blank" title="Instagram"><i class="fa-brands fa-instagram"></i></a>`;
            if (agente.redes_fb) redesHtml += `<a href="${agente.redes_fb}" target="_blank" title="Facebook"><i class="fa-brands fa-facebook"></i></a>`;
            if (agente.redes_x) redesHtml += `<a href="${agente.redes_x}" target="_blank" title="X"><i class="fa-brands fa-x-twitter"></i></a>`;
            if (agente.redes_web) redesHtml += `<a href="${agente.redes_web}" target="_blank" title="Web"><i class="fa-solid fa-globe"></i></a>`;
            if (agente.redes_wa) redesHtml += `<a href="https://wa.me/${agente.redes_wa.replace(/\D/g,'')}" target="_blank" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`;

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
        console.error('Error fetching agentes:', error);
        showErrorState('agentes-container', 'Error al cargar agentes. Verifica tu conexión a la base de datos.');
    }
}

document.addEventListener('DOMContentLoaded', initAgentes);
