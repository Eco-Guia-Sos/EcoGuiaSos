<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'
import { useValidation } from '../composables/useValidation'
import { EventoSchema, LugarSchema } from '../schemas'
import { TerritoryService, type Territory } from '../services/territory.service'

import { compressImage } from '../utils/imageCompressor'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// State for table actions dropdown
const activeDropdown = ref<string | null>(null)

const toggleActionsMenu = (id: string, e: Event) => {
  e.stopPropagation()
  activeDropdown.value = activeDropdown.value === id ? null : id
}

const closeActionsMenu = () => {
  activeDropdown.value = null
}

const { validateForm } = useValidation()
const eventErrors = ref<Record<string, string>>({})
const placeErrors = ref<Record<string, string>>({})

const formatToISO = (dateStr: string) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? '' : d.toISOString()
  } catch {
    return ''
  }
}

const resolveItemSection = (item: any) => {
  if (selectedSection.value) return selectedSection.value
  if (item.seccion_id) return item.seccion_id
  if (item.fecha_inicio) return 'eventos'
  return 'lugares'
}

// State
const activeTab = ref('dashboard')
const selectedHub = ref<'colibri' | 'ajolote' | 'lobo' | null>(null)
const selectedSection = ref<string | null>(null)
const moderationFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>('all')
const actorModerationFilter = ref<'approved' | 'pending' | 'rejected'>('approved')
const pendingActoresCount = ref(0)

// Seguidores filters state
const seguidoresTabFilter = ref<'todos' | 'mis_seguidores'>('todos')
const searchSeguidoresQuery = ref('')

const stats = ref({
  actores: 0,
  voluntarios: 0,
  eventos: 0,
  eventos_activos: 0,
  eventos_inactivos: 0,
  lugares: 0,
  seguidores: 0
})

const listItems = ref<any[]>([])
const loadingList = ref(false)
const listError = ref('')

const isSidebarCollapsed = ref(false)
const isMobileSidebarActive = ref(false)

// Modals
const isEventModalOpen = ref(false)
const isPlaceModalOpen = ref(false)
const isContentModalOpen = ref(false)
const isPermissionsModalOpen = ref(false)
const isProfileAdminModalOpen = ref(false)
const isNotifReviewModalOpen = ref(false)

// Volunteer profile details modal state
const isVolunteerDetailModalOpen = ref(false)
const selectedVolunteer = ref<any | null>(null)
const volunteerFormEditable = ref(false)
const volunteerFormSaving = ref(false)
const savingItem = ref(false)
interface VolunteerFormType {
  email: string
  nombre_completo: string
  telefono: string
  zona_preferida: string
  bio: string
  habilidades: string
  nivel_experiencia: string
  disponibilidad: string
  tiene_vehiculo: boolean
  causas_interes: string[]
  links_sociales: Record<string, any>
}

const volunteerForm = ref<VolunteerFormType>({
  email: '',
  nombre_completo: '',
  telefono: '',
  zona_preferida: '',
  bio: '',
  habilidades: '',
  nivel_experiencia: '',
  disponibilidad: '',
  tiene_vehiculo: false,
  causas_interes: [],
  links_sociales: {}
})

const editingItem = ref<any>({
  id: null,
  nombre: '',
  titulo: '',
  descripcion: '',
  descripcion_texto: '',
  categoria: 'General',
  ubicacion: 'CDMX',
  lat: 19.4326,
  lng: -99.1332,
  imagen: '',
  imagen_url: '',
  es_gratuito: true,
  pet_friendly: false,
  apto_ninos: false,
  fecha: '',
  fecha_inicio: '',
  fecha_fin: '',
  enlace_externo: '',
  meta: {},
  modalidad: 'presencial',
  tiene_sesion_online: false,
  reg_link: '',
  sesion_online_link: '',
  lugar_id: '',
  social_fb: '',
  social_ig: '',
  social_wa: '',
  social_x: '',
  social_yt: '',
  social_web: '',
  imagenes: []
})

const CATEGORY_LABELS: Record<string, string> = {
  // Eventos
  taller: 'Taller',
  voluntariado: 'Voluntariado',
  conferencia: 'Conferencia / Charla',
  limpieza: 'Limpieza de Playas / Áreas',
  reforestacion: 'Reforestación',
  otro: 'Otro',
  
  // Lugares
  sede: 'Sede de Eventos',
  reciclaje: 'Centro de Reciclaje / Residuos',
  asociacion: 'Asociación / ONG Ambiental',
  granel: 'Tienda a Granel / Residuo Cero',
  restaurante: 'Restaurante Vegano / Eco-Gastronomía',
  huerto: 'Huerto / Espacio de Cultivo',
  ecoturismo: 'Ecoturismo / Área Natural'
}

const formatCategory = (cat: string) => {
  if (!cat) return 'General'
  const key = cat.toLowerCase()
  return CATEGORY_LABELS[key] || cat
}


// Permissions states for modals
const actorPermissions = ref<Record<string, boolean>>({
  puede_editar_cursos: false,
  puede_editar_ecotecnias: false,
  puede_editar_agua: false,
  puede_editar_lecturas: false,
  puede_editar_documentales: false,
  puede_editar_firmas: false,
  puede_editar_voluntariados: false,
  puede_editar_convocatoria: false,
  puede_editar_causas: false,
  puede_editar_normativa: false,
  puede_editar_fondos: false,
  puede_editar_lugares: false
})

const actorFuncPermissions = ref<Record<string, boolean>>({
  puede_crear_eventos: true,
  puede_crear_lugares: true,
  puede_enviar_notificaciones: false,
  visible_en_directorio: true,
  puede_gestionar_slider: false
})

const selectedActorId = ref<string | null>(null)
const selectedActorName = ref('')

// Profile tab state
const profileForm = ref({
  nombre_completo: '',
  bio: '',
  telefono: '',
  facebook: '',
  instagram: '',
  whatsapp: '',
  twitter: '',
  youtube: '',
  web: '',
  videos_presentacion: [] as string[],
  zonas_impacto: [] as string[]
})
const activeProfileSocial = ref('facebook')
const profileSaving = ref(false)

// Estados y Municipios reactivos
const estadosList = ref<Territory[]>([])

// Para perfil propio
const selectedEstado = ref('')
const selectedMunicipio = ref('')
const municipiosList = ref<Territory[]>([])

// Para modal de administración
const selectedEstadoAdmin = ref('')
const selectedMunicipioAdmin = ref('')
const municipiosListAdmin = ref<Territory[]>([])

const avatarFile = ref<File | null>(null)
const avatarUploading = ref(false)

// Admin Profile Modal state
const selectedActorForProfile = ref<any>(null)
const profileAdminForm = ref({
  nombre_completo: '',
  email: '',
  telefono: '',
  rol: 'user',
  web: '',
  bio: '',
  facebook: '',
  instagram: '',
  twitter: '',
  avatar_url: '',
  videos_presentacion: [] as string[],
  permitir_edicion_videos: true,
  is_validated: false,
  zonas_impacto: [] as string[]
})

const SOCIAL_NETWORKS = [
  { id: 'facebook', name: 'Facebook', icon: 'fa-brands fa-facebook', placeholder: 'https://facebook.com/tu-usuario' },
  { id: 'instagram', name: 'Instagram', icon: 'fa-brands fa-instagram', placeholder: 'https://instagram.com/tu-usuario' },
  { id: 'twitter', name: 'X / Twitter', icon: 'fa-brands fa-x-twitter', placeholder: 'https://x.com/tu-usuario' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fa-brands fa-whatsapp', placeholder: 'https://wa.me/5255...' },
  { id: 'youtube', name: 'YouTube', icon: 'fa-brands fa-youtube', placeholder: 'https://youtube.com/@tu-canal' },
  { id: 'web', name: 'Sitio Web', icon: 'fa-solid fa-globe', placeholder: 'https://tu-sitio.com' }
]

const CAUSAS_OPTIONS = [
  { id: 'reforestacion', emoji: '🌱', label: 'Reforestación' },
  { id: 'agua', emoji: '💧', label: 'Agua' },
  { id: 'fauna', emoji: '🦎', label: 'Fauna Silvestre' },
  { id: 'educacion', emoji: '🌍', label: 'Educación Ambiental' },
  { id: 'reciclaje', emoji: '♻️', label: 'Reciclaje' },
  { id: 'huertos', emoji: '🌆', label: 'Huertos Urbanos' },
  { id: 'conservacion_marina', emoji: '🌊', label: 'Conservación Marina' },
  { id: 'polinizadores', emoji: '🦋', label: 'Polinizadores' },
  { id: 'normativa', emoji: '📜', label: 'Normativa Ambiental' },
]

const ZONAS_DISPONIBLES = [
  'Álvaro Obregón', 'Azcapotzalco', 'Benito Juárez', 'Coyoacán',
  'Cuajimalpa', 'Cuauhtémoc', 'Gustavo A. Madero', 'Iztacalco',
  'Iztapalapa', 'La Magdalena Contreras', 'Miguel Hidalgo', 'Milpa Alta',
  'Tláhuac', 'Tlalpan', 'Venustiano Carranza', 'Xochimilco',
  'Estado de México', 'Morelos', 'Hidalgo', 'Puebla',
  'Nacional', 'Internacional'
]


const verPerfilVoluntario = (volu: any, editable: boolean) => {
  closeActionsMenu()
  selectedVolunteer.value = volu
  volunteerFormEditable.value = editable
  volunteerForm.value = {
    email: volu.email || '',
    nombre_completo: volu.nombre_completo || '',
    telefono: volu.telefono || '',
    zona_preferida: volu.zona_preferida || '',
    bio: volu.bio || '',
    habilidades: volu.habilidades || '',
    nivel_experiencia: volu.nivel_experiencia || '',
    disponibilidad: volu.disponibilidad || '',
    tiene_vehiculo: volu.tiene_vehiculo || false,
    causas_interes: volu.causas_interes ? [...volu.causas_interes] : [],
    links_sociales: volu.links_sociales ? { ...volu.links_sociales } : {}
  }
  isVolunteerDetailModalOpen.value = true
}

const saveVolunteerProfile = async () => {
  if (!selectedVolunteer.value) return
  volunteerFormSaving.value = true
  try {
    const { error } = await supabase
      .from('perfiles')
      .update({
        email: volunteerForm.value.email.trim(),
        nombre_completo: volunteerForm.value.nombre_completo.trim(),
        telefono: volunteerForm.value.telefono.trim(),
        zona_preferida: volunteerForm.value.zona_preferida.trim(),
        bio: volunteerForm.value.bio.trim(),
        habilidades: volunteerForm.value.habilidades.trim(),
        nivel_experiencia: volunteerForm.value.nivel_experiencia,
        disponibilidad: volunteerForm.value.disponibilidad,
        tiene_vehiculo: volunteerForm.value.tiene_vehiculo,
        causas_interes: volunteerForm.value.causas_interes,
        links_sociales: volunteerForm.value.links_sociales
      })
      .eq('id', selectedVolunteer.value.id)

    if (error) throw error
    alert('Perfil de voluntario guardado exitosamente.')
    isVolunteerDetailModalOpen.value = false
    
    if (selectedSection.value === 'seguidores') {
      fetchListData()
    }
    loadVoluntariosList()
  } catch (err: any) {
    alert('Error al guardar perfil de voluntario: ' + err.message)
  } finally {
    volunteerFormSaving.value = false
  }
}

const sendResetPasswordEmailForVolunteer = async () => {
  const emailToReset = volunteerForm.value.email || selectedVolunteer.value?.email
  if (!emailToReset) {
    alert('El voluntario no tiene un correo electrónico registrado.')
    return
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(emailToReset)
    if (error) throw error
    alert('Se ha enviado un enlace de recuperación al correo: ' + emailToReset)
  } catch (err: any) {
    alert('Error al enviar enlace: ' + err.message)
  }
}

const openProfileAdminModal = (actor: any) => {
  closeActionsMenu()
  selectedActorForProfile.value = actor
  profileAdminForm.value = {
    nombre_completo: actor.nombre_completo || '',
    email: actor.email || '',
    telefono: actor.telefono || '',
    rol: actor.rol || 'user',
    web: actor.links_sociales?.web || '',
    bio: actor.bio || '',
    facebook: actor.links_sociales?.facebook || '',
    instagram: actor.links_sociales?.instagram || '',
    twitter: actor.links_sociales?.twitter || '',
    avatar_url: actor.avatar_url || '',
    videos_presentacion: Array.isArray(actor.videos_presentacion) ? [...actor.videos_presentacion] : [],
    permitir_edicion_videos: actor.permitir_edicion_videos ?? true,
    is_validated: actor.is_validated || false,
    zonas_impacto: Array.isArray(actor.zonas_impacto) ? [...actor.zonas_impacto] : []
  }
  isProfileAdminModalOpen.value = true
}

const saveProfileAdmin = async () => {
  if (!selectedActorForProfile.value) return
  try {
    const { web, facebook, instagram, twitter, email, ...rest } = profileAdminForm.value
    const payload: any = { 
        ...rest,
        zonas_impacto: [...(profileAdminForm.value.zonas_impacto || [])],
        videos_presentacion: [...(profileAdminForm.value.videos_presentacion || [])],
        links_sociales: {
            ...(selectedActorForProfile.value.links_sociales || {}),
            web, facebook, instagram, twitter
        }
    }
    const { error } = await supabase.from('perfiles').update(payload).eq('id', selectedActorForProfile.value.id)
    if (error) throw error
    alert('Perfil guardado exitosamente.')
    isProfileAdminModalOpen.value = false
    loadStaffList()
    loadVoluntariosList()
  } catch (err: any) {
    alert('Error al guardar perfil: ' + err.message)
  }
}

const sendResetPasswordEmail = async () => {
  if (!profileAdminForm.value.email) {
    alert('El usuario no tiene un correo electrónico registrado.')
    return
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(profileAdminForm.value.email)
    if (error) throw error
    alert('Se ha enviado un enlace de recuperación al correo: ' + profileAdminForm.value.email)
  } catch (err: any) {
    alert('Error al enviar enlace: ' + err.message)
  }
}


// Config tab state
const configForm = ref({
  registro_abierto: true,
  modo_mantenimiento: false,
  mensaje_bienvenida: '',
  banner_activo: '',
  aprobacion_automatica: false,
  notificar_admins: false,
  mapa_lat: 19.4326,
  mapa_lng: -99.1332,
  mapa_zoom: 12,
  limite_archivos_mb: 10,
  activar_captcha: false,
  email_soporte: '',
  redes_sociales: {
    facebook: '',
    instagram: '',
    twitter: '',
    linkedin: ''
  }
})
const configSaving = ref(false)
const configLoading = ref(false)

// Notifications tab state
const notifForm = ref({
  titulo: '',
  mensaje: '',
  enlace_url: '',
  archivo_url: '',
  dest_todos: true,
  dest_actores: true,
  dest_voluntariados: true
})
const sendingNotif = ref(false)
const notifHistory = ref<any[]>([])
const activeNotifDetail = ref<any | null>(null)

// Slider tab state
const slidesList = ref<any[]>([])
const sliderForm = ref({
  id: null,
  titulo: '',
  subtitulo: '',
  enlace_url: '',
  imagen_url: '',
  imagen_pc_url: '',
  imagen_tablet_url: '',
  badge: '',
  orden: 0,
  activo: true,
  sin_boton: false
})
const isSliderModalOpen = ref(false)

// Messaging followers states and actions
const isMessageModalOpen = ref(false)
const messageRecipientName = ref('')
const messageRecipientId = ref('')
const messageTitle = ref('')
const messageBody = ref('')
const sendingMessage = ref(false)

const openMessageModal = (user: any) => {
  messageRecipientId.value = user.id
  messageRecipientName.value = user.nombre_completo || user.email || 'Voluntario'
  messageTitle.value = ''
  messageBody.value = ''
  isMessageModalOpen.value = true
}

const sendMessageToFollower = async () => {
  if (!messageRecipientId.value || sendingMessage.value) return
  sendingMessage.value = true
  try {
    const { data: notif, error: notifError } = await supabase.from('notificaciones').insert({
      remitente_id: authStore.user?.id,
      titulo: messageTitle.value,
      mensaje: messageBody.value,
      destinatarios: messageRecipientId.value
    }).select().single()

    if (notifError) throw notifError

    if (notif) {
      const { error: userError } = await supabase.from('notificaciones_usuarios').insert({
        notificacion_id: notif.id,
        usuario_id: messageRecipientId.value,
        leido: false
      })
      if (userError) throw userError
    }

    alert('Mensaje enviado con éxito.')
    isMessageModalOpen.value = false
  } catch (err: any) {
    alert('Error al enviar el mensaje: ' + err.message)
  } finally {
    sendingMessage.value = false
  }
}

// Configs for dynamic content fields
const SECTION_CONFIGS: Record<string, { label: string; fields: Array<{ id: string; label: string; type: string; options?: string[]; placeholder?: string }> }> = {
  cursos: {
    label: 'Curso',
    fields: [
      { id: 'area', label: 'Área Temática', type: 'select', options: ['Agua', 'Biodiversidad', 'Residuos', 'Energía', 'Clima', 'Cambio Climático'] },
      { id: 'institucion', label: 'Institución / Plataforma', type: 'text', placeholder: 'Ej: BID, Coursera, UNAM' },
      { id: 'gratuito', label: 'Acceso', type: 'select', options: ['Gratuito', 'Pago / Beca'] },
      { id: 'fecha_limite', label: 'Fecha Límite Registro', type: 'date' }
    ]
  },
  normativa: {
    label: 'Norma Ambiental',
    fields: [
      { id: 'ambito', label: 'Ámbito', type: 'select', options: ['Federal', 'Estatal', 'Municipal', 'Internacional'] },
      { id: 'tipo_norma', label: 'Tipo de Instrumento', type: 'select', options: ['Ley', 'Reglamento', 'NOM', 'NMX', 'Decreto', 'Acuerdo'] },
      { id: 'organismo', label: 'Organismo Emisor', type: 'text', placeholder: 'Ej: SEMARNAT, CONAGUA' },
      { id: 'vigencia', label: 'Estado de Vigencia', type: 'select', options: ['Vigente', 'En Revisión', 'Abrogada'] }
    ]
  },
  lecturas: {
    label: 'Lectura',
    fields: [
      { id: 'autor', label: 'Autor(es)', type: 'text', placeholder: 'Ej: Johan Rockström' },
      { id: 'tipo_lectura', label: 'Tipo de Material', type: 'select', options: ['Libro', 'Artículo Científico', 'Manual/Guía', 'Informe', 'Ensayo'] },
      { id: 'idioma', label: 'Idioma', type: 'select', options: ['Español', 'Inglés', 'Bilingüe'] }
    ]
  },
  documentales: {
    label: 'Cine/Documental',
    fields: [
      { id: 'director', label: 'Director', type: 'text' },
      { id: 'duracion', label: 'Duración (min)', type: 'text', placeholder: 'Ej: 90 min' },
      { id: 'plataforma', label: 'Disponible en', type: 'text', placeholder: 'Ej: Netflix, YouTube, Cine' }
    ]
  },
  convocatoria: {
    label: 'Convocatoria',
    fields: [
      { id: 'tipo_apoyo', label: 'Tipo de Apoyo', type: 'select', options: ['Financiamiento', 'Beca', 'Incubación', 'Premio'] },
      { id: 'monto', label: 'Monto/Alcance', type: 'text', placeholder: 'Ej: $50,000 MXN' },
      { id: 'fecha_cierre', label: 'Fecha de Cierre', type: 'date' }
    ]
  },
  voluntariados: {
    label: 'Voluntariado',
    fields: [
      { id: 'modalidad', label: 'Modalidad', type: 'select', options: ['Presencial', 'Remoto', 'Híbrido'] },
      { id: 'duracion_estimada', label: 'Tiempo Requerido', type: 'text', placeholder: 'Ej: 4 horas/semana' }
    ]
  },
  ecotecnias: {
    label: 'Ecotecnia',
    fields: [
      { id: 'dificultad', label: 'Dificultad', type: 'select', options: ['Baja', 'Media', 'Alta'] },
      { id: 'materiales', label: 'Materiales Clave', type: 'text', placeholder: 'Ej: PET, Madera, PVC' }
    ]
  },
  fondos: {
    label: 'Fondo / Beca',
    fields: [
      { id: 'tipo_fondo', label: 'Tipo', type: 'select', options: ['Gubernamental', 'Internacional', 'Fundación', 'ONU', 'Privado'] },
      { id: 'origen', label: 'Origen', type: 'select', options: ['Nacional', 'Internacional', 'Regional'] },
      { id: 'monto_aprox', label: 'Monto Aproximado', type: 'text', placeholder: 'Ej: Hasta $500,000 MXN' },
      { id: 'fecha_cierre', label: 'Fecha de Cierre', type: 'date' }
    ]
  },
  firmas: {
    label: 'Petición / Firma',
    fields: [
      { id: 'plataforma_firmas', label: 'Plataforma', type: 'text', placeholder: 'Ej: Change.org, Avaaz' },
      { id: 'meta_firmas', label: 'Meta de Firmas', type: 'text', placeholder: 'Ej: 10,000' }
    ]
  },
  causas: {
    label: 'Causa / Rifa',
    fields: [
      { id: 'organizador', label: 'Organizador / Beneficiario', type: 'text', placeholder: 'Ej: Campamento Palmarito' },
      { id: 'costo_boleto', label: 'Costo del Boleto', type: 'text', placeholder: 'Ej: $150 MXN' },
      { id: 'fecha_sorteo', label: 'Fecha del Sorteo', type: 'date' },
      { id: 'instagram', label: 'Instagram (URL)', type: 'text', placeholder: 'https://instagram.com/...' },
      { id: 'facebook', label: 'Facebook (URL)', type: 'text', placeholder: 'https://facebook.com/...' }
    ]
  }
}

const hubsConfig = {
  colibri: {
    label: 'Hub Colibrí',
    sections: [
      { id: 'cursos', label: 'Cursos', icon: 'fa-solid fa-graduation-cap' },
      { id: 'ecotecnias', label: 'Ecotecnias', icon: 'fa-solid fa-lightbulb' },
      { id: 'agua', label: 'Agua', icon: 'fa-solid fa-water' },
      { id: 'lecturas', label: 'Lecturas', icon: 'fa-solid fa-book' },
      { id: 'documentales', label: 'Documentales', icon: 'fa-solid fa-video' },
      { id: 'firmas', label: 'Firmas', icon: 'fa-solid fa-file-signature' }
    ]
  },
  ajolote: {
    label: 'Hub Ajolote',
    sections: [
      { id: 'voluntariados', label: 'Voluntariados', icon: 'fa-solid fa-hands-helping' },
      { id: 'convocatoria', label: 'Convocatorias', icon: 'fa-solid fa-bullhorn' },
      { id: 'causas', label: 'Causas / Rifas', icon: 'fa-solid fa-hand-holding-heart' }
    ]
  },
  lobo: {
    label: 'Hub Lobo',
    sections: [
      { id: 'normativa', label: 'Normativas', icon: 'fa-solid fa-scale-balanced' },
      { id: 'fondos', label: 'Fondos', icon: 'fa-solid fa-sack-dollar' }
    ]
  }
}

// User role check computed
const isUserAdmin = computed(() => authStore.profile?.rol === 'admin')
const isUserActor = computed(() => authStore.profile?.rol === 'actor')

// Permissions & Visibility filters
const actorSections = ref<string[]>([])
const actorFunctions = ref<Record<string, boolean>>({
  puede_crear_eventos: true,
  puede_crear_lugares: true,
  puede_enviar_notificaciones: false,
  visible_en_directorio: true,
  puede_gestionar_slider: false
})

const fetchActorPermissions = async () => {
  if (!authStore.user || !isUserActor.value) return
  
  // Section permissions
  const { data: actPerms } = await supabase
    .from('permisos_actores')
    .select('seccion_id')
    .eq('user_id', authStore.user.id)
  
  if (actPerms) {
    actorSections.value = actPerms.map(p => p.seccion_id)
  }

  // Operations permissions
  const { data: funcPerms } = await supabase
    .from('permisos_funciones')
    .select('*')
    .eq('user_id', authStore.user.id)
    .maybeSingle()
  
  if (funcPerms) {
    actorFunctions.value = {
      ...funcPerms,
      puede_gestionar_slider: false
    }
  }
}

const showHubMenu = (hub: 'colibri' | 'ajolote' | 'lobo') => {
  activeTab.value = hub
  selectedHub.value = hub
  selectedSection.value = null
}

const selectSection = (sectionId: string) => {
  selectedSection.value = sectionId
  activeTab.value = 'tabla-seccion'
  moderationFilter.value = 'all'
  seguidoresTabFilter.value = 'todos'
  searchSeguidoresQuery.value = ''
  fetchListData()
}

// Load List data based on selection
const fetchListData = async () => {
  // Always reset loading state first — avoids infinite spinner if called early
  loadingList.value = true
  listError.value = ''
  listItems.value = []

  if (!selectedSection.value) {
    loadingList.value = false
    return
  }

  try {
    if (selectedSection.value === 'seguidores') {
      let query = supabase
        .from('seguimientos_actores')
        .select(`
          id,
          created_at,
          actor_id,
          user:perfiles!fk_seguimientos_user (
            id, nombre_completo, email, avatar_url, rol,
            telefono, bio, zona_preferida, disponibilidad,
            causas_interes, habilidades, nivel_experiencia,
            tiene_vehiculo, links_sociales
          ),
          actor:perfiles!fk_seguimientos_actor (id, nombre_completo, email, avatar_url)
        `)
      
      if (isUserAdmin.value) {
        if (seguidoresTabFilter.value === 'mis_seguidores' && authStore.user) {
          query = query.eq('actor_id', authStore.user.id)
        }
      } else if (isUserActor.value && authStore.user) {
        query = query.eq('actor_id', authStore.user.id)
      }
      
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      
      const unique = []
      const seen = new Set()
      if (data) {
        for (const item of data) {
          const userVal = item.user as any
          const key = `${userVal?.id}-${item.actor_id}`
          if (!seen.has(key)) {
            seen.add(key)
            unique.push(item)
          }
        }
      }
      listItems.value = unique
      return
    }

    let query: any
    if (selectedSection.value === 'eventos') {
      query = supabase.from('eventos').select('*, publicador:owner_id(nombre_completo)')
    } else if (selectedSection.value === 'lugares') {
      query = supabase.from('lugares').select('*, publicador:owner_id(nombre_completo)')
    } else {
      query = supabase.from('contenido_secciones').select('*').eq('seccion_id', selectedSection.value)
    }

    // Role constraints
    if (isUserActor.value && authStore.user) {
      query = query.eq('owner_id', authStore.user.id)
    }

    // Moderation status constraints
    if (moderationFilter.value !== 'all') {
      if (moderationFilter.value === 'approved') {
        query = query.in('estado', ['approved', 'publicado'])
      } else {
        query = query.eq('estado', moderationFilter.value)
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    listItems.value = data || []
  } catch (err: any) {
    console.error('Error fetching list data:', err)
    listError.value = 'Error al cargar los datos.'
  } finally {
    loadingList.value = false
  }
}

watch(moderationFilter, () => {
  fetchListData()
})

watch(seguidoresTabFilter, () => {
  if (selectedSection.value === 'seguidores') {
    fetchListData()
  }
})

watch(() => authStore.profile, (newProfile) => {
  if (newProfile?.rol === 'admin' && !configForm.value.mensaje_bienvenida) {
    loadConfig()
  }
}, { immediate: false })

// Stats and global metrics
const fetchGlobalStats = async () => {
  try {
    let actQuery = supabase.from('perfiles').select('*', { count: 'exact', head: true }).or('rol.eq.admin,and(rol.eq.actor,actor_status.eq.approved)')
    let volQuery = supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'user')
    let evQuery = supabase.from('eventos').select('fecha_inicio, fecha_fin')
    let plQuery = supabase.from('lugares').select('*', { count: 'exact', head: true })
    let segQuery = supabase.from('seguimientos_actores').select('*', { count: 'exact', head: true })

    if (isUserActor.value && authStore.user) {
      evQuery = evQuery.eq('owner_id', authStore.user.id)
      plQuery = plQuery.eq('owner_id', authStore.user.id)
      segQuery = segQuery.eq('actor_id', authStore.user.id)
    }

    const [
      { count: actCount },
      { count: volCount },
      { data: evData },
      { count: plCount },
      { count: segCount }
    ] = await Promise.all([
      actQuery,
      volQuery,
      evQuery,
      plQuery,
      segQuery
    ])

    let activeEventsCount = 0
    let inactiveEventsCount = 0
    if (evData) {
      const now = new Date()
      evData.forEach(item => {
        let isActive = false
        if (item.fecha_fin || item.fecha_inicio) {
          const end = item.fecha_fin ? new Date(item.fecha_fin) : null
          const start = item.fecha_inicio ? new Date(item.fecha_inicio) : null
          if (end) isActive = end >= now
          else if (start) isActive = start >= now
        }
        if (isActive) {
          activeEventsCount++
        } else {
          inactiveEventsCount++
        }
      })
    }

    const { count: pendingActCount } = await supabase
      .from('perfiles')
      .select('*', { count: 'exact', head: true })
      .or('actor_status.eq.pending,and(rol.eq.actor,actor_status.is.null)')

    pendingActoresCount.value = pendingActCount || 0

    stats.value = {
      actores: actCount || 0,
      voluntarios: volCount || 0,
      eventos: evData ? evData.length : 0,
      eventos_activos: activeEventsCount,
      eventos_inactivos: inactiveEventsCount,
      lugares: plCount || 0,
      seguidores: segCount || 0
    }
  } catch (err) {
    console.error('Error fetching global stats:', err)
  }
}

const fetchDashboardList = async () => {
  loadingList.value = true
  listError.value = ''
  listItems.value = []

  try {
    let evQuery = supabase.from('eventos').select('*, publicador:owner_id(nombre_completo)').order('created_at', { ascending: false }).limit(5)
    let plQuery = supabase.from('lugares').select('*, publicador:owner_id(nombre_completo)').order('created_at', { ascending: false }).limit(5)

    if (isUserActor.value && authStore.user) {
      evQuery = evQuery.eq('owner_id', authStore.user.id)
      plQuery = plQuery.eq('owner_id', authStore.user.id)
    }

    const [
      { data: eventos },
      { data: lugares }
    ] = await Promise.all([
      evQuery,
      plQuery
    ])
    
    let combined = [...(eventos || []), ...(lugares || [])]
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    listItems.value = combined
  } catch (err) {
    console.error('Error fetching dashboard list:', err)
  } finally {
    loadingList.value = false
  }
}



// User loading / lists in admin view
const staffList = ref<any[]>([])
const showAdmins = ref(false)

const loadStaffList = async () => {
  if (!isUserAdmin.value) return
  
  let query = supabase
    .from('perfiles')
    .select('id, nombre_completo, email, rol, actor_status, created_at')
  
  if (actorModerationFilter.value === 'approved') {
    if (showAdmins.value) {
      query = query.or('rol.eq.admin,and(rol.eq.actor,actor_status.eq.approved)')
    } else {
      query = query.eq('rol', 'actor').eq('actor_status', 'approved')
    }
  } else if (actorModerationFilter.value === 'pending') {
    query = query.or('actor_status.eq.pending,and(rol.eq.actor,actor_status.is.null)')
  } else if (actorModerationFilter.value === 'rejected') {
    query = query.eq('actor_status', 'rejected')
  }

  const { data } = await query.order('created_at', { ascending: false })
  if (data) staffList.value = data
}

const voluntariosList = ref<any[]>([])
const loadVoluntariosList = async () => {
  if (!isUserAdmin.value) return
  const { data } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, email, rol, created_at, avatar_url, telefono, bio, zona_preferida, disponibilidad, causas_interes, habilidades, nivel_experiencia, tiene_vehiculo, links_sociales')
    .eq('rol', 'user')
    .order('created_at', { ascending: false })
  
  if (data) voluntariosList.value = data
}

const eventValidityFilter = ref<'all' | 'active' | 'passed'>('all')
const categoryFilter = ref<string>('all')
const publisherFilter = ref<string>('all')
const modalityFilter = ref<string>('all')
const stateFilter = ref<string>('all')
const searchQuery = ref<string>('')

const uniqueCategories = computed(() => {
  const cats = listItems.value.map(item => item.categoria)
  return [...new Set(cats)].filter(Boolean)
})

const uniquePublishers = computed(() => {
  const pubs = listItems.value.map(item => item.publicador?.nombre_completo || 'Sistema')
  return [...new Set(pubs)].filter(Boolean)
})

const clearAllFilters = () => {
  eventValidityFilter.value = 'all'
  categoryFilter.value = 'all'
  publisherFilter.value = 'all'
  modalityFilter.value = 'all'
  stateFilter.value = 'all'
  searchQuery.value = ''
}

// Reset filters when changing sections to avoid sticky filtered states
watch(selectedSection, () => {
  clearAllFilters()
})

const isEventActive = (eventItem: any) => {
  if (!eventItem.fecha_fin && !eventItem.fecha_inicio) return false
  const now = new Date()
  const end = eventItem.fecha_fin ? new Date(eventItem.fecha_fin) : null
  const start = eventItem.fecha_inicio ? new Date(eventItem.fecha_inicio) : null
  
  if (end) return end >= now
  if (start) return start >= now
  return false
}

const filteredListItems = computed(() => {
  return listItems.value.filter(item => {
    // 0. Search Query Filter
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      const title = (item.nombre || item.titulo || '').toLowerCase()
      const desc = (item.descripcion || item.descripcion_texto || '').toLowerCase()
      if (!title.includes(q) && !desc.includes(q)) return false
    }

    // 1. Validity Filter
    if (selectedSection.value === 'eventos' && eventValidityFilter.value !== 'all') {
      const active = isEventActive(item)
      if (eventValidityFilter.value === 'active' && !active) return false
      if (eventValidityFilter.value === 'passed' && active) return false
    }

    // 2. Category Filter
    if (categoryFilter.value !== 'all' && item.categoria !== categoryFilter.value) {
      return false
    }

    // 3. Publisher Filter
    if (publisherFilter.value !== 'all') {
      const pubName = item.publicador?.nombre_completo || 'Sistema'
      if (pubName !== publisherFilter.value) return false
    }

    // 4. Modality Filter
    if (selectedSection.value === 'eventos' && modalityFilter.value !== 'all') {
      const isOnline = item.modalidad === 'en_linea'
      const isHybrid = item.tiene_sesion_online
      let itemMod = 'presencial'
      if (isOnline) itemMod = 'en_linea'
      else if (isHybrid) itemMod = 'hibrido'

      if (modalityFilter.value !== itemMod) return false
    }

    // 5. State Filter
    if (stateFilter.value !== 'all' && item.estado !== stateFilter.value) {
      return false
    }

    return true
  })
})

const filteredStaffList = computed(() => staffList.value)

const filteredSeguidoresList = computed(() => {
  if (selectedSection.value !== 'seguidores') return []
  const query = searchSeguidoresQuery.value.trim().toLowerCase()
  return listItems.value.filter(item => {
    const userVal = item.user as any
    const actorVal = item.actor as any
    
    const userName = (userVal?.nombre_completo || '').toLowerCase()
    const actorName = (actorVal?.nombre_completo || '').toLowerCase()
    
    return userName.includes(query) || actorName.includes(query)
  })
})

const updateActorStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
  closeActionsMenu()
  try {
    const payload: any = {
      actor_status: newStatus,
      reviewed_by: authStore.user?.id,
      reviewed_at: new Date().toISOString()
    }

    if (newStatus === 'approved') {
      payload.rol = 'actor'
    } else if (newStatus === 'rejected') {
      payload.rol = 'user'
    }

    const { error } = await supabase.from('perfiles').update(payload).eq('id', id)
    if (error) throw error

    alert(`Estado del actor actualizado a: ${newStatus === 'approved' ? 'Aprobado' : 'Rechazado'}`)
    await fetchGlobalStats()
    await loadStaffList()
  } catch (err: any) {
    alert('Error al actualizar estado del actor: ' + err.message)
  }
}

