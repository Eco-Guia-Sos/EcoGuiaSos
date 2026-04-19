/* assets/js/pages/documentales.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';

function initDocumentales() {
    setupNavbar();
    setupAuthObserver();
    console.log('Documentales page initialized');
}

document.addEventListener('DOMContentLoaded', initDocumentales);
