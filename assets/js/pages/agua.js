/* assets/js/pages/agua.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';

function initAgua() {
    setupNavbar();
    setupAuthObserver();
    console.log('Agua page initialized');
}

document.addEventListener('DOMContentLoaded', initAgua);