const deleteActorProfile = async (actor: any) => {
  closeActionsMenu()
  if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente el perfil de "${actor.nombre_completo}"?`)) return
  try {
    const { error } = await supabase.from('perfiles').delete().eq('id', actor.id)
    if (error) throw error
    alert('Perfil de actor eliminado.')
    await fetchGlobalStats()
    await loadStaffList()
  } catch (err: any) {
    alert('Error al eliminar perfil: ' + err.message)
  }
}

watch([actorModerationFilter, showAdmins], () => {
  if (activeTab.value === 'usuarios') {
    loadStaffList()
  }
})

// Edit actions
const activeSocialInputs = ref<Record<string, boolean>>({
  fb: false,
  ig: false,
  wa: false,
  x: false,
  yt: false,
  web: false
})

const approvedPlacesList = ref<any[]>([])
const gmapsLink = ref('')
const isUploadingImages = ref(false)
const eventImagesInput = ref<HTMLInputElement | null>(null)

const fetchApprovedPlaces = async () => {
  try {
    const { data, error } = await supabase
      .from('lugares')
      .select('id, nombre')
      .order('nombre', { ascending: true })
    if (!error && data) {
      approvedPlacesList.value = data
    }
  } catch (err) {
    console.error('Error fetching approved places:', err)
  }
}

const toggleSocialInput = (network: string) => {
  activeSocialInputs.value[network] = !activeSocialInputs.value[network]
  if (!activeSocialInputs.value[network]) {
    if (network === 'fb') editingItem.value.social_fb = ''
    if (network === 'ig') editingItem.value.social_ig = ''
    if (network === 'wa') editingItem.value.social_wa = ''
    if (network === 'x') editingItem.value.social_x = ''
    if (network === 'yt') editingItem.value.social_yt = ''
    if (network === 'web') editingItem.value.social_web = ''
  }
}

const extractCoordsFromGmaps = () => {
  const url = gmapsLink.value.trim()
  if (!url) {
    alert('Ingresa un enlace de Google Maps primero.')
    return
  }
  
  const atRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/
  const queryRegex = /[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/
  
  let match = url.match(atRegex)
  if (!match) {
    match = url.match(queryRegex)
  }
  
  if (match && match[1] && match[2]) {
    editingItem.value.lat = parseFloat(match[1])
    editingItem.value.lng = parseFloat(match[2])
    alert(`Coordenadas extraídas con éxito:\nLatitud: ${editingItem.value.lat}\nLongitud: ${editingItem.value.lng}`)
  } else {
    alert('No se pudieron extraer las coordenadas de este enlace. Si es un enlace corto (maps.app.goo.gl), ábrelo en tu navegador para obtener el enlace completo y pégalo aquí.')
  }
}

const handleEventImagesUpload = async (e: Event) => {
  console.log('[Upload Debug] handleEventImagesUpload triggered', e)
  const target = e.target as HTMLInputElement
  const files = target.files
  console.log('[Upload Debug] Files list:', files)
  if (!files || files.length === 0) {
    console.log('[Upload Debug] No files selected or target.files is empty')
    return
  }

  console.log('[Upload Debug] Checking session from authStore...')
  const session = authStore.session
  console.log('[Upload Debug] Session user:', session?.user?.email)
  if (!session) {
    console.warn('[Upload Debug] Session not active in authStore')
    alert('Tu sesión ha expirado. Por favor recarga la página e inicia sesión de nuevo.')
    return
  }

  console.log('[Upload Debug] Starting upload of', files.length, 'files')
  isUploadingImages.value = true
  const errors: string[] = []
  try {
    if (!editingItem.value.imagenes) {
      editingItem.value.imagenes = []
    }
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) continue
      console.log(`[Upload Debug] Compressing and uploading file ${i}:`, file.name, 'size:', file.size)
      try {
        const url = await compressAndUploadFile(file)
        console.log(`[Upload Debug] Upload success for file ${i}, URL:`, url)
        editingItem.value.imagenes.push(url)
        if (!editingItem.value.imagen) {
          editingItem.value.imagen = url
        }
      } catch (fileErr: any) {
        errors.push(`${file.name}: ${fileErr.message}`)
        console.error('[Upload Debug] Error subiendo', file.name, fileErr)
      }
    }
    if (errors.length > 0) {
      alert('Algunos archivos no pudieron subirse:\n' + errors.join('\n'))
    }
  } catch (err: any) {
    console.error('[Upload Debug] General try-catch error in handler:', err)
  } finally {
    isUploadingImages.value = false
    target.value = ''
    console.log('[Upload Debug] Upload process finished')
  }
}

const removeEventImage = (index: number) => {
  if (!editingItem.value.imagenes) return
  editingItem.value.imagenes.splice(index, 1)
  if (editingItem.value.imagen === editingItem.value.imagenes[0]) {
    editingItem.value.imagen = editingItem.value.imagenes[0] || ''
  } else if (editingItem.value.imagenes.length === 0) {
    editingItem.value.imagen = ''
  }
}

const openAddModal = () => {
  eventErrors.value = {}
  placeErrors.value = {}
  gmapsLink.value = ''
  activeSocialInputs.value = {
    fb: false,
    ig: false,
    wa: false,
    x: false,
    yt: false,
    web: false
  }

  // Initial reset of values
  editingItem.value = {
    id: null,
    nombre: '',
    titulo: '',
    descripcion: '',
    descripcion_texto: '',
    categoria: '',
    ubicacion: 'CDMX',
    lat: 19.4326,
    lng: -99.1332,
    imagen: '',
    imagen_url: '',
    es_gratuito: true,
    pet_friendly: false,
    apto_ninos: false,
    fecha: '',
    fecha_inicio: '',
    fecha_fin: '',
    enlace_externo: '',
    meta: {},
    modalidad: 'presencial',
    tiene_sesion_online: false,
    reg_link: '',
    sesion_online_link: '',
    lugar_id: '',
    social_fb: '',
    social_ig: '',
    social_wa: '',
    social_x: '',
    social_yt: '',
    social_web: '',
    imagenes: [],
    drive_fotos_url: '',
    clave_fotos: ''
  }

  // Pre-fill meta structure if section contents
  if (selectedSection.value && !['eventos', 'lugares'].includes(selectedSection.value)) {
    const config = SECTION_CONFIGS[selectedSection.value]
    if (config) {
      config.fields.forEach(f => {
        editingItem.value.meta[f.id] = f.type === 'select' ? f.options?.[0] || '' : ''
      })
    }
  }

  if (selectedSection.value === 'eventos') {
    isEventModalOpen.value = true
  } else if (selectedSection.value === 'lugares') {
    isPlaceModalOpen.value = true
  } else {
    isContentModalOpen.value = true
  }
}

const openEditModal = (item: any) => {
  closeActionsMenu()
  eventErrors.value = {}
  placeErrors.value = {}
  gmapsLink.value = ''

  // Determine section if on dashboard
  if (!selectedSection.value) {
    selectedSection.value = resolveItemSection(item)
  }

  // Parse images robustly
  let imgs = item.imagenes
  if (imgs) {
    if (typeof imgs === 'string') {
      try {
        const parsed = JSON.parse(imgs)
        if (Array.isArray(parsed)) {
          imgs = parsed
        } else {
          imgs = [imgs]
        }
      } catch (e) {
        if (imgs.trim()) {
          imgs = [imgs.trim()]
        } else {
          imgs = []
        }
      }
    }
  } else {
    imgs = []
  }
  if (!Array.isArray(imgs)) {
    imgs = []
  }
  imgs = imgs.filter((u: any) => typeof u === 'string' && u.trim() !== '')
  if (imgs.length === 0 && (item.imagen || item.imagen_url)) {
    imgs.push(item.imagen || item.imagen_url)
  }

  // Load data for editing
  editingItem.value = { 
    ...item,
    modalidad: item.modalidad || 'presencial',
    tiene_sesion_online: item.tiene_sesion_online || false,
    reg_link: item.reg_link || '',
    sesion_online_link: item.sesion_online_link || '',
    lugar_id: item.lugar_id || '',
    social_fb: item.social_fb || '',
    social_ig: item.social_ig || '',
    social_wa: item.social_wa || '',
    social_x: item.social_x || '',
    social_yt: item.social_yt || '',
    social_web: item.social_web || '',
    imagenes: imgs,
    drive_fotos_url: item.drive_fotos_url || '',
    clave_fotos: item.clave_fotos || ''
  }

  if (selectedSection.value === 'eventos') {
    editingItem.value.fecha_inicio = item.fecha_inicio ? item.fecha_inicio.substring(0, 16) : ''
    editingItem.value.fecha_fin = item.fecha_fin ? item.fecha_fin.substring(0, 16) : ''
    
    // Initialize active social inputs based on edit item
    activeSocialInputs.value = {
      fb: !!item.social_fb,
      ig: !!item.social_ig,
      wa: !!item.social_wa,
      x: !!item.social_x,
      yt: !!item.social_yt,
      web: !!item.social_web
    }

    isEventModalOpen.value = true
  } else if (selectedSection.value === 'lugares') {
    isPlaceModalOpen.value = true
  } else {
    // Parse meta fields from description JSON
    let descTxt = item.descripcion || ''
    const metaFields: any = {}
    
    // Pre-initialize metadata keys based on section config
    if (selectedSection.value) {
      const config = SECTION_CONFIGS[selectedSection.value]
      if (config) {
        config.fields.forEach(f => {
          metaFields[f.id] = f.type === 'select' ? f.options?.[0] || '' : ''
        })
      }
    }

    try {
      if (descTxt.trim().startsWith('{')) {
        const parsed = JSON.parse(descTxt)
        Object.assign(metaFields, parsed)
        descTxt = parsed.descripcion_texto || ''
      }
    } catch (e) {
      // Ignored
    }

    editingItem.value.titulo = item.titulo || item.nombre || ''
    editingItem.value.descripcion_texto = descTxt
    editingItem.value.meta = metaFields
    isContentModalOpen.value = true
  }
}

const saveItem = async () => {
  console.log('[Save Debug] saveItem function triggered!')
  if (savingItem.value) {
    console.warn('[Save Debug] Save aborted: already saving an item')
    return
  }
  if (!authStore.user) {
    console.warn('[Save Debug] Save aborted: authStore.user is null')
    alert('Tu sesión ha expirado o no estás logueado. Por favor, recarga la página o vuelve a iniciar sesión.')
    return
  }
  savingItem.value = true
  console.log('[Save Debug] Logged user email:', authStore.user.email, 'ID:', authStore.user.id)
  console.log('[Save Debug] selectedSection:', selectedSection.value)
  if (!selectedSection.value) {
    console.warn('[Save Debug] Save aborted: selectedSection is empty')
    return
  }

  eventErrors.value = {}
  placeErrors.value = {}

  try {
    const isEditing = editingItem.value.id !== null
    console.log('[Save Debug] Mode:', isEditing ? 'EDITING existing item' : 'CREATING new item', 'Item ID:', editingItem.value.id)
    console.log('[Save Debug] Raw editingItem value:', JSON.parse(JSON.stringify(editingItem.value)))
    
    let dbPayload: any = {}

    if (selectedSection.value === 'eventos') {
      const eventData = {
        nombre: editingItem.value.nombre,
        descripcion: editingItem.value.descripcion,
        categoria: editingItem.value.categoria,
        modalidad: editingItem.value.modalidad || 'presencial',
        tiene_sesion_online: editingItem.value.modalidad === 'presencial' ? (editingItem.value.tiene_sesion_online || false) : false,
        ubicacion: editingItem.value.modalidad === 'presencial' ? (editingItem.value.ubicacion || null) : null,
        lat: editingItem.value.modalidad === 'presencial' ? (editingItem.value.lat ? Number(editingItem.value.lat) : null) : null,
        lng: editingItem.value.modalidad === 'presencial' ? (editingItem.value.lng ? Number(editingItem.value.lng) : null) : null,
        lugar_id: editingItem.value.modalidad === 'presencial' ? (editingItem.value.lugar_id || null) : null,
        reg_link: editingItem.value.reg_link || '',
        sesion_online_link: editingItem.value.sesion_online_link || '',
        social_fb: editingItem.value.social_fb || '',
        social_ig: editingItem.value.social_ig || '',
        social_wa: editingItem.value.social_wa || '',
        social_x: editingItem.value.social_x || '',
        social_yt: editingItem.value.social_yt || '',
        social_web: editingItem.value.social_web || '',
        es_gratuito: editingItem.value.es_gratuito,
        pet_friendly: editingItem.value.modalidad === 'presencial' ? (editingItem.value.pet_friendly || false) : false,
        apto_ninos: editingItem.value.modalidad === 'presencial' ? (editingItem.value.apto_ninos || false) : false,
        fecha_inicio: formatToISO(editingItem.value.fecha_inicio),
        fecha_fin: formatToISO(editingItem.value.fecha_fin),
        drive_fotos_url: editingItem.value.drive_fotos_url || '',
        clave_fotos: editingItem.value.clave_fotos || ''
      }

      console.log('[Save Debug] Event data structured for validation:', eventData)
      const { valid, errors } = validateForm(EventoSchema, eventData)
      console.log('[Save Debug] Event validation result:', { valid, errors })
      if (!valid) {
        eventErrors.value = errors
        console.warn('[Save Debug] Validation failed. Errors:', errors)
        alert('Por favor, revisa los errores indicados en el formulario de Evento.')
        return
      }

      dbPayload = {
        ...eventData,
        imagen_url: editingItem.value.imagen || editingItem.value.imagen_url || '',
        imagenes: editingItem.value.imagenes || [],
        estado: isEditing ? editingItem.value.estado : (isUserAdmin.value ? 'approved' : 'pending')
      }
    } else if (selectedSection.value === 'lugares') {
      const placeData = {
        nombre: editingItem.value.nombre,
        descripcion: editingItem.value.descripcion,
        categoria: editingItem.value.categoria,
        ubicacion: editingItem.value.ubicacion,
        lat: Number(editingItem.value.lat),
        lng: Number(editingItem.value.lng)
      }

      console.log('[Save Debug] Place data structured for validation:', placeData)
      const { valid, errors } = validateForm(LugarSchema, placeData)
      console.log('[Save Debug] Place validation result:', { valid, errors })
      if (!valid) {
        placeErrors.value = errors
        console.warn('[Save Debug] Validation failed. Errors:', errors)
        alert('Por favor, revisa los errores indicados en el formulario de Lugar.')
        return
      }

      dbPayload = {
        ...placeData,
        imagen_url: editingItem.value.imagen || editingItem.value.imagen_url || '',
        estado: isEditing ? editingItem.value.estado : (isUserAdmin.value ? 'approved' : 'pending')
      }
    } else {
      // Dynamic Section Contents
      const fullDesc = JSON.stringify({
        ...editingItem.value.meta,
        descripcion_texto: editingItem.value.descripcion_texto
      })
      
      let hub = 'colibri'
      if (selectedSection.value) {
        if (['voluntariados', 'convocatoria', 'causas'].includes(selectedSection.value)) hub = 'ajolote'
        else if (['normativa', 'fondos'].includes(selectedSection.value)) hub = 'lobo'
      }

      dbPayload = {
        seccion_id: selectedSection.value,
        parent_hub: hub,
        titulo: editingItem.value.titulo,
        descripcion: fullDesc,
        imagen_url: editingItem.value.imagen_url,
        enlace_externo: editingItem.value.enlace_externo || null,
        fecha_evento: editingItem.value.fecha_evento || null,
        estado: isEditing ? editingItem.value.estado : (isUserAdmin.value ? 'approved' : 'pending')
      }
    }

    if (!isEditing) {
      dbPayload.owner_id = authStore.user.id
    }

    console.log('[Save Debug] Final DB payload:', dbPayload)

    let error: any
    if (selectedSection.value === 'eventos') {
      if (isEditing) {
        console.log('[Save Debug] Calling Supabase events UPDATE for ID:', editingItem.value.id)
        const { error: e } = await supabase.from('eventos').update(dbPayload).eq('id', editingItem.value.id)
        error = e
      } else {
        console.log('[Save Debug] Calling Supabase events INSERT')
        const { error: e } = await supabase.from('eventos').insert(dbPayload)
        error = e
      }
    } else if (selectedSection.value === 'lugares') {
      if (isEditing) {
        console.log('[Save Debug] Calling Supabase places UPDATE for ID:', editingItem.value.id)
        const { error: e } = await supabase.from('lugares').update(dbPayload).eq('id', editingItem.value.id)
        error = e
      } else {
        console.log('[Save Debug] Calling Supabase places INSERT')
        const { error: e } = await supabase.from('lugares').insert(dbPayload)
        error = e
      }
    } else {
      if (isEditing) {
        console.log('[Save Debug] Calling Supabase contenido_secciones UPDATE for ID:', editingItem.value.id)
        const { error: e } = await supabase.from('contenido_secciones').update(dbPayload).eq('id', editingItem.value.id)
        error = e
      } else {
        console.log('[Save Debug] Calling Supabase contenido_secciones INSERT')
        const { error: e } = await supabase.from('contenido_secciones').insert(dbPayload)
        error = e
      }
    }

    if (error) {
      console.error('[Save Debug] Supabase returned database error:', error)
      throw error
    }

    console.log('[Save Debug] Save query completed successfully!')
    closeAllModals()
    if (activeTab.value === 'dashboard') {
      fetchDashboardList()
      fetchGlobalStats()
    } else {
      fetchListData()
    }
    alert('Registro guardado correctamente.')
  } catch (e: any) {
    console.error('[Save Debug] Exception caught in saveItem:', e)
    alert('Error al guardar el registro: ' + e.message)
  } finally {
    savingItem.value = false
  }
}

const deleteItem = async (item: any) => {
  closeActionsMenu()
  if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return
  try {
    let error: any
    const section = resolveItemSection(item)
    
    if (section === 'eventos') {
      const { error: e } = await supabase.from('eventos').delete().eq('id', item.id)
      error = e
    } else if (section === 'lugares') {
      const { error: e } = await supabase.from('lugares').delete().eq('id', item.id)
      error = e
    } else {
      const { error: e } = await supabase.from('contenido_secciones').delete().eq('id', item.id)
      error = e
    }

    if (error) throw error
    alert('Registro eliminado.')
    
    if (activeTab.value === 'dashboard') {
      fetchDashboardList()
      fetchGlobalStats()
    } else {
      fetchListData()
    }
  } catch (e: any) {
    alert('Error al eliminar: ' + e.message)
  }
}

// Moderation approval/rejection actions (Admin only)
const updateModerationStatus = async (item: any, newStatus: 'approved' | 'rejected') => {
  closeActionsMenu()
  try {
    let error: any
    const payload = { estado: newStatus }
    const section = resolveItemSection(item)

    if (section === 'eventos') {
      const { error: e } = await supabase.from('eventos').update(payload).eq('id', item.id)
      error = e
    } else if (section === 'lugares') {
      const { error: e } = await supabase.from('lugares').update(payload).eq('id', item.id)
      error = e
    } else {
      const { error: e } = await supabase.from('contenido_secciones').update(payload).eq('id', item.id)
      error = e
    }

    if (error) throw error
    
    // Optionally trigger revision notifications as in Vanilla JS
    await enviarNotificacionRevision(item.owner_id, section || 'contenido', newStatus)

    alert(`Estado actualizado a: ${newStatus === 'approved' ? 'Aprobado' : 'Rechazado'}`)
    
    if (activeTab.value === 'dashboard') {
      fetchDashboardList()
      fetchGlobalStats()
    } else {
      fetchListData()
    }
  } catch (e: any) {
    alert('Error al moderar: ' + e.message)
  }
}

const enviarNotificacionRevision = async (ownerId: string, tipo: string, estado: 'approved' | 'rejected') => {
  if (!ownerId) return
  try {
    const titulo = estado === 'approved' ? '🎉 Tu propuesta fue aprobada' : '⚠️ Tu propuesta requiere revisión'
    const mensaje = estado === 'approved' 
      ? `Felicidades, tu contenido de tipo "${tipo}" ha sido revisado y ya se encuentra visible en la plataforma.`
      : `Lo sentimos, tu propuesta de tipo "${tipo}" no cumple con los lineamientos actuales. Por favor, edítala desde tu panel.`

    const { data: notif, error } = await supabase.from('notificaciones').insert({
      remitente_id: authStore.user?.id,
      titulo,
      mensaje,
      destinatarios: ownerId
    }).select().single()

    if (!error && notif) {
      await supabase.from('notificaciones_usuarios').insert({
        notificacion_id: notif.id,
        usuario_id: ownerId,
        leido: false
      })
    }
  } catch (e) {
    console.error('Error sending moderation notification:', e)
  }
}

// Actor permissions modals (Admin only)
const openPermissionsModal = async (actor: any) => {
  closeActionsMenu()
  selectedActorId.value = actor.id
  selectedActorName.value = actor.nombre_completo || 'Actor'

  // Reset checkboxes
  Object.keys(actorPermissions.value).forEach(k => actorPermissions.value[k] = false)
  Object.keys(actorFuncPermissions.value).forEach(k => actorFuncPermissions.value[k] = false)

  // Fetch sections permissions
  const { data: secData } = await supabase
    .from('permisos_actores')
    .select('seccion_id')
    .eq('user_id', actor.id)
  
  if (secData) {
    secData.forEach(p => {
      const propKey = `puede_editar_${p.seccion_id}`
      if (propKey in actorPermissions.value) {
        actorPermissions.value[propKey] = true
      }
    })
  }

  // Fetch operations permissions
  const { data: funcData } = await supabase
    .from('permisos_funciones')
    .select('*')
    .eq('user_id', actor.id)
    .maybeSingle()
  
  if (funcData) {
    actorFuncPermissions.value = {
      puede_crear_eventos: funcData.puede_crear_eventos,
      puede_crear_lugares: funcData.puede_crear_lugares,
      puede_enviar_notificaciones: funcData.puede_enviar_notificaciones,
      visible_en_directorio: funcData.visible_en_directorio,
      puede_gestionar_slider: false
    }
  }

  isPermissionsModalOpen.value = true
}

const savePermissions = async () => {
  if (!selectedActorId.value) return

  try {
    // 1. Save section permissions (delete old, insert new checked)
    await supabase.from('permisos_actores').delete().eq('user_id', selectedActorId.value)

    const sectionsToInsert: any[] = []
    Object.keys(actorPermissions.value).forEach(k => {
      if (actorPermissions.value[k]) {
        const secId = k.replace('puede_editar_', '')
        // Determine parent hub
        let hub = 'colibri'
        if (['voluntariados', 'convocatoria', 'causas', 'lugares'].includes(secId)) hub = 'ajolote'
        if (['normativa', 'fondos'].includes(secId)) hub = 'lobo'

        sectionsToInsert.push({
          user_id: selectedActorId.value,
          parent_hub: hub,
          seccion_id: secId
        })
      }
    })

    if (sectionsToInsert.length > 0) {
      const { error } = await supabase.from('permisos_actores').insert(sectionsToInsert)
      if (error) throw error
    }

    // 2. Save operations permissions
    const { data: existingFunc } = await supabase
      .from('permisos_funciones')
      .select('id')
      .eq('user_id', selectedActorId.value)
      .maybeSingle()
    
    const funcPayload = {
      user_id: selectedActorId.value,
      puede_crear_eventos: actorFuncPermissions.value.puede_crear_eventos,
      puede_crear_lugares: actorFuncPermissions.value.puede_crear_lugares,
      puede_enviar_notificaciones: actorFuncPermissions.value.puede_enviar_notificaciones,
      visible_en_directorio: actorFuncPermissions.value.visible_en_directorio
    }

    let fError: any
    if (existingFunc) {
      const { error } = await supabase.from('permisos_funciones').update(funcPayload).eq('id', existingFunc.id)
      fError = error
    } else {
      const { error } = await supabase.from('permisos_funciones').insert(funcPayload)
      fError = error
    }

    if (fError) throw fError

    alert('Permisos guardados con éxito.')
    isPermissionsModalOpen.value = false
    loadStaffList()
  } catch (e: any) {
    alert('Error al guardar permisos: ' + e.message)
  }
}

// Métodos para cargar municipios y gestionar zonas de impacto
const onEstadoChange = async (formType: 'own' | 'admin') => {
  const code = formType === 'own' ? selectedEstado.value : selectedEstadoAdmin.value
  try {
    if (formType === 'own') {
      selectedMunicipio.value = ''
      municipiosList.value = []
      if (code) {
        municipiosList.value = await TerritoryService.getMunicipalities(code)
      }
    } else {
      selectedMunicipioAdmin.value = ''
      municipiosListAdmin.value = []
      if (code) {
        municipiosListAdmin.value = await TerritoryService.getMunicipalities(code)
      }
    }
  } catch (err) {
    console.error('Error al cargar municipios:', err)
  }
}

const agregarZonaImpacto = (formType: 'own' | 'admin') => {
  if (formType === 'own') {
    if (!selectedEstado.value) return
    const est = estadosList.value.find(e => e.code === selectedEstado.value)
    if (!est) return
    
    let zonaStr = est.name
    if (selectedMunicipio.value) {
      zonaStr = `${selectedMunicipio.value}, ${est.name}`
    }
    
    if (!profileForm.value.zonas_impacto) {
      profileForm.value.zonas_impacto = []
    }
    if (!profileForm.value.zonas_impacto.includes(zonaStr)) {
      profileForm.value.zonas_impacto.push(zonaStr)
    }
    selectedMunicipio.value = ''
  } else {
    if (!selectedEstadoAdmin.value) return
    const est = estadosList.value.find(e => e.code === selectedEstadoAdmin.value)
    if (!est) return
    
    let zonaStr = est.name
    if (selectedMunicipioAdmin.value) {
      zonaStr = `${selectedMunicipioAdmin.value}, ${est.name}`
    }
    
    if (!profileAdminForm.value.zonas_impacto) {
      profileAdminForm.value.zonas_impacto = []
    }
    if (!profileAdminForm.value.zonas_impacto.includes(zonaStr)) {
      profileAdminForm.value.zonas_impacto.push(zonaStr)
    }
    selectedMunicipioAdmin.value = ''
  }
}

const removerZonaImpacto = (zona: string, formType: 'own' | 'admin') => {
  if (formType === 'own') {
    profileForm.value.zonas_impacto = (profileForm.value.zonas_impacto || []).filter(z => z !== zona)
  } else {
    profileAdminForm.value.zonas_impacto = (profileAdminForm.value.zonas_impacto || []).filter(z => z !== zona)
  }
}

// Profile edit methods
const loadProfileForm = () => {
  if (!authStore.profile) return
  const p = authStore.profile as any
  profileForm.value = {
    nombre_completo: p.nombre_completo || '',
    bio: p.bio || '',
    telefono: p.telefono || '',
    facebook: p.links_sociales?.facebook || '',
    instagram: p.links_sociales?.instagram || '',
    whatsapp: p.links_sociales?.whatsapp || '',
    twitter: p.links_sociales?.twitter || '',
    youtube: p.links_sociales?.youtube || '',
    web: p.links_sociales?.web || '',
    videos_presentacion: Array.isArray(p.videos_presentacion) ? [...p.videos_presentacion] : [],
    zonas_impacto: Array.isArray(p.zonas_impacto) ? [...p.zonas_impacto] : []
  }
}

const refreshProfileOnly = async () => {
  if (!authStore.user) return
  const { data } = await supabase.from('perfiles').select('*').eq('id', authStore.user.id).maybeSingle()
  if (data) {
    authStore.profile = data
    localStorage.setItem('eco_user_name', data.nombre_completo?.split(' ')[0] || '')
    if (data.avatar_url) localStorage.setItem('eco_user_avatar', data.avatar_url)
  }
}

const saveProfile = async () => {
  if (!authStore.user) return
  profileSaving.value = true
  try {
    const payload: any = {
      nombre_completo: profileForm.value.nombre_completo,
      bio: profileForm.value.bio,
      telefono: profileForm.value.telefono,
      zonas_impacto: [...(profileForm.value.zonas_impacto || [])],
      links_sociales: {
        facebook: profileForm.value.facebook,
        instagram: profileForm.value.instagram,
        whatsapp: profileForm.value.whatsapp,
        twitter: profileForm.value.twitter,
        youtube: profileForm.value.youtube,
        web: profileForm.value.web
      }
    }

    if (authStore.profile?.permitir_edicion_videos !== false) {
      payload.videos_presentacion = [...(profileForm.value.videos_presentacion || [])]
    }

    const { error } = await supabase.from('perfiles').update(payload).eq('id', authStore.user.id)
    if (error) throw error
    alert('Perfil actualizado correctamente.')
    await refreshProfileOnly() // Reload session profile details quickly
  } catch (e: any) {
    alert('Error al actualizar perfil: ' + e.message)
  } finally {
    profileSaving.value = false
  }
}

// Config platform methods
const loadConfig = async () => {
  if (!isUserAdmin.value || configLoading.value) return
  configLoading.value = true
  try {
    const { data, error } = await supabase
      .from('config_plataforma')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    
    if (error) throw error
    if (data) {
      configForm.value = {
        registro_abierto: data.registro_abierto ?? true,
        modo_mantenimiento: data.modo_mantenimiento ?? false,
        mensaje_bienvenida: data.mensaje_bienvenida ?? '',
        banner_activo: data.banner_activo ?? '',
        aprobacion_automatica: data.aprobacion_automatica ?? false,
        notificar_admins: data.notificar_admins ?? false,
        mapa_lat: data.mapa_lat ?? 19.4326,
        mapa_lng: data.mapa_lng ?? -99.1332,
        mapa_zoom: data.mapa_zoom ?? 12,
        limite_archivos_mb: data.limite_archivos_mb ?? 10,
        activar_captcha: data.activar_captcha ?? false,
        email_soporte: data.email_soporte ?? '',
        redes_sociales: {
          facebook: data.redes_sociales?.facebook ?? '',
          instagram: data.redes_sociales?.instagram ?? '',
          twitter: data.redes_sociales?.twitter ?? '',
          linkedin: data.redes_sociales?.linkedin ?? ''
        }
      }
    }
  } catch (err: any) {
    console.error('Error al cargar la configuración de la plataforma:', err)
  } finally {
    configLoading.value = false
  }
}

const saveConfig = async () => {
  if (!isUserAdmin.value) return
  configSaving.value = true
  try {
    const payload = {
      registro_abierto: configForm.value.registro_abierto,
      modo_mantenimiento: configForm.value.modo_mantenimiento,
      mensaje_bienvenida: configForm.value.mensaje_bienvenida,
      banner_activo: configForm.value.banner_activo,
      aprobacion_automatica: configForm.value.aprobacion_automatica,
      notificar_admins: configForm.value.notificar_admins,
      mapa_lat: Number(configForm.value.mapa_lat),
      mapa_lng: Number(configForm.value.mapa_lng),
      mapa_zoom: Number(configForm.value.mapa_zoom),
      limite_archivos_mb: Number(configForm.value.limite_archivos_mb),
      activar_captcha: configForm.value.activar_captcha,
      email_soporte: configForm.value.email_soporte,
      redes_sociales: {
        facebook: configForm.value.redes_sociales.facebook,
        instagram: configForm.value.redes_sociales.instagram,
        twitter: configForm.value.redes_sociales.twitter,
        linkedin: configForm.value.redes_sociales.linkedin
      }
    }

    const { error } = await supabase
      .from('config_plataforma')
      .update(payload)
      .eq('id', 1)
    
    if (error) throw error
    alert('Configuración guardada correctamente.')
  } catch (err: any) {
    alert('Error al guardar la configuración: ' + err.message)
  } finally {
    configSaving.value = false
  }
}

const securityForm = ref({
  newEmail: '',
  newPassword: ''
})

const updateEmail = async () => {
  if (!securityForm.value.newEmail) return
  const { error } = await supabase.auth.updateUser({ email: securityForm.value.newEmail })
  if (error) {
    alert('Error al actualizar correo: ' + error.message)
  } else {
    alert('Se ha enviado un correo de confirmación a ambas direcciones.')
    securityForm.value.newEmail = ''
  }
}

const updatePassword = async () => {
  if (!securityForm.value.newPassword) return
  if (securityForm.value.newPassword.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres')
    return
  }
  const { error } = await supabase.auth.updateUser({ password: securityForm.value.newPassword })
  if (error) {
    alert('Error al actualizar contraseña: ' + error.message)
  } else {
    alert('Contraseña actualizada correctamente.')
    securityForm.value.newPassword = ''
  }
}

// Image compression and upload helpers
const compressAndUploadFile = async (file: File): Promise<string> => {
  console.log('[Upload Debug] compressAndUploadFile start for:', file.name, 'mime:', file.type)
  // Verify session before attempting upload
  const session = authStore.session
  if (!session) {
    console.warn('[Upload Debug] compressAndUploadFile: No session active in authStore')
    throw new Error('Tu sesión ha expirado o no está activa. Por favor recarga la página.')
  }

  // La compresión nativa se delega directamente a la utilidad importada compressImage

  console.log('[Upload Debug] Compressing image with Canvas native utility...')
  let blob: Blob
  let ext = 'jpg'
  let mimeType = 'image/jpeg'

  try {
    const compressed = await compressImage(file, 1200, 0.8)
    blob = compressed
    mimeType = compressed.type || 'image/jpeg'
    ext = mimeType.split('/')[1] || 'jpg'
    if (ext === 'jpeg') ext = 'jpg'
  } catch (err: any) {
    console.warn('[Upload Debug] Native Canvas compression helper failed, uploading original:', err)
    blob = file
    mimeType = file.type
    ext = file.name.split('.').pop() || 'jpg'
  }

  console.log('[Upload Debug] Compression success, size:', blob.size, 'type:', mimeType)

  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`
  console.log('[Upload Debug] Uploading blob to Supabase Storage with name:', fileName)
  const { error: uploadError, data: uploadData } = await supabase.storage
    .from('imagenes-plataforma')
    .upload(fileName, blob, { contentType: mimeType, upsert: false })

  if (uploadError) {
    console.error('[Upload Debug] Supabase upload error:', uploadError)
    // Provide helpful error messages
    const msg = uploadError.message || String(uploadError)
    if (msg.includes('Unauthorized') || msg.includes('403') || msg.includes('permission') || msg.includes('policy')) {
      throw new Error(`Sin permiso para subir imágenes. Verifica que tu cuenta tenga los permisos necesarios. (${msg})`)
    }
    throw new Error(`Error al subir imagen a Supabase: ${msg}`)
  }

  console.log('[Upload Debug] Supabase upload success! Data:', uploadData)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  return `${supabaseUrl}/storage/v1/object/public/imagenes-plataforma/${fileName}`
}

