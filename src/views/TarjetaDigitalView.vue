<template>
  <div class="tarjeta-digital-page-container">
    <!-- Preloader -->
    <div v-if="loading" id="preloader">
      <div class="haku-visual-container">
        <img src="/logo-app.webp" alt="EcoGuía SOS Cargando" class="preloader-logo" />
      </div>
      <div class="loading-text animate">
        <span>C</span><span>a</span><span>r</span><span>g</span><span>a</span><span>n</span><span>d</span><span>o</span>
      </div>
    </div>

    <!-- FONDO DE PARTÍCULAS (CONSTELACIÓN) -->
    <div id="particles-js"></div>

    <!-- Main Wrapper -->
    <div class="card-wrapper">
      <!-- Header Card -->
      <header class="card header-card fade-in">
        <div class="top-actions">
          <button @click="copyContactInfo" class="action-btn" title="Copiar datos de contacto">
            <i class="fa-regular fa-address-card"></i>
          </button>
          <button @click="shareProfile" class="action-btn" title="Compartir perfil">
            <i class="fa-solid fa-share-nodes"></i>
          </button>
        </div>

        <div class="avatar-container" @click="showQrModal = true" title="Ver código QR oficial">
          <img class="avatar-img" :src="avatarUrl" alt="Logo de la Asociación" onerror="this.src='/logo-app.webp'" />
          <div class="avatar-overlay">
            <i class="fa-solid fa-qrcode"></i>
          </div>
        </div>

        <h1 class="typewriter-title">{{ name }}</h1>

        <div class="header-button-container">
          <RouterLink to="/" class="btn-portafolio">
            <i class="fa-solid fa-seedling" style="color: #72b04d;"></i>
            <span>Ir a EcoGuía SOS</span>
          </RouterLink>
        </div>
      </header>

      <!-- Profile Section -->
      <section class="card profile-card fade-in">
        <h2 class="txt-eco">Perfil</h2>
        <p>{{ description }}</p>
      </section>

      <!-- Contact List Section -->
      <section class="card contact-card fade-in">
        <h2 class="card-title">Contacto</h2>
        <ul class="contact-list">
          <!-- 1. LinkedIn (Full Width) -->
          <li v-if="networks.linkedin" class="full-width">
            <a :href="networks.linkedin" target="_blank" rel="noopener" class="contact-link btn-linkedin">
              <i class="fa-brands fa-linkedin"></i>
              <span>Ver Perfil de LinkedIn</span>
            </a>
          </li>

          <!-- 2. Correo Principal (Full Width) -->
          <li v-if="networks.email" class="full-width">
            <a :href="`mailto:${networks.email}`" class="contact-link btn-email-yellow">
              <i class="fa-solid fa-envelope"></i>
              <span>{{ networks.email }}</span>
            </a>
          </li>

          <!-- 3. Correo Alternativo (Full Width) -->
          <li v-if="networks.email_alterno" class="full-width">
            <a :href="`mailto:${networks.email_alterno}`" class="contact-link btn-email-pink">
              <i class="fa-solid fa-envelope"></i>
              <span>{{ networks.email_alterno }}</span>
            </a>
          </li>

          <!-- 4. WhatsApp (Col 1) -->
          <li v-if="networks.whatsapp">
            <a :href="networks.whatsapp" target="_blank" rel="noopener" class="contact-link btn-whatsapp">
              <i class="fa-brands fa-whatsapp"></i>
              <span>WhatsApp</span>
            </a>
          </li>

          <!-- 5. EcoGuía SOS (Col 2) -->
          <li>
            <RouterLink to="/" class="contact-link btn-ecoguia-purple">
              <i class="fa-solid fa-seedling"></i>
              <span>EcoGuiaSOS</span>
            </RouterLink>
          </li>

          <!-- 6. Twitter / X (Col 1) -->
          <li v-if="networks.twitter">
            <a :href="networks.twitter" target="_blank" rel="noopener" class="contact-link btn-x">
              <i class="fa-brands fa-x-twitter"></i>
              <span>Twitter</span>
            </a>
          </li>

          <!-- 7. Facebook (Col 2) -->
          <li v-if="networks.facebook">
            <a :href="networks.facebook" target="_blank" rel="noopener" class="contact-link btn-facebook">
              <i class="fa-brands fa-facebook"></i>
              <span>Facebook</span>
            </a>
          </li>

          <!-- 8. Instagram (Col 1) -->
          <li v-if="networks.instagram">
            <a :href="networks.instagram" target="_blank" rel="noopener" class="contact-link btn-instagram">
              <i class="fa-brands fa-instagram"></i>
              <span>Instagram</span>
            </a>
          </li>

          <!-- 9. TikTok (Col 2) -->
          <li v-if="networks.tiktok">
            <a :href="networks.tiktok" target="_blank" rel="noopener" class="contact-link btn-tiktok">
              <i class="fa-brands fa-tiktok"></i>
              <span>TikTok</span>
            </a>
          </li>
        </ul>
      </section>

      <!-- Footer -->
      <footer class="footer-card fade-in">
        <div class="footer-center-content">
          <div class="brand-sello" @click="showQrModal = true" title="Ver QR">
            <img src="/logo-app.webp" alt="EcoGuía SOS" />
          </div>
          <p class="copyright">© 2026 Ecoguiasos.com</p>
        </div>
      </footer>
    </div>

    <!-- QR Modal -->
    <div v-if="showQrModal" class="qr-modal-backdrop" @click="showQrModal = false">
      <div class="qr-modal-content" @click.stopPropagation>
        <button class="modal-close" @click="showQrModal = false">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <h3 class="txt-eco">Código QR Oficial</h3>
        <div class="qr-code-box">
          <img :src="qrUrl || defaultQrUrl" alt="QR Code" />
        </div>
        <p>Escanea este código para guardar los datos de contacto directamente en tu dispositivo.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../services/supabase.service'

