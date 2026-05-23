<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  // Staggered Fade-In Animation
  const cards = document.querySelectorAll('.rol-card')
  cards.forEach((card, index) => {
    const el = card as HTMLElement
    el.style.opacity = '0'
    el.style.transform = 'translateY(20px)'
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease'
    
    setTimeout(() => {
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    }, 100 + (index * 80))
  })
})
</script>

<template>
  <main class="guia-main-container">
    <!-- HERO SECTION -->
    <header class="guia-hero">
      <img src="/assets/img/logmov.gif" alt="Logo Animado EcoGuía SOS" class="hero-logo-gif" />
      <h1>¿Cómo quieres usar EcoGuía SOS?</h1>
      <p>Selecciona tu perfil para ver los videos tutoriales, atajos y flujos de acción optimizados para tus necesidades.</p>
    </header>

    <!-- TARJETAS DE SELECCIÓN DE ROL -->
    <section class="rol-cards-grid">
      <!-- TARJETA A: VISITANTES / VOLUNTARIOS -->
      <article class="rol-card">
        <div>
          <div class="rol-icon-box">
            <i class="fa-solid fa-person-hiking"></i>
          </div>
          <h3>Visitante / Voluntario</h3>
          <p>Ideal si buscas sumarte a iniciativas locales, encontrar áreas verdes, asistir a eventos y seguir de cerca la regeneración ambiental.</p>
          
          <ul class="rol-features-list">
            <li><i class="fa-solid fa-circle-check"></i> Búsqueda y filtrado inteligente</li>
            <li><i class="fa-solid fa-circle-check"></i> Uso del radar geográfico de proximidad</li>
            <li><i class="fa-solid fa-circle-check"></i> Gestión de favoritos y perfiles seguidos</li>
            <li><i class="fa-solid fa-circle-check"></i> Proceso de registro y ayuda en campo</li>
          </ul>
        </div>
        <button type="button" class="btn-user" aria-label="Ver tutoriales para visitantes" @click="router.push('/guia-usuario')">
          Ver Guía de Usuario <i class="fa-solid fa-arrow-right"></i>
        </button>
      </article>

      <!-- TARJETA B: ACTORES / ORGANIZACIONES -->
      <article class="rol-card actor-card">
        <div>
          <div class="rol-icon-box">
            <i class="fa-solid fa-bullhorn"></i>
          </div>
          <h3>Actor / Organización</h3>
          <p>Diseñado para colectivos, instituciones, parques y proyectos oficiales que requieren difundir sus actividades y fortalecer su impacto.</p>
          
          <ul class="rol-features-list">
            <li><i class="fa-solid fa-circle-check"></i> Solicitud y validación de cuenta de Actor</li>
            <li><i class="fa-solid fa-circle-check"></i> Uso del Panel de Administración central</li>
            <li><i class="fa-solid fa-circle-check"></i> Formulario de eventos con múltiples imágenes</li>
            <li><i class="fa-solid fa-circle-check"></i> Captura precisa de coordenadas en Google Maps</li>
          </ul>
        </div>
        <button type="button" class="btn-actor" aria-label="Ver tutoriales para organizaciones" @click="router.push('/guia-actor')">
          Ver Guía de Actor <i class="fa-solid fa-arrow-right"></i>
        </button>
      </article>
    </section>
  </main>
</template>

<style>
@import '../assets/css/guia.css';
</style>
