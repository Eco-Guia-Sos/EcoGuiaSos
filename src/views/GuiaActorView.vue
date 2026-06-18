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
  theme: string
}

const TOPICS_CONFIG: Record<string, GuideTopic> = {
  acceso: {
    title: 'Solicitar acceso de Actor',
    icon: '📋',
    description: 'Paso a paso para registrar tu colectivo y el proceso de validación administrativa requerida.',
    steps: [
      'Crea una cuenta normal desde la vista "Súmate" con el correo de tu colectivo.',
      'Solicita la validación enviando tus credenciales oficiales de colectivo/parque al correo administrativo de la plataforma.',
      'Una vez aprobado, tu perfil cambiará de rol a "Actor", desbloqueando tu acceso al Panel de Administración principal.'
    ],
    theme: 'green'
  },
  recorrido: {
    title: 'Conocer el Panel Admin',
    icon: '🎛️',
    description: 'Visión general de la barra lateral, gestión de sesiones y el estado de tus métricas de impacto.',
    steps: [
      'Inicia sesión y haz click en "Administrar" en tu menú de perfil para acceder a `/admin`.',
      'Usa la barra lateral izquierda para navegar entre el Dashboard, tus Eventos y los Hubs Ecológicos.',
      'El panel es responsivo: en móviles puedes abrir el menú usando el ícono de hamburguesa en la parte superior.'
    ],
    theme: 'purple'
  },
  publicar: {
    title: 'Publicar un Evento',
    icon: '📝',
    description: 'Cómo estructurar títulos atractivos, describir actividades y clasificar la categoría correctamente.',
    steps: [
      'Haz click en "Eventos" en la barra lateral del Panel y presiona "Agregar Nuevo".',
      'Llena el formulario con título, descripción y clasifica en categorías como Talleres, Reforestación o Pláticas.',
      'Configura la fecha y hora de inicio/fin del evento, y define si es Gratuito, Pet-friendly o apto para niños.'
    ],
    theme: 'blue'
  },
  imagenes: {
    title: 'Subir imágenes al Storage',
    icon: '🖼️',
    description: 'Aprende a adjuntar y previsualizar imágenes optimizadas locales con compresión automática.',
    steps: [
      'En el formulario de creación, haz click en "Sube una imagen" o pega una URL directa.',
      'El cargador de archivos comprimirá la imagen localmente en formato `.webp` de forma automática.',
      'Esto reduce el peso de la imagen hasta en un 80% garantizando una carga rápida para usuarios móviles.'
    ],
    theme: 'teal'
  },
  coordenadas: {
    title: 'Captura de Ubicación',
    icon: '📍',
    description: 'Métodos para ingresar direcciones físicas y coordenadas de latitud/longitud precisas para el mapa.',
    steps: [
      'Ingresa la dirección en formato de texto legible (ej: Bosque de Chapultepec, CDMX).',
      'Ingresa las coordenadas de Latitud y Longitud del sitio de encuentro.',
      'Usa Google Maps en otra pestaña para buscar el lugar, haz click derecho y copia los dos números decimales directamente en los campos del panel.'
    ],
    theme: 'yellow'
  },
  revision: {
    title: 'Publicación y Revisión',
    icon: '🚀',
    description: 'Conoce el ciclo de vida de los eventos: desde el estado \'Pendiente\' hasta su aprobación pública.',
    steps: [
      'Al guardar un nuevo evento, este quedará en estado "Pendiente" y no será visible al público inmediatamente.',
      'Los administradores del sitio recibirán una alerta para verificar los datos y la coherencia ambiental de tu propuesta.',
      'Una vez aprobado, recibirás una notificación de sistema en tu perfil y el evento aparecerá en los catálogos y el Atlas Territorial.'
    ],
    theme: 'green'
  },
  perfil: {
    title: 'Editar Perfil Público',
    icon: '🌐',
    description: 'Cómo actualizar tu logotipo, biografía de tu colectivo y enlazar tus redes sociales oficiales.',
    steps: [
      'Accede a la pestaña "Mi Perfil" en el Panel de Administración.',
      'Sube tu logotipo y escribe tu biografía y misión principal.',
      'Añade enlaces de contacto: página web, Instagram, Facebook y tu número de WhatsApp para recibir consultas directas.'
    ],
    theme: 'purple'
  },
  gestion: {
    title: 'Gestionar Publicaciones',
    icon: '🗂️',
    description: 'Accede a tu historial de eventos creados para aplicar correcciones rápidas de texto o remover registros.',
    steps: [
      'Ve a la pestaña "Mis Eventos" o "Mis Lugares" en tu panel.',
      'Usa el botón de lápiz (editar) para corregir ortografías o actualizar fechas sobre registros existentes.',
      'Si un evento se canceló o deseas quitarlo, presiona el botón de basura (eliminar) para retirarlo al instante.'
    ],
    theme: 'blue'
  }
}
</script>

<template>
  <main class="guia-main-container" style="padding-top: 100px;">
    <!-- HERO SECTION -->
    <header class="guia-hero" style="margin-bottom: 2rem;">
      <h1>Guía para Actores y Organizaciones</h1>
      <p>Domina el Panel de Administración central para publicar actividades, amplificar tu convocatoria y gestionar tu huella en nuestra comunidad.</p>
    </header>

    <!-- SECURITY ALERT -->
    <div class="guia-alert">
      <div class="guia-alert-content">
        <i class="fa-solid fa-shield-halved"></i>
        <p><strong>Aviso de seguridad:</strong> El acceso a estas funciones requiere validación previa en la base de datos (rol de <em>Actor Oficial</em>).</p>
      </div>
      <RouterLink to="/auth?tab=signup" class="alert-link-auth">
        Solicitar validación de cuenta
      </RouterLink>
    </div>

    <!-- VIDEOS & TUTORIALS GRID (COLLAPSIBLE ACCORDIONS) -->
    <section class="videos-grid">
      <article 
        v-for="(topic, key) in TOPICS_CONFIG" 
        :key="key" 
        :class="['video-card', 'theme-' + topic.theme]"
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
      <p>¿Eres un ciudadano interesado en explorar el catálogo y sumarte a voluntariados?</p>
      <RouterLink to="/guia-usuario" class="link-switch-rol">
        Consultar los tutoriales de exploración para Visitantes y Voluntarios <i class="fa-solid fa-circle-arrow-right"></i>
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

/* Fix for alert link in custom styles */
.guia-alert {
  background: rgba(14, 165, 233, 0.1);
  border: 1px solid rgba(14, 165, 233, 0.2);
  border-radius: 16px;
  padding: 15px 25px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 15px;
}
.guia-alert-content {
  display: flex;
  align-items: center;
  gap: 15px;
  color: #cbd5e1;
}
.guia-alert-content i {
  color: #0ea5e9;
  font-size: 1.25rem;
}
.alert-link-auth {
  background: #0ea5e9;
  color: black;
  text-decoration: none;
  font-weight: 700;
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 0.85rem;
  transition: all 0.3s;
}
.alert-link-auth:hover {
  background: #0284c7;
  transform: translateY(-2px);
}
</style>
