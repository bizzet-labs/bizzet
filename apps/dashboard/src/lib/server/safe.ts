import { randomUUID } from 'node:crypto'
import {
  sepolia as addresses,
  hashSafeTransaction,
  predictSafeAddress,
  proxyFactoryAbi,
  safeOwnerAbi,
} from '@bizzet/contracts'
import { and, type Db, eq, groups, inArray, safeTransactions } from '@bizzet/db'
import { type Address, getAddress, type Hex } from 'viem'
import { publicClient } from './chain'
import type { Group } from './visibility'

let proxyCreationCode: Promise<Hex> | undefined

function loadProxyCreationCode() {
  proxyCreationCode ??= publicClient.readContract({
    address: addresses.safe.proxyFactory,
    abi: proxyFactoryAbi,
    functionName: 'proxyCreationCode',
  })
  return proxyCreationCode
}

// グループの Safe のアドレス。モジュールなし・CompatibilityFallbackHandler の設定から CREATE2 で求める
export async function computeGroupSafeAddress(
  owners: readonly Address[],
  threshold: bigint,
  saltNonce: bigint,
) {
  return predictSafeAddress(
    { owners, threshold, kind: 'group' },
    saltNonce,
    await loadProxyCreationCode(),
  )
}

export async function isDeployed(address: Address) {
  const code = await publicClient.getCode({ address })
  return code !== undefined && code !== '0x'
}

// Safe のノンスを割り当てる。チェーン上のノンス（未配置なら 0）と、送信前・送信済みの提案のうち
// 最大のノンスの次の、大きい方を使う
export async function nextSafeNonce(db: Db, safe: Address) {
  const onchain = (await isDeployed(safe))
    ? await publicClient.readContract({
        address: safe,
        abi: safeOwnerAbi,
        functionName: 'nonce',
      })
    : 0n
  const pending = await db.query.safeTransactions.findMany({
    where: and(
      eq(safeTransactions.safeAddress, safe.toLowerCase()),
      inArray(safeTransactions.status, ['open', 'submitted']),
    ),
  })
  const maxPending = pending.reduce((max, tx) => Math.max(max, tx.nonce), -1)
  return BigInt(Math.max(Number(onchain), maxPending + 1))
}

export type CreateSafeTransactionInput = {
  group: Group
  kind: 'payout' | 'owner_change' | 'safe_setup'
  to: Address
  value?: bigint
  data: Hex
  operation?: 0 | 1
  createdBy: string
  token?: string | null
  amount?: string | null
  recipient?: string | null
  targetMemberId?: string | null
  description?: string | null
}

// Safe の取引の提案を作る。署名はウォレットで行い、ここでは署名の対象（safe_tx_hash）を決めて保存する
export async function createSafeTransaction(
  db: Db,
  input: CreateSafeTransactionInput,
) {
  if (!input.group.safeAddress) {
    throw new Error('このグループの Safe はまだ設定されていません')
  }
  const safe = getAddress(input.group.safeAddress)
  const nonce = await nextSafeNonce(db, safe)
  const operation = input.operation ?? 0
  const value = input.value ?? 0n
  const safeTxHash = hashSafeTransaction(safe, {
    to: input.to,
    value,
    data: input.data,
    operation,
    nonce,
  })
  const id = randomUUID()
  await db.insert(safeTransactions).values({
    id,
    groupId: input.group.id,
    safeAddress: safe.toLowerCase(),
    kind: input.kind,
    to: input.to.toLowerCase(),
    value: value.toString(),
    data: input.data,
    operation,
    nonce: Number(nonce),
    safeTxHash,
    token: input.token?.toLowerCase() ?? null,
    amount: input.amount ?? null,
    recipient: input.recipient?.toLowerCase() ?? null,
    targetMemberId: input.targetMemberId ?? null,
    description: input.description ?? null,
    createdBy: input.createdBy,
  })
  return { id, nonce, safeTxHash }
}

// 本部のグループ。1つの組織に1つだけ置く
export async function getHeadquarters(db: Db) {
  return db.query.groups.findFirst({ where: eq(groups.kind, 'headquarters') })
}
