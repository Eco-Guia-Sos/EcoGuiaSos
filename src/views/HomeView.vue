<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

// State
const todosLosProyectos = ref<any[]>([])
const carruselSlides = ref<any[]>([])
const filtroActual = ref<'evento' | 'lugar'>('evento')
const buscadorInput = ref('')
const loading = ref(true)

// Navigation/View toggles
const isMapVisible = ref(false)
const isCalendarVisible = ref(false)
const isEventSheetVisible = ref(false)

// Pagination
const currentPage = ref(1)
const maxRendered = ref(window.innerWidth <= 600 ? 4 : 9)

// Geolocation
const proximidadActiva = ref(false)
const userCoords = ref<{ lat: number; lng: number } | null>(null)

// Advanced Search Filters
const isAdvancedSearchOpen = ref(false)
const filtrosAvanzados = ref({
  categoria: 'all',
  ubicacion: 'all',
  distancia: 100,
  fechas: 'all',
  fechaExacta: '',
  soloGratis: false,
  ninos: false,
  mascotas: false
})

// Map and Calendar selections
const selectedProjectDetail = ref<any | null>(null)
const activeDateLabel = ref('')
const activeDateEvents = ref<any[]>([])

// Calendar state
const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())

// Resize handler
onMounted(() => {
  window.addEventListener('resize', () => {
    maxRendered.value = window.innerWidth <= 600 ? 4 : 9
  })
  
  // Init auth store if not already initialized
  if (authStore.loading) {
    authStore.init()
  }
  
  // Listen for auth change to get GPS
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (session) {
        setTimeout(() => obtenerUbicacionSilenciosa(), 1000)
      }
    }
  })
})

// Globals declarations
declare const Swiper: any
declare const maplibregl: any
declare const particlesJS: any
declare const lucide: any

let mapInstance: any = null
let currentMarkers: any[] = []

// Fetch Data
const cargarDatos = async () => {
  loading.value = true
  try {
    // Fetch carrusel
    const { data: slides } = await supabase
      .from('carrusel_principal')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true })
    
    if (slides) carruselSlides.value = slides

    // Fetch events
    const { data: eventosData } = await supabase
      .from('eventos')
      .select('*')

    // Fetch places
    const { data: lugaresData } = await supabase
      .from('lugares')
      .select('*, eventos(count)')

    // Fetch profiles for owner names
    const ownerIds = [
      ...(eventosData || []).map(r => r.owner_id),
      ...(lugaresData || []).map(r => r.owner_id)
    ].filter((v, i, a) => v && a.indexOf(v) === i)

    const profilesMap: Record<string, string> = {}
    if (ownerIds.length > 0) {
      const { data: pData } = await supabase
        .from('perfiles')
        .select('id, nombre_completo')
        .in('id', ownerIds)
      
      if (pData) {
        pData.forEach(p => {
          profilesMap[p.id] = p.nombre_completo
        })
      }
    }

    const parseRow = (row: any, tipo: 'evento' | 'lugar') => {
      let conteo = 0
      if (tipo === 'lugar' && row.eventos && row.eventos.length > 0) {
        conteo = row.eventos[0].count || 0
      }
      
      let firstImg = row.imagen_url || row.imagen
      if (row.imagenes && Array.isArray(row.imagenes) && row.imagenes.length > 0) {
        firstImg = row.imagenes[0]
      }

      return {
        id: row.id,
        nombre: row.nombre,
        categoria: row.categoria || 'General',
        ubicacion: row.ubicacion || 'CDMX',
        mapa_url: row.mapa_url || null,
        imagen: firstImg || '/assets/img/kpop.webp',
        descripcion: row.descripcion || 'Sin descripción.',
        tipo: tipo,
        coordenadas: (row.lat && row.lng) ? { lat: row.lat, lng: row.lng } : null,
        conteo_eventos: conteo,
        fecha: row.fecha_inicio || row.fecha || row.created_at,
        es_gratuito: row.es_gratuito,
        pet_friendly: row.pet_friendly,
        apto_ninos: row.apto_ninos,
        owner_id: row.owner_id,
        actor_nombre: row.owner_id ? (profilesMap[row.owner_id] || null) : null
      }
    }

    const parseadosEventos = (eventosData || []).map(r => parseRow(r, 'evento'))
    const parseadosLugares = (lugaresData || []).map(r => parseRow(r, 'lugar'))

    todosLosProyectos.value = [...parseadosEventos, ...parseadosLugares]
  } catch (error) {
    console.error('Error cargando datos:', error)
  } finally {
    loading.value = false
    nextTick(() => {
      iniciarCarrusel()
      iniciarParticulas()
    })
  }
}

