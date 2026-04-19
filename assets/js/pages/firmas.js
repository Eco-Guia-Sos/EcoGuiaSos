/* assets/js/pages/firmas.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';

function initFirmas() {
    setupNavbar();
    setupAuthObserver();
    console.log('Firmas page initialized');
}

document.addEventListener('DOMContentLoaded', initFirmas);
