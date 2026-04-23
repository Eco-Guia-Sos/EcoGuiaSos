/* assets/js/dynamic-section-handler.js */
import { supabase } from './supabase.js';
import { sanitize, showToast } from './ui-utils.js';

/**
 * Inicializa una sección dinámica cargando su contenido y verificando permisos
 * @param {string} sectionId - ID de la sección (ej. 'agua', 'cursos')
 * @param {string} parentHub - ID del hub padre (ej. 'colibri', 'ajolote', 'lobo')
 */
export async function initDynamicSection(sectionId, parentHub) {
    console.log(`[DynamicSection] Cargando sección: ${sectionId} (Hub: ${parentHub})`);
    
    const container = document.querySelector('.card-grid-container');
    if (!container) return;

    // 1. Mostrar estado de carga
    container.innerHTML = '<p class="txt-loading">Cargando contenido dinámico...</p>';

    // 2. Cargar contenido desde la base de datos
    const { data: items, error } = await supabase
        .from('contenido_secciones')
        .select('*')
        .eq('seccion_id', sectionId)
        .eq('estado', 'publicado')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[DynamicSection] Error al cargar contenido:', error);
        container.innerHTML = '<p class="error-msg">Error al conectar con la base de datos.</p>';
        return;
    }

    // 3. Renderizar items
    renderItems(items, container);

    // 4. Verificar permisos para el botón "Proponer Contenido"
    setupActionButtons(sectionId, parentHub);
}

/**
 * Renderiza los items en el contenedor
 */
function renderItems(items, container) {
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="empty-msg">Aún no hay contenido en esta sección. ¡Sé el primero en proponer algo!</p>';
        return;
    }

    container.innerHTML = '';
    items.forEach(item => {
        const article = document.createElement('article');
        article.className = 'glass-card fade-in';
        
        // Estructura básica de tarjeta (similar a index.js pero adaptada)
        article.innerHTML = `
            ${item.imagen_url ? `
            <div class="card-img-container">
                <img src="${item.imagen_url}" alt="${sanitize(item.titulo)}">
            </div>` : ''}
            <div class="card-content">
                <h3>${sanitize(item.titulo)}</h3>
                <p>${sanitize(item.descripcion || '')}</p>
                ${item.enlace_externo ? `
                <div class="card-actions">
                    <a href="${item.enlace_externo}" target="_blank" class="btn btn-primary-small">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver más
                    </a>
                </div>` : ''}
            </div>
        `;
        container.appendChild(article);
    });
}

/**
 * Configura los botones de acción basados en el rol del usuario
 */
async function setupActionButtons(sectionId, parentHub) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Verificar rol en perfiles
    const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', session.user.id)
        .single();

    if (!perfil) return;

    const isAdmin = perfil.rol === 'admin';
    const isActor = perfil.rol === 'actor';

    if (isAdmin || isActor) {
        // Verificar si el actor tiene permiso específico para esta sección
        if (isActor) {
            const { data: permisos } = await supabase
                .from('permisos_actores')
                .select(`puede_editar_${sectionId}`)
                .eq('actor_id', session.user.id)
                .single();
            
            // Si no tiene permiso explícito y no es admin, no mostramos el botón
            if (!isAdmin && (!permisos || !permisos[`puede_editar_${sectionId}`])) {
                return;
            }
        }

        // Crear botón "Agregar Contenido" flotante o en el header
        addProposalButton(sectionId, parentHub);
    }
}

function addProposalButton(sectionId, parentHub) {
    const header = document.querySelector('.hero-glass-panel');
    if (!header) return;

    const btn = document.createElement('button');
    btn.className = 'btn btn-proposal shimmer-extra';
    btn.innerHTML = `<i class="fa-solid fa-plus-circle"></i> Agregar a esta sección`;
    btn.style = `
        margin-top: 15px;
        background: var(--color-eco);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 30px;
        cursor: pointer;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    btn.onclick = () => {
        window.location.href = `../admin.html?action=new&section=${sectionId}&hub=${parentHub}`;
    };

    header.appendChild(btn);
}
