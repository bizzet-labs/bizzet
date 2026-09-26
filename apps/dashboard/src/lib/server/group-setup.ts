import { randomBytes, randomUUID } from 'node:crypto'
import {
  sepolia as addresses,
  encodeRolesSetup,
  predictRolesAddress,
  safeModuleAbi,
  tokens,
} from '@bizzet/contracts'
import {
  and,
  count,
  type Db,
  desc,
  eq,
  groups,
  inArray,
  isNull,
  members,
  passkeys,
  safeTransactionSignatures,
  safeTransactions,
} from '@bizzet/db'
import { type Address, getAddress, isAddress } from 'viem'
import type { Member } from './auth'
import { publicClient } from './chain'
import {
  computeGroupSafeAddress,
  createSafeTransaction,
  getHeadquarters,
  isDeployed,
} from './safe'
import { type Group, getVisibleGroups } from './visibility'

// 本部の Safe の設定。3人以上にするのは、1人がパスキーを失っても残る2人で入れ替えの承認ができるようにするため
export const HEADQUARTERS_MIN_OWNERS = 3
export const HEADQUARTERS_THRESHOLD = 2
// 店舗の Safe は本部の Safe だけをオーナーにし、本部の2人承認をそのまま店舗の承認にする
const STORE_THRESHOLD = 1

// Safe の状態。unconfigured：設定の確定前、undeployed：確定済みで未配置、deployed：配置済み
export type SafeStatus = 'unconfigured' | 'undeployed' | 'deployed'

// Safe の saltNonce。推測されても困る値ではないが、同じ設定の Safe と衝突しないよう乱数の uint64 にする
function randomSaltNonce() {
  return randomBytes(8).readBigUInt64BE()
}

// Safe が配置済みかを確かめ、初めて配置を確認したときに配置日時を記録する。配置済みなら配置日時を返す。
// チェーンに確認できなかったときは、画面を止めないよう未配置として扱う
export async function refreshDeployment(
  db: Db,
  group: Group,
): Promise<Date | null> {
  if (!group.safeAddress) return null
  if (group.safeDeployedAt) return group.safeDeployedAt
  const deployed = await isDeployed(getAddress(group.safeAddress)).catch(
    (e) => {
      console.error('Safe の配置の確認に失敗しました', e)
      return false
    },
  )
  if (!deployed) return null
  const deployedAt = new Date()
  await db
    .update(groups)
    .set({ safeDeployedAt: deployedAt })
    .where(and(eq(groups.id, group.id), isNull(groups.safeDeployedAt)))
  return deployedAt
}

function safeStatus(group: Group, deployed: boolean): SafeStatus {
  if (!group.safeAddress) return 'unconfigured'
  return deployed ? 'deployed' : 'undeployed'
}

// グループの一覧。見られるグループだけを、Safe の状態とメンバーの人数とともに返す
export async function listGroups(db: Db, member: Member) {
  const visible = await getVisibleGroups(db, member)
  if (visible.length === 0) return []
  const [counts, deployed] = await Promise.all([
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
  ])
  return visible.map((group, i) => ({
    id: group.id,
    name: group.name,
    kind: group.kind,
    safeStatus: safeStatus(group, (deployed[i] ?? null) !== null),
    memberCount: counts.find((c) => c.groupId === group.id)?.count ?? 0,
  }))
}

async function isGroupNameTaken(db: Db, name: string) {
  const all = await db.query.groups.findMany({ columns: { name: true } })
  return all.some((g) => g.name.toLowerCase() === name.toLowerCase())
}

// 店舗の Safe の設定を確定する。本部の Safe が未設定なら何もしない。
// 確定済みの設定は上書きしないよう、Safe のアドレスが未設定のときだけ更新する
async function configureStoreSafeWith(db: Db, groupId: string, hq: Group) {
  if (!hq.safeAddress) return false
  const owners = [getAddress(hq.safeAddress)]
  const saltNonce = randomSaltNonce()
  const safeAddress = await computeGroupSafeAddress(
    owners,
    BigInt(STORE_THRESHOLD),
    saltNonce,
  )
  const updated = await db
    .update(groups)
    .set({
      safeAddress: safeAddress.toLowerCase(),
      safeOwners: owners,
      safeThreshold: STORE_THRESHOLD,
      safeSaltNonce: saltNonce.toString(),
    })
    .where(and(eq(groups.id, groupId), isNull(groups.safeAddress)))
    .returning({ id: groups.id })
  return updated.length > 0
}

