/* assets/js/pages/normativa.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';

function initNormativa() {
    setupNavbar();
    setupAuthObserver();
    console.log('Normativa page initialized');
}

document.addEventListener('DOMContentLoaded', initNormativa);
