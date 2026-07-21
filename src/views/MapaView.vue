<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { supabase } from '../services/supabase.service'
import { TerritoryService, type Territory } from '../services/territory.service'

const router = useRouter()

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

const getItemDetailPath = (item: any) => {
  if (!item) return ''
  return item.tipo === 'lugar' ? `/lugares/${item.id}` : `/eventos/${item.id}`
}


// Map references
let map: maplibregl.Map | null = null
let currentMarkers: maplibregl.Marker[] = []
let userMarker: maplibregl.Marker | null = null
let municipalityMarker: maplibregl.Marker | null = null
const defaultLocation: [number, number] = [-102.5528, 23.6345] // Center of Mexico [lng, lat]

// Reactive state
const isFilterPanelOpen = ref(false)
const isDetailPanelOpen = ref(false)
const filterText = ref('')
const selectedEstado = ref('')
const selectedMunicipio = ref('')
const selectedRegion = ref('')
const isLocating = ref(false)

const estadosList = ref<Territory[]>([])
const municipiosList = ref<Territory[]>([])

const allItems = ref<any[]>([])
const filteredItems = ref<any[]>([])
const activeItem = ref<any | null>(null)
const userCoords = ref<{ lat: number; lng: number } | null>(null)
const isLoggedIn = ref(false)

// Advanced search state
const isAdvancedSearchOpen = ref(false)
const searchType = ref<'todos' | 'evento' | 'lugar'>('todos')
const filterCategory = ref('')
const filterFree = ref(false)
const filterPetFriendly = ref(false)
const filterKidsFriendly = ref(false)
const eventsInActivePlace = ref<any[]>([])
const profilesMap = ref<Record<string, any>>({})

// Carousel scrolling ref
const carouselRef = ref<HTMLElement | null>(null)

// Load states
const loadTerritoryData = async () => {
  try {
    estadosList.value = await TerritoryService.getStates()
  } catch (e) {
    console.error('Error al cargar estados:', e)
  }
}

watch(selectedEstado, async (newVal) => {
  selectedMunicipio.value = ''
  municipiosList.value = []
  
  if (!newVal) {
    if (map) map.flyTo({ center: defaultLocation, zoom: 5 })
    highlightTerritory(null)
    applyFilters()
    return
  }

  // Load municipalities lazy
  try {
    municipiosList.value = await TerritoryService.getMunicipalities(newVal)
  } catch (e) {
    console.error('Error al cargar municipios:', e)
  }

  // Centering map
  const matched = estadosList.value.find(e => e.code === newVal)
  if (matched && matched.centroid?.coordinates && map) {
    map.flyTo({ center: matched.centroid.coordinates, zoom: 7 })
    highlightTerritory(matched.id, matched.name)
  } else {
    highlightTerritory(null)
  }

  applyFilters()
})

watch(selectedMunicipio, async (newVal) => {
  if (municipalityMarker) {
    municipalityMarker.remove()
    municipalityMarker = null
  }

  if (!newVal) {
    // Fallback to state center
    if (selectedEstado.value) {
      const stateObj = estadosList.value.find(e => e.code === selectedEstado.value)
      if (stateObj && stateObj.centroid?.coordinates && map) {
        map.flyTo({ center: stateObj.centroid.coordinates, zoom: 7 })
        highlightTerritory(stateObj.id, stateObj.name)
      }
    } else {
      highlightTerritory(null)
    }
    applyFilters()
    return
  }

  const stateObj = estadosList.value.find(e => e.code === selectedEstado.value)
  const matched = municipiosList.value.find(m => m.code === newVal)
  
  if (matched && map) {
    let coords: [number, number] | null = null
    if (matched.centroid?.coordinates) {
      coords = matched.centroid.coordinates
    } else if (matched.id) {
      // Lazy fetch geometry if missing centroid
      try {
        const geoData = await TerritoryService.getGeometry(matched.id)
        if (geoData?.geometry?.coordinates?.[0]?.[0]) {
          const firstCoord = geoData.geometry.coordinates[0][0]
          if (Array.isArray(firstCoord) && firstCoord.length >= 2) {
            coords = firstCoord as [number, number]
          }
        }
      } catch (err) {
        console.warn('Sin geometría de municipio, haciendo zoom de fallback.')
      }
    }

    if (coords) {
      map.flyTo({ center: coords, zoom: 11 })
      
      // Create custom glowing marker
      const el = document.createElement('div')
      el.className = 'municipality-highlight-marker'
      el.innerHTML = '<div class="pulse-ring"></div><div class="dot"></div>'
      
      municipalityMarker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map)
      
      highlightTerritory(null) // clear state polygon
    } else {
      if (stateObj?.centroid?.coordinates) map.flyTo({ center: stateObj.centroid.coordinates, zoom: 10 })
    }
  }

  applyFilters()
})

watch(activeItem, async (newItem) => {
  eventsInActivePlace.value = []
  if (newItem && newItem.tipo === 'lugar') {
    try {
      const today = new Date()
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
      
      const { data, error } = await supabase
        .from('eventos')
        .select('id, nombre, fecha_inicio, categoria, imagen_url')
        .eq('lugar_id', newItem.id)
        .eq('estado', 'approved')
        .gte('fecha_fin', startOfMonth)
        .order('fecha_inicio', { ascending: true })
        
      if (!error && data) {
        eventsInActivePlace.value = data
      }
    } catch (e) {
      console.error('Error fetching events for place:', e)
    }
  }
})

const selectEventFromPlace = (ev: any) => {
  activeItem.value = {
    ...ev,
    tipo: 'evento',
    lat: activeItem.value.lat,
    lng: activeItem.value.lng
  }
}

watch([isAdvancedSearchOpen, searchType, filterCategory, filterFree, filterPetFriendly, filterKidsFriendly], () => {
  applyFilters()
})

// Highlight territory from local GEOJSON or Supabase
let mexicoGeoJSON: any = null
const highlightTerritory = async (territoryId: string | null, territoryName: string | null = null) => {
  if (!map || !map.getSource('selected-territory')) return

  if (municipalityMarker) {
    municipalityMarker.remove()
    municipalityMarker = null
  }

  if (!territoryName && !territoryId) {
    ;(map.getSource('selected-territory') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: []
    })
    return
  }

  try {
    // 1. Try local GeoJSON first (super fast)
    if (territoryName) {
      if (!mexicoGeoJSON) {
        const res = await fetch('/assets/data/mexico-estados.geojson')
        if (res.ok) {
          mexicoGeoJSON = await res.json()
        }
      }

      if (mexicoGeoJSON?.features) {
        const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
        const normalizedName = normalizeStr(territoryName)
        const feature = mexicoGeoJSON.features.find((f: any) => {
          const propName = normalizeStr(f.properties.name || f.properties.nomgeo || '')
          if (propName === normalizedName) return true
          if (normalizedName === 'ciudad de mexico' && propName === 'distrito federal') return true
          if (normalizedName === 'ciudad de mexico' && propName === 'df') return true
          if (normalizedName === 'estado de mexico' && propName === 'mexico') return true
          if (normalizedName === 'mexico' && propName === 'mexico') return true
          return false
        })

        if (feature) {
          ;(map.getSource('selected-territory') as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: [feature]
          })
          return
        }
      }
    }

    // 2. Database Fallback
    if (territoryId) {
      const data = await TerritoryService.getGeometry(territoryId)
      if (data) {
        ;(map.getSource('selected-territory') as maplibregl.GeoJSONSource).setData(data)
        return
      }
    }

    // Reset if not found
    ;(map.getSource('selected-territory') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: []
    })
  } catch (err) {
    console.warn('Geometría no disponible para resaltar:', err)
  }
}

