/* assets/js/pages/admin.js */
import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver, sanitize, showToast, formatearFechaRelativa } from '../ui-utils.js';

// Scripts with type="module" are automatically deferred, no need for DOMContentLoaded wrapper.
(async () => {
    console.log('[Admin] 🚀 Iniciando panel unificado...');
    
    let currentModerationStatus = 'approved'; // Definida al inicio para evitar errores de scope
    
    // --- CONFIGURACIÓN DE CAMPOS POR SECCIÓN (METADATOS) ---
    const SECTION_CONFIGS = {
        cursos: {
            label: 'Curso',
            fields: [
                { id: 'area', label: 'Área Temática', type: 'select', options: ['Agua', 'Biodiversidad', 'Residuos', 'Energía', 'Clima', 'Cambio Climático'] },
                { id: 'institucion', label: 'Institución / Plataforma', type: 'text', placeholder: 'Ej: BID, Coursera, UNAM' },
                { id: 'gratuito', label: 'Acceso', type: 'select', options: ['Gratuito', 'Pago / Beca'] },
                { id: 'fecha_limite', label: 'Fecha Límite Registro', type: 'date' }
            ]
        },
        normativa: {
            label: 'Norma Ambiental',
            fields: [
                { id: 'ambito', label: 'Ámbito', type: 'select', options: ['Federal', 'Estatal', 'Municipal', 'Internacional'] },
                { id: 'tipo_norma', label: 'Tipo de Instrumento', type: 'select', options: ['Ley', 'Reglamento', 'NOM', 'NMX', 'Decreto', 'Acuerdo'] },
                { id: 'organismo', label: 'Organismo Emisor', type: 'text', placeholder: 'Ej: SEMARNAT, CONAGUA' },
                { id: 'vigencia', label: 'Estado de Vigencia', type: 'select', options: ['Vigente', 'En Revisión', 'Abrogada'] }
            ]
        },
        lecturas: {
            label: 'Lectura',
            fields: [
                { id: 'autor', label: 'Autor(es)', type: 'text', placeholder: 'Ej: Johan Rockström' },
                { id: 'tipo_lectura', label: 'Tipo de Material', type: 'select', options: ['Libro', 'Artículo Científico', 'Manual/Guía', 'Informe', 'Ensayo'] },
                { id: 'idioma', label: 'Idioma', type: 'select', options: ['Español', 'Inglés', 'Bilingüe'] }
            ]
        },
        documentales: {
            label: 'Cine/Documental',
            fields: [
                { id: 'director', label: 'Director', type: 'text' },
                { id: 'duracion', label: 'Duración (min)', type: 'text', placeholder: 'Ej: 90 min' },
                { id: 'plataforma', label: 'Disponible en', type: 'text', placeholder: 'Ej: Netflix, YouTube, Cine' }
            ]
        },
        convocatoria: {
            label: 'Convocatoria',
            fields: [
                { id: 'tipo_apoyo', label: 'Tipo de Apoyo', type: 'select', options: ['Financiamiento', 'Beca', 'Incubación', 'Premio'] },
                { id: 'monto', label: 'Monto/Alcance', type: 'text', placeholder: 'Ej: $50,000 MXN' },
                { id: 'fecha_cierre', label: 'Fecha de Cierre', type: 'date' }
            ]
        },
        voluntariados: {
            label: 'Voluntariado',
            fields: [
                { id: 'modalidad', label: 'Modalidad', type: 'select', options: ['Presencial', 'Remoto', 'Híbrido'] },
                { id: 'duracion_estimada', label: 'Tiempo Requerido', type: 'text', placeholder: 'Ej: 4 horas/semana' }
            ]
        },
        ecotecnias: {
            label: 'Ecotecnia',
            fields: [
                { id: 'dificultad', label: 'Dificultad', type: 'select', options: ['Baja', 'Media', 'Alta'] },
                { id: 'materiales', label: 'Materiales Clave', type: 'text', placeholder: 'Ej: PET, Madera, PVC' }
            ]
        },
        fondos: {
            label: 'Fondo / Beca',
            fields: [
                { id: 'tipo_fondo', label: 'Tipo', type: 'select', options: ['Gubernamental', 'Internacional', 'Fundación', 'ONU', 'Privado'] },
                { id: 'origen', label: 'Origen', type: 'select', options: ['Nacional', 'Internacional', 'Regional'] },
                { id: 'monto_aprox', label: 'Monto Aproximado', type: 'text', placeholder: 'Ej: Hasta $500,000 MXN' },
                { id: 'fecha_cierre', label: 'Fecha de Cierre', type: 'date' }
            ]
        },
        firmas: {
            label: 'Petición / Firma',
            fields: [
                { id: 'plataforma_firmas', label: 'Plataforma', type: 'text', placeholder: 'Ej: Change.org, Avaaz' },
                { id: 'meta_firmas', label: 'Meta de Firmas', type: 'text', placeholder: 'Ej: 10,000' }
            ]
        }
    };

    function renderDynamicFields(sectionId) {
        const container = document.getElementById('co-dynamic-fields');
        if (!container) return;
        container.innerHTML = '';
        
        const config = SECTION_CONFIGS[sectionId];
        if (!config || !config.fields) return;

        config.fields.forEach(field => {
            const group = document.createElement('div');
            group.className = 'form-group';
            group.innerHTML = `<label>${field.label}</label>`;
            
            const wrapper = document.createElement('div');
            wrapper.className = 'input-wrapper';
            
            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                input.id = `meta-${field.id}`;
                input.innerHTML = field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
            } else {
                input = document.createElement('input');
                input.type = field.type;
                input.id = `meta-${field.id}`;
                if (field.placeholder) input.placeholder = field.placeholder;
            }
            
            wrapper.appendChild(input);
            group.appendChild(wrapper);
            container.appendChild(group);
        });
    }

    setupNavbar();
    setupAuthObserver();

    // UI Selectors (Immediate)
    const h1Header = document.querySelector('.header-titles h1');
    const pHeader = document.querySelector('.admin-subtitle');
    const statsGrid = document.getElementById('dashboard-stats');
    const hubMenuView = document.getElementById('hub-menu-view');
    const hubMenuGrid = document.getElementById('hub-menu-grid');
    const tableContainer = document.getElementById('admin-table-container');
    const tableTitle = document.getElementById('table-title');
    const btnNuevo = document.getElementById('btn-nuevo');
    const tbody = document.getElementById('tabla-registros');
    const adminMainContent = document.getElementById('admin-main-content');
    const btnNotificarSeguidores = document.getElementById('btn-notificar-seguidores');
    const modalMensaje = document.getElementById('modal-mensaje-seguidores');
    const formMensaje = document.getElementById('form-mensaje-seguidores');
    const msgDestinatarioLabel = document.getElementById('msg-destinatario-label');
    const msgDestinatarioId = document.getElementById('msg-destinatario-id');

    // Sidebar Logic (Unified)
    const adminSidebar = document.getElementById('admin-sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');

    // Desktop Sidebar Toggle
    const desktopToggle = document.getElementById('desktop-sidebar-toggle');
    if (desktopToggle) {
        desktopToggle.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
            
            // Toggle Icon
            const icon = desktopToggle.querySelector('i');
            if (document.body.classList.contains('sidebar-collapsed')) {
                icon.setAttribute('data-lucide', 'panel-left-open');
            } else {
                icon.setAttribute('data-lucide', 'panel-left-close');
            }
            lucide.createIcons();
        });
    }

    // Mobile Sidebar Toggle
    const mobileToggle = document.getElementById('mobile-sidebar-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-active');
        });
    }

    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', () => {
            document.body.classList.remove('sidebar-active');
        });
    }

    // Navigation Logic (Attached immediately)
    const menuLinks = document.querySelectorAll('.admin-menu a[data-view]');
    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            menuLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Close mobile sidebar on link click
            document.body.classList.remove('sidebar-active');

            resetViews();

            if (view === 'dashboard') {
                showDashboard();
            } else if (view === 'historial') {
                showHistoryView();
            } else if (view === 'perfil') {
                showPerfilView();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            } else if (view === 'notificaciones') {
                showNotificationsView();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            } else if (view === 'config') {
                showConfigView();
            } else if (['colibri', 'ajolote', 'lobo'].includes(view)) {
                showHubMenu(view);
            } else {
                showDirectSection(view, link.querySelector('span').textContent);
            }
        });
    });

    // 1. Guard: Authentication & Role Check
    let session = null;
    let perfil = { rol: 'user' }; // Fallback role
    let esAdmin = false;
    let esActor = false;
    let currentAdminFilter = 'all';
    let currentHub = null;
    let currentSection = null;
    let actorPerms = []; // Guardará { seccion_id, parent_hub }


    try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        session = currentSession;

        if (!currentUser || !session) {
            window.location.href = './auth.html';
            return;
        }

        // --- SEGURIDAD: Validación de Perfil Estricta ---
        console.log('[Security] Verificando credenciales para:', currentUser.email);
        
        const { data: profile, error: perfilError } = await supabase
            .from('perfiles')
            .select('nombre_completo, rol, avatar_url, bio, telefono, links_sociales')
            .eq('id', currentUser.id)
            .single();

        if (perfilError || !profile) {
            console.error('[Security] ERROR DE PERFIL:', perfilError?.message || 'Perfil no encontrado');
            mostrarErrorAcceso('No se pudo validar tu perfil. Asegúrate de estar registrado correctamente.');
            return;
        }

        const userRole = (profile.rol || 'user').trim().toLowerCase();
        
        // Verificación de Rol Estricta
        if (!['admin', 'actor'].includes(userRole)) {
            console.error('[Security] ROL NO AUTORIZADO:', userRole);
            mostrarErrorAcceso(`Tu cuenta (${userRole}) no tiene permisos para acceder a esta área.`);
            return;
        }

        // Si llegamos aquí, el acceso es válido y el perfil es real
        perfil = profile;
        esAdmin = perfil.rol === 'admin';
        esActor = perfil.rol === 'actor';

        console.log(`[Security] Acceso concedido: ${perfil.nombre_completo} (${perfil.rol})`);

        // Función auxiliar para mostrar error en pantalla y evitar redirección silenciosa
        function mostrarErrorAcceso(msg) {
            if (adminMainContent) {
                adminMainContent.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:60vh; text-align:center; padding:20px;">
                        <i data-lucide="shield-x" style="width:64px; height:64px; color:#ef4444; margin-bottom:20px;"></i>
                        <h1 style="color:white; margin-bottom:10px;">Acceso Restringido</h1>
                        <p style="color:#94a3b8; max-width:400px; margin-bottom:30px;">${msg}</p>
                        <a href="./index.html" class="btn-admin" style="background:var(--admin-accent); color:white; text-decoration:none;">Volver al Inicio</a>
                    </div>
                `;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            } else {
                window.location.href = './index.html';
            }
        }

        // Actualizar Tarjeta de Perfil en Sidebar y Header
        updateHeaderInfo(perfil);

        // Activar elementos de Admin mediante clase en body
        if (esAdmin) {
            document.body.classList.add('is-admin');
        } else {
            // Ajustar etiquetas para Actor
            const lblEvents = document.getElementById('menu-label-eventos');
            const lblPlaces = document.getElementById('menu-label-lugares');
            const lblFollowers = document.getElementById('menu-label-seguidores');
            
            if (lblEvents) lblEvents.textContent = 'Mis Eventos';
            if (lblPlaces) lblPlaces.textContent = 'Mis Lugares';
            if (lblFollowers) lblFollowers.textContent = 'Mis Seguidores';

            // Filtrar visibilidad de Hubs y Stats por permiso
            document.getElementById('stat-card-actores')?.classList.add('hidden');
            document.getElementById('stat-card-voluntarios')?.classList.add('hidden');
            
            await updateHubsVisibility();
        }

        // Cargar datos en el formulario de perfil
        cargarDatosPerfil(perfil);

        // 2. Initialize Dashboard
        currentModerationStatus = 'approved'; // Asegurar estado por defecto antes de cargar
        await actualizarEstadisticas();
        await updateBadges(); 
        
        // 3. Setup Moderation Tabs
        setupModerationTabs();
        
        showDashboard();

    } catch (err) {
        console.error("Critical Error during admin initialization:", err);
    }

    async function updateHubsVisibility() {
        if (esAdmin) return; // Admin ve todo

        // 1. Obtener permisos de Hubs/Secciones
        const { data: perms } = await supabase
            .from('permisos_actores')
            .select('parent_hub, seccion_id')
            .eq('user_id', session.user.id);
        
        actorPerms = perms || [];
        const permittedHubs = [...new Set(actorPerms.map(p => p.parent_hub))];
        
        ['colibri', 'ajolote', 'lobo'].forEach(hub => {
            const link = document.querySelector(`.admin-menu a[data-view="${hub}"]`);
            if (link) {
                const li = link.closest('li');
                if (!permittedHubs.includes(hub)) {
                    if (li) li.style.display = 'none';
                } else {
                    if (li) li.style.display = 'block';
                }
            }
        });

        // Ocultar la categoría Hubs si no hay acceso
        const hubCategory = document.getElementById('menu-category-hubs');
        if (hubCategory) hubCategory.style.display = permittedHubs.length > 0 ? 'block' : 'none';

        // 2. Obtener permisos de Funciones Especiales
        const { data: fnPerms } = await supabase
            .from('permisos_funciones')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

        const toggleLink = (view, condition) => {
            const link = document.querySelector(`.admin-menu a[data-view="${view}"]`);
            if (link) {
                const li = link.closest('li');
                if (li) li.style.display = condition ? 'block' : 'none';
            }
        };

        // Si no hay registro de funciones, por defecto eventos/lugares/directorio suelen ser true para staff 
        // pero aquí seremos estrictos si el admin ya configuró algo
        toggleLink('eventos', fnPerms ? fnPerms.puede_crear_eventos : true);
        toggleLink('lugares', fnPerms ? fnPerms.puede_crear_lugares : true);
        toggleLink('notificaciones', fnPerms ? fnPerms.puede_enviar_notificaciones : false);
        toggleLink('directorio', fnPerms ? fnPerms.visible_en_directorio : true);
    }


    function updateHeaderInfo(profile) {
        const sidebarName = document.getElementById('sidebar-user-name');
        const sidebarRole = document.getElementById('sidebar-user-role');
        const sidebarAvatar = document.getElementById('sidebar-avatar');
        const headerRoleBadge = document.getElementById('role-status-badge');
        const currentDateSpan = document.querySelector('#current-date span');

        // Sidebar Profile
        if (sidebarName) sidebarName.textContent = profile.nombre_completo || 'Usuario';
        if (sidebarRole) {
            sidebarRole.textContent = esAdmin ? '● Administrador' : '● Actor';
            sidebarRole.className = `profile-role-badge ${profile.rol}`;
        }
        if (sidebarAvatar) {
            if (perfil.avatar_url) {
                sidebarAvatar.style.backgroundImage = `url("${perfil.avatar_url}")`;
                sidebarAvatar.textContent = '';
                localStorage.setItem('eco_user_avatar', perfil.avatar_url);
            } else {
                sidebarAvatar.style.backgroundImage = 'none';
                sidebarAvatar.textContent = (perfil.nombre_completo || 'U').charAt(0).toUpperCase();
            }
        }

        // Header Info
        if (headerRoleBadge) {
            headerRoleBadge.textContent = esAdmin ? '● Administrador' : '● Actor';
            headerRoleBadge.className = `profile-role-badge ${profile.rol}`;
        }

        if (currentDateSpan) {
            const now = new Date();
            const options = { weekday: 'long', day: 'numeric', month: 'long' };
            currentDateSpan.textContent = now.toLocaleDateString('es-ES', options);
        }
    }

    function resetViews() {
        if (statsGrid) statsGrid.classList.add('hidden');
        if (hubMenuView) hubMenuView.classList.add('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        if (btnNuevo) btnNuevo.style.display = 'none';
        const perfilView = document.getElementById('perfil-view');
        const notifView = document.getElementById('notificaciones-view');
        const configView = document.getElementById('config-view');
        if (perfilView) perfilView.classList.add('hidden');
        if (notifView) notifView.classList.add('hidden');
        if (configView) configView.classList.add('hidden');

        currentHub = null;
        currentSection = null;
        if (adminMainContent) adminMainContent.classList.remove('hub-colibri', 'hub-ajolote', 'hub-lobo');
    }

    async function compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/webp', 0.7);
                };
            };
            reader.onerror = error => reject(error);
        });
    }

    function showPerfilView() {
        resetViews();
        h1Header.textContent = 'Configuraciones';
        pHeader.textContent = 'Gestiona tu perfil y preferencias de la plataforma.';
        const perfilView = document.getElementById('perfil-view');
        if (perfilView) {
            perfilView.classList.remove('hidden');
            cargarDatosPerfil(perfil);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    function showNotificationsView() {
        resetViews();
        h1Header.textContent = 'Centro de Mensajes';
        pHeader.textContent = 'Envía avisos importantes y notificaciones a tu comunidad.';
        const view = document.getElementById('notificaciones-view');
        if (view) {
            view.classList.remove('hidden');
            setupNotifCheckboxes();
            cargarHistorialNotificaciones();
        }
    }

    function setupNotifCheckboxes() {
        const chkTodos = document.getElementById('n-dest-todos');
        const chkActores = document.getElementById('n-dest-actores');
        const chkVol = document.getElementById('n-dest-voluntariados');

        if (!chkTodos) return;

        chkTodos.addEventListener('change', () => {
            const isChecked = chkTodos.checked;
            chkActores.checked = isChecked;
            chkVol.checked = isChecked;
        });

        [chkActores, chkVol].forEach(chk => {
            chk.addEventListener('change', () => {
                if (!chk.checked) chkTodos.checked = false;
                if (chkActores.checked && chkVol.checked) chkTodos.checked = true;
            });
        });
    }

    async function cargarHistorialNotificaciones() {
        const container = document.getElementById('notif-list-container');
        if (!container) return;
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            let query = supabase.from('notificaciones').select('*').order('created_at', { ascending: false });

            if (esActor) query = query.eq('remitente_id', user.id);

            const { data: notifs, error } = await query.limit(10);
            if (error) throw error;

            if (!notifs || notifs.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="text-align: center; padding: 40px 20px; color: var(--admin-text-muted);">
                        <i data-lucide="inbox" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
                        <p>No hay notificaciones enviadas aún.</p>
                    </div>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                return;
            }

            container.innerHTML = notifs.map(n => {
            const dests = n.destinatarios ? n.destinatarios.split(',') : ['todos'];
            const isTodos = dests.includes('todos');
            const isActores = dests.includes('actores') || isTodos;
            const isVol = dests.includes('voluntariados') || isTodos;

            return `
            <div class="notif-item compact fade-in" style="cursor: pointer;" onclick="window.revisarNotificacion(${JSON.stringify(n).replace(/"/g, '&quot;')})">
                <div class="notif-header-main" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 14px 18px; background: rgba(255,255,255,0.01);">
                    <h4 style="font-size: 0.95rem; font-weight: 600; color: white; margin: 0; display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-envelope-circle-check" style="color: var(--admin-accent); font-size: 0.8rem; opacity: 0.7;"></i>
                        ${sanitize(n.titulo)}
                    </h4>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="background: rgba(114, 176, 77, 0.15); color: var(--admin-accent); padding: 4px 10px; border-radius: 20px; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.5px; border: 1px solid rgba(114, 176, 77, 0.2); text-transform: uppercase;">Enviado</span>
                        <i class="fa-solid fa-up-right-from-square" style="font-size: 0.7rem; color: #64748b; opacity: 0.5;"></i>
                    </div>
                </div>
            </div>

            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();

        } catch (err) {
            console.error('Error al cargar historial:', err);
            container.innerHTML = '<p class="empty-state" style="color:#ff6b6b;">Error al cargar historial</p>';
        }
    }

    window.eliminarNotificacion = async (id) => {
        if (!confirm('¿Estás seguro de eliminar esta notificación? Se borrará para todos los destinatarios.')) return;

        try {
            // Primero eliminamos los registros de entrega (aunque Cascade debería encargarse, lo hacemos manual por seguridad)
            await supabase.from('notificaciones_usuarios').delete().eq('notificacion_id', id);
            
            // Luego la notificación principal
            const { error } = await supabase.from('notificaciones').delete().eq('id', id);
            
            if (error) throw error;

            showToast('✅ Notificación eliminada correctamente');
            cargarHistorialNotificaciones();
        } catch (err) {
            console.error('Error al eliminar:', err);
            showToast('❌ Error al eliminar la notificación', 'error');
        }
    }

    const btnCancelNotif = document.getElementById('btn-cancel-notif');

    function limpiarFormNotif() {
        document.getElementById('form-notif-send').reset();
        document.getElementById('n-archivo-url').value = '';
        document.getElementById('txt-file-name').textContent = 'Seleccionar archivo...';
        document.getElementById('btn-clear-notif-file').classList.add('hidden');
        if (typeof updateNotifFilePreview === 'function') updateNotifFilePreview(null);
        if (btnCancelNotif) btnCancelNotif.classList.add('hidden');
    }

    if (btnCancelNotif) {
        btnCancelNotif.onclick = () => {
            limpiarFormNotif();
            showToast('✅ Formulario limpiado', 'info');
        };
    }

    document.getElementById('form-notif-send').onsubmit = async (e) => {

        e.preventDefault();
        const btn = document.getElementById('btn-send-notif');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const destSeleccionados = [];
            if (document.getElementById('n-dest-todos').checked) destSeleccionados.push('todos');
            if (document.getElementById('n-dest-actores').checked) destSeleccionados.push('actores');
            if (document.getElementById('n-dest-voluntariados').checked) destSeleccionados.push('voluntariados');

            const destinatariosStr = destSeleccionados.length > 0 ? destSeleccionados.join(',') : 'todos';

            const titulo = document.getElementById('n-titulo').value;
            const mensaje = document.getElementById('n-mensaje').value;
            const enlace = document.getElementById('n-link').value;
            const archivo = document.getElementById('n-archivo-url').value;

            const { data: notif, error: nError } = await supabase.from('notificaciones').insert({
                remitente_id: user.id,
                titulo,
                mensaje,
                destinatarios: destinatariosStr,
                enlace_url: enlace || null,
                archivo_url: archivo || null
            }).select().single();

            if (nError) throw nError;

            let userIds = [];
            const seleccionados = destinatariosStr.split(',');

            if (seleccionados.includes('todos')) {
                const { data } = await supabase.from('perfiles').select('id');
                userIds = data.map(u => u.id);
            } else {
                if (seleccionados.includes('actores')) {
                    const { data } = await supabase.from('perfiles').select('id').eq('rol', 'actor');
                    userIds = [...userIds, ...data.map(u => u.id)];
                }
                if (seleccionados.includes('voluntariados')) {
                    const { data } = await supabase.from('perfiles').select('id').eq('rol', 'user');
                    userIds = [...userIds, ...data.map(u => u.id)];
                }
                // Evitar duplicados si un usuario tiene varios roles (poco común pero posible)
                userIds = [...new Set(userIds)];
            }

            // --- NUEVO: Asegurar que los admins siempre reciban la notificación en su campana ---
            const { data: admins } = await supabase.from('perfiles').select('id').eq('rol', 'admin');
            if (admins && admins.length > 0) {
                userIds = [...userIds, ...admins.map(a => a.id)];
                userIds = [...new Set(userIds)]; // Limpiar duplicados de nuevo
            }
            // ----------------------------------------------------------------------------------

            if (userIds.length > 0) {
                const delivery = userIds.map(uid => ({
                    notificacion_id: notif.id,
                    usuario_id: uid,
                    leido: false
                }));
                const { error: dError } = await supabase.from('notificaciones_usuarios').insert(delivery);
                if (dError) throw dError;
            }

            showToast(`✅ Notificación enviada a ${userIds.length} usuarios`);
            limpiarFormNotif();

            cargarHistorialNotificaciones();

        } catch (err) {
            console.error('Error al enviar notificacion:', err);
            showToast('❌ Error al enviar mensaje', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    };

    window.cargarNotifEnFormulario = (n) => {
        document.getElementById('n-titulo').value = n.titulo;
        document.getElementById('n-mensaje').value = n.mensaje;
        document.getElementById('n-link').value = n.enlace_url || '';
        document.getElementById('n-archivo-url').value = n.archivo_url || '';
        
        if (n.archivo_url) {
            document.getElementById('txt-file-name').textContent = 'Archivo cargado';
            document.getElementById('btn-clear-notif-file').classList.remove('hidden');
            updateNotifFilePreview(n.archivo_url);
        } else {
            updateNotifFilePreview(null);
        }

        const dests = n.destinatarios ? n.destinatarios.split(',') : ['todos'];
        const isTodos = dests.includes('todos');
        
        document.getElementById('n-dest-todos').checked = isTodos;
        document.getElementById('n-dest-actores').checked = isTodos || dests.includes('actores');
        document.getElementById('n-dest-voluntariados').checked = isTodos || dests.includes('voluntariados');
        
        // Efecto visual y scroll
        const composer = document.querySelector('.notif-composer');
        composer.style.boxShadow = '0 0 30px rgba(77, 150, 255, 0.3)';
        setTimeout(() => composer.style.boxShadow = '', 2000);
        
        
        composer.scrollIntoView({ behavior: 'smooth' });

        // Mostrar botón de cancelar
        if (document.getElementById('btn-cancel-notif')) {
            document.getElementById('btn-cancel-notif').classList.remove('hidden');
        }
    };


    window.revisarNotificacion = (n) => {
        const body = document.getElementById('notif-review-body');
        const modal = document.getElementById('notif-review-modal');
        
        const dests = n.destinatarios ? n.destinatarios.split(',') : ['todos'];
        const isTodos = dests.includes('todos');
        const isActores = dests.includes('actores') || isTodos;
        const isVol = dests.includes('voluntariados') || isTodos;

        body.innerHTML = `
            <div style="margin-bottom: 25px;">
                <h3 style="color: white; margin: 0 0 8px 0; font-size: 1.3rem;">${sanitize(n.titulo)}</h3>
                <span style="font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-regular fa-calendar"></i> Enviado el ${new Date(n.created_at).toLocaleString('es-ES')}
                </span>
            </div>

            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 15px; margin-bottom: 25px;">
                <p style="color: #cbd5e1; font-size: 1rem; line-height: 1.7; white-space: pre-wrap; margin: 0;">${sanitize(n.mensaje)}</p>
            </div>

            ${n.archivo_url ? `
                <div style="margin-bottom: 25px;">
                    <p style="font-size: 0.8rem; color: var(--admin-text-muted); margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Archivo Adjunto</p>
                    <div style="border-radius: 15px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: #000; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                        ${n.archivo_url.match(/\.(jpeg|jpg|gif|png|webp|jfif|avif)($|\?)/i) ? 
                            `<img src="${n.archivo_url}" style="width:100%; display:block; max-height: 400px; object-fit: contain;">` :
                            `<div style="padding: 30px; text-align: center;"><i class="fa-solid fa-file-pdf" style="font-size: 3rem; color: #ef4444; margin-bottom: 10px;"></i><p style="color:white; margin:0;">Documento PDF</p></div>`
                        }
                    </div>
                </div>
            ` : ''}

            <div style="margin-bottom: 25px;">
                <p style="font-size: 0.8rem; color: var(--admin-text-muted); margin-bottom: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Audiencia Alcanzada</p>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    <div style="padding: 8px 14px; border-radius: 10px; background: ${isTodos ? 'rgba(114, 176, 77, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${isTodos ? 'rgba(114, 176, 77, 0.3)' : 'rgba(255,255,255,0.05)'}; color: ${isTodos ? 'var(--admin-accent)' : '#64748b'}; display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
                        <i class="fa-solid ${isTodos ? 'fa-check-circle' : 'fa-circle'}"></i> Todos
                    </div>
                    <div style="padding: 8px 14px; border-radius: 10px; background: ${isActores ? 'rgba(114, 176, 77, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${isActores ? 'rgba(114, 176, 77, 0.3)' : 'rgba(255,255,255,0.05)'}; color: ${isActores ? 'var(--admin-accent)' : '#64748b'}; display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
                        <i class="fa-solid ${isActores ? 'fa-check-circle' : 'fa-circle'}"></i> Actores
                    </div>
                    <div style="padding: 8px 14px; border-radius: 10px; background: ${isVol ? 'rgba(114, 176, 77, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${isVol ? 'rgba(114, 176, 77, 0.3)' : 'rgba(255,255,255,0.05)'}; color: ${isVol ? 'var(--admin-accent)' : '#64748b'}; display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
                        <i class="fa-solid ${isVol ? 'fa-check-circle' : 'fa-circle'}"></i> Voluntarios
                    </div>
                </div>
            </div>

            ${n.enlace_url ? `
                <div style="margin-top: 10px;">
                    <a href="${n.enlace_url}" target="_blank" style="display: flex; align-items: center; gap: 10px; color: var(--admin-accent); text-decoration: none; font-weight: 600; background: rgba(114, 176, 77, 0.05); padding: 12px 18px; border-radius: 12px; border: 1px dashed rgba(114, 176, 77, 0.3); word-break: break-all;">
                        <i class="fa-solid fa-link" style="flex-shrink: 0;"></i> 
                        <span style="flex: 1;">Enlace de Acción: ${n.enlace_url}</span>
                        <i class="fa-solid fa-external-link-alt" style="flex-shrink: 0; font-size: 0.8rem;"></i>
                    </a>
                </div>
            ` : ''}

        `;

        document.getElementById('btn-notif-review-reuse').onclick = () => {
            window.cargarNotifEnFormulario(n);
            modal.classList.add('hidden');
        };

        modal.classList.remove('hidden');
    };


    async function showConfigView() {
        resetViews();
        h1Header.textContent = 'Ajustes de Plataforma';
        pHeader.textContent = 'Control global del sistema y preferencias de usuario.';
        const view = document.getElementById('config-view');
        if (view) {
            view.classList.remove('hidden');
            try {
                const { data: cfg, error } = await supabase.from('config_plataforma').select('*').eq('id', 1).single();
                if (cfg) {
                    document.getElementById('cfg-registro').checked = cfg.registro_abierto;
                    document.getElementById('cfg-mantenimiento').checked = cfg.modo_mantenimiento;
                    document.getElementById('cfg-bienvenida').value = cfg.mensaje_bienvenida || '';
                    document.getElementById('cfg-banner').value = cfg.banner_activo || '';
                }
            } catch (err) { console.error(err); }
        }
    }

    document.getElementById('form-config-global').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-config');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Aplicando...';

        try {
            const updates = {
                registro_abierto: document.getElementById('cfg-registro').checked,
                modo_mantenimiento: document.getElementById('cfg-mantenimiento').checked,
                mensaje_bienvenida: document.getElementById('cfg-bienvenida').value,
                banner_activo: document.getElementById('cfg-banner').value,
                updated_at: new Date()
            };
            const { error } = await supabase.from('config_plataforma').update(updates).eq('id', 1);
            if (error) throw error;
            showToast('✅ Ajustes globales aplicados');
        } catch (err) { 
            console.error(err);
            showToast('❌ Error al guardar ajustes', 'error'); 
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    };

    async function updateBadges() {
        if (!esAdmin) return;

        try {
            // Contar eventos pendientes
            const { count: pendingEvents } = await supabase
                .from('eventos')
                .select('*', { count: 'exact', head: true })
                .eq('estado', 'pending');
            
            // Contar actores pendientes (usuarios pidiendo ser actores)
            const { count: pendingActores } = await supabase
                .from('perfiles')
                .select('*', { count: 'exact', head: true })
                .eq('actor_status', 'pending');

            const badgeEvents = document.getElementById('badge-eventos-pending');
            const badgeActores = document.getElementById('badge-actores-pending');

            if (badgeEvents) {
                badgeEvents.textContent = pendingEvents || 0;
                badgeEvents.classList.toggle('hidden', !pendingEvents);
            }
            if (badgeActores) {
                badgeActores.textContent = pendingActores || 0;
                badgeActores.classList.toggle('hidden', !pendingActores);
            }

            // Actualizar contador en tabs si estamos en esa vista
            const counterTab = document.getElementById('counter-pending');
            if (counterTab) {
                const count = (currentAdminFilter === 'eventos' || currentAdminFilter === 'all') ? pendingEvents : pendingActores;
                counterTab.textContent = count || 0;
            }

        } catch (err) {
            console.error('[Badges] Error:', err);
        }
    }

    function setupModerationTabs() {
        const tabs = document.querySelectorAll('.admin-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentModerationStatus = tab.dataset.status;
                cargarDatos(currentAdminFilter);
            });
        });
    }

    function showModerationTabs(visible) {
        const tabsContainer = document.getElementById('moderation-tabs');
        if (tabsContainer) {
            tabsContainer.classList.toggle('hidden', !visible);
        }
    }

    async function actualizarEstadisticas() {
        try {
            // 1. Actores (Admin + Actor)
            const { count: countActores } = await supabase
                .from('perfiles')
                .select('*', { count: 'exact', head: true })
                .in('rol', ['admin', 'actor']);
            
            // 2. Voluntarios (User)
            const { count: countVoluntarios } = await supabase
                .from('perfiles')
                .select('*', { count: 'exact', head: true })
                .eq('rol', 'user');

            // 3. Eventos
            let qEventos = supabase.from('eventos').select('*', { count: 'exact', head: true });
            if (esActor) qEventos = qEventos.eq('owner_id', session.user.id);
            const { count: countEventos } = await qEventos;

            // 4. Lugares
            let qLugares = supabase.from('lugares').select('*', { count: 'exact', head: true });
            if (esActor) qLugares = qLugares.eq('owner_id', session.user.id);
            const { count: countLugares } = await qLugares;

            // 5. Seguidores
            let qSeguidores = supabase.from('seguimientos_actores').select('*', { count: 'exact', head: true });
            if (esActor) qSeguidores = qSeguidores.eq('actor_id', session.user.id);
            const { count: countSeguidores } = await qSeguidores;

            // Actualizar DOM con animaciones suaves (opcional, por ahora directo)
            const elActores = document.getElementById('stat-actores');
            const elVoluntarios = document.getElementById('stat-voluntarios');
            const elEventos = document.getElementById('stat-eventos');
            const elLugares = document.getElementById('stat-lugares');
            const elSeguidores = document.getElementById('stat-seguidores');

            if (elActores) elActores.textContent = countActores || 0;
            if (elVoluntarios) elVoluntarios.textContent = countVoluntarios || 0;
            if (elEventos) elEventos.textContent = countEventos || 0;
            if (elLugares) elLugares.textContent = countLugares || 0;
            if (elSeguidores) elSeguidores.textContent = countSeguidores || 0;

        } catch (err) {
            console.error('[Stats] Error al cargar contadores:', err);
        }
    }

    function showDashboard() {
        const displayName = perfil.nombre_completo ? perfil.nombre_completo.split(' ')[0] : 'Admin';
        h1Header.textContent = `¡Hola, ${displayName}!`;
        pHeader.textContent = esAdmin ? 'Resumen global de EcoGuía SOS.' : 'Tu espacio de gestión y registros.';
        statsGrid.classList.remove('hidden');
        tableContainer.classList.remove('hidden');
        tableTitle.textContent = esAdmin ? 'Últimos Registros Globales' : 'Mis Últimos Registros';
        
        if (esActor) {
            document.getElementById('stat-card-actores')?.classList.add('hidden');
            document.getElementById('stat-card-voluntarios')?.classList.add('hidden');
        }
        currentAdminFilter = 'all';
        currentModerationStatus = 'approved'; // Dashboard siempre muestra lo aprobado
        cargarDatos('all');
    }

    function showHistoryView() {
        resetViews();
        h1Header.textContent = 'Historial de Actividad';
        pHeader.textContent = 'Registro de acciones recientes en la plataforma.';
        tableContainer.classList.remove('hidden');
        tableTitle.textContent = 'Actividad Reciente';
        currentAdminFilter = 'historial';
        cargarDatos('historial');
    }

    function showHubMenu(hub) {
        resetViews();
        currentHub = hub;
        adminMainContent.classList.add(`hub-${hub}`);
        h1Header.textContent = `Hub ${hub.charAt(0).toUpperCase() + hub.slice(1)}`;
        pHeader.textContent = 'Selecciona un área para gestionar su contenido.';
        hubMenuView.classList.remove('hidden');
        renderHubMenuGrid(hub);
    }

    function showDirectSection(view, title) {
        resetViews();
        h1Header.textContent = title;
        pHeader.textContent = `Listado de ${title.toLowerCase()} registrados.`;
        tableContainer.classList.remove('hidden');
        tableTitle.textContent = `Registros: ${title}`;
        
        // Mostrar tabs solo en eventos o usuarios (moderación)
        const isModerated = view === 'eventos' || view === 'usuarios';
        showModerationTabs(isModerated);

        if (view !== 'usuarios' && view !== 'voluntarios' && view !== 'seguidores') {
            btnNuevo.style.display = 'flex';
        }
        currentAdminFilter = view;
        updateBadges(); // Actualizar contador dinÃ¡mico del tab segÃºn la vista
        cargarDatos(view);
    }

    function renderHubMenuGrid(hub) {
        hubMenuGrid.innerHTML = '';
        const sections = {
            colibri: [
                { id: 'agua', label: 'Agua y Cuenca', icon: 'droplets' },
                { id: 'cursos', label: 'Cursos', icon: 'presentation' },
                { id: 'ecotecnias', label: 'Ecotecnias', icon: 'leaf' },
                { id: 'lecturas', label: 'Lecturas', icon: 'book-open' },
                { id: 'documentales', label: 'Cine/Documental', icon: 'clapperboard' },
                { id: 'firmas', label: 'Peticiones', icon: 'pen-tool' }
            ],
            ajolote: [
                { id: 'convocatoria', label: 'Convocatorias', icon: 'megaphone' },
                { id: 'voluntariados', label: 'Voluntariados', icon: 'hand-helping' },
                { id: 'agentes', label: 'Agentes de Cambio', icon: 'users-2' },
                { id: 'eventos', label: 'Eventos', icon: 'calendar-days' }
            ],
            lobo: [
                { id: 'fondos', label: 'Fondos y Apoyos', icon: 'banknote' },
                { id: 'normativa', label: 'Normativa Ambiental', icon: 'scale' }
            ]
        };

        (sections[hub] || []).forEach(sec => {
            // Si es actor, filtrar por permisos específicos
            if (esActor) {
                const hasPerm = actorPerms.some(p => p.parent_hub === hub && p.seccion_id === sec.id);
                if (!hasPerm) return;
            }

            const card = document.createElement('div');

            card.className = 'hub-card';
            card.innerHTML = `<i data-lucide="${sec.icon}"></i><h4>${sec.label}</h4>`;
            card.onclick = () => {
                currentSection = sec.id;
                hubMenuView.classList.add('hidden');
                tableContainer.classList.remove('hidden');
                tableTitle.textContent = `Gestión: ${sec.label}`;
                btnNuevo.style.display = 'flex';
                currentAdminFilter = `seccion_${sec.id}_${hub}`;
                cargarDatos(currentAdminFilter);
            };
            hubMenuGrid.appendChild(card);
        });
        lucide.createIcons();
    }

    async function cargarDatos(filter = 'all') {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Cargando...</td></tr>';
        try {
            let allItems = [];
            if (filter === 'all' || filter === 'eventos' || filter === 'lugares') {
                const tables = filter === 'all' ? ['eventos', 'lugares'] : [filter];
                for (const t of tables) {
                    // Hacemos JOIN con perfiles para obtener el nombre del creador (publicador)
                    let q = supabase.from(t)
                        .select('*, publicador:owner_id(nombre_completo)')
                        .order('created_at', { ascending: false });
                    if (esActor) q = q.eq('owner_id', session.user.id);
                    
                    // Aplicar filtro de moderación si es admin
                    // Verificación de seguridad: solo filtrar si el campo existe en el esquema
                    if (esAdmin && t === 'eventos') {
                        // Usamos RPC o una consulta head para verificar columnas si fuera necesario, 
                        // pero por ahora intentamos el filtro y si falla lo manejamos
                        q = q.eq('estado', currentModerationStatus);
                    }
                    
                    const { data } = await q;
                    if (data) allItems = [...allItems, ...data.map(x => ({...x, tipo_orig: t === 'eventos' ? 'evento' : 'lugar'}))];
                }
            } else if (filter === 'usuarios' || filter === 'voluntarios') {
                let q = supabase.from('perfiles').select('*');
                if (filter === 'voluntarios') {
                    q = q.eq('rol', 'user');
                } else {
                    // Pestaña de Actores / Staff
                    if (currentModerationStatus === 'pending' || currentModerationStatus === 'rejected') {
                        // En revisión o rechazados: Mostrar a cualquiera que tenga ese estado en actor_status (solicitudes de actor)
                        q = q.eq('actor_status', currentModerationStatus);
                    } else {
                        // Publicados: Mostrar SOLO actores aprobados (excluyendo explícitamente a los admins)
                        q = q.eq('rol', 'actor').eq('actor_status', 'approved');
                    }
                }
                const { data } = await q;
                if (data) allItems = data.map(x => ({...x, nombre: x.nombre_completo, tipo_orig: 'perfiles'}));
            } else if (filter.startsWith('seccion_')) {
                const [_, secId, hub] = filter.split('_');
                let q = supabase.from('contenido_secciones').select('*').eq('seccion_id', secId).eq('parent_hub', hub);
                if (esActor) q = q.eq('owner_id', session.user.id);
                const { data } = await q;
                if (data) allItems = data.map(x => ({...x, nombre: x.titulo, tipo_orig: 'contenido_secciones'}));
            } else if (filter === 'seguidores') {
                let q = supabase.from('seguimientos_actores').select('user_id, perfiles:user_id(nombre_completo)');
                if (esActor) q = q.eq('actor_id', session.user.id);
                const { data } = await q;
                if (data) allItems = data.map(r => ({id: r.user_id, nombre: r.perfiles?.nombre_completo, tipo_orig: 'perfiles', categoria: 'Seguidor'}));
            }
            if (btnNotificarSeguidores) {
                if (filter === 'seguidores' && esActor) btnNotificarSeguidores.classList.remove('hidden');
                else btnNotificarSeguidores.classList.add('hidden');
            }

            renderTablaRows(allItems);
        } catch (err) { tbody.innerHTML = '<tr><td colspan="4">Error al cargar datos.</td></tr>'; }
    }

    function renderTablaRows(items) {
        tbody.innerHTML = items.length ? '' : '<tr><td colspan="4">No hay registros.</td></tr>';
        items.forEach(item => {
            const tr = document.createElement('tr');
            const typeClass = item.tipo_orig.replace('contenido_secciones', 'contenido');
            
            // Lógica de permisos de acción
            const esSeguidor = item.tipo_orig === 'perfiles' && item.categoria === 'Seguidor';
            const esPropio = !item.owner_id || item.owner_id === session.user.id;
            const puedeEditar = (esAdmin || esPropio) && !esSeguidor;

            const nombrePublicador = item.publicador?.nombre_completo ? `<div style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 2px;"><i data-lucide="user" style="width: 10px; height: 10px; display: inline-block; margin-right: 3px;"></i>Publicado por: ${sanitize(item.publicador.nombre_completo)}</div>` : '';

            tr.innerHTML = `
                <td>
                    <strong>${sanitize(item.nombre || item.titulo)}</strong>
                    ${nombrePublicador}
                </td>
                <td><span class="badge-tipo ${typeClass}">${typeClass.toUpperCase()}</span></td>
                <td><span class="badge ${item.estado || item.actor_status || 'active'}">${(item.estado || item.actor_status || 'ACTIVO').toUpperCase()}</span></td>
                <td>
                    <div class="actions-dropdown-container">
                        <button class="btn-actions-trigger" onclick="window.toggleActionsMenu(event, '${item.id}')">
                            <i data-lucide="more-horizontal"></i> Acciones
                        </button>
                        <div class="actions-menu" id="menu-${item.id}">
                            ${puedeEditar ? `
                                <button onclick="window.editarRegistro('${item.id}', '${item.tipo_orig}')" class="action-item edit">
                                    <i data-lucide="pencil"></i> Editar Registro
                                </button>
                            ` : ''}

                            ${esAdmin && (item.tipo_orig === 'evento' || item.tipo_orig === 'perfiles') && (item.estado === 'pending' || item.actor_status === 'pending') ? `
                                <button onclick="window.moderarRegistro('${item.id}', '${item.tipo_orig}', 'approved')" class="action-item approve">
                                    <i data-lucide="check-circle"></i> Aprobar Publicación
                                </button>
                                <button onclick="window.moderarRegistro('${item.id}', '${item.tipo_orig}', 'correction')" class="action-item edit">
                                    <i data-lucide="message-square"></i> Solicitar Corrección
                                </button>
                                <button onclick="window.moderarRegistro('${item.id}', '${item.tipo_orig}', 'rejected')" class="action-item reject">
                                    <i data-lucide="x-circle"></i> Rechazar Registro
                                </button>
                            ` : ''}

                            ${esAdmin && item.rol === 'actor' ? `
                                <button onclick="window.gestionarPermisos('${item.id}')" class="action-item">
                                    <i data-lucide="key"></i> Gestionar Permisos
                                </button>
                            ` : ''}

                            ${esSeguidor ? `
                                <button onclick="window.abrirModalMensaje('${item.id}', '${sanitize(item.nombre)}')" class="action-item message">
                                    <i data-lucide="message-square"></i> Enviar Mensaje Directo
                                </button>
                            ` : ''}

                            ${puedeEditar ? `
                                <div style="border-top: 1px solid var(--admin-border); margin: 5px 0;"></div>
                                <button onclick="window.eliminarRegistro('${item.id}', '${item.tipo_orig}', '${sanitize(item.nombre || item.titulo)}')" class="action-item reject">
                                    <i data-lucide="trash-2"></i> Eliminar Definitivamente
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    }

    // Modal Handling (Events/Places/Content)
    btnNuevo.onclick = () => {
        if (currentAdminFilter === 'eventos') {
            document.getElementById('modal-nuevo-evento').classList.remove('hidden');
            cargarSedesEvento();
        } else if (currentAdminFilter === 'lugares') {
            document.getElementById('modal-nuevo-lugar').classList.remove('hidden');
        } else if (currentAdminFilter.startsWith('seccion_')) {
            const [_, secId, hub] = currentAdminFilter.split('_');
            const form = document.getElementById('form-nuevo-contenido');
            form.reset();
            delete form.dataset.editId;
            
            renderDynamicFields(secId);
            
            document.getElementById('co-image-preview').classList.add('hidden');
            document.getElementById('contenido-modal-title').innerText = `Agregar Nuevo ${SECTION_CONFIGS[secId]?.label || 'Recurso'}`;
            document.getElementById('modal-nuevo-contenido').classList.remove('hidden');
        }
    };

    async function cargarSedesEvento() {
        const select = document.getElementById('ev-sede');
        const { data } = await supabase.from('lugares').select('id, nombre').order('nombre');
        if (data) select.innerHTML = '<option value="">Selecciona...</option>' + data.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
    }

    // Restore missing coordinate extraction
    document.getElementById('ev-btn-extract-coords').onclick = () => {
        const url = document.getElementById('ev-gmaps').value;
        const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) {
            document.getElementById('ev-lat').value = match[1];
            document.getElementById('ev-lng').value = match[2];
            showToast('Coordenadas extraídas');
        } else {
            alert("No se pudieron extraer las coordenadas de este enlace.\n\nSi copiaste un enlace corto desde tu celular (maps.app.goo.gl), Google Maps oculta las coordenadas. Por favor, ingresa la Latitud y Longitud manualmente.");
        }
    };

    document.getElementById('pl-btn-extract-coords').onclick = () => {
        const url = document.getElementById('pl-gmaps').value;
        const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) {
            document.getElementById('pl-lat').value = match[1];
            document.getElementById('pl-lng').value = match[2];
            showToast('Coordenadas extraídas');
        } else {
            alert("No se pudieron extraer las coordenadas de este enlace.\n\nSi copiaste un enlace corto desde tu celular (maps.app.goo.gl), Google Maps oculta las coordenadas. Por favor, ingresa la Latitud y Longitud manualmente.");
        }
    };

    // Close Modals
    document.querySelectorAll('.btn-close-modal, .btn-cancelar, #btn-cancelar-evento, #btn-cancelar-lugar').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
            // Limpiar data-editId al cancelar para no sobreescribir al crear nuevo
            const fe = document.getElementById('form-nuevo-evento');
            const fl = document.getElementById('form-nuevo-lugar');
            if (fe) { fe.reset(); delete fe.dataset.editId; }
            if (fl) { fl.reset(); delete fl.dataset.editId; }
        };
    });

    // ==========================================
    // LÓGICA DE FORMULARIOS: EVENTOS Y LUGARES
    // ==========================================

    window.editarRegistro = async (id, tipo) => {
        const tabla = tipo === 'evento' ? 'eventos' : (tipo === 'lugar' ? 'lugares' : tipo);
        const { data, error } = await supabase.from(tabla).select('*').eq('id', id).single();
        if (error) {
            showToast('Error al cargar datos para edición', 'error');
            return;
        }

        if (tipo === 'evento') {
            const form = document.getElementById('form-nuevo-evento');
            form.reset();
            form.dataset.editId = id;
            
            document.getElementById('ev-nombre').value = data.nombre || data.titulo || '';
            document.getElementById('ev-categoria').value = data.categoria || '';
            document.getElementById('ev-fecha-inicio').value = data.fecha_inicio ? new Date(data.fecha_inicio).toISOString().slice(0, 16) : '';
            document.getElementById('ev-fecha-fin').value = data.fecha_fin ? new Date(data.fecha_fin).toISOString().slice(0, 16) : '';
            document.getElementById('ev-ubicacion').value = data.ubicacion || data.location_name || '';
            document.getElementById('ev-gmaps').value = data.gmaps_link || data.external_link || '';
            document.getElementById('ev-lat').value = data.latitud || data.lat || '';
            document.getElementById('ev-lng').value = data.longitud || data.lng || '';
            
            // Cargar múltiples imágenes
            const imgArrayInput = document.getElementById('ev-imagenes-array');
            const previewGrid = document.getElementById('ev-images-preview-grid');
            let imgs = data.imagenes || [];
            if (!Array.isArray(imgs)) imgs = [];
            if (imgs.length === 0 && (data.imagen_url || data.imagen)) {
                imgs.push(data.imagen_url || data.imagen);
            }
            imgArrayInput.value = JSON.stringify(imgs);
            renderizarGridImagenes(imgs, previewGrid, imgArrayInput);
            
            document.getElementById('ev-descripcion').value = data.descripcion || '';
            document.getElementById('ev-reg-link').value = data.sumate_link || '';
            
            await cargarSedesEvento();
            if (data.sede_id) document.getElementById('ev-sede').value = data.sede_id;
            
            document.getElementById('modal-nuevo-evento').classList.remove('hidden');
        } else if (tipo === 'lugar') {
            const form = document.getElementById('form-nuevo-lugar');
            form.reset();
            form.dataset.editId = id;

            document.getElementById('pl-nombre').value = data.nombre || data.titulo || '';
            document.getElementById('pl-categoria').value = data.categoria || '';
            document.getElementById('pl-ubicacion').value = data.ubicacion || data.location_name || '';
            document.getElementById('pl-gmaps').value = data.gmaps_link || data.external_link || '';
            document.getElementById('pl-lat').value = data.latitud || '';
            document.getElementById('pl-lng').value = data.longitud || '';
            document.getElementById('pl-imagen-url').value = data.imagen_url || data.imagen || '';
            document.getElementById('pl-descripcion').value = data.descripcion || '';
            document.getElementById('pl-reg-link').value = data.sumate_link || '';

            document.getElementById('modal-nuevo-lugar').classList.remove('hidden');
        } else if (tipo === 'perfiles') {
            const form = document.getElementById('form-profile-edit');
            form.dataset.editId = id;

            document.getElementById('prof-nombre').value = data.nombre_completo || '';
            document.getElementById('prof-rol').value = data.rol || '';
            document.getElementById('prof-telefono').value = data.telefono || '';
            document.getElementById('prof-bio').value = data.bio || '';
            document.getElementById('prof-web').value = data.sitio_web || '';
            
            // Redes Sociales
            const links = data.links_sociales || {};
            document.getElementById('prof-fb').value = links.facebook || '';
            document.getElementById('prof-ig').value = links.instagram || '';
            document.getElementById('prof-x').value = links.twitter || '';

            // Preview Avatar
            const preview = document.getElementById('prof-avatar-preview');
            if (data.avatar_url) {
                preview.innerHTML = `<img src="${data.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:40px;">`;
            } else {
                preview.innerHTML = (data.nombre_completo || 'U').charAt(0).toUpperCase();
            }

            // Mostrar/Ocultar sección de seguridad según sea el usuario actual
            const secSelf = document.getElementById('security-controls-self');
            const secOther = document.getElementById('security-controls-other');
            const secNote = document.getElementById('security-note-admin');

            if (secSelf && secOther) {
                if (id === session.user.id) {
                    secSelf.style.display = 'block';
                    secOther.style.display = 'none';
                    document.getElementById('prof-email').value = session.user.email;
                    if (secNote) secNote.innerText = "Nota: Solo puedes modificar tus propias credenciales.";
                } else {
                    secSelf.style.display = 'none';
                    secOther.style.display = 'block';
                    // Intentar obtener email del registro si existe
                    form.dataset.targetEmail = data.email || '';
                    if (secNote) secNote.innerText = "Nota: Por seguridad, como administrador solo puedes enviar un enlace de recuperación.";
                }
            }

            document.getElementById('profile-modal').classList.remove('hidden');



        } else if (tipo === 'contenido_secciones') {
            const form = document.getElementById('form-nuevo-contenido');
            form.reset();
            form.dataset.editId = id;
            
            const secId = data.seccion_id;
            renderDynamicFields(secId);

            document.getElementById('co-titulo').value = data.titulo || '';
            document.getElementById('co-enlace').value = data.enlace_externo || '';
            document.getElementById('co-imagen-url').value = data.imagen_url || '';
            document.getElementById('co-estado').value = data.estado || 'publicado';

            // Intentar parsear metadatos del campo descripción
            let meta = {};
            let descripcionPura = data.descripcion || '';
            try {
                if (descripcionPura.trim().startsWith('{')) {
                    meta = JSON.parse(descripcionPura);
                    document.getElementById('co-descripcion').value = meta.descripcion_texto || '';
                } else {
                    document.getElementById('co-descripcion').value = descripcionPura;
                }
            } catch (e) {
                document.getElementById('co-descripcion').value = descripcionPura;
            }

            // Llenar campos dinámicos
            if (SECTION_CONFIGS[secId]) {
                SECTION_CONFIGS[secId].fields.forEach(f => {
                    const el = document.getElementById(`meta-${f.id}`);
                    if (el && meta[f.id]) el.value = meta[f.id];
                });
            }

            const preview = document.getElementById('co-image-preview');
            if (data.imagen_url) {
                preview.innerHTML = `<img src="${data.imagen_url}" style="width:100%; height:100%; object-fit:cover;">`;
                preview.classList.remove('hidden');
            } else {
                preview.classList.add('hidden');
            }

            document.getElementById('contenido-modal-title').innerText = `Editar ${SECTION_CONFIGS[secId]?.label || 'Recurso'}`;
            document.getElementById('modal-nuevo-contenido').classList.remove('hidden');

        } else {
            showToast('Edición en construcción para esta sección', 'info');
        }
    };

    // --- Subida de imagen para EVENTOS ---
    const btnUploadEv = document.getElementById('ev-btn-trigger-upload');
    const inputImgEv = document.getElementById('ev-imagen-file');
    if (btnUploadEv && inputImgEv) {
        btnUploadEv.onclick = () => inputImgEv.click();
        inputImgEv.onchange = async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            
            btnUploadEv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
            btnUploadEv.disabled = true;
            
            const arrayInput = document.getElementById('ev-imagenes-array');
            const previewGrid = document.getElementById('ev-images-preview-grid');
            let currentImgs = JSON.parse(arrayInput.value || '[]');

            try {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const blob = await compressImage(file);
                    const fileName = `evento_${Date.now()}_${i}.webp`;
                    const filePath = `${session.user.id}/${fileName}`;
                    const { error: uploadError } = await supabase.storage.from('imagenes-plataforma').upload(filePath, blob, { upsert: true });
                    if (uploadError) throw uploadError;
                    
                    const { data } = supabase.storage.from('imagenes-plataforma').getPublicUrl(filePath);
                    currentImgs.push(data.publicUrl);
                }
                
                arrayInput.value = JSON.stringify(currentImgs);
                renderizarGridImagenes(currentImgs, previewGrid, arrayInput);
                showToast(`✅ ${files.length} imagen(es) subida(s)`);
            } catch (err) {
                console.error(err);
                showToast('❌ Error al subir imágenes', 'error');
            } finally {
                btnUploadEv.innerHTML = '<i class="fa-solid fa-images"></i> Añadir Imágenes';
                btnUploadEv.disabled = false;
                inputImgEv.value = ''; // Resetear input
            }
        };
    }

    // Helper para renderizar la cuadrícula de imágenes
    window.renderizarGridImagenes = function(imgsArray, gridElement, hiddenInput) {
        gridElement.innerHTML = '';
        imgsArray.forEach((url, index) => {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.width = '100%';
            wrapper.style.paddingBottom = '100%'; // Aspect ratio 1:1
            wrapper.style.borderRadius = '8px';
            wrapper.style.overflow = 'hidden';

            const img = document.createElement('img');
            img.src = url;
            img.style.position = 'absolute';
            img.style.top = '0';
            img.style.left = '0';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            const btnDelete = document.createElement('button');
            btnDelete.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            btnDelete.type = 'button';
            btnDelete.style.position = 'absolute';
            btnDelete.style.top = '5px';
            btnDelete.style.right = '5px';
            btnDelete.style.background = 'rgba(255,0,0,0.8)';
            btnDelete.style.color = 'white';
            btnDelete.style.border = 'none';
            btnDelete.style.borderRadius = '50%';
            btnDelete.style.width = '24px';
            btnDelete.style.height = '24px';
            btnDelete.style.cursor = 'pointer';
            btnDelete.style.display = 'flex';
            btnDelete.style.alignItems = 'center';
            btnDelete.style.justifyContent = 'center';
            btnDelete.style.fontSize = '12px';

            btnDelete.onclick = (e) => {
                e.stopPropagation();
                imgsArray.splice(index, 1);
                hiddenInput.value = JSON.stringify(imgsArray);
                renderizarGridImagenes(imgsArray, gridElement, hiddenInput);
            };

            wrapper.appendChild(img);
            wrapper.appendChild(btnDelete);
            gridElement.appendChild(wrapper);
        });
    };

    // --- Guardar EVENTO ---
    const formEvento = document.getElementById('form-nuevo-evento');
    if (formEvento) {
        formEvento.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-evento');
            const origHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            btn.disabled = true;

            try {
                    const imgsArray = JSON.parse(document.getElementById('ev-imagenes-array').value || '[]');
                    const payload = {
                    nombre: document.getElementById('ev-nombre').value,
                    categoria: document.getElementById('ev-categoria').value,
                    lugar_id: document.getElementById('ev-sede').value || null,
                    fecha_inicio: document.getElementById('ev-fecha-inicio').value,
                    fecha_fin: document.getElementById('ev-fecha-fin').value,
                    ubicacion: document.getElementById('ev-ubicacion').value,
                    mapa_url: document.getElementById('ev-gmaps').value,   // columna real en BD
                    lat: parseFloat(document.getElementById('ev-lat').value) || null,
                    lng: parseFloat(document.getElementById('ev-lng').value) || null,
                    imagen_url: imgsArray.length > 0 ? imgsArray[0] : '', // Mantener retrocompatibilidad
                    imagenes: imgsArray, // Nueva columna array
                    descripcion: document.getElementById('ev-descripcion').value,
                    reg_link: document.getElementById('ev-reg-link').value, // columna real en BD
                    owner_id: session.user.id
                };

                const editId = formEvento.dataset.editId;
                const { error } = editId 
                    ? await supabase.from('eventos').update(payload).eq('id', editId)
                    : await supabase.from('eventos').insert(payload);

                if (error) throw error;
                showToast('✅ Evento guardado exitosamente');
                document.getElementById('modal-nuevo-evento').classList.add('hidden');
                formEvento.reset();
                document.getElementById('ev-imagenes-array').value = '[]';
                document.getElementById('ev-images-preview-grid').innerHTML = '';
                delete formEvento.dataset.editId;
                cargarDatos(currentAdminFilter);
            } catch (err) {
                console.error(err);
                showToast('❌ Error al guardar evento', 'error');
            } finally {
                btn.innerHTML = origHTML;
                btn.disabled = false;
            }
        };
    }

    // --- Subida de imagen para LUGARES ---
    const btnUploadPl = document.getElementById('pl-btn-trigger-upload');
    const inputImgPl = document.getElementById('pl-imagen-file');
    if (btnUploadPl && inputImgPl) {
        btnUploadPl.onclick = () => inputImgPl.click();
        inputImgPl.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            btnUploadPl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
            btnUploadPl.disabled = true;
            try {
                const blob = await compressImage(file);
                const fileName = `lugar_${Date.now()}.webp`;
                const filePath = `${session.user.id}/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('imagenes-plataforma').upload(filePath, blob, { upsert: true });
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('imagenes-plataforma').getPublicUrl(filePath);
                document.getElementById('pl-imagen-url').value = data.publicUrl;
                showToast('✅ Imagen lista');
            } catch (err) {
                console.error(err);
                showToast('❌ Error al subir imagen', 'error');
            } finally {
                btnUploadPl.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Seleccionar otra';
                btnUploadPl.disabled = false;
            }
        };
    }

    // --- Guardar LUGAR ---
    const formLugar = document.getElementById('form-nuevo-lugar');
    if (formLugar) {
        formLugar.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-lugar');
            const origHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            btn.disabled = true;

            try {
                const payload = {
                    nombre: document.getElementById('pl-nombre').value,
                    categoria: document.getElementById('pl-categoria').value,
                    ubicacion: document.getElementById('pl-ubicacion').value,
                    mapa_url: document.getElementById('pl-gmaps').value,   // columna real en BD
                    lat: parseFloat(document.getElementById('pl-lat').value) || null,
                    lng: parseFloat(document.getElementById('pl-lng').value) || null,
                    imagen_url: document.getElementById('pl-imagen-url').value, // columna real tras REORGANIZACION_DB_FINAL
                    descripcion: document.getElementById('pl-descripcion').value,
                    reg_link: document.getElementById('pl-reg-link').value, // columna real en BD
                    owner_id: session.user.id
                };

                const editId = formLugar.dataset.editId;
                const { error } = editId 
                    ? await supabase.from('lugares').update(payload).eq('id', editId)
                    : await supabase.from('lugares').insert(payload);

                if (error) throw error;
                showToast('✅ Lugar guardado exitosamente');
                document.getElementById('modal-nuevo-lugar').classList.add('hidden');
                formLugar.reset();
                delete formLugar.dataset.editId;
                cargarDatos(currentAdminFilter);
            } catch (err) {
                console.error(err);
                showToast('❌ Error al guardar lugar', 'error');
            } finally {
                btn.innerHTML = origHTML;
                btn.disabled = false;
            }
        };
    }

    // --- Subida de imagen para CONTENIDO SECCIONES ---
    const btnUploadCo = document.getElementById('co-btn-trigger-upload');
    const inputImgCo = document.getElementById('co-imagen-file');
    if (btnUploadCo && inputImgCo) {
        btnUploadCo.onclick = () => inputImgCo.click();
        inputImgCo.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            btnUploadCo.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
            btnUploadCo.disabled = true;
            try {
                const blob = await compressImage(file);
                const fileName = `content_${Date.now()}.webp`;
                const filePath = `${session.user.id}/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('imagenes-plataforma').upload(filePath, blob, { upsert: true });
                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('imagenes-plataforma').getPublicUrl(filePath);
                document.getElementById('co-imagen-url').value = data.publicUrl;
                
                const preview = document.getElementById('co-image-preview');
                preview.innerHTML = `<img src="${data.publicUrl}" style="width:100%; height:100%; object-fit:cover;">`;
                preview.classList.remove('hidden');
                
                showToast('✅ Imagen lista');
            } catch (err) {
                console.error(err);
                showToast('❌ Error al subir imagen', 'error');
            } finally {
                btnUploadCo.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Seleccionar otra';
                btnUploadCo.disabled = false;
            }
        };
    }

    // --- Guardar CONTENIDO DINÁMICO ---
    const formContenido = document.getElementById('form-nuevo-contenido');
    if (formContenido) {
        formContenido.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-contenido');
            const origHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            btn.disabled = true;

            try {
                const [_, secId, hub] = currentAdminFilter.split('_');

                // Recolectar metadatos dinámicos
                const meta = {
                    descripcion_texto: document.getElementById('co-descripcion').value
                };
                if (SECTION_CONFIGS[secId]) {
                    SECTION_CONFIGS[secId].fields.forEach(f => {
                        const el = document.getElementById(`meta-${f.id}`);
                        if (el) meta[f.id] = el.value;
                    });
                }

                const payload = {
                    titulo: document.getElementById('co-titulo').value,
                    enlace_externo: document.getElementById('co-enlace').value || null,
                    descripcion: JSON.stringify(meta),
                    imagen_url: document.getElementById('co-imagen-url').value || null,
                    estado: document.getElementById('co-estado').value,
                    seccion_id: secId,
                    parent_hub: hub,
                    owner_id: session.user.id,
                    updated_at: new Date()
                };

                const editId = formContenido.dataset.editId;
                const { error } = editId 
                    ? await supabase.from('contenido_secciones').update(payload).eq('id', editId)
                    : await supabase.from('contenido_secciones').insert(payload);

                if (error) throw error;

                showToast(`✅ Recurso ${editId ? 'actualizado' : 'creado'} correctamente`);
                document.getElementById('modal-nuevo-contenido').classList.add('hidden');
                formContenido.reset();
                delete formContenido.dataset.editId;
                cargarDatos(currentAdminFilter);
            } catch (err) {
                console.error(err);
                showToast('❌ Error al guardar recurso', 'error');
            } finally {
                btn.innerHTML = origHTML;
                btn.disabled = false;
            }
        };
    }

    // --- Cierre de modales extendido ---
    document.querySelectorAll('.btn-close-modal, #btn-cancelar-contenido, #btn-close-contenido').forEach(btn => {
        const original = btn.onclick;
        btn.onclick = () => {
            if (original) original();
            document.getElementById('modal-nuevo-contenido').classList.add('hidden');
        };
    });

    // --- GESTIÓN DE PERFIL COMPLETA (ADMIN) ---
    async function compressImage(file, { maxWidth = 800, quality = 0.7 } = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                            type: 'image/webp',
                            lastModified: Date.now()
                        }));
                    }, 'image/webp', quality);
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    }

    async function uploadToSupabase(supabase, file) {
        try {
            const compressedFile = await compressImage(file);
            const fileExt = 'webp';
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `avatares/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('imagenes-plataforma')
                .upload(filePath, compressedFile);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('imagenes-plataforma').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (error) {
            console.error('Error in uploadToSupabase:', error);
            throw error;
        }
    }

    // Manejar previsualización de nuevo avatar en modal de edición de agente
    const profAvatarInput = document.getElementById('prof-avatar-input');
    if (profAvatarInput) {
        profAvatarInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.getElementById('prof-avatar-preview').innerHTML = `<img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:40px;">`;
                };
                reader.readAsDataURL(file);
            }
        };
    }

    const formProfileEdit = document.getElementById('form-profile-edit');
    if (formProfileEdit) {
        formProfileEdit.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-save-user-profile');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            btn.disabled = true;

            try {
                const editId = formProfileEdit.dataset.editId;
                
                // 1. Subir nueva imagen si se seleccionó
                let avatarUrl = null;
                const file = profAvatarInput.files[0];
                if (file) {
                    avatarUrl = await uploadToSupabase(supabase, file);
                }

                const payload = {
                    nombre_completo: document.getElementById('prof-nombre').value,
                    rol: document.getElementById('prof-rol').value,
                    telefono: document.getElementById('prof-telefono').value,
                    bio: document.getElementById('prof-bio').value,
                    sitio_web: document.getElementById('prof-web').value,
                    links_sociales: {
                        facebook: document.getElementById('prof-fb').value,
                        instagram: document.getElementById('prof-ig').value,
                        twitter: document.getElementById('prof-x').value
                    },
                    updated_at: new Date()
                };

                if (avatarUrl) payload.avatar_url = avatarUrl;


                const { error } = await supabase.from('perfiles').update(payload).eq('id', editId);
                if (error) throw error;

                // Actualizar Sidebar inmediatamente
                const sidebarAvatar = document.getElementById('sidebar-avatar');
                if (sidebarAvatar && avatarUrl) {
                    sidebarAvatar.style.backgroundImage = `url("${avatarUrl}")`;
                    sidebarAvatar.textContent = '';
                }
                
                showToast('✅ Perfil actualizado correctamente');
                document.getElementById('profile-modal').classList.add('hidden');
                formProfileEdit.reset();
                delete formProfileEdit.dataset.editId;
                cargarDatos(currentAdminFilter);
            } catch (err) {
                console.error(err);
                showToast('❌ Error al actualizar perfil', 'error');
            } finally {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        };
    }

    // --- SEGURIDAD: Actualizar EMAIL/PASS desde el Modal de Perfil ---
    const btnProfUpdateEmail = document.getElementById('btn-prof-update-email');
    if (btnProfUpdateEmail) {
        btnProfUpdateEmail.onclick = async () => {
            const newEmail = document.getElementById('prof-email').value;
            const editId = formProfileEdit.dataset.editId;
            
            if (editId !== session.user.id) {
                showToast('⚠️ Solo puedes cambiar tu propio correo', 'info');
                return;
            }
            if (!newEmail || newEmail === session.user.email) return;

            btnProfUpdateEmail.disabled = true;
            try {
                const { error } = await supabase.auth.updateUser({ email: newEmail });
                if (error) throw error;
                showToast('✅ Correo actualizado. Revisa ambos correos para confirmar.');
            } catch (err) {
                showToast('❌ Error: ' + err.message, 'error');
            } finally {
                btnProfUpdateEmail.disabled = false;
            }
        };
    }

    const btnProfUpdatePass = document.getElementById('btn-prof-update-pass');
    if (btnProfUpdatePass) {
        btnProfUpdatePass.onclick = async () => {
            const newPass = document.getElementById('prof-password').value;
            const editId = formProfileEdit.dataset.editId;

            if (editId !== session.user.id) {
                showToast('⚠️ Solo puedes cambiar tu propia contraseña', 'info');
                return;
            }
            if (!newPass || newPass.length < 6) {
                showToast('⚠️ La contraseña debe tener al menos 6 caracteres', 'info');
                return;
            }

            btnProfUpdatePass.disabled = true;
            try {
                const { error } = await supabase.auth.updateUser({ password: newPass });
                if (error) throw error;
                showToast('✅ Contraseña actualizada correctamente');
                document.getElementById('prof-password').value = '';
            } catch (err) {
                showToast('❌ Error: ' + err.message, 'error');
            } finally {
                btnProfUpdatePass.disabled = false;
            }
        };
    }


    // --- SEGURIDAD: Enviar Enlace de Recuperación (para otros usuarios) ---
    const btnProfSendReset = document.getElementById('btn-prof-send-reset');
    if (btnProfSendReset) {
        btnProfSendReset.onclick = async () => {
            const form = document.getElementById('form-profile-edit');
            let targetEmail = form.dataset.targetEmail;
            
            if (!targetEmail || targetEmail === 'undefined' || targetEmail === '') {
                targetEmail = prompt("No tenemos el correo de este usuario en la base de datos de perfiles. Por favor, ingrésalo para enviar el enlace:");
                if (!targetEmail) return;
            }

            btnProfSendReset.disabled = true;
            const originalHtml = btnProfSendReset.innerHTML;
            btnProfSendReset.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

            try {
                const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
                    redirectTo: window.location.origin + '/admin.html',
                });
                if (error) throw error;
                showToast('✅ Enlace de recuperación enviado a ' + targetEmail);
            } catch (err) {
                showToast('❌ Error: ' + err.message, 'error');
            } finally {
                btnProfSendReset.disabled = false;
                btnProfSendReset.innerHTML = originalHtml;
            }
        };
    }

    // Logout
    document.getElementById('logout-btn').onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = './index.html';
    };

    // Export window functions for buttons in table
    window.eliminarRegistro = async (id, tipo, nombre) => {
        if (!confirm(`¿Eliminar "${nombre}"?`)) return;
        const tabla = tipo === 'evento' ? 'eventos' : (tipo === 'lugar' ? 'lugares' : tipo);
        const { error } = await supabase.from(tabla).delete().eq('id', id);
        if (!error) { showToast('Eliminado'); cargarDatos(currentAdminFilter); }
    };

    function cargarDatosPerfil(p) {
        document.getElementById('p-nombre').value = p.nombre_completo || '';
        document.getElementById('p-telefono').value = p.telefono || '';
        document.getElementById('p-bio').value = p.bio || '';
        
        const preview = document.getElementById('edit-avatar-preview');
        if (p.avatar_url) {
            preview.innerHTML = `<img src="${p.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:30px;">`;
        } else {
            preview.innerHTML = (p.nombre_completo || 'U').charAt(0).toUpperCase();
        }

        const emailText = document.getElementById('p-email-display-text');
        if (emailText) emailText.textContent = session.user.email || '...';
        
        if (p.links_sociales) {
            document.getElementById('p-fb').value = p.links_sociales.facebook || '';
            document.getElementById('p-ig').value = p.links_sociales.instagram || '';
            document.getElementById('p-x').value = p.links_sociales.twitter || '';
            document.getElementById('p-web').value = p.links_sociales.web || '';
        }
    }

    // Lógica para subir archivos en notificaciones (ARREGLADO)
    const btnUploadNotif = document.getElementById('btn-upload-notif');
    const inputNotifFile = document.getElementById('n-file');
    let isUploadingNotif = false;

    function updateNotifFilePreview(url) {
        const previewCont = document.getElementById('n-file-preview');
        const previewImg = document.getElementById('n-preview-img');
        const previewFileInfo = document.getElementById('n-preview-file-info');
        const previewFileName = document.getElementById('n-preview-file-name');

        if (!previewCont) return;

        if (!url) {
            previewCont.classList.add('hidden');
            return;
        }

        previewCont.classList.remove('hidden');
        const isImage = url.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i) || url.includes('image');

        if (isImage) {
            previewImg.src = url;
            previewImg.classList.remove('hidden');
            previewFileInfo.classList.add('hidden');
        } else {
            previewImg.classList.add('hidden');
            previewFileInfo.classList.remove('hidden');
            const name = url.split('/').pop().split('?')[0];
            previewFileName.textContent = name.length > 25 ? name.substring(0, 22) + '...' : name;
        }
    }

    if (btnUploadNotif && inputNotifFile) {
        btnUploadNotif.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isUploadingNotif) inputNotifFile.click();
        });

        inputNotifFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || isUploadingNotif) return;
            
            isUploadingNotif = true;
            const txt = document.getElementById('txt-file-name');
            const originalText = txt.textContent;
            txt.textContent = 'Subiendo...';
            btnUploadNotif.style.opacity = '0.7';

            try {
                const fileName = `notif_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                const filePath = `notificaciones/${session.user.id}/${fileName}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('imagenes-plataforma')
                    .upload(filePath, file, { cacheControl: '3600', upsert: true });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('imagenes-plataforma').getPublicUrl(filePath);
                document.getElementById('n-archivo-url').value = data.publicUrl;
                txt.textContent = `📎 ${file.name}`;
                
                updateNotifFilePreview(data.publicUrl);
                
                const btnClear = document.getElementById('btn-clear-notif-file');
                if (btnClear) btnClear.classList.remove('hidden');
                
                showToast('✅ Archivo adjunto listo');
            } catch (err) {
                console.error('[Upload Error]', err);
                txt.textContent = 'Error al subir';
                showToast('❌ Error al subir: Revisa los permisos de Storage', 'error');
            } finally {
                isUploadingNotif = false;
                btnUploadNotif.style.opacity = '1';
                // Reset file input to allow re-selecting same file if needed
                inputNotifFile.value = '';
            }
        });
    }

    // Lógica para el botón de "tache" (Eliminar adjunto)
    const btnClearNotifFile = document.getElementById('btn-clear-notif-file');
    if (btnClearNotifFile) {
        btnClearNotifFile.onclick = () => {
            document.getElementById('n-archivo-url').value = '';
            document.getElementById('txt-file-name').textContent = 'Seleccionar archivo...';
            document.getElementById('n-file').value = '';
            updateNotifFilePreview(null);
            btnClearNotifFile.classList.add('hidden');
            showToast('🗑️ Adjunto eliminado', 'info');
        };
    }

    // BOTONES DE SEGURIDAD INDEPENDIENTES
    const btnUpdateEmail = document.getElementById('btn-update-email');
    if (btnUpdateEmail) {
        btnUpdateEmail.onclick = async () => {
            const newEmail = document.getElementById('p-new-email').value;
            if (!newEmail || newEmail === session.user.email) return showToast('Ingresa un correo diferente', 'info');
            
            btnUpdateEmail.disabled = true;
            btnUpdateEmail.textContent = 'Procesando...';
            
            try {
                const { error } = await supabase.auth.updateUser({ email: newEmail });
                if (error) throw error;
                showToast('📧 Confirma el cambio en AMBOS correos');
                document.getElementById('p-new-email').value = '';
            } catch (err) {
                showToast('❌ Error: ' + err.message, 'error');
            } finally {
                btnUpdateEmail.disabled = false;
                btnUpdateEmail.textContent = 'Actualizar Correo';
            }
        };
    }

    const btnUpdatePass = document.getElementById('btn-update-pass');
    if (btnUpdatePass) {
        btnUpdatePass.onclick = async () => {
            const newPass = document.getElementById('p-new-password').value;
            if (!newPass || newPass.length < 6) return showToast('Mínimo 6 caracteres', 'info');
            
            btnUpdatePass.disabled = true;
            btnUpdatePass.textContent = 'Cambiando...';
            
            try {
                const { error } = await supabase.auth.updateUser({ password: newPass });
                if (error) throw error;
                showToast('🔑 Contraseña actualizada');
                document.getElementById('p-new-password').value = '';
            } catch (err) {
                showToast('❌ Error: ' + err.message, 'error');
            } finally {
                btnUpdatePass.disabled = false;
                btnUpdatePass.textContent = 'Cambiar Contraseña';
            }
        };
    }

    // Manejar previsualización de nuevo avatar en "Mi Perfil"
    const pAvatarInput = document.getElementById('p-avatar-input');
    if (pAvatarInput) {
        pAvatarInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.getElementById('edit-avatar-preview').innerHTML = `<img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:30px;">`;
                };
                reader.readAsDataURL(file);
            }
        };
    }

    document.getElementById('form-perfil-full').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-perfil');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';

        try {
            // 1. Subir nueva imagen si se seleccionó
            let avatarUrl = null;
            const file = pAvatarInput.files[0];
            if (file) {
                avatarUrl = await uploadToSupabase(supabase, file);
            }

            const updates = {
                nombre_completo: document.getElementById('p-nombre').value,
                telefono: document.getElementById('p-telefono').value,
                bio: document.getElementById('p-bio').value,
                links_sociales: {
                    facebook: document.getElementById('p-fb').value,
                    instagram: document.getElementById('p-ig').value,
                    twitter: document.getElementById('p-x').value,
                    web: document.getElementById('p-web').value
                },
                updated_at: new Date()
            };

            if (avatarUrl) updates.avatar_url = avatarUrl;

            // Solo actualizar Datos de Perfil (Public)
            const { error: profileError } = await supabase.from('perfiles').update(updates).eq('id', session.user.id);
            if (profileError) throw profileError;

            showToast('✅ Datos públicos actualizados');
            perfil = { ...perfil, ...updates };
            // Actualizar la UI del header si existe
            if (typeof updateHeaderInfo === 'function') updateHeaderInfo(perfil);
            
        } catch (err) {
            console.error(err);
            showToast('❌ Error al actualizar perfil', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    };

    // ========== GESTIÓN DE PERMISOS (MODERNIZADO) ==========
    const permsModal = document.getElementById('permissions-modal');
    const permsList = document.getElementById('permissions-list');
    let currentPermsUserId = null;

    window.gestionarPermisos = async (userId) => {
        currentPermsUserId = userId;
        permsList.innerHTML = '<p style="grid-column: span 3; text-align: center; padding: 40px;">Cargando permisos...</p>';
        permsModal.classList.remove('hidden');

        try {
            // 1. Cargar Permisos de Hubs/Secciones
            const { data: currentPerms } = await supabase.from('permisos_actores').select('seccion_id, parent_hub').eq('user_id', userId);
            
            // 2. Cargar Permisos de Funciones (Resiliente a 404/406)
            let fnPerms = null;
            try {
                // Usamos maybeSingle() para evitar errores si no hay filas o si hay problemas de schema cache
                const { data, error } = await supabase.from('permisos_funciones').select('*').eq('user_id', userId).maybeSingle();
                if (!error) fnPerms = data;
            } catch (e) {
                console.warn('[Admin] Tabla permisos_funciones no disponible o error 406:', e);
            }


            // Setear switches de funciones
            const fnEventos = document.getElementById('fn-eventos');
            const fnLugares = document.getElementById('fn-lugares');
            const fnNotifs = document.getElementById('fn-notifs');
            const fnDirectorio = document.getElementById('fn-directorio');
            const fnReadonly = document.getElementById('fn-readonly');

            if (fnEventos) fnEventos.checked = fnPerms ? fnPerms.puede_crear_eventos : true;
            if (fnLugares) fnLugares.checked = fnPerms ? fnPerms.puede_crear_lugares : true;
            if (fnNotifs) fnNotifs.checked = fnPerms ? fnPerms.puede_enviar_notificaciones : false;
            if (fnDirectorio) fnDirectorio.checked = fnPerms ? fnPerms.visible_en_directorio : true;
            if (fnReadonly) fnReadonly.checked = fnPerms ? fnPerms.modo_solo_lectura : false;

            
            const hubs = {
                colibri: { label: 'Hub Colibrí', color: '#72B04D', icon: 'feather', sections: [
                    { id: 'agua', label: 'Agua y Cuenca' }, { id: 'cursos', label: 'Cursos' }, { id: 'ecotecnias', label: 'Ecotecnias' },
                    { id: 'lecturas', label: 'Lecturas' }, { id: 'documentales', label: 'Cine/Documental' }, { id: 'firmas', label: 'Peticiones' }
                ]},
                ajolote: { label: 'Hub Ajolote', color: '#FF6B6B', icon: 'component', sections: [
                    { id: 'convocatoria', label: 'Convocatorias' }, { id: 'voluntariados', label: 'Voluntariados' },
                    { id: 'agentes', label: 'Agentes de Cambio' }, { id: 'eventos', label: 'Eventos' }
                ]},
                lobo: { label: 'Hub Lobo', color: '#4D96FF', icon: 'dog', sections: [
                    { id: 'fondos', label: 'Fondos y Apoyos' }, { id: 'normativa', label: 'Normativa Ambiental' }
                ]}
            };

            permsList.innerHTML = '';
            
            Object.keys(hubs).forEach(hubId => {
                const hub = hubs[hubId];
                const col = document.createElement('div');
                col.className = `perm-column hub-${hubId}`;
                col.style.setProperty('--hub-color', hub.color);
                
                let sectionHtml = '';
                hub.sections.forEach(sec => {
                    const hasPerm = currentPerms?.some(p => p.seccion_id === sec.id && p.parent_hub === hubId);
                    sectionHtml += `
                        <label class="perm-item">
                            <input type="checkbox" data-sec="${sec.id}" data-hub="${hubId}" ${hasPerm ? 'checked' : ''}>
                            <span>${sec.label}</span>
                        </label>
                    `;
                });

                col.innerHTML = `
                    <div class="hub-header" style="color: ${hub.color}">
                        <i data-lucide="${hub.icon}"></i>
                        <span>${hub.label}</span>
                    </div>
                    <div class="hub-sections">
                        ${sectionHtml}
                    </div>
                `;
                permsList.appendChild(col);
            });

            if (typeof lucide !== 'undefined') lucide.createIcons();

        } catch (err) {
            console.error('Error al cargar permisos:', err);
            showToast('Error al cargar permisos', 'error');
        }
    };

    document.getElementById('btn-close-perms').onclick = () => permsModal.classList.add('hidden');
    document.getElementById('btn-cancel-perms').onclick = () => permsModal.classList.add('hidden');

    document.getElementById('btn-save-perms').onclick = async () => {
        const btn = document.getElementById('btn-save-perms');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';

        try {
            // 1. Guardar Permisos de Hubs/Secciones
            const checks = permsList.querySelectorAll('input[type="checkbox"]');
            const newPerms = Array.from(checks)
                .filter(c => c.checked)
                .map(c => ({
                    user_id: currentPermsUserId,
                    seccion_id: c.dataset.sec,
                    parent_hub: c.dataset.hub
                }));

            await supabase.from('permisos_actores').delete().eq('user_id', currentPermsUserId);
            if (newPerms.length > 0) {
                const { error } = await supabase.from('permisos_actores').insert(newPerms);
                if (error) throw error;
            }

            // 2. Guardar Permisos de Funciones (UPSERT)
            const fnUpdates = {
                user_id: currentPermsUserId,
                puede_crear_eventos: document.getElementById('fn-eventos').checked,
                puede_crear_lugares: document.getElementById('fn-lugares').checked,
                puede_enviar_notificaciones: document.getElementById('fn-notifs').checked,
                visible_en_directorio: document.getElementById('fn-directorio').checked,
                modo_solo_lectura: document.getElementById('fn-readonly').checked,
                updated_at: new Date()
            };

            // 2. Guardar Permisos de Funciones (Resiliente a 404)
            try {
                const { error: fnError } = await supabase.from('permisos_funciones').upsert(fnUpdates);
                if (fnError && fnError.code !== 'PGRST116') { // Ignorar si es error de tabla no encontrada o similar
                    console.error('[Admin] Error al guardar funciones:', fnError);
                }
            } catch (e) {
                console.warn('[Admin] Falló el guardado en permisos_funciones (posible tabla faltante)');
            }


            showToast('✅ Permisos actualizados correctamente');
            permsModal.classList.add('hidden');
        } catch (err) {
            console.error('Error al guardar permisos:', err);
            showToast('❌ Error al guardar cambios', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar';
        }
    };

    // --- LÓGICA DE MENSAJERÍA PARA SEGUIDORES ---
    window.abrirModalMensaje = (id = 'all', nombre = 'Todos mis seguidores') => {
        if (!modalMensaje) return;
        msgDestinatarioId.value = id;
        msgDestinatarioLabel.innerText = `Destinatario: ${nombre}`;
        document.getElementById('msg-titulo').value = '';
        document.getElementById('msg-cuerpo').value = '';
        modalMensaje.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    };

    if (btnNotificarSeguidores) {
        btnNotificarSeguidores.onclick = () => window.abrirModalMensaje('all', 'Todos mis seguidores');
    }

    if (document.getElementById('btn-close-msg-modal')) {
        document.getElementById('btn-close-msg-modal').onclick = () => modalMensaje.classList.add('hidden');
    }
    if (document.getElementById('btn-cancelar-msg')) {
        document.getElementById('btn-cancelar-msg').onclick = () => modalMensaje.classList.add('hidden');
    }

    if (formMensaje) {
        formMensaje.onsubmit = async (e) => {
            e.preventDefault();
            const btnSubmit = e.submitter;
            const originalText = btnSubmit.innerHTML;
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';

            const titulo = document.getElementById('msg-titulo').value;
            const cuerpo = document.getElementById('msg-cuerpo').value;
            const destinatarioId = msgDestinatarioId.value;

            try {
                // 1. Obtener destinatarios
                let userIds = [];
                if (destinatarioId === 'all') {
                    const { data, error: sErr } = await supabase.from('seguimientos_actores').select('user_id').eq('actor_id', session.user.id);
                    if (sErr) throw sErr;
                    userIds = data.map(u => u.user_id);
                } else {
                    userIds = [destinatarioId];
                }

                if (userIds.length === 0) {
                    showToast('⚠️ No hay seguidores a quienes notificar', 'warning');
                    return;
                }

                // 2. Crear notificación
                const { data: notif, error: nErr } = await supabase.from('notificaciones').insert({
                    titulo,
                    mensaje: cuerpo,
                    created_by: session.user.id
                }).select().single();

                if (nErr) throw nErr;

                // 3. Vincular con usuarios (por lotes si es necesario)
                const entries = userIds.map(uid => ({ notificacion_id: notif.id, usuario_id: uid }));
                const { error: dErr } = await supabase.from('notificaciones_usuarios').insert(entries);
                if (dErr) throw dErr;

                showToast('✅ Mensaje enviado con éxito');
                modalMensaje.classList.add('hidden');
            } catch (err) {
                console.error(err);
                showToast('❌ Error al enviar el mensaje', 'error');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = originalText;
            }
        };
    }

    // ========== ASIGNAR ACCIÓN AL LÁPIZ DE LA TABLA ==========
    // Reemplazamos la función editarPerfil que viene del listado
    window.editarPerfil = async (id) => {
        const profileModal = document.getElementById('profile-modal');
        const formProfileEdit = document.getElementById('form-profile-edit');
        const profEmailInput = document.getElementById('prof-email');
        
        try {
            const { data, error } = await supabase.from('perfiles').select('*').eq('id', id).single();
            if (error) throw error;

            if (data) {
                formProfileEdit.dataset.editId = id;
                document.getElementById('prof-nombre').value = data.nombre_completo || '';
                document.getElementById('prof-rol').value = data.rol || 'actor';
                document.getElementById('prof-telefono').value = data.telefono || '';
                document.getElementById('prof-bio').value = data.bio || '';
                document.getElementById('prof-web').value = data.sitio_web || '';
                
                // Intentar obtener el correo (si es el propio usuario o desde metadatos si los guardaste)
                if (profEmailInput) {
                    profEmailInput.value = data.email || ''; // Si agregamos email a perfiles
                }

                const links = data.links_sociales || {};
                document.getElementById('prof-fb').value = links.facebook || '';
                document.getElementById('prof-ig').value = links.instagram || '';
                document.getElementById('prof-x').value = links.twitter || '';
                
                // Mostrar avatar actual
                const preview = document.getElementById('prof-avatar-preview');
                if (data.avatar_url) {
                    preview.innerHTML = `<img src="${data.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:40px;">`;
                } else {
                    preview.innerHTML = (data.nombre_completo || 'U').charAt(0).toUpperCase();
                }
                
                // El email ya llega en data-target-email del form (puesto al abrir el modal)
                // data.email puede ser NULL en perfiles si el trigger aún no se actualizó
                const form = document.getElementById('form-profile-edit');
                const emailFromForm = form?.dataset?.targetEmail || '';
                const resolvedEmail = data.email || emailFromForm;

                const profEmailDisplay = document.getElementById('prof-email-display');
                if (profEmailDisplay) {
                    profEmailDisplay.value = resolvedEmail;
                }

                if (profEmailInput) {
                    profEmailInput.value = resolvedEmail;
                }

                // Limpiar cualquier aviso de tiempo previo (ya que decidimos no usarlo)
                const timeNotice = document.getElementById('edit-time-notice');
                if (timeNotice) timeNotice.remove();

                // Asegurar que el botÃ³n de guardar estÃ© siempre habilitado
                const saveBtn = document.getElementById('btn-save-user-profile');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.style.opacity = '1';
                    saveBtn.textContent = 'Actualizar Perfil';
                }

                profileModal.classList.remove('hidden');
            }
        } catch (err) {
            console.error(err);
            showToast('Error al cargar perfil', 'error');
        }
    };

    document.getElementById('btn-close-profile').onclick = () => document.getElementById('profile-modal').classList.add('hidden');
    document.getElementById('btn-cancel-profile').onclick = () => document.getElementById('profile-modal').classList.add('hidden');

    // ==========================================
    // CONTROL DE MENÃš DE ACCIONES Y MODERACIÃ“N
    // ==========================================

    window.toggleActionsMenu = (event, id) => {
        event.stopPropagation();
        const menu = document.getElementById(`menu-${id}`);
        const allMenus = document.querySelectorAll('.actions-menu');
        
        // Cerrar otros menÃºs
        allMenus.forEach(m => {
            if (m.id !== `menu-${id}`) m.classList.remove('active');
        });

        if (menu) {
            const isOpening = !menu.classList.contains('active');
            menu.classList.toggle('active');

            if (isOpening) {
                // Detectar espacio disponible debajo
                const rect = event.currentTarget.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                
                // Si hay menos de 220px debajo, abrir hacia arriba
                if (spaceBelow < 220) {
                    menu.style.top = 'auto';
                    menu.style.bottom = '100%';
                    menu.style.marginTop = '0';
                    menu.style.marginBottom = '8px';
                } else {
                    menu.style.top = '100%';
                    menu.style.bottom = 'auto';
                    menu.style.marginTop = '8px';
                    menu.style.marginBottom = '0';
                }
            }
        }

        // Cerrar al hacer clic fuera
        const closeMenu = (e) => {
            if (menu && !menu.contains(e.target)) {
                menu.classList.remove('active');
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    };

    window.moderarRegistro = async (id, tipo, nuevoEstado) => {
        const confirmMsg = nuevoEstado === 'approved' ? 'Â¿Aprobar publicaciÃ³n?' : 
                          (nuevoEstado === 'rejected' ? 'Â¿Rechazar definitivamente?' : 'Â¿Solicitar correcciones?');
        
        if (!confirm(confirmMsg)) return;

        let reviewNotes = '';
        if (nuevoEstado === 'correction' || nuevoEstado === 'rejected') {
            reviewNotes = prompt('Escribe el motivo o las correcciones necesarias:');
            if (reviewNotes === null) return;
        }

        try {
            const esPerfil = tipo === 'perfiles' || tipo === 'usuarios';
            const tabla = esPerfil ? 'perfiles' : (tipo === 'evento' ? 'eventos' : tipo);
            const campoEstado = esPerfil ? 'actor_status' : 'estado';
            
            const updates = {
                [campoEstado]: nuevoEstado === 'correction' ? 'pending' : nuevoEstado,
                review_notes: reviewNotes,
                reviewed_by: session.user.id,
                reviewed_at: new Date()
            };

            // Si es un perfil y lo estamos aprobando, le otorgamos el rol de actor
            if (esPerfil && nuevoEstado === 'approved') {
                updates.rol = 'actor';
            }

            console.log(`[Moderation] Actualizando ${tabla} (${id}) con estado: ${nuevoEstado}`);
            const { error } = await supabase.from(tabla).update(updates).eq('id', id);
            if (error) throw error;

            showToast(`âœ… Registro actualizado a ${nuevoEstado}`);
            
            // Enviar notificaciÃ³n al usuario/actor
            await enviarNotificacionRevision(id, tipo, nuevoEstado, reviewNotes);
            
            await updateBadges();
            cargarDatos(currentAdminFilter);
        } catch (err) {
            console.error('Error al moderar:', err);
            showToast('âŒ Error al procesar la moderaciÃ³n: ' + err.message, 'error');
        }
    };

    async function enviarNotificacionRevision(targetId, tipo, estado, notas) {
        try {
            const tabla = tipo === 'evento' ? 'eventos' : 'perfiles';
            const { data } = await supabase.from(tabla).select(tipo === 'evento' ? 'owner_id, nombre' : 'id, nombre_completo').eq('id', targetId).single();
            
            const userId = tipo === 'evento' ? data.owner_id : data.id;
            const nombreObj = tipo === 'evento' ? data.nombre : data.nombre_completo;

            if (!userId) return;

            const titulos = {
                approved: 'âœ… Â¡PublicaciÃ³n Aprobada!',
                rejected: 'âŒ PublicaciÃ³n Rechazada',
                correction: 'âœï¸ AcciÃ³n Requerida: Correcciones'
            };

            const mensajes = {
                approved: `Tu ${tipo} "${nombreObj}" ha sido aprobado y ya es visible en la plataforma.`,
                rejected: `Lo sentimos, tu ${tipo} "${nombreObj}" no cumple con los lineamientos: ${notas}`,
                correction: `Por favor, revisa y corrige tu ${tipo} "${nombreObj}". Nota del admin: ${notas}`
            };

            const { data: notif, error: nError } = await supabase.from('notificaciones').insert({
                remitente_id: session.user.id,
                titulo: titulos[estado],
                mensaje: mensajes[estado],
                destinatarios: 'privada'
            }).select().single();

            if (nError) throw nError;

            await supabase.from('notificaciones_usuarios').insert({
                notificacion_id: notif.id,
                usuario_id: userId,
                leido: false
            });
        } catch (err) { console.error(err); }
    }

    // --- GESTIÃ“N DE PARÃMETROS URL ---
    async function handleQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        const section = params.get('section');
        const hub = params.get('hub');

        if (action === 'new' && section && hub) {
            console.log(`[Admin] âš¡ AcciÃ³n rÃ¡pida detectada: Nuevo registro en ${section} (${hub})`);
            showHubMenu(hub);
            currentAdminFilter = `seccion_${section}_${hub}`;
            setTimeout(() => {
                const btnNuevo = document.getElementById('btn-nuevo');
                if (btnNuevo) btnNuevo.click();
            }, 500);
        }
    }

    // Ejecutar al final de la carga
    await handleQueryParams();
})();
