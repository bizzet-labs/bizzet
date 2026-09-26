import { randomBytes } from 'node:crypto'
import { invitations } from '@bizzet/db'
import { error, fail } from '@sveltejs/kit'
import { normalizeEmail } from '$lib/server/auth'
import type { Actions, PageServerLoad } from './$types'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ROLES = ['owner', 'approver', 'viewer'] as const
type Role = (typeof ROLES)[number]

function requireOwner(member: App.Locals['member']) {
  if (!member) error(401)
  if (member.role !== 'owner')
    error(403, 'メンバーの招待は Owner だけが行えます')
  return member
}

export const load: PageServerLoad = async ({ locals }) => {
  requireOwner(locals.member)
  const groups = await locals.db.query.groups.findMany()
  return { groups: groups.map((g) => ({ id: g.id, name: g.name })) }
}

export const actions: Actions = {
  default: async ({ locals, request, url }) => {
    const owner = requireOwner(locals.member)

    const form = await request.formData()
    const email = form.get('email')
    const groupId = form.get('groupId')
    const role = form.get('role')
    if (typeof email !== 'string' || !email.includes('@')) {
      return fail(400, { message: 'メールアドレスを入力してください' })
    }
    if (typeof groupId !== 'string' || !groupId) {
      return fail(400, { message: 'グループを選んでください' })
    }
    if (typeof role !== 'string' || !ROLES.includes(role as Role)) {
      return fail(400, { message: 'ロールを選んでください' })
    }

    const token = randomBytes(32).toString('base64url')
    await locals.db.insert(invitations).values({
      token,
      email: normalizeEmail(email),
      groupId,
      role: role as Role,
      invitedBy: owner.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })

    return { inviteUrl: `${url.origin}/invite/${token}`, email }
  },
}
