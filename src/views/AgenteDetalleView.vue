<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const errorMsg = ref('')
const agente = ref<any | null>(null)
const eventos = ref<any[]>([])
const isFollowing = ref(false)
const followLoading = ref(false)

const agentId = computed(() => route.params.id as string)

const isOwnProfile = computed(() => {
  return authStore.user && authStore.user.id === agentId.value
})

const getImgSrc = (ev: any) => {
  let imgSrc = ev.imagen_url
  if (ev.imagenes && Array.isArray(ev.imagenes) && ev.imagenes.length > 0) {
    imgSrc = ev.imagenes[0]
  }
  return imgSrc || '/assets/img/kpop.webp'
}

const cleanWhatsappNumber = (wa: string) => {
  return wa ? wa.replace(/\D/g, '') : ''
}

const fetchAgentProfile = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    if (!agentId.value) {
      router.push('/agentes')
      return
    }

    // 1. Get profile data
    const { data: perfil, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', agentId.value)
      .single()

    if (error || !perfil) {
      throw new Error('Perfil no encontrado')
    }

    agente.value = {
      nombre: perfil.nombre_completo || 'Agente de Cambio',
      imagen_url: perfil.avatar_url || perfil.imagen_url || '/assets/img/kpop.webp',
      banner_img: perfil.banner_img || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2013&auto=format&fit=crop',
      especialidad: perfil.especialidad || (perfil.rol === 'actor' ? 'Líder Ambiental' : perfil.rol) || 'Agente de Cambio',
      descripcion: perfil.descripcion || 'Este actor aún no ha configurado su descripción detallada.',
      usuario_id: perfil.id,
      is_verified: perfil.is_validated || false,
      organizacion: perfil.organizacion || 'Participante',
      mision: perfil.mision || null,
      impacto_resumen: perfil.impacto_resumen || '--',
      alcaldia: perfil.alcaldia || perfil.zona || 'Varias zonas',
      redes_ig: perfil.redes_ig || null,
      redes_fb: perfil.redes_fb || null,
      redes_x: perfil.redes_x || null,
      redes_web: perfil.redes_web || null,
      redes_wa: perfil.redes_wa || null
    }

    document.title = `${agente.value.nombre} | EcoGuía SOS`

    // 2. Fetch events
    await fetchAgentEvents()

    // 3. Setup follow logic if user is authenticated
    if (authStore.user) {
      await checkFollowStatus()
    }
  } catch (err: any) {
    console.error('[AgenteDetalle] Error:', err)
    errorMsg.value = err.message || 'Error al cargar el perfil del agente.'
  } finally {
    loading.value = false
  }
}

const fetchAgentEvents = async () => {
  try {
    const { data, error } = await supabase
      .from('eventos')
      .select('*')
      .eq('owner_id', agentId.value)
      .order('fecha_inicio', { ascending: false })

    if (error) throw error
    eventos.value = data || []
  } catch (err) {
    console.error('Error loading events:', err)
  }
}

const checkFollowStatus = async () => {
  if (!authStore.user || isOwnProfile.value) return
  try {
    const { data, error } = await supabase
      .from('seguimientos_actores')
      .select('id')
      .eq('user_id', authStore.user.id)
      .eq('actor_id', agentId.value)
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      isFollowing.value = true
    } else {
      isFollowing.value = false
    }
  } catch (e) {
    console.error('Error checking follow status:', e)
  }
}

const handleFollowToggle = async () => {
  if (!authStore.user) {
    router.push('/auth?tab=login')
    return
  }
  
  followLoading.value = true
  try {
    const userId = authStore.user.id
    const actorId = agentId.value

    if (isFollowing.value) {
      const { error } = await supabase
        .from('seguimientos_actores')
        .delete()
        .eq('user_id', userId)
        .eq('actor_id', actorId)

      if (!error) isFollowing.value = false
    } else {
      // Delete any duplicate first, then insert
      await supabase
        .from('seguimientos_actores')
        .delete()
        .eq('user_id', userId)
        .eq('actor_id', actorId)

      const { error } = await supabase
        .from('seguimientos_actores')
        .insert({ user_id: userId, actor_id: actorId })

      if (!error) isFollowing.value = true
    }
  } catch (e) {
    console.error('Error toggling follow:', e)
  } finally {
    followLoading.value = false
  }
}

