<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'
import { useValidation } from '../composables/useValidation'
import { useServiceCall } from '../composables/useServiceCall'
import { AuthSchema, LoginSchema } from '../schemas'

declare const particlesJS: any

// TODO: Integrar Cloudflare Turnstile para proteger el formulario de auth
// Pasos:
// 1. npm install @vue-turnstile/vue3
// 2. Registrarse en https://dash.cloudflare.com/?to=/:account/turnstile
// 3. Crear Site Key y Secret Key
// 4. Poner VITE_TURNSTILE_SITE_KEY en .env
// 5. Agregar <VueTurnstile v-model="captchaToken" /> en el template
// 6. Validar el token en handleSubmit() antes de llamar a supabase.auth.signUp()


const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Validation composable
const { validateForm } = useValidation()
const { call } = useServiceCall()
const loginErrors = ref<Record<string, string>>({})
const signupErrors = ref<Record<string, string>>({})
const actorErrors = ref<Record<string, string>>({})

// State
const activeTab = ref<'login' | 'signup' | 'actor'>('login')
const isSumateMode = ref(false) // If true, hides "Ingresar" tab

// Message display
const messageText = ref('')
const messageType = ref<'error' | 'success'>('error')

// Form state - Login
const loginEmail = ref('')
const loginPassword = ref('')
const showLoginPassword = ref(false)
const isLoginSubmitting = ref(false)

// Form state - Signup
const regAvatar = ref<File | null>(null)
const regAvatarPreview = ref<string | null>(null)
const regName = ref('')
const regEmail = ref('')
const regPhone = ref('')
const regPassword = ref('')
const showRegPassword = ref(false)
const activeRegSocials = ref<string[]>([])
const regSocialValues = ref<Record<string, string>>({})
const isSignupSubmitting = ref(false)

// Form state - Actor
const actorAvatar = ref<File | null>(null)
const actorAvatarPreview = ref<string | null>(null)
const actorName = ref('')
const actorEmail = ref('')
const actorPhone = ref('')
const actorPassword = ref('')
const showActorPassword = ref(false)
const actorBio = ref('')
const activeActorSocials = ref<string[]>([])
const actorSocialValues = ref<Record<string, string>>({})
const isActorSubmitting = ref(false)

// Available social networks
const socialNetworks = [
  { id: 'facebook', icon: 'fa-brands fa-facebook', title: 'Facebook', color: '#1877f2' },
  { id: 'instagram', icon: 'fa-brands fa-instagram', title: 'Instagram', color: '#e1306c' },
  { id: 'whatsapp', icon: 'fa-brands fa-whatsapp', title: 'WhatsApp', color: '#25d366' },
  { id: 'x-twitter', icon: 'fa-brands fa-x-twitter', title: 'X (Twitter)', color: '#ffffff' },
  { id: 'youtube', icon: 'fa-brands fa-youtube', title: 'YouTube', color: '#ff0000' },
  { id: 'web', icon: 'fa-solid fa-globe', title: 'Sitio Web', color: '#5bc2f7' }
]

// Función reutilizable para actualizar la pestaña según la URL
const updateTabFromQuery = (tabParam: any) => {
  if (tabParam === 'signup' || tabParam === 'actor') {
    isSumateMode.value = true
    activeTab.value = tabParam as 'signup' | 'actor'
  } else {
    isSumateMode.value = false
    activeTab.value = 'login'
  }
}

// Watcher reactivo de la ruta para actualizaciones dentro de la misma vista
watch(() => route.query.tab, (newTab) => {
  updateTabFromQuery(newTab)
})

onMounted(() => {
  updateTabFromQuery(route.query.tab)

  // Initialize Particles
  if (typeof particlesJS !== 'undefined') {
    particlesJS('particles-js', {
      particles: {
        number: { value: 40, density: { enable: true, value_area: 800 } },
        color: { value: ['#72B04D', '#0077b6'] },
        shape: { type: 'circle' },
        opacity: { value: 0.3, random: true },
        size: { value: 6, random: true },
        move: { enable: true, speed: 2 }
      }
    })
  }
})

const showMessage = (msg: string, type: 'error' | 'success' = 'error') => {
  messageText.value = msg
  messageType.value = type
}

