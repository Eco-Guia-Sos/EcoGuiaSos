<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'

const router = useRouter()
const perfiles = ref<any[]>([])
const loading = ref(true)
const errorMsg = ref('')
const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const statusFilter = ref<'todos' | 'activos' | 'inactivos'>('todos')

const toggleCategoryFilter = (categoryTheme: string) => {
  if (selectedCategory.value === categoryTheme) {
    selectedCategory.value = null
  } else {
    selectedCategory.value = categoryTheme
  }
}

const filteredAgentes = computed(() => {
  let list = perfiles.value
  
  // Filter by category
  if (selectedCategory.value) {
    list = list.filter(p => getAgenteThemeClass(p.especialidad) === selectedCategory.value)
  }

  // Filter by status (active vs inactive)
  if (statusFilter.value === 'activos') {
    list = list.filter(p => agentesActivosIds.value.has(p.id))
  } else if (statusFilter.value === 'inactivos') {
    list = list.filter(p => !agentesActivosIds.value.has(p.id))
  }

  if (!searchQuery.value) return list
  const query = searchQuery.value.toLowerCase()
  return list.filter(p => 
    (p.nombre_completo || '').toLowerCase().includes(query) ||
    (p.especialidad || '').toLowerCase().includes(query) ||
    (p.organizacion || '').toLowerCase().includes(query)
  )
})

const fetchAgentes = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('rol', 'actor')
      .order('nombre_completo')

    if (error) throw error
    perfiles.value = data || []
  } catch (err: any) {
    console.error('[Agentes] Error:', err)
    errorMsg.value = 'Error al cargar el directorio de agentes. Intente de nuevo más tarde.'
  } finally {
    loading.value = false
  }
}

const agentesActivosIds = ref<Set<string>>(new Set())

const fetchAgentesConEventos = async () => {
  try {
    const { data, error } = await supabase
      .from('eventos')
      .select('owner_id')
      .eq('estado', 'approved')

    if (!error && data) {
      const activeIds = new Set(data.map((e: any) => e.owner_id).filter(Boolean) as string[])
      agentesActivosIds.value = activeIds
    }
  } catch (e) {
    console.error('[Agentes] Error fetching active events:', e)
  }
}

const getAgenteThemeClass = (especialidad: string) => {
  const esp = (especialidad || '').toLowerCase()
  if (
    esp.includes('agua') ||
    esp.includes('lluvia') ||
    esp.includes('ecotecnia') ||
    esp.includes('energía') ||
    esp.includes('solar') ||
    esp.includes('tecnología')
  ) {
    return 'theme-blue'
  }
  if (
    esp.includes('huerto') ||
    esp.includes('permacultura') ||
    esp.includes('reforestación') ||
    esp.includes('naturaleza') ||
    esp.includes('tierra') ||
    esp.includes('ecología')
  ) {
    return 'theme-green'
  }
  if (
    esp.includes('educación') ||
    esp.includes('taller') ||
    esp.includes('comunidad') ||
    esp.includes('social') ||
    esp.includes('cultura')
  ) {
    return 'theme-purple'
  }
  return 'theme-default'
}

const getAgenteCategoryLabel = (especialidad: string) => {
  const esp = (especialidad || '').toLowerCase()
  if (
    esp.includes('agua') ||
    esp.includes('lluvia') ||
    esp.includes('ecotecnia') ||
    esp.includes('energía') ||
    esp.includes('solar') ||
    esp.includes('tecnología')
  ) {
    return '💧 Agua y Ecotecnias'
  }
  if (
    esp.includes('huerto') ||
    esp.includes('permacultura') ||
    esp.includes('reforestación') ||
    esp.includes('naturaleza') ||
    esp.includes('tierra') ||
    esp.includes('ecología')
  ) {
    return '🌿 Tierra y Permacultura'
  }
  if (
    esp.includes('educación') ||
    esp.includes('taller') ||
    esp.includes('comunidad') ||
    esp.includes('social') ||
    esp.includes('cultura')
  ) {
    return '👥 Educación y Comunidad'
  }
  return '🌐 Líder Ambiental'
}

const navigateToDetail = (id: string) => {
  router.push(`/agentes/${id}`)
}

onMounted(async () => {
  await fetchAgentes()
  await fetchAgentesConEventos()
})
</script>