// Fetch profiles for actors that published events/places
const fetchActorsForItems = async (items: any[]) => {
  const actorIds = [...new Set(items.map(item => item.owner_id).filter(Boolean))]
  if (actorIds.length === 0) return
  
  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, avatar_url')
      .in('id', actorIds)
    if (!error && data) {
      const newMap = { ...profilesMap.value }
      data.forEach(p => {
        newMap[p.id] = p
      })
      profilesMap.value = newMap
    }
  } catch (err) {
    console.error('Error fetching actors:', err)
  }
}

// Fetch markers within visible bounding box with debounce and sequence control
let bboxTimer: ReturnType<typeof setTimeout> | null = null
let bboxReqId = 0

const fetchMarkersInBounds = (minLng: number, minLat: number, maxLng: number, maxLat: number) => {
  const currentReq = ++bboxReqId
  if (bboxTimer) clearTimeout(bboxTimer)

  bboxTimer = setTimeout(async () => {
    try {
      const today = new Date()
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

      const [lugaresRes, eventosRes] = await Promise.all([
        supabase.from('lugares')
          .select('id, nombre, lat, lng, categoria, imagen_url, ubicacion, owner_id')
          .eq('estado', 'approved')
          .gte('lat', minLat)
          .lte('lat', maxLat)
          .gte('lng', minLng)
          .lte('lng', maxLng),
        supabase.from('eventos')
          .select('id, nombre, lat, lng, categoria, imagen_url, ubicacion, fecha_inicio, fecha_fin, es_gratuito, pet_friendly, apto_ninos, lugar_id, owner_id')
          .eq('estado', 'approved')
          .gte('fecha_fin', startOfMonth)
          .gte('lat', minLat)
          .lte('lat', maxLat)
          .gte('lng', minLng)
          .lte('lng', maxLng)
      ])

      // Ignore out of order / stale requests
      if (currentReq !== bboxReqId) return

      const places = (lugaresRes.data || []).map(l => ({ ...l, tipo: 'lugar', lat: Number(l.lat), lng: Number(l.lng) }))
      const events = (eventosRes.data || []).map(e => ({ ...e, tipo: 'evento', lat: Number(e.lat), lng: Number(e.lng) }))

      allItems.value = [...places, ...events]
      await fetchActorsForItems(allItems.value)
      if (currentReq === bboxReqId) {
        applyFilters()
      }
    } catch (err) {
      console.error('Error al cargar marcadores en coordenadas:', err)
    }
  }, 250)
}

// Filter items locally or spatially
const applyFilters = async () => {
  let result = [...allItems.value]

  // Text Filter
  if (filterText.value) {
    const q = filterText.value.toLowerCase()
    result = result.filter(item => 
      item.nombre.toLowerCase().includes(q) ||
      (item.categoria && item.categoria.toLowerCase().includes(q)) ||
      (item.ubicacion && item.ubicacion.toLowerCase().includes(q))
    )
  }

  // Region Filter
  if (selectedRegion.value) {
    const regionObj = TerritoryService.getRegions().find(r => r.id === selectedRegion.value)
    if (regionObj) {
      try {
        const spatialData = await TerritoryService.fetchEventsByRegion(selectedRegion.value)
        if (spatialData && spatialData.length > 0) {
          const eventIds = spatialData.filter((d: any) => d.tipo === 'evento').map((d: any) => d.id)
          const placeIds = spatialData.filter((d: any) => d.tipo === 'lugar').map((d: any) => d.id)
          
          const [fullEvents, fullPlaces] = await Promise.all([
            eventIds.length > 0 ? supabase.from('eventos').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion, fecha_inicio, fecha_fin, es_gratuito, pet_friendly, apto_ninos, lugar_id, owner_id').in('id', eventIds).eq('estado', 'approved') : Promise.resolve({ data: [] }),
            placeIds.length > 0 ? supabase.from('lugares').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion, owner_id').in('id', placeIds).eq('estado', 'approved') : Promise.resolve({ data: [] })
          ])
          
          result = [
            ...(fullPlaces.data || []).map(l => ({ ...l, tipo: 'lugar', lat: Number(l.lat), lng: Number(l.lng) })),
            ...(fullEvents.data || []).map(e => ({ ...e, tipo: 'evento', lat: Number(e.lat), lng: Number(e.lng) }))
          ]
        }
      } catch (_) {}
    }
  }

  // State/Municipality spatial filter
  if (selectedMunicipio.value) {
    const matchedMun = municipiosList.value.find(m => m.code === selectedMunicipio.value)
    if (matchedMun?.id) {
      try {
        const spatialData = await TerritoryService.fetchEventsByTerritory(matchedMun.id)
        if (spatialData && spatialData.length > 0) {
          const eventIds = spatialData.filter((d: any) => d.tipo === 'evento').map((d: any) => d.id)
          const placeIds = spatialData.filter((d: any) => d.tipo === 'lugar').map((d: any) => d.id)
          
          const [fullEvents, fullPlaces] = await Promise.all([
            eventIds.length > 0 ? supabase.from('eventos').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion, fecha_inicio, fecha_fin, es_gratuito, pet_friendly, apto_ninos, lugar_id, owner_id').in('id', eventIds).eq('estado', 'approved') : Promise.resolve({ data: [] }),
            placeIds.length > 0 ? supabase.from('lugares').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion, owner_id').in('id', placeIds).eq('estado', 'approved') : Promise.resolve({ data: [] })
          ])
          
          result = [
            ...(fullPlaces.data || []).map(l => ({ ...l, tipo: 'lugar', lat: Number(l.lat), lng: Number(l.lng) })),
            ...(fullEvents.data || []).map(e => ({ ...e, tipo: 'evento', lat: Number(e.lat), lng: Number(e.lng) }))
          ]
        }
      } catch (_) {}
    }
  } else if (selectedEstado.value) {
    const matchedState = estadosList.value.find(e => e.code === selectedEstado.value)
    if (matchedState?.id) {
      try {
        const spatialData = await TerritoryService.fetchEventsByTerritory(matchedState.id)
        if (spatialData && spatialData.length > 0) {
          const eventIds = spatialData.filter((d: any) => d.tipo === 'evento').map((d: any) => d.id)
          const placeIds = spatialData.filter((d: any) => d.tipo === 'lugar').map((d: any) => d.id)
          
          const [fullEvents, fullPlaces] = await Promise.all([
            eventIds.length > 0 ? supabase.from('eventos').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion, fecha_inicio, fecha_fin, es_gratuito, pet_friendly, apto_ninos, lugar_id, owner_id').in('id', eventIds).eq('estado', 'approved') : Promise.resolve({ data: [] }),
            placeIds.length > 0 ? supabase.from('lugares').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion, owner_id').in('id', placeIds).eq('estado', 'approved') : Promise.resolve({ data: [] })
          ])
          
          result = [
            ...(fullPlaces.data || []).map(l => ({ ...l, tipo: 'lugar', lat: Number(l.lat), lng: Number(l.lng) })),
            ...(fullEvents.data || []).map(e => ({ ...e, tipo: 'evento', lat: Number(e.lat), lng: Number(e.lng) }))
          ]
        }
      } catch (_) {}
    }
  }

  if (selectedRegion.value || selectedMunicipio.value || selectedEstado.value) {
    await fetchActorsForItems(result)
  }

  // 1. Filter events from current month onwards
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  result = result.filter(item => {
    if (item.tipo !== 'evento') return true
    if (!item.fecha_fin && !item.fecha_inicio) return false
    const dateToCompare = item.fecha_fin ? new Date(item.fecha_fin) : new Date(item.fecha_inicio)
    return dateToCompare >= startOfMonth
  })

  // 2. Advanced Search Filters
  // Filter by type
  if (searchType.value !== 'todos') {
    result = result.filter(item => item.tipo === searchType.value)
  }

  // Filter by category
  if (filterCategory.value) {
    result = result.filter(item => item.categoria && item.categoria.toLowerCase() === filterCategory.value.toLowerCase())
  }

  // Filter specific event attributes
  if (searchType.value === 'evento' || searchType.value === 'todos') {
    if (filterFree.value) {
      result = result.filter(item => item.es_gratuito === true)
    }
    if (filterPetFriendly.value) {
      result = result.filter(item => item.pet_friendly === true)
    }
    if (filterKidsFriendly.value) {
      result = result.filter(item => item.apto_ninos === true)
    }
  }

  filteredItems.value = result
  refreshMarkers()
}

