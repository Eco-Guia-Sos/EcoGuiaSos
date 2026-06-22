<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

// State
const activeTab = ref<'eventos' | 'lugares' | 'causas' | 'actores'>('eventos')
const loading = ref(true)
const eventFilter = ref<'actuales' | 'historial'>('actuales')
const causaFilter = ref<'activas' | 'historial'>('activas')

const eventos = ref<any[]>([])
const lugares = ref<any[]>([])
const causas = ref<any[]>([])
const actores = ref<any[]>([])
const userCoords = ref<{ lat: number; lng: number } | null>(null)

const filteredEventos = computed(() => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed (5 for June)

  const parseLocalDate = (dateStr: string): Date => {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match && match[1] && match[2] && match[3]) {
      const year = parseInt(match[1], 10)
      const month = parseInt(match[2], 10) - 1
      const day = parseInt(match[3], 10)
      return new Date(year, month, day)
    }
    return new Date(dateStr)
  }

  return eventos.value.filter(ev => {
    // Falls back from fecha_fin to fecha_inicio or fecha
    const eventDateStr = ev.fecha_fin || ev.fecha_inicio || ev.fecha
    if (!eventDateStr) return eventFilter.value === 'actuales' // default to current if no date is found
    try {
      const eventDate = parseLocalDate(eventDateStr)
      const evYear = eventDate.getFullYear()
      const evMonth = eventDate.getMonth()

      const isCurrentOrFutureMonth = (evYear > currentYear) || (evYear === currentYear && evMonth >= currentMonth)

      if (eventFilter.value === 'actuales') {
        return isCurrentOrFutureMonth
      } else {
        return !isCurrentOrFutureMonth
      }
    } catch (e) {
      return eventFilter.value === 'actuales'
    }
  })
})

const filteredCausas = computed(() => {
  const now = new Date()
  return causas.value.filter(cs => {
    const fechaStr = cs.fecha_evento || cs.meta?.fecha_sorteo
    if (!fechaStr) return causaFilter.value === 'activas'
    try {
      const fecha = new Date(fechaStr)
      const isActive = fecha >= now
      return causaFilter.value === 'activas' ? isActive : !isActive
    } catch {
      return causaFilter.value === 'activas'
    }
  })
})

