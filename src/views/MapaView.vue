<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { supabase } from '../services/supabase.service'
import { TerritoryService, type Territory } from '../services/territory.service'

const router = useRouter()

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

// Fetch events and places data
const fetchData = async () => {
  try {
    const [lugaresRes, eventosRes] = await Promise.all([
      supabase.from('lugares').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion').eq('estado', 'approved'),
      supabase.from('eventos').select('id, nombre, lat, lng, categoria, imagen_url, ubicacion, fecha_inicio').eq('estado', 'approved')
    ])

    const places = (lugaresRes.data || []).map(l => ({ ...l, tipo: 'lugar', lat: Number(l.lat), lng: Number(l.lng) }))
    const events = (eventosRes.data || []).map(e => ({ ...e, tipo: 'evento', lat: Number(e.lat), lng: Number(e.lng) }))

    allItems.value = [...places, ...events]
    filteredItems.value = [...allItems.value]
    
    refreshMarkers()
  } catch (err) {
    console.error('Error al cargar marcadores:', err)
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

    fetchData()
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-right')

  // Auto locate user
  setTimeout(() => locateUser(), 1200)
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
            <p><i class="fa-solid fa-layer-group"></i> {{ item.categoria || 'General' }}</p>
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
            <i class="fa-solid fa-layer-group"></i> {{ activeItem.categoria || 'Sin categoría' }}
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
/* CSS scoped overrides for map view compatibility */
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
}

/* Map specific overrides */
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
@keyframes pulse-marker {
  0% { transform: scale(0.9); opacity: 0.9; }
  100% { transform: scale(1.4); opacity: 0; }
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

.map-right-controls {
  position: absolute;
  top: 130px;
  right: 20px;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.map-btn.reset-btn {
  background: #72b04d;
  color: black;
  border-color: white;
}
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

@media (max-width: 1100px) {
  .map-side-panel {
    top: auto !important;
    bottom: 120px !important;
    left: 50% !important;
    width: calc(100vw - 40px) !important;
    max-width: 420px !important;
    transform: translateX(-50%) translateY(0) !important;
  }
  .map-side-panel.hidden {
    transform: translateX(-50%) translateY(150%) !important;
  }
  .map-right-controls {
    top: 180px;
  }
}
</style>
