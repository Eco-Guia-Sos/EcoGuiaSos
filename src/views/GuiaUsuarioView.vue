<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const expandedTopic = ref<string | null>(null)

const toggleTopic = (topicId: string) => {
  if (expandedTopic.value === topicId) {
    expandedTopic.value = null
  } else {
    expandedTopic.value = topicId
  }
}

interface GuideTopic {
  title: string
  icon: string
  description: string
  steps: string[]
}

const TOPICS_CONFIG: Record<string, GuideTopic> = {
  navegacion: {
    title: 'Navegar el sitio',
    icon: '🧭',
    description: 'Descubre el menú superior, el sistema de niveles ecológicos y la arquitectura de contenidos.',
    steps: [
      'Usa la barra de navegación superior sticky para moverte entre Inicio, Nosotros, Cómo Usar y tu Perfil.',
      'En la página de inicio, explora las categorías divididas por los tres niveles de compromiso: Colibrí (Lecturas, Ecotecnias, Agua), Ajolote (Voluntariado y Convocatorias) y Lobo (Normativas y Fondos).',
      'Despliega los tooltips informativos en cada nivel para entender el impacto de cada categoría.'
    ]
  },
  registro: {
    title: 'Registrarte como Voluntario',
    icon: '🌱',
    description: 'Cómo crear tu perfil seguro para desbloquear el guardado de actividades y seguimiento de actores locales.',
    steps: [
      'Haz click en el botón "Súmate" o "Iniciar Sesión" en la barra de navegación superior.',
      'Llena el formulario con tu correo electrónico y define una contraseña segura de al menos 6 caracteres.',
      'Confirma tu cuenta y accede a tu panel personal para empezar a seguir agentes ambientales y almacenar favoritos.'
    ]
  },
  busqueda: {
    title: 'Búsqueda en tiempo real',
    icon: '🔍',
    description: 'Aprende a usar la barra de búsqueda superior para ubicar proyectos, eventos y lugares sustentables.',
    steps: [
      'Localiza la barra de búsqueda en la sección principal de la web.',
      'Escribe palabras clave como "reforestación", "reciclaje" o el nombre de una alcaldía.',
      'La cuadrícula se filtrará de forma instantánea mostrando tarjetas relevantes con títulos e imágenes.'
    ]
  },
  filtros: {
    title: 'Filtros de Búsqueda Avanzada',
    icon: '⚙️',
    description: 'Combina categorías (Talleres, Parques, Huertos), fechas precisas y preferencias como acceso con mascotas.',
    steps: [
      'Haz click en el botón "Búsqueda Avanzada" en la cabecera del catálogo.',
      'Selecciona categorías específicas, rangos de fechas o marca chips como "Gratuito", "Pet-Friendly" o "Apto para Niños".',
      'Los resultados se actualizarán automáticamente respetando todas las condiciones seleccionadas.'
    ]
  },
  radar: {
    title: 'Radar de Distancia',
    icon: '🎯',
    description: 'Autoriza tu ubicación geográfica y desliza el control de kilómetros para ver lo que sucede a tu alrededor.',
    steps: [
      'Asegúrate de permitir el acceso de geolocalización en tu navegador móvil o de escritorio.',
      'Usa el control deslizante de distancia (slider de kilómetros) para ajustar tu radio de acción de 1 km hasta 100 km.',
      'El sistema calculará las distancias por fórmula Haversine y listará únicamente los proyectos correspondientes.'
    ]
  },
  detalles: {
    title: 'Detalles y Carrusel',
    icon: '🃏',
    description: 'Explora la tarjeta interior de los eventos: galerías de fotos, descripción de actividades y mapas.',
    steps: [
      'Haz click en cualquier tarjeta de evento o lugar sustentable en el catálogo.',
      'Lee la descripción detallada, fechas y horarios en la ficha ampliada.',
      'Visualiza la galería de fotos cargadas y usa la ubicación integrada para trazar tu ruta de viaje.'
    ]
  },
  mapa: {
    title: 'Visor en Mapa',
    icon: '🗺️',
    description: 'Alterna al lienzo cartográfico para analizar la densidad de proyectos y planificar rutas de voluntariado.',
    steps: [
      'Haz click en "Ver Mapa" o accede directamente a la sección de Atlas Territorial.',
      'Verás marcadores interactivos que se agrupan (clustering) para evitar saturación visual.',
      'Selecciona cualquier pin para ver el resumen del proyecto en el panel flotante derecho y centrar la vista del carrusel.'
    ]
  },
  favoritos: {
    title: 'Guardar en Favoritos',
    icon: '❤️',
    description: 'Marca con un corazón los eventos, lecturas o lugares de interés para consultarlos en tu menú personal.',
    steps: [
      'En la vista de detalles de cualquier evento o lugar, presiona el botón "Guardar en Favoritos".',
      'El sistema enlazará el registro a tu cuenta en tiempo real.',
      'Visita tu menú de perfil y selecciona "Mis Favoritos" para consultar tus contenidos almacenados cuando lo desees.'
    ]
  },
  agentes: {
    title: 'Conectar con Agentes',
    icon: '👥',
    description: 'Visita perfiles de organizaciones validadas, consulta su historial y síguelos para recibir alertas.',
    steps: [
      'Accede a la sección de "Agentes de Cambio" para ver el listado de colectivos validados.',
      'Haz click en cualquiera para ver su banner, biografía, redes sociales y proyectos publicados.',
      'Presiona "+ Seguir" para recibir notificaciones directas en tu panel de alertas cada vez que publiquen novedades.'
    ]
  }
}
</script>