<template>
  <div class="theme-ajolote">
    <header class="interior-hero">
      <div class="hero-glass-panel">
        <span class="category-badge">🦎 Ajolote</span>
        <h2>Agentes de Cambio</h2>
        <p>Conoce, apoya y colabora con las personas detrás del impacto social.</p>
      </div>
      
      <div class="subnav-scroll-wrapper fade-in">
        <nav class="level-subnav">
          <RouterLink to="/agentes" class="subnav-link active"><i class="fa-solid fa-users"></i> Agentes</RouterLink>
          <RouterLink to="/voluntariados" class="subnav-link"><i class="fa-solid fa-hands-helping"></i> Voluntariados</RouterLink>
          <RouterLink to="/convocatoria" class="subnav-link"><i class="fa-solid fa-bullhorn"></i> Convocatoria</RouterLink>
          <RouterLink to="/causas" class="subnav-link"><i class="fa-solid fa-hand-holding-heart"></i> Causas</RouterLink>
          <RouterLink to="/lugares" class="subnav-link"><i class="fa-solid fa-map-pin"></i> Lugares</RouterLink>
        </nav>
      </div>
    </header>

    <main class="content-section">
      <!-- BARRA DE BÚSQUEDA -->
      <div v-if="!loading && !errorMsg" class="search-bar-row" v-reveal style="margin-bottom: 20px;">
        <div class="search-bar-container">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Buscar agentes por nombre, especialidad u organización..." 
            autocomplete="off"
          >
        </div>
      </div>

      <!-- LEYENDA DE CATEGORÍAS -->
      <div v-if="!loading && !errorMsg" class="agentes-legend" v-reveal>
        <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap; width: 100%;">
          <span class="legend-title">Categorías de Impacto:</span>
          <div class="legend-items">
            <span 
              class="legend-item theme-default"
              :class="{ 'active': !selectedCategory, 'dimmed': selectedCategory }"
              @click="selectedCategory = null"
            >📁 Todos</span>
            <span 
              class="legend-item theme-green"
              :class="{ 'active': selectedCategory === 'theme-green', 'dimmed': selectedCategory && selectedCategory !== 'theme-green' }"
              @click="toggleCategoryFilter('theme-green')"
            >🌿 Tierra</span>
            <span 
              class="legend-item theme-blue"
              :class="{ 'active': selectedCategory === 'theme-blue', 'dimmed': selectedCategory && selectedCategory !== 'theme-blue' }"
              @click="toggleCategoryFilter('theme-blue')"
            >💧 Agua</span>
            <span 
              class="legend-item theme-purple"
              :class="{ 'active': selectedCategory === 'theme-purple', 'dimmed': selectedCategory && selectedCategory !== 'theme-purple' }"
              @click="toggleCategoryFilter('theme-purple')"
            >👥 Comunidad</span>
            <span 
              class="legend-item theme-default"
              :class="{ 'active': selectedCategory === 'theme-default', 'dimmed': selectedCategory && selectedCategory !== 'theme-default' }"
              @click="toggleCategoryFilter('theme-default')"
            >🌐 Otras Áreas</span>
          </div>
        </div>

        <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 10px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap;">
          <span class="legend-title">Filtrar por Actividad:</span>
          <div class="legend-items">
            <span 
              class="legend-item theme-default"
              :class="{ 'active': statusFilter === 'todos', 'dimmed': statusFilter !== 'todos' }"
              @click="statusFilter = 'todos'"
            >🔄 Todos</span>
            <span 
              class="legend-item theme-green"
              :class="{ 'active': statusFilter === 'activos', 'dimmed': statusFilter !== 'activos' }"
              @click="statusFilter = 'activos'"
            >🟢 Activos</span>
            <span 
              class="legend-item theme-default"
              :class="{ 'active': statusFilter === 'inactivos', 'dimmed': statusFilter !== 'inactivos' }"
              @click="statusFilter = 'inactivos'"
            >⚫ Inactivos</span>
          </div>
        </div>
      </div>

      <div v-if="loading" class="no-events">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Cargando agentes de cambio...
      </div>
      
      <div v-else-if="errorMsg" class="no-events">
        <p class="error-msg">{{ errorMsg }}</p>
      </div>

      <div v-else-if="perfiles.length === 0" class="no-events">
        <p class="empty-msg">No se encontraron agentes registrados aún.</p>
      </div>

      <div v-else-if="filteredAgentes.length === 0" class="no-events">
        <p class="empty-msg">No se encontraron agentes que coincidan con la búsqueda.</p>
      </div>

      <div v-else class="card-grid-container" id="agentes-container">
        <article 
          v-for="(perfil, index) in filteredAgentes" 
          :key="perfil.id"
          class="agente-card glass-card"
          :class="[
            'delay-' + ((index % 4) * 100),
            getAgenteThemeClass(perfil.especialidad),
            { 'agente-activo': agentesActivosIds.has(perfil.id) }
          ]"
          v-reveal
          style="cursor: pointer;"
          @click="navigateToDetail(perfil.id)"
        >
          <!-- Badge de actividad absoluto -->
          <span v-if="agentesActivosIds.has(perfil.id)" class="activo-badge">
            <span class="pulse-dot"></span> Activo
          </span>

          <img 
            :src="perfil.avatar_url || perfil.imagen_url || '/assets/img/logo-app.webp'" 
            :alt="perfil.nombre_completo || 'Agente'" 
            class="agente-img" 
            @error="($event.target as HTMLImageElement).src='/assets/img/logo-app.webp'"
          >
          <div class="agente-info">
            <h3>{{ perfil.nombre_completo || 'Agente de Cambio' }}</h3>
            <span class="agente-category-pill">
              {{ getAgenteCategoryLabel(perfil.especialidad) }}
            </span>
            <p class="agente-especialidad">{{ perfil.especialidad || 'Líder Ambiental' }}</p>
            <p class="agente-org">{{ perfil.organizacion || 'Participante' }}</p>
            <p class="agente-mini-desc">
              {{ perfil.descripcion || perfil.bio || 'Participante activo de la red EcoGuía SOS.' }}
            </p>
            <div class="agente-socials">
              <!-- Social networks links if they exist on perfil -->
              <a 
                v-if="perfil.redes_ig" 
                :href="perfil.redes_ig" 
                target="_blank" 
                @click.stop
              >
                <i class="fa-brands fa-instagram"></i>
              </a>
              <a 
                v-if="perfil.redes_fb" 
                :href="perfil.redes_fb" 
                target="_blank" 
                @click.stop
              >
                <i class="fa-brands fa-facebook"></i>
              </a>
              <span v-if="perfil.is_validated" class="verified-badge-wrapper" title="Agente Verificado por EcoGuía SOS">
                <span class="verified-badge">
                  <img src="/assets/img/logo-navbar.webp" alt="Verificado" class="verified-logo-img">
                </span>
                <span class="verified-text">eco-verificado</span>
              </span>
            </div>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<style>
