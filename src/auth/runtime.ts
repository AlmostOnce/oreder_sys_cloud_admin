import type { SessionStorage } from './contracts.ts'
import { ApiClient } from './http.ts'
import { AuthSession } from './session.ts'

/** 使用浏览器 sessionStorage；非浏览器构建时使用当前运行周期内存。 */
const sessionStorageAdapter: SessionStorage =
  typeof window === 'undefined' ? createMemoryStorage() : window.sessionStorage

/** 所有页面与路由共享同一个认证协调器，避免重复创建刷新状态。 */
export const authSession = new AuthSession(
  new ApiClient(import.meta.env.VITE_API_BASE_URL || '/api'),
  sessionStorageAdapter,
)

/** 给非浏览器导入场景提供最小存储实现。 */
function createMemoryStorage(): SessionStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}