const fetchFavoritesData = async () => {
  if (!authStore.user) {
    router.push('/auth?tab=login')
    return
  }

  loading.value = true
  try {
    // 1. Fetch event, place and causes favorites
    const { data: favs } = await supabase
      .from('favoritos')
      .select('item_id, item_tipo')
      .eq('user_id', authStore.user.id)

    if (favs && favs.length > 0) {
      const eventIds = favs.filter(f => f.item_tipo === 'evento').map(f => f.item_id)
      const placeIds = favs.filter(f => f.item_tipo === 'lugar').map(f => f.item_id)
      const causaIds = favs.filter(f => f.item_tipo === 'causa').map(f => f.item_id)

      if (eventIds.length > 0) {
        const { data: evs } = await supabase
          .from('eventos')
          .select('*, publicador:owner_id(nombre_completo)')
          .in('id', eventIds)
        eventos.value = evs || []
      } else {
        eventos.value = []
      }

      if (placeIds.length > 0) {
        const { data: lgs } = await supabase
          .from('lugares')
          .select('*, publicador:owner_id(nombre_completo)')
          .in('id', placeIds)
        lugares.value = lgs || []
      } else {
        lugares.value = []
      }

      if (causaIds.length > 0) {
        const { data: css, error: cssErr } = await supabase
          .from('contenido_secciones')
          .select('*')
          .in('id', causaIds)
        
        if (cssErr) console.error('[Favoritos] Error al cargar causas:', cssErr)
        
        causas.value = (css || []).map(item => {
          let textoDescripcion = item.descripcion || ''
          let meta: any = {}
          try {
            if (textoDescripcion.trim().startsWith('{')) {
              meta = JSON.parse(textoDescripcion)
              textoDescripcion = meta.descripcion_texto || ''
            }
          } catch (e) {
            // ignore
          }
          return {
            ...item,
            nombre: item.titulo,
            meta,
            descripcion_texto: textoDescripcion
          }
        })
      } else {
        causas.value = []
      }
    } else {
      eventos.value = []
      lugares.value = []
      causas.value = []
    }

    // 2. Fetch followed actors
    const { data: follows } = await supabase
      .from('seguimientos_actores')
      .select('actor_id')
      .eq('user_id', authStore.user.id)

    if (follows && follows.length > 0) {
      const actorIds = follows.map(f => f.actor_id)
      const { data: profiles } = await supabase
        .from('perfiles')
        .select('*')
        .in('id', actorIds)
      
      actores.value = (profiles || []).map(p => ({
        id: p.id,
        nombre_completo: p.nombre_completo,
        avatar_url: p.avatar_url,
        imagen_url: p.imagen_url,
        especialidad: p.especialidad,
        organizacion: p.organizacion,
        descripcion: p.descripcion,
        bio: p.bio,
        redes_ig: p.redes_ig,
        redes_fb: p.redes_fb,
        is_validated: p.is_validated
      }))
    } else {
      actores.value = []
    }
  } catch (err) {
    console.error('Error fetching favorites:', err)
  } finally {
    loading.value = false
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  // Eventos
  taller: 'Taller',
  voluntariado: 'Voluntariado',
  conferencia: 'Conferencia / Charla',
  limpieza: 'Limpieza de Playas / Áreas',
  reforestacion: 'Reforestación',
  otro: 'Otro',
  
  // Lugares
  sede: 'Sede de Eventos',
  reciclaje: 'Centro de Reciclaje / Residuos',
  asociacion: 'Asociación / ONG Ambiental',
  granel: 'Tienda a Granel / Residuo Cero',
  restaurante: 'Restaurante Vegano / Eco-Gastronomía',
  huerto: 'Huerto / Espacio de Cultivo',
  ecoturismo: 'Ecoturismo / Área Natural'
}

const formatCategory = (cat: string) => {
  if (!cat) return 'General'
  const key = cat.toLowerCase()
  return CATEGORY_LABELS[key] || cat
}

const getCategoryIcon = (cat: string) => {
  if (!cat) return '💡'
  const key = cat.toLowerCase()
  const icons: Record<string, string> = {
    // Eventos
    taller: '🎨',
    voluntariado: '🤝',
    conferencia: '🗣️',
    limpieza: '♻️',
    reforestacion: '🌲',
    otro: '💡',
    
    // Lugares
    sede: '📍',
    reciclaje: '♻️',
    asociacion: '🤝',
    granel: '🫙',
    restaurante: '🥦',
    huerto: '🌱',
    ecoturismo: '🌲'
  }
  return icons[key] || '💡'
}

const getImgSrc = (item: any) => {
  let imgSrc = item.imagen_url || item.imagen
  if (item.imagenes && Array.isArray(item.imagenes) && item.imagenes.length > 0) {
    imgSrc = item.imagenes[0]
  }
  return imgSrc || '/assets/img/kpop.webp'
}

const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const formatearFechaSubtext = (fecha: string) => {
  if (!fecha) return ''
  try {
    const d = new Date(fecha)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    return ''
  }
}

const getNivelClass = (categoria: string) => {
  const cat = (categoria || '').toLowerCase()
  const colibri = ['agua', 'cursos', 'ecotecnias', 'lecturas', 'documentales', 'educación', 'naturaleza', 'ecología']
  const ajolote = ['agentes', 'voluntariados', 'comunidad', 'social', 'convocatoria', 'convocatorias']
  const lobo = ['fondos', 'normativa', 'legal', 'estrategia', 'finanzas']

  if (colibri.some(c => cat.includes(c))) return 'card-colibri'
  if (ajolote.some(c => cat.includes(c))) return 'card-ajolote'
  if (lobo.some(c => cat.includes(c))) return 'card-lobo'
  return 'card-general'
}

// Agentes helpers and active status query
const agentesActivosIds = ref<Set<string>>(new Set())

const fetchAgentesConEventos = async () => {
  try {
    const { data, error } = await supabase
      .from('eventos')
      .select('owner_id')
      .eq('estado', 'approved')

    if (!error && data) {
      const activeIds = new Set(data.map((e: any) => e.owner_id).filter(Boolean) as string[])
      agentesActivosIds.value = activeIds
    }
  } catch (e) {
    console.error('[Agentes] Error fetching active events:', e)
  }
}

const getAgenteThemeClass = (especialidad: string) => {
  const esp = (especialidad || '').toLowerCase()
  if (
    esp.includes('agua') ||
    esp.includes('lluvia') ||
    esp.includes('ecotecnia') ||
    esp.includes('energía') ||
    esp.includes('solar') ||
    esp.includes('tecnología')
  ) {
    return 'theme-blue'
  }
  if (
    esp.includes('huerto') ||
    esp.includes('permacultura') ||
    esp.includes('reforestación') ||
    esp.includes('naturaleza') ||
    esp.includes('tierra') ||
    esp.includes('ecología')
  ) {
    return 'theme-green'
  }
  if (
    esp.includes('educación') ||
    esp.includes('taller') ||
    esp.includes('comunidad') ||
    esp.includes('social') ||
    esp.includes('cultura')
  ) {
    return 'theme-purple'
  }
  return 'theme-default'
}

const getAgenteCategoryLabel = (especialidad: string) => {
  const esp = (especialidad || '').toLowerCase()
  if (
    esp.includes('agua') ||
    esp.includes('lluvia') ||
    esp.includes('ecotecnia') ||
    esp.includes('energía') ||
    esp.includes('solar') ||
    esp.includes('tecnología')
  ) {
    return '💧 Agua y Ecotecnias'
  }
  if (
    esp.includes('huerto') ||
    esp.includes('permacultura') ||
    esp.includes('reforestación') ||
    esp.includes('naturaleza') ||
    esp.includes('tierra') ||
    esp.includes('ecología')
  ) {
    return '🌿 Tierra y Permacultura'
  }
  if (
    esp.includes('educación') ||
    esp.includes('taller') ||
    esp.includes('comunidad') ||
    esp.includes('social') ||
    esp.includes('cultura')
  ) {
    return '👥 Educación y Comunidad'
  }
  return '🌐 Líder Ambiental'
}

onMounted(async () => {
  const cached = localStorage.getItem('eco_user_coords')
  if (cached) {
    try {
      userCoords.value = JSON.parse(cached)
    } catch (e) {}
  }
  if (authStore.loading) {
    await authStore.init()
  }
  await Promise.all([
    fetchFavoritesData(),
    fetchAgentesConEventos()
  ])
})
</script>

<template>
  <div class="favoritos-page-body">
    <div class="dashboard-container">
      
      <!-- Back Button -->
      <div class="dash-topbar">
        <RouterLink to="/" class="btn-back-home">
          <i class="fa-solid fa-arrow-left"></i> Explorar Catálogo
        </RouterLink>
      </div>

      <!-- Dashboard Header -->
      <header class="dash-header">
        <div class="dash-avatar" style="overflow: hidden;">
          <img 
            v-if="authStore.profile?.avatar_url || authStore.profile?.imagen_url" 
            :src="authStore.profile.avatar_url || authStore.profile.imagen_url" 
            alt="Tu Perfil" 
            style="width: 100%; height: 100%; object-fit: cover;"
          />
          <i v-else class="fa-solid fa-user-astronaut"></i>
        </div>
        <div class="dash-info">
          <h1>Tu Panel Personal</h1>
          <p>Aquí se guarda todo lo que te inspira a cambiar el mundo.</p>
        </div>
      </header>

      <!-- Tabs (Segmented Control) -->
      <div style="text-align: center;">
        <div class="segmented-control">
          <button 
            class="segment-btn" 
            :class="{ 'active': activeTab === 'eventos' }" 
            @click="activeTab = 'eventos'"
          >
            <i class="fa-solid fa-calendar-check"></i>
            <span>Mis Eventos</span>
          </button>
          <button 
            class="segment-btn" 
            :class="{ 'active': activeTab === 'lugares' }" 
            @click="activeTab = 'lugares'"
          >
            <i class="fa-solid fa-location-dot"></i>
            <span>Mis Lugares</span>
          </button>
          <button 
            class="segment-btn" 
            :class="{ 'active': activeTab === 'causas' }" 
            @click="activeTab = 'causas'"
          >
            <i class="fa-solid fa-hand-holding-heart"></i>
            <span>Mis Causas</span>
          </button>
          <button 
            class="segment-btn" 
            :class="{ 'active': activeTab === 'actores' }" 
            @click="activeTab = 'actores'"
          >
            <i class="fa-solid fa-users"></i>
            <span>Siguiendo</span>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" style="text-align:center; padding: 50px; width: 100%;">
        <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color: #72B04D;"></i>
      </div>

      <!-- Tab Contents -->
      <div v-else class="tab-contents-wrapper">
        
        <!-- Tab: Eventos -->
        <div v-if="activeTab === 'eventos'" class="tab-content active">
          <div v-if="eventos.length === 0" class="empty-favorites-state">
            <i class="fa-solid fa-calendar-xmark" style="font-size:3rem; margin-bottom:15px; color:#475569;"></i>
            <p>Aún no has guardado ningún evento.</p>
          </div>
          <div v-else>
            <!-- Event filter controls (Segmented pills) -->
            <div class="event-filter-controls">
              <button 
                class="filter-pill-btn" 
                :class="{ 'active': eventFilter === 'actuales' }"
                @click="eventFilter = 'actuales'"
              >
                <i class="fa-solid fa-calendar-day"></i> Actualmente
              </button>
              <button 
                class="filter-pill-btn" 
                :class="{ 'active': eventFilter === 'historial' }"
                @click="eventFilter = 'historial'"
              >
                <i class="fa-solid fa-clock-rotate-left"></i> Historial
              </button>
            </div>

            <!-- Empty state for specific filter selection -->
            <div v-if="filteredEventos.length === 0" class="empty-favorites-state" style="border-style: dotted; background: transparent;">
              <i class="fa-solid fa-calendar-xmark" style="font-size:2.5rem; margin-bottom:12px; color:#475569;"></i>
              <p v-if="eventFilter === 'actuales'">No tienes eventos vigentes o futuros guardados.</p>
              <p v-else>No tienes eventos pasados en tu historial.</p>
            </div>

            <!-- Event Cards Grid -->
            <div v-else class="card-grid-container" id="contenedor-tarjetas">
              <div 
                v-for="ev in filteredEventos" 
                :key="ev.id" 
                class="card-wrapper"
              >
                <div v-if="ev.publicador?.nombre_completo" class="actor-badge" :title="`Publicado por: ${ev.publicador.nombre_completo}`">
                  <i class="fa-solid fa-user-pen"></i>
                  <span>{{ ev.publicador.nombre_completo }}</span>
                </div>
                <article 
                  class="card fade-in" 
                  :class="getNivelClass(ev.categoria)"
                  @click="router.push(`/eventos/${ev.id}`)" 
                  style="cursor: pointer;"
                >
                  <div class="card-image">
                    <img 
                      :src="getImgSrc(ev)" 
                      :alt="ev.nombre" 
                      @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
                    />
                  </div>
                  <div class="card-content">
                    <!-- Metadata row below image -->
                    <div class="card-meta-row">
                      <span class="card-meta-category">
                        <span class="category-icon-bg">{{ getCategoryIcon(ev.categoria) }}</span>
                        {{ formatCategory(ev.categoria) }}
                      </span>
                      <span v-if="userCoords && ev.lat && ev.lng" class="card-meta-dist">
                        <i class="fa-solid fa-route"></i> a {{ calcularDistancia(userCoords.lat, userCoords.lng, ev.lat, ev.lng).toFixed(1) }} km
                      </span>
                    </div>

                    <div class="card-header" style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 20px; margin-bottom: 4px;">
                      <span v-if="ev.modalidad === 'en_linea'" class="status-badge" style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9; font-size: 0.65rem; border: 1px solid rgba(14, 165, 233, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                        🖥️ En Línea
                      </span>
                      <span v-else-if="ev.tiene_sesion_online" class="status-badge" style="background: rgba(139, 92, 246, 0.15); color: #c084fc; font-size: 0.65rem; border: 1px solid rgba(139, 92, 246, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                        🔄 Híbrido
                      </span>
                    </div>
                    <h3 class="card-title" style="margin-bottom:2px; font-size: 1rem; line-height: 1.25; color: white;">{{ ev.nombre }}</h3>
                    <span v-if="formatearFechaSubtext(ev.fecha_inicio || ev.fecha)" class="card-date-sub" style="color:#5bc2f7; font-size:0.75rem; display:block; margin-top:4px; font-weight:600;">
                      <i class="fa-regular fa-calendar" style="margin-right:4px;"></i>{{ formatearFechaSubtext(ev.fecha_inicio || ev.fecha) }}
                    </span>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab: Causas -->
        <div v-if="activeTab === 'causas'" class="tab-content active">
          <div v-if="causas.length === 0" class="empty-favorites-state">
            <i class="fa-solid fa-hand-holding-heart" style="font-size:3rem; margin-bottom:15px; color:#475569;"></i>
            <p>Aún no has guardado ninguna causa o rifa solidaria.</p>
          </div>
          <div v-else>
            <!-- Causa filter pills -->
            <div class="event-filter-controls">
              <button 
                class="filter-pill-btn" 
                :class="{ 'active': causaFilter === 'activas' }"
                @click="causaFilter = 'activas'"
              >
                <i class="fa-solid fa-fire"></i> Activas
              </button>
              <button 
                class="filter-pill-btn" 
                :class="{ 'active': causaFilter === 'historial' }"
                @click="causaFilter = 'historial'"
              >
                <i class="fa-solid fa-clock-rotate-left"></i> Historial
              </button>
            </div>

            <!-- Empty state for filter -->
            <div v-if="filteredCausas.length === 0" class="empty-favorites-state" style="border-style: dotted; background: transparent;">
              <i class="fa-solid fa-hand-holding-heart" style="font-size:2.5rem; margin-bottom:12px; color:#475569;"></i>
              <p v-if="causaFilter === 'activas'">No tienes causas activas guardadas.</p>
              <p v-else>No tienes causas pasadas en tu historial.</p>
            </div>

            <!-- Causas Grid -->
            <div v-else class="card-grid-container" id="contenedor-tarjetas">
              <div 
                v-for="cs in filteredCausas" 
                :key="cs.id" 
                class="card-wrapper"
              >
                <article 
                  class="card fade-in card-ajolote" 
                  @click="router.push(`/causas/${cs.id}`)" 
                  style="cursor: pointer;"
                >
                  <div class="card-image">
                    <img 
                      :src="cs.imagen_url || '/assets/img/kpop.webp'" 
                      :alt="cs.nombre" 
                      @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
                    />
                    <!-- Status badge overlay -->
                    <div style="position:absolute; top:10px; right:10px;">
                      <span 
                        v-if="cs.fecha_evento && new Date(cs.fecha_evento) >= new Date()"
                        style="background: rgba(34,197,94,0.2); border:1px solid rgba(34,197,94,0.4); color:#86efac; font-size:0.65rem; padding:3px 8px; border-radius:20px; font-weight:700; backdrop-filter:blur(6px);"
                      >🟢 ACTIVA</span>
                      <span 
                        v-else-if="cs.fecha_evento"
                        style="background: rgba(100,116,139,0.2); border:1px solid rgba(100,116,139,0.3); color:#94a3b8; font-size:0.65rem; padding:3px 8px; border-radius:20px; font-weight:700; backdrop-filter:blur(6px);"
                      >⏹ FINALIZADA</span>
                    </div>
                  </div>
                  <div class="card-content" style="padding-top: 12px;">
                    <div class="card-meta-row">
                      <span class="card-meta-category">
                        <span class="category-icon-bg">💝</span>
                        Causa / Rifa
                      </span>
                      <span v-if="cs.meta?.costo_boleto" style="font-size:0.72rem; color:#fbbf24; font-weight:700;">
                        🎟️ {{ cs.meta.costo_boleto }}
                      </span>
                    </div>
                    <h3 class="card-title" style="margin-bottom:2px; font-size: 1rem; line-height: 1.25; color: white;">{{ cs.nombre }}</h3>
                    <span v-if="cs.meta?.organizador" class="card-date-sub" style="color:#5bc2f7; font-size:0.75rem; display:block; margin-top:4px; font-weight:600;">
                      <i class="fa-solid fa-house-chimney-user" style="margin-right:4px;"></i>{{ cs.meta.organizador }}
                    </span>
                    <span v-if="cs.meta?.fecha_sorteo || cs.fecha_evento" class="card-date-sub" style="color:#a78bfa; font-size:0.72rem; display:block; margin-top:3px; font-weight:600;">
                      <i class="fa-solid fa-calendar-check" style="margin-right:4px;"></i>
                      Sorteo: {{ new Date(cs.meta?.fecha_sorteo || cs.fecha_evento).toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' }) }}
                    </span>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab: Lugares -->
        <div v-if="activeTab === 'lugares'" class="tab-content active">
          <div v-if="lugares.length === 0" class="empty-favorites-state">
            <i class="fa-solid fa-map-location-dot" style="font-size:3rem; margin-bottom:15px; color:#475569;"></i>
            <p>Aún no has guardado ningún lugar sustentable.</p>
          </div>
          <div class="card-grid-container" id="contenedor-tarjetas">
            <div 
              v-for="lg in lugares" 
              :key="lg.id" 
              class="card-wrapper"
            >
              <div v-if="lg.publicador?.nombre_completo" class="actor-badge" :title="`Publicado por: ${lg.publicador.nombre_completo}`">
                <i class="fa-solid fa-user-pen"></i>
                <span>{{ lg.publicador.nombre_completo }}</span>
              </div>
              <article 
                class="card fade-in" 
                :class="getNivelClass(lg.categoria)"
                @click="router.push(`/lugares/${lg.id}`)" 
                style="cursor: pointer;"
              >
                <div class="card-image">
                  <img 
                    :src="getImgSrc(lg)" 
                    :alt="lg.nombre" 
                    @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
                  />
                </div>
                <div class="card-content" style="padding-top: 12px;">
                  <!-- Metadata row below image -->
                  <div class="card-meta-row">
                    <span class="card-meta-category">
                      <span class="category-icon-bg">{{ getCategoryIcon(lg.categoria) }}</span>
                      {{ formatCategory(lg.categoria) }}
                    </span>
                    <span v-if="userCoords && lg.lat && lg.lng" class="card-meta-dist">
                      <i class="fa-solid fa-route"></i> a {{ calcularDistancia(userCoords.lat, userCoords.lng, lg.lat, lg.lng).toFixed(1) }} km
                    </span>
                  </div>
                  
                  <h3 class="card-title" style="margin-bottom:2px; font-size: 1rem; line-height: 1.25; color: white;">{{ lg.nombre }}</h3>
                  <span v-if="lg.ubicacion" class="card-date-sub" style="color:#5bc2f7; font-size:0.75rem; display:block; margin-top:4px; font-weight:600;">
                    <i class="fa-solid fa-location-dot" style="margin-right:4px;"></i>{{ lg.ubicacion }}
                  </span>
                </div>
              </article>
            </div>
          </div>
        </div>

        <!-- Tab: Actores -->
        <div v-if="activeTab === 'actores'" class="tab-content active">
          <div v-if="actores.length === 0" class="empty-favorites-state">
            <i class="fa-solid fa-user-slash" style="font-size:3rem; margin-bottom:15px; color:#475569;"></i>
            <p>No estás siguiendo a ningún Agente de Cambio por el momento.</p>
          </div>
          <div v-else class="card-grid-container" id="agentes-container">
            <article 
              v-for="(ac, index) in actores" 
              :key="ac.id" 
              class="agente-card glass-card"
              :class="[
                'delay-' + ((index % 4) * 100),
                getAgenteThemeClass(ac.especialidad),
                { 'agente-activo': agentesActivosIds.has(ac.id) }
              ]"
              v-reveal
              style="cursor: pointer;"
              @click="router.push(`/agentes/${ac.id}`)"
            >
              <!-- Badge de actividad absoluto -->
              <span v-if="agentesActivosIds.has(ac.id)" class="activo-badge">
                <span class="pulse-dot"></span> Activo
              </span>

              <img 
                :src="ac.avatar_url || ac.imagen_url || '/assets/img/kpop.webp'" 
                :alt="ac.nombre_completo || 'Agente'" 
                class="agente-img" 
                @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
              >
              <div class="agente-info">
                <h3>{{ ac.nombre_completo || 'Agente de Cambio' }}</h3>
                <span class="agente-category-pill">
                  {{ getAgenteCategoryLabel(ac.especialidad) }}
                </span>
                <p class="agente-especialidad">{{ ac.especialidad || 'Líder Ambiental' }}</p>
                <p class="agente-org">{{ ac.organizacion || 'Participante' }}</p>
                <p class="agente-mini-desc">
                  {{ ac.descripcion || ac.bio || 'Participante activo de la red EcoGuía SOS.' }}
                </p>
                <div class="agente-socials">
                  <!-- Social networks links if they exist on perfil -->
                  <a 
                    v-if="ac.redes_ig" 
                    :href="ac.redes_ig" 
                    target="_blank" 
                    @click.stop
                  >
                    <i class="fa-brands fa-instagram"></i>
                  </a>
                  <a 
                    v-if="ac.redes_fb" 
                    :href="ac.redes_fb" 
                    target="_blank" 
                    @click.stop
                  >
                    <i class="fa-brands fa-facebook"></i>
                  </a>
                  <span v-if="ac.is_validated" class="verified-badge-wrapper" title="Agente Verificado por EcoGuía SOS">
                    <span class="verified-badge">
                      <img src="/assets/img/logo-navbar.webp" alt="Verificado" class="verified-logo-img">
                    </span>
                    <span class="verified-text">eco-verificado</span>
                  </span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.favoritos-page-body {
  background-color: #0b0f19;
  background-image: 
    radial-gradient(circle at 15% 50%, rgba(114, 176, 77, 0.08), transparent 30%),
    radial-gradient(circle at 85% 30%, rgba(91, 194, 247, 0.08), transparent 30%);
  background-attachment: fixed;
  color: #e2e8f0;
  min-height: 100vh;
  font-family: 'Outfit', sans-serif;
  padding-top: 100px;
}
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px 40px;
}
.dash-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
}
.btn-back-home {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 10px 22px;
  border-radius: 30px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}
.btn-back-home:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateX(-5px);
}
.dash-header {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  padding: 30px;
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 40px;
  backdrop-filter: blur(20px);
}
.dash-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #72B04D, #5bc2f7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  color: white;
  box-shadow: 0 0 25px rgba(114, 176, 77, 0.3);
  flex-shrink: 0; /* Prevents avatar from squeezing in flex container */
}
.dash-info h1 {
  margin: 0 0 6px 0;
  font-size: 1.8rem;
  font-weight: 800;
  color: white;
}
.dash-info p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.95rem;
}

