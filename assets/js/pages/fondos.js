/* assets/js/pages/fondos.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';
import { initDynamicSection } from '../dynamic-section-handler.js';

async function initFondos() {
    setupNavbar();
    setupAuthObserver();
    await initDynamicSection('fondos', 'lobo');
}

document.addEventListener('DOMContentLoaded', initFondos);
