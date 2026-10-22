import { createRouter, createWebHistory } from 'vue-router'
import { ADMIN_ROLE_CODES } from '../auth/policy.ts'
import { useAuthStore } from '../stores/auth.ts'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { requiresAuth: true, allowedRoles: ADMIN_ROLE_CODES },
    },
    {
      path: '/forbidden',
      name: 'forbidden',
      component: () => import('../views/ForbiddenView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
})

// 路由守卫负责页面导航；每个数据接口仍由服务端执行最终权限校验。
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.initialize()

  if (to.name === 'login') {
    if (auth.isAuthenticated) return { name: 'home', replace: true }
    return true
  }

  if (!to.meta.requiresAuth) return true
  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath }, replace: true }
  }

  const allowedRoles = to.meta.allowedRoles as readonly string[] | undefined
  if (allowedRoles && !allowedRoles.includes(auth.profile?.roleCode ?? '')) {
    return { name: 'forbidden', replace: true }
  }

  return true
})

export default router
