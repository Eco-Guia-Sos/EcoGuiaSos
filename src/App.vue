<script setup lang="ts">
import { ref, onMounted, computed, watch, onErrorCaptured } from 'vue'
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import { useAuthStore } from './stores/authStore'
import { useHomeStore } from './stores/homeStore'
import { supabase } from './services/supabase.service'
import * as Sentry from '@sentry/vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const homeStore = useHomeStore()

const routerLoading = ref(false)
const showGlobalLoader = computed(() => {
  return authStore.loading || homeStore.loading || routerLoading.value
})

// Menu toggles
const isMenuOpen = ref(false)
const isUserDropdownOpen = ref(false)
const isNotifDropdownOpen = ref(false)

// Notifications state
const unreadCount = ref(0)
const notifications = ref<any[]>([])
const isNotifLoading = ref(false)
const selectedNotification = ref<any | null>(null)
const isNotifModalOpen = ref(false)

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = () => {
  isMenuOpen.value = false
}

const toggleUserDropdown = (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
  isUserDropdownOpen.value = !isUserDropdownOpen.value
  isNotifDropdownOpen.value = false
}

const toggleNotifDropdown = (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
  isNotifDropdownOpen.value = !isNotifDropdownOpen.value
  isUserDropdownOpen.value = false
  
  if (isNotifDropdownOpen.value && authStore.user) {
    cargarNotificaciones()
  }
}

const closeDropdowns = () => {
  isUserDropdownOpen.value = false
  isNotifDropdownOpen.value = false
}

const displayName = computed(() => {
  const name = authStore.profile?.nombre_completo || authStore.user?.email?.split('@')[0] || 'Hola'
  return name.split(' ')[0]
})

const userAvatar = computed(() => {
  return authStore.profile?.avatar_url || localStorage.getItem('eco_user_avatar') || ''
})

const isAdminOrActor = computed(() => {
  const role = authStore.profile?.rol || localStorage.getItem('eco_user_role') || 'user'
  return role === 'admin' || role === 'actor'
})

// Logout
const handleLogout = async () => {
  await authStore.logout()
  closeDropdowns()
  closeMenu()
  router.push('/')
}

// Fetch notification count
const checkUnreadNotifications = async (userId: string) => {
  try {
    const { count, error } = await supabase
      .from('notificaciones_usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', userId)
      .eq('leido', false)

    if (!error && count !== null) {
      unreadCount.value = count
    }
  } catch (e) {
    console.error('Error fetching notification count:', e)
  }
}