<template>
  <main class="guia-main-container" style="padding-top: 100px;">
    <!-- HERO SECTION -->
    <header class="guia-hero" style="margin-bottom: 2.5rem;">
      <h1>Guía para Visitantes y Voluntarios</h1>
      <p>Saca el máximo provecho de nuestras herramientas de exploración ciudadana para apoyar la restauración y conservación ambiental.</p>
    </header>

    <!-- VIDEOS & TUTORIALS GRID (COLLAPSIBLE ACCORDIONS) -->
    <section class="videos-grid">
      <article 
        v-for="(topic, key) in TOPICS_CONFIG" 
        :key="key" 
        class="video-card"
        style="height: max-content;"
      >
        <header class="video-card-header" @click="toggleTopic(key)">
          <span class="topic-icon">{{ topic.icon }}</span>
          <div style="flex-grow: 1; padding-right: 10px;">
            <h3>{{ topic.title }}</h3>
            <p>{{ topic.description }}</p>
          </div>
          <i 
            class="fa-solid fa-chevron-down dropdown-arrow" 
            :class="{ 'dropdown-open': expandedTopic === key }"
          ></i>
        </header>

        <transition name="fade">
          <div v-show="expandedTopic === key" class="video-card-body">
            <div class="written-guide-section">
              <h4><i class="fa-solid fa-book-open"></i> Guía Escrita Paso a Paso</h4>
              <ul class="steps-list">
                <li v-for="(step, idx) in topic.steps" :key="idx">
                  <span class="step-num">{{ idx + 1 }}</span>
                  <span class="step-text">{{ step }}</span>
                </li>
              </ul>
            </div>
            
            <div class="video-preview-section">
              <div class="video-player-container">
                <div class="video-placeholder">
                  <i class="fa-solid fa-video-slash"></i>
                  <span>Video tutorial en producción (Próximamente)</span>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </article>
    </section>

    <!-- BOTTOM CTA -->
    <footer class="guia-cta-footer">
      <p>¿Perteneces a un colectivo, parque o proyecto ambiental constituido?</p>
      <RouterLink to="/guia-actor" class="link-switch-rol">
        Consultar los tutoriales para Organizaciones y Actores Oficiales <i class="fa-solid fa-circle-arrow-right"></i>
      </RouterLink>
    </footer>
  </main>
</template>

<style>
@import '../assets/css/guia.css';

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
