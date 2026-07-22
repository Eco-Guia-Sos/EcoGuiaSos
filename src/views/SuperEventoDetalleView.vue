<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'
import { compressImage } from '../utils/imageCompressor'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const superEventoId = route.params.id as string

const superEvento = ref<any | null>(null)
const subEventos = ref<any[]>([])
const loading = ref(true)
const errorMsg = ref('')

const sectionCoverUrl = ref('')
const uploadingCover = ref(false)

const isAdmin = computed(() => {
  return authStore.profile?.rol === 'admin'
})

const fetchSectionCover = async () => {
  try {
    const { data, error } = await supabase
      .from('portadas_secciones')
      .select('imagen_url')
      .eq('seccion_id', 'super-eventos')
      .maybeSingle()
    if (!error && data && data.imagen_url) {
      sectionCoverUrl.value = data.imagen_url
    }
  } catch (err) {
    console.warn('Error fetching super-event cover fallback:', err)
  }
}

const triggerFileInput = () => {
  const input = document.getElementById('superevento-cover-file-input') as HTMLInputElement
  if (input) input.click()
}

const handleCoverUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingCover.value = true
  try {
    // 1. Compress image natively
    const compressedBlob = await compressImage(file, 1200, 0.8)
    const compressedFile = new File([compressedBlob], `superevento_${superEventoId}_${Date.now()}.jpg`, {
      type: 'image/jpeg'
    })

    // 2. Upload to Supabase Storage bucket 'imagenes-plataforma'
    const fileName = `supereventos/${superEventoId}_${Date.now()}.jpg`
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

    // 3. Update the specific super_evento's imagen_url in the DB
    const { error: dbError } = await supabase
      .from('super_eventos')
      .update({
        imagen_url: publicUrl
      })
      .eq('id', superEventoId)

    if (dbError) throw dbError

    if (superEvento.value) {
      superEvento.value.imagen_url = publicUrl
    }
    alert('¡Portada del Súper Evento actualizada correctamente!')
  } catch (err: any) {
    console.error('Error uploading cover:', err)
    alert('No se pudo subir la portada: ' + (err.message || err))
  } finally {
    uploadingCover.value = false
    target.value = ''
  }
}

const hasSocialLinks = computed(() => {
  if (!superEvento.value) return false
  return !!(
    superEvento.value.social_fb ||
    superEvento.value.social_ig ||
    superEvento.value.social_wa ||
    superEvento.value.social_x ||
    superEvento.value.social_yt ||
    superEvento.value.social_web
  )
})

// GPS and proximity state
const userCoords = ref<{ lat: number; lng: number } | null>(null)
const selectedEventDetail = ref<any | null>(null)

// Map instances
let mapInstance: maplibregl.Map | null = null
let currentMarkers: maplibregl.Marker[] = []
const markerElements = new Map<string, HTMLElement>()

// Haversine formula
const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const getDistanceText = (p: any) => {
  if (p.distancia_calculada !== undefined && p.distancia_calculada !== Infinity) {
    return `${p.distancia_calculada.toFixed(1)} km`
  }
  return ''
}

// Fetch super event and sub-events data
const fetchData = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    // 1. Fetch parent Super Evento
    const { data: seData, error: seErr } = await supabase
      .from('super_eventos')
      .select('*')
      .eq('id', superEventoId)
      .eq('estado', 'approved')
      .maybeSingle()

    if (seErr) throw seErr
    if (!seData) {
      errorMsg.value = 'El súper evento no fue encontrado o no está aprobado.'
      loading.value = false
      return
    }
    superEvento.value = seData

    // 2. Fetch associated sub-events
    const { data: subData, error: subErr } = await supabase
      .from('eventos')
      .select('*')
      .eq('super_evento_id', superEventoId)
      .eq('estado', 'approved')

    if (subErr) throw subErr
    const rawEvents = subData || []

    // 3. Fetch owner profiles for actor names manually (Supabase cache relations bypass)
    const ownerIds = [...new Set(rawEvents.map((r: any) => r.owner_id).filter(Boolean))] as string[]
    const profilesMap: Record<string, any> = {}
    
    if (ownerIds.length > 0) {
      const { data: pData } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, avatar_url')
        .in('id', ownerIds)
      
      if (pData) {
        pData.forEach((p: any) => {
          profilesMap[p.id] = p
        })
      }
    }

    subEventos.value = rawEvents.map((row: any) => {
      return {
        ...row,
        actor_nombre: row.owner_id && profilesMap[row.owner_id] ? profilesMap[row.owner_id].nombre_completo : 'Colectivo',
        actor_avatar: row.owner_id && profilesMap[row.owner_id] ? profilesMap[row.owner_id].avatar_url : null,
        coordenadas: (row.lat && row.lng) ? { lat: row.lat, lng: row.lng } : null,
        distancia_calculada: undefined
      }
    })

    // Request GPS permission to calculate distances
    requestUserLocation()

    // Fetch section cover fallback
    await fetchSectionCover()

  } catch (err: any) {
    console.error('Error fetching details:', err)
    errorMsg.value = 'Error al cargar los detalles del súper evento.'
  } finally {
    loading.value = false
  }
}

const requestUserLocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userCoords.value = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }
        recalculateDistances()
      },
      (err) => {
        console.warn('Geolocation permission denied or failed:', err)
      }
    )
  }
}

const recalculateDistances = () => {
  if (!userCoords.value) return
  subEventos.value = subEventos.value.map(ev => {
    if (ev.coordenadas && ev.coordenadas.lat && ev.coordenadas.lng) {
      ev.distancia_calculada = calcularDistancia(
        userCoords.value!.lat,
        userCoords.value!.lng,
        ev.coordenadas.lat,
        ev.coordenadas.lng
      )
    } else {
      ev.distancia_calculada = Infinity
    }
    return ev
  })

  // Sort sub-events by distance
  subEventos.value.sort((a, b) => (a.distancia_calculada || Infinity) - (b.distancia_calculada || Infinity))
  actualizarMapa()
}

// Maplibre implementation
const initMap = () => {
  if (mapInstance) return
  try {
    mapInstance = new maplibregl.Map({
      container: 'supereventos-map-container',
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors'
          }
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm'
        }]
      },
      center: [-99.1332, 19.4326],
      zoom: 11,
      scrollZoom: false
    })

    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right')

    mapInstance.on('load', () => {
      mapInstance?.resize()
      actualizarMapa()
    })
  } catch (err) {
    console.error('Error initializing map:', err)
  }
}

