<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'

// ── Types ──────────────────────────────────────────────────────────────────
type MsgType = 'text' | 'image' | 'video' | 'audio' | 'location'

interface LocationPayload { lat: number; lng: number; label: string }

interface Message {
  id: string
  sender_id: 'user' | 'support'
  type: MsgType
  text?: string
  image_url?: string
  video_url?: string
  audio_url?: string
  audio_duration?: number
  location?: LocationPayload
  timestamp: Date
  read: boolean
}

// ── State ──────────────────────────────────────────────────────────────────
const isOpen        = ref(false)
const inputText     = ref('')
const isTyping      = ref(false)
const isRecording   = ref(false)
const recordSeconds = ref(0)
const fileInputRef  = ref<HTMLInputElement | null>(null)
const messagesEndRef = ref<HTMLElement | null>(null)
const supportOnline = ref(true)
let recordTimer: ReturnType<typeof setInterval> | null = null

const messages = ref<Message[]>([
  {
    id: '1', sender_id: 'support', type: 'text',
    text: '¡Hola! Bienvenido/a al Soporte EcoGuía SOS 🌿. ¿En qué puedo ayudarte hoy?',
    timestamp: new Date(Date.now() - 1000 * 60 * 5), read: true,
  },
  {
    id: '2', sender_id: 'user', type: 'text',
    text: 'No puedo subir las fotos de mi recorrido en la sección de lugares.',
    timestamp: new Date(Date.now() - 1000 * 60 * 3), read: true,
  },
  {
    id: '3', sender_id: 'support', type: 'text',
    text: 'Entendido. ¿Puedes compartirme una captura del error que ves?',
    timestamp: new Date(Date.now() - 1000 * 60 * 2), read: false,
  },
])

// ── Computed ───────────────────────────────────────────────────────────────
const unreadCount = computed(
  () => messages.value.filter(m => m.sender_id === 'support' && !m.read).length
)

// ── Helpers ────────────────────────────────────────────────────────────────
function gid() { return Math.random().toString(36).slice(2, 9) }
function fmtTime(d: Date) {
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}
function fmtDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

async function scrollToBottom() {
  await nextTick()
  messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
}

function simSupportReply(delay = 2000) {
  isTyping.value = true
  setTimeout(() => {
    isTyping.value = false
    messages.value.push({
      id: gid(), sender_id: 'support', type: 'text',
      text: 'Gracias, ya recibí tu mensaje. Estoy revisando el caso ahora mismo. 🌱',
      timestamp: new Date(), read: isOpen.value,
    })
    scrollToBottom()
  }, delay)
}

// ── Actions ────────────────────────────────────────────────────────────────
function toggleChat() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    messages.value.forEach(m => { m.read = true })
    scrollToBottom()
  }
}

function sendText() {
  const text = inputText.value.trim()
  if (!text) return
  messages.value.push({ id: gid(), sender_id: 'user', type: 'text', text, timestamp: new Date(), read: true })
  inputText.value = ''
  scrollToBottom()
  simSupportReply()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() }
}

// Image / Video attach
function triggerFile() { fileInputRef.value?.click() }
function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  const isVideo = file.type.startsWith('video/')
  messages.value.push({
    id: gid(), sender_id: 'user',
    type: isVideo ? 'video' : 'image',
    ...(isVideo ? { video_url: url } : { image_url: url }),
    text: file.name,
    timestamp: new Date(), read: true,
  })
  scrollToBottom()
  simSupportReply(2500)
  ;(e.target as HTMLInputElement).value = ''
}

// Voice note (simulated)
function toggleRecording() {
  if (!isRecording.value) {
    isRecording.value = true
    recordSeconds.value = 0
    recordTimer = setInterval(() => { recordSeconds.value++ }, 1000)
  } else {
    isRecording.value = false
    if (recordTimer) clearInterval(recordTimer)
    const duration = recordSeconds.value || 3
    messages.value.push({
      id: gid(), sender_id: 'user', type: 'audio',
      audio_duration: duration,
      timestamp: new Date(), read: true,
    })
    scrollToBottom()
    simSupportReply(2000)
  }
}

