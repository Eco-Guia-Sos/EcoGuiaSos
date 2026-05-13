/* DETALLES.JS - Lógica de carga dinámica (Estilo CDMX) */
import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver, sanitize } from '../ui-utils.js';

let mapHandle = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. UI Essentials
    setupNavbar();
    setupAuthObserver();

    // 2. Extraer parámetros de URL
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const type = window.location.pathname.includes('eventos') ? 'evento' : 'lugar';

    if (!id) {
        showError("No se proporcionó un identificador de proyecto.");
        return;
    }

    // 3. Cargar datos de Supabase
    await loadData(id, type);

    // 4. Lógica de favoritos y seguimiento (requiere sesión)
    setupSocialActions(id, type);
});

async function loadData(id, type) {
    const loader = document.getElementById('detail-loader');
    const content = document.getElementById('detail-main-content');
    const tableName = type === 'evento' ? 'eventos' : 'lugares';

    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            showError("No encontramos el proyecto solicitado.");
            return;
        }

        // 4. Inyectar datos en el DOM
        renderData(data, type);

        // Sub-eventos si es lugar
        if (type === 'lugar') {
            await loadSubEvents(id);
        }

        // 5. Mostrar contenido
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
            content.classList.remove('hidden');
            // Inicializar mapa después de mostrar el contenedor
            initMiniMap(data);
        }, 500);

    } catch (err) {
        console.error("Error cargando detalles:", err);
        showError("Ocurrió un error inesperado.");
    }
}

async function loadSubEvents(lugarId) {
    const section = document.getElementById('sub-events-section');
    const container = document.getElementById('detail-sub-events');
    if (!section || !container) return;

    try {
        const { data: eventos, error } = await supabase
            .from('eventos')
            .select('id, nombre, imagen, fecha_inicio')
            .eq('lugar_id', lugarId)
            .order('fecha_inicio', { ascending: true }); // Futuros eventos

        if (error || !eventos || eventos.length === 0) {
            section.style.display = 'none';
            return;
        }

        container.innerHTML = '';
        eventos.forEach(ev => {
            let fTxt = 'Próximamente';
            if(ev.fecha_inicio) {
                const d = new Date(ev.fecha_inicio);
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                fTxt = d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            }

            const evImg = ev.imagen_url || ev.imagen || '/assets/img/kpop.webp';

            container.innerHTML += `
                <div class="mini-event-card hover-glow" onclick="window.location.href='/pages/eventos.html?id=${ev.id}'" style="min-width: 160px; max-width: 180px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; cursor: pointer; transition: 0.3s; padding-bottom: 5px;">
                    <div style="height: 100px; width: 100%; overflow: hidden;">
                        <img src="${evImg}" style="width: 100%; height: 100%; object-fit: cover; transition: 0.3s;" alt="${sanitize(ev.nombre)}" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                    </div>
                    <div style="padding: 12px;">
                        <h4 style="font-size: 0.9rem; margin: 0 0 6px 0; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${sanitize(ev.nombre)}">${sanitize(ev.nombre)}</h4>
                        <p style="font-size: 0.75rem; color: #5bc2f7; margin: 0; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${fTxt}</p>
                    </div>
                </div>
            `;
        });
        
        section.style.display = 'block';

    } catch (e) {
        console.error("Error loading sub events:", e);
    }
}

