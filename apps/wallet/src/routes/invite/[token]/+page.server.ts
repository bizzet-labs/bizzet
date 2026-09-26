import { randomUUID } from 'node:crypto'
import { eq, invitations, members, passkeys } from '@bizzet/db'
import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

const HEX_64_BYTES = /^0x[0-9a-fA-F]{128}$/
const ADDRESS = /^0x[0-9a-fA-F]{40}$/

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
  // ブラウザで作ったパスキーを保存し、招待をメンバーに変える
  default: async ({ locals, params, request }) => {
    const invitation = await findOpenInvitation(locals.db, params.token)

    const form = await request.formData()
    const id = form.get('id')
    const publicKey = form.get('publicKey')
    const signer = form.get('signer')
    if (
      typeof id !== 'string' ||
      !id ||
      typeof publicKey !== 'string' ||
      !HEX_64_BYTES.test(publicKey) ||
      typeof signer !== 'string' ||
      !ADDRESS.test(signer)
    ) {
      return fail(400, { message: 'パスキーの情報が正しくありません' })
    }

    const db = locals.db
    await db
      .insert(passkeys)
      .values({ id, publicKey, signer: signer.toLowerCase() })
    await db.insert(members).values({
      id: randomUUID(),
      email: invitation.email,
      groupId: invitation.groupId,
      role: invitation.role,
      passkeyId: id,
    })
    await db
      .update(invitations)
      .set({ usedAt: new Date() })
      .where(eq(invitations.token, invitation.token))

    redirect(303, '/')
  },
}
