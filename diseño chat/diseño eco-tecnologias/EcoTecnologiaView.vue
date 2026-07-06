<script setup lang="ts">
import { ref, computed } from 'vue'

// ── Types ──────────────────────────────────────────────────────────────────
type TechCategory = 'Todos' | 'Inteligencia Artificial' | 'Hardware/IoT' | 'Software Verde' | 'Energías Limpias'
type ResourceType = 'Todos' | 'Sitios Web' | 'Videos' | 'Repositorios' | 'Artículos'

interface EcoTechProject {
  id: string
  title: string
  description: string
  developer: string
  stack: string
  cover_image?: string
  category: Exclude<TechCategory, 'Todos'>
  resource_type: Exclude<ResourceType, 'Todos'>
  url: string
}

// ── Mock Data ──────────────────────────────────────────────────────────────
const projects = ref<EcoTechProject[]>([
  {
    id: '1',
    title: 'EcoSense AI — Monitoreo de Calidad del Aire',
    description: 'Modelo de visión por computadora que detecta partículas contaminantes en tiempo real usando cámaras urbanas de bajo costo.',
    developer: 'Laura Gómez',
    stack: 'Python · TensorFlow',
    cover_image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
    category: 'Inteligencia Artificial',
    resource_type: 'Repositorios',
    url: 'https://github.com',
  },
  {
    id: '2',
    title: 'Sensor de Humedad IoT para Reforestación',
    description: 'Dispositivo open-source basado en ESP32 que monitorea humedad del suelo y envía alertas de riego a brigadas forestales.',
    developer: 'Comunidad Maker MX',
    stack: 'ESP32 · MQTT',
    cover_image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
    category: 'Hardware/IoT',
    resource_type: 'Artículos',
    url: 'https://example.com',
  },
  {
    id: '3',
    title: 'GreenCode: Buenas Prácticas de Software Eficiente',
    description: 'Guía y librería para medir el consumo energético de tus aplicaciones y reducir la huella de carbono del código.',
    developer: 'Carlos Beltrán',
    stack: 'JavaScript · Node.js',
    category: 'Software Verde',
    resource_type: 'Repositorios',
    url: 'https://github.com',
  },
  {
    id: '4',
    title: 'Microrredes Solares Comunitarias',
    description: 'Documental técnico sobre la implementación de microrredes solares en comunidades rurales de Oaxaca.',
    developer: 'Canal EnergíaViva',
    stack: 'Paneles Solares · Baterías LiFePO4',
    cover_image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&q=80',
    category: 'Energías Limpias',
    resource_type: 'Videos',
    url: 'https://youtube.com',
  },
  {
    id: '5',
    title: 'Chatbot de Educación Ambiental con NLP',
    description: 'Asistente conversacional entrenado para responder dudas sobre reciclaje, fauna local y normativa ambiental mexicana.',
    developer: 'Equipo NLP-Verde',
    stack: 'Python · spaCy · FastAPI',
    category: 'Inteligencia Artificial',
    resource_type: 'Sitios Web',
    url: 'https://example.com',
  },
  {
    id: '6',
    title: 'Estación Meteorológica de Bajo Costo',
    description: 'Tutorial paso a paso para construir tu propia estación meteorológica con Arduino y sensores ambientales.',
    developer: 'Ana Torres',
    stack: 'Arduino · DHT22',
    cover_image: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=600&q=80',
    category: 'Hardware/IoT',
    resource_type: 'Videos',
    url: 'https://youtube.com',
  },
  {
    id: '7',
    title: 'Calculadora de Huella de Carbono Web',
    description: 'Herramienta gratuita y open-source para que ONGs calculen su huella de carbono anual con reportes exportables.',
    developer: 'OpenClimate Labs',
    stack: 'Vue 3 · Chart.js',
    category: 'Software Verde',
    resource_type: 'Repositorios',
    url: 'https://github.com',
  },
  {
    id: '8',
    title: 'Guía: Energía Eólica a Pequeña Escala',
    description: 'Artículo técnico sobre el diseño e instalación de microturbinas eólicas para hogares rurales.',
    developer: 'Revista EcoTech LATAM',
    stack: 'Turbinas · Inversores',
    cover_image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=600&q=80',
    category: 'Energías Limpias',
    resource_type: 'Artículos',
    url: 'https://example.com',
  },
])

