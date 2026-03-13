/* assets/js/ui-utils.js */
// Common UI behaviors like Navbar toggling

export function setupNavbar() {
    const hamburger = document.querySelector('.hamburger-menu');
    const navMenu = document.getElementById('nav-menu-list');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            const isFlex = navMenu.style.display === 'flex';
            navMenu.style.display = isFlex ? 'none' : 'flex';
        });
    }
}

export function showLoader(containerId, message = 'Buscando información...') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="loader-text">
                <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

export function showEmptyState(containerId, message = 'No hay resultados disponibles.') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<p class="loader-text">${message}</p>`;
    }
}

export function showErrorState(containerId, message = 'Error al cargar los datos.') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<p class="loader-text">${message}</p>`;
    }
}
