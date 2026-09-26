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

    // パスワードの追加用リンクは、まだダッシュボードのユーザーを持たないメンバーにだけ使える
    if (invitation.kind === 'add_password') {
      const target = invitation.memberId
        ? await db.query.members.findFirst({
            where: eq(members.id, invitation.memberId),
          })
        : undefined
      if (!target || target.userId) error(410, m.auth_invite_used())
    }

    // Better Auth のユーザーを作る。sveltekitCookies によりセッションの Cookie もここで発行される。
    // ユーザーの作成は packages/db の hook が「このメールアドレスあての未使用の招待があること」を確かめる。
    // メールアドレスは1人1つのため、同じ招待が同時に2回使われても、ユーザーを作れるのは片方だけになる
    let userId: string
    try {
      const result = await getAuth().api.signUpEmail({
        body: { name: email, email, password },
        headers: request.headers,
      })
      userId = result.user.id
    } catch (e) {
      if (e instanceof APIError && e.status === 'UNPROCESSABLE_ENTITY') {
        return fail(409, { message: m.auth_email_taken() })
      }
      throw e
    }

    // ユーザーを作れた方だけが招待を使用済みにし、メンバーを作るか既存のメンバーに紐づける
    await db
      .update(invitations)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(invitations.token, invitation.token),
          isNull(invitations.usedAt),
        ),
      )
    if (invitation.kind === 'add_password' && invitation.memberId) {
      await db
        .update(members)
        .set({ userId })
        .where(eq(members.id, invitation.memberId))
    } else {
      await db.insert(members).values({
        id: randomUUID(),
        email,
        name: invitation.name,
        title: invitation.title,
        groupId: invitation.groupId,
        role: invitation.role,
        userId,
      })
    }

    redirect(303, '/')
  },
}
