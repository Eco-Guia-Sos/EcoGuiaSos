<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const router = useRouter()
const authStore = useAuthStore()

// Cover Management
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
      .eq('seccion_id', 'lugares')
      .maybeSingle()
    if (error) throw error
    if (data && data.imagen_url) {
      coverUrl.value = data.imagen_url
    }
  } catch (err) {
    console.warn('Error fetching cover photo for places:', err)
  }
}

const triggerFileInput = () => {
  const input = document.getElementById('places-cover-file-input') as HTMLInputElement
  if (input) input.click()
}

const handleCoverUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingCover.value = true
  try {
    if (!compressImageHelper.value) {
      const mod = await import('../utils/imageCompressor')
      compressImageHelper.value = mod.compressImage
    }
    
    const compressedBlob = await compressImageHelper.value(file, 1200, 0.8)
    const compressedFile = new File([compressedBlob], `cover_lugares_${Date.now()}.jpg`, {
      type: 'image/jpeg'
    })

    const fileName = `portadas/lugares_${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('imagenes-plataforma')
      .upload(fileName, compressedFile, {
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase.storage
      .from('imagenes-plataforma')
      .getPublicUrl(fileName)

    const publicUrl = publicUrlData.publicUrl

    const { error: dbError } = await supabase
      .from('portadas_secciones')
      .upsert({
        seccion_id: 'lugares',
        imagen_url: publicUrl,
        updated_at: new Date().toISOString(),
        updated_by: authStore.user?.id
      })

    if (dbError) throw dbError

    coverUrl.value = publicUrl
    alert('¡Portada de lugares actualizada correctamente!')
  } catch (err: any) {
    console.error('Error uploading cover:', err)
    alert('No se pudo subir la portada: ' + (err.message || err))
  } finally {
    uploadingCover.value = false
    target.value = ''
  }
}

// State
const todosLosLugares = ref<any[]>([])
const loading = ref(true)
const errorMsg = ref('')
const buscadorInput = ref('')

const filtrosAvanzados = ref({
  categoria: 'all',
  ubicacion: 'all',
  distancia: 20,
  ordenarPor: 'alfabetico'
})

const proximidadActiva = ref(false)
const userCoords = ref<{ lat: number; lng: number } | null>(null)
const isMapVisible = ref(false)
const isAdvancedSearchOpen = ref(false)
const canAddContent = ref(false)

const selectedLugarDetail = ref<any | null>(null)

const abrirPanelDetalle = (lugar: any) => {
  selectedLugarDetail.value = lugar
  if (mapInstance && lugar.lat && lugar.lng) {
    mapInstance.flyTo({ center: [lugar.lng, lugar.lat], zoom: 14 })
  }
}

// Pagination
const currentPage = ref(1)
const itemsPerPage = 6

// Map instances
declare const lucide: any
let mapInstance: maplibregl.Map | null = null
let currentMarkers: maplibregl.Marker[] = []

const CATEGORY_LABELS: Record<string, string> = {
  sede: 'Sede de Eventos',
  reciclaje: 'Centro de Reciclaje / Residuos',
  asociacion: 'Asociación / ONG Ambiental',
  granel: 'Tienda a Granel / Residuo Cero',
  restaurante: 'Restaurante Vegano / Eco-Gastronomía',
  huerto: 'Huerto / Espacio de Cultivo',
  ecoturismo: 'Ecoturismo / Área Natural',
  otro: 'Otros Lugares'
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

// Distance Helper (Haversine)
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
    return `a ${p.distancia_calculada.toFixed(1)} km`
  }
  return ''
}

// Fetch approved places
const fetchLugares = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const { data, error } = await supabase
      .from('lugares')
      .select('id, nombre, descripcion, categoria, ubicacion, lat, lng, imagen_url, estado, owner_id')
      .eq('estado', 'approved')

    if (error) throw error

    // Fetch owner profiles for actor names
    const ownerIds = (data || []).map((r: any) => r.owner_id).filter((v, i, a) => v && a.indexOf(v) === i)
    const profilesMap: Record<string, string> = {}
    
    if (ownerIds.length > 0) {
      const { data: pData } = await supabase
        .from('perfiles')
        .select('id, nombre_completo')
        .in('id', ownerIds)
      
      if (pData) {
        pData.forEach((p: any) => {
          profilesMap[p.id] = p.nombre_completo
        })
      }
    }

    todosLosLugares.value = (data || []).map((row: any) => {
      return {
        id: row.id,
        nombre: row.nombre,
        categoria: row.categoria || 'General',
        ubicacion: row.ubicacion || 'CDMX',
        imagen: row.imagen_url || '/assets/img/ajolote.webp',
        descripcion: row.descripcion || 'Sin descripción.',
        coordenadas: (row.lat && row.lng) ? { lat: row.lat, lng: row.lng } : null,
        lat: row.lat,
        lng: row.lng,
        owner_id: row.owner_id,
        actor_nombre: row.owner_id ? (profilesMap[row.owner_id] || null) : null
      }
    })
  } catch (err: any) {
    console.error('Error fetching places:', err)
    errorMsg.value = 'No se pudieron cargar los lugares sustentables.'
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
    try {
      const { data } = await supabase
        .from('permisos_funciones')
        .select('puede_crear_lugares')
        .eq('user_id', authStore.user.id)
        .maybeSingle()

      if (data?.puede_crear_lugares) {
        canAddContent.value = true
      }
    } catch (e) {
      console.error('Error checking user permissions:', e)
    }
  }
}

// GPS / Proximity
const toggleProximidad = () => {
  if (filtrosAvanzados.value.ubicacion === 'nearby') {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userCoords.value = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }
          proximidadActiva.value = true
          if (filtrosAvanzados.value.ordenarPor === 'alfabetico') {
            filtrosAvanzados.value.ordenarPor = 'distancia'
          }
        },
        (err) => {
          console.warn('Geolocation error:', err)
          alert('No pudimos acceder a tu ubicación. Por favor, activa los permisos GPS en tu navegador.')
          filtrosAvanzados.value.ubicacion = 'all'
          proximidadActiva.value = false
          userCoords.value = null
        }
      )
    } else {
      alert('Tu navegador no soporta geolocalización.')
      filtrosAvanzados.value.ubicacion = 'all'
    }
  } else {
    proximidadActiva.value = false
    userCoords.value = null
    if (filtrosAvanzados.value.ordenarPor === 'distancia') {
      filtrosAvanzados.value.ordenarPor = 'alfabetico'
    }
  }
}

// Clean filters
const resetFiltros = () => {
  filtrosAvanzados.value = {
    categoria: 'all',
    ubicacion: 'all',
    distancia: 20,
    ordenarPor: 'alfabetico'
  }
  proximidadActiva.value = false
  userCoords.value = null
}

// Computed Filtered Places
const filteredLugares = computed(() => {
  let list = [...todosLosLugares.value]

  // 1. Free search filter
  if (buscadorInput.value) {
    const text = buscadorInput.value.toLowerCase()
    list = list.filter(p => 
      p.nombre.toLowerCase().includes(text) ||
      p.categoria.toLowerCase().includes(text) ||
      p.ubicacion.toLowerCase().includes(text)
    )
  }

  // 2. Category Filter
  if (filtrosAvanzados.value.categoria !== 'all') {
    list = list.filter(p => p.categoria?.toLowerCase() === filtrosAvanzados.value.categoria.toLowerCase())
  }

  // 3. Proximity / Bounding box / Distance calculation
  if (userCoords.value) {
    list = list.map(p => {
      if (p.coordenadas && p.coordenadas.lat && p.coordenadas.lng) {
        const dist = calcularDistancia(userCoords.value!.lat, userCoords.value!.lng, p.coordenadas.lat, p.coordenadas.lng)
        p.distancia_calculada = dist
      } else {
        p.distancia_calculada = Infinity
      }
      return p
    })

    if (proximidadActiva.value) {
      list = list.filter(p => p.distancia_calculada !== Infinity && p.distancia_calculada <= filtrosAvanzados.value.distancia)
    }
  } else {
    list.forEach(p => p.distancia_calculada = undefined)
  }

  // 4. Sort alphabetically or by distance
  if (filtrosAvanzados.value.ordenarPor === 'distancia' && proximidadActiva.value && userCoords.value) {
    list.sort((a, b) => (a.distancia_calculada || Infinity) - (b.distancia_calculada || Infinity))
  } else {
    list.sort((a, b) => a.nombre.localeCompare(b.nombre))
  }

  return list
})

// Pagination Computeds
const totalPaginas = computed(() => Math.ceil(filteredLugares.value.length / itemsPerPage))
const paginatedLugares = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return filteredLugares.value.slice(start, start + itemsPerPage)
})

const cambiarPagina = (num: number) => {
  currentPage.value = num
  document.getElementById('places-grid-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Maplibre implementation
const initMap = () => {
  if (mapInstance) return
  try {
    mapInstance = new maplibregl.Map({
      container: 'lugares-map-container',
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
      zoom: 10,
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

  const bounds = new maplibregl.LngLatBounds()
  let hasCoords = false

  // User Marker
  if (userCoords.value) {
    const el = document.createElement('div')
    el.className = 'user-marker-premium'
    
    let avatarSrc = '/assets/img/logo-app.webp'
    const cachedAvatar = localStorage.getItem('eco_user_avatar')
    if (cachedAvatar) avatarSrc = cachedAvatar

    el.innerHTML = `
      <div class="user-marker-avatar">
        <img src="${avatarSrc}" alt="Tú" onerror="this.src='/assets/img/logo-app.webp'">
      </div>
      <div class="user-marker-label">
        Tú <span class="status">Ahora</span>
      </div>
    `

    const popup = new maplibregl.Popup({ offset: 25, closeButton: false })
      .setHTML(`<div style="text-align: center; color: #72B04D; padding: 8px;">
                  <h4 style="margin: 0; font-weight: 800; font-size: 16px;">📍 Tu ubicación</h4>
                  <p style="margin: 5px 0 0; font-size: 12px; color: #444;">Estás explorando cerca de aquí</p>
                </div>`)

    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([userCoords.value.lng, userCoords.value.lat])
      .setPopup(popup)
      .addTo(mapInstance)
    
    currentMarkers.push(marker)
    bounds.extend([userCoords.value.lng, userCoords.value.lat])
    hasCoords = true
  }

  // Places Markers
  filteredLugares.value.forEach(p => {
    if (p.coordenadas && p.coordenadas.lat && p.coordenadas.lng) {
      const el = document.createElement('div')
      el.className = 'map-card-marker type-lugar'
      el.innerHTML = `
        <div class="marker-card-pulse"></div>
        <img src="${p.imagen || '/assets/img/ajolote.webp'}" alt="${p.nombre}" onerror="this.src='/assets/img/ajolote.webp'">
      `

      el.onclick = () => {
        selectedLugarDetail.value = p
        mapInstance?.flyTo({ center: [p.lng, p.lat], zoom: 14 })
      }

      const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
        <div style="color: black; font-family: 'Inter', sans-serif; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; font-weight:800; font-size:0.9rem;">${p.nombre}</h4>
          <span style="font-size:0.7rem; color:#0ea5e9; font-weight:700; text-transform:uppercase;">${formatCategory(p.categoria)}</span>
          <p style="margin:4px 0 0 0; font-size:0.75rem; color:#475569;">${p.ubicacion}</p>
        </div>
      `)

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([p.coordenadas.lng, p.coordenadas.lat])
        .setPopup(popup)
        .addTo(mapInstance!)

      currentMarkers.push(marker)
      bounds.extend([p.coordenadas.lng, p.coordenadas.lat])
      hasCoords = true
    }
  })

  if (hasCoords) {
    mapInstance.fitBounds(bounds, { padding: 45, maxZoom: 14 })
  }
}

