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
const filtroActual = ref<'evento' | 'en_linea'>('evento')
const buscadorInput = ref('')

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

const formatFechaShort = (dateStr: string) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
  } catch (e) {
    return ''
  }
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


// Navigation/View toggles
const isMapVisible = ref(false)
const isCalendarVisible = ref(false)
const isEventSheetVisible = ref(false)

// Pagination
const currentPage = ref(1)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
const gridColumns = ref(5)

const isMobile = ref(false)
const isTablet = ref(false)

const updateGridColumns = () => {
  nextTick(() => {
    const el = document.getElementById('contenedor-tarjetas')
    if (el) {
      const computedStyle = window.getComputedStyle(el)
      const gridTemplateColumns = computedStyle.gridTemplateColumns
      if (gridTemplateColumns) {
        const columns = gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length
        if (columns > 0) {
          gridColumns.value = columns
          console.log('[Pagination Debug] Detected grid columns:', columns, 'maxRendered will be:', columns * 2)
        }
      }
    } else {
      // Fallback calculation based on width if element is not in DOM yet
      const width = windowWidth.value
      let cols = 5
      if (width <= 768) {
        cols = 2
      } else if (width <= 1024) {
        cols = 4
      } else if (width <= 1200) {
        cols = 3
      } else {
        cols = Math.floor((width - 40) / 320) || 1
        if (cols > 5) cols = 5
        if (cols < 1) cols = 1
      }
      gridColumns.value = cols
    }
  })
}

const updateWidth = () => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
    updateGridColumns()
  }
}

const maxRendered = computed(() => {
  return gridColumns.value * 2
})

// Geolocation
const getInitialCoords = () => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('eco_user_coords')
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch (e) {}
    }
  }
  return null
}
const userCoords = ref<{ lat: number; lng: number } | null>(getInitialCoords())
const proximidadActiva = ref(!!userCoords.value)

// Advanced Search Filters
const isAdvancedSearchOpen = ref(false)
const filtrosAvanzados = ref({
  categoria: 'all',
  ubicacion: userCoords.value ? 'nearby' : 'all',
  distancia: 40,
  fechas: 'all',
  fechaExacta: '',
  soloGratis: false,
  ninos: false,
  mascotas: false,
  ordenarPor: 'fecha'
})

const hasActiveFilters = computed(() => {
  return !!buscadorInput.value || 
         filtrosAvanzados.value.categoria !== 'all' || 
         proximidadActiva.value || 
         filtrosAvanzados.value.soloGratis || 
         filtrosAvanzados.value.mascotas || 
         filtrosAvanzados.value.ninos
})

// Map and Calendar selections
const selectedProjectDetail = ref<any | null>(null)
const activeDateLabel = ref('')
const activeDateEvents = ref<any[]>([])

// Calendar state
const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())

// Tooltip state
const activeTooltip = ref<string | null>(null)
const toggleTooltip = (name: string, event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  activeTooltip.value = activeTooltip.value === name ? null : name
}

// Window Event Listeners
let mobileQuery: MediaQueryList | null = null
let tabletQuery: MediaQueryList | null = null

const updateMatch = () => {
  if (mobileQuery) isMobile.value = mobileQuery.matches
  if (tabletQuery) isTablet.value = tabletQuery.matches
  console.log('[Pagination Debug] updateMatch triggered. isMobile:', isMobile.value, 'isTablet:', isTablet.value, 'window.innerWidth:', window.innerWidth)
}

const handleWindowClick = () => {
  activeTooltip.value = null
}

watch(() => authStore.user, (newUser) => {
  if (newUser) {
    setTimeout(() => obtenerUbicacionSilenciosa(), 1000)
  } else {
    userCoords.value = null
    proximidadActiva.value = false
    localStorage.removeItem('eco_user_coords')
    homeStore.invalidateCache()
    homeStore.cargarDatos(undefined, undefined, undefined, true)
  }
}, { immediate: true })

// Watch proximity filters to query database dynamically
watch([userCoords, () => filtrosAvanzados.value.distancia, proximidadActiva], ([newCoords, newDist, isProxActive]) => {
  if (isProxActive && newCoords) {
    homeStore.cargarDatos(newCoords.lat, newCoords.lng, newDist, true)
  }
})

