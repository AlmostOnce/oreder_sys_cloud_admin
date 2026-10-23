/** 管理端导航、页面标题和页面访问名单的唯一配置来源。 */
export type AdminRole = 'STALL_MANAGER' | 'RESTAURANT_MANAGER' | 'GENERAL_MANAGER' | 'SYSTEM_ADMIN'

/** 一个真实可访问的运营页面入口。 */
export interface AdminNavigationItem {
  name: string
  label: string
  description: string
  allowedRoles: readonly AdminRole[]
}

/** 后端餐厅管理 Controller 当前允许的角色。 */
export const RESTAURANT_ALLOWED_ROLES: readonly AdminRole[] = [
  'RESTAURANT_MANAGER',
  'GENERAL_MANAGER',
]

/** 后端档口、分类、菜品管理 Controller 当前允许的角色。 */
export const WINDOW_ALLOWED_ROLES: readonly AdminRole[] = ['STALL_MANAGER', 'RESTAURANT_MANAGER']

/** 页面角色矩阵；路由和侧栏都从该配置派生，避免权限文案分叉。 */
export const ADMIN_NAVIGATION: readonly AdminNavigationItem[] = [
  {
    name: 'restaurants',
    label: '餐厅管理',
    description: '维护当前账号范围内的餐厅资料。',
    allowedRoles: RESTAURANT_ALLOWED_ROLES,
  },
  {
    name: 'windows',
    label: '档口管理',
    description: '维护档口资料、启停状态与营业状态。',
    allowedRoles: WINDOW_ALLOWED_ROLES,
  },
]

/** 菜单与档口共用同一组角色边界，后端仍会再次校验具体数据范围。 */
export const CATALOG_ALLOWED_ROLES = WINDOW_ALLOWED_ROLES

/** 所有运营人员可以进入首页，具体业务操作由业务服务授权。 */
export const HOME_ALLOWED_ROLES: readonly AdminRole[] = [
  'STALL_MANAGER',
  'RESTAURANT_MANAGER',
  'GENERAL_MANAGER',
  'SYSTEM_ADMIN',
]

/** 将后端角色编码限制为当前管理端已知角色。 */
export function asAdminRole(roleCode: string | undefined): AdminRole | null {
  if (
    roleCode === 'STALL_MANAGER' ||
    roleCode === 'RESTAURANT_MANAGER' ||
    roleCode === 'GENERAL_MANAGER' ||
    roleCode === 'SYSTEM_ADMIN'
  ) {
    return roleCode
  }
  return null
}

/** 判断角色是否出现在指定页面授权矩阵中。 */
export function roleCanAccess(
  roleCode: string | undefined,
  allowedRoles: readonly AdminRole[],
): boolean {
  const role = asAdminRole(roleCode)
  return role !== null && allowedRoles.includes(role)
}

/** 返回角色可以访问的真实导航入口，不提供暂缺后端支持的伪页面。 */
export function navigationForRole(roleCode: string | undefined): AdminNavigationItem[] {
  return ADMIN_NAVIGATION.filter((item) => roleCanAccess(roleCode, item.allowedRoles))
}

/** 将页面路由名称转换为运营端标题。 */
export function pageTitle(routeName: unknown): string {
  const item = ADMIN_NAVIGATION.find((entry) => entry.name === routeName)
  if (item) return item.label
  if (routeName === 'window-catalog') return '菜单管理'
  if (routeName === 'forbidden') return '无权访问'
  if (routeName === 'not-found') return '页面不存在'
  return '运营概览'
}
