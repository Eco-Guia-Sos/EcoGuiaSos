<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Interactive step-by-step drawer/modal state
const selectedTopic = ref<string | null>(null)
const isModalOpen = ref(false)

interface GuideTopic {
  title: string
  icon: string
  description: string
  steps: string[]
}

const TOPICS_CONFIG: Record<string, GuideTopic> = {
  navegacion: {
    title: 'Navegar por el Portal',
    icon: '🧭',
    description: 'Aprende a moverte por las diferentes secciones de EcoGuía SOS.',
    steps: [
      'Usa la barra de navegación superior sticky para moverte entre Inicio, Nosotros, Cómo Usar y tu Perfil.',
      'En la página de inicio, explora las categorías divididas por los tres niveles de compromiso: Colibrí (Lecturas, Ecotecnias, Agua), Ajolote (Voluntariado y Convocatorias) y Lobo (Normativas y Fondos).',
      'Despliega los tooltips informativos en cada nivel para entender el impacto de cada categoría.'
    ]
  },
  registro: {
    title: 'Registrarse como Voluntario',
    icon: '🌱',
    description: 'Crea una cuenta para desbloquear el catálogo interactivo completo.',
    steps: [
      'Haz click en el botón "Súmate" o "Iniciar Sesión" en la barra de navegación superior.',
      'Llena el formulario con tu correo electrónico y define una contraseña segura de al menos 6 caracteres.',
      'Confirma tu cuenta y accede a tu panel personal para empezar a seguir agentes ambientales y almacenar favoritos.'
    ]
  },
  busqueda: {
    title: 'Búsqueda en Tiempo Real',
    icon: '🔍',
    description: 'Ubica de forma rápida proyectos y centros cerca de ti.',
    steps: [
      'Localiza la barra de búsqueda en la sección principal de la web.',
      'Escribe palabras clave como "reforestación", "reciclaje" o el nombre de una alcaldía.',
      'La cuadrícula se filtrará de forma instantánea mostrando tarjetas relevantes con títulos e imágenes.'
    ]
  },
  filtros: {
    title: 'Filtros de Búsqueda Avanzada',
    icon: '⚙️',
    description: 'Combina filtros lógicos para afinar tus búsquedas de campo.',
    steps: [
      'Haz click en el botón "Búsqueda Avanzada" en la cabecera del catálogo.',
      'Selecciona categorías específicas, rangos de fechas o marca chips como "Gratuito", "Pet-Friendly" o "Apto para Niños".',
      'Los resultados se actualizarán automáticamente respetando todas las condiciones seleccionadas.'
    ]
  },
  radar: {
    title: 'Radar de Distancia',
    icon: '🎯',
    description: 'Descubre iniciativas activas a tu alrededor inmediato.',
    steps: [
      'Asegúrate de permitir el acceso de geolocalización en tu navegador móvil o de escritorio.',
      'Usa el control deslizante de distancia (slider de kilómetros) para ajustar tu radio de acción de 1 km hasta 100 km.',
      'El sistema calculará las distancias por fórmula Haversine y listará únicamente los proyectos correspondientes.'
    ]
  },
  detalles: {
    title: 'Visualizar Detalles de Tarjeta',
    icon: '🃏',
    description: 'Explora galerías, descripciones detalladas y mapas interactivos de eventos.',
    steps: [
      'Haz click en cualquier tarjeta de evento o lugar sustentable en el catálogo.',
      'Lee la descripción detallada, fechas y horarios en la ficha ampliada.',
      'Visualiza la galería de fotos cargadas y usa la ubicación integrada para trazar tu ruta de viaje.'
    ]
  },
  mapa: {
    title: 'Visor en Mapa',
    icon: '🗺️',
    description: 'Analiza geográficamente las iniciativas del país.',
    steps: [
      'Haz click en "Ver Mapa" o accede directamente a la sección de Atlas Territorial.',
      'Verás marcadores interactivos que se agrupan (clustering) para evitar saturación visual.',
      'Selecciona cualquier pin para ver el resumen del proyecto en el panel flotante derecho y centrar la vista del carrusel.'
    ]
  },
  favoritos: {
    title: 'Guardar en Favoritos',
    icon: '❤️',
    description: 'Crea tu propia agenda de voluntariado y consultas.',
    steps: [
      'En la vista de detalles de cualquier evento o lugar, presiona el botón "Guardar en Favoritos".',
      'El sistema enlazará el registro a tu cuenta en tiempo real.',
      'Visita tu menú de perfil y selecciona "Mis Favoritos" para consultar tus contenidos almacenados cuando lo desees.'
    ]
  },
  agentes: {
    title: 'Seguimiento de Agentes',
    icon: '👥',
    description: 'Mantente al día con el trabajo de tus organizaciones preferidas.',
    steps: [
      'Accede a la sección de "Agentes de Cambio" para ver el listado de colectivos validados.',
      'Haz click en cualquiera para ver su banner, biografía, redes sociales y proyectos publicados.',
      'Presiona "+ Seguir" para recibir notificaciones directas en tu panel de alertas cada vez que publiquen novedades.'
    ]
  }
}

