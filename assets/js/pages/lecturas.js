/* assets/js/pages/lecturas.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';
import { initDynamicSection } from '../dynamic-section-handler.js';

async function initLecturas() {
    setupNavbar();
    setupAuthObserver();
    await initDynamicSection('lecturas', 'colibri');
}

document.addEventListener('DOMContentLoaded', initLecturas);