// Avatar change handlers
const onRegAvatarChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    regAvatar.value = file
    const reader = new FileReader()
    reader.onload = (event) => {
      regAvatarPreview.value = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const onActorAvatarChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    actorAvatar.value = file
    const reader = new FileReader()
    reader.onload = (event) => {
      actorAvatarPreview.value = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

// Social toggling
const toggleRegSocial = (net: string) => {
  if (activeRegSocials.value.includes(net)) {
    activeRegSocials.value = activeRegSocials.value.filter(n => n !== net)
    delete regSocialValues.value[net]
  } else {
    activeRegSocials.value.push(net)
    regSocialValues.value[net] = ''
  }
}

const toggleActorSocial = (net: string) => {
  if (activeActorSocials.value.includes(net)) {
    activeActorSocials.value = activeActorSocials.value.filter(n => n !== net)
    delete actorSocialValues.value[net]
  } else {
    activeActorSocials.value.push(net)
    actorSocialValues.value[net] = ''
  }
}

// Image compression
const compressImage = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 500
        const MAX_HEIGHT = 500
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        const size = Math.min(width, height)
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas context is null'))

        const offsetX = (width - size) / 2
        const offsetY = (height - size) / 2
        
        ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size)
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas blob is null'))
        }, 'image/webp', 0.8)
      }
    }
    reader.onerror = error => reject(error)
  })
}

// Avatar upload
const uploadAvatar = async (file: File): Promise<string | null> => {
  try {
    const compressedBlob = await compressImage(file)
    const fileName = `avatares/perfil_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`
    const { error: uploadError } = await supabase.storage
      .from('imagenes-plataforma')
      .upload(fileName, compressedBlob, { upsert: false })
      
    if (uploadError) {
      console.error('[Auth] Error subiendo avatar:', uploadError)
      return null
    }
    const { data } = supabase.storage.from('imagenes-plataforma').getPublicUrl(fileName)
    return data.publicUrl
  } catch (err) {
    console.error('[Auth] Excepción subiendo avatar:', err)
    return null
  }
}

// Format social data for DB
const getSocialDataStr = (socialValues: Record<string, string>) => {
  return Object.entries(socialValues)
    .filter(([_, val]) => val.trim() !== '')
    .map(([net, val]) => `${net}: ${val}`)
    .join(' | ')
}

// Auth Handlers
const handleLogin = async () => {
  loginErrors.value = {}
  const { valid, errors } = validateForm(LoginSchema, {
    email: loginEmail.value,
    password: loginPassword.value
  })

  if (!valid) {
    loginErrors.value = errors
    return
  }

  isLoginSubmitting.value = true
  showMessage('')
  
  const { error } = await call(
    async () => {
      const res = await supabase.auth.signInWithPassword({
        email: loginEmail.value,
        password: loginPassword.value
      })
      if (res.error) throw res.error
      return res.data
    },
    'Email o contraseña incorrectos.'
  )

  if (error) {
    showMessage(error, 'error')
    isLoginSubmitting.value = false
    return
  }

  showMessage('Sesión iniciada. Redirigiendo...', 'success')
  
  // Initialize Pinia store update
  await authStore.init()
  
  setTimeout(() => router.push('/'), 1500)
  isLoginSubmitting.value = false
}

const handleSignup = async () => {
  signupErrors.value = {}
  const { valid, errors } = validateForm(AuthSchema, {
    email: regEmail.value,
    password: regPassword.value
  })

  if (!valid) {
    signupErrors.value = errors
    return
  }

  isSignupSubmitting.value = true
  showMessage('')
  try {
    let avatarUrl: string | null = null
    if (regAvatar.value) {
      avatarUrl = await uploadAvatar(regAvatar.value)
    }

    const socialLinks = getSocialDataStr(regSocialValues.value)

    const { error } = await supabase.auth.signUp({
      email: regEmail.value,
      password: regPassword.value,
      options: {
        data: {
          nombre_completo: regName.value,
          telefono: regPhone.value,
          redes_sociales: socialLinks,
          avatar_url: avatarUrl
        }
      }
    })

    if (error) throw error
    showMessage('¡Registro exitoso! Revisa tu email para confirmar.', 'success')
    
    // Reset form
    regName.value = ''
    regEmail.value = ''
    regPhone.value = ''
    regPassword.value = ''
    regAvatar.value = null
    regAvatarPreview.value = null
    activeRegSocials.value = []
    regSocialValues.value = {}
  } catch (error: any) {
    showMessage(error.message, 'error')
  } finally {
    isSignupSubmitting.value = false
  }
}

