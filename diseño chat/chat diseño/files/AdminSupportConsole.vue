<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'

// ── Types ──────────────────────────────────────────────────────────────────
type TicketStatus = 'Abierto' | 'En Proceso' | 'Resuelto'
type UserRole     = 'Voluntario' | 'Actor'
type MsgType      = 'text' | 'image' | 'video' | 'audio' | 'location'

interface LocationPayload { lat: number; lng: number; label: string }
interface Message {
  id: string; sender_id: 'user' | 'admin'; type: MsgType
  text?: string; image_url?: string; video_url?: string
  audio_duration?: number; location?: LocationPayload
  timestamp: Date; read: boolean
}
interface ChatUser {
  id: string; name: string; email: string; role: UserRole
  color: string; initials: string
  registered_at: Date; last_seen: Date; online: boolean
  ticket_status: TicketStatus; internal_notes: string
  messages: Message[]
}

// ── Mock Data ──────────────────────────────────────────────────────────────
const mockUsers = ref<ChatUser[]>([
  {
    id:'u1', name:'Mariana López', email:'mariana.lopez@ecoguia.mx', role:'Voluntario',
    color:'#0077b6', initials:'ML',
    registered_at: new Date('2024-03-14'), last_seen: new Date(Date.now()-120000), online:true,
    ticket_status:'En Proceso', internal_notes:'Zona Xochimilco Sur, revisar permisos de carga.',
    messages:[
      { id:'m1', sender_id:'user', type:'text', text:'Hola, no puedo subir fotos a la sección de lugares.', timestamp:new Date(Date.now()-1800000), read:true },
      { id:'m2', sender_id:'admin', type:'text', text:'Hola Mariana, ¿qué error te aparece exactamente?', timestamp:new Date(Date.now()-1500000), read:true },
      { id:'m3', sender_id:'user', type:'image', image_url:'https://placehold.co/280x160/1a2a35/72B04D?text=Captura+de+error', text:'Captura de pantalla del error.png', timestamp:new Date(Date.now()-600000), read:false },
    ],
  },
  {
    id:'u2', name:'Carlos Reyes', email:'c.reyes@actorguia.org', role:'Actor',
    color:'#72B04D', initials:'CR',
    registered_at: new Date('2024-01-20'), last_seen: new Date(Date.now()-3600000), online:false,
    ticket_status:'Abierto', internal_notes:'',
    messages:[
      { id:'m4', sender_id:'user', type:'text', text:'Necesito actualizar los datos de mi organización.', timestamp:new Date(Date.now()-3900000), read:true },
      { id:'m5', sender_id:'user', type:'audio', audio_duration:14, timestamp:new Date(Date.now()-3600000), read:false },
    ],
  },
  {
    id:'u3', name:'Sofía Ramírez', email:'sofia.r@voluntariados.mx', role:'Voluntario',
    color:'#b8860b', initials:'SR',
    registered_at: new Date('2024-05-03'), last_seen: new Date(Date.now()-300000), online:true,
    ticket_status:'Resuelto', internal_notes:'Caso resuelto. Se envió confirmación al correo.',
    messages:[
      { id:'m6', sender_id:'user', type:'text', text:'¡Ya funciona! Muchas gracias por la ayuda.', timestamp:new Date(Date.now()-7200000), read:true },
      { id:'m7', sender_id:'admin', type:'text', text:'¡Perfecto! Que todo vaya bien, Sofía 🌱', timestamp:new Date(Date.now()-7000000), read:true },
    ],
  },
  {
    id:'u4', name:'Emilio Vega', email:'evega@redeco.com', role:'Actor',
    color:'#e07b54', initials:'EV',
    registered_at: new Date('2023-11-08'), last_seen: new Date(Date.now()-10800000), online:false,
    ticket_status:'Abierto', internal_notes:'Esperando respuesta del equipo técnico.',
    messages:[
      { id:'m8', sender_id:'user', type:'location', location:{ lat:19.43260, lng:-99.13320, label:'Ubicación del problema reportado' }, timestamp:new Date(Date.now()-10800000), read:false },
      { id:'m9', sender_id:'user', type:'text', text:'El botón de publicar alertas no genera notificaciones. Aquí les mando dónde está el lugar.', timestamp:new Date(Date.now()-10900000), read:false },
      { id:'m10', sender_id:'user', type:'video', video_url:'', text:'grabacion-error-alertas.mp4', timestamp:new Date(Date.now()-10200000), read:false },
    ],
  },
])

