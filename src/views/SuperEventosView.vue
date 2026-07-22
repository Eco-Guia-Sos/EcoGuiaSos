<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'
import { compressImage } from '../utils/imageCompressor'

const router = useRouter()
const authStore = useAuthStore()

const superEventos = ref<any[]>([])
const loading = ref(true)
const errorMsg = ref('')

// Cover State
const coverUrl = ref('')
const uploadingCover = ref(false)

const isAdmin = computed(() => {
  return authStore.profile?.rol === 'admin'
})

const fetchCover = async () => {
  try {
    const { data, error } = await supabase
      .from('portadas_secciones')
      .select('imagen_url')
      .eq('seccion_id', 'super-eventos')
      .maybeSingle()
    if (error) throw error
    if (data && data.imagen_url) {
      coverUrl.value = data.imagen_url
    }
  } catch (err) {
    console.warn('Error fetching cover photo:', err)
  }
}

const triggerFileInput = () => {
  const input = document.getElementById('cover-file-input') as HTMLInputElement
  if (input) input.click()
}

const handleCoverUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingCover.value = true
  try {
    // 1. Compress image natively using canvas helper
    const compressedBlob = await compressImage(file, 1200, 0.8)
    const compressedFile = new File([compressedBlob], `cover_super_eventos_${Date.now()}.jpg`, {
      type: 'image/jpeg'
    })

    // 2. Upload to Supabase Storage bucket 'imagenes-plataforma'
    const fileName = `portadas/super_eventos_${Date.now()}.jpg`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('imagenes-plataforma')
      .upload(fileName, compressedFile, {
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('imagenes-plataforma')
      .getPublicUrl(fileName)

    const publicUrl = publicUrlData.publicUrl

    // 3. Save reference in DB
    const { error: dbError } = await supabase
      .from('portadas_secciones')
      .upsert({
        seccion_id: 'super-eventos',
        imagen_url: publicUrl,
        updated_at: new Date().toISOString(),
        updated_by: authStore.user?.id
      })

    if (dbError) throw dbError

    coverUrl.value = publicUrl
    alert('¡Portada de página actualizada correctamente!')
  } catch (err: any) {
    console.error('Error uploading cover:', err)
    alert('No se pudo subir la portada: ' + (err.message || err))
  } finally {
    uploadingCover.value = false
    // Clear input
    target.value = ''
  }
}

const fetchSuperEventos = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    // Attempt querying the active view first
    const { data: viewData, error: viewError } = await supabase
      .from('super_eventos_activos')
      .select('*')
      .order('fecha_ultimo_evento', { ascending: true })

    if (!viewError && viewData) {
      superEventos.value = viewData
      return
    }

    // Fallback: Query super_eventos table directly
    const { data, error } = await supabase
      .from('super_eventos')
      .select('*')
      .eq('estado', 'approved')
      .order('created_at', { ascending: false })

    if (error) throw error
    superEventos.value = data || []
  } catch (err: any) {
    console.error('Error fetching super eventos:', err)
    errorMsg.value = 'No se pudieron cargar los eventos especiales.'
  } finally {
    loading.value = false
  }
}

const resolveImgUrl = (url: string) => {
  if (!url) return '/assets/img/logo-app.webp'
  if (url.startsWith('http') || url.startsWith('/assets/')) return url
  const supabaseUrlStr = import.meta.env.VITE_SUPABASE_URL || ''
  return `${supabaseUrlStr}/storage/v1/object/public/imagenes-plataforma/${url.startsWith('/') ? url.slice(1) : url}`
}

onMounted(() => {
  fetchSuperEventos()
  fetchCover()
})
</script>

