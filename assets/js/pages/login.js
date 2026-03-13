/* assets/js/pages/login.js */
import { supabase } from '../supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const errorAlert = document.getElementById('login-error');

    // Comprobar si ya está logeado
    verificarSesion();

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // Estado de carga
        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...';
        loginBtn.disabled = true;
        errorAlert.style.display = 'none';

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            // Login exitoso, redirigir al panel
            window.location.href = '/admin.html';
        } catch (error) {
            console.error('Error de login:', error.message);
            errorAlert.textContent = 'Correo o contraseña incorrectos.';
            errorAlert.style.display = 'block';
        } finally {
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    });

    async function verificarSesion() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            window.location.href = '/admin.html'; // Si ya está logueado, mandarlo al admin
        }
    }
});
