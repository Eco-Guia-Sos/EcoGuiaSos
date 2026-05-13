/* ==========================================================================
   LÓGICA PARA LAS PÁGINAS "CÓMO USAR" (INTERACTIVIDAD MÍNIMA + CORE)
   ========================================================================== */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';

function initComoUsar() {
    // Inicializar menú hamburguesa y observador de sesión
    setupNavbar();
    setupAuthObserver();

    // 1. Animación suave de entrada para las tarjetas (Staggered Fade-In)
    const cards = document.querySelectorAll('.rol-card, .video-card');
    
    if (cards.length > 0) {
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 100 + (index * 80));
        });
    }

    // 2. Manejo de clics en las tarjetas de rol de la Landing
    const btnUser = document.querySelector('.btn-user');
    const btnActor = document.querySelector('.btn-actor');

    if (btnUser) {
        btnUser.addEventListener('click', () => {
            window.location.href = './pages/guia-usuario.html';
        });
    }

    if (btnActor) {
        btnActor.addEventListener('click', () => {
            window.location.href = './pages/guia-actor.html';
        });
    }

    // 3. Registrar interacciones simples en los botones de "Leer guía"
    const readGuideButtons = document.querySelectorAll('.btn-read-guide');
    readGuideButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const href = btn.getAttribute('href');
            if (!href || href === '#') {
                e.preventDefault();
                const headerTitle = btn.closest('.video-card')?.querySelector('h3')?.textContent || 'esta función';
                alert(`📖 La guía detallada en texto para "${headerTitle}" se está redactando. ¡Estará disponible pronto!`);
            }
        });
    });
}

// Ejecutar al cargar el DOM o de inmediato si ya cargó
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComoUsar);
} else {
    initComoUsar();
}