// Watch filters
watch(filterText, () => applyFilters())

// Render Markers with Clustering
const refreshMarkers = () => {
  // Clear previous markers
  currentMarkers.forEach(m => m.remove())
  currentMarkers = []

  if (!map) return
  const activeMap = map

  const zoom = map.getZoom()
  const THRESHOLD = zoom > 10 ? 0.0005 : 0.005
  const clusters: Array<{ lat: number; lng: number; items: any[] }> = []

  // Clustering logic
  filteredItems.value.forEach(p => {
    const latNum = Number(p.lat)
    const lngNum = Number(p.lng)
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return

    const found = clusters.find(c => {
      const dLat = Math.abs(c.lat - latNum)
      const dLng = Math.abs(c.lng - lngNum)
      return dLat < THRESHOLD && dLng < THRESHOLD
    })

    if (found) {
      const total = found.items.length + 1
      found.lat = (found.lat * (total - 1) + latNum) / total
      found.lng = (found.lng * (total - 1) + lngNum) / total
      found.items.push(p)
    } else {
      clusters.push({ lat: latNum, lng: lngNum, items: [p] })
    }
  })

  // Render elements
  clusters.forEach(c => {
    const firstItem = c.items[0]
    const count = c.items.length
    const el = document.createElement('div')

    if (count > 1) {
      el.className = `map-cluster-marker type-${firstItem.tipo}`
      const img = document.createElement('img')
      img.src = firstItem.imagen_url || '/assets/img/ajolote.webp'
      img.alt = firstItem.nombre || 'Item'
      img.onerror = () => { img.src = '/assets/img/ajolote.webp' }

      const badge = document.createElement('div')
      badge.className = 'cluster-count-badge'
      badge.textContent = count > 9 ? '9+' : String(count)

      el.appendChild(img)
      el.appendChild(badge)

      el.onclick = () => {
        if (!map) return
        const z = map.getZoom()
        if (z < 16) {
          map.flyTo({ center: [c.lng, c.lat], zoom: z + 2 })
        } else {
          filteredItems.value = c.items
          refreshMarkers()
        }
      }
    } else {
      el.className = `map-card-marker type-${firstItem.tipo}`

      const pulse = document.createElement('div')
      pulse.className = 'marker-card-pulse'

      const img = document.createElement('img')
      img.src = firstItem.imagen_url || '/assets/img/ajolote.webp'
      img.alt = firstItem.nombre || 'Item'
      img.onerror = () => { img.src = '/assets/img/ajolote.webp' }

      el.appendChild(pulse)
      el.appendChild(img)

      el.onclick = () => openDetail(firstItem)
    }

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([c.lng, c.lat])
      .addTo(activeMap)
    
    currentMarkers.push(marker)
  })
}

// Open Detail panel
const openDetail = (item: any) => {
  activeItem.value = item
  isDetailPanelOpen.value = true

  if (map && !isNaN(item.lng) && !isNaN(item.lat)) {
    map.flyTo({ center: [item.lng, item.lat], zoom: 15, essential: true })
  }

  // Scroll carousel to selected card
  nextTick(() => {
    if (carouselRef.value) {
      const activeCard = carouselRef.value.querySelector(`[data-id="${item.id}"]`)
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  })
}

// Locate User
const locateUser = () => {
  if (!navigator.geolocation) {
    alert('Geolocalización no soportada en este navegador.')
    return
  }

  isLocating.value = true
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords
      const pos: [number, number] = [longitude, latitude]
      userCoords.value = { lat: latitude, lng: longitude }

      if (map) {
        map.flyTo({ center: pos, zoom: 13, speed: 1.5 })

        if (userMarker) {
          userMarker.setLngLat(pos)
        } else {
          userMarker = new maplibregl.Marker({ color: '#0ea5e9', scale: 0.9 })
            .setLngLat(pos)
            .addTo(map)
        }
      }

      // State detection
      const detected = await TerritoryService.detectStateFromCoords(latitude, longitude)
      if (detected) {
        selectedEstado.value = detected.code
      }

      isLocating.value = false
    },
    (err) => {
      console.warn(err)
      alert('No se pudo obtener tu ubicación actual.')
      isLocating.value = false
    }
  )
}

// Clear all filters
const clearFilters = () => {
  filterText.value = ''
  selectedEstado.value = ''
  selectedMunicipio.value = ''
  selectedRegion.value = ''
  filteredItems.value = [...allItems.value]
  highlightTerritory(null)
  if (map) map.flyTo({ center: defaultLocation, zoom: 5 })
  applyFilters()
}

// Toggle regions
const selectRegion = (regionId: string) => {
  selectedRegion.value = selectedRegion.value === regionId ? '' : regionId
  selectedEstado.value = ''
  applyFilters()
}

// Carousel controls
const scrollCarousel = (direction: 'left' | 'right') => {
  if (!carouselRef.value) return
  const amt = window.innerWidth <= 768 ? 155 : 310
  carouselRef.value.scrollBy({
    left: direction === 'left' ? -amt : amt,
    behavior: 'smooth'
  })
}

