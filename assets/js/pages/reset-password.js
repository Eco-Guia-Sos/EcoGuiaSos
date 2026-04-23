/* assets/js/pages/reset-password.js */
import { supabase } from '../supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar partículas (opcional, igual que auth.html)
    if (window.particlesJS) {
        particlesJS.load('particles-js', '../assets/js/particles-config.json');
    }

    const formRequest = document.getElementById('form-reset-request');
    const formNewPass = document.getElementById('form-new-password');
    const stepRequest = document.getElementById('step-request');
    const stepUpdate = document.getElementById('step-update');
    const stepSuccess = document.getElementById('step-success');

    // 1. Detectar si el usuario viene de un correo de recuperación
    // Supabase detecta el fragmento en la URL y dispara un evento de auth
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            console.log('[Reset] Modo recuperación de contraseña activado');
            stepRequest.classList.remove('active');
            stepUpdate.classList.add('active');
        }
    });

    // 2. Manejar solicitud de enlace (Paso 1)
    if (formRequest) {
        formRequest.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('reset-email').value;
            const btn = e.target.querySelector('button');
            
            btn.disabled = true;
            btn.innerText = 'Enviando...';

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/pages/reset-password.html`,
            });

            if (error) {
                alert('Error: ' + error.message);
                btn.disabled = false;
                btn.innerText = 'Enviar enlace';
            } else {
                stepRequest.classList.remove('active');
                stepSuccess.classList.add('active');
                document.getElementById('success-title').innerText = '¡Enlace enviado!';
                document.getElementById('success-msg').innerText = `Hemos enviado instrucciones a ${email}. No olvides revisar tu carpeta de spam.`;
            }
        });
    }

    // 3. Manejar actualización de contraseña (Paso 2)
    if (formNewPass) {
        formNewPass.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const btn = e.target.querySelector('button');

            if (newPassword !== confirmPassword) {
                alert('Las contraseñas no coinciden.');
                return;
            }

            btn.disabled = true;
            btn.innerText = 'Actualizando...';

            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) {
                alert('Error al actualizar: ' + error.message);
                btn.disabled = false;
                btn.innerText = 'Actualizar contraseña';
            } else {
                stepUpdate.classList.remove('active');
                stepSuccess.classList.add('active');
                document.getElementById('success-title').innerText = '¡Éxito!';
                document.getElementById('success-msg').innerText = 'Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión.';
            }
        });
    }
});