onMounted(() => {
  fetchAgentProfile()
})

// Watch route to re-fetch if ID changes
watch(() => route.params.id, () => {
  fetchAgentProfile()
})
</script>

<template>
  <main class="content-section" style="padding-top: 100px;">
    <div class="container">
      
      <!-- Botón Volver -->
      <div style="margin-bottom: 20px;">
        <RouterLink to="/agentes" class="btn-ghost-eco">
          <i class="fa-solid fa-arrow-left"></i> Volver a Agentes
        </RouterLink>
      </div>

      <div v-if="loading" class="no-events" id="profile-loader">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Cargando perfil del agente...
      </div>

      <div v-else-if="errorMsg" class="no-events">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar el perfil</h3>
        <p>{{ errorMsg }}</p>
      </div>

      <div v-else-if="agente" id="profile-content">
        <!-- Header de Perfil -->
        <div class="agent-profile-header">
          <img id="agent-banner" :src="agente.banner_img" alt="Banner" class="agent-banner">
          <div class="agent-info-overlay">
            <img id="agent-avatar" :src="agente.imagen_url" alt="Avatar" class="agent-avatar-large" @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'">
            <div class="agent-titles">
              <h1 id="agent-name">
                {{ agente.nombre }}
                <i v-if="agente.is_verified" class="fa-solid fa-circle-check verified-badge"></i>
              </h1>
              <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                <p id="agent-specialty" style="margin: 0;">{{ agente.especialidad }} | {{ agente.organizacion }}</p>
                <button 
                  v-if="authStore.user && !isOwnProfile"
                  id="btn-follow-profile" 
                  class="btn btn-primary" 
                  style="padding: 5px 15px; font-size: 0.8rem; border-radius: 20px;"
                  :style="isFollowing ? 'background: #333; border-color: #72B04D; color: #72B04D;' : ''"
                  :disabled="followLoading"
                  @click="handleFollowToggle"
                >
                  {{ isFollowing ? '✓ Siguiendo' : '+ Seguir' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="profile-grid">
          <!-- Columna Principal -->
          <div class="profile-main">
            <div class="profile-main-card">
              <div v-if="agente.mision" id="agent-mision" class="mision-box">
                "{{ agente.mision }}"
              </div>
              
              <h3>Sobre el Agente</h3>
              <p id="agent-desc">{{ agente.descripcion }}</p>

              <div class="events-grid">
                <h3><i class="fa-solid fa-calendar-star"></i> Proyectos y Eventos</h3>
                <div 
                  v-if="eventos.length === 0" 
                  id="agent-events-container"
                  class="no-events"
                >
                  <p>Este agente aún no ha publicado eventos o proyectos.</p>
                </div>
                <div 
                  v-else
                  id="agent-events-container" 
                  class="card-grid-container" 
                  style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; padding: 0;"
                >
                  <article 
                    v-for="ev in eventos" 
                    :key="ev.id" 
                    class="dash-card" 
                    @click="router.push(`/eventos/${ev.id}`)" 
                    style="cursor: pointer;"
                  >
                    <div style="position:relative; width: 100%; height: 160px; overflow: hidden; border-radius: 12px 12px 0 0;">
                      <img 
                        :src="getImgSrc(ev)" 
                        :alt="ev.nombre" 
                        class="dash-card-img" 
                        style="width: 100%; height: 100%; object-fit: cover;" 
                        @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
                      >
                    </div>
                    <div class="dash-card-body">
                      <h3 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" :title="ev.nombre">{{ ev.nombre }}</h3>
                      <p style="color: var(--primary-color); font-size: 0.9rem;">{{ ev.categoria || 'Evento' }}</p>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </div>

          <!-- Columna Lateral -->
          <div class="profile-side">
            <div class="profile-main-card" style="position: sticky; top: 100px;">
              <div class="agent-stats">
                <div class="stat-item">
                  <span class="stat-value" id="count-events">{{ eventos.length }}</span>
                  <span class="stat-label">Eventos</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value" id="count-impact">{{ agente.impacto_resumen }}</span>
                  <span class="stat-label">Impacto</span>
                </div>
              </div>

              <h4>Contacto y Redes</h4>
              <div id="agent-socials" class="agente-socials" style="justify-content: flex-start; margin-bottom: 20px;">
                <template v-if="agente.redes_ig || agente.redes_fb || agente.redes_x || agente.redes_web || agente.redes_wa">
                  <a v-if="agente.redes_ig" :href="agente.redes_ig" target="_blank"><i class="fa-brands fa-instagram"></i></a>
                  <a v-if="agente.redes_fb" :href="agente.redes_fb" target="_blank"><i class="fa-brands fa-facebook"></i></a>
                  <a v-if="agente.redes_x" :href="agente.redes_x" target="_blank"><i class="fa-brands fa-x-twitter"></i></a>
                  <a v-if="agente.redes_web" :href="agente.redes_web" target="_blank"><i class="fa-solid fa-globe"></i></a>
                  <a v-if="agente.redes_wa" :href="`https://wa.me/${cleanWhatsappNumber(agente.redes_wa)}`" target="_blank"><i class="fa-brands fa-whatsapp"></i></a>
                </template>
                <p v-else style="color: #666; font-size: 0.8rem;">Sin redes sociales vinculadas.</p>
              </div>

              <hr style="border-color: rgba(255,255,255,0.05); margin: 20px 0;">
              
              <p style="font-size: 0.8rem; color: #888;">
                <i class="fa-solid fa-location-dot"></i> <span id="agent-location">{{ agente.alcaldia }}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style>
@import '../assets/css/interior-pages.css';
@import '../assets/css/style.css';

/* Estilos específicos para el Perfil del Agente */
.agent-profile-header {
    position: relative;
    margin-bottom: 40px;
}

.agent-banner {
    width: 100%;
    height: 250px;
    object-fit: cover;
    border-radius: 20px;
    background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
}

.agent-info-overlay {
    position: relative;
    margin-top: -60px;
    padding: 0 30px;
    display: flex;
    align-items: flex-end;
    gap: 25px;
}

.agent-avatar-large {
    width: 150px;
    height: 150px;
    border-radius: 50%;
    border: 5px solid var(--color-fondo);
    object-fit: cover;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    background-color: var(--color-fondo);
}

.agent-titles {
    padding-bottom: 15px;
}

.agent-titles h1 {
    font-size: 2.2rem;
    margin: 0;
    color: white;
    display: flex;
    align-items: center;
    gap: 10px;
}

.verified-badge {
    color: #3897f0;
    font-size: 1.5rem;
}

.agent-titles p {
    color: var(--primary-color);
    font-weight: 600;
    margin: 5px 0 0 0;
}

.profile-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 30px;
}

.profile-main-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    padding: 30px;
}

.mision-box {
    background: rgba(114, 176, 77, 0.1);
    border-left: 4px solid var(--primary-color);
    padding: 20px;
    border-radius: 0 15px 15px 0;
    margin-bottom: 30px;
    font-style: italic;
    color: #eee;
}

.agent-stats {
    display: flex;
    gap: 20px;
    margin-bottom: 30px;
}

.stat-item {
    flex: 1;
    background: rgba(0, 0, 0, 0.2);
    padding: 15px;
    border-radius: 12px;
    text-align: center;
}

.stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 800;
    color: white;
}

.stat-label {
    font-size: 0.75rem;
    color: #888;
    text-transform: uppercase;
}

.events-grid {
    margin-top: 40px;
}

.no-events {
    padding: 40px;
    text-align: center;
    color: #666;
    border: 2px dashed rgba(255, 255, 255, 0.05);
    border-radius: 15px;
}

@media (max-width: 768px) {
    .profile-grid {
        grid-template-columns: 1fr;
    }

    .agent-info-overlay {
        flex-direction: column;
        align-items: center;
        text-align: center;
        margin-top: -75px;
    }

    .agent-avatar-large {
        width: 120px;
        height: 120px;
    }
}
</style>
