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


// Map references
let map: maplibregl.Map | null = null
let currentMarkers: maplibregl.Marker[] = []
let userMarker: maplibregl.Marker | null = null
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
    if (matched.centroid?.coordinates) {
      map.flyTo({ center: matched.centroid.coordinates, zoom: 11 })
      highlightTerritory(matched.id, matched.name)
    } else if (matched.id) {
      // Lazy fetch geometry if missing centroid
      try {
        const geoData = await TerritoryService.getGeometry(matched.id)
        if (geoData?.geometry?.coordinates?.[0]?.[0]) {
          const coords = geoData.geometry.coordinates[0][0]
          if (Array.isArray(coords) && coords.length >= 2) {
            map.flyTo({ center: coords as [number, number], zoom: 11 })
          }
        }
      } catch (err) {
        console.warn('Sin geometría de municipio, haciendo zoom de fallback.')
        if (stateObj?.centroid?.coordinates) map.flyTo({ center: stateObj.centroid.coordinates, zoom: 10 })
      }
      highlightTerritory(matched.id, matched.name)
    }
  }

  applyFilters()
})

// Highlight territory from local GEOJSON or Supabase
let mexicoGeoJSON: any = null
const highlightTerritory = async (territoryId: string | null, territoryName: string | null = null) => {
  if (!map || !map.getSource('selected-territory')) return

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
        const normalizedName = territoryName.toLowerCase().trim()
        const feature = mexicoGeoJSON.features.find((f: any) => {
          const propName = (f.properties.name || f.properties.nomgeo || '').toLowerCase()
          return propName === normalizedName || normalizedName.includes(propName) || propName.includes(normalizedName)
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

// Fetch markers within visible bounding box
const fetchMarkersInBounds = async (minLng: number, minLat: number, maxLng: number, maxLat: number) => {
  try {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

    const [lugaresRes, eventosRes] = await Promise.all([
      supabase.from('lugares')
        .select('id, nombre, lat, lng, categoria, imagen_url, ubicacion')
        .eq('estado', 'approved')
        .gte('lat', minLat)
        .lte('lat', maxLat)
        .gte('lng', minLng)
        .lte('lng', maxLng),
      supabase.from('eventos')
        .select('id, nombre, lat, lng, categoria, imagen_url, ubicacion, fecha_inicio, fecha_fin')
        .eq('estado', 'approved')
        .gte('fecha_fin', startOfMonth)
        .gte('lat', minLat)
        .lte('lat', maxLat)
        .gte('lng', minLng)
        .lte('lng', maxLng)
    ])

    const places = (lugaresRes.data || []).map(l => ({ ...l, tipo: 'lugar', lat: Number(l.lat), lng: Number(l.lng) }))
    const events = (eventosRes.data || []).map(e => ({ ...e, tipo: 'evento', lat: Number(e.lat), lng: Number(e.lng) }))

    allItems.value = [...places, ...events]
    applyFilters()
  } catch (err) {
    console.error('Error al cargar marcadores en coordenadas:', err)
  }
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
      result = result.filter(item => {
        // Simple heuristic: match against state codes or coordinates
        return true // Fallback
      })
      // If we select a region, query database or fallback
      try {
        const spatialData = await TerritoryService.fetchEventsByRegion(selectedRegion.value)
        if (spatialData && spatialData.length > 0) {
          result = spatialData.map((d: any) => ({ ...d, lat: Number(d.lat), lng: Number(d.lng) }))
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
          result = spatialData.map((d: any) => ({ ...d, lat: Number(d.lat), lng: Number(d.lng) }))
        }
      } catch (_) {}
    }
  } else if (selectedEstado.value) {
    const matchedState = estadosList.value.find(e => e.code === selectedEstado.value)
    if (matchedState?.id) {
      try {
        const spatialData = await TerritoryService.fetchEventsByTerritory(matchedState.id)
        if (spatialData && spatialData.length > 0) {
          result = spatialData.map((d: any) => ({ ...d, lat: Number(d.lat), lng: Number(d.lng) }))
        }
      } catch (_) {}
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
    if (isNaN(p.lat) || isNaN(p.lng)) return

    const found = clusters.find(c => {
      const dLat = Math.abs(c.lat - p.lat)
      const dLng = Math.abs(c.lng - p.lng)
      return dLat < THRESHOLD && dLng < THRESHOLD
    })

    if (found) {
      found.items.push(p)
    } else {
      clusters.push({ lat: p.lat, lng: p.lng, items: [p] })
    }
  })

  // Render elements
  clusters.forEach(c => {
    const firstItem = c.items[0]
    const count = c.items.length
    const el = document.createElement('div')

    if (count > 1) {
      el.className = `map-cluster-marker type-${firstItem.tipo}`
      el.innerHTML = `
        <img src="${firstItem.imagen_url || '/assets/img/ajolote.webp'}" alt="${firstItem.nombre}" onerror="this.src='/assets/img/ajolote.webp'">
        <div class="cluster-count-badge">${count > 9 ? '9+' : count}</div>
      `
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
      el.innerHTML = `
        <div class="marker-card-pulse"></div>
        <img src="${firstItem.imagen_url || '/assets/img/ajolote.webp'}" alt="${firstItem.nombre}" onerror="this.src='/assets/img/ajolote.webp'">
      `
      el.onclick = () => openDetail(firstItem)
    }

    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
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
    return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
  } catch (_) {
    return ''
  }
}

// Init maplibre
onMounted(async () => {
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

  // Auto locate user
  setTimeout(() => locateUser(), 1200)
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
              placeholder="Buscar iniciativas ecológicas..." 
            />
          </div>
        </div>

        <div class="territory-filters">
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
            <p v-if="userCoords" class="map-event-dist">
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
          <p class="panel-meta">
            <i class="fa-solid fa-location-dot"></i> {{ activeItem.ubicacion || 'Ubicación registrada' }}
          </p>
        </div>
        <div class="panel-footer">
          <RouterLink :to="`/${activeItem.tipo}s/${activeItem.id}`" class="btn-full">
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
  min-width: 150px;
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
  color: #72b04d !important;
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


/* --- DETALLE DE EVENTO (SIDE PANEL) --- */
.map-side-panel {
  position: absolute;
  top: 95px;
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
  left: 6px;
  background: rgba(15,20,25,0.85);
  color: #0ea5e9;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid rgba(14,165,233,0.3);
  z-index: 2;
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
    top: 180px;
    right: 15px;
  }

  .filter-panel-drawer {
    width: calc(100vw - 30px);
    left: 15px;
    top: 70px;
    box-sizing: border-box;
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
</style>
