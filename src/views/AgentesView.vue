<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'

const router = useRouter()
const perfiles = ref<any[]>([])
const loading = ref(true)
const errorMsg = ref('')

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

const navigateToDetail = (id: string) => {
  router.push(`/agentes/${id}`)
}

onMounted(() => {
  fetchAgentes()
})
</script>

<template>
  <div>
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
        </nav>
      </div>
    </header>

    <main class="content-section">
      <div v-if="loading" class="no-events">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Cargando agentes de cambio...
      </div>
      
      <div v-else-if="errorMsg" class="no-events">
        <p class="error-msg">{{ errorMsg }}</p>
      </div>

      <div v-else-if="perfiles.length === 0" class="no-events">
        <p class="empty-msg">No se encontraron agentes registrados aún.</p>
      </div>

      <div v-else class="card-grid-container" id="agentes-container">
        <article 
          v-for="perfil in perfiles" 
          :key="perfil.id"
          class="agente-card glass-card fade-in"
          style="cursor: pointer;"
          @click="navigateToDetail(perfil.id)"
        >
          <img 
            :src="perfil.avatar_url || perfil.imagen_url || '/assets/img/kpop.webp'" 
            :alt="perfil.nombre_completo || 'Agente'" 
            class="agente-img" 
            @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
          >
          <h3>{{ perfil.nombre_completo || 'Agente de Cambio' }}</h3>
          <p class="agente-especialidad">{{ perfil.especialidad || 'Líder Ambiental' }}</p>
          <p class="agente-org">{{ perfil.organizacion || 'Participante' }}</p>
          <p class="agente-mini-desc">
            {{ perfil.descripcion || 'Participante activo de la red EcoGuía SOS.' }}
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
            <RouterLink :to="`/agentes/${perfil.id}`" @click.stop>
              <i class="fa-solid fa-circle-info"></i>
            </RouterLink>
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
</style>