export type CreateStoreResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'name_required' | 'name_taken' | 'no_headquarters' }

// 店舗のグループを作る。本部の Safe が設定済みなら、店舗の Safe の設定も同時に確定する
export async function createStore(
  db: Db,
  rawName: string,
): Promise<CreateStoreResult> {
  const name = rawName.trim()
  if (!name) return { ok: false, reason: 'name_required' }
  const hq = await getHeadquarters(db)
  if (!hq) return { ok: false, reason: 'no_headquarters' }
  if (await isGroupNameTaken(db, name)) {
    return { ok: false, reason: 'name_taken' }
  }
  const id = randomUUID()
  // 名前の重複は DB の一意制約（大文字と小文字を区別しない）でも防ぐ。先の確認のあとに同じ名前が
  // 同時に作られた場合は、制約違反（23505）になるので同じ「名前が重複」として返す
  const inserted = await db
    .insert(groups)
    .values({ id, name, kind: 'store' })
    .onConflictDoNothing()
    .returning({ id: groups.id })
  if (inserted.length === 0) return { ok: false, reason: 'name_taken' }
  await configureStoreSafeWith(db, id, hq)
  return { ok: true, id }
}

export type ConfigureResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'already_configured'
        | 'headquarters_unconfigured'
        | 'not_enough_owners'
        | 'invalid_owner'
    }

// 店舗の設定画面から、あとで店舗の Safe の設定を確定する
export async function configureStoreSafe(
  db: Db,
  group: Group,
): Promise<ConfigureResult> {
  if (group.safeAddress) return { ok: false, reason: 'already_configured' }
  const hq = await getHeadquarters(db)
  if (!hq?.safeAddress)
    return { ok: false, reason: 'headquarters_unconfigured' }
  const updated = await configureStoreSafeWith(db, group.id, hq)
  return updated ? { ok: true } : { ok: false, reason: 'already_configured' }
}

// 本部の Safe のオーナーの候補。本部の Owner と Approver を作成順に並べ、パスキーの署名者を添える。
// パスキーのないメンバーも、登録を促すために候補として返す
export async function getHeadquartersCandidates(db: Db, hq: Group) {
  const rows = await db
    .select({
      id: members.id,
      email: members.email,
      name: members.name,
      role: members.role,
      signer: passkeys.signer,
    })
    .from(members)
    .leftJoin(passkeys, eq(members.passkeyId, passkeys.id))
    .where(
      and(
        eq(members.groupId, hq.id),
        inArray(members.role, ['owner', 'approver']),
      ),
    )
    .orderBy(members.createdAt, members.id)
  return rows.map((row) => ({
    ...row,
    signer: row.signer ? getAddress(row.signer) : null,
  }))
}

// 本部の Safe の設定を確定する。オーナーは選ばれたメンバーのパスキーの署名者。
// 確定後の変更は本部の Safe の取引（オーナーの変更の提案）で行うため、ここでは確定済みの設定を上書きしない
export async function configureHeadquartersSafe(
  db: Db,
  hq: Group,
  memberIds: readonly string[],
): Promise<ConfigureResult> {
  if (hq.kind !== 'headquarters') return { ok: false, reason: 'invalid_owner' }
  if (hq.safeAddress) return { ok: false, reason: 'already_configured' }
  const unique = new Set(memberIds)
  const candidates = await getHeadquartersCandidates(db, hq)
  if ([...unique].some((id) => !candidates.some((c) => c.id === id))) {
    return { ok: false, reason: 'invalid_owner' }
  }
  // オーナーの並びは、フォームで選ばれた順（画面の候補の並び）にする
  const chosen = [...unique].flatMap((id) =>
    candidates.filter((c) => c.id === id),
  )
  if (chosen.some((c) => !c.signer)) {
    return { ok: false, reason: 'invalid_owner' }
  }
  if (chosen.length < HEADQUARTERS_MIN_OWNERS) {
    return { ok: false, reason: 'not_enough_owners' }
  }
  const owners = chosen.map((c) => c.signer as Address)
  const saltNonce = randomSaltNonce()
  const safeAddress = await computeGroupSafeAddress(
    owners,
    BigInt(HEADQUARTERS_THRESHOLD),
    saltNonce,
  )
  const updated = await db
    .update(groups)
    .set({
      safeAddress: safeAddress.toLowerCase(),
      safeOwners: owners,
      safeThreshold: HEADQUARTERS_THRESHOLD,
      safeSaltNonce: saltNonce.toString(),
    })
    .where(and(eq(groups.id, hq.id), isNull(groups.safeAddress)))
    .returning({ id: groups.id })
  return updated.length > 0
    ? { ok: true }
    : { ok: false, reason: 'already_configured' }
}

