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

    // Inyectar estilos responsive si no existen
    if (!document.getElementById('dynamic-sections-styles')) {
        const style = document.createElement('style');
        style.id = 'dynamic-sections-styles';
        style.innerHTML = `
            .card-grid-container {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 25px;
                padding: 20px 0;
            }
            .glass-card {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                overflow: hidden;
                transition: all 0.3s ease;
            }
            .glass-card:hover {
                transform: translateY(-5px);
                background: rgba(255, 255, 255, 0.05);
                border-color: var(--primary-color);
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            .card-img-container {
                position: relative;
                height: 180px;
                overflow: hidden;
            }
            .card-img-container img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .card-badge {
                position: absolute;
                top: 15px;
                right: 15px;
                background: var(--primary-color);
                color: black;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            }
            @media (max-width: 768px) {
                .card-grid-container {
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 15px;
                }
                .card-meta-info {
                    gap: 5px !important;
                }
                .btn-proposal {
                    width: 100%;
                    justify-content: center;
                }
            }
        `;
        document.head.appendChild(style);
    }

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

        // Intentar extraer metadatos adicionales si es JSON
        let textoDescripcion = item.descripcion || '';
        let meta = {};
        try {
            if (textoDescripcion.trim().startsWith('{')) {
                meta = JSON.parse(textoDescripcion);
                textoDescripcion = meta.descripcion_texto || '';
            }
        } catch (e) { }

        // Estructura básica de tarjeta (Premium Look)
        article.innerHTML = `
            ${item.imagen_url ? `
            <div class="card-img-container">
                <img src="${item.imagen_url}" alt="${sanitize(item.titulo)}" onerror="this.src='/assets/img/colibri.webp'">
                ${meta.area || meta.ambito ? `<span class="card-badge">${sanitize(meta.area || meta.ambito)}</span>` : ''}
            </div>` : ''}
            <div class="card-content">
                <h3>${sanitize(item.titulo)}</h3>
                
                <div class="card-meta-info" style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 10px;">
                    <!-- Campos de Cursos -->
                    ${meta.institucion ? `<span><i class="fa-solid fa-building-columns"></i> ${sanitize(meta.institucion)}</span>` : ''}
                    ${meta.gratuito ? `<span><i class="fa-solid fa-tag"></i> ${sanitize(meta.gratuito)}</span>` : ''}
                    
                    <!-- Campos de Normativa -->
                    ${meta.tipo_norma ? `<span><i class="fa-solid fa-scale-balanced"></i> ${sanitize(meta.tipo_norma)}</span>` : ''}
                    ${meta.organismo ? `<span><i class="fa-solid fa-building"></i> ${sanitize(meta.organismo)}</span>` : ''}

                    <!-- Campos de Lecturas -->
                    ${meta.autor ? `<span><i class="fa-solid fa-user-pen"></i> ${sanitize(meta.autor)}</span>` : ''}
                    ${meta.tipo_lectura ? `<span><i class="fa-solid fa-book"></i> ${sanitize(meta.tipo_lectura)}</span>` : ''}

                    <!-- Campos de Documentales -->
                    ${meta.director ? `<span><i class="fa-solid fa-clapperboard"></i> ${sanitize(meta.director)}</span>` : ''}
                    ${meta.duracion ? `<span><i class="fa-solid fa-clock"></i> ${sanitize(meta.duracion)}</span>` : ''}

                    <!-- Campos de Convocatorias -->
                    ${meta.tipo_apoyo ? `<span><i class="fa-solid fa-hand-holding-dollar"></i> ${sanitize(meta.tipo_apoyo)}</span>` : ''}
                    ${meta.monto ? `<span><i class="fa-solid fa-sack-dollar"></i> ${sanitize(meta.monto)}</span>` : ''}

                    <!-- Campos de Fondos -->
                    ${meta.tipo_fondo ? `<span><i class="fa-solid fa-sack-dollar"></i> ${sanitize(meta.tipo_fondo)}</span>` : ''}
                    ${meta.origen ? `<span><i class="fa-solid fa-earth-americas"></i> ${sanitize(meta.origen)}</span>` : ''}
                    ${meta.monto_aprox ? `<span><i class="fa-solid fa-coins"></i> ${sanitize(meta.monto_aprox)}</span>` : ''}

                    <!-- Campos de Firmas -->
                    ${meta.plataforma_firmas ? `<span><i class="fa-solid fa-pen-nib"></i> ${sanitize(meta.plataforma_firmas)}</span>` : ''}
                    ${meta.meta_firmas ? `<span><i class="fa-solid fa-users"></i> Meta: ${sanitize(meta.meta_firmas)} firmas</span>` : ''}

                    <!-- Campos Comunes -->
                    ${meta.fecha_limite || meta.fecha_cierre ? `<span><i class="fa-regular fa-calendar-check"></i> Límite: ${sanitize(meta.fecha_limite || meta.fecha_cierre)}</span>` : ''}
                    ${item.fecha_evento ? `<span><i class="fa-regular fa-calendar"></i> ${new Date(item.fecha_evento).toLocaleDateString()}</span>` : ''}
                </div>

                <p style="margin-bottom: 20px;">${sanitize(textoDescripcion)}</p>
                
                ${item.enlace_externo ? `
                <div class="card-actions" style="margin-top: auto;">
                    <a href="${item.enlace_externo}" target="_blank" class="btn btn-primary-small" style="width: 100%; justify-content: center;">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Acceder al Recurso
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

    // Mapeo de nombres legibles para el botón
    const labels = {
        cursos: 'Curso',
        lecturas: 'Lectura',
        documentales: 'Documental',
        ecotecnias: 'Ecotecnia',
        normativa: 'Norma',
        agua: 'Recurso de Agua',
        convocatoria: 'Convocatoria',
        voluntariados: 'Voluntariado',
        firmas: 'Petición',
        fondos: 'Fondo'
    };

    const label = labels[sectionId] || 'Recurso';

    const btn = document.createElement('button');
    btn.className = 'btn btn-proposal shimmer-extra';
    btn.innerHTML = `<i class="fa-solid fa-plus-circle"></i> Agregar ${label}`;
    btn.style = `
        margin-top: 20px;
        background: var(--primary-color);
        color: black;
        border: none;
        padding: 12px 25px;
        border-radius: 30px;
        cursor: pointer;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
    `;

    btn.onmouseover = () => { btn.style.transform = 'scale(1.05)'; btn.style.filter = 'brightness(1.1)'; };
    btn.onmouseout = () => { btn.style.transform = 'scale(1)'; btn.style.filter = 'brightness(1)'; };

    btn.onclick = () => {
        window.location.href = `../admin.html?action=new&section=${sectionId}&hub=${parentHub}`;
    };

    header.appendChild(btn);
}