// Distance Calculation
const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Filtering
const filteredProyectos = computed(() => {
  let list = todosLosProyectos.value.filter(p => p.tipo === filtroActual.value)

  // Search Input
  if (buscadorInput.value) {
    const text = buscadorInput.value.toLowerCase()
    list = list.filter(p => 
      p.nombre.toLowerCase().includes(text) ||
      p.categoria.toLowerCase().includes(text) ||
      p.ubicacion.toLowerCase().includes(text)
    )
  }

  // Category
  if (filtrosAvanzados.value.categoria !== 'all') {
    list = list.filter(p => p.categoria === filtrosAvanzados.value.categoria)
  }

  // GPS Proximity
  if (proximidadActiva.value && userCoords.value) {
    list = list.filter(p => {
      if (!p.coordenadas || !p.coordenadas.lat || !p.coordenadas.lng) {
        p.distancia_calculada = Infinity
        return true
      }
      const dist = calcularDistancia(userCoords.value!.lat, userCoords.value!.lng, p.coordenadas.lat, p.coordenadas.lng)
      p.distancia_calculada = dist
      return dist <= filtrosAvanzados.value.distancia
    })
    list.sort((a, b) => (a.distancia_calculada || 0) - (b.distancia_calculada || 0))
  } else {
    list.forEach(p => p.distancia_calculada = undefined)
  }

  // Dates
  if (filtrosAvanzados.value.fechaExacta) {
    list = list.filter(p => {
      if (!p.fecha) return false
      const d1 = new Date(p.fecha).toDateString()
      const d2 = new Date(filtrosAvanzados.value.fechaExacta + 'T00:00:00').toDateString()
      return d1 === d2
    })
  } else if (filtrosAvanzados.value.fechas !== 'all') {
    const hoy = new Date()
    list = list.filter(p => {
      if (!p.fecha) return true
      const fechaE = new Date(p.fecha)
      if (filtrosAvanzados.value.fechas === 'today') return fechaE.toDateString() === hoy.toDateString()
      if (filtrosAvanzados.value.fechas === 'tomorrow') {
        const manana = new Date(hoy)
        manana.setDate(hoy.getDate() + 1)
        return fechaE.toDateString() === manana.toDateString()
      }
      if (filtrosAvanzados.value.fechas === 'weekend') {
        const dia = fechaE.getDay()
        return dia === 0 || dia === 6
      }
      return true
    })
  }

  // Audiences
  if (filtrosAvanzados.value.soloGratis) {
    list = list.filter(p => p.es_gratuito === true || p.es_gratuito === undefined)
  }
  if (filtrosAvanzados.value.mascotas) {
    list = list.filter(p => p.pet_friendly === true)
  }
  if (filtrosAvanzados.value.ninos) {
    list = list.filter(p => p.apto_ninos === true)
  }

  return list
})

// Pagination Computeds
const totalPaginas = computed(() => {
  return Math.ceil(filteredProyectos.value.length / maxRendered.value) || 1
})

const paginatedProyectos = computed(() => {
  if (currentPage.value > totalPaginas.value) currentPage.value = totalPaginas.value
  const inicio = (currentPage.value - 1) * maxRendered.value
  return filteredProyectos.value.slice(inicio, inicio + maxRendered.value)
})

// Watch filters to reset page and update map markers
watch([filtroActual, buscadorInput, filtrosAvanzados, proximidadActiva], () => {
  currentPage.value = 1
  nextTick(() => {
    actualizarMiniMapa()
  })
}, { deep: true })

const cambiarPagina = (num: number) => {
  currentPage.value = num
  document.getElementById('contenedor-tarjetas')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Map Functions
const toggleMapa = () => {
  isMapVisible.value = !isMapVisible.value
  if (isMapVisible.value) {
    nextTick(() => {
      iniciarMiniMapa()
    })
  }
}

const iniciarMiniMapa = () => {
  const mapContainer = document.getElementById('mini-map')
  if (!mapContainer || mapInstance) return

  try {
    mapInstance = new maplibregl.Map({
      container: 'mini-map',
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
      mapInstance.resize()
      actualizarMiniMapa()
    })
  } catch (err) {
    console.error('Error initializing map:', err)
  }
}

const actualizarMiniMapa = () => {
  if (!mapInstance) return
  
  currentMarkers.forEach(m => m.remove())
  currentMarkers = []
  
  const bounds = new maplibregl.LngLatBounds()
  let hasCoords = false

  // User marker
  if (userCoords.value) {
    const el = document.createElement('div')
    el.className = 'user-marker-premium'
    
    let avatarSrc = '/assets/img/kpop.webp'
    const cachedAvatar = localStorage.getItem('eco_user_avatar')
    if (cachedAvatar) avatarSrc = cachedAvatar

    el.innerHTML = `
      <div class="user-marker-avatar">
        <img src="${avatarSrc}" alt="Tú" onerror="this.src='/assets/img/kpop.webp'">
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

  // Clusters or single markers
  const clusters: any[] = []
  const CLUSTER_THRESHOLD = 0.002

  filteredProyectos.value.forEach(p => {
    if (!p.coordenadas || !p.coordenadas.lat || !p.coordenadas.lng) return
    
    const foundCluster = clusters.find(c => {
      const dLat = Math.abs(c.lat - p.coordenadas.lat)
      const dLng = Math.abs(c.lng - p.coordenadas.lng)
      return dLat < CLUSTER_THRESHOLD && dLng < CLUSTER_THRESHOLD
    })

    if (foundCluster) {
      foundCluster.items.push(p)
    } else {
      clusters.push({
        lat: p.coordenadas.lat,
        lng: p.coordenadas.lng,
        items: [p]
      })
    }
  })

  clusters.forEach(c => {
    const count = c.items.length
    const p = c.items[0]
    const el = document.createElement('div')

    if (count > 1) {
      el.className = `map-cluster-marker type-${p.tipo}`
      el.innerHTML = `
        <img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='/assets/img/kpop.webp'">
        <div class="cluster-count-badge">${count > 2 ? '2+' : count}</div>
      `
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        const currentZoom = mapInstance.getZoom()
        if (currentZoom >= 15) {
          abrirPanelDetalle(p)
        } else {
          mapInstance.flyTo({ 
            center: [c.lng, c.lat], 
            zoom: currentZoom + 3,
            essential: true 
          })
        }
      })
    } else {
      el.className = `map-card-marker type-${p.tipo}`
      el.innerHTML = `<img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='/assets/img/kpop.webp'">`
      
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        abrirPanelDetalle(p)
      })
    }

    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([c.lng, c.lat])
      .addTo(mapInstance)

    currentMarkers.push(marker)
    bounds.extend([c.lng, c.lat])
    hasCoords = true
  })

  if (proximidadActiva.value && userCoords.value) {
    mapInstance.flyTo({
      center: [userCoords.value.lng, userCoords.value.lat],
      zoom: 14,
      essential: true
    })
  } else if (hasCoords) {
    mapInstance.fitBounds(bounds, { padding: 80, maxZoom: 15 })
  }
}

