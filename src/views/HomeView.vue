<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'

import { useHomeStore } from '../stores/homeStore'

const router = useRouter()
const authStore = useAuthStore()
const homeStore = useHomeStore()

// State
const todosLosProyectos = computed(() => homeStore.todosLosProyectos)
const carruselSlides = computed(() => homeStore.carruselSlides)
const loading = computed(() => homeStore.loading)
const filtroActual = ref<'evento' | 'en_linea' | 'lugar'>('evento')
const buscadorInput = ref('')

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
const calFiltro = ref<'todos' | 'presencial' | 'en_linea'>('todos')

// Tooltip state
const activeTooltip = ref<string | null>(null)
const toggleTooltip = (name: string, event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  activeTooltip.value = activeTooltip.value === name ? null : name
}

// Window Event Listeners
const handleResize = () => {
  maxRendered.value = window.innerWidth <= 600 ? 4 : 9
}

const handleWindowClick = () => {
  activeTooltip.value = null
}

watch(() => authStore.user, (newUser) => {
  if (newUser) {
    setTimeout(() => obtenerUbicacionSilenciosa(), 1000)
  }
}, { immediate: true })

// Watch slides to initialize/reinitialize Swiper when they load or change
watch(carruselSlides, (newSlides) => {
  if (newSlides && newSlides.length > 0) {
    nextTick(() => {
      iniciarCarrusel()
    })
  }
})