// Load notifications list
const cargarNotificaciones = async () => {
  if (!authStore.user) return
  isNotifLoading.value = true
  try {
    const { data, error } = await supabase
      .from('notificaciones_usuarios')
      .select('id, leido, created_at, notificaciones(id, titulo, mensaje, enlace_url, archivo_url)')
      .eq('usuario_id', authStore.user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error
    notifications.value = data || []
  } catch (err) {
    console.error('Error fetching notifications list:', err)
  } finally {
    isNotifLoading.value = false
  }
}

// Mark specific notification as read
const abrirNotificacion = async (n: any) => {
  if (!n.leido) {
    n.leido = true
    if (unreadCount.value > 0) unreadCount.value--
    
    // Update in DB asynchronously
    supabase
      .from('notificaciones_usuarios')
      .update({ leido: true, leido_at: new Date().toISOString() })
      .eq('id', n.id)
      .then()
  }

  selectedNotification.value = n.notificaciones
  isNotifModalOpen.value = true
  isNotifDropdownOpen.value = false
}

// Mark all as read
const markAllAsRead = async () => {
  if (!authStore.user) return
  try {
    const { error } = await supabase
      .from('notificaciones_usuarios')
      .update({ leido: true, leido_at: new Date().toISOString() })
      .eq('usuario_id', authStore.user.id)
      .eq('leido', false)

    if (!error) {
      unreadCount.value = 0
      notifications.value.forEach(n => n.leido = true)
    }
  } catch (e) {
    console.error('Error marking notifications as read:', e)
  }
}

// Watch user state to fetch notification count
watch(() => authStore.user, (newUser) => {
  if (newUser) {
    checkUnreadNotifications(newUser.id)
  } else {
    unreadCount.value = 0
    notifications.value = []
  }
})

// Rutas de admin y de atlas de mapa — layout completamente independiente (sin navbar ni footer del sitio)
const isFullLayoutHidden = computed(() =>
  route.path.startsWith('/admin') || route.path === '/mapa'
)

// Rutas que necesitan fondo oscuro (todas excepto Home y Mapa)
const darkRoutes = [
  '/cursos', '/ecotecnias', '/agua', '/lecturas', '/documentales', '/firmas',
  '/agentes', '/voluntariados', '/convocatoria', '/normativa', '/fondos',
  '/nosotros', '/auth', '/como-usar', '/favoritos', '/admin',
  '/eventos/', '/lugares/', '/guia-usuario', '/guia-actor',
  '/reset-password', '/admin-login'
]

watch(() => route.path, (newPath) => {
  const isDark = darkRoutes.some(r => newPath.startsWith(r))
  if (isDark) {
    document.body.classList.add('dark-theme')
  } else {
    document.body.classList.remove('dark-theme')
  }
}, { immediate: true })

onMounted(() => {
  authStore.init()

  // Listen to route changes to trigger loading
  router.beforeEach((to, from) => {
    routerLoading.value = true
  })

  router.afterEach(() => {
    setTimeout(() => {
      routerLoading.value = false
    }, 300)
  })

  // Close dropdowns on window click
  window.addEventListener('click', () => {
    closeDropdowns()
  })
})

const globalError = ref<string | null>(null)

onErrorCaptured((err, instance, info) => {
  console.error('Global error captured:', err, info)
  Sentry.captureException(err)
  globalError.value = 'Ocurrió un error inesperado en la aplicación. Por favor, intenta de nuevo.'
  return false // Stop propagation
})
</script>

<template>
  <div>
    <!-- GLOBAL LOADING SCREEN -->
    <transition name="fade">
      <div v-if="showGlobalLoader" class="global-page-loader">
        <div class="loader-content">
          <img src="/assets/gif/EGSBOOK.webp" alt="EcoGuía SOS Cargando..." class="loader-gif" />
          <p class="loader-text">Cargando...</p>
        </div>
      </div>
    </transition>

    <!-- Banner de error global -->
    <div v-if="globalError" class="global-error-banner" style="background-color: #ef4444; color: white; padding: 12px; text-align: center; font-weight: 600; display: flex; justify-content: center; align-items: center; gap: 15px; position: sticky; top: 0; z-index: 100000;">
      <span>{{ globalError }}</span>
      <button @click="globalError = null" style="background: transparent; border: 1px solid white; color: white; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Cerrar</button>
    </div>

    <!-- BARRA DE NAVEGACIÓN SUPERIOR (ESTANDARIZADA) — oculta en admin y mapa -->
    <nav v-if="!isFullLayoutHidden" class="main-nav">
      <div class="nav-container">
        <RouterLink to="/" class="nav-brand" @click="closeMenu(); closeDropdowns()">
          <img src="/assets/img/logo-navbar.webp" alt="Logo EcoGuía SOS" class="nav-brand-logo" />
          <h1>EcoGuía SOS</h1>
        </RouterLink>

        <!-- Dynamic elements wrapper on navbar -->
        <div class="nav-actions-wrapper" style="display: flex; align-items: center; gap: 15px;">
          <!-- Notification Bell -->
          <div v-if="authStore.user" class="nav-notif-item" @click.stop>
            <a 
              href="#" 
              class="nav-notif-btn" 
              id="notif-bell-btn"
              @click="toggleNotifDropdown"
            >
              <i class="fa-solid fa-bell"></i>
              <span v-if="unreadCount > 0" class="notif-badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
            </a>
            
            <!-- Notifications Dropdown -->
            <div 
              class="notif-dropdown" 
              :class="{ 'hidden': !isNotifDropdownOpen }"
              id="notif-dropdown"
              style="position: absolute; top: 100%; right: 0; z-index: 10000;"
            >
              <div class="notif-dropdown-header">
                <span>Notificaciones</span>
                <button @click="markAllAsRead" style="background:none; border:none; color:#10b981; font-size:0.75rem; cursor:pointer;">Marcar todas</button>
              </div>
              <div class="notif-dropdown-body">
                <p v-if="isNotifLoading" class="notif-empty">Cargando...</p>
                <p v-else-if="notifications.length === 0" class="notif-empty">No tienes notificaciones.</p>
                <template v-else>
                  <div 
                    v-for="n in notifications" 
                    :key="n.id" 
                    class="notif-item-mini"
                    :class="{ 'nueva': !n.leido, 'leida': n.leido }"
                    @click="abrirNotificacion(n)"
                  >
                    <div class="notif-dot"></div>
                    <div class="notif-content">
                      <h5 v-if="n.notificaciones">{{ n.notificaciones.titulo || 'Notificación' }}</h5>
                      <p v-if="n.notificaciones">{{ n.notificaciones.mensaje || '' }}</p>
                      <span>{{ new Date(n.created_at).toLocaleDateString() }}</span>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <button class="hamburger-menu" aria-label="Abrir menú" @click.stop="toggleMenu">
            <i class="fa-solid fa-bars"></i>
          </button>
        </div>

        <ul class="nav-menu" :class="{ 'active': isMenuOpen }" id="nav-menu-list">
          <li><RouterLink to="/" class="nav-blue-btn" @click="closeMenu(); closeDropdowns()">Inicio</RouterLink></li>
          <li><RouterLink to="/nosotros" class="nav-purple-btn" @click="closeMenu(); closeDropdowns()">Nosotros</RouterLink></li>
          <li><RouterLink to="/como-usar" class="nav-how-to-btn" @click="closeMenu(); closeDropdowns()">Cómo usar</RouterLink></li>
          
          <!-- User Dropdown (Logged In) -->
          <li v-if="authStore.user" class="nav-user-dropdown-container" @click.stop style="position: relative;">
            <a 
              href="#" 
              class="nav-btn-highlight nav-user-dropdown-btn" 
              id="nav-auth-btn" 
              @click="toggleUserDropdown"
            >
              <i class="fa-solid fa-user"></i> {{ displayName }} 
              <i class="fa-solid fa-chevron-down" style="width:14px; height:14px; margin-left:5px;"></i>
            </a>
            
            <!-- User Dropdown Menu -->
            <div 
              class="user-dropdown-menu" 
              :class="{ 'active': isUserDropdownOpen }"
              id="user-dropdown-menu"
            >
              <div class="dropdown-user-header">
                <div 
                  class="user-avatar-small" 
                  :style="userAvatar ? `background-image: url(${userAvatar}); background-size: cover; background-position: center; border: none;` : ''"
                >
                  <i v-if="!userAvatar" class="fa-solid fa-user"></i>
                </div>
                <div class="user-info-text">
                  <span class="user-display-name">{{ displayName }}</span>
                  <span class="user-email-text">{{ authStore.user.email }}</span>
                </div>
              </div>
              <div class="dropdown-divider"></div>
              
              <!-- Panel for Admin/Actor -->
              <RouterLink v-if="isAdminOrActor" to="/admin" class="dropdown-item" @click="closeDropdowns(); closeMenu()">
                <i class="fa-solid fa-gauge"></i> Mi Panel
              </RouterLink>
              
              <!-- Profile link -->
              <RouterLink :to="`/agentes/${authStore.user.id}`" class="dropdown-item" @click="closeDropdowns(); closeMenu()">
                <i class="fa-solid fa-circle-user"></i> Mi Perfil
              </RouterLink>

              <!-- Favorites link -->
              <RouterLink to="/favoritos" class="dropdown-item" @click="closeDropdowns(); closeMenu()">
                <i class="fa-solid fa-star"></i> Mis Favoritos
              </RouterLink>
              
              <div class="dropdown-divider"></div>
              <a href="#" @click.prevent="handleLogout" class="dropdown-item logout">
                <i class="fa-solid fa-sign-out-alt"></i> Cerrar Sesión
              </a>
            </div>
          </li>

          <!-- Login/Signup Links (Logged Out) -->
          <template v-else>
            <li><RouterLink to="/auth?tab=signup" class="nav-btn-highlight" id="nav-auth-btn" @click="closeMenu(); closeDropdowns()">Súmate</RouterLink></li>
            <li><RouterLink to="/auth?tab=login" class="nav-login-btn" id="nav-login-btn" @click="closeMenu(); closeDropdowns()">Iniciar sesión</RouterLink></li>
          </template>
        </ul>
      </div>
    </nav>

    <!-- VISTA DINÁMICA -->
    <RouterView />

    <!-- FOOTER — oculto en admin y mapa -->
    <footer v-if="!isFullLayoutHidden">
      <div class="footer-content">
        <div class="footer-section">
          <h4>EcoGuía SOS</h4>
          <p>Generando Redes Para el Futuro</p>
        </div>
        <div class="footer-section">
          <h4>Contacto</h4>
          <p>Email: contacto@ecogaiasos.com</p>
        </div>
        <div class="footer-section">
          <h4>Síguenos</h4>
          <div class="social-icons">
            <a href="#" aria-label="Facebook"><i class="fa-brands fa-facebook"></i></a>
            <a href="#" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
          </div>
          <!-- Staff login link -->
          <div class="footer-admin-box">
            <RouterLink to="/admin-login" class="footer-admin-link" @click="closeMenu(); closeDropdowns()">
              <i class="fa-solid fa-lock"></i> Staff
            </RouterLink>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2026 EcoGuía SOS. Todos los derechos reservados.</p>
      </div>
    </footer>

    <!-- GLOBAL NOTIFICATION MODAL -->
    <div 
      v-if="isNotifModalOpen && selectedNotification" 
      class="modal-overlay" 
      style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 99999; backdrop-filter: blur(5px);"
      @click="isNotifModalOpen = false"
    >
      <div class="modal-content" style="background: #111827; border: 1px solid #374151; width: 90%; max-width: 450px; text-align: center; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden; max-height: 90vh; display: flex; flex-direction: column;" @click.stop>
        <div class="modal-header" style="background: rgba(255,255,255,0.05); padding: 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #374151; flex-shrink: 0;">
          <h3 style="margin: 0; font-size: 1.2rem; color: #f9fafb;">{{ selectedNotification.titulo || 'Notificación' }}</h3>
          <button class="close-modal-btn" @click="isNotifModalOpen = false" style="background: transparent; border: none; color: #9ca3af; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>
        <div class="modal-body" style="padding: 30px 20px; overflow-y: auto;">
          <p style="margin-bottom: 20px; color: #d1d5db; font-size: 1.1rem; line-height: 1.6;">{{ selectedNotification.mensaje }}</p>
          
          <div v-if="selectedNotification.archivo_url && selectedNotification.archivo_url.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i)" style="margin-bottom: 20px; border-radius: 8px; overflow: hidden; border: 1px solid #374151;">
            <img :src="selectedNotification.archivo_url" alt="Imagen" style="max-width: 100%; height: auto; display: block;" />
          </div>

          <div style="display: flex; gap: 10px; flex-direction: column;">
            <a 
              v-if="selectedNotification.enlace_url" 
              :href="selectedNotification.enlace_url" 
              target="_blank" 
              class="btn btn-primary" 
              style="display: block; width: 100%; border-radius: 12px; padding: 12px; font-weight: 600; text-decoration: none; background: #059669; color: white;"
            >
              Abrir Enlace
            </a>
            <a 
              v-if="selectedNotification.archivo_url && !selectedNotification.archivo_url.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i)" 
              :href="selectedNotification.archivo_url" 
              target="_blank" 
              class="btn btn-secondary" 
              style="display: block; width: 100%; border-radius: 12px; padding: 12px; font-weight: 600; text-decoration: none; background-color: #374151; color: white;"
            >
              Ver Archivo
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 10000;
}

@media (max-width: 850px) {
  .user-dropdown-menu {
    right: auto;
    left: 50%;
    transform: translate(-50%, -8px) scale(0.97);
  }
  .user-dropdown-menu.active {
    transform: translate(-50%, 0) scale(1);
  }
}

.global-page-loader {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #0b0f19;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999999;
}
.loader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
.loader-gif {
  width: 120px;
  height: 120px;
  object-fit: contain;
}
.loader-text {
  color: #72b04d;
  font-family: 'Inter', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin: 0;
  animation: loaderPulse 1.5s infinite ease-in-out;
}

@keyframes loaderPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
