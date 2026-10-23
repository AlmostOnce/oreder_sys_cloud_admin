import { authSession } from '../auth/runtime.ts'

/** 档口管理接口的返回视图，与后端 WindowAdminVO 保持一致。 */
export interface WindowAdmin {
  windowId: number
  restaurantId: number
  windowCode: string
  windowName: string
  description: string | null
  sortOrder: number
  location: string | null
  imageUrl: string | null
  status: number
  isOpen: number
  createdAt: string | null
  updatedAt: string | null
}

/** 档口新建/更新 DTO；状态与是否营业是两个不同业务字段。 */
export interface WindowSaveRequest {
  restaurantId: number
  windowCode: string
  windowName: string
  description: string | null
  sortOrder: number
  location: string | null
  imageUrl: string | null
  status: number
  isOpen: number
}

/** 菜品分类管理列表的返回视图。 */
export interface ProductCategoryAdmin {
  categoryId: number
  windowId: number
  categoryName: string
  sortOrder: number
  status: number
  createdAt: string | null
  updatedAt: string | null
}

/** 分类新建/更新 DTO。 */
export interface CategorySaveRequest {
  categoryName: string
  sortOrder: number
  status: number
}

/** 菜品管理列表的返回视图。 */
export interface ProductAdmin {
  productId: number
  windowId: number
  categoryId: number | null
  productCode: string
  productName: string
  description: string | null
  imageUrl: string | null
  price: number
  saleStatus: number
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
}

/** 菜品新建/更新 DTO。 */
export interface ProductSaveRequest {
  categoryId: number | null
  productCode: string
  productName: string
  description: string | null
  imageUrl: string | null
  price: number
  saleStatus: number
  sortOrder: number
}

/** 读取当前操作者数据范围内的档口列表。 */
export function listWindows(signal?: AbortSignal): Promise<WindowAdmin[]> {
  return authSession.request<WindowAdmin[]>('/products/admin/windows', { signal })
}

/** 新建档口；服务端校验目标餐厅是否属于操作者的数据范围。 */
export function createWindow(request: WindowSaveRequest): Promise<WindowAdmin> {
  return authSession.request<WindowAdmin>('/products/admin/windows', {
    method: 'POST',
    body: request,
  })
}

/** 更新档口资料；服务端再次校验档口与目标餐厅的归属关系。 */
export function updateWindow(windowId: number, request: WindowSaveRequest): Promise<WindowAdmin> {
  return authSession.request<WindowAdmin>('/products/admin/windows/' + windowId, {
    method: 'PUT',
    body: request,
  })
}

/** 停用档口而非物理删除。 */
export function disableWindow(windowId: number): Promise<null> {
  return authSession.request<null>('/products/admin/windows/' + windowId, { method: 'DELETE' })
}

/** 读取指定档口下的全部管理分类。 */
export function listCategories(
  windowId: number,
  signal?: AbortSignal,
): Promise<ProductCategoryAdmin[]> {
  return authSession.request<ProductCategoryAdmin[]>(
    '/products/admin/windows/' + windowId + '/categories',
    { signal },
  )
}

/** 在指定档口内创建分类。 */
export function createCategory(
  windowId: number,
  request: CategorySaveRequest,
): Promise<ProductCategoryAdmin> {
  return authSession.request<ProductCategoryAdmin>(
    '/products/admin/windows/' + windowId + '/categories',
    { method: 'POST', body: request },
  )
}

/** 更新分类展示和启用状态。 */
export function updateCategory(
  categoryId: number,
  request: CategorySaveRequest,
): Promise<ProductCategoryAdmin> {
  return authSession.request<ProductCategoryAdmin>('/products/admin/categories/' + categoryId, {
    method: 'PUT',
    body: request,
  })
}

/** 停用分类；接口不会物理删除数据库记录。 */
export function disableCategory(categoryId: number): Promise<null> {
  return authSession.request<null>('/products/admin/categories/' + categoryId, {
    method: 'DELETE',
  })
}

/** 读取指定档口的菜品列表。 */
export function listProducts(windowId: number, signal?: AbortSignal): Promise<ProductAdmin[]> {
  return authSession.request<ProductAdmin[]>('/products/admin/windows/' + windowId + '/products', {
    signal,
  })
}

/** 在指定档口创建菜品。 */
export function createProduct(
  windowId: number,
  request: ProductSaveRequest,
): Promise<ProductAdmin> {
  return authSession.request<ProductAdmin>('/products/admin/windows/' + windowId + '/products', {
    method: 'POST',
    body: request,
  })
}

/** 更新菜品资料，允许通过 saleStatus 恢复在售状态。 */
export function updateProduct(
  productId: number,
  request: ProductSaveRequest,
): Promise<ProductAdmin> {
  return authSession.request<ProductAdmin>('/products/admin/products/' + productId, {
    method: 'PUT',
    body: request,
  })
}

/** 下架菜品而非物理删除。 */
export function takeProductOffSale(productId: number): Promise<null> {
  return authSession.request<null>('/products/admin/products/' + productId, {
    method: 'DELETE',
  })
}

/** 将已有受控上传文件绑定为档口图片。 */
export function bindWindowImage(windowId: number, fileKey: string): Promise<WindowAdmin> {
  return authSession.request<WindowAdmin>('/products/admin/windows/' + windowId + '/image', {
    method: 'PUT',
    body: { fileKey },
  })
}

/** 将已有受控上传文件绑定为菜品图片。 */
export function bindProductImage(productId: number, fileKey: string): Promise<ProductAdmin> {
  return authSession.request<ProductAdmin>('/products/admin/products/' + productId + '/image', {
    method: 'PUT',
    body: { fileKey },
  })
}