const abrirPanelDetalle = (p: any) => {
  selectedProjectDetail.value = p
  if (mapInstance && p.coordenadas) {
    mapInstance.flyTo({
      center: [p.coordenadas.lng, p.coordenadas.lat],
      zoom: 16,
      essential: true
    })
  }
}

// GPS / Location
const toggleProximidad = () => {
  if (filtrosAvanzados.value.ubicacion === 'nearby') {
    activarProximidad()
  } else {
    proximidadActiva.value = false
    userCoords.value = null
  }
}

const activarProximidad = async () => {
  if (!navigator.geolocation) return alert('Tu navegador no soporta geolocalización.')
  
  isMapVisible.value = true
  nextTick(() => {
    iniciarMiniMapa()
  })

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userCoords.value = { lat: position.coords.latitude, lng: position.coords.longitude }
      localStorage.setItem('eco_user_coords', JSON.stringify(userCoords.value))
      proximidadActiva.value = true
      nextTick(() => {
        actualizarMiniMapa()
      })
    },
    (error) => {
      console.error('[GPS] Error:', error)
      alert('No pudimos obtener tu ubicación precisa actual.')
    },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
  )
}

const obtenerUbicacionSilenciosa = () => {
  if (!navigator.geolocation) return
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userCoords.value = { lat: position.coords.latitude, lng: position.coords.longitude }
      localStorage.setItem('eco_user_coords', JSON.stringify(userCoords.value))
      proximidadActiva.value = true
      filtrosAvanzados.value.distancia = 100
      filtrosAvanzados.value.ubicacion = 'nearby'
    },
    (error) => {
      console.log('[GPS Silencioso] Falló:', error)
    },
    { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
  )
}

// Calendar Logic
const allEvents = computed(() => {
  return todosLosProyectos.value.filter(p => p.tipo === 'evento')
})

const daysInMonthList = computed(() => {
  const list = []
  const firstDay = new Date(currentYear.value, currentMonth.value, 1).getDay()
  const daysInMonth = new Date(currentYear.value, currentMonth.value + 1, 0).getDate()

  // Empty days
  for (let i = 0; i < firstDay; i++) {
    list.push({ day: null, events: [] })
  }

  // Month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateEvents = allEvents.value.filter(ev => {
      if (!ev.fecha) return false
      const evDate = new Date(ev.fecha)
      return evDate.getFullYear() === currentYear.value && 
             evDate.getMonth() === currentMonth.value && 
             evDate.getDate() === day
    })
    
    list.push({ day, events: dateEvents })
  }

  return list
})

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const currentMonthLabel = computed(() => {
  return `${monthNames[currentMonth.value]} ${currentYear.value}`
})

const changeMonth = (delta: number) => {
  currentMonth.value += delta
  if (currentMonth.value < 0) {
    currentMonth.value = 11
    currentYear.value--
  } else if (currentMonth.value > 11) {
    currentMonth.value = 0
    currentYear.value++
  }
}

const openEventSheet = (day: number, events: any[]) => {
  const dateStr = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const dateObj = new Date(dateStr + 'T00:00:00')
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  activeDateLabel.value = dateObj.toLocaleDateString('es-ES', options)
  activeDateEvents.value = events
  isEventSheetVisible.value = true
  document.body.style.overflow = 'hidden'
}

const closeEventSheet = () => {
  isEventSheetVisible.value = false
  document.body.style.overflow = ''
}

const toggleCalendario = () => {
  isCalendarVisible.value = !isCalendarVisible.value
  if (isCalendarVisible.value) {
    isMapVisible.value = false
  }
}

// Swiper & Particles initializations
const iniciarCarrusel = () => {
  if (typeof Swiper !== 'undefined' && carruselSlides.value.length > 0) {
    new Swiper('.hero-carousel', {
      loop: carruselSlides.value.length > 1,
      autoplay: {
        delay: 6000,
        disableOnInteraction: false
      },
      pagination: { el: '.swiper-pagination', clickable: true },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      effect: 'fade',
      fadeEffect: { crossFade: true },
      watchSlidesProgress: true,
      observer: true,
      observeParents: true
    })
  }
}

const iniciarParticulas = () => {
  if (typeof particlesJS !== 'undefined') {
    particlesJS('particles-main', {
      particles: {
        number: { value: 30, density: { enable: true, value_area: 800 } },
        color: { value: ['#72B04D', '#0077b6', '#FFD700', '#E74C3C'] },
        shape: { type: 'circle' },
        opacity: { value: 0.4, random: true },
        size: { value: 6, random: true },
        line_linked: { enable: false },
        move: { enable: true, speed: 2, direction: 'out', random: true, out_mode: 'out' }
      },
      interactivity: { detect_on: 'canvas', events: { onhover: { enable: false }, onclick: { enable: false }, resize: true } },
      retina_detect: true
    })
  }
}

