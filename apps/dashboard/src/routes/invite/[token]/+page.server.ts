import { randomUUID } from 'node:crypto'
import { eq, invitations, members } from '@bizzet/db'
import { error, fail, redirect } from '@sveltejs/kit'
import { APIError } from 'better-auth'
import { auth, normalizeEmail, PASSWORD_MIN_LENGTH } from '$lib/server/auth'
import type { Actions, PageServerLoad } from './$types'

async function findOpenInvitation(db: App.Locals['db'], token: string) {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  })
  if (!invitation) error(404, '招待が見つかりません')
  if (invitation.usedAt) error(410, 'この招待は既に使われています')
  if (invitation.expiresAt.getTime() < Date.now()) {
    error(410, 'この招待は期限が切れています')
  }
  return invitation
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const invitation = await findOpenInvitation(locals.db, params.token)
  const group = await locals.db.query.groups.findFirst({
    where: (g, { eq }) => eq(g.id, invitation.groupId),
  })
  return {
    email: invitation.email,
    role: invitation.role,
    groupName: group?.name ?? '',
  }
}

export const actions: Actions = {
  // パスワードを決めて招待をメンバーに変え、そのままログインする
  default: async ({ locals, params, request }) => {
    const invitation = await findOpenInvitation(locals.db, params.token)

    const form = await request.formData()
    const password = form.get('password')
    const confirm = form.get('confirm')
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
      return fail(400, {
        message: `パスワードは ${PASSWORD_MIN_LENGTH} 文字以上にしてください`,
      })
    }
    if (password !== confirm) {
      return fail(400, { message: '確認用のパスワードが一致しません' })
    }

    const db = locals.db
    const email = normalizeEmail(invitation.email)

    // Better Auth のユーザーを作る。sveltekitCookies によりセッションの Cookie もここで発行される
    let userId: string
    try {
      const result = await auth.api.signUpEmail({
        body: { name: email, email, password },
        headers: request.headers,
      })
      userId = result.user.id
    } catch (e) {
      if (e instanceof APIError && e.status === 'UNPROCESSABLE_ENTITY') {
        return fail(409, {
          message:
            'このメールアドレスは既に登録されています。ログイン画面からログインしてください',
        })
      }
      throw e
    }

    const existing = await db.query.members.findFirst({
      where: eq(members.email, email),
    })
    if (existing) {
      await db
        .update(members)
        .set({ userId })
        .where(eq(members.id, existing.id))
    } else {
      await db.insert(members).values({
        id: randomUUID(),
        email,
        groupId: invitation.groupId,
        role: invitation.role,
        userId,
      })
    }
    await db
      .update(invitations)
      .set({ usedAt: new Date() })
      .where(eq(invitations.token, invitation.token))

    redirect(303, '/')
  },
}
