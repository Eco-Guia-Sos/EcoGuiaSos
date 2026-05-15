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

let _authObserverRegistered = false;
let _profileFetchCounter = 0;
let _resolvedDbRole = null;
let _lastResolvedUserId = null;

export function setupAuthObserver() {
    if (_authObserverRegistered) {
        console.log('[Auth] setupAuthObserver ya estaba iniciado, ignorando.');
        return;
    }
    _authObserverRegistered = true;
    console.log('[Auth] setupAuthObserver iniciado (v.stabilization-profile)');
    
    let authBtn = document.getElementById('nav-auth-btn') || document.querySelector('.nav-btn-highlight');
    
    const isSubpage = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/forms/');

    const updateAuthUI = async (session) => {
        const userEmail = session && session.user ? session.user.email : 'NULL';
        console.log(`[Auth] updateAuthUI llamado. Usuario: ${userEmail}`);
        
        if (!authBtn) {
            authBtn = document.getElementById('nav-auth-btn') || document.querySelector('.nav-btn-highlight');
            if (!authBtn) return;
        }

        if (session && session.user) {
            const user = session.user;
            const meta = user.user_metadata || {};
            
            // 1. Recuperar de LocalStorage para evitar parpadeos
            const cachedName = localStorage.getItem('eco_user_name');
            const cachedRole = localStorage.getItem('eco_user_role');
            const cachedAvatar = localStorage.getItem('eco_user_avatar');
            
            // 2. Determinar estado inicial (Preferir Cache -> Metadata -> Fallback)
            const initialRole = _resolvedDbRole || cachedRole || meta.rol || meta.role || 'user';
            user.role_assigned = initialRole;
            user.avatar_url = cachedAvatar || meta.avatar_url;
            
            let rawName = meta.nombre_completo || meta.full_name || meta.name || user.email.split('@')[0];
            let greetingName = (rawName.includes('@') ? rawName.split('@')[0] : rawName).split(' ')[0];
            const displayName = cachedName || greetingName;

            console.log(`[Auth] UI Inicial: ${displayName} (${initialRole}) - Cache: ${!!cachedRole} - DbRole: ${_resolvedDbRole}`);

            // 3. Renderizado Visual Inmediato
            authBtn.innerHTML = `<i data-lucide="user"></i> ${displayName} <i data-lucide="chevron-down" style="width:14px; height:14px; margin-left:5px;"></i>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            authBtn.classList.add('nav-user-dropdown-btn');
            authBtn.href = "#";

            // Inyectar el dropdown con los datos actuales
            setupUserDropdown(authBtn, user, displayName);

            // Componentes adicionales
            setupNotifications(user.id, session.access_token);
            const loginBtn = document.getElementById('nav-login-btn');
            if (loginBtn) loginBtn.style.display = 'none';

            // 4. Sincronización con DB (Solo si el usuario cambió o no tenemos rol resuelto)
            if (user.id !== _lastResolvedUserId || !_resolvedDbRole) {
                _lastResolvedUserId = user.id;
                const thisCallId = ++_profileFetchCounter;
                
                console.log(`[Auth] Iniciando fetch de perfil DB (callId: ${thisCallId})...`);

                const fetchProfileWithTimeout = async () => {
                    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout DB')), 3000));
                    
                    const sdkCall = (async () => {
                        try {
                            const { data, error } = await supabase.from('perfiles').select('nombre_completo,rol,avatar_url').eq('id', user.id).maybeSingle();
                            if (!error && data) return data;
                        } catch (e) { console.warn('[Auth] Error SDK:', e); }
                        return null;
                    })();

                    const restCall = (async () => {
                        try {
                            const url = `${supabaseUrl}/rest/v1/perfiles?id=eq.${user.id}&select=nombre_completo,rol,avatar_url`;
                            const res = await fetch(url, {
                                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${session.access_token}` }
                            });
                            if (res.ok) {
                                const list = await res.json();
                                return list.length > 0 ? list[0] : null;
                            }
                        } catch (e) { console.warn('[Auth] Error REST:', e); }
                        return null;
                    })();

                    // Intentar ambos, el que resuelva primero con éxito
                    return Promise.race([sdkCall, restCall, timeout]).catch(err => {
                        console.warn('[Auth] Fallback a REST lento:', err.message);
                        return restCall; // Último intento si el race falla
                    });
                };

                fetchProfileWithTimeout().then(profile => {
                    if (thisCallId !== _profileFetchCounter) return;

                    if (profile) {
                        const detectedRole = (profile.rol || 'user').trim().toLowerCase();
                        _resolvedDbRole = detectedRole;
                        
                        let dbName = displayName; 
                        if (profile.nombre_completo && !profile.nombre_completo.includes('@')) {
                            dbName = profile.nombre_completo.split(' ')[0];
                        }

                        console.log(`[Auth] Datos DB sincronizados: ${dbName} (${detectedRole}) [callId: ${thisCallId}]`);
                        
                        // Guardar en cache para persistencia
                        localStorage.setItem('eco_user_name', dbName);
                        localStorage.setItem('eco_user_role', detectedRole);
                        if (profile.avatar_url) localStorage.setItem('eco_user_avatar', profile.avatar_url);
                        
                        // Re-renderizar si el rol cambió o para asegurar datos finales
                        if (document.body.contains(authBtn)) {
                            user.role_assigned = detectedRole;
                            user.avatar_url = profile.avatar_url;
                            authBtn.innerHTML = `<i data-lucide="user"></i> ${dbName} <i data-lucide="chevron-down" style="width:14px; height:14px; margin-left:5px;"></i>`;
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                            setupUserDropdown(authBtn, user, dbName);
                        }
                    } else {
                        console.log(`[Auth] No se pudo obtener perfil de DB para ${userEmail}`);
                    }
                }).catch(err => console.error('[Auth] Error en flujo de perfil:', err));
            }
        } else {
            // Limpieza por falta de sesión
            _resolvedDbRole = null;
            _lastResolvedUserId = null;
            localStorage.removeItem('eco_user_name');
            localStorage.removeItem('eco_user_role');
            localStorage.removeItem('eco_user_avatar');
            
            authBtn.innerHTML = 'Súmate';
            authBtn.classList.remove('nav-user-dropdown-btn');
            authBtn.href = isSubpage ? '../auth.html?tab=signup' : './auth.html?tab=signup';
            authBtn.onclick = null;
            
            const loginBtn = document.getElementById('nav-login-btn');
            if (loginBtn) loginBtn.style.display = '';
            
            const existingDropdown = document.getElementById('user-dropdown-menu');
            if (existingDropdown) existingDropdown.remove();
        }
    };

    // Registrar observadores
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] Evento onAuthStateChange:', event);
        updateAuthUI(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
        console.log('[Auth] getSession listo');
        updateAuthUI(session);
    });
}