const actualizarMapa = () => {
  if (!mapInstance) return
  currentMarkers.forEach(m => m.remove())
  currentMarkers = []
  markerElements.clear()

  const bounds = new maplibregl.LngLatBounds()
  let hasCoords = false

  // User Marker
  if (userCoords.value) {
    const el = document.createElement('div')
    el.className = 'user-marker-premium'
    
    let avatarSrc = '/assets/img/logo-app.webp'
    const cachedAvatar = localStorage.getItem('eco_user_avatar')
    if (cachedAvatar) avatarSrc = cachedAvatar

    const avatarDiv = document.createElement('div')
    avatarDiv.className = 'user-marker-avatar'
    const avatarImg = document.createElement('img')
    avatarImg.src = avatarSrc
    avatarImg.alt = 'Tú'
    avatarImg.onerror = () => { avatarImg.src = '/assets/img/logo-app.webp' }
    avatarDiv.appendChild(avatarImg)

    const labelDiv = document.createElement('div')
    labelDiv.className = 'user-marker-label'
    labelDiv.textContent = 'Tú '
    const statusSpan = document.createElement('span')
    statusSpan.className = 'status'
    statusSpan.textContent = 'Aquí'
    labelDiv.appendChild(statusSpan)

    el.appendChild(avatarDiv)
    el.appendChild(labelDiv)

    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([userCoords.value.lng, userCoords.value.lat])
      .addTo(mapInstance)
    
    currentMarkers.push(marker)
    bounds.extend([userCoords.value.lng, userCoords.value.lat])
    hasCoords = true
  }

  // Sub-events Markers
  subEventos.value.forEach(ev => {
    if (ev.coordenadas && ev.coordenadas.lat && ev.coordenadas.lng) {
      const el = document.createElement('div')
      el.className = 'map-card-marker type-event'
      el.style.borderColor = '#72b04d'

      const pulse = document.createElement('div')
      pulse.className = 'marker-card-pulse'
      pulse.style.background = 'rgba(114,176,77,0.4)'

      const img = document.createElement('img')
      img.src = ev.imagen_url || '/assets/img/logo-app.webp'
      img.alt = ev.nombre || 'Evento'
      img.onerror = () => { img.src = '/assets/img/logo-app.webp' }

      el.appendChild(pulse)
      el.appendChild(img)

      markerElements.set(ev.id, el)

      el.onclick = () => {
        selectedEventDetail.value = ev
        mapInstance?.flyTo({ center: [ev.lng, ev.lat], zoom: 15 })
      }

      const popupContainer = document.createElement('div')
      popupContainer.style.cssText = 'color: black; font-family: "Inter", sans-serif; padding: 4px;'

      const h4 = document.createElement('h4')
      h4.style.cssText = 'margin: 0 0 4px 0; font-weight:800; font-size:0.9rem;'
      h4.textContent = ev.nombre || ''

      const catSpan = document.createElement('span')
      catSpan.style.cssText = 'font-size:0.7rem; color:#72b04d; font-weight:700; text-transform:uppercase;'
      catSpan.textContent = ev.categoria || 'Evento'

      const locP = document.createElement('p')
      locP.style.cssText = 'margin:4px 0 0 0; font-size:0.75rem; color:#475569;'
      locP.textContent = ev.ubicacion || 'CDMX'

      popupContainer.appendChild(h4)
      popupContainer.appendChild(catSpan)
      popupContainer.appendChild(locP)

      const popup = new maplibregl.Popup({ offset: 25, closeButton: false })
        .setDOMContent(popupContainer)

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([ev.coordenadas.lng, ev.coordenadas.lat])
        .setPopup(popup)
        .addTo(mapInstance!)

      currentMarkers.push(marker)
      bounds.extend([ev.coordenadas.lng, ev.coordenadas.lat])
      hasCoords = true
    }
  })

  if (hasCoords) {
    mapInstance.fitBounds(bounds, { padding: 50, maxZoom: 15 })
  }
}

const selectCard = (ev: any) => {
  selectedEventDetail.value = ev
  if (mapInstance && ev.lat && ev.lng) {
    mapInstance.flyTo({ center: [ev.lng, ev.lat], zoom: 15 })
  }
}

const esSubeventoFinalizado = (ev: any) => {
  const dateStr = ev.fecha_fin || ev.fecha_inicio
  if (!dateStr) return false
  try {
    const today = new Date()
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
    const d = (match && match[1] && match[2] && match[3]) 
      ? new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10))
      : new Date(dateStr)
    return d < startOfToday
  } catch (e) {
    return false
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
  } catch (e) {
    return dateStr
  }
}

const lightboxImage = ref<string | null>(null)
const openLightbox = (url: string) => {
  lightboxImage.value = url
}
const closeLightbox = () => {
  lightboxImage.value = null
}

onMounted(async () => {
  await fetchData()
  nextTick(() => {
    initMap()
  })
})

watch(subEventos, () => {
  nextTick(() => {
    actualizarMapa()
  })
})

watch(selectedEventDetail, (newVal, oldVal) => {
  if (oldVal) {
    const el = markerElements.get(oldVal.id)
    if (el) {
      el.style.borderColor = '#72b04d'
      const pulse = el.querySelector('.marker-card-pulse') as HTMLElement
      if (pulse) {
        pulse.style.background = 'rgba(114,176,77,0.4)'
      }
    }
  }
  if (newVal) {
    const el = markerElements.get(newVal.id)
    if (el) {
      el.style.borderColor = '#fbbf24'
      const pulse = el.querySelector('.marker-card-pulse') as HTMLElement
      if (pulse) {
        pulse.style.background = 'rgba(251,191,36,0.5)'
      }
    }
  }
})
</script>

