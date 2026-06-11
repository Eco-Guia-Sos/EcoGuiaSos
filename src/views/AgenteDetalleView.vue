<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const errorMsg = ref('')
const agente = ref<any | null>(null)
const eventos = ref<any[]>([])
const isFollowing = ref(false)
const followLoading = ref(false)
const followerCount = ref(0)

const agentId = computed(() => route.params.id as string)

const isOwnProfile = computed(() => {
  return authStore.user && authStore.user.id === agentId.value
})

// Mapeo de nivel de experiencia
const NIVEL_MAP: Record<string, { emoji: string; label: string; color: string }> = {
  'Principiante': { emoji: '🐦', label: 'Colibrí', color: '#72B04D' },
  'Intermedio':   { emoji: '🦎', label: 'Ajolote', color: '#0ea5e9' },
  'Experimentado':{ emoji: '🐺', label: 'Lobo',    color: '#c084fc' },
}

// Mapeo de causas de interés
const CAUSAS_MAP: Record<string, { emoji: string; label: string }> = {
  reforestacion:       { emoji: '🌱', label: 'Reforestación' },
  agua:                { emoji: '💧', label: 'Agua' },
  fauna:               { emoji: '🦎', label: 'Fauna Silvestre' },
  educacion:           { emoji: '🌍', label: 'Educación Ambiental' },
  reciclaje:           { emoji: '♻️', label: 'Reciclaje' },
  huertos:             { emoji: '🌆', label: 'Huertos Urbanos' },
  conservacion_marina: { emoji: '🌊', label: 'Conservación Marina' },
  polinizadores:       { emoji: '🦋', label: 'Polinizadores' },
  normativa:           { emoji: '📜', label: 'Normativa Ambiental' },
}

const getImgSrc = (ev: any) => {
  let imgSrc = ev.imagen_url
  if (ev.imagenes && Array.isArray(ev.imagenes) && ev.imagenes.length > 0) {
    imgSrc = ev.imagenes[0]
  }
  return imgSrc || '/assets/img/kpop.webp'
}

const cleanWhatsappNumber = (wa: string) => {
  return wa ? wa.replace(/\D/g, '') : ''
}

