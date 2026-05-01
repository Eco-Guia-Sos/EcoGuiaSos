/* assets/js/pages/admin.js */
import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver, sanitize, showToast, formatearFechaRelativa, uploadToSupabase } from '../ui-utils.js';

// Scripts with type="module" are automatically deferred, no need for DOMContentLoaded wrapper.
(async () => {
    console.log('[Admin] 🚀 Iniciando panel...');
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

    // Navigation Logic (Attached immediately)
    const menuLinks = document.querySelectorAll('.admin-menu a[data-view]');
    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            menuLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

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
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        session = currentSession;

        if (!session) {
            window.location.href = './auth.html';
            return;
        }

        const { data: profile, error: perfilError } = await supabase
            .from('perfiles')
            .select('nombre_completo, rol, avatar_url')
            .eq('id', session.user.id)
            .single();

        if (perfilError || !profile || !['admin', 'actor'].includes(profile.rol)) {
            console.warn('[Security] Acceso denegado o perfil no encontrado');
            window.location.href = './index.html';
            return;
        }

        perfil = profile;
        esAdmin = perfil.rol === 'admin';
        esActor = perfil.rol === 'actor';

        // Actualizar Tarjeta de Perfil en Sidebar y Header
        updateHeaderInfo(perfil);

        // Show admin-only elements
        if (esAdmin) {
            document.querySelectorAll('.only-admin').forEach(el => el.style.display = 'flex');
        } else {
            // Ajustar etiquetas para Actor
            const lblEvents = document.getElementById('menu-label-eventos');
            const lblPlaces = document.getElementById('menu-label-lugares');
            const lblFollowers = document.getElementById('menu-label-seguidores');
            
            if (lblEvents) lblEvents.textContent = 'Mis Eventos';
            if (lblPlaces) lblPlaces.textContent = 'Mis Lugares';
            if (lblFollowers) lblFollowers.textContent = 'Mis Seguidores';

            // Filtrar visibilidad de Hubs por permiso
            await updateHubsVisibility();
        }

        // Cargar datos en el formulario de perfil (siempre disponible en memoria)
        cargarDatosPerfil(perfil);

        // 2. Initialize Dashboard
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

    /**
     * Utility to compress images client-side before upload
     * @param {File} file 
     * @returns {Promise<Blob>}
     */
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
                    }, 'image/webp', 0.7); // Highly optimized WebP
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
            // Recargar datos por si acaso
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
            cargarHistorialNotificaciones();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    async function cargarHistorialNotificaciones() {
        const container = document.getElementById('notif-list-container');
        if (!container) return;
        container.innerHTML = '<p class="empty-state">Buscando envíos...</p>';

        try {
            const { data: { user } } = await supabase.auth.getUser();
            let query = supabase.from('notificaciones').select('*').order('created_at', { ascending: false });

            // Si es actor, solo ve las suyas. Si es admin, ve todas (o podemos filtrar).
            if (esActor) {
                query = query.eq('remitente_id', user.id);
            }

            const { data: notifs, error } = await query.limit(20);
            if (error) throw error;

            if (!notifs || notifs.length === 0) {
                container.innerHTML = '<p class="empty-state">No has enviado notificaciones aún.</p>';
                return;
            }

            container.innerHTML = notifs.map(n => `
                <div class="notif-card-mini">
                    <h4>${sanitize(n.titulo)}</h4>
                    <p>${sanitize(n.mensaje)}</p>
                    <div class="notif-meta">
                        <span><i class="fa-solid fa-users"></i> ${n.tipo_destinatario}</span>
                        <span>${formatearFechaRelativa(n.created_at)}</span>
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

            // 1. Insertar en tabla principal
            const { data: notif, error: nError } = await supabase.from('notificaciones').insert({
                remitente_id: user.id,
                titulo,
                mensaje,
                tipo_destinatario: destinatarios
            }).select().single();

            if (nError) throw nError;

            // 2. Identificar usuarios destino (Lógica de segmentación)
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

            // 3. Insertar en tabla de entrega (notificaciones_usuarios)
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
            
            // Cargar Config desde DB
            try {
                const { data: cfg, error } = await supabase.from('config_plataforma').select('*').eq('id', 1).single();
                if (error) throw error;

                if (cfg) {
                    document.getElementById('cfg-registro').checked = cfg.registro_abierto;
                    document.getElementById('cfg-mantenimiento').checked = cfg.modo_mantenimiento;
                    document.getElementById('cfg-bienvenida').value = cfg.mensaje_bienvenida || '';
                    document.getElementById('cfg-banner').value = cfg.banner_activo || '';
                }
            } catch (err) {
                console.error('Error al cargar config global:', err);
            }
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
            console.error('Error al guardar config global:', err);
            showToast('❌ Error al guardar ajustes', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    };

    function showDashboard() {
        const displayName = perfil.nombre_completo ? perfil.nombre_completo.split(' ')[0] : (esAdmin ? 'Administrador' : 'Actor');
        h1Header.textContent = `¡Hola, ${displayName}!`;
        pHeader.textContent = esAdmin ? 'Resumen global de EcoGuía SOS.' : 'Tu espacio de gestión y registros.';
        statsGrid.classList.remove('hidden');
        
        // Renderizar Acciones Rápidas
        renderQuickActions();
        
        tableContainer.classList.remove('hidden');
        tableTitle.textContent = 'Últimos Registros Globales';
        currentAdminFilter = 'all';
        cargarDatos('all');
    }

    function showHistoryView() {
        h1Header.textContent = 'Historial de Actividad';
        pHeader.textContent = 'Registro de acciones recientes en la plataforma.';
        
        // Ocultar acciones rápidas
        const qaContainer = document.getElementById('quick-actions-container');
        if (qaContainer) qaContainer.innerHTML = '';
        
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
        h1Header.textContent = title;
        pHeader.textContent = `Listado de ${title.toLowerCase()} registrados.`;
        
        // Ocultar acciones rápidas al entrar a sección
        const qaContainer = document.getElementById('quick-actions-container');
        if (qaContainer) qaContainer.innerHTML = '';

        tableContainer.classList.remove('hidden');
        tableTitle.textContent = `Registros: ${title}`;
        
        if (view !== 'usuarios' && view !== 'voluntarios' && view !== 'seguidores') {
            btnNuevo.style.display = 'flex';
        }
        
        currentAdminFilter = view;
        cargarDatos(view);
    }

    function renderQuickActions() {
        const container = document.getElementById('quick-actions-container');
        if (!container) return;
        container.innerHTML = '';

        const actions = esAdmin ? [
            { id: 'new-actor', label: 'Nuevo Actor', icon: 'user-plus', view: 'usuarios' },
            { id: 'new-event', label: 'Nuevo Evento', icon: 'calendar-plus', view: 'eventos' },
            { id: 'new-place', label: 'Nuevo Lugar', icon: 'map-pin', view: 'lugares' }
        ] : [
            { id: 'new-event', label: 'Nuevo Evento', icon: 'calendar-plus', view: 'eventos' },
            { id: 'new-place', label: 'Nuevo Lugar', icon: 'map-pin', view: 'lugares' },
            { id: 'view-profile', label: 'Ver mi Perfil', icon: 'user', action: 'profile' }
        ];

        actions.forEach(act => {
            const btn = document.createElement('a');
            btn.href = '#';
            btn.className = 'btn-quick-action';
            btn.innerHTML = `<i data-lucide="${act.icon}"></i> <span>${act.label}</span>`;
            btn.onclick = (e) => {
                e.preventDefault();
                if (act.view) {
                    const link = document.querySelector(`.admin-menu a[data-view="${act.view}"]`);
                    if (link) link.click();
                    // Simular click en "Nuevo" después de que cargue la vista
                    setTimeout(() => {
                        const btnN = document.getElementById('btn-nuevo');
                        if (btnN) btnN.click();
                    }, 500);
                } else if (act.action === 'profile') {
                    // Abrir modal de perfil (ya implementado en admin.js)
                    const modal = document.getElementById('profile-modal');
                    if (modal) {
                        // Aquí deberíamos llamar a la función que llena el perfil, 
                        // pero por ahora solo abrimos el modal
                        modal.classList.remove('hidden');
                    }
                }
            };
            container.appendChild(btn);
        });
        lucide.createIcons();
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
                { id: 'firmas', label: 'Firmas/Peticiones', icon: 'pen-tool' }
            ],
            ajolote: [
                { id: 'convocatoria', label: 'Convocatorias', icon: 'megaphone' },
                { id: 'voluntariados', label: 'Voluntariados', icon: 'hand-helping' },
                { id: 'agentes', label: 'Agentes de Cambio', icon: 'users-2' },
                { id: 'eventos', label: 'Eventos de Comunidad', icon: 'calendar-days' }
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
                pHeader.textContent = `Área específica de ${sec.label} en Hub ${hub}.`;
                btnNuevo.style.display = 'flex';
                currentAdminFilter = `seccion_${sec.id}_${hub}`;
                cargarDatos(currentAdminFilter);
            };
            hubMenuGrid.appendChild(card);
        });
        lucide.createIcons();
    }

    async function cargarDatos(filter = 'all') {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Cargando datos...</td></tr>';
        
        try {
            let allItems = [];
            
            if (filter === 'all') {
                let qEvents = supabase.from('eventos').select('*').order('created_at', { ascending: false });
                let qPlaces = supabase.from('lugares').select('*').order('created_at', { ascending: false });
                
                if (esActor) {
                    qEvents = qEvents.eq('owner_id', session.user.id);
                    qPlaces = qPlaces.eq('owner_id', session.user.id);
                }

                const [eventsRes, placesRes] = await Promise.all([qEvents, qPlaces]);

                if (eventsRes.data) {
                    const mappedEvents = eventsRes.data.map(x => ({...x, nombre: x.nombre, categoria: x.categoria, tipo_orig: 'evento'}));
                    allItems = [...allItems, ...mappedEvents];
                }
                if (placesRes.data) {
                    const mappedPlaces = placesRes.data.map(x => ({...x, nombre: x.nombre, categoria: x.categoria, tipo_orig: 'lugar'}));
                    allItems = [...allItems, ...mappedPlaces];
                }

                // Actualizar Stats compartidas
                document.getElementById('stat-eventos').textContent = allItems.filter(x => x.tipo_orig === 'evento').length;
                document.getElementById('stat-lugares').textContent = allItems.filter(x => x.tipo_orig === 'lugar').length;

                // Cargar Stats adicionales (Admin / Actor)
                if (esAdmin) {
                    const { count: actoresCount } = await supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'actor');
                    const { count: userCount } = await supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'user');
                    const { count: followersCount } = await supabase.from('seguimientos_actores').select('*', { count: 'exact', head: true });
                    
                    document.getElementById('stat-actores').textContent = actoresCount || 0;
                    document.getElementById('stat-voluntarios').textContent = userCount || 0;
                    document.getElementById('stat-seguidores').textContent = followersCount || 0;
                } else {
                    const { count: myFollowersCount } = await supabase.from('seguimientos_actores').select('*', { count: 'exact', head: true }).eq('actor_id', session.user.id);
                    document.getElementById('stat-seguidores').textContent = myFollowersCount || 0;
                }
            } 
            else if (filter === 'eventos' || filter === 'lugares') {
                let q = supabase.from(filter).select('*').order('created_at', { ascending: false });
                if (esActor) q = q.eq('owner_id', session.user.id);
                const { data } = await q;
                if (data) allItems = data.map(x => ({...x, nombre: x.nombre, categoria: x.categoria, tipo_orig: filter.slice(0, -1)}));
            }
            else if (filter.startsWith('seccion_')) {
                const parts = filter.split('_');
                const secId = parts[1];
                const hub = parts[2];
                let q = supabase.from('contenido_secciones').select('*').eq('seccion_id', secId).eq('parent_hub', hub);
                if (esActor) q = q.eq('owner_id', session.user.id);
                const { data } = await q;
                if (data) allItems = data.map(x => ({...x, nombre: x.titulo, categoria: x.seccion_id, tipo_orig: 'contenido_secciones'}));
            }
            else if (filter === 'usuarios' && esAdmin) {
                const { data } = await supabase.from('perfiles').select('*').in('rol', ['admin', 'actor']).order('created_at', { ascending: false });
                if (data) allItems = data.map(x => ({...x, nombre: x.nombre_completo, categoria: x.rol, tipo_orig: 'perfiles'}));
            }
            else if (filter === 'voluntarios' && esAdmin) {
                const { data } = await supabase.from('perfiles').select('*').eq('rol', 'user').order('created_at', { ascending: false });
                if (data) allItems = data.map(x => ({...x, nombre: x.nombre_completo, categoria: 'Voluntario', tipo_orig: 'perfiles'}));
            }
            else if (filter === 'historial' && esAdmin) {
                // Combinar últimos registros de eventos, lugares y contenidos
                const [evRes, plRes, coRes] = await Promise.all([
                    supabase.from('eventos').select('id, nombre, created_at').order('created_at', { ascending: false }).limit(10),
                    supabase.from('lugares').select('id, nombre, created_at').order('created_at', { ascending: false }).limit(10),
                    supabase.from('contenido_secciones').select('id, titulo, created_at').order('created_at', { ascending: false }).limit(10)
                ]);

                if (evRes.data) allItems = [...allItems, ...evRes.data.map(x => ({...x, nombre: `Evento creado: ${x.nombre}`, categoria: 'Evento', tipo_orig: 'historial'}))];
                if (plRes.data) allItems = [...allItems, ...plRes.data.map(x => ({...x, nombre: `Lugar creado: ${x.nombre}`, categoria: 'Lugar', tipo_orig: 'historial'}))];
                if (coRes.data) allItems = [...allItems, ...coRes.data.map(x => ({...x, nombre: `Contenido creado: ${x.titulo}`, categoria: 'Contenido', tipo_orig: 'historial'}))];
                
                allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
            else if (filter === 'seguidores') {
                // Para el Admin muestra TODOS los seguidores en la plataforma
                // Para el Actor muestra SOLO los que lo siguen a ÉL
                let query = supabase
                    .from('seguimientos_actores')
                    .select('user_id, perfiles:user_id(nombre_completo)');
                
                if (esActor) {
                    query = query.eq('actor_id', session.user.id);
                }

                const { data, error } = await query;
                if (!error && data) {
                    allItems = data.map(row => ({
                        id: row.user_id,
                        nombre: row.perfiles?.nombre_completo || 'Usuario',
                        categoria: 'Seguidor',
                        tipo_orig: 'perfiles'
                    }));
                }
            }

            renderTablaRows(allItems);
        } catch (err) {
            console.error('Error cargarDatos:', err);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--color-danger);">Error al cargar datos.</td></tr>';
        }
    }

    function renderTablaRows(items) {
        tbody.innerHTML = '';
        if (!items || items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #666;">No se encontraron registros.</td></tr>';
            return;
        }

        items.forEach(item => {
            const tr = document.createElement('tr');
            const esSeguidor = item.tipo_orig === 'perfiles' && item.categoria === 'Seguidor';
            
            // Lógica de Badge de Tipo
            let tipoLabel = item.tipo_orig || 'Registro';
            let tipoClass = 'evento';
            if (tipoLabel.includes('lugar')) { tipoLabel = 'Lugar'; tipoClass = 'lugar'; }
            else if (tipoLabel.includes('evento')) { tipoLabel = 'Evento'; tipoClass = 'evento'; }
            else if (tipoLabel.includes('contenido')) { tipoLabel = 'Contenido'; tipoClass = 'contenido'; }
            
            const statusLabel = item.estado || 'activo';
            const badgeColor = statusLabel === 'publicado' ? '#72B04D' : (statusLabel === 'pendiente' ? '#f39c12' : '#64748b');
            
            // Fecha relativa simple
            const fechaObj = new Date(item.created_at);
            const haceDias = Math.floor((new Date() - fechaObj) / (1000 * 60 * 60 * 24));
            const fechaStr = haceDias === 0 ? 'Hoy' : (haceDias === 1 ? 'Ayer' : `Hace ${haceDias} días`);

            tr.innerHTML = `
                <td>
                    <div style="display: flex; flex-direction: column;">
                        <strong>${sanitize(item.nombre)}</strong>
                        <span style="font-size: 0.75rem; color: #64748b;">${fechaStr}</span>
                    </div>
                </td>
                <td><span class="badge-tipo ${tipoClass}">${tipoLabel}</span></td>
                <td><span class="badge" style="background: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}44;">${statusLabel}</span></td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        ${esSeguidor ? `
                            <button onclick="window.abrirModalMensaje('${item.id}', '${sanitize(item.nombre)}')" class="btn-admin-action message" title="Enviar Mensaje Directo"><i data-lucide="message-square"></i></button>
                        ` : `
                            ${item.tipo_orig === 'perfiles' ? `
                                <button onclick="window.editarPerfil('${item.id}')" class="btn-admin-action edit" title="Editar Info"><i data-lucide="user-cog"></i></button>
                                ${item.rol === 'actor' ? `<button onclick="window.gestionarPermisos('${item.id}')" class="btn-admin-action permissions" title="Permisos"><i data-lucide="key"></i></button>` : ''}
                                <button onclick="window.eliminarRegistro('${item.id}', 'perfiles', '${sanitize(item.nombre)}')" class="btn-admin-action delete" title="Eliminar"><i data-lucide="trash-2"></i></button>
                            ` : `
                                <button onclick="window.editarRegistro('${item.id}', '${item.tipo_orig}')" class="btn-admin-action edit" title="Editar"><i data-lucide="pencil"></i></button>
                                <button onclick="window.eliminarRegistro('${item.id}', '${item.tipo_orig}', '${sanitize(item.nombre)}')" class="btn-admin-action delete" title="Eliminar"><i data-lucide="trash-2"></i></button>
                            `}
                        `}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    }

    // ========== LOGICA DE ELIMINACIÓN UNIVERSAL ==========
    window.eliminarRegistro = async (id, tipo, nombre) => {
        if (tipo === 'perfiles' && id === session.user.id) {
            return showToast('No puedes eliminar tu propia cuenta.', 'warning');
        }

        const modalDelete = document.getElementById('modal-confirm-delete');
        const textDelete = document.getElementById('delete-confirm-text');
        const btnConfirm = document.getElementById('btn-confirm-delete');
        const btnCancel = document.getElementById('btn-cancel-delete');

        textDelete.textContent = `¿Estás seguro de que deseas eliminar "${nombre}"?`;
        modalDelete.classList.remove('hidden');
        lucide.createIcons(); // Para el icono de alerta

        return new Promise((resolve) => {
            btnConfirm.onclick = async () => {
                modalDelete.classList.add('hidden');
                
                let tabla = tipo === 'evento' ? 'eventos' : (tipo === 'lugar' ? 'lugares' : tipo);
                if (tipo === 'contenido_secciones') tabla = 'contenido_secciones';

                try {
                    console.log(`[Admin] Intentando eliminar de tabla: ${tabla}, ID: ${id}`);
                    const { error } = await supabase.from(tabla).delete().eq('id', id);
                    
                    if (error) {
                        console.error('[Admin] Error de Supabase:', error);
                        // Mensaje amigable para errores de llaves foráneas
                        if (error.code === '23503') {
                            showToast('❌ No se puede eliminar: Este usuario tiene registros vinculados (seguidores, eventos, etc.)', 'error');
                        } else {
                            showToast(`❌ Error: ${error.message}`, 'error');
                        }
                        resolve(false);
                        return;
                    }

                    showToast('✅ Registro eliminado correctamente', 'success');
                    cargarDatos(currentAdminFilter);
                    resolve(true);
                } catch (err) {
                    console.error('[Admin] Error inesperado:', err);
                    showToast('❌ Ocurrió un error inesperado al intentar eliminar.', 'error');
                    resolve(false);
                }
            };

            btnCancel.onclick = () => {
                modalDelete.classList.add('hidden');
                resolve(false);
            };
        });
    };

    window.editarRegistro = async (id, tipo) => {
        if (tipo === 'eventos' || tipo === 'evento') {
            const { data, error } = await supabase.from('eventos').select('*').eq('id', id).single();
            if (data) {
                const modalEvento = document.getElementById('modal-nuevo-evento');
                const formEvento = document.getElementById('form-nuevo-evento');
                
                // Reset y marcar como edición
                formEvento.reset();
                modalEvento.dataset.editingId = id;
                document.querySelector('#modal-nuevo-evento h2').textContent = 'Editar Evento';
                document.getElementById('btn-submit-evento').textContent = 'Actualizar Evento';
                
                // Cargar datos básicos
                document.getElementById('ev-nombre').value = data.nombre || '';
                document.getElementById('ev-descripcion').value = data.descripcion || '';
                document.getElementById('ev-categoria').value = data.categoria || '';
                document.getElementById('ev-fecha-inicio').value = data.fecha_inicio ? data.fecha_inicio.substring(0, 16) : '';
                document.getElementById('ev-fecha-fin').value = data.fecha_fin ? data.fecha_fin.substring(0, 16) : '';
                document.getElementById('ev-ubicacion').value = data.ubicacion || '';
                document.getElementById('ev-gmaps').value = data.mapa_url || '';
                document.getElementById('ev-lat').value = data.lat || '';
                document.getElementById('ev-lng').value = data.lng || '';
                document.getElementById('ev-reg-link').value = data.reg_link || '';
                
                // Imagen
                if (data.imagen_url) {
                    document.getElementById('ev-imagen-url').value = data.imagen_url;
                    const preview = document.getElementById('ev-image-preview');
                    preview.style.backgroundImage = `url(${data.imagen_url})`;
                    preview.classList.remove('hidden');
                }

                // Cargar sedes antes de abrir
                await cargarSedesEvento();
                document.getElementById('ev-sede').value = data.lugar_id || '';

                // Redes Sociales
                const socialContainer = document.getElementById('ev-social-inputs');
                socialContainer.innerHTML = '';
                document.querySelectorAll('#ev-social-selector .social-btn').forEach(b => b.classList.remove('active'));
                
                const socialNetworks = ['fb', 'ig', 'wa', 'x', 'yt', 'web'];
                socialNetworks.forEach(net => {
                    const val = data[`social_${net}`];
                    if (val) {
                        const btn = document.querySelector(`#ev-social-selector .social-btn[data-net="social_${net}"]`);
                        if (btn) {
                            btn.classList.add('active');
                            const div = document.createElement('div');
                            div.className = 'social-input-group form-group';
                            div.dataset.net = `social_${net}`;
                            const iconClass = btn.querySelector('i').className;
                            div.innerHTML = `
                                <div class="input-wrapper">
                                    <i class="${iconClass}"></i>
                                    <input type="text" value="${val}" data-net="social_${net}" required>
                                </div>
                            `;
                            socialContainer.appendChild(div);
                        }
                    }
                });

                modalEvento.classList.remove('hidden');
            }
        } else if (tipo === 'lugares' || tipo === 'lugar' || tipo === 'lugare') {
            const { data, error } = await supabase.from('lugares').select('*').eq('id', id).single();
            if (data) {
                const modalLugar = document.getElementById('modal-nuevo-lugar');
                const formLugar = document.getElementById('form-nuevo-lugar');
                
                // Reset y marcar como edición
                formLugar.reset();
                modalLugar.dataset.editingId = id;
                document.querySelector('#modal-nuevo-lugar h2').textContent = 'Editar Lugar / Sede';
                document.getElementById('btn-submit-lugar').textContent = 'Actualizar Lugar';
                
                // Cargar datos básicos
                document.getElementById('pl-nombre').value = data.nombre || '';
                document.getElementById('pl-descripcion').value = data.descripcion || '';
                document.getElementById('pl-categoria').value = data.categoria || '';
                document.getElementById('pl-ubicacion').value = data.ubicacion || '';
                document.getElementById('pl-gmaps').value = data.mapa_url || '';
                document.getElementById('pl-lat').value = data.lat || '';
                document.getElementById('pl-lng').value = data.lng || '';
                document.getElementById('pl-reg-link').value = data.reg_link || '';
                
                // Imagen
                if (data.imagen) { // La columna se llama 'imagen' en lugares
                    document.getElementById('pl-imagen-url').value = data.imagen;
                    const preview = document.getElementById('pl-image-preview');
                    preview.style.backgroundImage = `url(${data.imagen})`;
                    preview.classList.remove('hidden');
                }

                // Redes Sociales
                const socialContainer = document.getElementById('pl-social-inputs');
                if (socialContainer) {
                    socialContainer.innerHTML = '';
                    document.querySelectorAll('#pl-social-selector .social-btn').forEach(b => b.classList.remove('active'));
                    
                    const socialNetworks = ['fb', 'ig', 'wa', 'x', 'yt', 'web'];
                    socialNetworks.forEach(net => {
                        const val = data[`social_${net}`];
                        if (val) {
                            const btn = document.querySelector(`#pl-social-selector .social-btn[data-net="social_${net}"]`);
                            if (btn) {
                                btn.classList.add('active');
                                const div = document.createElement('div');
                                div.className = 'social-input-group form-group';
                                div.dataset.net = `social_${net}`;
                                const iconClass = btn.querySelector('i').className;
                                div.innerHTML = `
                                    <div class="input-wrapper">
                                        <i class="${iconClass}"></i>
                                        <input type="text" value="${val}" data-net="social_${net}" required>
                                    </div>
                                `;
                                socialContainer.appendChild(div);
                            }
                        }
                    });
                }

                modalLugar.classList.remove('hidden');
            }
        } else if (tipo === 'contenido_secciones') {
            const { data, error } = await supabase.from('contenido_secciones').select('*').eq('id', id).single();
            if (data) {
                const modalContent = document.getElementById('modal-nuevo');
                const formContent = document.getElementById('form-nuevo');
                
                formContent.reset();
                modalContent.dataset.editingId = id;
                document.getElementById('modal-title-text').textContent = 'Editar Contenido';
                document.getElementById('btn-submit-form').textContent = 'Actualizar Registro';
                
                document.getElementById('input-nombre').value = data.titulo || '';
                document.getElementById('input-descripcion').value = data.descripcion || '';
                document.getElementById('input-enlace').value = data.enlace || '';
                
                if (data.imagen_url) {
                    document.getElementById('input-imagen-url').value = data.imagen_url;
                    const preview = document.getElementById('image-preview');
                    preview.style.backgroundImage = `url(${data.imagen_url})`;
                    preview.classList.remove('hidden');
                }
                
                switchFormType('contenido');
                modalContent.classList.remove('hidden');
            }
        } else {
            showToast('Función de edición en desarrollo para esta sección', 'info');
        }
    };

    // ========== GESTIÓN DE MODAL "NUEVO REGISTRO" (DOS SECCIONES) ==========
    const modalNuevo = document.getElementById('modal-nuevo');
    const formNuevo = document.getElementById('form-nuevo');
    const typeButtons = document.querySelectorAll('.type-btn');
    const sectionEvento = document.getElementById('section-evento-fields');
    const sectionLugar = document.getElementById('section-lugar-fields');
    const sectionContent = document.getElementById('section-content-fields');
    const mapSection = document.getElementById('map-section');

    function switchFormType(type) {
        document.getElementById('input-tipo').value = type;
        
        // Update Buttons
        typeButtons.forEach(btn => {
            if (btn.dataset.type === type) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Toggle Sections
        sectionEvento.style.display = type === 'eventos' ? 'grid' : 'none';
        sectionLugar.style.display = type === 'lugares' ? 'grid' : 'none';
        sectionContent.style.display = type === 'contenido' ? 'grid' : 'none';
        
        // Map visibility (Events and Places need map)
        mapSection.style.display = (type === 'eventos' || type === 'lugares') ? 'block' : 'none';
        
        if ((type === 'eventos' || type === 'lugares') && typeof map !== 'undefined') {
            setTimeout(() => map.resize(), 300);
        }

        // Adjust label name if needed
        document.getElementById('label-nombre').textContent = type === 'contenido' ? 'Título del Contenido' : 'Nombre / Título';
    }

    typeButtons.forEach(btn => {
        btn.onclick = () => switchFormType(btn.dataset.type);
    });

    btnNuevo.onclick = () => {
        if (currentAdminFilter === 'eventos') {
            const modalEvento = document.getElementById('modal-nuevo-evento');
            const formEvento = document.getElementById('form-nuevo-evento');
            formEvento.reset();
            delete modalEvento.dataset.editingId;
            document.querySelector('#modal-nuevo-evento h2').textContent = 'Crear Nuevo Evento';
            document.getElementById('btn-submit-evento').textContent = 'Guardar Evento';

            document.getElementById('ev-image-preview').classList.add('hidden');
            document.getElementById('ev-image-preview').style.backgroundImage = '';
            cargarSedesEvento();
            modalEvento.classList.remove('hidden');
            return;
        }

        if (currentAdminFilter === 'lugares') {
            const modalLugar = document.getElementById('modal-nuevo-lugar');
            const formLugar = document.getElementById('form-nuevo-lugar');
            formLugar.reset();
            delete modalLugar.dataset.editingId;
            document.querySelector('#modal-nuevo-lugar h2').textContent = 'Crear Nuevo Lugar / Sede';
            document.getElementById('btn-submit-lugar').textContent = 'Guardar Lugar';

            document.getElementById('pl-image-preview').classList.add('hidden');
            document.getElementById('pl-image-preview').style.backgroundImage = '';
            modalLugar.classList.remove('hidden');
            return;
        }

        formNuevo.reset();
        delete modalNuevo.dataset.editingId;
        document.getElementById('modal-title-text').textContent = "Nuevo Registro";
        document.getElementById('btn-submit-form').textContent = 'Guardar Registro';
        
        document.getElementById('image-preview').classList.add('hidden');
        document.getElementById('image-preview').style.backgroundImage = '';
        
        // Auto-detect type based on current view
        let defaultType = 'eventos';
        if (currentAdminFilter === 'lugares') defaultType = 'lugares';
        else if (currentAdminFilter.startsWith('seccion_')) defaultType = 'contenido';
        
        // Hide/Show Content button only when needed
        document.getElementById('btn-type-content').style.display = defaultType === 'contenido' ? 'flex' : 'none';
        
        switchFormType(defaultType);
        modalNuevo.classList.remove('hidden');
    };

    // Extraer coordenadas de GMaps
    document.getElementById('btn-extract-coords').onclick = () => {
        const url = document.getElementById('input-gmaps').value;
        if (!url) return showToast('Pega un enlace de Google Maps primero', 'error');
        const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const match = url.match(regex);
        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            document.getElementById('input-lat').value = lat;
            document.getElementById('input-lng').value = lng;
            if (typeof marker !== 'undefined') marker.setLngLat([lng, lat]);
            if (typeof map !== 'undefined') map.flyTo({ center: [lng, lat], zoom: 15 });
            showToast('Coordenadas extraídas correctamente');
        } else {
            showToast('No se pudieron extraer coordenadas.', 'warning');
        }
    };

    // GPS Helper
    document.getElementById('btn-gps-helper').onclick = () => {
        if (!navigator.geolocation) return showToast('Geolocalización no soportada', 'error');
        showToast('Obteniendo ubicación...');
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;
            document.getElementById('input-lat').value = lat;
            document.getElementById('input-lng').value = lng;
            if (typeof marker !== 'undefined') marker.setLngLat([lng, lat]);
            if (typeof map !== 'undefined') map.flyTo({ center: [lng, lat], zoom: 16 });
        }, () => showToast('Error al obtener GPS', 'error'));
    };

    // Cargar Sedes
    async function cargarSedes() {
        const select = document.getElementById('input-sede');
        if (!select) return;
        select.innerHTML = '<option value="">Selecciona un lugar...</option>';
        const { data } = await supabase.from('lugares').select('id, nombre').order('nombre');
        if (data) {
            data.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.textContent = l.nombre;
                select.appendChild(opt);
            });
        }
    }

    // Cargar Sedes para el NUEVO modal de Eventos
    async function cargarSedesEvento() {
        const select = document.getElementById('ev-sede');
        if (!select) return;
        select.innerHTML = '<option value="">Selecciona un lugar...</option>';
        const { data } = await supabase.from('lugares').select('id, nombre').order('nombre');
        if (data) {
            data.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.textContent = l.nombre;
                select.appendChild(opt);
            });
        }
    }

    // Lógica para Extracción de Coordenadas y Mapas del NUEVO modal de Eventos
    document.getElementById('ev-btn-extract-coords').onclick = () => {
        const url = document.getElementById('ev-gmaps').value;
        if (!url) return showToast('Pega un enlace de Google Maps primero', 'error');
        const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const match = url.match(regex);
        if (match) {
            document.getElementById('ev-lat').value = parseFloat(match[1]);
            document.getElementById('ev-lng').value = parseFloat(match[2]);
            showToast('Coordenadas extraídas correctamente');
        } else {
            showToast('No se pudieron extraer coordenadas.', 'warning');
        }
    };

    // Lógica para Extracción de Coordenadas y Mapas del NUEVO modal de Lugares
    document.getElementById('pl-btn-extract-coords').onclick = () => {
        const url = document.getElementById('pl-gmaps').value;
        if (!url) return showToast('Pega un enlace de Google Maps primero', 'error');
        const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const match = url.match(regex);
        if (match) {
            document.getElementById('pl-lat').value = parseFloat(match[1]);
            document.getElementById('pl-lng').value = parseFloat(match[2]);
            showToast('Coordenadas extraídas correctamente');
        } else {
            showToast('No se pudieron extraer coordenadas.', 'warning');
        }
    };

    // Lógica para Redes Sociales del NUEVO modal de Eventos
    const evSocialSelector = document.getElementById('ev-social-selector');
    const evSocialContainer = document.getElementById('ev-social-inputs');
    if (evSocialSelector && evSocialContainer) {
        evSocialSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.social-btn');
            if (!btn) return;
            const network = btn.dataset.net;
            const iconClass = btn.querySelector('i').className;
            
            if (btn.classList.contains('active')) {
                btn.classList.remove('active');
                const row = evSocialContainer.querySelector(`[data-net="${network}"]`);
                if (row) row.remove();
            } else {
                btn.classList.add('active');
                const div = document.createElement('div');
                div.className = 'social-input-group form-group'; // Usar form-group para diseño consistente
                div.dataset.net = network;
                div.innerHTML = `
                    <div class="input-wrapper">
                        <i class="${iconClass}"></i>
                        <input type="text" placeholder="URL o usuario..." data-net="${network}" required>
                    </div>
                `;
                evSocialContainer.appendChild(div);
            }
        });
    }

    function getEvSocial(net) {
        const input = evSocialContainer.querySelector(`input[data-net="${net}"]`);
        return input ? input.value : null;
    }

    // Lógica para Redes Sociales del NUEVO modal de Lugares
    const plSocialSelector = document.getElementById('pl-social-selector');
    const plSocialContainer = document.getElementById('pl-social-inputs');
    if (plSocialSelector && plSocialContainer) {
        plSocialSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.social-btn');
            if (!btn) return;
            const network = btn.dataset.net;
            const iconClass = btn.querySelector('i').className;
            
            if (btn.classList.contains('active')) {
                btn.classList.remove('active');
                const row = plSocialContainer.querySelector(`[data-net="${network}"]`);
                if (row) row.remove();
            } else {
                btn.classList.add('active');
                const div = document.createElement('div');
                div.className = 'social-input-group form-group';
                div.dataset.net = network;
                div.innerHTML = `
                    <div class="input-wrapper">
                        <i class="${iconClass}"></i>
                        <input type="text" placeholder="URL o usuario..." data-net="${network}" required>
                    </div>
                `;
                plSocialContainer.appendChild(div);
            }
        });
    }

    function getPlSocial(net) {
        if (!plSocialContainer) return null;
        const input = plSocialContainer.querySelector(`input[data-net="${net}"]`);
        return input ? input.value : null;
    }

    // Imagen Handling VIEJO MODAL

    const btnTrigger = document.getElementById('btn-trigger-upload');
    const fileInput = document.getElementById('input-imagen-file');
    const urlInput = document.getElementById('input-imagen-url');
    const preview = document.getElementById('image-preview');

    if (btnTrigger) {
        btnTrigger.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    preview.style.backgroundImage = `url(${re.target.result})`;
                    preview.classList.remove('hidden');
                    btnTrigger.innerHTML = `<i class="fa-solid fa-check"></i> ${file.name}`;
                };
                reader.readAsDataURL(file);
            }
        };

        urlInput.oninput = () => {
            if (urlInput.value) {
                preview.style.backgroundImage = `url(${urlInput.value})`;
                preview.classList.remove('hidden');
            } else {
                preview.classList.add('hidden');
            }
        };
    }

    // Imagen Handling NUEVO MODAL EVENTO
    const evBtnTrigger = document.getElementById('ev-btn-trigger-upload');
    const evFileInput = document.getElementById('ev-imagen-file');
    const evUrlInput = document.getElementById('ev-imagen-url');
    const evPreview = document.getElementById('ev-image-preview');

    if (evBtnTrigger) {
        evBtnTrigger.onclick = () => evFileInput.click();
        evFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    evPreview.style.backgroundImage = `url(${re.target.result})`;
                    evPreview.classList.remove('hidden');
                    evBtnTrigger.innerHTML = `<i class="fa-solid fa-check"></i> ${file.name}`;
                };
                reader.readAsDataURL(file);
            }
        };

        evUrlInput.oninput = () => {
            if (evUrlInput.value) {
                evPreview.style.backgroundImage = `url(${evUrlInput.value})`;
                evPreview.classList.remove('hidden');
            } else {
                evPreview.classList.add('hidden');
            }
        };

        // Lógica para quitar imagen
        const evBtnRemoveImg = document.getElementById('ev-btn-remove-img');
        if (evBtnRemoveImg) {
            evBtnRemoveImg.onclick = (e) => {
                e.stopPropagation();
                evFileInput.value = '';
                evUrlInput.value = '';
                evPreview.classList.add('hidden');
                evPreview.style.backgroundImage = 'none';
                evBtnTrigger.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Seleccionar Imagen`;
            };
        }
    }

    // Imagen Handling NUEVO MODAL LUGARES
    const plBtnTrigger = document.getElementById('pl-btn-trigger-upload');
    const plFileInput = document.getElementById('pl-imagen-file');
    const plUrlInput = document.getElementById('pl-imagen-url');
    const plPreview = document.getElementById('pl-image-preview');

    if (plBtnTrigger) {
        plBtnTrigger.onclick = () => plFileInput.click();
        plFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    plPreview.style.backgroundImage = `url(${re.target.result})`;
                    plPreview.classList.remove('hidden');
                    plBtnTrigger.innerHTML = `<i class="fa-solid fa-check"></i> ${file.name}`;
                };
                reader.readAsDataURL(file);
            }
        };

        plUrlInput.oninput = () => {
            if (plUrlInput.value) {
                plPreview.style.backgroundImage = `url(${plUrlInput.value})`;
                plPreview.classList.remove('hidden');
            } else {
                plPreview.classList.add('hidden');
            }
        };

        // Lógica para quitar imagen
        const plBtnRemoveImg = document.getElementById('pl-btn-remove-img');
        if (plBtnRemoveImg) {
            plBtnRemoveImg.onclick = (e) => {
                e.stopPropagation();
                plFileInput.value = '';
                plUrlInput.value = '';
                plPreview.classList.add('hidden');
                plPreview.style.backgroundImage = 'none';
                plBtnTrigger.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Seleccionar Imagen`;
            };
        }
    }

    // Cierre de modales
    document.getElementById('btn-close-modal').onclick = () => modalNuevo.classList.add('hidden');
    document.getElementById('btn-cancelar').onclick = () => modalNuevo.classList.add('hidden');
    document.getElementById('btn-close-evento').onclick = () => document.getElementById('modal-nuevo-evento').classList.add('hidden');
    document.getElementById('btn-cancelar-evento').onclick = () => document.getElementById('modal-nuevo-evento').classList.add('hidden');
    document.getElementById('btn-close-lugar').onclick = () => document.getElementById('modal-nuevo-lugar').classList.add('hidden');
    document.getElementById('btn-cancelar-lugar').onclick = () => document.getElementById('modal-nuevo-lugar').classList.add('hidden');



    formNuevo.onsubmit = async (e) => {
        e.preventDefault();
        const editingId = modalNuevo.dataset.editingId;
        const btn = document.getElementById('btn-submit-form');
        const tipo = document.getElementById('input-tipo').value;
        
        btn.disabled = true;
        btn.textContent = editingId ? 'Actualizando...' : 'Guardando...';

        try {
            let imageUrl = urlInput.value;

            if (fileInput.files[0]) {
                const file = fileInput.files[0];
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `uploads/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('eco-media').upload(filePath, file);
                if (uploadError) throw uploadError;
                const { data: publicUrl } = supabase.storage.from('eco-media').getPublicUrl(filePath);
                imageUrl = publicUrl.publicUrl;
            }

            const dataToSave = {
                owner_id: session.user.id
            };
            if (tipo === 'contenido') {
                const parts = currentAdminFilter.split('_');
                Object.assign(dataToSave, {
                    titulo: document.getElementById('input-nombre').value,
                    descripcion: document.getElementById('input-descripcion').value,
                    imagen_url: imageUrl,
                    enlace: document.getElementById('input-enlace').value,
                    seccion_id: parts[1],
                    parent_hub: parts[2],
                    estado: 'publicado'
                });

                if (editingId) {
                    const { error } = await supabase.from('contenido_secciones').update(dataToSave).eq('id', editingId);
                    if (error) throw error;
                    showToast('✅ Contenido actualizado correctamente');
                } else {
                    const { error } = await supabase.from('contenido_secciones').insert([dataToSave]);
                    if (error) throw error;
                    showToast('✅ Contenido guardado correctamente');
                }
            } 
            else if (tipo === 'eventos' || tipo === 'lugares') {
                // Estos suelen usar sus propios modales ahora, pero mantenemos compatibilidad por si acaso
                const tabla = tipo === 'eventos' ? 'eventos' : 'lugares';
                const commonData = {
                    nombre: document.getElementById('input-nombre').value,
                    descripcion: document.getElementById('input-descripcion').value,
                    imagen_url: imageUrl,
                    estado: 'publicado',
                    categoria: tipo === 'eventos' ? document.getElementById('input-categoria-evento').value : document.getElementById('input-categoria-lugar').value,
                    lat: document.getElementById('input-lat').value || null,
                    lng: document.getElementById('input-lng').value || null
                };

                if (editingId) {
                    const { error } = await supabase.from(tabla).update(commonData).eq('id', editingId);
                    if (error) throw error;
                    showToast('✅ Registro actualizado correctamente');
                } else {
                    commonData.owner_id = session.user.id;
                    const { error } = await supabase.from(tabla).insert([commonData]);
                    if (error) throw error;
                    showToast('✅ Registro guardado correctamente');
                }
            }

            modalNuevo.classList.add('hidden');
            formNuevo.reset();
            cargarDatos(currentAdminFilter);
        } catch (err) {
            console.error('Error procesando registro:', err);
            showToast('❌ Error al procesar el registro', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = editingId ? 'Actualizar Registro' : 'Guardar Registro';
        }
    };

    // ========== SUBMIT NUEVO MODAL EVENTO ==========
    document.getElementById('form-nuevo-evento').onsubmit = async (e) => {
        e.preventDefault();
        const modalEvento = document.getElementById('modal-nuevo-evento');
        const editingId = modalEvento.dataset.editingId;
        const btn = document.getElementById('btn-submit-evento');
        btn.disabled = true;
        btn.textContent = editingId ? 'Actualizando...' : 'Guardando Evento...';

        try {
            let imageUrl = evUrlInput.value;

            if (evFileInput.files[0]) {
                const rawFile = evFileInput.files[0];
                const file = await compressImage(rawFile);
                const fileName = `${Math.random()}.webp`;
                const filePath = `uploads/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('eco-media').upload(filePath, file, {
                    contentType: 'image/webp'
                });
                if (uploadError) throw uploadError;
                const { data: publicUrl } = supabase.storage.from('eco-media').getPublicUrl(filePath);
                imageUrl = publicUrl.publicUrl;
            }

            const eventData = {
                nombre: document.getElementById('ev-nombre').value,
                descripcion: document.getElementById('ev-descripcion').value,
                imagen_url: imageUrl,
                categoria: document.getElementById('ev-categoria').value,
                lugar_id: document.getElementById('ev-sede').value || null,
                fecha_inicio: document.getElementById('ev-fecha-inicio').value,
                fecha_fin: document.getElementById('ev-fecha-fin').value,
                ubicacion: document.getElementById('ev-ubicacion').value,
                mapa_url: document.getElementById('ev-gmaps').value,
                lat: document.getElementById('ev-lat').value || null,
                lng: document.getElementById('ev-lng').value || null,
                reg_link: document.getElementById('ev-reg-link').value || null,
                social_fb: getEvSocial('social_fb'),
                social_ig: getEvSocial('social_ig'),
                social_wa: getEvSocial('social_wa'),
                social_x: getEvSocial('social_x'),
                social_yt: getEvSocial('social_yt'),
                social_web: getEvSocial('social_web')
            };

            if (editingId) {
                const { error } = await supabase.from('eventos').update(eventData).eq('id', editingId);
                if (error) throw error;
                showToast('✅ Evento actualizado correctamente');
            } else {
                eventData.owner_id = session.user.id;
                eventData.estado = 'publicado';
                const { error } = await supabase.from('eventos').insert([eventData]);
                if (error) throw error;
                showToast('✅ Evento creado correctamente');
            }

            modalEvento.classList.add('hidden');
            formEvento.reset();
            evSocialContainer.innerHTML = '';
            document.querySelectorAll('#ev-social-selector .social-btn').forEach(b => b.classList.remove('active'));
            cargarDatos('eventos');
        } catch (err) {
            console.error('Error procesando evento:', err);
            showToast('❌ Error al procesar el evento', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = editingId ? 'Actualizar Evento' : 'Guardar Evento';
        }
    };

    function getEvSocial(network) {
        const input = document.querySelector(`#ev-social-inputs input[data-net="${network}"]`);
        return input ? input.value : null;
    }

    // ========== SUBMIT NUEVO MODAL LUGAR ==========
    document.getElementById('form-nuevo-lugar').onsubmit = async (e) => {
        e.preventDefault();
        const modalLugar = document.getElementById('modal-nuevo-lugar');
        const editingId = modalLugar.dataset.editingId;
        const btn = document.getElementById('btn-submit-lugar');
        const formLugar = document.getElementById('form-nuevo-lugar');

        btn.disabled = true;
        btn.textContent = editingId ? 'Actualizando...' : 'Guardando Lugar...';

        try {
            let imageUrl = plUrlInput.value;

            if (plFileInput.files[0]) {
                const rawFile = plFileInput.files[0];
                const file = await compressImage(rawFile);
                const fileName = `${Math.random()}.webp`;
                const filePath = `uploads/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('eco-media').upload(filePath, file, {
                    contentType: 'image/webp'
                });
                if (uploadError) throw uploadError;
                const { data: publicUrl } = supabase.storage.from('eco-media').getPublicUrl(filePath);
                imageUrl = publicUrl.publicUrl;
            }

            const placeData = {
                nombre: document.getElementById('pl-nombre').value,
                descripcion: document.getElementById('pl-descripcion').value,
                imagen: imageUrl, // Columna en BD se llama "imagen"
                categoria: document.getElementById('pl-categoria').value,
                ubicacion: document.getElementById('pl-ubicacion').value,
                mapa_url: document.getElementById('pl-gmaps').value,
                lat: document.getElementById('pl-lat').value || null,
                lng: document.getElementById('pl-lng').value || null,
                reg_link: document.getElementById('pl-reg-link').value || null,
                social_fb: getPlSocial('social_fb'),
                social_ig: getPlSocial('social_ig'),
                social_wa: getPlSocial('social_wa'),
                social_x: getPlSocial('social_x'),
                social_yt: getPlSocial('social_yt'),
                social_web: getPlSocial('social_web')
            };

            if (editingId) {
                const { error } = await supabase.from('lugares').update(placeData).eq('id', editingId);
                if (error) throw error;
                showToast('✅ Lugar actualizado correctamente');
            } else {
                placeData.owner_id = session.user.id;
                const { error } = await supabase.from('lugares').insert([placeData]);
                if (error) throw error;
                showToast('✅ Lugar creado correctamente');
            }

            modalLugar.classList.add('hidden');
            formLugar.reset();
            if(plSocialContainer) plSocialContainer.innerHTML = '';
            document.querySelectorAll('#pl-social-selector .social-btn').forEach(b => b.classList.remove('active'));
            cargarDatos('lugares');
        } catch (err) {
            console.error('Error procesando lugar:', err);
            showToast('❌ Error al procesar el lugar', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = editingId ? 'Actualizar Lugar' : 'Guardar Lugar';
        }
    };


    // User Profile logic
    window.editarPerfil = async (id) => {
        console.log('[Admin] Abriendo perfil para ID:', id);
        const profileModal = document.getElementById('profile-modal');
        if (!profileModal) {
            console.error('[Admin] No se encontró el elemento #profile-modal');
            return;
        }

        try {
            const { data, error } = await supabase.from('perfiles').select('*').eq('id', id).single();
            if (error) {
                console.error('[Admin] Error al obtener perfil:', error);
                showToast('Error al cargar datos del perfil', 'error');
                return;
            }

            if (data) {
                const nombreEl = document.getElementById('prof-nombre');
                const rolEl = document.getElementById('prof-rol');
                const telEl = document.getElementById('prof-telefono');
                const bioEl = document.getElementById('prof-bio');
                const webEl = document.getElementById('prof-web');
                const fbEl = document.getElementById('prof-fb');
                const igEl = document.getElementById('prof-ig');
                const xEl = document.getElementById('prof-x');

                if (nombreEl) nombreEl.value = data.nombre_completo || '';
                if (rolEl) rolEl.value = data.rol || 'actor';
                if (telEl) telEl.value = data.telefono || '';
                if (bioEl) bioEl.value = data.bio || '';
                if (webEl) webEl.value = data.sitio_web || '';
                
                const links = data.links_sociales || {};
                if (fbEl) fbEl.value = links.facebook || '';
                if (igEl) igEl.value = links.instagram || '';
                if (xEl) xEl.value = links.twitter || '';
                
                // Mostrar avatar actual
                const preview = document.getElementById('prof-avatar-preview');
                if (preview) {
                    if (data.avatar_url) {
                        preview.innerHTML = `<img src="${data.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:40px;">`;
                    } else {
                        preview.innerHTML = (data.nombre_completo || 'U').charAt(0).toUpperCase();
                    }
                }
                
                profileModal.dataset.userId = id;
                profileModal.classList.remove('hidden');
                console.log('[Admin] Modal de gestión de agente mostrado');
            } else {
                showToast('No se encontró el perfil', 'warning');
            }
        } catch (err) {
            console.error('[Admin] Error inesperado en editarPerfil:', err);
            showToast('Ocurrió un error al abrir el perfil', 'error');
        }
    };

    document.getElementById('btn-close-profile').onclick = () => document.getElementById('profile-modal').classList.add('hidden');
    document.getElementById('btn-cancel-profile').onclick = () => document.getElementById('profile-modal').classList.add('hidden');
    
    // Manejar previsualización de nuevo avatar en modal
    const avatarInput = document.getElementById('prof-avatar-input');
    if (avatarInput) {
        avatarInput.onchange = (e) => {
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

    document.getElementById('form-profile-edit').onsubmit = async (e) => {
        e.preventDefault();
        const profileModal = document.getElementById('profile-modal');
        const id = profileModal.dataset.userId;
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';

        try {
            // 1. Subir nueva imagen si se seleccionó
            let avatarUrl = null;
            const file = avatarInput.files[0];
            if (file) {
                avatarUrl = await uploadToSupabase(supabase, file);
            }

            const updates = {
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

            if (avatarUrl) updates.avatar_url = avatarUrl;

            if (avatarUrl) updates.avatar_url = avatarUrl;

            const { error } = await supabase.from('perfiles').update(updates).eq('id', id);
            if (error) throw error;

            showToast('✅ Perfil actualizado correctamente');
            profileModal.classList.add('hidden');
            
            // Si el perfil editado es el del propio admin/actor logueado, recargar la página para ver cambios en navbar
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.id === id) {
                setTimeout(() => window.location.reload(), 1000);
            } else {
                cargarDatos('usuarios');
            }
        } catch (err) {
            console.error('Error al actualizar perfil:', err);
            showToast('❌ Error al actualizar perfil', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    };

    // Mobile Toggle is already handled at the top of the script.

    // ========== GESTIÓN DE PERMISOS ==========
    // ========== GESTIÓN DE PERFIL COMPLETA ==========
    function cargarDatosPerfil(perfil) {
        document.getElementById('p-nombre').value = perfil.nombre_completo || '';
        document.getElementById('p-telefono').value = perfil.telefono || '';
        document.getElementById('p-bio').value = perfil.bio || '';
        
        const preview = document.getElementById('edit-avatar-preview');
        if (perfil.avatar_url) {
            preview.innerHTML = `<img src="${perfil.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:30px;">`;
        } else {
            preview.innerHTML = (perfil.nombre_completo || 'U').charAt(0).toUpperCase();
        }

        // Mostrar email actual
        const emailDisplay = document.getElementById('p-email-display-text');
        if (emailDisplay) {
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (user) emailDisplay.textContent = user.email;
            });
        }
        
        // Cargar redes sociales desde metadatos si existen
        if (perfil.links_sociales) {
            document.getElementById('p-fb').value = perfil.links_sociales.facebook || '';
            document.getElementById('p-ig').value = perfil.links_sociales.instagram || '';
            document.getElementById('p-x').value = perfil.links_sociales.twitter || '';
            document.getElementById('p-web').value = perfil.links_sociales.web || '';
        }
    }

    // Manejar previsualización en vista "Mi Perfil"
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
            const { data: { user } } = await supabase.auth.getUser();
            
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

            const { error } = await supabase.from('perfiles').update(updates).eq('id', user.id);
            if (error) throw error;

            showToast('✅ Cambios guardados con éxito');
            
            // Recargar para ver cambios en sidebar y navbar
            setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
            console.error('Error al actualizar perfil:', err);
            showToast('❌ Error al guardar cambios', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    };

    // --- LÓGICA DE SEGURIDAD (EMAIL/PASS) ---
    const btnUpdateEmail = document.getElementById('btn-update-email');
    if (btnUpdateEmail) {
        btnUpdateEmail.onclick = async () => {
            const newEmail = document.getElementById('p-new-email').value;
            if (!newEmail) return showToast('⚠️ Ingresa el nuevo correo', 'warning');
            
            btnUpdateEmail.disabled = true;
            btnUpdateEmail.textContent = 'Procesando...';

            const { error } = await supabase.auth.updateUser({ email: newEmail });
            if (error) {
                showToast(`❌ Error: ${error.message}`, 'error');
            } else {
                showToast('✅ Se ha enviado un correo de confirmación a ambas direcciones');
                document.getElementById('p-new-email').value = '';
            }
            btnUpdateEmail.disabled = false;
            btnUpdateEmail.textContent = 'Actualizar Correo';
        };
    }

    const btnUpdatePass = document.getElementById('btn-update-pass');
    if (btnUpdatePass) {
        btnUpdatePass.onclick = async () => {
            const newPass = document.getElementById('p-new-password').value;
            if (!newPass || newPass.length < 6) return showToast('⚠️ Mínimo 6 caracteres', 'warning');
            
            btnUpdatePass.disabled = true;
            btnUpdatePass.textContent = 'Procesando...';

            const { error } = await supabase.auth.updateUser({ password: newPass });
            if (error) {
                showToast(`❌ Error: ${error.message}`, 'error');
            } else {
                showToast('✅ Contraseña actualizada correctamente');
                document.getElementById('p-new-password').value = '';
            }
            btnUpdatePass.disabled = false;
            btnUpdatePass.textContent = 'Cambiar Contraseña';
        };
    }

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
            
            // 2. Cargar Permisos de Funciones (NUEVO)
            const { data: fnPerms } = await supabase.from('permisos_funciones').select('*').eq('user_id', userId).single();

            // Setear switches de funciones
            document.getElementById('fn-eventos').checked = fnPerms ? fnPerms.puede_crear_eventos : true;
            document.getElementById('fn-lugares').checked = fnPerms ? fnPerms.puede_crear_lugares : true;
            document.getElementById('fn-notifs').checked = fnPerms ? fnPerms.puede_enviar_notificaciones : false;
            document.getElementById('fn-directorio').checked = fnPerms ? fnPerms.visible_en_directorio : true;
            document.getElementById('fn-readonly').checked = fnPerms ? fnPerms.modo_solo_lectura : false;
            
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
                    <button type="button" class="btn-select-all" onclick="window.selectAllHub('${hubId}')">
                        Seleccionar Todo
                    </button>
                `;
                permsList.appendChild(col);
            });

            lucide.createIcons();

        } catch (err) {
            console.error('Error al cargar permisos:', err);
            showToast('Error al cargar permisos', 'error');
        }
    };

    window.selectAllHub = (hubId) => {
        const hubCol = document.querySelector(`.perm-column.hub-${hubId}`);
        const checks = hubCol.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(checks).every(c => c.checked);
        checks.forEach(c => c.checked = !allChecked);
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

            const { error: fnError } = await supabase.from('permisos_funciones').upsert(fnUpdates);
            if (fnError) throw fnError;

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

                // 3. Vincular con usuarios
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

    document.getElementById('logout-btn').onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = './index.html';
    };
})();
