<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

// State
const activeTab = ref<'eventos' | 'lugares' | 'actores'>('eventos')
const loading = ref(true)

const eventos = ref<any[]>([])
const lugares = ref<any[]>([])
const actores = ref<any[]>([])
const userCoords = ref<{ lat: number; lng: number } | null>(null)

const fetchFavoritesData = async () => {
  if (!authStore.user) {
    router.push('/auth?tab=login')
    return
  }

  loading.value = true
  try {
    // 1. Fetch event and place favorites
    const { data: favs } = await supabase
      .from('favoritos')
      .select('item_id, item_tipo')
      .eq('user_id', authStore.user.id)

    if (favs && favs.length > 0) {
      const eventIds = favs.filter(f => f.item_tipo === 'evento').map(f => f.item_id)
      const placeIds = favs.filter(f => f.item_tipo === 'lugar').map(f => f.item_id)

      if (eventIds.length > 0) {
        const { data: evs } = await supabase
          .from('eventos')
          .select('*, publicador:owner_id(nombre_completo)')
          .in('id', eventIds)
        eventos.value = evs || []
      } else {
        eventos.value = []
      }

      if (placeIds.length > 0) {
        const { data: lgs } = await supabase
          .from('lugares')
          .select('*, publicador:owner_id(nombre_completo)')
          .in('id', placeIds)
        lugares.value = lgs || []
      } else {
        lugares.value = []
      }
    } else {
      eventos.value = []
      lugares.value = []
    }

    // 2. Fetch followed actors
    const { data: follows } = await supabase
      .from('seguimientos_actores')
      .select('actor_id')
      .eq('user_id', authStore.user.id)

    if (follows && follows.length > 0) {
      const actorIds = follows.map(f => f.actor_id)
      const { data: profiles } = await supabase
        .from('perfiles')
        .select('*')
        .in('id', actorIds)
      
      actores.value = (profiles || []).map(p => ({
        id: p.id,
        nombre: p.nombre_completo || 'Agente de Cambio',
        imagen_url: p.avatar_url || p.imagen_url || '/assets/img/kpop.webp',
        especialidad: p.especialidad || 'Líder Ambiental',
        organizacion: p.organizacion || 'Participante',
        is_verified: p.is_validated || false
      }))
    } else {
      actores.value = []
    }
  } catch (err) {
    console.error('Error fetching favorites:', err)
  } finally {
    loading.value = false
  }
}

const getImgSrc = (item: any) => {
  let imgSrc = item.imagen_url || item.imagen
  if (item.imagenes && Array.isArray(item.imagenes) && item.imagenes.length > 0) {
    imgSrc = item.imagenes[0]
  }
  return imgSrc || '/assets/img/kpop.webp'
}

const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
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

onMounted(async () => {
  const cached = localStorage.getItem('eco_user_coords')
  if (cached) {
    try {
      userCoords.value = JSON.parse(cached)
    } catch (e) {}
  }
  if (authStore.loading) {
    await authStore.init()
  }
  await fetchFavoritesData()
})
</script>

