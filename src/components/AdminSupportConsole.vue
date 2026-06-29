<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'

// ── Types ──────────────────────────────────────────────────────────────────
type TicketStatus = 'Abierto' | 'En Proceso' | 'Resuelto'
type UserRole     = 'Voluntario' | 'Actor'
type MsgType      = 'text' | 'image' | 'video' | 'audio' | 'location'

interface LocationPayload { lat: number; lng: number; label: string }

interface Message {
  id: string; sender_id: 'user' | 'admin'; type: MsgType
  text?: string; image_url?: string; video_url?: string
  audio_url?: string
  audio_duration?: number; location?: LocationPayload
  timestamp: Date; read: boolean
}

interface ChatUser {
  id: string; name: string; email: string; role: UserRole
  color: string; initials: string; avatar_url?: string
  registered_at: Date; last_seen: Date; online: boolean
  ticket_status: TicketStatus; internal_notes: string
  messages: Message[]
}

// ── State ──────────────────────────────────────────────────────────────────
const authStore    = useAuthStore()
const mockUsers    = ref<ChatUser[]>([])
const activeId     = ref<string | null>(null)
const searchQuery  = ref('')
const adminInput   = ref('')
const messagesEnd  = ref<HTMLElement | null>(null)

let globalChannel: any = null

// ── Computed ───────────────────────────────────────────────────────────────
const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return mockUsers.value.filter(u =>
    u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  )
})
const active = computed(() => mockUsers.value.find(u => u.id === activeId.value) ?? null)

function unread(uid: string) {
  const u = mockUsers.value.find(u => u.id === uid)
  if (!u) return 0
  if (u.ticket_status === 'Resuelto' || activeId.value === uid) return 0
  return u.messages.filter(m => !m.read && m.sender_id === 'user').length
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
  if (m.type === 'image')    return '📷 Imagen'
  if (m.type === 'video')    return '🎬 Video'
  if (m.type === 'audio')    return '🎙️ Nota de voz'
  if (m.type === 'location') return '📍 Ubicación'
  const pre = m.sender_id === 'admin' ? 'Tú: ' : ''
  return pre + (m.text ?? '').slice(0,45) + ((m.text?.length ?? 0) > 45 ? '…' : '')
}

async function scrollToBottom() { await nextTick(); messagesEnd.value?.scrollIntoView({behavior:'smooth'}) }

// ── DB Connection ──────────────────────────────────────────────────────────
async function loadConversations() {
  try {
    const { data, error } = await supabase
      .from('conversaciones_soporte')
      .select('*, perfiles:usuario_id(*), mensajes_soporte(*)')
      .order('updated_at', { ascending: false })

    if (error) throw error

    mockUsers.value = data.map((c: any) => {
      const profile = c.perfiles
      const email = profile?.email || 'invitado@ecoguia.mx'
      const name = profile?.nombre_completo || email.split('@')[0]
      const role = (profile?.rol === 'actor' ? 'Actor' : 'Voluntario') as UserRole
      
      const initials = name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
      
      const color = profile?.rol === 'actor' ? '#72B04D' : '#0077b6'
      
      const rawMsgs = c.mensajes_soporte || []
      rawMsgs.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      const messages: Message[] = rawMsgs.map((m: any) => ({
        id: m.id,
        sender_id: m.sender_role === 'admin' ? 'admin' : 'user',
        type: m.type as MsgType,
        text: m.text,
        image_url: m.image_url,
        video_url: m.video_url,
        audio_url: m.audio_url,
        audio_duration: m.audio_duration,
        location: m.location,
        timestamp: new Date(m.created_at),
        read: m.read
      }))

      const avatar_url = profile?.avatar_url || profile?.imagen_url || ''

      return {
        id: c.id,
        name,
        email,
        role,
        color,
        initials,
        avatar_url,
        registered_at: new Date(profile?.created_at || c.created_at),
        last_seen: new Date(profile?.updated_at || c.updated_at),
        online: false,
        ticket_status: (c.estado || 'Abierto') as TicketStatus,
        internal_notes: c.nota_interna || '',
        messages
      }
    })

    // Si hay un chat activo seleccionado, asegurar que se mantenga seleccionado
    if (activeId.value && !mockUsers.value.some(u => u.id === activeId.value)) {
      activeId.value = mockUsers.value[0]?.id || null
    }
  } catch (e) {
    console.error('Error al cargar conversaciones:', e)
  }
}

