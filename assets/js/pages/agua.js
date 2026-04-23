/* assets/js/pages/agua.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';
import { initDynamicSection } from '../dynamic-section-handler.js';

async function initAgua() {
    setupNavbar();
    setupAuthObserver();
    
    // Inicializar contenido dinámico
    await initDynamicSection('agua', 'colibri');
    
    console.log('Agua page initialized dynamically');
}

document.addEventListener('DOMContentLoaded', initAgua);