<template>
  <div class="theme-ajolote" style="min-height: 100vh; background: #0b1329;">
    <!-- HEADER HERO BANNER -->
    <header 
      class="interior-hero" 
      :style="{ backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.65)), url(${superEvento?.imagen_url || sectionCoverUrl || '/assets/img/logo-app.webp'})` }"
      style="position: relative; overflow: hidden; padding-bottom: 2rem; background-size: cover; background-position: center; display: flex; align-items: center; min-height: 320px;"
    >
      <!-- Admin Cover Changer Floating Widget -->
      <div v-if="isAdmin" class="admin-cover-widget" style="position: absolute; top: 25px; right: 25px; z-index: 100;">
        <button 
          @click="triggerFileInput" 
          class="admin-cover-btn" 
          :disabled="uploadingCover"
          title="Cambiar imagen de portada del Súper Evento"
        >
          <i v-if="uploadingCover" class="fa-solid fa-spinner fa-spin"></i>
          <i v-else class="fa-solid fa-camera"></i>
          <span>{{ uploadingCover ? 'Subiendo...' : 'Cambiar portada' }}</span>
        </button>
        <input 
          type="file" 
          id="superevento-cover-file-input" 
          @change="handleCoverUpload" 
          accept="image/*" 
          style="display: none;" 
        />
      </div>
      
      <div class="hero-glass-panel" style="position: relative; z-index: 2; max-width: 1200px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <span class="category-badge" style="background: rgba(114, 176, 77, 0.2); border-color: rgba(114, 176, 77, 0.4); color: #8ce167; font-weight: 700;">🏆 Super Evento Colectivo</span>
          <button @click="router.push('/super-eventos')" class="back-btn-classic">
            <i class="fa-solid fa-arrow-left"></i> Volver a Super Eventos
          </button>
        </div>
        
        <h2 style="font-size: 2.2rem; font-weight: 800; text-shadow: 0 4px 10px rgba(0,0,0,0.5); color: white; margin: 5px 0;">{{ superEvento?.nombre }}</h2>
        <p style="font-size: 1.1rem; color: #cbd5e1; max-width: 800px; margin: 0; line-height: 1.6;">{{ superEvento?.descripcion_corta }}</p>
      </div>
    </header>

    <main style="max-width: 1200px; margin: 0 auto; padding: 20px 15px 60px; position: relative; z-index: 5;">
      
      <!-- DETALLES CARGANDO -->
      <div v-if="loading" style="text-align: center; padding: 100px 0; color: #94a3b8;">
        <i class="fa-solid fa-circle-notch fa-spin fa-2x"></i>
        <p style="margin-top: 15px; font-weight: 500;">Cargando detalles de este festival...</p>
      </div>

      <div v-else-if="errorMsg" style="text-align: center; padding: 100px 0; color: #ef4444;">
        <p>{{ errorMsg }}</p>
        <button @click="router.push('/super-eventos')" class="back-btn-classic" style="margin-top: 20px;">Ir a Catalogo</button>
      </div>

      <div v-else style="display: flex; flex-direction: column; gap: 40px;">
        
        <!-- PARTE CENTRAL: MAPA Y LISTADO DE SUBEVENTOS -->
        <div class="superevento-grid">
          <!-- LISTADO DE EVENTOS AFILIADOS -->
          <div class="superevento-sidebar-list">
            <h3 style="color: white; font-weight: 800; font-size: 1.3rem; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-calendar-days" style="color: #72b04d;"></i>
              Actividades Agrupadas ({{ subEventos.length }})
            </h3>

            <div v-if="subEventos.length === 0" style="background: rgba(15, 23, 42, 0.4); border: 1px dashed rgba(255,255,255,0.15); border-radius: 20px; padding: 40px 20px; text-align: center; color: #cbd5e1; backdrop-filter: blur(10px);">
              <i class="fa-solid fa-calendar-xmark" style="font-size: 2.5rem; color: #72b04d; margin-bottom: 15px; display: block;"></i>
              <p style="margin: 0; font-size: 0.95rem; font-weight: 500;">No se han registrado actividades aprobadas para este súper evento.</p>
            </div>

            <div v-else class="event-cards-list" style="display: flex; flex-direction: column; gap: 15px; max-height: 430px; overflow-y: auto; padding-right: 5px;">
              <div 
                v-for="ev in subEventos" 
                :key="ev.id"
                class="subevent-card"
                :class="{ 'active': selectedEventDetail?.id === ev.id }"
                @click="selectCard(ev)"
                style="cursor: pointer; border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 16px; transition: all 0.3s ease; position: relative; overflow: hidden; background: rgba(255,255,255,0.02); text-align: left; display: flex; flex-direction: column;"
              >
                <!-- Badge de distancia si está habilitado -->
                <span v-if="ev.distancia_calculada !== undefined && ev.distancia_calculada !== Infinity" class="distance-tag">
                  <i class="fa-solid fa-location-arrow"></i> {{ getDistanceText(ev) }}
                </span>

                <div style="display: flex; gap: 15px;">
                  <div style="width: 80px; height: 80px; border-radius: 12px; overflow: hidden; flex-shrink: 0;">
                    <img 
                      :src="ev.imagen_url || '/assets/img/logo-app.webp'" 
                      style="width: 100%; height: 100%; object-fit: cover;"
                      onerror="this.src='/assets/img/logo-app.webp'"
                    />
                  </div>
                  <div style="display: flex; flex-direction: column; justify-content: center; gap: 5px;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <span style="font-size: 0.75rem; color: #72b04d; font-weight: 700; text-transform: uppercase;">
                        {{ ev.categoria || 'Taller' }}
                      </span>
                      <span v-if="esSubeventoFinalizado(ev)" style="background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 0.65rem; border: 1px solid rgba(239, 68, 68, 0.25); padding: 1px 5px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                        ⏳ Finalizado
                      </span>
                    </div>
                    <h4 style="color: white; font-weight: 700; font-size: 1rem; margin: 0; line-height: 1.2;">{{ ev.nombre }}</h4>
                    <p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">
                      <i class="fa-solid fa-clock" style="margin-right: 5px;"></i> {{ formatDate(ev.fecha_inicio) }}
                    </p>
                  </div>
                </div>

                <div style="margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                  <!-- Actor que lo organizó -->
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <img 
                      :src="ev.actor_avatar || '/assets/img/logo-app.webp'" 
                      style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;"
                      onerror="this.src='/assets/img/logo-app.webp'"
                    />
                    <span style="font-size: 0.75rem; color: #cbd5e1;">{{ ev.actor_nombre }}</span>
                  </div>
                  
                  <button @click.stop="router.push(`/eventos/${ev.id}`)" class="detail-btn">
                    Detalles <i class="fa-solid fa-chevron-right" style="font-size: 0.7rem; margin-left: 3px;"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- MAPA DE UBICACIONES -->
          <div class="superevento-map-area" style="position: relative; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); height: 500px;">
            <div id="supereventos-map-container" style="width: 100%; height: 100%; min-height: 500px;"></div>
            
            <!-- Detalle flotante al hacer clic en un pin -->
            <div v-if="selectedEventDetail" class="map-floating-card" @click.stop>
              <button @click.stop="selectedEventDetail = null" class="close-float-btn" style="z-index: 99; padding: 5px;">
                <i class="fa-solid fa-xmark"></i>
              </button>
              <div style="display: flex; gap: 12px; align-items: center; padding-right: 15px;">
                <img :src="selectedEventDetail.imagen_url || '/assets/img/logo-app.webp'" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;" />
                <div>
                  <h4 style="margin: 0; color: white; font-size: 0.95rem; font-weight: 700;">{{ selectedEventDetail.nombre }}</h4>
                  <p style="margin: 3px 0 0; color: #94a3b8; font-size: 0.75rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">
                    <i class="fa-solid fa-location-dot"></i> {{ selectedEventDetail.ubicacion || 'Presencial' }}
                  </p>
                </div>
              </div>
              <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.75rem; color: #72b04d; font-weight: 700;">{{ selectedEventDetail.actor_nombre }}</span>
                <button @click="router.push(`/eventos/${selectedEventDetail.id}`)" class="detail-btn-mini">
                  Abrir Evento
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- PARTE INFERIOR: HISTORIA Y DESCRIPCIÓN DETALLADA (DOS COLUMNAS EN GRID) -->
        <div class="superevento-bottom-grid">
          
          <!-- Tarjeta 1: Historia e Información -->
          <section class="superevento-history" style="margin: 0;">
            <h3 style="color: white; font-weight: 800; font-size: 1.4rem; margin-top: 0; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-scroll" style="color: #72b04d;"></i>
              Historia e Información General
            </h3>
            <div style="color: #cbd5e1; font-size: 1rem; line-height: 1.7; white-space: pre-line; word-wrap: break-word;">
              {{ superEvento?.descripcion_general || 'Sin descripción detallada disponible por el momento.' }}
            </div>

            <!-- Redes Sociales del Súper Evento -->
            <div v-if="hasSocialLinks" style="margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px;">
              <h4 style="color: white; font-weight: 700; font-size: 1.1rem; margin-top: 0; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-share-nodes" style="color: #72b04d;"></i>
                Redes Sociales y Enlaces
              </h4>
              <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <a v-if="superEvento.social_fb" :href="superEvento.social_fb" target="_blank" class="social-link-badge fb" style="display: flex; align-items: center; gap: 6px; background: rgba(59, 89, 152, 0.15); color: #3b5998; border: 1px solid rgba(59, 89, 152, 0.3); padding: 8px 15px; border-radius: 12px; font-weight: 600; text-decoration: none; transition: all 0.3s ease;">
                  <i class="fa-brands fa-facebook"></i> Facebook
                </a>
                <a v-if="superEvento.social_ig" :href="superEvento.social_ig" target="_blank" class="social-link-badge ig" style="display: flex; align-items: center; gap: 6px; background: rgba(225, 48, 108, 0.15); color: #e1306c; border: 1px solid rgba(225, 48, 108, 0.3); padding: 8px 15px; border-radius: 12px; font-weight: 600; text-decoration: none; transition: all 0.3s ease;">
                  <i class="fa-brands fa-instagram"></i> Instagram
                </a>
                <a v-if="superEvento.social_wa" :href="superEvento.social_wa" target="_blank" class="social-link-badge wa" style="display: flex; align-items: center; gap: 6px; background: rgba(37, 211, 102, 0.15); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.3); padding: 8px 15px; border-radius: 12px; font-weight: 600; text-decoration: none; transition: all 0.3s ease;">
                  <i class="fa-brands fa-whatsapp"></i> WhatsApp
                </a>
                <a v-if="superEvento.social_x" :href="superEvento.social_x" target="_blank" class="social-link-badge x" style="display: flex; align-items: center; gap: 6px; background: rgba(0, 0, 0, 0.4); color: white; border: 1px solid rgba(255, 255, 255, 0.15); padding: 8px 15px; border-radius: 12px; font-weight: 600; text-decoration: none; transition: all 0.3s ease;">
                  <i class="fa-brands fa-x-twitter"></i> X / Twitter
                </a>
                <a v-if="superEvento.social_yt" :href="superEvento.social_yt" target="_blank" class="social-link-badge yt" style="display: flex; align-items: center; gap: 6px; background: rgba(255, 0, 0, 0.15); color: #ff0000; border: 1px solid rgba(255, 0, 0, 0.3); padding: 8px 15px; border-radius: 12px; font-weight: 600; text-decoration: none; transition: all 0.3s ease;">
                  <i class="fa-brands fa-youtube"></i> YouTube
                </a>
                <a v-if="superEvento.social_web" :href="superEvento.social_web" target="_blank" class="social-link-badge web" style="display: flex; align-items: center; gap: 6px; background: rgba(114, 176, 77, 0.15); color: #72b04d; border: 1px solid rgba(114, 176, 77, 0.3); padding: 8px 15px; border-radius: 12px; font-weight: 600; text-decoration: none; transition: all 0.3s ease;">
                  <i class="fa-solid fa-globe"></i> Sitio Web
                </a>
              </div>
            </div>
          </section>

          <!-- Tarjeta 2: Galería de Imágenes (Sólo si existen) -->
          <section v-if="superEvento?.imagenes && superEvento.imagenes.length > 0" class="superevento-gallery-card" style="margin: 0; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 25px; display: flex; flex-direction: column; gap: 15px;">
            <h3 style="color: white; font-weight: 800; font-size: 1.4rem; margin-top: 0; margin-bottom: 0; display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-images" style="color: #72b04d;"></i>
              Galería y Cronograma
            </h3>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px; margin-top: 10px;">
              <div 
                v-for="(img, idx) in superEvento.imagenes" 
                :key="idx" 
                @click="openLightbox(img)"
                style="border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.3); cursor: pointer; position: relative; max-height: 400px; display: flex; align-items: center; justify-content: center;"
                class="gallery-thumbnail-wrapper"
              >
                <!-- Render image with auto-height and full-width to display flyers beautifully -->
                <img :src="img" style="width: 100%; height: 100%; object-fit: contain; max-height: 400px; transition: transform 0.3s;" @error="($event.target as HTMLImageElement).src='/assets/img/logo-app.webp'" />
                <div class="hover-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s;">
                  <i class="fa-solid fa-magnifying-glass-plus" style="color: white; font-size: 1.5rem;"></i>
                </div>
              </div>
            </div>
          </section>

        </div>

        <!-- LIGHTBOX MODAL PARA IMÁGENES -->
        <div v-if="lightboxImage" class="lightbox-overlay" @click="closeLightbox">
          <button class="lightbox-close" @click="closeLightbox">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <div class="lightbox-content" @click.stop>
            <img :src="lightboxImage" style="max-width: 90vw; max-height: 85vh; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); object-fit: contain;" />
          </div>
        </div>

      </div>
    </main>
  </div>
