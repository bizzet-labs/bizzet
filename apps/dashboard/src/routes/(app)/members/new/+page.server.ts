import { randomBytes } from 'node:crypto'
import { and, eq, gt, invitations, isNull, members } from '@bizzet/db'
import { fail, setError, superValidate } from 'sveltekit-superforms'
import { zod4 } from 'sveltekit-superforms/adapters'
import { m } from '$lib/paraglide/messages.js'
import { normalizeEmail } from '$lib/server/auth'
import { requireOwner } from '$lib/server/guards'
import { walletInviteUrl } from '$lib/server/member-changes'
import { sortGroups } from '$lib/server/visibility'
import type { Actions, PageServerLoad } from './$types'
import { inviteSchema } from './schema'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const load: PageServerLoad = async ({ locals }) => {
  requireOwner(locals.member)
  const list = await locals.db.query.groups.findMany()
  const sorted = sortGroups(list).map((g) => ({
    id: g.id,
    name: g.name,
    kind: g.kind,
  }))
  const form = await superValidate(zod4(inviteSchema(sorted)))
  return {
    pageTitle: m.members_invite_title(),
    groups: sorted,
    form,
  }
}

export const actions: Actions = {
  default: async ({ locals, request, url }) => {
    const owner = requireOwner(locals.member)
    const db = locals.db

    const list = await db.query.groups.findMany()
    const groupList = sortGroups(list).map((g) => ({ id: g.id, kind: g.kind }))
    const form = await superValidate(request, zod4(inviteSchema(groupList)))
    if (!form.valid) return fail(400, { form })

    // 登録済みのメンバーのグループやロールは、招待ではなくメンバーの編集で変える
    const email = normalizeEmail(form.data.email)
    const [member, openInvitation] = await Promise.all([
      db.query.members.findFirst({ where: eq(members.email, email) }),
      db.query.invitations.findFirst({
        where: and(
          eq(invitations.email, email),
          eq(invitations.kind, 'member'),
          isNull(invitations.usedAt),
          gt(invitations.expiresAt, new Date()),
        ),
      }),
    ])
    if (member) {
      return setError(form, 'email', m.members_error_email_member(), {
        status: 409,
      })
    }
    if (openInvitation) {
      return setError(form, 'email', m.members_error_email_invited(), {
        status: 409,
      })
    }

    const name = form.data.name || null
    const title = form.data.title || null
    const token = randomBytes(32).toString('base64url')
    await db.insert(invitations).values({
      token,
      kind: 'member',
      email,
      name,
      title,
      groupId: form.data.groupId,
      role: form.data.role,
      invitedBy: owner.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })

    // 同じ招待を、ダッシュボード（パスワード）とウォレット（パスキー）のどちらでも使える
    return {
      form,
      email,
      dashboardUrl: `${url.origin}/invite/${token}`,
      walletUrl: walletInviteUrl(token),
    }
  },
}