watch(proximidadActiva, (newVal) => {
  if (!newVal) {
    homeStore.cargarDatos(undefined, undefined, undefined, true)
  }
})

// Watch slides to initialize/reinitialize Swiper when they load or change
watch(carruselSlides, (newSlides) => {
  if (newSlides && newSlides.length > 0) {
    nextTick(() => {
      iniciarCarrusel()
    })
  }
})

onMounted(async () => {
  console.log('[Pagination Debug] onMounted called')
  mobileQuery = window.matchMedia('(max-width: 600px)')
  tabletQuery = window.matchMedia('(min-width: 601px) and (max-width: 1024px)')
  
  updateMatch() // Ensure matches are set on initial load

  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener('change', updateMatch)
    tabletQuery.addEventListener('change', updateMatch)
  } else {
    mobileQuery.addListener(updateMatch)
    tabletQuery.addListener(updateMatch)
  }

  window.addEventListener('click', handleWindowClick)
  window.addEventListener('resize', updateWidth)
  
  // Init auth store if not already initialized
  if (authStore.loading) {
    authStore.init()
  }
  
  if (proximidadActiva.value && userCoords.value) {
    await homeStore.cargarDatos(userCoords.value.lat, userCoords.value.lng, filtrosAvanzados.value.distancia, true)
  } else {
    await homeStore.cargarDatos(undefined, undefined, undefined, true)
  }
  
  nextTick(() => {
    iniciarCarrusel()
    iniciarParticulas()
    updateGridColumns()
  })
})

onUnmounted(() => {
  if (mobileQuery) {
    if (mobileQuery.removeEventListener) {
      mobileQuery.removeEventListener('change', updateMatch)
      tabletQuery?.removeEventListener('change', updateMatch)
    } else {
      mobileQuery.removeListener(updateMatch)
      tabletQuery?.removeListener(updateMatch)
    }
  }
  window.removeEventListener('click', handleWindowClick)
  window.removeEventListener('resize', updateWidth)
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
    } else {
      return p.tipo === 'evento' && (p.modalidad === 'en_linea' || p.tiene_sesion_online === true)
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
    list = list.filter(p => p.categoria?.toLowerCase() === filtrosAvanzados.value.categoria.toLowerCase())
  }

  // GPS Proximity
  if (proximidadActiva.value && userCoords.value) {
    list = list.filter(p => {
      // Las actividades virtuales o con sesión online ignoran la distancia del GPS
      if (p.modalidad === 'en_linea' || p.tiene_sesion_online === true) {
        p.distancia_calculada = Infinity
        return true
      }
      if (!p.coordenadas || !p.coordenadas.lat || !p.coordenadas.lng) {
        p.distancia_calculada = Infinity
        return true
      }
      const dist = calcularDistancia(userCoords.value!.lat, userCoords.value!.lng, p.coordenadas.lat, p.coordenadas.lng)
      p.distancia_calculada = dist
      return dist <= filtrosAvanzados.value.distancia
    })
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

  // ORDENACIÓN DINÁMICA
  if (filtrosAvanzados.value.ordenarPor === 'distancia' && proximidadActiva.value && userCoords.value) {
    list.sort((a, b) => (a.distancia_calculada || Infinity) - (b.distancia_calculada || Infinity))
  } else if (filtrosAvanzados.value.ordenarPor === 'alfabetico') {
    list.sort((a, b) => a.nombre.localeCompare(b.nombre))
  } else {
    list.sort((a, b) => {
      if (a.tipo === 'lugar' && b.tipo === 'lugar') {
        return a.nombre.localeCompare(b.nombre)
      }
      const dateA = a.fecha_inicio ? new Date(a.fecha_inicio).getTime() : Infinity
      const dateB = b.fecha_inicio ? new Date(b.fecha_inicio).getTime() : Infinity
      return dateA - dateB
    })
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

const visiblePageNumbers = computed(() => {
  const total = totalPaginas.value
  const current = currentPage.value
  const pages: (number | string)[] = []
  
  if (total <= 5) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    if (current <= 3) {
      pages.push(1, 2, 3, 4, '...', total)
    } else if (current >= total - 2) {
      pages.push(1, '...', total - 3, total - 2, total - 1, total)
    } else {
      pages.push(1, '...', current - 1, current, current + 1, '...', total)
    }
  }
  return pages
})

// Watch filters to reset page and update map markers
watch([filtroActual, buscadorInput, filtrosAvanzados, proximidadActiva], () => {
  currentPage.value = 1
  nextTick(() => {
    actualizarMiniMapa()
    updateGridColumns()
  })
}, { deep: true })

watch(todosLosProyectos, () => {
  updateGridColumns()
})

watch(filtroActual, () => {
  filtrosAvanzados.value.categoria = 'all'
})

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
        <img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='/assets/img/logo-app.webp'">
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
      el.innerHTML = `<img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='/assets/img/logo-app.webp'">`
      
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
  if (!authStore.user) {
    alert('Inicia sesión para buscar eventos cerca de ti.')
    filtrosAvanzados.value.ubicacion = 'all'
    return
  }
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
      const newLat = position.coords.latitude
      const newLng = position.coords.longitude
      if (userCoords.value) {
        const diff = calcularDistancia(userCoords.value.lat, userCoords.value.lng, newLat, newLng)
        if (diff < 0.05) { // menos de 50 metros
          console.log('[GPS Silencioso] Ubicación sin cambios significativos (<50m).')
          proximidadActiva.value = true
          filtrosAvanzados.value.distancia = 40
          filtrosAvanzados.value.ubicacion = 'nearby'
          return
        }
      }
      userCoords.value = { lat: newLat, lng: newLng }
      localStorage.setItem('eco_user_coords', JSON.stringify(userCoords.value))
      proximidadActiva.value = true
      filtrosAvanzados.value.distancia = 40
      filtrosAvanzados.value.ubicacion = 'nearby'
    },
    (error) => {
      console.log('[GPS Silencioso] Falló:', error)
    },
    { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
  )
}

