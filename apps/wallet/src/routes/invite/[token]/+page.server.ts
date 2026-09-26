import { randomUUID } from 'node:crypto'
import { and, eq, invitations, isNull, members, passkeys } from '@bizzet/db'
import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

const HEX_64_BYTES = /^0x[0-9a-fA-F]{128}$/
const ADDRESS = /^0x[0-9a-fA-F]{40}$/

type Db = App.Locals['db']
type Invitation = typeof invitations.$inferSelect

async function findOpenInvitation(db: Db, token: string) {
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

// パスキーの追加用リンクの対象のメンバー。既にパスキーがあれば、別のパスキーで上書きしないよう拒む
async function findPasskeyTarget(db: Db, invitation: Invitation) {
  if (!invitation.memberId) error(400, 'このリンクは正しくありません')
  const member = await db.query.members.findFirst({
    where: eq(members.id, invitation.memberId),
  })
  if (!member) error(404, 'このリンクのメンバーが見つかりません')
  if (member.passkeyId)
    error(409, 'このメンバーのパスキーは既に登録されています')
  return member
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const invitation = await findOpenInvitation(locals.db, params.token)
  if (invitation.kind === 'add_passkey') {
    await findPasskeyTarget(locals.db, invitation)
  }
  const group = await locals.db.query.groups.findFirst({
    where: (g, { eq }) => eq(g.id, invitation.groupId),
  })
  return {
    kind: invitation.kind,
    email: invitation.email,
    role: invitation.role,
    groupName: group?.name ?? '',
  }
}

export const actions: Actions = {
  // ブラウザで作ったパスキーを保存し、招待ならメンバーを作り、追加用リンクなら既存のメンバーに紐づける
  default: async ({ locals, params, request }) => {
    const db = locals.db
    const invitation = await findOpenInvitation(db, params.token)
    if (invitation.kind === 'add_password') {
      return fail(400, {
        message: 'このリンクはダッシュボードで開いてください',
      })
    }
    const target =
      invitation.kind === 'add_passkey'
        ? await findPasskeyTarget(db, invitation)
        : null

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

    if (!target) {
      const existing = await db.query.members.findFirst({
        where: eq(members.email, invitation.email),
      })
      if (existing) {
        return fail(409, {
          message:
            'このメールアドレスは既に登録されています。ログイン画面からログインしてください',
        })
      }
    }

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
    if (claimed.length === 0) error(410, 'この招待は既に使われています')
    // 登録に失敗したら使用済みを戻し、同じリンクからやり直せるようにする
    const release = () =>
      db
        .update(invitations)
        .set({ usedAt: null })
        .where(eq(invitations.token, invitation.token))

    const passkey = { id, publicKey, signer: signer.toLowerCase() }
    try {
      if (target) {
        // パスキーの保存と紐づけを1つのトランザクションで行う。
        // 紐づけは、まだパスキーがないときだけ成功する条件付きにする
        const [, linked] = await db.batch([
          db.insert(passkeys).values(passkey),
          db
            .update(members)
            .set({ passkeyId: id })
            .where(and(eq(members.id, target.id), isNull(members.passkeyId)))
            .returning({ id: members.id }),
        ])
        if (linked.length === 0) {
          await db.delete(passkeys).where(eq(passkeys.id, id))
          await release()
          return fail(409, {
            message: 'このメンバーのパスキーは既に登録されています',
          })
        }
      } else {
        // パスキーの保存とメンバーの作成を1つのトランザクションで行う
        await db.batch([
          db.insert(passkeys).values(passkey),
          db.insert(members).values({
            id: randomUUID(),
            email: invitation.email,
            name: invitation.name,
            title: invitation.title,
            groupId: invitation.groupId,
            role: invitation.role,
            passkeyId: id,
          }),
        ])
      }
    } catch (e) {
      await release()
      console.error(e)
      // 多いのは、同じパスキーや同じ署名者が既に登録されている場合（一意制約の違反）
      return fail(409, {
        message:
          'パスキーを登録できませんでした。このパスキーが既に使われていないか確認してください',
      })
    }

    redirect(303, '/')
  },
}
