<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase.service'

const router = useRouter()

// State
const currentStep = ref<'request' | 'update' | 'success'>('request')
const email = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)

const successTitle = ref('¡Enviado!')
const successMsg = ref('Revisa tu bandeja de entrada para continuar.')

const handleRequestReset = async () => {
  loading.value = true
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      successTitle.value = '¡Enlace enviado!'
      successMsg.value = `Hemos enviado instrucciones a ${email.value}. No olvides revisar tu carpeta de spam.`
      currentStep.value = 'success'
    }
  } catch (err: any) {
    alert('Error al enviar la solicitud: ' + err.message)
  } finally {
    loading.value = false
  }
}

const handleUpdatePassword = async () => {
  if (newPassword.value !== confirmPassword.value) {
    alert('Las contraseñas no coinciden.')
    return
  }

  loading.value = true
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword.value
    })

    if (error) {
      alert('Error al actualizar: ' + error.message)
    } else {
      successTitle.value = '¡Éxito!'
      successMsg.value = 'Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión.'
      currentStep.value = 'success'
    }
  } catch (err: any) {
    alert('Error al actualizar contraseña: ' + err.message)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // Listen to Supabase Auth State changes to detect recovery token clicks
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      console.log('[Reset] Evento de recuperación de contraseña detectado')
      currentStep.value = 'update'
    }
  })

  // Quick fallback check for hash params in the route URL
  if (window.location.hash && window.location.hash.includes('type=recovery')) {
    currentStep.value = 'update'
  }
})
</script>

<template>
  <div class="reset-password-body">
    <!-- background particles placeholder style -->
    <div id="particles-js" class="particles-bg"></div>

    <div class="auth-wrapper">
      <header class="auth-header">
        <RouterLink to="/auth" class="back-link">
          <i class="fa-solid fa-arrow-left"></i> Volver al ingreso
        </RouterLink>
        <img src="/assets/img/logo-navbar.webp" alt="Logo EcoGuía SOS" class="auth-logo">
      </header>

      <main class="auth-container glass-effect">
        
        <!-- STEP 1: Request reset link -->
        <div v-if="currentStep === 'request'" class="auth-form active">
          <h2>Recuperar Contraseña</h2>
          <p class="auth-desc">Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.</p>
          
          <form @submit.prevent="handleRequestReset">
            <div class="input-group">
              <label for="reset-email">Email</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-envelope"></i>
                <input 
                  type="email" 
                  id="reset-email" 
                  v-model="email" 
                  placeholder="tu@email.com" 
                  required 
                />
              </div>
            </div>
            <button 
              type="submit" 
              class="btn btn-primary auth-btn shimmer-extra"
              :disabled="loading"
            >
              {{ loading ? 'Enviando...' : 'Enviar enlace' }}
            </button>
          </form>
        </div>

        <!-- STEP 2: Update password -->
        <div v-else-if="currentStep === 'update'" class="auth-form active">
          <h2>Nueva Contraseña</h2>
          <p class="auth-desc">Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta.</p>
          
          <form @submit.prevent="handleUpdatePassword">
            <div class="input-group">
              <label for="new-password">Nueva Contraseña</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-lock"></i>
                <input 
                  type="password" 
                  id="new-password" 
                  v-model="newPassword" 
                  placeholder="Mínimo 6 caracteres" 
                  required 
                  minlength="6" 
                />
              </div>
            </div>
            
            <div class="input-group">
              <label for="confirm-password">Confirmar Contraseña</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-lock"></i>
                <input 
                  type="password" 
                  id="confirm-password" 
                  v-model="confirmPassword" 
                  placeholder="Repite la contraseña" 
                  required 
                  minlength="6" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              class="btn btn-primary auth-btn shimmer-extra"
              :disabled="loading"
            >
              {{ loading ? 'Actualizando...' : 'Actualizar contraseña' }}
            </button>
          </form>
        </div>

        <!-- STEP 3: Success message -->
        <div v-else-if="currentStep === 'success'" class="auth-form active">
          <div style="text-align: center; padding: 20px;">
            <i class="fa-solid fa-circle-check" style="font-size: 3.5rem; color: #72B04D; margin-bottom: 20px; display:inline-block;"></i>
            <h2 style="color:white; font-size:1.8rem; font-weight:800; margin-bottom:10px;">{{ successTitle }}</h2>
            <p style="color:#cbd5e1; font-size:0.95rem; line-height:1.5; margin-bottom:25px;">{{ successMsg }}</p>
            
            <RouterLink to="/auth?tab=login" class="btn btn-primary" style="padding: 10px 30px; border-radius: 20px; font-weight:700;">
              Ir al ingreso
            </RouterLink>
          </div>
        </div>

      </main>
    </div>
  </div>
</template>

<style>
.reset-password-body {
  background-color: #0b0f19;
  min-height: 100vh;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Outfit', sans-serif;
  color: white;
}
.particles-bg {
  position: absolute;
  inset: 0;
  z-index: 1;
}
.auth-wrapper {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 440px;
  padding: 20px;
  box-sizing: border-box;
}
.auth-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}
.back-link {
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color 0.3s;
}
.back-link:hover {
  color: #72B04D;
}
.auth-logo {
  height: 40px;
  width: auto;
}
.auth-container {
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 35px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}
.auth-form h2 {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0 0 10px 0;
  color: white;
}
.auth-desc {
  color: #94a3b8;
  font-size: 0.88rem;
  line-height: 1.5;
  margin-bottom: 25px;
}
.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}
.input-group label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #94a3b8;
}
.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.input-wrapper i {
  position: absolute;
  left: 14px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.95rem;
}
.input-wrapper input {
  width: 100%;
  padding: 12px 14px 12px 42px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  color: white;
  outline: none;
  font-family: inherit;
  font-size: 0.95rem;
  transition: all 0.3s;
}
.input-wrapper input:focus {
  border-color: #72B04D;
  background: rgba(255, 255, 255, 0.05);
}
.auth-btn {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.95rem;
  margin-top: 10px;
  border: none;
  cursor: pointer;
}
</style>
