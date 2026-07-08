import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ComoUsarView from '../views/ComoUsarView.vue'
import NosotrosView from '../views/NosotrosView.vue'
import AuthView from '../views/AuthView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
import AgentesView from '../views/AgentesView.vue'
import AgenteDetalleView from '../views/AgenteDetalleView.vue'
import DynamicSectionView from '../views/DynamicSectionView.vue'
import DetailView from '../views/DetailView.vue'
import { useAuthStore } from '../stores/authStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/como-usar',
      name: 'como-usar',
      component: ComoUsarView,
    },
    {
      path: '/nosotros',
      name: 'nosotros',
      component: NosotrosView,
    },
    {
      path: '/auth',
      name: 'auth',
      component: AuthView,
    },
    {
      path: '/admin-login',
      name: 'admin-login',
      component: AdminLoginView,
    },
    {
      path: '/agentes',
      name: 'agentes',
      component: AgentesView,
    },
    {
      path: '/agentes/:id',
      name: 'agente-detalle',
      component: AgenteDetalleView,
    },
    // Dynamic sections for Hub Colibri
    {
      path: '/cursos',
      name: 'cursos',
      component: DynamicSectionView,
      props: { sectionId: 'cursos', parentHub: 'colibri' }
    },
    {
      path: '/ecotecnias',
      name: 'ecotecnias',
      component: DynamicSectionView,
      props: { sectionId: 'ecotecnias', parentHub: 'colibri' }
    },
    {
      path: '/agua',
      name: 'agua',
      component: DynamicSectionView,
      props: { sectionId: 'agua', parentHub: 'colibri' }
    },
    {
      path: '/lecturas',
      name: 'lecturas',
      component: DynamicSectionView,
      props: { sectionId: 'lecturas', parentHub: 'colibri' }
    },
    {
      path: '/documentales',
      name: 'documentales',
      component: DynamicSectionView,
      props: { sectionId: 'documentales', parentHub: 'colibri' }
    },
    {
      path: '/firmas',
      name: 'firmas',
      component: DynamicSectionView,
      props: { sectionId: 'firmas', parentHub: 'colibri' }
    },
    {
      path: '/eco-tecnologia',
      name: 'eco-tecnologia',
      component: DynamicSectionView,
      props: { sectionId: 'eco-tecnologia', parentHub: 'colibri' }
    },
    // Dynamic sections for Hub Ajolote
    {
      path: '/voluntariados',
      name: 'voluntariados',
      component: DynamicSectionView,
      props: { sectionId: 'voluntariados', parentHub: 'ajolote' }
    },
    {
      path: '/convocatoria',
      name: 'convocatoria',
      component: DynamicSectionView,
      props: { sectionId: 'convocatoria', parentHub: 'ajolote' }
    },
    {
      path: '/causas',
      name: 'causas',
      component: DynamicSectionView,
      props: { sectionId: 'causas', parentHub: 'ajolote' }
    },
    // Dynamic sections for Hub Lobo
    {
      path: '/normativa',
      name: 'normativa',
      component: DynamicSectionView,
      props: { sectionId: 'normativa', parentHub: 'lobo' }
    },
    {
      path: '/fondos',
      name: 'fondos',
      component: DynamicSectionView,
      props: { sectionId: 'fondos', parentHub: 'lobo' }
    },
    // Detailed views (CDMX Style)
    {
      path: '/eventos/:id',
      name: 'evento-detalle',
      component: DetailView
    },
    {
      path: '/lugares/:id',
      name: 'lugar-detalle',
      component: DetailView
    },
    {
      path: '/causas/:id',
      name: 'causa-detalle',
      component: DetailView
    },
    {
      path: '/eco-tecnologia/:id',
      name: 'eco-tecnologia-detalle',
      component: DetailView
    },
    {
      path: '/lugares',
      name: 'lugares',
      component: () => import('../views/LugaresView.vue')
    },
    // Special Pages & Configurations
    {
      path: '/mapa',
      name: 'mapa',
      component: () => import('../views/MapaView.vue')
    },
    {
      path: '/favoritos',
      name: 'favoritos',
      component: () => import('../views/FavoritosView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('../views/ResetPasswordView.vue')
    },
    {
      path: '/guia-usuario',
      name: 'guia-usuario',
      component: () => import('../views/GuiaUsuarioView.vue')
    },
    {
      path: '/guia-actor',
      name: 'guia-actor',
      component: () => import('../views/GuiaActorView.vue')
    },
    // Admin View
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'actor'] }
    },
    // Admin Edit Redirect
    {
      path: '/admin/editar/:tipo/:id',
      redirect: to => {
        const tipo = to.params.tipo as string
        const id = to.params.id as string
        let section = 'eventos'
        if (tipo === 'lugar') section = 'lugares'
        else if (tipo === 'causa') section = 'causas'
        return {
          path: '/admin',
          query: {
            tab: 'tabla-seccion',
            section: section,
            action: 'edit',
            id: id
          }
        }
      }
    },
    // Volunteer Profile View
    {
      path: '/mi-perfil',
      name: 'mi-perfil',
      component: () => import('../views/MiPerfilVoluntarioView.vue'),
      meta: { requiresAuth: true }
    },
    // Super Eventos Views
    {
      path: '/super-eventos',
      name: 'super-eventos',
      component: () => import('../views/SuperEventosView.vue')
    },
    {
      path: '/super-eventos/:id',
      name: 'super-evento-detalle',
      component: () => import('../views/SuperEventoDetalleView.vue')
    }
  ],
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0, behavior: 'smooth' }
  }
})

// ⚠️ IMPORTANTE: Este guardián es SOLO para UX (evitar clicks a rutas protegidas)
// El control de acceso REAL está en RLS de Supabase.
// Si un usuario hace un POST directo a /api/admin, Supabase lo rechazará.
router.beforeEach(async (to, from) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const allowedRoles = to.meta.roles as string[] | undefined

  if (requiresAuth) {
    const authStore = useAuthStore()
    if (authStore.loading) {
      await authStore.init()
    }

    if (!authStore.user) {
      return { name: 'auth', query: { tab: 'login', redirect: to.fullPath } }
    } else if (allowedRoles && (!authStore.profile?.rol || !allowedRoles.includes(authStore.profile.rol))) {
      return { name: 'home' }
    }
  }
})

export default router

