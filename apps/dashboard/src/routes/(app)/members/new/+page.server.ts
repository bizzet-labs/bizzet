import { randomBytes } from 'node:crypto'
import { and, eq, groups, gt, invitations, isNull, members } from '@bizzet/db'
import { fail } from '@sveltejs/kit'
import { m } from '$lib/paraglide/messages.js'
import { normalizeEmail } from '$lib/server/auth'
import { requireOwner } from '$lib/server/guards'
import {
  isRole,
  isRoleAllowedInGroup,
  walletInviteUrl,
} from '$lib/server/member-changes'
import { sortGroups } from '$lib/server/visibility'
import type { Actions, PageServerLoad } from './$types'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const load: PageServerLoad = async ({ locals }) => {
  requireOwner(locals.member)
  const list = await locals.db.query.groups.findMany()
  return {
    pageTitle: m.members_invite_title(),
    groups: sortGroups(list).map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind,
    })),
  }
}

function optionalText(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export const actions: Actions = {
  default: async ({ locals, request, url }) => {
    const owner = requireOwner(locals.member)
    const db = locals.db

    const form = await request.formData()
    const rawEmail = form.get('email')
    const groupId = form.get('groupId')
    const role = form.get('role')
    const name = optionalText(form.get('name'))
    const title = optionalText(form.get('title'))
    // 入力し直さずに済むよう、失敗しても入力値を返す
    const values = {
      email: typeof rawEmail === 'string' ? rawEmail : '',
      name: name ?? '',
      title: title ?? '',
    }
    if (typeof rawEmail !== 'string' || !rawEmail.includes('@')) {
      return fail(400, { values, message: m.members_error_email_required() })
    }
    if (typeof groupId !== 'string' || !groupId) {
      return fail(400, { values, message: m.members_error_group_required() })
    }
    if (!isRole(role)) {
      return fail(400, { values, message: m.members_error_role_required() })
    }
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    })
    if (!group) {
      return fail(400, { values, message: m.members_error_group_required() })
    }
    if (!isRoleAllowedInGroup(group.kind, role)) {
      return fail(400, { values, message: m.members_error_store_viewer_only() })
    }

    // 登録済みのメンバーのグループやロールは、招待ではなくメンバーの編集で変える
    const email = normalizeEmail(rawEmail)
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
      return fail(409, { values, message: m.members_error_email_member() })
    }
    if (openInvitation) {
      return fail(409, { values, message: m.members_error_email_invited() })
    }

    const token = randomBytes(32).toString('base64url')
    await db.insert(invitations).values({
      token,
      kind: 'member',
      email,
      name,
      title,
      groupId,
      role,
      invitedBy: owner.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })

    // 同じ招待を、ダッシュボード（パスワード）とウォレット（パスキー）のどちらでも使える
    return {
      email,
      dashboardUrl: `${url.origin}/invite/${token}`,
      walletUrl: walletInviteUrl(token),
    }
  },
}
