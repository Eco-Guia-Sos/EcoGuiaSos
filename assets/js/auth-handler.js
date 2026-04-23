/* assets/js/auth-handler.js */
import { supabase } from './supabase.js';

const formLogin = document.getElementById('form-login');
const formSignup = document.getElementById('form-signup');
const formActor = document.getElementById('form-actor-request');
const authMessage = document.getElementById('auth-message');

const showMessage = (msg, type = 'error') => {
    authMessage.textContent = msg;
    authMessage.className = `auth-message ${type}`;
    authMessage.style.display = 'block';
};

// --- LOGICA DE SELECTOR DE REDES SOCIALES ---
const setupSocialSelector = (formType) => {
    const selector = document.querySelector(`.social-selector[data-form="${formType}"]`);
    const container = document.getElementById(`${formType}-social-inputs`);
    
    if (!selector || !container) return;

    selector.addEventListener('click', (e) => {
        const btn = e.target.closest('.social-btn');
        if (!btn) return;

        const network = btn.dataset.net;
        const iconClass = btn.querySelector('i').className;

        if (btn.classList.contains('active')) {
            // Quitar red
            btn.classList.remove('active');
            const row = container.querySelector(`[data-net="${network}"]`);
            if (row) row.remove();
        } else {
            // Añadir red
            btn.classList.add('active');
            const div = document.createElement('div');
            div.className = 'social-input-group';
            div.dataset.net = network;
            div.innerHTML = `
                <label title="${network}"><i class="${iconClass}"></i></label>
                <input type="text" placeholder="URL o usuario de ${network}" data-net="${network}" required>
            `;
            container.appendChild(div);
        }
    });
};

setupSocialSelector('signup');
setupSocialSelector('actor');

const getSocialData = (formType) => {
    const inputs = document.querySelectorAll(`#${formType}-social-inputs input`);
    return Array.from(inputs)
        .map(input => `${input.dataset.net}: ${input.value}`)
        .join(' | ');
};

// 1. Manejo de Registro (Voluntario)
if (formSignup) {
    formSignup.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const phone = document.getElementById('reg-phone').value;
        const socialLinks = getSocialData('signup');

        const btn = formSignup.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Registrando...';

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nombre_completo: fullName,
                        telefono: phone,
                        redes_sociales: socialLinks
                    }
                }
            });

            if (error) throw error;
            showMessage('¡Registro exitoso! Revisa tu email para confirmar.', 'success');
            formSignup.reset();
            document.querySelectorAll('.social-inputs-container').forEach(c => c.innerHTML = '');
            document.querySelectorAll('.social-btn').forEach(b => b.classList.remove('active'));
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Crear Cuenta';
        }
    });
}

// 2. Manejo de Inicio de Sesión (Sign In)
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const btn = formLogin.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Entrando...';

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            showMessage('Sesión iniciada. Redirigiendo...', 'success');
            setTimeout(() => window.location.href = 'index.html', 1500);
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Entrar';
        }
    });
}

// 3. Manejo de Solicitud de Actor (REGISTRO + SOLICITUD)
if (formActor) {
    formActor.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = formActor.querySelector('button');
        
        const fullName = document.getElementById('actor-name').value;
        const email = document.getElementById('actor-email').value;
        const phone = document.getElementById('actor-phone').value;
        const password = document.getElementById('actor-password').value;
        const bio = document.getElementById('actor-bio').value;
        const socialLinks = getSocialData('actor');

        // Validar mínimos
        if (!socialLinks) {
            showMessage('Debes añadir al menos una red social para ser Actor.', 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Procesando tu alta...';

        try {
            // Obtener sesión actual para ver si ya está logueado
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            let userId = currentSession?.user?.id;
            let authData = { user: currentSession?.user };

            if (!userId) {
                // A. Registrar Cuenta de Usuario en Auth solo si no hay sesión
                const { data, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            nombre_completo: fullName,
                            telefono: phone,
                            rol: 'user' // Inicia como user hasta ser aprobado
                        }
                    }
                });
                if (authError) throw authError;
                authData = data;
                userId = data.user.id;
            } else {
                console.log('[Auth] Usuario ya logueado, saltando registro de Auth. ID:', userId);
            }

            if (!userId) throw new Error("No se pudo obtener el ID de usuario.");

            // B. Asegurar registro en tabla 'perfiles' (si el trigger de Auth no lo hizo)
            const { error: profileError } = await supabase
                .from('perfiles')
                .upsert({
                    id: authData.user.id,
                    nombre_completo: fullName,
                    email: email,
                    telefono: phone,
                    rol: 'user'
                });

            if (profileError) console.warn("Aviso: No se pudo crear perfil manual, posiblemente ya existe vía Trigger.");

            // C. Guardar Solicitud Detallada vinculando el ID de usuario
            const { error: dbError } = await supabase
                .from('solicitudes_actores')
                .insert([{
                    usuario_id: authData.user.id, // VÍNCULO CRÍTICO
                    nombre_completo: fullName,
                    email: email,
                    telefono: phone,
                    redes_sociales: socialLinks,
                    biografia: bio,
                    estado: 'pendiente'
                }]);

            if (dbError) throw dbError;

            showMessage('¡Cuenta creada y solicitud enviada! Revisa tu email.', 'success');
            
            // D. Abrir WhatsApp para validación
            setTimeout(() => {
                const waMessage = encodeURIComponent(`¡Hola! Soy ${fullName}. Acabo de enviar mi solicitud como Actor en EcoGuía SOS. Mi correo es ${email}.`);
                window.open(`https://wa.me/525540149022?text=${waMessage}`, '_blank');
                formActor.reset();
            }, 2000);
            
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enviar Solicitud';
        }
    });
}
