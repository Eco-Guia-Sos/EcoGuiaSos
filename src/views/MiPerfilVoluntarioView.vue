<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../services/supabase.service'

const router = useRouter()
const authStore = useAuthStore()

// State
const loading = ref(false)
const saving = ref(false)
const profileId = ref('')
const message = ref<{ text: string; type: 'success' | 'error' } | null>(null)

// Form fields
const nombreCompleto = ref('')
const email = ref('')
const telefono = ref('')
const avatarUrl = ref('')
const zonaPreferida = ref('')
const bio = ref('')
const habilidades = ref('')
const nivelExperiencia = ref('')
const disponibilidad = ref('')
const tieneVehiculo = ref(false)
const causasInteres = ref<string[]>([])

// Security fields
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const updatingPassword = ref(false)

// Password visibility toggles
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

// Social links
const activeSocials = ref<string[]>([])
const socialValues = ref<Record<string, string>>({
  facebook: '',
  instagram: '',
  twitter: '',
  whatsapp: '',
  youtube: '',
  web: ''
})

const SOCIAL_NETWORKS = [
  { id: 'facebook', name: 'Facebook', icon: 'fa-brands fa-facebook', class: 'facebook', placeholder: 'https://facebook.com/tu-usuario', color: '#1877F2' },
  { id: 'instagram', name: 'Instagram', icon: 'fa-brands fa-instagram', class: 'instagram', placeholder: 'https://instagram.com/tu-usuario', color: '#E1306C' },
  { id: 'twitter', name: 'X / Twitter', icon: 'fa-brands fa-x-twitter', class: 'x-twitter', placeholder: 'https://x.com/tu-usuario', color: '#f8fafc' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fa-brands fa-whatsapp', class: 'whatsapp', placeholder: 'https://wa.me/5255...', color: '#25D366' },
  { id: 'youtube', name: 'YouTube', icon: 'fa-brands fa-youtube', class: 'youtube', placeholder: 'https://youtube.com/@tu-canal', color: '#FF0000' },
  { id: 'web', name: 'Sitio Web', icon: 'fa-solid fa-globe', class: 'web', placeholder: 'https://tu-sitio.com', color: '#72B04D' }
]

const CAUSAS_OPTIONS = [
  { id: 'reforestacion', emoji: '🌱', label: 'Reforestación' },
  { id: 'agua', emoji: '💧', label: 'Agua' },
  { id: 'fauna', emoji: '🦎', label: 'Fauna Silvestre' },
  { id: 'educacion', emoji: '🌍', label: 'Educación Ambiental' },
  { id: 'reciclaje', emoji: '♻️', label: 'Reciclaje' },
  { id: 'huertos', emoji: '🌆', label: 'Huertos Urbanos' },
  { id: 'conservacion_marina', emoji: '🌊', label: 'Conservación Marina' },
  { id: 'polinizadores', emoji: '🦋', label: 'Polinizadores' },
  { id: 'normativa', emoji: '📜', label: 'Normativa Ambiental' },
]

const toggleSocial = (net: string) => {
  if (activeSocials.value.includes(net)) {
    activeSocials.value = activeSocials.value.filter(n => n !== net)
    socialValues.value[net] = ''
  } else {
    activeSocials.value.push(net)
  }
}

const toggleCausa = (causaId: string) => {
  if (causasInteres.value.includes(causaId)) {
    causasInteres.value = causasInteres.value.filter(id => id !== causaId)
  } else {
    causasInteres.value.push(causaId)
  }
}

// Check authorization
onMounted(async () => {
  loading.value = true
  try {
    if (!authStore.user) {
      await authStore.init()
    }
    if (!authStore.user) {
      router.push({ name: 'auth', query: { tab: 'login', redirect: '/mi-perfil' } })
      return
    }

    profileId.value = authStore.user.id
    await cargarPerfil()
  } catch (err) {
    console.error('Error inicializando perfil:', err)
  } finally {
    loading.value = false
  }
})

const cargarPerfil = async () => {
  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', profileId.value)
      .maybeSingle()

    if (error) throw error

    if (data) {
      nombreCompleto.value = data.nombre_completo || ''
      email.value = data.email || authStore.user?.email || ''
      telefono.value = data.telefono || ''
      avatarUrl.value = data.avatar_url || ''
      zonaPreferida.value = data.zona_preferida || ''
      bio.value = data.bio || ''
      habilidades.value = data.habilidades || ''
      nivelExperiencia.value = data.nivel_experiencia || ''
      disponibilidad.value = data.disponibilidad || ''
      tieneVehiculo.value = data.tiene_vehiculo || false
      causasInteres.value = data.causas_interes || []

      // Populate social links
      const links = data.links_sociales || {}
      activeSocials.value = []
      Object.keys(socialValues.value).forEach(net => {
        if (links[net]) {
          socialValues.value[net] = links[net]
          activeSocials.value.push(net)
        } else {
          socialValues.value[net] = ''
        }
      })
    }
  } catch (err: any) {
    console.error('Error cargando perfil:', err)
    showMessage('No se pudo cargar la información del perfil', 'error')
  }
}

