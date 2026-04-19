/* assets/js/pages/agentes.js */
import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver, showLoader, showErrorState, showEmptyState } from '../ui-utils.js';

async function initAgentes() {
    setupNavbar();
    setupAuthObserver();
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
                <article class="agente-card generic-card fade-in hover-glow" 
                         onclick="window.location.href='agente-detalle.html?id=${agente.id}'" 
                         style="cursor:pointer"
                         data-alcaldia="${alcaldia}" 
                         data-categoria="${especialidad}">
                    <img src="${imgUrl}" alt="${nombre}" class="agente-img" loading="lazy" onerror="this.src='/assets/img/kpop.webp'">
                    <h3>${nombre}</h3>
                    <div class="agente-especialidad">${especialidad}</div>
                    <div class="agente-org"><i class="fa-solid fa-users"></i> ${organizacion}</div>
                    ${locText}
                    ${descripcion ? `<p class="agente-mini-desc">${descripcion}</p>` : ''}
                    <div class="agente-socials">
                        ${redesHtml}
                    </div>
                    <div class="agente-actions" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <button class="btn-follow-agente btn btn-primary" 
                                data-actor-id="${agente.usuario_id}" 
                                style="display: none; width: 100%; font-size: 0.85rem; padding: 8px;">
                            + Seguir
                        </button>
                    </div>
                </article>
            `;
            container.innerHTML += cardHtml;
        });

        // 3. Activar botones de seguimiento
        setupFollowButtons();

    } catch (error) {
        console.error('Error fetching agentes:', error);
        showErrorState('agentes-container', 'Error al cargar agentes. Verifica tu conexión a la base de datos.');
    }
}

async function setupFollowButtons() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const btns = document.querySelectorAll('.btn-follow-agente');
    const userId = session.user.id;

    // Cargar seguimientos actuales del usuario
    const { data: followings } = await supabase
        .from('seguimientos_actores')
        .select('actor_id')
        .eq('user_id', userId);

    const followingIds = new Set(followings?.map(f => f.actor_id) || []);

    btns.forEach(btn => {
        const actorId = btn.dataset.actorId;
        if (!actorId || actorId === 'null') return;

        btn.style.display = 'block';
        let isFollowing = followingIds.has(actorId);
        
        const updateUI = (active) => {
            if (active) {
                btn.innerHTML = '✓ Siguiendo';
                btn.style.background = '#333';
                btn.style.borderColor = '#72B04D';
                btn.style.color = '#72B04D';
            } else {
                btn.innerHTML = '+ Seguir';
                btn.style.background = '';
                btn.style.borderColor = '';
                btn.style.color = '';
            }
        };

        updateUI(isFollowing);

        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Evitar navegar al perfil al dar clic en seguir
            
            if (isFollowing) {
                await supabase.from('seguimientos_actores').delete().eq('user_id', userId).eq('actor_id', actorId);
                isFollowing = false;
            } else {
                await supabase.from('seguimientos_actores').insert({ user_id: userId, actor_id: actorId });
                isFollowing = true;
            }
            updateUI(isFollowing);
        });
    });
}

document.addEventListener('DOMContentLoaded', initAgentes);