const toggleMapa = () => {
  isMapVisible.value = !isMapVisible.value
  if (isMapVisible.value) {
    nextTick(() => {
      initMap()
      setTimeout(() => {
        mapInstance?.resize()
        actualizarMapa()
      }, 200)
    })
  }
}

// Watchers
watch([filteredLugares, proximidadActiva], () => {
  currentPage.value = 1
  nextTick(() => {
    actualizarMapa()
  })
}, { deep: true })

onMounted(() => {
  const cachedCoords = localStorage.getItem('eco_user_coords')
  if (cachedCoords) {
    try {
      userCoords.value = JSON.parse(cachedCoords)
      proximidadActiva.value = true
      filtrosAvanzados.value.ubicacion = 'nearby'
    } catch (e) {
      console.warn('Error parsing cached coordinates:', e)
    }
  }

  fetchLugares()
  checkPermissions()
  fetchCover()
  if (typeof lucide !== 'undefined') {
    lucide.createIcons()
  }
})
</script>

<template>
  <div class="theme-ajolote">
    <!-- Hero / Header -->
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
          title="Cambiar imagen de portada de lugares"
        >
          <i v-if="uploadingCover" class="fa-solid fa-spinner fa-spin"></i>
          <i v-else class="fa-solid fa-camera"></i>
          <span>{{ uploadingCover ? 'Subiendo...' : 'Cambiar portada' }}</span>
        </button>
        <input 
          type="file" 
          id="places-cover-file-input" 
          @change="handleCoverUpload" 
          accept="image/*" 
          style="display: none;" 
        />
      </div>

      <div class="hero-glass-panel">
        <span class="category-badge">🦎 Hub Ajolote</span>
        <h2>Lugares Sustentables</h2>
        <p>Descubre puntos de reciclaje, huertos urbanos, cooperativas sustentables y espacios ecofriendly en tu comunidad.</p>
        
        <!-- Add Button if authorized -->
        <button 
          v-if="canAddContent"
          class="btn btn-proposal shimmer-extra"
          style="margin-top: 20px;"
          @click="router.push('/admin?tab=tabla-seccion&section=lugares&action=new')"
        >
          <i class="fa-solid fa-plus-circle"></i> Proponer Lugar
        </button>
      </div>
      
      <!-- subnav scroll horizontal -->
      <div class="subnav-scroll-wrapper fade-in">
        <nav class="level-subnav">
          <RouterLink to="/agentes" class="subnav-link"><i class="fa-solid fa-users"></i> Agentes</RouterLink>
          <RouterLink to="/convocatoria" class="subnav-link"><i class="fa-solid fa-bullhorn"></i> Convocatorias</RouterLink>
          <RouterLink to="/voluntariados" class="subnav-link"><i class="fa-solid fa-handshake"></i> Ayuda</RouterLink>
          <RouterLink to="/causas" class="subnav-link"><i class="fa-solid fa-hand-holding-heart"></i> Causas / Rifas</RouterLink>
          <RouterLink to="/lugares" class="subnav-link active"><i class="fa-solid fa-map-pin"></i> Lugares</RouterLink>
          <RouterLink to="/super-eventos" class="subnav-link"><i class="fa-solid fa-trophy"></i> Eventos Especiales</RouterLink>
        </nav>
      </div>
    </header>

    <main class="content-section">
      <!-- Search row -->
      <div v-if="!loading && !errorMsg" class="search-bar-row fade-in" style="margin-bottom: 20px;">
        <div class="search-bar-container">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input 
            type="text" 
            v-model="buscadorInput" 
            placeholder="Buscar por nombre o dirección..." 
            autocomplete="off"
          >
        </div>
      </div>

      <!-- Action buttons -->
      <div v-if="!loading && !errorMsg" class="action-buttons-row fade-in" style="display:flex; justify-content:space-between; align-items:center; gap: 15px; margin-bottom: 25px;">
        <button 
          class="btn btn-secondary glass-effect" 
          :class="{ 'active': isAdvancedSearchOpen }"
          @click="isAdvancedSearchOpen = !isAdvancedSearchOpen"
        >
          <i class="fa-solid fa-sliders"></i> Búsqueda Avanzada
        </button>
        <button type="button" class="btn-pill-map" @click="toggleMapa">
          {{ isMapVisible ? 'Ocultar mapa' : 'Ver mapa' }}
        </button>
      </div>

      <!-- Advanced search panel -->
      <div 
        v-if="!loading && !errorMsg && isAdvancedSearchOpen"
        class="advanced-search-panel glass-effect fade-in" 
        style="margin-bottom: 25px; padding: 25px; border-radius: 20px;"
      >
        <div class="search-panel-grid lugar-grid">
          <!-- Col 1: Categorías de Lugares -->
          <div class="search-col">
            <h3>¿Qué buscas?</h3>
            <div class="category-pills-grid">
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'all' }"
                @click="filtrosAvanzados.categoria = 'all'"
              >
                🌍 Todo
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'sede' }"
                @click="filtrosAvanzados.categoria = 'sede'"
              >
                📍 Sede de Eventos
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'reciclaje' }"
                @click="filtrosAvanzados.categoria = 'reciclaje'"
              >
                ♻️ Reciclaje
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'asociacion' }"
                @click="filtrosAvanzados.categoria = 'asociacion'"
              >
                🤝 Asociación / ONG
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'granel' }"
                @click="filtrosAvanzados.categoria = 'granel'"
              >
                🫙 Compra a Granel
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'restaurante' }"
                @click="filtrosAvanzados.categoria = 'restaurante'"
              >
                🥦 Vegano / Eco-Restaurante
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'huerto' }"
                @click="filtrosAvanzados.categoria = 'huerto'"
              >
                🌱 Huerto Urbano
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'ecoturismo' }"
                @click="filtrosAvanzados.categoria = 'ecoturismo'"
              >
                🌲 Ecoturismo
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'otro' }"
                @click="filtrosAvanzados.categoria = 'otro'"
              >
                🌿 Otros
              </button>
            </div>
          </div>

          <!-- Col 2: Ubicación / GPS -->
          <div class="search-col">
            <h3>¿Dónde?</h3>
            <div class="location-options">
              <button 
                class="loc-pill" 
                :class="{ 'active': filtrosAvanzados.ubicacion === 'all' }"
                @click="filtrosAvanzados.ubicacion = 'all'; toggleProximidad()"
              >
                📍 Todo
              </button>
              <button 
                class="loc-pill" 
                :class="{ 'active': filtrosAvanzados.ubicacion === 'nearby' }"
                @click="filtrosAvanzados.ubicacion = 'nearby'; toggleProximidad()"
              >
                🎯 Cerca de mí
              </button>
            </div>
            <div 
              class="distance-slider-box"
              :class="{ 'hidden': filtrosAvanzados.ubicacion !== 'nearby' }"
              style="margin-top: 15px;"
            >
              <div class="slider-header" style="margin-bottom: 5px; font-size: 0.85rem;">
                <span>Radio: <strong>{{ filtrosAvanzados.distancia }}</strong> km</span>
              </div>
              <input 
                type="range" 
                v-model.number="filtrosAvanzados.distancia" 
                min="1" 
                max="100" 
                class="custom-slider"
                style="width: 100%; cursor: pointer;"
              >
            </div>
          </div>

          <!-- Col 3: Ordenar por -->
          <div class="search-col">
            <h3>Ordenar por</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label class="filter-chip">
                <input type="radio" v-model="filtrosAvanzados.ordenarPor" value="alfabetico" name="sort-type-places">
                <span class="chip-content">🔤 Alfabético (Nombre)</span>
              </label>
              <label class="filter-chip" :style="!proximidadActiva ? 'opacity: 0.5; cursor: not-allowed;' : ''">
                <input type="radio" v-model="filtrosAvanzados.ordenarPor" value="distancia" name="sort-type-places" :disabled="!proximidadActiva">
                <span class="chip-content">📍 Cercanos (Distancia)</span>
              </label>
              <span v-if="!proximidadActiva" style="font-size: 0.75rem; color: #9ca3af; font-style: italic; margin-top: 2px;">
                (Activa "Cerca de mí" para ordenar por cercanía)
              </span>
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 20px; flex-wrap:wrap; gap:10px;">
          <div class="results-indicator" style="display: flex; align-items: center; gap: 8px; background: rgba(77, 182, 232, 0.15); border: 1px solid rgba(77, 182, 232, 0.3); padding: 6px 16px; border-radius: 20px;">
            <span style="font-size: 0.85rem; color: #cbd5e1; font-weight: 600;">Lugares encontrados:</span>
            <span style="color: #4db6e8; font-weight: 800; font-size: 0.95rem;">{{ filteredLugares.length }}</span>
          </div>
          <button class="btn btn-secondary" style="font-size: 0.8rem;" @click="resetFiltros">
            Limpiar Filtros
          </button>
        </div>
      </div>

      <!-- SECCIÓN MAPA ESTILO HOME -->
      <section 
        v-show="isMapVisible && !loading && !errorMsg"
        class="home-map-section fade-in"
        id="mapa-lugares-wrapper"
        style="background: rgba(2, 6, 23, 0.95); padding: 20px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5); margin: 30px auto; max-width: 1000px; width: 100%; position: relative; overflow: hidden;"
      >
        <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at center, rgba(77, 182, 232, 0.05) 0%, transparent 60%); pointer-events: none; z-index: 0;"></div>

        <div v-if="authStore.user" class="map-header-actions" style="position: relative; z-index: 1; padding: 15px; display: flex; justify-content: center; margin-bottom: 10px;">
          <RouterLink to="/mapa" class="btn btn-primary shimmer-extra" style="width: 100%; max-width: 400px; margin: 0 auto; text-align: center; border-radius: 12px; box-shadow: 0 10px 20px rgba(114, 176, 77, 0.3); font-weight: 700; letter-spacing: 1px;">
            <i class="fa-solid fa-expand"></i> VER ATLAS COMPLETO
          </RouterLink>
        </div>

        <div class="mini-map-container" style="position: relative; z-index: 1; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);">
          <div id="lugares-map-container" style="width: 100%; height: 100%;"></div>

          <!-- PANEL LATERAL DE DETALLES INTEGRADO -->
          <aside 
            id="lugares-detail-panel" 
            class="map-side-panel"
            :class="{ 'hidden': !selectedLugarDetail }"
          >
            <button class="panel-close-btn" @click="selectedLugarDetail = null">
              <i class="fa-solid fa-xmark"></i>
            </button>
            <div v-if="selectedLugarDetail" class="panel-img-container" style="height: 120px;">
              <img :src="selectedLugarDetail.imagen" alt="Imagen" @error="($event.target as HTMLImageElement).src='/assets/img/ajolote.webp'">
            </div>
            <div v-if="selectedLugarDetail" class="panel-content" style="padding: 12px;">
              <span class="badge lugar" style="background: rgba(77, 182, 232, 0.15); color: #4db6e8; border: 1px solid rgba(77, 182, 232, 0.3);">LUGAR</span>
              <h3 style="font-size: 16px; color: white; margin: 5px 0 2px 0;">{{ selectedLugarDetail.nombre }}</h3>
              <p v-if="authStore.user" class="panel-meta" style="font-size: 12px; color: #cbd5e1; display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                <i class="fa-solid fa-location-dot"></i> <span>{{ selectedLugarDetail.ubicacion }}</span>
              </p>
              <p v-else class="panel-meta" style="font-size: 12px; color: rgba(255,255,255,0.4); font-style: italic; display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                <i class="fa-solid fa-lock"></i> Inicia sesión para ver la ubicación
              </p>
            </div>
            <div v-if="selectedLugarDetail" class="panel-footer" style="padding: 0 12px 12px;">
              <RouterLink 
                :to="`/lugares/${selectedLugarDetail.id}`" 
                class="btn-full"
                style="padding: 8px; font-size: 13px; background: #0ea5e9; color: white; display: block; text-align: center; border-radius: 12px; font-weight: 700; text-decoration: none;"
              >
                Ver detalles
              </RouterLink>
            </div>
          </aside>
        </div>

        <!-- Carrusel Horizontal de Lugares Cercanos -->
        <div class="nearby-slider-wrapper" style="margin-top: 15px;">
          <div id="nearby-lugares-slider" class="nearby-events-slider" style="display: flex; gap: 15px; overflow-x: auto; scroll-behavior: smooth; padding: 10px 0;">
            <div 
              v-for="p in filteredLugares" 
              :key="p.id" 
              class="nearby-slider-card"
              :class="{ 'active': selectedLugarDetail?.id === p.id }"
              @click="abrirPanelDetalle(p)"
            >
              <div class="nearby-card-img" style="position:relative;">
                <img :src="p.imagen" :alt="p.nombre" onerror="this.src='/assets/img/ajolote.webp'">
              </div>
              <div class="nearby-card-info">
                <div class="nearby-card-title" style="font-weight:700; line-height:1.1;">{{ getCategoryIcon(p.categoria) }} {{ p.nombre }}</div>
                <div v-if="p.distancia_calculada && p.distancia_calculada !== Infinity" class="nearby-card-dist" style="color:#fde047; font-size:0.75rem; font-weight:700; margin-top:2px;">
                  <i class="fa-solid fa-route"></i> a {{ p.distancia_calculada.toFixed(1) }} km
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Content grid -->
      <div v-if="loading" class="no-events fade-in">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Cargando lugares sustentables...
      </div>
      
      <div v-else-if="errorMsg" class="no-events fade-in">
        <p class="error-msg">{{ errorMsg }}</p>
      </div>

      <div v-else-if="filteredLugares.length === 0" class="no-events fade-in">
        <p class="empty-msg">No se encontraron lugares con los criterios seleccionados.</p>
      </div>

      <div v-else id="places-grid-top" class="card-grid-container fade-in">
        <article 
          v-for="(p, index) in paginatedLugares" 
          :key="p.id"
          class="card"
          :class="[getNivelClass(p.categoria), 'delay-' + ((index % 4) * 100)]"
          v-reveal="'scale'"
          @click="router.push(`/lugares/${p.id}`)"
          style="cursor: pointer;"
        >
          <div class="card-image">
            <img :src="p.imagen" :alt="p.nombre" @error="($event.target as HTMLImageElement).src='/assets/img/ajolote.webp'">
            <!-- Category Icon Badge (Bottom-Left, on the same line as distance badge) -->
            <span class="card-category" :title="formatCategory(p.categoria)" style="position: absolute; bottom: 10px; left: 10px; top: auto !important; right: auto !important; font-size: 1.15rem; cursor: help; background: #ffffff !important; border: 1px solid rgba(0, 0, 0, 0.15) !important; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; padding: 0; z-index: 2;">{{ getCategoryIcon(p.categoria) }}</span>
            
            <span v-if="p.distancia_calculada && p.distancia_calculada !== Infinity" class="dist-badge" style="background:rgba(15,20,25,0.9); color:#fde047; border:1px solid rgba(253,224,71,0.4); font-weight:700;">
              <i class="fa-solid fa-route"></i> a {{ p.distancia_calculada.toFixed(1) }} km
            </span>
            
            <div v-if="p.actor_nombre" class="actor-badge" :title="`Publicado por: ${p.actor_nombre}`">
              <i class="fa-solid fa-user-pen"></i>
              <span>{{ p.actor_nombre }}</span>
            </div>
            
            <div class="card-actions-overlay">
              <button 
                v-if="authStore.profile?.rol === 'admin' || (authStore.profile?.rol === 'actor' && p.owner_id === authStore.user?.id)" 
                class="btn-icon-glass"
                @click.stop="router.push(`/admin/editar/lugar/${p.id}`)"
              >
                <i class="fa-solid fa-pen"></i>
              </button>
            </div>
          </div>

          <div class="card-content" style="padding-top: 12px;">
            <h3 class="card-title" style="margin-bottom:2px; font-size: 1rem; line-height: 1.25;">{{ p.nombre }}</h3>
            
            <span class="card-date-sub" style="color:#5bc2f7; font-size:0.75rem; display:block; margin-top:4px; font-weight:600;">
              <i class="fa-solid fa-location-dot" style="margin-right:4px;"></i>{{ p.ubicacion }}
            </span>
          </div>
        </article>
      </div>

      <!-- Pagination Controls -->
      <div v-if="!loading && totalPaginas > 1" class="pagination-container fade-in" style="display:flex; justify-content:center; gap:8px; margin-top:30px;">
        <button 
          v-for="page in totalPaginas" 
          :key="page" 
          class="page-btn" 
          :class="{ 'active': page === currentPage }"
          @click="cambiarPagina(page)"
        >
          {{ page }}
        </button>
      </div>
    </main>
  </div>