const showMessage = (text: string, type: 'success' | 'error') => {
  message.value = { text, type }
  setTimeout(() => {
    message.value = null
  }, 5000)
}

// Image compression (same as AuthView)
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

// Handle Avatar change
const handleAvatarChange = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  saving.value = true
  try {
    const compressedBlob = await compressImage(file)
    const fileName = `avatares/perfil_${profileId.value}_${Date.now()}.webp`

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from('imagenes-plataforma')
      .upload(fileName, compressedBlob, { upsert: true })

    if (uploadError) throw uploadError

    // Get public URL
    const { data } = supabase.storage.from('imagenes-plataforma').getPublicUrl(fileName)
    const publicUrl = data.publicUrl

    // Update in DB
    const { error: updateError } = await supabase
      .from('perfiles')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', profileId.value)

    if (updateError) throw updateError

    avatarUrl.value = publicUrl
    if (authStore.profile) {
      authStore.profile.avatar_url = publicUrl
    }
    showMessage('Foto de perfil actualizada correctamente', 'success')
  } catch (err: any) {
    console.error('Error actualizando foto de perfil:', err)
    showMessage('Error al subir la imagen: ' + err.message, 'error')
  } finally {
    saving.value = false
  }
}

// Save profile form
const saveProfile = async () => {
  saving.value = true
  try {
    // Format social links JSON
    const links: Record<string, string> = {}
    activeSocials.value.forEach(net => {
      if (socialValues.value[net]?.trim()) {
        links[net] = socialValues.value[net].trim()
      }
    })

    const { error } = await supabase
      .from('perfiles')
      .update({
        nombre_completo: nombreCompleto.value.trim(),
        telefono: telefono.value.trim(),
        zona_preferida: zonaPreferida.value.trim(),
        bio: bio.value.trim(),
        habilidades: habilidades.value.trim(),
        nivel_experiencia: nivelExperiencia.value,
        disponibilidad: disponibilidad.value,
        tiene_vehiculo: tieneVehiculo.value,
        causas_interes: causasInteres.value,
        links_sociales: links,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId.value)

    if (error) throw error

    // Sync authStore profile
    if (authStore.profile) {
      authStore.profile.nombre_completo = nombreCompleto.value.trim()
      authStore.profile.telefono = telefono.value.trim()
      authStore.profile.zona_preferida = zonaPreferida.value.trim()
      authStore.profile.bio = bio.value.trim()
      authStore.profile.habilidades = habilidades.value.trim()
      authStore.profile.nivel_experiencia = nivelExperiencia.value
      authStore.profile.disponibilidad = disponibilidad.value
      authStore.profile.tiene_vehiculo = tieneVehiculo.value
      authStore.profile.causas_interes = causasInteres.value
      authStore.profile.links_sociales = links
    }

    showMessage('Perfil guardado exitosamente', 'success')
  } catch (err: any) {
    console.error('Error guardando perfil:', err)
    showMessage('Error al guardar el perfil: ' + err.message, 'error')
  } finally {
    saving.value = false
  }
}

// Update security (Email / Password)
const handleUpdateSecurity = async () => {
  if (newPassword.value !== confirmPassword.value) {
    showMessage('Las nuevas contraseñas no coinciden.', 'error')
    return
  }

  updatingPassword.value = true
  try {
    // 1. Email update if changed
    if (email.value.trim() !== authStore.user?.email) {
      const { error: emailErr } = await supabase.auth.updateUser({
        email: email.value.trim()
      })
      if (emailErr) throw emailErr
      showMessage('Se ha enviado una confirmación a tu nuevo correo.', 'success')
    }

    // 2. Password update if fields are filled
    if (newPassword.value) {
      const { error: passErr } = await supabase.auth.updateUser({
        password: newPassword.value
      })
      if (passErr) throw passErr
      showMessage('Contraseña actualizada correctamente.', 'success')
      newPassword.value = ''
      confirmPassword.value = ''
      currentPassword.value = ''
    }
  } catch (err: any) {
    console.error('Error al actualizar seguridad:', err)
    showMessage('Error: ' + err.message, 'error')
  } finally {
    updatingPassword.value = false
  }
}
</script>

<template>
  <div class="volunteer-profile-page">
    <div class="profile-container">
      <header class="profile-header">
        <h1>Mi Perfil de Voluntario</h1>
        <p class="profile-desc">Completa tu información para que los administradores y los agentes que sigues te conozcan mejor.</p>
      </header>

      <div v-if="loading" class="profile-loading">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Cargando información de perfil...
      </div>

      <div v-else class="profile-grid">
        <!-- Main Form (4 Sections) -->
        <main class="profile-main-form">
          <form @submit.prevent="saveProfile">
            
            <!-- SECCIÓN 1: Datos Personales -->
            <section class="profile-section-card glass-effect">
              <div class="card-header-icon">
                <i class="fa-solid fa-address-card"></i>
                <h2>Datos Personales</h2>
              </div>
              
              <div class="avatar-upload-wrapper">
                <div 
                  class="avatar-preview"
                  :style="avatarUrl ? `background-image: url(${avatarUrl}); background-size: cover; background-position: center; border: none;` : ''"
                >
                  <i v-if="!avatarUrl" class="fa-solid fa-user"></i>
                  <label for="avatar-input" class="avatar-edit-badge" title="Cambiar foto de perfil">
                    <i class="fa-solid fa-camera"></i>
                  </label>
                  <input 
                    type="file" 
                    id="avatar-input" 
                    accept="image/*" 
                    @change="handleAvatarChange" 
                    style="display: none;" 
                  />
                </div>
                <div class="avatar-help">
                  <p class="avatar-title">Foto de Perfil</p>
                  <p class="avatar-desc-text">Formatos recomendados: JPG, PNG o WEBP. Redonda y centrada.</p>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group col-md-6">
                  <label for="p-nombre">Nombre Completo</label>
                  <div class="input-wrapper">
                    <i class="fa-solid fa-user"></i>
                    <input 
                      type="text" 
                      id="p-nombre" 
                      v-model="nombreCompleto" 
                      placeholder="Tu nombre completo" 
                      required 
                    />
                  </div>
                </div>

                <div class="form-group col-md-6">
                  <label for="p-telefono">Teléfono / WhatsApp</label>
                  <div class="input-wrapper">
                    <i class="fa-solid fa-phone"></i>
                    <input 
                      type="tel" 
                      id="p-telefono" 
                      v-model="telefono" 
                      placeholder="Ej. +52 5512345678" 
                    />
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label for="p-zona">Zona / Alcaldía / Colonia de residencia</label>
                <div class="input-wrapper">
                  <i class="fa-solid fa-location-dot"></i>
                  <input 
                    type="text" 
                    id="p-zona" 
                    v-model="zonaPreferida" 
                    placeholder="Ej. Coyoacán, CDMX / Colonia Centro" 
                  />
                </div>
              </div>
            </section>

            <!-- SECCIÓN 2: Sobre ti y Disponibilidad -->
            <section class="profile-section-card glass-effect">
              <div class="card-header-icon">
                <i class="fa-solid fa-hand-holding-heart"></i>
                <h2>Sobre Ti y Disponibilidad</h2>
              </div>

              <div class="form-group">
                <label for="p-bio">Biografía / Presentación</label>
                <div class="textarea-wrapper">
                  <textarea 
                    id="p-bio" 
                    v-model="bio" 
                    rows="3" 
                    maxlength="200" 
                    placeholder="Cuéntanos brevemente quién eres y por qué quieres sumarte..."
                  ></textarea>
                  <span class="char-counter">{{ bio.length }}/200</span>
                </div>
              </div>

              <div class="form-group">
                <label for="p-habilidades">Habilidades que aportas</label>
                <div class="textarea-wrapper">
                  <textarea 
                    id="p-habilidades" 
                    v-model="habilidades" 
                    rows="3" 
                    placeholder="Ej. Fotografía, manejo de redes, organización de grupos, siembra, etc."
                  ></textarea>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group col-md-6">
                  <label for="p-experiencia">Nivel de Experiencia</label>
                  <div class="input-wrapper select-wrapper">
                    <i class="fa-solid fa-award"></i>
                    <select id="p-experiencia" v-model="nivelExperiencia">
                      <option value="" disabled hidden>Selecciona tu experiencia</option>
                      <option value="Principiante">🐦 Colibrí (Principiante / Con ganas de aprender)</option>
                      <option value="Intermedio">🦎 Ajolote (Intermedio / Con alguna experiencia)</option>
                      <option value="Experimentado">🐺 Lobo (Experimentado / Experto en la materia)</option>
                    </select>
                  </div>
                </div>

                <div class="form-group col-md-6">
                  <label for="p-disponibilidad">Disponibilidad</label>
                  <div class="input-wrapper select-wrapper">
                    <i class="fa-solid fa-calendar-days"></i>
                    <select id="p-disponibilidad" v-model="disponibilidad">
                      <option value="" disabled hidden>Selecciona tu disponibilidad</option>
                      <option value="Fines de semana">Fines de semana</option>
                      <option value="Entre semana">Entre semana</option>
                      <option value="Ambas">Fines de semana y Entre semana</option>
                      <option value="Tiempo completo">Tiempo completo</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="toggle-group-wrapper">
                <span class="toggle-label">¿Cuentas con vehículo propio para traslados?</span>
                <label class="switch-toggle">
                  <input type="checkbox" v-model="tieneVehiculo" />
                  <span class="slider-toggle-round"></span>
                </label>
              </div>
            </section>

            <!-- SECCIÓN 3: Causas de interés -->
            <section class="profile-section-card glass-effect">
              <div class="card-header-icon">
                <i class="fa-solid fa-heart"></i>
                <h2>Causas que te apasionan</h2>
              </div>
              <p class="section-instruction">Selecciona una o varias causas de interés ambiental en las que te gustaría participar:</p>
              
              <div class="causes-chips-grid">
                <button
                  type="button"
                  v-for="causa in CAUSAS_OPTIONS"
                  :key="causa.id"
                  class="cause-chip-btn"
                  :class="{ 'active': causasInteres.includes(causa.id) }"
                  @click="toggleCausa(causa.id)"
                >
                  <span class="cause-emoji">{{ causa.emoji }}</span>
                  <span class="cause-label">{{ causa.label }}</span>
                  <i class="fa-solid fa-circle-check check-indicator"></i>
                </button>
              </div>
            </section>

            <!-- SECCIÓN 4: Redes Sociales -->
            <section class="profile-section-card glass-effect">
              <div class="card-header-icon">
                <i class="fa-solid fa-share-nodes"></i>
                <h2>Redes Sociales</h2>
              </div>
              <p class="section-instruction">Redes Sociales (Haz clic en un icono para ingresar su enlace)</p>

              <div class="social-selector" style="margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 10px;">
                <button
                  type="button"
                  v-for="net in SOCIAL_NETWORKS"
                  :key="net.id"
                  class="social-btn"
                  :class="[net.class, { 'active': activeSocials.includes(net.id) }]"
                  @click="toggleSocial(net.id)"
                  :title="net.name"
                >
                  <i :class="net.icon"></i>
                </button>
              </div>

              <div class="social-inputs-list">
                <transition-group name="fade-slide">
                  <div 
                    v-for="net in SOCIAL_NETWORKS.filter(n => activeSocials.includes(n.id))" 
                    :key="net.id"
                    class="form-group social-input-group"
                    style="margin-bottom: 15px;"
                  >
                    <div class="input-wrapper">
                      <i :class="net.icon" :style="{ color: net.color || '#72B04D' }"></i>
                      <input 
                        type="url" 
                        :id="`s-${net.id}`" 
                        v-model="socialValues[net.id]" 
                        :placeholder="net.placeholder" 
                      />
                    </div>
                  </div>
                </transition-group>
              </div>
            </section>

            <!-- Submit Button for Profile Form -->
            <div class="form-actions-sticky">
              <button 
                type="submit" 
                class="btn btn-primary save-btn shimmer-extra"
                :disabled="saving"
              >
                <i class="fa-solid fa-floppy-disk"></i> {{ saving ? 'Guardando...' : 'Guardar Cambios del Perfil' }}
              </button>
            </div>
          </form>
        </main>

        <!-- Sidebar (Security & Account info) -->
        <aside class="profile-sidebar">
          
          <!-- SECCIÓN 5: Seguridad de la cuenta -->
          <div class="profile-section-card glass-effect sidebar-card">
            <div class="card-header-icon">
              <i class="fa-solid fa-shield-halved"></i>
              <h2>Security y Cuenta</h2>
            </div>
            
            <form @submit.prevent="handleUpdateSecurity">
              <div class="form-group">
                <label for="sec-email">Correo Electrónico</label>
                <div class="input-wrapper">
                  <i class="fa-solid fa-envelope"></i>
                  <input 
                    type="email" 
                    id="sec-email" 
                    v-model="email" 
                    placeholder="tu@email.com" 
                    required 
                  />
                </div>
              </div>

              <div class="security-divider">Cambiar Contraseña</div>

              <div class="form-group">
                <label for="sec-new-password">Nueva Contraseña</label>
                <div class="input-wrapper">
                  <i class="fa-solid fa-lock"></i>
                  <input 
                    :type="showNewPassword ? 'text' : 'password'" 
                    id="sec-new-password" 
                    v-model="newPassword" 
                    placeholder="Dejar en blanco para no cambiar" 
                    minlength="6" 
                  />
                  <button 
                    type="button" 
                    class="password-visibility-btn" 
                    @click="showNewPassword = !showNewPassword"
                    title="Mostrar/Ocultar contraseña"
                  >
                    <i :class="showNewPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label for="sec-confirm-password">Confirmar Nueva Contraseña</label>
                <div class="input-wrapper">
                  <i class="fa-solid fa-lock"></i>
                  <input 
                    :type="showConfirmPassword ? 'text' : 'password'" 
                    id="sec-confirm-password" 
                    v-model="confirmPassword" 
                    placeholder="Repite la nueva contraseña" 
                    minlength="6" 
                  />
                  <button 
                    type="button" 
                    class="password-visibility-btn" 
                    @click="showConfirmPassword = !showConfirmPassword"
                    title="Mostrar/Ocultar contraseña"
                  >
                    <i :class="showConfirmPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                class="btn btn-secondary update-security-btn"
                :disabled="updatingPassword"
              >
                <i class="fa-solid fa-key"></i> {{ updatingPassword ? 'Actualizando...' : 'Actualizar Cuenta' }}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>

    <!-- Floating Global Message -->
    <transition name="fade-slide">
      <div v-if="message" class="floating-alert" :class="message.type">
        <i :class="message.type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'"></i>
        <span>{{ message.text }}</span>
      </div>
    </transition>
  </div>
</template>

<style>
.volunteer-profile-page {
  background-color: #0b0f19;
  min-height: 100vh;
  padding: 100px 20px 50px 20px;
  font-family: 'Outfit', sans-serif;
  color: white;
}

.profile-container {
  max-width: 1200px;
  margin: 0 auto;
}

.profile-header {
  margin-bottom: 30px;
}

.profile-header h1 {
  font-size: 2.2rem;
  font-weight: 800;
  color: white;
  margin-bottom: 8px;
}

.profile-desc {
  color: #94a3b8;
  font-size: 1rem;
}

.profile-loading {
  text-align: center;
  padding: 50px;
  font-size: 1.2rem;
  color: #94a3b8;
}

.profile-loading i {
  color: #72B04D;
  margin-right: 10px;
}

.profile-grid {
  display: grid;
  grid-template-columns: 8fr 4fr;
  gap: 30px;
  align-items: start;
}

@media (max-width: 992px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}

.profile-section-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 30px;
  margin-bottom: 25px;
}