declare const particlesJS: any

const loading = ref(true)
const showQrModal = ref(false)

const name = ref('EcoGuía SOS')
const description = ref('Cargando información...')
const qrUrl = ref('')
const avatarUrl = ref('/logo-app.webp')
const defaultQrUrl = ref('https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://ecoguiasos.com/tarjeta-digital')
const networks = ref<any>({})

const initParticles = () => {
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
}

onMounted(async () => {
  // Load configuration from database
  try {
    const { data, error } = await supabase
      .from('config_plataforma')
      .select('redes_sociales')
      .eq('id', 1)
      .maybeSingle()

    if (error) throw error

    if (data && data.redes_sociales?.tarjeta) {
      const t = data.redes_sociales.tarjeta
      name.value = t.nombre || 'EcoGuía SOS'
      description.value = t.descripcion || 'Plataforma ambiental para la difusión y participación en iniciativas, eventos y ecotecnologías.'
      qrUrl.value = t.qr_url || ''
      avatarUrl.value = t.avatar_url || '/logo-app.webp'
      
      // Load actual links or set default false links for review
      networks.value = {
        linkedin: t.linkedin || 'https://www.linkedin.com',
        email: t.email || 'contacto@ecoguiasos.com',
        email_alterno: t.email_alterno || 'soporte@ecoguiasos.com',
        whatsapp: t.whatsapp || 'https://wa.me/5215586864746',
        twitter: t.twitter || 'https://x.com',
        facebook: t.facebook || 'https://facebook.com',
        instagram: t.instagram || 'https://instagram.com',
        tiktok: t.tiktok || 'https://tiktok.com'
      }
    } else {
      name.value = 'EcoGuía SOS'
      description.value = 'Plataforma de divulgación de eventos y Acción Ambiental para la preservación de la biodiversidad.'
      networks.value = {
        linkedin: 'https://www.linkedin.com',
        email: 'contacto@ecoguiasos.com',
        email_alterno: 'soporte@ecoguiasos.com',
        whatsapp: 'https://wa.me/5215586864746',
        twitter: 'https://x.com',
        facebook: 'https://facebook.com',
        instagram: 'https://instagram.com',
        tiktok: 'https://tiktok.com'
      }
    }
  } catch (err) {
    console.error('Error loading config:', err)
  } finally {
    loading.value = false
    // Init background particles after loading hides
    setTimeout(() => initParticles(), 100)
  }
})

const copyContactInfo = () => {
  let contactText = `${name.value}
Plataforma de Acción Ambiental`

  if (description.value) contactText += `\n${description.value}`
  if (networks.value.email) contactText += `\nCorreo: ${networks.value.email}`
  if (networks.value.whatsapp) contactText += `\nWhatsApp: ${networks.value.whatsapp}`

  navigator.clipboard.writeText(contactText)
    .then(() => alert('¡Datos de contacto copiados al portapapeles!'))
    .catch(() => alert('No se pudo copiar la información.'))
}

const shareProfile = async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: `${name.value} - Tarjeta Digital`,
        text: `Conoce los datos de contacto oficial de ${name.value}.`,
        url: window.location.href
      })
    } catch (err) {
      console.log('Error al compartir:', err)
    }
  } else {
    navigator.clipboard.writeText(window.location.href)
      .then(() => alert('¡Enlace de perfil copiado al portapapeles!'))
      .catch(() => {})
  }
}
</script>

<style scoped>
/* Page container wrapper to override global body colors */
.tarjeta-digital-page-container {
  min-height: 100vh;
  width: 100%;
  background-color: #050811 !important;
  position: relative;
  z-index: 1;
  overflow-x: hidden;
  box-sizing: border-box;
  padding: 40px 0 80px 0;
}