// ── State ──────────────────────────────────────────────────────────────────
const activeId     = ref<string | null>('u1')
const searchQuery  = ref('')
const adminInput   = ref('')
const messagesEnd  = ref<HTMLElement | null>(null)

// ── Computed ───────────────────────────────────────────────────────────────
const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return mockUsers.value.filter(u =>
    u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  )
})
const active = computed(() => mockUsers.value.find(u => u.id === activeId.value) ?? null)

function unread(uid: string) {
  return mockUsers.value.find(u => u.id === uid)?.messages.filter(m => !m.read && m.sender_id === 'user').length ?? 0
}

// ── Helpers ────────────────────────────────────────────────────────────────
function gid() { return Math.random().toString(36).slice(2,9) }
function fmtTime(d: Date) {
  const diff = Date.now() - d.getTime()
  if (diff < 60000)    return 'Ahora'
  if (diff < 3600000)  return `${Math.floor(diff/60000)} min`
  if (diff < 86400000) return d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})
  return d.toLocaleDateString('es-MX',{day:'numeric',month:'short'})
}
function fmtDate(d: Date) { return d.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}) }
function fmtDur(s: number) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` }
function lastMsg(u: ChatUser): string {
  const m = u.messages.at(-1); if (!m) return 'Sin mensajes'
  if (m.type === 'image')    return '📷 Imagen adjunta'
  if (m.type === 'video')    return '🎬 Video adjunto'
  if (m.type === 'audio')    return '🎙️ Nota de voz'
  if (m.type === 'location') return '📍 Ubicación compartida'
  const pre = m.sender_id === 'admin' ? 'Tú: ' : ''
  return pre + (m.text ?? '').slice(0,45) + ((m.text?.length ?? 0) > 45 ? '…' : '')
}

async function scrollToBottom() { await nextTick(); messagesEnd.value?.scrollIntoView({behavior:'smooth'}) }

// ── Actions ────────────────────────────────────────────────────────────────
function selectUser(uid: string) {
  activeId.value = uid
  const u = mockUsers.value.find(u => u.id === uid)
  if (u) u.messages.forEach(m => { m.read = true })
  scrollToBottom()
}

function sendAdmin() {
  const text = adminInput.value.trim()
  if (!text || !active.value) return
  active.value.messages.push({ id:gid(), sender_id:'admin', type:'text', text, timestamp:new Date(), read:true })
  adminInput.value = ''
  scrollToBottom()
}

function handleKey(e: KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAdmin() } }

function setStatus(s: TicketStatus) { if (active.value) active.value.ticket_status = s }

function openMap(loc: LocationPayload) { window.open(`https://maps.google.com/?q=${loc.lat},${loc.lng}`,'_blank') }

watch(activeId, () => scrollToBottom())
</script>

