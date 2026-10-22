import type {
  AdminProfile,
  ApiEnvelope,
  Captcha,
  LoginCredentials,
  SessionStorage,
  StoredSession,
  TokenPair,
} from './contracts.ts'
import { ApiClient } from './http.ts'
import { ApiError, AuthenticationError } from './errors.ts'
import { canAccessAdmin } from './policy.ts'
import { clearSession, readSession, saveSession } from './storage.ts'

/** 认证状态公开快照不包含任何令牌，供 Pinia 与视图安全展示。 */
export interface AuthSnapshot {
  profile: AdminProfile | null
  authenticated: boolean
}

/** 管理端登录、身份恢复、令牌轮换与注销的唯一协调入口。 */
export class AuthSession {
  private session: StoredSession | null = null
  private profile: AdminProfile | null = null
  private revision = 0
  private refreshFlight: Promise<string> | null = null
  private restoreFlight: Promise<boolean> | null = null
  private readonly listeners = new Set<(snapshot: AuthSnapshot) => void>()

  constructor(
    private readonly api: ApiClient,
    private readonly storage: SessionStorage,
    private readonly now: () => number = Date.now,
  ) {}

  /** 订阅不含令牌的认证快照，并立即收到当前状态。 */
  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => this.listeners.delete(listener)
  }

  /** 获取新的图片验证码；验证码接口允许匿名访问。 */
  fetchCaptcha(): Promise<Captcha> {
    return this.api.request<Captcha>('/auth/captcha')
  }

  /** 使用账号、密码和一次性验证码建立管理端会话。 */
  async signIn(credentials: LoginCredentials): Promise<AdminProfile> {
    const revision = ++this.revision
    this.clearState(false)

    const tokens = await this.api.request<TokenPair>('/auth/login', {
      method: 'POST',
      body: credentials,
    })
    const nextSession = createStoredSession(tokens, this.now())
    this.session = nextSession
    saveSession(this.storage, nextSession)

    try {
      const profile = await this.fetchProfile()
      if (!canAccessAdmin(profile)) {
        await this.revokeCurrentSession(revision)
        throw new AuthenticationError('此账号属于顾客角色，不能登录管理端。')
      }
      if (revision !== this.revision) throw new AuthenticationError('登录状态已改变，请重新登录。')

      this.profile = profile
      this.emit()
      return profile
    } catch (error) {
      if (revision === this.revision) {
        await this.revokeCurrentSession(revision)
      }
      throw error
    }
  }

  /** 检查会话存储、续期临期令牌并从后端重新加载用户身份。 */
  restore(): Promise<boolean> {
    if (this.restoreFlight) return this.restoreFlight

    const task = this.restoreSession()
    this.restoreFlight = task
    void task
      .finally(() => {
        if (this.restoreFlight === task) this.restoreFlight = null
      })
      .catch(() => undefined)
    return task
  }

  /** 使用经授权的 JWT 访问业务 API，401 时刷新一次并重放原请求一次。 */
  async request<T>(
    path: string,
    options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
  ): Promise<T> {
    const revision = this.revision
    const accessToken = await this.getValidAccessToken()

    try {
      return await this.api.request<T>(path, { ...options, accessToken })
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error
      if (revision !== this.revision) throw new AuthenticationError('登录状态已改变，请重试。')

      const renewedToken =
        this.session?.accessToken !== accessToken
          ? this.session?.accessToken
          : await this.refreshAccessToken()
      if (!renewedToken) throw new AuthenticationError('登录已过期，请重新登录。')

      return this.api.request<T>(path, { ...options, accessToken: renewedToken })
    }
  }

  /** 撤销当前 Refresh Token，只有服务端确认后才清除本地状态。 */
  async signOut(): Promise<void> {
    const session = this.session ?? readSession(this.storage, this.now())
    if (!session) {
      this.clearState(true)
      return
    }

    const revision = this.revision
    const accessToken = await this.getValidAccessToken()
    await this.api.request<null>('/auth/logout', {
      method: 'POST',
      accessToken,
      body: { refreshToken: this.session?.refreshToken ?? session.refreshToken },
    })

    if (revision === this.revision) this.clearState(true)
  }

  /** 当前已登录身份；未初始化或无有效登录态时返回 null。 */
  currentProfile(): AdminProfile | null {
    return this.profile
  }

  /** 从本地和内存中同时移除身份与令牌。 */
  clear(): void {
    this.clearState(true)
  }

  /** 读取并校验服务端身份；失败会清除会话，避免页面误认为仍已登录。 */
  private async restoreSession(): Promise<boolean> {
    const stored = readSession(this.storage, this.now())
    if (!stored) {
      this.clearState(true)
      return false
    }

    const revision = ++this.revision
    this.session = stored
    try {
      const profile = await this.fetchProfile()
      if (revision !== this.revision) return false
      if (!canAccessAdmin(profile)) throw new AuthenticationError('该账号没有管理端访问权限。')

      this.profile = profile
      this.emit()
      return true
    } catch {
      if (revision === this.revision) this.clearState(true)
      return false
    }
  }

  /** 查询服务端资料，并用资料中的真实角色判定管理端访问资格。 */
  private async fetchProfile(): Promise<AdminProfile> {
    return this.request<AdminProfile>('/users/me/profile')
  }

  /** 在令牌临近过期时先执行单次共享刷新。 */
  private async getValidAccessToken(): Promise<string> {
    const session = this.session
    if (!session || session.refreshExpiresAt <= this.now()) {
      this.clearState(true)
      throw new AuthenticationError('登录已过期，请重新登录。')
    }

    if (session.accessExpiresAt - this.now() > 30_000) return session.accessToken
    return this.refreshAccessToken()
  }

  /** 同一时刻所有并发请求共享一次 Refresh Token 轮换。 */
  private refreshAccessToken(): Promise<string> {
    if (this.refreshFlight) return this.refreshFlight

    const task = this.performRefresh()
    this.refreshFlight = task
    void task
      .finally(() => {
        if (this.refreshFlight === task) this.refreshFlight = null
      })
      .catch(() => undefined)
    return task
  }

  /** 调用后端刷新接口并原子替换本地双令牌。 */
  private async performRefresh(): Promise<string> {
    const previous = this.session ?? readSession(this.storage, this.now())
    if (!previous || previous.refreshExpiresAt <= this.now()) {
      this.clearState(true)
      throw new AuthenticationError('登录已过期，请重新登录。')
    }

    const revision = this.revision
    try {
      const tokens = await this.api.request<TokenPair>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: previous.refreshToken },
      })
      if (revision !== this.revision) throw new AuthenticationError('登录状态已改变，请重新登录。')

      const next = createStoredSession(tokens, this.now())
      this.session = next
      saveSession(this.storage, next)
      return next.accessToken
    } catch (error) {
      if (revision === this.revision) this.clearState(true)
      throw error
    }
  }

  /** 注销角色不允许访问管理端的新会话，失败也不留下可用的前端身份。 */
  private async revokeCurrentSession(revision: number): Promise<void> {
    const session = this.session
    try {
      if (session) {
        await this.api.request<null>('/auth/logout', {
          method: 'POST',
          accessToken: session.accessToken,
          body: { refreshToken: session.refreshToken },
        })
      }
    } catch {
      // 角色门禁已在前端拒绝；撤销失败时仍必须清除本地敏感令牌。
    } finally {
      if (revision === this.revision) this.clearState(true)
    }
  }

  /** 发布公开快照；订阅者永远拿不到 Token。 */
  private emit(): void {
    const snapshot = this.snapshot()
    this.listeners.forEach((listener) => listener(snapshot))
  }

  /** 构造无 Token 的视图状态。 */
  private snapshot(): AuthSnapshot {
    return { profile: this.profile, authenticated: this.profile !== null }
  }

  /** 清空内存身份与令牌，并按调用方要求更新会话版本。 */
  private clearState(invalidateRequests: boolean): void {
    if (invalidateRequests) this.revision += 1
    this.session = null
    this.profile = null
    clearSession(this.storage)
    this.emit()
  }
}

/** 校验后端令牌响应并计算绝对有效期。 */
function createStoredSession(tokens: TokenPair, now: number): StoredSession {
  const hasValidTokens =
    typeof tokens.accessToken === 'string' &&
    tokens.accessToken.length > 0 &&
    typeof tokens.refreshToken === 'string' &&
    tokens.refreshToken.length > 0
  const hasValidExpiry =
    Number.isFinite(tokens.expiresIn) &&
    tokens.expiresIn > 0 &&
    Number.isFinite(tokens.refreshExpiresIn) &&
    tokens.refreshExpiresIn > 0

  if (!hasValidTokens || !hasValidExpiry) {
    throw new AuthenticationError('认证服务返回的令牌信息不完整，请稍后重试。')
  }

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: now + tokens.expiresIn * 1000,
    refreshExpiresAt: now + tokens.refreshExpiresIn * 1000,
  }
}
