<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'
import { useValidation } from '../composables/useValidation'
import { EventoSchema, LugarSchema } from '../schemas'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

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

// State
const activeTab = ref('dashboard')
const selectedHub = ref<'colibri' | 'ajolote' | 'lobo' | null>(null)
const selectedSection = ref<string | null>(null)
const moderationFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>('all')

const stats = ref({
  actores: 0,
  voluntarios: 0,
  eventos: 0,
  lugares: 0
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
const isNotifReviewModalOpen = ref(false)

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
  meta: {}
})

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
  puede_editar_normativa: false,
  puede_editar_fondos: false
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
  twitter: '',
  linkedin: ''
})
const profileSaving = ref(false)
const avatarFile = ref<File | null>(null)
const avatarUploading = ref(false)

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
      { id: 'convocatoria', label: 'Convocatorias', icon: 'fa-solid fa-bullhorn' }
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
    actorFunctions.value = funcPerms
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
  fetchListData()
}

// Load List data based on selection
const fetchListData = async () => {
  if (!selectedSection.value) return
  loadingList.value = true
  listError.value = ''
  listItems.value = []

  try {
    let query: any
    if (selectedSection.value === 'eventos') {
      query = supabase.from('eventos').select('*')
    } else if (selectedSection.value === 'lugares') {
      query = supabase.from('lugares').select('*')
    } else {
      query = supabase.from('contenido_secciones').select('*').eq('seccion_id', selectedSection.value)
    }

    // Role constraints
    if (isUserActor.value && authStore.user) {
      query = query.eq('owner_id', authStore.user.id)
    }

    // Moderation status constraints
    if (moderationFilter.value !== 'all') {
      query = query.eq('estado', moderationFilter.value)
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

// Stats and global metrics
const fetchGlobalStats = async () => {
  try {
    const { count: actCount } = await supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'actor')
    const { count: volCount } = await supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'user')
    const { count: evCount } = await supabase.from('eventos').select('*', { count: 'exact', head: true })
    const { count: plCount } = await supabase.from('lugares').select('*', { count: 'exact', head: true })

    stats.value = {
      actores: actCount || 0,
      voluntarios: volCount || 0,
      eventos: evCount || 0,
      lugares: plCount || 0
    }
  } catch (e) {
    console.error('Error loading statistics:', e)
  }
}

// User loading / lists in admin view
const staffList = ref<any[]>([])
const loadStaffList = async () => {
  if (!isUserAdmin.value) return
  const { data } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, email, rol, created_at')
    .in('rol', ['admin', 'actor'])
    .order('created_at', { ascending: false })
  
  if (data) staffList.value = data
}

// Edit actions
const openAddModal = () => {
  eventErrors.value = {}
  placeErrors.value = {}
  // Initial reset of values
  editingItem.value = {
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
    meta: {}
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
  eventErrors.value = {}
  placeErrors.value = {}
  // Load data for editing
  editingItem.value = { ...item }

  if (selectedSection.value === 'eventos') {
    editingItem.value.fecha_inicio = item.fecha_inicio ? item.fecha_inicio.substring(0, 16) : ''
    editingItem.value.fecha_fin = item.fecha_fin ? item.fecha_fin.substring(0, 16) : ''
    isEventModalOpen.value = true
  } else if (selectedSection.value === 'lugares') {
    isPlaceModalOpen.value = true
  } else {
    // Parse meta fields from description JSON
    let descTxt = item.descripcion || ''
    let metaFields = {}
    try {
      if (descTxt.trim().startsWith('{')) {
        const parsed = JSON.parse(descTxt)
        metaFields = parsed
        descTxt = parsed.descripcion_texto || ''
      }
    } catch (e) {
      // Ignored
    }
    editingItem.value.descripcion_texto = descTxt
    editingItem.value.meta = metaFields
    isContentModalOpen.value = true
  }
}

const saveItem = async () => {
  if (!selectedSection.value || !authStore.user) return

  eventErrors.value = {}
  placeErrors.value = {}

  try {
    const isEditing = editingItem.value.id !== null
    let dbPayload: any = {}

    if (selectedSection.value === 'eventos') {
      const eventData = {
        nombre: editingItem.value.nombre,
        descripcion: editingItem.value.descripcion,
        categoria: editingItem.value.categoria,
        ubicacion: editingItem.value.ubicacion,
        lat: Number(editingItem.value.lat),
        lng: Number(editingItem.value.lng),
        es_gratuito: editingItem.value.es_gratuito,
        pet_friendly: editingItem.value.pet_friendly,
        apto_ninos: editingItem.value.apto_ninos,
        fecha_inicio: formatToISO(editingItem.value.fecha_inicio),
        fecha_fin: formatToISO(editingItem.value.fecha_fin)
      }

      const { valid, errors } = validateForm(EventoSchema, eventData)
      if (!valid) {
        eventErrors.value = errors
        return
      }

      dbPayload = {
        ...eventData,
        imagen: editingItem.value.imagen,
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

      const { valid, errors } = validateForm(LugarSchema, placeData)
      if (!valid) {
        placeErrors.value = errors
        return
      }

      dbPayload = {
        ...placeData,
        imagen: editingItem.value.imagen,
        estado: isEditing ? editingItem.value.estado : (isUserAdmin.value ? 'approved' : 'pending')
      }
    } else {
      // Dynamic Section Contents
      const fullDesc = JSON.stringify({
        ...editingItem.value.meta,
        descripcion_texto: editingItem.value.descripcion_texto
      })
      dbPayload = {
        seccion_id: selectedSection.value,
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

    let error: any
    if (selectedSection.value === 'eventos') {
      if (isEditing) {
        const { error: e } = await supabase.from('eventos').update(dbPayload).eq('id', editingItem.value.id)
        error = e
      } else {
        const { error: e } = await supabase.from('eventos').insert(dbPayload)
        error = e
      }
    } else if (selectedSection.value === 'lugares') {
      if (isEditing) {
        const { error: e } = await supabase.from('lugares').update(dbPayload).eq('id', editingItem.value.id)
        error = e
      } else {
        const { error: e } = await supabase.from('lugares').insert(dbPayload)
        error = e
      }
    } else {
      if (isEditing) {
        const { error: e } = await supabase.from('contenido_secciones').update(dbPayload).eq('id', editingItem.value.id)
        error = e
      } else {
        const { error: e } = await supabase.from('contenido_secciones').insert(dbPayload)
        error = e
      }
    }

    if (error) throw error

    alert('Registro guardado correctamente.')
    closeAllModals()
    fetchListData()
  } catch (e: any) {
    console.error('Error saving:', e)
    alert('Error al guardar el registro: ' + e.message)
  }
}

const deleteItem = async (item: any) => {
  if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return
  try {
    let error: any
    if (selectedSection.value === 'eventos') {
      const { error: e } = await supabase.from('eventos').delete().eq('id', item.id)
      error = e
    } else if (selectedSection.value === 'lugares') {
      const { error: e } = await supabase.from('lugares').delete().eq('id', item.id)
      error = e
    } else {
      const { error: e } = await supabase.from('contenido_secciones').delete().eq('id', item.id)
      error = e
    }

    if (error) throw error
    alert('Registro eliminado.')
    fetchListData()
  } catch (e: any) {
    alert('Error al eliminar: ' + e.message)
  }
}

// Moderation approval/rejection actions (Admin only)
const updateModerationStatus = async (item: any, newStatus: 'approved' | 'rejected') => {
  try {
    let error: any
    const payload = { estado: newStatus }

    if (selectedSection.value === 'eventos') {
      const { error: e } = await supabase.from('eventos').update(payload).eq('id', item.id)
      error = e
    } else if (selectedSection.value === 'lugares') {
      const { error: e } = await supabase.from('lugares').update(payload).eq('id', item.id)
      error = e
    } else {
      const { error: e } = await supabase.from('contenido_secciones').update(payload).eq('id', item.id)
      error = e
    }

    if (error) throw error
    
    // Optionally trigger revision notifications as in Vanilla JS
    await enviarNotificacionRevision(item.owner_id, selectedSection.value || 'contenido', newStatus)

    alert(`Estado actualizado a: ${newStatus === 'approved' ? 'Aprobado' : 'Rechazado'}`)
    fetchListData()
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
      puede_gestionar_slider: funcData.puede_gestionar_slider
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
        if (['voluntariados', 'convocatoria'].includes(secId)) hub = 'ajolote'
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
      visible_en_directorio: actorFuncPermissions.value.visible_en_directorio,
      puede_gestionar_slider: actorFuncPermissions.value.puede_gestionar_slider
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
    twitter: p.links_sociales?.twitter || '',
    linkedin: p.links_sociales?.linkedin || ''
  }
}

const saveProfile = async () => {
  if (!authStore.user) return
  profileSaving.value = true
  try {
    const payload = {
      nombre_completo: profileForm.value.nombre_completo,
      bio: profileForm.value.bio,
      telefono: profileForm.value.telefono,
      links_sociales: {
        facebook: profileForm.value.facebook,
        instagram: profileForm.value.instagram,
        twitter: profileForm.value.twitter,
        linkedin: profileForm.value.linkedin
      }
    }

    const { error } = await supabase.from('perfiles').update(payload).eq('id', authStore.user.id)
    if (error) throw error
    alert('Perfil actualizado correctamente.')
    await authStore.init() // Reload session profile details
  } catch (e: any) {
    alert('Error al actualizar perfil: ' + e.message)
  } finally {
    profileSaving.value = false
  }
}

// Image compression and upload helpers
const compressAndUploadFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1200
        const MAX_HEIGHT = 800
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error('No se pudo comprimir la imagen'))
            return
          }
          try {
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`
            const { error } = await supabase.storage
              .from('imagenes-plataforma')
              .upload(fileName, blob, { contentType: 'image/webp' })
            
            if (error) throw error
            
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/imagenes-plataforma/${fileName}`
            resolve(publicUrl)
          } catch (e) {
            reject(e)
          }
        }, 'image/webp', 0.7)
      }
    }
  })
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
    await authStore.init() // Reload profile
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
    loadStaffList()
  } else if (view === 'notificaciones') {
    fetchNotifHistory()
  } else if (view === 'slider') {
    fetchSlides()
  } else if (view === 'perfil') {
    loadProfileForm()
  } else if (view === 'dashboard') {
    fetchGlobalStats()
  }
}