// キーパーの送信元アドレス。未設定か不正な値なら null にし、画面で設定を促す
export function getKeeperAddress(value: string | undefined) {
  return value && isAddress(value) ? getAddress(value) : null
}

// 店舗の Safe の Roles v2 の設定の提案のうち、却下されていない最新のもの。
// 店舗の Safe の safe_setup の提案は Roles v2 の設定だけのため、種類で見分ける
async function findRolesProposal(db: Db, group: Group) {
  const proposal = await db.query.safeTransactions.findFirst({
    where: and(
      eq(safeTransactions.groupId, group.id),
      eq(safeTransactions.kind, 'safe_setup'),
      inArray(safeTransactions.status, ['open', 'submitted', 'executed']),
    ),
    orderBy: desc(safeTransactions.createdAt),
  })
  if (!proposal) return null
  const [signatures] = await db
    .select({ count: count() })
    .from(safeTransactionSignatures)
    .where(eq(safeTransactionSignatures.transactionId, proposal.id))
  return {
    id: proposal.id,
    status: proposal.status,
    nonce: proposal.nonce,
    signatureCount: signatures?.count ?? 0,
    createdAt: proposal.createdAt,
  }
}

// Roles v2 がモジュールとして有効か。店舗の Safe が未配置なら、まだ有効にはなっていない
async function isRolesEnabled(safe: Address, deployed: boolean) {
  if (!deployed) return false
  return publicClient
    .readContract({
      address: safe,
      abi: safeModuleAbi,
      functionName: 'isModuleEnabled',
      args: [predictRolesAddress(safe)],
    })
    .catch((e) => {
      console.error('Roles v2 の有効化の確認に失敗しました', e)
      return false
    })
}

// 設定画面に出す Roles v2 の状況
export async function getRolesStatus(
  db: Db,
  group: Group,
  deployed: boolean,
  keeper: Address | null,
) {
  if (group.kind !== 'store' || !group.safeAddress) return null
  const safe = getAddress(group.safeAddress)
  const hq = await getHeadquarters(db)
  const [proposal, enabled] = await Promise.all([
    findRolesProposal(db, group),
    isRolesEnabled(safe, deployed),
  ])
  return {
    rolesAddress: predictRolesAddress(safe),
    keeper,
    recipient: hq?.safeAddress ? getAddress(hq.safeAddress) : null,
    tokens: tokens.map((t) => t.symbol),
    proposal,
    enabled: enabled || proposal?.status === 'executed',
  }
}

export type ProposeRolesResult =
  | { ok: true; id: string }
  | {
      ok: false
      reason:
        | 'not_store'
        | 'store_unconfigured'
        | 'headquarters_unconfigured'
        | 'keeper_unset'
        | 'already_proposed'
    }

// 店舗の Safe の Roles v2 の設定を、店舗の Safe の取引として提案する。
// 配置・権限の設定・モジュールの有効化を1つの取引にまとめ、本部の2人承認で実行する
export async function proposeRolesSetup(
  db: Db,
  group: Group,
  keeper: Address | null,
  createdBy: Member,
): Promise<ProposeRolesResult> {
  if (group.kind !== 'store') return { ok: false, reason: 'not_store' }
  if (!group.safeAddress) return { ok: false, reason: 'store_unconfigured' }
  if (!keeper) return { ok: false, reason: 'keeper_unset' }
  const hq = await getHeadquarters(db)
  if (!hq?.safeAddress)
    return { ok: false, reason: 'headquarters_unconfigured' }
  // 却下されていない提案があれば、二重に作らない。実行済みなら Roles は配置済みで、作り直すと失敗する
  if (await findRolesProposal(db, group)) {
    return { ok: false, reason: 'already_proposed' }
  }
  const setup = encodeRolesSetup({
    safe: getAddress(group.safeAddress),
    keeper,
    recipient: getAddress(hq.safeAddress),
    tokens: [addresses.tokens.jpyc, addresses.tokens.usdc],
  })
  const { id } = await createSafeTransaction(db, {
    group,
    kind: 'safe_setup',
    to: setup.to,
    value: setup.value,
    data: setup.data,
    operation: setup.operation,
    createdBy: createdBy.id,
  })
  return { ok: true, id }
}