const handleActorRequest = async () => {
  actorErrors.value = {}
  const { valid, errors } = validateForm(AuthSchema, {
    email: actorEmail.value,
    password: actorPassword.value
  })

  if (!valid) {
    actorErrors.value = errors
    return
  }

  const socialLinks = getSocialDataStr(actorSocialValues.value)
  if (!socialLinks) {
    showMessage('Debes añadir al menos una red social para ser Actor.', 'error')
    return
  }

  isActorSubmitting.value = true
  showMessage('')
  try {
    let avatarUrl: string | null = null
    if (actorAvatar.value) {
      avatarUrl = await uploadAvatar(actorAvatar.value)
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: actorEmail.value,
      password: actorPassword.value,
      options: {
        data: {
          nombre_completo: actorName.value,
          telefono: actorPhone.value,
          rol: 'user',
          avatar_url: avatarUrl
        }
      }
    })

    if (authError) throw authError
    if (!authData?.user) throw new Error('No se pudo obtener el ID de usuario.')

    // Format links dictionary
    const links: Record<string, string> = {}
    Object.entries(actorSocialValues.value).forEach(([net, val]) => {
      links[net] = val
    })

    // Create profile
    const { error: profileError } = await supabase
      .from('perfiles')
      .upsert({
        id: authData.user.id,
        nombre_completo: actorName.value,
        email: actorEmail.value,
        telefono: actorPhone.value,
        rol: 'user',
        actor_status: 'pending',
        bio: actorBio.value,
        links_sociales: links,
        avatar_url: avatarUrl
      })

    if (profileError) throw profileError

    showMessage('¡Cuenta creada y solicitud enviada! Revisa tu email.', 'success')

    // Open WhatsApp
    setTimeout(() => {
      const waMessage = encodeURIComponent(`¡Hola! Soy ${actorName.value}. Acabo de enviar mi solicitud como Actor en EcoGuía SOS. Mi correo es ${actorEmail.value}.`)
      window.open(`https://wa.me/525540149022?text=${waMessage}`, '_blank')
      
      // Reset form
      actorName.value = ''
      actorEmail.value = ''
      actorPhone.value = ''
      actorPassword.value = ''
      actorBio.value = ''
      actorAvatar.value = null
      actorAvatarPreview.value = null
      activeActorSocials.value = []
      actorSocialValues.value = {}
    }, 2000)
  } catch (error: any) {
    showMessage(error.message, 'error')
  } finally {
    isActorSubmitting.value = false
  }
}
</script>