<template>
  <div class="ac">
    <!-- ══ LEFT: Conversation list ══════════════════════════════ -->
    <aside class="col-l">
      <div class="col-l__top">
        <div class="col-l__head">
          <span class="col-l__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="col-l__title-icon" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Conversaciones
          </span>
          <span class="col-l__count">{{ filtered.length }}</span>
        </div>
        <div class="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search__icon" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input v-model="searchQuery" class="search__input" placeholder="Buscar usuario o rol…" />
        </div>
      </div>

      <div class="chat-list">
        <button v-for="u in filtered" :key="u.id" class="ci" :class="{ 'ci--active': activeId === u.id }" @click="selectUser(u.id)">
          <div class="ci__av" :style="{ background: u.color }">
            {{ u.initials }}
            <span class="ci__dot" :class="u.online ? 'ci__dot--on' : 'ci__dot--off'"></span>
          </div>
          <div class="ci__body">
            <div class="ci__row1">
              <span class="ci__name">{{ u.name }}</span>
              <span class="ci__time">{{ fmtTime(u.messages.at(-1)?.timestamp ?? u.registered_at) }}</span>
            </div>
            <div class="ci__row2">
              <span class="ci__preview">{{ lastMsg(u) }}</span>
              <span v-if="unread(u.id) > 0" class="ci__badge">{{ unread(u.id) }}</span>
            </div>
            <span class="ci__role" :class="`role--${u.role.toLowerCase()}`">{{ u.role }}</span>
          </div>
        </button>

        <div v-if="filtered.length === 0" class="list-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <p>Sin resultados</p>
        </div>
      </div>
    </aside>

    <!-- ══ CENTER: Active chat ══════════════════════════════════ -->
    <main class="col-c">
      <template v-if="active">
        <header class="cc-head">
          <div class="cc-head__user">
            <div class="cc-head__av" :style="{ background: active.color }">
              {{ active.initials }}
              <span class="ci__dot" :class="active.online ? 'ci__dot--on' : 'ci__dot--off'"></span>
            </div>
            <div>
              <p class="cc-head__name">{{ active.name }}</p>
              <p class="cc-head__sub">{{ active.online ? 'En línea' : `Últ. vez ${fmtTime(active.last_seen)}` }}</p>
            </div>
          </div>
          <span class="status-pill" :class="`sp--${active.ticket_status.toLowerCase().replace(' ','-')}`">{{ active.ticket_status }}</span>
        </header>

        <div class="cc-body">
          <TransitionGroup name="msg" tag="div" class="cc-body__inner">
            <div v-for="m in active.messages" :key="m.id" class="row" :class="m.sender_id === 'admin' ? 'row--admin' : 'row--user'">
              <div class="bubble" :class="m.sender_id === 'admin' ? 'bubble--admin' : 'bubble--user'">

                <!-- Text -->
                <p v-if="m.type === 'text'" class="bubble__text">{{ m.text }}</p>

                <!-- Image with thumbnail -->
                <div v-else-if="m.type === 'image'" class="bubble__img-wrap">
                  <img :src="m.image_url" :alt="m.text" class="bubble__img" />
                  <p v-if="m.text" class="bubble__caption">{{ m.text }}</p>
                </div>

                <!-- Video player -->
                <div v-else-if="m.type === 'video'" class="bubble__video-wrap">
                  <template v-if="m.video_url">
                    <video :src="m.video_url" class="bubble__video" controls preload="metadata">
                      Tu navegador no soporta video.
                    </video>
                  </template>
                  <template v-else>
                    <!-- Placeholder when no real URL (mock data) -->
                    <div class="bubble__video-placeholder">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="video-placeholder-icon">
                        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                      </svg>
                      <span>Vista previa no disponible</span>
                    </div>
                  </template>
                  <div class="bubble__video-meta">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="video-meta-icon" aria-hidden="true">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                    <p class="bubble__caption">{{ m.text }}</p>
                  </div>
                </div>

                <!-- Audio player -->
                <div v-else-if="m.type === 'audio'" class="bubble__audio">
                  <button class="audio-play" aria-label="Reproducir nota de voz">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  </button>
                  <div class="audio-track">
                    <div class="audio-bars">
                      <span v-for="i in 22" :key="i" class="audio-bar" :style="{ height: (Math.sin(i*0.8)*8 + 10) + 'px' }"></span>
                    </div>
                    <div class="audio-meta">
                      <span class="audio-dur">{{ fmtDur(m.audio_duration ?? 0) }}</span>
                      <span class="audio-label">Nota de voz</span>
                    </div>
                  </div>
                </div>

                <!-- Location card -->
                <div v-else-if="m.type === 'location'" class="bubble__loc">
                  <div class="loc-card">
                    <div class="loc-card__map-preview">
                      <svg viewBox="0 0 120 60" width="100%" height="60">
                        <rect width="120" height="60" fill="#0d1b24"/>
                        <line x1="0" y1="30" x2="120" y2="30" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
                        <line x1="60" y1="0" x2="60" y2="60" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
                        <circle cx="60" cy="30" r="14" fill="rgba(114,176,77,0.18)" stroke="rgba(114,176,77,0.5)" stroke-width="1.5"/>
                        <circle cx="60" cy="30" r="4" fill="#72B04D"/>
                        <circle cx="60" cy="30" r="7" fill="rgba(114,176,77,0.35)"/>
                      </svg>
                    </div>
                    <div class="loc-card__body">
                      <div style="display:flex;align-items:center;gap:7px">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="loc-icon">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <div>
                          <p class="loc-label">{{ m.location?.label }}</p>
                          <p class="loc-coords">{{ m.location?.lat }}, {{ m.location?.lng }}</p>
                        </div>
                      </div>
                      <button class="loc-btn" @click="openMap(m.location!)">Ver en Mapa →</button>
                    </div>
                  </div>
                </div>

                <span class="bubble__time">{{ fmtTime(m.timestamp) }}</span>
              </div>
            </div>
          </TransitionGroup>
          <div ref="messagesEnd"></div>
        </div>

        <footer class="cc-foot">
          <textarea v-model="adminInput" class="cc-foot__input" placeholder="Escribe tu respuesta…" rows="1" @keydown="handleKey"></textarea>
          <button class="cc-foot__send" :disabled="!adminInput.trim()" @click="sendAdmin">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Enviar
          </button>
        </footer>
      </template>

      <div v-else class="cc-empty">
        <svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="30" stroke="rgba(114,176,77,0.18)" stroke-width="2"/><path d="M20 28h24M20 36h16" stroke="rgba(114,176,77,0.4)" stroke-width="2.5" stroke-linecap="round"/></svg>
        <p>Selecciona una conversación</p>
      </div>
    </main>

    <!-- ══ RIGHT: Case detail ════════════════════════════════════ -->
    <aside v-if="active" class="col-r">
      <!-- User card -->
      <div class="card">
        <div class="card__av" :style="{ background: active.color }">{{ active.initials }}</div>
        <p class="card__name">{{ active.name }}</p>
        <span class="ci__role" :class="`role--${active.role.toLowerCase()}`" style="margin-bottom:12px">{{ active.role }}</span>
        <ul class="card__info">
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            {{ active.email }}
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Desde {{ fmtDate(active.registered_at) }}
          </li>
        </ul>
      </div>

      <!-- Ticket status -->
      <div class="card">
        <p class="card__section-title">Estado del Ticket</p>
        <div class="ticket-opts">
          <button
            v-for="s in (['Abierto','En Proceso','Resuelto'] as TicketStatus[])"
            :key="s"
            class="t-btn"
            :class="[`t-btn--${s.toLowerCase().replace(' ','-')}`, { 't-btn--active': active.ticket_status === s }]"
            @click="setStatus(s)"
          >
            <span class="t-btn__dot"></span>
            {{ s }}
          </button>
        </div>
      </div>

      <!-- Internal notes -->
      <div class="card card--notes">
        <p class="card__section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:#FFD700" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Notas Internas
        </p>
        <textarea v-model="active.internal_notes" class="notes-ta" placeholder="Notas privadas del caso (solo tú las ves)…" rows="5"></textarea>
        <p class="notes-hint">Solo visibles para el equipo de soporte</p>
      </div>

      <!-- Stats -->
      <div class="card">
        <p class="card__section-title">Resumen</p>
        <div class="stats">
          <div class="stat">
            <span class="stat__n">{{ active.messages.length }}</span>
            <span class="stat__l">Mensajes</span>
          </div>
          <div class="stat">
            <span class="stat__n">{{ active.messages.filter(m=>m.sender_id==='user').length }}</span>
            <span class="stat__l">Del usuario</span>
          </div>
          <div class="stat">
            <span class="stat__n" :class="active.online ? 'n--on' : 'n--off'">{{ active.online ? 'Activo' : 'Ausente' }}</span>
            <span class="stat__l">Estado</span>
          </div>
        </div>
      </div>
    </aside>

    <aside v-else class="col-r col-r--empty">
      <div class="r-placeholder">
        <svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="18" r="9" stroke="rgba(114,176,77,0.2)" stroke-width="2"/><path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="rgba(114,176,77,0.2)" stroke-width="2" stroke-linecap="round"/></svg>
        <p>Selecciona un usuario</p>
      </div>
    </aside>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Roboto:wght@400;500&display=swap');

