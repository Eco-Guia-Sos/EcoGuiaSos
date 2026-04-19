/* assets/js/ui-utils.js */
import { supabase } from './supabase.js';

// Common UI behaviors like Navbar toggling

export function setupNavbar() {
    const hamburger = document.querySelector('.hamburger-menu');
    const navMenu = document.getElementById('nav-menu-list');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const icon = hamburger.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-xmark');
            }
        });
    }
}

export function showLoader(containerId, message = 'Buscando información...') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="loader-text">
                <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
                <p>${message}</p>
            </div>
        `;
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
            
            // 1. Mostrar nombre INMEDIATAMENTE desde metadata local
            let greetingName = meta.nombre_completo?.split(' ')[0]
                                || meta.full_name?.split(' ')[0] 
                                || meta.name?.split(' ')[0]
                                || user.email.split('@')[0];

            user.role_assigned = meta.rol || meta.role || 'user';

            authBtn.innerHTML = `<i class="fa-solid fa-user-circle"></i> ${greetingName} <i class="fa-solid fa-chevron-down" style="font-size:0.7rem; margin-left:5px;"></i>`;
            authBtn.classList.add('nav-user-dropdown-btn');
            authBtn.href = "#";

            // 2. Activar dropdown INMEDIATAMENTE (antes de consultar DB)
            setupUserDropdown(authBtn, user);
            console.log('[Auth] ✅ UI y dropdown listos. Nombre:', greetingName);

            // Ocultar el botón "Iniciar sesión" si ya hay sesión iniciada
            const loginBtn = document.getElementById('nav-login-btn');
            if (loginBtn) loginBtn.style.display = 'none';

            // 3. Enriquecer con datos de DB en segundo plano (no bloquea UI)
            supabase
                .from('perfiles')
                .select('nombre_completo, rol')
                .eq('id', user.id)
                .single()
                .then(({ data: profile, error }) => {
                    if (!error && profile) {
                        console.log('[Auth] Perfil DB cargado. Rol:', profile.rol);
                        if (profile.nombre_completo) {
                            const dbName = profile.nombre_completo.split(' ')[0];
                            authBtn.innerHTML = `<i class="fa-solid fa-user-circle"></i> ${dbName} <i class="fa-solid fa-chevron-down" style="font-size:0.7rem; margin-left:5px;"></i>`;
                        }
                        if (profile.rol && profile.rol !== user.role_assigned) {
                            user.role_assigned = profile.rol;
                            setupUserDropdown(authBtn, user); // Re-crear con rol correcto
                        }
                    }
                })
                .catch(err => console.warn('[Auth] DB perfil fetch falló:', err));
        } else {
            console.log('[Auth] Sin sesión - mostrando botón Súmate');
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

function setupUserDropdown(authBtn, user) {
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
                <i class="fa-solid fa-circle-user"></i>
            </div>
            <div class="user-info-text">
                <span class="user-display-name">Hola de nuevo</span>
                <span class="user-email-text">${user.email}</span>
            </div>
        </div>
        <div class="dropdown-divider"></div>
    `;

    // ROLE CHECK: Only show "Mi Panel" (Admin) if role is 'actor' or 'admin'
    const role = user.role_assigned || 'public';
    const isAdmin = (role === 'actor' || role === 'admin');

    dropdown.innerHTML = `
        ${userHeader}
        ${isAdmin ? `
            <a href="/admin.html" class="dropdown-item">
                <i class="fa-solid fa-gauge-high"></i> Mi Panel
            </a>
        ` : ''}
        <a href="/pages/mis-favoritos.html" class="dropdown-item">
            <i class="fa-solid fa-star"></i> Mis Favoritos
        </a>
        <div class="dropdown-divider"></div>
        <a href="#" onclick="handleMainLogout(event)" class="dropdown-item logout">
            <i class="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
        </a>
    `;

    document.body.appendChild(dropdown);

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
        const keysToRemove = [];
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