/**
 * Configura el menú desplegable del usuario.
 */
export function setupUserDropdown(authBtn, user, userName) {
    if (!authBtn || !user) return;

    // Remove if already exists to avoid duplicates
    let dropdown = document.getElementById('user-dropdown-menu');
    const wasActive = dropdown && dropdown.classList.contains('active');
    if (dropdown) dropdown.remove();

    dropdown = document.createElement('div');
    dropdown.id = 'user-dropdown-menu';
    dropdown.className = 'user-dropdown-menu';
    if (wasActive) dropdown.classList.add('active');
    
    // User info header
    const avatarUrl = user.avatar_url || localStorage.getItem('eco_user_avatar');
    const userHeader = `
        <div class="dropdown-user-header">
            <div class="user-avatar-small" style="${avatarUrl ? `background-image: url(${avatarUrl}); background-size: cover; background-position: center; border: none;` : ''}">
                ${!avatarUrl ? '<i data-lucide="user"></i>' : ''}
            </div>
            <div class="user-info-text">
                <span class="user-display-name">${userName || 'Hola'}</span>
                <span class="user-email-text">${user.email}</span>
            </div>
        </div>
        <div class="dropdown-divider"></div>
    `;

    // ROLE CHECK: Only show "Mi Panel" (Admin) if role is 'actor' or 'admin'
    const role = (user.role_assigned || localStorage.getItem('eco_user_role') || 'user').trim().toLowerCase();
    const isAdmin = (role === 'actor' || role === 'admin' || (user.email && user.email.toLowerCase() === 'ecoguiasos@gmail.com'));
    
    // Rutas dinámicas basadas en la profundidad de la URL
    const isSubpage = window.location.pathname.includes('/pages/');
    const basePath = isSubpage ? '../' : './';
    const adminPath = `${basePath}admin.html`;
    const favPath = `${basePath}pages/mis-favoritos.html`;
    
    // --- NUEVO: Mi Perfil ahora apunta a la vista pública del actor ---
    const publicProfilePath = `${basePath}pages/agente-detalle.html?actor_id=${user.id}`;

    console.log(`[Auth] Dropdown Render: ${userName} (${role}) - isAdmin: ${isAdmin} - isSubpage: ${isSubpage}`);

    dropdown.innerHTML = `
        ${userHeader}
        ${isAdmin ? `
            <a href="${adminPath}" class="dropdown-item">
                <i data-lucide="layout-dashboard"></i> Mi Panel
            </a>
            <a href="${publicProfilePath}" class="dropdown-item">
                <i data-lucide="user-circle"></i> Mi Perfil
            </a>
        ` : `
            <a href="${publicProfilePath}" class="dropdown-item">
                <i data-lucide="user-circle"></i> Mi Perfil
            </a>
        `}
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

    // Re-posicionar si ya estaba activo
    if (wasActive) {
        const rect = authBtn.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + 10}px`;
        if (window.innerWidth < 768) {
            dropdown.style.left = '50%';
            dropdown.style.transform = 'translate(-50%, 0)';
        } else {
            dropdown.style.left = `${rect.right - 220}px`;
            dropdown.style.transform = 'none';
        }
    }

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
        const keysToRemove = ['eco_user_role', 'eco_user_name', 'eco_user_avatar'];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Borrar cualquier llave de Supabase (por defecto o nuestra custom)
            if (key && (key.includes('supabase') || key.includes('sb-') || key === 'ecoguia-auth-token')) {
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
async function setupNotifications(userId, accessToken) {
    const navMenu = document.getElementById('nav-menu-list');
    if (!navMenu) return;

    // 1. Inyectar estilos para el dropdown (Responsive)
    if (!document.getElementById('notif-styles')) {
        const style = document.createElement('style');
        style.id = 'notif-styles';
        style.innerHTML = `
            .nav-notif-container { position: relative; }
            .notif-dropdown {
                position: absolute;
                top: 100%;
                right: 0;
                width: 320px;
                background: #111827;
                border: 1px solid #374151;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                margin-top: 10px;
                z-index: 1000;
                overflow: hidden;
            }
            .notif-dropdown.hidden { display: none; }
            .notif-dropdown-header {
                padding: 12px 15px;
                border-bottom: 1px solid #374151;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(255,255,255,0.03);
            }
            .notif-dropdown-header span { font-weight: 600; font-size: 0.9rem; color: #f9fafb; }
            .notif-dropdown-header button { 
                background: none; border: none; color: #10b981; 
                font-size: 0.75rem; cursor: pointer; padding: 0;
            }
            .notif-dropdown-body { max-height: 350px; overflow-y: auto; }
            .notif-item-mini {
                padding: 12px 15px;
                border-bottom: 1px solid #1f2937;
                display: flex;
                gap: 12px;
                cursor: pointer;
                transition: background 0.2s;
            }
            .notif-item-mini:hover { background: #1f2937; }
            .notif-item-mini.nueva { background: rgba(16, 185, 129, 0.05); }
            .notif-dot { 
                width: 8px; height: 8px; border-radius: 50%; 
                background: #10b981; flex-shrink: 0; margin-top: 5px;
            }
            .notif-item-mini.leida .notif-dot { opacity: 0; }
            .notif-content h5 { margin: 0 0 4px 0; font-size: 0.85rem; color: #f3f4f6; }
            .notif-content p { margin: 0 0 6px 0; font-size: 0.75rem; color: #9ca3af; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .notif-content span { font-size: 0.65rem; color: #6b7280; }
            .notif-empty { padding: 30px; text-align: center; color: #6b7280; font-size: 0.8rem; }

            @media (max-width: 480px) {
                .notif-dropdown {
                    position: fixed;
                    top: 70px;
                    left: 10px;
                    right: 10px;
                    width: calc(100% - 20px);
                    max-height: calc(100vh - 100px);
                }
                
                /* Ajustes para el Modal en móviles */
                #global-notif-modal .modal-content {
                    width: 92% !important;
                    margin: 20px auto !important;
                    border-radius: 16px !important;
                    padding: 0 !important;
                }
                #global-notif-modal .modal-body {
                    padding: 20px 15px !important;
                }
                #global-notif-modal #gn-message {
                    font-size: 1rem !important;
                    line-height: 1.5;
                }
                #global-notif-modal .modal-image-container img {
                    max-height: 220px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 2. Crear o buscar la campanita
    let bellContainer = document.getElementById('nav-notif-container');
    if (!bellContainer) {
        bellContainer = document.createElement('div');
        bellContainer.id = 'nav-notif-container';
        bellContainer.className = 'nav-notif-item';
        bellContainer.innerHTML = `
            <a href="#" class="nav-notif-btn" id="notif-bell-btn">
                <i class="fa-solid fa-bell"></i>
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

    // Asegurar que exista el modal global de notificación (ESTILOS INLINE PARA TODAS LAS PÁGINAS)
    if (!document.getElementById('global-notif-modal')) {
        const modalHTML = `
        <div id="global-notif-modal" class="modal-overlay hidden" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 99999; backdrop-filter: blur(5px);">
            <div class="modal-content" style="background: #111827; border: 1px solid #374151; width: 90%; max-width: 450px; text-align: center; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header" style="background: rgba(255,255,255,0.05); padding: 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #374151; flex-shrink: 0;">
                    <h3 id="gn-title" style="margin: 0; font-size: 1.2rem; color: #f9fafb;">Notificación</h3>
                    <button class="close-modal-btn" onclick="document.getElementById('global-notif-modal').classList.add('hidden')" style="background: transparent; border: none; color: #9ca3af; font-size: 1.5rem; cursor: pointer; transition: color 0.3s;">&times;</button>
                </div>
                <div class="modal-body" style="padding: 30px 20px; overflow-y: auto;">
                    <p id="gn-message" style="margin-bottom: 20px; color: #d1d5db; font-size: 1.1rem; line-height: 1.6;"></p>
                    
                    <div id="gn-image-container" style="display: none; margin-bottom: 20px; border-radius: 8px; overflow: hidden; border: 1px solid #374151;">
                        <img id="gn-image" src="" alt="Imagen adjunta" style="max-width: 100%; height: auto; display: block;">
                    </div>

                    <div style="display: flex; gap: 10px; flex-direction: column;">
                        <a id="gn-link" href="#" target="_blank" class="btn btn-primary" style="display: none; width: 100%; border-radius: 12px; padding: 12px; font-weight: 600; text-decoration: none; background: #059669; color: white;">Abrir Enlace</a>
                        <a id="gn-file" href="#" target="_blank" class="btn btn-secondary" style="display: none; width: 100%; border-radius: 12px; padding: 12px; font-weight: 600; text-decoration: none; background-color: #374151; color: white;">Ver Archivo</a>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        console.log('[Notificaciones] 🔔 Modal detectado y listo (Con soporte de imágenes)');
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
            renderNotificacionesList(userId, accessToken, listBody);
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
}

async function renderNotificacionesList(userId, accessToken, container) {
    console.log('[Notificaciones] 🔎 Iniciando renderizado (Fetch Directo) para:', userId);
    container.innerHTML = '<p class="notif-empty">Buscando mensajes...</p>';
    
    try {
        if (!accessToken) {
            container.innerHTML = '<p class="notif-empty">Error de sesión.</p>';
            return;
        }

        const url = `${supabaseUrl}/rest/v1/notificaciones_usuarios?usuario_id=eq.${userId}&select=id,leido,created_at,notificaciones(id,titulo,mensaje,enlace_url,archivo_url)&order=created_at.desc&limit=10`;
        
        const response = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        console.log('[Notificaciones] ✅ Respuesta recibida:', data?.length || 0, 'registros');

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="notif-empty">No tienes notificaciones.</p>';
            return;
        }

        const validNotifs = data.filter(n => n.notificaciones);
        if (validNotifs.length === 0) {
            container.innerHTML = '<p class="notif-empty">No hay mensajes válidos.</p>';
            return;
        }

        container.innerHTML = validNotifs.map(n => {
            const tituloSafe = (n.notificaciones.titulo || 'Notificación').replace(/"/g, "&quot;");
            const mensajeSafe = (n.notificaciones.mensaje || '').replace(/"/g, "&quot;");
            const enlaceSafe = (n.notificaciones.enlace_url || '').replace(/"/g, "&quot;");
            const archivoSafe = (n.notificaciones.archivo_url || '').replace(/"/g, "&quot;");
            
            return `
            <div class="notif-item-mini ${n.leido ? 'leida' : 'nueva'}" 
                 data-id="${n.id}"
                 data-titulo="${tituloSafe}"
                 data-mensaje="${mensajeSafe}"
                 data-enlace="${enlaceSafe}"
                 data-archivo="${archivoSafe}"
                 onclick="window.abrirNotificacionDesdeDataset(this)">
                <div class="notif-dot"></div>
                <div class="notif-content">
                    <h5>${n.notificaciones.titulo || 'Notificación'}</h5>
                    <p>${n.notificaciones.mensaje || ''}</p>
                    <span>${new Date(n.created_at).toLocaleDateString()}</span>
                </div>
            </div>
        `}).join('');

    } catch (err) {
        console.error('[Notificaciones] 💥 Error:', err);
        container.innerHTML = '<p class="notif-empty">Error al cargar mensajes.</p>';
    }
}

window.abrirNotificacionDesdeDataset = async (el) => {
    try {
        const id = el.getAttribute('data-id');
        const titulo = el.getAttribute('data-titulo');
        const mensaje = el.getAttribute('data-mensaje');
        const enlace = el.getAttribute('data-enlace');
        const archivo = el.getAttribute('data-archivo');

        const modal = document.getElementById('global-notif-modal');
        if (!modal) return;

        // 1. Marcar como leída
        if (el.classList.contains('nueva')) {
            el.classList.remove('nueva');
            el.classList.add('leida');
            supabase.from('notificaciones_usuarios').update({ leido: true, leido_at: new Date() }).eq('id', id).then();
            
            const badge = document.getElementById('notif-count-badge');
            if(badge && !badge.classList.contains('hidden')) {
                let count = parseInt(badge.textContent) || 0;
                if(count > 1) badge.textContent = count - 1;
                else badge.classList.add('hidden');
            }
        }

        // 2. Llenar modal
        document.getElementById('gn-title').textContent = titulo;
        document.getElementById('gn-message').textContent = mensaje;
        
        const linkBtn = document.getElementById('gn-link');
        const fileBtn = document.getElementById('gn-file');
        const imgContainer = document.getElementById('gn-image-container');
        const imgElement = document.getElementById('gn-image');

        // Resetear visualización
        linkBtn.style.display = 'none';
        fileBtn.style.display = 'none';
        imgContainer.style.display = 'none';

        // Manejar Enlace
        if (enlace && enlace !== 'null' && enlace.trim() !== '') {
            linkBtn.href = enlace;
            linkBtn.innerHTML = '<i class="fa-solid fa-link"></i> Abrir Enlace';
            linkBtn.style.display = 'block';
        } 
        
        // Manejar Archivo / Imagen
        if (archivo && archivo !== 'null' && archivo.trim() !== '') {
            const isImage = archivo.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i);
            
            if (isImage) {
                imgElement.src = archivo;
                imgContainer.style.display = 'block';
            } else {
                fileBtn.href = archivo;
                fileBtn.innerHTML = '<i class="fa-solid fa-file-arrow-down"></i> Descargar Documento';
                fileBtn.style.display = 'block';
            }
        }
        
        document.getElementById('notif-dropdown').classList.add('hidden');
        modal.classList.remove('hidden');

    } catch (error) {
        console.error('[Notificaciones] 💥 Error al abrir modal:', error);
    }
};

// --- UTILIDADES COMPARTIDAS DE IMAGEN Y STORAGE ---

/**
 * Comprime una imagen a formato WebP conservando relación de aspecto
 */
export async function compressImage(file, maxWidth = 3840, maxHeight = 2160, quality = 0.95) {
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

                // Calcular nuevas dimensiones conservando el aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                // Dibujar la imagen completa en el canvas (sin recortes cuadrados)
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
            };
        };
        reader.onerror = error => reject(error);
    });
}

/**
 * Sube una imagen al bucket de Supabase
 */
export async function uploadToSupabase(supabaseClient, file, folder = 'avatares') {
    if (!file) return null;
    try {
        // Para avatares usamos un tamaño contenido (500x500)
        const compressedBlob = await compressImage(file, 500, 500, 0.8);
        const fileName = `${folder}/img_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
        const { error: uploadError } = await supabaseClient.storage.from('imagenes-plataforma').upload(fileName, compressedBlob, { upsert: false });
        if (uploadError) throw uploadError;
        const { data } = supabaseClient.storage.from('imagenes-plataforma').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (err) {
        console.error('[Storage] Error subiendo archivo:', err);
        return null;
    }
}