// Location
function shareLocation() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      messages.value.push({
        id: gid(), sender_id: 'user', type: 'location',
        location: {
          lat: parseFloat(pos.coords.latitude.toFixed(5)),
          lng: parseFloat(pos.coords.longitude.toFixed(5)),
          label: 'Mi ubicación actual',
        },
        timestamp: new Date(), read: true,
      })
      scrollToBottom()
      simSupportReply()
    },
    () => {
      // Fallback simulated location
      messages.value.push({
        id: gid(), sender_id: 'user', type: 'location',
        location: { lat: 19.43260, lng: -99.13320, label: 'Mi ubicación actual' },
        timestamp: new Date(), read: true,
      })
      scrollToBottom()
      simSupportReply()
    }
  )
}

function openMap(loc: LocationPayload) {
  window.open(`https://maps.google.com/?q=${loc.lat},${loc.lng}`, '_blank')
}

onUnmounted(() => { if (recordTimer) clearInterval(recordTimer) })
</script>

<template>
  <div class="widget-root">
    <!-- ── FAB ──────────────────────────────────────────────────── -->
    <button class="fab" :class="{ 'fab--open': isOpen }" @click="toggleChat" aria-label="Soporte EcoGuía">
      <Transition name="fab-icon" mode="out-in">
        <svg v-if="!isOpen" key="msg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <svg v-else key="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </Transition>
      <span v-if="unreadCount > 0 && !isOpen" class="fab__badge">{{ unreadCount }}</span>
    </button>

    <!-- ── Chat Window ───────────────────────────────────────────── -->
    <Transition name="win">
      <div v-if="isOpen" class="chat-win" role="dialog" aria-label="Chat de soporte">

        <!-- Header -->
        <header class="cw-header">
          <div class="cw-header__left">
            <div class="cw-header__av-wrap">
              <svg class="cw-header__av" viewBox="0 0 44 44">
                <defs>
                  <linearGradient id="avG" x1="0" y1="0" x2="44" y2="44">
                    <stop stop-color="#0077b6"/><stop offset="1" stop-color="#72B04D"/>
                  </linearGradient>
                </defs>
                <circle cx="22" cy="22" r="22" fill="url(#avG)"/>
                <circle cx="22" cy="17" r="8" fill="rgba(255,255,255,0.85)"/>
                <ellipse cx="22" cy="37" rx="12" ry="9" fill="rgba(255,255,255,0.85)"/>
              </svg>
              <span class="dot" :class="supportOnline ? 'dot--on' : 'dot--off'"></span>
            </div>
            <div>
              <p class="cw-header__name">Soporte EcoGuía SOS</p>
              <p class="cw-header__status">{{ supportOnline ? 'Administración · En línea' : 'Fuera de línea' }}</p>
            </div>
          </div>
          <button class="icon-btn" @click="toggleChat" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        <!-- Body -->
        <div class="cw-body">
          <TransitionGroup name="msg" tag="div" class="cw-body__inner">
            <div v-for="m in messages" :key="m.id" class="row" :class="m.sender_id === 'user' ? 'row--user' : 'row--support'">
              <div class="bubble" :class="m.sender_id === 'user' ? 'bubble--user' : 'bubble--support'">

                <!-- Text -->
                <p v-if="m.type === 'text'" class="bubble__text">{{ m.text }}</p>

                <!-- Image -->
                <div v-else-if="m.type === 'image'" class="bubble__img-wrap">
                  <img :src="m.image_url" :alt="m.text" class="bubble__img" />
                  <p v-if="m.text" class="bubble__caption">{{ m.text }}</p>
                </div>

                <!-- Video -->
                <div v-else-if="m.type === 'video'" class="bubble__video-wrap">
                  <video :src="m.video_url" class="bubble__video" controls preload="metadata">
                    Tu navegador no soporta video.
                  </video>
                  <div class="bubble__video-meta">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="video-meta-icon" aria-hidden="true">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                    <p class="bubble__caption">{{ m.text }}</p>
                  </div>
                </div>

                <!-- Audio -->
                <div v-else-if="m.type === 'audio'" class="bubble__audio">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="audio-icon">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  <div class="audio-bars">
                    <span v-for="i in 18" :key="i" class="audio-bar" :style="{ height: (Math.random() * 16 + 4) + 'px' }"></span>
                  </div>
                  <span class="audio-dur">{{ fmtDuration(m.audio_duration ?? 0) }}</span>
                </div>

                <!-- Location -->
                <div v-else-if="m.type === 'location'" class="bubble__loc">
                  <div class="loc-header">
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

                <span class="bubble__time">{{ fmtTime(m.timestamp) }}</span>
              </div>
            </div>

            <!-- Typing indicator -->
            <div v-if="isTyping" key="typing" class="row row--support">
              <div class="bubble bubble--support bubble--typing">
                <span class="tdot"></span><span class="tdot"></span><span class="tdot"></span>
              </div>
            </div>
          </TransitionGroup>
          <div ref="messagesEndRef"></div>
        </div>

        <!-- Recording bar -->
        <Transition name="recbar">
          <div v-if="isRecording" class="rec-bar">
            <span class="rec-dot"></span>
            <span class="rec-label">Grabando {{ fmtDuration(recordSeconds) }}</span>
            <button class="rec-cancel" @click="isRecording = false; if(recordTimer) clearInterval(recordTimer)">Cancelar</button>
          </div>
        </Transition>

        <!-- Footer -->
        <footer class="cw-footer">
          <input ref="fileInputRef" type="file" class="sr-only" accept="image/*,video/*,.mp4,.mov,.webm" @change="handleFileSelect" />
          <div class="cw-footer__actions">
            <!-- Attach image/video -->
            <button class="tool-btn" @click="triggerFile" title="Adjuntar imagen o video">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <!-- Voice note -->
            <button class="tool-btn" :class="{ 'tool-btn--recording': isRecording }" @click="toggleRecording" title="Nota de voz">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
            <!-- Location -->
            <button class="tool-btn" @click="shareLocation" title="Compartir ubicación">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </button>
          </div>
          <textarea v-model="inputText" class="cw-footer__input" placeholder="Escribe tu mensaje…" rows="1" @keydown="handleKeydown"></textarea>
          <button class="send-btn" :disabled="!inputText.trim() && !isRecording" @click="sendText" aria-label="Enviar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </footer>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Roboto:wght@400;500&display=swap');