</template>

<style>
@import '../assets/css/interior-pages.css';

.map-card-marker {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid var(--color-ajolote, #0ea5e9);
  box-shadow: 0 5px 15px rgba(0,0,0,0.4);
  cursor: pointer;
  background: #0f172a;
  /* Animación de posición instantánea (evita flotado del transform) */
  transition: border-color 0.2s, box-shadow 0.2s;
}

.map-card-marker:hover {
  border-color: #3385ff;
  box-shadow: 0 5px 25px rgba(51, 133, 255, 0.6);
  z-index: 100;
}

.map-card-marker img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  transition: transform 0.2s ease;
}

.map-card-marker:hover img {
  transform: scale(1.15);
}

.marker-card-pulse {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid var(--color-ajolote, #0ea5e9);
  opacity: 0.7;
  animation: pulse-marker 1.8s infinite;
  pointer-events: none;
}

@keyframes pulse-marker {
  0% { transform: scale(0.9); opacity: 0.9; }
  100% { transform: scale(1.4); opacity: 0; }
}

/* Panel de detalles del mapa - Estilo premium oscuro */
.theme-ajolote .map-side-panel {
  position: absolute;
  top: 20px !important;
  left: 20px !important;
  width: 300px !important;
  background: rgba(15, 23, 42, 0.95) !important;
  backdrop-filter: blur(20px) !important;
  border-radius: 24px !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6) !important;
  z-index: 2000 !important;
  color: white !important;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  transform: translateX(0) !important;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s !important;
}

