import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver, showLoader, showErrorState, sanitize } from '../ui-utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    setupNavbar();
    setupAuthObserver();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../auth.html?tab=login';
        return;
    }

    initTabs();
    
    // Captura nativa de coordenadas si no están guardadas, para que aparezcan siempre las distancias
    const checkAndLoad = () => loadFavorites(session.user.id);
    if (!localStorage.getItem('eco_user_coords') && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                localStorage.setItem('eco_user_coords', JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
                checkAndLoad();
            },
            () => checkAndLoad(),
            { enableHighAccuracy: false, timeout: 5000 }
        );
    } else {
        checkAndLoad();
    }
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
        // Enriquecemos la consulta trayendo datos del dueño si es posible
        const { data: events } = await supabase
            .from('eventos')
            .select('*, perfiles!owner_id(nombre_completo)')
            .in('id', eventIds);
        renderCards(events || [], containers.eventos, 'evento');
    } else {
        renderEmpty(containers.eventos, 'No has guardado eventos aún.', 'fa-calendar-xmark');
    }

    if (lugarIds.length > 0) {
        const { data: places } = await supabase.from('lugares').select('*').in('id', lugarIds);
        renderCards(places || [], containers.lugares, 'lugar');
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
        const { data: profiles } = await supabase.from('perfiles').select('*').in('id', actorIds);
        
        const mappedActors = (profiles || []).map(p => {
            return {
                ...p,
                agent_id: null
            };
        });

        renderActors(mappedActors, containers.actores);
    } else {
        renderEmpty(containers.actores, 'No sigues a ningún agente aún.', 'fa-user-slash');
    }
}

// Función auxiliar de proximidad en vivo mediante fórmula de Haversine
function calcularDistanciaLocal(lat2, lon2) {
    const userCoordsStr = sessionStorage.getItem('eco_user_coords') || localStorage.getItem('eco_user_coords');
    if (!userCoordsStr || !lat2 || !lon2) return null;
    try {
        const coords = JSON.parse(userCoordsStr);
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - coords.lat) * Math.PI / 180;
        const dLon = (lon2 - coords.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(coords.lat * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    } catch(e) { return null; }
}

function renderCards(data, container, type) {
    container.innerHTML = '';
    data.forEach(p => {
        const detailPage = type === 'evento' ? 'eventos.html' : 'lugares.html';
        
        // Formato premium de la fecha
        let fTxt = '';
        if (p.fecha_inicio) {
            try {
                const d = new Date(p.fecha_inicio);
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                fTxt = `<span style="color:#5bc2f7; font-size:0.8rem; display:block; margin-bottom:5px; font-weight:600;"><i class="fa-regular fa-calendar" style="margin-right:4px;"></i>${d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>`;
            } catch(e){}
        }

        // Nombre del actor responsable
        const actorName = p.perfiles?.nombre_completo || p.actor_nombre || '';
        const actorHtml = actorName ? `<span style="color:#a7f3d0; font-size:0.8rem; display:block; margin-bottom:5px; font-weight:600;"><i class="fa-solid fa-user-pen" style="margin-right:4px;"></i>Por: ${sanitize(actorName)}</span>` : '';

        // Cálculo de distancia local
        const dist = calcularDistanciaLocal(p.lat, p.lng);
        const distHtml = dist !== null ? `<span style="color:#fde047; font-size:0.8rem; font-weight:600; float:right;"><i class="fa-solid fa-route"></i> a ${dist.toFixed(1)} km</span>` : '';

        const html = `
            <article class="dash-card" onclick="window.location.href='/pages/${detailPage}?id=${p.id}'" style="cursor: pointer;">
                <div style="position:relative;">
                    <img src="${p.imagen_url || p.imagen || '/assets/img/kpop.webp'}" alt="${sanitize(p.nombre)}" class="dash-card-img" onerror="this.src='/assets/img/kpop.webp'">
                    <span class="badge-pill" style="position:absolute; top:10px; right:10px; background:var(--primary-color);">${type.toUpperCase()}</span>
                </div>
                <div class="dash-card-body">
                    <h3 style="margin-bottom:6px;">${sanitize(p.nombre)}</h3>
                    ${fTxt}
                    ${actorHtml}
                    <p style="margin-bottom: 10px; font-size:0.85rem; color:#aaa;">${sanitize(p.categoria || 'General')}</p>
                    <div style="overflow:hidden; margin-top:4px;">
                        <span style="color: var(--primary-color); font-size: 0.85rem;"><i class="fa-solid fa-location-dot"></i> ${sanitize(p.alcaldia || 'CDMX')}</span>
                        ${distHtml}
                    </div>
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
                <h3 style="margin-bottom: 5px; color: white; font-size: 1.2rem;">${sanitize(actor.nombre_completo || actor.nombre || 'Agente')}</h3>
                <p style="color: var(--primary-color); font-size: 0.9rem;">${sanitize(actor.especialidad || actor.rol || 'Líder Ambiental')}</p>
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
