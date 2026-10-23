import type { ApiEnvelope } from './contracts.ts'
import { ApiError } from './errors.ts'

/** 请求层仅依赖 fetch 注入，支持浏览器运行和隔离的单元验证。 */
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/** 向管理端 API 发送请求，并校验 HTTP 状态与后端业务状态码。 */
export class ApiClient {
  constructor(
    private readonly baseUrl = '/api',
    private readonly fetcher: FetchLike = globalThis.fetch.bind(globalThis),
  ) {}

  /** 请求 JSON 或 multipart 接口；Bearer 令牌只通过 Authorization 请求头发送。 */
  async request<T>(
    path: string,
    options: {
      method?: string
      body?: unknown
      accessToken?: string
      signal?: AbortSignal
    } = {},
  ): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' })

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
    if (options.body !== undefined && !isFormData) {
      headers.set('Content-Type', 'application/json')
    }
    if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`)

    let response: Response
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body:
          options.body === undefined
            ? undefined
            : isFormData
              ? (options.body as FormData)
              : JSON.stringify(options.body),
        signal: options.signal,
        cache: 'no-store',
      })
    } catch {
      throw new ApiError('网络连接失败，请检查网关是否已启动后重试。', 0)
    }

    const envelope = await readEnvelope<T>(response)
    if (!response.ok) {
      throw new ApiError(
        envelope.message || statusMessage(response.status),
        response.status,
        envelope.code,
      )
    }
    if (envelope.code !== 'COMMON_000') {
      throw new ApiError(
        envelope.message || '请求未成功，请稍后重试。',
        response.status,
        envelope.code,
      )
    }
    // Void endpoints such as logout legitimately return data: null.
    return envelope.data as T
  }
}

/** 尽可能解析统一响应；非 JSON 网关错误仍转换成可读的 HTTP 异常。 */
async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try {
    return (await response.json()) as ApiEnvelope<T>
  } catch {
    return {
      code: `HTTP_${response.status}`,
      message: statusMessage(response.status),
      data: null,
    }
  }
}

/** 为没有后端 message 的错误响应提供简短中文提示。 */
function statusMessage(status: number): string {
  if (status === 401) return '登录已过期，请重新登录。'
  if (status === 403) return '当前账号没有执行此操作的权限。'
  if (status === 429) return '操作过于频繁，请稍后再试。'
  if (status >= 500) return '服务暂时不可用，请稍后重试。'
  return `请求失败（HTTP ${status}），请检查输入后重试。`
}
