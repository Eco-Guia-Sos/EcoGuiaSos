// Lógica de funcionamiento para las pestañas de la demo

document.addEventListener('DOMContentLoaded', () => {

    // Configurar menú móvil (reutilizado)
    const hamburger = document.querySelector('.hamburger-menu');
    const navMenu = document.getElementById('nav-menu-list');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            if (navMenu.style.display === 'flex') {
                navMenu.style.display = 'none';
            } else {
                navMenu.style.display = 'flex';
            }
        });
    }

    // Lógica del Dashboard Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 1. Quitar 'active' de todos los botones
            tabBtns.forEach(b => b.classList.remove('active'));
            // 2. Ocultar todos los páneles
            tabPanes.forEach(p => p.classList.remove('active'));

            // 3. Activar el botón clickeado
            btn.classList.add('active');

            // 4. Mostrar el panel correspondiente al data-target
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

});
