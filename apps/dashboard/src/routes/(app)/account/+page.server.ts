import { randomBytes } from 'node:crypto'
import { and, eq, groups, gt, invitations, isNull } from '@bizzet/db'
import { error, fail } from '@sveltejs/kit'
import { m } from '$lib/paraglide/messages.js'
import { walletInviteUrl } from '$lib/server/member-changes'
import type { Actions, PageServerLoad } from './$types'

// パスキーの追加用リンクの有効期限。発行した本人がすぐにスマートフォンで開く前提で短くする
const ADD_PASSKEY_TTL_MS = 60 * 60 * 1000

export const load: PageServerLoad = async ({ locals }) => {
  const member = locals.member
  if (!member) error(401)
  const db = locals.db
  const [group, openLink] = await Promise.all([
    db.query.groups.findFirst({ where: eq(groups.id, member.groupId) }),
    db.query.invitations.findFirst({
      where: and(
        eq(invitations.kind, 'add_passkey'),
        eq(invitations.memberId, member.id),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    }),
  ])
  return {
    pageTitle: m.common_nav_account(),
    account: {
      name: member.name,
      title: member.title,
      email: member.email,
      role: member.role,
      groupName: group?.name ?? '',
      groupKind: group?.kind ?? 'store',
      hasPassword: member.userId !== null,
      hasPasskey: member.passkeyId !== null,
    },
    // 発行済みで期限内のリンクがあれば、画面を開き直しても同じリンクを見せる
    passkeyLink:
      openLink && !member.passkeyId
        ? {
            url: walletInviteUrl(openLink.token),
            expiresAt: openLink.expiresAt.toISOString(),
          }
        : null,
  }
}

export const actions: Actions = {
  // ウォレットでパスキーを登録するための追加用リンクを発行する。前に発行した未使用のリンクは無効にする
  issuePasskeyLink: async ({ locals }) => {
    const member = locals.member
    if (!member) error(401)
    if (member.passkeyId) {
      return fail(409, { message: m.members_account_passkey_exists() })
    }
    const db = locals.db
    await db
      .delete(invitations)
      .where(
        and(
          eq(invitations.kind, 'add_passkey'),
          eq(invitations.memberId, member.id),
          isNull(invitations.usedAt),
        ),
      )
    const token = randomBytes(32).toString('base64url')
    await db.insert(invitations).values({
      token,
      kind: 'add_passkey',
      memberId: member.id,
      email: member.email,
      groupId: member.groupId,
      role: member.role,
      invitedBy: member.id,
      expiresAt: new Date(Date.now() + ADD_PASSKEY_TTL_MS),
    })
    return { issued: true }
  },
}