.theme-ajolote .map-side-panel.hidden {
  transform: translateX(-120%) !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

/* Forzar textos del panel a blanco y gris claro */
.theme-ajolote .map-side-panel h3 {
  color: white !important;
  font-weight: 800 !important;
  font-size: 1.1rem !important;
  margin: 5px 0 !important;
}

.theme-ajolote .map-side-panel p.panel-meta {
  color: #cbd5e1 !important;
  font-size: 0.8rem !important;
}

.theme-ajolote .panel-close-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  color: white !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  transition: all 0.2s;
}

.theme-ajolote .panel-close-btn:hover {
  background: rgba(255, 255, 255, 0.25) !important;
  transform: scale(1.1);
}

.custom-slider {
  accent-color: var(--color-ajolote, #0ea5e9);
}

.page-btn {
  padding: 8px 16px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  color: white;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.page-btn.active, .page-btn:hover {
  background: var(--color-ajolote, #0ea5e9);
  border-color: var(--color-ajolote, #0ea5e9);
  color: white;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
}

/* Responsivo para el panel flotante y carrusel */
@media (max-width: 768px) {
  .theme-ajolote .map-side-panel {
    top: auto !important;
    bottom: 20px !important;
    left: 50% !important;
    width: calc(100% - 40px) !important;
    max-width: 360px !important;
    transform: translateX(-50%) translateY(0) !important;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s !important;
  }

  .theme-ajolote .map-side-panel.hidden {
    transform: translateX(-50%) translateY(150%) !important;
    opacity: 0 !important;
  }
}

/* Forzar diseño vertical con ratio 5:3 en las tarjetas de lugares en PC */
@media (min-width: 1025px) {
  #places-grid-top .card {
    flex-direction: column !important;
    align-items: flex-start !important;
    padding: 0 !important;
    gap: 0 !important;
    min-height: auto !important;
    max-width: 100% !important;
    border-radius: 16px !important;
  }

  #places-grid-top .card-image {
    width: 100% !important;
    height: auto !important;
    aspect-ratio: 5 / 3 !important; /* Mismo ratio 5x3 que eventos en Home */
    border-radius: 16px 16px 0 0 !important;
  }

  #places-grid-top .card-content {
    padding: 1rem !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }
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