// ── State ──────────────────────────────────────────────────────────────────
const searchQuery     = ref('')
const activeCategory  = ref<TechCategory>('Todos')
const activeResource  = ref<ResourceType>('Todos')

const categories: TechCategory[] = ['Todos', 'Inteligencia Artificial', 'Hardware/IoT', 'Software Verde', 'Energías Limpias']
const resourceTypes: ResourceType[] = ['Todos', 'Sitios Web', 'Videos', 'Repositorios', 'Artículos']

// ── Computed ───────────────────────────────────────────────────────────────
const filteredProjects = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return projects.value.filter(p => {
    const matchesQuery = !q ||
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.developer.toLowerCase().includes(q)
    const matchesCategory = activeCategory.value === 'Todos' || p.category === activeCategory.value
    const matchesResource = activeResource.value === 'Todos' || p.resource_type === activeResource.value
    return matchesQuery && matchesCategory && matchesResource
  })
})

// ── Helpers ────────────────────────────────────────────────────────────────
function categoryAccent(cat: string): string {
  const map: Record<string, string> = {
    'Inteligencia Artificial': '#eab308',
    'Hardware/IoT': '#72B04D',
    'Software Verde': '#72B04D',
    'Energías Limpias': '#ca8a04',
  }
  return map[cat] ?? '#72B04D'
}

function resourceIcon(type: string): string {
  const map: Record<string, string> = {
    'Sitios Web': 'globe',
    'Videos': 'video',
    'Repositorios': 'github',
    'Artículos': 'file-text',
  }
  return map[type] ?? 'globe'
}

function ctaLabel(type: string): string {
  const map: Record<string, string> = {
    'Sitios Web': 'Visitar Sitio',
    'Videos': 'Ver Video',
    'Repositorios': 'Acceder al Proyecto',
    'Artículos': 'Leer Artículo',
  }
  return map[type] ?? 'Acceder al Proyecto'
}

function fallbackGradient(id: string): string {
  // Deterministic pseudo-random gradient per project for visual variety
  const seed = id.charCodeAt(0) % 3
  const gradients = [
    'linear-gradient(135deg, rgba(114,176,77,0.35), rgba(10,14,18,0.9))',
    'linear-gradient(135deg, rgba(234,179,8,0.3), rgba(10,14,18,0.9))',
    'linear-gradient(135deg, rgba(0,119,182,0.3), rgba(10,14,18,0.9))',
  ]
  return gradients[seed]
}

function setCategory(cat: TechCategory) { activeCategory.value = cat }
function setResource(type: ResourceType) { activeResource.value = type }
function clearFilters() { searchQuery.value = ''; activeCategory.value = 'Todos'; activeResource.value = 'Todos' }
</script>