/* Color variables of EcoGuía SOS */
.txt-eco { color: #72B04D !important; }
.txt-gaia { color: #0077b6 !important; }
.txt-sos { color: #FFD700 !important; }

/* Preloader */
#preloader {
  position: fixed;
  inset: 0;
  background: #000000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 99999;
}

.haku-visual-container {
  margin-bottom: 20px;
  animation: pulse-preloader 1.5s infinite ease-in-out;
}

.preloader-logo {
  width: 100px;
  height: 100px;
  object-fit: contain;
}

.loading-text {
  display: flex;
  gap: 3px;
  font-family: 'Outfit', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #72b04d;
}

.loading-text span {
  animation: loading-letter 1.4s infinite ease-in-out;
}
.loading-text span:nth-child(1) { animation-delay: 0s; }
.loading-text span:nth-child(2) { animation-delay: 0.1s; }
.loading-text span:nth-child(3) { animation-delay: 0.2s; }
.loading-text span:nth-child(4) { animation-delay: 0.3s; }
.loading-text span:nth-child(5) { animation-delay: 0.4s; }
.loading-text span:nth-child(6) { animation-delay: 0.5s; }
.loading-text span:nth-child(7) { animation-delay: 0.6s; }
.loading-text span:nth-child(8) { animation-delay: 0.7s; }

@keyframes loading-letter {
  0%, 100% { transform: translateY(0); opacity: 0.5; }
  50% { transform: translateY(-8px); opacity: 1; }
}

@keyframes pulse-preloader {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* Background particles layer */
#particles-js {
  position: fixed;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  z-index: 0; /* Above body wrapper, behind cards wrapper */
  pointer-events: none;
}

/* Card layout container */
.card-wrapper {
  max-width: 480px;
  width: 90%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
  font-family: 'Outfit', sans-serif;
  position: relative;
  z-index: 2; /* Renders above particles */
}

/* Card base with white glow like Nosotros */
.card {
  background: #0d0f14;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 28px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4);
  position: relative;
  overflow: hidden;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.3s ease;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  text-align: left !important;
}

.card:hover {
  transform: translateY(-4px);
}

/* Custom glows */
.header-card {
  box-shadow: 0 0 25px rgba(114, 176, 77, 0.25), 0 4px 30px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(114, 176, 77, 0.3) !important;
  align-items: center !important;
  text-align: center !important;
  border-left: none !important;
}
.header-card:hover {
  border-color: rgba(114, 176, 77, 0.55) !important;
  box-shadow: 0 0 35px rgba(114, 176, 77, 0.45), 0 8px 40px rgba(0, 0, 0, 0.5);
}

.profile-card {
  box-shadow: 0 0 25px rgba(255, 215, 0, 0.1), 0 4px 30px rgba(0, 0, 0, 0.4);
  border-left: 4px solid #8e44ad !important; /* Left indicator style from example */
  border-image: linear-gradient(to bottom, #8e44ad, #0077b6) 1 100%;
}
.profile-card:hover {
  box-shadow: 0 0 35px rgba(255, 215, 0, 0.2), 0 8px 40px rgba(0, 0, 0, 0.5);
}

.contact-card {
  box-shadow: 0 0 25px rgba(0, 119, 182, 0.12), 0 4px 30px rgba(0, 0, 0, 0.4);
  border-left: 4px solid #0077b6 !important;
}
.contact-card:hover {
  box-shadow: 0 0 35px rgba(0, 119, 182, 0.25), 0 8px 40px rgba(0, 0, 0, 0.5);
}

/* Header contents */
.header-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: 50px;
}

.top-actions {
  position: absolute;
  top: 15px;
  left: 15px;
  right: 15px;
  display: flex;
  justify-content: space-between;
}

.action-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255,255,255,0.08);
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.action-btn:hover {
  background: rgba(114, 176, 77, 0.2);
  color: #72b04d;
  border-color: rgba(114, 176, 77, 0.4);
  transform: scale(1.1) rotate(5deg);
}

/* QR / Avatar Photo */
.avatar-container {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 3px solid #72b04d;
  padding: 4px;
  cursor: pointer;
  margin-bottom: 20px;
  box-shadow: 0 0 25px rgba(114, 176, 77, 0.7); /* Bright green glow */
  background: #0d0f14;
  transition: all 0.3s ease;
}

.avatar-container:hover {
  transform: scale(1.05);
  box-shadow: 0 0 35px rgba(114, 176, 77, 0.9);
  border-color: #72b04d;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background: #0d0f14;
}

.avatar-overlay {
  position: absolute;
  inset: 4px;
  background: rgba(0,0,0,0.65);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.avatar-container:hover .avatar-overlay {
  opacity: 1;
}

/* Title */
.typewriter-title {
  color: #72b04d;
  font-size: 1.9rem;
  font-weight: 800;
  margin: 5px 0 25px 0;
  letter-spacing: 0.5px;
  text-shadow: 0 0 10px rgba(114, 176, 77, 0.35);
}

.header-button-container {
  width: 100%;
}

/* Briefcase / Seedling button from screenshot */
.btn-portafolio {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #ffffff;
  color: #111111;
  border-radius: 14px;
  padding: 12px 28px;
  font-weight: 700;
  font-size: 0.95rem;
  text-decoration: none;
  box-shadow: 0 4px 15px rgba(255,255,255,0.25);
  transition: all 0.3s ease;
}

.btn-portafolio:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255,255,255,0.4);
}