</template>

<style scoped>
.superevento-bottom-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 25px;
  margin-top: 10px;
}
@media (min-width: 1024px) {
  .superevento-bottom-grid {
    grid-template-columns: 1.2fr 0.8fr;
  }
}
.superevento-history {
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 30px;
  backdrop-filter: blur(10px);
  text-align: left;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}
.subevent-card {
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.05);
  padding: 15px;
  border-radius: 16px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  background: rgba(255,255,255,0.02);
  display: flex;
  flex-direction: column;
  text-align: left;
  flex-shrink: 0;
}
.superevento-grid {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 30px;
}
@media (max-width: 992px) {
  .superevento-grid {
    grid-template-columns: 1fr;
  }
  .superevento-map-area {
    order: -1;
  }
}
.back-btn-classic {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s;
}
.back-btn-classic:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.2);
}
.distance-tag {
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
  color: #fbbf24;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
}
.subevent-card:hover {
  background: rgba(255,255,255,0.05) !important;
  border-color: rgba(114, 176, 77, 0.4) !important;
  box-shadow: 0 8px 20px rgba(0,0,0,0.3);
}
.subevent-card.active {
  background: rgba(255,255,255,0.07) !important;
  border-color: #fbbf24 !important;
  box-shadow: 0 8px 25px rgba(251, 191, 36, 0.25);
}
.detail-btn {
  background: none;
  border: none;
  color: #72b04d;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;
  transition: color 0.3s;
}
.detail-btn:hover {
  color: #8ce167;
}
.map-floating-card {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  z-index: 10;
  background: rgba(15, 23, 42, 0.9) !important;
  border: 1px solid rgba(114, 176, 77, 0.3) !important;
  border-radius: 16px;
  padding: 15px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  height: auto !important;
}
@media (min-width: 768px) {
  .map-floating-card {
    width: 380px;
    right: auto;
  }
}
.close-float-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1rem;
}
.close-float-btn:hover {
  color: white;
}
.detail-btn-mini {
  background: #72b04d;
  border: none;
  color: white;
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.3s;
}
.detail-btn-mini:hover {
  background: #8ce167;
}
/* Scrollbar custom styles */
.event-cards-list::-webkit-scrollbar {
  width: 5px;
}
.event-cards-list::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.01);
}
.event-cards-list::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 10px;
}
.event-cards-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.2);
}
.gallery-thumbnail-wrapper:hover img {
  transform: scale(1.08);
}
.gallery-thumbnail-wrapper:hover .hover-overlay {
  opacity: 1 !important;
}
.lightbox-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  cursor: zoom-out;
}
.lightbox-close {
  position: absolute;
  top: 20px;
  right: 20px;
  background: none;
  border: none;
  color: white;
  font-size: 2.5rem;
  cursor: pointer;
  z-index: 100000;
  transition: transform 0.2s;
}
.lightbox-close:hover {
  transform: scale(1.1);
}
.lightbox-content {
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Admin Cover Photo Widget */
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
    top: 15px !important;
    right: 15px !important;
  }
  .admin-cover-btn {
    padding: 8px 14px;
    font-size: 0.75rem;
  }
}
</style>
