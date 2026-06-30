<script setup lang="ts">
import { onMounted } from 'vue'

declare const particlesJS: any

onMounted(() => {
  if (typeof particlesJS !== 'undefined') {
    particlesJS('particles-js', {
      particles: {
        number: {
          value: 60,
          density: { enable: true, value_area: 800 }
        },
        color: {
          value: ['#72B04D', '#0077b6', '#FFD700', '#E74C3C']
        },
        shape: { type: 'circle' },
        opacity: {
          value: 0.7,
          random: true,
          anim: { enable: true, speed: 0.5, opacity_min: 0, sync: false }
        },
        size: { value: 6, random: true },
        line_linked: {
          enable: true,
          distance: 150,
          color: '#ffffff',
          opacity: 0.2,
          width: 1
        },
        move: {
          enable: true,
          speed: 3,
          direction: 'none',
          random: true,
          straight: false,
          out_mode: 'out',
          bounce: false
        }
      },
      interactivity: {
        detect_on: 'canvas',
        events: {
          onhover: { enable: true, mode: 'repulse' },
          onclick: { enable: true, mode: 'push' },
          resize: true
        }
      },
      retina_detect: true
    })
  }
})
</script>

<template>
  <div class="nosotros-page-wrapper">
    <!-- FONDO DE PARTÍCULAS (CONSTELACIÓN) -->
    <div id="particles-js"></div>

    <main class="nosotros-container">
      <header class="header-section">
        <h1>Nuestra Esencia
          <span class="txt-eco">Eco</span>
          <span class="txt-gaia">Guía</span>
          <span class="txt-sos">SOS</span>
        </h1>
        <p class="subtitle">Generando Redes Para el Futuro</p>
      </header>

      <section class="mv-grid">
        <div class="card mission">
          <div class="icon"><i class="fas fa-seedling"></i></div>
          <h2>Misión</h2>
          <p>
            "Democratizar el acceso a la sostenibilidad en México, conectando a ciudadanos, 
            activistas y organizaciones a través de una plataforma tecnológica accesible 
            que visibilice y articule acciones en favor de la ecología integral."
          </p>
        </div>

        <div class="card vision">
          <div class="icon"><i class="fas fa-globe-americas"></i></div>
          <h2>Visión</h2>
          <p>
            "Consolidarnos como el ecosistema digital de referencia para la acción climática en México, 
            donde cualquier persona pueda transitar desde la curiosidad individual hasta el 
            liderazgo colectivo."
          </p>
        </div>
      </section>

      <section class="symbology-section">
        <h3><i class="fas fa-fingerprint"></i> Nuestro Emblema</h3>
        <p class="section-intro">Nuestro logo es un mapa vivo de nuestras áreas de acción:</p>

        <div class="logos-container">
          <div class="logo-highlight-box">
            <h4>Emblema Animado</h4>
            <div class="logo-highlight">
              <img src="/assets/img/logmov.gif" alt="Logo Animado EcoGuía SOS" class="main-logo-gif" />
            </div>
            <p class="logo-info">Representación completa de nuestra esencia e interconexión con el conocimiento y la naturaleza.</p>
          </div>
          
          <div class="logo-highlight-box">
            <h4>Logotipo de la App</h4>
            <div class="logo-highlight">
              <img src="/logo-app.webp" alt="Logo App Móvil EcoGuía SOS" class="main-logo-gif app-logo-img" />
            </div>
            <p class="logo-info">Identidad visual optimizada y simplificada de la aplicación móvil para dispositivos inteligentes.</p>
          </div>
        </div>

        <div class="name-breakdown">
          <div class="name-item eco-item">
            <span class="term txt-eco">Eco</span> <span class="def">Ecología Sensata</span>
          </div>
          <div class="name-item guia-item">
            <span class="term txt-gaia">Guía</span> <span class="def">Directorio y Apoyo</span>
          </div>
          <div class="name-item sos-item">
            <span class="term txt-sos">SOS</span> <span class="def">Llamado a la Acción</span>
          </div>
        </div>

        <div class="symbols-grid">
          <div class="symbol-card">
            <div class="symbol-img-box">
              <img src="/assets/img/nopal.webp" alt="Nopal" />
            </div>
            <h4>El Nopal</h4>
            <p class="symbol-desc">Identidad mexicana y resiliencia. Capacidad de florecer incluso en condiciones difíciles.</p>
          </div>

          <div class="symbol-card">
            <div class="symbol-img-box">
              <img src="/assets/img/engrane.png" alt="Engrane" />
            </div>
            <h4>Engrane con Brote</h4>
            <p class="symbol-desc">Fusión de ingeniería y biología. Tecnología puesta al servicio de la vida (Ecotecnología).</p>
          </div>

          <div class="symbol-card">
            <div class="symbol-img-box">
              <img src="/assets/img/agua.webp" alt="Gota de Agua" />
            </div>
            <h4>Gota de Agua</h4>
            <p class="symbol-desc">Recurso vital. Compromiso ineludible con la protección y saneamiento del agua.</p>
          </div>

          <div class="symbol-card">
            <div class="symbol-img-box">
              <img src="/assets/img/luz.webp" alt="Rayo y Hoja" />
            </div>
            <h4>Rayo y Hoja</h4>
            <p class="symbol-desc">Energía renovable y el poder de la naturaleza como fuente limpia y sostenible.</p>
          </div>

          <div class="symbol-card">
            <div class="symbol-img-box">
              <img src="/assets/img/book.png" alt="El Libro" />
            </div>
            <h4>El Libro</h4>
            <p class="symbol-desc">Educación y sabiduría. El pilar fundamental del conocimiento que nos permite comprender y transformar nuestra relación con el medio ambiente.</p>
          </div>

          <div class="symbol-card">
            <div class="symbol-img-box">
              <img src="/assets/img/world.png" alt="El Mundo" />
            </div>
            <h4>El Mundo</h4>
            <p class="symbol-desc">Conciencia global y acción local. Representa nuestro hogar común y la necesidad de trabajar unidos por un futuro sostenible para todos.</p>
          </div>
        </div>
      </section>

      <section class="dna-section">
        <h3>Nuestro ADN: Imitando a la Naturaleza</h3>
        <div class="levels-wrapper">
          <div class="level colibri">
            <h4><i class="fas fa-dove"></i> Nivel Colibrí</h4>
            <span>(Polinización)</span>
            <p>Educación y sensibilización.</p>
          </div>
          <div class="level ajolote">
            <h4><i class="fas fa-frog"></i> Nivel Ajolote</h4>
            <span>(Regeneración)</span>
            <p>Acción directa y restauración.</p>
          </div>
          <div class="level lobo">
            <h4><i class="fas fa-dog"></i> Nivel Lobo</h4>
            <span>(Estrategia)</span>
            <p>Recursos y cambio sistémico.</p>
          </div>
        </div>
      </section>

      <section class="founders-section">
        <h3>Equipo Fundador</h3>
        <div class="founders-grid">
          <div class="founder-card">
            <div class="photo-frame">
              <img src="/assets/img/profilecv.webp" alt="Sergio Garduño" />
            </div>
            <div class="info">
              <h4>Sergio Garduño Jardón</h4>
              <span class="role">Tecnología & Desarrollo (IT)</span>
              <p>Encargado de la arquitectura de software y la experiencia de usuario.</p>
              <div class="links">
                <a href="https://sgj369.github.io/cv-sergio-gardu-o-jardon/index.html" target="_blank" rel="noopener noreferrer" class="btn-link">Portafolio</a>
                <a href="https://github.com/sgj369" target="_blank" rel="noopener noreferrer" class="social-icon" aria-label="GitHub"><i class="fab fa-github"></i></a>
              </div>
            </div>
          </div>

          <div class="founder-card">
            <div class="photo-frame">
              <img src="/assets/img/EVJA.webp" alt="Alejandro Enríquez" />
            </div>
            <div class="info">
              <h4>Alejandro Enríquez</h4>
              <span class="role">Investigación & Datos</span>
              <p>Responsable de la curaduría de datos y validación de proyectos.</p>
              <div class="links">
                <a href="https://jenriquezv1400.github.io/EVJA/" target="_blank" rel="noopener noreferrer" class="btn-link">Portafolio</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
@import '../assets/css/nosotros.css';
</style>