@import '../assets/css/interior-pages.css';

/* Specific overrides for Agentes */
.agente-card { 
    padding: 30px 20px; 
    align-items: center; 
    text-align: center; 
    background: var(--tarjeta-bg-dark);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border: 1px solid var(--tarjeta-border-dark);
    box-shadow: var(--shadow-sh);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
}
.agente-img { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary-color); margin-bottom: 15px; }
.agente-card h3 { margin: 0 0 5px 0; color: white; font-size: 1.3rem; }
.agente-especialidad { color: var(--primary-color); font-weight: 600; font-size: 0.9rem; margin-bottom: 10px; }
.agente-org { color: #aaa; font-size: 0.85rem; margin-bottom: 5px; }
.agente-socials { margin-top: 15px; display: flex; gap: 15px; font-size: 1.2rem; justify-content: center; }
.agente-socials a { color: var(--primary-color); transition: color 0.3s ease; }
.agente-socials a:hover { color: white; }
.agente-mini-desc { font-size: 0.8rem; color: #ccc; margin: 10px 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; text-overflow: ellipsis; line-height: 1.4; }

/* Dynamic Theme Colors by Specialty */
.theme-green {
  --theme-color: #72B04D;
  border-left: 5px solid var(--theme-color) !important;
}
.theme-blue {
  --theme-color: #0077b6;
  border-left: 5px solid var(--theme-color) !important;
}
.theme-purple {
  --theme-color: #6a00a8;
  border-left: 5px solid var(--theme-color) !important;
}
.theme-default {
  --theme-color: #2a9d8f;
  border-left: 5px solid var(--theme-color) !important;
}

/* Specialty Text Highlights */
.theme-green .agente-especialidad { color: #72B04D !important; }
.theme-blue .agente-especialidad { color: #0077b6 !important; }
.theme-purple .agente-especialidad { color: #b862ff !important; }
.theme-default .agente-especialidad { color: #2a9d8f !important; }

.theme-green .agente-socials a { color: #72B04D !important; }
.theme-blue .agente-socials a { color: #0077b6 !important; }
.theme-purple .agente-socials a { color: #b862ff !important; }
.theme-default .agente-socials a { color: #2a9d8f !important; }

/* Active Glow Effect (Propuesta C) */
.agente-activo {
  border: 1px solid var(--theme-color) !important;
  animation: pulse-glow-agente 2.5s infinite ease-in-out;
}

@keyframes pulse-glow-agente {
  0%, 100% {
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2), 0 0 0px var(--theme-color);
  }
  50% {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 8px var(--theme-color);
  }
}

/* Active Badge Styling */
#agentes-container .activo-badge {
  position: absolute !important;
  top: 12px !important;
  right: 12px !important;
  margin: 0 !important;
  z-index: 10 !important;
}
.activo-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid rgba(16, 185, 129, 0.2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.pulse-dot {
  width: 6px;
  height: 6px;
  background-color: #10b981;
  border-radius: 50%;
  display: inline-block;
  animation: dot-pulse 1.8s infinite ease-in-out;
}
@keyframes dot-pulse {
  0%, 100% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
}

/* Verified Badge Styling */
.verified-badge-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
}
.verified-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(114, 176, 77, 0.3);
  overflow: hidden;
  box-shadow: 0 0 8px rgba(114, 176, 77, 0.2);
}
.verified-logo-img {
  width: 18px;
  height: 18px;
  object-fit: cover;
  border-radius: 50%;
}
.verified-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--theme-color, #72B04D);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Legend Styling */
.agentes-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 15px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 12px 20px;
  border-radius: 16px;
  margin-bottom: 35px;
  justify-content: center;
  width: 100%;
}
.legend-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.legend-item {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 50px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid transparent;
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;
}
.legend-item:hover {
  transform: translateY(-1px);
  filter: brightness(1.15);
}
.legend-item.dimmed {
  opacity: 0.35;
  filter: grayscale(0.2);
}
.legend-item.theme-green { border-color: #72B04D !important; }
.legend-item.theme-green.active { background: rgba(114, 176, 77, 0.25) !important; color: #fff !important; font-weight: 700; box-shadow: 0 0 10px rgba(114, 176, 77, 0.25); }

.legend-item.theme-blue { border-color: #0077b6 !important; }
.legend-item.theme-blue.active { background: rgba(0, 119, 182, 0.25) !important; color: #fff !important; font-weight: 700; box-shadow: 0 0 10px rgba(0, 119, 182, 0.25); }

.legend-item.theme-purple { border-color: #6a00a8 !important; }
.legend-item.theme-purple.active { background: rgba(106, 0, 168, 0.25) !important; color: #fff !important; font-weight: 700; box-shadow: 0 0 10px rgba(106, 0, 168, 0.25); }

.legend-item.theme-default { border-color: #2a9d8f !important; }
.legend-item.theme-default.active { background: rgba(42, 157, 143, 0.25) !important; color: #fff !important; font-weight: 700; box-shadow: 0 0 10px rgba(42, 157, 143, 0.25); }

/* Explicit Category Badge in Card */
.agente-category-pill {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  width: fit-content;
  text-transform: uppercase;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}
.theme-green .agente-category-pill {
  background: rgba(114, 176, 77, 0.12) !important;
  color: #72B04D !important;
  border: 1px solid rgba(114, 176, 77, 0.2) !important;
}
.theme-blue .agente-category-pill {
  background: rgba(0, 119, 182, 0.12) !important;
  color: #4db6e8 !important;
  border: 1px solid rgba(0, 119, 182, 0.2) !important;
}
.theme-purple .agente-category-pill {
  background: rgba(106, 0, 168, 0.12) !important;
  color: #b862ff !important;
  border: 1px solid rgba(106, 0, 168, 0.2) !important;
}
.theme-default .agente-category-pill {
  background: rgba(42, 157, 143, 0.12) !important;
  color: #2a9d8f !important;
  border: 1px solid rgba(42, 157, 143, 0.2) !important;
}

/* Desktop/Tablet Horizontal Rectangular Layout */
@media (min-width: 769px) {
  #agentes-container {
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)) !important;
    gap: 30px !important;
  }
  #agentes-container .agente-card {
    flex-direction: row !important;
    align-items: center !important;
    text-align: left !important;
    padding: 24px 24px 24px 36px !important; /* Extra padding-left for active badge if needed */
    gap: 24px !important;
    border-radius: 20px !important;
    height: 100% !important;
    position: relative !important;
  }
  .agente-img {
    width: 110px !important;
    height: 110px !important;
    border-radius: 16px !important;
    margin-bottom: 0 !important;
    flex-shrink: 0 !important;
  }
  .agente-info {
    display: flex !important;
    flex-direction: column !important;
    flex-grow: 1 !important;
    overflow: hidden !important;
  }
  .agente-card h3 {
    margin: 0 0 4px 0 !important;
    font-size: 1.25rem !important;
  }
  .agente-especialidad {
    margin-bottom: 4px !important;
  }
  .agente-org {
    margin-bottom: 8px !important;
  }
  .agente-mini-desc {
    margin: 0 0 12px 0 !important;
    line-height: 1.4 !important;
  }
  .agente-socials {
    margin-top: 0 !important;
    justify-content: flex-start !important;
  }
}

/* Responsive Mobile Horizontal Rectangular Layout */
@media (max-width: 768px) {
  #agentes-container {
    grid-template-columns: 1fr !important;
    gap: 15px !important;
  }
  #agentes-container .agente-card {
    flex-direction: row !important;
    align-items: flex-start !important; /* Align elements to the top */
    text-align: left !important;
    padding: 16px !important;
    gap: 16px !important;
    border-radius: 16px !important;
    height: auto !important;
    position: relative !important;
  }
  #agentes-container .agente-img {
    width: 85px !important;
    height: 85px !important;
    border-radius: 12px !important;
    margin-bottom: 0 !important;
    flex-shrink: 0 !important;
  }
  #agentes-container .agente-info {
    display: flex !important;
    flex-direction: column !important;
    flex-grow: 1 !important;
    overflow: hidden !important;
  }
  #agentes-container .agente-card h3 {
    font-size: 1.05rem !important;
    margin: 0 0 2px 0 !important;
    white-space: normal !important;
    text-align: left !important;
    width: auto !important;
    display: inline-flex !important;
    align-items: center !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
  }
  #agentes-container .agente-category-pill {
    font-size: 0.65rem !important;
    padding: 2px 8px !important;
    margin-bottom: 4px !important;
  }
  #agentes-container .agente-especialidad {
    font-size: 0.75rem !important;
    text-align: left !important;
    margin-bottom: 2px !important;
  }
  #agentes-container .agente-org {
    display: block !important;
    font-size: 0.7rem !important;
    color: #aaa !important;
    margin-bottom: 4px !important;
  }
  #agentes-container .agente-mini-desc {
    display: block !important; /* Show bio description on mobile */
    font-size: 0.75rem !important;
    color: #ccc !important;
    margin: 4px 0 8px 0 !important;
    line-height: 1.4 !important;
    overflow: hidden !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important; /* Limit to 2 lines on mobile to save vertical space */
    -webkit-box-orient: vertical !important;
    text-overflow: ellipsis !important;
  }
  #agentes-container .agente-socials {
    display: flex !important;
    margin-top: 4px !important;
    font-size: 1rem !important;
    gap: 10px !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    justify-content: flex-start !important;
  }
  #agentes-container .activo-badge {
    font-size: 0.65rem !important;
    padding: 1px 6px !important;
  }
  #agentes-container .verified-text {
    font-size: 0.65rem !important;
  }
  #agentes-container .verified-badge {
    width: 20px !important;
    height: 20px !important;
  }
  #agentes-container .verified-logo-img {
    width: 14px !important;
    height: 14px !important;
  }
}
</style>