<template>
  <section class="ecotech">

    <!-- Header -->
    <header class="ecotech__header">
      <div class="header__badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
        Nivel Colibrí · Divulgación y Aprendizaje
      </div>
      <h1 class="header__title">Eco-tecnología</h1>
      <p class="header__subtitle">
        Explora proyectos, herramientas y recursos tecnológicos creados por la comunidad para impulsar soluciones ambientales.
      </p>
    </header>

    <!-- Search -->
    <div class="search-bar">
      <svg class="search-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        class="search-bar__input"
        placeholder="Buscar por título, descripción o desarrollador…"
      />
      <button v-if="searchQuery" class="search-bar__clear" @click="searchQuery = ''" aria-label="Limpiar búsqueda">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-row">
        <span class="filter-row__label">Categoría</span>
        <div class="pills">
          <button
            v-for="cat in categories"
            :key="cat"
            class="pill"
            :class="{ 'pill--active': activeCategory === cat, 'pill--gold': activeCategory === cat && cat !== 'Todos' }"
            @click="setCategory(cat)"
          >{{ cat }}</button>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-row__label">Tipo de recurso</span>
        <div class="pills">
          <button
            v-for="type in resourceTypes"
            :key="type"
            class="pill"
            :class="{ 'pill--active': activeResource === type, 'pill--green': activeResource === type && type !== 'Todos' }"
            @click="setResource(type)"
          >{{ type }}</button>
        </div>
      </div>
    </div>

    <!-- Results count -->
    <div class="results-bar">
      <span class="results-bar__count">
        {{ filteredProjects.length }} {{ filteredProjects.length === 1 ? 'recurso encontrado' : 'recursos encontrados' }}
      </span>
      <button
        v-if="searchQuery || activeCategory !== 'Todos' || activeResource !== 'Todos'"
        class="results-bar__clear"
        @click="clearFilters"
      >Limpiar filtros</button>
    </div>

    <!-- Grid -->
    <TransitionGroup name="card" tag="div" class="grid">
      <article
        v-for="p in filteredProjects"
        :key="p.id"
        class="card"
        :style="{ '--accent': categoryAccent(p.category) }"
      >
        <!-- Cover -->
        <div class="card__cover" :style="!p.cover_image ? { background: fallbackGradient(p.id) } : {}">
          <img v-if="p.cover_image" :src="p.cover_image" :alt="p.title" class="card__cover-img" loading="lazy" />
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" class="card__cover-fallback-icon" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
          <span class="card__badge" :style="{ background: `${categoryAccent(p.category)}22`, borderColor: `${categoryAccent(p.category)}55`, color: categoryAccent(p.category) }">
            {{ p.category }}
          </span>
        </div>

        <!-- Body -->
        <div class="card__body">
          <h3 class="card__title">{{ p.title }}</h3>

          <div class="card__meta">
            <span class="chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {{ p.developer }}
            </span>
            <span class="chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              {{ p.stack }}
            </span>
          </div>

          <p class="card__desc">{{ p.description }}</p>

          <a :href="p.url" target="_blank" rel="noopener noreferrer" class="card__cta" :style="{ '--accent': categoryAccent(p.category) }">
            <!-- Resource icon -->
            <svg v-if="resourceIcon(p.resource_type) === 'github'" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.41-5.27 5.69.42.36.78 1.08.78 2.18 0 1.57-.02 2.84-.02 3.23 0 .3.21.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/>
            </svg>
            <svg v-else-if="resourceIcon(p.resource_type) === 'video'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            <svg v-else-if="resourceIcon(p.resource_type) === 'file-text'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            {{ ctaLabel(p.resource_type) }}
            <svg class="card__cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
        </div>
      </article>
    </TransitionGroup>

    <!-- Empty state -->
    <div v-if="filteredProjects.length === 0" class="empty-state">
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="30" stroke="rgba(234,179,8,0.2)" stroke-width="2"/>
        <circle cx="11" cy="11" r="8" stroke="rgba(255,255,255,0.2)" stroke-width="2" transform="translate(16,16)"/>
        <line x1="38" y1="38" x2="46" y2="46" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
      </svg>
      <p class="empty-state__title">No encontramos resultados</p>
      <p class="empty-state__hint">Intenta con otros términos de búsqueda o ajusta los filtros activos.</p>
      <button class="empty-state__reset" @click="clearFilters">Limpiar filtros</button>
    </div>
  </section>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Roboto:wght@400;500&display=swap');