.card-header-icon {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 25px;
}

.card-header-icon i {
  font-size: 1.4rem;
  color: #72B04D;
}

.card-header-icon h2 {
  font-size: 1.3rem;
  font-weight: 700;
  margin: 0;
}

.avatar-upload-wrapper {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 25px;
  background: rgba(255, 255, 255, 0.02);
  padding: 15px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.avatar-preview {
  position: relative;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.05);
  border: 2px dashed rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-preview i {
  font-size: 2.2rem;
  color: rgba(255, 255, 255, 0.3);
}

.avatar-edit-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #72B04D;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  transition: transform 0.2s, background-color 0.2s;
}

.avatar-edit-badge:hover {
  transform: scale(1.1);
  background-color: #61973f;
}

.avatar-help {
  flex: 1;
}

.avatar-title {
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 3px;
}

.avatar-desc-text {
  color: #64748b;
  font-size: 0.8rem;
  line-height: 1.4;
}

.form-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

@media (max-width: 600px) {
  .form-row {
    flex-direction: column;
    gap: 0;
  }
}

.form-group {
  margin-bottom: 20px;
  width: 100%;
}

.form-group label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #94a3b8;
  margin-bottom: 8px;
  display: block;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper i {
  position: absolute;
  left: 14px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.95rem;
}

