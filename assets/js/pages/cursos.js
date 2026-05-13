/* assets/js/pages/cursos.js */
import { setupNavbar, setupAuthObserver } from '../ui-utils.js';
import { initDynamicSection } from '../dynamic-section-handler.js';

/**
 * Inicializa la página de cursos utilizando el manejador de secciones dinámicas
 */
async function initCursosPage() {
    setupNavbar();
    setupAuthObserver();

    // El manejador se encarga de:
    // 1. Mostrar el estado de carga
    // 2. Consultar la tabla 'contenido_secciones' filtrando por 'cursos'
    // 3. Renderizar las tarjetas con el diseño estandarizado
    // 4. Mostrar el botón "Proponer Contenido" si el usuario tiene permisos
    await initDynamicSection('cursos', 'colibri');
}

document.addEventListener('DOMContentLoaded', initCursosPage);