const openGuide = (topicId: string) => {
  selectedTopic.value = topicId
  isModalOpen.value = true
}

const closeModal = () => {
  selectedTopic.value = null
  isModalOpen.value = false
}
</script>

<template>
  <main class="guia-main-container" style="padding-top: 100px;">
    <!-- HERO SECTION -->
    <header class="guia-hero" style="margin-bottom: 2rem;">
      <h1>Guía para Visitantes y Voluntarios</h1>
      <p>Saca el máximo provecho de nuestras herramientas de exploración ciudadana para apoyar la restauración y conservación ambiental.</p>
    </header>

    <!-- VIDEOS & TUTORIALS GRID -->
    <section class="videos-grid">
      
      <!-- Video Card: Navegar sitio -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">🧭</span>
          <div>
            <h3>Navegar el sitio</h3>
            <p>Descubre el menú superior, el sistema de niveles ecológicos y la arquitectura de contenidos.</p>
          </div>
        </header>
        <div class="video-player-container">
          <div class="video-placeholder">
            <i class="fa-solid fa-video-slash"></i>
            <span>Video en producción</span>
          </div>
        </div>
        <footer class="video-card-footer">
          <span class="video-status pending">Próximamente</span>
          <button class="btn-read-guide" @click="openGuide('navegacion')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Registro -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">🌱</span>
          <div>
            <h3>Registrarte como Voluntario</h3>
            <p>Cómo crear tu perfil seguro para desbloquear el guardado de actividades y seguimiento de actores locales.</p>
          </div>
        </header>
        <div class="video-player-container">
          <div class="video-placeholder">
            <i class="fa-solid fa-video-slash"></i>
            <span>Video en producción</span>
          </div>
        </div>
        <footer class="video-card-footer">
          <span class="video-status pending">Próximamente</span>
          <button class="btn-read-guide" @click="openGuide('registro')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Búsqueda -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">🔍</span>
          <div>
            <h3>Búsqueda en tiempo real</h3>
            <p>Aprende a usar la barra de búsqueda superior para ubicar proyectos, eventos y lugares sustentables.</p>
          </div>
        </header>
        <div class="video-player-container">
          <div class="video-placeholder">
            <i class="fa-solid fa-video-slash"></i>
            <span>Video en producción</span>
          </div>
        </div>
        <footer class="video-card-footer">
          <span class="video-status pending">Próximamente</span>
          <button class="btn-read-guide" @click="openGuide('busqueda')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Filtros -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">⚙️</span>
          <div>
            <h3>Filtros de Búsqueda Avanzada</h3>
            <p>Combina categorías (Talleres, Parques, Huertos), fechas precisas y preferencias como acceso con mascotas.</p>
          </div>
        </header>
        <div class="video-player-container">
          <div class="video-placeholder">
            <i class="fa-solid fa-video-slash"></i>
            <span>Video en producción</span>
          </div>
        </div>
        <footer class="video-card-footer">
          <span class="video-status pending">Próximamente</span>
          <button class="btn-read-guide" @click="openGuide('filtros')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Radar -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">🎯</span>
          <div>
            <h3>Radar de Distancia</h3>
            <p>Autoriza tu ubicación geográfica y desliza el control de kilómetros para ver lo que sucede a tu alrededor.</p>
          </div>
        </header>
        <div class="video-player-container">
          <div class="video-placeholder">
            <i class="fa-solid fa-video-slash"></i>
            <span>Video en producción</span>
          </div>
        </div>
        <footer class="video-card-footer">
          <span class="video-status pending">Próximamente</span>
          <button class="btn-read-guide" @click="openGuide('radar')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Detalles -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">🃏</span>
          <div>
            <h3>Detalles y Carrusel</h3>
            <p>Explora la tarjeta interior de los eventos: galerías de fotos, descripción de actividades y mapas.</p>
          </div>
        </header>
        <div class="video-player-container">
          <div class="video-placeholder">
            <i class="fa-solid fa-video-slash"></i>
            <span>Video en producción</span>
          </div>
        </div>
        <footer class="video-card-footer">
          <span class="video-status pending">Próximamente</span>
          <button class="btn-read-guide" @click="openGuide('detalles')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Mapa -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">🗺️</span>
          <div>
            <h3>Visor en Mapa</h3>
            <p>Alterna al lienzo cartográfico para analizar la densidad de proyectos y planificar rutas de voluntariado.</p>
          </div>
        </header>
        <div class="video-player-container">
          <div class="video-placeholder">
            <i class="fa-solid fa-video-slash"></i>
            <span>Video en producción</span>
          </div>
        </div>
        <footer class="video-card-footer">
          <span class="video-status pending">Próximamente</span>
          <button class="btn-read-guide" @click="openGuide('mapa')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Favoritos -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">❤️</span>
          <div>
            <h3>Guardar en Favoritos</h3>
            <p>Marca con un corazón los eventos, lecturas o lugares de interés para consultarlos en tu menú personal.</p>
          </div>
        </header>
        <div class="video-player-container">
          <div class="video-placeholder">
            <i class="fa-solid fa-video-slash"></i>
            <span>Video en producción</span>
          </div>
        </div>
        <footer class="video-card-footer">
          <span class="video-status pending">Próximamente</span>
          <button class="btn-read-guide" @click="openGuide('favoritos')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Agentes -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">👥</span>
          <div>
            <h3>Conectar con Agentes</h3>
            <p>Visita perfiles de organizaciones validadas, consulta su historial y síguelos para recibir alertas.</p>
          </div>
        </header>
        <div class="video-player-container">
          <div class="video-placeholder">
            <i class="fa-solid fa-video-slash"></i>
            <span>Video en producción</span>
          </div>
        </div>
        <footer class="video-card-footer">
          <span class="video-status pending">Próximamente</span>
          <button class="btn-read-guide" @click="openGuide('agentes')">Leer guía</button>
        </footer>
      </article>

    </section>

    <!-- BOTTOM CTA -->
    <footer class="guia-cta-footer">
      <p>¿Perteneces a un colectivo, parque o proyecto ambiental constituido?</p>
      <RouterLink to="/guia-actor" class="link-switch-rol">
        Consultar los tutoriales para Organizaciones y Actores Oficiales <i class="fa-solid fa-circle-arrow-right"></i>
      </RouterLink>
    </footer>

    <!-- INTERACTIVE STEP-BY-STEP MODAL -->
    <div v-if="isModalOpen && selectedTopic && TOPICS_CONFIG[selectedTopic]" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content glass-effect" style="max-width: 550px; padding: 30px; border-radius: 20px; text-align: left;">
        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="color:white; margin:0; display:flex; align-items:center; gap:10px;">
            <span>{{ TOPICS_CONFIG[selectedTopic]?.icon }}</span>
            {{ TOPICS_CONFIG[selectedTopic]?.title }}
          </h3>
          <button @click="closeModal" style="background:none; border:none; color:#94a3b8; font-size:1.8rem; cursor:pointer;">&times;</button>
        </div>
        
        <p style="color:#cbd5e1; font-size:0.95rem; line-height:1.5; margin-bottom: 20px;">
          {{ TOPICS_CONFIG[selectedTopic]?.description }}
        </p>

        <ol style="color:#f8fafc; font-size:0.95rem; line-height:1.6; padding-left:20px; display:flex; flex-direction:column; gap:12px;">
          <li v-for="(step, idx) in TOPICS_CONFIG[selectedTopic]?.steps" :key="idx">
            {{ step }}
          </li>
        </ol>

        <button class="btn btn-primary" @click="closeModal" style="margin-top: 25px; width:100%; border-radius:12px; font-weight:700; padding:10px;">
          Entendido
        </button>
      </div>
    </div>
  </main>
</template>

<style>
@import '../assets/css/guia.css';
</style>