.ecotech {
  --bg:       #0a0e12;
  --gold:     #eab308;
  --gold-dk:  #ca8a04;
  --eco:      #72B04D;
  --glass:    rgba(255, 255, 255, 0.03);
  --gbord:    1px solid rgba(255, 255, 255, 0.1);
  --tr:       all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --ft:       'Outfit', sans-serif;
  --fb:       'Roboto', sans-serif;

  background: var(--bg);
  min-height: 100vh;
  padding: 48px 32px 80px;
  font-family: var(--fb);
  color: rgba(255,255,255,0.9);
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.ecotech__header { max-width: 760px; margin: 0 auto 36px; text-align: center; }
.header__badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3);
  color: var(--gold); font-family: var(--ft); font-size: 12.5px; font-weight: 600;
  padding: 6px 16px; border-radius: 30px; margin-bottom: 18px;
  box-shadow: 0 0 18px rgba(234,179,8,0.12);
}
.header__badge svg { width: 14px; height: 14px; }
.header__title {
  font-family: var(--ft); font-size: 40px; font-weight: 800;
  background: linear-gradient(135deg, var(--gold), var(--eco));
  -webkit-background-clip: text; background-clip: text; color: transparent;
  margin: 0 0 12px; letter-spacing: -0.02em;
}
.header__subtitle { font-family: var(--fb); font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.5); margin: 0; }

/* ── Search ─────────────────────────────────────────────────────────────── */
.search-bar {
  max-width: 640px; margin: 0 auto 28px; position: relative;
  display: flex; align-items: center;
}
.search-bar__icon {
  position: absolute; left: 20px; width: 19px; height: 19px;
  color: rgba(255,255,255,0.35); pointer-events: none;
}
.search-bar__input {
  width: 100%; background: var(--glass); border: var(--gbord);
  backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
  border-radius: 30px; padding: 15px 48px; color: rgba(255,255,255,0.92);
  font-family: var(--fb); font-size: 14.5px; outline: none; transition: var(--tr);
}
.search-bar__input::placeholder { color: rgba(255,255,255,0.32); }
.search-bar__input:focus {
  border-color: rgba(234,179,8,0.4);
  box-shadow: 0 0 0 3px rgba(234,179,8,0.08), 0 0 24px rgba(234,179,8,0.1);
}
.search-bar__clear {
  position: absolute; right: 16px; width: 26px; height: 26px; border-radius: 50%;
  background: rgba(255,255,255,0.06); border: none; color: rgba(255,255,255,0.5);
  display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--tr);
}
.search-bar__clear:hover { background: rgba(255,255,255,0.12); color: #fff; }
.search-bar__clear svg { width: 13px; height: 13px; }

/* ── Filters ────────────────────────────────────────────────────────────── */
.filters { max-width: 1100px; margin: 0 auto 18px; display: flex; flex-direction: column; gap: 16px; }
.filter-row { display: flex; flex-direction: column; gap: 9px; }
.filter-row__label {
  font-family: var(--ft); font-size: 11.5px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.35);
  padding-left: 4px;
}
.pills { display: flex; flex-wrap: wrap; gap: 9px; }

.pill {
  font-family: var(--ft); font-size: 13px; font-weight: 500;
  padding: 9px 18px; border-radius: 30px;
  background: var(--glass); border: var(--gbord); color: rgba(255,255,255,0.6);
  cursor: pointer; transition: var(--tr); white-space: nowrap;
  backdrop-filter: blur(12px);
}
.pill:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.9); border-color: rgba(255,255,255,0.18); }

