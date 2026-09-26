// グループの一覧と店舗の作成
import { randomUUID } from 'node:crypto'
import { count, type Db, groups, inArray, members } from '@bizzet/db'
import type { Member } from './auth'
import { checkLabel, getEnsSettings, resolveGroupEns } from './ens'
import { configureStoreSafeWith, refreshDeployment } from './group-safe'
import { getHeadquarters } from './safe'
import { type Group, getVisibleGroups } from './visibility'

// Safe の状態。unconfigured：設定の確定前、undeployed：確定済みで未配置、deployed：配置済み
export type SafeStatus = 'unconfigured' | 'undeployed' | 'deployed'

function safeStatus(group: Group, deployed: boolean): SafeStatus {
  if (!group.safeAddress) return 'unconfigured'
  return deployed ? 'deployed' : 'undeployed'
}

// グループの一覧。見られるグループだけを、Safe の状態とメンバーの人数とともに返す
export async function listGroups(db: Db, member: Member) {
  const visible = await getVisibleGroups(db, member)
  if (visible.length === 0) return []
  const [counts, deployed, ens] = await Promise.all([
    db
      .select({ groupId: members.groupId, count: count() })
      .from(members)
      .where(
        inArray(
          members.groupId,
          visible.map((g) => g.id),
        ),
      )
      .groupBy(members.groupId),
    Promise.all(visible.map((g) => refreshDeployment(db, g))),
    getEnsSettings(db).then((settings) =>
      Promise.all(visible.map((g) => resolveGroupEns(g, settings))),
    ),
  ])
  return visible.map((group, i) => ({
    id: group.id,
    name: group.name,
    kind: group.kind,
    safeStatus: safeStatus(group, (deployed[i] ?? null) !== null),
    memberCount: counts.find((c) => c.groupId === group.id)?.count ?? 0,
    ensName: ens[i]?.name ?? null,
    ensStatus: group.ensStatus,
    ensMismatch: ens[i]?.mismatch ?? false,
  }))
}

async function isGroupNameTaken(db: Db, name: string) {
  const all = await db.query.groups.findMany({ columns: { name: true } })
  return all.some((g) => g.name.toLowerCase() === name.toLowerCase())
}

export type CreateStoreResult =
  | { ok: true; id: string }
  | {
      ok: false
      reason:
        | 'name_required'
        | 'name_taken'
        | 'no_headquarters'
        | 'invalid_label'
        | 'label_taken'
    }

// 店舗のグループを作る。本部の Safe が設定済みなら、店舗の Safe の設定も同時に確定する。
// ENS の名前の登録はここでは行わず、作成後に呼び出し側が行う（失敗しても作成を取り消さないため）
export async function createStore(
  db: Db,
  rawName: string,
  rawLabel = '',
): Promise<CreateStoreResult> {
  const name = rawName.trim()
  if (!name) return { ok: false, reason: 'name_required' }
  const hq = await getHeadquarters(db)
  if (!hq) return { ok: false, reason: 'no_headquarters' }
  if (await isGroupNameTaken(db, name)) {
    return { ok: false, reason: 'name_taken' }
  }
  const label = await checkLabel(db, rawLabel)
  if (!label.ok) return { ok: false, reason: label.reason }
  const id = randomUUID()
  // 名前の重複は DB の一意制約（大文字と小文字を区別しない）でも防ぐ。先の確認のあとに同じ名前が
  // 同時に作られた場合は、制約違反（23505）になるので同じ「名前が重複」として返す
  const inserted = await db
    .insert(groups)
    .values({ id, name, kind: 'store', ensLabel: label.label })
    .onConflictDoNothing()
    .returning({ id: groups.id })
  if (inserted.length === 0) return { ok: false, reason: 'name_taken' }
  await configureStoreSafeWith(db, id, hq)
  return { ok: true, id }
}