.ac {
  --eco:   #72B04D;
  --blue:  #0077b6;
  --sos:   #FFD700;
  --bg:    #0a0e12;
  --glass: rgba(14, 22, 30, 0.88);
  --glass2:rgba(18, 28, 38, 0.72);
  --gbord: 1px solid rgba(255,255,255,0.07);
  --tr:    all 0.3s cubic-bezier(0.4,0,0.2,1);
  --ft:    'Outfit', sans-serif;
  --fb:    'Roboto', sans-serif;
  display: grid; grid-template-columns: 295px 1fr 270px;
  height: 100vh; max-height: 860px;
  background: var(--bg); border-radius: 20px; overflow: hidden;
  border: var(--gbord); box-shadow: 0 8px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(114,176,77,0.06);
  font-family: var(--fb);
}
* { scrollbar-width: thin; scrollbar-color: rgba(114,176,77,0.22) transparent; }

/* ── LEFT ── */
.col-l { background: rgba(8,14,20,0.9); border-right: var(--gbord); display:flex; flex-direction:column; overflow:hidden; }
.col-l__top { padding: 18px 15px 10px; border-bottom: var(--gbord); flex-shrink:0; }
.col-l__head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.col-l__title { font-family:var(--ft); font-size:14.5px; font-weight:600; color:rgba(255,255,255,0.85); display:flex; align-items:center; gap:8px; }
.col-l__title-icon { width:17px; height:17px; color:var(--eco); }
.col-l__count { background:rgba(114,176,77,0.15); border:1px solid rgba(114,176,77,0.3); color:var(--eco); font-size:11px; font-weight:700; font-family:var(--ft); padding:2px 8px; border-radius:20px; }