// Close modals
const closeAllModals = () => {
  isEventModalOpen.value = false
  isPlaceModalOpen.value = false
  isContentModalOpen.value = false
  isPermissionsModalOpen.value = false
  isSliderModalOpen.value = false
  eventErrors.value = {}
  placeErrors.value = {}
}

// Handle query parameter deep linking
const checkQueryParams = () => {
  const action = route.query.action
  const section = route.query.section as string
  const hub = route.query.hub as 'colibri' | 'ajolote' | 'lobo'

  if (action === 'new' && section && hub) {
    showHubMenu(hub)
    selectSection(section)
    setTimeout(() => openAddModal(), 300)
  }
}

onMounted(async () => {
  if (authStore.loading) {
    await authStore.init()
  }
  await fetchActorPermissions()
  await fetchGlobalStats()
  loadProfileForm()
  checkQueryParams()
})

// Formatting helper
const formatRelativeDate = (dateStr: string) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div class="admin-body">
    <!-- LAYOUT PRINCIPAL -->
    <div class="admin-main-wrapper" id="admin-main-wrapper">
      
      <!-- MENU SIDEBAR -->
      <aside 
        class="admin-sidebar" 
        :class="{ 'collapsed': isSidebarCollapsed, 'active': isMobileSidebarActive }"
        id="admin-sidebar"
      >
        <div class="profile-section">
          <div 
            class="profile-avatar" 
            id="sidebar-avatar"
            :style="authStore.profile?.avatar_url ? `background-image: url(${authStore.profile.avatar_url}); background-size: cover; background-position: center; border: none;` : ''"
          >
            <span v-if="!authStore.profile?.avatar_url">
              {{ (authStore.profile?.nombre_completo || 'U').charAt(0).toUpperCase() }}
            </span>
          </div>
          <div class="profile-info" v-if="!isSidebarCollapsed">
            <h4 id="sidebar-user-name" style="margin-bottom:4px; font-weight:700;">{{ authStore.profile?.nombre_completo || 'Administrador' }}</h4>
            <span 
              id="sidebar-user-role" 
              class="profile-role-badge"
              :class="authStore.profile?.rol"
            >
              ● {{ isUserAdmin ? 'Administrador' : 'Actor' }}
            </span>
          </div>
        </div>

        <nav class="admin-menu">
          <ul>
            <li :class="{ 'active': activeTab === 'dashboard' }">
              <a href="#" @click.prevent="navigateTo('dashboard')">
                <i class="fa-solid fa-chart-line" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Dashboard</span>
              </a>
            </li>

            <!-- ADMIN ONLY - PLATFORM MANAGEMENT -->
            <template v-if="isUserAdmin">
              <li class="menu-category" v-if="!isSidebarCollapsed">Gestión Plataforma</li>
              <li :class="{ 'active': activeTab === 'usuarios' }">
                <a href="#" @click.prevent="navigateTo('usuarios')">
                  <i class="fa-solid fa-users-gear" style="margin-right:10px;"></i>
                  <span v-if="!isSidebarCollapsed">Actores / Staff</span>
                </a>
              </li>
            </template>

            <!-- SHARED CONTENTS SECTION -->
            <li class="menu-category" v-if="!isSidebarCollapsed">Contenidos</li>
            
            <li 
              v-if="isUserAdmin || actorFunctions.puede_crear_eventos" 
              :class="{ 'active': selectedSection === 'eventos' }"
            >
              <a href="#" @click.prevent="selectSection('eventos')">
                <i class="fa-solid fa-calendar-days" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">{{ isUserAdmin ? 'Eventos' : 'Mis Eventos' }}</span>
              </a>
            </li>

            <li 
              v-if="isUserAdmin || actorFunctions.puede_crear_lugares" 
              :class="{ 'active': selectedSection === 'lugares' }"
            >
              <a href="#" @click.prevent="selectSection('lugares')">
                <i class="fa-solid fa-map-pin" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">{{ isUserAdmin ? 'Lugares' : 'Mis Lugares' }}</span>
              </a>
            </li>

            <!-- HUBS & SECTIONS -->
            <li class="menu-category" v-if="!isSidebarCollapsed">Hubs y Secciones</li>
            
            <li 
              v-if="isUserAdmin || actorSections.some(s => hubsConfig.colibri.sections.map(x => x.id).includes(s))" 
              :class="{ 'active': activeTab === 'colibri' }"
            >
              <a href="#" @click.prevent="showHubMenu('colibri')">
                <i class="fa-solid fa-dove" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Hub Colibrí</span>
              </a>
            </li>

            <li 
              v-if="isUserAdmin || actorSections.some(s => hubsConfig.ajolote.sections.map(x => x.id).includes(s))" 
              :class="{ 'active': activeTab === 'ajolote' }"
            >
              <a href="#" @click.prevent="showHubMenu('ajolote')">
                <i class="fa-solid fa-frog" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Hub Ajolote</span>
              </a>
            </li>

            <li 
              v-if="isUserAdmin || actorSections.some(s => hubsConfig.lobo.sections.map(x => x.id).includes(s))" 
              :class="{ 'active': activeTab === 'lobo' }"
            >
              <a href="#" @click.prevent="showHubMenu('lobo')">
                <i class="fa-solid fa-dog" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Hub Lobo</span>
              </a>
            </li>

            <!-- SETTINGS -->
            <li class="menu-category" v-if="!isSidebarCollapsed">Ajustes</li>
            
            <li :class="{ 'active': activeTab === 'perfil' }">
              <a href="#" @click.prevent="navigateTo('perfil')">
                <i class="fa-solid fa-user-gear" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Mi Perfil</span>
              </a>
            </li>

            <li 
              v-if="isUserAdmin || actorFunctions.puede_enviar_notificaciones" 
              :class="{ 'active': activeTab === 'notificaciones' }"
            >
              <a href="#" @click.prevent="navigateTo('notificaciones')">
                <i class="fa-solid fa-bell" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Notificaciones</span>
              </a>
            </li>

            <li 
              v-if="isUserAdmin || actorFunctions.puede_gestionar_slider" 
              :class="{ 'active': activeTab === 'slider' }"
            >
              <a href="#" @click.prevent="navigateTo('slider')">
                <i class="fa-solid fa-images" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Slider Principal</span>
              </a>
            </li>

            <li class="menu-divider"></li>
            <li>
              <RouterLink to="/">
                <i class="fa-solid fa-house" style="margin-right:10px;"></i>
                <span v-if="!isSidebarCollapsed">Ir al Portal</span>
              </RouterLink>
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

      <!-- MAIN CONTAINER -->
      <main class="admin-content-area">
        
        <!-- HEADER TOP -->
        <header class="admin-top-header">
          <button class="mobile-sidebar-toggle" @click="isMobileSidebarActive = true">
            <i class="fa-solid fa-bars"></i>
          </button>
          
          <button class="desktop-sidebar-toggle" @click="isSidebarCollapsed = !isSidebarCollapsed">
            <i :class="isSidebarCollapsed ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left'"></i>
          </button>

          <div class="header-titles">
            <h1 style="color:white; font-size:1.8rem; font-weight:800; text-transform:uppercase;">
              {{ activeTab === 'dashboard' ? 'Panel de Administración' : activeTab.toUpperCase() }}
            </h1>
            <p class="admin-subtitle">EcoGuía SOS — Gestión Unificada</p>
          </div>
        </header>

        <!-- VIEWS CONTENT SWITCH -->

        <!-- 1. DASHBOARD VIEW -->
        <div v-if="activeTab === 'dashboard'" class="dashboard-wrapper">
          <div class="stats-grid" id="dashboard-stats">
            <div class="stat-card fade-in" v-if="isUserAdmin">
              <i class="fa-solid fa-users-gear stat-icon" style="color: #6a00a8;"></i>
              <div class="stat-info">
                <h3>{{ stats.actores }}</h3>
                <p>Actores / Staff</p>
              </div>
            </div>
            
            <div class="stat-card fade-in" v-if="isUserAdmin">
              <i class="fa-solid fa-users stat-icon" style="color: #0077b6;"></i>
              <div class="stat-info">
                <h3>{{ stats.voluntarios }}</h3>
                <p>Voluntarios Registrados</p>
              </div>
            </div>

            <div class="stat-card fade-in">
              <i class="fa-solid fa-calendar-days stat-icon" style="color: #72b04d;"></i>
              <div class="stat-info">
                <h3>{{ stats.eventos }}</h3>
                <p>Eventos Activos</p>
              </div>
            </div>

            <div class="stat-card fade-in">
              <i class="fa-solid fa-map-pin stat-icon" style="color: #e74c3c;"></i>
              <div class="stat-info">
                <h3>{{ stats.lugares }}</h3>
                <p>Lugares Sustentables</p>
              </div>
            </div>
          </div>

          <div class="welcome-box glass-effect" style="margin-top: 30px; padding: 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); background: rgba(15,22,30,0.6);">
            <h2 style="color: white; margin-bottom: 10px; font-weight:800;">Hola, {{ authStore.profile?.nombre_completo }}</h2>
            <p style="color: #cbd5e1; font-size: 1.05rem; line-height: 1.6; max-width: 700px;">
              Desde este panel puedes proponer y coordinar actividades sustentables, subir recursos educativos, autorizar solicitudes y mandar alertas a toda la comunidad de EcoGuía SOS.
            </p>
          </div>
        </div>

        <!-- 2. HUB VIEW -->
        <div v-else-if="['colibri', 'ajolote', 'lobo'].includes(activeTab) && selectedHub" class="hub-menu-view">
          <div class="hub-menu-grid">
            <template v-for="sec in hubsConfig[selectedHub].sections" :key="sec.id">
              <div 
                v-if="isUserAdmin || actorSections.includes(sec.id)"
                class="hub-card glass-effect"
                @click="selectSection(sec.id)"
                style="cursor: pointer; padding: 25px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); text-align: center; transition: all 0.3s ease;"
              >
                <i :class="sec.icon" style="font-size: 2.5rem; color: var(--color-eco); margin-bottom: 15px; display: inline-block;"></i>
                <h3 style="color: white; font-size: 1.25rem; font-weight:700; margin: 0;">{{ sec.label }}</h3>
              </div>
            </template>
          </div>
        </div>

        <!-- 3. TABLE / SECTION CONTENTS MODERATION VIEW -->
        <div v-else-if="activeTab === 'tabla-seccion'" class="table-view-container">
          <div class="table-header-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
            <h2 style="color: white; font-weight: 800; font-size: 1.4rem; margin:0;">
              Sección: {{ selectedSection?.toUpperCase() }}
            </h2>
            <button class="btn btn-primary" @click="openAddModal" style="border-radius: 12px; font-weight:700;">
              <i class="fa-solid fa-circle-plus"></i> Agregar Nuevo
            </button>
          </div>

          <!-- Tabs for Moderation -->
          <div class="moderation-tabs-row" style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button 
              class="tab-btn" 
              :class="{ 'active': moderationFilter === 'all' }" 
              @click="moderationFilter = 'all'"
            >
              Todos
            </button>
            <button 
              class="tab-btn" 
              :class="{ 'active': moderationFilter === 'approved' }" 
              @click="moderationFilter = 'approved'"
            >
              Aprobados
            </button>
            <button 
              class="tab-btn" 
              :class="{ 'active': moderationFilter === 'pending' }" 
              @click="moderationFilter = 'pending'"
            >
              Pendientes
            </button>
            <button 
              class="tab-btn" 
              :class="{ 'active': moderationFilter === 'rejected' }" 
              @click="moderationFilter = 'rejected'"
            >
              Rechazados
            </button>
          </div>

          <div v-if="loadingList" class="loading-state" style="padding: 50px; text-align: center; color: white;">
            <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
          </div>
          <div v-else-if="listItems.length === 0" class="empty-state" style="padding: 50px; text-align: center; background: rgba(255,255,255,0.01); border-radius: 16px; color: var(--text-muted);">
            No hay registros para mostrar.
          </div>
          <div v-else class="table-responsive glass-effect" style="border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden;">
            <table class="admin-data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <th style="padding: 15px 20px; color: white;">Título / Nombre</th>
                  <th style="padding: 15px 20px; color: white;">Categoría</th>
                  <th style="padding: 15px 20px; color: white;">Fecha Creación</th>
                  <th style="padding: 15px 20px; color: white;">Estado</th>
                  <th style="padding: 15px 20px; color: white; text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in listItems" :key="item.id" style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                  <td style="padding: 15px 20px; color: #f8fafc; font-weight:600;">
                    {{ item.nombre || item.titulo }}
                  </td>
                  <td style="padding: 15px 20px; color: #94a3b8;">
                    {{ item.categoria || 'General' }}
                  </td>
                  <td style="padding: 15px 20px; color: #94a3b8;">
                    {{ formatRelativeDate(item.created_at) }}
                  </td>
                  <td style="padding: 15px 20px;">
                    <span 
                      class="status-badge"
                      :class="item.estado"
                    >
                      {{ item.estado }}
                    </span>
                  </td>
                  <td style="padding: 15px 20px; text-align: right;">
                    <div style="display: inline-flex; gap: 8px;">
                      <!-- Approve/Reject buttons for admin -->
                      <template v-if="isUserAdmin && item.estado === 'pending'">
                        <button class="action-btn btn-success" @click="updateModerationStatus(item, 'approved')" title="Aprobar">
                          <i class="fa-solid fa-check"></i>
                        </button>
                        <button class="action-btn btn-danger" @click="updateModerationStatus(item, 'rejected')" title="Rechazar">
                          <i class="fa-solid fa-xmark"></i>
                        </button>
                      </template>
                      
                      <button class="action-btn btn-edit" @click="openEditModal(item)" title="Editar">
                        <i class="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button class="action-btn btn-danger" @click="deleteItem(item)" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 4. STAFF / ACTORS MANAGEMENT VIEW (Admin only) -->
        <div v-else-if="activeTab === 'usuarios'" class="staff-view-container">
          <h2 style="color: white; font-weight: 800; font-size: 1.4rem; margin-bottom: 20px;">Gestión de Actores y Staff</h2>
          <div class="table-responsive glass-effect" style="border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden;">
            <table class="admin-data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <th style="padding: 15px 20px; color: white;">Nombre</th>
                  <th style="padding: 15px 20px; color: white;">Email</th>
                  <th style="padding: 15px 20px; color: white;">Rol</th>
                  <th style="padding: 15px 20px; color: white; text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="actor in staffList" :key="actor.id" style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                  <td style="padding: 15px 20px; color: white; font-weight:600;">{{ actor.nombre_completo }}</td>
                  <td style="padding: 15px 20px; color: #94a3b8;">{{ actor.email || 'N/A' }}</td>
                  <td style="padding: 15px 20px;">
                    <span class="role-badge" :class="actor.rol">{{ actor.rol }}</span>
                  </td>
                  <td style="padding: 15px 20px; text-align: right;">
                    <!-- Key icon (🔑) for managing actor permissions -->
                    <button 
                      v-if="actor.rol === 'actor'" 
                      class="action-btn btn-warning" 
                      @click="openPermissionsModal(actor)"
                      title="Gestionar Permisos"
                    >
                      <i class="fa-solid fa-key"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 5. PROFILE EDIT VIEW -->
        <div v-else-if="activeTab === 'perfil'" class="profile-view-container glass-effect" style="padding: 30px; border-radius: 20px;">
          <h2 style="color: white; font-weight: 800; font-size: 1.4rem; margin-bottom: 30px;">Mi Perfil de Autor</h2>
          
          <div class="profile-edit-grid" style="display: grid; grid-template-columns: 200px 1fr; gap: 30px;">
            <div class="profile-avatar-upload" style="text-align: center;">
              <div 
                class="avatar-preview" 
                style="width: 150px; height: 150px; border-radius: 50%; overflow: hidden; margin: 0 auto 15px auto; border: 3px solid rgba(114, 176, 77, 0.4); display: flex; align-items: center; justify-content: center; background: #0f172a;"
                :style="authStore.profile?.avatar_url ? `background-image: url(${authStore.profile.avatar_url}); background-size: cover; background-position: center;` : ''"
              >
                <i v-if="!authStore.profile?.avatar_url" class="fa-solid fa-user" style="font-size: 4rem; color: #475569;"></i>
              </div>
              <label class="btn btn-secondary" style="border-radius: 30px; font-weight:600; cursor: pointer; display: inline-block;">
                <i class="fa-solid fa-camera"></i> Subir Avatar
                <input type="file" @change="handleAvatarUpload" style="display: none;" accept="image/*" />
              </label>
              <p v-if="avatarUploading" style="color: #0ea5e9; font-size:0.8rem; margin-top:8px;">Subiendo...</p>
            </div>

            <form @submit.prevent="saveProfile" style="display: flex; flex-direction: column; gap: 15px;">
              <div class="form-group">
                <label>Nombre Completo</label>
                <input type="text" v-model="profileForm.nombre_completo" required style="width: 100%;" />
              </div>
              <div class="form-group">
                <label>Biografía / Misión</label>
                <textarea v-model="profileForm.bio" rows="4" style="width: 100%;"></textarea>
              </div>
              <div class="form-group">
                <label>Teléfono</label>
                <input type="text" v-model="profileForm.telefono" style="width: 100%;" />
              </div>
              
              <h3 style="color: white; margin-top: 15px; font-weight: 700; font-size:1.1rem;">Redes Sociales</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                  <label><i class="fa-brands fa-facebook"></i> Facebook URL</label>
                  <input type="url" v-model="profileForm.facebook" style="width: 100%;" />
                </div>
                <div class="form-group">
                  <label><i class="fa-brands fa-instagram"></i> Instagram URL</label>
                  <input type="url" v-model="profileForm.instagram" style="width: 100%;" />
                </div>
                <div class="form-group">
                  <label><i class="fa-brands fa-twitter"></i> Twitter / X URL</label>
                  <input type="url" v-model="profileForm.twitter" style="width: 100%;" />
                </div>
                <div class="form-group">
                  <label><i class="fa-brands fa-linkedin"></i> LinkedIn URL</label>
                  <input type="url" v-model="profileForm.linkedin" style="width: 100%;" />
                </div>
              </div>

              <button 
                type="submit" 
                class="btn btn-primary" 
                style="margin-top: 20px; align-self: flex-start; border-radius: 12px; font-weight:700;"
                :disabled="profileSaving"
              >
                {{ profileSaving ? 'Guardando...' : 'Guardar Cambios' }}
              </button>
            </form>
          </div>
        </div>

        <!-- 6. NOTIFICATIONS VIEW -->
        <div v-else-if="activeTab === 'notificaciones'" class="notif-view-container" style="display: grid; grid-template-columns: 1fr 350px; gap: 30px;">
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

      </main>
    </div>

    <!-- MODAL REGISTRO: EVENTO -->
    <div v-if="isEventModalOpen" class="modal-overlay">
      <div class="modal-content admin-modal glass-effect">
        <div class="modal-header">
          <h3>{{ editingItem.id ? 'Editar Evento' : 'Agregar Evento' }}</h3>
          <button class="close-modal-btn" @click="closeAllModals">&times;</button>
        </div>
        <form @submit.prevent="saveItem" class="modal-body" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div class="form-group" style="grid-column: span 2;">
            <label>Nombre del Evento</label>
            <input type="text" v-model="editingItem.nombre" required />
            <span v-if="eventErrors.nombre" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.nombre }}</span>
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label>Descripción</label>
            <textarea v-model="editingItem.descripcion" rows="3" required></textarea>
            <span v-if="eventErrors.descripcion" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.descripcion }}</span>
          </div>
          <div class="form-group">
            <label>Categoría</label>
            <input type="text" v-model="editingItem.categoria" placeholder="Ej: Reforestación, Taller" required />
            <span v-if="eventErrors.categoria" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.categoria }}</span>
          </div>
          <div class="form-group">
            <label>Ubicación (Texto)</label>
            <input type="text" v-model="editingItem.ubicacion" placeholder="Ej: Chapultepec, CDMX" required />
            <span v-if="eventErrors.ubicacion" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.ubicacion }}</span>
          </div>
          <div class="form-group">
            <label>Latitud</label>
            <input type="number" step="any" v-model="editingItem.lat" required />
            <span v-if="eventErrors.lat" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.lat }}</span>
          </div>
          <div class="form-group">
            <label>Longitud</label>
            <input type="number" step="any" v-model="editingItem.lng" required />
            <span v-if="eventErrors.lng" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.lng }}</span>
          </div>
          <div class="form-group">
            <label>Fecha Inicio</label>
            <input type="datetime-local" v-model="editingItem.fecha_inicio" required />
            <span v-if="eventErrors.fecha_inicio" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.fecha_inicio }}</span>
          </div>
          <div class="form-group">
            <label>Fecha Fin</label>
            <input type="datetime-local" v-model="editingItem.fecha_fin" required />
            <span v-if="eventErrors.fecha_fin" class="error-msg" style="color: #ff4d4d; font-size: 0.8rem; margin-top: 4px; display: block;">{{ eventErrors.fecha_fin }}</span>
          </div>
          
          <!-- Image upload -->
          <div class="form-group" style="grid-column: span 2;">
            <label>Imagen del Evento</label>
            <input type="text" v-model="editingItem.imagen" placeholder="URL de la imagen o sube una:" style="margin-bottom: 8px;" />
            <input type="file" @change="handleItemImageUpload($event, 'imagen')" accept="image/*" />
          </div>

          <!-- Feature check chips -->
          <div class="form-group" style="grid-column: span 2; display: flex; gap: 20px; margin-top: 10px;">
            <label style="display: flex; align-items: center; gap: 8px; color: white;">
              <input type="checkbox" v-model="editingItem.es_gratuito" /> Gratis
            </label>
            <label style="display: flex; align-items: center; gap: 8px; color: white;">
              <input type="checkbox" v-model="editingItem.pet_friendly" /> Pet Friendly
            </label>
            <label style="display: flex; align-items: center; gap: 8px; color: white;">
              <input type="checkbox" v-model="editingItem.apto_ninos" /> Apto para Niños
            </label>
          </div>

          <div style="grid-column: span 2; display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
            <button type="button" class="btn btn-secondary" @click="closeAllModals">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
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
            <input type="text" v-model="editingItem.categoria" placeholder="Ej: Centro de Reciclaje, Eco-Tienda" required />
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
            <button type="submit" class="btn btn-primary">Guardar</button>
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
        <form @submit.prevent="saveItem" class="modal-body" style="display: flex; flex-direction: column; gap: 15px; max-height:80vh; overflow-y:auto;">
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
            <button type="submit" class="btn btn-primary">Guardar</button>
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
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 20px; max-height:75vh; overflow-y:auto;">
          
          <div>
            <h4 style="color: var(--color-eco); font-weight: 700; margin-bottom: 10px; font-size:1.05rem;">Acceso a Secciones (Hubs)</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
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
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_normativa" /> ⚖️ Normativas
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
                <input type="checkbox" v-model="actorPermissions.puede_editar_fondos" /> 💰 Fondos
              </label>
            </div>
          </div>

          <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
            <h4 style="color: var(--color-eco); font-weight: 700; margin-bottom: 10px; font-size:1.05rem;">Capacidades Operativas</h4>
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
        <form @submit.prevent="saveSlide" class="modal-body" style="display: flex; flex-direction: column; gap: 15px; max-height:80vh; overflow-y:auto;">
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

  </div>
</template>

<style>
@import '../assets/css/admin.css';

/* Compact style overrides for Vue compatibility */
.admin-body {
  background-color: #0b0f19;
  color: #f8fafc;
  min-height: 100vh;
  font-family: 'Outfit', sans-serif;
  display: flex;
}
.admin-main-wrapper {
  display: flex;
  width: 100%;
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
</style>
