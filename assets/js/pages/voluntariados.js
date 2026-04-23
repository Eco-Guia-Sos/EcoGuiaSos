/* assets/js/pages/voluntariados.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';
import { initDynamicSection } from '../dynamic-section-handler.js';

async function initVoluntariados() {
    setupNavbar();
    setupAuthObserver();
    await initDynamicSection('voluntariados', 'ajolote');
}

document.addEventListener('DOMContentLoaded', initVoluntariados);