// Extrae el ID de un video de YouTube y devuelve la URL de embed
const getYoutubeEmbed = (url: string): string | null => {
  try {
    const regexes = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ]
    for (const regex of regexes) {
      const match = url.match(regex)
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`
      }
    }
    return null
  } catch {
    return null
  }
}

const fetchAgentProfile = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    if (!agentId.value) {
      router.push('/agentes')
      return
    }

    // 1. Get profile data
    const { data: perfil, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', agentId.value)
      .single()

    if (error || !perfil) {
      throw new Error('Perfil no encontrado')
    }

    agente.value = {
      nombre: perfil.nombre_completo || 'Agente de Cambio',
      imagen_url: perfil.avatar_url || perfil.imagen_url || '/assets/img/kpop.webp',
      banner_img: perfil.banner_img || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2013&auto=format&fit=crop',
      especialidad: perfil.especialidad || (perfil.rol === 'actor' ? 'Líder Ambiental' : perfil.rol) || 'Agente de Cambio',
      descripcion: perfil.descripcion || null,
      bio: perfil.bio || null,
      usuario_id: perfil.id,
      is_verified: perfil.is_validated || false,
      organizacion: perfil.organizacion || null,
      mision: perfil.mision || null,
      impacto_resumen: perfil.impacto_resumen || '--',
      alcaldia: perfil.alcaldia || perfil.zona || null,
      redes_ig: perfil.redes_ig || perfil.links_sociales?.instagram || null,
      redes_fb: perfil.redes_fb || perfil.links_sociales?.facebook || null,
      redes_x: perfil.redes_x || perfil.links_sociales?.twitter || null,
      redes_web: perfil.redes_web || perfil.links_sociales?.web || null,
      redes_wa: perfil.redes_wa || perfil.links_sociales?.whatsapp || null,
      // Nuevos campos
      habilidades: perfil.habilidades || null,
      causas_interes: Array.isArray(perfil.causas_interes) ? perfil.causas_interes : [],
      nivel_experiencia: perfil.nivel_experiencia || null,
      disponibilidad: perfil.disponibilidad || null,
      videos_presentacion: Array.isArray(perfil.videos_presentacion) ? perfil.videos_presentacion : [],
      zonas_impacto: Array.isArray(perfil.zonas_impacto) ? perfil.zonas_impacto : [],
    }

    document.title = `${agente.value.nombre} | EcoGuía SOS`

    // 2. Fetch events, followers
    await Promise.all([
      fetchAgentEvents(),
      fetchFollowerCount(),
    ])

    // 3. Setup follow logic if user is authenticated
    if (authStore.user) {
      await checkFollowStatus()
    }
  } catch (err: any) {
    console.error('[AgenteDetalle] Error:', err)
    errorMsg.value = err.message || 'Error al cargar el perfil del agente.'
  } finally {
    loading.value = false
  }
}

const fetchAgentEvents = async () => {
  try {
    const { data, error } = await supabase
      .from('eventos')
      .select('*')
      .eq('owner_id', agentId.value)
      .order('fecha_inicio', { ascending: false })

    if (error) throw error
    eventos.value = data || []
  } catch (err) {
    console.error('Error loading events:', err)
  }
}

const fetchFollowerCount = async () => {
  try {
    const { count, error } = await supabase
      .from('seguimientos_actores')
      .select('*', { count: 'exact', head: true })
      .eq('actor_id', agentId.value)

    if (!error && count !== null) {
      followerCount.value = count
    }
  } catch (err) {
    console.error('Error fetching follower count:', err)
  }
}

const checkFollowStatus = async () => {
  if (!authStore.user || isOwnProfile.value) return
  try {
    const { data, error } = await supabase
      .from('seguimientos_actores')
      .select('id')
      .eq('user_id', authStore.user.id)
      .eq('actor_id', agentId.value)
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      isFollowing.value = true
    } else {
      isFollowing.value = false
    }
  } catch (e) {
    console.error('Error checking follow status:', e)
  }
}

const handleFollowToggle = async () => {
  if (!authStore.user) {
    router.push('/auth?tab=login')
    return
  }
  
  followLoading.value = true
  try {
    const userId = authStore.user.id
    const actorId = agentId.value

    if (isFollowing.value) {
      const { error } = await supabase
        .from('seguimientos_actores')
        .delete()
        .eq('user_id', userId)
        .eq('actor_id', actorId)

      if (!error) {
        isFollowing.value = false
        followerCount.value = Math.max(0, followerCount.value - 1)
      }
    } else {
      await supabase
        .from('seguimientos_actores')
        .delete()
        .eq('user_id', userId)
        .eq('actor_id', actorId)

      const { error } = await supabase
        .from('seguimientos_actores')
        .insert({ user_id: userId, actor_id: actorId })

      if (!error) {
        isFollowing.value = true
        followerCount.value += 1
      }
    }
  } catch (e) {
    console.error('Error toggling follow:', e)
  } finally {
    followLoading.value = false
  }
}

// Habilidades como array
const habilidadesArray = computed(() => {
  if (!agente.value?.habilidades) return []
  return agente.value.habilidades
    .split(/[,;\n]+/)
    .map((h: string) => h.trim())
    .filter((h: string) => h.length > 0)
    .slice(0, 10)
})

// Videos con embed URL válido
const videosEmbeds = computed(() => {
  if (!agente.value?.videos_presentacion?.length) return []
  return agente.value.videos_presentacion
    .map((url: string) => ({ url, embed: getYoutubeEmbed(url) }))
    .filter((v: any) => v.embed !== null)
})

// Nivel de experiencia formateado
const nivelExperienciaBadge = computed(() => {
  if (!agente.value || !agente.value.nivel_experiencia) return null
  return NIVEL_MAP[agente.value.nivel_experiencia] || null
})

// Causas de interés detalladas para iterar sin v-if + v-for colisionando
const causasDetalle = computed(() => {
  if (!agente.value || !Array.isArray(agente.value.causas_interes)) return []
  return agente.value.causas_interes
    .map((id: string) => ({ id, ...CAUSAS_MAP[id] }))
    .filter((c: any) => c.label !== undefined)
})

// ── Video Slider state ────────────────────────────────────────────────
const videoSliderRef = ref<HTMLElement | null>(null)
const videoSliderIndex = ref(0)

const scrollVideoSlider = (dir: -1 | 1) => {
  const track = videoSliderRef.value
  if (!track) return
  const newIdx = Math.max(0, Math.min(videoSliderIndex.value + dir, videosEmbeds.value.length - 1))
  videoSliderIndex.value = newIdx
  const slide = track.children[newIdx] as HTMLElement | undefined
  if (slide) slide.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
}

const goToVideoSlide = (i: number) => {
  const track = videoSliderRef.value
  if (!track) return
  videoSliderIndex.value = i
  const slide = track.children[i] as HTMLElement | undefined
  if (slide) slide.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
}

const handleTrackScroll = () => {
  const track = videoSliderRef.value
  if (!track || track.children.length === 0) return

  const scrollLeft = track.scrollLeft
  const firstSlide = track.children[0] as HTMLElement | undefined
  if (!firstSlide) return

  const slideWidth = firstSlide.offsetWidth + 16
  if (slideWidth <= 0) return

  const newIndex = Math.round(scrollLeft / slideWidth)
  if (newIndex >= 0 && newIndex < videosEmbeds.value.length && newIndex !== videoSliderIndex.value) {
    videoSliderIndex.value = newIndex
  }
}

const userCoords = ref<{ lat: number; lng: number } | null>(null)

const getUserCoordinates = () => {
  if (!authStore.user) return
  const saved = localStorage.getItem('eco_user_coords')
  if (saved) {
    try {
      userCoords.value = JSON.parse(saved)
    } catch (e) {
      console.error('Error parsing coordinates from cache:', e)
    }
  }
  if (!userCoords.value && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userCoords.value = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }
        localStorage.setItem('eco_user_coords', JSON.stringify(userCoords.value))
      },
      (err) => console.log('Silent geolocation error in profile view:', err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    )
  }
}

const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const getEventDistanceText = (ev: any) => {
  if (!authStore.user || !userCoords.value) return ''
  if (ev.modalidad === 'en_linea') return 'virtual'
  if (ev.lat == null || ev.lng == null) return ''
  const dist = calcularDistancia(userCoords.value.lat, userCoords.value.lng, ev.lat, ev.lng)
  if (dist < 1) return `${(dist * 1000).toFixed(0)} m`
  return `${dist.toFixed(1)} km`
}

const formatearFecha = (fecha: string) => {
  if (!fecha) return ''
  try {
    const d = new Date(fecha)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toLocaleDateString('es-MX', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (e) {
    return ''
  }
}

onMounted(() => {
  fetchAgentProfile()
  getUserCoordinates()
})

watch(() => route.params.id, () => {
  fetchAgentProfile()
})

watch(() => authStore.user, (newUser) => {
  if (newUser) {
    getUserCoordinates()
  } else {
    userCoords.value = null
  }
}, { immediate: true })
</script>

<template>
  <main class="content-section" style="padding-top: 100px; max-width: 100%; padding-left: 1rem; padding-right: 1rem; box-sizing: border-box; display: block;">
    <div class="container" style="max-width: 1200px; margin: 0 auto; padding-left: 0; padding-right: 0;">
      
      <!-- Botón Volver -->
      <div style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <RouterLink to="/agentes" class="btn-ghost-eco">
          <i class="fa-solid fa-arrow-left"></i> Volver a Agentes
        </RouterLink>
        <!-- Editar propio perfil -->
        <RouterLink 
          v-if="isOwnProfile"
          to="/admin?tab=perfil"
          class="btn btn-secondary"
          id="btn-edit-own-profile"
          style="font-size: 0.85rem; padding: 8px 18px; border-radius: 20px;"
        >
          <i class="fa-solid fa-pen-to-square"></i> Editar mi Perfil
        </RouterLink>
      </div>

      <div v-if="loading" class="no-events" id="profile-loader">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Cargando perfil del agente...
      </div>

      <div v-else-if="errorMsg" class="no-events">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar el perfil</h3>
        <p>{{ errorMsg }}</p>
      </div>

      <div v-else-if="agente" id="profile-content">
        <!-- Header de Perfil -->
        <div class="agent-profile-header">
          <img id="agent-banner" :src="agente.banner_img" alt="Banner" class="agent-banner">
          <div class="agent-info-overlay">
            <img id="agent-avatar" :src="agente.imagen_url" alt="Avatar" class="agent-avatar-large" @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'">
            <div class="agent-titles">
              <h1 id="agent-name">
                {{ agente.nombre }}
                <i v-if="agente.is_verified" class="fa-solid fa-circle-check verified-badge"></i>
              </h1>
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px;">
                <p id="agent-specialty" style="margin: 0;">
                  {{ agente.especialidad }}<span v-if="agente.organizacion"> | {{ agente.organizacion }}</span>
                </p>
                <!-- Badge de Perfil Verificado -->
                <span 
                  v-if="agente.is_verified"
                  class="nivel-badge"
                  style="border-color: #3897f0; color: #3897f0; background: rgba(56, 151, 240, 0.05);"
                  id="agent-verified-badge"
                >
                  <i class="fa-solid fa-circle-check"></i> Eco Actor Verificado
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <button 
                  v-if="authStore.user && !isOwnProfile"
                  id="btn-follow-profile" 
                  class="btn btn-primary" 
                  style="padding: 5px 15px; font-size: 0.8rem; border-radius: 20px;"
                  :style="isFollowing ? 'background: #333; border-color: #72B04D; color: #72B04D;' : ''"
                  :disabled="followLoading"
                  @click="handleFollowToggle"
                >
                  {{ isFollowing ? '✓ Siguiendo' : '+ Seguir' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="profile-grid">
          <!-- Columna Principal -->
          <div class="profile-main">
            <div class="profile-main-card">
              <!-- Sobre el Agente Section Wrapper -->
              <div class="about-agent-section">
                <!-- Misión -->
                <div v-if="agente.mision" id="agent-mision" class="mision-box">
                  "{{ agente.mision }}"
                </div>
                
                <!-- Sobre el Agente -->
                <h3>Sobre el Agente</h3>
                <p v-if="agente.descripcion" id="agent-desc">{{ agente.descripcion }}</p>
                <p v-else-if="agente.bio" id="agent-desc">{{ agente.bio }}</p>
                <p v-else id="agent-desc" style="color: #666; font-style: italic;">Este agente aún no ha configurado su descripción.</p>
              </div>

              <!-- Eventos y Proyectos -->
              <div class="events-grid">
                <h3><i class="fa-solid fa-calendar-star"></i> Proyectos y Eventos</h3>
                <div 
                  v-if="eventos.length === 0" 
                  id="agent-events-container"
                  class="no-events"
                >
                  <p>Este agente aún no ha publicado eventos o proyectos.</p>
                </div>
                <div 
                  v-else
                  id="agent-events-container" 
                  class="card-grid-container" 
                  style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; padding: 0;"
                >
                  <article 
                    v-for="ev in eventos" 
                    :key="ev.id" 
                    class="dash-card" 
                    @click="router.push(`/eventos/${ev.id}`)" 
                    style="cursor: pointer;"
                  >
                    <div class="dash-card-image-wrapper">
                      <img 
                        :src="getImgSrc(ev)" 
                        :alt="ev.nombre" 
                        class="dash-card-img" 
                        style="width: 100%; height: 100%; object-fit: cover;" 
                        @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
                      >
                    </div>
                    <div class="dash-card-body" style="padding: 15px; display: flex; flex-direction: column; gap: 8px;">
                      <h3 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; font-size: 1.05rem;" :title="ev.nombre">{{ ev.nombre }}</h3>
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="color: var(--primary-color); font-size: 0.8rem; font-weight: 700; text-transform: uppercase;">{{ ev.categoria || 'Evento' }}</span>
                        
                        <!-- Badges de Modalidad -->
                        <span v-if="ev.modalidad === 'en_linea'" class="status-badge" style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9; font-size: 0.65rem; border: 1px solid rgba(14, 165, 233, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                          🖥️ En Línea
                        </span>
                        <span v-else-if="ev.tiene_sesion_online" class="status-badge" style="background: rgba(139, 92, 246, 0.15); color: #c084fc; font-size: 0.65rem; border: 1px solid rgba(139, 92, 246, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                          🔄 Híbrido
                        </span>
                        <span v-else-if="ev.modalidad === 'presencial'" class="status-badge" style="background: rgba(114, 176, 77, 0.15); color: #72B04D; font-size: 0.65rem; border: 1px solid rgba(114, 176, 77, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                          📍 Presencial
                        </span>
                      </div>
                      
                      <!-- Fecha del Evento -->
                      <p v-if="ev.fecha_inicio" style="margin: 0; font-size: 0.8rem; color: #a3aab1; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-calendar-day" style="color: var(--primary-color);"></i>
                        {{ formatearFecha(ev.fecha_inicio) }}
                      </p>
                      
                      <!-- Distancia al Evento -->
                      <p v-if="authStore.user && ev.modalidad !== 'en_linea' && getEventDistanceText(ev)" style="margin: 0; font-size: 0.8rem; color: #f0f2f5; display: flex; align-items: center; gap: 6px; font-weight: 600;">
                        <i class="fa-solid fa-location-dot" style="color: #FFD700;"></i>
                        <span>A {{ getEventDistanceText(ev) }}</span>
                      </p>
                    </div>
                  </article>
                </div>
              </div>

              <!-- Habilidades -->
              <div v-if="habilidadesArray.length > 0" class="profile-section-block" id="agent-habilidades">
                <h4><i class="fa-solid fa-screwdriver-wrench" style="color: var(--primary-color);"></i> Habilidades</h4>
                <div class="chips-grid">
                  <span v-for="hab in habilidadesArray" :key="hab" class="skill-chip">{{ hab }}</span>
                </div>
              </div>

              <!-- Causas que apoya -->
              <div v-if="causasDetalle.length > 0" class="profile-section-block" id="agent-causas">
                <h4><i class="fa-solid fa-heart" style="color: #f43f5e;"></i> Causas que Apoya</h4>
                <div class="chips-grid">
                  <span 
                    v-for="causa in causasDetalle" 
                    :key="causa.id" 
                    class="causa-chip"
                  >
                    {{ causa.emoji }} {{ causa.label }}
                  </span>
                </div>
              </div>

              <!-- Videos de Presentación -->
              <div v-if="videosEmbeds.length > 0" class="profile-section-block" :class="{ 'has-2-videos': videosEmbeds.length === 2 }" id="agent-videos">
                <div class="videos-slider-header">
                  <h3><i class="fa-brands fa-youtube" style="color: #FF0000;"></i> Videos de Presentación</h3>
                  <div v-if="videosEmbeds.length > 1" class="slider-nav-btns">
                    <button
                      class="slider-nav-btn"
                      :disabled="videoSliderIndex === 0"
                      @click="scrollVideoSlider(-1)"
                      aria-label="Video anterior"
                    ><i class="fa-solid fa-chevron-left"></i></button>
                    <span class="slider-counter">{{ videoSliderIndex + 1 }} / {{ videosEmbeds.length }}</span>
                    <button
                      class="slider-nav-btn"
                      :disabled="videoSliderIndex === videosEmbeds.length - 1"
                      @click="scrollVideoSlider(1)"
                      aria-label="Video siguiente"
                    ><i class="fa-solid fa-chevron-right"></i></button>
                  </div>
                </div>

                <div class="videos-slider-track" ref="videoSliderRef" @scroll="handleTrackScroll">
                  <div v-for="(video, i) in videosEmbeds" :key="i" class="video-slide">
                    <div class="video-embed-wrapper">
                      <iframe
                        :src="video.embed"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        loading="lazy"
                      ></iframe>
                    </div>
                  </div>
                </div>

                <!-- Dots -->
                <div v-if="videosEmbeds.length > 1" class="video-slider-dots">
                  <button
                    v-for="(_, i) in videosEmbeds"
                    :key="i"
                    class="video-slider-dot"
                    :class="{ active: videoSliderIndex === Number(i) }"
                    @click="goToVideoSlide(Number(i))"
                    :aria-label="`Ir al video ${Number(i) + 1}`"
                  ></button>
                </div>
              </div>
            </div>
          </div>

          <!-- Columna Lateral -->
          <div class="profile-side">
            <div class="profile-main-card">
              <!-- Disponibilidad (Hasta Arriba) -->
              <div v-if="agente.disponibilidad" class="sidebar-availability-top" id="agent-disponibilidad" style="margin-bottom: 20px;">
                <span class="availability-desc" style="display: block; font-size: 0.8rem; color: #a3aab1; margin-bottom: 6px; font-weight: 500;">
                  Mis eventos normalmente son:
                </span>
                <div class="availability-badge" style="display: inline-flex; align-items: center; gap: 8px; background: rgba(114, 176, 77, 0.15); color: #72B04D; padding: 6px 12px; border-radius: 8px; font-size: 0.88rem; font-weight: 600;">
                  <i class="fa-solid fa-calendar-check"></i>
                  <span>{{ agente.disponibilidad }}</span>
                </div>
              </div>

              <!-- Stats -->
              <div class="agent-stats">
                <div class="stat-item">
                  <span class="stat-value" id="count-followers">{{ followerCount }}</span>
                  <span class="stat-label">Seguidores</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value" id="count-events">{{ eventos.length }}</span>
                  <span class="stat-label">Eventos</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value" id="count-impact">{{ agente.zonas_impacto?.length || 0 }}</span>
                  <span class="stat-label">Zonas</span>
                </div>
              </div>

              <!-- Ubicación -->
              <div v-if="agente.alcaldia" class="sidebar-info-row" id="agent-location-row" style="margin-top: 15px;">
                <i class="fa-solid fa-location-dot" style="color: var(--primary-color);"></i>
                <span id="agent-location">{{ agente.alcaldia }}</span>
              </div>

              <!-- Zonas de Impacto (Chips) -->
              <div v-if="agente.zonas_impacto && agente.zonas_impacto.length > 0" class="sidebar-impact-zones" style="margin-top: 20px;">
                <h5 style="font-size: 0.9rem; font-weight: 700; margin: 0 0 10px 0; color: white; display: flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-earth-americas" style="color: var(--primary-color);"></i> Zonas de Impacto
                </h5>
                <div class="chips-grid" style="display: flex; flex-wrap: wrap; gap: 6px;">
                  <span 
                    v-for="zona in agente.zonas_impacto" 
                    :key="zona" 
                    class="zona-chip"
                    style="display: inline-block; padding: 4px 10px; border-radius: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #ddd; font-size: 0.75rem; font-weight: 500;"
                  >
                    {{ zona }}
                  </span>
                </div>
              </div>

              <hr style="border-color: rgba(255,255,255,0.05); margin: 20px 0;">

              <!-- Redes Sociales -->
              <h4>Contacto y Redes</h4>
              <div id="agent-socials" class="agente-socials" style="justify-content: flex-start; margin-bottom: 0;">
                <template v-if="agente.redes_ig || agente.redes_fb || agente.redes_x || agente.redes_web || agente.redes_wa">
                  <a v-if="agente.redes_fb" :href="agente.redes_fb" target="_blank" class="social-btn facebook" title="Facebook"><i class="fa-brands fa-facebook"></i></a>
                  <a v-if="agente.redes_ig" :href="agente.redes_ig" target="_blank" class="social-btn instagram" title="Instagram"><i class="fa-brands fa-instagram"></i></a>
                  <a v-if="agente.redes_wa" :href="`https://wa.me/${cleanWhatsappNumber(agente.redes_wa)}`" target="_blank" class="social-btn whatsapp" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
                  <a v-if="agente.redes_x" :href="agente.redes_x" target="_blank" class="social-btn x-twitter" title="X / Twitter"><i class="fa-brands fa-x-twitter"></i></a>
                  <a v-if="agente.redes_web" :href="agente.redes_web" target="_blank" class="social-btn web" title="Sitio Web"><i class="fa-solid fa-globe"></i></a>
                </template>
                <p v-else style="color: #666; font-size: 0.8rem; margin: 0;">Sin redes sociales vinculadas.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style>
@import '../assets/css/interior-pages.css';
@import '../assets/css/style.css';

/* ── Estilos del Perfil del Agente ─────────────────────── */
.agent-profile-header {
    position: relative;
    margin-bottom: 40px;
}

.agent-banner {
    width: 100%;
    height: 250px;
    object-fit: cover;
    border-radius: 20px;
    background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
}

.agent-info-overlay {
    position: relative;
    margin-top: -60px;
    padding: 0 30px;
    display: flex;
    align-items: flex-end;
    gap: 25px;
}

.agent-avatar-large {
    width: 150px;
    height: 150px;
    border-radius: 50%;
    border: 5px solid var(--color-fondo);
    object-fit: cover;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    background-color: var(--color-fondo);
    flex-shrink: 0;
}

.agent-titles {
    padding-bottom: 15px;
}

.agent-titles h1 {
    font-size: 2.2rem;
    margin: 0 0 6px 0;
    color: white;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.verified-badge {
    color: #3897f0;
    font-size: 1.5rem;
}

.agent-titles p {
    color: var(--primary-color);
    font-weight: 600;
    margin: 0;
}

/* Badge de nivel */
.nivel-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 20px;
    border: 1px solid;
    font-size: 0.75rem;
    font-weight: 700;
    background: rgba(255,255,255,0.04);
    backdrop-filter: blur(4px);
}

/* Layout del perfil */
.profile-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 30px;
    width: 100%;
}

.profile-main,
.profile-side {
    min-width: 0;
    width: 100%;
}

.profile-main-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    padding: 30px;
}

