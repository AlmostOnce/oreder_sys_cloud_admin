<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { navigationForRole, pageTitle } from '../admin/permissions.ts'
import { roleLabel } from '../auth/policy.ts'
import { useAuthStore } from '../stores/auth.ts'
import BaseButton from '../components/BaseButton.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const navigationOpen = ref(false)
const accountMenuOpen = ref(false)
const navigationButton = ref<HTMLButtonElement | null>(null)
const sidebarElement = ref<HTMLElement | null>(null)
const roleName = computed(() => roleLabel(auth.profile?.roleCode ?? ''))
const navigation = computed(() => navigationForRole(auth.profile?.roleCode))
const title = computed(() => pageTitle(route.name))
const avatarInitial = computed(() => auth.profile?.username.trim().charAt(0).toUpperCase() || '管')

/** 切换页面后收起移动端导航和账号菜单，避免遮挡新页面内容。 */
watch(
  () => route.fullPath,
  () => {
    const shouldReturnFocus = navigationOpen.value
    navigationOpen.value = false
    accountMenuOpen.value = false
    if (shouldReturnFocus) {
      void nextTick(() => navigationButton.value?.focus())
    }
  },
)

/** 会话因刷新失败或主动注销而清除时，及时回到登录页并保留当前站内地址。 */
watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    if (!authenticated && auth.initialized && route.name !== 'login') {
      void router.replace({ name: 'login', query: { redirect: route.fullPath } })
    }
  },
)

/** 注销只有在后端确认后才清理会话；失败信息继续留在顶部菜单中。 */
async function logout(): Promise<void> {
  try {
    await auth.signOut()
    await router.replace({ name: 'login' })
  } catch {
    // 认证 Store 保留服务端错误说明，当前用户仍可重试。
  }
}

/** 按 Escape 关闭移动导航并将键盘焦点交还给打开按钮。 */
function onNavigationKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && navigationOpen.value) {
    closeNavigation()
    return
  }
  if (event.key === 'Tab' && navigationOpen.value) {
    const focusableItems = sidebarElement.value?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    )
    if (!focusableItems?.length) return
    const firstItem = focusableItems.item(0)
    const lastItem = focusableItems.item(focusableItems.length - 1)
    if (!firstItem || !lastItem) return
    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault()
      lastItem.focus()
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault()
      firstItem.focus()
    }
  }
}

/** 打开移动导航时将焦点移入菜单，关闭时交还给菜单按钮。 */
async function toggleNavigation(): Promise<void> {
  navigationOpen.value = !navigationOpen.value
  if (navigationOpen.value) {
    await nextTick()
    sidebarElement.value?.querySelector<HTMLElement>('a[href]')?.focus()
  } else {
    await nextTick()
    navigationButton.value?.focus()
  }
}

/** 从遮罩或 Escape 关闭移动导航并恢复焦点。 */
function closeNavigation(): void {
  navigationOpen.value = false
  void nextTick(() => navigationButton.value?.focus())
}
</script>

<template>
  <div class="operations-theme" @keydown="onNavigationKeydown">
    <button
      v-if="navigationOpen"
      class="ops-mobile-scrim"
      type="button"
      aria-label="关闭导航菜单"
      @click="closeNavigation"
    ></button>

    <aside
      id="admin-navigation"
      ref="sidebarElement"
      class="ops-sidebar"
      :class="{ 'is-open': navigationOpen }"
      aria-label="主导航"
    >
      <RouterLink class="ops-brand" :to="{ name: 'home' }">
        <span class="ops-brand__mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="ops-brand__copy">校园点餐<small>运营管理端</small></span>
      </RouterLink>

      <div class="ops-sidebar__caption">工作区</div>
      <nav class="ops-navigation" aria-label="运营管理">
        <RouterLink class="ops-nav-link" :to="{ name: 'home' }" exact-active-class="is-active">
          <span class="ops-nav-link__pin" aria-hidden="true"></span>
          <span>运营概览</span>
        </RouterLink>
        <RouterLink
          v-for="item in navigation"
          :key="item.name"
          class="ops-nav-link"
          :to="{ name: item.name }"
          :class="{
            'is-active':
              item.name === route.name ||
              (route.name === 'window-catalog' && item.name === 'windows'),
          }"
        >
          <span class="ops-nav-link__pin" aria-hidden="true"></span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="ops-sidebar__bottom">
        <span class="ops-sidebar__rule"></span>
        <p>角色和数据范围由业务服务校验。</p>
        <span class="ops-sidebar__edition">ORDER SYSTEM <i>·</i> ADMIN</span>
      </div>
    </aside>

    <div class="ops-shell" :inert="navigationOpen">
      <header class="ops-topbar">
        <button
          ref="navigationButton"
          class="ops-menu-trigger"
          type="button"
          :aria-expanded="navigationOpen"
          aria-controls="admin-navigation"
          @click="toggleNavigation"
        >
          <span class="ops-menu-trigger__glyph" aria-hidden="true"><i></i><i></i></span>
          <span class="ops-visually-hidden">{{ navigationOpen ? '关闭导航' : '打开导航' }}</span>
        </button>
        <div class="ops-topbar__context">
          <span class="ops-topbar__crumb">运营管理</span>
          <span class="ops-topbar__separator" aria-hidden="true">/</span>
          <span class="ops-topbar__title">{{ title }}</span>
        </div>
        <div class="ops-account">
          <button
            class="ops-account__trigger"
            type="button"
            :aria-expanded="accountMenuOpen"
            aria-controls="account-menu"
            @click="accountMenuOpen = !accountMenuOpen"
          >
            <span class="ops-account__avatar" aria-hidden="true">{{ avatarInitial }}</span>
            <span class="ops-account__identity">
              <strong>{{ auth.profile?.username }}</strong>
              <small>{{ roleName }}</small>
            </span>
            <span class="ops-account__chevron" aria-hidden="true"></span>
          </button>
          <div v-if="accountMenuOpen" id="account-menu" class="ops-account-menu">
            <div class="ops-account-menu__identity">
              <strong>{{ auth.profile?.username }}</strong>
              <span>{{ roleName }}</span>
            </div>
            <p v-if="auth.errorMessage" class="ops-account-menu__error" role="alert">
              {{ auth.errorMessage }}
            </p>
            <BaseButton variant="quiet" :loading="auth.busy" @click="logout"> 退出登录 </BaseButton>
          </div>
        </div>
      </header>

      <RouterView />
    </div>
  </div>
</template>