const handleAvatarUpload = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !authStore.user) return
  
  avatarUploading.value = true
  try {
    const publicUrl = await compressAndUploadFile(file)
    
    // Update profile in DB
    const { error } = await supabase
      .from('perfiles')
      .update({ avatar_url: publicUrl })
      .eq('id', authStore.user.id)
    
    if (error) throw error
    alert('Avatar actualizado.')
    await refreshProfileOnly() // Reload profile quickly
  } catch (err: any) {
    alert('Error al subir avatar: ' + err.message)
  } finally {
    avatarUploading.value = false
  }
}

// Notification center methods
const fetchNotifHistory = async () => {
  if (!authStore.user) return
  let query = supabase.from('notificaciones').select('*').order('created_at', { ascending: false })
  if (isUserActor.value) {
    query = query.eq('remitente_id', authStore.user.id)
  }
  const { data } = await query.limit(20)
  if (data) notifHistory.value = data
}

const selectNotifDetail = (notif: any) => {
  activeNotifDetail.value = notif
  isNotifReviewModalOpen.value = true
}

const sendNotification = async () => {
  if (!authStore.user) return
  sendingNotif.value = true
  try {
    const segments: string[] = []
    if (notifForm.value.dest_todos) segments.push('todos')
    if (notifForm.value.dest_actores) segments.push('actores')
    if (notifForm.value.dest_voluntariados) segments.push('voluntariados')

    const destsStr = segments.join(',')

    const { data: notif, error } = await supabase.from('notificaciones').insert({
      remitente_id: authStore.user.id,
      titulo: notifForm.value.titulo,
      mensaje: notifForm.value.mensaje,
      destinatarios: destsStr,
      enlace_url: notifForm.value.enlace_url || null,
      archivo_url: notifForm.value.archivo_url || null
    }).select().single()

    if (error) throw error

    // Create user mappings
    let targetUserIds: string[] = []
    if (segments.includes('todos')) {
      const { data } = await supabase.from('perfiles').select('id')
      if (data) targetUserIds = data.map(p => p.id)
    } else {
      if (segments.includes('actores')) {
        const { data } = await supabase.from('perfiles').select('id').eq('rol', 'actor')
        if (data) targetUserIds = [...targetUserIds, ...data.map(p => p.id)]
      }
      if (segments.includes('voluntariados')) {
        const { data } = await supabase.from('perfiles').select('id').eq('rol', 'user')
        if (data) targetUserIds = [...targetUserIds, ...data.map(p => p.id)]
      }
      targetUserIds = [...new Set(targetUserIds)]
    }

    // Force admins to receive notification too
    const { data: admins } = await supabase.from('perfiles').select('id').eq('rol', 'admin')
    if (admins) {
      targetUserIds = [...new Set([...targetUserIds, ...admins.map(a => a.id)])]
    }

    if (targetUserIds.length > 0) {
      const deliveryPayload = targetUserIds.map(uid => ({
        notificacion_id: notif.id,
        usuario_id: uid,
        leido: false
      }))
      const { error: dError } = await supabase.from('notificaciones_usuarios').insert(deliveryPayload)
      if (dError) throw dError
    }

    alert('Notificación enviada con éxito.')
    // Reset form
    notifForm.value = {
      titulo: '',
      mensaje: '',
      enlace_url: '',
      archivo_url: '',
      dest_todos: true,
      dest_actores: true,
      dest_voluntariados: true
    }
    fetchNotifHistory()
  } catch (e: any) {
    alert('Error al enviar la notificación: ' + e.message)
  } finally {
    sendingNotif.value = false
  }
}

// Carousel slider methods
const fetchSlides = async () => {
  const { data } = await supabase.from('carrusel_principal').select('*').order('orden', { ascending: true })
  if (data) slidesList.value = data
}

const openSlideModal = (slide: any = null) => {
  if (slide) {
    sliderForm.value = { ...slide }
  } else {
    sliderForm.value = {
      id: null,
      titulo: '',
      subtitulo: '',
      enlace_url: '',
      imagen_url: '',
      imagen_pc_url: '',
      imagen_tablet_url: '',
      badge: '',
      orden: slidesList.value.length,
      activo: true,
      sin_boton: false
    }
  }
  isSliderModalOpen.value = true
}

const saveSlide = async () => {
  try {
    const payload = {
      titulo: sliderForm.value.titulo || null,
      subtitulo: sliderForm.value.subtitulo || null,
      enlace_url: sliderForm.value.enlace_url || null,
      imagen_url: sliderForm.value.imagen_url,
      imagen_pc_url: sliderForm.value.imagen_pc_url || null,
      imagen_tablet_url: sliderForm.value.imagen_tablet_url || null,
      badge: sliderForm.value.badge || null,
      orden: Number(sliderForm.value.orden),
      activo: sliderForm.value.activo,
      sin_boton: sliderForm.value.sin_boton
    }

    let error: any
    if (sliderForm.value.id) {
      const { error: e } = await supabase.from('carrusel_principal').update(payload).eq('id', sliderForm.value.id)
      error = e
    } else {
      const { error: e } = await supabase.from('carrusel_principal').insert(payload)
      error = e
    }

    if (error) throw error
    alert('Slide guardado.')
    isSliderModalOpen.value = false
    fetchSlides()
  } catch (e: any) {
    alert('Error al guardar slide: ' + e.message)
  }
}

const deleteSlide = async (id: number) => {
  if (!confirm('¿Deseas eliminar este slide del carrusel principal?')) return
  const { error } = await supabase.from('carrusel_principal').delete().eq('id', id)
  if (!error) {
    alert('Slide eliminado.')
    fetchSlides()
  }
}

