/* assets/js/pages/documentales.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';
import { initDynamicSection } from '../dynamic-section-handler.js';

async function initDocumentales() {
    setupNavbar();
    setupAuthObserver();
    await initDynamicSection('documentales', 'colibri');
}

document.addEventListener('DOMContentLoaded', initDocumentales);