onMounted(async () => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('click', handleWindowClick)
  
  // Init auth store if not already initialized
  if (authStore.loading) {
    authStore.init()
  }
  
  await homeStore.cargarDatos()
  
  nextTick(() => {
    iniciarCarrusel()
    iniciarParticulas()
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('click', handleWindowClick)
  if (swiperInstance) {
    try {
      swiperInstance.destroy(true, true)
    } catch (e) {}
  }
})

// Globals declarations
declare const Swiper: any
declare const maplibregl: any
declare const particlesJS: any
declare const lucide: any

let mapInstance: any = null
let currentMarkers: any[] = []
let swiperInstance: any = null

// Data loading is managed by homeStore
// Carga de datos local removida

// Distance Calculation
const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const filteredProyectos = computed(() => {
  let list = todosLosProyectos.value.filter(p => {
    if (filtroActual.value === 'evento') {
      return p.tipo === 'evento' && p.modalidad === 'presencial'
    } else if (filtroActual.value === 'en_linea') {
      return p.tipo === 'evento' && (p.modalidad === 'en_linea' || p.tiene_sesion_online === true)
    } else {
      return p.tipo === 'lugar'
    }
  })

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
  let list = todosLosProyectos.value.filter(p => p.tipo === 'evento')
  if (calFiltro.value === 'presencial') {
    return list.filter(p => p.modalidad === 'presencial')
  } else if (calFiltro.value === 'en_linea') {
    return list.filter(p => p.modalidad === 'en_linea' || p.tiene_sesion_online === true)
  }
  return list
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
    if (swiperInstance) {
      try {
        swiperInstance.destroy(true, true)
      } catch (e) {}
    }
    swiperInstance = new Swiper('.hero-carousel', {
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
  const ajolote = ['agentes', 'voluntariados', 'comunidad', 'social', 'convocatoria', 'convocatorias']
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

const scrollToSection = (id: string) => {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

// Carga en onMounted unificado
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
            <div class="level-btn-group level-btn-colibri" :class="{ 'dropdown-open': activeTooltip === 'colibri' }">
              <a href="#seccion-colibri" class="level-btn-link" @click.prevent="scrollToSection('seccion-colibri')">
                <i class="fa-solid fa-dove"></i> Colibrí (Polinización)
              </a>
              <button type="button" class="mobile-info-toggle" @click.stop="toggleTooltip('colibri', $event)">
                <i class="fa-solid fa-chevron-down dropdown-arrow"></i>
              </button>
            </div>
            <div class="tooltip-list" :class="{ 'activo': activeTooltip === 'colibri' }" @click.stop>
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
            <div class="level-btn-group level-btn-ajolote" :class="{ 'dropdown-open': activeTooltip === 'ajolote' }">
              <a href="#seccion-ajolote" class="level-btn-link" @click.prevent="scrollToSection('seccion-ajolote')">
                <i class="fa-solid fa-frog"></i> Ajolote (Regeneración)
              </a>
              <button type="button" class="mobile-info-toggle" @click.stop="toggleTooltip('ajolote', $event)">
                <i class="fa-solid fa-chevron-down dropdown-arrow"></i>
              </button>
            </div>
            <div class="tooltip-list" :class="{ 'activo': activeTooltip === 'ajolote' }" @click.stop>
              <ul>
                <li><RouterLink to="/agentes">👥 Agentes</RouterLink></li>
                <li><RouterLink to="/convocatoria">📣 Convocatorias</RouterLink></li>
                <li><RouterLink to="/voluntariados">🤝 Ayuda</RouterLink></li>
              </ul>
            </div>
          </div>

          <!-- LOBO -->
          <div class="btn-wrapper">
            <div class="level-btn-group level-btn-lobo" :class="{ 'dropdown-open': activeTooltip === 'lobo' }">
              <a href="#seccion-lobo" class="level-btn-link" @click.prevent="scrollToSection('seccion-lobo')">
                <i class="fa-solid fa-dog"></i> Lobo (Estrategia)
              </a>
              <button type="button" class="mobile-info-toggle" @click.stop="toggleTooltip('lobo', $event)">
                <i class="fa-solid fa-chevron-down dropdown-arrow"></i>
              </button>
            </div>
            <div class="tooltip-list" :class="{ 'activo': activeTooltip === 'lobo' }" @click.stop>
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
          <button 
            type="button"
            class="tab-btn" 
            :class="{ 'active': filtroActual === 'evento' }"
            @click="filtroActual = 'evento'"
          >
            📍 Eventos
          </button>
          <button 
            type="button"
            class="tab-btn" 
            :class="{ 'active': filtroActual === 'en_linea' }"
            @click="filtroActual = 'en_linea'"
          >
            🖥️ En Línea
          </button>
          <button 
            type="button"
            class="tab-btn" 
            :class="{ 'active': filtroActual === 'lugar' }"
            @click="filtroActual = 'lugar'"
          >
            🌿 Lugares
          </button>
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
                data-cat="all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="globe" aria-hidden="true" class="lucide lucide-globe"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg> Todo
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'Taller' }"
                @click="filtrosAvanzados.categoria = 'Taller'"
                data-cat="Taller"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="palette" aria-hidden="true" class="lucide lucide-palette"><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"></path><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle></svg> Talleres
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'Voluntariado' }"
                @click="filtrosAvanzados.categoria = 'Voluntariado'"
                data-cat="Voluntariado"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="sprout" aria-hidden="true" class="lucide lucide-sprout"><path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"></path><path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"></path><path d="M5 21h14"></path></svg> Voluntarios
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'Parque' }"
                @click="filtrosAvanzados.categoria = 'Parque'"
                data-cat="Parque"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="trees" aria-hidden="true" class="lucide lucide-trees"><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"></path><path d="M7 16v6"></path><path d="M13 19v3"></path><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"></path></svg> Parques
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'Huerto' }"
                @click="filtrosAvanzados.categoria = 'Huerto'"
                data-cat="Huerto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="leaf" aria-hidden="true" class="lucide lucide-leaf"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg> Huertos
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'General' }"
                @click="filtrosAvanzados.categoria = 'General'"
                data-cat="General"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="map-pin" aria-hidden="true" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg> General
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
                data-loc="all"
              >
                📍 Todo
              </button>
              <button 
                class="loc-pill" 
                :class="{ 'active': filtrosAvanzados.ubicacion === 'nearby' }"
                @click="filtrosAvanzados.ubicacion = 'nearby'; toggleProximidad()"
                data-loc="nearby"
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
                <span>Radio: <strong id="distance-value">{{ filtrosAvanzados.distancia }}</strong> km</span>
              </div>
              <input 
                type="range" 
                id="distance-slider"
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
                data-date="all"
              >
                📅 Todas
              </button>
              <button 
                class="date-pill" 
                :class="{ 'active': filtrosAvanzados.fechas === 'today' && !filtrosAvanzados.fechaExacta }"
                @click="filtrosAvanzados.fechas = 'today'; filtrosAvanzados.fechaExacta = ''"
                data-date="today"
              >
                Hoy
              </button>
              <button 
                class="date-pill" 
                :class="{ 'active': filtrosAvanzados.fechas === 'tomorrow' && !filtrosAvanzados.fechaExacta }"
                @click="filtrosAvanzados.fechas = 'tomorrow'; filtrosAvanzados.fechaExacta = ''"
                data-date="tomorrow"
              >
                Mañana
              </button>
              <button 
                class="date-pill" 
                :class="{ 'active': filtrosAvanzados.fechas === 'weekend' && !filtrosAvanzados.fechaExacta }"
                @click="filtrosAvanzados.fechas = 'weekend'; filtrosAvanzados.fechaExacta = ''"
                data-date="weekend"
              >
                Finde
              </button>
            </div>
            <div class="specific-date-box">
              <span>O una fecha exacta:</span>
              <input 
                type="date" 
                id="calendar-input"
                v-model="filtrosAvanzados.fechaExacta" 
                class="custom-date-input"
                @change="filtrosAvanzados.fechas = 'all'"
              >
            </div>
          </div>

          <!-- Col 4: Preferencias -->
          <div class="search-col">
            <h3>Preferencias</h3>
            <div class="audience-grid">
              <label class="filter-chip">
                <input type="checkbox" id="filter-pets" v-model="filtrosAvanzados.mascotas">
                <span class="chip-content">🐶 Mascotas</span>
              </label>
              <label class="filter-chip">
                <input type="checkbox" id="filter-kids" v-model="filtrosAvanzados.ninos">
                <span class="chip-content">🧒 Niños</span>
              </label>
              <label class="filter-chip">
                <input type="checkbox" id="switch-gratis" v-model="filtrosAvanzados.soloGratis">
                <span class="chip-content">💰 Gratis</span>
              </label>
            </div>
          </div>
        </div>

        <div class="search-panel-footer">
          <button class="btn" id="btn-reset-filters" @click="resetFiltros" style="background-color: #d32f2f; color: white; border-radius: 15px; font-weight: 800; padding: 1rem 2rem; box-shadow: 0 10px 20px rgba(211, 47, 47, 0.2); transition: all 0.3s; border: none; cursor: pointer;">
            <i class="fa-solid fa-rotate-left"></i> Limpiar
          </button>
          <button class="btn" id="btn-apply-filters" @click="isAdvancedSearchOpen = false" style="background-color: #0077b6; color: white; border: none; cursor: pointer; border-radius: 15px; font-weight: 800; padding: 1rem 2rem; box-shadow: 0 10px 20px rgba(0, 119, 182, 0.2); transition: all 0.3s;">
            Mostrar <span id="results-count">{{ filteredProyectos.length }}</span> resultados
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
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="card-category">{{ p.categoria }}</span>
              <span v-if="p.tipo === 'evento' && p.modalidad === 'en_linea'" class="status-badge" style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9; font-size: 0.65rem; border: 1px solid rgba(14, 165, 233, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                🖥️ En Línea
              </span>
              <span v-else-if="p.tipo === 'evento' && p.tiene_sesion_online" class="status-badge" style="background: rgba(139, 92, 246, 0.15); color: #c084fc; font-size: 0.65rem; border: 1px solid rgba(139, 92, 246, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                🔄 Híbrido
              </span>
            </div>
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
        <div class="calendar-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">
          <h2 style="margin: 0;">{{ currentMonthLabel }}</h2>
          <div class="calendar-filters" style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin: 0 auto 0 0;">
            <button 
              type="button"
              class="tab-btn" 
              :class="{ 'active': calFiltro === 'todos' }" 
              @click="calFiltro = 'todos'"
              style="padding: 6px 14px; font-size: 0.85rem; font-weight: 700; border: none; border-radius: 20px; transition: all 0.3s; cursor: pointer;"
            >
              Todos
            </button>
            <button 
              type="button"
              class="tab-btn" 
              :class="{ 'active': calFiltro === 'presencial' }" 
              @click="calFiltro = 'presencial'"
              style="padding: 6px 14px; font-size: 0.85rem; font-weight: 700; border: none; border-radius: 20px; transition: all 0.3s; cursor: pointer;"
            >
              📍 Presencial
            </button>
            <button 
              type="button"
              class="tab-btn" 
              :class="{ 'active': calFiltro === 'en_linea' }" 
              @click="calFiltro = 'en_linea'"
              style="padding: 6px 14px; font-size: 0.85rem; font-weight: 700; border: none; border-radius: 20px; transition: all 0.3s; cursor: pointer;"
            >
              🖥️ En Línea
            </button>
          </div>
          <div class="calendar-nav" style="display: flex; gap: 10px;">
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
          <RouterLink to="/convocatoria" class="nivel-btn-item glass-effect">
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

.toggle-container {
  display: flex;
  gap: 8px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 30px;
  position: relative;
  width: fit-content;
  margin: 0 auto 2.5rem;
}

:global(body.dark-theme) .toggle-container {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.tab-btn {
  background: transparent;
  color: #4b5563;
  cursor: pointer;
  border: none;
  padding: 10px 24px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.tab-btn:hover {
  color: #1f2937;
  background: rgba(0, 0, 0, 0.03);
}

:global(body.dark-theme) .tab-btn {
  color: rgba(255, 255, 255, 0.6);
}

:global(body.dark-theme) .tab-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  background: #72B04D;
  color: #fff !important;
  box-shadow: 0 4px 12px rgba(114, 176, 77, 0.3);
}

:global(body.dark-theme) .tab-btn.active {
  box-shadow: 0 4px 15px rgba(114, 176, 77, 0.4);
}
</style>
