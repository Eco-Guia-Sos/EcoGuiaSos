<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// State
const item = ref<any | null>(null)
const loading = ref(true)
const errorMsg = ref('')
const currentSlide = ref(0)
const subEventos = ref<any[]>([])
const hasSocial = ref(false)

// Publisher Actor Info
const actor = ref<any | null>(null)
const isFollowingActor = ref(false)
const followActorLoading = ref(false)

// Favorites state
const isFavorite = ref(false)
const favoriteLoading = ref(false)

declare const maplibregl: any
let mapInstance: any = null

const itemId = computed(() => route.params.id as string)
const isEventType = computed(() => route.path.includes('eventos'))
const typeLabel = computed(() => isEventType.value ? 'evento' : 'lugar')

// Slide images helper
const images = computed(() => {
  if (!item.value) return ['/assets/img/kpop.webp']
  let imgs = item.value.imagenes
  
  if (imgs) {
    if (typeof imgs === 'string') {
      try {
        const parsed = JSON.parse(imgs)
        if (Array.isArray(parsed)) {
          imgs = parsed
        } else {
          imgs = [imgs]
        }
      } catch (e) {
        if (imgs.trim()) {
          imgs = [imgs.trim()]
        } else {
          imgs = []
        }
      }
    }
  } else {
    imgs = []
  }

  if (!Array.isArray(imgs)) {
    imgs = []
  }

  imgs = imgs.filter((u: any) => typeof u === 'string' && u.trim() !== '')

  if (imgs.length === 0) {
    const singleImg = item.value.imagen || item.value.imagen_url
    if (singleImg && typeof singleImg === 'string' && singleImg.trim()) {
      imgs.push(singleImg.trim())
    }
  }

  if (imgs.length === 0) {
    imgs.push('/assets/img/kpop.webp')
  }

  return imgs
})

const getMetaIcon = (net: any) => {
  const icons: Record<string, string> = {
    social_web: 'fa-solid fa-globe',
    social_fb: 'fa-brands fa-facebook',
    social_ig: 'fa-brands fa-instagram',
    social_wa: 'fa-brands fa-whatsapp',
    social_x: 'fa-brands fa-x-twitter',
    social_yt: 'fa-brands fa-youtube'
  }
  return icons[net] || 'fa-solid fa-globe'
}

const getMetaTitle = (net: any) => {
  const titles: Record<string, string> = {
    social_web: 'Sitio Web',
    social_fb: 'Facebook',
    social_ig: 'Instagram',
    social_wa: 'WhatsApp',
    social_x: 'X / Twitter',
    social_yt: 'YouTube'
  }
  return titles[net] || 'Enlace'
}

const socialNetworks = computed(() => {
  if (!item.value) return []
  const keys = ['social_web', 'social_fb', 'social_ig', 'social_wa', 'social_x', 'social_yt']
  const classes: Record<string, string> = {
    social_web: 'web',
    social_fb: 'facebook',
    social_ig: 'instagram',
    social_wa: 'whatsapp',
    social_x: 'x-twitter',
    social_yt: 'youtube'
  }
  const nets = keys
    .filter(key => item.value[key])
    .map(key => ({
      key,
      url: item.value[key],
      icon: getMetaIcon(key),
      title: getMetaTitle(key),
      className: classes[key] || 'web'
    }))
  return nets
})

const formattedDate = computed(() => {
  if (!item.value) return ''
  if (item.value.fecha_inicio) {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    }
    const dInicio = new Date(item.value.fecha_inicio)
    let txt = dInicio.toLocaleDateString('es-MX', options)
    
    if (item.value.fecha_fin) {
      const dFin = new Date(item.value.fecha_fin)
      txt += ` y finaliza el ${dFin.toLocaleDateString('es-MX', options)}`
    }
    return txt
  }
  return item.value.horarios || 'Consulte disponibilidad directamente en el recinto.'
})

