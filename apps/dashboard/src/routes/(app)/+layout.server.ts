import { eq, groups } from '@bizzet/db'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
  const member = locals.member
  if (!member) return { member: null, groupName: '' }
  const group = await locals.db.query.groups.findFirst({
    where: eq(groups.id, member.groupId),
  })
  return {
    member: { email: member.email, name: member.name, role: member.role },
    groupName: group?.name ?? '',
  }
}