/* Tabs / Segmented Control */
.segmented-control {
  background: rgba(15, 23, 42, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 20px;
  padding: 5px;
  display: inline-flex;
  gap: 6px;
  margin-bottom: 40px;
}
.segment-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 12px 28px;
  border-radius: 16px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 8px;
}
.segment-btn:hover {
  color: white;
}
.segment-btn.active {
  background: linear-gradient(135deg, #72b04d 0%, #5ba23a 100%) !important;
  color: white !important;
  box-shadow: 0 4px 15px rgba(114, 176, 77, 0.35) !important;
}

.empty-favorites-state {
  text-align: center;
  padding: 60px 20px;
  background: rgba(255,255,255,0.01);
  border: 2px dashed rgba(255,255,255,0.05);
  border-radius: 24px;
  color: #94a3b8;
  font-weight: 500;
}

.favoritos-page-body .card-wrapper {
  position: relative;
  padding-top: 25px;
  display: flex;
  flex-direction: column;
  height: 100%;
  margin-top: 12px;
}
.favoritos-page-body .actor-badge {
  position: absolute !important;
  top: 25px !important;
  left: 50% !important;
  transform: translate(-50%, -90%) !important;
  z-index: 10 !important;
}
.favoritos-page-body .card {
  background: rgba(15, 23, 42, 0.65) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 20px;
  overflow: visible !important;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  position: relative;
  display: flex;
  flex-direction: column;
}
.favoritos-page-body .card-image {
  border-top-left-radius: 19px !important;
  border-top-right-radius: 19px !important;
}
.favoritos-page-body .card:hover {
  transform: translateY(-8px) scale(1.02) !important;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

.favoritos-page-body .card.card-colibri:hover {
  border-color: rgba(91, 194, 247, 0.5) !important;
  box-shadow: 0 8px 25px rgba(91, 194, 247, 0.2), 0 0 0 1px rgba(91, 194, 247, 0.2) !important;
}
.favoritos-page-body .card.card-ajolote:hover {
  border-color: rgba(114, 176, 77, 0.5) !important;
  box-shadow: 0 8px 25px rgba(114, 176, 77, 0.2), 0 0 0 1px rgba(114, 176, 77, 0.2) !important;
}
.favoritos-page-body .card.card-lobo:hover {
  border-color: rgba(253, 186, 116, 0.5) !important;
  box-shadow: 0 8px 25px rgba(253, 186, 116, 0.2), 0 0 0 1px rgba(253, 186, 116, 0.2) !important;
}
.favoritos-page-body .card.card-general:hover {
  border-color: rgba(20, 184, 166, 0.5) !important;
  box-shadow: 0 8px 25px rgba(20, 184, 166, 0.2), 0 0 0 1px rgba(20, 184, 166, 0.2) !important;
}

.favoritos-page-body .card-content {
  padding: 16px 20px 20px 20px !important;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}
.favoritos-page-body .card-title {
  font-family: 'Outfit', sans-serif !important;
  font-weight: 700 !important;
  font-size: 1.05rem !important;
  color: #ffffff !important;
  margin-bottom: 6px !important;
}

/* Card Metadata Row styles */
.favoritos-page-body .card-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.favoritos-page-body .card-meta-category {
  font-size: 0.8rem;
  font-weight: 600;
  color: #72b04d;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.category-icon-bg {
  background-color: white;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 0.8rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.25);
  margin-right: 2px;
}
.favoritos-page-body .card-meta-dist {
  font-size: 0.75rem;
  font-weight: 700;
  color: #fde047;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Followed Actors Cards overrides matching AgentesView.vue */
.agente-card { 
    padding: 30px 20px; 
    align-items: center; 
    text-align: center; 
    background: var(--tarjeta-bg-dark, rgba(30, 41, 59, 0.45));
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border: 1px solid var(--tarjeta-border-dark, rgba(255, 255, 255, 0.08));
    box-shadow: var(--shadow-sh, 0 4px 20px rgba(0, 0, 0, 0.3));
    border-radius: var(--radius-lg, 20px);
    display: flex;
    flex-direction: column;
    position: relative;
    height: 100%;
}
.agente-img { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary-color, #72B04D); margin-bottom: 15px; }
.agente-card h3 { margin: 0 0 5px 0; color: white; font-size: 1.3rem; }
.agente-especialidad { color: var(--primary-color, #72B04D); font-weight: 600; font-size: 0.9rem; margin-bottom: 10px; }
.agente-org { color: #aaa; font-size: 0.85rem; margin-bottom: 5px; }
.agente-socials { margin-top: 15px; display: flex; gap: 15px; font-size: 1.2rem; justify-content: center; }
.agente-socials a { color: var(--primary-color, #72B04D); transition: color 0.3s ease; }
.agente-socials a:hover { color: white; }
.agente-mini-desc { font-size: 0.8rem; color: #ccc; margin: 10px 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; text-overflow: ellipsis; line-height: 1.4; }

/* Dynamic Theme Colors by Specialty */
.theme-green {
  --theme-color: #72B04D;
  border-left: 5px solid var(--theme-color) !important;
}
.theme-blue {
  --theme-color: #0077b6;
  border-left: 5px solid var(--theme-color) !important;
}
.theme-purple {
  --theme-color: #6a00a8;
  border-left: 5px solid var(--theme-color) !important;
}
.theme-default {
  --theme-color: #2a9d8f;
  border-left: 5px solid var(--theme-color) !important;
}

/* Specialty Text Highlights */
.theme-green .agente-especialidad { color: #72B04D !important; }
.theme-blue .agente-especialidad { color: #0077b6 !important; }
.theme-purple .agente-especialidad { color: #b862ff !important; }
.theme-default .agente-especialidad { color: #2a9d8f !important; }

.theme-green .agente-socials a { color: #72B04D !important; }
.theme-blue .agente-socials a { color: #0077b6 !important; }
.theme-purple .agente-socials a { color: #b862ff !important; }
.theme-default .agente-socials a { color: #2a9d8f !important; }

/* Active Glow Effect */
.agente-activo {
  border: 1px solid var(--theme-color) !important;
  animation: pulse-glow-agente 2.5s infinite ease-in-out;
}

@keyframes pulse-glow-agente {
  0%, 100% {
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2), 0 0 0px var(--theme-color);
  }
  50% {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 8px var(--theme-color);
  }
}

/* Active Badge Styling */
#agentes-container .activo-badge {
  position: absolute !important;
  top: 12px !important;
  right: 12px !important;
  margin: 0 !important;
  z-index: 10 !important;
}
.activo-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid rgba(16, 185, 129, 0.2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.pulse-dot {
  width: 6px;
  height: 6px;
  background-color: #10b981;
  border-radius: 50%;
  display: inline-block;
  animation: dot-pulse 1.8s infinite ease-in-out;
}
@keyframes dot-pulse {
  0%, 100% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
}

/* Verified Badge Styling */
.verified-badge-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
}
.verified-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(114, 176, 77, 0.3);
  overflow: hidden;
  box-shadow: 0 0 8px rgba(114, 176, 77, 0.2);
}
.verified-logo-img {
  width: 18px;
  height: 18px;
  object-fit: cover;
  border-radius: 50%;
}
.verified-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--theme-color, #72B04D);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Explicit Category Badge in Card */
.agente-category-pill {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  width: fit-content;
  text-transform: uppercase;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}
.theme-green .agente-category-pill {
  background: rgba(114, 176, 77, 0.12) !important;
  color: #72B04D !important;
  border: 1px solid rgba(114, 176, 77, 0.2) !important;
}
.theme-blue .agente-category-pill {
  background: rgba(0, 119, 182, 0.12) !important;
  color: #4db6e8 !important;
  border: 1px solid rgba(0, 119, 182, 0.2) !important;
}
.theme-purple .agente-category-pill {
  background: rgba(106, 0, 168, 0.12) !important;
  color: #b862ff !important;
  border: 1px solid rgba(106, 0, 168, 0.2) !important;
}
.theme-default .agente-category-pill {
  background: rgba(42, 157, 143, 0.12) !important;
  color: #2a9d8f !important;
  border: 1px solid rgba(42, 157, 143, 0.2) !important;
}

/* Desktop/Tablet Horizontal Rectangular Layout */
@media (min-width: 769px) {
  #agentes-container {
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)) !important;
    gap: 30px !important;
  }
  #agentes-container .agente-card {
    flex-direction: row !important;
    align-items: center !important;
    text-align: left !important;
    padding: 24px 24px 24px 36px !important;
    gap: 24px !important;
    border-radius: 20px !important;
    height: 100% !important;
    position: relative !important;
  }
  .agente-img {
    width: 110px !important;
    height: 110px !important;
    border-radius: 16px !important;
    margin-bottom: 0 !important;
    flex-shrink: 0 !important;
  }
  .agente-info {
    display: flex !important;
    flex-direction: column !important;
    flex-grow: 1 !important;
    overflow: hidden !important;
  }
  .agente-card h3 {
    margin: 0 0 4px 0 !important;
    font-size: 1.25rem !important;
  }
  .agente-especialidad {
    margin-bottom: 4px !important;
  }
  .agente-org {
    margin-bottom: 8px !important;
  }
  .agente-mini-desc {
    margin: 0 0 12px 0 !important;
    line-height: 1.4 !important;
  }
  .agente-socials {
    margin-top: 0 !important;
    justify-content: flex-start !important;
  }
}

/* Responsive Mobile Horizontal Rectangular Layout */
@media (max-width: 768px) {
  #agentes-container {
    grid-template-columns: 1fr !important;
    gap: 15px !important;
  }
  #agentes-container .agente-card {
    flex-direction: row !important;
    align-items: flex-start !important;
    text-align: left !important;
    padding: 16px !important;
    gap: 16px !important;
    border-radius: 16px !important;
    height: auto !important;
    position: relative !important;
  }
  #agentes-container .agente-img {
    width: 85px !important;
    height: 85px !important;
    border-radius: 12px !important;
    margin-bottom: 0 !important;
    flex-shrink: 0 !important;
  }
  #agentes-container .agente-info {
    display: flex !important;
    flex-direction: column !important;
    flex-grow: 1 !important;
    overflow: hidden !important;
  }
  #agentes-container .agente-card h3 {
    font-size: 1.05rem !important;
    margin: 0 0 2px 0 !important;
    white-space: normal !important;
    text-align: left !important;
    width: auto !important;
    display: inline-flex !important;
    align-items: center !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
  }
  #agentes-container .agente-category-pill {
    font-size: 0.65rem !important;
    padding: 2px 8px !important;
    margin-bottom: 4px !important;
  }
  #agentes-container .agente-especialidad {
    font-size: 0.75rem !important;
    text-align: left !important;
    margin-bottom: 2px !important;
  }
  #agentes-container .agente-org {
    display: block !important;
    font-size: 0.7rem !important;
    color: #aaa !important;
    margin-bottom: 4px !important;
  }
  #agentes-container .agente-mini-desc {
    display: block !important;
    font-size: 0.75rem !important;
    color: #ccc !important;
    margin: 4px 0 8px 0 !important;
    line-height: 1.4 !important;
    overflow: hidden !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    text-overflow: ellipsis !important;
  }
  #agentes-container .agente-socials {
    display: flex !important;
    margin-top: 4px !important;
    font-size: 1rem !important;
    gap: 10px !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    justify-content: flex-start !important;
  }
  #agentes-container .activo-badge {
    font-size: 0.65rem !important;
    padding: 1px 6px !important;
  }
  #agentes-container .verified-text {
    font-size: 0.65rem !important;
  }
  #agentes-container .verified-badge {
    width: 20px !important;
    height: 20px !important;
  }
  #agentes-container .verified-logo-img {
    width: 14px !important;
    height: 14px !important;
  }
}

