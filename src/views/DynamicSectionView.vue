<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

// Props
const props = defineProps<{
  sectionId: string
  parentHub: 'colibri' | 'ajolote' | 'lobo'
}>()

// State
const items = ref<any[]>([])
const loading = ref(true)
const errorMsg = ref('')
const canAddContent = ref(false)

// Config definition
const hubsConfig = {
  colibri: {
    badge: '🐦 Colibrí',
    heroTitle: 'Eco-Aprende y Participa',
    heroDesc: 'Capacítate, lee, ve documentales y participa en iniciativas para un estilo de vida sustentable.',
    links: [
      { name: 'Cursos', path: '/cursos', icon: 'fa-solid fa-graduation-cap', id: 'cursos' },
      { name: 'Ecotecnias', path: '/ecotecnias', icon: 'fa-solid fa-lightbulb', id: 'ecotecnias' },
      { name: 'Agua', path: '/agua', icon: 'fa-solid fa-water', id: 'agua' },
      { name: 'Lecturas', path: '/lecturas', icon: 'fa-solid fa-book', id: 'lecturas' },
      { name: 'Documentales', path: '/documentales', icon: 'fa-solid fa-video', id: 'documentales' },
      { name: 'Firmas', path: '/firmas', icon: 'fa-solid fa-file-signature', id: 'firmas' }
    ],
    labels: {
      cursos: 'Curso',
      lecturas: 'Lectura',
      documentales: 'Documental',
      ecotecnias: 'Ecotecnia',
      agua: 'Recurso de Agua',
      firmas: 'Petición'
    } as Record<string, string>
  },
  ajolote: {
    badge: '🦎 Ajolote',
    heroTitle: 'Redes y Comunidad',
    heroDesc: 'Encuentra agentes de cambio, súmate a voluntariados o participa en convocatorias activas.',
    links: [
      { name: 'Agentes', path: '/agentes', icon: 'fa-solid fa-users', id: 'agentes' },
      { name: 'Voluntariados', path: '/voluntariados', icon: 'fa-solid fa-hands-helping', id: 'voluntariados' },
      { name: 'Convocatoria', path: '/convocatoria', icon: 'fa-solid fa-bullhorn', id: 'convocatoria' }
    ],
    labels: {
      agentes: 'Agente',
      voluntariados: 'Voluntariado',
      convocatoria: 'Convocatoria'
    } as Record<string, string>
  },
  lobo: {
    badge: '🐺 Lobo',
    heroTitle: 'Normativa y Financiamiento',
    heroDesc: 'Consulta la legislación ambiental vigente y encuentra fondos para financiar tus proyectos ecológicos.',
    links: [
      { name: 'Normativa', path: '/normativa', icon: 'fa-solid fa-scale-balanced', id: 'normativa' },
      { name: 'Fondos', path: '/fondos', icon: 'fa-solid fa-sack-dollar', id: 'fondos' }
    ],
    labels: {
      normativa: 'Norma',
      fondos: 'Fondo'
    } as Record<string, string>
  }
}

const currentHub = computed(() => hubsConfig[props.parentHub])
const proposalLabel = computed(() => currentHub.value.labels[props.sectionId] || 'Recurso')

// Parse description helper (extracts meta from JSON if applicable)
const parseItem = (item: any) => {
  let textoDescripcion = item.descripcion || ''
  let meta: any = {}
  
  try {
    if (textoDescripcion.trim().startsWith('{')) {
      meta = JSON.parse(textoDescripcion)
      textoDescripcion = meta.descripcion_texto || ''
    }
  } catch (e) {
    // Silent
  }

  return {
    ...item,
    meta,
    textoDescripcion
  }
}

const parsedItems = computed(() => items.value.map(parseItem))

const fetchContent = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const { data, error } = await supabase
      .from('contenido_secciones')
      .select('*')
      .eq('seccion_id', props.sectionId)
      .eq('estado', 'publicado')
      .order('created_at', { ascending: false })

    if (error) throw error
    items.value = data || []
  } catch (err: any) {
    console.error(`[DynamicSection] Error:`, err)
    errorMsg.value = 'Error al conectar con la base de datos.'
  } finally {
    loading.value = false
  }
}