// Fetch Data
const loadDetailData = async () => {
  loading.value = true
  errorMsg.value = ''
  item.value = null
  actor.value = null
  subEventos.value = []
  
  const tableName = isEventType.value ? 'eventos' : 'lugares'
  
  try {
    if (!itemId.value) {
      throw new Error('No se proporcionó un identificador de proyecto.')
    }

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', itemId.value)
      .single()

    if (error || !data) {
      throw new Error('No encontramos el proyecto solicitado.')
    }

    item.value = data
    document.title = `${data.nombre} - EcoGuía SOS`

    // Sub-events if it's a place
    if (!isEventType.value) {
      await loadSubEvents()
    }

    // Load publisher actor
    if (data.owner_id) {
      await loadPublisherActor(data.owner_id)
    }

    // Check favorite status
    if (authStore.user) {
      await checkFavoriteStatus()
    }

    // Apagar la carga para que Vue renderice el contenedor del mapa en el DOM
    loading.value = false

    await nextTick()
    
    // Map init
    initMiniMap()
  } catch (err: any) {
    console.error('Error cargando detalles:', err)
    errorMsg.value = err.message || 'Ocurrió un error inesperado.'
    loading.value = false
  }
}

const loadSubEvents = async () => {
  try {
    const { data, error } = await supabase
      .from('eventos')
      .select('id, nombre, imagen, fecha_inicio, imagen_url')
      .eq('lugar_id', itemId.value)
      .order('fecha_inicio', { ascending: true })

    if (!error && data) {
      subEventos.value = data
    }
  } catch (e) {
    console.error('Error loading sub-events:', e)
  }
}

const loadPublisherActor = async (ownerId: string) => {
  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', ownerId)
      .single()

    if (!error && data) {
      actor.value = data
      await checkFollowActorStatus(ownerId)
    }
  } catch (e) {
    console.error('Error loading actor section:', e)
  }
}

const checkFollowActorStatus = async (actorId: string) => {
  if (!authStore.user) return
  try {
    const { data, error } = await supabase
      .from('seguimientos_actores')
      .select('id')
      .eq('user_id', authStore.user.id)
      .eq('actor_id', actorId)
      .limit(1)
      .maybeSingle()

    isFollowingActor.value = !error && !!data
  } catch (e) {
    console.error('Error checking follow status:', e)
  }
}

const handleFollowActorToggle = async () => {
  if (!authStore.user) {
    router.push('/auth?tab=login')
    return
  }
  if (!actor.value) return

  followActorLoading.value = true
  try {
    const userId = authStore.user.id
    const actorId = actor.value.id

    if (isFollowingActor.value) {
      const { error } = await supabase
        .from('seguimientos_actores')
        .delete()
        .eq('user_id', userId)
        .eq('actor_id', actorId)

      if (!error) isFollowingActor.value = false
    } else {
      await supabase
        .from('seguimientos_actores')
        .delete()
        .eq('user_id', userId)
        .eq('actor_id', actorId)

      const { error } = await supabase
        .from('seguimientos_actores')
        .insert({ user_id: userId, actor_id: actorId })

      if (!error) isFollowingActor.value = true
    }
  } catch (e) {
    console.error('Error actualizando seguimiento:', e)
  } finally {
    followActorLoading.value = false
  }
}

const checkFavoriteStatus = async () => {
  if (!authStore.user) return
  try {
    const { data, error } = await supabase
      .from('favoritos')
      .select('id')
      .eq('user_id', authStore.user.id)
      .eq('item_id', itemId.value)
      .eq('item_tipo', typeLabel.value)
      .limit(1)
      .maybeSingle()

    isFavorite.value = !error && !!data
  } catch (e) {
    console.error('Error checking favorite status:', e)
  }
}

const handleFavoriteToggle = async () => {
  if (!authStore.user) {
    router.push('/auth?tab=login')
    return
  }

  favoriteLoading.value = true
  try {
    const userId = authStore.user.id
    const id = itemId.value
    const type = typeLabel.value

    if (isFavorite.value) {
      // Find fav ID
      const { data } = await supabase
        .from('favoritos')
        .select('id')
        .eq('user_id', userId)
        .eq('item_id', id)
        .eq('item_tipo', type)
        .limit(1)
        .maybeSingle()

      if (data) {
        const { error } = await supabase
          .from('favoritos')
          .delete()
          .eq('id', data.id)
        if (!error) isFavorite.value = false
      }
    } else {
      const { error } = await supabase
        .from('favoritos')
        .insert({
          user_id: userId,
          item_id: id,
          item_tipo: type
        })
      if (!error) isFavorite.value = true
    }
  } catch (e) {
    console.error('Error toggling favorite:', e)
  } finally {
    favoriteLoading.value = false
  }
}