/* Event Filter Pill Controls styling */
.event-filter-controls {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 25px;
}
.filter-pill-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}
.filter-pill-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.filter-pill-btn.active {
  background: rgba(114, 176, 77, 0.15) !important;
  border-color: rgba(114, 176, 77, 0.3) !important;
  color: #72b04d !important;
  box-shadow: 0 0 10px rgba(114, 176, 77, 0.15);
}

/* Mobile responsive styles for narrow viewports */
@media (max-width: 480px) {
  .favoritos-page-body #contenedor-tarjetas,
  .favoritos-page-body .card-grid-container {
    row-gap: 36px !important;
    column-gap: 12px !important;
  }
  .dash-header {
    flex-direction: column !important;
    text-align: center !important;
    padding: 20px !important;
    gap: 15px !important;
  }
  .dash-info h1 {
    font-size: 1.5rem !important;
  }
  .dash-info p {
    font-size: 0.85rem !important;
  }
  .segmented-control {
    display: flex !important;
    flex-wrap: wrap !important;
    width: 100% !important;
    border-radius: 14px !important;
    justify-content: center !important;
  }
  .segment-btn {
    flex: 1 1 40% !important;
    padding: 8px 12px !important;
    font-size: 0.8rem !important;
    justify-content: center !important;
  }
}