const checkPermissions = async () => {
  canAddContent.value = false
  if (!authStore.user) return

  const userRole = authStore.profile?.rol || localStorage.getItem('eco_user_role') || 'user'
  
  if (userRole === 'admin') {
    canAddContent.value = true
    return
  }

  if (userRole === 'actor') {
    // Check specific permission
    try {
      const { data, error } = await supabase
        .from('permisos_actores')
        .select(`puede_editar_${props.sectionId}`)
        .eq('actor_id', authStore.user.id)
        .single()

      if (!error && data && data[`puede_editar_${props.sectionId}` as keyof typeof data]) {
        canAddContent.value = true
      }
    } catch (e) {
      console.error('Error checking actor permissions:', e)
    }
  }
}

const handleAddContent = () => {
  router.push(`/admin?action=new&section=${props.sectionId}&hub=${props.parentHub}`)
}

onMounted(() => {
  fetchContent()
  checkPermissions()
})

// Watch route parameter changes to fetch correct content
watch(() => props.sectionId, () => {
  fetchContent()
  checkPermissions()
})

watch(() => authStore.user, () => {
  checkPermissions()
})
</script>

<template>
  <div :class="`theme-${props.parentHub}`">
    <header class="interior-hero">
      <div class="hero-glass-panel">
        <span class="category-badge">{{ currentHub.badge }}</span>
        <h2>{{ currentHub.heroTitle }}</h2>
        <p>{{ currentHub.heroDesc }}</p>
        
        <!-- Add Button if authorized -->
        <button 
          v-if="canAddContent"
          class="btn btn-proposal shimmer-extra"
          style="margin-top: 20px;"
          @click="handleAddContent"
        >
          <i class="fa-solid fa-plus-circle"></i> Agregar {{ proposalLabel }}
        </button>
      </div>
      
      <div class="subnav-scroll-wrapper fade-in">
        <nav class="level-subnav">
          <RouterLink 
            v-for="link in currentHub.links" 
            :key="link.id"
            :to="link.path" 
            class="subnav-link"
            :class="{ 'active': link.id === props.sectionId }"
          >
            <i :class="link.icon"></i> {{ link.name }}
          </RouterLink>
        </nav>
      </div>
    </header>

    <main class="content-section">
      <div v-if="loading" class="no-events">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Cargando contenido...
      </div>
      
      <div v-else-if="errorMsg" class="no-events">
        <p class="error-msg">{{ errorMsg }}</p>
      </div>

      <div v-else-if="parsedItems.length === 0" class="no-events">
        <p class="empty-msg">Aún no hay contenido en esta sección. ¡Sé el primero en proponer algo!</p>
      </div>

      <div v-else class="card-grid-container">
        <article 
          v-for="item in parsedItems" 
          :key="item.id"
          class="glass-card fade-in"
        >
          <div v-if="item.imagen_url" class="card-img-container">
            <img 
              :src="item.imagen_url" 
              :alt="item.titulo" 
              @error="($event.target as HTMLImageElement).src='/assets/img/colibri.webp'"
            >
            <span 
              v-if="item.meta.area || item.meta.ambito" 
              class="card-badge"
            >
              {{ item.meta.area || item.meta.ambito }}
            </span>
          </div>

          <div class="card-content">
            <h3>{{ item.titulo }}</h3>
            
            <div class="card-meta-info" style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 10px;">
              <!-- Dynamic Metadata fields depending on type -->
              <span v-if="item.meta.institucion"><i class="fa-solid fa-building-columns"></i> {{ item.meta.institucion }}</span>
              <span v-if="item.meta.gratuito"><i class="fa-solid fa-tag"></i> {{ item.meta.gratuito }}</span>
              
              <span v-if="item.meta.tipo_norma"><i class="fa-solid fa-scale-balanced"></i> {{ item.meta.tipo_norma }}</span>
              <span v-if="item.meta.organismo"><i class="fa-solid fa-building"></i> {{ item.meta.organismo }}</span>

              <span v-if="item.meta.autor"><i class="fa-solid fa-user-pen"></i> {{ item.meta.autor }}</span>
              <span v-if="item.meta.tipo_lectura"><i class="fa-solid fa-book"></i> {{ item.meta.tipo_lectura }}</span>

              <span v-if="item.meta.director"><i class="fa-solid fa-clapperboard"></i> {{ item.meta.director }}</span>
              <span v-if="item.meta.duracion"><i class="fa-solid fa-clock"></i> {{ item.meta.duracion }}</span>

              <span v-if="item.meta.tipo_apoyo"><i class="fa-solid fa-hand-holding-dollar"></i> {{ item.meta.tipo_apoyo }}</span>
              <span v-if="item.meta.monto"><i class="fa-solid fa-sack-dollar"></i> {{ item.meta.monto }}</span>

              <span v-if="item.meta.tipo_fondo"><i class="fa-solid fa-sack-dollar"></i> {{ item.meta.tipo_fondo }}</span>
              <span v-if="item.meta.origen"><i class="fa-solid fa-earth-americas"></i> {{ item.meta.origen }}</span>
              <span v-if="item.meta.monto_aprox"><i class="fa-solid fa-coins"></i> {{ item.meta.monto_aprox }}</span>

              <span v-if="item.meta.plataforma_firmas"><i class="fa-solid fa-pen-nib"></i> {{ item.meta.plataforma_firmas }}</span>
              <span v-if="item.meta.meta_firmas"><i class="fa-solid fa-users"></i> Meta: {{ item.meta.meta_firmas }} firmas</span>

              <!-- Common fields -->
              <span v-if="item.meta.fecha_limite || item.meta.fecha_cierre"><i class="fa-regular fa-calendar-check"></i> Límite: {{ item.meta.fecha_limite || item.meta.fecha_cierre }}</span>
              <span v-if="item.fecha_evento"><i class="fa-regular fa-calendar"></i> {{ new Date(item.fecha_evento).toLocaleDateString() }}</span>
            </div>

            <p style="margin-bottom: 20px; color: #cbd5e1; font-size: 0.95rem; line-height: 1.5;">{{ item.textoDescripcion }}</p>
            
            <div v-if="item.enlace_externo" class="card-actions" style="margin-top: auto;">
              <a 
                :href="item.enlace_externo" 
                target="_blank" 
                class="btn btn-primary" 
                style="width: 100%; justify-content: center; padding: 10px; border-radius: 30px;"
              >
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Acceder al Recurso
              </a>
            </div>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<style>
@import '../assets/css/interior-pages.css';

.card-grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 25px;
    padding: 20px 0;
}
.glass-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    overflow: hidden;
    transition: all 0.3s ease;
}
.glass-card:hover {
    transform: translateY(-5px);
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--primary-color);
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}
.card-img-container {
    position: relative;
    height: 180px;
    overflow: hidden;
}
.card-img-container img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.card-badge {
    position: absolute;
    top: 15px;
    right: 15px;
    background: var(--primary-color);
    color: black;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}
.card-content {
    padding: 25px;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
}
.card-content h3 {
    margin-top: 0;
    margin-bottom: 10px;
    color: white;
    font-size: 1.3rem;
}
.btn-proposal {
    background: var(--primary-color);
    color: black;
    border: none;
    padding: 12px 25px;
    border-radius: 30px;
    cursor: pointer;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
}
.btn-proposal:hover {
    transform: scale(1.05);
    filter: brightness(1.1);
}

@media (max-width: 768px) {
    .card-grid-container {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 15px;
    }
    .card-meta-info {
        gap: 5px !important;
    }
    .btn-proposal {
        width: 100%;
        justify-content: center;
    }
}
</style>