// Calendar Logic
const calendarEvents = ref<any[]>([])

const fetchCalendarEvents = async () => {
  try {
    const startOfMonth = new Date(currentYear.value, currentMonth.value, 1, 0, 0, 0).toISOString()
    const endOfMonth = new Date(currentYear.value, currentMonth.value + 1, 0, 23, 59, 59).toISOString()
    
    const { data, error } = await supabase
      .from('eventos')
      .select('id, nombre, categoria, ubicacion, imagen_url, fecha_inicio, fecha_fin, modalidad, lat, lng, tiene_sesion_online, imagenes, es_gratuito, pet_friendly, apto_ninos')
      .eq('estado', 'approved')
      .gte('fecha_inicio', startOfMonth)
      .lte('fecha_inicio', endOfMonth)
      
    if (error) throw error
    
    calendarEvents.value = (data || []).map((row: any) => {
      let firstImg = row.imagen_url
      if (row.imagenes && Array.isArray(row.imagenes) && row.imagenes.length > 0) {
        firstImg = row.imagenes[0]
      }
      return {
        id: row.id,
        nombre: row.nombre,
        categoria: row.categoria || 'General',
        ubicacion: row.ubicacion || 'CDMX',
        imagen: firstImg || '/assets/img/logo-app.webp',
        tipo: 'evento',
        fecha: row.fecha_inicio || row.created_at,
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
        modalidad: row.modalidad || 'presencial',
        tiene_sesion_online: row.tiene_sesion_online || false,
        coordenadas: (row.lat && row.lng) ? { lat: row.lat, lng: row.lng } : null,
        es_gratuito: row.es_gratuito,
        pet_friendly: row.pet_friendly,
        apto_ninos: row.apto_ninos
      }
    })
  } catch (err) {
    console.error('[Calendar] Error al cargar eventos del mes:', err)
  }
}

watch([currentMonth, currentYear, isCalendarVisible], () => {
  if (isCalendarVisible.value) {
    fetchCalendarEvents()
  }
}, { immediate: true })

