/* assets/js/pages/admin.js */
import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    setupNavbar();
    setupAuthObserver();

    // Guard: Only allow admins or actors
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = './auth.html';
        return;
    }

    // Logout button in admin sidebar
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = './index.html';
        });
    }

    // Mobile sidebar toggle
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function openSidebar() {
        sidebar?.classList.add('open');
        overlay?.classList.add('active');
        if (sidebarToggleBtn) sidebarToggleBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    }

    function closeSidebar() {
        sidebar?.classList.remove('open');
        overlay?.classList.remove('active');
        if (sidebarToggleBtn) sidebarToggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }

    sidebarToggleBtn?.addEventListener('click', () => {
        sidebar?.classList.contains('open') ? closeSidebar() : openSidebar();
    });

    overlay?.addEventListener('click', closeSidebar);

    // Admin Sidebar Menu Filtering
    const menuLinks = document.querySelectorAll('.admin-menu a');
    let currentAdminFilter = 'all';

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const h2Header = document.querySelector('.header-titles h1');
            const pHeader = document.querySelector('.admin-subtitle');
            
            if (link.classList.contains('nav-back-admin')) return;
            
            e.preventDefault();
            menuLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const section = link.innerText.trim();
            if (section.includes('Dashboard')) currentAdminFilter = 'all';
            else if (section.includes('Eventos')) currentAdminFilter = 'evento';
            else if (section.includes('Lugares')) currentAdminFilter = 'lugar';
            else if (section.includes('Usuarios')) currentAdminFilter = 'perfiles';
            
            h2Header.textContent = `Gestión de ${section}`;
            pHeader.textContent = `Listado de ${section.toLowerCase()} registrados en el sistema.`;
            
            cargarDatos(currentAdminFilter);
        });
    });

    const { data: profile } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', session.user.id)
        .single();

    if (!profile || (profile.rol !== 'admin' && profile.rol !== 'actor')) {
        alert('No tienes permisos para acceder a esta sección.');
        window.location.href = './index.html';
        return;
    }

    // Set user display name
    const adminUserDisplay = document.getElementById('admin-user-display');
    if (adminUserDisplay) {
        adminUserDisplay.textContent = `Administrador (${session.user.email})`;
    }

    // Modal elements
    const btnNuevo = document.getElementById('btn-nuevo');
    const modalNuevo = document.getElementById('modal-nuevo');
    const btnCancelar = document.getElementById('btn-cancelar');
    const formNuevo = document.getElementById('form-nuevo');

    if (btnNuevo) btnNuevo.disabled = false;

    // Mostrar/ocultar categorías exclusivas de admin
    const optgroupAdmin = document.getElementById('optgroup-admin');
    if (optgroupAdmin && profile.rol === 'admin') {
        optgroupAdmin.style.display = '';
    }
    
    let mapPicker = null;
    let marker = null;

    cargarDatos('all');
    setupModal();

    function setupModal() {
        if (!btnNuevo) return;

        btnNuevo.addEventListener('click', async () => {
            await loadSedesDropdown();
            modalNuevo.style.display = 'flex';
            initMapPicker();
        });

        btnCancelar.addEventListener('click', () => {
            modalNuevo.style.display = 'none';
            formNuevo.reset();
            if (marker) marker.remove();
            marker = null;
        });
        // Toggle Lógica para Tipo (Evento vs Lugar Permanente)
        const typeSelect = document.getElementById('input-tipo');
        const catBtns = document.querySelectorAll('.btn-categoria');
        
        catBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update internal hidden input
                if (typeSelect) typeSelect.value = btn.dataset.cat;
                
                // Active button visual
                catBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'rgba(0,0,0,0.3)';
                });
                btn.classList.add('active');
                btn.style.background = 'var(--color-eco)';

                // DYNAMIC UI TOGGLES
                const isLugar = btn.dataset.cat === 'lugar';
                
                // 1. Categoria (Dropdown vs Text)
                document.getElementById('label-categoria').innerText = isLugar ? 'Tipo de Espacio (Ej. Huerto, Parque...)' : 'Categoría';
                document.getElementById('container-categoria-evento').style.display = isLugar ? 'none' : 'block';
                document.getElementById('container-categoria-lugar').style.display = isLugar ? 'block' : 'none';

                // 2. Fechas / Horario
                document.getElementById('section-fechas').style.display = isLugar ? 'none' : 'grid';

                // 3. Sede & Registro (Only for events)
                document.getElementById('section-sede').style.display = isLugar ? 'none' : 'block';
                document.getElementById('section-registro').style.display = isLugar ? 'none' : 'block';
            });
        });

        // Auto-fill coordenadas si selecciona un lugar
        const inputLugarId = document.getElementById('input-lugar-id');
        if (inputLugarId) {
            inputLugarId.addEventListener('change', (e) => {
                const lugarId = e.target.value;
                if (!lugarId) return;
                const lugar = window.sysLugaresCache?.find(l => l.id === lugarId);
                if (lugar) {
                    if (lugar.ubicacion) document.getElementById('input-ubicacion').value = lugar.ubicacion;
                    if (lugar.lat && lugar.lng) {
                        document.getElementById('input-lat').value = lugar.lat;
                        document.getElementById('input-lng').value = lugar.lng;
                        updatePickerMarker(lugar.lat, lugar.lng);
                    }
                }
            });
        }

        // Redes Sociales: Lógica de Toggle (Se prenden al pulsar)
        const snToggles = document.querySelectorAll('.btn-sn-toggle');
        snToggles.forEach(btn => {
            btn.addEventListener('click', () => {
                const sn = btn.dataset.sn;
                const activeColor = btn.dataset.color;
                const group = document.getElementById(`input-group-${sn}`);
                
                if (group) {
                    if (group.style.display === 'none' || group.style.display === '') {
                        // PRENDER
                        group.style.display = 'flex';
                        btn.style.background = activeColor;
                        btn.style.color = 'white';
                        btn.style.boxShadow = `0 4px 15px ${activeColor.includes('gradient') ? 'rgba(214, 41, 118, 0.4)' : activeColor + '66'}`;
                        btn.classList.replace('sn-off', 'sn-on');
                    } else {
                        // APAGAR
                        group.style.display = 'none';
                        btn.style.background = 'rgba(255,255,255,0.05)';
                        btn.style.color = 'rgba(255,255,255,0.4)';
                        btn.style.boxShadow = 'none';
                        btn.classList.replace('sn-on', 'sn-off');
                        document.getElementById(`input-${sn}`).value = '';
                    }
                }
            });
        });

        // GPS Helper Logic
        const btnGPS = document.getElementById('btn-gps-helper');
        if (btnGPS) {
            btnGPS.addEventListener('click', () => {
                if (!navigator.geolocation) return alert("Tu navegador no soporta GPS.");
                btnGPS.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Obteniendo...';
                navigator.geolocation.getCurrentPosition((pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    document.getElementById('input-lat').value = lat;
                    document.getElementById('input-lng').value = lng;
                    updatePickerMarker(lat, lng);
                    btnGPS.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Usar mi ubicación actual (GPS)';
                }, () => {
                    alert("Error al obtener ubicación. Asegúrate de dar permiso al navegador.");
                    btnGPS.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Usar mi ubicación actual (GPS)';
                });
            });
        }

        // 🔑 EXTRACTOR DE COORDENADAS DESDE GOOGLE MAPS
        const btnExtract = document.getElementById('btn-extract-coords');
        const extractInput = document.getElementById('input-gmaps-extract');
        const extractStatus = document.getElementById('extract-status');

        if (btnExtract && extractInput) {
            btnExtract.addEventListener('click', async () => {
                const raw = extractInput.value.trim();
                if (!raw) return;

                extractStatus.style.color = '#f39c12';
                extractStatus.textContent = '🔄 Procesando link...';

                // Intento 1: Extraer del URL directamente (formato @lat,lng)
                const coordMatch = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (coordMatch) {
                    setExtractedCoords(parseFloat(coordMatch[1]), parseFloat(coordMatch[2]));
                    return;
                }

                // Intento 2: Buscar ?q=lat,lng
                const qMatch = raw.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (qMatch) {
                    setExtractedCoords(parseFloat(qMatch[1]), parseFloat(qMatch[2]));
                    return;
                }

                // Intento 3: Link corto (goo.gl / maps.app.goo.gl) — necesita expandirse
                // Como no podemos hacer CORS fetch al link corto, pedimos al usuario que use el link largo
                if (raw.includes('goo.gl') || raw.includes('maps.app')) {
                    extractStatus.style.color = '#5bc2f7';
                    extractStatus.innerHTML = '⚠️ Link corto detectado. <strong>Abre el link en tu navegador</strong>, copia el URL largo de la barra de dirección y pégalo aquí. El URL largo contiene @lat,lng.';
                    return;
                }

                extractStatus.style.color = '#ff5252';
                extractStatus.textContent = '❌ No se encontraron coordenadas en este link. Intenta con el URL completo de maps.google.com.';
            });
        }

        function setExtractedCoords(lat, lng) {
            document.getElementById('input-lat').value = lat.toFixed(6);
            document.getElementById('input-lng').value = lng.toFixed(6);
            updatePickerMarker(lat, lng);
            extractStatus.style.color = '#2ed573';
            extractStatus.textContent = `✅ Coordenadas extraidas: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }

        formNuevo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = formNuevo.querySelector('button[type="submit"]');
            btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            btnSubmit.disabled = true;

            const tipo = document.getElementById('input-tipo').value;
            const table = (tipo === 'evento') ? 'eventos' : 'lugares';

            // 1. Validar y subir imagen si hay archivo
            let imagenUrl = null;
            const fileInput = document.getElementById('input-imagen-file');
            const uploadStatus = document.getElementById('upload-status');

            if (fileInput?.files?.length > 0) {
                const file = fileInput.files[0];
                
                // --- VALIDACIONES DE CALIDAD ---
                const MAX_SIZE = 2 * 1024 * 1024; // 2MB
                const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

                if (!ALLOWED_TYPES.includes(file.type)) {
                    alert('❌ Formato no permitido. Por favor usa JPG, PNG o WebP. (Evita .bmp o .tiff)');
                    btnSubmit.innerHTML = 'Guardar';
                    btnSubmit.disabled = false;
                    return;
                }

                if (file.size > MAX_SIZE) {
                    alert('❌ Imagen muy pesada. El límite es de 2MB para mantener la página rápida.');
                    btnSubmit.innerHTML = 'Guardar';
                    btnSubmit.disabled = false;
                    return;
                }
                // -------------------------------

                const ext = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                uploadStatus.textContent = '⏳ Subiendo imagen...';

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('imagenes-plataforma')
                    .upload(fileName, file, { upsert: false });

                if (uploadError) {
                    uploadStatus.textContent = `⚠️ Error subida: ${uploadError.message}`;
                    console.error("Error storage:", uploadError);
                } else {
                    const { data: urlData } = supabase.storage
                        .from('imagenes-plataforma')
                        .getPublicUrl(uploadData.path);
                    imagenUrl = urlData.publicUrl;
                    uploadStatus.textContent = '✅ Imagen subida';
                }
            }

            // 2. Construir payload limpio
            const lat = parseFloat(document.getElementById('input-lat').value) || null;
            const lng = parseFloat(document.getElementById('input-lng').value) || null;
            const mapaUrl = document.getElementById('input-mapa').value.trim() 
                         || document.getElementById('input-gmaps-extract').value.trim() 
                         || null;

            const isEvento = tipo === 'evento';
            
            const payload = {
                nombre: document.getElementById('input-nombre').value,
                categoria: isEvento ? document.getElementById('input-categoria').value : document.getElementById('input-categoria-libre').value,
                ubicacion: document.getElementById('input-ubicacion').value,
                mapa_url: mapaUrl,
                descripcion: document.getElementById('input-descripcion').value.trim() || null,
                lat: document.getElementById('input-lat').value || null,
                lng: document.getElementById('input-lng').value || null,
                fecha_inicio: isEvento ? (document.getElementById('input-fecha-inicio').value || null) : null,
                fecha_fin: isEvento ? (document.getElementById('input-fecha-fin').value || null) : null,
                social_fb: document.getElementById('input-fb').value.trim() || null,
                social_ig: document.getElementById('input-ig').value.trim() || null,
                social_wa: document.getElementById('input-wa').value.trim() || null,
                social_yt: document.getElementById('input-yt').value.trim() || null,
                social_web: document.getElementById('input-web').value.trim() || null,
                reg_link: isEvento ? (document.getElementById('input-reg-link').value.trim() || null) : null,
                owner_id: session.user.id
            };

            if (isEvento) {
                payload.lugar_id = document.getElementById('input-lugar-id')?.value || null;
            }

            if (imagenUrl) payload.imagen = imagenUrl;

            try {
                const editingId = formNuevo.dataset.editingId;
                const editingTable = formNuevo.dataset.editingTable;

                if (editingId && editingTable) {
                    // MODO EDICIÓN — UPDATE
                    const { error } = await supabase.from(editingTable).update(payload).eq('id', editingId);
                    if (error) { console.error('Error update:', error); throw error; }
                    delete formNuevo.dataset.editingId;
                    delete formNuevo.dataset.editingTable;
                } else {
                    // MODO CREACIÓN — INSERT
                    const { error } = await supabase.from(table).insert([payload]);
                    if (error) { console.error('Error insert:', error); throw error; }
                }

                // Reset modal
                document.querySelector('#modal-nuevo h2').textContent = 'Crear Nuevo';
                const btnS = formNuevo.querySelector('button[type="submit"]');
                btnS.textContent = 'Guardar';

                modalNuevo.style.display = 'none';
                formNuevo.reset();
                uploadStatus.textContent = '';
                cargarDatos(currentAdminFilter);
                alert('✅ ¡Guardado con éxito!');
            } catch (err) {
                console.error("Error guardando:", err);
                alert(`Error al guardar: ${err.message || 'Revisa la consola para más detalles.'}`);
            } finally {
                btnSubmit.innerHTML = 'Guardar';
                btnSubmit.disabled = false;
            }
        });
    }

    function initMapPicker() {
        if (mapPicker) {
            mapPicker.resize();
            return;
        }

        mapPicker = new maplibregl.Map({
            container: 'map-picker',
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: [-99.1332, 19.4326],
            zoom: 11
        });

        mapPicker.on('click', (e) => {
            const { lng, lat } = e.lngLat;
            document.getElementById('input-lat').value = lat.toFixed(6);
            document.getElementById('input-lng').value = lng.toFixed(6);
            updatePickerMarker(lat, lng);
        });
    }

    function updatePickerMarker(lat, lng) {
        if (!mapPicker) return;
        if (marker) marker.remove();
        marker = new maplibregl.Marker({ color: '#72B04D' })
            .setLngLat([lng, lat])
            .addTo(mapPicker);
        mapPicker.flyTo({ center: [lng, lat], zoom: 14 });
    }

    async function loadSedesDropdown() {
        const select = document.getElementById('input-lugar-id');
        if (!select) return;
        
        // Fetch only basic logic needed
        const { data: lugares } = await supabase.from('lugares').select('id, nombre, lat, lng, ubicacion').order('nombre');
        window.sysLugaresCache = lugares || [];
        
        select.innerHTML = '<option value="">No (Será una ubicación independiente)</option>';
        if (lugares) {
            lugares.forEach(l => {
                select.innerHTML += `<option value="${l.id}">${l.nombre}</option>`;
            });
        }
    }

    async function cargarDatos(filter = 'all') {
        const tbody = document.getElementById('tabla-registros');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">Actualizando datos...</td></tr>';

        try {
            let allEventos = [];
            let allLugares = [];

            // Actores solo ven sus propios registros
            const isActor = profile.rol === 'actor';
            const ownerFilter = isActor ? { column: 'owner_id', value: session.user.id } : null;

            if (filter === 'all' || filter === 'evento') {
                let q = supabase.from('eventos').select('*').order('created_at', { ascending: false });
                if (ownerFilter) q = q.eq(ownerFilter.column, ownerFilter.value);
                const { data: ev, error: evErr } = await q;
                if (evErr) console.error('Error eventos:', evErr);
                if (ev) allEventos = ev;
            }
            if (filter === 'all' || filter === 'lugar') {
                let q = supabase.from('lugares').select('*').order('created_at', { ascending: false });
                if (ownerFilter) q = q.eq(ownerFilter.column, ownerFilter.value);
                const { data: lu, error: luErr } = await q;
                if (luErr) console.error('Error lugares:', luErr);
                if (lu) allLugares = lu;
            }

            // Actualizar contadores del dashboard
            const statEventos = document.getElementById('stat-eventos');
            const statLugares = document.getElementById('stat-lugares');
            const statUsuarios = document.getElementById('stat-usuarios');
            if (statEventos) statEventos.textContent = allEventos.length;
            if (statLugares) statLugares.textContent = allLugares.length;

            let allPerfiles = [];
            if (filter === 'perfiles' && profile.rol === 'admin') {
                const { data: pr } = await supabase.from('perfiles').select('*').order('created_at', { ascending: false });
                if (pr) allPerfiles = pr;
                if (statUsuarios) statUsuarios.textContent = pr?.filter(p => p.rol === 'admin').length || 0;
            } else if (filter === 'all' && profile.rol === 'admin') {
                const { count } = await supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'admin');
                if (statUsuarios) statUsuarios.textContent = count || 0;
            }

            let all = [
                ...allEventos.map(x => ({...x, tipo_orig: 'evento'})),
                ...allLugares.map(x => ({...x, tipo_orig: 'lugar'})),
                ...allPerfiles.map(x => ({...x, nombre: x.nombre_usuario || x.email || 'Sin nombre', categoria: x.rol, tipo_orig: 'perfiles'}))
            ];

            tbody.innerHTML = '';
            if (all.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">No hay registros en esta sección.</td></tr>';
                return;
            }

            all.forEach(item => {
                const isOwner = item.owner_id === session.user.id || profile.rol === 'admin';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${item.nombre}</strong></td>
                    <td>${item.categoria || '--'}</td>
                    <td><span class="badge" style="background: rgba(114, 176, 77, 0.2); color: var(--color-eco); border: 1px solid var(--color-eco);">activo</span></td>
                    <td>
                        ${isOwner && item.tipo_orig !== 'perfiles' ? `
                        <button class="btn-admin" onclick="window.editarRegistro('${item.id}', '${item.tipo_orig}')" 
                            style="background: transparent; color: #5bc2f7; border: none; cursor: pointer; font-size: 1.1rem; margin-right: 6px;" title="Editar">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>` : ''}
                        ${isOwner ? `
                        <button class="btn-admin" onclick="window.eliminarRegistro('${item.id}', '${item.tipo_orig}')" 
                            style="background: transparent; color: #ff5252; border: none; cursor: pointer; font-size: 1.1rem;" title="Eliminar">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error cargando datos:', error);
        }
    }

    // --- EDITAR REGISTRO ---
    window.editarRegistro = async function(id, tipo) {
        const table = tipo === 'evento' ? 'eventos' : 'lugares';
        const { data: item, error } = await supabase.from(table).select('*').eq('id', id).single();
        if (error || !item) { alert('Error al cargar el registro.'); return; }

        // Guardar el ID en edición en el formulario
        formNuevo.dataset.editingId = id;
        formNuevo.dataset.editingTable = table;

        // Reseteo previo de visuales por si acaso
        document.querySelectorAll('.btn-categoria').forEach(b => {
             b.classList.remove('active'); b.style.background = 'rgba(0,0,0,0.3)';
        });

        // Pre-rellenar el formulario
        document.getElementById('input-tipo').value = tipo;
        
        // Activar botón visual correcto
        const targetBtn = document.querySelector(`.btn-categoria[data-cat="${tipo}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
            targetBtn.style.background = 'var(--color-eco)';
        }

        // Cargar dropdown por si acaso y asignar
        await loadSedesDropdown();
        const sedeSection = document.getElementById('sede-section');
        if (tipo === 'evento') {
            if (sedeSection) sedeSection.style.display = 'block';
            document.getElementById('input-lugar-id').value = item.lugar_id || '';
        } else {
            if (sedeSection) sedeSection.style.display = 'none';
        }

        document.getElementById('input-nombre').value = item.nombre || '';
        document.getElementById('input-categoria').value = item.categoria || '';
        document.getElementById('input-ubicacion').value = item.ubicacion || '';
        document.getElementById('input-descripcion').value = item.descripcion || '';
        
        if (item.fecha_inicio) {
            // Convert to YYYY-MM-DDTHH:mm for datetime-local
            const dInicio = new Date(item.fecha_inicio);
            dInicio.setMinutes(dInicio.getMinutes() - dInicio.getTimezoneOffset());
            document.getElementById('input-fecha-inicio').value = dInicio.toISOString().slice(0, 16);
        } else {
            document.getElementById('input-fecha-inicio').value = '';
        }
        
        if (item.fecha_fin) {
            const dFin = new Date(item.fecha_fin);
            dFin.setMinutes(dFin.getMinutes() - dFin.getTimezoneOffset());
            document.getElementById('input-fecha-fin').value = dFin.toISOString().slice(0, 16);
        } else {
            document.getElementById('input-fecha-fin').value = '';
        }

        if (item.lat) document.getElementById('input-lat').value = item.lat;
        if (item.lng) document.getElementById('input-lng').value = item.lng;

        // Dynamic fields for Editing
        const isEditLugar = tipo === 'lugar';
        document.getElementById('label-categoria').innerText = isEditLugar ? 'Tipo de Espacio' : 'Categoría';
        document.getElementById('container-categoria-evento').style.display = isEditLugar ? 'none' : 'block';
        document.getElementById('container-categoria-lugar').style.display = isEditLugar ? 'block' : 'none';
        document.getElementById('section-fechas').style.display = isEditLugar ? 'none' : 'grid';
        document.getElementById('section-sede').style.display = isEditLugar ? 'none' : 'block';
        document.getElementById('section-registro').style.display = isEditLugar ? 'none' : 'block';

        if (isEditLugar) {
            document.getElementById('input-categoria-libre').value = item.categoria || '';
        } else {
            document.getElementById('input-categoria').value = item.categoria || '';
        }
        
        // Redes Sociales
        // Primero ocultar todos y quitar bordes para evitar residuos de ediciones anteriores
        document.querySelectorAll('.btn-sn-toggle').forEach(b => b.style.border = 'none');
        document.querySelectorAll('.sn-input-group').forEach(g => g.style.display = 'none');

        const snKeys = { 
            fb: item.social_fb, 
            ig: item.social_ig, 
            wa: item.social_wa, 
            x: item.social_x, 
            yt: item.social_yt,
            web: item.social_web
        };

        Object.keys(snKeys).forEach(key => {
            const btn = document.querySelector(`.btn-sn-toggle[data-sn="${key}"]`);
            const group = document.getElementById(`input-group-${key}`);
            const input = document.getElementById(`input-${key}`);

            if (snKeys[key]) {
                input.value = snKeys[key];
                if (group) group.style.display = 'flex';
                if (btn) {
                    const activeColor = btn.dataset.color;
                    btn.style.background = activeColor;
                    btn.style.color = 'white';
                    btn.style.boxShadow = `0 4px 15px ${activeColor.includes('gradient') ? 'rgba(214, 41, 118, 0.4)' : activeColor + '66'}`;
                    btn.classList.replace('sn-off', 'sn-on');
                }
            } else {
                input.value = '';
                if (group) group.style.display = 'none';
                if (btn) {
                    btn.style.background = 'rgba(255,255,255,0.05)';
                    btn.style.color = 'rgba(255,255,255,0.4)';
                    btn.style.boxShadow = 'none';
                    btn.classList.add('sn-off');
                }
            }
        });

        document.getElementById('input-reg-link').value = item.reg_link || '';

        // Cambiar título del modal y botón
        document.querySelector('#modal-nuevo h2').textContent = 'Editar Registro';
        const btnSubmit = formNuevo.querySelector('button[type="submit"]');
        btnSubmit.textContent = 'Guardar Cambios';

        modalNuevo.style.display = 'flex';
        initMapPicker();
        if (item.lat && item.lng) updatePickerMarker(item.lat, item.lng);
    };

    window.eliminarRegistro = async function(id, tipo) {
        if (!confirm('¿Seguro que deseas eliminar este registro?')) return;
        const table = (tipo === 'evento') ? 'eventos' : (tipo === 'lugar' ? 'lugares' : 'perfiles');
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else cargarDatos(currentAdminFilter);
    };
});
