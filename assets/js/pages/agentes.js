/* assets/js/pages/agentes.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';
import { initDynamicSection } from '../dynamic-section-handler.js';

async function initAgentes() {
    setupNavbar();
    setupAuthObserver();
    
    // NOTA: Agentes suele ser una vista más compleja con perfiles de usuario.
    // Pero para la versión dinámica unificada, usamos el mismo handler.
    await initDynamicSection('agentes', 'ajolote');
}

document.addEventListener('DOMContentLoaded', initAgentes);
