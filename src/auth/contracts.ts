/** 后端统一响应格式，与 common-response 的 code/message/data 保持一致。 */
export interface ApiEnvelope<T> {
  code: string
  message: string
  data: T | null
}

/** 登录和刷新接口返回的双令牌信息。 */
export interface TokenPair {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer' | string
  expiresIn: number
  refreshExpiresIn: number
}

/** 当前登录用户公开资料；角色取自经过网关认证的服务端响应。 */
export interface AdminProfile {
  /** 稳定的公开 UUID；不可转换为内部数字主键。 */
  userUuid: string
  /** 服务端分配的十位用户号，按字符串保留可能存在的前导零。 */
  userNo: string
  /** 仅用于展示的昵称，不作为登录账号。 */
  username: string
  roleCode: string
  email: string | null
  avatarUrl: string | null
  createdAt: string | null
}

/** 后端图片验证码响应；验证码答案本身从不下发。 */
export interface Captcha {
  captchaId: string
  imageBase64: string
  expiresIn: number
}

/** 登录表单提交到认证接口的字段。 */
export interface LoginCredentials {
  /** 十位用户号或邮箱；不再提交昵称 username。 */
  account: string
  password: string
  captchaId: string
  captchaCode: string
}

/** 浏览器会话中保存的令牌和到期时刻。 */
export interface StoredSession {
  accessToken: string
  refreshToken: string
  accessExpiresAt: number
  refreshExpiresAt: number
}

/** 注入到认证模块的最小存储接口，便于隔离浏览器环境。 */
export interface SessionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
