import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../services/supabase.service'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export const useHomeStore = defineStore('home', () => {
  const todosLosProyectos = ref<any[]>([])
  const carruselSlides = ref<any[]>([])
  const loading = ref(false)
  const initialFetchDone = ref(false)
  const error = ref<string | null>(null)
  const lastFetched = ref<number | null>(null)

  const isCacheValid = () => {
    return lastFetched.value !== null && Date.now() - lastFetched.value < CACHE_TTL_MS
  }

  const cargarDatos = async (lat?: number, lng?: number, radiusKm?: number, force = false) => {
    console.log('[homeStore] cargarDatos started. lat:', lat, 'lng:', lng, 'radiusKm:', radiusKm, 'force:', force)
    // Skip fetch if cache is still fresh and no specific coordinate parameters are specified
    if (!force && isCacheValid() && lat === undefined) {
      console.log('[homeStore] cargarDatos skipped: cache valid')
      return
    }

    loading.value = true
    error.value = null

    try {
      // Fetch carousel
      const { data: slides } = await supabase
        .from('carrusel_principal')
        .select('*')
        .eq('activo', true)
        .order('orden', { ascending: true })

      if (slides) carruselSlides.value = slides

      // Fetch events (upcoming and active events, lightweight payload)
      const today = new Date()
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
      
      let queryEventos = supabase
        .from('eventos')
        .select('id, nombre, categoria, ubicacion, lat, lng, imagen_url, fecha_inicio, fecha_fin, es_gratuito, pet_friendly, apto_ninos, owner_id, modalidad, tiene_sesion_online, imagenes')
        .eq('estado', 'approved')
        .gte('fecha_fin', startOfMonth)

      // Apply geographic bounding box filter if coordinates are provided
      if (lat !== undefined && lng !== undefined && radiusKm !== undefined) {
        const latitudeDelta = radiusKm / 111.0
        const longitudeDelta = radiusKm / (111.0 * Math.cos(lat * Math.PI / 180))

        const minLat = lat - latitudeDelta
        const maxLat = lat + latitudeDelta
        const minLng = lng - longitudeDelta
        const maxLng = lng + longitudeDelta

        queryEventos = queryEventos.or(`modalidad.eq.en_linea,tiene_sesion_online.eq.true,and(lat.gte.${minLat},lat.lte.${maxLat},lng.gte.${minLng},lng.lte.${maxLng})`)
      } else {
        // Fallback: order by date and limit to 30 events if no coordinates are supplied
        queryEventos = queryEventos.order('fecha_inicio', { ascending: true }).limit(30)
      }

      const { data: eventosData } = await queryEventos

      // Fetch owner profiles
      const ownerIds = (eventosData || []).map((r: any) => r.owner_id).filter((v, i, a) => v && a.indexOf(v) === i)

      const profilesMap: Record<string, string> = {}
      if (ownerIds.length > 0) {
        const { data: pData } = await supabase
          .from('perfiles')
          .select('id, nombre_completo')
          .in('id', ownerIds)

        if (pData) {
          pData.forEach((p: any) => {
            profilesMap[p.id] = p.nombre_completo
          })
        }
      }

      const parseRow = (row: any, tipo: 'evento' | 'lugar') => {
        let conteo = 0
        if (tipo === 'lugar' && row.eventos && row.eventos.length > 0) {
          conteo = row.eventos[0].count || 0
        }

        let firstImg = row.imagen_url || row.imagen
        if (row.imagenes && Array.isArray(row.imagenes) && row.imagenes.length > 0) {
          firstImg = row.imagenes[0]
        }

        return {
          id: row.id,
          nombre: row.nombre,
          categoria: row.categoria || 'General',
          ubicacion: row.ubicacion || 'CDMX',
          mapa_url: row.mapa_url || null,
          imagen: firstImg || '/assets/img/logo-app.webp',
          descripcion: row.descripcion || 'Sin descripción.',
          tipo: tipo,
          coordenadas: (row.lat && row.lng) ? { lat: row.lat, lng: row.lng } : null,
          lat: row.lat,
          lng: row.lng,
          conteo_eventos: conteo,
          fecha: row.fecha_inicio || row.fecha || row.created_at,
          fecha_inicio: row.fecha_inicio,
          fecha_fin: row.fecha_fin,
          es_gratuito: row.es_gratuito,
          pet_friendly: row.pet_friendly,
          apto_ninos: row.apto_ninos,
          owner_id: row.owner_id,
          actor_nombre: row.owner_id ? (profilesMap[row.owner_id] || null) : null,
          modalidad: row.modalidad || 'presencial',
          tiene_sesion_online: row.tiene_sesion_online || false,
          reg_link: row.reg_link || null,
          sesion_online_link: row.sesion_online_link || null,
          social_fb: row.social_fb || null,
          social_ig: row.social_ig || null,
          social_wa: row.social_wa || null,
          social_x: row.social_x || null,
          social_yt: row.social_yt || null,
          social_web: row.social_web || null,
          imagenes: row.imagenes || []
        }
      }

      const parseadosEventos = (eventosData || []).map((r: any) => parseRow(r, 'evento'))

      todosLosProyectos.value = parseadosEventos
      lastFetched.value = Date.now()
    } catch (err) {
      console.error('[homeStore] Error cargando datos:', err)
      error.value = 'Error al cargar los datos. Verifica tu conexión.'
    } finally {
      loading.value = false
      initialFetchDone.value = true
    }
  }

  const invalidateCache = () => {
    lastFetched.value = null
  }

  return {
    todosLosProyectos,
    carruselSlides,
    loading,
    initialFetchDone,
    error,
    lastFetched,
    isCacheValid,
    cargarDatos,
    invalidateCache
  }
})
