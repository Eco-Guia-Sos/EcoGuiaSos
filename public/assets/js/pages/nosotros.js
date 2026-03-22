/* assets/js/pages/nosotros.js */
import { setupNavbar } from '../ui-utils.js';

function initNosotros() {
    setupNavbar();
    
    if (typeof particlesJS !== 'undefined') {
        particlesJS("particles-js", {
            "particles": {
                "number": {
                    "value": 60,
                    "density": { "enable": true, "value_area": 800 }
                },
                "color": {
                    /* Colores de tu Logo: Verde, Azul, Amarillo, Rojo(SOS) */
                    "value": ["#72B04D", "#0077b6", "#FFD700", "#E74C3C"]
                },
                "shape": { "type": "circle" },
                "opacity": {
                    "value": 0.7,
                    "random": true,
                    "anim": { "enable": true, "speed": 0.5, "opacity_min": 0, "sync": false }
                },
                "size": { "value": 6, "random": true },
                "line_linked": {
                    "enable": true,
                    "distance": 150,
                    "color": "#ffffff",
                    "opacity": 0.2,
                    "width": 1
                },
                "move": {
                    "enable": true,
                    "speed": 3,
                    "direction": "none",
                    "random": true,
                    "straight": false,
                    "out_mode": "out",
                    "bounce": false
                }
            },
            "interactivity": {
                "detect_on": "canvas",
                "events": {
                    "onhover": { "enable": true, "mode": "repulse" },
                    "onclick": { "enable": true, "mode": "push" },
                    "resize": true
                }
            },
            "retina_detect": true
        });
    }

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker registrado:', reg.scope))
                .catch(err => console.log('Error al registrar Service Worker:', err));
        });
    }
}

document.addEventListener('DOMContentLoaded', initNosotros);