.widget-root {
  --eco:   #72B04D;
  --blue:  #0077b6;
  --sos:   #FFD700;
  --bg:    #0a0e12;
  --glass: rgba(18, 28, 36, 0.88);
  --gbord: 1px solid rgba(255,255,255,0.08);
  --tr:    all 0.3s cubic-bezier(0.4,0,0.2,1);
  --ft:    'Outfit', sans-serif;
  --fb:    'Roboto', sans-serif;
  position: fixed; bottom: 28px; right: 28px; z-index: 9999;
  display: flex; flex-direction: column; align-items: flex-end; gap: 14px;
}

/* FAB */
.fab {
  position: relative; width: 60px; height: 60px; border-radius: 50%; border: none;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--blue), var(--eco));
  box-shadow: 0 4px 22px rgba(0,119,182,0.45), 0 0 0 0 rgba(114,176,77,0);
  transition: var(--tr); outline: none; color: #fff;
}
.fab:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(0,119,182,0.6), 0 0 22px rgba(114,176,77,0.3); }
.fab--open { background: rgba(20,32,40,0.9); box-shadow: 0 4px 18px rgba(0,0,0,0.5); }
.fab svg { width: 26px; height: 26px; }
.fab__badge {
  position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px;
  border-radius: 10px; background: var(--sos); color: #0a0e12;
  font-family: var(--ft); font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; padding: 0 5px;
  box-shadow: 0 0 12px rgba(255,215,0,0.8); animation: badge-pulse 2s ease-in-out infinite;
}
@keyframes badge-pulse { 0%,100%{box-shadow:0 0 10px rgba(255,215,0,0.7)} 50%{box-shadow:0 0 22px rgba(255,215,0,1)} }

.fab-icon-enter-active,.fab-icon-leave-active{transition:opacity .15s,transform .15s}
.fab-icon-enter-from,.fab-icon-leave-to{opacity:0;transform:scale(0.7)}

/* Chat window */
.chat-win {
  width: 370px; height: 560px; border-radius: 22px;
  background: var(--glass); border: var(--gbord);
  backdrop-filter: blur(22px) saturate(1.3);
  -webkit-backdrop-filter: blur(22px) saturate(1.3);
  box-shadow: 0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(114,176,77,0.07);
  display: flex; flex-direction: column; overflow: hidden;
}
.win-enter-active,.win-leave-active{transition:opacity .28s ease,transform .3s cubic-bezier(.4,0,.2,1)}
.win-enter-from,.win-leave-to{opacity:0;transform:translateY(18px) scale(.95)}

