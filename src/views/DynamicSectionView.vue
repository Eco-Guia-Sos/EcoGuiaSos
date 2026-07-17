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
      { name: 'Firmas', path: '/firmas', icon: 'fa-solid fa-file-signature', id: 'firmas' },
      { name: 'Eco-tecnología', path: '/eco-tecnologia', icon: 'fa-solid fa-microchip', id: 'eco-tecnologia' }
    ],
    labels: {
      cursos: 'Curso',
      lecturas: 'Lectura',
      documentales: 'Documental',
      ecotecnias: 'Ecotecnia',
      agua: 'Recurso de Agua',
      firmas: 'Petición',
      'eco-tecnologia': 'Recurso Tecnológico'
    } as Record<string, string>
  },
  ajolote: {
    badge: '🦎 Ajolote',
    heroTitle: 'Redes y Comunidad',
    heroDesc: 'Encuentra agentes de cambio, súmate a voluntariados o participa en convocatorias activas.',
    links: [
      { name: 'Agentes', path: '/agentes', icon: 'fa-solid fa-users', id: 'agentes' },
      { name: 'Convocatorias', path: '/convocatoria', icon: 'fa-solid fa-bullhorn', id: 'convocatoria' },
      { name: 'Ayuda', path: '/voluntariados', icon: 'fa-solid fa-handshake', id: 'voluntariados' },
      { name: 'Causas / Rifas', path: '/causas', icon: 'fa-solid fa-hand-holding-heart', id: 'causas' },
      { name: 'Lugares', path: '/lugares', icon: 'fa-solid fa-map-pin', id: 'lugares' },
      { name: 'Eventos Especiales', path: '/super-eventos', icon: 'fa-solid fa-trophy', id: 'super-eventos' }
    ],
    labels: {
      agentes: 'Agente',
      voluntariados: 'Voluntariado',
      convocatoria: 'Convocatoria',
      causas: 'Causa / Rifa',
      lugares: 'Lugar',
      'super-eventos': 'Evento Especial'
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

const profilesMap = ref<Record<string, any>>({})

// Parse description helper (extracts meta from JSON if applicable)
const parseItem = (item: any) => {
  let textoDescripcion = item.descripcion || ''
  let meta: any = {}
  let descripcionCorta = ''
  
  try {
    if (textoDescripcion.trim().startsWith('{')) {
      meta = JSON.parse(textoDescripcion)
      textoDescripcion = meta.descripcion_texto || ''
      descripcionCorta = meta.descripcion_corta || ''
    }
  } catch (e) {
    // Silent
  }

  return {
    ...item,
    meta,
    textoDescripcion,
    descripcion_corta: descripcionCorta,
    perfiles: item.owner_id ? profilesMap.value[item.owner_id] : null
  }
}

const parsedItems = computed(() => items.value.map(parseItem))

// State for Eco-tecnología filters
const searchQuery = ref('')
const activeCategory = ref('Todos')
const activeResource = ref('Todos')
const isAdvancedSearchOpen = ref(false)

const categories = ['Todos', 'Inteligencia Artificial', 'Hardware/IoT', 'Software Verde', 'Energías Limpias']
const resourceTypes = ['Todos', 'Sitios Web', 'Videos', 'Repositorios', 'Artículos']

const filteredTechProjects = computed(() => {
  if (props.sectionId !== 'eco-tecnologia') {
    return parsedItems.value
  }
  
  const q = searchQuery.value.trim().toLowerCase()
  return parsedItems.value.filter(p => {
    const matchesQuery = !q ||
      (p.titulo || '').toLowerCase().includes(q) ||
      (p.textoDescripcion || '').toLowerCase().includes(q) ||
      (p.meta?.desarrollador || '').toLowerCase().includes(q)
      
    const itemCat = p.meta?.categoria_tech || 'Todos'
    const matchesCategory = activeCategory.value === 'Todos' || itemCat === activeCategory.value
    
    const itemType = p.meta?.tipo_recurso || 'Todos'
    const typeMapping: Record<string, string> = {
      'web': 'Sitios Web',
      'video': 'Videos',
      'github': 'Repositorios',
      'repositorio': 'Repositorios',
      'articulo': 'Artículos'
    }
    const mappedType = typeMapping[itemType.toLowerCase()] || itemType
    const matchesResource = activeResource.value === 'Todos' || mappedType === activeResource.value
    
    return matchesQuery && matchesCategory && matchesResource
  })
})

function categoryAccent(cat: string): string {
  const map: Record<string, string> = {
    'Inteligencia Artificial': '#eab308',
    'Hardware/IoT': '#72B04D',
    'Software Verde': '#2ec4b6',
    'Energías Limpias': '#ca8a04',
  }
  return map[cat] ?? '#72B04D'
}

function resourceIcon(type: string): string {
  const map: Record<string, string> = {
    'Sitios Web': 'fa-solid fa-globe',
    'Videos': 'fa-solid fa-video',
    'Repositorios': 'fa-brands fa-github',
    'Artículos': 'fa-solid fa-file-lines',
  }
  return map[type] ?? 'fa-solid fa-globe'
}

function ctaLabel(type: string): string {
  const map: Record<string, string> = {
    'Sitios Web': 'Visitar Sitio',
    'Videos': 'Ver Video',
    'Repositorios': 'Acceder al Proyecto',
    'Artículos': 'Leer Artículo',
  }
  return map[type] ?? 'Acceder al Proyecto'
}

function fallbackGradient(id: string): string {
  const seed = id ? id.charCodeAt(0) % 3 : 0
  const gradients = [
    'linear-gradient(135deg, rgba(46,196,182,0.35), rgba(10,14,18,0.9))',
    'linear-gradient(135deg, rgba(234,179,8,0.3), rgba(10,14,18,0.9))',
    'linear-gradient(135deg, rgba(131,56,236,0.3), rgba(10,14,18,0.9))',
  ]
  return (gradients[seed] || gradients[0]) as string
}

function clearFilters() {
  searchQuery.value = ''
  activeCategory.value = 'Todos'
  activeResource.value = 'Todos'
}


const getBriefDescription = (text: string) => {
  if (!text) return ''
  const firstParagraph = text.split(/\r?\n\r?\n/)[0] || ''
  if (firstParagraph.length > 150) {
    return firstParagraph.substring(0, 150).trim() + '...'
  }
  return firstParagraph
}

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
    
    // Fetch profiles for the owners to bypass missing DB foreign key mapping
    const ownerIds = [...new Set(items.value.map(item => item.owner_id).filter(Boolean))] as string[]
    if (ownerIds.length > 0) {
      const { data: profs, error: pErr } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, avatar_url')
        .in('id', ownerIds)
        
      if (!pErr && profs) {
        const map: Record<string, any> = {}
        profs.forEach(p => {
          map[p.id] = p
        })
        profilesMap.value = map
      }
    }
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
        .select('seccion_id')
        .eq('user_id', authStore.user.id)
        .eq('seccion_id', props.sectionId)
        .maybeSingle()

      if (!error && data) {
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

// Cover management logic
const coverUrl = ref('')
const uploadingCover = ref(false)
const compressImageHelper = ref<any>(null)

const isAdmin = computed(() => {
  return authStore.profile?.rol === 'admin'
})

const fetchCover = async () => {
  coverUrl.value = ''
  try {
    const { data, error } = await supabase
      .from('portadas_secciones')
      .select('imagen_url')
      .eq('seccion_id', props.sectionId)
      .maybeSingle()
    if (error) throw error
    if (data && data.imagen_url) {
      coverUrl.value = data.imagen_url
    }
  } catch (err) {
    console.warn('Error fetching cover photo for section:', props.sectionId, err)
  }
}

const triggerFileInput = () => {
  const input = document.getElementById('section-cover-file-input') as HTMLInputElement
  if (input) input.click()
}

const handleCoverUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingCover.value = true
  try {
    // Lazy-import compression helper dynamically
    if (!compressImageHelper.value) {
      const mod = await import('../utils/imageCompressor')
      compressImageHelper.value = mod.compressImage
    }
    
    // 1. Compress image natively
    const compressedBlob = await compressImageHelper.value(file, 1200, 0.8)
    const compressedFile = new File([compressedBlob], `cover_${props.sectionId}_${Date.now()}.jpg`, {
      type: 'image/jpeg'
    })

    // 2. Upload to Supabase Storage bucket 'imagenes-plataforma'
    const fileName = `portadas/${props.sectionId}_${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
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
        seccion_id: props.sectionId,
        imagen_url: publicUrl,
        updated_at: new Date().toISOString(),
        updated_by: authStore.user?.id
      })

    if (dbError) throw dbError

    coverUrl.value = publicUrl
    alert('¡Portada de sección actualizada correctamente!')
  } catch (err: any) {
    console.error('Error uploading cover:', err)
    alert('No se pudo subir la portada: ' + (err.message || err))
  } finally {
    uploadingCover.value = false
    target.value = ''
  }
}

onMounted(() => {
  fetchContent()
  checkPermissions()
  fetchCover()
})

// Watch route parameter changes to fetch correct content and covers
watch(() => props.sectionId, () => {
  fetchContent()
  checkPermissions()
  fetchCover()
})

watch(() => authStore.user, () => {
  checkPermissions()
})
</script>

<template>
  <div :class="`theme-${props.parentHub}`">
    <header 
      class="interior-hero" 
      :style="coverUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url(${coverUrl})` } : {}"
    >
      <!-- Admin Cover Changer Floating Widget -->
      <div v-if="isAdmin" class="admin-cover-widget">
        <button 
          @click="triggerFileInput" 
          class="admin-cover-btn" 
          :disabled="uploadingCover"
          title="Cambiar imagen de portada de la sección"
        >
          <i v-if="uploadingCover" class="fa-solid fa-spinner fa-spin"></i>
          <i v-else class="fa-solid fa-camera"></i>
          <span>{{ uploadingCover ? 'Subiendo...' : 'Cambiar portada' }}</span>
        </button>
        <input 
          type="file" 
          id="section-cover-file-input" 
          @change="handleCoverUpload" 
          accept="image/*" 
          style="display: none;" 
        />
      </div>

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
      <!-- Loader -->
      <div v-if="loading" class="no-events">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Cargando contenido...
      </div>
      
      <!-- Error Message -->
      <div v-else-if="errorMsg" class="no-events">
        <p class="error-msg">{{ errorMsg }}</p>
      </div>

      <!-- Search and Filters (Eco-tecnología only) -->
      <template v-else-if="props.sectionId === 'eco-tecnologia'">
        <!-- Search bar -->
        <div class="search-bar-row fade-in" style="margin-bottom: 20px;">
          <div class="search-bar-container">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="Buscar por título, descripción o desarrollador..." 
              autocomplete="off"
            >
          </div>
        </div>

        <!-- Action Button -->
        <div class="action-buttons-row fade-in" style="display:flex; justify-content:space-between; align-items:center; gap: 15px; margin-bottom: 25px;">
          <button 
            class="btn btn-secondary glass-effect" 
            :class="{ 'active': isAdvancedSearchOpen }"
            @click="isAdvancedSearchOpen = !isAdvancedSearchOpen"
          >
            <i class="fa-solid fa-sliders"></i> Búsqueda Avanzada
          </button>
        </div>

        <!-- Advanced Search Panel -->
        <div 
          v-if="isAdvancedSearchOpen"
          class="advanced-search-panel glass-effect fade-in" 
          style="margin-bottom: 25px; padding: 25px; border-radius: 20px;"
        >
          <div class="search-panel-grid lugar-grid">
            <!-- Col 1: Categorías Tech -->
            <div class="search-col">
              <h3>¿Qué tecnología buscas?</h3>
              <div class="category-pills-grid">
                <button 
                  v-for="cat in categories"
                  :key="cat"
                  class="cat-pill" 
                  :class="{ 'active': activeCategory === cat }"
                  @click="activeCategory = cat"
                >
                  {{ cat === 'Todos' ? '🌍 Todo' : cat }}
                </button>
              </div>
            </div>
            
            <!-- Col 2: Tipo de Recurso -->
            <div class="search-col">
              <h3>Tipo de recurso</h3>
              <div class="category-pills-grid">
                <button 
                  v-for="type in resourceTypes"
                  :key="type"
                  class="cat-pill" 
                  :class="{ 'active': activeResource === type }"
                  @click="activeResource = type"
                >
                  {{ type === 'Todos' ? '📁 Todo' : type }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Results Info -->
        <div class="results-bar" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; padding: 0 4px;">
          <span class="results-bar__count" style="color: #94a3b8; font-size: 0.9rem;">
            {{ filteredTechProjects.length }} {{ filteredTechProjects.length === 1 ? 'recurso encontrado' : 'recursos encontrados' }}
          </span>
          <button 
            v-if="searchQuery || activeCategory !== 'Todos' || activeResource !== 'Todos'"
            class="btn btn-link" 
            style="padding: 0; background: none; border: none; color: #72B04D; cursor: pointer; text-decoration: underline; font-weight: 600;"
            @click="clearFilters"
          >
            Limpiar filtros
          </button>
        </div>
      </template>

      <!-- Empty States -->
      <div v-if="!loading && !errorMsg && filteredTechProjects.length === 0" class="no-events">
        <template v-if="parsedItems.length === 0">
          <p class="empty-msg">Aún no hay contenido en esta sección. ¡Sé el primero en proponer algo!</p>
        </template>
        <template v-else>
          <p class="empty-msg">No se encontraron resultados para los filtros seleccionados.</p>
          <button class="btn btn-secondary" style="margin-top: 15px;" @click="clearFilters">Limpiar filtros</button>
        </template>
      </div>

      <!-- Content Grid -->
      <div v-else-if="!loading && !errorMsg" class="card-grid-container">
        <article 
          v-for="item in filteredTechProjects" 
          :key="item.id"
          class="glass-card fade-in"
          :style="props.sectionId === 'causas' || props.sectionId === 'eco-tecnologia' ? 'cursor: pointer;' : ''"
          @click="props.sectionId === 'causas' ? router.push(`/causas/${item.id}`) : (props.sectionId === 'eco-tecnologia' ? router.push(`/eco-tecnologia/${item.id}`) : null)"
        >
          <!-- TEMPLATE 1: ECO-TECNOLOGÍA (Claude UI) -->
          <template v-if="props.sectionId === 'eco-tecnologia'">
            <div class="card-img-container" :style="!item.imagen_url ? { background: fallbackGradient(item.id) } : {}">
              <img v-if="item.imagen_url" :src="item.imagen_url" :alt="item.titulo" @error="($event.target as HTMLImageElement).src='/assets/img/logo-app.webp'" />
              <div v-else class="card-cover-fallback" style="display: flex; align-items: center; justify-content: center; height: 100%;">
                <i class="fa-solid fa-microchip" style="font-size: 3rem; opacity: 0.15;"></i>
              </div>
              <span 
                class="card-badge" 
                :style="{ 
                  background: `${categoryAccent(item.meta.categoria_tech || 'Todos')}22`, 
                  borderColor: `${categoryAccent(item.meta.categoria_tech || 'Todos')}55`, 
                  color: categoryAccent(item.meta.categoria_tech || 'Todos'), 
                  border: '1px solid',
                  textTransform: 'none'
                }"
              >
                {{ item.meta.categoria_tech || 'General' }}
              </span>
            </div>
            
            <div class="card-content">
              <!-- Autor info block -->
              <div v-if="item.perfiles" class="card-author-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <img 
                  :src="item.perfiles.avatar_url || '/assets/img/logo-app.webp'" 
                  style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);"
                  @error="($event.target as HTMLImageElement).src='/assets/img/logo-app.webp'"
                />
                <span style="font-size: 0.8rem; color: #a3aab1; font-weight: 500;">
                  {{ item.perfiles.nombre_completo }}
                </span>
              </div>
              <h3>{{ item.titulo }}</h3>
              
              <div class="card-meta-info" style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 8px;">
                <span v-if="item.meta.desarrollador || item.meta.autor" class="card-meta-tag" style="margin: 0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem;">
                  <i class="fa-solid fa-user-gear"></i> {{ item.meta.desarrollador || item.meta.autor }}
                </span>
                <span v-if="item.meta.stack" class="card-meta-tag" style="margin: 0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem;">
                  <i class="fa-solid fa-code"></i> {{ item.meta.stack }}
                </span>
              </div>
              
              <p style="margin-bottom: 0; color: #cbd5e1; font-size: 0.95rem; line-height: 1.5; flex-grow: 1;">
                {{ item.descripcion_corta || getBriefDescription(item.textoDescripcion) }}
              </p>
            </div>
          </template>

          <!-- TEMPLATE 2: ESTÁNDAR (Existente) -->
          <template v-else>
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
              <!-- Autor info block -->
              <div v-if="item.perfiles" class="card-author-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <img 
                  :src="item.perfiles.avatar_url || '/assets/img/logo-app.webp'" 
                  style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);"
                  @error="($event.target as HTMLImageElement).src='/assets/img/logo-app.webp'"
                />
                <span style="font-size: 0.8rem; color: #a3aab1; font-weight: 500;">
                  {{ item.perfiles.nombre_completo }}
                </span>
              </div>
              <h3>{{ item.titulo }}</h3>
              
              <div v-if="props.sectionId !== 'causas'" class="card-meta-info" style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 10px;">
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

              <p style="margin-bottom: 20px; color: #cbd5e1; font-size: 0.95rem; line-height: 1.5;">
                {{ item.descripcion_corta || getBriefDescription(item.textoDescripcion) }}
              </p>
              
              <div v-if="props.sectionId !== 'causas' && item.enlace_externo" class="card-actions" style="margin-top: auto;">
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
          </template>
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

/* Causes Custom Card Metadata Tags styling */
.card-meta-tag {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px 12px;
  border-radius: 50px;
  font-size: 0.8rem;
  color: #cbd5e1 !important;
  font-weight: 600;
  margin-right: 6px;
  margin-bottom: 6px;
  transition: all 0.3s ease;
}
.card-meta-tag:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(14, 165, 233, 0.4);
}
.meta-icon-circle {
  background: white;
  color: #0284c7; /* Sky/Teal matching Ajolote theme */
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 0.75rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.25);
  margin-right: 8px;
  flex-shrink: 0;
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
