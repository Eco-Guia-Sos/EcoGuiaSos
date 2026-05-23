<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const messageText = ref('')
const messageType = ref<'error' | 'success'>('error')
const isSubmitting = ref(false)

const showMessage = (msg: string, type: 'error' | 'success' = 'error') => {
  messageText.value = msg
  messageType.value = type
}

const handleAdminLogin = async () => {
  isSubmitting.value = true
  showMessage('')
  
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('No se pudo autenticar el usuario.')

    // Check role in profile
    const { data: profile, error: profileError } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      throw new Error('No se encontró un perfil asociado a esta cuenta.')
    }

    if (profile.rol !== 'admin' && profile.rol !== 'actor') {
      await supabase.auth.signOut()
      throw new Error('No tienes permisos de administrador.')
    }

    showMessage('Acceso concedido. Entrando al panel...', 'success')
    
    // Init authStore session update
    await authStore.init()

    setTimeout(() => {
      router.push('/admin')
    }, 1000)
  } catch (error: any) {
    showMessage(error.message, 'error')
    console.error('Admin Auth Error:', error)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="auth-page-wrapper">
    <div class="auth-wrap">
      <RouterLink to="/" class="nav-back">
        <i class="fa-solid fa-house"></i> Ir a Inicio
      </RouterLink>
      
      <div class="auth-box admin-auth-container glass-effect">
        <div class="auth-header">
          <img src="/assets/img/logo-navbar.webp" alt="EcoGuía Logo" class="auth-logo" />
          <div class="admin-badge">Panel Administrativo</div>
          <h2>Bienvenido</h2>
          <p>Ingresa para gestionar tu organización o el sistema.</p>
        </div>

        <form @submit.prevent="handleAdminLogin">
          <div class="input-group">
            <label for="admin-email">Email Corporativo</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-envelope"></i>
              <input type="email" id="admin-email" v-model="email" placeholder="tu@email.com" required />
            </div>
          </div>

          <div class="input-group">
            <label for="admin-password">Contraseña</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-lock"></i>
              <input type="password" id="admin-password" v-model="password" placeholder="••••••••" required />
            </div>
          </div>

          <div v-if="messageText" class="auth-message" :class="messageType" style="display: block;">
            {{ messageText }}
          </div>

          <button type="submit" class="auth-btn btn-gaia" :disabled="isSubmitting">
            <template v-if="isSubmitting">
              <i class="fa-solid fa-spinner fa-spin"></i> Accediendo...
            </template>
            <template v-else>
              <i class="fa-solid fa-shield-halved"></i> Acceder al Panel
            </template>
          </button>
        </form>

        <div class="auth-footer">
          <p>¿No eres administrador? <RouterLink to="/auth?tab=signup">Volver a Súmate</RouterLink></p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-auth-container {
  border-top: 4px solid var(--color-gaia);
}
.admin-badge {
  background: rgba(0, 119, 182, 0.1);
  color: var(--color-gaia);
  padding: 5px 12px;
  border-radius: 5px;
  font-size: 0.8rem;
  text-transform: uppercase;
  font-weight: 700;
  display: inline-block;
  margin-bottom: 15px;
}
</style>