// Card details styling helper
const getNivelClass = (categoria: string) => {
  const cat = (categoria || '').toLowerCase()
  const colibri = ['agua', 'cursos', 'ecotecnias', 'lecturas', 'documentales', 'educación', 'naturaleza', 'ecología']
  const ajolote = ['agentes', 'voluntariados', 'comunidad', 'social', 'convocatorias']
  const lobo = ['fondos', 'normativa', 'legal', 'estrategia', 'finanzas']

  if (colibri.some(c => cat.includes(c))) return 'card-colibri'
  if (ajolote.some(c => cat.includes(c))) return 'card-ajolote'
  if (lobo.some(c => cat.includes(c))) return 'card-lobo'
  return 'card-general'
}

// Reset filters
const resetFiltros = () => {
  filtrosAvanzados.value = {
    categoria: 'all',
    ubicacion: 'all',
    distancia: 100,
    fechas: 'all',
    fechaExacta: '',
    soloGratis: false,
    ninos: false,
    mascotas: false
  }
  proximidadActiva.value = false
  userCoords.value = null
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

const resolveImgUrl = (url: string) => {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const supabaseUrlStr = import.meta.env.VITE_SUPABASE_URL
  return `${supabaseUrlStr}/storage/v1/object/public/imagenes-plataforma/${url.startsWith('/') ? url.slice(1) : url}`
}

const abrirEnlace = (url: string) => {
  window.open(url, '_blank')
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  cargarDatos()
})
</script>

