import './assets/css/global.css'
import './assets/css/style.css'
import './assets/css/fab.css'
import './assets/css/calendar.css'

import * as Sentry from '@sentry/vue'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'

if ('serviceWorker' in navigator) {
  // Registrar el SW controlando la caché del navegador para el script
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    .then(reg => {
      console.log('[SW] Service Worker registrado con éxito:', reg.scope);
      
      // Checar si hay actualizaciones regularmente
      reg.update();
      
      // Si ya hay un SW esperando, decirle que tome el control
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Escuchar cuando el nuevo SW se instala y queda esperando
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Enviar instrucción de activación inmediata
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    })
    .catch(err => {
      console.error('[SW] Error al registrar Service Worker:', err);
    });

  // Cuando cambie el controlador activo (nuevo SW activado), recargar para aplicar CSP limpia
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('[SW] Nuevo controlador detectado. Recargando página...');
      window.location.reload();
    }
  });
}

const app = createApp(App)

app.directive('reveal', {
  mounted(el: any, binding: any) {
    el.classList.add('scroll-reveal')
    if (binding.value) {
      el.classList.add(`reveal-${binding.value}`)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add('reveal-visible')
            observer.unobserve(el)
          }
        })
      },
      {
        threshold: 0.05,
        rootMargin: '0px 0px -30px 0px'
      }
    )
    observer.observe(el)
    el._revealObserver = observer
  },
  unmounted(el: any) {
    if (el._revealObserver) {
      el._revealObserver.unobserve(el)
    }
  }
})

app.use(createPinia())
app.use(router)

// Inicializar Sentry
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    app,
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    beforeSend(event, hint) {
      // Filtrar errores que no queremos reportar
      if (navigator.onLine === false) return null // Offline, ignorar
      const error = hint.originalException as any
      if (error && error.message) {
        if (error.message.includes('401')) return null // Auth error
        if (error.message.includes('Network')) return null // Network error
      }
      return event
    },
  })
}

app.mount('#app')