<template>
  <div class="auth-page-wrapper">
    <div id="particles-js"></div>

    <div class="auth-wrapper">
      <header class="auth-header">
        <RouterLink to="/" class="back-link">
          <i class="fa-solid fa-arrow-left"></i> Volver
        </RouterLink>
      </header>

      <main class="auth-container glass-effect">
        <!-- Tabs -->
        <div v-if="isSumateMode" class="auth-tabs">
          <button 
            class="auth-tab" 
            :class="{ 'active': activeTab === 'signup' }" 
            @click="activeTab = 'signup'"
          >
            Voluntario
          </button>
          <button 
            class="auth-tab" 
            :class="{ 'active': activeTab === 'actor' }" 
            @click="activeTab = 'actor'"
          >
            Soy Actor
          </button>
        </div>

        <!-- Formulario de Login -->
        <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="auth-form active">
          <h2>¡Hola de nuevo!</h2>
          <p>Ingresa tus credenciales para continuar.</p>
          
          <div class="input-group">
            <label for="login-email">Email</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-envelope"></i>
              <input type="email" id="login-email" v-model="loginEmail" placeholder="tu@email.com" required>
            </div>
            <span v-if="loginErrors.email" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ loginErrors.email }}</span>
          </div>

          <div class="input-group">
            <label for="login-password">Contraseña</label>
            <div class="input-wrapper password-wrapper">
              <i class="fa-solid fa-lock"></i>
              <input :type="showLoginPassword ? 'text' : 'password'" id="login-password" v-model="loginPassword" placeholder="••••••••" required>
              <button type="button" class="password-toggle-btn" @click="showLoginPassword = !showLoginPassword" tabindex="-1">
                <i :class="showLoginPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
              </button>
            </div>
            <span v-if="loginErrors.password" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ loginErrors.password }}</span>
            <div class="forgot-password-container">
              <RouterLink to="/reset-password" class="forgot-link">¿Olvidaste tu contraseña?</RouterLink>
            </div>
          </div>

          <button type="submit" class="btn btn-primary auth-btn shimmer-extra" :disabled="isLoginSubmitting">
            {{ isLoginSubmitting ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        <!-- Formulario de Registro (Voluntario) -->
        <form v-if="activeTab === 'signup'" @submit.prevent="handleSignup" class="auth-form active">
          <h2>Crea tu Cuenta</h2>
          <p>Únete como voluntario para recibir noticias y participar.</p>
          
          <div class="profile-pic-upload">
            <label for="reg-avatar">
              <div class="avatar-preview" id="reg-avatar-preview">
                <img v-if="regAvatarPreview" :src="regAvatarPreview" alt="Preview">
                <template v-else>
                  <i class="fa-solid fa-camera"></i>
                  <span>Añadir Foto</span>
                </template>
                <div v-if="regAvatarPreview" class="overlay-edit">
                  <i class="fa-solid fa-pen" style="font-size: 0.6rem; margin:0;"></i>
                </div>
              </div>
            </label>
            <input type="file" id="reg-avatar" @change="onRegAvatarChange" accept="image/png, image/jpeg, image/webp" hidden>
          </div>

          <div class="input-group">
            <label for="reg-name">Nombre Completo</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-user"></i>
              <input type="text" id="reg-name" v-model="regName" placeholder="Ej. Juan Pérez" required>
            </div>
          </div>

          <div class="input-group">
            <label for="reg-email">Email</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-envelope"></i>
              <input type="email" id="reg-email" v-model="regEmail" placeholder="tu@email.com" required>
            </div>
            <span v-if="signupErrors.email" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ signupErrors.email }}</span>
          </div>

          <div class="input-group">
            <label for="reg-phone">Teléfono (WhatsApp)</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-phone"></i>
              <input type="tel" id="reg-phone" v-model="regPhone" placeholder="Ej. +52 55..." required>
            </div>
          </div>

          <div class="input-group">
            <label>Redes Sociales (Pulsar para añadir)</label>
            <div class="social-selector">
              <button 
                v-for="net in socialNetworks" 
                :key="net.id"
                type="button" 
                class="social-btn" 
                :class="[net.id, { 'active': activeRegSocials.includes(net.id) }]"
                :title="net.title"
                @click="toggleRegSocial(net.id)"
              >
                <i :class="net.icon"></i>
              </button>
            </div>
            <div class="social-inputs-container">
              <div v-for="net in activeRegSocials" :key="net" class="social-input-group">
                <label :title="net"><i :class="socialNetworks.find(n => n.id === net)?.icon"></i></label>
                <input 
                  type="text" 
                  :placeholder="`URL o usuario de ${net}`" 
                  v-model="regSocialValues[net]"
                  required
                >
              </div>
            </div>
          </div>

          <div class="input-group">
            <label for="reg-password">Contraseña</label>
            <div class="input-wrapper password-wrapper">
              <i class="fa-solid fa-lock"></i>
              <input :type="showRegPassword ? 'text' : 'password'" id="reg-password" v-model="regPassword" placeholder="Mínimo 6 caracteres" required minlength="6">
              <button type="button" class="password-toggle-btn" @click="showRegPassword = !showRegPassword" tabindex="-1">
                <i :class="showRegPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
              </button>
            </div>
            <span v-if="signupErrors.password" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ signupErrors.password }}</span>
          </div>

          <button type="submit" class="btn btn-primary auth-btn shimmer-extra" :disabled="isSignupSubmitting">
            {{ isSignupSubmitting ? 'Registrando...' : 'Crear Cuenta' }}
          </button>
        </form>

        <!-- Formulario de Solicitud (Actor) -->
        <form v-if="activeTab === 'actor'" @submit.prevent="handleActorRequest" class="auth-form active">
          <h2>Solicitud de Actor</h2>
          <p>Cuéntanos sobre tu organización para darte permisos de publicación.</p>
          
          <div class="profile-pic-upload">
            <label for="actor-avatar">
              <div class="avatar-preview" id="actor-avatar-preview">
                <img v-if="actorAvatarPreview" :src="actorAvatarPreview" alt="Preview">
                <template v-else>
                  <i class="fa-solid fa-camera"></i>
                  <span>Logo / Foto</span>
                </template>
                <div v-if="actorAvatarPreview" class="overlay-edit">
                  <i class="fa-solid fa-pen" style="font-size: 0.6rem; margin:0;"></i>
                </div>
              </div>
            </label>
            <input type="file" id="actor-avatar" @change="onActorAvatarChange" accept="image/png, image/jpeg, image/webp" hidden>
          </div>

          <div class="input-group">
            <label for="actor-name">Nombre o Razón Social</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-building"></i>
              <input type="text" id="actor-name" v-model="actorName" placeholder="Ej. Huerto Roma Verde" required>
            </div>
          </div>

          <div class="input-group">
            <label for="actor-email">Email de Contacto</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-envelope"></i>
              <input type="email" id="actor-email" v-model="actorEmail" placeholder="contacto@organizacion.com" required>
            </div>
            <span v-if="actorErrors.email" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ actorErrors.email }}</span>
          </div>

          <div class="input-group">
            <label for="actor-phone">Teléfono / WhatsApp</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-phone"></i>
              <input type="tel" id="actor-phone" v-model="actorPhone" placeholder="55 1234 5678" required>
            </div>
          </div>

          <div class="input-group">
            <label>Redes Sociales / Web <span class="required-badge">Obligatorio (mín. 1)</span></label>
            <div class="social-selector">
              <button 
                v-for="net in socialNetworks" 
                :key="net.id"
                type="button" 
                class="social-btn" 
                :class="[net.id, { 'active': activeActorSocials.includes(net.id) }]"
                :title="net.title"
                @click="toggleActorSocial(net.id)"
              >
                <i :class="net.icon"></i>
              </button>
            </div>
            <div class="social-inputs-container">
              <div v-for="net in activeActorSocials" :key="net" class="social-input-group">
                <label :title="net"><i :class="socialNetworks.find(n => n.id === net)?.icon"></i></label>
                <input 
                  type="text" 
                  :placeholder="`URL o usuario de ${net}`" 
                  v-model="actorSocialValues[net]"
                  required
                >
              </div>
            </div>
          </div>

          <div class="input-group">
            <label for="actor-password">Contraseña para tu cuenta <span class="required-badge">Obligatorio</span></label>
            <div class="input-wrapper password-wrapper">
              <i class="fa-solid fa-lock"></i>
              <input :type="showActorPassword ? 'text' : 'password'" id="actor-password" v-model="actorPassword" placeholder="Crea tu clave de acceso" required minlength="6">
              <button type="button" class="password-toggle-btn" @click="showActorPassword = !showActorPassword" tabindex="-1">
                <i :class="showActorPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
              </button>
            </div>
            <span v-if="actorErrors.password" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ actorErrors.password }}</span>
          </div>

          <div class="input-group">
            <label for="actor-bio">¿A qué se dedican? (Breve Bio)</label>
            <div class="input-wrapper">
              <textarea id="actor-bio" v-model="actorBio" class="auth-textarea" placeholder="Breve descripción de su impacto ecológico..." required></textarea>
            </div>
          </div>

          <button type="submit" class="btn btn-primary auth-btn shimmer-extra btn-actor-submit" :disabled="isActorSubmitting">
            {{ isActorSubmitting ? 'Procesando...' : 'Enviar Solicitud' }}
          </button>
        </form>

        <!-- Mensaje -->
        <div v-if="messageText" class="auth-message" :class="messageType" style="display: block;">
          {{ messageText }}
        </div>
      </main>
    </div>
  </div>
</template>

<style>
@import '../assets/css/auth.css';
</style>