// Haversine distance
const getDistanceText = (item: any) => {
  if (!userCoords.value || isNaN(item.lat) || isNaN(item.lng)) return ''
  
  const R = 6371 // Earth radius in km
  const dLat = (item.lat - userCoords.value.lat) * Math.PI / 180
  const dLon = (item.lng - userCoords.value.lng) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(userCoords.value.lat * Math.PI / 180) * Math.cos(item.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = R * c
  
  return `A ${d.toFixed(1)} km`
}

const formatDateBadge = (dateStr: string) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const datePart = d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
    const timePart = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
    return `${datePart}, ${timePart}`
  } catch (_) {
    return ''
  }
}

// Init maplibre
onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  isLoggedIn.value = !!session

  supabase.auth.onAuthStateChange((_event, session) => {
    isLoggedIn.value = !!session
  })

  await loadTerritoryData()

  map = new maplibregl.Map({
    container: 'map-viewport',
    style: {
      version: 8,
      sources: {
        'carto-tiles': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
        }
      },
      layers: [
        {
          id: 'carto-layer',
          type: 'raster',
          source: 'carto-tiles',
          minzoom: 0,
          maxzoom: 20
        }
      ]
    },
    center: defaultLocation,
    zoom: 5
  })

  map.on('load', () => {
    if (!map) return

    // Reseller sources
    map.addSource('selected-territory', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    })

    // Fill paint
    map.addLayer({
      id: 'selected-territory-fill',
      type: 'fill',
      source: 'selected-territory',
      paint: {
        'fill-color': '#72b04d',
        'fill-opacity': 0.15
      }
    })

    // Stroke paint
    map.addLayer({
      id: 'selected-territory-line',
      type: 'line',
      source: 'selected-territory',
      paint: {
        'line-color': '#72b04d',
        'line-width': 3,
        'line-blur': 1
      }
    })

    const triggerBBoxLoad = () => {
      if (!map) return
      const bounds = map.getBounds()
      fetchMarkersInBounds(bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth())
    }

    map.on('moveend', triggerBBoxLoad)
    triggerBBoxLoad()
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-right')

  // Auto locate user if logged in
  if (isLoggedIn.value) {
    setTimeout(() => locateUser(), 1200)
  }
})

onUnmounted(() => {
  currentMarkers.forEach(m => m.remove())
  currentMarkers = []
  userMarker?.remove()
  userMarker = null
  map?.remove()
  map = null
})
</script>

