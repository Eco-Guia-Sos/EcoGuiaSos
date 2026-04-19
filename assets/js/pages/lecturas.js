/* assets/js/pages/lecturas.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';

function initLecturas() {
    setupNavbar();
    setupAuthObserver();
    console.log('Lecturas page initialized');
}

document.addEventListener('DOMContentLoaded', initLecturas);