.input-wrapper input,
.input-wrapper select {
  width: 100%;
  padding: 12px 14px 12px 42px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  color: white;
  outline: none;
  font-family: inherit;
  font-size: 0.95rem;
  transition: all 0.3s;
}

.input-wrapper input:focus,
.input-wrapper select:focus {
  border-color: #72B04D;
  background: rgba(255, 255, 255, 0.05);
}

.textarea-wrapper {
  position: relative;
}

.textarea-wrapper textarea {
  width: 100%;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  color: white;
  outline: none;
  font-family: inherit;
  font-size: 0.95rem;
  transition: all 0.3s;
  resize: vertical;
}

.textarea-wrapper textarea:focus {
  border-color: #72B04D;
  background: rgba(255, 255, 255, 0.05);
}

.char-counter {
  position: absolute;
  bottom: 8px;
  right: 12px;
  font-size: 0.75rem;
  color: #64748b;
}

.select-wrapper::after {
  content: '\f078';
  font-family: 'Font Awesome 6 Free';
  font-weight: 900;
  position: absolute;
  right: 15px;
  color: rgba(255,255,255,0.4);
  pointer-events: none;
  font-size: 0.8rem;
}

.input-wrapper select {
  appearance: none;
}

.toggle-group-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.02);
  padding: 15px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.toggle-label {
  font-size: 0.9rem;
  color: #cbd5e1;
}

