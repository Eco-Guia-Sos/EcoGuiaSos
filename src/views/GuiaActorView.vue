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
  acceso: {
    title: 'Solicitar acceso de Actor',
    icon: '📋',
    description: 'Paso a paso para registrar tu colectivo o institución ambiental.',
    steps: [
      'Crea una cuenta normal desde la vista "Súmate" con el correo de tu colectivo.',
      'Solicita la validación enviando tus credenciales oficiales de colectivo/parque al correo administrativo de la plataforma.',
      'Una vez aprobado, tu perfil cambiará de rol a "Actor", desbloqueando tu acceso al Panel de Administración principal.'
    ]
  },
  recorrido: {
    title: 'Recorrido por el Panel Admin',
    icon: '🎛️',
    description: 'Visión general del entorno de administración centralizado.',
    steps: [
      'Inicia sesión y haz click en "Administrar" en tu menú de perfil para acceder a `/admin`.',
      'Usa la barra lateral izquierda para navegar entre el Dashboard, tus Eventos y los Hubs Ecológicos.',
      'El panel es responsivo: en móviles puedes abrir el menú usando el ícono de hamburguesa en la parte superior.'
    ]
  },
  publicar: {
    title: 'Publicar un Evento Ecológico',
    icon: '📝',
    description: 'Aprende a formular y clasificar propuestas ecológicas atractivas.',
    steps: [
      'Haz click en "Eventos" en la barra lateral del Panel y presiona "Agregar Nuevo".',
      'Llena el formulario con título, descripción y clasifica en categorías como Talleres, Reforestación o Pláticas.',
      'Configura la fecha y hora de inicio/fin del evento, y define si es Gratuito, Pet-friendly o apto para niños.'
    ]
  },
  imagenes: {
    title: 'Subir Imágenes al Storage',
    icon: '🖼️',
    description: 'Añade impacto visual a tus publicaciones con imágenes optimizadas.',
    steps: [
      'En el formulario de creación, haz click en "Sube una imagen" o pega una URL directa.',
      'El cargador de archivos comprimirá la imagen localmente en formato `.webp` de forma automática.',
      'Esto reduce el peso de la imagen hasta en un 80% garantizando una carga rápida para usuarios móviles.'
    ]
  },
  coordenadas: {
    title: 'Captura Precisa de Ubicación',
    icon: '📍',
    description: 'Georreferencia tu evento para mostrarlo en el mapa y radar.',
    steps: [
      'Ingresa la dirección en formato de texto legible (ej: Bosque de Chapultepec, CDMX).',
      'Ingresa las coordenadas de Latitud y Longitud del sitio de encuentro.',
      'Usa Google Maps en otra pestaña para buscar el lugar, haz click derecho y copia los dos números decimales directamente en los campos del panel.'
    ]
  },
  revision: {
    title: 'Ciclo de Revisión y Moderación',
    icon: '🚀',
    description: 'Conoce cómo se aprueban las propuestas en la plataforma.',
    steps: [
      'Al guardar un nuevo evento, este quedará en estado "Pendiente" y no será visible al público inmediatamente.',
      'Los administradores del sitio recibirán una alerta para verificar los datos y la coherencia ambiental de tu propuesta.',
      'Una vez aprobado, recibirás una notificación de sistema en tu perfil y el evento aparecerá en los catálogos y el Atlas Territorial.'
    ]
  },
  perfil: {
    title: 'Editar Perfil Público',
    icon: '🌐',
    description: 'Configura la carta de presentación de tu colectivo.',
    steps: [
      'Accede a la pestaña "Mi Perfil" en el Panel de Administración.',
      'Sube tu logotipo y escribe tu biografía y misión principal.',
      'Añade enlaces de contacto: página web, Instagram, Facebook y tu número de WhatsApp para recibir consultas directas.'
    ]
  },
  gestion: {
    title: 'Gestionar Publicaciones',
    icon: '🗂️',
    description: 'Edita, duplica o remueve tus eventos creados.',
    steps: [
      'Ve a la pestaña "Mis Eventos" o "Mis Lugares" en tu panel.',
      'Usa el botón de lápiz (editar) para corregir ortografías o actualizar fechas sobre registros existentes.',
      'Si un evento se canceló o deseas quitarlo, presiona el botón de basura (eliminar) para retirarlo al instante.'
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

    <!-- VIDEOS & TUTORIALS GRID -->
    <section class="videos-grid">
      
      <!-- Video Card: Solicitar Acceso -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">📋</span>
          <div>
            <h3>Solicitar acceso de Actor</h3>
            <p>Paso a paso para registrar tu colectivo y el proceso de validación administrativa requerida.</p>
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
          <button class="btn-read-guide" @click="openGuide('acceso')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Recorrido por el Panel -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">🎛️</span>
          <div>
            <h3>Conocer el Panel Admin</h3>
            <p>Visión general de la barra lateral, gestión de sesiones y el estado de tus métricas de impacto.</p>
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
          <button class="btn-read-guide" @click="openGuide('recorrido')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Publicar Evento -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">📝</span>
          <div>
            <h3>Publicar un Evento</h3>
            <p>Cómo estructurar títulos atractivos, describir actividades y clasificar la categoría correctamente.</p>
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
          <button class="btn-read-guide" @click="openGuide('publicar')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Subir Imágenes -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">🖼️</span>
          <div>
            <h3>Subir imágenes al Storage</h3>
            <p>Aprende a adjuntar y previsualizar imágenes optimizadas locales con compresión automática.</p>
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
          <button class="btn-read-guide" @click="openGuide('imagenes')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Georreferenciación -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">📍</span>
          <div>
            <h3>Captura de Ubicación</h3>
            <p>Métodos para ingresar direcciones físicas y coordenadas de latitud/longitud precisas para el mapa.</p>
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
          <button class="btn-read-guide" @click="openGuide('coordenadas')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Proceso de publicación -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">🚀</span>
          <div>
            <h3>Publicación y Revisión</h3>
            <p>Conoce el ciclo de vida de los eventos: desde el estado 'Pendiente' hasta su aprobación pública.</p>
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
          <button class="btn-read-guide" @click="openGuide('revision')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Editar Perfil -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">🌐</span>
          <div>
            <h3>Editar Perfil Público</h3>
            <p>Cómo actualizar tu logotipo, biografía de tu colectivo y enlazar tus redes sociales oficiales.</p>
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
          <button class="btn-read-guide" @click="openGuide('perfil')">Leer guía</button>
        </footer>
      </article>

      <!-- Video Card: Gestionar Publicaciones -->
      <article class="video-card">
        <header class="video-card-header">
          <span class="topic-icon">🗂️</span>
          <div>
            <h3>Gestionar Publicaciones</h3>
            <p>Accede a tu historial de eventos creados para aplicar correcciones rápidas de texto o remover registros.</p>
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
          <button class="btn-read-guide" @click="openGuide('gestion')">Leer guía</button>
        </footer>
      </article>

    </section>

    <!-- BOTTOM CTA -->
    <footer class="guia-cta-footer">
      <p>¿Eres un ciudadano interesado en explorar el catálogo y sumarte a voluntariados?</p>
      <RouterLink to="/guia-usuario" class="link-switch-rol">
        Consultar los tutoriales de exploración para Visitantes y Voluntarios <i class="fa-solid fa-circle-arrow-right"></i>
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
