import { randomBytes } from 'node:crypto'
import { and, type Db, eq, gt, invitations, isNull } from '@bizzet/db'
import { env } from '$env/dynamic/public'
import type { Member } from './member'

// パスワードの追加用リンクの有効期限。発行した本人がすぐにパソコンで開く前提で短くする
export const ADD_PASSWORD_TTL_MS = 60 * 60 * 1000
const DEFAULT_DASHBOARD_URL = 'http://localhost:5174'

// 追加用リンクはダッシュボードの /invite/{token} で開き、パスワードを決める
export function dashboardInviteUrl(token: string, base?: string) {
  const origin = (base || DEFAULT_DASHBOARD_URL).replace(/\/+$/, '')
  return `${origin}/invite/${token}`
}

function toLink(invitation: { token: string; expiresAt: Date }) {
  return {
    url: dashboardInviteUrl(invitation.token, env.PUBLIC_DASHBOARD_URL),
    expiresAt: invitation.expiresAt.toISOString(),
  }
}

// 発行済みで期限内の未使用のリンク。画面を開き直しても同じリンクを見せる
export async function findOpenPasswordLink(db: Db, member: Member) {
  if (member.userId) return null
  const open = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.kind, 'add_password'),
      eq(invitations.memberId, member.id),
      isNull(invitations.usedAt),
      gt(invitations.expiresAt, new Date()),
    ),
  })
  return open ? toLink(open) : null
}

// パスワードの追加用リンクを発行する。前に発行した未使用のリンクは無効にする
export async function issuePasswordLink(db: Db, member: Member) {
  await db
    .delete(invitations)
    .where(
      and(
        eq(invitations.kind, 'add_password'),
        eq(invitations.memberId, member.id),
        isNull(invitations.usedAt),
      ),
    )
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + ADD_PASSWORD_TTL_MS)
  await db.insert(invitations).values({
    token,
    kind: 'add_password',
    memberId: member.id,
    email: member.email,
    groupId: member.groupId,
    role: member.role,
    invitedBy: member.id,
    expiresAt,
  })
  return toLink({ token, expiresAt })
}
