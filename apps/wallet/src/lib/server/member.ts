import { type Db, eq, groups, members, passkeys } from '@bizzet/db'
import { error } from '@sveltejs/kit'

export type Member = typeof members.$inferSelect
export type Group = typeof groups.$inferSelect
export type Passkey = typeof passkeys.$inferSelect

// ログインしたセッションのメンバー。ウォレットの API は、リクエストの中身ではなく必ずこれでメンバーを引く。
// 署名を受け付ける処理では、別途パスキーの署名そのものを保存した公開鍵で確かめる
export function requireMember(locals: App.Locals) {
  if (!locals.passkeyId) error(401, 'ログインしてください')
  return findMemberByPasskey(locals.db, locals.passkeyId)
}

async function findMemberByPasskey(db: Db, passkeyId: string) {
  const passkey = await db.query.passkeys.findFirst({
    where: eq(passkeys.id, passkeyId),
  })
  if (!passkey) error(401, 'このパスキーは登録されていません')
  const member = await db.query.members.findFirst({
    where: eq(members.passkeyId, passkey.id),
  })
  if (!member) error(401, 'このパスキーのメンバーが見つかりません')
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, member.groupId),
  })
  if (!group) error(404, 'メンバーのグループが見つかりません')
  return { member, passkey, group }
}

// 見られるグループ。本部のメンバーは全グループ、店舗のメンバーは自分の店舗だけ。
// 本部を先に、同じ種類の中は作成順に並べる
export async function getVisibleGroups(db: Db, own: Group): Promise<Group[]> {
  if (own.kind !== 'headquarters') return [own]
  const all = await db.query.groups.findMany()
  return [...all].sort(
    (a, b) =>
      (a.kind === 'headquarters' ? 0 : 1) -
        (b.kind === 'headquarters' ? 0 : 1) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  )
}

// 署名者になれるのは本部の Owner と Approver だけ
export function isHeadquartersSigner(member: Member, own: Group) {
  return own.kind === 'headquarters' && member.role !== 'viewer'
}