function subscribeGlobal() {
  if (globalChannel) {
    supabase.removeChannel(globalChannel)
  }

  globalChannel = supabase.channel('support_global_inbox')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mensajes_soporte' },
      async (payload) => {
        await loadConversations()
        
        // Si el mensaje es para la conversación activa y viene del usuario, marcarlo como leído
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as any
          if (newMsg.conversacion_id === activeId.value && newMsg.sender_role === 'user') {
            await supabase.from('mensajes_soporte').update({ read: true }).eq('id', newMsg.id)
            // Marcar localmente también
            const u = mockUsers.value.find(user => user.id === activeId.value)
            if (u) {
              const localMsg = u.messages.find(m => m.id === newMsg.id)
              if (localMsg) localMsg.read = true
            }
          }
        }
        scrollToBottom()
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'conversaciones_soporte' },
      async () => {
        await loadConversations()
      }
    )
    .subscribe()
}

// ── Actions ────────────────────────────────────────────────────────────────
async function selectUser(uid: string) {
  activeId.value = uid
  
  // Marcar todos los mensajes como leídos en la base de datos
  const { error } = await supabase
    .from('mensajes_soporte')
    .update({ read: true })
    .eq('conversacion_id', uid)
    .eq('sender_role', 'user')

  if (!error) {
    const u = mockUsers.value.find(user => user.id === uid)
    if (u) {
      u.messages.forEach(m => {
        if (m.sender_id === 'user') m.read = true
      })
    }
  }
  
  scrollToBottom()
}

async function sendAdmin() {
  if (isRecording.value) {
    stopRecording(false)
    return
  }
  const text = adminInput.value.trim()
  if (!text || !active.value || !authStore.user) return

  const targetConvId = active.value.id
  adminInput.value = ''

  const { error } = await supabase
    .from('mensajes_soporte')
    .insert({
      conversacion_id: targetConvId,
      sender_id: authStore.user.id,
      sender_role: 'admin',
      type: 'text',
      text
    })

  if (error) {
    console.error('Error al enviar respuesta de administrador:', error.message)
  } else {
    // Actualizar updated_at de la conversación para que suba en la lista
    await supabase
      .from('conversaciones_soporte')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', targetConvId)
    
    scrollToBottom()
  }
}

function handleKey(e: KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAdmin() } }

async function setStatus(s: TicketStatus) {
  if (!active.value) return
  const { error } = await supabase
    .from('conversaciones_soporte')
    .update({ estado: s })
    .eq('id', active.value.id)

  if (error) {
    console.error('Error al actualizar estado:', error.message)
  } else {
    active.value.ticket_status = s
  }
}

function openMap(loc: LocationPayload) { window.open(`https://maps.google.com/?q=${loc.lat},${loc.lng}`,'_blank') }

// Guardar notas internas de forma reactiva con lazy binding (al perder foco)
watch(
  () => active.value?.internal_notes,
  async (newNotes, oldNotes) => {
    if (newNotes !== undefined && oldNotes !== undefined && active.value) {
      await supabase
        .from('conversaciones_soporte')
        .update({ nota_interna: newNotes })
        .eq('id', active.value.id)
    }
  }
)

onMounted(async () => {
  await loadConversations()
  subscribeGlobal()
  const firstUser = mockUsers.value[0]
  if (firstUser) {
    selectUser(firstUser.id)
  }
})

onUnmounted(() => {
  if (globalChannel) {
    supabase.removeChannel(globalChannel)
  }
})


const fileInputRef = ref<HTMLInputElement | null>(null)
const isRecording = ref(false)
const recordSeconds = ref(0)
let recordTimer: ReturnType<typeof setInterval> | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []

const playingAudioId = ref<string | null>(null)
let activeAudio: HTMLAudioElement | null = null

function togglePlayAudio(msgId: string, url: string) {
  if (playingAudioId.value === msgId) {
    if (activeAudio) activeAudio.pause()
    playingAudioId.value = null
  } else {
    if (activeAudio) activeAudio.pause()
    playingAudioId.value = msgId
    activeAudio = new Audio(url)
    activeAudio.play().catch(err => {
      console.error('Error al reproducir audio admin:', err)
      playingAudioId.value = null
    })
    activeAudio.onended = () => {
      playingAudioId.value = null
      activeAudio = null
    }
  }
}

function triggerFile() { fileInputRef.value?.click() }

function fmtDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

