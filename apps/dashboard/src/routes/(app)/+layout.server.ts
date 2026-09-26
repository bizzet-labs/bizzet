import { eq, groups } from '@bizzet/db'
import { isDemoMode } from '$lib/server/demo'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
  const member = locals.member
  const demoMode = isDemoMode()
  if (!member) return { member: null, groupName: '', demoMode }
  const group = await locals.db.query.groups.findFirst({
    where: eq(groups.id, member.groupId),
  })
  return {
    member: { email: member.email, name: member.name, role: member.role },
    groupName: group?.name ?? '',
    demoMode,
  }
}
