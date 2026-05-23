<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

const isMenuOpen = ref(false)

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = () => {
  isMenuOpen.value = false
}
</script>

<template>
  <div>
    <!-- BARRA DE NAVEGACIÓN SUPERIOR (ESTANDARIZADA) -->
    <nav class="main-nav">
      <div class="nav-container">
        <RouterLink to="/" class="nav-brand" @click="closeMenu">
          <img src="/assets/img/logo-navbar.webp" alt="Logo EcoGuía SOS" class="nav-brand-logo" />
          <h1>EcoGuía SOS</h1>
        </RouterLink>

        <button class="hamburger-menu" aria-label="Abrir menú" @click="toggleMenu">
          <i class="fa-solid fa-bars"></i>
        </button>

        <ul class="nav-menu" :class="{ 'active': isMenuOpen }" id="nav-menu-list">
          <li><RouterLink to="/" class="nav-blue-btn" @click="closeMenu">Inicio</RouterLink></li>
          <li><RouterLink to="/nosotros" class="nav-purple-btn" @click="closeMenu">Nosotros</RouterLink></li>
          <li><RouterLink to="/como-usar" class="nav-how-to-btn" @click="closeMenu">Cómo usar</RouterLink></li>
          <li><RouterLink to="/auth?tab=signup" class="nav-btn-highlight" id="nav-auth-btn" @click="closeMenu">Súmate</RouterLink></li>
          <li><RouterLink to="/auth?tab=login" class="nav-login-btn" id="nav-login-btn" @click="closeMenu">Iniciar sesión</RouterLink></li>
        </ul>
      </div>
    </nav>

    <!-- VISTA DINÁMICA -->
    <RouterView />

    <!-- FOOTER -->
    <footer>
      <div class="footer-content">
        <div class="footer-section">
          <h4>EcoGuía SOS</h4>
          <p>Generando Redes Para el Futuro</p>
        </div>
        <div class="footer-section">
          <h4>Contacto</h4>
          <p>Email: contacto@ecogaiasos.com</p>
        </div>
        <div class="footer-section">
          <h4>Síguenos</h4>
          <div class="social-icons">
            <a href="#" aria-label="Facebook"><i class="fa-brands fa-facebook"></i></a>
            <a href="#" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
          </div>
          <!-- Puerta de acceso administrativa discreta -->
          <div class="footer-admin-box">
            <RouterLink to="/admin-login" class="footer-admin-link" @click="closeMenu">
              <i class="fa-solid fa-lock"></i> Staff
            </RouterLink>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2025 EcoGuía SOS. Todos los derechos reservados.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Estilos adicionales si fueran necesarios, pero la mayoría provienen de global.css y style.css */
</style>