/* Sections titles */
.profile-card h2, .contact-card h2 {
  font-size: 1.3rem;
  font-weight: 800;
  margin-top: 0;
  margin-bottom: 18px;
  letter-spacing: 0.5px;
}

.contact-card h2 {
  color: #ffffff;
}

.profile-card p {
  color: rgba(255,255,255,0.9);
  font-size: 0.98rem;
  line-height: 1.7;
  margin: 0;
}

/* Contact Grid matching screenshot exactly */
.contact-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
}

.contact-list li {
  width: 100%;
}

.contact-list li.full-width {
  grid-column: span 2;
}

.contact-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 15px;
  border-radius: 12px;
  color: white;
  font-size: 0.95rem;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-sizing: border-box;
  text-align: center;
}

.contact-link i {
  font-size: 1.3rem;
}

.contact-link:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.4);
  filter: brightness(1.1);
}

/* Exact screenshot colors */
.btn-linkedin {
  background: #0077b5;
}

.btn-email-yellow {
  background: #f1c40f;
  color: #111111 !important;
}

.btn-email-pink {
  background: #ff3f6c;
}

.btn-whatsapp {
  background: #5ebb73;
}

.btn-ecoguia-purple {
  background: #9b59b6;
}

.btn-x {
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.btn-facebook {
  background: #1877f2;
}

.btn-instagram {
  background: #ff5a3c;
}

.btn-tiktok {
  background: #ffffff;
  color: #111111 !important;
}

/* Footer Section */
.footer-card {
  display: flex !important;
  flex-direction: row !important;
  justify-content: center !important;
  align-items: center !important;
  width: 100% !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 20px 10px !important;
  box-sizing: border-box;
}

.footer-center-content {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 12px !important;
}

.brand-sello {
  width: 38px;
  height: 38px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 4px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.brand-sello img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand-sello:hover {
  transform: scale(1.1) rotate(15deg);
  border-color: #0077b6;
  box-shadow: 0 0 12px rgba(0, 119, 182, 0.4);
}

.copyright {
  margin: 0;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.85rem;
  font-weight: 600;
}

/* QR Modal */
.qr-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fade-in 0.3s ease;
}

.qr-modal-content {
  background: rgba(20, 20, 20, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 28px;
  width: 90%;
  max-width: 380px;
  padding: 30px;
  text-align: center;
  position: relative;
  box-shadow: 0 0 30px rgba(114, 176, 77, 0.2);
  font-family: 'Outfit', sans-serif;
  color: white;
}

.modal-close {
  position: absolute;
  top: 15px;
  right: 15px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.6);
  font-size: 1.2rem;
  cursor: pointer;
  transition: color 0.3s ease;
}

.modal-close:hover {
  color: #72b04d;
}

.qr-modal-content h3 {
  margin-top: 0;
  font-size: 1.3rem;
  font-weight: 700;
  text-transform: uppercase;
}

.qr-code-box {
  background: white;
  padding: 12px;
  border-radius: 18px;
  display: inline-block;
  margin: 15px 0;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
}

.qr-code-box img {
  display: block;
  max-width: 200px;
  height: auto;
}

.qr-modal-content p {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.7);
  line-height: 1.5;
  margin: 5px 0 0 0;
}

/* Animations */
.fade-in {
  animation: card-appear 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
}

.header-card.fade-in { animation-delay: 0.1s; }
.profile-card.fade-in { animation-delay: 0.2s; }
.contact-card.fade-in { animation-delay: 0.3s; }
.footer-card.fade-in { animation-delay: 0.4s; }

@keyframes card-appear {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Responsive spacing */
@media (max-width: 480px) {
  .tarjeta-digital-page-container {
    padding: 20px 0 40px 0;
  }
  .card-wrapper {
    gap: 18px;
  }
  .card {
    padding: 22px;
    border-radius: 20px;
  }
  .typewriter-title {
    font-size: 1.6rem;
  }
}
</style>
