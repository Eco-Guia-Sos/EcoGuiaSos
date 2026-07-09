<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'

const router = useRouter()
const superEventos = ref<any[]>([])
const loading = ref(true)
const errorMsg = ref('')

const fetchSuperEventos = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const { data, error } = await supabase
      .from('super_eventos')
      .select('*')
      .eq('estado', 'approved')
      .order('created_at', { ascending: false })

    if (error) throw error
    superEventos.value = data || []
  } catch (err: any) {
    console.error('Error fetching super eventos:', err)
    errorMsg.value = 'No se pudieron cargar los eventos especiales.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchSuperEventos()
})
</script>

<template>
  <div class="theme-ajolote" style="min-height: 100vh; background: #0b1329;">
    <header class="interior-hero">
      <div class="hero-glass-panel">
        <span class="category-badge">🏆 Macro Eventos</span>
        <h2>Super Eventos Colectivos</h2>
        <p>Explora ferias, olimpiadas y festivales sustentables que reúnen a múltiples colectivos en la red.</p>
      </div>
      
      <div class="subnav-scroll-wrapper fade-in">
        <nav class="level-subnav">
          <RouterLink to="/agentes" class="subnav-link"><i class="fa-solid fa-users"></i> Agentes</RouterLink>
          <RouterLink to="/convocatoria" class="subnav-link"><i class="fa-solid fa-bullhorn"></i> Convocatorias</RouterLink>
          <RouterLink to="/voluntariados" class="subnav-link"><i class="fa-solid fa-handshake"></i> Ayuda</RouterLink>
          <RouterLink to="/causas" class="subnav-link"><i class="fa-solid fa-hand-holding-heart"></i> Causas / Rifas</RouterLink>
          <RouterLink to="/lugares" class="subnav-link"><i class="fa-solid fa-map-pin"></i> Lugares</RouterLink>
          <RouterLink to="/super-eventos" class="subnav-link active"><i class="fa-solid fa-trophy"></i> Eventos Especiales</RouterLink>
        </nav>
      </div>
    </header>

    <main style="max-width: 1200px; margin: 0 auto; padding: 20px 15px 60px; position: relative; z-index: 5;">
      <div v-if="loading" class="no-events">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Cargando eventos especiales...
      </div>
      
      <div v-else-if="errorMsg" class="no-events">
        <p class="error-msg">{{ errorMsg }}</p>
      </div>

      <div v-else-if="superEventos.length === 0" class="no-events">
        <p class="empty-msg">No hay súper eventos programados por el momento.</p>
      </div>

      <div v-else class="card-grid-container">
        <article 
          v-for="se in superEventos" 
          :key="se.id"
          class="card fade-in card-colibri"
          @click="router.push(`/super-eventos/${se.id}`)"
          style="cursor: pointer;"
        >
          <div class="card-image">
            <img 
              :src="se.imagen_url || '/assets/img/logo-app.webp'" 
              @error="($event.target as HTMLImageElement).src='/assets/img/logo-app.webp'"
              style="width: 100%; height: 100%; object-fit: cover;"
            >
          </div>
          <div class="card-content" style="padding-top: 12px;">
            <div class="card-meta-row">
              <span class="card-meta-category">
                <span class="category-icon-bg">🏆</span> Super Evento
              </span>
            </div>
            <h3 class="card-title" style="margin-bottom:6px; font-size: 1.1rem; line-height: 1.25; color: white;">{{ se.nombre }}</h3>
            <p style="font-size:0.8rem; color:#94a3b8; line-height:1.4; margin-top:6px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">
              {{ se.descripcion_corta || 'Explora todas las actividades de este encuentro sustentable.' }}
            </p>
            <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size: 0.75rem; color: #72b04d; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                <i class="fa-solid fa-map-location-dot" style="margin-right: 5px;"></i> Ver Encuentro
              </span>
            </div>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<style scoped>
.no-events {
  text-align: center;
  padding: 80px 20px;
  color: #94a3b8;
  font-size: 1.1rem;
}
.empty-msg {
  color: #64748b;
  font-size: 1rem;
}
.error-msg {
  color: #ef4444;
  font-weight: 500;
}
</style>
