import { and, eq, gt, invitations, isNull } from '@bizzet/db'
import { fail } from '@sveltejs/kit'
import { requireOwner } from '$lib/server/guards'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  requireOwner(locals.member)
  const db = locals.db

  const [groups, members, openInvitations] = await Promise.all([
    db.query.groups.findMany(),
    db.query.members.findMany(),
    db.query.invitations.findMany({
      where: and(
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    }),
  ])

  // 本部を先に、同じ種類の中は作成順に並べる
  const sortedGroups = [...groups].sort(
    (a, b) =>
      (a.kind === 'headquarters' ? 0 : 1) -
        (b.kind === 'headquarters' ? 0 : 1) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  )

  return {
    groups: sortedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      kind: group.kind,
      members: members
        .filter((m) => m.groupId === group.id)
        .sort((a, b) => a.email.localeCompare(b.email))
        .map((m) => ({
          id: m.id,
          email: m.email,
          role: m.role,
          hasPassword: m.userId !== null,
          hasPasskey: m.passkeyId !== null,
        })),
    })),
    invitations: openInvitations
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((invitation) => ({
        token: invitation.token,
        email: invitation.email,
        groupName: groups.find((g) => g.id === invitation.groupId)?.name ?? '',
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
      })),
  }
}

export const actions: Actions = {
  // 未使用の招待を取り消す。使用済みの招待は取り消せない
  revoke: async ({ locals, request }) => {
    requireOwner(locals.member)
    const token = (await request.formData()).get('token')
    if (typeof token !== 'string' || !token) {
      return fail(400, { message: '取り消す招待が指定されていません' })
    }
    const deleted = await locals.db
      .delete(invitations)
      .where(and(eq(invitations.token, token), isNull(invitations.usedAt)))
      .returning({ token: invitations.token })
    if (deleted.length === 0) {
      return fail(404, {
        message: 'この招待は既に使われたか、取り消されています',
      })
    }
    return { revoked: true }
  },
}
