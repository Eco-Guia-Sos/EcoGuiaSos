/* assets/js/pages/fondos.js */
import { setupNavbar } from '../ui-utils.js';

function initFondos() {
    setupNavbar();
    // Logic for dynamic loading could be added here later if a GSheet tab for Fondos is created.
    console.log('Fondos page initialized');
}

document.addEventListener('DOMContentLoaded', initFondos);
