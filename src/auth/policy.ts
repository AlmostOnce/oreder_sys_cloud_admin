import type { AdminProfile } from './contracts.ts'

/** 管理端当前开放的业务管理角色，与后端 RoleCode 保持一致。 */
export const ADMIN_ROLE_CODES = [
  'STALL_MANAGER',
  'RESTAURANT_MANAGER',
  'GENERAL_MANAGER',
  'SYSTEM_ADMIN',
] as const

/** 判断服务端返回的用户资料是否允许进入管理端。 */
export function canAccessAdmin(profile: AdminProfile): boolean {
  return ADMIN_ROLE_CODES.includes(profile.roleCode as (typeof ADMIN_ROLE_CODES)[number])
}

/** 将后端角色编码转换成管理端可读名称。 */
export function roleLabel(roleCode: string): string {
  const labels: Record<string, string> = {
    STALL_MANAGER: '档口负责人',
    RESTAURANT_MANAGER: '餐厅经理',
    GENERAL_MANAGER: '总经理',
    SYSTEM_ADMIN: '系统管理员',
    CUSTOMER: '顾客',
  }

  return labels[roleCode] ?? '未知角色'
}
