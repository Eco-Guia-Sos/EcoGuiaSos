/* assets/js/pages/admin.js */
import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver, sanitize, showToast } from '../ui-utils.js';

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

    // Mobile Sidebar Toggle
    const mobileToggle = document.getElementById('mobile-toggle');
    const adminSidebar = document.getElementById('admin-sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');

    if (mobileToggle && adminSidebar && sidebarBackdrop) {
        mobileToggle.addEventListener('click', () => {
            adminSidebar.classList.toggle('active');
            sidebarBackdrop.classList.toggle('active');
        });

        sidebarBackdrop.addEventListener('click', () => {
            adminSidebar.classList.remove('active');
            sidebarBackdrop.classList.remove('active');
        });

        // Close sidebar on menu item click (mobile only)
        document.querySelectorAll('.admin-menu a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    adminSidebar.classList.remove('active');
                    sidebarBackdrop.classList.remove('active');
                }
            });
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
            .select('rol')
            .eq('id', session.user.id)
            .single();

        if (perfilError || !profile || !['admin', 'actor'].includes(profile.rol)) {
            console.warn('[Security] Acceso denegado');
            window.location.href = './index.html';
            return;
        }

        perfil = profile;
        esAdmin = perfil.rol === 'admin';
        esActor = perfil.rol === 'actor';

        // Show admin-only elements
        if (esAdmin) {
            document.querySelectorAll('.only-admin').forEach(el => el.style.display = 'flex');
        }

        // 2. Initialize Dashboard
        showDashboard();

    } catch (err) {
        console.error("Critical Error during admin initialization:", err);
    }

    function resetViews() {
        if (statsGrid) statsGrid.classList.add('hidden');
        if (hubMenuView) hubMenuView.classList.add('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        if (btnNuevo) btnNuevo.style.display = 'none';
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

    function showDashboard() {
        h1Header.textContent = `Hola, ${perfil.rol === 'admin' ? 'Administrador' : 'Actor'}`;
        pHeader.textContent = 'Resumen general de la plataforma.';
        statsGrid.classList.remove('hidden');
        tableContainer.classList.remove('hidden');
        tableTitle.textContent = 'Últimos Registros Globales';
        currentAdminFilter = 'all';
        cargarDatos('all');
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
        tableContainer.classList.remove('hidden');
        tableTitle.textContent = `Registros: ${title}`;
        
        if (view !== 'usuarios' && view !== 'voluntarios') {
            btnNuevo.style.display = 'flex';
        }
        
        currentAdminFilter = view;
        cargarDatos(view);
    }

    function renderHubMenuGrid(hub) {
        hubMenuGrid.innerHTML = '';
        const sections = {
            colibri: [
                { id: 'agua', label: 'Agua y Cuenca', icon: 'fa-droplet' },
                { id: 'cursos', label: 'Cursos', icon: 'fa-chalkboard-user' },
                { id: 'ecotecnias', label: 'Ecotecnias', icon: 'fa-solar-panel' },
                { id: 'lecturas', label: 'Lecturas', icon: 'fa-book-open' },
                { id: 'documentales', label: 'Cine/Documental', icon: 'fa-film' },
                { id: 'firmas', label: 'Firmas/Peticiones', icon: 'fa-pen-nib' }
            ],
            ajolote: [
                { id: 'convocatoria', label: 'Convocatorias', icon: 'fa-bullhorn' },
                { id: 'voluntariados', label: 'Voluntariados', icon: 'fa-handshake-angle' },
                { id: 'agentes', label: 'Agentes de Cambio', icon: 'fa-users' },
                { id: 'eventos', label: 'Eventos de Comunidad', icon: 'fa-calendar-day' }
            ],
            lobo: [
                { id: 'fondos', label: 'Fondos y Apoyos', icon: 'fa-hand-holding-dollar' },
                { id: 'normativa', label: 'Normativa Ambiental', icon: 'fa-scale-balanced' }
            ]
        };

        (sections[hub] || []).forEach(sec => {
            const card = document.createElement('div');
            card.className = 'hub-card';
            card.innerHTML = `<i class="fa-solid ${sec.icon}"></i><h4>${sec.label}</h4>`;
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
    }

    async function cargarDatos(filter = 'all') {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Cargando datos...</td></tr>';
        
        try {
            let allItems = [];
            
            if (filter === 'all') {
                const [eventsRes, placesRes] = await Promise.all([
                    supabase.from('eventos').select('*').order('created_at', { ascending: false }),
                    supabase.from('lugares').select('*').order('created_at', { ascending: false })
                ]);

                if (eventsRes.data) {
                    const mappedEvents = eventsRes.data.map(x => ({...x, nombre: x.nombre, categoria: x.categoria, tipo_orig: 'evento'}));
                    allItems = [...allItems, ...mappedEvents];
                }
                if (placesRes.data) {
                    const mappedPlaces = placesRes.data.map(x => ({...x, nombre: x.nombre, categoria: x.categoria, tipo_orig: 'lugar'}));
                    allItems = [...allItems, ...mappedPlaces];
                }

                document.getElementById('stat-eventos').textContent = allItems.filter(x => x.tipo_orig === 'evento').length;
                document.getElementById('stat-lugares').textContent = allItems.filter(x => x.tipo_orig === 'lugar').length;
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
            else if (filter === 'seguidores') {
                // Para el Admin muestra TODOS los seguidores en la plataforma
                // Para el Actor muestra SOLO los que lo siguen a ÉL
                let query = supabase
                    .from('seguimientos_actores')
                    .select('follower_id, perfiles:follower_id(nombre_completo, email)');
                
                if (esActor) {
                    query = query.eq('actor_id', session.user.id);
                }

                const { data, error } = await query;
                if (!error && data) {
                    allItems = data.map(row => ({
                        id: row.follower_id,
                        nombre: row.perfiles?.nombre_completo || 'Usuario',
                        categoria: row.perfiles?.email || 'Seguidor',
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
            const statusLabel = item.estado || 'activo';
            const badgeColor = statusLabel === 'publicado' ? '#72B04D' : (statusLabel === 'pendiente' ? '#f39c12' : '#64748b');
            
            tr.innerHTML = `
                <td><strong>${sanitize(item.nombre)}</strong></td>
                <td><span style="font-size: 0.8rem; color: #888;">${sanitize(item.categoria)}</span></td>
                <td><span class="badge" style="background: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}44;">${statusLabel}</span></td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        ${item.tipo_orig === 'perfiles' ? `
                            <button onclick="window.editarPerfil('${item.id}')" class="btn-admin" style="padding: 4px 8px; font-size: 0.75rem;"><i class="fa-solid fa-user-pen"></i> Info</button>
                            ${item.rol === 'actor' ? `<button onclick="window.gestionarPermisos('${item.id}')" class="btn-admin" style="padding: 4px 8px; font-size: 0.75rem; border-color: var(--color-eco); color: var(--color-eco);"><i class="fa-solid fa-key"></i></button>` : ''}
                        ` : `
                            <button class="btn-admin" style="padding: 4px 8px; color: #5bc2f7;"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn-admin" style="padding: 4px 8px; color: #ff5252;"><i class="fa-solid fa-trash"></i></button>
                        `}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

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
            document.getElementById('pl-image-preview').classList.add('hidden');
            document.getElementById('pl-image-preview').style.backgroundImage = '';
            modalLugar.classList.remove('hidden');
            return;
        }

        formNuevo.reset();
        document.getElementById('modal-title-text').textContent = "Nuevo Registro";
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
        const btn = document.getElementById('btn-submit-form');
        const tipo = document.getElementById('input-tipo').value;
        
        btn.disabled = true;
        btn.textContent = 'Guardando...';

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

            const commonData = {
                nombre: document.getElementById('input-nombre').value,
                descripcion: document.getElementById('input-descripcion').value,
                imagen_url: imageUrl,
                owner_id: session.user.id,
                estado: 'publicado'
            };

            if (tipo === 'eventos') {
                const { error } = await supabase.from('eventos').insert([{
                    ...commonData,
                    categoria: document.getElementById('input-categoria-evento').value,
                    lugar_id: document.getElementById('input-sede').value,
                    fecha_inicio: document.getElementById('input-fecha-inicio').value,
                    fecha_fin: document.getElementById('input-fecha-fin').value,
                    lat: document.getElementById('input-lat').value || null,
                    lng: document.getElementById('input-lng').value || null
                }]);
                if (error) throw error;
            } 
            else if (tipo === 'lugares') {
                const { error } = await supabase.from('lugares').insert([{
                    ...commonData,
                    categoria: document.getElementById('input-categoria-lugar').value,
                    direccion: document.getElementById('input-direccion').value,
                    lat: document.getElementById('input-lat').value || null,
                    lng: document.getElementById('input-lng').value || null
                }]);
                if (error) throw error;
            }
            else if (tipo === 'contenido') {
                // If it's content, we need the section/hub from currentAdminFilter
                const parts = currentAdminFilter.split('_');
                const { error } = await supabase.from('contenido_secciones').insert([{
                    titulo: commonData.nombre,
                    descripcion: commonData.descripcion,
                    imagen_url: commonData.imagen_url,
                    enlace: document.getElementById('input-enlace').value,
                    seccion_id: parts[1],
                    parent_hub: parts[2],
                    owner_id: commonData.owner_id,
                    estado: 'publicado'
                }]);
                if (error) throw error;
            }

            showToast('✅ Registro guardado correctamente');
            modalNuevo.classList.add('hidden');
            formNuevo.reset();
            cargarDatos(currentAdminFilter);
        } catch (err) {
            console.error('Error guardando:', err);
            showToast('❌ Error al guardar registro', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar Registro';
        }
    };

    // ========== SUBMIT NUEVO MODAL EVENTO ==========
    document.getElementById('form-nuevo-evento').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-evento');
        btn.disabled = true;
        btn.textContent = 'Guardando Evento...';

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
                owner_id: session.user.id, // THE ACTOR ID IS SAVED HERE
                estado: 'publicado',
                categoria: document.getElementById('ev-categoria').value,
                lugar_id: document.getElementById('ev-sede').value,
                fecha_inicio: document.getElementById('ev-fecha-inicio').value,
                fecha_fin: document.getElementById('ev-fecha-fin').value,
                ubicacion: document.getElementById('ev-ubicacion').value,
                mapa_url: document.getElementById('ev-gmaps').value,
                lat: document.getElementById('ev-lat').value || null,
                lng: document.getElementById('ev-lng').value || null,
                reg_link: document.getElementById('ev-reg-link').value || null,
                // Redes
                social_fb: getEvSocial('social_fb'),
                social_ig: getEvSocial('social_ig'),
                social_wa: getEvSocial('social_wa'),
                social_x: getEvSocial('social_x'),
                social_yt: getEvSocial('social_yt'),
                social_web: getEvSocial('social_web')
            };

            const { error } = await supabase.from('eventos').insert([eventData]);
            if (error) throw error;

            showToast('✅ Evento creado correctamente');
            document.getElementById('modal-nuevo-evento').classList.add('hidden');
            document.getElementById('form-nuevo-evento').reset();
            evSocialContainer.innerHTML = '';
            document.querySelectorAll('#ev-social-selector .social-btn').forEach(b => b.classList.remove('active'));
            cargarDatos('eventos');
        } catch (err) {
            console.error('Error guardando evento:', err);
            showToast('❌ Error al guardar el evento', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar Evento';
        }
    };

    function getEvSocial(network) {
        const input = document.querySelector(`#ev-social-inputs input[data-net="${network}"]`);
        return input ? input.value : null;
    }

    // ========== SUBMIT NUEVO MODAL LUGAR ==========
    document.getElementById('form-nuevo-lugar').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-lugar');
        btn.disabled = true;
        btn.textContent = 'Guardando Lugar...';

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
                owner_id: session.user.id,
                categoria: document.getElementById('pl-categoria').value,
                ubicacion: document.getElementById('pl-ubicacion').value,
                mapa_url: document.getElementById('pl-gmaps').value,
                lat: document.getElementById('pl-lat').value || null,
                lng: document.getElementById('pl-lng').value || null,
                reg_link: document.getElementById('pl-reg-link').value || null,
                // Redes
                social_fb: getPlSocial('social_fb'),
                social_ig: getPlSocial('social_ig'),
                social_wa: getPlSocial('social_wa'),
                social_x: getPlSocial('social_x'),
                social_yt: getPlSocial('social_yt'),
                social_web: getPlSocial('social_web')
            };

            const { error } = await supabase.from('lugares').insert([placeData]);
            if (error) throw error;

            showToast('✅ Lugar creado correctamente');
            document.getElementById('modal-nuevo-lugar').classList.add('hidden');
            document.getElementById('form-nuevo-lugar').reset();
            if(plSocialContainer) plSocialContainer.innerHTML = '';
            document.querySelectorAll('#pl-social-selector .social-btn').forEach(b => b.classList.remove('active'));
            cargarDatos('lugares');
        } catch (err) {
            console.error('Error guardando lugar:', err);
            showToast('❌ Error al guardar el lugar', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar Lugar';
        }
    };


    // User Profile logic
    const profileModal = document.getElementById('profile-modal');
    window.editarPerfil = async (id) => {
        const { data } = await supabase.from('perfiles').select('*').eq('id', id).single();
        if (data) {
            document.getElementById('prof-nombre').value = data.nombre_completo || '';
            document.getElementById('prof-rol').value = data.rol || 'user';
            document.getElementById('prof-telefono').value = data.telefono || '';
            document.getElementById('prof-links').value = data.social_links || '';
            profileModal.dataset.userId = id;
            profileModal.classList.remove('hidden');
        }
    };

    document.getElementById('btn-close-profile').onclick = () => profileModal.classList.add('hidden');
    document.getElementById('btn-cancel-profile').onclick = () => profileModal.classList.add('hidden');
    
    document.getElementById('form-profile-edit').onsubmit = async (e) => {
        e.preventDefault();
        const id = profileModal.dataset.userId;
        const updates = {
            nombre_completo: document.getElementById('prof-nombre').value,
            rol: document.getElementById('prof-rol').value,
            telefono: document.getElementById('prof-telefono').value,
            social_links: document.getElementById('prof-links').value
        };
        const { error } = await supabase.from('perfiles').update(updates).eq('id', id);
        if (!error) {
            showToast('Perfil actualizado');
            profileModal.classList.add('hidden');
            cargarDatos('usuarios');
        }
    };

    // Mobile Toggle is already handled at the top of the script.

    // ========== GESTIÓN DE PERMISOS ==========
    const permsModal = document.getElementById('permissions-modal');
    const permsList = document.getElementById('permissions-list');
    let currentPermsUserId = null;

    window.gestionarPermisos = async (userId) => {
        currentPermsUserId = userId;
        permsList.innerHTML = '<p style="grid-column: span 2;">Cargando permisos...</p>';
        permsModal.classList.remove('hidden');

        try {
            const { data: currentPerms } = await supabase.from('permisos_actores').select('seccion_id, parent_hub').eq('user_id', userId);
            
            const allSections = [
                { id: 'agua', label: 'Agua (Colibrí)', hub: 'colibri' },
                { id: 'cursos', label: 'Cursos (Colibrí)', hub: 'colibri' },
                { id: 'ecotecnias', label: 'Ecotecnias (Colibrí)', hub: 'colibri' },
                { id: 'lecturas', label: 'Lecturas (Colibrí)', hub: 'colibri' },
                { id: 'documentales', label: 'Cine (Colibrí)', hub: 'colibri' },
                { id: 'firmas', label: 'Peticiones (Colibrí)', hub: 'colibri' },
                { id: 'convocatoria', label: 'Convocatorias (Ajolote)', hub: 'ajolote' },
                { id: 'voluntariados', label: 'Voluntariados (Ajolote)', hub: 'ajolote' },
                { id: 'agentes', label: 'Agentes (Ajolote)', hub: 'ajolote' },
                { id: 'eventos', label: 'Eventos (Ajolote)', hub: 'ajolote' },
                { id: 'fondos', label: 'Fondos (Lobo)', hub: 'lobo' },
                { id: 'normativa', label: 'Normativa (Lobo)', hub: 'lobo' }
            ];

            permsList.innerHTML = '';
            allSections.forEach(sec => {
                const hasPerm = currentPerms?.some(p => p.seccion_id === sec.id && p.parent_hub === sec.hub);
                const div = document.createElement('label');
                div.className = 'perm-item';
                div.innerHTML = `
                    <input type="checkbox" data-sec="${sec.id}" data-hub="${sec.hub}" ${hasPerm ? 'checked' : ''}>
                    <span>${sec.label}</span>
                `;
                permsList.appendChild(div);
            });

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
        btn.textContent = 'Guardando...';

        try {
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

            showToast('Permisos actualizados correctamente');
            permsModal.classList.add('hidden');
        } catch (err) {
            console.error('Error al guardar permisos:', err);
            showToast('Error al guardar cambios', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar Cambios';
        }
    };

    document.getElementById('logout-btn').onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = './index.html';
    };
})();