/* Extremely narrow viewport adjustments (like 216px width) - Keep 2 columns but stack/scale elements */
@media (max-width: 350px) {
  .favoritos-page-body #contenedor-tarjetas {
    grid-template-columns: repeat(2, 1fr) !important;
    row-gap: 36px !important;
    column-gap: 10px !important;
  }
  .favoritos-page-body .card-grid-container {
    grid-template-columns: repeat(2, 1fr) !important;
    row-gap: 36px !important;
    column-gap: 10px !important;
  }
  .favoritos-page-body .card-wrapper {
    padding-top: 18px !important;
    margin-top: 10px !important;
  }
  .favoritos-page-body .card {
    min-height: 290px !important;
    border-radius: 12px !important;
    overflow: visible !important;
  }
  .favoritos-page-body .card-image {
    height: 85px !important;
    border-top-left-radius: 11px !important;
    border-top-right-radius: 11px !important;
  }
  /* Remove old absolute positioning overrides */
  .favoritos-page-body .card-category {
    display: none !important;
  }
  .favoritos-page-body .dist-badge {
    display: none !important;
  }
  /* Compact actor badge at the top-center edge */
  .favoritos-page-body .actor-badge {
    top: 18px !important;
    padding: 2px 6px !important;
    font-size: 0.58rem !important;
    border-width: 1.5px !important;
  }
  .favoritos-page-body .actor-badge i {
    font-size: 0.55rem !important;
  }
  /* Text container compacting and vertical stretching */
  .favoritos-page-body .card-content {
    padding: 8px 6px !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: flex-start !important;
    gap: 4px !important;
  }
  /* Stack the meta row items vertically to fit narrow width */
  .favoritos-page-body .card-meta-row {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 2px !important;
    margin-bottom: 4px !important;
  }
  .favoritos-page-body .card-meta-category {
    font-size: 0.65rem !important;
  }
  .favoritos-page-body .card-meta-dist {
    font-size: 0.65rem !important;
  }
  .favoritos-page-body .status-badge {
    font-size: 0.58rem !important;
    padding: 1px 4px !important;
  }
  .favoritos-page-body .card-title {
    font-size: 0.78rem !important;
    line-height: 1.2 !important;
    margin-bottom: 4px !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  .favoritos-page-body .card-date-sub {
    font-size: 0.65rem !important;
    margin-top: 2px !important;
  }
  /* Segmented control tabs compacting */
  .segment-btn span {
    display: none !important;
  }
  .segment-btn {
    flex: 1 !important;
    padding: 10px 8px !important;
    font-size: 1.15rem !important;
  }
  .event-filter-controls {
    gap: 8px !important;
  }
  .filter-pill-btn {
    font-size: 0.75rem !important;
    padding: 6px 10px !important;
    flex: 1 !important;
    justify-content: center !important;
  }
}
</style>
