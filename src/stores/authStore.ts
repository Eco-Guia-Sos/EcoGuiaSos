import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../services/supabase.service'
import type { Session, User } from '@supabase/supabase-js'
import { PerfilSchema } from '../schemas'
import * as Sentry from '@sentry/vue'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const profile = ref<{
    nombre_completo: string | null
    rol: string | null
    avatar_url: string | null
  } | null>(null)
  
  const loading = ref(true)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!error && data) {
        const { success } = PerfilSchema.safeParse(data)
        if (!success) {
          console.warn('Perfil con campos inesperados:', data)
          Sentry.captureMessage(`Perfil con campos inesperados: ${JSON.stringify(data)}`, 'warning')
        }

        profile.value = data
        // Cache profile data as in the original app
        let dbName = data.nombre_completo || ''
        if (dbName && !dbName.includes('@')) {
          dbName = dbName.split(' ')[0]
        }
        localStorage.setItem('eco_user_name', dbName)
        localStorage.setItem('eco_user_role', data.rol || 'user')
        if (data.avatar_url) localStorage.setItem('eco_user_avatar', data.avatar_url)
      }
    } catch (e) {
      console.warn('[AuthStore] Error fetching profile:', e)
    }
  }

  const handleSession = async (currentSession: Session | null) => {
    session.value = currentSession
    user.value = currentSession?.user || null
    
    if (user.value) {
      await fetchProfile(user.value.id)
    } else {
      profile.value = null
      // Clear cache on logout
      localStorage.removeItem('eco_user_name')
      localStorage.removeItem('eco_user_role')
      localStorage.removeItem('eco_user_avatar')
    }
    loading.value = false
  }

  const initialized = ref(false)

  const init = async () => {
    if (initialized.value) return
    initialized.value = true
    
    loading.value = true
    
    // Initial session check
    const { data } = await supabase.auth.getSession()
    await handleSession(data.session)

    // Listen to auth changes
    supabase.auth.onAuthStateChange(async (_event, newSession) => {
      await handleSession(newSession)
    })
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.warn('[AuthStore] Error llamando a signOut:', error)
    } finally {
      await handleSession(null)
    }
  }

  return {
    session,
    user,
    profile,
    loading,
    initialized,
    init,
    logout
  }
})