.switch-toggle {
  position: relative;
  display: inline-block;
  width: 46px;
  height: 24px;
}

.switch-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider-toggle-round {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.1);
  transition: .4s;
  border-radius: 34px;
  border: 1px solid rgba(255,255,255,0.1);
}

.slider-toggle-round:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

.switch-toggle input:checked + .slider-toggle-round {
  background-color: #72B04D;
}

.switch-toggle input:checked + .slider-toggle-round:before {
  transform: translateX(22px);
}

.section-instruction {
  color: #cbd5e1;
  font-size: 0.9rem;
  margin-top: -10px;
  margin-bottom: 20px;
}

.causes-chips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.cause-chip-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: white;
  cursor: pointer;
  transition: all 0.3s;
  text-align: left;
  position: relative;
  font-family: inherit;
  font-size: 0.9rem;
}

.cause-chip-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.cause-chip-btn.active {
  background: rgba(114, 176, 77, 0.15);
  border-color: #72B04D;
  box-shadow: 0 4px 15px rgba(114, 176, 77, 0.1);
}

.cause-emoji {
  font-size: 1.1rem;
}

.check-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 0.95rem;
  color: #72B04D;
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s;
}

.cause-chip-btn.active .check-indicator {
  opacity: 1;
  transform: scale(1);
}