// File picker uploads in forms
const handleItemImageUpload = async (e: Event, targetField: 'imagen' | 'imagen_url' | 'archivo_url') => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  try {
    const publicUrl = await compressAndUploadFile(file)
    if (targetField === 'imagen') {
      editingItem.value.imagen = publicUrl
    } else if (targetField === 'imagen_url') {
      editingItem.value.imagen_url = publicUrl
    } else if (targetField === 'archivo_url') {
      notifForm.value.archivo_url = publicUrl
    }
  } catch (err: any) {
    alert('Error al subir archivo: ' + err.message)
  }
}

const handleProfileAdminAvatarUpload = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  try {
    const publicUrl = await compressAndUploadFile(file)
    profileAdminForm.value.avatar_url = publicUrl
  } catch (err: any) {
    alert('Error al subir imagen: ' + err.message)
  }
}

const handleSliderImageUpload = async (e: Event, targetField: 'imagen_url' | 'imagen_pc_url' | 'imagen_tablet_url') => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  try {
    const publicUrl = await compressAndUploadFile(file)
    sliderForm.value[targetField] = publicUrl
  } catch (err: any) {
    alert('Error al subir imagen del slider: ' + err.message)
  }
}

// Sidebar links list
const navigateTo = (view: string) => {
  activeTab.value = view
  selectedHub.value = null
  selectedSection.value = null

  if (view === 'usuarios') {
    actorModerationFilter.value = 'approved'
    loadStaffList()
  } else if (view === 'voluntarios') {
    loadVoluntariosList()
  } else if (view === 'notificaciones') {
    fetchNotifHistory()
  } else if (view === 'slider') {
    fetchSlides()
  } else if (view === 'perfil') {
    loadProfileForm()
  } else if (view === 'dashboard') {
    fetchGlobalStats()
    fetchDashboardList()
  } else if (view === 'config') {
    loadConfig()
  }
}

// Close modals
const closeAllModals = () => {
  isEventModalOpen.value = false
  isPlaceModalOpen.value = false
  isContentModalOpen.value = false
  isPermissionsModalOpen.value = false
  isProfileAdminModalOpen.value = false
  isSliderModalOpen.value = false
  eventErrors.value = {}
  placeErrors.value = {}

  if (activeTab.value === 'dashboard') {
    selectedSection.value = null
  }
}

const fetchAndEditItem = async (section: string, id: string) => {
  try {
    let query: any = supabase.from(section).select('*')
    if (section === 'eventos' || section === 'lugares') {
      query = supabase.from(section).select('*, publicador:owner_id(nombre_completo)')
    }
    const { data, error } = await query.eq('id', id).single()
    if (error) throw error
    if (data) {
      openEditModal(data)
    }
  } catch (err) {
    console.error('Error fetching item for editing:', err)
  }
}

// Handle query parameter deep linking
const checkQueryParams = () => {
  const action = route.query.action
  const section = route.query.section as string
  const hub = route.query.hub as 'colibri' | 'ajolote' | 'lobo'
  const tab = route.query.tab as string
  const id = route.query.id as string

  if (action === 'new' && section === 'lugares') {
    selectSection('lugares')
    setTimeout(() => openAddModal(), 300)
  } else if (action === 'new' && section && hub) {
    showHubMenu(hub)
    selectSection(section)
    setTimeout(() => openAddModal(), 300)
  } else if (action === 'edit' && section && id) {
    selectSection(section)
    setTimeout(() => fetchAndEditItem(section, id), 300)
  } else if (tab) {
    activeTab.value = tab
    if (tab === 'tabla-seccion' && section) {
      selectSection(section)
    }
  }
}

onMounted(async () => {
  // Cargar estados
  try {
    estadosList.value = await TerritoryService.getStates()
  } catch (e) {
    console.error('Error al cargar estados en panel:', e)
  }

  if (!authStore.initialized) {
    await authStore.init()
  } else if (authStore.loading) {
    await new Promise<void>(resolve => {
      const unwatch = watch(() => authStore.loading, (loading) => {
        if (!loading) {
          unwatch()
          resolve()
        }
      })
    })
  }

  await Promise.all([
    fetchActorPermissions(),
    fetchGlobalStats(),
    fetchDashboardList(),
    fetchApprovedPlaces(),
    isUserAdmin.value ? loadConfig() : Promise.resolve()
  ])

  loadProfileForm()
  checkQueryParams()

  // Add global click listener for actions menu
  document.addEventListener('click', closeActionsMenu)
})

// Defensive watcher: if profile resolves asynchronously after mount (race condition),
// reload dashboard data so the UI is never left empty or stuck.
watch(() => authStore.profile, (newProfile, oldProfile) => {
  if (newProfile && !oldProfile && listItems.value.length === 0) {
    // Profile just resolved — ensure data is loaded
    Promise.all([
      fetchActorPermissions(),
      fetchGlobalStats(),
      fetchDashboardList()
    ])
    loadProfileForm()
  }
}, { immediate: false })

onUnmounted(() => {
  document.removeEventListener('click', closeActionsMenu)
})

// Logout
const handleLogout = async () => {
  await authStore.logout()
  router.push('/')
}

