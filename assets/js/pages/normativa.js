/* assets/js/pages/normativa.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';
import { initDynamicSection } from '../dynamic-section-handler.js';

async function initNormativa() {
    setupNavbar();
    setupAuthObserver();
    await initDynamicSection('normativa', 'lobo');
}

document.addEventListener('DOMContentLoaded', initNormativa);