/* Header */
.cw-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 15px 18px;
  background: linear-gradient(135deg,rgba(0,119,182,0.22),rgba(114,176,77,0.14));
  border-bottom: var(--gbord); flex-shrink: 0;
}
.cw-header__left { display: flex; align-items: center; gap: 11px; }
.cw-header__av-wrap { position: relative; flex-shrink: 0; }
.cw-header__av { width: 44px; height: 44px; border-radius: 50%; display: block; border: 2px solid rgba(114,176,77,0.4); box-shadow: 0 0 14px rgba(114,176,77,0.25); }
.dot {
  position: absolute; bottom: 1px; right: 1px; width: 11px; height: 11px;
  border-radius: 50%; border: 2px solid #0d1b24;
}
.dot--on  { background: #4ade80; box-shadow: 0 0 8px rgba(74,222,128,0.9); animation: blink 2.5s ease-in-out infinite; }
.dot--off { background: #f97316; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.45} }
.cw-header__name { font-family: var(--ft); font-size: 14px; font-weight: 600; color: #e8f0ee; margin: 0; }
.cw-header__status { font-family: var(--fb); font-size: 11.5px; color: rgba(255,255,255,0.4); margin: 2px 0 0; }

.icon-btn {
  width: 30px; height: 30px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5);
  display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--tr);
}
.icon-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
.icon-btn svg { width: 15px; height: 15px; }

/* Body */
.cw-body { flex: 1; overflow-y: auto; padding: 14px 13px; scrollbar-width: thin; scrollbar-color: rgba(114,176,77,0.25) transparent; }
.cw-body__inner { display: flex; flex-direction: column; gap: 10px; }

/* Messages */
.row { display: flex; }
.row--user    { justify-content: flex-end; }
.row--support { justify-content: flex-start; }

.bubble {
  max-width: 80%; border-radius: 16px; padding: 10px 13px;
  display: flex; flex-direction: column; gap: 5px;
}
.bubble--user {
  background: linear-gradient(135deg, rgba(0,119,182,0.55), rgba(114,176,77,0.38));
  border: 1px solid rgba(0,119,182,0.3); border-bottom-right-radius: 4px;
}
.bubble--support {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
  border-bottom-left-radius: 4px;
}
.bubble--typing { flex-direction: row; align-items: center; gap: 5px; padding: 12px 16px; }

.bubble__text { font-family: var(--fb); font-size: 13.5px; color: rgba(255,255,255,0.9); line-height: 1.5; margin: 0; word-break: break-word; }
.bubble__time { font-family: var(--fb); font-size: 10px; color: rgba(255,255,255,0.3); align-self: flex-end; }

/* Image bubble */
.bubble__img-wrap { display: flex; flex-direction: column; gap: 5px; }
.bubble__img { width: 100%; max-width: 220px; border-radius: 10px; object-fit: cover; display: block; }
.bubble__caption { font-family: var(--fb); font-size: 11.5px; color: rgba(255,255,255,0.55); margin: 0; }

/* Video bubble */
.bubble__video-wrap { display: flex; flex-direction: column; gap: 6px; }
.bubble__video {
  width: 100%; max-width: 240px; border-radius: 10px; display: block;
  background: #000; outline: none;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.bubble__video-meta { display: flex; align-items: center; gap: 6px; }
.video-meta-icon { width: 13px; height: 13px; color: rgba(255,255,255,0.4); flex-shrink: 0; }

/* Audio bubble */
.bubble__audio {
  display: flex; align-items: center; gap: 8px; min-width: 180px;
}
.audio-icon { width: 20px; height: 20px; color: var(--eco); flex-shrink: 0; cursor: pointer; }
.audio-bars { display: flex; align-items: center; gap: 2px; flex: 1; }
.audio-bar { width: 3px; border-radius: 2px; background: linear-gradient(to top, var(--blue), var(--eco)); opacity: 0.7; flex-shrink: 0; }
.audio-dur { font-family: var(--fb); font-size: 11px; color: rgba(255,255,255,0.5); flex-shrink: 0; }

/* Location bubble */
.bubble__loc { display: flex; flex-direction: column; gap: 9px; min-width: 200px; }
.loc-header { display: flex; align-items: center; gap: 9px; }
.loc-icon { width: 22px; height: 22px; color: var(--sos); flex-shrink: 0; }
.loc-label { font-family: var(--ft); font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.9); margin: 0; }
.loc-coords { font-family: var(--fb); font-size: 10.5px; color: rgba(255,255,255,0.4); margin: 2px 0 0; }
.loc-btn {
  padding: 7px 12px; background: rgba(114,176,77,0.18); border: 1px solid rgba(114,176,77,0.35);
  color: var(--eco); border-radius: 9px; font-family: var(--ft); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: var(--tr);
}
.loc-btn:hover { background: rgba(114,176,77,0.3); }

/* Typing dots */
.tdot { width: 7px; height: 7px; border-radius: 50%; background: rgba(114,176,77,0.7); display: inline-block; animation: tdot 1.2s ease-in-out infinite; }
.tdot:nth-child(2){ animation-delay:.2s } .tdot:nth-child(3){ animation-delay:.4s }
@keyframes tdot { 0%,80%,100%{transform:translateY(0);opacity:.5} 40%{transform:translateY(-6px);opacity:1} }

.msg-enter-active{transition:opacity .22s ease,transform .24s cubic-bezier(.4,0,.2,1)}
.msg-enter-from{opacity:0;transform:translateY(8px)}

/* Recording bar */
.rec-bar {
  display: flex; align-items: center; gap: 10px; padding: 10px 16px;
  background: rgba(239,68,68,0.12); border-top: 1px solid rgba(239,68,68,0.2); flex-shrink: 0;
}
.rec-dot { width: 10px; height: 10px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 10px rgba(239,68,68,0.8); animation: rec-blink 1s ease-in-out infinite; }
@keyframes rec-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
.rec-label { font-family: var(--fb); font-size: 12.5px; color: #fca5a5; flex: 1; }
.rec-cancel { font-family: var(--ft); font-size: 12px; color: rgba(255,255,255,0.45); background: none; border: none; cursor: pointer; }
.recbar-enter-active,.recbar-leave-active{transition:opacity .2s,transform .2s}
.recbar-enter-from,.recbar-leave-to{opacity:0;transform:translateY(4px)}

/* Footer */
.cw-footer {
  display: flex; align-items: flex-end; gap: 7px; padding: 11px 13px;
  border-top: var(--gbord); background: rgba(0,0,0,0.18); flex-shrink: 0;
}
.cw-footer__actions { display: flex; flex-direction: column; gap: 4px; }
.tool-btn {
  width: 32px; height: 32px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.09);
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.45);
  display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--tr);
}
.tool-btn svg { width: 16px; height: 16px; }
.tool-btn:hover { background: rgba(0,119,182,0.22); color: #4fc3f7; border-color: rgba(0,119,182,0.35); }
.tool-btn--recording { background: rgba(239,68,68,0.2) !important; color: #fca5a5 !important; border-color: rgba(239,68,68,0.4) !important; }
.cw-footer__input {
  flex: 1; background: rgba(255,255,255,0.06); border: var(--gbord); border-radius: 12px;
  padding: 9px 13px; color: rgba(255,255,255,0.88); font-family: var(--fb); font-size: 13.5px;
  resize: none; outline: none; transition: var(--tr); max-height: 90px; overflow-y: auto;
}
.cw-footer__input::placeholder { color: rgba(255,255,255,0.28); }
.cw-footer__input:focus { border-color: rgba(114,176,77,0.4); background: rgba(255,255,255,0.09); box-shadow: 0 0 14px rgba(114,176,77,0.12); }
.send-btn {
  width: 40px; height: 40px; border-radius: 50%; border: none; flex-shrink: 0;
  background: linear-gradient(135deg, var(--blue), var(--eco)); color: #fff;
  display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--tr);
  box-shadow: 0 0 14px rgba(0,119,182,0.35);
}
.send-btn svg { width: 17px; height: 17px; }
.send-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 18px rgba(0,119,182,0.6); }
.send-btn:disabled { opacity: 0.35; cursor: default; }
.sr-only { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0 }
</style>