.mision-box {
    background: rgba(114, 176, 77, 0.1);
    border-left: 4px solid var(--primary-color);
    padding: 20px;
    border-radius: 0 15px 15px 0;
    margin-bottom: 30px;
    font-style: italic;
    color: #eee;
}

/* Secciones secundarias del perfil */
.profile-section-block {
    margin-top: 30px;
    padding-top: 25px;
    border-top: 1px solid rgba(255,255,255,0.05);
}

.profile-section-block h4 {
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 14px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}

/* Chips de habilidades y causas */
.chips-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.skill-chip {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    background: rgba(114, 176, 77, 0.12);
    border: 1px solid rgba(114, 176, 77, 0.3);
    color: #72B04D;
    font-size: 0.8rem;
    font-weight: 600;
}

.causa-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 14px;
    border-radius: 20px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #ddd;
    font-size: 0.8rem;
    font-weight: 500;
}

/* ── Videos Slider ───────────────────────────────────────────────── */
.videos-slider-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
}

.videos-slider-header h3 {
    margin: 0;
}

.slider-nav-btns {
    display: flex;
    align-items: center;
    gap: 8px;
}

.slider-nav-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.06);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    transition: background 0.2s, border-color 0.2s;
}

.slider-nav-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.14);
    border-color: rgba(255,255,255,0.3);
}

