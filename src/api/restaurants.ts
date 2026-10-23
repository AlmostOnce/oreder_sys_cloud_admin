import { authSession } from '../auth/runtime.ts'

/** 餐厅管理列表返回的业务视图，与后端 RestaurantAdminVO 对齐。 */
export interface RestaurantAdmin {
  restaurantId: number
  restaurantCode: string
  restaurantName: string
  location: string
  phone: string | null
  imageUrl: string | null
  notice: string | null
  sortOrder: number
  status: number
  createdAt: string | null
  updatedAt: string | null
}

/** 餐厅新建和更新共用的后端请求 DTO。 */
export interface RestaurantSaveRequest {
  restaurantCode: string
  restaurantName: string
  location: string
  phone: string | null
  imageUrl: string | null
  notice: string | null
  sortOrder: number | null
}

/** 读取当前 JWT 身份数据范围内可见的餐厅列表。 */
export function listRestaurants(signal?: AbortSignal): Promise<RestaurantAdmin[]> {
  return authSession.request<RestaurantAdmin[]>('/products/admin/restaurants', { signal })
}

/** 创建餐厅；平台范围仍由后端检查。 */
export function createRestaurant(request: RestaurantSaveRequest): Promise<RestaurantAdmin> {
  return authSession.request<RestaurantAdmin>('/products/admin/restaurants', {
    method: 'POST',
    body: request,
  })
}

/** 更新餐厅展示资料；字段级权限仍由后端检查。 */
export function updateRestaurant(
  restaurantId: number,
  request: RestaurantSaveRequest,
): Promise<RestaurantAdmin> {
  return authSession.request<RestaurantAdmin>('/products/admin/restaurants/' + restaurantId, {
    method: 'PUT',
    body: request,
  })
}

/** 停用餐厅；当前 API 没有对应的恢复接口。 */
export function disableRestaurant(restaurantId: number): Promise<null> {
  return authSession.request<null>('/products/admin/restaurants/' + restaurantId, {
    method: 'DELETE',
  })
}
