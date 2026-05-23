import { createClient } from '@supabase/supabase-js'
import { useServiceCall } from '../composables/useServiceCall'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('FALTAN VARIABLES DE ENTORNO DE SUPABASE.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'ecoguia-auth-token',
    autoRefreshToken: true,
    persistSession: true
  }
})

export const fetchEvents = async () => {
  const { call } = useServiceCall()
  return call(
    async () => {
      const { data, error } = await supabase.from('eventos').select('*').eq('estado', 'approved')
      if (error) throw error
      return data
    },
    'No se pudieron cargar los eventos. Intenta de nuevo en unos momentos.'
  )
}

export const fetchPlaces = async () => {
  const { call } = useServiceCall()
  return call(
    async () => {
      const { data, error } = await supabase.from('lugares').select('*').eq('estado', 'approved')
      if (error) throw error
      return data
    },
    'No se pudieron cargar los lugares. Intenta de nuevo en unos momentos.'
  )
}

export const fetchUserProfile = async (userId: string) => {
  const { call } = useServiceCall()
  return call(
    async () => {
      const { data, error } = await supabase.from('perfiles').select('*').eq('id', userId).maybeSingle()
      if (error) throw error
      return data
    },
    'No se pudo cargar el perfil del usuario.'
  )
}
