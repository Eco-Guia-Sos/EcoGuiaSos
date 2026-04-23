/* assets/js/pages/convocatoria.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';
import { initDynamicSection } from '../dynamic-section-handler.js';

async function initConvocatoria() {
    setupNavbar();
    setupAuthObserver();
    await initDynamicSection('convocatoria', 'ajolote');
}

document.addEventListener('DOMContentLoaded', initConvocatoria);