.search { position:relative; }
.search__icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); width:14px; height:14px; color:rgba(255,255,255,0.28); pointer-events:none; }
.search__input { width:100%; background:rgba(255,255,255,0.05); border:var(--gbord); border-radius:10px; padding:8px 10px 8px 32px; color:rgba(255,255,255,0.8); font-family:var(--fb); font-size:13px; outline:none; transition:var(--tr); box-sizing:border-box; }
.search__input::placeholder { color:rgba(255,255,255,0.25); }
.search__input:focus { border-color:rgba(114,176,77,0.38); background:rgba(255,255,255,0.08); }

.chat-list { flex:1; overflow-y:auto; }
.ci { width:100%; display:flex; align-items:flex-start; gap:10px; padding:12px 15px; background:transparent; border:none; cursor:pointer; transition:var(--tr); border-left:3px solid transparent; text-align:left; }
.ci:hover { background:rgba(255,255,255,0.035); }
.ci--active { background:rgba(114,176,77,0.08); border-left-color:var(--eco); }
.ci__av { width:40px; height:40px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-family:var(--ft); font-weight:700; font-size:13px; color:#fff; position:relative; }
.ci__dot { position:absolute; bottom:0; right:0; width:10px; height:10px; border-radius:50%; border:2px solid #0a1218; }
.ci__dot--on  { background:#4ade80; box-shadow:0 0 7px rgba(74,222,128,0.9); }
.ci__dot--off { background:#6b7280; }
.ci__body { flex:1; min-width:0; }
.ci__row1 { display:flex; justify-content:space-between; align-items:baseline; gap:5px; margin-bottom:2px; }
.ci__name { font-family:var(--ft); font-size:13px; font-weight:600; color:rgba(255,255,255,0.88); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ci__time { font-size:10.5px; color:rgba(255,255,255,0.3); flex-shrink:0; }
.ci__row2 { display:flex; align-items:center; gap:5px; margin-bottom:5px; }
.ci__preview { font-size:11.5px; color:rgba(255,255,255,0.36); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }
.ci__badge { flex-shrink:0; background:var(--eco); color:#fff; font-size:9.5px; font-weight:700; width:17px; height:17px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 9px rgba(114,176,77,0.6); }
.ci__role { font-size:10.5px; font-weight:500; padding:2px 8px; border-radius:20px; display:inline-block; font-family:var(--ft); }
.role--voluntario { background:rgba(0,119,182,0.18); color:#4fc3f7; border:1px solid rgba(0,119,182,0.3); }
.role--actor      { background:rgba(114,176,77,0.15); color:#a5d67c; border:1px solid rgba(114,176,77,0.3); }
.list-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:40px 20px; color:rgba(255,255,255,0.22); }
.list-empty svg { width:36px; height:36px; }
.list-empty p { font-size:13px; margin:0; }

/* ── CENTER ── */
.col-c { display:flex; flex-direction:column; overflow:hidden; background:var(--glass); border-right:var(--gbord); }
.cc-head { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:var(--gbord); background:rgba(0,119,182,0.08); flex-shrink:0; }
.cc-head__user { display:flex; align-items:center; gap:11px; }
.cc-head__av { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:var(--ft); font-weight:700; font-size:13px; color:#fff; position:relative; flex-shrink:0; }
.cc-head__name { font-family:var(--ft); font-size:14.5px; font-weight:600; color:rgba(255,255,255,0.9); margin:0; }
.cc-head__sub { font-size:11px; color:rgba(255,255,255,0.38); margin:2px 0 0; }

/* Ticket status pill */
.status-pill { font-size:11px; font-weight:600; font-family:var(--ft); padding:4px 12px; border-radius:20px; }
.sp--abierto    { background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.35); box-shadow:0 0 10px rgba(239,68,68,0.2); }
.sp--en-proceso { background:rgba(255,215,0,0.14);  color:#FFD700; border:1px solid rgba(255,215,0,0.35);  box-shadow:0 0 10px rgba(255,215,0,0.25); }
.sp--resuelto   { background:rgba(74,222,128,0.14); color:#4ade80; border:1px solid rgba(74,222,128,0.35); box-shadow:0 0 10px rgba(74,222,128,0.25); }

.cc-body { flex:1; overflow-y:auto; padding:16px 18px; }
.cc-body__inner { display:flex; flex-direction:column; gap:10px; }

.row { display:flex; }
.row--admin { justify-content:flex-end; }
.row--user  { justify-content:flex-start; }
.bubble { max-width:74%; border-radius:16px; padding:10px 13px; display:flex; flex-direction:column; gap:5px; }
.bubble--admin { background:linear-gradient(135deg,rgba(0,119,182,0.52),rgba(0,119,182,0.3)); border:1px solid rgba(0,119,182,0.3); border-bottom-right-radius:4px; }
.bubble--user  { background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1); border-bottom-left-radius:4px; }
.bubble__text { font-family:var(--fb); font-size:13.5px; color:rgba(255,255,255,0.9); line-height:1.5; margin:0; word-break:break-word; }
.bubble__time { font-size:10px; color:rgba(255,255,255,0.3); align-self:flex-end; }

/* Image */
.bubble__img-wrap { display:flex; flex-direction:column; gap:5px; }
.bubble__img { width:100%; max-width:240px; border-radius:10px; object-fit:cover; display:block; border:1px solid rgba(255,255,255,0.1); }
.bubble__caption { font-family:var(--fb); font-size:11px; color:rgba(255,255,255,0.45); margin:0; }

/* Video */
.bubble__video-wrap { display:flex; flex-direction:column; gap:6px; }
.bubble__video {
  width:100%; max-width:260px; border-radius:10px; display:block;
  background:#000; outline:none; border:1px solid rgba(255,255,255,0.1);
  box-shadow:0 4px 16px rgba(0,0,0,0.4);
}
.bubble__video-placeholder {
  width:260px; height:120px; border-radius:10px;
  background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:8px; color:rgba(255,255,255,0.3);
}
.video-placeholder-icon { width:32px; height:32px; opacity:0.4; }
.bubble__video-placeholder span { font-family:var(--fb); font-size:11.5px; }
.bubble__video-meta { display:flex; align-items:center; gap:6px; }
.video-meta-icon { width:13px; height:13px; color:rgba(255,255,255,0.4); flex-shrink:0; }

/* Audio */
.bubble__audio { display:flex; align-items:center; gap:10px; min-width:210px; }
.audio-play { width:34px; height:34px; border-radius:50%; border:1px solid rgba(114,176,77,0.4); background:rgba(114,176,77,0.15); color:var(--eco); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:var(--tr); }
.audio-play:hover { background:rgba(114,176,77,0.3); }
.audio-play svg { width:14px; height:14px; }
.audio-track { flex:1; display:flex; flex-direction:column; gap:4px; }
.audio-bars { display:flex; align-items:center; gap:2px; }
.audio-bar { width:3px; border-radius:2px; background:linear-gradient(to top, var(--blue), var(--eco)); opacity:0.65; flex-shrink:0; }
.audio-meta { display:flex; justify-content:space-between; }
.audio-dur { font-family:var(--fb); font-size:10.5px; color:rgba(255,255,255,0.45); }
.audio-label { font-family:var(--fb); font-size:10.5px; color:rgba(255,255,255,0.28); }

/* Location */
.bubble__loc { min-width:220px; }
.loc-card { background:rgba(0,0,0,0.25); border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); }
.loc-card__map-preview { width:100%; overflow:hidden; }
.loc-card__body { padding:10px 12px; display:flex; flex-direction:column; gap:8px; }
.loc-icon { width:20px; height:20px; color:var(--sos); flex-shrink:0; }
.loc-label { font-family:var(--ft); font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.9); margin:0; }
.loc-coords { font-family:var(--fb); font-size:10.5px; color:rgba(255,255,255,0.38); margin:2px 0 0; }
.loc-btn { padding:7px 12px; background:rgba(114,176,77,0.16); border:1px solid rgba(114,176,77,0.32); color:var(--eco); border-radius:9px; font-family:var(--ft); font-size:12px; font-weight:600; cursor:pointer; transition:var(--tr); }
.loc-btn:hover { background:rgba(114,176,77,0.28); }

.msg-enter-active{transition:opacity .22s ease,transform .24s cubic-bezier(.4,0,.2,1)}
.msg-enter-from{opacity:0;transform:translateY(7px)}

.cc-foot { display:flex; align-items:flex-end; gap:9px; padding:13px 18px; border-top:var(--gbord); background:rgba(0,0,0,0.15); flex-shrink:0; }
.cc-foot__input { flex:1; background:rgba(255,255,255,0.06); border:var(--gbord); border-radius:12px; padding:9px 13px; color:rgba(255,255,255,0.88); font-family:var(--fb); font-size:13.5px; resize:none; outline:none; transition:var(--tr); max-height:96px; overflow-y:auto; }
.cc-foot__input::placeholder { color:rgba(255,255,255,0.26); }
.cc-foot__input:focus { border-color:rgba(0,119,182,0.4); background:rgba(255,255,255,0.09); box-shadow:0 0 12px rgba(0,119,182,0.14); }
.cc-foot__send { display:flex; align-items:center; gap:7px; padding:9px 18px; background:linear-gradient(135deg,var(--blue),#005f92); border:none; border-radius:11px; color:#fff; font-family:var(--ft); font-size:13px; font-weight:600; cursor:pointer; transition:var(--tr); flex-shrink:0; box-shadow:0 0 14px rgba(0,119,182,0.3); }
.cc-foot__send svg { width:15px; height:15px; }
.cc-foot__send:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 4px 18px rgba(0,119,182,0.55); }
.cc-foot__send:disabled { opacity:.35; cursor:default; }
.cc-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; color:rgba(255,255,255,0.2); }
.cc-empty svg { width:60px; height:60px; }
.cc-empty p { font-size:13.5px; }

/* ── RIGHT ── */
.col-r { background:rgba(8,14,20,0.78); display:flex; flex-direction:column; gap:11px; padding:16px 14px; overflow-y:auto; }
.col-r--empty { align-items:center; justify-content:center; }
.r-placeholder { display:flex; flex-direction:column; align-items:center; gap:14px; color:rgba(255,255,255,0.2); }
.r-placeholder svg { width:54px; height:54px; }
.r-placeholder p { font-size:13px; }

/* Cards */
.card { background:var(--glass2); border:var(--gbord); border-radius:16px; padding:16px; display:flex; flex-direction:column; align-items:center; gap:6px; backdrop-filter:blur(10px); }
.card--notes { align-items:stretch; }
.card__av { width:54px; height:54px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:var(--ft); font-weight:700; font-size:18px; color:#fff; box-shadow:0 0 18px rgba(0,0,0,0.45); margin-bottom:4px; }
.card__name { font-family:var(--ft); font-size:14.5px; font-weight:600; color:rgba(255,255,255,0.9); margin:0; }
.card__info { list-style:none; margin:6px 0 0; padding:0; width:100%; display:flex; flex-direction:column; gap:7px; }
.card__info li { display:flex; align-items:center; gap:8px; font-size:11px; color:rgba(255,255,255,0.45); }
.card__info li svg { width:13px; height:13px; flex-shrink:0; color:var(--blue); }
.card__section-title { font-family:var(--ft); font-size:11px; font-weight:600; color:rgba(255,255,255,0.45); text-transform:uppercase; letter-spacing:0.08em; margin:0 0 10px; display:flex; align-items:center; gap:6px; align-self:flex-start; }

/* Ticket buttons */
.ticket-opts { display:flex; flex-direction:column; gap:7px; width:100%; }
.t-btn { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.07); background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.42); font-family:var(--ft); font-size:12.5px; font-weight:500; cursor:pointer; transition:var(--tr); text-align:left; width:100%; }
.t-btn:hover { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.7); }
.t-btn__dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; background:currentColor; opacity:0.7; }

/* Active ticket states with glow */
.t-btn--abierto.t-btn--active    { background:rgba(239,68,68,0.2);   color:#f87171; border-color:rgba(239,68,68,0.4);   box-shadow:0 0 14px rgba(239,68,68,0.25),  inset 0 0 8px rgba(239,68,68,0.08); }
.t-btn--en-proceso.t-btn--active  { background:rgba(255,215,0,0.15);   color:#FFD700; border-color:rgba(255,215,0,0.4);    box-shadow:0 0 14px rgba(255,215,0,0.25),   inset 0 0 8px rgba(255,215,0,0.08); }
.t-btn--resuelto.t-btn--active    { background:rgba(74,222,128,0.15);  color:#4ade80; border-color:rgba(74,222,128,0.4);   box-shadow:0 0 14px rgba(74,222,128,0.28),  inset 0 0 8px rgba(74,222,128,0.1); }

/* Notes */
.notes-ta { width:100%; background:rgba(255,255,255,0.04); border:var(--gbord); border-radius:10px; padding:10px 12px; color:rgba(255,255,255,0.78); font-family:var(--fb); font-size:12.5px; line-height:1.55; resize:none; outline:none; transition:var(--tr); box-sizing:border-box; }
.notes-ta::placeholder { color:rgba(255,255,255,0.2); }
.notes-ta:focus { border-color:rgba(255,215,0,0.33); background:rgba(255,255,255,0.07); box-shadow:0 0 10px rgba(255,215,0,0.1); }
.notes-hint { font-size:10.5px; color:rgba(255,255,255,0.22); margin:5px 0 0; align-self:flex-start; }

/* Stats */
.stats { display:flex; gap:5px; justify-content:stretch; width:100%; }
.stat { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; background:rgba(255,255,255,0.04); border-radius:10px; padding:9px 4px; border:var(--gbord); }
.stat__n { font-family:var(--ft); font-size:18px; font-weight:700; color:rgba(255,255,255,0.85); }
.stat__l { font-size:9.5px; color:rgba(255,255,255,0.32); text-align:center; }
.n--on { color:#4ade80; font-size:11px; }
.n--off { color:rgba(255,255,255,0.4); font-size:11px; }
</style>
