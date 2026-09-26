// ロールとグループの種類。DB のスキーマから直接importせず、クライアントのフォーム検証からも
// サーバー側のロジックからも安全に使える形でここに定義する

export const ROLES = ['owner', 'approver', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export type GroupKind = 'headquarters' | 'store'

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.includes(value as Role)
}

// 店舗のグループに割り当てられるのは Viewer だけ（Owner と Approver は本部の Safe のオーナーになるため）
export function isRoleAllowedInGroup(kind: GroupKind, role: Role) {
  return kind === 'headquarters' || role === 'viewer'
}