<template>
  <div class="map-view-body">
    <!-- ATLAS HEADER -->
    <div class="atlas-title">
      <h1>ATLAS TERRITORIAL</h1>
      <p>EcoGuía SOS | México</p>
    </div>

    <!-- MAP OVERLAYS -->
    <div class="map-overlay">
      <div class="map-overlay-container">
        <div class="map-overlay-top-row">
          <RouterLink to="/" class="map-btn" title="Volver al inicio">
            <i class="fa-solid fa-arrow-left"></i>
          </RouterLink>

          <div class="search-bar">
            <i class="fa-solid fa-magnifying-glass" style="color: rgba(255,255,255,0.4);"></i>
            <input 
              type="text" 
              v-model="filterText" 
              placeholder="Buscar iniciativas..." 
              style="width: 100%;"
            />
            <button 
              class="advanced-search-toggle" 
              :class="{ 'active': isAdvancedSearchOpen }"
              @click="isAdvancedSearchOpen = !isAdvancedSearchOpen"
              title="Búsqueda Avanzada"
              style="background:none; border:none; color:rgba(255,255,255,0.6); cursor:pointer; font-size:1.1rem; padding: 0 8px; display:flex; align-items:center;"
            >
              <i class="fa-solid fa-sliders"></i>
            </button>
          </div>
        </div>
        <!-- BÚSQUEDA AVANZADA PANEL -->
        <div v-if="isAdvancedSearchOpen" class="advanced-search-panel glass-effect">
          <!-- Tabs: Todos vs Lugares vs Eventos -->
          <div class="adv-tabs" style="display: flex; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 8px;">
            <button 
              class="adv-tab-btn" 
              :class="{ 'active': searchType === 'todos' }"
              @click="searchType = 'todos'"
              style="flex: 1; padding: 8px 10px; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; transition: all 0.2s; font-size: 0.8rem;"
            >
              <i class="fa-solid fa-list" style="margin-right: 4px;"></i> Todos
            </button>
            <button 
              class="adv-tab-btn" 
              :class="{ 'active': searchType === 'evento' }"
              @click="searchType = 'evento'"
              style="flex: 1; padding: 8px 10px; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; transition: all 0.2s; font-size: 0.8rem;"
            >
              <i class="fa-solid fa-calendar-days" style="margin-right: 4px;"></i> Eventos
            </button>
            <button 
              class="adv-tab-btn" 
              :class="{ 'active': searchType === 'lugar' }"
              @click="searchType = 'lugar'"
              style="flex: 1; padding: 8px 10px; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; transition: all 0.2s; font-size: 0.8rem;"
            >
              <i class="fa-solid fa-location-dot" style="margin-right: 4px;"></i> Lugares
            </button>
          </div>

          <!-- Filters Form -->
          <div class="adv-filters-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <!-- Category Filter -->
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label style="color: rgba(255,255,255,0.7); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Categoría</label>
              <select v-model="filterCategory" class="custom-select adv-select" style="width: 100%; background: rgba(10,15,20,0.6); border: 1px solid rgba(114, 176, 77, 0.25); color: white; padding: 8px 12px; border-radius: 8px; outline: none; font-size: 0.85rem; transition: border-color 0.20s;">
                <option value="" style="background:#0b0f14; color:#ffffff;">✨ Todas las categorías</option>
                <template v-if="searchType === 'evento'">
                  <option value="taller" style="background:#0b0f14; color:#0ea5e9;">🛠️ Taller</option>
                  <option value="voluntariado" style="background:#0b0f14; color:#0ea5e9;">🤝 Voluntariado</option>
                  <option value="conferencia" style="background:#0b0f14; color:#0ea5e9;">🎤 Conferencia / Charla</option>
                  <option value="limpieza" style="background:#0b0f14; color:#0ea5e9;">🧹 Limpieza de Áreas</option>
                  <option value="reforestacion" style="background:#0b0f14; color:#0ea5e9;">🌳 Reforestación</option>
                  <option value="otro" style="background:#0b0f14; color:#0ea5e9;">✨ Otro</option>
                </template>
                <template v-else-if="searchType === 'lugar'">
                  <option value="sede" style="background:#0b0f14; color:#72b04d;">🏢 Sede de Eventos</option>
                  <option value="reciclaje" style="background:#0b0f14; color:#72b04d;">♻️ Centro de Reciclaje</option>
                  <option value="asociacion" style="background:#0b0f14; color:#72b04d;">🌿 Asociación / ONG</option>
                  <option value="granel" style="background:#0b0f14; color:#72b04d;">🛍️ Tienda a Granel</option>
                  <option value="restaurante" style="background:#0b0f14; color:#72b04d;">🥗 Restaurante Vegano</option>
                  <option value="huerto" style="background:#0b0f14; color:#72b04d;">🚜 Huerto de Cultivo</option>
                  <option value="ecoturismo" style="background:#0b0f14; color:#72b04d;">🏔️ Ecoturismo / Natural</option>
                </template>
                <template v-else>
                  <!-- All Categories Combined -->
                  <optgroup label="📅 Eventos" style="background:#0b0f14; color:#0ea5e9;">
                    <option value="taller" style="background:#0b0f14; color:#0ea5e9;">🛠️ Taller</option>
                    <option value="voluntariado" style="background:#0b0f14; color:#0ea5e9;">🤝 Voluntariado</option>
                    <option value="conferencia" style="background:#0b0f14; color:#0ea5e9;">🎤 Conferencia / Charla</option>
                    <option value="limpieza" style="background:#0b0f14; color:#0ea5e9;">🧹 Limpieza de Áreas</option>
                    <option value="reforestacion" style="background:#0b0f14; color:#0ea5e9;">🌳 Reforestación</option>
                    <option value="otro" style="background:#0b0f14; color:#0ea5e9;">✨ Otro</option>
                  </optgroup>
                  <optgroup label="📍 Lugares" style="background:#0b0f14; color:#72b04d;">
                    <option value="sede" style="background:#0b0f14; color:#72b04d;">🏢 Sede de Eventos</option>
                    <option value="reciclaje" style="background:#0b0f14; color:#72b04d;">♻️ Centro de Reciclaje</option>
                    <option value="asociacion" style="background:#0b0f14; color:#72b04d;">🌿 Asociación / ONG</option>
                    <option value="granel" style="background:#0b0f14; color:#72b04d;">🛍️ Tienda a Granel</option>
                    <option value="restaurante" style="background:#0b0f14; color:#72b04d;">🥗 Restaurante Vegano</option>
                    <option value="huerto" style="background:#0b0f14; color:#72b04d;">🚜 Huerto de Cultivo</option>
                    <option value="ecoturismo" style="background:#0b0f14; color:#72b04d;">🏔️ Ecoturismo / Natural</option>
                  </optgroup>
                </template>
              </select>
            </div>

            <!-- Specific Event filters: Free/Paid, Pet Friendly, Kids Friendly -->
            <div v-if="searchType === 'evento'" style="display: flex; flex-wrap: wrap; gap: 10px; align-content: center; padding-top: 20px;">
              <label class="adv-checkbox-label">
                <input type="checkbox" v-model="filterFree" class="adv-checkbox" /> Gratis
              </label>
              <label class="adv-checkbox-label">
                <input type="checkbox" v-model="filterPetFriendly" class="adv-checkbox" /> Pet Friendly
              </label>
              <label class="adv-checkbox-label">
                <input type="checkbox" v-model="filterKidsFriendly" class="adv-checkbox" /> Apto Niños
              </label>
            </div>
          </div>
        </div>

        <div class="territory-filters" :class="{ 'adv-search-open': isAdvancedSearchOpen }">
          <select v-model="selectedEstado" class="custom-select">
            <option value="">Todo México</option>
            <option v-for="est in estadosList" :key="est.code" :value="est.code">
              {{ est.name }}
            </option>
          </select>
          <select 
            v-model="selectedMunicipio" 
            class="custom-select" 
            :disabled="!selectedEstado || municipiosList.length === 0"
          >
            <option value="">Municipio / Delegación</option>
            <option v-for="mun in municipiosList" :key="mun.code" :value="mun.code">
              {{ mun.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- RIGHT ACTION CONTROLS -->
    <div class="map-right-controls">
      <button 
        v-if="isLoggedIn"
        class="map-btn" 
        :class="{ 'active': isLocating }" 
        @click="locateUser" 
        title="Mi ubicación"
      >
        <i class="fa-solid fa-location-crosshairs"></i>
      </button>
      <button 
        class="map-btn" 
        :class="{ 'active': isFilterPanelOpen }" 
        @click="isFilterPanelOpen = true" 
        title="Filtrar por región"
      >
        <i class="fa-solid fa-layer-group"></i>
      </button>
      <button 
        v-if="selectedEstado || selectedMunicipio || selectedRegion || filterText"
        class="map-btn reset-btn" 
        @click="clearFilters" 
        title="Limpiar filtros"
      >
        <i class="fa-solid fa-arrow-rotate-left"></i>
      </button>
    </div>

    <!-- FILTER REGIONS DRAWER -->
    <div class="filter-panel" :class="{ 'open': isFilterPanelOpen }">
      <div class="filter-panel-backdrop" @click="isFilterPanelOpen = false"></div>
      <div class="filter-panel-drawer">
        <button class="drawer-close-btn" @click="isFilterPanelOpen = false" aria-label="Cerrar panel de filtros">
          <i class="fa-solid fa-xmark"></i>
        </button>
        
        <div class="filter-section">
          <p class="filter-panel-title">🌎 Región de México</p>
          <div class="region-chips">
            <div 
              class="region-chip" 
              :class="{ 'active': selectedRegion === 'norte' }"
              @click="selectRegion('norte')"
            >Norte</div>
            <div 
              class="region-chip" 
              :class="{ 'active': selectedRegion === 'bajio' }"
              @click="selectRegion('bajio')"
            >Bajío</div>
            <div 
              class="region-chip" 
              :class="{ 'active': selectedRegion === 'centro' }"
              @click="selectRegion('centro')"
            >Centro</div>
            <div 
              class="region-chip" 
              :class="{ 'active': selectedRegion === 'sur' }"
              @click="selectRegion('sur')"
            >Sur</div>
          </div>
        </div>

        <div class="filter-section">
          <p class="filter-panel-title">📍 Estado</p>
          <select v-model="selectedEstado" class="filter-select">
            <option value="">Todo México</option>
            <option v-for="est in estadosList" :key="est.code" :value="est.code">
              {{ est.name }}
            </option>
          </select>
        </div>

        <button class="filter-clear-btn" @click="clearFilters">
          <i class="fa-solid fa-rotate-left"></i> Limpiar filtros
        </button>
      </div>
    </div>

    <!-- BOTTOM EVENT CAROUSEL TRAY -->
    <div class="carousel-wrapper">
      <button class="carousel-arrow" @click="scrollCarousel('left')">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      
      <div ref="carouselRef" class="map-events-tray">
        <div 
          v-for="item in filteredItems.slice(0, 15)" 
          :key="item.id" 
          class="map-event-card"
          :class="{ 'card--active': activeItem?.id === item.id }"
          :data-id="item.id"
          @click="openDetail(item)"
        >
          <!-- Actor badge at top left -->
          <span v-if="item.owner_id && profilesMap[item.owner_id]" class="card-actor-badge">
            <i class="fa-solid fa-circle-user"></i> {{ profilesMap[item.owner_id].nombre_completo }}
          </span>
          <!-- Date badge at top right -->
          <span v-if="item.fecha_inicio" class="card-date-badge">
            <i class="fa-regular fa-calendar"></i> {{ formatDateBadge(item.fecha_inicio) }}
          </span>
          <img 
            :src="item.imagen_url || '/assets/img/ajolote.webp'" 
            :alt="item.nombre" 
            onerror="this.src='/assets/img/ajolote.webp'" 
          />
          <div class="map-event-info">
            <h4>{{ item.nombre }}</h4>
            <p><i class="fa-solid fa-layer-group"></i> {{ formatCategory(item.categoria) }}</p>
            <p v-if="isLoggedIn && userCoords" class="map-event-dist">
              <i class="fa-solid fa-person-walking"></i> {{ getDistanceText(item) }}
            </p>
          </div>
        </div>
      </div>

      <button class="carousel-arrow" @click="scrollCarousel('right')">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>

    <!-- SLIDER SIDE DETAILS PANEL -->
    <aside class="map-side-panel" :class="{ 'hidden': !isDetailPanelOpen }">
      <button class="panel-close-btn" @click="isDetailPanelOpen = false">
        <i class="fa-solid fa-xmark"></i>
      </button>
      
      <div v-if="activeItem" class="panel-inner">
        <div class="panel-img-container">
          <img :src="activeItem.imagen_url || '/assets/img/ajolote.webp'" alt="Detalle" />
        </div>
        <div class="panel-content">
          <span class="badge" :class="activeItem.tipo">{{ activeItem.tipo?.toUpperCase() }}</span>
          <h3 style="color:white; font-size:1.3rem; margin:10px 0 5px 0; font-weight:800;">{{ activeItem.nombre }}</h3>
          <p class="panel-meta">
            <i class="fa-solid fa-layer-group"></i> {{ formatCategory(activeItem.categoria) }}
          </p>
          <p v-if="activeItem.fecha_inicio" class="panel-meta">
            <i class="fa-regular fa-calendar"></i> {{ new Date(activeItem.fecha_inicio).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) }}
          </p>
          <p v-if="isLoggedIn" class="panel-meta">
            <i class="fa-solid fa-location-dot"></i> {{ activeItem.ubicacion || 'Ubicación registrada' }}
          </p>
          <p v-else class="panel-meta" style="color: rgba(255, 255, 255, 0.4); font-size: 0.8rem; font-style: italic;">
            <i class="fa-solid fa-lock"></i> Inicia sesión para ver la ubicación exacta
          </p>
          
          <!-- Publisher Actor Info -->
          <p v-if="activeItem.owner_id && profilesMap[activeItem.owner_id]" class="panel-meta" style="margin-top: 12px; padding: 10px; background: rgba(114, 176, 77, 0.08); border: 1px solid rgba(114, 176, 77, 0.15); border-radius: 12px; display: flex; align-items: center; gap: 10px;">
            <img 
              :src="profilesMap[activeItem.owner_id].avatar_url || '/assets/img/logo-app.webp'" 
              alt="Actor avatar" 
              style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--color-eco); object-fit: cover;"
              onerror="this.src='/assets/img/logo-app.webp'"
            />
            <span style="font-size: 0.8rem; color: #ffffff;">
              Publicado por: <strong style="color: var(--color-eco);">{{ profilesMap[activeItem.owner_id].nombre_completo }}</strong>
            </span>
          </p>

          <!-- Events in this Place (Only if it's a place and has events) -->
          <div v-if="activeItem.tipo === 'lugar' && eventsInActivePlace.length > 0" class="related-events-section" style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 15px;">
            <h4 style="color:var(--color-eco); font-size:0.95rem; font-weight:700; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-calendar-days"></i> Eventos en esta ubicación
            </h4>
            <div class="related-events-list" style="display:flex; flex-direction:column; gap:8px; max-height: 200px; overflow-y: auto;">
              <div 
                v-for="ev in eventsInActivePlace" 
                :key="ev.id" 
                class="related-event-card"
                style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:8px; border-radius:8px; cursor:pointer; transition:all 0.2s;"
                @click="selectEventFromPlace(ev)"
              >
                <img 
                  :src="ev.imagen_url || '/assets/img/ajolote.webp'" 
                  alt="Evento" 
                  style="width:40px; height:40px; border-radius:6px; object-fit:cover;"
                />
                <div style="flex:1; min-width:0;">
                  <h5 style="color:white; font-size:0.85rem; font-weight:600; margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ ev.nombre }}</h5>
                  <span style="color:var(--color-texto-secundario); font-size:0.75rem;">{{ ev.fecha_inicio ? new Date(ev.fecha_inicio).toLocaleDateString() : 'Próximamente' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="panel-footer">
          <RouterLink :to="getItemDetailPath(activeItem)" class="btn-full">
            Ver todos los detalles
          </RouterLink>
        </div>
      </div>
    </aside>

    <!-- MAP CONTAINER -->
    <div id="map-viewport"></div>
  </div>
</template>

<style>
/* CSS overrides for map view compatibility */
.map-view-body {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #0b0f19;
  font-family: 'Outfit', 'Inter', sans-serif;
}
#map-viewport {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  background: #f8fafc; /* Fondo claro por si fallan las tiles */
}

/* Float UI */
.map-overlay {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  z-index: 3000 !important;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.map-overlay-container {
  display: flex;
  gap: 15px;
  width: 100%;
  align-items: center;
  flex-wrap: wrap;
}

.map-overlay-top-row {
  display: flex;
  gap: 15px;
  align-items: center;
}

.drawer-close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
  width: 35px;
  height: 35px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
}

.drawer-close-btn:hover {
  background: rgba(255,255,255,0.2);
  color: white;
  transform: scale(1.1);
}

.map-right-controls {
  position: absolute;
  top: 240px; /* Debajo de los controles de zoom de MapLibre */
  right: 20px;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.map-overlay > * {
  pointer-events: auto;
}

.search-bar {
  background: rgba(2, 6, 23, 0.8);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding: 12px 25px;
  border-radius: 50px;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 380px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.6);
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.search-bar:focus-within {
  border-color: #72b04d;
  box-shadow: 0 0 20px rgba(114, 176, 77, 0.3);
  width: 420px;
}

.search-bar input {
  background: transparent;
  border: none;
  color: #ffffff;
  flex: 1;
  outline: none;
  font-size: 1rem;
  font-weight: 500;
}

.territory-filters {
  display: flex;
  gap: 10px;
  pointer-events: auto;
  width: 380px;
}

.custom-select {
  background: rgba(2, 6, 23, 0.85);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding: 10px 20px;
  border-radius: 50px;
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  appearance: none;
  -webkit-appearance: none;
  flex: 1;
  width: 0;
  min-width: 0;
}

.custom-select:hover {
  border-color: rgba(255,255,255,0.3);
  background: rgba(15, 23, 42, 0.9);
}

.custom-select:focus {
  border-color: #72b04d;
  box-shadow: 0 0 15px rgba(114, 176, 77, 0.3);
}

.custom-select option {
  background: #0f172a;
  color: white;
}

.custom-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(1);
}

/* Carrusel Inferior de Eventos */
.map-events-tray {
  flex: 1;
  display: flex;
  gap: 15px;
  overflow-x: auto;
  scroll-behavior: smooth;
  pointer-events: auto;
  scrollbar-width: none;
  user-select: none;
  cursor: grab;
  padding: 10px 0;
}

.map-events-tray:active {
  cursor: grabbing;
}

.map-events-tray::-webkit-scrollbar {
  display: none;
}

.map-events-tray > * {
  pointer-events: auto;
}

.map-event-card {
  min-width: 280px;
  max-width: 280px;
  background: rgba(2, 6, 23, 0.8);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  display: flex;
  padding: 12px;
  gap: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  box-sizing: border-box;
  position: relative;
}

.map-event-card:hover {
  transform: translateY(-10px) scale(1.02);
  border-color: #72b04d;
  background: rgba(15, 23, 42, 0.95);
}

.map-event-card img {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  object-fit: cover;
}

.map-event-info {
  flex: 1;
  overflow: hidden;
}

.map-event-info h4 {
  margin: 0;
  color: white;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.map-event-info p {
  margin: 4px 0;
  color: rgba(255,255,255,0.6);
  font-size: 0.8rem;
}

.map-event-dist {
  color: #ffd700 !important;
  font-weight: 700;
  font-size: 0.75rem !important;
}

.map-btn {
  width: 55px;
  height: 55px;
  background: rgba(15, 23, 42, 0.85);
  -webkit-backdrop-filter: blur(15px);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 10px 25px rgba(0,0,0,0.4);
}

.map-btn:hover {
  background: #72b04d;
  transform: translateY(-5px) scale(1.1);
  box-shadow: 0 15px 30px rgba(114, 176, 77, 0.4);
  border-color: rgba(255,255,255,0.4);
}

.map-btn.active {
  background: #72b04d;
  box-shadow: 0 0 20px #72b04d;
}

.map-btn.reset-btn {
  background: #72b04d;
  color: black;
  border-color: white;
}

/* --- ATLAS HEADER (ESTILO PREMIUM) --- */
.atlas-title {
  position: absolute;
  top: 25px;
  right: 30px;
  text-align: right;
  z-index: 1000;
  pointer-events: none;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(20px);
  padding: 15px 30px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 15px 40px rgba(0,0,0,0.5), 
              inset 0 0 15px rgba(114, 176, 77, 0.1);
}

.atlas-title h1 {
  font-size: 2rem;
  font-weight: 900;
  margin: 0;
  background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 5px;
  text-transform: uppercase;
  line-height: 1;
}

.atlas-title p {
  margin: 8px 0 0 0;
  color: #72b04d;
  font-weight: 700;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 4px;
  opacity: 0.9;
  text-shadow: 0 0 10px rgba(114, 176, 77, 0.3);
}

/* Empujar controles de zoom debajo del título en pantallas de escritorio y limitar ancho del buscador para evitar colisión */
@media (min-width: 1101px) {
  .maplibregl-ctrl-top-right {
    top: 130px !important;
    right: 20px !important;
  }
  .map-overlay-container {
    max-width: calc(100% - 420px);
  }
}


.map-side-panel {
  position: absolute;
  top: 180px;
  left: 20px;
  width: 380px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  box-shadow: 0 25px 60px rgba(0,0,0,0.6);
  z-index: 1000;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.2);
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1), opacity 0.4s;
}

@media (max-width: 1100px) and (min-width: 769px) {
  .map-side-panel {
    top: 330px !important;
  }
}

.map-side-panel.hidden {
  transform: translateX(-120%);
  opacity: 0;
  pointer-events: none;
}

.panel-close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: all 0.2s;
}

