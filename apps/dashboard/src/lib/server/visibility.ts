import { type Db, eq, groups } from '@bizzet/db'
import type { Member } from './auth'

export type Group = typeof groups.$inferSelect

// 見られるグループ。本部のメンバーは全グループ、店舗のメンバーは自分の店舗だけ。
// 閲覧はオンチェーンで強制せず、ここで絞る
export async function getVisibleGroups(
  db: Db,
  member: Member,
): Promise<Group[]> {
  const own = await db.query.groups.findFirst({
    where: eq(groups.id, member.groupId),
  })
  if (!own) return []
  if (own.kind !== 'headquarters') return [own]
  const all = await db.query.groups.findMany()
  return sortGroups(all)
}

export async function canSeeGroup(db: Db, member: Member, groupId: string) {
  const visible = await getVisibleGroups(db, member)
  return visible.some((g) => g.id === groupId)
}

// 本部を先に、同じ種類の中は作成順に並べる
export function sortGroups(list: Group[]) {
  return [...list].sort(
    (a, b) =>
      (a.kind === 'headquarters' ? 0 : 1) -
        (b.kind === 'headquarters' ? 0 : 1) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  )
}

// 本部のメンバーかどうか。出金やオーナーの変更の署名者になれるのは本部の Owner と Approver
export async function isHeadquartersMember(db: Db, member: Member) {
  const own = await db.query.groups.findFirst({
    where: eq(groups.id, member.groupId),
  })
  return own?.kind === 'headquarters'
}
