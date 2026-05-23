import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ComoUsarView from '../views/ComoUsarView.vue'
import NosotrosView from '../views/NosotrosView.vue'
import AuthView from '../views/AuthView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'

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
    }
  ],
})

export default router

