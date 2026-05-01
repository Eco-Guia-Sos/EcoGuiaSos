/* assets/js/ui-utils.js */
import { supabase, supabaseUrl, supabaseKey } from './supabase.js';

// Common UI behaviors like Navbar toggling

export function setupNavbar() {
    const hamburger = document.querySelector('.hamburger-menu');
    const navMenu = document.getElementById('nav-menu-list');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            // Lucide maneja mejor los cambios reemplazando el atributo data-lucide
            const icon = hamburger.querySelector('i');
            if (icon) {
                const current = icon.getAttribute('data-lucide');
                icon.setAttribute('data-lucide', current === 'menu' ? 'x' : 'menu');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    }
}

export function showLoader(containerId, message = 'Buscando información...') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="loader-text">
                <i data-lucide="loader-2" class="spin"></i>
                <p>${message}</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

export function showEmptyState(containerId, message = 'No hay resultados disponibles.') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<p class="loader-text">${message}</p>`;
    }
}

export function showErrorState(containerId, message = 'Error al cargar los datos.') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<p class="loader-text">${message}</p>`;
    }
}

export function setupAuthObserver() {
    console.log('[Auth] setupAuthObserver iniciado');
    
    let authBtn = document.getElementById('nav-auth-btn') || document.querySelector('.nav-btn-highlight');
    console.log('[Auth] Botón inicial:', authBtn ? `encontrado (${authBtn.textContent.trim()})` : 'NO encontrado');

    const updateAuthUI = async (session) => {
        console.log('[Auth] updateAuthUI llamado. Sesión:', session ? `usuario ${session.user?.email}` : 'NULL');
        
        if (!authBtn) {
            authBtn = document.getElementById('nav-auth-btn') || document.querySelector('.nav-btn-highlight');
            if (!authBtn) return;
        }

        if (session) {
            const user = session.user;
            const meta = user.user_metadata || {};
            
            // 1. Prioridad: Recuperar de LocalStorage para evitar parpadeos
            const cachedName = localStorage.getItem('eco_user_name');
            const cachedRole = localStorage.getItem('eco_user_role');
            
            // 2. Determinar nombre inicial (Metadata -> Email)
            let rawName = meta.nombre_completo || meta.full_name || meta.name || user.email.split('@')[0];
            // Si el nombre parece un email, lo limpiamos
            let greetingName = (rawName.includes('@') ? rawName.split('@')[0] : rawName).split(' ')[0];
            
            // Usar cache si existe, si no, el calculado
            const displayName = cachedName || greetingName;
            user.role_assigned = cachedRole || meta.rol || meta.role || 'user';

            console.log(`[Auth] UI Inicial: ${displayName} (${user.role_assigned}) - Cache: ${!!cachedName}`);

            // Actualizar Botón Nav
            authBtn.innerHTML = `<i data-lucide="user"></i> ${displayName} <i data-lucide="chevron-down" style="width:14px; height:14px; margin-left:5px;"></i>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            authBtn.classList.add('nav-user-dropdown-btn');
            authBtn.href = "#";

            // Activar dropdown
            setupUserDropdown(authBtn, user, displayName);

            // 4. Inicializar Campanita de Notificaciones (NUEVO)
            setupNotifications(user.id);

            // Ocultar el botón "Iniciar sesión"
            const loginBtn = document.getElementById('nav-login-btn');
            if (loginBtn) loginBtn.style.display = 'none';

            // 3. Consulta DB para datos finales (Uso de fetch directo para mayor confiabilidad)
            console.log('[Auth] Iniciando fetch de perfil DB (Directo)...');
            
            const fetchProfile = async () => {
                const url = `${supabaseUrl}/rest/v1/perfiles?id=eq.${user.id}&select=nombre_completo,rol`;
                const response = await fetch(url, {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                return data && data.length > 0 ? data[0] : null;
            };

            fetchProfile()
                .then(profile => {
                    if (profile) {
                        const detectedRole = (profile.rol || 'user').trim().toLowerCase();
                        
                        // Lógica de nombre: NO sobreescribir con email si ya tenemos un nombre real
                        let dbName = displayName; 
                        const isEmailLike = (str) => str && (str.includes('@') || str.includes('+'));
                        
                        if (profile.nombre_completo && !isEmailLike(profile.nombre_completo)) {
                            dbName = profile.nombre_completo.split(' ')[0];
                        } else if (isEmailLike(displayName) && profile.nombre_completo && !isEmailLike(profile.nombre_completo)) {
                            dbName = profile.nombre_completo.split(' ')[0];
                        } 
                        
                        console.log(`[Auth] Datos DB recibidos: ${dbName} (${detectedRole})`);
                        
                        // Guardar en cache para persistencia entre páginas
                        localStorage.setItem('eco_user_name', dbName);
                        localStorage.setItem('eco_user_role', detectedRole);
                        
                        // Si el botón ya no existe en el DOM (navegación rápida), abortar
                        if (!document.body.contains(authBtn)) return;

                        // Actualizar UI si el rol cambió o el nombre es mejor
                        if (dbName !== displayName || detectedRole !== user.role_assigned) {
                            console.log('[Auth] Actualizando UI con datos finales');
                            user.role_assigned = detectedRole;
                            authBtn.innerHTML = `<i data-lucide="user"></i> ${dbName} <i data-lucide="chevron-down" style="width:14px; height:14px; margin-left:5px;"></i>`;
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                            setupUserDropdown(authBtn, user, dbName);
                        }
                    } else {
                        console.warn('[Auth] No se encontró perfil en DB para este ID');
                    }
                })
                .catch(err => {
                    console.error('[Auth] Error recuperando perfil:', err);
                });
        } else {
            console.log('[Auth] Sin sesión - mostrando botón Súmate');
            localStorage.removeItem('eco_user_name');
            localStorage.removeItem('eco_user_role');
            authBtn.innerHTML = 'Súmate';
            authBtn.classList.remove('nav-user-dropdown-btn');
            const isSubpage = window.location.pathname.includes('/pages/');
            authBtn.href = isSubpage ? '../auth.html?tab=signup' : './auth.html?tab=signup';
            authBtn.onclick = null;
            
            // Asegurar que el botón "Iniciar sesión" sea visible si no hay sesión
            const loginBtn = document.getElementById('nav-login-btn');
            if (loginBtn) loginBtn.style.display = '';
            
            const existingDropdown = document.getElementById('user-dropdown-menu');
            if (existingDropdown) existingDropdown.remove();
        }
    };

    // Verificación inicial de sesión
    console.log('[Auth] Llamando getSession...');
    supabase.auth.getSession().then(({ data, error }) => {
        console.log('[Auth] getSession respondió. data.session:', data?.session ? `existe (${data.session.user?.email})` : 'null', 'error:', error?.message);
        updateAuthUI(data?.session || null);
    }).catch(err => {
        console.error('[Auth] getSession lanzó error:', err);
    });

    // Observar cambios de sesión
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] onAuthStateChange evento:', event, 'sesión:', session ? session.user?.email : 'null');
        updateAuthUI(session);
    });
}

function setupUserDropdown(authBtn, user, userName) {
    // Remove if already exists to avoid duplicates
    let dropdown = document.getElementById('user-dropdown-menu');
    if (dropdown) dropdown.remove();

    dropdown = document.createElement('div');
    dropdown.id = 'user-dropdown-menu';
    dropdown.className = 'user-dropdown-menu';
    
    // User info header
    const userHeader = `
        <div class="dropdown-user-header">
            <div class="user-avatar-small">
                <i data-lucide="user"></i>
            </div>
            <div class="user-info-text">
                <span class="user-display-name">${userName || 'Hola'}</span>
                <span class="user-email-text">${user.email}</span>
            </div>
        </div>
        <div class="dropdown-divider"></div>
    `;

    // ROLE CHECK: Only show "Mi Panel" (Admin) if role is 'actor' or 'admin'
    const role = (user.role_assigned || 'public').trim().toLowerCase();
    const isAdmin = (role === 'actor' || role === 'admin' || (user.email && user.email.toLowerCase() === 'ecoguiasos@gmail.com'));
    
    // Rutas dinámicas basadas en la profundidad de la URL
    const isSubpage = window.location.pathname.includes('/pages/');
    const basePath = isSubpage ? '../' : './';
    const adminPath = `${basePath}admin.html`;
    const favPath = `${basePath}pages/mis-favoritos.html`;
    const profilePath = `${basePath}pages/agente-detalle.html?actor_id=${user.id}`;

    console.log(`[Auth] Dropdown: ${userName} (${role}) - isSubpage: ${isSubpage}`);

    dropdown.innerHTML = `
        ${userHeader}
        ${isAdmin ? `
            <a href="${adminPath}" class="dropdown-item">
                <i data-lucide="layout-dashboard"></i> Mi Panel
            </a>
        ` : ''}
        ${(role === 'actor' || role === 'admin') ? `
            <a href="${profilePath}" class="dropdown-item">
                <i data-lucide="user-circle"></i> Mi Perfil
            </a>
        ` : ''}
        <a href="${favPath}" class="dropdown-item">
            <i data-lucide="star"></i> Mis Favoritos
        </a>
        <div class="dropdown-divider"></div>
        <a href="#" onclick="handleMainLogout(event)" class="dropdown-item logout">
            <i data-lucide="log-out"></i> Cerrar Sesión
        </a>
    `;

    document.body.appendChild(dropdown);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    authBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = authBtn.getBoundingClientRect();
        
        if (window.innerWidth < 768) {
            dropdown.style.left = '50%';
            dropdown.style.transform = 'translate(-50%, 0)';
            dropdown.style.top = `${rect.bottom + 10}px`;
        } else {
            dropdown.style.left = `${rect.right - 220}px`;
            dropdown.style.transform = 'none';
            dropdown.style.top = `${rect.bottom + 10}px`;
        }
        dropdown.classList.toggle('active');
    };

    dropdown.onclick = (e) => e.stopPropagation();

    window.addEventListener('click', (e) => {
        if (!authBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

// Función global para manejar el cierre de sesión desde cualquier parte del sitio
window.handleMainLogout = async (e) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    console.log('[Auth] Cerrando sesión y limpiando huellas...');
    
    try {
        // 1. Intentar aviso al servidor (rápido)
        await Promise.race([
            supabase.auth.signOut(),
            new Promise(resolve => setTimeout(resolve, 800)) // Timeout de red
        ]);
    } catch (err) {
        console.warn('[Auth] Error al avisar salida al servidor:', err);
    } finally {
        // 2. PURGA TOTAL de LocalStorage (Lo más importante)
        const keysToRemove = ['eco_user_role', 'eco_user_name'];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Borrar cualquier llave de Supabase (por defecto o nuestra custom)
            if (key.includes('supabase') || key.includes('sb-') || key === 'ecoguia-auth-token') {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        
        console.log('[Auth] ✅ Sesión purgada de este dispositivo.');

        // 3. Redirección limpia al inicio
        window.location.href = '/';
    }
};


/**
 * Sanitiza una cadena de texto para evitar ataques XSS
 * Convierte caracteres especiales en entidades HTML
 * @param {string} str - La cadena a sanitizar
 * @returns {string} - La cadena sanitizada
 */
export function sanitize(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, function(m) { return map[m]; });
}

/**
 * Muestra una notificación tipo Toast
 * @param {string} message - El mensaje a mostrar
 * @param {string} type - 'success', 'error', 'warning'
 */
export function formatearFechaRelativa(fecha) {
    const ahora = new Date();
    const f = new Date(fecha);
    const dif = (ahora - f) / 1000; // segundos

    if (dif < 60) return 'Hace un momento';
    if (dif < 3600) return `Hace ${Math.floor(dif / 60)} min`;
    if (dif < 86400) return `Hace ${Math.floor(dif / 3600)} horas`;
    if (dif < 604800) return `Hace ${Math.floor(dif / 86400)} días`;
    return f.toLocaleDateString();
}

export function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    const colors = {
        success: '#72B04D',
        error: '#e74c3c',
        warning: '#f39c12'
    };
    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-circle'
    };

    toast.className = `toast-notification fade-in`;
    toast.style = `
        background: rgba(15, 20, 25, 0.9);
        backdrop-filter: blur(10px);
        color: white;
        padding: 14px 24px;
        border-radius: 12px;
        border-left: 4px solid ${colors[type]};
        box-shadow: 0 8px 30px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 250px;
        transition: all 0.3s ease;
        font-weight: 500;
    `;

    toast.innerHTML = `
        <i data-lucide="${icons[type]}" style="color: ${colors[type]}; width: 20px; height: 20px;"></i>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
/**
 * Sistema de Notificaciones Global
 */
async function setupNotifications(userId) {
    const navMenu = document.getElementById('nav-menu-list');
    if (!navMenu) return;

    // 1. Crear o buscar la campanita
    let bellContainer = document.getElementById('nav-notif-container');
    if (!bellContainer) {
        bellContainer = document.createElement('div');
        bellContainer.id = 'nav-notif-container';
        bellContainer.className = 'nav-notif-item';
        bellContainer.innerHTML = `
            <a href="#" class="nav-notif-btn" id="notif-bell-btn">
                <i data-lucide="bell"></i>
                <span class="notif-badge hidden" id="notif-count-badge">0</span>
            </a>
            <div class="notif-dropdown hidden" id="notif-dropdown">
                <div class="notif-dropdown-header">
                    <span>Notificaciones</span>
                    <button id="notif-mark-all">Marcar todas</button>
                </div>
                <div class="notif-dropdown-body" id="notif-list-body">
                    <p class="notif-empty">Cargando...</p>
                </div>
            </div>
        `;
        
        // Insertar en nav-container antes del hamburger
        const hamburger = document.querySelector('.hamburger-menu');
        const navContainer = document.querySelector('.nav-container');
        if (hamburger && navContainer) {
            navContainer.insertBefore(bellContainer, hamburger);
        } else if (navMenu) {
            navMenu.appendChild(bellContainer);
        }
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    const bellBtn = document.getElementById('notif-bell-btn');
    const dropdown = document.getElementById('notif-dropdown');
    const badge = document.getElementById('notif-count-badge');
    const listBody = document.getElementById('notif-list-body');

    // Toggle Dropdown
    bellBtn.onclick = (e) => {
        e.preventDefault();
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            renderNotificacionesList(userId, listBody);
        }
    };

    // Cerrar al click afuera
    document.addEventListener('click', (e) => {
        if (!bellContainer.contains(e.target)) dropdown.classList.add('hidden');
    });

    // Actualizar badge inicial
    const updateBadge = async () => {
        const { count, error } = await supabase
            .from('notificaciones_usuarios')
            .select('*', { count: 'exact', head: true })
            .eq('usuario_id', userId)
            .eq('leido', false);
        
        if (!error && count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    };

    updateBadge();
    // Podríamos poner un intervalo o Realtime de Supabase aquí
}

async function renderNotificacionesList(userId, container) {
    container.innerHTML = '<p class="notif-empty">Buscando mensajes...</p>';
    
    try {
        const { data, error } = await supabase
            .from('notificaciones_usuarios')
            .select(`
                id, leido, created_at,
                notificaciones (titulo, mensaje)
            `)
            .eq('usuario_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="notif-empty">No tienes notificaciones.</p>';
            return;
        }

        container.innerHTML = data.map(n => `
            <div class="notif-item-mini ${n.leido ? 'leida' : 'nueva'}" onclick="marcarLeida('${n.id}', this)">
                <div class="notif-dot"></div>
                <div class="notif-content">
                    <h5>${n.notificaciones.titulo}</h5>
                    <p>${n.notificaciones.mensaje}</p>
                    <span>${new Date(n.created_at).toLocaleDateString()}</span>
                </div>
            </div>
        `).join('');

    } catch (err) {
        container.innerHTML = '<p class="notif-empty">Error al cargar.</p>';
    }
}

window.marcarLeida = async (id, el) => {
    await supabase.from('notificaciones_usuarios').update({ leido: true, leido_at: new Date() }).eq('id', id);
    el.classList.remove('nueva');
    el.classList.add('leida');
};
