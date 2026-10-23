import { authSession } from '../auth/runtime.ts'

/** 文件服务上传成功后返回的公开视图，与 FileUploadVO 对齐。 */
export interface FileUploadResult {
  fileKey: string
  url: string
  originalName: string
  fileExt: string
  contentType: string
  fileSize: number
}

/** 上传文件时后端要求的业务归属类型。 */
export type ImageBusinessType = 'WINDOW_IMAGE' | 'PRODUCT_IMAGE'

/** 先登记上传文件及业务归属，再由商品服务执行实体绑定。 */
export async function uploadManagedImage(
  file: File,
  bizType: ImageBusinessType,
  bizRef: number,
): Promise<FileUploadResult> {
  const body = new FormData()
  body.append('file', file)
  body.append('bizType', bizType)
  body.append('bizRef', String(bizRef))
  return authSession.request<FileUploadResult>('/files/upload', {
    method: 'POST',
    body,
  })
}

/** 绑定失败后尝试逻辑删除本次新上传的文件。 */
export function deleteManagedFile(fileKey: string): Promise<null> {
  return authSession.request<null>('/files/' + encodeURIComponent(fileKey), {
    method: 'DELETE',
  })
}

/** 规范化由网关返回的相对图片访问地址。 */
export function imageContentUrl(url: string | null): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return url.startsWith('/') ? url : '/' + url
}

/** 判断已保存的图片地址是否指向本次上传文件，用于对账结果不确定的绑定请求。 */
export function imageUrlUsesFileKey(url: string | null, fileKey: string): boolean {
  if (!url || !fileKey) return false
  try {
    // 使用固定基址解析相对地址，只比较路径，不依赖前端和网关使用相同主机名。
    const pathname = new URL(url, 'http://order-admin.invalid').pathname.replace(/\/+$/, '')
    return pathname.endsWith('/files/' + fileKey + '/content')
  } catch {
    return false
  }
}
