/* assets/js/pages/admin.js */
import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver, sanitize, showToast, formatearFechaRelativa } from '../ui-utils.js';

// Scripts with type="module" are automatically deferred, no need for DOMContentLoaded wrapper.
(async () => {
    console.log('[Admin] 🚀 Iniciando panel unificado...');
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
            } else if (view === 'notificaciones') {
                showNotificationsView();
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
        await actualizarEstadisticas();
        showDashboard();

    } catch (err) {
        console.error("Critical Error during admin initialization:", err);
    }

    async function updateHubsVisibility() {
        if (esAdmin) return; // Admin ve todo

        // Obtener permisos del actor
        const { data: perms } = await supabase
            .from('permisos_actores')
            .select('parent_hub')
            .eq('user_id', session.user.id);
        
        const permittedHubs = perms ? perms.map(p => p.parent_hub) : [];
        
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

        // Ocultar la categoría completa si no hay hubs permitidos
        const hubCategory = document.getElementById('menu-category-hubs');
        if (hubCategory) {
            hubCategory.style.display = permittedHubs.length > 0 ? 'block' : 'none';
        }
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
            if (profile.avatar_url) {
                sidebarAvatar.style.backgroundImage = `url(${profile.avatar_url})`;
                sidebarAvatar.textContent = '';
            } else {
                const inicial = (profile.nombre_completo || 'U').charAt(0).toUpperCase();
                sidebarAvatar.textContent = inicial;
                sidebarAvatar.style.background = esAdmin ? '#ef4444' : 'var(--admin-accent)';
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
        if (perfilView) perfilView.classList.remove('hidden');
    }

    function showNotificationsView() {
        resetViews();
        h1Header.textContent = 'Centro de Mensajes';
        pHeader.textContent = 'Envía avisos importantes y notificaciones a tu comunidad.';
        const view = document.getElementById('notificaciones-view');
        if (view) {
            view.classList.remove('hidden');
            cargarHistorialNotificaciones();
        }
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

            container.innerHTML = notifs.map(n => `
                <div class="notif-item fade-in">
                    <div class="notif-item-info">
                        <h4>${sanitize(n.titulo)}</h4>
                        <p>${sanitize(n.mensaje.substring(0, 60))}${n.mensaje.length > 60 ? '...' : ''}</p>
                        <div style="display: flex; gap: 10px; margin-top: 6px; font-size: 0.7rem; color: var(--admin-text-muted);">
                            <span><i class="fa-solid fa-users" style="font-size: 0.65rem;"></i> ${n.destinatarios.toUpperCase()}</span>
                            <span><i class="fa-regular fa-clock" style="font-size: 0.65rem;"></i> ${formatearFechaRelativa(n.created_at)}</span>
                            ${n.enlace_url ? `<a href="${n.enlace_url}" target="_blank" style="color:var(--admin-accent);"><i class="fa-solid fa-link" style="font-size: 0.65rem;"></i> Link</a>` : ''}
                            ${n.archivo_url ? `<a href="${n.archivo_url}" target="_blank" style="color:#22c55e;"><i class="fa-solid fa-file-pdf" style="font-size: 0.65rem;"></i> Doc</a>` : ''}
                        </div>
                    </div>
                    <div class="notif-status">
                        <span style="background: rgba(34, 197, 94, 0.1); color: #22c55e; padding: 4px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 600;">ENVIADO</span>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.error('Error al cargar historial:', err);
            container.innerHTML = '<p class="empty-state" style="color:#ff6b6b;">Error al cargar historial</p>';
        }
    }

    document.getElementById('form-notif-send').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-send-notif');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const titulo = document.getElementById('n-titulo').value;
            const mensaje = document.getElementById('n-mensaje').value;
            const destinatarios = document.getElementById('n-destinatarios').value;
            const enlace = document.getElementById('n-link').value;
            const archivo = document.getElementById('n-archivo-url').value;

            const { data: notif, error: nError } = await supabase.from('notificaciones').insert({
                remitente_id: user.id,
                titulo,
                mensaje,
                destinatarios: destinatarios,
                enlace_url: enlace || null,
                archivo_url: archivo || null
            }).select().single();

            if (nError) throw nError;

            let userIds = [];
            if (destinatarios === 'todos') {
                const { data } = await supabase.from('perfiles').select('id');
                userIds = data.map(u => u.id);
            } else if (destinatarios === 'actores') {
                const { data } = await supabase.from('perfiles').select('id').eq('rol', 'actor');
                userIds = data.map(u => u.id);
            } else if (destinatarios === 'seguidores') {
                const { data } = await supabase.from('seguimientos_actores').select('user_id').eq('actor_id', user.id);
                userIds = data.map(u => u.user_id);
            }

            if (userIds.length > 0) {
                const delivery = userIds.map(uid => ({
                    notificacion_id: notif.id,
                    usuario_id: uid
                }));
                const { error: dError } = await supabase.from('notificaciones_usuarios').insert(delivery);
                if (dError) throw dError;
            }

            showToast(`✅ Notificación enviada a ${userIds.length} usuarios`);
            e.target.reset();
            
            // Reset visual del adjunto
            document.getElementById('txt-file-name').textContent = 'Seleccionar archivo...';
            document.getElementById('n-archivo-url').value = '';
            const btnClear = document.getElementById('btn-clear-notif-file');
            if (btnClear) btnClear.classList.add('hidden');

            cargarHistorialNotificaciones();

        } catch (err) {
            console.error('Error al enviar notificacion:', err);
            showToast('❌ Error al enviar mensaje', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
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
        if (view !== 'usuarios' && view !== 'voluntarios' && view !== 'seguidores') {
            btnNuevo.style.display = 'flex';
        }
        currentAdminFilter = view;
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
                    let q = supabase.from(t).select('*').order('created_at', { ascending: false });
                    if (esActor) q = q.eq('owner_id', session.user.id);
                    const { data } = await q;
                    if (data) allItems = [...allItems, ...data.map(x => ({...x, tipo_orig: t === 'eventos' ? 'evento' : 'lugar'}))];
                }
            } else if (filter === 'usuarios' || filter === 'voluntarios') {
                let q = supabase.from('perfiles').select('*');
                if (filter === 'voluntarios') q = q.eq('rol', 'user');
                else q = q.in('rol', ['admin', 'actor']);
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

            tr.innerHTML = `
                <td><strong>${sanitize(item.nombre || item.titulo)}</strong></td>
                <td><span class="badge-tipo ${typeClass}">${typeClass.toUpperCase()}</span></td>
                <td><span class="badge active">ACTIVO</span></td>
                <td>
                    <div style="display:flex; gap:8px; align-items: center;">
                        ${puedeEditar ? `
                            <button onclick="window.editarRegistro('${item.id}', '${item.tipo_orig}')" class="btn-admin-action edit" title="Editar"><i data-lucide="pencil"></i></button>
                            <button onclick="window.eliminarRegistro('${item.id}', '${item.tipo_orig}', '${sanitize(item.nombre || item.titulo)}')" class="btn-admin-action delete" title="Eliminar"><i data-lucide="trash-2"></i></button>
                        ` : (esSeguidor ? '' : `
                            <span style="font-size: 0.7rem; color: #94a3b8; font-style: italic;">Solo lectura</span>
                        `)}

                        ${esSeguidor ? `
                            <button onclick="window.abrirModalMensaje('${item.id}', '${sanitize(item.nombre)}')" class="btn-admin-action message" title="Enviar Mensaje Directo"><i data-lucide="message-square"></i></button>
                        ` : ''}
                        
                        ${esAdmin && item.rol === 'actor' ? `
                            <button onclick="window.gestionarPermisos('${item.id}')" class="btn-admin-action permissions" title="Gestionar Permisos"><i data-lucide="key"></i></button>
                        ` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    }

    // Modal Handling (Events/Places)
    btnNuevo.onclick = () => {
        if (currentAdminFilter === 'eventos') {
            document.getElementById('modal-nuevo-evento').classList.remove('hidden');
            cargarSedesEvento();
        } else if (currentAdminFilter === 'lugares') {
            document.getElementById('modal-nuevo-lugar').classList.remove('hidden');
        }
    };

    async function cargarSedesEvento() {
        const select = document.getElementById('ev-sede');
        const { data } = await supabase.from('lugares').select('id, nombre').order('nombre');
        if (data) select.innerHTML = '<option value="">Selecciona...</option>' + data.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
    }

    // Restore missing coordinate extraction
    document.getElementById('ev-btn-extract-coords').onclick = () => {
        const match = document.getElementById('ev-gmaps').value.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) {
            document.getElementById('ev-lat').value = match[1];
            document.getElementById('ev-lng').value = match[2];
            showToast('Coordenadas extraídas');
        }
    };

    document.getElementById('pl-btn-extract-coords').onclick = () => {
        const match = document.getElementById('pl-gmaps').value.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) {
            document.getElementById('pl-lat').value = match[1];
            document.getElementById('pl-lng').value = match[2];
            showToast('Coordenadas extraídas');
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
            document.getElementById('ev-lat').value = data.latitud || '';
            document.getElementById('ev-lng').value = data.longitud || '';
            document.getElementById('ev-imagen-url').value = data.imagen_url || data.imagen || ''; // Compatibilidad con schema anterior/nuevo
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

            document.getElementById('profile-modal').classList.remove('hidden');
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
            const file = e.target.files[0];
            if (!file) return;
            btnUploadEv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
            btnUploadEv.disabled = true;
            try {
                const blob = await compressImage(file);
                const fileName = `evento_${Date.now()}.webp`;
                const filePath = `${session.user.id}/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('imagenes-plataforma').upload(filePath, blob, { upsert: true });
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('imagenes-plataforma').getPublicUrl(filePath);
                document.getElementById('ev-imagen-url').value = data.publicUrl;
                showToast('✅ Imagen lista');
            } catch (err) {
                console.error(err);
                showToast('❌ Error al subir imagen', 'error');
            } finally {
                btnUploadEv.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Seleccionar otra';
                btnUploadEv.disabled = false;
            }
        };
    }

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
                const payload = {
                    nombre: document.getElementById('ev-nombre').value,
                    categoria: document.getElementById('ev-categoria').value,
                    sede_id: document.getElementById('ev-sede').value || null,
                    fecha_inicio: document.getElementById('ev-fecha-inicio').value,
                    fecha_fin: document.getElementById('ev-fecha-fin').value,
                    ubicacion: document.getElementById('ev-ubicacion').value,
                    gmaps_link: document.getElementById('ev-gmaps').value,
                    latitud: document.getElementById('ev-lat').value,
                    longitud: document.getElementById('ev-lng').value,
                    imagen_url: document.getElementById('ev-imagen-url').value, // Alineado con REORGANIZACION_DB_FINAL
                    descripcion: document.getElementById('ev-descripcion').value,
                    sumate_link: document.getElementById('ev-reg-link').value,
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
                    gmaps_link: document.getElementById('pl-gmaps').value,
                    latitud: document.getElementById('pl-lat').value,
                    longitud: document.getElementById('pl-lng').value,
                    imagen_url: document.getElementById('pl-imagen-url').value, // Alineado con REORGANIZACION_DB_FINAL
                    descripcion: document.getElementById('pl-descripcion').value,
                    sumate_link: document.getElementById('pl-reg-link').value,
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

    // --- Guardar PERFIL (Admin Edit) ---
    const formProfileEdit = document.getElementById('form-profile-edit');
    if (formProfileEdit) {
        formProfileEdit.onsubmit = async (e) => {
            e.preventDefault();
            const btn = formProfileEdit.querySelector('button[type="submit"]');
            const origHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            btn.disabled = true;

            try {
                const editId = formProfileEdit.dataset.editId;
                const payload = {
                    nombre_completo: document.getElementById('prof-nombre').value,
                    rol: document.getElementById('prof-rol').value,
                    telefono: document.getElementById('prof-telefono').value,
                    updated_at: new Date()
                };

                const { error } = await supabase.from('perfiles').update(payload).eq('id', editId);
                if (error) throw error;

                showToast('✅ Perfil actualizado correctamente');
                document.getElementById('profile-modal').classList.add('hidden');
                formProfileEdit.reset();
                delete formProfileEdit.dataset.editId;
                cargarDatos(currentAdminFilter);
            } catch (err) {
                console.error(err);
                showToast('❌ Error al actualizar perfil', 'error');
            } finally {
                btn.innerHTML = origHTML;
                btn.disabled = false;
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

    document.getElementById('form-perfil-full').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-perfil');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';

        try {
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

            // Solo actualizar Datos de Perfil (Public)
            const { error: profileError } = await supabase.from('perfiles').update(updates).eq('id', session.user.id);
            if (profileError) throw profileError;

            showToast('✅ Datos públicos actualizados');
            perfil = { ...perfil, ...updates };
            updateHeaderInfo(perfil);
            
        } catch (err) {
            console.error(err);
            showToast('❌ Error al actualizar perfil', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    };

    // Finalize: Permission management (Simplified for prod)
    window.gestionarPermisos = (userId) => {
        document.getElementById('permissions-modal').classList.remove('hidden');
        // Logic for checkboxes would go here (similar to V2)
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

})();