// Mini Map initialization
const initMiniMap = () => {
  console.log('[MiniMap] initMiniMap triggered');
  if (!item.value) {
    console.log('[MiniMap] Return early: item.value is null');
    return;
  }
  console.log('[MiniMap] item values:', { modality: item.value.modalidad, lat: item.value.lat, lng: item.value.lng });
  
  if (item.value.lat == null || item.value.lng == null) {
    console.log('[MiniMap] Return early: lat or lng is null/undefined');
    return;
  }

  const lat = parseFloat(item.value.lat)
  const lng = parseFloat(item.value.lng)
  console.log('[MiniMap] parsed coordinates:', { lat, lng });
  
  if (isNaN(lat) || isNaN(lng)) {
    console.log('[MiniMap] Return early: lat or lng is NaN');
    return;
  }

  const container = document.getElementById('detail-mini-map')
  if (!container) {
    console.log('[MiniMap] Return early: container #detail-mini-map not found in DOM');
    return;
  }
  console.log('[MiniMap] Container found:', container);

  if (typeof maplibregl === 'undefined') {
    console.warn('[MiniMap] MapLibre GL library not loaded yet on window.');
    return
  }

  try {
    if (mapInstance) {
      console.log('[MiniMap] Removing previous map instance');
      mapInstance.remove()
    }

    console.log('[MiniMap] Instantiating new MapLibre instance...');
    mapInstance = new maplibregl.Map({
      container: 'detail-mini-map',
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
          }
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 20
          }
        ]
      },
      center: [lng, lat],
      zoom: 15,
      interactive: false
    })

    mapInstance.on('load', () => {
      console.log('[MiniMap] MapInstance loaded event fired');
      if (!mapInstance) return
      mapInstance.resize()
      
      console.log('[MiniMap] Adding marker...');
      new maplibregl.Marker({ color: '#72B04D' })
        .setLngLat([lng, lat])
        .addTo(mapInstance)
    })
  } catch (e) {
    console.error('[MiniMap] Exception caught:', e)
  }
}

// Slideshow Navigation
const nextSlide = () => {
  if (currentSlide.value < images.value.length - 1) {
    currentSlide.value++
  } else {
    currentSlide.value = 0
  }
}

const prevSlide = () => {
  if (currentSlide.value > 0) {
    currentSlide.value--
  } else {
    currentSlide.value = images.value.length - 1
  }
}

const setSlide = (idx: number | string) => {
  currentSlide.value = typeof idx === 'string' ? parseInt(idx, 10) : idx
}

// Social Sharing
const shareContent = () => {
  if (!item.value) return
  if (navigator.share) {
    navigator.share({
      title: item.value.nombre,
      text: `Mira este proyecto ecológico en EcoGuía SOS: ${item.value.nombre}`,
      url: window.location.href
    }).catch(err => console.log('Error sharing:', err))
  } else {
    navigator.clipboard.writeText(window.location.href)
    alert('¡Enlace copiado al portapapeles!')
  }
}

onMounted(() => {
  loadDetailData()
})

// Watch parameters to re-run on path shifts
watch(() => route.params.id, () => {
  loadDetailData()
})
watch(() => route.path, () => {
  loadDetailData()
})
</script>

