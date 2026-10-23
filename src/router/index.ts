import { createRouter, createWebHistory } from 'vue-router'
import {
  CATALOG_ALLOWED_ROLES,
  HOME_ALLOWED_ROLES,
  pageTitle,
  RESTAURANT_ALLOWED_ROLES,
} from '../admin/permissions.ts'
import { ADMIN_ROLE_CODES } from '../auth/policy.ts'
import { useAuthStore } from '../stores/auth.ts'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    {
      path: '/',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('../views/HomeView.vue'),
          meta: { allowedRoles: HOME_ALLOWED_ROLES },
        },
        {
          path: 'restaurants',
          name: 'restaurants',
          component: () => import('../views/RestaurantsView.vue'),
          meta: { allowedRoles: RESTAURANT_ALLOWED_ROLES },
        },
        {
          path: 'windows',
          name: 'windows',
          component: () => import('../views/WindowsView.vue'),
          meta: { allowedRoles: CATALOG_ALLOWED_ROLES },
        },
        {
          path: 'windows/:windowId/catalog',
          name: 'window-catalog',
          component: () => import('../views/WindowCatalogView.vue'),
          meta: { allowedRoles: CATALOG_ALLOWED_ROLES },
        },
      ],
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

/** 路由守卫只负责前端导航体验，服务端仍必须校验每个 API 请求。 */
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
  if (
    allowedRoles &&
    (!ADMIN_ROLE_CODES.includes(auth.profile?.roleCode as (typeof ADMIN_ROLE_CODES)[number]) ||
      !allowedRoles.includes(auth.profile?.roleCode ?? ''))
  ) {
    return { name: 'forbidden', replace: true }
  }

  return true
})

/** 路由切换后更新浏览器标题；登录页沿用既有认证标题样式。 */
router.afterEach((to) => {
  if (typeof document === 'undefined') return
  if (to.name === 'login') {
    document.title = '登录管理端 · 食堂运营平台'
    return
  }
  document.title = pageTitle(to.name) + ' — 校园点餐管理端'
})

export default router