<template>
  <div class="favoritos-page-body">
    <div class="dashboard-container">
      
      <!-- Back Button -->
      <div class="dash-topbar">
        <RouterLink to="/" class="btn-back-home">
          <i class="fa-solid fa-arrow-left"></i> Explorar Catálogo
        </RouterLink>
      </div>

      <!-- Dashboard Header -->
      <header class="dash-header">
        <div class="dash-avatar">
          <i class="fa-solid fa-user-astronaut"></i>
        </div>
        <div class="dash-info">
          <h1>Tu Panel Personal</h1>
          <p>Aquí se guarda todo lo que te inspira a cambiar el mundo.</p>
        </div>
      </header>

      <!-- Tabs (Segmented Control) -->
      <div style="text-align: center;">
        <div class="segmented-control">
          <button 
            class="segment-btn" 
            :class="{ 'active': activeTab === 'eventos' }" 
            @click="activeTab = 'eventos'"
          >
            <i class="fa-solid fa-calendar-check"></i>
            <span>Mis Eventos</span>
          </button>
          <button 
            class="segment-btn" 
            :class="{ 'active': activeTab === 'lugares' }" 
            @click="activeTab = 'lugares'"
          >
            <i class="fa-solid fa-location-dot"></i>
            <span>Mis Lugares</span>
          </button>
          <button 
            class="segment-btn" 
            :class="{ 'active': activeTab === 'actores' }" 
            @click="activeTab = 'actores'"
          >
            <i class="fa-solid fa-users"></i>
            <span>Siguiendo</span>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" style="text-align:center; padding: 50px; width: 100%;">
        <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color: #72B04D;"></i>
      </div>

      <!-- Tab Contents -->
      <div v-else class="tab-contents-wrapper">
        
        <!-- Tab: Eventos -->
        <div v-if="activeTab === 'eventos'" class="tab-content active">
          <div v-if="eventos.length === 0" class="empty-favorites-state">
            <i class="fa-solid fa-calendar-xmark" style="font-size:3rem; margin-bottom:15px; color:#475569;"></i>
            <p>Aún no has guardado ningún evento.</p>
          </div>
          <div v-else class="card-grid-container" id="contenedor-tarjetas">
            <article 
              v-for="ev in eventos" 
              :key="ev.id" 
              class="card fade-in" 
              :class="getNivelClass(ev.categoria)"
              @click="router.push(`/eventos/${ev.id}`)" 
              style="cursor: pointer;"
            >
              <div class="card-image">
                <img 
                  :src="getImgSrc(ev)" 
                  :alt="ev.nombre" 
                  @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
                />
                <span v-if="userCoords && ev.lat && ev.lng" class="dist-badge" style="background:rgba(15,20,25,0.9); color:#fde047; border:1px solid rgba(253,224,71,0.4); font-weight:700;">
                  <i class="fa-solid fa-route"></i> a {{ calcularDistancia(userCoords.lat, userCoords.lng, ev.lat, ev.lng).toFixed(1) }} km
                </span>
                <div v-if="ev.publicador?.nombre_completo" class="actor-badge" :title="`Publicado por: ${ev.publicador.nombre_completo}`">
                  <i class="fa-solid fa-user-pen"></i>
                  <span>{{ ev.publicador.nombre_completo }}</span>
                </div>
              </div>
              <div class="card-content">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="card-category">{{ ev.categoria }}</span>
                  <span v-if="ev.modalidad === 'en_linea'" class="status-badge" style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9; font-size: 0.65rem; border: 1px solid rgba(14, 165, 233, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                    🖥️ En Línea
                  </span>
                  <span v-else-if="ev.tiene_sesion_online" class="status-badge" style="background: rgba(139, 92, 246, 0.15); color: #c084fc; font-size: 0.65rem; border: 1px solid rgba(139, 92, 246, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                    🔄 Híbrido
                  </span>
                </div>
                <h3 class="card-title" style="margin-bottom:2px; font-weight: 800; font-size: 1.2rem; color: white;">{{ ev.nombre }}</h3>
                <span v-if="formatearFechaSubtext(ev.fecha_inicio || ev.fecha)" class="card-date-sub" style="color:#5bc2f7; font-size:0.8rem; display:block; margin-top:4px; font-weight:600;">
                  <i class="fa-regular fa-calendar" style="margin-right:4px;"></i>{{ formatearFechaSubtext(ev.fecha_inicio || ev.fecha) }}
                </span>
              </div>
            </article>
          </div>
        </div>

        <!-- Tab: Lugares -->
        <div v-if="activeTab === 'lugares'" class="tab-content active">
          <div v-if="lugares.length === 0" class="empty-favorites-state">
            <i class="fa-solid fa-map-location-dot" style="font-size:3rem; margin-bottom:15px; color:#475569;"></i>
            <p>Aún no has guardado ningún lugar sustentable.</p>
          </div>
          <div class="card-grid-container" id="contenedor-tarjetas">
            <article 
              v-for="lg in lugares" 
              :key="lg.id" 
              class="card fade-in" 
              :class="getNivelClass(lg.categoria)"
              @click="router.push(`/lugares/${lg.id}`)" 
              style="cursor: pointer;"
            >
              <div class="card-image">
                <img 
                  :src="getImgSrc(lg)" 
                  :alt="lg.nombre" 
                  @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
                />
                <span v-if="userCoords && lg.lat && lg.lng" class="dist-badge" style="background:rgba(15,20,25,0.9); color:#fde047; border:1px solid rgba(253,224,71,0.4); font-weight:700;">
                  <i class="fa-solid fa-route"></i> a {{ calcularDistancia(userCoords.lat, userCoords.lng, lg.lat, lg.lng).toFixed(1) }} km
                </span>
                <div v-if="lg.publicador?.nombre_completo" class="actor-badge" :title="`Publicado por: ${lg.publicador.nombre_completo}`">
                  <i class="fa-solid fa-user-pen"></i>
                  <span>{{ lg.publicador.nombre_completo }}</span>
                </div>
              </div>
              <div class="card-content">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="card-category">{{ lg.categoria || 'Lugar Sustentable' }}</span>
                </div>
                <h3 class="card-title" style="margin-bottom:2px; font-weight: 800; font-size: 1.2rem; color: white;">{{ lg.nombre }}</h3>
              </div>
            </article>
          </div>
        </div>

        <!-- Tab: Actores -->
        <div v-if="activeTab === 'actores'" class="tab-content active">
          <div v-if="actores.length === 0" class="empty-favorites-state">
            <i class="fa-solid fa-user-slash" style="font-size:3rem; margin-bottom:15px; color:#475569;"></i>
            <p>No estás siguiendo a ningún Agente de Cambio por el momento.</p>
          </div>
          <div class="card-grid-container" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:25px;">
            <article 
              v-for="ac in actores" 
              :key="ac.id" 
              class="dash-card" 
              @click="router.push(`/agentes/${ac.id}`)" 
              style="cursor: pointer;"
            >
              <div class="dash-card-image-box" style="height: 180px; display:flex; align-items:center; justify-content:center; background:#0f172a; padding: 20px;">
                <img 
                  :src="ac.imagen_url" 
                  :alt="ac.nombre" 
                  class="dash-card-img" 
                  style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(114,176,77,0.3);"
                  @error="($event.target as HTMLImageElement).src='/assets/img/kpop.webp'"
                />
              </div>
              <div class="dash-card-body" style="text-align: center;">
                <h3 style="margin-bottom:6px;">
                  {{ ac.nombre }}
                  <i v-if="ac.is_verified" class="fa-solid fa-circle-check" style="color: #3897f0; font-size:0.95rem;"></i>
                </h3>
                <p class="dash-card-category">{{ ac.especialidad }} | {{ ac.organizacion }}</p>
              </div>
            </article>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style>
.favoritos-page-body {
  background-color: #0b0f19;
  background-image: 
    radial-gradient(circle at 15% 50%, rgba(114, 176, 77, 0.1), transparent 25%),
    radial-gradient(circle at 85% 30%, rgba(91, 194, 247, 0.1), transparent 25%);
  background-attachment: fixed;
  color: #e2e8f0;
  min-height: 100vh;
  font-family: 'Outfit', sans-serif;
  padding-top: 100px;
}
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px 40px;
}
.dash-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
}
.btn-back-home {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 10px 22px;
  border-radius: 30px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}
