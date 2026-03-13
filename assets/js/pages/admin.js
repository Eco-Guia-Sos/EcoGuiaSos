/* assets/js/pages/admin.js */
import { supabase } from '../supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // Proteger la ruta: Comprobar autenticación
    comprobarSesion();

    let currentUser = null;

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/login.html';
        });
    }

    // Modal elements
    const btnNuevo = document.getElementById('btn-nuevo');
    const modalNuevo = document.getElementById('modal-nuevo');
    const btnCancelar = document.getElementById('btn-cancelar');
    const formNuevo = document.getElementById('form-nuevo');

    async function comprobarSesion() {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
            window.location.href = '/login.html';
            return;
        }

        currentUser = session.user;
        
        // Habilitar botón
        if(btnNuevo) btnNuevo.disabled = false;
        
        cargarDatos();
        setupModal();
    }

    function setupModal() {
        btnNuevo.addEventListener('click', () => {
            modalNuevo.style.display = 'flex';
        });

        btnCancelar.addEventListener('click', () => {
            modalNuevo.style.display = 'none';
            formNuevo.reset();
        });

        formNuevo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = formNuevo.querySelector('button[type="submit"]');
            btnSubmit.innerHTML = 'Guardando...';
            btnSubmit.disabled = true;

            const tipo = document.getElementById('input-tipo').value;
            let tabla = 'eventos';
            if (tipo === 'lugar') tabla = 'lugares';
            if (tipo === 'curso') tabla = 'cursos';
            if (tipo === 'voluntariado') tabla = 'voluntariados';
            if (tipo === 'agente') tabla = 'agentes';
            
            const nuevoRegistro = {
                nombre: document.getElementById('input-nombre').value,
                categoria: document.getElementById('input-categoria').value,
                ubicacion: document.getElementById('input-ubicacion').value,
                mapa_url: document.getElementById('input-mapa').value || null,
                imagen: document.getElementById('input-imagen').value || '/assets/img/kpop.webp',
                descripcion: document.getElementById('input-descripcion').value || null,
                creado_por: currentUser.id
            };

            try {
                const { error } = await supabase.from(tabla).insert([nuevoRegistro]);
                if (error) throw error;
                
                modalNuevo.style.display = 'none';
                formNuevo.reset();
                cargarDatos(); // Refresh table
            } catch (error) {
                console.error('Error insertando registro:', error);
                alert('No se pudo guardar el registro: ' + error.message);
            } finally {
                btnSubmit.innerHTML = 'Guardar';
                btnSubmit.disabled = false;
            }
        });
    }

    async function cargarDatos() {
        try {
            // Cargar Eventos
            const { data: eventos, count: countEventos, error: errE } = await supabase.from('eventos').select('*', { count: 'exact' });
            
            // Cargar Lugares
            const { data: lugares, count: countLugares, error: errL } = await supabase.from('lugares').select('*', { count: 'exact' });

            // Cargar Cursos
            const { data: cursos, error: errC } = await supabase.from('cursos').select('*', { count: 'exact' });
            
            // Cargar Voluntariados
            const { data: voluntarios, error: errV } = await supabase.from('voluntariados').select('*', { count: 'exact' });

            // Cargar Agentes
            const { data: agentes, error: errA } = await supabase.from('agentes').select('*', { count: 'exact' });
                
            if (errE) throw errE;
            if (errL) throw errL;

            document.getElementById('stat-eventos').textContent = countEventos || 0;
            document.getElementById('stat-lugares').textContent = countLugares || 0;

            const tbody = document.getElementById('tabla-registros');
            tbody.innerHTML = '';
            
            const todos = [
                ...(eventos || []).map(e => ({...e, tipo_str: 'evento', color: '#e74c3c'})),
                ...(lugares || []).map(l => ({...l, tipo_str: 'lugar', color: '#72B04D'})),
                ...(cursos || []).map(c => ({...c, tipo_str: 'curso', color: '#3498db'})),
                ...(voluntarios || []).map(v => ({...v, tipo_str: 'voluntariado', color: '#f1c40f'})),
                ...(agentes || []).map(a => ({...a, tipo_str: 'agente', color: '#9b59b6'}))
            ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

            if (todos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888;">No hay registros todavía. Crea el primero.</td></tr>';
                return;
            }

            todos.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${item.nombre}</strong></td>
                    <td>${item.categoria}</td>
                    <td><span style="background: ${item.color}; padding: 3px 8px; border-radius: 10px; font-size: 0.8rem; text-transform: capitalize;">${item.tipo_str}</span></td>
                    <td>
                        <button class="btn btn-danger" onclick="eliminarRegistro('${item.id}', '${item.tipo_str === 'lugar' ? 'lugares' : item.tipo_str + 's'}')" style="padding: 5px 10px; font-size: 0.8rem;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error('Error cargando stats:', error);
            document.getElementById('tabla-registros').innerHTML = '<tr><td colspan="4" style="text-align: center; color: #e74c3c;">Vaya! La base de datos aún no tiene las tablas creadas o hubo un error de conexión.</td></tr>';
        }
    }

    window.eliminarRegistro = async function(id, tabla) {
        if(confirm('¿Estás seguro de eliminar este registro?')) {
            const { error } = await supabase.from(tabla).delete().eq('id', id);
            if(error) {
                alert('No tienes permisos o hubo un error: ' + error.message);
            } else {
                cargarDatos();
            }
        }
    }
});
