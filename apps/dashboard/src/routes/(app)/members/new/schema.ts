import { z } from 'zod'
import { m } from '$lib/paraglide/messages.js'
import { type GroupKind, isRoleAllowedInGroup, ROLES } from '$lib/roles'

// メンバーの招待フォームの検証。クライアントとサーバーの両方から使うため、
// サーバー限定のモジュール（$lib/server/*）には依存しない。
// グループの一覧は本部・店舗の判定に使うだけで、選べる groupId の集合そのものにも使う
// （存在しない・アクセスできないグループを弾くため）
export function inviteSchema(groups: { id: string; kind: GroupKind }[]) {
  const groupIds = groups.map((g) => g.id)
  return z
    .object({
      email: z
        .string()
        .trim()
        .min(1, m.members_error_email_required())
        .email(m.members_error_email_required()),
      name: z.string().trim().default(''),
      title: z.string().trim().default(''),
      groupId:
        groupIds.length > 0
          ? z
              .enum(
                groupIds as [string, ...string[]],
                m.members_error_group_required(),
              )
              // 本部を先頭に並べた一覧の先頭（本部）を既定で選ぶ
              .default(groupIds[0] as string)
          : z.string().min(1, m.members_error_group_required()),
      role: z.enum(ROLES, m.members_error_role_required()).default('viewer'),
    })
    .superRefine((values, ctx) => {
      const group = groups.find((g) => g.id === values.groupId)
      if (group && !isRoleAllowedInGroup(group.kind, values.role)) {
        ctx.addIssue({
          code: 'custom',
          path: ['role'],
          message: m.members_error_store_viewer_only(),
        })
      }
    })
}

export type InviteSchema = ReturnType<typeof inviteSchema>