.pill--active {
  color: #0a0e12; font-weight: 600;
  border-color: transparent;
}
.pill--active:not(.pill--gold):not(.pill--green) {
  background: rgba(255,255,255,0.85);
}
.pill--gold {
  background: linear-gradient(135deg, var(--gold), var(--gold-dk));
  box-shadow: 0 0 18px rgba(234,179,8,0.35);
}
.pill--green {
  background: linear-gradient(135deg, var(--eco), #5c9140);
  box-shadow: 0 0 18px rgba(114,176,77,0.35);
}

/* ── Results bar ────────────────────────────────────────────────────────── */
.results-bar {
  max-width: 1100px; margin: 0 auto 22px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px;
}
.results-bar__count { font-family: var(--fb); font-size: 13px; color: rgba(255,255,255,0.4); }
.results-bar__clear {
  font-family: var(--ft); font-size: 12.5px; font-weight: 600; color: var(--gold);
  background: none; border: none; cursor: pointer; transition: var(--tr);
}
.results-bar__clear:hover { color: #f3ce4a; text-decoration: underline; }

/* ── Grid ───────────────────────────────────────────────────────────────── */
.grid {
  max-width: 1100px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 22px;
}

.card-move,
.card-enter-active,
.card-leave-active { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.card-enter-from { opacity: 0; transform: translateY(16px) scale(0.96); }
.card-leave-to { opacity: 0; transform: translateY(-10px) scale(0.96); }
.card-leave-active { position: absolute; }

/* ── Card ───────────────────────────────────────────────────────────────── */
.card {
  background: var(--glass); border: var(--gbord);
  backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
  border-radius: 20px; overflow: hidden;
  display: flex; flex-direction: column;
  transition: var(--tr);
  box-shadow: 0 4px 24px rgba(0,0,0,0.3);
}
.card:hover {
  transform: translateY(-5px);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  box-shadow: 0 14px 36px rgba(0,0,0,0.45), 0 0 28px color-mix(in srgb, var(--accent) 25%, transparent);
}

/* Cover */
.card__cover {
  position: relative; width: 100%; height: 168px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.02);
}
.card__cover-img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  transition: var(--tr);
}
.card:hover .card__cover-img { transform: scale(1.06); }
.card__cover-fallback-icon { width: 48px; height: 48px; color: rgba(255,255,255,0.18); }

.card__badge {
  position: absolute; top: 12px; left: 12px;
  font-family: var(--ft); font-size: 10.5px; font-weight: 600;
  padding: 4px 11px; border-radius: 20px; border: 1px solid;
  backdrop-filter: blur(8px);
}

/* Body */
.card__body { padding: 18px 18px 20px; display: flex; flex-direction: column; gap: 12px; flex: 1; }
.card__title {
  font-family: var(--ft); font-size: 16px; font-weight: 600; line-height: 1.35;
  color: rgba(255,255,255,0.95); margin: 0;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.card__meta { display: flex; flex-wrap: wrap; gap: 7px; }
.chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--fb); font-size: 11px; color: rgba(255,255,255,0.55);
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  padding: 4px 10px; border-radius: 20px;
}
.chip svg { width: 11px; height: 11px; flex-shrink: 0; opacity: 0.7; }

.card__desc {
  font-family: var(--fb); font-size: 12.5px; line-height: 1.55;
  color: rgba(255,255,255,0.45); margin: 0; flex: 1;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}

.card__cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  margin-top: 4px; padding: 11px 20px; border-radius: 30px;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent); font-family: var(--ft); font-size: 13px; font-weight: 600;
  text-decoration: none; cursor: pointer; transition: var(--tr);
}
.card__cta svg:first-child { width: 15px; height: 15px; flex-shrink: 0; }
.card__cta-arrow { width: 14px; height: 14px; flex-shrink: 0; transition: var(--tr); margin-left: -2px; }
.card__cta:hover {
  background: color-mix(in srgb, var(--accent) 28%, transparent);
  box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 30%, transparent);
}
.card__cta:hover .card__cta-arrow { transform: translateX(3px); }

/* ── Empty state ────────────────────────────────────────────────────────── */
.empty-state {
  max-width: 1100px; margin: 60px auto 0;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  text-align: center; padding: 40px 20px;
}
.empty-state svg { width: 64px; height: 64px; }
.empty-state__title { font-family: var(--ft); font-size: 17px; font-weight: 600; color: rgba(255,255,255,0.7); margin: 0; }
.empty-state__hint { font-family: var(--fb); font-size: 13px; color: rgba(255,255,255,0.35); margin: 0; max-width: 360px; }
.empty-state__reset {
  margin-top: 6px; font-family: var(--ft); font-size: 13px; font-weight: 600;
  padding: 10px 24px; border-radius: 30px;
  background: linear-gradient(135deg, var(--gold), var(--eco)); color: #0a0e12;
  border: none; cursor: pointer; transition: var(--tr);
}
.empty-state__reset:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(234,179,8,0.3); }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .ecotech { padding: 32px 16px 60px; }
  .header__title { font-size: 30px; }
  .grid { grid-template-columns: 1fr; }
}
</style>
