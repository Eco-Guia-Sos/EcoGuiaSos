/* assets/js/pages/agente-detalle.js */
import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';

async function initAgentProfile() {
    setupNavbar();
    setupAuthObserver();

    const params = new URLSearchParams(window.location.search);
    const agentId = params.get('id');

    if (!agentId) {
        window.location.href = 'agentes.html';
        return;
    }

    const loader = document.getElementById('profile-loader');
    const content = document.getElementById('profile-content');

    try {
        // 1. Obtener datos del agente
        const { data: agente, error } = await supabase
            .from('agentes')
            .select('*')
            .eq('id', agentId)
            .single();

        if (error || !agente) throw new Error('Agente no encontrado');

        renderProfile(agente);

        // 1.1 Configurar botón de seguimiento si hay usuario_id
        if (agente.usuario_id) {
            setupFollowLogic(agente.usuario_id);
        }

        // 2. Cargar eventos vinculados si tiene usuario_id
        if (agente.usuario_id) {
            await loadAgentEvents(agente.usuario_id);
        } else {
            showNoEvents();
        }

        loader.style.display = 'none';
        content.style.display = 'block';

    } catch (err) {
        console.error('Error:', err);
        loader.innerHTML = `<h3><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar el perfil</h3><p>${err.message}</p>`;
    }
}

function renderProfile(agente) {
    document.title = `${agente.nombre} | EcoGuía SOS`;
    document.getElementById('agent-name').innerHTML = `${agente.nombre} ${agente.is_verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''}`;
    document.getElementById('agent-avatar').src = agente.imagen || '/assets/img/kpop.webp';
    document.getElementById('agent-banner').src = agente.banner_img || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2013&auto=format&fit=crop';
    document.getElementById('agent-specialty').innerText = `${agente.categoria || agente.especialidad || 'Agente de Cambio'} | ${agente.organizacion || 'Independiente'}`;
    document.getElementById('agent-desc').innerText = agente.descripcion || 'Sin descripción disponible.';
    document.getElementById('agent-location').innerText = agente.alcaldia || agente.zona || 'Varias zonas';
    document.getElementById('count-impact').innerText = agente.impacto_resumen || '--';

    if (agente.mision) {
        const misionBox = document.getElementById('agent-mision');
        misionBox.innerText = `"${agente.mision}"`;
        misionBox.style.display = 'block';
    }

    // Redes Sociales
    const socialContainer = document.getElementById('agent-socials');
    let redesHtml = '';
    if (agente.redes_ig) redesHtml += `<a href="${agente.redes_ig}" target="_blank"><i class="fa-brands fa-instagram"></i></a>`;
    if (agente.redes_fb) redesHtml += `<a href="${agente.redes_fb}" target="_blank"><i class="fa-brands fa-facebook"></i></a>`;
    if (agente.redes_x) redesHtml += `<a href="${agente.redes_x}" target="_blank"><i class="fa-brands fa-x-twitter"></i></a>`;
    if (agente.redes_web) redesHtml += `<a href="${agente.redes_web}" target="_blank"><i class="fa-solid fa-globe"></i></a>`;
    if (agente.redes_wa) redesHtml += `<a href="https://wa.me/${agente.redes_wa.replace(/\D/g,'')}" target="_blank"><i class="fa-brands fa-whatsapp"></i></a>`;
    
    socialContainer.innerHTML = redesHtml || '<p style="color: #666; font-size: 0.8rem;">Sin redes sociales vinculadas.</p>';
}

async function loadAgentEvents(userId) {
    const container = document.getElementById('agent-events-container');
    
    try {
        const { data: eventos, error } = await supabase
            .from('eventos')
            .select('*')
            .eq('owner_id', userId)
            .order('fecha_inicio', { ascending: false });

        if (error) throw error;

        if (!eventos || eventos.length === 0) {
            showNoEvents();
            return;
        }

        document.getElementById('count-events').innerText = eventos.length;
        container.innerHTML = '';

        eventos.forEach(ev => {
            container.innerHTML += `
                <article class="dash-card" onclick="window.location.href='eventos.html?id=${ev.id}'" style="cursor: pointer;">
                    <div style="position:relative;">
                        <img src="${ev.imagen || '/assets/img/kpop.webp'}" alt="${ev.nombre}" class="dash-card-img" onerror="this.src='/assets/img/kpop.webp'">
                    </div>
                    <div class="dash-card-body">
                        <h3>${ev.nombre}</h3>
                        <p style="color: var(--primary-color); font-size: 0.9rem;">${ev.categoria || 'Evento'}</p>
                    </div>
                </article>
            `;
        });

    } catch (err) {
        console.error('Error loading events:', err);
        showNoEvents();
    }
}

function showNoEvents() {
    document.getElementById('agent-events-container').innerHTML = `
        <div class="no-events" style="grid-column: 1 / -1;">
            <p>Este agente aún no ha publicado eventos o proyectos.</p>
        </div>
    `;
}

async function setupFollowLogic(actorId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const btn = document.getElementById('btn-follow-profile');
    if (!btn) return;

    const userId = session.user.id;
    btn.style.display = 'block';

    let isFollowing = false;
    const { data: followData } = await supabase
        .from('seguimientos_actores')
        .select('id')
        .eq('user_id', userId)
        .eq('actor_id', actorId)
        .single();

    if (followData) isFollowing = true;

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

    btn.onclick = async () => {
        if (isFollowing) {
            await supabase.from('seguimientos_actores').delete().eq('user_id', userId).eq('actor_id', actorId);
            isFollowing = false;
        } else {
            await supabase.from('seguimientos_actores').insert({ user_id: userId, actor_id: actorId });
            isFollowing = true;
        }
        updateUI(isFollowing);
    };
}

document.addEventListener('DOMContentLoaded', initAgentProfile);
