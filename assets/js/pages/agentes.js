import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver, sanitize } from '../ui-utils.js';

async function initAgentes() {
    setupNavbar();
    setupAuthObserver();
    
    const container = document.getElementById('agentes-container');
    if (!container) return;

    container.innerHTML = '<p class="txt-loading">Cargando agentes de cambio...</p>';

    try {
        // 1. Obtener perfiles que son actores
        const { data: perfiles, error: pError } = await supabase
            .from('perfiles')
            .select('*')
            .eq('rol', 'actor')
            .order('nombre_completo');

        if (pError) throw pError;

        // 2. Usamos solo perfiles (la tabla agentes no existe)
        const agentes = null;

        container.innerHTML = '';

        if (!perfiles || perfiles.length === 0) {
            container.innerHTML = '<p class="empty-msg">No se encontraron agentes registrados aún.</p>';
            return;
        }

        perfiles.forEach(perfil => {
            const agente = agentes ? agentes.find(a => a.usuario_id === perfil.id) : null;
            const name = perfil.nombre_completo || 'Agente de Cambio';
            const img = perfil.avatar_url || perfil.imagen_url || '../assets/img/kpop.webp';
            const specialty = agente ? (agente.especialidad || agente.categoria || 'Agente de Cambio') : 'Agente de Cambio';
            const org = agente ? (agente.organizacion || 'Independiente') : 'Participante';
            
            // Link de navegación: prefiere ID de agente si existe
            const link = agente ? `agente-detalle.html?id=${agente.id}` : `agente-detalle.html?actor_id=${perfil.id}`;

            const article = document.createElement('article');
            article.className = 'agente-card glass-card fade-in';
            article.style.cursor = 'pointer';
            article.onclick = () => window.location.href = link;
            
            article.innerHTML = `
                <img src="${img}" alt="${sanitize(name)}" class="agente-img" onerror="this.src='../assets/img/kpop.webp'">
                <h3>${sanitize(name)}</h3>
                <p class="agente-especialidad">${sanitize(specialty)}</p>
                <p class="agente-org">${sanitize(org)}</p>
                <p class="agente-mini-desc">${sanitize(agente ? agente.descripcion : (perfil.descripcion || 'Participante activo de la red EcoGuía SOS.'))}</p>
                <div class="agente-socials">
                    ${agente?.redes_ig ? `<a href="${agente.redes_ig}" target="_blank" onclick="event.stopPropagation();"><i class="fa-brands fa-instagram"></i></a>` : ''}
                    ${agente?.redes_fb ? `<a href="${agente.redes_fb}" target="_blank" onclick="event.stopPropagation();"><i class="fa-brands fa-facebook"></i></a>` : ''}
                    <a href="${link}" onclick="event.stopPropagation();"><i class="fa-solid fa-circle-info"></i></a>
                </div>
            `;
            container.appendChild(article);
        });

    } catch (err) {
        console.error('[Agentes] Error:', err);
        container.innerHTML = '<p class="error-msg">Error al cargar el directorio de agentes. Intente de nuevo más tarde.</p>';
    }
}

document.addEventListener('DOMContentLoaded', initAgentes);
