import type { SessionStorage, StoredSession } from './contracts.ts'

/** 管理端会话存储键；按版本命名以便未来安全调整时整体失效。 */
export const SESSION_STORAGE_KEY = 'order-admin-session-v1'

/** 将令牌写入当前标签页的 sessionStorage，关闭标签页后自动清除。 */
export function saveSession(storage: SessionStorage, session: StoredSession): void {
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

/** 读取并校验已保存的会话，损坏、缺字段或已过期时一律返回空。 */
export function readSession(storage: SessionStorage, now = Date.now()): StoredSession | null {
  const serialized = storage.getItem(SESSION_STORAGE_KEY)

  if (!serialized) return null

  try {
    const value: unknown = JSON.parse(serialized)
    if (!isStoredSession(value)) {
      clearSession(storage)
      return null
    }

    if (value.refreshExpiresAt <= now) {
      clearSession(storage)
      return null
    }

    return value
  } catch {
    clearSession(storage)
    return null
  }
}

/** 删除本标签页保存的访问令牌与刷新令牌。 */
export function clearSession(storage: SessionStorage): void {
  storage.removeItem(SESSION_STORAGE_KEY)
}

/** 确认未知 JSON 对象完整符合本地会话结构。 */
function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false

  const session = value as Partial<StoredSession>
  return (
    typeof session.accessToken === 'string' &&
    session.accessToken.length > 0 &&
    typeof session.refreshToken === 'string' &&
    session.refreshToken.length > 0 &&
    typeof session.accessExpiresAt === 'number' &&
    Number.isFinite(session.accessExpiresAt) &&
    typeof session.refreshExpiresAt === 'number' &&
    Number.isFinite(session.refreshExpiresAt)
  )
}