.slider-nav-btn:disabled {
    opacity: 0.3;
    cursor: default;
}

.slider-counter {
    font-size: 0.78rem;
    color: #888;
    min-width: 36px;
    text-align: center;
}

.videos-slider-track {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    padding-bottom: 8px;
    /* hide scrollbar */
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.videos-slider-track::-webkit-scrollbar {
    display: none;
}

.video-slide {
    flex: 0 0 calc(100% - 0px);
    scroll-snap-align: start;
}

@media (min-width: 1024px) {
  .video-slide {
    flex: 0 0 calc(50% - 8px);
  }
}

.video-embed-wrapper {
    position: relative;
    padding-bottom: 56.25%; /* 16:9 */
    height: 0;
    border-radius: 14px;
    overflow: hidden;
    background: #000;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

.video-embed-wrapper iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 14px;
}

/* Video Slider Dots específicos */
.video-slider-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-top: 12px;
}

.video-slider-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.2);
    cursor: pointer;
    padding: 0;
    transition: background 0.25s, transform 0.2s;
}

.video-slider-dot.active {
    background: #FF0000;
    transform: scale(1.3);
}

@media (min-width: 1024px) {
  .has-2-videos .video-slider-dots,
  .has-2-videos .slider-nav-btns {
    display: none !important;
  }
}