function renderData(item, type) {
    // Hero Info
    document.title = `${item.nombre} - EcoGuía SOS`;
    document.getElementById('detail-title').innerText = item.nombre;
    const breadcrumb = document.getElementById('breadcrumb-current');
    if (breadcrumb) breadcrumb.innerText = item.nombre;
    
    // Slider de imágenes
    const track = document.getElementById('slider-track');
    const btnPrev = document.getElementById('slider-prev');
    const btnNext = document.getElementById('slider-next');
    const dotsContainer = document.getElementById('slider-dots');
    
    // Determinar las imágenes (prioriza array 'imagenes', fallback a 'imagen_url')
    let images = item.imagenes || [];
    if (!Array.isArray(images)) images = [];
    if (images.length === 0 && (item.imagen_url || item.imagen)) {
        images.push(item.imagen_url || item.imagen);
    }
    if (images.length === 0) {
        images.push('/assets/img/kpop.webp'); // Default
    }

    // Inicializar slider
    if (track) {
        track.innerHTML = '';
        if (dotsContainer) dotsContainer.innerHTML = '';
        
        images.forEach((imgUrl, i) => {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.flexShrink = '0';
            track.appendChild(img);

            if (dotsContainer && images.length > 1) {
                const dot = document.createElement('div');
                dot.style.width = '8px';
                dot.style.height = '8px';
                dot.style.borderRadius = '50%';
                dot.style.background = i === 0 ? 'white' : 'rgba(255,255,255,0.4)';
                dot.style.cursor = 'pointer';
                dot.style.transition = '0.3s';
                dot.onclick = () => goToSlide(i);
                dotsContainer.appendChild(dot);
            }
        });

        let currentSlide = 0;
        const goToSlide = (index) => {
            currentSlide = index;
            track.style.transform = `translateX(-${index * 100}%)`;
            if (dotsContainer) {
                Array.from(dotsContainer.children).forEach((dot, i) => {
                    dot.style.background = i === currentSlide ? 'white' : 'rgba(255,255,255,0.4)';
                });
            }
        };

        if (images.length > 1) {
            if (btnPrev) {
                btnPrev.style.display = 'flex';
                btnPrev.onclick = () => {
                    if (currentSlide > 0) goToSlide(currentSlide - 1);
                    else goToSlide(images.length - 1); // Loop
                };
            }
            if (btnNext) {
                btnNext.style.display = 'flex';
                btnNext.onclick = () => {
                    if (currentSlide < images.length - 1) goToSlide(currentSlide + 1);
                    else goToSlide(0); // Loop
                };
            }
        }
    }

    document.getElementById('hero-bg-blur').style.backgroundImage = `url('${images[0]}')`;
    
    const badge = document.getElementById('detail-type-badge');
    badge.innerText = type === 'evento' ? 'EVENTO ECOLÓGICO' : 'LUGAR SUSTENTABLE';
    badge.style.background = type === 'evento' ? 'var(--color-gaia)' : 'var(--color-eco)';

    document.getElementById('detail-category').innerText = item.categoria || 'General';
    
    // Description
    const desc = document.getElementById('detail-description');
    desc.innerHTML = item.descripcion ? sanitize(item.descripcion).replace(/\n/g, '<br>') : 'Sin descripción detallada por el momento.';

    // Fechas y Horarios (Estructurados o Antiguos)
    const hours = document.getElementById('detail-hours');
    if (item.fecha_inicio) {
        // Formato para que se lea: "Jueves 24 de Octubre de 2024, 14:00"
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const dInicio = new Date(item.fecha_inicio);
        
        let textoFecha = `<span style="text-transform: capitalize;">${dInicio.toLocaleDateString('es-MX', options)}</span>`;
        
        if (item.fecha_fin) {
            const dFin = new Date(item.fecha_fin);
            textoFecha += `<br><span style="font-size: 0.85em; color: var(--text-muted); display:block; margin-top:5px;">Termina: <span style="text-transform: capitalize;">${dFin.toLocaleDateString('es-MX', options)}</span></span>`;
        }
        hours.innerHTML = textoFecha;
    } else {
        hours.innerText = item.horarios || 'Consulte disponibilidad directamente en el recinto.';
    }

    // Sidebar Info
    document.getElementById('detail-location-name').innerText = item.nombre;
    document.getElementById('detail-address').innerText = item.ubicacion || 'Dirección no especificada';
    
    // Maps Link
    const gmapsBtn = document.getElementById('btn-google-maps');
    if(item.lat && item.lng) {
        gmapsBtn.href = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
    } else {
        gmapsBtn.classList.add('disabled');
    }

    // Share Button
    document.getElementById('btn-share').onclick = () => shareContent(item);
    document.getElementById('mobile-btn-share').onclick = () => shareContent(item);

    // Redes Sociales Dinámicas
    const socialContainer = document.getElementById('detail-social-links');
    if (socialContainer) {
        socialContainer.innerHTML = '';
        const networks = [
            { key: 'social_web', class: 'web', icon: 'fa-solid fa-globe', title: 'Sitio Web' },
            { key: 'social_fb', class: 'facebook', icon: 'fa-brands fa-facebook' },
            { key: 'social_ig', class: 'instagram', icon: 'fa-brands fa-instagram' },
            { key: 'social_wa', class: 'whatsapp', icon: 'fa-brands fa-whatsapp' },
            { key: 'social_x', class: 'x-twitter', icon: 'fa-brands fa-x-twitter' },
            { key: 'social_yt', class: 'youtube', icon: 'fa-brands fa-youtube' }
        ];

        let hasSocial = false;
        networks.forEach(net => {
            if (item[net.key]) {
                hasSocial = true;
                const link = document.createElement('a');
                link.href = item[net.key];
                link.target = '_blank';
                link.className = `social-btn ${net.class}`;
                if (net.title) link.title = net.title;
                link.innerHTML = `<i class="${net.icon}"></i>`;
                socialContainer.appendChild(link);
            }
        });

        if (!hasSocial) {
            socialContainer.innerHTML = '<p style="color: #888; font-style: italic;">No hay redes registradas para este evento.</p>';
        }
    }
    // Lógica Botón Súmate Inteligente
    const btnSumate = document.getElementById('btn-sumate');
    const mobileBtnSumate = document.getElementById('mobile-btn-sumate');
    
    if (item.reg_link) {
        if (btnSumate) {
            btnSumate.style.display = 'flex';
            btnSumate.onclick = () => window.open(item.reg_link, '_blank');
        }
        if (mobileBtnSumate) {
            mobileBtnSumate.style.display = 'flex';
            mobileBtnSumate.onclick = () => window.open(item.reg_link, '_blank');
        }
    } else {
        if (btnSumate) btnSumate.style.display = 'none';
        if (mobileBtnSumate) mobileBtnSumate.style.display = 'none';
    }

    // Inyectar sección del Actor Publicador (si existe owner_id)
    if (item.owner_id) {
        renderActorSection(item.owner_id);
    }
}