<template>
  <div class="theme-ajolote" style="min-height: 100vh; background: #0b1329;">
    <header 
      class="interior-hero" 
      :style="coverUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url(${resolveImgUrl(coverUrl)})` } : {}"
    >
      <!-- Admin Cover Changer Floating Widget -->
      <div v-if="isAdmin" class="admin-cover-widget">
        <button 
          @click="triggerFileInput" 
          class="admin-cover-btn" 
          :disabled="uploadingCover"
          title="Cambiar imagen de portada"
        >
          <i v-if="uploadingCover" class="fa-solid fa-spinner fa-spin"></i>
          <i v-else class="fa-solid fa-camera"></i>
          <span>{{ uploadingCover ? 'Subiendo...' : 'Cambiar portada' }}</span>
        </button>
        <input 
          type="file" 
          id="cover-file-input" 
          @change="handleCoverUpload" 
          accept="image/*" 
          style="display: none;" 
        />
      </div>

      <div class="hero-glass-panel">
        <span class="category-badge">🏆 Macro Eventos</span>
        <h2>Super Eventos Colectivos</h2>
        <p>Explora ferias, olimpiadas y festivales sustentables que reúnen a múltiples colectivos en la red.</p>
      </div>
      
      <div class="subnav-scroll-wrapper fade-in">
        <nav class="level-subnav">
          <RouterLink to="/agentes" class="subnav-link"><i class="fa-solid fa-users"></i> Agentes</RouterLink>
          <RouterLink to="/convocatoria" class="subnav-link"><i class="fa-solid fa-bullhorn"></i> Convocatorias</RouterLink>
          <RouterLink to="/voluntariados" class="subnav-link"><i class="fa-solid fa-handshake"></i> Ayuda</RouterLink>
          <RouterLink to="/causas" class="subnav-link"><i class="fa-solid fa-hand-holding-heart"></i> Causas / Rifas</RouterLink>
          <RouterLink to="/lugares" class="subnav-link"><i class="fa-solid fa-map-pin"></i> Lugares</RouterLink>
          <RouterLink to="/super-eventos" class="subnav-link active"><i class="fa-solid fa-trophy"></i> Eventos Especiales</RouterLink>
        </nav>
      </div>
    </header>

    <main style="max-width: 1200px; margin: 0 auto; padding: 20px 15px 60px; position: relative; z-index: 5;">
      <div v-if="loading" class="no-events">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Cargando eventos especiales...
      </div>
      
      <div v-else-if="errorMsg" class="no-events">
        <p class="error-msg">{{ errorMsg }}</p>
      </div>

      <div v-else-if="superEventos.length === 0" class="no-events">
        <p class="empty-msg">No hay súper eventos programados por el momento.</p>
      </div>

      <div v-else class="card-grid-container">
        <article 
          v-for="se in superEventos" 
          :key="se.id"
          class="card fade-in card-colibri"
          @click="router.push(`/super-eventos/${se.id}`)"
          style="cursor: pointer;"
        >
          <div class="card-image">
            <img 
              :src="resolveImgUrl(se.imagen_url)" 
              @error="($event.target as HTMLImageElement).src='/assets/img/logo-app.webp'"
              style="width: 100%; height: 100%; object-fit: cover;"
            >
          </div>
          <div class="card-content" style="padding-top: 12px;">
            <div class="card-meta-row">
              <span class="card-meta-category">
                <span class="category-icon-bg">🏆</span> Super Evento
              </span>
            </div>
            <h3 class="card-title" style="margin-bottom:6px; font-size: 1.1rem; line-height: 1.25; color: white;">{{ se.nombre }}</h3>
            <p style="font-size:0.8rem; color:#94a3b8; line-height:1.4; margin-top:6px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">
              {{ se.descripcion_corta || 'Explora todas las actividades de este encuentro sustentable.' }}
            </p>
            <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size: 0.75rem; color: #72b04d; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                <i class="fa-solid fa-map-location-dot" style="margin-right: 5px;"></i> Ver Encuentro
              </span>
            </div>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<style scoped>
.no-events {
  text-align: center;
  padding: 80px 20px;
  color: #94a3b8;
  font-size: 1.1rem;
}
.empty-msg {
  color: #64748b;
  font-size: 1rem;
}
.error-msg {
  color: #ef4444;
  font-weight: 500;
}

/* Admin Cover Photo Widget */
.admin-cover-widget {
  position: absolute;
  top: 90px;
  right: 25px;
  z-index: 100;
}
.admin-cover-btn {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(114, 176, 77, 0.4);
  color: #72B04D;
  padding: 10px 18px;
  border-radius: 50px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}
.admin-cover-btn:hover:not(:disabled) {
  background: #72B04D;
  color: #0b1329;
  border-color: #72B04D;
  box-shadow: 0 0 15px rgba(114, 176, 77, 0.6);
  transform: scale(1.05);
}
.admin-cover-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .admin-cover-widget {
    top: 85px;
    right: 15px;
  }
  .admin-cover-btn {
    padding: 8px 14px;
    font-size: 0.75rem;
  }
}
</style>
