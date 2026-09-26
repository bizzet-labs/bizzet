import { randomUUID } from 'node:crypto'
import { and, eq, groups, invitations, isNull, members } from '@bizzet/db'
import { error, fail, redirect } from '@sveltejs/kit'
import { APIError } from 'better-auth'
import { m } from '$lib/paraglide/messages.js'
import { getAuth, normalizeEmail, PASSWORD_MIN_LENGTH } from '$lib/server/auth'
import type { Actions, PageServerLoad } from './$types'

// ダッシュボードで開ける招待。パスキーの追加用リンクはウォレットで開く
async function findOpenInvitation(db: App.Locals['db'], token: string) {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  })
  if (!invitation) error(404, m.auth_invite_not_found())
  if (invitation.kind === 'add_passkey') error(400, m.auth_invite_for_wallet())
  if (invitation.usedAt) error(410, m.auth_invite_used())
  if (invitation.expiresAt.getTime() < Date.now()) {
    error(410, m.auth_invite_expired())
  }
  return invitation
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const invitation = await findOpenInvitation(locals.db, params.token)
  const group = await locals.db.query.groups.findFirst({
    where: eq(groups.id, invitation.groupId),
  })
  return {
    pageTitle: m.auth_invite_title(),
    kind: invitation.kind,
    email: invitation.email,
    role: invitation.role,
    groupName: group?.name ?? '',
    passwordMinLength: PASSWORD_MIN_LENGTH,
  }
}

export const actions: Actions = {
  // パスワードを決めて、招待ならメンバーを作り、追加用リンクなら既存のメンバーに紐づけてログインする
  default: async ({ locals, params, request }) => {
    const invitation = await findOpenInvitation(locals.db, params.token)

    const form = await request.formData()
    const password = form.get('password')
    const confirm = form.get('confirm')
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
      return fail(400, {
        message: m.auth_password_too_short({ min: PASSWORD_MIN_LENGTH }),
      })
    }
    if (password !== confirm) {
      return fail(400, { message: m.auth_password_mismatch() })
    }

    const db = locals.db
    const email = normalizeEmail(invitation.email)

    // 招待を先に使用済みにする。未使用のときだけ成功するので、同時に2回使われても片方だけが通る
    const claimed = await db
      .update(invitations)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(invitations.token, invitation.token),
          isNull(invitations.usedAt),
        ),
      )
      .returning({ token: invitations.token })
    if (claimed.length === 0) error(410, m.auth_invite_used())
    const release = () =>
      db
        .update(invitations)
        .set({ usedAt: null })
        .where(eq(invitations.token, invitation.token))

    // Better Auth のユーザーを作る。sveltekitCookies によりセッションの Cookie もここで発行される
    let userId: string
    try {
      const result = await getAuth().api.signUpEmail({
        body: { name: email, email, password },
        headers: request.headers,
      })
      userId = result.user.id
    } catch (e) {
      await release()
      if (e instanceof APIError && e.status === 'UNPROCESSABLE_ENTITY') {
        return fail(409, { message: m.auth_email_taken() })
      }
      throw e
    }

    if (invitation.kind === 'add_password' && invitation.memberId) {
      await db
        .update(members)
        .set({ userId })
        .where(eq(members.id, invitation.memberId))
    } else {
      await db.insert(members).values({
        id: randomUUID(),
        email,
        groupId: invitation.groupId,
        role: invitation.role,
        userId,
      })
    }

    redirect(303, '/')
  },
}