const allEvents = computed(() => {
  let list = calendarEvents.value

  // 1. Sincronización con el selector principal del Home (filtroActual)
  if (filtroActual.value === 'evento') {
    list = list.filter(p => p.modalidad === 'presencial')
  } else if (filtroActual.value === 'en_linea') {
    list = list.filter(p => p.modalidad === 'en_linea' || p.tiene_sesion_online === true)
  }

  // 2. Filtro de Texto (Buscador superior)
  if (buscadorInput.value) {
    const text = buscadorInput.value.toLowerCase()
    list = list.filter(p => 
      p.nombre.toLowerCase().includes(text) ||
      p.categoria.toLowerCase().includes(text) ||
      p.ubicacion.toLowerCase().includes(text)
    )
  }

  // 3. Filtro de Categoría (Búsqueda avanzada)
  if (filtrosAvanzados.value.categoria !== 'all') {
    list = list.filter(p => p.categoria?.toLowerCase() === filtrosAvanzados.value.categoria.toLowerCase())
  }

  // 4. Filtro de Proximidad GPS (si está activa)
  if (proximidadActiva.value && userCoords.value) {
    list = list.filter(p => {
      // Las actividades virtuales o con sesión online ignoran la distancia del GPS
      if (p.modalidad === 'en_linea' || p.tiene_sesion_online === true) return true
      if (!p.coordenadas || !p.coordenadas.lat || !p.coordenadas.lng) return false
      
      const dist = calcularDistancia(userCoords.value!.lat, userCoords.value!.lng, p.coordenadas.lat, p.coordenadas.lng)
      return dist <= filtrosAvanzados.value.distancia
    })
  }

  // 5. Filtros de Preferencias (Gratis, Mascotas, Niños)
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
    distancia: 40, // matching default initial value of 40
    fechas: 'all',
    fechaExacta: '',
    soloGratis: false,
    ninos: false,
    mascotas: false,
    ordenarPor: 'fecha'
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
                <li><RouterLink to="/firmas">✍️ Firmas</RouterLink></li>
                <li><RouterLink to="/eco-tecnologia">🔌 Eco-tecnología</RouterLink></li>
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
                <li><RouterLink to="/causas">💝 Causas / Rifas</RouterLink></li>
                <li><RouterLink to="/lugares">🌿 Lugares</RouterLink></li>
                <li><RouterLink to="/super-eventos">🏆 Eventos Especiales</RouterLink></li>
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
      <div class="search-bar-row" v-reveal>
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
      <div class="toggle-row" v-reveal>
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
            @click="router.push('/lugares')"
          >
            🌿 Lugares
          </button>
        </div>
      </div>

      <!-- BOTONES DE ACCIÓN (SEARCH & NEAR ME) -->
      <div class="action-buttons-row" v-reveal>
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
                🌍 Todo
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'taller' }"
                @click="filtrosAvanzados.categoria = 'taller'"
              >
                🎨 Talleres
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'voluntariado' }"
                @click="filtrosAvanzados.categoria = 'voluntariado'"
              >
                🤝 Voluntariados
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'conferencia' }"
                @click="filtrosAvanzados.categoria = 'conferencia'"
              >
                🗣️ Charlas
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'limpieza' }"
                @click="filtrosAvanzados.categoria = 'limpieza'"
              >
                ♻️ Limpieza
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'reforestacion' }"
                @click="filtrosAvanzados.categoria = 'reforestacion'"
              >
                🌲 Reforestación
              </button>
              <button 
                class="cat-pill" 
                :class="{ 'active': filtrosAvanzados.categoria === 'otro' }"
                @click="filtrosAvanzados.categoria = 'otro'"
              >
                💡 Otros
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

          <!-- Col 5: Ordenar por -->
          <div class="search-col">
            <h3>Ordenar por</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label class="filter-chip">
                <input type="radio" v-model="filtrosAvanzados.ordenarPor" value="fecha" name="sort-type">
                <span class="chip-content">📅 Próximos (Fecha)</span>
              </label>
              <label class="filter-chip" :style="!proximidadActiva ? 'opacity: 0.5; cursor: not-allowed;' : ''">
                <input type="radio" v-model="filtrosAvanzados.ordenarPor" value="distancia" name="sort-type" :disabled="!proximidadActiva">
                <span class="chip-content">📍 Cercanos (Distancia)</span>
              </label>
              <span v-if="!proximidadActiva" style="font-size: 0.75rem; color: #9ca3af; font-style: italic; margin-top: 2px;">
                (Activa "Cerca de mí" para ordenar)
              </span>
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
      <p v-if="!isCalendarVisible && loading" class="txt-loading">Cargando proyectos...</p>
      <p v-else-if="!isCalendarVisible && paginatedProyectos.length === 0" class="txt-loading">No se encontraron resultados.</p>
      
      <div 
        v-else-if="!isCalendarVisible" 
        class="card-grid-container" 
        id="contenedor-tarjetas"
      >
        
        <div 
          v-for="(p, index) in paginatedProyectos" 
          :key="p.id" 
          class="card-wrapper"
        >
          <div v-if="p.actor_nombre" class="actor-badge" :title="`Publicado por: ${p.actor_nombre}`">
            <i class="fa-solid fa-user-pen"></i>
            <span>{{ p.actor_nombre }}</span>
          </div>
          <article 
            class="card" 
            :class="[getNivelClass(p.categoria), 'delay-' + ((index % 4) * 100)]"
            v-reveal="'scale'"
            @click="router.push(`/${p.tipo}s/${p.id}`)"
            style="cursor: pointer;"
          >
            <div class="card-image">
              <img :src="p.imagen" :alt="p.nombre" onerror="this.src='/assets/img/logo-app.webp'">
              <span v-if="p.tipo === 'lugar'" class="place-event-badge">
                <i class="fa-solid fa-calendar-star"></i> {{ p.conteo_eventos || 0 }}
              </span>
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
              <!-- Metadata row below image -->
              <div class="card-meta-row">
                <span class="card-meta-category">
                  <span class="category-icon-bg">{{ getCategoryIcon(p.categoria) }}</span>
                  {{ formatCategory(p.categoria) }}
                </span>
                <span v-if="p.distancia_calculada && p.distancia_calculada !== Infinity" class="card-meta-dist">
                  <i class="fa-solid fa-route"></i> a {{ p.distancia_calculada.toFixed(1) }} km
                </span>
              </div>

              <div class="card-header" style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 20px; margin-bottom: 4px;">
                <span v-if="p.tipo === 'evento' && p.modalidad === 'en_linea'" class="status-badge" style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9; font-size: 0.65rem; border: 1px solid rgba(14, 165, 233, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                  🖥️ En Línea
                </span>
                <span v-else-if="p.tipo === 'evento' && p.tiene_sesion_online" class="status-badge" style="background: rgba(139, 92, 246, 0.15); color: #c084fc; font-size: 0.65rem; border: 1px solid rgba(139, 92, 246, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                  🔄 Híbrido
                </span>
              </div>
              <h3 class="card-title" style="margin-bottom:2px; font-size: 1rem; line-height: 1.25;">{{ p.nombre }}</h3>
              <span v-if="formatearFechaSubtext(p.fecha)" class="card-date-sub" style="color:#5bc2f7; font-size:0.75rem; display:block; margin-top:4px; font-weight:600;">
                <i class="fa-regular fa-calendar" style="margin-right:4px;"></i>{{ formatearFechaSubtext(p.fecha) }}
              </span>
            </div>
          </article>
        </div>
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
          aria-label="Anterior"
        >
          <i class="fa-solid fa-chevron-left"></i> <span class="pagination-arrow-text">Anterior</span>
        </button>

        <template v-for="(page, idx) in visiblePageNumbers" :key="idx">
          <span v-if="page === '...'" class="pagination-dots">...</span>
          <button 
            v-else
            class="pagination-btn" 
            :class="{ 'active': Number(page) === currentPage }"
            @click="cambiarPagina(Number(page))"
          >
            {{ page }}
          </button>
        </template>

        <button 
          class="pagination-btn pagination-arrow" 
          :class="{ 'disabled': currentPage === totalPaginas }"
          @click="currentPage < totalPaginas && cambiarPagina(currentPage + 1)"
          aria-label="Siguiente"
        >
          <span class="pagination-arrow-text">Siguiente</span> <i class="fa-solid fa-chevron-right"></i>
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
          <div class="calendar-nav" style="display: flex; gap: 10px;">
            <button class="calendar-nav-btn" @click="changeMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
            <button class="calendar-nav-btn" @click="changeMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>

        <!-- Alertas e información de filtros del calendario -->
        <div class="calendar-info-alerts" style="margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px;">
          <div v-if="hasActiveFilters" class="calendar-alert-banner" style="background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.3); color: #38bdf8; padding: 10px 16px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-sliders"></i>
              <span>🔍 Filtros de búsqueda activos</span>
            </div>
            <button @click="resetFiltros" style="background: rgba(14, 165, 233, 0.2); border: 1px solid rgba(14, 165, 233, 0.4); color: #38bdf8; padding: 4px 12px; border-radius: 20px; cursor: pointer; font-size: 0.8rem; font-weight: 700; transition: all 0.3s; border: none;">
              Limpiar filtros
            </button>
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
              v-if="dayObj.day && dayObj.events.length >= 1" 
              :src="dayObj.events[0].imagen" 
              class="event-image-bg"
            >
            <span v-if="dayObj.day && dayObj.events.length > 1" class="event-count-badge">
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

        <div v-if="authStore.user" class="map-header-actions" style="position: relative; z-index: 1; padding: 15px; display: flex; justify-content: center; margin-bottom: 10px;">
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
              <p v-if="authStore.user" class="panel-meta" style="font-size: 12px;">
                <i class="fa-solid fa-location-dot"></i> <span>{{ selectedProjectDetail.ubicacion }}</span>
              </p>
              <p v-else class="panel-meta" style="font-size: 12px; color: rgba(255,255,255,0.4); font-style: italic;">
                <i class="fa-solid fa-lock"></i> Inicia sesión para ver la ubicación
              </p>
              <p v-if="selectedProjectDetail.fecha" class="panel-meta" style="font-size: 12px; margin-top: 4px;">
                <i class="fa-regular fa-calendar"></i> <span>{{ new Date(selectedProjectDetail.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) }}</span>
              </p>
              <p v-if="selectedProjectDetail.actor_nombre" class="panel-meta" style="font-size: 12px; margin-top: 4px; color: var(--color-eco); font-weight: 600;">
                <i class="fa-solid fa-circle-user"></i> <span>Publicado por: {{ selectedProjectDetail.actor_nombre }}</span>
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
              <div class="nearby-card-img" style="position:relative; width: 100%; height: 100px; overflow: hidden; border-radius: 12px;">
                <!-- Actor badge at top left -->
                <span v-if="p.actor_nombre" class="nearby-card-actor-badge" style="position: absolute; top: 6px; left: 6px; background: rgba(15,20,25,0.85); color: var(--color-eco); font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(114,176,77,0.3); z-index: 2; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <i class="fa-solid fa-circle-user"></i> {{ p.actor_nombre }}
                </span>
                <!-- Date badge at top right -->
                <span v-if="p.fecha" class="nearby-card-date-badge" style="position: absolute; top: 6px; right: 6px; background: rgba(15,20,25,0.85); color: #0ea5e9; font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(14,165,233,0.3); z-index: 2;">
                  <i class="fa-regular fa-calendar"></i> {{ formatFechaShort(p.fecha) }}
                </span>
                <img :src="p.imagen" :alt="p.nombre" onerror="this.src='/assets/img/logo-app.webp'" style="width: 100%; height: 100%; object-fit: cover;">
              </div>
              <div class="nearby-card-info" style="padding: 8px 0 0 0;">
                <div class="nearby-card-title" style="font-weight:700; line-height:1.1; font-size: 0.85rem; color: white;">{{ p.nombre }}</div>
                <div v-if="authStore.user && p.distancia_calculada && p.distancia_calculada !== Infinity" class="nearby-card-dist" style="color:#fde047; font-size:0.75rem; font-weight:700; margin-top:2px;">
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
          <img :src="ev.imagen" :alt="ev.nombre" onerror="this.src='/assets/img/logo-app.webp'">
          <div class="sheet-event-content">
            <h4>{{ ev.nombre }}</h4>
            <p><i class="fa-solid fa-location-dot"></i> {{ ev.ubicacion }}</p>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 6px;">
              <span class="event-category-badge" style="margin-top: 0;">{{ formatCategory(ev.categoria) }}</span>
              <span v-if="userCoords && ((ev.coordenadas && ev.coordenadas.lat && ev.coordenadas.lng) || (ev.lat && ev.lng))" class="event-dist-badge" style="color: #fde047; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-route"></i> a {{ calcularDistancia(userCoords.lat, userCoords.lng, (ev.coordenadas?.lat || ev.lat), (ev.coordenadas?.lng || ev.lng)).toFixed(1) }} km
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECCIÓN COLIBRÍ -->
    <section id="seccion-colibri" class="nivel-section" v-reveal>
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
          <RouterLink to="/eco-tecnologia" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">🔌 Eco-tecnología</span>
            <p class="nivel-btn-desc">Innovaciones y desarrollos tecnológicos ambientales.</p>
          </RouterLink>
        </div>
        <button @click="scrollToTop" class="btn-back-to-top">
          <i class="fa-solid fa-arrow-up"></i> Ir al Buscador
        </button>
      </div>
    </section>

    <!-- SECCIÓN AJOLOTE -->
    <section id="seccion-ajolote" class="nivel-section" v-reveal>
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
            <span class="nivel-btn-title">🤝 Ayuda</span>
            <p class="nivel-btn-desc">Eventos y jornadas cerca de ti.</p>
          </RouterLink>
          <RouterLink to="/causas" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">💝 Causas / Rifas</span>
            <p class="nivel-btn-desc">Apoya causas locales y solidarias.</p>
          </RouterLink>
          <RouterLink to="/lugares" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">🌿 Lugares</span>
            <p class="nivel-btn-desc">Lugares sustentables para visitar.</p>
          </RouterLink>
          <RouterLink to="/super-eventos" class="nivel-btn-item glass-effect">
            <span class="nivel-btn-title">🏆 Eventos Especiales</span>
            <p class="nivel-btn-desc">Festivales y macro eventos colectivos.</p>
          </RouterLink>
        </div>
        <button @click="scrollToTop" class="btn-back-to-top">
          <i class="fa-solid fa-arrow-up"></i> Ir al Buscador
        </button>
      </div>
    </section>

    <!-- SECCIÓN LOBO -->
    <section id="seccion-lobo" class="nivel-section" v-reveal>
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

.card-wrapper {
  position: relative;
  padding-top: 25px;
  display: flex;
  flex-direction: column;
  height: 100%;
  margin-top: 12px;
}
.actor-badge {
  position: absolute !important;
  top: 25px !important;
  left: 50% !important;
  transform: translate(-50%, -90%) !important;
  z-index: 10 !important;
}
.card {
  overflow: visible !important;
}
.card-image {
  border-top-left-radius: 19px !important;
  border-top-right-radius: 19px !important;
  overflow: hidden !important;
}
.card-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.card-meta-category {
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
.card-meta-dist {
  font-size: 0.75rem;
  font-weight: 700;
  color: #fde047;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

@media (max-width: 480px) {
  #contenedor-tarjetas {
    row-gap: 36px !important;
    column-gap: 12px !important;
  }
}

@media (max-width: 350px) {
  #contenedor-tarjetas {
    row-gap: 36px !important;
    column-gap: 10px !important;
  }
  .card-wrapper {
    padding-top: 18px !important;
    margin-top: 10px !important;
  }
  .card {
    min-height: 290px !important;
    border-radius: 12px !important;
    overflow: visible !important;
  }
  .card-image {
    height: 85px !important;
    border-top-left-radius: 11px !important;
    border-top-right-radius: 11px !important;
  }
  .actor-badge {
    top: 18px !important;
    padding: 2px 6px !important;
    font-size: 0.58rem !important;
    border-width: 1.5px !important;
  }
  .actor-badge i {
    font-size: 0.55rem !important;
  }
  .card-content {
    padding: 8px 6px !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: flex-start !important;
    gap: 4px !important;
  }
  .card-meta-row {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 2px !important;
    margin-bottom: 4px !important;
  }
  .card-meta-category {
    font-size: 0.65rem !important;
  }
  .card-meta-dist {
    font-size: 0.65rem !important;
  }
  .card-title {
    font-size: 0.78rem !important;
    line-height: 1.2 !important;
    margin-bottom: 4px !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  .card-date-sub {
    font-size: 0.65rem !important;
    margin-top: 2px !important;
  }
}
</style>
