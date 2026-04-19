/* assets/js/pages/ecotecnias.js */
import { supabase } from '../supabase.js';
import { setupNavbar, setupAuthObserver, showLoader, showErrorState, showEmptyState } from '../ui-utils.js';

async function initEcotecnias() {
    setupNavbar();
    setupAuthObserver();
    const container = document.getElementById('ecotecnias-container');
    if (!container) return;

    showLoader('ecotecnias-container', 'Cargando tecnologías sustentables...');

    try {
        const { data: ecotecnias, error } = await supabase
            .from('ecotecnias')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;

        container.innerHTML = '';

        if (!ecotecnias || ecotecnias.length === 0) {
            showEmptyState('ecotecnias-container', 'Aún no hay ecotecnias registradas.');
            return;
        }

        ecotecnias.forEach(eco => {
            const nombre = eco.nombre;
            const categoria = eco.categoria || 'Ecotecnología';
            const icono = eco.icono || 'fa-seedling';
            const desc = eco.descripcion || 'Sin descripción.';
            const beneficio = eco.beneficio || '';

            const cardHtml = `
                <article class="ecotecnia-card generic-card fade-in">
                    <div class="e-header">
                        <i class="fa-solid ${icono} e-icon"></i>
                        <h3 class="e-title">${nombre}</h3>
                    </div>
                    <p class="e-desc">${desc}</p>
                    <div class="e-tags">
                        <span class="e-tag">${categoria}</span>
                        ${beneficio ? `<span class="e-tag">${beneficio}</span>` : ''}
                    </div>
                </article>
            `;
            container.innerHTML += cardHtml;
        });
    } catch (error) {
        console.error("Error loading ecotecnias:", error);
        showErrorState('ecotecnias-container', 'Error al cargar ecotecnias.');
    }
}

document.addEventListener('DOMContentLoaded', initEcotecnias);
