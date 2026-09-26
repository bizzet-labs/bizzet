import { type Db, eq, groups } from '@bizzet/db'
import { error } from '@sveltejs/kit'
import { m } from '$lib/paraglide/messages.js'
import type { Member } from './auth'
import { canSeeGroup, type Group } from './visibility'

// ログインしていなければ 401 にする
export function requireMember(member: App.Locals['member']) {
  if (!member) error(401)
  return member
}

// メンバーの管理（一覧・招待）は Owner だけが行える
export function requireOwner(member: App.Locals['member']) {
  const owner = requireMember(member)
  if (owner.role !== 'owner') {
    error(403, m.common_error_forbidden())
  }
  return owner
}

// 見られないグループは、存在も分からないよう 404 にする
export async function requireVisibleGroup(
  db: Db,
  member: Member,
  id: string,
): Promise<Group> {
  if (!(await canSeeGroup(db, member, id))) {
    error(404, m.common_error_not_found())
  }
  const group = await db.query.groups.findFirst({ where: eq(groups.id, id) })
  if (!group) error(404, m.common_error_not_found())
  return group
}
