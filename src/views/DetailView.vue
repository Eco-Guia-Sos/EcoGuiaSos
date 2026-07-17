<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'
import { compressImage } from '../utils/imageCompressor'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

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


// State
const item = ref<any | null>(null)
const loading = ref(true)
const errorMsg = ref('')
const currentSlide = ref(0)
const subEventos = ref<any[]>([])
const hasSocial = ref(false)

// Publisher Actor Info
const actor = ref<any | null>(null)
const isFollowingActor = ref(false)
const followActorLoading = ref(false)
const parentSuperEvento = ref<any | null>(null)

// Favorites state
const isFavorite = ref(false)
const favoriteLoading = ref(false)
const favoriteError = ref('')

// Photo Passcode States
const isPhotoPasscodeModalOpen = ref(false)
const photoPasscodeText = ref('')
const photoPasscodeError = ref('')
const photoPasscodeVisible = ref(false)

// Expand description states
const isDescriptionExpanded = ref(false)
const isCausaExpanded = ref(false)

declare const maplibregl: any
let mapInstance: any = null

const itemId = computed(() => route.params.id as string)
const isCausaType = computed(() => route.path.includes('causas'))
const isEcoTecType = computed(() => route.path.includes('eco-tecnologia'))
const isEventType = computed(() => route.path.includes('eventos'))
const typeLabel = computed(() => {
  if (isCausaType.value) return 'causa'
  if (isEcoTecType.value) return 'eco-tecnologia'
  if (isEventType.value) return 'evento'
  return 'lugar'
})
const tableName = computed(() => {
  if (isCausaType.value || isEcoTecType.value) return 'contenido_secciones'
  if (isEventType.value) return 'eventos'
  return 'lugares'
})

// Cover propagation from section
const sectionCoverUrl = ref('')
const uploadingCover = ref(false)

const isAdmin = computed(() => {
  return authStore.profile?.rol === 'admin'
})

const triggerFileInput = () => {
  const input = document.getElementById('detail-cover-file-input') as HTMLInputElement
  if (input) input.click()
}

const handleCoverUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingCover.value = true
  try {
    // 1. Compress image natively
    const compressedBlob = await compressImage(file, 1200, 0.8)
    const compressedFile = new File([compressedBlob], `item_${itemId.value}_${Date.now()}.jpg`, {
      type: 'image/jpeg'
    })

    // 2. Upload to Supabase Storage bucket 'imagenes-plataforma'
    const fileName = `portadas/detail_${itemId.value}_${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('imagenes-plataforma')
      .upload(fileName, compressedFile, {
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('imagenes-plataforma')
      .getPublicUrl(fileName)

    const publicUrl = publicUrlData.publicUrl

    // 3. Update the item's image/cover URL in the DB
    const { error: dbError } = await supabase
      .from(tableName.value)
      .update({
        imagen_url: publicUrl
      })
      .eq('id', itemId.value)

    if (dbError) throw dbError

    if (item.value) {
      item.value.imagen_url = publicUrl
      item.value.imagen = publicUrl
    }
    alert('¡Portada del elemento actualizada correctamente!')
  } catch (err: any) {
    console.error('Error uploading cover:', err)
    alert('No se pudo subir la portada: ' + (err.message || err))
  } finally {
    uploadingCover.value = false
    target.value = ''
  }
}

const fetchSectionCover = async () => {
  sectionCoverUrl.value = ''
  let targetSection = ''
  
  if (isCausaType.value) {
    targetSection = 'causas'
  } else if (isEcoTecType.value) {
    targetSection = 'eco-tecnologia'
  } else if (isEventType.value) {
    // If it has a parent super_evento, we should grab the cover of that super_evento
    if (item.value?.super_evento_id) {
      try {
        const { data, error } = await supabase
          .from('super_eventos')
          .select('imagen_url')
          .eq('id', item.value.super_evento_id)
          .maybeSingle()
        if (!error && data && data.imagen_url) {
          sectionCoverUrl.value = data.imagen_url
          return
        }
      } catch (err) {
        console.warn('Error fetching parent super event cover:', err)
      }
    }
    targetSection = 'super-eventos'
  } else {
    // Places / Lugares
    targetSection = 'lugares'
  }

  if (!targetSection && item.value?.seccion_id) {
    targetSection = item.value.seccion_id
  }

  if (!targetSection) return

  try {
    const { data, error } = await supabase
      .from('portadas_secciones')
      .select('imagen_url')
      .eq('seccion_id', targetSection)
      .maybeSingle()
    if (!error && data && data.imagen_url) {
      sectionCoverUrl.value = data.imagen_url
    }
  } catch (err) {
    console.warn('Error fetching fallback cover:', err)
  }
}

// Slide images helper
const images = computed(() => {
  if (!item.value) return ['/assets/img/logo-app.webp']
  let imgs = item.value.imagenes
  
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

  if (imgs.length === 0) {
    const singleImg = item.value.imagen || item.value.imagen_url
    if (singleImg && typeof singleImg === 'string' && singleImg.trim()) {
      imgs.push(singleImg.trim())
    }
  }

  // Fallback to section cover photo if configured before using logo-app.webp
  if (imgs.length === 0 && sectionCoverUrl.value) {
    imgs.push(sectionCoverUrl.value)
  }

  if (imgs.length === 0) {
    imgs.push('/assets/img/logo-app.webp')
  }

  return imgs
})

const getMetaIcon = (net: any) => {
  const icons: Record<string, string> = {
    social_web: 'fa-solid fa-globe',
    social_fb: 'fa-brands fa-facebook',
    social_ig: 'fa-brands fa-instagram',
    social_wa: 'fa-brands fa-whatsapp',
    social_x: 'fa-brands fa-x-twitter',
    social_yt: 'fa-brands fa-youtube'
  }
  return icons[net] || 'fa-solid fa-globe'
}

const getMetaTitle = (net: any) => {
  const titles: Record<string, string> = {
    social_web: 'Sitio Web',
    social_fb: 'Facebook',
    social_ig: 'Instagram',
    social_wa: 'WhatsApp',
    social_x: 'X / Twitter',
    social_yt: 'YouTube'
  }
  return titles[net] || 'Enlace'
}

const socialNetworks = computed(() => {
  if (!item.value) return []
  
  if (isCausaType.value) {
    const nets = []
    if (item.value.meta?.instagram) {
      nets.push({
        key: 'instagram',
        url: item.value.meta.instagram,
        icon: 'fa-brands fa-instagram',
        title: 'Instagram',
        className: 'instagram'
      })
    }
    if (item.value.meta?.facebook) {
      nets.push({
        key: 'facebook',
        url: item.value.meta.facebook,
        icon: 'fa-brands fa-facebook',
        title: 'Facebook',
        className: 'facebook'
      })
    }
    return nets
  }

  const keys = ['social_web', 'social_fb', 'social_ig', 'social_wa', 'social_x', 'social_yt']
  const classes: Record<string, string> = {
    social_web: 'web',
    social_fb: 'facebook',
    social_ig: 'instagram',
    social_wa: 'whatsapp',
    social_x: 'x-twitter',
    social_yt: 'youtube'
  }
  const nets = keys
    .filter(key => item.value[key])
    .map(key => ({
      key,
      url: item.value[key],
      icon: getMetaIcon(key),
      title: getMetaTitle(key),
      className: classes[key] || 'web'
    }))
  return nets
})

const parsedCausa = computed(() => {
  if (!isCausaType.value || !item.value) return null
  
  const text = item.value.descripcion || ''
  
  let antecedentes = ''
  let rifaInfo = ''
  const premios: Array<{ emoji: string, text: string }> = []
  let premiosNota = ''
  let apoyoInfo = ''
  let agradecimiento = ''
  
  const rifaIndex = text.indexOf('🎟️ Rifa con Causa')
  if (rifaIndex !== -1) {
    antecedentes = text.substring(0, rifaIndex).trim()
    
    let nextIndex = text.indexOf('🏆 Premios:')
    if (nextIndex === -1) nextIndex = text.indexOf('Premios:')
    
    if (nextIndex !== -1) {
      rifaInfo = text.substring(rifaIndex, nextIndex).trim()
      rifaInfo = rifaInfo.replace('🎟️ Rifa con Causa', '').trim()
      
      let endPrizesIndex = text.indexOf('🌊')
      if (endPrizesIndex === -1) endPrizesIndex = text.indexOf('También hemos creado')
      
      if (endPrizesIndex !== -1) {
        const prizesBlock = text.substring(nextIndex, endPrizesIndex).trim()
        const lines = prizesBlock.split('\n')
        lines.forEach((line: string) => {
          const trimmed = line.trim()
          if (!trimmed) return
          if (trimmed.startsWith('🏆') || trimmed.toLowerCase().includes('premios')) {
            return
          }
          if (trimmed.startsWith('✨')) {
            premiosNota = trimmed.substring(1).trim()
            return
          }
          
          const emojiRegex = /^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}🥇🥈🥉🏆🪂🤿🐢👕✨💵💳📲💚🌊📣🎟️📅➡️🏎️🏖️🏕️🌋🧗🚢🛥️])\s*(.*)$/u
          const match = trimmed.match(emojiRegex)
          if (match) {
            premios.push({
              emoji: match[1] || '',
              text: match[2] || ''
            })
          } else {
            premios.push({
              emoji: '🎁',
              text: trimmed
            })
          }
        })
        
        const supportBlock = text.substring(endPrizesIndex).trim()
        let socialIndex = supportBlock.indexOf('📲')
        if (socialIndex === -1) socialIndex = supportBlock.indexOf('Síguenos')
        
        let supportText = socialIndex !== -1 ? supportBlock.substring(0, socialIndex).trim() : supportBlock
        
        let splitIcon = supportText.indexOf('💚')
        if (splitIcon === -1) splitIcon = supportText.indexOf('Gracias por')
        
        if (splitIcon !== -1) {
          apoyoInfo = supportText.substring(0, splitIcon).trim()
          agradecimiento = supportText.substring(splitIcon).trim()
        } else {
          apoyoInfo = supportText
        }
      } else {
        rifaInfo = text.substring(rifaIndex).trim()
      }
    } else {
      rifaInfo = text.substring(rifaIndex).trim()
    }
  } else {
    antecedentes = text
  }
  
  return {
    antecedentes,
    rifaInfo,
    premios,
    premiosNota,
    apoyoInfo,
    agradecimiento
  }
})

const formattedDate = computed(() => {
  if (!item.value) return ''
  if (item.value.fecha_inicio) {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    }
    const dInicio = new Date(item.value.fecha_inicio)
    let txt = dInicio.toLocaleDateString('es-MX', options)
    
    if (item.value.fecha_fin) {
      const dFin = new Date(item.value.fecha_fin)
      txt += ` y finaliza el ${dFin.toLocaleDateString('es-MX', options)}`
    }
    return txt
  }
  return item.value.horarios || 'Consulte disponibilidad directamente en el recinto.'
})

// Fetch Data
const loadDetailData = async () => {
  loading.value = true
  errorMsg.value = ''
  item.value = null
  actor.value = null
  subEventos.value = []
  
  const table = tableName.value
  
  try {
    if (!itemId.value) {
      throw new Error('No se proporcionó un identificador de proyecto.')
    }

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', itemId.value)
      .single()

    if (error || !data) {
      throw new Error('No encontramos el proyecto solicitado.')
    }

    let parsedData = { ...data }
    let meta: any = {}
    let textoDescripcion = parsedData.descripcion || ''

    try {
      if (textoDescripcion.trim().startsWith('{')) {
        meta = JSON.parse(textoDescripcion)
        textoDescripcion = meta.descripcion_texto || ''
      }
    } catch (e) {
      // ignore
    }

    parsedData.nombre = data.titulo || data.nombre || ''
    parsedData.meta = meta
    parsedData.descripcion = textoDescripcion

    item.value = parsedData
    document.title = `${parsedData.nombre} - EcoGuía SOS`

    // Load section cover fallback photo
    await fetchSectionCover()

    // Load parent super event if it's an event type
    if (isEventType.value && parsedData.super_evento_id) {
      await loadParentSuperEvento(parsedData.super_evento_id)
    }

    // Sub-events if it's a place
    if (!isEventType.value) {
      await loadSubEvents()
    }

    // Load publisher actor
    if (data.owner_id) {
      await loadPublisherActor(data.owner_id)
    }

    // Check favorite status
    if (authStore.user) {
      await checkFavoriteStatus()
    }

    // Apagar la carga para que Vue renderice el contenedor del mapa en el DOM
    loading.value = false

    await nextTick()
    
    // Map init
    initMiniMap()
  } catch (err: any) {
    console.error('Error cargando detalles:', err)
    errorMsg.value = err.message || 'Ocurrió un error inesperado.'
    loading.value = false
  }
}

const loadSubEvents = async () => {
  try {
    const { data, error } = await supabase
      .from('eventos')
      .select('id, nombre, fecha_inicio, imagen_url')
      .eq('lugar_id', itemId.value)
      .order('fecha_inicio', { ascending: true })

    if (!error && data) {
      subEventos.value = data
    }
  } catch (e) {
    console.error('Error loading sub-events:', e)
  }
}

const loadPublisherActor = async (ownerId: string) => {
  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', ownerId)
      .single()

    if (!error && data) {
      actor.value = data
      await checkFollowActorStatus(ownerId)
    }
  } catch (e) {
    console.error('Error loading actor section:', e)
  }
}

const loadParentSuperEvento = async (superId: string) => {
  try {
    const { data, error } = await supabase
      .from('super_eventos')
      .select('id, nombre, descripcion_corta, imagen_url')
      .eq('id', superId)
      .single()

    if (!error && data) {
      parentSuperEvento.value = data
    }
  } catch (e) {
    console.error('Error loading parent super event:', e)
  }
}

const checkFollowActorStatus = async (actorId: string) => {
  if (!authStore.user) return
  try {
    const { data, error } = await supabase
      .from('seguimientos_actores')
      .select('id')
      .eq('user_id', authStore.user.id)
      .eq('actor_id', actorId)
      .limit(1)
      .maybeSingle()

    isFollowingActor.value = !error && !!data
  } catch (e) {
    console.error('Error checking follow status:', e)
  }
}

const handleFollowActorToggle = async () => {
  if (!authStore.user) {
    router.push('/auth?tab=login')
    return
  }
  if (!actor.value) return

  followActorLoading.value = true
  try {
    const userId = authStore.user.id
    const actorId = actor.value.id

    if (isFollowingActor.value) {
      const { error } = await supabase
        .from('seguimientos_actores')
        .delete()
        .eq('user_id', userId)
        .eq('actor_id', actorId)

      if (!error) isFollowingActor.value = false
    } else {
      await supabase
        .from('seguimientos_actores')
        .delete()
        .eq('user_id', userId)
        .eq('actor_id', actorId)

      const { error } = await supabase
        .from('seguimientos_actores')
        .insert({ user_id: userId, actor_id: actorId })

      if (!error) isFollowingActor.value = true
    }
  } catch (e) {
    console.error('Error actualizando seguimiento:', e)
  } finally {
    followActorLoading.value = false
  }
}

const checkFavoriteStatus = async () => {
  if (!authStore.user) return
  try {
    const { data, error } = await supabase
      .from('favoritos')
      .select('id')
      .eq('user_id', authStore.user.id)
      .eq('item_id', itemId.value)
      .eq('item_tipo', typeLabel.value)
      .limit(1)
      .maybeSingle()

    isFavorite.value = !error && !!data
  } catch (e) {
    console.error('Error checking favorite status:', e)
  }
}

const handleVerFotos = () => {
  if (!item.value || !item.value.drive_fotos_url) return
  if (item.value.clave_fotos && item.value.clave_fotos.trim() !== '') {
    photoPasscodeText.value = ''
    photoPasscodeError.value = ''
    photoPasscodeVisible.value = false
    isPhotoPasscodeModalOpen.value = true
  } else {
    window.open(item.value.drive_fotos_url, '_blank')
  }
}

const closePhotoPasscodeModal = () => {
  isPhotoPasscodeModalOpen.value = false
  photoPasscodeText.value = ''
  photoPasscodeError.value = ''
}

const checkPhotoPasscode = () => {
  if (!item.value) return
  if (photoPasscodeText.value === item.value.clave_fotos) {
    window.open(item.value.drive_fotos_url, '_blank')
    closePhotoPasscodeModal()
  } else {
    photoPasscodeError.value = 'Clave incorrecta. Por favor, intenta de nuevo.'
  }
}

const handleFavoriteToggle = async () => {
  if (!authStore.user) {
    router.push('/auth?tab=login')
    return
  }

  favoriteLoading.value = true
  favoriteError.value = ''
  try {
    const userId = authStore.user.id
    const id = itemId.value
    const type = typeLabel.value

    if (isFavorite.value) {
      // Find fav ID
      const { data } = await supabase
        .from('favoritos')
        .select('id')
        .eq('user_id', userId)
        .eq('item_id', id)
        .eq('item_tipo', type)
        .limit(1)
        .maybeSingle()

      if (data) {
        const { error } = await supabase
          .from('favoritos')
          .delete()
          .eq('id', data.id)
        if (!error) {
          isFavorite.value = false
        } else {
          console.error('[Favoritos] Error al eliminar:', error)
          favoriteError.value = 'No se pudo quitar de favoritos. Intenta de nuevo.'
        }
      }
    } else {
      const { error } = await supabase
        .from('favoritos')
        .insert({
          user_id: userId,
          item_id: id,
          item_tipo: type
        })
      if (!error) {
        isFavorite.value = true
      } else {
        console.error('[Favoritos] Error al insertar:', error)
        favoriteError.value = 'No se pudo guardar en favoritos. Verifica tu sesión.'
      }
    }
  } catch (e) {
    console.error('Error toggling favorite:', e)
    favoriteError.value = 'Error inesperado. Intenta de nuevo.'
  } finally {
    favoriteLoading.value = false
    if (favoriteError.value) {
      setTimeout(() => { favoriteError.value = '' }, 4000)
    }
  }
}

// Mini Map initialization
const initMiniMap = () => {
  console.log('[MiniMap] initMiniMap triggered');
  if (!item.value) {
    console.log('[MiniMap] Return early: item.value is null');
    return;
  }
  console.log('[MiniMap] item values:', { modality: item.value.modalidad, lat: item.value.lat, lng: item.value.lng });
  
  if (item.value.lat == null || item.value.lng == null) {
    console.log('[MiniMap] Return early: lat or lng is null/undefined');
    return;
  }

  const lat = parseFloat(item.value.lat)
  const lng = parseFloat(item.value.lng)
  console.log('[MiniMap] parsed coordinates:', { lat, lng });
  
  if (isNaN(lat) || isNaN(lng)) {
    console.log('[MiniMap] Return early: lat or lng is NaN');
    return;
  }

  const container = document.getElementById('detail-mini-map')
  if (!container) {
    console.log('[MiniMap] Return early: container #detail-mini-map not found in DOM');
    return;
  }
  console.log('[MiniMap] Container found:', container);

  if (typeof maplibregl === 'undefined') {
    console.warn('[MiniMap] MapLibre GL library not loaded yet on window.');
    return
  }

  try {
    if (mapInstance) {
      console.log('[MiniMap] Removing previous map instance');
      mapInstance.remove()
    }

    console.log('[MiniMap] Instantiating new MapLibre instance...');
    mapInstance = new maplibregl.Map({
      container: 'detail-mini-map',
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
          }
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 20
          }
        ]
      },
      center: [lng, lat],
      zoom: 15,
      interactive: false
    })

    mapInstance.on('load', () => {
      console.log('[MiniMap] MapInstance loaded event fired');
      if (!mapInstance) return
      mapInstance.resize()
      
      console.log('[MiniMap] Adding marker...');
      new maplibregl.Marker({ color: '#72B04D' })
        .setLngLat([lng, lat])
        .addTo(mapInstance)
    })
  } catch (e) {
    console.error('[MiniMap] Exception caught:', e)
  }
}

// Slideshow Navigation
const nextSlide = () => {
  if (currentSlide.value < images.value.length - 1) {
    currentSlide.value++
  } else {
    currentSlide.value = 0
  }
}

const prevSlide = () => {
  if (currentSlide.value > 0) {
    currentSlide.value--
  } else {
    currentSlide.value = images.value.length - 1
  }
}

const setSlide = (idx: number | string) => {
  currentSlide.value = typeof idx === 'string' ? parseInt(idx, 10) : idx
}

// Social Sharing
const shareContent = () => {
  if (!item.value) return
  if (navigator.share) {
    navigator.share({
      title: item.value.nombre,
      text: `Mira este proyecto ecológico en EcoGuía SOS: ${item.value.nombre}`,
      url: window.location.href
    }).catch(err => console.log('Error sharing:', err))
  } else {
    navigator.clipboard.writeText(window.location.href)
    alert('¡Enlace copiado al portapapeles!')
  }
}

onMounted(() => {
  loadDetailData()
})

// Watch parameters to re-run on path shifts
watch(() => route.params.id, () => {
  loadDetailData()
})
watch(() => route.path, () => {
  loadDetailData()
})
</script>

<template>
  <div :class="isCausaType ? 'theme-ajolote' : (isEcoTecType ? 'theme-colibri' : (isEventType ? 'theme-gaia' : 'theme-eco'))">
    <!-- LOADING SHIMMER -->
    <div v-if="loading" id="detail-loader" class="full-screen-loader">
      <div class="spinner"></div>
    </div>

    <!-- ERROR VIEW -->
    <div v-else-if="errorMsg" class="no-events" style="padding: 100px 20px; text-align: center;">
      <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; color: #ff4d4d; margin-bottom: 20px;"></i>
      <h2>¡Vaya! Algo salió mal</h2>
      <p>{{ errorMsg }}</p>
      <br>
      <RouterLink to="/" class="btn btn-primary">Volver al inicio</RouterLink>
    </div>

    <!-- MAIN DETAIL CONTENT -->
    <main v-else-if="item" id="detail-main-content">
      <!-- 1. HERO SECTION -->
      <header class="detail-hero" style="position: relative;">
        <!-- Admin Cover Changer Floating Widget for page header banner -->
        <div v-if="isAdmin" class="admin-cover-widget" style="position: absolute; top: 20px; right: 20px; z-index: 100;">
          <button 
            @click="triggerFileInput" 
            class="admin-cover-btn" 
            :disabled="uploadingCover"
            title="Cambiar imagen de portada del elemento"
            style="padding: 8px 14px; font-size: 0.75rem;"
          >
            <i v-if="uploadingCover" class="fa-solid fa-spinner fa-spin"></i>
            <i v-else class="fa-solid fa-camera"></i>
            <span>{{ uploadingCover ? 'Subiendo...' : 'Cambiar portada' }}</span>
          </button>
          <input 
            type="file" 
            id="detail-cover-file-input" 
            @change="handleCoverUpload" 
            accept="image/*" 
            style="display: none;" 
          />
        </div>

        <div class="hero-bg-blur" id="hero-bg-blur" :style="`background-image: url(${images[0]});`"></div>
        <div class="hero-container container">
          <div class="hero-info no-poster">
            <div v-if="parentSuperEvento" class="super-evento-badge-link" @click="router.push(`/super-eventos/${parentSuperEvento.id}`)" style="display: inline-flex; align-items: center; gap: 8px; background: rgba(114, 176, 77, 0.2); border: 1px solid rgba(114, 176, 77, 0.4); color: #8ce167; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; margin-bottom: 12px; cursor: pointer; transition: all 0.3s ease;">
              <i class="fa-solid fa-trophy" style="color: #72b04d;"></i>
              Este evento forma parte de: <span style="text-decoration: underline; color: white;">{{ parentSuperEvento.nombre }}</span>
            </div>
            <h1 id="detail-title">{{ item.nombre }}</h1>
            <div class="hero-meta">
              <div class="meta-item">
                <i class="fa-solid fa-tag"></i>
                <span id="detail-category">{{ isEcoTecType ? (item.meta?.categoria_tech || 'Eco-tecnología') : formatCategory(item.categoria) }}</span>
              </div>
              <div class="meta-item highlight">
                <i class="fa-solid fa-clock"></i>
                <span id="detail-time-status">Hoy disponible</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- 2. CONTENT GRID -->
      <div class="content-wrapper container">
        <div class="left-column-wrapper">
          <article class="main-content">
          <!-- Description -->
          <template v-if="isCausaType && parsedCausa">
            <!-- Section 1: La Causa (Antecedentes) -->
            <section v-if="parsedCausa.antecedentes" class="info-section causa-detail-card">
              <h2 class="section-title"><i class="fa-solid fa-circle-info"></i> La Causa</h2>
              <div class="description-text" style="white-space: pre-line;">
                <span v-if="!isCausaExpanded && parsedCausa.antecedentes.length > 300">
                  {{ parsedCausa.antecedentes.substring(0, 300) }}...
                </span>
                <span v-else>
                  {{ parsedCausa.antecedentes }}
                </span>
                <button 
                  v-if="parsedCausa.antecedentes.length > 300" 
                  @click="isCausaExpanded = !isCausaExpanded" 
                  class="btn-ver-mas-link"
                  style="background: transparent; border: none; color: #38bdf8; font-weight: 700; cursor: pointer; padding: 0; margin-left: 6px; font-size: inherit; text-decoration: underline;"
                >
                  {{ isCausaExpanded ? 'Ver menos' : 'Ver más' }}
                </button>
              </div>
            </section>

            <!-- Rifa & Campaña moved below content-wrapper -->
          </template>
          <section v-else class="info-section">
            <h2 class="section-title"><i class="fa-solid fa-circle-info"></i> Acerca de</h2>
            <div id="detail-description" class="description-text" style="white-space: pre-line;">
              <span v-if="!isDescriptionExpanded && item.descripcion && item.descripcion.length > 300">
                {{ item.descripcion.substring(0, 300) }}...
              </span>
              <span v-else>
                {{ item.descripcion || 'Sin descripción detallada por el momento.' }}
              </span>
              <button 
                v-if="item.descripcion && item.descripcion.length > 300" 
                @click="isDescriptionExpanded = !isDescriptionExpanded" 
                class="btn-ver-mas-link"
                style="background: transparent; border: none; color: #38bdf8; font-weight: 700; cursor: pointer; padding: 0; margin-left: 6px; font-size: inherit; text-decoration: underline;"
              >
                {{ isDescriptionExpanded ? 'Ver menos' : 'Ver más' }}
              </button>
            </div>
          </section>

          <!-- Sub-events (if place) -->
          <section v-if="!isEventType && subEventos.length > 0" id="sub-events-section" class="info-section">
            <h3 class="section-title" style="font-size: 1.2rem; color: #5bc2f7; margin-bottom: 20px;">
              <i class="fa-solid fa-calendar-star"></i> Próximos Eventos Aquí
            </h3>
            <div id="detail-sub-events" style="display: flex; overflow-x: auto; gap: 15px; padding-bottom: 10px;">
              <div 
                v-for="ev in subEventos" 
                :key="ev.id" 
                class="mini-event-card hover-glow"
                style="min-width: 160px; max-width: 180px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; cursor: pointer; transition: 0.3s; padding-bottom: 5px;"
                @click="router.push(`/eventos/${ev.id}`)"
              >
                <div style="height: 100px; width: 100%; overflow: hidden;">
                  <img 
                    :src="ev.imagen_url || ev.imagen || '/assets/img/logo-app.webp'" 
                    style="width: 100%; height: 100%; object-fit: cover;" 
                    :alt="ev.nombre"
                    @error="($event.target as HTMLImageElement).src='/assets/img/logo-app.webp'"
                  >
                </div>
                <div style="padding: 12px;">
                  <h4 style="font-size: 0.9rem; margin: 0 0 6px 0; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" :title="ev.nombre">{{ ev.nombre }}</h4>
                  <p style="font-size: 0.75rem; color: #5bc2f7; margin: 0; font-weight: 600;">
                    <i class="fa-regular fa-clock"></i> 
                    {{ ev.fecha_inicio ? new Date(ev.fecha_inicio).toLocaleDateString() : 'Próximamente' }}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- Schedules (Non-causes) -->
          <template v-if="!isCausaType">
            <section class="info-section">
              <h2 class="section-title"><i class="fa-solid fa-calendar-days"></i> Horarios y Disponibilidad</h2>
              <div class="schedule-grid" id="detail-schedule">
                <div class="schedule-card">
                  <p class="label">{{ isEventType ? 'Fecha y Hora' : 'Horario' }}</p>
                  <p class="value" id="detail-hours" v-html="formattedDate"></p>
                </div>
              </div>
            </section>

          </template>
        </article>

        <!-- 4. BOTTOM CARDS SECTION -->
        <div v-if="!isCausaType && (actor || parentSuperEvento)" class="bottom-cards-section">
          <!-- Publisher Actor Card Section -->
          <section 
            v-if="actor" 
            class="info-section actor-card-lite"
            style="margin-top: 40px; padding: 20px; background: rgba(255,255,255,0.03); border-radius: 15px; border: 1px solid rgba(255,255,255,0.05);"
          >
            <h3 style="font-size: 1.1rem; color: #888; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">Publicado por:</h3>
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
              <img 
                :src="actor.avatar_url || actor.imagen_url || '/assets/img/logo-app.webp'" 
                style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary-color);"
                @error="($event.target as HTMLImageElement).src='/assets/img/logo-app.webp'"
              >
              <div style="flex-grow: 1;">
                <h4 style="margin: 0; color: white; font-size: 1.2rem;">{{ actor.nombre_completo || 'Agente de Cambio' }}</h4>
                <p style="margin: 3px 0 0 0; color: var(--primary-color); font-size: 0.9rem;">{{ actor.especialidad || 'Líder Ambiental' }}</p>
              </div>
              <div style="display: flex; gap: 10px; margin-left: auto;">
                <RouterLink 
                  :to="`/agentes/${actor.id}`" 
                  class="btn-ver-perfil-actor" 
                  style="padding: 10px 18px; font-size: 0.85rem; color: #72B04D; border: 1px solid #72B04D; border-radius: 30px; text-decoration: none; font-weight: 600; transition: all 0.3s ease;"
                >
                  Ver perfil
                </RouterLink>
                 <button 
                  v-if="authStore.user && authStore.user.id !== actor.id"
                  id="btn-follow-actor" 
                  class="btn btn-primary" 
                  :class="{ 'btn-follow-glow': !isFollowingActor }"
                  style="padding: 10px 18px; font-size: 0.85rem; border-radius: 30px;"
                  :style="isFollowingActor ? 'background: #333; border-color: #72B04D; color: #72B04D;' : ''"
                  :disabled="followActorLoading"
                  @click="handleFollowActorToggle"
                >
                  {{ isFollowingActor ? '✓ Siguiendo' : '+ Seguir' }}
                </button>
              </div>
            </div>
          </section>

          <!-- Parent Super Event Card Section -->
          <section 
            v-if="parentSuperEvento" 
            class="info-section actor-card-lite"
            style="margin-top: 20px; padding: 20px; background: rgba(114, 176, 77, 0.05); border-radius: 15px; border: 1px solid rgba(114, 176, 77, 0.15);"
          >
            <h3 style="font-size: 1.1rem; color: #72b04d; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">Este evento forma parte de:</h3>
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
              <img 
                :src="parentSuperEvento.imagen_url || '/assets/img/logo-app.webp'" 
                style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover; border: 2px solid #72b04d;"
                @error="($event.target as HTMLImageElement).src='/assets/img/logo-app.webp'"
              >
              <div style="flex-grow: 1;">
                <h4 style="margin: 0; color: white; font-size: 1.2rem;">{{ parentSuperEvento.nombre }}</h4>
                <p style="margin: 3px 0 0 0; color: #cbd5e1; font-size: 0.85rem;">{{ parentSuperEvento.descripcion_corta }}</p>
              </div>
              <div style="display: flex; gap: 10px; margin-left: auto;">
                <RouterLink 
                  :to="`/super-eventos/${parentSuperEvento.id}`" 
                  class="btn btn-primary" 
                  style="padding: 10px 18px; font-size: 0.85rem; border-radius: 30px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; background: #72b04d; border-color: #72b04d; color: white;"
                >
                  🏆 Ver Súper Evento
                </RouterLink>
              </div>
            </div>
          </section>
        </div>
      </div>

        <!-- Col 2: Flyer / Imagen Central -->
        <div class="flyer-content">
          <div class="flyer-wrapper" id="slider-container" style="position: relative; overflow: visible; border-radius: 20px; background: rgba(0,0,0,0.2);">

            <!-- Inner container to handle image slideshow clipping -->
            <div style="width: 100%; height: 100%; overflow: hidden; border-radius: 12px;">
              <!-- Slider Track -->
              <div 
                id="slider-track" 
                style="display: flex; height: 100%; transition: transform 0.3s ease;"
                :style="`transform: translateX(-${currentSlide * 100}%);`"
              >
                <img 
                  v-for="(imgUrl, i) in images" 
                  :key="i"
                  :src="imgUrl" 
                  :alt="item.nombre" 
                  style="width: 100%; height: 100%; object-fit: cover; flex-shrink: 0;"
                  @error="($event.target as HTMLImageElement).src='/assets/img/logo-app.webp'"
                >
              </div>
            </div>

            <!-- Badge Type -->
            <span 
              id="detail-type-badge" 
              class="badge-pill type-badge"
              :style="`background: ${isCausaType ? 'var(--color-eco)' : (isEcoTecType ? 'var(--color-colibri)' : (isEventType ? 'var(--color-gaia)' : 'var(--color-eco)'))};`"
            >
              {{ isCausaType ? 'CAUSA SOLIDARIA' : (isEcoTecType ? 'RECURSO TECNOLÓGICO' : (isEventType ? 'EVENTO ECOLÓGICO' : 'LUGAR SUSTENTABLE')) }}
            </span>

            <!-- Controls (if more than 1 image) -->
            <template v-if="images.length > 1">
              <button class="slider-btn prev" id="slider-prev" @click="prevSlide" aria-label="Foto anterior">
                <i class="fa-solid fa-chevron-left"></i>
              </button>
              <button class="slider-btn next" id="slider-next" @click="nextSlide" aria-label="Siguiente foto">
                <i class="fa-solid fa-chevron-right"></i>
              </button>
              
              <!-- Indicator Dots -->
              <div class="slider-dots" id="slider-dots">
                <div 
                  v-for="(dot, idx) in images" 
                  :key="idx" 
                  class="dot"
                  :class="{ 'active': idx === currentSlide }"
                  @click="setSlide(idx)"
                ></div>
              </div>
            </template>
          </div>
        </div>

        <!-- 3. SIDEBAR -->
        <aside class="side-panel">
          <div class="sticky-card glass-effect">
            <!-- Sidebar Map (Only if presencial or hybrid, i.e. has coordinates) -->
            <div v-if="item.modalidad !== 'en_linea' && item.lat && item.lng" class="sidebar-map-container" style="margin-bottom: 15px;">
              <div id="detail-mini-map"></div>
            </div>
            
            <div class="sidebar-info">
              <!-- Location block -->
              <div v-if="isEcoTecType" class="location-box" style="margin-bottom: 20px;">
                <p class="location-label">DESARROLLADOR / CREADOR</p>
                <h4 style="color: var(--color-colibri); margin: 4px 0 12px 0; font-weight: 700; font-size: 1.15rem;">
                  👨‍💻 {{ item.meta?.desarrollador || 'Desarrollador' }}
                </h4>
                
                <p class="location-label">CATEGORÍA TECNOLÓGICA</p>
                <h4 style="color: white; margin: 4px 0 12px 0; font-weight: 700; font-size: 1.1rem;">
                  🌍 {{ item.meta?.categoria_tech || 'General' }}
                </h4>
                
                <p v-if="item.meta?.stack" class="location-label">STACK / TECNOLOGÍAS</p>
                <h4 v-if="item.meta?.stack" style="color: #5bc2f7; margin: 4px 0 0 0; font-weight: 700; font-size: 1.1rem;">
                  💻 {{ item.meta.stack }}
                </h4>
              </div>
              <div v-else-if="isCausaType" class="location-box" style="margin-bottom: 20px;">
                <p class="location-label">ORGANIZADOR</p>
                <h4 style="color: var(--color-eco); margin: 4px 0 12px 0; font-weight: 700; font-size: 1.15rem;">
                  🐢 {{ item.meta?.organizador || 'Campamento Tortuguero Palmarito' }}
                </h4>
                
                <p v-if="item.meta?.costo_boleto" class="location-label">COSTO BOLETO (RIFA)</p>
                <h4 v-if="item.meta?.costo_boleto" style="color: white; margin: 4px 0 12px 0; font-weight: 700; font-size: 1.1rem;">
                  🎟️ {{ item.meta.costo_boleto }}
                </h4>
                
                <p v-if="item.meta?.fecha_sorteo" class="location-label">FECHA DEL SORTEO</p>
                <h4 v-if="item.meta?.fecha_sorteo" style="color: #5bc2f7; margin: 4px 0 0 0; font-weight: 700; font-size: 1.1rem;">
                  📅 {{ item.meta.fecha_sorteo }}
                </h4>
              </div>
              <div v-else class="location-box" style="margin-bottom: 20px;">
                <p class="location-label">MODALIDAD</p>
                <h4 style="color: var(--color-eco); margin: 4px 0 8px 0; font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 6px;">
                  <span v-if="item.modalidad === 'en_linea'">🖥️ Virtual / En Línea</span>
                  <span v-else-if="item.tiene_sesion_online">🔄 Híbrido (Presencial + En Línea)</span>
                  <span v-else>📍 Presencial</span>
                </h4>
                
                <template v-if="item.modalidad !== 'en_linea'">
                  <p class="location-label" style="margin-top: 12px;">UBICACIÓN</p>
                  <h4 id="detail-location-name" style="margin: 4px 0;">{{ item.nombre }}</h4>
                  <p id="detail-address" class="location-address">{{ item.ubicacion || 'Dirección no especificada' }}</p>
                </template>
                <template v-else>
                  <p class="location-label" style="margin-top: 12px;">PLATAFORMA</p>
                  <p style="color: #94a3b8; font-size: 0.9rem; margin: 4px 0 0 0;">Acceso virtual a través del enlace de sesión</p>
                </template>
              </div>

              <!-- Social links for this event/place -->
              <div style="margin-bottom: 25px;">
                <h4 style="font-size: 0.8rem; color: #888; text-transform: uppercase; margin-bottom: 12px;">Redes Sociales</h4>
                <div id="detail-social-links" style="display: flex; gap: 10px; flex-wrap: wrap;">
                  <template v-if="socialNetworks.length > 0">
                    <a 
                      v-for="net in socialNetworks" 
                      :key="net.key"
                      :href="net.url" 
                      target="_blank"
                      class="social-btn"
                      :class="net.className"
                      :title="net.title"
                      style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.05); color: white; transition: 0.3s; border: 1px solid rgba(255,255,255,0.08);"
                    >
                      <i :class="net.icon"></i>
                    </a>
                  </template>
                  <p v-else style="color: #666; font-style: italic; font-size: 0.8rem;">No hay redes registradas.</p>
                </div>
              </div>

              <div class="action-buttons">
                <!-- Redirection button for GoFundMe (Causes only) -->
                <a 
                  v-if="isCausaType && item.enlace_externo"
                  :href="item.enlace_externo" 
                  target="_blank" 
                  class="btn btn-primary full-width shimmer-extra"
                  style="margin-bottom: 8px; justify-content: center;"
                >
                  <i class="fa-solid fa-hand-holding-dollar"></i> Apoyar en GoFundMe
                </a>

                <!-- Redirection button for Eco-tecnología resource -->
                <a 
                  v-if="isEcoTecType && item.enlace_externo"
                  :href="item.enlace_externo" 
                  target="_blank" 
                  class="btn btn-primary full-width shimmer-extra"
                  style="margin-bottom: 8px; justify-content: center; background: var(--color-colibri); color: #000; font-weight: 700; border-color: transparent;"
                >
                  <i class="fa-solid fa-arrow-up-right-from-square"></i> Acceder al Recurso
                </a>

                <!-- Google Maps redirection (Presencial / Hybrid only) -->
                <a 
                  v-if="!isCausaType && !isEcoTecType && item.modalidad !== 'en_linea' && item.lat && item.lng"
                  :href="`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`" 
                  target="_blank" 
                  class="btn btn-secondary full-width"
                >
                  <i class="fa-solid fa-map-location-dot"></i> Cómo llegar
                </a>
                                <button class="btn btn-outline full-width btn-share-effect" @click="shareContent">
                  <i class="fa-solid fa-share-nodes"></i> Compartir
                </button>
                <!-- Edit button for Admin or Owner -->
                <button 
                  v-if="authStore.profile?.rol === 'admin' || (authStore.profile?.rol === 'actor' && item && item.owner_id === authStore.user?.id)"
                  class="btn btn-primary full-width btn-edit-effect"
                  @click="router.push(`/admin/editar/${typeLabel}/${itemId}`)"
                  style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; margin-bottom: 8px; justify-content: center; display: flex; align-items: center; gap: 8px; font-weight: 700;"
                >
                  <i class="fa-solid fa-pen-to-square"></i> Editar {{ isCausaType ? 'Causa' : (isEcoTecType ? 'Recurso' : (isEventType ? 'Evento' : 'Lugar')) }}
                </button>
                <button 
                  v-if="authStore.user && item && item.drive_fotos_url"
                  class="btn btn-secondary full-width btn-photos-effect"
                  @click="handleVerFotos"
                  style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; margin-bottom: 8px; justify-content: center; display: flex; align-items: center; gap: 8px;"
                >
                  <i class="fa-solid fa-images"></i> Ver fotografías del evento
                </button>
                                <button 
                  v-if="authStore.user"
                  class="btn btn-outline full-width btn-favorite-effect" 
                  :class="{ 'btn-favorite-active': isFavorite }"
                  :disabled="favoriteLoading"
                  @click="handleFavoriteToggle"
                >
                  <i class="fa-bookmark" :class="isFavorite ? 'fa-solid' : 'fa-regular'"></i> 
                  {{ isFavorite ? 'Guardado' : 'Guardar en Favoritos' }}
                </button>
                <!-- Favoritos error toast -->
                <div 
                  v-if="favoriteError" 
                  style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); border-radius: 10px; padding: 10px 14px; font-size: 0.82rem; color: #fca5a5; display: flex; align-items: center; gap: 8px; margin-top: 4px;"
                >
                  <i class="fa-solid fa-triangle-exclamation" style="color: #f87171; flex-shrink:0;"></i>
                  {{ favoriteError }}
                </div>
                
                <!-- Smart Sumate Buttons -->
                <template v-if="!isCausaType">
                  <!-- Case 1: Pure Online -->
                  <template v-if="item.modalidad === 'en_linea'">
                    <!-- Session link (Required) -->
                    <a 
                      v-if="item.sesion_online_link"
                      :href="item.sesion_online_link" 
                      target="_blank" 
                      class="btn btn-primary full-width shimmer-extra"
                      style="margin-bottom: 8px;"
                    >
                      <i class="fa-solid fa-desktop"></i> Unirse a la sesión
                    </a>
                    <!-- Registration form link (Optional) -->
                    <a 
                      v-if="item.reg_link"
                      :href="item.reg_link" 
                      target="_blank" 
                      class="btn btn-secondary full-width"
                    >
                      <i class="fa-solid fa-clipboard-list"></i> Registrarse al evento
                    </a>
                  </template>
                  
                  <!-- Case 2: Hybrid -->
                  <template v-else-if="item.tiene_sesion_online">
                    <!-- Registration / Presencial link (Optional) -->
                    <a 
                      v-if="item.reg_link"
                      :href="item.reg_link" 
                      target="_blank" 
                      class="btn btn-primary full-width shimmer-extra"
                      style="margin-bottom: 8px;"
                    >
                      <i class="fa-solid fa-hand-holding-heart"></i> Súmate presencialmente
                    </a>
                    <!-- Session link (Required) -->
                    <a 
                      v-if="item.sesion_online_link"
                      :href="item.sesion_online_link" 
                      target="_blank" 
                      class="btn btn-secondary full-width"
                    >
                      <i class="fa-solid fa-desktop"></i> Ver sesión en línea
                    </a>
                  </template>

                  <!-- Case 3: Pure Presencial -->
                  <template v-else>
                    <a 
                      v-if="item.reg_link"
                      :href="item.reg_link" 
                      target="_blank" 
                      class="btn btn-primary full-width shimmer-extra"
                    >
                      <i class="fa-solid fa-hand-holding-heart"></i> Súmate ahora
                    </a>
                  </template>
                </template>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <!-- 2.5 CAUSAS SPLIT ROW BELOW THE GRID FOR DESKTOP/TABLET, OR STACKED -->
      <div v-if="isCausaType && parsedCausa" class="causa-bottom-container container" style="margin-top: 40px; margin-bottom: 80px;">
        <div class="causa-split-row causa-rifa-campana-row">
          <!-- Section 2: Rifa con Causa & Premios -->
          <section v-if="parsedCausa.rifaInfo || parsedCausa.premios.length > 0" class="info-section causa-detail-card" style="background: #1a232e; border: 1px solid rgba(255,255,255,0.05); padding: 40px; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
            <h2 class="section-title"><i class="fa-solid fa-ticket"></i> Rifa con Causa</h2>
            <div v-if="parsedCausa.rifaInfo" class="description-text" style="white-space: pre-line; margin-bottom: 25px; color: rgba(255, 255, 255, 0.85);">
              {{ parsedCausa.rifaInfo }}
            </div>
            
            <div v-if="parsedCausa.premios.length > 0" class="prizes-container">
              <h3 style="font-size: 1.15rem; color: #38bdf8; margin-bottom: 15px; font-weight: 700;">🏆 Lista de Premios:</h3>
              <div class="prizes-list" style="display: flex; flex-direction: column; gap: 12px;">
                <div v-for="(p, index) in parsedCausa.premios" :key="index" class="prize-item-row" style="display: flex; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 12px 18px; border-radius: 14px; gap: 15px; transition: 0.3s;">
                  <span class="prize-emoji-circle" style="background: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; box-shadow: 0 2px 6px rgba(0,0,0,0.15); flex-shrink: 0;">
                    {{ p.emoji }}
                  </span>
                  <span class="prize-text" style="color: white; font-size: 0.95rem; font-weight: 600; line-height: 1.4;">
                    {{ p.text }}
                  </span>
                </div>
              </div>
              <p v-if="parsedCausa.premiosNota" class="premios-nota" style="margin-top: 18px; font-size: 0.88rem; color: #94a3b8; font-style: italic; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-circle-info" style="color: #38bdf8; flex-shrink: 0;"></i> {{ parsedCausa.premiosNota }}
              </p>
            </div>
          </section>

          <!-- Section 3: Campaña de Apoyo & Donaciones -->
          <section v-if="parsedCausa.apoyoInfo || parsedCausa.agradecimiento" class="info-section causa-detail-card" style="background: #1a232e; border: 1px solid rgba(255,255,255,0.05); padding: 40px; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
            <h2 class="section-title"><i class="fa-solid fa-hand-holding-heart"></i> Campaña de Apoyo</h2>
            <div v-if="parsedCausa.apoyoInfo" class="description-text" style="white-space: pre-line; margin-bottom: 20px; color: rgba(255, 255, 255, 0.85);">
              {{ parsedCausa.apoyoInfo }}
            </div>
            <div v-if="parsedCausa.agradecimiento" class="description-text agradecimiento-box" style="white-space: pre-line; background: rgba(14, 165, 233, 0.05); border: 1px dashed rgba(14, 165, 233, 0.2); padding: 20px; border-radius: 16px; border-left: 4px solid #0284c7; color: #cbd5e1; font-style: italic;">
              {{ parsedCausa.agradecimiento }}
            </div>
          </section>
        </div>

        <!-- 2.6 Schedules & Publisher Section below Rifa & support split row -->
        <div class="causa-split-row" style="margin-top: 10px;">
          <!-- Schedules (Causes) -->
          <section class="info-section causa-detail-card" style="background: #1a232e; border: 1px solid rgba(255,255,255,0.05); padding: 40px; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
            <h2 class="section-title"><i class="fa-solid fa-calendar-days"></i> Horarios y Disponibilidad</h2>
            <div class="schedule-grid" id="detail-schedule">
              <div class="schedule-card" style="margin-bottom: 0; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
                <p class="label">Horario</p>
                <p class="value" id="detail-hours" v-html="formattedDate"></p>
              </div>
            </div>
          </section>

          <!-- Publisher Actor Card Section (Causes) -->
          <section 
            v-if="actor" 
            class="info-section actor-card-lite"
            style="background: #1a232e; border: 1px solid rgba(255,255,255,0.05); padding: 40px; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.25); display: flex; flex-direction: column; justify-content: center;"
          >
            <h3 style="font-size: 1.15rem; color: #38bdf8; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Publicado por:</h3>
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
              <img 
                :src="actor.avatar_url || actor.imagen_url || '/assets/img/logo-app.webp'" 
                style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary-color);"
                @error="($event.target as HTMLImageElement).src='/assets/img/logo-app.webp'"
              >
              <div style="flex-grow: 1;">
                <h4 style="margin: 0; color: white; font-size: 1.2rem; font-weight: 700;">{{ actor.nombre_completo || 'Agente de Cambio' }}</h4>
                <p style="margin: 3px 0 0 0; color: #38bdf8; font-size: 0.9rem;">{{ actor.especialidad || 'Líder Ambiental' }}</p>
              </div>
              <div style="display: flex; gap: 10px; margin-left: auto;">
                <RouterLink 
                  :to="`/agentes/${actor.id}`" 
                  class="btn-ver-perfil-actor" 
                  style="padding: 10px 18px; font-size: 0.85rem; color: #38bdf8; border: 1px solid #0284c7; border-radius: 30px; text-decoration: none; font-weight: 600; transition: all 0.3s ease;"
                >
                  Ver perfil
                </RouterLink>
                 <button 
                  v-if="authStore.user && authStore.user.id !== actor.id"
                  id="btn-follow-actor" 
                  class="btn btn-primary" 
                  :class="{ 'btn-follow-glow': !isFollowingActor }"
                  style="padding: 10px 18px; font-size: 0.85rem; border-radius: 30px;"
                  :style="isFollowingActor ? 'background: #333; border-color: #0284c7; color: #38bdf8;' : ''"
                  :disabled="followActorLoading"
                  @click="handleFollowActorToggle"
                >
                  {{ isFollowingActor ? '✓ Siguiendo' : '+ Seguir' }}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- UI MOBILE: Bottom Action Bar -->
      <div class="mobile-action-bar">
        <a 
          v-if="item.modalidad !== 'en_linea' && item.lat && item.lng"
          :href="`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`" 
          target="_blank"
          class="btn-circular"
        >
          <i class="fa-solid fa-location-dot"></i>
        </a>
        <button class="btn-circular" @click="shareContent"><i class="fa-solid fa-share-nodes"></i></button>
        <button 
          v-if="authStore.user" 
          class="btn-circular" 
          :style="isFavorite ? 'color: #72B04D;' : ''" 
          @click="handleFavoriteToggle"
        >
          <i class="fa-bookmark" :class="isFavorite ? 'fa-solid' : 'fa-regular'"></i>
        </button>
        <!-- Smart Sumate Buttons (Mobile) -->
        <!-- Case 1: Pure Online -->
        <template v-if="item.modalidad === 'en_linea'">
          <a 
            v-if="item.sesion_online_link" 
            :href="item.sesion_online_link" 
            target="_blank" 
            class="btn btn-primary flex-grow" 
            style="display: flex; justify-content: center; align-items: center; text-decoration: none;"
          >
            🖥️ Unirse
          </a>
          <a 
            v-if="item.reg_link" 
            :href="item.reg_link" 
            target="_blank" 
            class="btn btn-secondary flex-grow" 
            style="display: flex; justify-content: center; align-items: center; text-decoration: none;"
          >
            📋 Registro
          </a>
        </template>
        <!-- Case 2: Hybrid -->
        <template v-else-if="item.tiene_sesion_online">
          <a 
            v-if="item.reg_link" 
            :href="item.reg_link" 
            target="_blank" 
            class="btn btn-primary flex-grow" 
            style="display: flex; justify-content: center; align-items: center; text-decoration: none;"
          >
            📍 Presencial
          </a>
          <a 
            v-if="item.sesion_online_link" 
            :href="item.sesion_online_link" 
            target="_blank" 
            class="btn btn-secondary flex-grow" 
            style="display: flex; justify-content: center; align-items: center; text-decoration: none;"
          >
            🖥️ Online
          </a>
        </template>
        <!-- Case 3: Pure Presencial -->
        <template v-else>
          <a 
            v-if="item.reg_link" 
            :href="item.reg_link" 
            target="_blank" 
            class="btn btn-primary flex-grow" 
            style="display: flex; justify-content: center; align-items: center; text-decoration: none;"
          >
            Súmate
          </a>
        </template>
      </div>
    </main>

    <!-- MODAL CLAVE ACCESO FOTOS -->
    <div 
      v-if="isPhotoPasscodeModalOpen" 
      class="modal-overlay photo-passcode-overlay"
      @click="closePhotoPasscodeModal"
    >
      <div class="modal-content glass-effect photo-passcode-modal" @click.stop>
        <div class="modal-header">
          <h3><i class="fa-solid fa-lock" style="color: #10b981; margin-right: 8px;"></i>Acceso Protegido</h3>
          <button class="close-modal-btn" @click="closePhotoPasscodeModal">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-description">Este álbum de fotos está protegido. Ingresa la clave de acceso para continuar.</p>
          <div class="input-wrapper green-effect" style="margin: 20px 0 10px; position: relative; display: flex; align-items: center;">
            <input 
              :type="photoPasscodeVisible ? 'text' : 'password'" 
              v-model="photoPasscodeText" 
              placeholder="Escribe la clave de acceso..." 
              @keyup.enter="checkPhotoPasscode"
              class="passcode-input"
            />
            <button 
              type="button" 
              class="toggle-visible-btn" 
              @click="photoPasscodeVisible = !photoPasscodeVisible"
            >
              <i class="fa-solid" :class="photoPasscodeVisible ? 'fa-eye-slash' : 'fa-eye'"></i>
            </button>
          </div>
          <p v-if="photoPasscodeError" class="passcode-error-msg">
            <i class="fa-solid fa-circle-exclamation"></i> {{ photoPasscodeError }}
          </p>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="closePhotoPasscodeModal">Cancelar</button>
            <button class="btn btn-primary shimmer-extra" @click="checkPhotoPasscode">Ver Fotografías</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import '../assets/css/detalles.css';
@import '../assets/css/style.css';

/* Custom Photo Passcode Modal Styles */
.photo-passcode-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  backdrop-filter: blur(8px);
}
.photo-passcode-modal {
  background: rgba(17, 24, 39, 0.85) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  width: 90%;
  max-width: 420px;
  border-radius: 20px;
  padding: 24px;
  color: white;
  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  animation: modalFadeIn 0.3s ease;
}
@keyframes modalFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.photo-passcode-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 12px;
  margin-bottom: 16px;
}
.photo-passcode-modal .modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  display: flex;
  align-items: center;
}
.photo-passcode-modal .close-modal-btn {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 1.5rem;
  cursor: pointer;
  transition: 0.2s;
  padding: 0;
  line-height: 1;
}
.photo-passcode-modal .close-modal-btn:hover {
  color: white;
}
.photo-passcode-modal .modal-description {
  font-size: 0.9rem;
  color: rgba(255,255,255,0.7);
  line-height: 1.5;
  margin: 0;
}
.photo-passcode-modal .passcode-input {
  width: 100%;
  padding: 12px 45px 12px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: white;
  font-size: 0.95rem;
  outline: none;
  transition: 0.3s;
}
.photo-passcode-modal .passcode-input:focus {
  border-color: #10b981;
  background: rgba(255, 255, 255, 0.08);
}
.photo-passcode-modal .toggle-visible-btn {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  padding: 4px;
  font-size: 0.95rem;
  transition: 0.2s;
}
.photo-passcode-modal .toggle-visible-btn:hover {
  color: white;
}
.photo-passcode-modal .passcode-error-msg {
  color: #f87171;
  font-size: 0.8rem;
  margin: 8px 0 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.photo-passcode-modal .modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}
.photo-passcode-modal .modal-actions .btn {
  padding: 10px 16px;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: 0.2s;
}
.photo-passcode-modal .modal-actions .btn-secondary {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
}
.photo-passcode-modal .modal-actions .btn-secondary:hover {
  background: rgba(255,255,255,0.1);
}
.photo-passcode-modal .modal-actions .btn-primary {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
}
.photo-passcode-modal .modal-actions .btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

/* Fix specific overrides and additions for details view styling */
.full-screen-loader {
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--color-fondo);
  z-index: 9999;
}
.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(114, 176, 77, 0.1);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Image Slider styles */
.slider-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: 0.3s;
}
.slider-btn:hover {
  background: var(--primary-color);
  color: black;
}
.slider-btn.prev { left: 15px; }
.slider-btn.next { right: 15px; }
.slider-dots {
  position: absolute;
  bottom: 15px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
}
.slider-dots .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.4);
  cursor: pointer;
  transition: 0.3s;
}
.slider-dots .dot.active {
  background: white;
  width: 20px;
  border-radius: 10px;
}

/* Social Buttons custom colors */
.social-btn.web:hover { background: var(--primary-color) !important; color: black !important; }
.social-btn.facebook:hover { background: #3b5998 !important; }
.social-btn.instagram:hover { background: #e1306c !important; }
.social-btn.whatsapp:hover { background: #25d366 !important; }
.social-btn.x-twitter:hover { background: #111 !important; }
.social-btn.youtube:hover { background: #ff0000 !important; }
/* Publisher ver perfil button styling */
.btn-ver-perfil-actor:hover {
  background: #72B04D !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(114, 176, 77, 0.3);
}

/* Glowing Follow Button */
.btn-follow-glow {
  box-shadow: 0 0 10px rgba(114, 176, 77, 0.45) !important;
  animation: follow-glow-pulse 2.5s infinite ease-in-out !important;
  border: 1px solid rgba(114, 176, 77, 0.5) !important;
}
.btn-follow-glow:hover {
  box-shadow: 0 0 16px rgba(114, 176, 77, 0.7) !important;
  transform: scale(1.03) !important;
  animation-play-state: paused !important;
}
@keyframes follow-glow-pulse {
  0%, 100% {
    box-shadow: 0 0 8px rgba(114, 176, 77, 0.35);
  }
  50% {
    box-shadow: 0 0 16px rgba(114, 176, 77, 0.75);
  }
}

/* Favorite Button Styling and Effects */
.btn-favorite-effect {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
  position: relative !important;
  overflow: hidden !important;
  border: 1px solid rgba(114, 176, 77, 0.45) !important;
  color: #72B04D !important;
  box-shadow: 0 0 10px rgba(114, 176, 77, 0.25) !important;
  animation: favorite-idle-glow 3.0s infinite ease-in-out !important;
}
.btn-favorite-effect:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 0 16px rgba(114, 176, 77, 0.55) !important;
  border-color: #72B04D !important;
  color: #72B04D !important;
  background: rgba(114, 176, 77, 0.08) !important;
}
.btn-favorite-effect:active {
  transform: translateY(1px) !important;
}
.btn-favorite-active {
  background: #72B04D !important;
  border-color: #72B04D !important;
  color: white !important;
  box-shadow: 0 0 16px rgba(114, 176, 77, 0.6) !important;
  animation: favorite-glow-pulse 2.5s infinite ease-in-out !important;
  font-weight: 850 !important;
}
.btn-favorite-active:hover {
  background: #649a41 !important;
  border-color: #649a41 !important;
  color: white !important;
  box-shadow: 0 0 20px rgba(114, 176, 77, 0.75) !important;
}
@keyframes favorite-idle-glow {
  0%, 100% {
    box-shadow: 0 0 8px rgba(114, 176, 77, 0.2);
    border-color: rgba(114, 176, 77, 0.4);
  }
  50% {
    box-shadow: 0 0 14px rgba(114, 176, 77, 0.5);
    border-color: rgba(114, 176, 77, 0.85);
  }
}
@keyframes favorite-glow-pulse {
  0%, 100% {
    box-shadow: 0 0 12px rgba(114, 176, 77, 0.4);
  }
  50% {
    box-shadow: 0 0 22px rgba(114, 176, 77, 0.75);
  }
}

/* Share Button Styling and Effects */
.btn-share-effect {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
  position: relative !important;
  overflow: hidden !important;
  border: 1px solid rgba(56, 151, 240, 0.45) !important;
  color: #3897f0 !important;
  box-shadow: 0 0 10px rgba(56, 151, 240, 0.25) !important;
  animation: share-idle-glow 3.0s infinite ease-in-out !important;
}
.btn-share-effect:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 0 16px rgba(56, 151, 240, 0.55) !important;
  border-color: #3897f0 !important;
  color: #3897f0 !important;
  background: rgba(56, 151, 240, 0.08) !important;
}
.btn-share-effect:active {
  transform: translateY(1px) !important;
}
@keyframes share-idle-glow {
  0%, 100% {
    box-shadow: 0 0 8px rgba(56, 151, 240, 0.2);
    border-color: rgba(56, 151, 240, 0.4);
  }
  50% {
    box-shadow: 0 0 14px rgba(56, 151, 240, 0.5);
    border-color: rgba(56, 151, 240, 0.85);
  }
}

/* AJOLOTE THEME OVERRIDES FOR DETAIL VIEW & CAUSAS STYLING */
.theme-ajolote {
  --primary-color: #0284c7;
}
.theme-ajolote .btn-primary {
  background: #0284c7 !important;
  color: white !important;
  border: none !important;
}
.theme-ajolote .btn-primary:hover {
  background: #0369a1 !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 20px rgba(2, 132, 199, 0.4) !important;
}
.theme-ajolote .btn-outline {
  border-color: rgba(2, 132, 199, 0.5) !important;
  color: #38bdf8 !important;
}
.theme-ajolote .btn-outline:hover {
  background: rgba(2, 132, 199, 0.1) !important;
  border-color: #0284c7 !important;
  color: white !important;
}
.theme-ajolote .section-title i {
  color: #38bdf8 !important;
}
.theme-ajolote .prize-item-row:hover {
  background: rgba(2, 132, 199, 0.08) !important;
  border-color: rgba(2, 132, 199, 0.25) !important;
  transform: translateX(4px);
}
.theme-ajolote .location-box h4 {
  color: #38bdf8 !important;
}
.theme-ajolote .btn-favorite-effect {
  border-color: rgba(2, 132, 199, 0.45) !important;
  color: #38bdf8 !important;
  box-shadow: 0 0 10px rgba(2, 132, 199, 0.25) !important;
  animation: favorite-idle-glow-ajolote 3.0s infinite ease-in-out !important;
}
.theme-ajolote .btn-favorite-effect:hover {
  box-shadow: 0 0 16px rgba(2, 132, 199, 0.55) !important;
  border-color: #38bdf8 !important;
  color: #38bdf8 !important;
  background: rgba(2, 132, 199, 0.08) !important;
}
.theme-ajolote .btn-favorite-active {
  background: #0284c7 !important;
  border-color: #0284c7 !important;
  color: white !important;
  box-shadow: 0 0 16px rgba(2, 132, 199, 0.6) !important;
  animation: favorite-glow-pulse-ajolote 2.5s infinite ease-in-out !important;
}
.theme-ajolote .btn-favorite-active:hover {
  background: #0369a1 !important;
  border-color: #0369a1 !important;
}
.theme-ajolote .btn-ver-perfil-actor {
  color: #38bdf8 !important;
  border-color: #0284c7 !important;
}
.theme-ajolote .btn-ver-perfil-actor:hover {
  background: #0284c7 !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3) !important;
}

@keyframes favorite-idle-glow-ajolote {
  0%, 100% {
    box-shadow: 0 0 8px rgba(2, 132, 199, 0.2);
    border-color: rgba(2, 132, 199, 0.4);
  }
  50% {
    box-shadow: 0 0 14px rgba(2, 132, 199, 0.5);
    border-color: rgba(2, 132, 199, 0.85);
  }
}
@keyframes favorite-glow-pulse-ajolote {
  0%, 100% {
    box-shadow: 0 0 12px rgba(2, 132, 199, 0.4);
  }
  50% {
    box-shadow: 0 0 22px rgba(2, 132, 199, 0.75);
  }
}

.causa-split-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  width: 100%;
}

/* Primera fila: Rifa (mismo ancho que La Causa) + Campaña (resto del espacio) */
.causa-rifa-campana-row {
  grid-template-columns: 1fr calc(var(--flyer-width) + var(--sidebar-width) + 40px);
}

@media (max-width: 900px) {
  .causa-split-row {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .causa-rifa-campana-row {
    grid-template-columns: 1fr;
  }
}

.causa-bottom-container {
  max-width: var(--content-max-width, 1350px) !important;
  margin-left: auto !important;
  margin-right: auto !important;
  box-sizing: border-box;
}

/* Admin Cover Photo Widget */
.admin-cover-btn {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(114, 176, 77, 0.4);
  color: #72B04D;
  padding: 10px 18px;
  border-radius: 50px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}
.admin-cover-btn:hover:not(:disabled) {
  background: #72B04D;
  color: #0b1329;
  border-color: #72B04D;
  box-shadow: 0 0 15px rgba(114, 176, 77, 0.6);
  transform: scale(1.05);
}
.admin-cover-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .admin-cover-widget {
    top: 10px !important;
    right: 10px !important;
  }
  .admin-cover-btn {
    padding: 8px 14px;
    font-size: 0.75rem;
  }
}
</style>
