/* assets/js/components/fab-menu.js */
import { supabase } from '../supabase.js';

export function setupFAB() {
    supabase.auth.onAuthStateChange(async (event, session) => {
        const existingFab = document.getElementById('fab-container');
        if (existingFab) existingFab.remove();

        if (session) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profile && (profile.role === 'admin' || profile.role === 'actor')) {
                renderFAB(profile.role);
            }
        }
    });
}

function renderFAB(role) {
    const fabContainer = document.createElement('div');
    fabContainer.id = 'fab-container';
    fabContainer.className = 'fab-container';
    
    // Main Toggle
    fabContainer.innerHTML = `
        <button class="fab-main" id="fab-main">
            <i class="fa-solid fa-plus"></i>
        </button>
        <div class="fab-menu" id="fab-menu">
            <a href="./admin.html" class="fab-item" data-label="Panel Admin">
                <i class="fa-solid fa-gauge-high"></i>
            </a>
            <a href="./admin.html?action=new-event" class="fab-item" data-label="Nuevo Evento">
                <i class="fa-solid fa-calendar-plus"></i>
            </a>
            <a href="#" class="fab-item" data-label="Crear Organización">
                <i class="fa-solid fa-building-circle-check"></i>
            </a>
        </div>
    `;

    document.body.appendChild(fabContainer);

    const mainBtn = document.getElementById('fab-main');
    const menu = document.getElementById('fab-menu');

    mainBtn.addEventListener('click', () => {
        mainBtn.classList.toggle('active');
        menu.classList.toggle('active');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!fabContainer.contains(e.target)) {
            mainBtn.classList.remove('active');
            menu.classList.remove('active');
        }
    });
}