.panel-close-btn:hover {
  background: rgba(255,255,255,0.2);
  transform: scale(1.1);
}

.panel-inner {
  display: flex;
  flex-direction: column;
}

.panel-img-container {
  width: 100%;
  height: 180px;
  overflow: hidden;
}

.panel-img-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.panel-content {
  padding: 20px;
}

.panel-meta {
  color: #cbd5e1;
  font-size: 0.85rem;
  margin: 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-footer {
  padding: 0 20px 20px 20px;
}

.btn-full {
  display: block;
  width: 100%;
  background: #72b04d;
  color: black;
  text-align: center;
  padding: 10px;
  border-radius: 12px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.3s;
}

.btn-full:hover {
  background: #5a933a;
  transform: translateY(-2px);
}

.badge {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.badge.lugar {
  background: rgba(231, 76, 60, 0.15);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.3);
}

.badge.evento {
  background: rgba(114, 176, 77, 0.15);
  color: #72b04d;
  border: 1px solid rgba(114, 176, 77, 0.3);
}

/* MapLibre Popup Styling */
.maplibregl-popup-content {
  background: rgba(15, 25, 35, 0.95) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  backdrop-filter: blur(12px) !important;
  color: white !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 16px !important;
  padding: 15px !important;
  box-shadow: 0 10px 40px rgba(0,0,0,0.4) !important;
}

.maplibregl-popup-tip {
  border-top-color: rgba(15, 25, 35, 0.95) !important;
}

.popup-card {
  min-width: 180px;
}

.popup-card h3 {
  margin: 0 0 5px 0;
  font-size: 1.1rem;
  color: #72b04d;
}

.popup-card p {
  font-size: 0.85rem;
  margin: 0 0 12px 0;
  color: rgba(255,255,255,0.7);
}

.popup-btn {
  background: #72b04d;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 10px;
  font-size: 0.85rem;
  width: 100%;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
}

.popup-btn:hover {
  background: #5a933a;
  transform: translateY(-2px);
}

/* === FILTER PANEL (DRAWER OVERLAY) === */
.filter-panel {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2000;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.filter-panel.open {
  pointer-events: auto;
  opacity: 1;
}

.filter-panel-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.filter-panel-drawer {
  position: absolute;
  top: 90px;
  left: 20px;
  width: 320px;
  background: rgba(2, 6, 23, 0.92);
  backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(114,176,77,0.1);
  transform: translateY(-10px);
  transition: transform 0.3s ease;
  box-sizing: border-box;
}

.filter-panel.open .filter-panel-drawer {
  transform: translateY(0);
}

.filter-panel-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 2px;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
  margin: 0 0 12px 0;
}

.filter-section {
  margin-bottom: 20px;
}

.filter-section:last-child {
  margin-bottom: 0;
}

/* Region chips */
.region-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.region-chip {
  padding: 7px 14px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.7);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.region-chip:hover {
  border-color: rgba(114,176,77,0.5);
  color: #72b04d;
}

.region-chip.active {
  background: rgba(114,176,77,0.2);
  border-color: #72b04d;
  color: #72b04d;
  box-shadow: 0 0 12px rgba(114,176,77,0.3);
}

.filter-select {
  width: 100%;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  color: white;
  padding: 10px 14px;
  font-size: 0.85rem;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  -webkit-appearance: none;
}

.filter-select:hover, .filter-select:focus {
  border-color: rgba(114,176,77,0.5);
}

.filter-select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.filter-clear-btn {
  width: 100%;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: transparent;
  color: rgba(255,255,255,0.5);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2;
  margin-top: 4px;
}

.filter-clear-btn:hover {
  background: rgba(255,255,255,0.05);
  color: white;
}

/* === CAROUSEL ARROWS === */
.carousel-wrapper {
  position: absolute;
  bottom: 20px;
  left: 0;
  width: 100%;
  padding: 0 15px;
  box-sizing: border-box;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.carousel-arrow {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(2, 6, 23, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.15);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  transition: all 0.2s ease;
  z-index: 1002;
  margin: 0 4px;
}

.carousel-arrow:hover {
  background: rgba(114,176,77,0.3);
  border-color: #72b04d;
  box-shadow: 0 0 15px rgba(114,176,77,0.4);
}

/* === CARD ACTIVE GLOW (EXTREME NEON) === */
.map-event-card.card--active {
  border: 2px solid #72b04d !important;
  box-shadow: 0 0 30px #72b04d, 0 0 60px rgba(114, 176, 77, 0.5) !important;
  transform: translateY(-12px) scale(1.05) !important;
  background: rgba(114, 176, 77, 0.25) !important;
  z-index: 9999 !important;
  animation: card-glow-pulse 1.5s infinite alternate !important;
}

@keyframes card-glow-pulse {
  from { box-shadow: 0 0 20px #72b04d, 0 0 40px rgba(114, 176, 77, 0.4); }
  to { box-shadow: 0 0 40px #72b04d, 0 0 80px rgba(114, 176, 77, 0.6), 0 0 20px #fff; }
}

/* Map specific markers */
.map-cluster-marker {
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 3px solid #72b04d;
  background: #0f172a;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  cursor: pointer;
}

.map-cluster-marker.type-lugar {
  border-color: #0077b6;
}

.map-cluster-marker img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.cluster-count-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #ef4444;
  color: white;
  font-size: 0.7rem;
  font-weight: 800;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}

.map-card-marker {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid #72b04d;
  box-shadow: 0 5px 15px rgba(0,0,0,0.4);
  cursor: pointer;
  background: #0f172a;
}

.map-card-marker.type-lugar {
  border-color: #e74c3c;
}

.map-card-marker img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.marker-card-pulse {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid #72b04d;
  opacity: 0.7;
  animation: pulse-marker 1.8s infinite;
  pointer-events: none;
}

.map-card-marker.type-lugar .marker-card-pulse {
  border-color: #e74c3c;
}

.card-date-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(15,20,25,0.85);
  color: #0ea5e9;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid rgba(14,165,233,0.3);
  z-index: 2;
}

.card-actor-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(15,20,25,0.85);
  color: var(--color-eco);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid rgba(114,176,77,0.3);
  z-index: 2;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes pulse-marker {
  0% { transform: scale(0.9); opacity: 0.9; }
  100% { transform: scale(1.4); opacity: 0; }
}

/* Mobile/Tablet specific responsive layout */
@media (max-width: 1100px) {
  .atlas-title {
    display: none;
  }

  .map-overlay {
    top: 15px;
    left: 15px;
    right: 15px;
  }

  .map-overlay-container {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .map-overlay-top-row {
    display: flex;
    gap: 10px;
    width: 100%;
  }

  .search-bar {
    width: auto !important;
    flex: 1;
    padding: 10px 18px;
  }

  .territory-filters {
    width: 100%;
    justify-content: space-between;
    gap: 8px;
  }

  .custom-select {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    font-size: 0.8rem;
  }

  .map-right-controls {
    top: auto !important;
    bottom: 180px !important;
    right: 15px;
  }

  .adv-filters-grid {
    grid-template-columns: 1fr !important;
    gap: 10px;
  }

  .adv-tabs {
    gap: 6px !important;
  }

  .filter-panel-drawer {
    width: calc(100vw - 30px);
    left: 15px;
    top: 70px;
    box-sizing: border-box;
  }

  .map-event-card {
    min-width: 140px;
    max-width: 140px;
    flex-direction: column;
    padding: 10px;
    gap: 8px;
  }

  .map-event-card img {
    width: 100%;
    height: 70px;
    border-radius: 10px;
  }

  .map-event-info h4 {
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .map-event-info p {
    font-size: 0.75rem;
    margin: 2px 0;
  }
}

.adv-tab-btn {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
.adv-tab-btn.active {
  background: var(--color-eco) !important;
  color: white !important;
  border-color: var(--color-eco) !important;
  box-shadow: 0 0 10px rgba(114, 176, 77, 0.3);
}
.advanced-search-toggle.active {
  color: var(--color-eco) !important;
}
.related-event-card:hover {
  background: rgba(255,255,255,0.08) !important;
  border-color: rgba(255,255,255,0.15) !important;
  transform: translateY(-1px);
}
.adv-select:focus {
  border-color: var(--color-eco) !important;
  box-shadow: 0 0 8px rgba(114, 176, 77, 0.2);
}
.adv-checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255,255,255,0.85);
  font-size: 0.8rem;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}
.adv-checkbox-label:hover {
  color: white;
}
.adv-checkbox {
  accent-color: var(--color-eco);
  cursor: pointer;
  width: 14px;
  height: 14px;
}

/* Municipality Glowing Highlight Marker */
.municipality-highlight-marker {
  position: relative;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.municipality-highlight-marker .dot {
  width: 10px;
  height: 10px;
  background: #72b04d;
  border-radius: 50%;
  box-shadow: 0 0 10px #72b04d, 0 0 20px #72b04d;
  z-index: 2;
}
.municipality-highlight-marker .pulse-ring {
  position: absolute;
  width: 24px;
  height: 24px;
  border: 2px solid #72b04d;
  border-radius: 50%;
  animation: mun-pulse 2s infinite ease-out;
  opacity: 0;
  z-index: 1;
}
@keyframes mun-pulse {
  0% {
    transform: scale(0.5);
    opacity: 0.8;
  }
  100% {
    transform: scale(2.8);
    opacity: 0;
  }
}

/* Custom advanced-search-panel styling & layout */
.advanced-search-panel {
  margin-bottom: 12px;
  padding: 15px;
  border-radius: 12px;
  border: 1px solid rgba(114, 176, 77, 0.25);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 0 12px rgba(114, 176, 77, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (min-width: 1280px) {
  .advanced-search-panel {
    position: absolute;
    top: 0;
    left: 490px;
    right: 480px;
    width: auto;
    margin-bottom: 0;
    z-index: 10;
  }
}

/* Position zoom controls lower to prevent overlap */
.maplibregl-ctrl-top-right {
  top: 110px !important;
  transition: top 0.3s ease;
}

@media (max-width: 768px) {
  .maplibregl-ctrl-top-right {
    top: 160px !important;
  }

  .map-side-panel {
    top: auto !important;
    bottom: 20px !important;
    left: 50% !important;
    width: calc(100vw - 30px) !important;
    max-width: 420px !important;
    transform: translateX(-50%) translateY(0) !important;
    box-sizing: border-box;
    z-index: 5000 !important;
  }

  .map-side-panel.hidden {
    transform: translateX(-50%) translateY(150%) !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
}

@media (min-width: 1280px) {
  .territory-filters.adv-search-open {
    position: absolute;
    top: 75px;
    left: 70px;
    z-index: 5;
    transition: all 0.3s ease;
  }
}
</style>