.social-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.social-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.4);
  font-size: 1.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
}

.social-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: white;
  transform: translateY(-2px);
}

.social-btn.active {
  color: white !important;
  box-shadow: 0 4px 15px rgba(255, 255, 255, 0.1);
}

.social-btn.facebook.active {
  background: #1877F2;
  border-color: #1877F2;
}

.social-btn.instagram.active {
  background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
  border-color: transparent;
}

.social-btn.whatsapp.active {
  background: #25D366;
  border-color: #25D366;
}

.social-btn.x-twitter.active {
  background: #000000;
  border-color: #333;
}

.social-btn.youtube.active {
  background: #FF0000;
  border-color: #FF0000;
}

.social-btn.web.active {
  background: #72B04D;
  border-color: #72B04D;
}

/* Fix dropdown background color in select element */
select option {
  background-color: #0b0f19 !important;
  color: white !important;
}

.social-inputs-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.social-input-group label i {
  color: #72B04D;
  margin-right: 5px;
}

.form-actions-sticky {
  position: sticky;
  bottom: 20px;
  background: rgba(11, 15, 25, 0.85);
  backdrop-filter: blur(10px);
  padding: 15px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: flex-end;
  z-index: 100;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  margin-top: 20px;
}

.save-btn {
  padding: 12px 30px;
  font-weight: 700;
  font-size: 1rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  cursor: pointer;
}

.sidebar-card {
  position: sticky;
  top: 100px;
}

.security-divider {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  margin: 25px 0 15px 0;
  gap: 10px;
}

.security-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
}

.password-visibility-btn {
  position: absolute;
  right: 14px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  font-size: 0.95rem;
  transition: color 0.2s;
  padding: 5px;
}

.password-visibility-btn:hover {
  color: white;
}

.update-security-btn {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 15px;
  border: none;
  cursor: pointer;
}

.floating-alert {
  position: fixed;
  bottom: 30px;
  right: 30px;
  background: rgba(15, 23, 42, 0.9);
  border-radius: 12px;
  padding: 16px 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10000;
  border: 1px solid rgba(255,255,255,0.1);
  animation: slideIn 0.3s ease-out;
  max-width: 380px;
}

.floating-alert.success {
  border-left: 4px solid #72B04D;
}

.floating-alert.success i {
  color: #72B04D;
}

.floating-alert.error {
  border-left: 4px solid #ef4444;
}

.floating-alert.error i {
  color: #ef4444;
}

/* Animations */
@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