// Formatting helper
const formatRelativeDate = (dateStr: string) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div class="admin-body" :class="{ 'sidebar-active': isMobileSidebarActive }">
    <!-- LAYOUT PRINCIPAL -->

      <!-- MENU SIDEBAR -->
      <aside 
        class="admin-sidebar" 
        :class="{ 'collapsed': isSidebarCollapsed, 'active': isMobileSidebarActive }"
        id="admin-sidebar"
      >
      <!-- SIDEBAR LOGO -->
        <div class="sidebar-logo">
          <div class="logo-main">
            <img src="/assets/img/logo-navbar.webp" alt="EcoGuía Logo">
            <span v-if="!isSidebarCollapsed">EcoGuía <span style="color: var(--admin-accent);">SOS</span></span>
          </div>
          <button class="sidebar-toggle-btn desktop-only" @click="isSidebarCollapsed = !isSidebarCollapsed" title="Contraer menú">
            <i :class="isSidebarCollapsed ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left'"></i>
          </button>
        </div>

        <!-- PROFILE CARD -->
        <div class="sidebar-profile-card">
          <div class="profile-avatar-container">
            <div
              class="profile-avatar"
              id="sidebar-avatar"
              :style="authStore.profile?.avatar_url ? `background-image: url(${authStore.profile.avatar_url}); background-size: cover; background-position: center; border: none;` : ''"
            >
              <span v-if="!authStore.profile?.avatar_url">
                {{ (authStore.profile?.nombre_completo || 'U').charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="online-indicator"></div>
          </div>
          <div class="profile-info" v-if="!isSidebarCollapsed">
            <span class="profile-name" id="sidebar-user-name">{{ authStore.profile?.nombre_completo || 'Administrador' }}</span>
            <span class="profile-role-badge" :class="authStore.profile?.rol" id="sidebar-user-role">
              ● {{ isUserAdmin ? 'Administrador' : 'Actor' }}
            </span>
          </div>
        </div>

        <nav class="admin-menu">
          <ul>
            <li class="menu-item-dashboard" :class="{ 'active': activeTab === 'dashboard' }">
              <a href="#" @click.prevent="navigateTo('dashboard')">
                <i class="fa-solid fa-chart-line" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Dashboard</span>
              </a>
            </li>

            <!-- ADMIN ONLY - PLATFORM MANAGEMENT -->
            <template v-if="isUserAdmin">
              <li class="menu-category" v-if="!isSidebarCollapsed">Gestión Plataforma</li>
              <li class="menu-item-gestion" :class="{ 'active': activeTab === 'usuarios' }">
                <a href="#" @click.prevent="navigateTo('usuarios')">
                  <i class="fa-solid fa-users-gear" style="margin-right:10px;"></i>
                  <span v-if="!isSidebarCollapsed">Actores / Staff</span>
                  <span class="pending-badge" v-if="pendingActoresCount > 0 && !isSidebarCollapsed" style="margin-left: 8px; background: #ef4444; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; font-weight: 700;">
                    {{ pendingActoresCount }}
                  </span>
                </a>
              </li>
              <li class="menu-item-gestion" :class="{ 'active': activeTab === 'voluntarios' }">
                <a href="#" @click.prevent="navigateTo('voluntarios')">
                  <i class="fa-solid fa-users" style="margin-right:10px;"></i>
                  <span v-if="!isSidebarCollapsed">Voluntarios Totales</span>
                </a>
              </li>
              <li class="menu-item-gestion" :class="{ 'active': activeTab === 'historial' }">
                <a href="#" @click.prevent="navigateTo('historial')">
                  <i class="fa-solid fa-clock-rotate-left" style="margin-right:10px;"></i>
                  <span v-if="!isSidebarCollapsed">Historial Actividad</span>
                </a>
              </li>
            </template>

            <!-- SHARED CONTENTS SECTION -->
            <li class="menu-category" v-if="!isSidebarCollapsed">Contenidos</li>
            
            <li 
              v-if="isUserAdmin || actorFunctions.puede_crear_eventos" 
              class="menu-item-contenidos"
              :class="{ 'active': selectedSection === 'eventos' }"
            >
              <a href="#" @click.prevent="selectSection('eventos')">
                <i class="fa-solid fa-calendar-days" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">{{ isUserAdmin ? 'Eventos' : 'Mis Eventos' }}</span>
              </a>
            </li>

            <li 
              v-if="isUserAdmin || actorFunctions.puede_crear_lugares || actorSections.includes('lugares')" 
              class="menu-item-contenidos"
              :class="{ 'active': selectedSection === 'lugares' }"
            >
              <a href="#" @click.prevent="selectSection('lugares')">
                <i class="fa-solid fa-map-pin" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">{{ isUserAdmin ? 'Lugares' : 'Mis Lugares' }}</span>
              </a>
            </li>

            <li class="menu-item-contenidos" :class="{ 'active': selectedSection === 'seguidores' }">
              <a href="#" @click.prevent="selectSection('seguidores')">
                <i class="fa-solid fa-heart" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Seguidores</span>
              </a>
            </li>

            <!-- HUBS & SECTIONS -->
            <li class="menu-category" v-if="!isSidebarCollapsed">Hubs y Secciones</li>
            
            <li 
              v-if="isUserAdmin || actorSections.some(s => hubsConfig.colibri.sections.map(x => x.id).includes(s))" 
              class="menu-item-colibri"
              :class="{ 'active': activeTab === 'colibri' }"
            >
              <a href="#" @click.prevent="showHubMenu('colibri')">
                <i class="fa-solid fa-dove" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Hub Colibrí</span>
              </a>
            </li>

            <li 
              v-if="isUserAdmin || actorSections.some(s => hubsConfig.ajolote.sections.map(x => x.id).includes(s))" 
              class="menu-item-ajolote"
              :class="{ 'active': activeTab === 'ajolote' }"
            >
              <a href="#" @click.prevent="showHubMenu('ajolote')">
                <i class="fa-solid fa-frog" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Hub Ajolote</span>
              </a>
            </li>

            <li 
              v-if="isUserAdmin || actorSections.some(s => hubsConfig.lobo.sections.map(x => x.id).includes(s))" 
              class="menu-item-lobo"
              :class="{ 'active': activeTab === 'lobo' }"
            >
              <a href="#" @click.prevent="showHubMenu('lobo')">
                <i class="fa-solid fa-dog" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Hub Lobo</span>
              </a>
            </li>

            <!-- SETTINGS -->
            <li class="menu-category" v-if="!isSidebarCollapsed">Ajustes</li>
            
            <li class="menu-item-ajustes" :class="{ 'active': activeTab === 'perfil' }">
              <a href="#" @click.prevent="navigateTo('perfil')">
                <i class="fa-solid fa-user-gear" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Mi Perfil</span>
              </a>
            </li>

            <li 
              v-if="isUserAdmin || actorFunctions.puede_enviar_notificaciones" 
              class="menu-item-ajustes"
              :class="{ 'active': activeTab === 'notificaciones' }"
            >
              <a href="#" @click.prevent="navigateTo('notificaciones')">
                <i class="fa-solid fa-bell" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Notificaciones</span>
              </a>
            </li>

            <li 
              v-if="isUserAdmin || actorFunctions.puede_gestionar_slider" 
              class="menu-item-ajustes"
              :class="{ 'active': activeTab === 'slider' }"
            >
              <a href="#" @click.prevent="navigateTo('slider')">
                <i class="fa-solid fa-images" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Slider Principal</span>
              </a>
            </li>

            <li v-if="isUserAdmin" :class="{ 'active': activeTab === 'config' }">
              <a href="#" @click.prevent="navigateTo('config')">
                <i class="fa-solid fa-gear" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Ajustes Plataforma</span>
              </a>
            </li>

            <li class="menu-divider"></li>
            <li>
              <RouterLink to="/">
                <i class="fa-solid fa-house" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Ir al Portal</span>
              </RouterLink>
            </li>
            <!-- LOGOUT -->
            <li class="menu-logout-item">
              <a href="#" class="logout-link" @click.prevent="handleLogout">
                <i class="fa-solid fa-right-from-bracket" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Cerrar Sesión</span>
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      <!-- BACKDROP FOR MOBILE -->
      <div 
        class="sidebar-backdrop" 
        :class="{ 'active': isMobileSidebarActive }"
        @click="isMobileSidebarActive = false"
      ></div>

      <!-- MAIN WRAPPER & CONTAINER -->
      <div class="admin-main-wrapper" :class="{ 'sidebar-collapsed': isSidebarCollapsed }" id="admin-main-wrapper">
        <main class="admin-content-area">
        
        <!-- HEADER TOP -->
        <header class="admin-header">
          <button class="mobile-menu-toggle" @click="isMobileSidebarActive = true">
            <i class="fa-solid fa-bars"></i>
          </button>

          <div class="header-titles">
            <div class="header-main-row">
              <h1>¡Hola, {{ authStore.profile?.nombre_completo?.split(' ')[0] || 'Admin' }}!</h1>
              <div class="profile-role-badge" :class="authStore.profile?.rol" style="font-size:0.75rem;">
                ● {{ isUserAdmin ? 'Administrador' : 'Actor' }}
              </div>
            </div>
            <p class="admin-subtitle">{{ activeTab === 'dashboard' ? (isUserAdmin ? 'Resumen global de EcoGuía SOS.' : 'Resumen de mi actividad.') : 'EcoGuía SOS — Gestión Unificada' }}</p>
          </div>

          <div class="header-right">
            <div class="header-date">
              <i class="fa-solid fa-calendar-day"></i>
              <span>{{ new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) }}</span>
            </div>
          </div>
        </header>

        <!-- VIEWS CONTENT SWITCH -->

        <!-- 1. DASHBOARD VIEW & 3. TABLE/SECTION VIEW MERGED LOGIC -->
        <div v-if="['dashboard', 'tabla-seccion'].includes(activeTab)" class="admin-tab-content">
          
          <!-- DASHBOARD SPECIFIC: Title & Stats -->
          <template v-if="activeTab === 'dashboard'">
            <h3 class="table-section-title" style="color: white; font-weight: 800; font-size: 1.4rem; margin-bottom: 20px;">{{ isUserAdmin ? 'Últimos Registros Globales' : 'Mis Últimos Registros' }}</h3>
            <div class="stats-grid" id="dashboard-stats" style="margin-bottom: 30px;">
              <div class="stat-card fade-in" v-if="isUserAdmin">
                <div class="stat-icon icon-purple">
                  <i class="fa-solid fa-users-gear"></i>
                </div>
                <div class="stat-info">
                  <h3>{{ stats.actores }}</h3>
                  <p>Actores / Staff</p>
                </div>
              </div>
              
              <div class="stat-card fade-in" v-if="isUserAdmin">
                <div class="stat-icon icon-blue">
                  <i class="fa-solid fa-users"></i>
                </div>
                <div class="stat-info">
                  <h3>{{ stats.voluntarios }}</h3>
                  <p>Voluntarios</p>
                </div>
              </div>

              <div class="stat-card fade-in">
                <div class="stat-icon icon-red">
                  <i class="fa-solid fa-calendar-days"></i>
                </div>
                <div class="stat-info">
                  <h3 style="display: flex; align-items: baseline; gap: 8px;">
                    <span>{{ stats.eventos_activos }}</span>
                    <span style="font-size: 0.9rem; color: #4ade80; font-weight: 600;">Activos</span>
                  </h3>
                  <p style="font-size: 0.85rem; color: var(--admin-text-muted); display: flex; align-items: center; gap: 5px; margin-top: 2px;">
                    <span>{{ stats.eventos_inactivos }} Inactivos</span>
                  </p>
                </div>
              </div>

              <div class="stat-card fade-in">
                <div class="stat-icon icon-green">
                  <i class="fa-solid fa-map-pin"></i>
                </div>
                <div class="stat-info">
                  <h3>{{ stats.lugares }}</h3>
                  <p>Lugares Sustentables</p>
                </div>
              </div>

              <!-- NEW SEGUIDORES STAT -->
              <div class="stat-card fade-in">
                <div class="stat-icon icon-pink">
                  <i class="fa-solid fa-heart"></i>
                </div>
                <div class="stat-info">
                  <h3>{{ stats.seguidores || 0 }}</h3>
                  <p>Seguidores</p>
                </div>
              </div>
            </div>
          </template>

          <!-- SECTION SPECIFIC: Header -->
          <template v-if="activeTab === 'tabla-seccion'">
            <div class="table-header-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
              <h2 style="color: white; font-weight: 800; font-size: 1.4rem; margin:0;">
                Sección: {{ selectedSection?.toUpperCase() }}
              </h2>
            </div>
          </template>
          <!-- SHARED TABLE COMPONENT (Section Table only) -->
          <template v-if="activeTab === 'tabla-seccion'">
            <!-- Search & Actions Header (Regular Sections) -->
             <div v-if="selectedSection !== 'seguidores'" class="table-actions-container" style="display: flex; gap: 15px; margin-bottom: 20px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
              <div class="admin-search-box" style="position: relative; flex: 1; max-width: 400px;">
                <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--admin-text-muted);"></i>
                <input type="text" v-model="searchQuery" placeholder="Buscar registros..." style="width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--admin-border); padding: 12px 15px 12px 40px; border-radius: 20px; color: white; font-family: 'Inter', sans-serif; transition: all 0.3s;" />
              </div>
              
              <!-- Reset Filters Button -->
              <button 
                class="btn btn-secondary" 
                @click="clearAllFilters" 
                style="border-radius: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.1); color: white; padding: 10px 18px; transition: all 0.3s; cursor: pointer;"
                title="Restablecer todos los filtros de la tabla"
              >
                <i class="fa-solid fa-filter-circle-xmark"></i> Todos
              </button>

              <button v-if="activeTab === 'tabla-seccion'" class="btn btn-primary" @click="openAddModal" style="border-radius: 12px; font-weight:700;">
                <i class="fa-solid fa-circle-plus"></i> Nuevo Registro
              </button>
            </div>

            <!-- Search & Toggle Header (Seguidores) -->
            <div v-else class="seguidores-controls-container" style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px; width: 100%;">
              <!-- Toggle Tab (Solo Admin) -->
              <div v-if="isUserAdmin" class="moderation-tabs-row" style="display: flex; gap: 10px; margin-bottom: 5px;">
                <button class="tab-btn" :class="{ 'active': seguidoresTabFilter === 'todos' }" @click="seguidoresTabFilter = 'todos'">
                  Todos los Seguidores
                </button>
                <button class="tab-btn" :class="{ 'active': seguidoresTabFilter === 'mis_seguidores' }" @click="seguidoresTabFilter = 'mis_seguidores'">
                  Mis Seguidores
                </button>
              </div>

              <!-- Filtros de búsqueda para seguidores -->
              <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: center; width: 100%;">
                <!-- Buscar por Voluntario o Actor -->
                <div class="admin-search-box" style="position: relative; flex: 1; min-width: 250px; max-width: 400px;">
                  <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--admin-text-muted);"></i>
                  <input 
                    type="text" 
                    v-model="searchSeguidoresQuery"
                    placeholder="Buscar por voluntario o actor..." 
                    style="width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--admin-border); padding: 12px 15px 12px 40px; border-radius: 20px; color: white; font-family: 'Inter', sans-serif; transition: all 0.3s;" 
                  />
                </div>
              </div>
            </div>

            <div v-if="loadingList" class="loading-state" style="padding: 50px; text-align: center; color: white;">
              <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
            </div>
            <div v-else-if="(selectedSection === 'seguidores' ? filteredSeguidoresList.length : listItems.length) === 0" class="empty-state" style="padding: 50px; text-align: center; background: rgba(255,255,255,0.01); border-radius: 16px; color: var(--text-muted);">
              No hay registros para mostrar.
            </div>
            <div v-else-if="selectedSection === 'seguidores'" class="table-responsive" style="overflow: visible;">
              <table class="admin-data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                  <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <th style="padding: 15px 20px; color: white;">Usuario</th>
                    <th style="padding: 15px 20px; color: white;">Email</th>
                    <th style="padding: 15px 20px; color: white;">Rol</th>
                    <th v-if="isUserAdmin" style="padding: 15px 20px; color: white;">Actor Seguido</th>
                    <th style="padding: 15px 20px; color: white; text-align: right;">Fecha de Registro</th>
                    <th v-if="!isUserAdmin || seguidoresTabFilter === 'mis_seguidores'" style="padding: 15px 20px; color: white; text-align: right;">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in filteredSeguidoresList" :key="item.id" style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 15px 20px; color: #f8fafc; font-weight:600; display: flex; align-items: center; gap: 10px;">
                      <img 
                        :src="item.user?.avatar_url || '/assets/img/logo-app.webp'" 
                        alt="Avatar" 
                        style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);"
                      />
                      <span>{{ item.user?.nombre_completo || 'Usuario sin nombre' }}</span>
                    </td>
                    <td style="padding: 15px 20px; color: #94a3b8;">
                      {{ item.user?.email || 'N/A' }}
                    </td>
                    <td style="padding: 15px 20px;">
                      <span class="status-badge" style="background: rgba(255, 255, 255, 0.05); color: #94a3b8; border: 1px solid rgba(255, 255, 255, 0.1); padding: 4px 8px; border-radius: 8px; font-size: 0.75rem; font-weight: 600;">
                        {{ (item.user?.rol || 'usuario').toUpperCase() }}
                      </span>
                    </td>
                    <td v-if="isUserAdmin" style="padding: 15px 20px; color: #f8fafc; font-weight:600;">
                      {{ item.actor?.nombre_completo || 'Actor sin nombre' }}
                    </td>
                    <td style="padding: 15px 20px; text-align: right; color: #64748b; font-size: 0.85rem;">
                      {{ formatRelativeDate(item.created_at) }}
                    </td>
                    <td v-if="!isUserAdmin || seguidoresTabFilter === 'mis_seguidores'" style="padding: 15px 20px; text-align: right; display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
                      <button 
                        v-if="item.user?.rol === 'user'" 
                        class="action-btn" 
                        @click="verPerfilVoluntario(item.user, false)" 
                        title="Ver Perfil de Voluntario" 
                        style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); width: 34px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;"
                      >
                        <i class="fa-solid fa-circle-user"></i>
                      </button>
                      <button class="action-btn" @click="openMessageModal(item.user)" title="Enviar Mensaje" style="background: rgba(114, 176, 77, 0.15); color: #72B04D; border: 1px solid rgba(114, 176, 77, 0.2); width: 34px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                        <i class="fa-solid fa-paper-plane"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="table-responsive" style="overflow: visible;">
              <table class="admin-data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                  <tr style="background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <th style="padding: 15px 20px; color: white;">Nombre</th>
                    <th style="padding: 15px 20px; color: white;">
                      <select v-model="categoryFilter" style="background: transparent; color: white; border: none; font-weight: bold; font-size: inherit; cursor: pointer; outline: none; padding-right: 5px;">
                        <option value="all" style="background: #1e293b; color: white;">Categoría (Todas)</option>
                        <option v-for="cat in uniqueCategories" :key="cat" :value="cat" style="background: #1e293b; color: white;">
                          {{ formatCategory(cat).toUpperCase() }}
                        </option>
                      </select>
                    </th>
                    <th v-if="selectedSection === 'eventos' || selectedSection === 'lugares'" style="padding: 15px 20px; color: white;">
                      <select v-model="publisherFilter" style="background: transparent; color: white; border: none; font-weight: bold; font-size: inherit; cursor: pointer; outline: none; padding-right: 5px;">
                        <option value="all" style="background: #1e293b; color: white;">Publicador (Todos)</option>
                        <option v-for="pub in uniquePublishers" :key="pub" :value="pub" style="background: #1e293b; color: white;">
                          {{ pub }}
                        </option>
                      </select>
                    </th>
                    <th v-if="selectedSection === 'eventos'" style="padding: 15px 20px; color: white;">
                      <select v-model="modalityFilter" style="background: transparent; color: white; border: none; font-weight: bold; font-size: inherit; cursor: pointer; outline: none; padding-right: 5px;">
                        <option value="all" style="background: #1e293b; color: white;">Modalidad (Todas)</option>
                        <option value="presencial" style="background: #1e293b; color: white;">📍 Presencial</option>
                        <option value="en_linea" style="background: #1e293b; color: white;">🖥️ En Línea</option>
                        <option value="hibrido" style="background: #1e293b; color: white;">🔄 Híbrido</option>
                      </select>
                    </th>
                    <th v-if="selectedSection === 'eventos'" style="padding: 15px 20px; color: white;">
                      <select v-model="eventValidityFilter" style="background: transparent; color: white; border: none; font-weight: bold; font-size: inherit; cursor: pointer; outline: none; padding-right: 5px;">
                        <option value="all" style="background: #1e293b; color: white;">Vigencia (Todos)</option>
                        <option value="active" style="background: #1e293b; color: white;">Activos</option>
                        <option value="passed" style="background: #1e293b; color: white;">Pasados</option>
                      </select>
                    </th>
                    <th style="padding: 15px 20px; color: white;">
                      <select v-model="stateFilter" style="background: transparent; color: white; border: none; font-weight: bold; font-size: inherit; cursor: pointer; outline: none; padding-right: 5px;">
                        <option value="all" style="background: #1e293b; color: white;">Estado (Todos)</option>
                        <option value="approved" style="background: #1e293b; color: white;">Aprobado</option>
                        <option value="pending" style="background: #1e293b; color: white;">Pendiente</option>
                        <option value="rejected" style="background: #1e293b; color: white;">Rechazado</option>
                      </select>
                    </th>
                    <th style="padding: 15px 20px; color: white; text-align: right;">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in filteredListItems" :key="item.id" style="border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
                    <td style="padding: 15px 20px; color: #f8fafc; font-weight: 600;">
                      {{ item.nombre || item.titulo }}
                    </td>
                    <td style="padding: 15px 20px; color: #94a3b8; font-weight: 600;">
                      {{ formatCategory(item.categoria || (item.fecha_inicio ? 'EVENTO' : 'LUGAR')).toUpperCase() }}
                    </td>
                    <td v-if="selectedSection === 'eventos' || selectedSection === 'lugares'" style="padding: 15px 20px; color: #94a3b8; font-size: 0.9rem;">
                      {{ item.publicador?.nombre_completo || 'Sistema' }}
                    </td>
                    <td v-if="selectedSection === 'eventos'" style="padding: 15px 20px;">
                      <span v-if="item.modalidad === 'en_linea'" class="status-badge" style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9;">
                        🖥️ En Línea
                      </span>
                      <span v-else-if="item.tiene_sesion_online" class="status-badge" style="background: rgba(139, 92, 246, 0.15); color: #8b5cf6;">
                        🔄 Híbrido
                      </span>
                      <span v-else class="status-badge" style="background: rgba(114, 176, 77, 0.15); color: #72B04D;">
                        📍 Presencial
                      </span>
                    </td>
                    <td v-if="selectedSection === 'eventos'" style="padding: 15px 20px;">
                      <span v-if="isEventActive(item)" class="status-badge" style="background: rgba(74, 222, 128, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.2);">
                        Activo
                      </span>
                      <span v-else class="status-badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2);">
                        Pasado
                      </span>
                    </td>
                    <td style="padding: 15px 20px;">
                      <span class="status-badge" :class="item.estado">{{ item.estado }}</span>
                    </td>
                    <td style="padding: 15px 20px; text-align: right; position: relative;">
                      <div class="actions-dropdown-container" :style="{ zIndex: activeDropdown === item.id ? 1000 : 'auto' }" style="display: inline-block;">
                        <button class="btn-actions-trigger" @click.stop="toggleActionsMenu(item.id, $event)">
                          Acciones <i class="fa-solid fa-ellipsis"></i>
                        </button>
                        <div class="actions-menu" :class="{ 'active': activeDropdown === item.id }">
                          <template v-if="isUserAdmin && item.estado === 'pending'">
                            <a href="#" @click.stop.prevent="updateModerationStatus(item, 'approved')" style="color: #10b981;">
                              <i class="fa-solid fa-check"></i> Aprobar Registro
                            </a>
                            <a href="#" @click.stop.prevent="updateModerationStatus(item, 'rejected')" style="color: #f43f5e;">
                              <i class="fa-solid fa-xmark"></i> Rechazar Registro
                            </a>
                            <div class="actions-divider"></div>
                          </template>
                          <a href="#" @click.stop.prevent="openEditModal(item)">
                            <i class="fa-solid fa-pen"></i> Editar Registro
                          </a>
                          <a href="#" @click.stop.prevent="deleteItem(item)" class="text-danger">
                            <i class="fa-solid fa-trash"></i> Eliminar Definitivamente
                          </a>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

        </div> <!-- END admin-tab-content -->

        <!-- 2. HUB VIEW -->
        <div v-else-if="['colibri', 'ajolote', 'lobo'].includes(activeTab) && selectedHub" class="hub-menu-view">
          <div class="hub-menu-grid">
            <template v-for="sec in hubsConfig[selectedHub].sections" :key="sec.id">
              <div 
                v-if="isUserAdmin || actorSections.includes(sec.id)"
                class="hub-card glass-effect"
                :class="`hub-card-${selectedHub}`"
                @click="selectSection(sec.id)"
                style="cursor: pointer; padding: 25px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); text-align: center; transition: all 0.3s ease;"
              >
                <i :class="sec.icon" style="font-size: 2.5rem; margin-bottom: 15px; display: inline-block;"></i>
                <h3 style="color: white; font-size: 1.25rem; font-weight:700; margin: 0;">{{ sec.label }}</h3>
              </div>
            </template>
          </div>
        </div>

        <!-- 4. STAFF / ACTORS MANAGEMENT VIEW (Admin only) -->
        <div v-else-if="activeTab === 'usuarios'" class="staff-view-container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: white; font-weight: 800; font-size: 1.4rem; margin: 0;">Gestión de Actores y Staff</h2>
            <label class="switch" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <span style="color: white; font-weight: 600; font-size: 0.9rem;">Mostrar Administradores</span>
              <div style="position: relative; width: 44px; height: 24px;">
                <input type="checkbox" v-model="showAdmins" style="opacity: 0; width: 0; height: 0;">
                <span class="slider round" :style="{ background: showAdmins ? 'var(--color-eco)' : 'rgba(255,255,255,0.2)', position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0', borderRadius: '34px', transition: '.4s' }">
                  <span :style="{ position: 'absolute', height: '18px', width: '18px', left: showAdmins ? '22px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }"></span>
                </span>
              </div>
            </label>
          </div>

          <!-- Pestañas de Moderación de Actores -->
          <div class="moderation-tabs-row" style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button class="tab-btn" :class="{ 'active': actorModerationFilter === 'approved' }" @click="actorModerationFilter = 'approved'">Publicados</button>
            <button class="tab-btn" :class="{ 'active': actorModerationFilter === 'pending' }" @click="actorModerationFilter = 'pending'">En Revisión <span class="tab-counter" v-if="pendingActoresCount > 0" style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; margin-left: 5px;">{{ pendingActoresCount }}</span></button>
            <button class="tab-btn" :class="{ 'active': actorModerationFilter === 'rejected' }" @click="actorModerationFilter = 'rejected'">Rechazados</button>
          </div>

          <div class="table-responsive glass-effect" style="border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); overflow: visible;">
            <table class="admin-data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <th style="padding: 15px 20px; color: white;">Nombre</th>
                  <th style="padding: 15px 20px; color: white;">Email</th>
                  <th style="padding: 15px 20px; color: white;">Rol</th>
                  <th style="padding: 15px 20px; color: white;">Estado</th>
                  <th style="padding: 15px 20px; color: white; text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="actor in filteredStaffList" :key="actor.id" style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                  <td style="padding: 15px 20px; color: white; font-weight:600;">{{ actor.nombre_completo }}</td>
                  <td style="padding: 15px 20px; color: #94a3b8;">{{ actor.email || 'N/A' }}</td>
                  <td style="padding: 15px 20px;">
                    <span class="role-badge" :class="actor.rol">{{ actor.rol }}</span>
                  </td>
                  <td style="padding: 15px 20px;">
                    <span class="status-badge" :class="actor.actor_status || 'approved'">{{ actor.actor_status || 'approved' }}</span>
                  </td>
                  <td style="padding: 15px 20px; text-align: right; position: relative;">
                    <!-- Menu de acciones desplegable -->
                    <div class="actions-dropdown-container" :style="{ zIndex: activeDropdown === actor.id ? 1000 : 'auto' }" style="display: inline-block;">
                      <button class="btn-actions-trigger" @click.stop="toggleActionsMenu(actor.id, $event)">
                        Acciones <i class="fa-solid fa-ellipsis"></i>
                      </button>
                      <div class="actions-menu" :class="{ 'active': activeDropdown === actor.id }">
                        <template v-if="actor.actor_status === 'pending' || (actor.rol === 'actor' && !actor.actor_status)">
                          <a href="#" @click.stop.prevent="updateActorStatus(actor.id, 'approved')" style="color: #10b981;">
                            <i class="fa-solid fa-check"></i> Aprobar Actor
                          </a>
                          <a href="#" @click.stop.prevent="updateActorStatus(actor.id, 'rejected')" style="color: #f43f5e;">
                            <i class="fa-solid fa-xmark"></i> Rechazar Actor
                          </a>
                          <div class="actions-divider"></div>
                        </template>
                        <template v-else-if="actor.actor_status === 'rejected'">
                          <a href="#" @click.stop.prevent="updateActorStatus(actor.id, 'approved')" style="color: #10b981;">
                            <i class="fa-solid fa-check"></i> Aprobar Actor
                          </a>
                          <div class="actions-divider"></div>
                        </template>
                        <template v-else-if="actor.rol === 'actor'">
                          <a href="#" @click.stop.prevent="openProfileAdminModal(actor)">
                            <i class="fa-solid fa-user-gear"></i> Gestión de Agente
                          </a>
                          <a href="#" @click.stop.prevent="openPermissionsModal(actor)">
                            <i class="fa-solid fa-key"></i> Gestionar Permisos
                          </a>
                          <a href="#" @click.stop.prevent="updateActorStatus(actor.id, 'rejected')" style="color: #f43f5e;">
                            <i class="fa-solid fa-xmark"></i> Rechazar Actor
                          </a>
                          <div class="actions-divider"></div>
                        </template>
                        <a href="#" @click.stop.prevent="deleteActorProfile(actor)" class="text-danger">
                          <i class="fa-solid fa-trash"></i> Eliminar Definitivamente
                        </a>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredStaffList.length === 0">
                  <td colspan="5" style="padding: 30px; text-align: center; color: #94a3b8;">No hay registros para mostrar.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 4.5 VOLUNTARIOS VIEW (Admin only) -->
        <div v-else-if="activeTab === 'voluntarios'" class="staff-view-container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: white; font-weight: 800; font-size: 1.4rem; margin: 0;">Gestión de Voluntarios</h2>
          </div>
          <div class="table-responsive glass-effect" style="border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); overflow: visible;">
            <table class="admin-data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <th style="padding: 15px 20px; color: white;">Nombre</th>
                  <th style="padding: 15px 20px; color: white;">Email</th>
                  <th style="padding: 15px 20px; color: white;">Rol</th>
                  <th style="padding: 15px 20px; color: white; text-align: right;">Fecha Registro</th>
                  <th style="padding: 15px 20px; color: white; text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="actor in voluntariosList" :key="actor.id" style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                  <td style="padding: 15px 20px; color: white; font-weight:600;">{{ actor.nombre_completo || 'Sin nombre' }}</td>
                  <td style="padding: 15px 20px; color: #94a3b8;">{{ actor.email || 'N/A' }}</td>
                  <td style="padding: 15px 20px;">
                    <span class="role-badge" :class="actor.rol">{{ actor.rol }}</span>
                  </td>
                  <td style="padding: 15px 20px; text-align: right; color: #94a3b8;">
                    {{ new Date(actor.created_at).toLocaleDateString() }}
                  </td>
                  <td style="padding: 15px 20px; text-align: right; position: relative;">
                    <div class="actions-dropdown-container" :style="{ zIndex: activeDropdown === actor.id ? 1000 : 'auto' }" style="display: inline-block;">
                      <button class="btn-actions-trigger" @click.stop="toggleActionsMenu(actor.id, $event)">
                        Acciones <i class="fa-solid fa-ellipsis"></i>
                      </button>
                      <div class="actions-menu" :class="{ 'active': activeDropdown === actor.id }">
                        <a href="#" @click.stop.prevent="verPerfilVoluntario(actor, true)">
                          <i class="fa-solid fa-user-gear"></i> Gestión de Voluntario
                        </a>
                        <div class="actions-divider"></div>
                        <a href="#" @click.stop.prevent="deleteActorProfile(actor)" class="text-danger">
                          <i class="fa-solid fa-trash"></i> Eliminar Definitivamente
                        </a>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-if="voluntariosList.length === 0">
                  <td colspan="5" style="padding: 30px; text-align: center; color: #94a3b8;">No hay voluntarios registrados.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 5. PROFILE EDIT VIEW -->
        <div v-else-if="activeTab === 'perfil'" class="profile-card-large glass-effect" style="margin: 0 auto;">
            <div class="profile-header-edit">
                <div class="profile-pic-upload" style="width: 100px; height: 100px;">
                    <div id="edit-avatar-preview" class="avatar-preview" style="border-radius: 30px; font-size: 2.5rem; font-weight: 800; background: var(--gradient-eco);">
                        <img :src="authStore.profile?.avatar_url || 'https://iiesxyviqhoxczydzeqa.supabase.co/storage/v1/object/public/imagenes-plataforma/avatares/kenc9imsux_1778543612447.webp'" style="width:100%; height:100%; object-fit:cover; border-radius:30px;">
                    </div>
                    <label for="p-avatar-input" class="upload-btn" style="cursor: pointer;">
                        <i class="fa-solid fa-camera"></i>
                    </label>
                    <input type="file" id="p-avatar-input" accept="image/*" style="display: none;" @change="handleAvatarUpload">
                </div>
                <div class="profile-header-info">
                    <h2 style="color: white; margin-bottom: 4px;" id="edit-profile-title">Mi Perfil</h2>
                    <p style="color: var(--admin-text-muted); font-size: 0.9rem;" id="edit-profile-subtitle">Gestiona tu información pública y de contacto.</p>
                </div>
            </div>
            
            <form id="form-perfil-full" class="modern-form" @submit.prevent="saveProfile">
                <div class="form-section">
                    <h3><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="user" aria-hidden="true" style="width: 18px;" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Información Básica</h3>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Nombre Completo</label>
                            <input type="text" id="p-nombre" v-model="profileForm.nombre_completo" placeholder="Tu nombre" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px; outline: none;">
                        </div>
                        <div class="form-group">
                            <label>Teléfono</label>
                            <input type="tel" id="p-telefono" v-model="profileForm.telefono" placeholder="Ej: +52 ..." style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px; outline: none;">
                        </div>
                        <div class="form-group full-width">
                            <label>Biografía Corta</label>
                            <textarea id="p-bio" v-model="profileForm.bio" rows="3" placeholder="Cuéntanos un poco sobre ti..." style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px; outline: none;"></textarea>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h3><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="share-2" aria-hidden="true" style="width: 18px;" class="lucide lucide-share-2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"></line><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"></line></svg> Redes Sociales</h3>
                    <div class="social-selector-wrapper" style="display: flex; flex-direction: column; gap: 15px;">
                        <div class="social-selector">
                            <button type="button" class="social-btn facebook" :class="{ active: activeProfileSocial === 'facebook' }" @click="activeProfileSocial = 'facebook'" title="Facebook"><i class="fa-brands fa-facebook"></i></button>
                            <button type="button" class="social-btn instagram" :class="{ active: activeProfileSocial === 'instagram' }" @click="activeProfileSocial = 'instagram'" title="Instagram"><i class="fa-brands fa-instagram"></i></button>
                            <button type="button" class="social-btn whatsapp" :class="{ active: activeProfileSocial === 'whatsapp' }" @click="activeProfileSocial = 'whatsapp'" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
                            <button type="button" class="social-btn x-twitter" :class="{ active: activeProfileSocial === 'twitter' }" @click="activeProfileSocial = 'twitter'" title="X (Twitter)"><i class="fa-brands fa-x-twitter"></i></button>
                            <button type="button" class="social-btn youtube" :class="{ active: activeProfileSocial === 'youtube' }" @click="activeProfileSocial = 'youtube'" title="YouTube"><i class="fa-brands fa-youtube"></i></button>
                            <button type="button" class="social-btn web" :class="{ active: activeProfileSocial === 'web' }" @click="activeProfileSocial = 'web'" title="Sitio Web"><i class="fa-solid fa-globe"></i></button>
                        </div>
                        
                        <div class="social-inputs-container">
                            <div v-if="activeProfileSocial === 'facebook'" class="input-with-icon" style="position: relative;">
                                <i class="fa-brands fa-facebook" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #1877F2; font-size: 1.2rem;"></i>
                                <input type="url" id="p-fb" v-model="profileForm.facebook" placeholder="Link Facebook" style="width: 100%; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px 12px 12px 44px; outline: none;">
                            </div>
                            <div v-else-if="activeProfileSocial === 'instagram'" class="input-with-icon" style="position: relative;">
                                <i class="fa-brands fa-instagram" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #dc2743; font-size: 1.2rem;"></i>
                                <input type="url" id="p-ig" v-model="profileForm.instagram" placeholder="Link Instagram" style="width: 100%; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px 12px 12px 44px; outline: none;">
                            </div>
                            <div v-else-if="activeProfileSocial === 'whatsapp'" class="input-with-icon" style="position: relative;">
                                <i class="fa-brands fa-whatsapp" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #25D366; font-size: 1.2rem;"></i>
                                <input type="text" id="p-wa" v-model="profileForm.whatsapp" placeholder="Link WhatsApp o Número (ej. https://wa.me/...)" style="width: 100%; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px 12px 12px 44px; outline: none;">
                            </div>
                            <div v-else-if="activeProfileSocial === 'twitter'" class="input-with-icon" style="position: relative;">
                                <i class="fa-brands fa-x-twitter" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #f8fafc; font-size: 1.2rem;"></i>
                                <input type="url" id="p-x" v-model="profileForm.twitter" placeholder="Link X (Twitter)" style="width: 100%; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px 12px 12px 44px; outline: none;">
                            </div>
                            <div v-else-if="activeProfileSocial === 'youtube'" class="input-with-icon" style="position: relative;">
                                <i class="fa-brands fa-youtube" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #FF0000; font-size: 1.2rem;"></i>
                                <input type="url" id="p-yt" v-model="profileForm.youtube" placeholder="Link Canal YouTube" style="width: 100%; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px 12px 12px 44px; outline: none;">
                            </div>
                            <div v-else-if="activeProfileSocial === 'web'" class="input-with-icon" style="position: relative;">
                                <i class="fa-solid fa-globe" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #10b981; font-size: 1.2rem;"></i>
                                <input type="url" id="p-web" v-model="profileForm.web" placeholder="Sitio Web" style="width: 100%; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px 12px 12px 44px; outline: none;">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ZONAS DE IMPACTO EN PERFIL PROPIO -->
                <div class="form-section">
                    <h3 style="display: flex; align-items: center; gap: 8px;">
                      <i class="fa-solid fa-earth-americas" style="color: var(--color-eco); margin-right: 8px;"></i> Zonas de Impacto
                    </h3>
                    <p style="color: var(--admin-text-muted); font-size: 0.85rem; margin-bottom: 15px;">Selecciona el Estado y Municipio / Alcaldía para agregar tus áreas de impacto.</p>
                    
                    <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                      <div style="flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 0.8rem; color: #a3aab1; font-weight: 600; text-transform: uppercase;">Estado</label>
                        <select v-model="selectedEstado" @change="onEstadoChange('own')" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white;">
                          <option value="">Selecciona un Estado</option>
                          <option v-for="est in estadosList" :key="est.code" :value="est.code">{{ est.name }}</option>
                        </select>
                      </div>
                      <div style="flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 0.8rem; color: #a3aab1; font-weight: 600; text-transform: uppercase;">Municipio / Alcaldía</label>
                        <select v-model="selectedMunicipio" :disabled="!selectedEstado || municipiosList.length === 0" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white;">
                          <option value="">Todo el Estado (General)</option>
                          <option v-for="mun in municipiosList" :key="mun.code" :value="mun.name">{{ mun.name }}</option>
                        </select>
                      </div>
                      <div style="display: flex; align-items: flex-end;">
                        <button type="button" @click="agregarZonaImpacto('own')" class="btn-admin" style="background: var(--color-eco); color: black; font-weight: 700; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; height: 42px; display: flex; align-items: center; gap: 6px;">
                          <i class="fa-solid fa-plus"></i> Agregar
                        </button>
                      </div>
                    </div>

                    <!-- Lista de Zonas Agregadas (Chips) -->
                    <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 12px; padding: 15px;">
                      <label style="font-size: 0.8rem; color: #a3aab1; display: block; margin-bottom: 10px; font-weight: 600; text-transform: uppercase;">Mis Zonas de Impacto Agregadas</label>
                      <div class="chips-grid" style="display: flex; flex-wrap: wrap; gap: 8px;">
                        <span 
                          v-for="zona in profileForm.zonas_impacto" 
                          :key="zona" 
                          class="zona-chip"
                          style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 20px; background: rgba(114, 176, 77, 0.15); border: 1px solid rgba(114, 176, 77, 0.3); color: #72B04D; font-size: 0.8rem; font-weight: 600;"
                        >
                          <span>{{ zona }}</span>
                          <button type="button" @click="removerZonaImpacto(zona, 'own')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.9rem; padding: 0; display: inline-flex; align-items: center;" title="Eliminar zona">
                            <i class="fa-solid fa-circle-xmark"></i>
                          </button>
                        </span>
                        <p v-if="!profileForm.zonas_impacto || profileForm.zonas_impacto.length === 0" style="color: #666; font-size: 0.85rem; font-style: italic; margin: 0;">No has agregado zonas de impacto aún.</p>
                      </div>
                    </div>
                </div>

                <!-- SECCIÓN VIDEOS DE PRESENTACIÓN EN PERFIL PROPIO -->
                <div class="form-section">
                    <h3><i class="fa-brands fa-youtube" style="color: #FF0000; margin-right: 8px;"></i> Videos de Presentación</h3>
                    
                    <div v-if="authStore.profile?.permitir_edicion_videos === false" style="background: rgba(239, 68, 68, 0.05); border: 1px dashed #ef4444; border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                      <p style="color: #ef4444; font-size: 0.9rem; margin: 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-lock"></i> La edición de tus videos de presentación ha sido deshabilitada por el administrador.
                      </p>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 10px;">
                      <div v-for="(videoUrl, index) in profileForm.videos_presentacion" :key="index" style="display: flex; gap: 10px; align-items: center;">
                        <div style="position: relative; flex: 1;">
                          <i class="fa-brands fa-youtube" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #FF0000;"></i>
                          <input 
                            type="url" 
                            v-model="profileForm.videos_presentacion[index]" 
                            placeholder="https://www.youtube.com/watch?v=..." 
                            :disabled="authStore.profile?.permitir_edicion_videos === false"
                            style="width: 100%; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px 12px 12px 44px; outline: none;"
                          >
                        </div>
                        <button 
                          type="button" 
                          class="action-btn btn-danger" 
                          @click="profileForm.videos_presentacion.splice(index, 1)"
                          :disabled="authStore.profile?.permitir_edicion_videos === false"
                          style="width: 44px; height: 44px; border-radius: 8px;"
                        >
                          <i class="fa-solid fa-trash"></i>
                        </button>
                      </div>

                      <button 
                        v-if="profileForm.videos_presentacion.length < 5"
                        type="button" 
                        class="btn-admin" 
                        @click="profileForm.videos_presentacion.push('')"
                        :disabled="authStore.profile?.permitir_edicion_videos === false"
                        style="width: fit-content; background: rgba(255,255,255,0.05); color: white; border: 1px solid var(--admin-border); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;"
                      >
                        <i class="fa-solid fa-plus"></i> Agregar enlace de video
                      </button>
                    </div>
                </div>

                <div class="form-section">
                    <h3><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="shield-check" aria-hidden="true" style="width: 18px;" class="lucide lucide-shield-check"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg> Seguridad de la Cuenta</h3>
                    <div class="security-split-grid">
                        <!-- Columna Email -->
                        <div class="security-card" style="background: rgba(255,255,255,0.02); padding: 20px; border-radius: 12px; border: 1px solid var(--admin-border);">
                            <h4 style="color: white; margin-bottom: 15px; font-size: 0.95rem;">Correo Electrónico</h4>
                            <div class="form-group">
                                <label>Actual: <span id="p-email-display-text" style="color: var(--admin-accent); font-weight: normal;">{{ authStore.user?.email }}</span></label>
                                <input type="email" id="p-new-email" v-model="securityForm.newEmail" placeholder="Nuevo correo electrónico" style="width: 100%; background: rgba(0,0,0,0.2); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 10px; margin-top: 10px;">
                            </div>
                            <button type="button" id="btn-update-email" @click="updateEmail" class="btn-admin" style="width: 100%; margin-top: 10px; background: rgba(255,255,255,0.05); color: white; border: 1px solid var(--admin-border); cursor: pointer; padding: 10px; border-radius: 8px;">
                                Actualizar Correo
                            </button>
                        </div>

                        <!-- Columna Contraseña -->
                        <div class="security-card" style="background: rgba(255,255,255,0.02); padding: 20px; border-radius: 12px; border: 1px solid var(--admin-border);">
                            <h4 style="color: white; margin-bottom: 15px; font-size: 0.95rem;">Contraseña</h4>
                            <div class="form-group">
                                <label>Nueva Contraseña</label>
                                <input type="password" id="p-new-password" v-model="securityForm.newPassword" placeholder="Mínimo 6 caracteres" style="width: 100%; background: rgba(0,0,0,0.2); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 10px; margin-top: 10px;">
                            </div>
                            <button type="button" id="btn-update-pass" @click="updatePassword" class="btn-admin" style="width: 100%; margin-top: 10px; background: rgba(255,255,255,0.05); color: white; border: 1px solid var(--admin-border); cursor: pointer; padding: 10px; border-radius: 8px;">
                                Cambiar Contraseña
                            </button>
                        </div>
                    </div>
                </div>

                <div class="form-actions" style="border-top: 1px solid var(--admin-border); padding-top: 20px; margin-top: 20px;">
                    <button type="submit" class="btn-create-new" id="btn-save-perfil" :disabled="profileSaving" style="width: auto; background: var(--admin-accent); color: white; border: none; cursor: pointer; padding: 12px 24px; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px; font-weight: 600;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="save" aria-hidden="true" class="lucide lucide-save" v-if="!profileSaving"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"></path><path d="M7 3v4a1 1 0 0 0 1 1h7"></path></svg>
                        <i v-else class="fa-solid fa-spinner fa-spin"></i>
                        {{ profileSaving ? 'Guardando...' : 'Guardar Datos Públicos' }}
                    </button>
                </div>
            </form>
        </div>

        <!-- 6. NOTIFICATIONS VIEW -->
        <div v-else-if="activeTab === 'notificaciones'" class="notif-view-container">
          <!-- SEND NOTIFICATION FORM -->
          <div class="notif-composer glass-effect" style="padding: 25px; border-radius: 20px;">
            <h2 style="color: white; font-weight: 800; font-size: 1.3rem; margin-bottom: 20px;">Redactar Alerta</h2>
            
            <form @submit.prevent="sendNotification" style="display: flex; flex-direction: column; gap: 15px;">
              <div class="form-group">
                <label>Título de la Alerta</label>
                <input type="text" v-model="notifForm.titulo" required placeholder="Ej: Nueva jornada de reforestación" />
              </div>
              <div class="form-group">
                <label>Mensaje / Detalles</label>
                <textarea v-model="notifForm.mensaje" required rows="5" placeholder="Escribe el cuerpo de la alerta..."></textarea>
              </div>
              <div class="form-group">
                <label>Enlace de Acción (URL opcional)</label>
                <input type="url" v-model="notifForm.enlace_url" placeholder="https://..." />
              </div>
              
              <div class="form-group">
                <label>Imagen o Archivo Adjunto (Opcional)</label>
                <input type="text" v-model="notifForm.archivo_url" placeholder="URL del archivo o sube uno:" style="margin-bottom: 10px;" />
                <input type="file" @change="handleItemImageUpload($event, 'archivo_url')" accept="image/*,application/pdf" />
              </div>

              <!-- Audiences segments checks -->
              <h4 style="color: white; font-weight: 700; font-size: 0.95rem; margin-top: 10px;">Destinatarios</h4>
              <div style="display: flex; gap: 20px;">
                <label style="display: flex; align-items: center; gap: 8px; color: #e2e8f0; cursor: pointer;">
                  <input type="checkbox" v-model="notifForm.dest_todos" /> Todos
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #e2e8f0; cursor: pointer;">
                  <input type="checkbox" v-model="notifForm.dest_actores" /> Actores
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #e2e8f0; cursor: pointer;">
                  <input type="checkbox" v-model="notifForm.dest_voluntariados" /> Voluntarios
                </label>
              </div>

              <button 
                type="submit" 
                class="btn btn-primary" 
                style="margin-top: 15px; border-radius: 12px; font-weight:700;"
                :disabled="sendingNotif"
              >
                <i class="fa-solid fa-paper-plane"></i> {{ sendingNotif ? 'Enviando...' : 'Enviar Alerta' }}
              </button>
            </form>
          </div>

          <!-- NOTIFICATION HISTORY -->
          <div class="notif-history glass-effect" style="padding: 25px; border-radius: 20px;">
            <h3 style="color: white; font-weight: 800; font-size: 1.15rem; margin-bottom: 15px;">Historial de Envíos</h3>
            <div class="notif-history-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 500px; overflow-y: auto;">
              <div 
                v-for="n in notifHistory" 
                :key="n.id" 
                class="notif-history-item"
                @click="selectNotifDetail(n)"
                style="cursor: pointer; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; transition: all 0.3s;"
              >
                <h4 style="color: white; font-weight: 600; font-size: 0.9rem; margin-bottom: 4px;">{{ n.titulo }}</h4>
                <span style="font-size: 0.75rem; color: var(--color-eco);">{{ formatRelativeDate(n.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 7. SLIDER / CAROUSEL VIEW -->
        <div v-else-if="activeTab === 'slider'" class="slider-view-container">
          <div class="table-header-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: white; font-weight: 800; font-size: 1.4rem;">Carrusel de Inicio</h2>
            <button class="btn btn-primary" @click="openSlideModal()" style="border-radius: 12px; font-weight:700;">
              <i class="fa-solid fa-circle-plus"></i> Agregar Slide
            </button>
          </div>

          <div class="slides-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
            <div 
              v-for="slide in slidesList" 
              :key="slide.id" 
              class="slide-card glass-effect"
              style="border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); background: rgba(15,22,30,0.6);"
            >
              <div style="height: 150px; position: relative; overflow: hidden; background: #000;">
                <img :src="slide.imagen_url" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.6;" />
                <span 
                  v-if="slide.badge" 
                  style="position: absolute; top: 10px; left: 10px; background: var(--color-eco); color: black; padding: 2px 8px; border-radius: 5px; font-size: 0.7rem; font-weight: 800;"
                >
                  {{ slide.badge }}
                </span>
                <span 
                  style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); color: white; padding: 2px 8px; border-radius: 5px; font-size: 0.7rem;"
                >
                  Orden: {{ slide.orden }}
                </span>
              </div>
              <div style="padding: 15px;">
                <h4 style="color: white; margin-bottom: 4px; font-weight:700;">{{ slide.titulo || '(Sin título)' }}</h4>
                <p style="color: var(--text-muted); font-size: 0.8rem; line-height: 1.4; margin-bottom: 15px;">{{ slide.subtitulo || '(Sin subtítulo)' }}</p>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size:0.75rem;" :style="slide.activo ? 'color:#10b981;' : 'color:#ef4444;'">
                    {{ slide.activo ? '● Activo' : '● Inactivo' }}
                  </span>
                  <div style="display: flex; gap: 8px;">
                    <button class="action-btn btn-edit" @click="openSlideModal(slide)">
                      <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="action-btn btn-danger" @click="deleteSlide(slide.id)">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 8. CONFIG PLATAFORMA (Admin only) -->
        <div v-else-if="activeTab === 'config'" class="config-view-container">
          <div class="profile-card-large glass-effect" style="margin: 0 auto; padding: 30px; border-radius: 20px;">
            <div class="profile-header-edit" style="display: flex; gap: 20px; align-items: center; margin-bottom: 30px; border-bottom: 1px solid var(--admin-border); padding-bottom: 20px;">
              <div class="header-icon-box" style="background: rgba(77, 150, 255, 0.15); color: #4d96ff; width: 60px; height: 60px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-2"><path d="M14 17H5"></path><path d="M19 7h-9"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>
              </div>
              <div class="profile-header-info">
                <h2 style="color: white; margin: 0 0 4px 0; font-size: 1.5rem; font-weight: 800;">Ajustes Globales</h2>
                <p style="color: var(--admin-text-muted); font-size: 0.9rem; margin: 0;">Configura el comportamiento general de la plataforma.</p>
              </div>
            </div>

            <div v-if="configLoading" class="loading-state" style="padding: 50px; text-align: center; color: white;">
              <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
            </div>
            
            <form v-else id="form-config-global" class="modern-form" @submit.prevent="saveConfig" style="display: flex; flex-direction: column; gap: 25px;">
              <!-- Estado del Sistema -->
              <div class="form-section">
                <h3 style="color: white; font-size: 1.1rem; font-weight: 700; margin-bottom: 15px; border-left: 3px solid var(--admin-accent); padding-left: 10px;">Estado del Sistema</h3>
                <div class="functions-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                  <label class="perm-item" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid var(--admin-border); padding: 15px; border-radius: 10px; cursor: pointer;">
                    <span style="color: #e2e8f0; font-size: 0.95rem;">Permitir nuevos registros</span>
                    <div style="position: relative; width: 44px; height: 24px;">
                      <input type="checkbox" v-model="configForm.registro_abierto" style="opacity: 0; width: 0; height: 0;">
                      <span class="slider round" :style="{ background: configForm.registro_abierto ? 'var(--color-eco)' : 'rgba(255,255,255,0.2)', position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0', borderRadius: '34px', transition: '.4s' }">
                        <span :style="{ position: 'absolute', height: '18px', width: '18px', left: configForm.registro_abierto ? '22px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }"></span>
                      </span>
                    </div>
                  </label>
                  <label class="perm-item" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(239, 68, 68, 0.2); padding: 15px; border-radius: 10px; cursor: pointer;">
                    <span style="color: #ff6b6b; font-size: 0.95rem;">Modo Mantenimiento</span>
                    <div style="position: relative; width: 44px; height: 24px;">
                      <input type="checkbox" v-model="configForm.modo_mantenimiento" style="opacity: 0; width: 0; height: 0;">
                      <span class="slider round" :style="{ background: configForm.modo_mantenimiento ? '#ef4444' : 'rgba(255,255,255,0.2)', position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0', borderRadius: '34px', transition: '.4s' }">
                        <span :style="{ position: 'absolute', height: '18px', width: '18px', left: configForm.modo_mantenimiento ? '22px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }"></span>
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Reglas de Moderación -->
              <div class="form-section">
                <h3 style="color: white; font-size: 1.1rem; font-weight: 700; margin-bottom: 15px; border-left: 3px solid var(--admin-accent); padding-left: 10px;">Moderación y Avisos</h3>
                <div class="functions-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                  <label class="perm-item" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid var(--admin-border); padding: 15px; border-radius: 10px; cursor: pointer;">
                    <span style="color: #e2e8f0; font-size: 0.95rem;">Aprobación automática de propuestas</span>
                    <div style="position: relative; width: 44px; height: 24px;">
                      <input type="checkbox" v-model="configForm.aprobacion_automatica" style="opacity: 0; width: 0; height: 0;">
                      <span class="slider round" :style="{ background: configForm.aprobacion_automatica ? 'var(--color-eco)' : 'rgba(255,255,255,0.2)', position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0', borderRadius: '34px', transition: '.4s' }">
                        <span :style="{ position: 'absolute', height: '18px', width: '18px', left: configForm.aprobacion_automatica ? '22px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }"></span>
                      </span>
                    </div>
                  </label>
                  <label class="perm-item" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid var(--admin-border); padding: 15px; border-radius: 10px; cursor: pointer;">
                    <span style="color: #e2e8f0; font-size: 0.95rem;">Notificar admins por correo</span>
                    <div style="position: relative; width: 44px; height: 24px;">
                      <input type="checkbox" v-model="configForm.notificar_admins" style="opacity: 0; width: 0; height: 0;">
                      <span class="slider round" :style="{ background: configForm.notificar_admins ? 'var(--color-eco)' : 'rgba(255,255,255,0.2)', position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0', borderRadius: '34px', transition: '.4s' }">
                        <span :style="{ position: 'absolute', height: '18px', width: '18px', left: configForm.notificar_admins ? '22px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }"></span>
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Mensajes del Sistema -->
              <div class="form-section">
                <h3 style="color: white; font-size: 1.1rem; font-weight: 700; margin-bottom: 15px; border-left: 3px solid var(--admin-accent); padding-left: 10px;">Mensajes de la Plataforma</h3>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                  <div class="form-group" style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="color: #94a3b8; font-size: 0.85rem; font-weight: 600;">Mensaje de Bienvenida</label>
                    <textarea v-model="configForm.mensaje_bienvenida" rows="2" placeholder="¡Hola! Bienvenido..." style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px; outline: none; font-family: inherit; resize: vertical;"></textarea>
                  </div>
                  <div class="form-group" style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="color: #94a3b8; font-size: 0.85rem; font-weight: 600;">Banner de Alerta (Opcional)</label>
                    <input type="text" v-model="configForm.banner_activo" placeholder="Ej: Mantenimiento programado..." style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px; outline: none;">
                  </div>
                </div>
              </div>

              <!-- Configuración del Mapa -->
              <div class="form-section">
                <h3 style="color: white; font-size: 1.1rem; font-weight: 700; margin-bottom: 15px; border-left: 3px solid var(--admin-accent); padding-left: 10px;">Ubicación y Mapa Predeterminado</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                  <div class="form-group" style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="color: #94a3b8; font-size: 0.85rem; font-weight: 600;">Latitud Inicial</label>
                    <input type="number" step="any" v-model="configForm.mapa_lat" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px; outline: none;">
                  </div>
                  <div class="form-group" style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="color: #94a3b8; font-size: 0.85rem; font-weight: 600;">Longitud Inicial</label>
                    <input type="number" step="any" v-model="configForm.mapa_lng" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px; outline: none;">
                  </div>
                  <div class="form-group" style="display: flex; flex-direction: column; gap: 5px; grid-column: span 2;">
                    <label style="color: #94a3b8; font-size: 0.85rem; font-weight: 600;">Zoom Inicial (1 - 20)</label>
                    <input type="number" min="1" max="20" v-model="configForm.mapa_zoom" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px; outline: none;">
                  </div>
                </div>
              </div>

              <!-- Límites y Seguridad -->
              <div class="form-section">
                <h3 style="color: white; font-size: 1.1rem; font-weight: 700; margin-bottom: 15px; border-left: 3px solid var(--admin-accent); padding-left: 10px;">Límites y Seguridad</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                  <div class="form-group" style="display: flex; flex-direction: column; gap: 5px;">
                    <label style="color: #94a3b8; font-size: 0.85rem; font-weight: 600;">Límite de Archivo Subido (MB)</label>
                    <input type="number" min="1" v-model="configForm.limite_archivos_mb" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px; outline: none;">
                  </div>
                  <label class="perm-item" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid var(--admin-border); padding: 15px; border-radius: 10px; cursor: pointer; align-self: end; height: 48px;">
                    <span style="color: #e2e8f0; font-size: 0.95rem;">Activar verificación Captcha</span>
                    <div style="position: relative; width: 44px; height: 24px;">
                      <input type="checkbox" v-model="configForm.activar_captcha" style="opacity: 0; width: 0; height: 0;">
                      <span class="slider round" :style="{ background: configForm.activar_captcha ? 'var(--color-eco)' : 'rgba(255,255,255,0.2)', position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0', borderRadius: '34px', transition: '.4s' }">
                        <span :style="{ position: 'absolute', height: '18px', width: '18px', left: configForm.activar_captcha ? '22px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }"></span>
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Correo de Soporte -->
              <div class="form-section">
                <h3 style="color: white; font-size: 1.1rem; font-weight: 700; margin-bottom: 15px; border-left: 3px solid var(--admin-accent); padding-left: 10px;">Información de Contacto y Soporte</h3>
                <div class="form-group" style="display: flex; flex-direction: column; gap: 5px;">
                  <label style="color: #94a3b8; font-size: 0.85rem; font-weight: 600;">Correo Electrónico de Soporte</label>
                  <input type="email" v-model="configForm.email_soporte" placeholder="soporte@ecoguia.org" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px; outline: none;">
                </div>
              </div>

              <!-- Redes Sociales de la Plataforma -->
              <div class="form-section">
                <h3 style="color: white; font-size: 1.1rem; font-weight: 700; margin-bottom: 15px; border-left: 3px solid var(--admin-accent); padding-left: 10px;">Redes Sociales Oficiales de la Plataforma</h3>
                <div class="social-inputs-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                  <div class="input-with-icon" style="position: relative;">
                    <i class="fa-brands fa-facebook" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #4d96ff;"></i>
                    <input type="url" v-model="configForm.redes_sociales.facebook" placeholder="https://facebook.com/..." style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px 12px 12px 44px; outline: none;">
                  </div>
                  <div class="input-with-icon" style="position: relative;">
                    <i class="fa-brands fa-instagram" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #e1306c;"></i>
                    <input type="url" v-model="configForm.redes_sociales.instagram" placeholder="https://instagram.com/..." style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px 12px 12px 44px; outline: none;">
                  </div>
                  <div class="input-with-icon" style="position: relative;">
                    <i class="fa-brands fa-x-twitter" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #f8fafc;"></i>
                    <input type="url" v-model="configForm.redes_sociales.twitter" placeholder="https://x.com/..." style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px 12px 12px 44px; outline: none;">
                  </div>
                  <div class="input-with-icon" style="position: relative;">
                    <i class="fa-brands fa-linkedin" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #0077b5;"></i>
                    <input type="url" v-model="configForm.redes_sociales.linkedin" placeholder="https://linkedin.com/..." style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px 12px 12px 44px; outline: none;">
                  </div>
                </div>
              </div>

              <!-- Acciones de Formulario -->
              <div class="form-actions" style="border-top: 1px solid var(--admin-border); padding-top: 20px; margin-top: 20px; display: flex; justify-content: flex-end;">
                <button type="submit" class="btn-create-new" id="btn-save-config" :disabled="configSaving" style="width: auto; background: var(--admin-accent); color: white; border: none; cursor: pointer; padding: 12px 24px; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px; font-weight: 600; transition: background 0.2s;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check" v-if="!configSaving"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>
                  <i v-else class="fa-solid fa-spinner fa-spin"></i>
                  {{ configSaving ? 'Aplicando...' : 'Aplicar Ajustes' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- 9. HISTORIAL ACTIVIDAD (Admin only) -->
        <div v-else-if="activeTab === 'historial'" class="historial-view-container glass-effect" style="padding: 40px; border-radius: 16px; text-align: center; border: 1px solid rgba(255,255,255,0.05);">
          <i class="fa-solid fa-clock-rotate-left" style="font-size: 4rem; color: #f59e0b; margin-bottom: 20px;"></i>
          <h2 style="color: white; font-weight: 800; font-size: 1.8rem; margin-bottom: 10px;">Historial de Actividad Global</h2>
          <p style="color: #94a3b8; font-size: 1.1rem; max-width: 500px; margin: 0 auto;">El registro de auditoría y actividad del sistema estará disponible en una próxima actualización.</p>
        </div>

      </main>
    </div>

    <!-- MODAL REGISTRO: EVENTO -->
    <div v-if="isEventModalOpen" class="modal-overlay">
      <div class="modal-content glass-effect" style="max-width: 650px; width: 90%; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h2>{{ editingItem.id ? 'Editar Evento' : 'Crear Evento' }}</h2>
          <button class="btn-close-modal" id="btn-close-evento" @click="closeAllModals" type="button">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <form @submit.prevent="saveItem" id="form-nuevo-evento" style="padding: 25px;">
          <div class="form-grid">
            <!-- Nombre -->
            <div class="form-group full-width">
              <label>Nombre del Evento</label>
              <div class="input-wrapper">
                <input type="text" v-model="editingItem.nombre" required />
              </div>
              <span v-if="eventErrors.nombre" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.nombre }}</span>
            </div>

            <!-- Modalidad Switch -->
            <div class="form-group full-width">
              <label>Modalidad del Evento</label>
              <div style="display: flex; gap: 10px;">
                <button 
                  type="button" 
                  class="tab-btn" 
                  :class="{ 'active': editingItem.modalidad === 'presencial' }" 
                  @click="editingItem.modalidad = 'presencial'"
                  style="flex: 1; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700;"
                >
                  📍 Presencial
                </button>
                <button 
                  type="button" 
                  class="tab-btn" 
                  :class="{ 'active': editingItem.modalidad === 'en_linea' }" 
                  @click="editingItem.modalidad = 'en_linea'"
                  style="flex: 1; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700;"
                >
                  🖥️ En Línea
                </button>
              </div>
            </div>

            <!-- Categoría -->
            <div class="form-group">
              <label>Categoría</label>
              <div class="input-wrapper">
                <select v-model="editingItem.categoria" required>
                  <option value="">Selecciona...</option>
                  <option value="reforestacion">Reforestación</option>
                  <option value="taller">Taller</option>
                  <option value="conferencia">Conferencia</option>
                  <option value="limpieza">Limpieza de Playas / Áreas</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <span v-if="eventErrors.categoria" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.categoria }}</span>
            </div>

            <!-- Sede / Lugar -->
            <div class="form-group">
              <label>Sede / Lugar (Opcional)</label>
              <div class="input-wrapper">
                <select v-model="editingItem.lugar_id">
                  <option value="">Ninguna / Otro lugar</option>
                  <option v-for="lugar in approvedPlacesList" :key="lugar.id" :value="lugar.id">
                    {{ lugar.nombre }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Fechas -->
            <div class="form-group">
              <label>Fecha Inicio</label>
              <div class="input-wrapper">
                <input type="datetime-local" v-model="editingItem.fecha_inicio" required />
              </div>
              <span v-if="eventErrors.fecha_inicio" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.fecha_inicio }}</span>
            </div>
            <div class="form-group">
              <label>Fecha Fin</label>
              <div class="input-wrapper">
                <input type="datetime-local" v-model="editingItem.fecha_fin" required />
              </div>
              <span v-if="eventErrors.fecha_fin" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.fecha_fin }}</span>
            </div>

            <!-- CONDITIONAL (presencial only) -->
            <template v-if="editingItem.modalidad === 'presencial'">
              <div class="form-group full-width" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px; margin-top: 5px;">
                <h4 style="color: #4d96ff; margin: 0 0 10px 0; font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                  📍 Ubicación e Integración con Google Maps
                </h4>
              </div>
              <div class="form-group full-width">
                <label>Dirección Escrita</label>
                <div class="input-wrapper">
                  <input type="text" v-model="editingItem.ubicacion" placeholder="Ej: Av. Paseo de la Reforma s/n, CDMX" />
                </div>
                <span v-if="eventErrors.ubicacion" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.ubicacion }}</span>
              </div>
              <div class="form-group full-width">
                <label>Enlace de Google Maps (Para extraer coordenadas)</label>
                <div class="input-with-button">
                  <input type="text" v-model="gmapsLink" placeholder="Pega el enlace de Google Maps aquí y haz clic en Extraer..." style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; padding: 12px; outline: none;" />
                  <button type="button" class="btn btn-primary" @click="extractCoordsFromGmaps" style="border-radius: 8px; padding: 0 18px; font-weight: 700; height: auto;">
                    Extraer
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label>Latitud</label>
                <div class="input-wrapper">
                  <input type="number" step="any" v-model="editingItem.lat" placeholder="Se rellena automáticamente..." />
                </div>
                <span v-if="eventErrors.lat" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.lat }}</span>
              </div>
              <div class="form-group">
                <label>Longitud</label>
                <div class="input-wrapper">
                  <input type="number" step="any" v-model="editingItem.lng" placeholder="Se rellena automáticamente..." />
                </div>
                <span v-if="eventErrors.lng" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.lng }}</span>
              </div>
              <div class="form-group full-width">
                <label class="perm-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; cursor: pointer;">
                  <span style="font-weight: 600; font-size: 0.9rem; color: white;">¿También disponible en línea? (Híbrido)</span>
                  <input type="checkbox" v-model="editingItem.tiene_sesion_online" style="width: auto;" />
                </label>
                <p style="font-size: 0.8rem; color: #94a3b8; margin: 6px 0 0 0;" v-if="editingItem.tiene_sesion_online">
                  * Si está activo, el evento se listará tanto en Presencial como en En Línea. Deberás ingresar el enlace de la sesión virtual abajo.
                </p>
                <div v-if="editingItem.tiene_sesion_online" class="form-group" style="margin-top: 15px;">
                  <label>Enlace de la Sesión En Línea <span class="required-badge" style="color: #ff4d4d;">* Requerido</span></label>
                  <div class="input-wrapper">
                    <input type="url" v-model="editingItem.sesion_online_link" placeholder="Ej: https://zoom.us/j/... o enlace directo a la videollamada" />
                  </div>
                  <span v-if="eventErrors.sesion_online_link" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.sesion_online_link }}</span>
                </div>
              </div>
            </template>

            <!-- CONDITIONAL (en_linea only) -->
            <template v-if="editingItem.modalidad === 'en_linea'">
              <div class="form-group full-width" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px; margin-top: 5px;">
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 15px; border-radius: 12px; color: #10b981; display: flex; align-items: flex-start; gap: 12px;">
                  <i class="fa-solid fa-circle-info" style="font-size: 1.2rem; margin-top: 2px;"></i>
                  <div>
                    <h4 style="margin: 0 0 4px 0; font-weight: 700; font-size: 0.95rem;">Sesión Virtual Activa</h4>
                    <p style="margin: 0; font-size: 0.85rem; color: #a7f3d0;">Ingresa el enlace directo (Zoom, Meet, Teams, etc.) para que los participantes puedan unirse a la sesión virtual.</p>
                  </div>
                </div>
                <div style="margin-top: 15px;">
                  <label>Enlace de la Sesión En Línea <span class="required-badge" style="color: #ff4d4d;">* Requerido</span></label>
                  <div class="input-wrapper">
                    <input type="url" v-model="editingItem.sesion_online_link" placeholder="Ej: https://zoom.us/j/... o enlace directo a la videollamada" />
                  </div>
                  <span v-if="eventErrors.sesion_online_link" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.sesion_online_link }}</span>
                </div>
              </div>
            </template>

            <div class="form-group full-width">
              <label>Imágenes (Flyers / Fotos)</label>
              <div class="image-upload-wrapper">
                <button type="button" class="btn-admin" @click="eventImagesInput?.click()" style="width: 100%; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white;">
                  <i class="fa-solid fa-images"></i> Añadir Imágenes
                </button>
                <input ref="eventImagesInput" type="file" @change="handleEventImagesUpload" accept="image/*" multiple style="display: none;" />
                
                <div v-if="isUploadingImages" style="font-size: 0.85rem; color: var(--color-eco); display: flex; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-spinner fa-spin"></i> Subiendo imágenes...
                </div>

                <div v-if="editingItem.imagenes && editingItem.imagenes.length > 0" id="ev-images-preview-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; margin-top: 10px;">
                  <div v-for="(img, idx) in editingItem.imagenes" :key="idx" style="position: relative; width: 100%; padding-bottom: 100%; border-radius: 8px; overflow: hidden;">
                    <img :src="img" style="position: absolute; top: 0px; left: 0px; width: 100%; height: 100%; object-fit: cover;" />
                    <button type="button" @click="removeEventImage(Number(idx))" style="position: absolute; top: 5px; right: 5px; background: rgba(255, 0, 0, 0.8); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px;">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Descripción -->
            <div class="form-group full-width">
              <label>Descripción del Evento</label>
              <div class="input-wrapper">
                <textarea v-model="editingItem.descripcion" rows="3" required placeholder="Describe los detalles, objetivos y actividades del evento..."></textarea>
              </div>
              <span v-if="eventErrors.descripcion" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.descripcion }}</span>
            </div>

            <!-- Enlace Registro -->
            <div class="form-group full-width">
              <label>Enlace Registro (Súmate) <span class="optional-badge" style="font-size: 0.75rem; opacity: 0.6; color: #94a3b8; font-weight: normal;">(Opcional)</span></label>
              <div class="input-wrapper pink-effect">
                <input type="url" v-model="editingItem.reg_link" placeholder="Ej: https://forms.gle/... o enlace a formulario de registro" />
              </div>
              <span v-if="eventErrors.reg_link" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.reg_link }}</span>
            </div>

            <!-- Drive Fotos y Clave (Nueva Acción) -->
            <div class="form-group full-width" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px; margin-top: 5px;">
              <h4 style="color: #10b981; margin: 0 0 10px 0; font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                📸 Compartir Fotografías del Evento (Drive)
              </h4>
            </div>
            <div class="form-group">
              <label>Enlace de Drive para Fotos <span class="optional-badge" style="font-size: 0.75rem; opacity: 0.6; color: #94a3b8; font-weight: normal;">(Opcional)</span></label>
              <div class="input-wrapper green-effect">
                <input type="url" v-model="editingItem.drive_fotos_url" placeholder="Ej: https://drive.google.com/drive/folders/..." />
              </div>
              <span v-if="eventErrors.drive_fotos_url" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.drive_fotos_url }}</span>
            </div>
            <div class="form-group">
              <label>Clave de Acceso a Fotos <span class="optional-badge" style="font-size: 0.75rem; opacity: 0.6; color: #94a3b8; font-weight: normal;">(Opcional)</span></label>
              <div class="input-wrapper green-effect">
                <input type="text" v-model="editingItem.clave_fotos" placeholder="Ej: Clave Secreta para ver fotos" />
              </div>
              <span v-if="eventErrors.clave_fotos" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.clave_fotos }}</span>
            </div>

            <!-- Social networks selector -->
            <div class="form-group full-width" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px; margin-top: 5px;">
              <label>Redes Sociales del Evento (Haz clic en un icono para ingresar su enlace)</label>
              <div class="social-selector" style="margin-bottom: 10px;">
                <button type="button" class="social-btn facebook" :class="{ 'active': activeSocialInputs.fb }" @click="toggleSocialInput('fb')" title="Facebook"><i class="fa-brands fa-facebook"></i></button>
                <button type="button" class="social-btn instagram" :class="{ 'active': activeSocialInputs.ig }" @click="toggleSocialInput('ig')" title="Instagram"><i class="fa-brands fa-instagram"></i></button>
                <button type="button" class="social-btn whatsapp" :class="{ 'active': activeSocialInputs.wa }" @click="toggleSocialInput('wa')" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
                <button type="button" class="social-btn x-twitter" :class="{ 'active': activeSocialInputs.x }" @click="toggleSocialInput('x')" title="X (Twitter)"><i class="fa-brands fa-x-twitter"></i></button>
                <button type="button" class="social-btn youtube" :class="{ 'active': activeSocialInputs.yt }" @click="toggleSocialInput('yt')" title="YouTube"><i class="fa-brands fa-youtube"></i></button>
                <button type="button" class="social-btn web" :class="{ 'active': activeSocialInputs.web }" @click="toggleSocialInput('web')" title="Sitio Web"><i class="fa-solid fa-globe"></i></button>
              </div>
              
              <div class="social-inputs-container">
                <div v-if="activeSocialInputs.fb" class="social-input-group">
                  <label style="color: #1877F2;"><i class="fa-brands fa-facebook"></i></label>
                  <input type="url" v-model="editingItem.social_fb" placeholder="URL de Facebook del evento..." />
                </div>
                <div v-if="activeSocialInputs.ig" class="social-input-group">
                  <label style="color: #E1306C;"><i class="fa-brands fa-instagram"></i></label>
                  <input type="url" v-model="editingItem.social_ig" placeholder="URL de Instagram del evento..." />
                </div>
                <div v-if="activeSocialInputs.wa" class="social-input-group">
                  <label style="color: #25D366;"><i class="fa-brands fa-whatsapp"></i></label>
                  <input type="url" v-model="editingItem.social_wa" placeholder="Enlace de contacto / grupo WhatsApp..." />
                </div>
                <div v-if="activeSocialInputs.x" class="social-input-group">
                  <label style="color: #000000;"><i class="fa-brands fa-x-twitter"></i></label>
                  <input type="url" v-model="editingItem.social_x" placeholder="Enlace de X (Twitter)..." />
                </div>
                <div v-if="activeSocialInputs.yt" class="social-input-group">
                  <label style="color: #FF0000;"><i class="fa-brands fa-youtube"></i></label>
                  <input type="url" v-model="editingItem.social_yt" placeholder="Video / Canal de YouTube..." />
                </div>
                <div v-if="activeSocialInputs.web" class="social-input-group">
                  <label style="color: #72B04D;"><i class="fa-solid fa-globe"></i></label>
                  <input type="url" v-model="editingItem.social_web" placeholder="Sitio Web oficial..." />
                </div>
              </div>
              
              <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
                <span v-if="eventErrors.social_fb" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem;">{{ eventErrors.social_fb }}</span>
                <span v-if="eventErrors.social_ig" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem;">{{ eventErrors.social_ig }}</span>
                <span v-if="eventErrors.social_wa" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem;">{{ eventErrors.social_wa }}</span>
                <span v-if="eventErrors.social_x" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem;">{{ eventErrors.social_x }}</span>
                <span v-if="eventErrors.social_yt" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem;">{{ eventErrors.social_yt }}</span>
                <span v-if="eventErrors.social_web" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem;">{{ eventErrors.social_web }}</span>
              </div>
            </div>

            <!-- Características Especiales -->
            <div class="form-group full-width" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px; margin-top: 10px;">
              <label style="color: #94a3b8; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; display: block;">Características Especiales</label>
              <div class="audience-grid">
                <!-- Mascotas (Sólo presencial) -->
                <label v-if="editingItem.modalidad === 'presencial'" class="filter-chip">
                  <input type="checkbox" id="filter-pets" v-model="editingItem.pet_friendly" />
                  <span class="chip-content">🐶 Mascotas</span>
                </label>
                <!-- Para Niños (Sólo presencial) -->
                <label v-if="editingItem.modalidad === 'presencial'" class="filter-chip">
                  <input type="checkbox" id="filter-kids" v-model="editingItem.apto_ninos" />
                  <span class="chip-content">🧒 Para Niños</span>
                </label>
                <!-- Gratis (Todos) -->
                <label class="filter-chip">
                  <input type="checkbox" id="switch-gratis" v-model="editingItem.es_gratuito" />
                  <span class="chip-content">💰 Gratis</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Footer Buttons -->
          <div class="modal-footer" style="margin-top: 30px; display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" @click="closeAllModals">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="savingItem">
              {{ savingItem ? 'Guardando...' : 'Guardar Evento' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL REGISTRO: LUGAR -->
    <div v-if="isPlaceModalOpen" class="modal-overlay">
      <div class="modal-content admin-modal glass-effect">
        <div class="modal-header">
          <h3>{{ editingItem.id ? 'Editar Lugar' : 'Agregar Lugar' }}</h3>
          <button class="close-modal-btn" @click="closeAllModals">&times;</button>
        </div>
        <form @submit.prevent="saveItem" class="modal-body" style="display: flex; flex-direction: column; gap: 15px;">
          <div class="form-group">
            <label>Nombre del Lugar</label>
            <input type="text" v-model="editingItem.nombre" required />
            <span v-if="placeErrors.nombre" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ placeErrors.nombre }}</span>
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <textarea v-model="editingItem.descripcion" rows="3" required></textarea>
            <span v-if="placeErrors.descripcion" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ placeErrors.descripcion }}</span>
          </div>
          <div class="form-group">
            <label>Categoría</label>
            <div class="input-wrapper">
              <select v-model="editingItem.categoria" required>
                <option value="">Selecciona...</option>
                <option value="sede">Sede de Eventos</option>
                <option value="reciclaje">Centro de Reciclaje / Residuos</option>
                <option value="asociacion">Asociación / ONG Ambiental</option>
                <option value="granel">Tienda a Granel / Residuo Cero</option>
                <option value="restaurante">Restaurante Vegano / Eco-Gastronomía</option>
                <option value="huerto">Huerto / Espacio de Cultivo</option>
                <option value="ecoturismo">Ecoturismo / Área Natural</option>
                <option value="otro">Otros Lugares Sustentables</option>
              </select>
            </div>
            <span v-if="placeErrors.categoria" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ placeErrors.categoria }}</span>
          </div>
          <div class="form-group">
            <label>Ubicación (Dirección)</label>
            <input type="text" v-model="editingItem.ubicacion" placeholder="Dirección completa" required />
            <span v-if="placeErrors.ubicacion" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ placeErrors.ubicacion }}</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div class="form-group">
              <label>Latitud</label>
              <input type="number" step="any" v-model="editingItem.lat" required />
              <span v-if="placeErrors.lat" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ placeErrors.lat }}</span>
            </div>
            <div class="form-group">
              <label>Longitud</label>
              <input type="number" step="any" v-model="editingItem.lng" required />
              <span v-if="placeErrors.lng" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ placeErrors.lng }}</span>
            </div>
          </div>
          
          <div class="form-group">
            <label>Imagen del Lugar</label>
            <input type="text" v-model="editingItem.imagen" placeholder="URL de la imagen o sube una:" style="margin-bottom: 8px;" />
            <input type="file" @change="handleItemImageUpload($event, 'imagen')" accept="image/*" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
            <button type="button" class="btn btn-secondary" @click="closeAllModals">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="savingItem">
              {{ savingItem ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL REGISTRO: CONTENIDO DINÁMICO (HUBS) -->
    <div v-if="isContentModalOpen" class="modal-overlay">
      <div class="modal-content admin-modal glass-effect">
        <div class="modal-header">
          <h3>{{ editingItem.id ? 'Editar Contenido' : 'Agregar Contenido' }}</h3>
          <button class="close-modal-btn" @click="closeAllModals">&times;</button>
        </div>
        <form @submit.prevent="saveItem" class="modal-body" style="display: flex; flex-direction: column; gap: 15px;">
          <div class="form-group">
            <label>Título / Nombre</label>
            <input type="text" v-model="editingItem.titulo" required />
          </div>
          
          <div class="form-group">
            <label>Descripción Principal</label>
            <textarea v-model="editingItem.descripcion_texto" rows="3" required></textarea>
          </div>

          <div class="form-group">
            <label>Enlace Externo (URL)</label>
            <input type="url" v-model="editingItem.enlace_externo" placeholder="https://..." />
          </div>

          <div class="form-group">
            <label>Fecha de Evento (Opcional)</label>
            <input type="date" v-model="editingItem.fecha_evento" />
          </div>

          <div class="form-group">
            <label>Imagen Adjunta</label>
            <input type="text" v-model="editingItem.imagen_url" placeholder="URL o sube una:" style="margin-bottom: 8px;" />
            <input type="file" @change="handleItemImageUpload($event, 'imagen_url')" accept="image/*" />
          </div>

          <!-- Dynamic fields depending on Configs -->
          <div 
            v-if="selectedSection && SECTION_CONFIGS[selectedSection]" 
            style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;"
          >
            <h4 style="grid-column: span 2; color: var(--color-eco); font-weight: 700; margin: 0 0 5px 0;">Datos Específicos</h4>
            
            <div v-for="field in SECTION_CONFIGS[selectedSection]?.fields" :key="field.id" class="form-group">
              <label>{{ field.label }}</label>
              <select v-if="field.type === 'select'" v-model="editingItem.meta[field.id]" style="width: 100%;">
                <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <input v-else :type="field.type" v-model="editingItem.meta[field.id]" :placeholder="field.placeholder" style="width: 100%;" />
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
            <button type="button" class="btn btn-secondary" @click="closeAllModals">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="savingItem">
              {{ savingItem ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL PERMISOS ACTOR (Admin only) -->
    <div v-if="isPermissionsModalOpen" class="modal-overlay">
      <div class="modal-content admin-modal glass-effect" style="max-width: 600px;">
        <div class="modal-header">
          <h3>Permisos de: {{ selectedActorName }}</h3>
          <button class="close-modal-btn" @click="closeAllModals">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 20px;">
          <div>
            <h4 style="color: var(--color-eco); font-weight: 700; margin-bottom: 10px; font-size: 1.05rem;">Acceso a Secciones (Hubs)</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <!-- Colibri (educación y acción) -->
              <h5 style="grid-column: 1 / -1; color: var(--color-eco); font-weight: 700; margin: 5px 0 2px;">Colibri</h5>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_cursos" /> 🎓 Cursos
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_ecotecnias" /> 💡 Ecotecnias
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_agua" /> 🌊 Agua
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_lecturas" /> 📚 Lecturas
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_documentales" /> 🎥 Documentales
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_firmas" /> ✍️ Firmas / Peticiones
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_voluntariados" /> 🤝 Voluntariados
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_convocatoria" /> 📣 Convocatorias
              </label>

              <!-- Ajolote (causas y lugares) -->
              <h5 style="grid-column: 1 / -1; color: var(--color-eco); font-weight: 700; margin: 15px 0 2px;">Ajolote</h5>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_causas" /> 💝 Causas / Rifas
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_lugares" /> 📍 Lugares Sustentables
              </label>

              <!-- Lobo (normativas y fondos) -->
              <h5 style="grid-column: 1 / -1; color: var(--color-eco); font-weight: 700; margin: 15px 0 2px;">Lobo</h5>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_normativa" /> ⚖️ Normativas
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_fondos" /> 💰 Fondos
              </label>
            </div>
          </div>

          <div style="border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 15px;">
            <h4 style="color: var(--color-eco); font-weight: 700; margin-bottom: 10px; font-size: 1.05rem;">Capacidades Operativas</h4>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorFuncPermissions.puede_crear_eventos" /> Permitir crear eventos ecológicos
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorFuncPermissions.puede_crear_lugares" /> Permitir crear lugares sustentables
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorFuncPermissions.puede_enviar_notificaciones" /> Permitir enviar notificaciones/alertas
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorFuncPermissions.visible_en_directorio" /> Mostrar en el directorio de agentes
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorFuncPermissions.puede_gestionar_slider" /> Permitir editar slider del inicio
              </label>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
            <button class="btn btn-secondary" @click="closeAllModals">Cancelar</button>
            <button class="btn btn-primary" @click="savePermissions">Guardar Permisos</button>
          </div>
        </div>
      </div>
    </div>
    

    <!-- MODAL DETALLE DE HISTORIAL DE NOTIFICACIONES -->
    <div v-if="isNotifReviewModalOpen && activeNotifDetail" class="modal-overlay">
      <div class="modal-content admin-modal glass-effect">
        <div class="modal-header">
          <h3>Detalle de Notificación</h3>
          <button class="close-modal-btn" @click="isNotifReviewModalOpen = false">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <h4 style="color: white; font-weight:700; font-size:1.15rem; margin-bottom:5px;">{{ activeNotifDetail.titulo }}</h4>
            <span style="font-size:0.75rem; color:#94a3b8;">Enviado el: {{ formatRelativeDate(activeNotifDetail.created_at) }}</span>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); color:#e2e8f0; line-height:1.5; white-space:pre-wrap;">
            {{ activeNotifDetail.mensaje }}
          </div>
          <div v-if="activeNotifDetail.enlace_url">
            <span style="color:#64748b; font-size:0.8rem; font-weight:600; display:block; margin-bottom:5px;">ENLACE ASOCIADO</span>
            <a :href="activeNotifDetail.enlace_url" target="_blank" style="color: var(--color-eco); word-break: break-all;">{{ activeNotifDetail.enlace_url }}</a>
          </div>
          <div v-if="activeNotifDetail.archivo_url">
            <span style="color:#64748b; font-size:0.8rem; font-weight:600; display:block; margin-bottom:5px;">ARCHIVO ADJUNTO</span>
            <a :href="activeNotifDetail.archivo_url" target="_blank" style="color: var(--color-eco); word-break: break-all;">{{ activeNotifDetail.archivo_url }}</a>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL SLIDER CAROUSEL -->
    <div v-if="isSliderModalOpen" class="modal-overlay">
      <div class="modal-content admin-modal glass-effect">
        <div class="modal-header">
          <h3>{{ sliderForm.id ? 'Editar Slide' : 'Agregar Slide' }}</h3>
          <button class="close-modal-btn" @click="closeAllModals">&times;</button>
        </div>
        <form @submit.prevent="saveSlide" class="modal-body" style="display: flex; flex-direction: column; gap: 15px;">
          <div class="form-group">
            <label>Título</label>
            <input type="text" v-model="sliderForm.titulo" />
          </div>
          <div class="form-group">
            <label>Subtítulo / Texto</label>
            <input type="text" v-model="sliderForm.subtitulo" />
          </div>
          <div class="form-group">
            <label>Badge de Nivel (Opcional)</label>
            <input type="text" v-model="sliderForm.badge" placeholder="Ej: Reforestación" />
          </div>
          <div class="form-group">
            <label>Enlace URL (Detalles)</label>
            <input type="url" v-model="sliderForm.enlace_url" />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div class="form-group">
              <label>Orden de visualización</label>
              <input type="number" v-model.number="sliderForm.orden" required />
            </div>
            <div class="form-group" style="display: flex; gap: 20px; align-items: center; height: 100%; margin-top:20px;">
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="sliderForm.activo" /> Activo
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="sliderForm.sin_boton" /> Ocultar Botón
              </label>
            </div>
          </div>

          <div class="form-group">
            <label>Imagen Móvil / Por defecto</label>
            <input type="text" v-model="sliderForm.imagen_url" required placeholder="URL o sube:" style="margin-bottom: 8px;" />
            <input type="file" @change="handleSliderImageUpload($event, 'imagen_url')" accept="image/*" />
          </div>

          <div class="form-group">
            <label>Imagen Desktop (Opcional)</label>
            <input type="text" v-model="sliderForm.imagen_pc_url" placeholder="URL o sube:" style="margin-bottom: 8px;" />
            <input type="file" @change="handleSliderImageUpload($event, 'imagen_pc_url')" accept="image/*" />
          </div>

          <div class="form-group">
            <label>Imagen Tablet (Opcional)</label>
            <input type="text" v-model="sliderForm.imagen_tablet_url" placeholder="URL o sube:" style="margin-bottom: 8px;" />
            <input type="file" @change="handleSliderImageUpload($event, 'imagen_tablet_url')" accept="image/*" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
            <button type="button" class="btn btn-secondary" @click="closeAllModals">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL DE MENSAJERÍA PARA SEGUIDORES -->
    <div v-if="isMessageModalOpen" id="modal-mensaje-seguidores" class="modal-overlay">
        <div class="modal-content message-modal-content" style="max-width: 500px;">
            <div class="message-modal-header">
                <h2 id="msg-modal-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send" style="margin-right: 8px;"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path></svg>
                  Enviar Mensaje
                </h2>
            </div>
            <form @submit.prevent="sendMessageToFollower" class="message-form-container" style="display: flex; flex-direction: column; gap: 15px;">
                <div class="recipient-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user" style="margin-right: 4px;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span id="msg-destinatario-label">Destinatario: {{ messageRecipientName }}</span>
                </div>
                
                <input type="hidden" id="msg-destinatario-id" :value="messageRecipientId">
                
                <div class="message-input-group">
                    <label style="display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">Asunto / Título</label>
                    <input type="text" v-model="messageTitle" required placeholder="Ej. ¡Nueva actividad confirmada!" style="width: 100%; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 14px 18px; color: white; font-size: 0.95rem; outline: none;" />
                </div>
                <div class="message-input-group">
                    <label style="display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">Mensaje</label>
                    <textarea v-model="messageBody" rows="5" required placeholder="Escribe tu mensaje aquí..." style="width: 100%; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 14px 18px; color: white; font-size: 0.95rem; outline: none;"></textarea>
                </div>

                <div class="modal-footer" style="margin-top: 10px; display: flex; gap: 12px; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" @click="isMessageModalOpen = false" style="background: rgba(255,255,255,0.05); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">Cancelar</button>
                    <button type="submit" class="btn-admin btn-success-admin btn btn-primary" :disabled="sendingMessage" style="display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                        <i v-if="sendingMessage" class="fa-solid fa-spinner fa-spin"></i>
                        <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path></svg>
                        Enviar Mensaje
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL GESTION DE AGENTE -->
    <div v-if="isProfileAdminModalOpen" class="modal-overlay">
        <div class="modal-content glass-effect" style="max-width: 650px;">
            <div class="modal-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="header-icon-box"><i class="fa-solid fa-user-gear"></i></div>
                    <div>
                        <h2>Gestión de Agente</h2>
                        <p style="color: var(--admin-text-muted); font-size: 0.9rem; margin: 0;">Edita el perfil completo del usuario.</p>
                    </div>
                </div>
                <button class="close-modal-btn" @click="closeAllModals"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body" style="padding: 25px;">
                <form @submit.prevent="saveProfileAdmin">
                    <div style="display: flex; justify-content: center; margin-bottom: 30px;">
                        <div class="profile-pic-upload" style="width: 120px; height: 120px;">
                            <div class="avatar-preview" style="border-radius: 40px; font-size: 3rem; background: var(--gradient-eco);">
                                <img v-if="profileAdminForm.avatar_url" :src="profileAdminForm.avatar_url" style="width:100%; height:100%; object-fit:cover; border-radius:40px;">
                                <span v-else style="color: white; font-weight: 600;">{{ profileAdminForm.nombre_completo ? profileAdminForm.nombre_completo.charAt(0).toUpperCase() : 'U' }}</span>
                            </div>
                            <label for="prof-avatar-input" class="upload-btn" style="cursor: pointer;">
                                <i class="fa-solid fa-camera"></i>
                            </label>
                            <input type="file" id="prof-avatar-input" accept="image/*" style="display: none;" @change="handleProfileAdminAvatarUpload">
                        </div>
                    </div>

                    <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label>Nombre Completo</label>
                            <input type="text" v-model="profileAdminForm.nombre_completo" style="width:100%; padding:10px; background:rgba(255,255,255,0.03); border:1px solid var(--admin-border); border-radius:8px; color:white;">
                        </div>
                        <div class="form-group">
                            <label>Correo Electrónico Registrado</label>
                            <input type="email" v-model="profileAdminForm.email" readonly style="width:100%; padding:10px; background:rgba(255,255,255,0.01); border:1px solid var(--admin-border); border-radius:8px; color:var(--admin-text-muted); cursor:not-allowed;">
                        </div>
                        <div class="form-group">
                            <label>Teléfono</label>
                            <input type="text" v-model="profileAdminForm.telefono" style="width:100%; padding:10px; background:rgba(255,255,255,0.03); border:1px solid var(--admin-border); border-radius:8px; color:white;">
                        </div>
                        <div class="form-group">
                            <label>Rol en la Plataforma</label>
                            <select v-model="profileAdminForm.rol" style="width:100%; padding:10px; background:rgba(255,255,255,0.03); border:1px solid var(--admin-border); border-radius:8px; color:white;">
                                <option value="admin">Administrador</option>
                                <option value="actor">Actor / Agente</option>
                                <option value="user">Usuario</option>
                            </select>
                        </div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Sitio Web</label>
                            <input type="url" v-model="profileAdminForm.web" style="width:100%; padding:10px; background:rgba(255,255,255,0.03); border:1px solid var(--admin-border); border-radius:8px; color:white;">
                        </div>
                    </div>

                    <div class="form-group full-width" style="margin-bottom: 20px;">
                        <label>Biografía</label>
                        <textarea v-model="profileAdminForm.bio" rows="3" style="width:100%; padding:10px; background:rgba(255,255,255,0.03); border:1px solid var(--admin-border); border-radius:8px; color:white; outline: none;"></textarea>
                    </div>

                    <div class="social-inputs-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px;">
                        <div class="input-with-icon" style="position: relative;">
                            <i class="fa-brands fa-facebook" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #1877F2; font-size: 1.2rem;"></i>
                            <input type="url" v-model="profileAdminForm.facebook" placeholder="Facebook" style="width:100%; padding:12px 12px 12px 44px; background:rgba(255,255,255,0.03); border:1px solid var(--admin-border); border-radius:8px; color:white; outline: none;">
                        </div>
                        <div class="input-with-icon" style="position: relative;">
                            <i class="fa-brands fa-instagram" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #dc2743; font-size: 1.2rem;"></i>
                            <input type="url" v-model="profileAdminForm.instagram" placeholder="Instagram" style="width:100%; padding:12px 12px 12px 44px; background:rgba(255,255,255,0.03); border:1px solid var(--admin-border); border-radius:8px; color:white; outline: none;">
                        </div>
                        <div class="input-with-icon" style="position: relative;">
                            <i class="fa-brands fa-x-twitter" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #f8fafc; font-size: 1.2rem;"></i>
                            <input type="url" v-model="profileAdminForm.twitter" placeholder="X / Twitter" style="width:100%; padding:12px 12px 12px 44px; background:rgba(255,255,255,0.03); border:1px solid var(--admin-border); border-radius:8px; color:white; outline: none;">
                        </div>
                    </div>

                    <!-- CONTROL VIDEOS (Admin config) -->
                    <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--admin-border); padding: 15px; border-radius: 12px; margin-bottom: 25px;">
                      <label style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; color: white;">
                        <span style="font-size: 0.95rem; font-weight: 600;">Permitir al actor gestionar sus videos de presentación</span>
                        <div style="position: relative; width: 44px; height: 24px;">
                          <input type="checkbox" v-model="profileAdminForm.permitir_edicion_videos" style="opacity: 0; width: 0; height: 0;">
                          <span class="slider round" :style="{ background: profileAdminForm.permitir_edicion_videos ? 'var(--color-eco)' : 'rgba(255,255,255,0.2)', position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0', borderRadius: '34px', transition: '.4s' }">
                            <span :style="{ position: 'absolute', height: '18px', width: '18px', left: profileAdminForm.permitir_edicion_videos ? '22px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }"></span>
                          </span>
                        </div>
                      </label>
                    </div>

                    <!-- CONTROL VERIFICACION (Admin config) -->
                    <div v-if="profileAdminForm.rol === 'actor'" style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--admin-border); padding: 15px; border-radius: 12px; margin-bottom: 25px;">
                      <label style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; color: white;">
                        <span style="font-size: 0.95rem; font-weight: 600;">Verificar Perfil (Eco Actor Verificado)</span>
                        <div style="position: relative; width: 44px; height: 24px;">
                          <input type="checkbox" v-model="profileAdminForm.is_validated" style="opacity: 0; width: 0; height: 0;">
                          <span class="slider round" :style="{ background: profileAdminForm.is_validated ? 'var(--color-eco)' : 'rgba(255,255,255,0.2)', position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0', borderRadius: '34px', transition: '.4s' }">
                            <span :style="{ position: 'absolute', height: '18px', width: '18px', left: profileAdminForm.is_validated ? '22px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }"></span>
                          </span>
                        </div>
                      </label>
                    </div>

                    <!-- ZONAS DE IMPACTO (Admin view/edit) -->
                    <div v-if="profileAdminForm.rol === 'actor'" style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--admin-border); padding: 20px; border-radius: 12px; margin-bottom: 25px;">
                      <label style="color: white; font-weight: 700; margin-bottom: 5px; display: block;">Zonas de Impacto</label>
                      <p style="color: var(--admin-text-muted); font-size: 0.8rem; margin-bottom: 12px;">Selecciona el Estado y Municipio para agregar a las zonas del actor:</p>
                      
                      <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 4px;">
                          <label style="font-size: 0.75rem; color: #a3aab1; font-weight: 600; text-transform: uppercase;">Estado</label>
                          <select v-model="selectedEstadoAdmin" @change="onEstadoChange('admin')" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; font-size: 0.85rem;">
                            <option value="">Selecciona un Estado</option>
                            <option v-for="est in estadosList" :key="est.code" :value="est.code">{{ est.name }}</option>
                          </select>
                        </div>
                        <div style="flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 4px;">
                          <label style="font-size: 0.75rem; color: #a3aab1; font-weight: 600; text-transform: uppercase;">Municipio / Alcaldía</label>
                          <select v-model="selectedMunicipioAdmin" :disabled="!selectedEstadoAdmin || municipiosListAdmin.length === 0" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; font-size: 0.85rem;">
                            <option value="">Todo el Estado (General)</option>
                            <option v-for="mun in municipiosListAdmin" :key="mun.code" :value="mun.name">{{ mun.name }}</option>
                          </select>
                        </div>
                        <div style="display: flex; align-items: flex-end;">
                          <button type="button" @click="agregarZonaImpacto('admin')" class="btn-admin" style="background: var(--color-eco); color: black; font-weight: 700; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; height: 35px; display: flex; align-items: center; gap: 4px; font-size: 0.8rem;">
                            <i class="fa-solid fa-plus"></i> Agregar
                          </button>
                        </div>
                      </div>

                      <!-- Lista de Zonas Agregadas (Chips) -->
                      <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; padding: 12px;">
                        <label style="font-size: 0.75rem; color: #a3aab1; display: block; margin-bottom: 8px; font-weight: 600; text-transform: uppercase;">Zonas Agregadas</label>
                        <div class="chips-grid" style="display: flex; flex-wrap: wrap; gap: 6px;">
                          <span 
                            v-for="zona in profileAdminForm.zonas_impacto" 
                            :key="zona" 
                            class="zona-chip"
                            style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: rgba(114, 176, 77, 0.15); border: 1px solid rgba(114, 176, 77, 0.3); color: #72B04D; font-size: 0.75rem; font-weight: 600;"
                          >
                            <span>{{ zona }}</span>
                            <button type="button" @click="removerZonaImpacto(zona, 'admin')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.85rem; padding: 0; display: inline-flex; align-items: center;" title="Eliminar zona">
                              <i class="fa-solid fa-circle-xmark"></i>
                            </button>
                          </span>
                          <p v-if="!profileAdminForm.zonas_impacto || profileAdminForm.zonas_impacto.length === 0" style="color: #666; font-size: 0.8rem; font-style: italic; margin: 0;">No se han agregado zonas de impacto.</p>
                        </div>
                      </div>
                    </div>


                    <!-- VIDEOS DE PRESENTACION (Admin view/edit) -->
                    <div class="form-group" style="margin-bottom: 25px;">
                        <label style="color: white; font-weight: 700; margin-bottom: 10px; display: block;">Videos de Presentación (Admin/Actor)</label>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                          <div v-for="(videoUrl, index) in profileAdminForm.videos_presentacion" :key="index" style="display: flex; gap: 10px; align-items: center;">
                            <div style="position: relative; flex: 1;">
                              <i class="fa-brands fa-youtube" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #FF0000;"></i>
                              <input 
                                type="url" 
                                v-model="profileAdminForm.videos_presentacion[index]" 
                                placeholder="https://www.youtube.com/watch?v=..." 
                                style="width: 100%; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; padding: 12px 12px 12px 44px; outline: none;"
                              >
                            </div>
                            <button 
                              type="button" 
                              class="action-btn btn-danger" 
                              @click="profileAdminForm.videos_presentacion.splice(index, 1)"
                              style="width: 44px; height: 44px; border-radius: 8px;"
                            >
                              <i class="fa-solid fa-trash"></i>
                            </button>
                          </div>

                          <button 
                            v-if="profileAdminForm.videos_presentacion.length < 5"
                            type="button" 
                            class="btn-admin" 
                            @click="profileAdminForm.videos_presentacion.push('')"
                            style="width: fit-content; background: rgba(255,255,255,0.05); color: white; border: 1px solid var(--admin-border); padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;"
                          >
                            <i class="fa-solid fa-plus"></i> Agregar enlace de video
                          </button>
                        </div>
                    </div>

                    <!-- SECCIÓN DE SEGURIDAD EN MODAL -->
                    <div class="form-section security-section-admin" style="margin-bottom: 25px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <h3 style="font-size: 0.9rem; color: var(--admin-accent); margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-shield-halved"></i> Seguridad de la Cuenta
                        </h3>
                        
                        <!-- Controles para el usuario actual -->
                        <div id="security-controls-self" style="display: none;">
                            <div class="security-split-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div class="form-group">
                                    <label>Nuevo Correo Electrónico</label>
                                    <div style="display: flex; gap: 8px;">
                                        <input type="email" id="prof-email" placeholder="nuevo@correo.com" style="flex: 1; padding:10px; background:rgba(255,255,255,0.03); border:1px solid var(--admin-border); border-radius:8px; color:white;">
                                        <button type="button" class="btn-admin" id="btn-prof-update-email" style="padding: 0 15px; background: rgba(255,255,255,0.05); border: 1px solid var(--admin-border); color: white;"><i class="fa-solid fa-envelope"></i></button>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Nueva Contraseña</label>
                                    <div style="display: flex; gap: 8px;">
                                        <input type="password" id="prof-password" placeholder="••••••••" style="flex: 1; padding:10px; background:rgba(255,255,255,0.03); border:1px solid var(--admin-border); border-radius:8px; color:white;">
                                        <button type="button" class="btn-admin" id="btn-prof-update-pass" style="padding: 0 15px; background: rgba(255,255,255,0.05); border: 1px solid var(--admin-border); color: white;"><i class="fa-solid fa-lock"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Controles para el Admin editando a otro -->
                        <div id="security-controls-other" style="display: block; background: rgba(114, 176, 77, 0.05); padding: 15px; border-radius: 12px; border: 1px dashed var(--admin-accent);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <p style="color: white; font-weight: 500; margin-bottom: 4px;">Asistencia de Acceso</p>
                                    <p style="font-size: 0.8rem; color: var(--admin-text-muted);">El usuario recibirá un correo para restablecer su propia contraseña.</p>
                                </div>
                                <button type="button" class="btn-admin" @click.prevent="sendResetPasswordEmail" style="background: var(--admin-accent); color: black; border: none; font-weight: 600; padding: 10px 20px;">
                                    <i class="fa-solid fa-paper-plane"></i> Enviar Enlace
                                </button>
                            </div>
                        </div>

                        <p style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 12px; font-style: italic;" id="security-note-admin">Nota: Por seguridad, como administrador solo puedes enviar un enlace de recuperación.</p>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:10px; border-top: 1px solid var(--admin-border); padding-top: 20px;">
                        <button type="button" class="btn btn-secondary" @click="closeAllModals">Cerrar</button>
                        <button type="submit" class="btn btn-primary">Actualizar Perfil</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- MODAL DETALLE DE VOLUNTARIO (VER / EDITAR) -->
    <div v-if="isVolunteerDetailModalOpen" class="modal-overlay">
        <div class="modal-content glass-effect" style="max-width: 650px; width: 90%; max-height: 90vh; overflow-y: auto; text-align: left;">
            <div class="modal-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="header-icon-box" style="background: rgba(114, 176, 77, 0.15); color: #72B04D; width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;"><i class="fa-solid fa-users"></i></div>
                    <div>
                        <h2 style="margin: 0; color: white; font-weight: 700; font-size: 1.2rem;">{{ volunteerFormEditable ? 'Gestión de Voluntario' : 'Perfil del Voluntario' }}</h2>
                        <p style="color: var(--admin-text-muted); font-size: 0.85rem; margin: 2px 0 0 0;">
                            {{ volunteerFormEditable ? 'Edita la información del voluntario.' : 'Información detallada del seguidor.' }}
                        </p>
                    </div>
                </div>
                <button class="close-modal-btn" @click="isVolunteerDetailModalOpen = false" style="background: none; border: none; color: #64748b; font-size: 1.2rem; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            <div class="modal-body" style="padding: 25px;">
                <form @submit.prevent="saveVolunteerProfile">
                    
                    <!-- Avatar & Nombre -->
                    <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 25px; background: rgba(255,255,255,0.02); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                        <img 
                          :src="selectedVolunteer?.avatar_url || '/assets/img/logo-app.webp'" 
                          alt="Avatar" 
                          style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #72B04D;"
                        />
                        <div style="flex: 1;">
                            <div v-if="volunteerFormEditable" style="display: flex; flex-direction: column; gap: 10px;">
                                <div class="form-group" style="margin: 0;">
                                    <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; display: block;">Nombre Completo</label>
                                    <input type="text" v-model="volunteerForm.nombre_completo" required style="width: 100%; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white;">
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; display: block;">Correo Electrónico</label>
                                    <input type="email" v-model="volunteerForm.email" required style="width: 100%; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white;">
                                </div>
                            </div>
                            <div v-else>
                                <h3 style="margin: 0 0 5px 0; color: white; font-weight: 700; font-size: 1.2rem;">{{ volunteerForm.nombre_completo || 'Sin nombre' }}</h3>
                                <p style="margin: 0; color: #64748b; font-size: 0.9rem;">{{ volunteerForm.email || selectedVolunteer?.email || 'N/A' }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Datos de Contacto y Ubicación -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; display: block;">Teléfono</label>
                            <input v-if="volunteerFormEditable" type="text" v-model="volunteerForm.telefono" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white;">
                            <p v-else style="color: white; margin: 5px 0 0 0; font-size: 0.95rem;">
                                <i class="fa-solid fa-phone" style="color: #72B04D; margin-right: 8px;"></i>
                                {{ volunteerForm.telefono || 'No proporcionado' }}
                            </p>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; display: block;">Zona / Alcaldía</label>
                            <input v-if="volunteerFormEditable" type="text" v-model="volunteerForm.zona_preferida" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white;">
                            <p v-else style="color: white; margin: 5px 0 0 0; font-size: 0.95rem;">
                                <i class="fa-solid fa-location-dot" style="color: #72B04D; margin-right: 8px;"></i>
                                {{ volunteerForm.zona_preferida || 'No proporcionada' }}
                            </p>
                        </div>
                    </div>

                    <!-- Bio / Habilidades -->
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; display: block;">Biografía / Presentación</label>
                        <textarea v-if="volunteerFormEditable" v-model="volunteerForm.bio" rows="2" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; resize: vertical; outline: none;"></textarea>
                        <p v-else style="color: #cbd5e1; margin: 5px 0 0 0; font-size: 0.95rem; line-height: 1.4; white-space: pre-wrap;">
                            {{ volunteerForm.bio || 'Sin biografía' }}
                        </p>
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; display: block;">Habilidades que aporta</label>
                        <textarea v-if="volunteerFormEditable" v-model="volunteerForm.habilidades" rows="2" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; resize: vertical; outline: none;"></textarea>
                        <p v-else style="color: #cbd5e1; margin: 5px 0 0 0; font-size: 0.95rem; line-height: 1.4; white-space: pre-wrap;">
                            {{ volunteerForm.habilidades || 'Ninguna descrita' }}
                        </p>
                    </div>

                    <!-- Disponibilidad y Vehículo -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; display: block;">Nivel de Experiencia</label>
                            <select v-if="volunteerFormEditable" v-model="volunteerForm.nivel_experiencia" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; outline: none;">
                                <option value="" disabled hidden>Selecciona experiencia</option>
                                <option value="Principiante">🐦 Colibrí (Principiante / Con ganas de aprender)</option>
                                <option value="Intermedio">🦎 Ajolote (Intermedio / Con alguna experiencia)</option>
                                <option value="Experimentado">🐺 Lobo (Experimentado / Experto en la materia)</option>
                            </select>
                            <p v-else style="color: white; margin: 5px 0 0 0; font-size: 0.95rem;">
                                <i class="fa-solid fa-award" style="color: #72B04D; margin-right: 8px;"></i>
                                {{ 
                                  volunteerForm.nivel_experiencia === 'Principiante' ? '🐦 Colibrí (Principiante / Con ganas de aprender)' :
                                  volunteerForm.nivel_experiencia === 'Intermedio' ? '🦎 Ajolote (Intermedio / Con alguna experiencia)' :
                                  volunteerForm.nivel_experiencia === 'Experimentado' ? '🐺 Lobo (Experimentado / Experto en la materia)' :
                                  volunteerForm.nivel_experiencia || 'No especificado'
                                }}
                            </p>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; display: block;">Disponibilidad</label>
                            <select v-if="volunteerFormEditable" v-model="volunteerForm.disponibilidad" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 8px; color: white; outline: none;">
                                <option value="" disabled hidden>Selecciona disponibilidad</option>
                                <option value="Fines de semana">Fines de semana</option>
                                <option value="Entre semana">Entre semana</option>
                                <option value="Ambas">Fines de semana y Entre semana</option>
                                <option value="Tiempo completo">Tiempo completo</option>
                            </select>
                            <p v-else style="color: white; margin: 5px 0 0 0; font-size: 0.95rem;">
                                <i class="fa-solid fa-calendar-days" style="color: #72B04D; margin-right: 8px;"></i>
                                {{ volunteerForm.disponibilidad || 'No especificada' }}
                            </p>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 25px;">
                        <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; display: block;">¿Cuenta con vehículo propio?</label>
                        <div v-if="volunteerFormEditable" style="margin-top: 8px;">
                            <label class="switch-toggle">
                                <input type="checkbox" v-model="volunteerForm.tiene_vehiculo" />
                                <span class="slider-toggle-round"></span>
                            </label>
                        </div>
                        <p v-else style="color: white; margin: 5px 0 0 0; font-size: 0.95rem;">
                            <i :class="volunteerForm.tiene_vehiculo ? 'fa-solid fa-circle-check text-success' : 'fa-solid fa-circle-xmark text-danger'" style="margin-right: 8px;"></i>
                            {{ volunteerForm.tiene_vehiculo ? 'Sí cuenta con vehículo' : 'No cuenta con vehículo' }}
                        </p>
                    </div>

                    <!-- Causas de Interés -->
                    <div class="form-group" style="margin-bottom: 25px;">
                        <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; display: block;">Causas de interés ambiental</label>
                        <div v-if="volunteerFormEditable" class="causes-chips-grid" style="grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; margin-top: 10px;">
                            <button
                              type="button"
                              v-for="causa in CAUSAS_OPTIONS"
                              :key="causa.id"
                              class="cause-chip-btn"
                              :class="{ 'active': volunteerForm.causas_interes.includes(causa.id) }"
                              @click="() => {
                                if (volunteerForm.causas_interes.includes(causa.id)) {
                                  volunteerForm.causas_interes = volunteerForm.causas_interes.filter(id => id !== causa.id)
                                } else {
                                  volunteerForm.causas_interes = [...volunteerForm.causas_interes, causa.id]
                                }
                              }"
                              style="padding: 8px 12px; font-size: 0.85rem;"
                            >
                              <span class="cause-emoji">{{ causa.emoji }}</span>
                              <span class="cause-label">{{ causa.label }}</span>
                              <i class="fa-solid fa-circle-check check-indicator"></i>
                            </button>
                        </div>
                        <div v-else style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                            <span 
                              v-for="causaId in volunteerForm.causas_interes" 
                              :key="causaId" 
                              style="background: rgba(114, 176, 77, 0.12); border: 1px solid #72B04D; color: white; padding: 5px 12px; border-radius: 12px; font-size: 0.85rem;"
                            >
                              {{ CAUSAS_OPTIONS.find(c => c.id === causaId)?.emoji || '🌱' }}
                              {{ CAUSAS_OPTIONS.find(c => c.id === causaId)?.label || causaId }}
                            </span>
                            <span v-if="!volunteerForm.causas_interes || volunteerForm.causas_interes.length === 0" style="color: var(--admin-text-muted); font-size: 0.9rem; font-style: italic;">Ninguna seleccionada</span>
                        </div>
                    </div>

                    <!-- Redes Sociales -->
                    <div class="form-group" style="margin-bottom: 25px;">
                        <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; display: block;">Redes Sociales</label>
                        <div v-if="volunteerFormEditable">
                            <div v-for="net in SOCIAL_NETWORKS" :key="net.id" class="form-group" style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
                                <span style="width: 100px; font-size: 0.85rem; color: #cbd5e1; display: inline-flex; align-items: center; gap: 6px;">
                                    <i :class="net.icon" style="color: #72B04D;"></i> {{ net.name }}
                                </span>
                                <input type="url" v-model="volunteerForm.links_sociales[net.id]" :placeholder="net.placeholder" style="flex: 1; padding: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--admin-border); border-radius: 6px; color: white; font-size: 0.9rem; outline: none;">
                            </div>
                        </div>
                        <div v-else style="display: flex; gap: 15px; margin-top: 8px; font-size: 1.3rem;">
                            <template v-for="net in SOCIAL_NETWORKS" :key="net.id">
                                <a 
                                  v-if="volunteerForm.links_sociales?.[net.id]"
                                  :href="volunteerForm.links_sociales?.[net.id] || '#'" 
                                  target="_blank" 
                                  :title="net.name"
                                  style="color: #72B04D; transition: color 0.2s;"
                                >
                                    <i :class="net.icon"></i>
                                </a>
                            </template>
                            <span v-if="!volunteerForm.links_sociales || Object.keys(volunteerForm.links_sociales || {}).length === 0" style="color: var(--admin-text-muted); font-size: 0.9rem; font-style: italic;">Sin redes sociales</span>
                        </div>
                    </div>

                    <!-- SECCIÓN DE SEGURIDAD EN MODAL VOLUNTARIO -->
                    <div v-if="isUserAdmin" class="form-section security-section-admin" style="margin-bottom: 25px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <h3 style="font-size: 0.95rem; color: var(--admin-accent); margin-bottom: 15px; display: flex; align-items: center; gap: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                            <i class="fa-solid fa-shield-halved" style="color: #72B04D;"></i> Seguridad de la Cuenta
                        </h3>
                        
                        <div style="background: rgba(114, 176, 77, 0.05); padding: 15px; border-radius: 12px; border: 1px dashed var(--admin-accent);">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px; flex-wrap: wrap;">
                                <div>
                                    <p style="color: white; font-weight: 500; margin: 0 0 4px 0; font-size: 0.9rem;">Asistencia de Acceso</p>
                                    <p style="font-size: 0.8rem; color: var(--admin-text-muted); margin: 0;">El voluntario recibirá un correo para restablecer su propia contraseña.</p>
                                </div>
                                <button type="button" class="btn-admin" @click.prevent="sendResetPasswordEmailForVolunteer" style="background: #72B04D; color: white; border: none; font-weight: 600; padding: 10px 20px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                    <i class="fa-solid fa-paper-plane"></i> Enviar Enlace
                                </button>
                            </div>
                        </div>
                        <p style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 12px; font-style: italic;">Nota: Por seguridad, como administrador solo puedes enviar un enlace de recuperación de contraseña.</p>
                    </div>

                    <!-- Actions -->
                    <div style="display:flex; justify-content:flex-end; gap:10px; border-top: 1px solid var(--admin-border); padding-top: 20px; margin-top: 25px;">
                        <button type="button" class="btn btn-secondary" @click="isVolunteerDetailModalOpen = false">Cerrar</button>
                        <button v-if="volunteerFormEditable" type="submit" class="btn btn-primary" :disabled="volunteerFormSaving" style="background: #72B04D; color: white; border: none; font-weight: 700;">
                            <i class="fa-solid fa-floppy-disk"></i> {{ volunteerFormSaving ? 'Guardando...' : 'Guardar Cambios' }}
                        </button>
                    </div>

                </form>
            </div>
        </div>
      </div>
  </div>
