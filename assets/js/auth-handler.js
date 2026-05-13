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

// --- LOGICA DE IMAGEN DE PERFIL ---
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500; // Avatares no necesitan ser tan grandes
                const MAX_HEIGHT = 500;
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

                // Recortar al cuadrado si queremos (opcional, por ahora solo dimensionamos)
                const size = Math.min(width, height);
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                
                // Centrar la imagen en el cuadrado
                const offsetX = (width - size) / 2;
                const offsetY = (height - size) / 2;
                
                ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);
                
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/webp', 0.8);
            };
        };
        reader.onerror = error => reject(error);
    });
}

async function uploadAvatar(file) {
    if (!file) return null;
    try {
        const compressedBlob = await compressImage(file);
        const fileName = `avatares/perfil_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
        const { error: uploadError } = await supabase.storage.from('imagenes-plataforma').upload(fileName, compressedBlob, { upsert: false });
        if (uploadError) {
            console.error('[Auth] Error subiendo avatar:', uploadError);
            return null; // Fallback silently
        }
        const { data } = supabase.storage.from('imagenes-plataforma').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (err) {
        console.error('[Auth] Excepción subiendo avatar:', err);
        return null;
    }
}

const setupAvatarPreview = (inputId, previewId) => {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                let img = preview.querySelector('img');
                if (!img) {
                    img = document.createElement('img');
                    preview.appendChild(img);
                }
                img.src = e.target.result;
                
                // Añadir overlay de edición si no existe
                if (!preview.querySelector('.overlay-edit')) {
                    const overlay = document.createElement('div');
                    overlay.className = 'overlay-edit';
                    overlay.innerHTML = '<i class="fa-solid fa-pen" style="font-size: 0.6rem; margin:0;"></i>';
                    preview.appendChild(overlay);
                }
            };
            reader.readAsDataURL(file);
        }
    });
};

setupAvatarPreview('reg-avatar', 'reg-avatar-preview');
setupAvatarPreview('actor-avatar', 'actor-avatar-preview');


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
        btn.textContent = 'Procesando...';

        try {
            // 1. Subir Avatar si existe
            const avatarFile = document.getElementById('reg-avatar').files[0];
            let avatarUrl = null;
            if (avatarFile) {
                btn.textContent = 'Subiendo foto...';
                avatarUrl = await uploadAvatar(avatarFile);
            }

            btn.textContent = 'Registrando...';
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nombre_completo: fullName,
                        telefono: phone,
                        redes_sociales: socialLinks,
                        avatar_url: avatarUrl // Incluir URL del avatar en metadatos
                    }
                }
            });

            if (error) throw error;
            showMessage('¡Registro exitoso! Revisa tu email para confirmar.', 'success');
            formSignup.reset();
            const previewImg = document.querySelector('#reg-avatar-preview img');
            if(previewImg) previewImg.remove();
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
        btn.textContent = 'Preparando...';

        try {
            // 1. Subir Avatar si existe
            const avatarFile = document.getElementById('actor-avatar').files[0];
            let avatarUrl = null;
            if (avatarFile) {
                btn.textContent = 'Subiendo logo/foto...';
                avatarUrl = await uploadAvatar(avatarFile);
            }

            btn.textContent = 'Procesando tu alta...';

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
                            rol: 'user', // Inicia como user hasta ser aprobado
                            avatar_url: avatarUrl // Guardar avatar en metadata
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

            // B. Asegurar registro en tabla 'perfiles' con los datos completos del actor
            
            // Construir objeto de redes sociales
            const links = {};
            document.querySelectorAll('#actor-social-inputs input').forEach(input => {
                const net = input.dataset.net;
                if(net === 'Facebook') links.facebook = input.value;
                if(net === 'Instagram') links.instagram = input.value;
                if(net === 'X') links.twitter = input.value;
            });

            const { error: profileError } = await supabase
                .from('perfiles')
                .upsert({
                    id: authData.user.id,
                    nombre_completo: fullName,
                    email: email, // Guardamos el correo explícitamente para el panel
                    telefono: phone,
                    rol: 'user', // Debe iniciar como 'user' hasta que el admin lo apruebe
                    actor_status: 'pending', // Marca de solicitud activa para el panel
                    bio: bio,
                    links_sociales: links,
                    avatar_url: avatarUrl || currentSession?.user?.user_metadata?.avatar_url
                });

            if (profileError) {
                console.warn("Aviso: No se pudo crear perfil manual, error:", profileError);
                throw new Error("No se pudo guardar el perfil de actor.");
            }

            // Ya no insertamos en solicitudes_actores porque el panel de moderación usa 'perfiles'

            showMessage('¡Cuenta creada y solicitud enviada! Revisa tu email.', 'success');
            
            // D. Abrir WhatsApp para validación
            setTimeout(() => {
                const waMessage = encodeURIComponent(`¡Hola! Soy ${fullName}. Acabo de enviar mi solicitud como Actor en EcoGuía SOS. Mi correo es ${email}.`);
                window.open(`https://wa.me/525540149022?text=${waMessage}`, '_blank');
                formActor.reset();
                const previewImg = document.querySelector('#actor-avatar-preview img');
                if(previewImg) previewImg.remove();
            }, 2000);
            
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enviar Solicitud';
        }
    });
}
