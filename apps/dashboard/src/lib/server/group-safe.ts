// グループの Safe の設定の確定と配置
import { randomBytes } from 'node:crypto'
import { sepolia as addresses, encodeCreateSafe } from '@bizzet/contracts'
import {
  and,
  type Db,
  eq,
  groups,
  inArray,
  isNull,
  members,
  passkeys,
} from '@bizzet/db'
import { type Address, getAddress } from 'viem'
import { publicClient } from './chain'
import { fakeTxHash, isDemoMode } from './demo'
import { operatorWallet } from './operator'
import { computeGroupSafeAddress, getHeadquarters, isDeployed } from './safe'
import type { Group } from './visibility'

// 本部の Safe の設定。3人以上にするのは、1人がパスキーを失っても残る2人で入れ替えの承認ができるようにするため
export const HEADQUARTERS_MIN_OWNERS = 3
export const HEADQUARTERS_THRESHOLD = 2
// 店舗の Safe は本部の Safe だけをオーナーにし、本部の2人承認をそのまま店舗の承認にする
const STORE_THRESHOLD = 1

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

export type DeploySafeResult =
  | { ok: true; txHash: string }
  | {
      ok: false
      reason:
        | 'unconfigured'
        | 'already_deployed'
        | 'operator_unset'
        | 'address_mismatch'
        | 'failed'
    }

// グループの Safe を、保存した設定のまま配置する。グループの Safe はここでだけ作り、ウォレットは未配置の Safe の出金を実行しない。
// 配置先のアドレスは設定と saltNonce だけで決まり、送る鍵によらないため、運用者の鍵がガス代を払って送る
export async function deployGroupSafe(
  db: Db,
  group: Group,
): Promise<DeploySafeResult> {
  if (
    !group.safeAddress ||
    !group.safeOwners ||
    !group.safeThreshold ||
    !group.safeSaltNonce
  ) {
    return { ok: false, reason: 'unconfigured' }
  }
  const safe = getAddress(group.safeAddress)
  // デモモードではチェーンに送らず、模擬の取引のハッシュで配置済みにする
  if (isDemoMode()) {
    if (group.safeDeployedAt) return { ok: false, reason: 'already_deployed' }
    await db
      .update(groups)
      .set({ safeDeployedAt: new Date() })
      .where(and(eq(groups.id, group.id), isNull(groups.safeDeployedAt)))
    return { ok: true, txHash: fakeTxHash() }
  }
  if (await isDeployed(safe)) {
    await refreshDeployment(db, group)
    return { ok: false, reason: 'already_deployed' }
  }
  const wallet = operatorWallet()
  if (!wallet) return { ok: false, reason: 'operator_unset' }
  const owners = group.safeOwners.map((o) => getAddress(o))
  const threshold = BigInt(group.safeThreshold)
  const saltNonce = BigInt(group.safeSaltNonce)
  // 設定から再現したアドレスが保存したアドレスと食い違うなら、別の Safe を作らないよう止める
  const predicted = await computeGroupSafeAddress(owners, threshold, saltNonce)
  if (getAddress(predicted) !== safe) {
    return { ok: false, reason: 'address_mismatch' }
  }
  try {
    const txHash = await wallet.sendTransaction({
      to: addresses.safe.proxyFactory,
      data: encodeCreateSafe({ owners, threshold, kind: 'group' }, saltNonce),
    })
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    })
    if (receipt.status !== 'success' || !(await isDeployed(safe))) {
      return { ok: false, reason: 'failed' }
    }
    await db
      .update(groups)
      .set({ safeDeployedAt: new Date() })
      .where(and(eq(groups.id, group.id), isNull(groups.safeDeployedAt)))
    return { ok: true, txHash }
  } catch (e) {
    console.error('Safe の配置に失敗しました', e)
    return { ok: false, reason: 'failed' }
  }
}

// 店舗の Safe の設定を確定する。本部の Safe が未設定なら何もしない。
// 確定済みの設定は上書きしないよう、Safe のアドレスが未設定のときだけ更新する
export async function configureStoreSafeWith(
  db: Db,
  groupId: string,
  hq: Group,
) {
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
      // デモモードでは配置の取引を送らないため、設定の確定と同時に配置済みにする
      ...(isDemoMode() ? { safeDeployedAt: new Date() } : {}),
    })
    .where(and(eq(groups.id, groupId), isNull(groups.safeAddress)))
    .returning({ id: groups.id })
  return updated.length > 0
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