async function renderActorSection(actorId) {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    try {
        const { data: actor, error } = await supabase
            .from('perfiles')
            .select('*')
            .eq('id', actorId)
            .single();

        if (error || !actor) return;

        // Simplificamos el link usando directamente el actorId
        const profileLink = `/pages/agente-detalle.html?actor_id=${actorId}`;

        const actorSection = document.createElement('section');
        actorSection.className = 'info-section actor-card-lite';
        actorSection.style = 'margin-top: 40px; padding: 20px; background: rgba(255,255,255,0.03); border-radius: 15px; border: 1px solid rgba(255,255,255,0.05);';
        
        actorSection.innerHTML = `
            <h3 style="font-size: 1.1rem; color: #888; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">Publicado por:</h3>
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                <img src="${actor.avatar_url || actor.imagen_url || '/assets/img/kpop.webp'}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary-color);">
                <div style="flex-grow: 1;">
                    <h4 style="margin: 0; color: white; font-size: 1.2rem;">${actor.nombre_completo || 'Agente de Cambio'}</h4>
                    <p style="margin: 3px 0 0 0; color: var(--primary-color); font-size: 0.9rem;">${actor.especialidad || 'Líder Ambiental'}</p>
                </div>
                <div style="display: flex; gap: 10px; margin-left: auto;">
                    <a href="${profileLink}" class="btn-ver-perfil-actor" style="padding: 10px 18px; font-size: 0.85rem; color: #72B04D; border: 1px solid #72B04D; border-radius: 30px; text-decoration: none; font-weight: 600; transition: all 0.3s ease;">Ver perfil</a>
                    <button id="btn-follow-actor" class="btn btn-primary" style="display: none; padding: 10px 18px; font-size: 0.85rem; border-radius: 30px;">+ Seguir</button>
                </div>
            </div>
            <style>
                .btn-ver-perfil-actor:hover {
                    background: #72B04D;
                    color: white !important;
                    box-shadow: 0 4px 12px rgba(114, 176, 77, 0.3);
                }
            </style>
        `;
        
        mainContent.appendChild(actorSection);
        
        // Verificar si el usuario ya lo sigue
        checkFollowStatus(actorId);

    } catch (e) {
        console.error("Error cargando sección del actor:", e);
    }
}

