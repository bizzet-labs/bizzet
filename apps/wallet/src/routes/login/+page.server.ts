import { eq, groups, isNotNull, members } from '@bizzet/db'
import { isDemoMode } from '$lib/server/demo'
import type { PageServerLoad } from './$types'

// デモモードでは、パスキーを登録したメンバーを選んでログインできるよう一覧を渡す
export const load: PageServerLoad = async ({ locals }) => {
  if (!isDemoMode()) return { demoMembers: null }
  const rows = await locals.db
    .select({
      id: members.id,
      name: members.name,
      email: members.email,
      role: members.role,
      groupName: groups.name,
    })
    .from(members)
    .innerJoin(groups, eq(groups.id, members.groupId))
    .where(isNotNull(members.passkeyId))
  return {
    demoMembers: rows.map((r) => ({
      id: r.id,
      name: r.name || r.email,
      role: r.role,
      groupName: r.groupName,
    })),
  }
}