.btn-back-home:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateX(-5px);
}
.dash-header {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  padding: 30px;
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 40px;
  backdrop-filter: blur(20px);
}
.dash-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #72B04D, #5bc2f7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  color: white;
  box-shadow: 0 0 25px rgba(114, 176, 77, 0.3);
}
.dash-info h1 {
  margin: 0 0 6px 0;
  font-size: 1.8rem;
  font-weight: 800;
  color: white;
}
.dash-info p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.95rem;
}
.segmented-control {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 20px;
  padding: 6px;
  display: inline-flex;
  gap: 6px;
  margin-bottom: 40px;
  border: 1px solid rgba(255,255,255,0.05);
}
.segment-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 10px 24px;
  border-radius: 14px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}
.segment-btn:hover {
  color: white;
}
.segment-btn.active {
  background: rgba(255, 255, 255, 0.08);
  color: #72b04d;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}
.empty-favorites-state {
  text-align: center;
  padding: 60px 20px;
  background: rgba(255,255,255,0.01);
  border: 2px dashed rgba(255,255,255,0.05);
  border-radius: 24px;
  color: #94a3b8;
  font-weight: 500;
}
.dash-card-image-box {
  width: 100%;
  height: 160px;
  overflow: hidden;
  border-radius: 16px 16px 0 0;
}
.dash-card-image-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s;
}
.dash-card:hover .dash-card-image-box img {
  transform: scale(1.05);
}
.dash-card-category {
  color: #72b04d;
  font-size: 0.85rem;
  font-weight: 600;
  margin: 5px 0 0 0;
}
</style>