async function setupSocialActions(itemId, type) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const user = session.user;
    const btnFav = document.getElementById('btn-favorite');
    const mobileBtnFav = document.getElementById('mobile-btn-favorite');

    if (btnFav) btnFav.style.display = 'flex';
    if (mobileBtnFav) mobileBtnFav.style.display = 'flex';

    // 1. Estado inicial Favorito
    let isFavorite = false;
    const { data: favData } = await supabase
        .from('favoritos')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_id', itemId)
        .eq('item_tipo', type)
        .maybeSingle();

    if (favData) {
        isFavorite = true;
        updateFavoriteUI(true);
    }

    const toggleFavorite = async () => {
        if (isFavorite) {
            const { error } = await supabase.from('favoritos').delete().eq('id', favData?.id || (await getFavId(user.id, itemId, type)));
            if (!error) {
                isFavorite = false;
                updateFavoriteUI(false);
            }
        } else {
            const { data, error } = await supabase.from('favoritos').insert({
                user_id: user.id,
                item_id: itemId,
                item_tipo: type
            }).select().single();
            if (!error) {
                isFavorite = true;
                updateFavoriteUI(true);
            }
        }
    };

    if (btnFav) btnFav.onclick = toggleFavorite;
    if (mobileBtnFav) mobileBtnFav.onclick = toggleFavorite;
}

async function getFavId(userId, itemId, type) {
    const { data } = await supabase.from('favoritos').select('id').eq('user_id', userId).eq('item_id', itemId).eq('item_tipo', type).maybeSingle();
    return data?.id;
}

function updateFavoriteUI(active) {
    const btns = [document.getElementById('btn-favorite'), document.getElementById('mobile-btn-favorite')];
    btns.forEach(btn => {
        if (!btn) return;
        if (active) {
            btn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Guardado';
            btn.classList.add('active-fav'); // Necesitaremos CSS para esto
            btn.style.background = 'rgba(114, 176, 77, 0.2)';
            btn.style.borderColor = '#72B04D';
            btn.style.color = '#72B04D';
        } else {
            btn.innerHTML = '<i class="fa-regular fa-bookmark"></i> Guardar en Favoritos';
            btn.classList.remove('active-fav');
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
        }
    });
}

async function checkFollowStatus(actorId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const btnFollow = document.getElementById('btn-follow-actor');
    if (!btnFollow) return;
    btnFollow.style.display = 'block';

    let isFollowing = false;
    const { data: followData } = await supabase
        .from('seguimientos_actores')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('actor_id', actorId)
        .maybeSingle();

    if (followData) isFollowing = true;
    updateFollowUI(isFollowing);

    btnFollow.onclick = async () => {
        if (isFollowing) {
            await supabase.from('seguimientos_actores').delete().eq('user_id', session.user.id).eq('actor_id', actorId);
            isFollowing = false;
        } else {
            await supabase.from('seguimientos_actores').insert({ user_id: session.user.id, actor_id: actorId });
            isFollowing = true;
        }
        updateFollowUI(isFollowing);
    };
}

function updateFollowUI(active) {
    const btn = document.getElementById('btn-follow-actor');
    if (!btn) return;
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
}

function initMiniMap(item) {
    if (!item.lat || !item.lng) return;

    try {
        mapHandle = new maplibregl.Map({
            container: 'detail-mini-map',
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: [item.lng, item.lat],
            zoom: 15,
            interactive: false
        });

        new maplibregl.Marker({ color: '#72B04D' })
            .setLngLat([item.lng, item.lat])
            .addTo(mapHandle);

        // Mobile Map Button logic
        document.getElementById('mobile-btn-map').onclick = () => {
            window.open(`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`, '_blank');
        };
    } catch (e) {
        console.error("Error al cargar map en detalle:", e);
    }
}

function shareContent(item) {
    if (navigator.share) {
        navigator.share({
            title: item.nombre,
            text: `Mira este proyecto ecológico en EcoGuía SOS: ${item.nombre}`,
            url: window.location.href
        }).catch(err => console.log('Error compartiendo:', err));
    } else {
        navigator.clipboard.writeText(window.location.href);
        alert("¡Enlace copiado al portapapeles!");
    }
}

function showError(msg) {
    const loader = document.getElementById('detail-loader');
    loader.innerHTML = `
        <div style="text-align: center; color: white; padding: 20px;">
            <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; color: #ff4d4d; margin-bottom: 20px;"></i>
            <h2>¡Vaya! Algo salió mal</h2>
            <p>${msg}</p>
            <br>
            <a href="/index.html" class="btn btn-primary">Volver al inicio</a>
        </div>
    `;
}
