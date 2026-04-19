/* assets/js/admin-auth.js */
import { supabase } from './supabase.js';

const formAdminLogin = document.getElementById('form-admin-login');
const authMsg = document.getElementById('admin-auth-message');

const showMsg = (msg, type = 'error') => {
    authMsg.textContent = msg;
    authMsg.className = `auth-message ${type}`;
    authMsg.style.display = 'block';
};

if (formAdminLogin) {
    formAdminLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        const btn = formAdminLogin.querySelector('button');

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Accediendo...';

        try {
            const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) throw authError;

            // Verificar rol antes de permitir entrada al panel (Perfil en español)
            const { data: profile, error: profileError } = await supabase
                .from('perfiles')
                .select('rol')
                .eq('id', user.id)
                .single();

            if (profileError || !profile) {
                await supabase.auth.signOut();
                throw new Error('No se encontró un perfil asociado a esta cuenta.');
            }

            if (profile.rol !== 'admin' && profile.rol !== 'actor') {
                await supabase.auth.signOut();
                throw new Error('No tienes permisos de administrador.');
            }

            // Redirigir al panel
            showMsg('Acceso concedido. Entrando al panel...', 'success');
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1000);

        } catch (error) {
            showMsg(error.message, 'error');
            console.error('Admin Auth Error:', error);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Acceder al Panel';
        }
    });
}
