import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AdminProfile, LoginCredentials } from '../auth/contracts.ts'
import { authSession } from '../auth/runtime.ts'

/** 页面共享的认证状态；Pinia 中只保存资料，不保存 JWT 字符串。 */
export const useAuthStore = defineStore('auth', () => {
  const profile = ref<AdminProfile | null>(null)
  const initialized = ref(false)
  const busy = ref(false)
  const errorMessage = ref('')
  let initialization: Promise<boolean> | null = null

  // 认证协调器只向 Pinia 推送不含令牌的快照。
  authSession.subscribe((snapshot) => {
    profile.value = snapshot.profile
  })

  /** 在路由判权前恢复一次服务端确认的身份。 */
  async function initialize(): Promise<boolean> {
    if (initialized.value) return profile.value !== null
    if (initialization) return initialization

    const task = authSession.restore().finally(() => {
      initialized.value = true
      initialization = null
    })
    initialization = task
    return task
  }

  /** 登录并从服务端确认角色，防止顾客账号进入管理端。 */
  async function signIn(credentials: LoginCredentials): Promise<AdminProfile> {
    busy.value = true
    errorMessage.value = ''
    try {
      return await authSession.signIn(credentials)
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : '登录失败，请检查账号信息后重试。'
      throw error
    } finally {
      busy.value = false
    }
  }

  /** 注销操作失败时保留现有会话，并展示可恢复错误。 */
  async function signOut(): Promise<void> {
    busy.value = true
    errorMessage.value = ''
    try {
      await authSession.signOut()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '注销未完成，请重试。'
      throw error
    } finally {
      busy.value = false
    }
  }

  /** 清空过期会话后统一由路由回到登录页。 */
  function expireSession(): void {
    authSession.clear()
    profile.value = null
    errorMessage.value = '登录状态已失效，请重新登录。'
  }

  /** 读取登录成功后的身份资料。 */
  const isAuthenticated = computed(() => profile.value !== null)

  return {
    profile,
    initialized,
    busy,
    errorMessage,
    isAuthenticated,
    initialize,
    signIn,
    signOut,
    expireSession,
  }
})