async function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !active.value || !authStore.user) return
  
  const targetConvId = active.value.id
  
  try {
    let uploadData: Blob | File = file
    const isImage = file.type.startsWith('image/')
    
    if (isImage) {
      const { compressImage } = await import('../utils/imageCompressor')
      uploadData = await compressImage(file)
    }

    const ext = file.name.split('.').pop() || (isImage ? 'jpg' : 'mp4')
    const fileName = `chat-soporte/admin/${Date.now()}_${gid()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('imagenes-plataforma')
      .upload(fileName, uploadData, { contentType: file.type })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from('imagenes-plataforma').getPublicUrl(fileName)
    const fileUrl = urlData.publicUrl

    await supabase
      .from('mensajes_soporte')
      .insert({
        conversacion_id: targetConvId,
        sender_id: authStore.user.id,
        sender_role: 'admin',
        type: isImage ? 'image' : 'video',
        text: file.name,
        image_url: isImage ? fileUrl : undefined,
        video_url: !isImage ? fileUrl : undefined
      })
      
    await supabase
      .from('conversaciones_soporte')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', targetConvId)
  } catch (err: any) {
    console.error('Error subiendo archivo admin:', err.message)
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}

// Voice notes (mic)
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream)
    audioChunks = []
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }
    
    mediaRecorder.onstop = async () => {
      if (!active.value || !authStore.user) return
      const targetConvId = active.value.id
      try {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
        const fileName = `chat-soporte/admin/${Date.now()}_${gid()}.webm`

        const { error: uploadError } = await supabase.storage
          .from('imagenes-plataforma')
          .upload(fileName, audioBlob, { contentType: 'audio/webm' })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('imagenes-plataforma').getPublicUrl(fileName)
        const fileUrl = urlData.publicUrl

        await supabase
          .from('mensajes_soporte')
          .insert({
            conversacion_id: targetConvId,
            sender_id: authStore.user.id,
            sender_role: 'admin',
            type: 'audio',
            audio_url: fileUrl,
            audio_duration: recordSeconds.value
          })
          
        await supabase
          .from('conversaciones_soporte')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', targetConvId)
      } catch (err: any) {
        console.error('Error subiendo audio admin:', err.message)
      }
    }

    mediaRecorder.start()
    isRecording.value = true
    recordSeconds.value = 0
    recordTimer = setInterval(() => { recordSeconds.value++ }, 1000)
  } catch (e) {
    console.error('No se pudo acceder al micrófono del admin:', e)
  }
}

function stopRecording(cancel = false) {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    if (cancel) {
      mediaRecorder.onstop = null
    }
    mediaRecorder.stop()
    mediaRecorder.stream.getTracks().forEach(track => track.stop())
  }
  isRecording.value = false
  if (recordTimer) {
    clearInterval(recordTimer)
    recordTimer = null
  }
}

async function toggleRecording() {
  if (!isRecording.value) {
    if (!active.value) return
    await startRecording()
  } else {
    stopRecording(false)
  }
}

// Quick Replies for Admin
const isQuickRepliesOpen = ref(false)
const isAddQuickReplyModalOpen = ref(false)
const newQrTitle = ref('')
const newQrText = ref('')

const defaultQuickReplies = [
  { title: 'Bienvenida', text: '¡Hola! Bienvenido al soporte técnico de EcoGuía SOS. Estoy aquí para ayudarte. 🌱' },
  { title: 'Agradecimiento', text: 'Muchas gracias por reportar esta situación. Ya lo estamos revisando con el equipo técnico. 🌿' },
  { title: 'Caso Resuelto', text: 'Hemos solucionado el inconveniente reportado. Por favor confírmanos si ya funciona correctamente de tu lado. ¡Saludos! 👍' }
]

const savedReplies = localStorage.getItem('admin_custom_quick_replies')
const initialReplies = savedReplies ? JSON.parse(savedReplies) : defaultQuickReplies
const customQuickReplies = ref<any[]>(initialReplies)
if (!savedReplies) {
  localStorage.setItem('admin_custom_quick_replies', JSON.stringify(defaultQuickReplies))
}

const adminQuickReplies = computed(() => customQuickReplies.value)

function selectAdminQuickReply(text: string) {
  adminInput.value = text
  isQuickRepliesOpen.value = false
}

const editingIndex = ref<number | null>(null)

function openAddQuickReplyModal() {
  newQrTitle.value = ''
  newQrText.value = ''
  editingIndex.value = null
  isAddQuickReplyModalOpen.value = true
  isQuickRepliesOpen.value = false
}

function editQuickReply(index: number) {
  const qr = customQuickReplies.value[index]
  if (qr) {
    editingIndex.value = index
    newQrTitle.value = qr.title
    newQrText.value = qr.text
  }
}

function cancelAddEdit() {
  isAddQuickReplyModalOpen.value = false
  editingIndex.value = null
  newQrTitle.value = ''
  newQrText.value = ''
}

function saveCustomQuickReply() {
  const title = newQrTitle.value.trim()
  const text = newQrText.value.trim()
  if (!title || !text) return
  
  if (editingIndex.value !== null) {
    // Update
    customQuickReplies.value[editingIndex.value] = { title, text }
    editingIndex.value = null
  } else {
    // Add new
    if (customQuickReplies.value.some(c => c.title.toLowerCase() === title.toLowerCase())) {
      alert('Ya existe una respuesta rápida con ese título.')
      return
    }
    customQuickReplies.value.push({ title, text })
  }
  localStorage.setItem('admin_custom_quick_replies', JSON.stringify(customQuickReplies.value))
  
  newQrTitle.value = ''
  newQrText.value = ''
}

function deleteQuickReply(title: string) {
  if (editingIndex.value !== null && customQuickReplies.value[editingIndex.value]?.title === title) {
    editingIndex.value = null
    newQrTitle.value = ''
    newQrText.value = ''
  }
  customQuickReplies.value = customQuickReplies.value.filter(c => c.title !== title)
  localStorage.setItem('admin_custom_quick_replies', JSON.stringify(customQuickReplies.value))
}

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
          
          <div class="ci__av" :style="u.avatar_url ? `background-image: url(${u.avatar_url}); background-size: cover; background-position: center; border: none;` : { background: u.color }">
            <span v-if="!u.avatar_url">{{ u.initials }}</span>
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
            
            <div class="cc-head__av" :style="active.avatar_url ? `background-image: url(${active.avatar_url}); background-size: cover; background-position: center; border: none;` : { background: active.color }">
              <span v-if="!active.avatar_url">{{ active.initials }}</span>
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
                <div v-else-if="m.type === 'audio'" class="bubble__audio" @click="togglePlayAudio(m.id, m.audio_url!)" style="cursor: pointer;">
                  <button class="audio-play" :aria-label="playingAudioId === m.id ? 'Pausar nota de voz' : 'Reproducir nota de voz'">
                    <svg v-if="playingAudioId === m.id" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <rect x="6" y="4" width="4" height="16" rx="1" ry="1"/>
                      <rect x="14" y="4" width="4" height="16" rx="1" ry="1"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  </button>
                  <div class="audio-track">
                    <div class="audio-bars" :class="{ 'audio-bars--playing': playingAudioId === m.id }">
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

        
        <footer class="cc-foot" style="position: relative;">
          <input ref="fileInputRef" type="file" class="sr-only" accept="image/*,video/*,.mp4,.mov,.webm" @change="handleFileSelect" />
          <div class="cc-foot__actions" style="display: flex; gap: 6px; align-items: center; margin-right: 8px;">
            <!-- Attach image/video -->
            <button class="tool-btn" @click="triggerFile" title="Adjuntar imagen o video">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <!-- Microphone recording -->
            <button class="tool-btn" :class="{ 'tool-btn--recording': isRecording }" @click="toggleRecording" :title="isRecording ? 'Detener' : 'Grabar nota de voz'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
            <!-- Quick Replies -->
            <button class="tool-btn" @click="isQuickRepliesOpen = !isQuickRepliesOpen" title="Respuestas Rápidas" style="color: #72B04D;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </button>
          </div>

          <div v-if="isRecording" class="rec-bar-admin">
            <span class="rec-dot"></span>
            <span class="rec-label">Grabando {{ fmtDuration(recordSeconds) }}</span>
            <button class="rec-cancel" @click="stopRecording(true)">Cancelar</button>
          </div>

          <textarea v-model="adminInput" class="cc-foot__input" placeholder="Escribe tu respuesta…" rows="1" @keydown="handleKey"></textarea>
          <button class="cc-foot__send" :disabled="!adminInput.trim() && !isRecording" @click="sendAdmin">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Enviar
          </button>

          <!-- Drawer of Quick Replies -->
          <div v-if="isQuickRepliesOpen" class="quick-replies-admin-drawer">
            <div class="qrad-header">
              <span>Respuestas Rápidas</span>
              <button class="qrad-add-btn" @click="openAddQuickReplyModal">
                + Nueva
              </button>
            </div>
            <div class="qrad-body">
              <div v-for="qr in adminQuickReplies" :key="qr.title" class="qrad-item" @click="selectAdminQuickReply(qr.text)">
                <strong>{{ qr.title }}</strong>
                <p>{{ qr.text }}</p>
                
              </div>
            </div>
          </div>
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
        
        <div class="card__av" :style="active.avatar_url ? `background-image: url(${active.avatar_url}); background-size: cover; background-position: center; border: none;` : { background: active.color }">
          <span v-if="!active.avatar_url">{{ active.initials }}</span>
        </div>
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
        <textarea v-model.lazy="active.internal_notes" class="notes-ta" placeholder="Notas privadas del caso (solo tú las ves)…" rows="5"></textarea>
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

    <!-- Modal: Manage Quick Replies -->
    <div v-if="isAddQuickReplyModalOpen" class="qr-modal-overlay">
      <div class="qr-modal glass-effect">
        <h3>Gestionar Respuestas Rápidas</h3>
        
        <!-- Recuadro con las respuestas actuales -->
        <div class="qr-list-container">
          <p class="qr-section-title">Respuestas Guardadas</p>
          <div class="qr-list">
            <div v-for="(qr, index) in customQuickReplies" :key="qr.title" class="qr-list-item">
              <div class="qr-list-info">
                <strong>{{ qr.title }}</strong>
                <p>{{ qr.text }}</p>
              </div>
              <div class="qr-list-actions">
                <button class="qr-list-btn qr-list-btn--edit" @click="editQuickReply(index)" title="Editar plantilla">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px; color: #4fc3f7;">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="qr-list-btn qr-list-btn--delete" @click="deleteQuickReply(qr.title)" title="Eliminar plantilla">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px; color: #f87171;">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
            <p v-if="customQuickReplies.length === 0" class="qr-list-empty">No tienes respuestas rápidas personalizadas.</p>
          </div>
        </div>
        
        <!-- Formulario para agregar / editar -->
        <div class="qr-form-section">
          <p class="qr-section-title">{{ editingIndex !== null ? 'Editar Respuesta Rápida' : 'Agregar Respuesta Rápida' }}</p>
          <div class="qr-modal-field">
            <label>Título (ej. Dudas, Pasos, etc.)</label>
            <input v-model="newQrTitle" placeholder="Ej. Agradecimiento corto" />
          </div>
          <div class="qr-modal-field">
            <label>Contenido de la plantilla</label>
            <textarea v-model="newQrText" rows="3" placeholder="Escribe el mensaje prediseñado aquí..."></textarea>
          </div>
        </div>
        
        <div class="qr-modal-actions">
          <button class="qr-modal-btn qr-modal-btn--cancel" @click="cancelAddEdit">Cerrar</button>
          <button class="qr-modal-btn qr-modal-btn--save" @click="saveCustomQuickReply">
            {{ editingIndex !== null ? 'Actualizar' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

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

/* Tool buttons & attachments */
.tool-btn {
  width: 32px; height: 32px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.09);
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.45);
  display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--tr);
}
.tool-btn:hover { background: rgba(0,119,182,0.22); color: #4fc3f7; border-color: rgba(0,119,182,0.35); }
.tool-btn--recording { background: rgba(239,68,68,0.2) !important; color: #fca5a5 !important; border-color: rgba(239,68,68,0.4) !important; animation: rec-blink 1.5s infinite; }
@keyframes rec-blink { 0%,100%{opacity:1} 50%{opacity:0.6} }

/* Recording bar */
.rec-bar-admin {
  position: absolute; left: 160px; right: 110px; top: 12px; bottom: 12px;
  background: #141f27; border-radius: 12px; display: flex; align-items: center;
  padding: 0 15px; border: 1px solid rgba(239,68,68,0.35); z-index: 10;
}
.rec-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; margin-right: 10px; animation: rec-blink 1s infinite; }
.rec-label { color: rgba(255,255,255,0.85); font-family: var(--fb); font-size: 13px; flex: 1; }
.rec-cancel { background: none; border: none; color: #9ca3af; font-family: var(--fb); font-size: 12px; cursor: pointer; text-decoration: underline; }
.rec-cancel:hover { color: #f3f4f6; }

/* Quick Replies Drawer */
.quick-replies-admin-drawer {
  position: absolute; bottom: 70px; left: 15px; width: 320px; max-height: 250px;
  background: #0d161d; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
  display: flex; flex-direction: column; overflow: hidden; z-index: 100;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
}
.qrad-header {
  padding: 10px 14px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.08);
  display: flex; justify-content: space-between; align-items: center; font-family: var(--ft); font-size: 12.5px; color: #fff;
}
.qrad-add-btn {
  background: rgba(114,176,77,0.15); border: 1px solid rgba(114,176,77,0.3); border-radius: 8px;
  color: #a5d67c; font-size: 11px; padding: 3px 8px; cursor: pointer; transition: var(--tr);
}
.qrad-add-btn:hover { background: rgba(114,176,77,0.3); color: #fff; }
.qrad-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
.qrad-item {
  padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer;
  transition: var(--tr); position: relative; text-align: left;
}
.qrad-item:hover { background: rgba(255,255,255,0.02); }
.qrad-item strong { display: block; font-family: var(--ft); font-size: 12px; color: #72B04D; margin-bottom: 2px; }
.qrad-item p { margin: 0; font-family: var(--fb); font-size: 11.5px; color: rgba(255,255,255,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 25px; }
.qrad-delete-btn {
  position: absolute; right: 12px; top: 12px; background: none; border: none; cursor: pointer; opacity: 0.5; transition: var(--tr);
}
.qrad-delete-btn:hover { opacity: 1; }

/* Modal overlay */
.qr-modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center; z-index: 1000;
  backdrop-filter: blur(4px);
}
.qr-modal {
  width: 90%; max-width: 440px; background: rgba(18, 28, 36, 0.95);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 25px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 18px;
}
.qr-modal h3 { margin: 0; font-family: var(--ft); font-size: 18px; color: #fff; text-align: left; }
.qr-modal-field { display: flex; flex-direction: column; gap: 6px; text-align: left; }
.qr-modal-field label { font-family: var(--ft); font-size: 12px; color: rgba(255,255,255,0.45); }
.qr-modal-field input, .qr-modal-field textarea {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
  padding: 10px; color: #fff; font-family: var(--fb); font-size: 13.5px; outline: none; transition: var(--tr);
}
.qr-modal-field input:focus, .qr-modal-field textarea:focus { border-color: var(--eco); }
.qr-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 5px; }
.qr-modal-btn {
  padding: 8px 18px; border-radius: 10px; font-family: var(--ft); font-size: 13px; font-weight: 500; cursor: pointer; transition: var(--tr);
}
.qr-modal-btn--cancel { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.6); }
.qr-modal-btn--cancel:hover { background: rgba(255,255,255,0.05); color: #fff; }
.qr-modal-btn--save { background: var(--eco); border: none; color: #fff; box-shadow: 0 4px 12px rgba(114,176,77,0.3); }
.qr-modal-btn--save:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(114,176,77,0.5); }
.sr-only { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0 }


.qr-list-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
  text-align: left;
}
.qr-section-title {
  font-family: var(--ft);
  font-size: 13px;
  font-weight: 600;
  color: var(--eco);
  margin: 0 0 6px;
}
.qr-list {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  max-height: 120px;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.qr-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  padding: 6px 10px;
  gap: 10px;
}
.qr-list-info {
  flex: 1;
  min-width: 0;
}
.qr-list-info strong {
  display: block;
  font-family: var(--ft);
  font-size: 11.5px;
  color: #fff;
  margin-bottom: 1px;
}
.qr-list-info p {
  margin: 0;
  font-family: var(--fb);
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.qr-list-actions {
  display: flex;
  gap: 6px;
}
.qr-list-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--tr);
}
.qr-list-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
.qr-list-empty {
  margin: 0;
  padding: 10px 0;
  text-align: center;
  font-family: var(--fb);
  font-size: 11.5px;
  color: rgba(255,255,255,0.22);
}
.qr-form-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 12px;
}

.audio-bars--playing .audio-bar {
  animation: audio-wave 1.2s ease-in-out infinite alternate;
}
.audio-bars--playing .audio-bar:nth-child(2n) { animation-delay: 0.15s; }
.audio-bars--playing .audio-bar:nth-child(3n) { animation-delay: 0.3s; }
.audio-bars--playing .audio-bar:nth-child(4n) { animation-delay: 0.45s; }
</style>