<template>
  <div>
    <!-- LOADING SHIMMER -->
    <div v-if="loading" id="detail-loader" class="full-screen-loader">
      <div class="spinner"></div>
    </div>

    <!-- ERROR VIEW -->
    <div v-else-if="errorMsg" class="no-events" style="padding: 100px 20px; text-align: center;">
      <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; color: #ff4d4d; margin-bottom: 20px;"></i>
      <h2>¡Vaya! Algo salió mal</h2>
      <p>{{ errorMsg }}</p>
      <br>
      <RouterLink to="/" class="btn btn-primary">Volver al inicio</RouterLink>
    </div>

    <!-- MAIN DETAIL CONTENT -->
    <main v-else-if="item" id="detail-main-content">
      <!-- 1. HERO SECTION -->
      <header class="detail-hero">
        <div class="hero-bg-blur" id="hero-bg-blur" :style="`background-image: url(${images[0]});`"></div>
        <div class="hero-container container">
          <div class="hero-info no-poster">
            <h1 id="detail-title">{{ item.nombre }}</h1>
            <div class="hero-meta">
              <div class="meta-item">
                <i class="fa-solid fa-tag"></i>
                <span id="detail-category">{{ item.categoria || 'General' }}</span>
              </div>
              <div class="meta-item highlight">
                <i class="fa-solid fa-clock"></i>
                <span id="detail-time-status">Hoy disponible</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- 2. CONTENT GRID -->
      <div class="content-wrapper container">
        <article class="main-content">
          <!-- Description -->
          <section class="info-section">
            <h2 class="section-title"><i class="fa-solid fa-circle-info"></i> Acerca de</h2>
            <div id="detail-description" class="description-text" style="white-space: pre-line;">
              {{ item.descripcion || 'Sin descripción detallada por el momento.' }}
            </div>
          </section>

          <!-- Sub-events (if place) -->
          <section v-if="!isEventType && subEventos.length > 0" id="sub-events-section" class="info-section">
            <h3 class="section-title" style="font-size: 1.2rem; color: #5bc2f7; margin-bottom: 20px;">
              <i class="fa-solid fa-calendar-star"></i> Próximos Eventos Aquí
            </h3>
            <div id="detail-sub-events" style="display: flex; overflow-x: auto; gap: 15px; padding-bottom: 10px;">
              <div 
                v-for="ev in subEventos" 
                :key="ev.id" 
                class="mini-event-card hover-glow"
                style="min-width: 160px; max-width: 180px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; cursor: pointer; transition: 0.3s; padding-bottom: 5px;"
                @click="router.push(`/eventos/${ev.id}`)"
              >
                <div style="height: 100px; width: 100%; overflow: hidden;">
                  <img 
                    :src="ev.imagen_url || ev.imagen || '/assets/img/kpop.webp'" 
                    style="width: 100%; height: 100%; object-fit: cover;" 
                    :alt="ev.nombre"
                    @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
                  >
                </div>
                <div style="padding: 12px;">
                  <h4 style="font-size: 0.9rem; margin: 0 0 6px 0; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" :title="ev.nombre">{{ ev.nombre }}</h4>
                  <p style="font-size: 0.75rem; color: #5bc2f7; margin: 0; font-weight: 600;">
                    <i class="fa-regular fa-clock"></i> 
                    {{ ev.fecha_inicio ? new Date(ev.fecha_inicio).toLocaleDateString() : 'Próximamente' }}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- Schedules -->
          <section class="info-section">
            <h2 class="section-title"><i class="fa-solid fa-calendar-days"></i> Horarios y Disponibilidad</h2>
            <div class="schedule-grid" id="detail-schedule">
              <div class="schedule-card">
                <p class="label">{{ isEventType ? 'Fecha y Hora' : 'Horario' }}</p>
                <p class="value" id="detail-hours" v-html="formattedDate"></p>
              </div>
            </div>
          </section>

          <!-- Publisher Actor Card Section -->
          <section 
            v-if="actor" 
            class="info-section actor-card-lite"
            style="margin-top: 40px; padding: 20px; background: rgba(255,255,255,0.03); border-radius: 15px; border: 1px solid rgba(255,255,255,0.05);"
          >
            <h3 style="font-size: 1.1rem; color: #888; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">Publicado por:</h3>
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
              <img 
                :src="actor.avatar_url || actor.imagen_url || '/assets/img/kpop.webp'" 
                style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary-color);"
                @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
              >
              <div style="flex-grow: 1;">
                <h4 style="margin: 0; color: white; font-size: 1.2rem;">{{ actor.nombre_completo || 'Agente de Cambio' }}</h4>
                <p style="margin: 3px 0 0 0; color: var(--primary-color); font-size: 0.9rem;">{{ actor.especialidad || 'Líder Ambiental' }}</p>
              </div>
              <div style="display: flex; gap: 10px; margin-left: auto;">
                <RouterLink 
                  :to="`/agentes/${actor.id}`" 
                  class="btn-ver-perfil-actor" 
                  style="padding: 10px 18px; font-size: 0.85rem; color: #72B04D; border: 1px solid #72B04D; border-radius: 30px; text-decoration: none; font-weight: 600; transition: all 0.3s ease;"
                >
                  Ver perfil
                </RouterLink>
                <button 
                  v-if="authStore.user && authStore.user.id !== actor.id"
                  id="btn-follow-actor" 
                  class="btn btn-primary" 
                  style="padding: 10px 18px; font-size: 0.85rem; border-radius: 30px;"
                  :style="isFollowingActor ? 'background: #333; border-color: #72B04D; color: #72B04D;' : ''"
                  :disabled="followActorLoading"
                  @click="handleFollowActorToggle"
                >
                  {{ isFollowingActor ? '✓ Siguiendo' : '+ Seguir' }}
                </button>
              </div>
            </div>
          </section>
        </article>

        <!-- Col 2: Flyer / Imagen Central -->
        <div class="flyer-content">
          <div class="flyer-wrapper" id="slider-container" style="position: relative; overflow: hidden; border-radius: 20px; background: rgba(0,0,0,0.2);">
            <!-- Slider Track -->
            <div 
              id="slider-track" 
              style="display: flex; height: 100%; transition: transform 0.3s ease;"
              :style="`transform: translateX(-${currentSlide * 100}%);`"
            >
              <img 
                v-for="(imgUrl, i) in images" 
                :key="i"
                :src="imgUrl" 
                :alt="item.nombre" 
                style="width: 100%; height: 100%; object-fit: cover; flex-shrink: 0;"
                @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
              >
            </div>

            <!-- Badge Type -->
            <span 
              id="detail-type-badge" 
              class="badge-pill type-badge"
              :style="`background: ${isEventType ? 'var(--color-gaia)' : 'var(--color-eco)'};`"
            >
              {{ isEventType ? 'EVENTO ECOLÓGICO' : 'LUGAR SUSTENTABLE' }}
            </span>

            <!-- Controls (if more than 1 image) -->
            <template v-if="images.length > 1">
              <button class="slider-btn prev" id="slider-prev" @click="prevSlide" aria-label="Foto anterior">
                <i class="fa-solid fa-chevron-left"></i>
              </button>
              <button class="slider-btn next" id="slider-next" @click="nextSlide" aria-label="Siguiente foto">
                <i class="fa-solid fa-chevron-right"></i>
              </button>
              
              <!-- Indicator Dots -->
              <div class="slider-dots" id="slider-dots">
                <div 
                  v-for="(dot, idx) in images" 
                  :key="idx" 
                  class="dot"
                  :class="{ 'active': idx === currentSlide }"
                  @click="setSlide(idx)"
                ></div>
              </div>
            </template>
          </div>
        </div>

        <!-- 3. SIDEBAR -->
        <aside class="side-panel">
          <div class="sticky-card glass-effect">
            <!-- Sidebar Map (Only if presencial or hybrid, i.e. has coordinates) -->
            <div v-if="item.modalidad !== 'en_linea' && item.lat && item.lng" class="sidebar-map-container" style="margin-bottom: 15px;">
              <div id="detail-mini-map"></div>
            </div>
            
            <div class="sidebar-info">
              <!-- Location block -->
              <div class="location-box" style="margin-bottom: 20px;">
                <p class="location-label">MODALIDAD</p>
                <h4 style="color: var(--color-eco); margin: 4px 0 8px 0; font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 6px;">
                  <span v-if="item.modalidad === 'en_linea'">🖥️ Virtual / En Línea</span>
                  <span v-else-if="item.tiene_sesion_online">🔄 Híbrido (Presencial + En Línea)</span>
                  <span v-else>📍 Presencial</span>
                </h4>
                
                <template v-if="item.modalidad !== 'en_linea'">
                  <p class="location-label" style="margin-top: 12px;">UBICACIÓN</p>
                  <h4 id="detail-location-name" style="margin: 4px 0;">{{ item.nombre }}</h4>
                  <p id="detail-address" class="location-address">{{ item.ubicacion || 'Dirección no especificada' }}</p>
                </template>
                <template v-else>
                  <p class="location-label" style="margin-top: 12px;">PLATAFORMA</p>
                  <p style="color: #94a3b8; font-size: 0.9rem; margin: 4px 0 0 0;">Acceso virtual a través del enlace de sesión</p>
                </template>
              </div>

              <!-- Social links for this event/place -->
              <div style="margin-bottom: 25px;">
                <h4 style="font-size: 0.8rem; color: #888; text-transform: uppercase; margin-bottom: 12px;">Redes Sociales</h4>
                <div id="detail-social-links" style="display: flex; gap: 10px; flex-wrap: wrap;">
                  <template v-if="socialNetworks.length > 0">
                    <a 
                      v-for="net in socialNetworks" 
                      :key="net.key"
                      :href="net.url" 
                      target="_blank"
                      class="social-btn"
                      :class="net.className"
                      :title="net.title"
                      style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.05); color: white; transition: 0.3s; border: 1px solid rgba(255,255,255,0.08);"
                    >
                      <i :class="net.icon"></i>
                    </a>
                  </template>
                  <p v-else style="color: #666; font-style: italic; font-size: 0.8rem;">No hay redes registradas.</p>
                </div>
              </div>

              <div class="action-buttons">
                <!-- Google Maps redirection (Presencial / Hybrid only) -->
                <a 
                  v-if="item.modalidad !== 'en_linea' && item.lat && item.lng"
                  :href="`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`" 
                  target="_blank" 
                  class="btn btn-secondary full-width"
                >
                  <i class="fa-solid fa-map-location-dot"></i> Cómo llegar
                </a>
                
                <button class="btn btn-outline full-width" @click="shareContent">
                  <i class="fa-solid fa-share-nodes"></i> Compartir
                </button>
                
                <button 
                  v-if="authStore.user"
                  class="btn btn-outline full-width" 
                  :style="isFavorite ? 'background: rgba(114, 176, 77, 0.2); border-color: #72B04D; color: #72B04D;' : ''"
                  :disabled="favoriteLoading"
                  @click="handleFavoriteToggle"
                >
                  <i class="fa-bookmark" :class="isFavorite ? 'fa-solid' : 'fa-regular'"></i> 
                  {{ isFavorite ? 'Guardado' : 'Guardar en Favoritos' }}
                </button>
                
                <!-- Smart Sumate Buttons -->
                <!-- Case 1: Pure Online -->
                <template v-if="item.modalidad === 'en_linea'">
                  <!-- Session link (Required) -->
                  <a 
                    v-if="item.sesion_online_link"
                    :href="item.sesion_online_link" 
                    target="_blank" 
                    class="btn btn-primary full-width shimmer-extra"
                    style="margin-bottom: 8px;"
                  >
                    <i class="fa-solid fa-desktop"></i> Unirse a la sesión
                  </a>
                  <!-- Registration form link (Optional) -->
                  <a 
                    v-if="item.reg_link"
                    :href="item.reg_link" 
                    target="_blank" 
                    class="btn btn-secondary full-width"
                  >
                    <i class="fa-solid fa-clipboard-list"></i> Registrarse al evento
                  </a>
                </template>
                
                <!-- Case 2: Hybrid -->
                <template v-else-if="item.tiene_sesion_online">
                  <!-- Registration / Presencial link (Optional) -->
                  <a 
                    v-if="item.reg_link"
                    :href="item.reg_link" 
                    target="_blank" 
                    class="btn btn-primary full-width shimmer-extra"
                    style="margin-bottom: 8px;"
                  >
                    <i class="fa-solid fa-hand-holding-heart"></i> Súmate presencialmente
                  </a>
                  <!-- Session link (Required) -->
                  <a 
                    v-if="item.sesion_online_link"
                    :href="item.sesion_online_link" 
                    target="_blank" 
                    class="btn btn-secondary full-width"
                  >
                    <i class="fa-solid fa-desktop"></i> Ver sesión en línea
                  </a>
                </template>

                <!-- Case 3: Pure Presencial -->
                <template v-else>
                  <a 
                    v-if="item.reg_link"
                    :href="item.reg_link" 
                    target="_blank" 
                    class="btn btn-primary full-width shimmer-extra"
                  >
                    <i class="fa-solid fa-hand-holding-heart"></i> Súmate ahora
                  </a>
                </template>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <!-- UI MOBILE: Bottom Action Bar -->
      <div class="mobile-action-bar">
        <a 
          v-if="item.modalidad !== 'en_linea' && item.lat && item.lng"
          :href="`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`" 
          target="_blank"
          class="btn-circular"
        >
          <i class="fa-solid fa-location-dot"></i>
        </a>
        <button class="btn-circular" @click="shareContent"><i class="fa-solid fa-share-nodes"></i></button>
        <button 
          v-if="authStore.user" 
          class="btn-circular" 
          :style="isFavorite ? 'color: #72B04D;' : ''" 
          @click="handleFavoriteToggle"
        >
          <i class="fa-bookmark" :class="isFavorite ? 'fa-solid' : 'fa-regular'"></i>
        </button>
        <!-- Smart Sumate Buttons (Mobile) -->
        <!-- Case 1: Pure Online -->
        <template v-if="item.modalidad === 'en_linea'">
          <a 
            v-if="item.sesion_online_link" 
            :href="item.sesion_online_link" 
            target="_blank" 
            class="btn btn-primary flex-grow" 
            style="display: flex; justify-content: center; align-items: center; text-decoration: none;"
          >
            🖥️ Unirse
          </a>
          <a 
            v-if="item.reg_link" 
            :href="item.reg_link" 
            target="_blank" 
            class="btn btn-secondary flex-grow" 
            style="display: flex; justify-content: center; align-items: center; text-decoration: none;"
          >
            📋 Registro
          </a>
        </template>
        <!-- Case 2: Hybrid -->
        <template v-else-if="item.tiene_sesion_online">
          <a 
            v-if="item.reg_link" 
            :href="item.reg_link" 
            target="_blank" 
            class="btn btn-primary flex-grow" 
            style="display: flex; justify-content: center; align-items: center; text-decoration: none;"
          >
            📍 Presencial
          </a>
          <a 
            v-if="item.sesion_online_link" 
            :href="item.sesion_online_link" 
            target="_blank" 
            class="btn btn-secondary flex-grow" 
            style="display: flex; justify-content: center; align-items: center; text-decoration: none;"
          >
            🖥️ Online
          </a>
        </template>
        <!-- Case 3: Pure Presencial -->
        <template v-else>
          <a 
            v-if="item.reg_link" 
            :href="item.reg_link" 
            target="_blank" 
            class="btn btn-primary flex-grow" 
            style="display: flex; justify-content: center; align-items: center; text-decoration: none;"
          >
            Súmate
          </a>
        </template>
      </div>
    </main>
  </div>