<template>
  <div class="home-page">
    <!-- HERO PRINCIPAL -->
    <header class="hero-section">
      <div class="hero-content">
        <!-- CARRUSEL PRINCIPAL -->
        <div class="swiper hero-carousel">
          <div class="swiper-wrapper" id="main-hero-swiper-wrapper">
            <!-- Slides Dinámicos -->
            <div 
              v-for="slide in carruselSlides" 
              :key="slide.id" 
              class="swiper-slide custom-slide"
              :style="slide.sin_boton && slide.enlace_url ? 'cursor: pointer;' : ''"
              @click="slide.sin_boton && slide.enlace_url ? abrirEnlace(slide.enlace_url) : null"
            >
              <div v-if="slide.badge || slide.titulo || slide.subtitulo || (!slide.sin_boton && slide.btn_texto)" class="slide-content-overlay">
                <span v-if="slide.badge" class="slide-badge" style="background: var(--color-colibri);">{{ slide.badge }}</span>
                <h2 v-if="slide.titulo">{{ slide.titulo }}</h2>
                <p v-if="slide.subtitulo">{{ slide.subtitulo }}</p>
                <a 
                  v-if="!slide.sin_boton && slide.enlace_url" 
                  :href="slide.enlace_url" 
                  target="_blank" 
                  class="btn btn-primary shimmer-btn"
                >
                  {{ slide.btn_texto || 'Ver Detalles' }}
                </a>
              </div>

              <!-- Multi-format dynamic picture template -->
              <picture class="hero-picture-full">
                <source v-if="slide.imagen_pc_url" :srcset="resolveImgUrl(slide.imagen_pc_url)" media="(min-width: 1024px)">
                <source v-if="slide.imagen_tablet_url" :srcset="resolveImgUrl(slide.imagen_tablet_url)" media="(min-width: 768px)">
                <img 
                  :src="resolveImgUrl(slide.imagen_url)" 
                  :alt="slide.titulo || 'EcoGuía SOS Portada'" 
                  :class="slide.titulo || slide.subtitulo ? 'slide-bg' : 'slide-bg full-color'" 
                  loading="lazy"
                >
              </picture>
              <div class="swiper-lazy-preloader swiper-lazy-preloader-white"></div>
            </div>

            <!-- Fallback Slide si no hay slides de BD -->
            <div v-if="carruselSlides.length === 0" class="swiper-slide custom-slide">
              <picture class="hero-picture-full">
                <source srcset="/assets/img/pc.gif" media="(min-width: 1024px)">
                <source srcset="/assets/img/tablet.gif" media="(min-width: 768px)">
                <img src="/assets/img/fon.gif" alt="Logo animado de EcoGuía SOS" class="slide-bg" loading="lazy">
              </picture>
              <div class="swiper-lazy-preloader swiper-lazy-preloader-white"></div>
            </div>
          </div>
          <!-- Controles -->
          <div class="swiper-pagination"></div>
          <div class="swiper-button-next"></div>
          <div class="swiper-button-prev"></div>
        </div>

        <!-- BOTONES DE NIVELES (MOVIDO AL HERO) -->
        <div class="level-buttons-container main-levels">
          <!-- COLIBRÍ -->
          <div class="btn-wrapper">
            <div class="level-btn-group level-btn-colibri glass-effect">
              <a href="#seccion-colibri" class="level-btn-link">
                <i class="fa-solid fa-dove"></i> Colibrí (Polinización)
              </a>
            </div>
            <div class="tooltip-list">
              <ul>
                <li><RouterLink to="/cursos">🎓 Cursos</RouterLink></li>
                <li><RouterLink to="/ecotecnias">💡 Ecotecnias</RouterLink></li>
                <li><RouterLink to="/agua">🌊 Agua</RouterLink></li>
                <li><RouterLink to="/lecturas">📚 Lecturas</RouterLink></li>
                <li><RouterLink to="/documentales">🎥 Documentales</RouterLink></li>
              </ul>
            </div>
          </div>

          <!-- AJOLOTE -->
          <div class="btn-wrapper">
            <div class="level-btn-group level-btn-ajolote glass-effect">
              <a href="#seccion-ajolote" class="level-btn-link">
                <i class="fa-solid fa-frog"></i> Ajolote (Regeneración)
              </a>
            </div>
            <div class="tooltip-list">
              <ul>
                <li><RouterLink to="/agentes">👥 Agentes</RouterLink></li>
                <li><RouterLink to="/convocatorias">📣 Convocatorias</RouterLink></li>
                <li><RouterLink to="/voluntariados">🤝 Ayuda</RouterLink></li>
              </ul>
            </div>
          </div>

          <!-- LOBO -->
          <div class="btn-wrapper">
            <div class="level-btn-group level-btn-lobo glass-effect">
              <a href="#seccion-lobo" class="level-btn-link">
                <i class="fa-solid fa-dog"></i> Lobo (Estrategia)
              </a>
            </div>
            <div class="tooltip-list">
              <ul>
                <li><RouterLink to="/fondos">💰 Fondos</RouterLink></li>
                <li><RouterLink to="/normativa">⚖️ Normativa</RouterLink></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="content-section">
      <!-- FONDO DE PARTÍCULAS PARA LA SECCIÓN DE EVENTOS -->
      <div id="particles-main"></div>

      <!-- BARRA DE BÚSQUEDA (TOP) -->
      <div class="search-bar-row">
        <div class="search-bar-container">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input 
            type="text" 
            v-model="buscadorInput" 
            placeholder="Buscar proyectos o lugares..." 
            autocomplete="off"
          >
        </div>
      </div>

      <!-- INTERRUPTOR DE EVENTOS/LUGARES (CENTRED) -->
      <div class="toggle-row">
        <div class="toggle-container">
          <span 
            class="toggle-label" 
            :class="{ 'active': filtroActual === 'evento' }"
            @click="filtroActual = 'evento'"
          >
            Eventos
          </span>
          <div 
            class="toggle-switch" 
            :class="{ 'active': filtroActual === 'lugar' }"
            @click="filtroActual = filtroActual === 'evento' ? 'lugar' : 'evento'"
          >
            <div class="toggle-handle"></div>
          </div>
          <span 
            class="toggle-label" 
            :class="{ 'active': filtroActual === 'lugar' }"
            @click="filtroActual = 'lugar'"
          >
            Lugares
          </span>
        </div>
      </div>

      <!-- BOTONES DE ACCIÓN (SEARCH & NEAR ME) -->
      <div class="action-buttons-row">
        <button 
          class="btn btn-secondary glass-effect" 
          :class="{ 'active': isAdvancedSearchOpen }"
          @click="isAdvancedSearchOpen = !isAdvancedSearchOpen"
        >
          <i class="fa-solid fa-sliders"></i> Búsqueda Avanzada
        </button>
        <div class="main-map-actions">
          <button type="button" class="btn-pill-map" @click="toggleMapa">
            {{ isMapVisible ? 'Ocultar mapa' : 'Ver mapa' }}
          </button>
          <button type="button" class="btn-pill-map" @click="toggleCalendario">
            {{ isCalendarVisible ? 'Ver cuadrícula' : 'Ver calendario' }}
          </button>
        </div>
      </div>

      <!-- PANEL DE BÚSQUEDA AVANZADA (Bottom Sheet / Modal) -->
      <div 
        id="advanced-search-panel" 
        class="advanced-search-panel glass-effect" 
        :class="{ 'hidden': !isAdvancedSearchOpen }"
      >
        <div class="search-panel-header-mobile">
          <div class="drag-handle"></div>
          <h3>Filtros Avanzados</h3>
        </div>

        <div class="search-panel-grid">
          <!-- Col 1: Categorías -->
          <div class="search-col">
            <h3>¿Qué buscas?</h3>
            <div class="category-pills-grid">
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'all' }"
                @click="filtrosAvanzados.categoria = 'all'"
              >
                Todo
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'Taller' }"
                @click="filtrosAvanzados.categoria = 'Taller'"
              >
                Talleres
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'Voluntariado' }"
                @click="filtrosAvanzados.categoria = 'Voluntariado'"
              >
                Voluntarios
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'Parque' }"
                @click="filtrosAvanzados.categoria = 'Parque'"
              >
                Parques
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'Huerto' }"
                @click="filtrosAvanzados.categoria = 'Huerto'"
              >
                Huertos
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'General' }"
                @click="filtrosAvanzados.categoria = 'General'"
              >
                General
              </button>
            </div>
          </div>

          <!-- Col 2: Ubicación -->
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
              id="distance-slider-container" 
              class="distance-slider-box"
              :class="{ 'hidden': filtrosAvanzados.ubicacion !== 'nearby' }"
            >
              <div class="slider-header">
                <span>Radio: <strong>{{ filtrosAvanzados.distancia }}</strong> km</span>
              </div>
              <input 
                type="range" 
                v-model.number="filtrosAvanzados.distancia" 
                min="1" 
                max="100" 
                class="custom-slider"
              >
            </div>
          </div>

          <!-- Col 3: Fecha -->
          <div class="search-col">
            <h3>¿Cuándo?</h3>
            <div class="date-pills-grid">
              <button 
                class="date-pill" 
                :class="{ 'active': filtrosAvanzados.fechas === 'all' && !filtrosAvanzados.fechaExacta }"
                @click="filtrosAvanzados.fechas = 'all'; filtrosAvanzados.fechaExacta = ''"
              >
                📅 Todas
              </button>
              <button 
                class="date-pill" 
                :class="{ 'active': filtrosAvanzados.fechas === 'today' && !filtrosAvanzados.fechaExacta }"
                @click="filtrosAvanzados.fechas = 'today'; filtrosAvanzados.fechaExacta = ''"
              >
                Hoy
              </button>
              <button 
                class="date-pill" 
                :class="{ 'active': filtrosAvanzados.fechas === 'tomorrow' && !filtrosAvanzados.fechaExacta }"
                @click="filtrosAvanzados.fechas = 'tomorrow'; filtrosAvanzados.fechaExacta = ''"
              >
                Mañana
              </button>
              <button 
                class="date-pill" 
                :class="{ 'active': filtrosAvanzados.fechas === 'weekend' && !filtrosAvanzados.fechaExacta }"
                @click="filtrosAvanzados.fechas = 'weekend'; filtrosAvanzados.fechaExacta = ''"
              >
                Finde
              </button>
            </div>
            <div class="specific-date-box">
              <span>O una fecha exacta:</span>
              <input 
                type="date" 
                v-model="filtrosAvanzados.fechaExacta" 
                class="custom-date-input"
                @change="filtrosAvanzados.fechas = 'all'"
              >
            </div>
          </div>

          <!-- Col 4: Audiencia -->
          <div class="search-col">
            <h3>Preferencias</h3>
            <div class="audience-grid">
              <label class="filter-chip">
                <input type="checkbox" v-model="filtrosAvanzados.mascotas">
                <span class="chip-content">🐶 Mascotas</span>
              </label>
              <label class="filter-chip">
                <input type="checkbox" v-model="filtrosAvanzados.ninos">
                <span class="chip-content">🧒 Niños</span>
              </label>
              <label class="filter-chip">
                <input type="checkbox" v-model="filtrosAvanzados.soloGratis">
                <span class="chip-content">💰 Gratis</span>
              </label>
            </div>
          </div>
        </div>

        <div class="search-panel-footer">
          <button class="btn" @click="resetFiltros" style="background-color: #d32f2f; color: white; border-radius: 15px; font-weight: 800; padding: 1rem 2rem; border: none; cursor: pointer;">
            <i class="fa-solid fa-rotate-left"></i> Limpiar
          </button>
          <button class="btn" @click="isAdvancedSearchOpen = false" style="background-color: #0077b6; color: white; border: none; cursor: pointer; border-radius: 15px; font-weight: 800; padding: 1rem 2rem;">
            Mostrar <span>{{ filteredProyectos.length }}</span> resultados
          </button>
        </div>
      </div>

      <!-- GRID DE TARJETAS -->
      <div 
        v-if="!isCalendarVisible" 
        class="card-grid-container" 
        id="contenedor-tarjetas"
      >
        <p v-if="loading" class="txt-loading">Cargando proyectos...</p>
        <p v-else-if="paginatedProyectos.length === 0" class="txt-loading">No se encontraron resultados.</p>
        
        <article 
          v-for="p in paginatedProyectos" 
          :key="p.id" 
          class="card fade-in" 
          :class="getNivelClass(p.categoria)"
          @click="router.push(`/${p.tipo}s/${p.id}`)"
          style="cursor: pointer;"
        >
          <div class="card-image">
            <img :src="p.imagen" :alt="p.nombre" onerror="this.src='/assets/img/kpop.webp'">
            <span v-if="p.distancia_calculada && p.distancia_calculada !== Infinity" class="dist-badge" style="background:rgba(15,20,25,0.9); color:#fde047; border:1px solid rgba(253,224,71,0.4); font-weight:700;">
              <i class="fa-solid fa-route"></i> a {{ p.distancia_calculada.toFixed(1) }} km
            </span>
            <span v-if="p.tipo === 'lugar'" class="place-event-badge">
              <i class="fa-solid fa-calendar-star"></i> {{ p.conteo_eventos || 0 }}
            </span>
            <div v-if="p.actor_nombre" class="actor-badge" :title="`Publicado por: ${p.actor_nombre}`">
              <i class="fa-solid fa-user-pen"></i>
              <span>{{ p.actor_nombre }}</span>
            </div>
            <div class="card-actions-overlay">
              <button 
                v-if="authStore.profile?.rol === 'admin' || (authStore.profile?.rol === 'actor' && p.owner_id === authStore.user?.id)" 
                class="btn-icon-glass"
                @click.stop="router.push(`/admin/editar/${p.tipo}/${p.id}`)"
              >
                <i class="fa-solid fa-pen"></i>
              </button>
            </div>
          </div>
          <div class="card-content">
            <div class="card-header"><span class="card-category">{{ p.categoria }}</span></div>
            <h3 class="card-title" style="margin-bottom:2px;">{{ p.nombre }}</h3>
            <span v-if="formatearFechaSubtext(p.fecha)" class="card-date-sub" style="color:#5bc2f7; font-size:0.8rem; display:block; margin-top:4px; font-weight:600;">
              <i class="fa-regular fa-calendar" style="margin-right:4px;"></i>{{ formatearFechaSubtext(p.fecha) }}
            </span>
          </div>
        </article>
      </div>

      <!-- PAGINACIÓN -->
      <div 
        v-if="!isCalendarVisible && totalPaginas > 1" 
        class="pagination-container"
      >
        <button 
          class="pagination-btn pagination-arrow" 
          :class="{ 'disabled': currentPage === 1 }"
          @click="currentPage > 1 && cambiarPagina(currentPage - 1)"
        >
          <i class="fa-solid fa-chevron-left"></i> <span>Anterior</span>
        </button>

        <template v-for="i in totalPaginas" :key="i">
          <button 
            class="pagination-btn" 
            :class="{ 'active': i === currentPage }"
            @click="cambiarPagina(i)"
          >
            {{ i }}
          </button>
        </template>

        <button 
          class="pagination-btn pagination-arrow" 
          :class="{ 'disabled': currentPage === totalPaginas }"
          @click="currentPage < totalPaginas && cambiarPagina(currentPage + 1)"
        >
          <span>Siguiente</span> <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>

      <!-- SECCIÓN CALENDARIO -->
      <section 
        v-if="isCalendarVisible" 
        id="calendar-section" 
        class="calendar-section fade-in"
      >
        <div class="calendar-header">
          <h2>{{ currentMonthLabel }}</h2>
          <div class="calendar-nav">
            <button class="calendar-nav-btn" @click="changeMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
            <button class="calendar-nav-btn" @click="changeMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>
        <div class="calendar-grid-header calendar-grid">
          <div class="calendar-weekday">Dom</div>
          <div class="calendar-weekday">Lun</div>
          <div class="calendar-weekday">Mar</div>
          <div class="calendar-weekday">Mié</div>
          <div class="calendar-weekday">Jue</div>
          <div class="calendar-weekday">Vie</div>
          <div class="calendar-weekday">Sáb</div>
        </div>
        <div id="calendar-days-grid" class="calendar-grid">
          <div 
            v-for="(dayObj, index) in daysInMonthList" 
            :key="index" 
            class="calendar-day"
            :class="{ 
              'empty': dayObj.day === null,
              'today': dayObj.day && new Date().getDate() === dayObj.day && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear,
              'has-single-event': dayObj.events.length === 1,
              'has-multiple-events': dayObj.events.length > 1
            }"
            @click="dayObj.day && dayObj.events.length > 0 ? openEventSheet(dayObj.day, dayObj.events) : null"
          >
            <span v-if="dayObj.day" class="calendar-day-number">{{ dayObj.day }}</span>
            <img 
              v-if="dayObj.day && dayObj.events.length === 1" 
              :src="dayObj.events[0].imagen" 
              class="event-image-bg"
            >
            <span v-else-if="dayObj.day && dayObj.events.length > 1" class="event-count-badge">
              {{ dayObj.events.length }} eventos
            </span>
          </div>
        </div>
      </section>

      <!-- Mini-Map Section (Desplegable) -->
      <section 
        class="home-map-section" 
        :class="{ 'hidden-map': !isMapVisible }"
        id="mapa-home-wrapper"
        style="background: rgba(2, 6, 23, 0.95); padding: 20px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5); margin: 40px auto; max-width: 1100px; width: 92%; position: relative; overflow: hidden;"
      >
        <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at center, rgba(114, 176, 77, 0.05) 0%, transparent 60%); pointer-events: none; z-index: 0;"></div>

        <div class="map-header-actions" style="position: relative; z-index: 1; padding: 15px; display: flex; justify-content: center; margin-bottom: 10px;">
          <RouterLink to="/mapa" class="btn btn-primary shimmer-extra" style="width: 100%; max-width: 400px; margin: 0 auto; text-align: center; border-radius: 12px; box-shadow: 0 10px 20px rgba(114, 176, 77, 0.3); font-weight: 700; letter-spacing: 1px;">
            <i class="fa-solid fa-expand"></i> VER ATLAS COMPLETO
          </RouterLink>
        </div>

        <div class="mini-map-container" style="position: relative; z-index: 1; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);">
          <div id="mini-map"></div>

          <!-- PANEL LATERAL DE DETALLES INTEGRADO -->
          <aside 
            id="home-event-detail-panel" 
            class="map-side-panel"
            :class="{ 'hidden': !selectedProjectDetail }"
          >
            <button class="panel-close-btn" @click="selectedProjectDetail = null">
              <i class="fa-solid fa-xmark"></i>
            </button>
            <div v-if="selectedProjectDetail" class="panel-img-container" style="height: 120px;">
              <img :src="selectedProjectDetail.imagen" alt="Imagen">
            </div>
            <div v-if="selectedProjectDetail" class="panel-content" style="padding: 12px;">
              <span class="badge">{{ selectedProjectDetail.tipo.toUpperCase() }}</span>
              <h3 style="font-size: 16px;">{{ selectedProjectDetail.nombre }}</h3>
              <p class="panel-meta" style="font-size: 12px;">
                <i class="fa-solid fa-location-dot"></i> <span>{{ selectedProjectDetail.ubicacion }}</span>
              </p>
            </div>
            <div v-if="selectedProjectDetail" class="panel-footer" style="padding: 0 12px 12px;">
              <RouterLink 
                :to="`/${selectedProjectDetail.tipo}s/${selectedProjectDetail.id}`" 
                class="btn-full"
                style="padding: 8px; font-size: 13px;"
              >
                Ver detalles
              </RouterLink>
            </div>
          </aside>
        </div>

        <!-- Carrusel Horizontal de Eventos Cercanos -->
        <div class="nearby-slider-wrapper">
          <div id="nearby-events-slider" class="nearby-events-slider">
            <div 
              v-for="p in filteredProyectos" 
              :key="p.id" 
              class="nearby-slider-card"
              :class="{ 'active': selectedProjectDetail?.id === p.id }"
              @click="abrirPanelDetalle(p)"
            >
              <div class="nearby-card-img" style="position:relative;">
                <img :src="p.imagen" :alt="p.nombre" onerror="this.src='/assets/img/kpop.webp'">
              </div>
              <div class="nearby-card-info">
                <div class="nearby-card-title" style="font-weight:700; line-height:1.1;">{{ p.nombre }}</div>
                <div v-if="p.distancia_calculada && p.distancia_calculada !== Infinity" class="nearby-card-dist" style="color:#fde047; font-size:0.75rem; font-weight:700; margin-top:2px;">
                  <i class="fa-solid fa-route"></i> a {{ p.distancia_calculada.toFixed(1) }} km
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- EVENT SHEET (Bottom Sheet para detalles de eventos del día) -->
    <div 
      class="event-sheet-overlay"
      :class="{ 'active': isEventSheetVisible }"
      @click="closeEventSheet"
    ></div>
    <div 
      class="event-sheet"
      :class="{ 'active': isEventSheetVisible }"
    >
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <h3 id="sheet-date-title">{{ activeDateLabel }}</h3>
        <p id="sheet-date-subtitle">Selecciona un evento para ver más información</p>
      </div>
      <div class="sheet-event-list">
        <div 
          v-for="ev in activeDateEvents" 
          :key="ev.id" 
          class="sheet-event-item"
          @click="closeEventSheet(); router.push(`/eventos/${ev.id}`)"
        >
          <img :src="ev.imagen" :alt="ev.nombre" onerror="this.src='/assets/img/kpop.webp'">
          <div class="sheet-event-content">
            <h4>{{ ev.nombre }}</h4>
            <p><i class="fa-solid fa-location-dot"></i> {{ ev.ubicacion }}</p>
            <span class="event-category-badge">{{ ev.categoria }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- SECCIÓN COLIBRÍ -->
    <section id="seccion-colibri" class="nivel-section">
      <div class="section-divider"></div>
      <div class="nivel-content">
        <h2><i class="fa-solid fa-dove"></i> Colibrí (Polinización)</h2>
        <p class="nivel-description">Poliniza tu mente con conocimiento y pequeñas acciones que generan vida.</p>
        <div class="nivel-btn-grid">
          <RouterLink to="/cursos" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">🎓 Cursos</span>
            <p class="nivel-btn-desc">Explora talleres y capacitación sostenible.</p>
          </RouterLink>
          <RouterLink to="/ecotecnias" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">💡 Ecotecnias</span>
            <p class="nivel-btn-desc">Tecnologías para el hogar sustentable.</p>
          </RouterLink>
          <RouterLink to="/agua" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">🌊 Agua</span>
            <p class="nivel-btn-desc">Cuidado y alternativas para uso del agua.</p>
          </RouterLink>
          <RouterLink to="/lecturas" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">📚 Lecturas</span>
            <p class="nivel-btn-desc">Reflexiones y guías de educación ambiental.</p>
          </RouterLink>
          <RouterLink to="/documentales" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">🎥 Documentales</span>
            <p class="nivel-btn-desc">Catálogo de cine y material audiovisual ecológico.</p>
          </RouterLink>
          <RouterLink to="/firmas" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">✍️ Firmas</span>
            <p class="nivel-btn-desc">Apoya causas ambientales importantes.</p>
          </RouterLink>
        </div>
        <button @click="scrollToTop" class="btn-back-to-top">
          <i class="fa-solid fa-arrow-up"></i> Ir al Buscador
        </button>
      </div>
    </section>

    <!-- SECCIÓN AJOLOTE -->
    <section id="seccion-ajolote" class="nivel-section">
      <div class="section-divider"></div>
      <div class="nivel-content">
        <h2><i class="fa-solid fa-frog"></i> Ajolote (Regeneración)</h2>
        <p class="nivel-description">Regenera el tejido social y ambiental actuando en comunidad.</p>
        <div class="nivel-btn-grid">
          <RouterLink to="/agentes" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">👥 Agentes de cambio</span>
            <p class="nivel-btn-desc">Conoce a quienes lideran el cambio.</p>
          </RouterLink>
          <RouterLink to="/convocatorias" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">📣 Convocatorias</span>
            <p class="nivel-btn-desc">Oportunidades para tus proyectos.</p>
          </RouterLink>
          <RouterLink to="/voluntariados" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">🤝 Voluntariados</span>
            <p class="nivel-btn-desc">Eventos y jornadas cerca de ti.</p>
          </RouterLink>
        </div>
        <button @click="scrollToTop" class="btn-back-to-top">
          <i class="fa-solid fa-arrow-up"></i> Ir al Buscador
        </button>
      </div>
    </section>

    <!-- SECCIÓN LOBO -->
    <section id="seccion-lobo" class="nivel-section">
      <div class="section-divider"></div>
      <div class="nivel-content">
        <h2><i class="fa-solid fa-dog"></i> Lobo (Estrategia)</h2>
        <p class="nivel-description">Lidera con estructura, fondos y legalidad.</p>
        <div class="nivel-btn-grid">
          <RouterLink to="/fondos" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">💰 Fondos</span>
            <p class="nivel-btn-desc">Financiamiento para proyectos.</p>
          </RouterLink>
          <RouterLink to="/normativa" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">⚖️ Normativa</span>
            <p class="nivel-btn-desc">Leyes y normativas ambientales.</p>
          </RouterLink>
        </div>
        <button @click="scrollToTop" class="btn-back-to-top">
          <i class="fa-solid fa-arrow-up"></i> Ir al Buscador
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Swiper styles and particles are handled globally, but scoped overrides can go here if needed */
</style>
