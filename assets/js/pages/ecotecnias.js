/* assets/js/pages/ecotecnias.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';
import { initDynamicSection } from '../dynamic-section-handler.js';

async function initEcotecnias() {
    setupNavbar();
    setupAuthObserver();
    
    // Inicializar contenido dinámico
    await initDynamicSection('ecotecnias', 'colibri');
    
    console.log('Ecotecnias page initialized dynamically');
}

document.addEventListener('DOMContentLoaded', initEcotecnias);
