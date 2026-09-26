// 店舗の Safe の Roles v2 の状況と設定の提案
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
  inArray,
  safeTransactionSignatures,
  safeTransactions,
} from '@bizzet/db'
import { type Address, getAddress, isAddress } from 'viem'
import type { Member } from './auth'
import { publicClient } from './chain'
import { isDemoMode } from './demo'
import { createSafeTransaction, getHeadquarters } from './safe'
import type { Group } from './visibility'

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
  if (!deployed || isDemoMode()) return false
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
