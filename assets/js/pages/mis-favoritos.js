import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver, showLoader, showErrorState } from '../ui-utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    setupNavbar();
    setupAuthObserver();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../auth.html?tab=login';
        return;
    }

    initTabs();
    loadFavorites(session.user.id);
});

function initTabs() {
    const btns = document.querySelectorAll('.segment-btn');
    const contents = document.querySelectorAll('.tab-content');

    btns.forEach(btn => {
        btn.onclick = () => {
            btns.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        };
    });
}

async function loadFavorites(userId) {
    const containers = {
        eventos: document.getElementById('container-eventos'),
        lugares: document.getElementById('container-lugares'),
        actores: document.getElementById('container-actores')
    };

    // 1. Cargar Eventos y Lugares favoritos
    const { data: favs, error: favErr } = await supabase
        .from('favoritos')
        .select('*')
        .eq('user_id', userId);

    if (favErr) {
        showErrorState('container-eventos', 'Error al cargar favoritos.');
        return;
    }

    const eventIds = favs.filter(f => f.item_tipo === 'evento').map(f => f.item_id);
    const lugarIds = favs.filter(f => f.item_tipo === 'lugar').map(f => f.item_id);

    if (eventIds.length > 0) {
        const { data: events } = await supabase.from('eventos').select('*').in('id', eventIds);
        renderCards(events, containers.eventos, 'evento');
    } else {
        renderEmpty(containers.eventos, 'No has guardado eventos aún.', 'fa-calendar-xmark');
    }

    if (lugarIds.length > 0) {
        const { data: places } = await supabase.from('lugares').select('*').in('id', lugarIds);
        renderCards(places, containers.lugares, 'lugar');
    } else {
        renderEmpty(containers.lugares, 'No has guardado lugares aún.', 'fa-map-location-dot');
    }

    // 2. Cargar Actores seguidos
    const { data: follows, error: followErr } = await supabase
        .from('seguimientos_actores')
        .select('actor_id')
        .eq('user_id', userId);

    const actorIds = follows?.map(f => f.actor_id) || [];

    if (actorIds.length > 0) {
        // Buscamos en perfiles para tener los datos básicos
        const { data: profiles } = await supabase.from('perfiles').select('*').in('id', actorIds);
        
        // Mapeamos directamente usando los perfiles
        const mappedActors = profiles.map(p => {
            return {
                ...p,
                agent_id: null // Ya no usamos ID de agente, solo ID de perfil
            };
        });

        renderActors(mappedActors, containers.actores);
    } else {
        renderEmpty(containers.actores, 'No sigues a ningún agente aún.', 'fa-user-slash');
    }
}

function renderCards(data, container, type) {
    container.innerHTML = '';
    data.forEach(p => {
        const detailPage = type === 'evento' ? 'eventos.html' : 'lugares.html';
        const html = `
            <article class="dash-card" onclick="window.location.href='/pages/${detailPage}?id=${p.id}'" style="cursor: pointer;">
                <div style="position:relative;">
                    <img src="${p.imagen_url || p.imagen || '/assets/img/kpop.webp'}" alt="${p.nombre}" class="dash-card-img" onerror="this.src='/assets/img/kpop.webp'">
                    <span class="badge-pill" style="position:absolute; top:10px; right:10px; background:var(--primary-color);">${type.toUpperCase()}</span>
                </div>
                <div class="dash-card-body">
                    <h3>${p.nombre}</h3>
                    <p style="margin-bottom: 10px;">${p.categoria || 'General'}</p>
                    <span style="color: var(--primary-color); font-size: 0.85rem;"><i class="fa-solid fa-location-dot"></i> ${p.alcaldia || 'CDMX'}</span>
                </div>
            </article>
        `;
        container.innerHTML += html;
    });
}

function renderActors(actors, container) {
    container.innerHTML = '';
    actors.forEach(actor => {
        const profileLink = actor.agent_id 
            ? `/pages/agente-detalle.html?id=${actor.agent_id}` 
            : `/pages/agente-detalle.html?actor_id=${actor.id}`;
            
        const html = `
            <article class="dash-card" onclick="window.location.href='${profileLink}'" style="cursor: pointer; text-align: center; padding: 30px 20px;">
                <img src="${actor.avatar_url || actor.imagen_url || '/assets/img/kpop.webp'}" style="width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 15px; border: 3px solid var(--primary-color); object-fit: cover;">
                <h3 style="margin-bottom: 5px; color: white; font-size: 1.2rem;">${actor.nombre_completo || actor.nombre || 'Agente'}</h3>
                <p style="color: var(--primary-color); font-size: 0.9rem;">${actor.especialidad || actor.rol || 'Líder Ambiental'}</p>
            </article>
        `;
        container.innerHTML += html;
    });
}

function renderEmpty(container, message, icon) {
    container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
            <i class="fa-solid ${icon}"></i>
            <h3>Aún no hay nada por aquí</h3>
            <p>${message}</p>
            <a href="../index.html" class="btn btn-outline">Explorar Catálogo</a>
        </div>
    `;
}
