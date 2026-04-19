/* assets/js/pages/voluntariados.js */
import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver, showLoader, showErrorState, showEmptyState } from '../ui-utils.js';

async function initVoluntariados() {
    setupNavbar();
    setupAuthObserver();
    const container = document.getElementById('voluntariados-container');
    if (!container) return;

    showLoader('voluntariados-container', 'Cargando voluntariados desde la base de datos...');

    try {
        const { data: voluntariados, error } = await supabase
            .from('voluntariados')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        container.innerHTML = '';

        if (!voluntariados || voluntariados.length === 0) {
            showEmptyState('voluntariados-container', 'Aún no hay voluntariados registrados. ¡Vuelve pronto!');
            return;
        }

        voluntariados.forEach(vol => {
            const nombre = vol.nombre;
            const lugar = vol.ubicacion || 'Ubicación por confirmar';
            const fecha = vol.fecha || 'Próximamente';
            const imgUrl = vol.imagen || '/assets/img/ajolote.webp';
            const link = vol.link || '#';
            const mapsUrl = vol.mapa_url || ''; // Asumiendo que la columna existe o falla silenciosamente a undefined

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
        console.error('Error fetching voluntariados:', error);
        showErrorState('voluntariados-container', 'Hubo un error cargando los datos de voluntariados. Verifica la conexión.');
    }
}

document.addEventListener('DOMContentLoaded', initVoluntariados);
