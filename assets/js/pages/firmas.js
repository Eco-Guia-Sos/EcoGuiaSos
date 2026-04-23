/* assets/js/pages/firmas.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';
import { initDynamicSection } from '../dynamic-section-handler.js';

async function initFirmas() {
    setupNavbar();
    setupAuthObserver();
    await initDynamicSection('firmas', 'colibri');
}

document.addEventListener('DOMContentLoaded', initFirmas);