</template>

<style>
@import '../assets/css/admin.css';

/* Fix dropdown background color in select element */
select option {
  background-color: #0b0f19 !important;
  color: white !important;
}

.role-badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}
.role-badge.admin {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.role-badge.actor {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}
.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
}
.status-badge.approved {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}
.status-badge.pending {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}
.status-badge.rejected {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}
.tab-btn {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  color: #94a3b8;
  padding: 8px 18px;
  border-radius: 30px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}
.tab-btn.active {
  background: var(--color-eco);
  color: black;
  border-color: var(--color-eco);
}
.action-btn {
  background: rgba(255,255,255,0.05);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.action-btn:hover {
  transform: scale(1.1);
}
.action-btn.btn-success {
  background: #10b981;
  color: white;
}
.action-btn.btn-danger {
  background: #ef4444;
  color: white;
}
.action-btn.btn-edit {
  background: #0ea5e9;
  color: white;
}
.action-btn.btn-warning {
  background: #f59e0b;
  color: black;
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(10px);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.admin-modal {
  background: #0f172a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24px;
  padding: 30px;
  width: 90%;
  max-width: 700px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 15px;
  margin-bottom: 20px;
}
.modal-header h3 {
  color: white;
  margin: 0;
  font-weight: 800;
  font-size: 1.3rem;
}
.close-modal-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.8rem;
  cursor: pointer;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-group label {
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
}
.form-group input, .form-group select, .form-group textarea {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 10px 14px;
  color: white;
  font-family: inherit;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.3s;
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus {
  border-color: var(--color-eco);
  background: rgba(255,255,255,0.05);
}

/* Social Selector Styles */
.social-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--admin-border);
  border-radius: 12px;
  align-items: center;
  justify-content: center;
}
.social-btn {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: white;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}
.social-btn:hover {
  transform: scale(1.1);
  background: rgba(255, 255, 255, 0.1);
}
.social-btn.active {
  color: white;
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.15);
}
.social-btn.facebook.active { background: #1877F2; border-color: #1877F2; }
.social-btn.instagram.active { background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); border-color: transparent; }
.social-btn.whatsapp.active { background: #25D366; border-color: #25D366; }
.social-btn.x-twitter.active { background: #000000; border-color: #333; }
.social-btn.youtube.active { background: #FF0000; border-color: #FF0000; }
.social-btn.web.active { background: #10b981; border-color: #10b981; }

.social-inputs-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
  width: 100%;
}
.social-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}
.social-input-group label {
  font-size: 1.2rem;
  width: 32px;
  text-align: center;
  margin: 0 !important;
}
.social-input-group input {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px 12px;
  color: white;
  outline: none;
  font-size: 0.9rem;
}
.social-input-group input:focus {
  border-color: var(--color-eco);
}
</style>
