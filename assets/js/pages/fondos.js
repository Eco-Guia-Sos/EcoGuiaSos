/* assets/js/pages/fondos.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';

function initFondos() {
    setupNavbar();
    setupAuthObserver();
    // Logic for dynamic loading could be added here later if a GSheet tab for Fondos is created.
    console.log('Fondos page initialized');
}

document.addEventListener('DOMContentLoaded', initFondos);