</template>

<style>
@import '../assets/css/detalles.css';
@import '../assets/css/style.css';

/* Fix specific overrides and additions for details view styling */
.full-screen-loader {
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--color-fondo);
  z-index: 9999;
}
.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(114, 176, 77, 0.1);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Image Slider styles */
.slider-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: 0.3s;
}
.slider-btn:hover {
  background: var(--primary-color);
  color: black;
}
.slider-btn.prev { left: 15px; }
.slider-btn.next { right: 15px; }
.slider-dots {
  position: absolute;
  bottom: 15px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
}
.slider-dots .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.4);
  cursor: pointer;
  transition: 0.3s;
}
.slider-dots .dot.active {
  background: white;
  width: 20px;
  border-radius: 10px;
}

/* Social Buttons custom colors */
.social-btn.web:hover { background: var(--primary-color) !important; color: black !important; }
.social-btn.facebook:hover { background: #3b5998 !important; }
.social-btn.instagram:hover { background: #e1306c !important; }
.social-btn.whatsapp:hover { background: #25d366 !important; }
.social-btn.x-twitter:hover { background: #111 !important; }
.social-btn.youtube:hover { background: #ff0000 !important; }

/* Publisher ver perfil button styling */
.btn-ver-perfil-actor:hover {
  background: #72B04D !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(114, 176, 77, 0.3);
}
</style>