/* Botones de Redes Sociales en el Perfil Público */
.agente-socials {
  display: flex !important; /* Forzar visualización en móvil, sobreescribiendo interior-pages.css */
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.profile-side .agente-socials {
  display: flex !important;
}

.agente-socials .social-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.agente-socials .social-btn:hover {
  transform: scale(1.1);
  color: white;
}

.agente-socials .social-btn.facebook:hover { background: #1877F2; border-color: #1877F2; }
.agente-socials .social-btn.instagram:hover { background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); border-color: transparent; }
.agente-socials .social-btn.whatsapp:hover { background: #25D366; border-color: #25D366; }
.agente-socials .social-btn.x-twitter:hover { background: #000000; border-color: #333; }
.agente-socials .social-btn.web:hover { background: #10b981; border-color: #10b981; }


/* Stats */
.agent-stats {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.stat-item {
    flex: 1;
    background: rgba(0, 0, 0, 0.2);
    padding: 12px 8px;
    border-radius: 12px;
    text-align: center;
}

.stat-value {
    display: block;
    font-size: 1.4rem;
    font-weight: 800;
    color: white;
}

.stat-label {
    font-size: 0.68rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* Filas de info del sidebar */
.sidebar-info-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: #aaa;
    margin-bottom: 10px;
}

.sidebar-info-row i {
    width: 16px;
    text-align: center;
}

/* Sección de eventos */
.events-grid {
    margin-top: 40px;
    padding-top: 30px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.no-events {
    padding: 40px;
    text-align: center;
    color: #666;
    border: 2px dashed rgba(255, 255, 255, 0.05);
    border-radius: 15px;
}

.dash-card-image-wrapper {
    position: relative;
    width: 100%;
    height: 160px;
    overflow: hidden;
    border-radius: 12px 12px 0 0;
}

/* ── Responsive ─────────────────────────────────────────── */
@media (max-width: 768px) {
    .agent-info-overlay {
        flex-direction: column;
        align-items: center;
        text-align: center;
        margin-top: -75px;
        padding: 0 15px;
    }
    .agent-titles {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    .agent-avatar-large {
        width: 120px;
        height: 120px;
    }
    .agent-titles h1 {
        font-size: 1.7rem;
        justify-content: center;
    }
    .agent-stats {
        gap: 8px;
    }
    .stat-value {
        font-size: 1.2rem;
    }
    .videos-grid {
        grid-template-columns: 1fr;
    }
    .dash-card-image-wrapper {
        height: 80px;
    }
}
</style>
