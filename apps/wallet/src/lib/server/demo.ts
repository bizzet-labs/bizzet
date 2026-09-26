// デモモード（DEMO_MODE=1）。チェーン・ENS・パスキーの署名の代わりに DB だけで画面を動かす
import { randomBytes, randomUUID } from 'node:crypto'
import {
  findToken,
  type ReceivingCurrency,
  type TokenSymbol,
  tokens,
} from '@bizzet/contracts'
import {
  and,
  type Db,
  deposits,
  ensSettings,
  eq,
  groups,
  safeTransactions,
} from '@bizzet/db'
import { env } from '$env/dynamic/private'
import { toTokenAmount } from '$lib/pay'

export function isDemoMode() {
  return env.DEMO_MODE === '1'
}

type DemoBalances = Map<string, Record<'JPYC' | 'USDC', bigint>>

// 仮置き：@bizzet/db の getDemoBalances が入るまでのローカル実装。入ったら次の行を
// `export { getDemoBalances } from '@bizzet/db'` に置き換え、localDemoBalances を消す
export const getDemoBalances = localDemoBalances

// 入金の合計から、実行済みの出金を引いた残高（Safe のアドレスは小文字をキーにする）
async function localDemoBalances(
  db: Db,
  safeAddresses: readonly string[],
): Promise<DemoBalances> {
  const result: DemoBalances = new Map()
  for (const a of safeAddresses)
    result.set(a.toLowerCase(), { JPYC: 0n, USDC: 0n })
  const symbolOf = (token: string | null) => {
    if (!token) return undefined
    return (
      findToken(token)?.symbol ??
      tokens.find((t) => t.symbol === token.toUpperCase())?.symbol
    )
  }
  const add = (
    safe: string,
    token: string | null,
    amount: string | null,
    sign: bigint,
  ) => {
    const entry = result.get(safe.toLowerCase())
    const symbol = symbolOf(token)
    if (!entry || !symbol || !amount) return
    entry[symbol] += sign * BigInt(amount)
  }
  for (const d of await db.select().from(deposits)) {
    add(d.safeAddress, d.token, d.amount, 1n)
  }
  const payouts = await db.query.safeTransactions.findMany({
    where: and(
      eq(safeTransactions.kind, 'payout'),
      eq(safeTransactions.status, 'executed'),
    ),
  })
  for (const p of payouts) add(p.safeAddress, p.token, p.amount, -1n)
  return result
}

// ホームの表示と同じ、通貨ごとの最小単位の10進文字列にしたデモの残高
export async function getDemoTokenBalances(
  db: Db,
  addresses: readonly string[],
): Promise<Map<string, Record<TokenSymbol, string | null>>> {
  const balances = await getDemoBalances(db, addresses)
  return new Map(
    [...balances].map(([address, b]) => [
      address,
      { JPYC: b.JPYC.toString(), USDC: b.USDC.toString() } as Record<
        TokenSymbol,
        string | null
      >,
    ]),
  )
}

export function fakeTxHash() {
  return `0x${randomBytes(32).toString('hex')}` as const
}

export type DemoResolution = {
  name: string
  groupId: string
  address: string
  currency: ReceivingCurrency
  description: string
}

// ENS の代わりに DB から名前を解決する。本部の名前そのものは本部、<label>.<本部の名前> はその店舗
export async function resolveDemoName(
  db: Db,
  name: string,
): Promise<DemoResolution | null> {
  const settings = await db.query.ensSettings.findFirst({
    where: eq(ensSettings.id, 'default'),
  })
  if (!settings) return null
  const lower = name.toLowerCase()
  const hqName = settings.hqName.toLowerCase()
  let group: typeof groups.$inferSelect | undefined
  if (lower === hqName) {
    group = await db.query.groups.findFirst({
      where: eq(groups.kind, 'headquarters'),
    })
  } else if (lower.endsWith(`.${hqName}`)) {
    const label = lower.slice(0, -(hqName.length + 1))
    group = await db.query.groups.findFirst({
      where: eq(groups.ensLabel, label),
    })
  }
  if (!group?.safeAddress) return null
  return {
    name,
    groupId: group.id,
    address: group.safeAddress,
    currency: group.receivingCurrency,
    description: group.name,
  }
}

// 支払いの代わりに、受取通貨での入金を1件記録する
export async function recordDemoDeposit(
  db: Db,
  resolution: DemoResolution,
  priceJpy: number,
) {
  const token = tokens.find((t) => t.symbol === resolution.currency)
  if (!token) throw new Error('受取通貨がありません')
  const txHash = fakeTxHash()
  await db.insert(deposits).values({
    id: `demo:${randomUUID()}`,
    chainId: 11155111,
    groupId: resolution.groupId,
    safeAddress: resolution.address.toLowerCase(),
    token: token.address.toLowerCase(),
    amount: toTokenAmount(priceJpy, resolution.currency).toString(),
    from: '0x000000000000000000000000000000000000c0de',
    txHash,
    logIndex: 0,
    blockNumber: '0',
    blockTimestamp: new Date(),
  })
  return txHash
}

// Safe の次のノンス。チェーンの代わりに、実行済みの提案の最大のノンスの次とする
export async function demoSafeNonce(db: Db, safe: string) {
  const executed = await db.query.safeTransactions.findMany({
    where: and(
      eq(safeTransactions.safeAddress, safe.toLowerCase()),
      eq(safeTransactions.status, 'executed'),
    ),
    columns: { nonce: true },
  })
  return BigInt(executed.reduce((max, tx) => Math.max(max, tx.nonce + 1), 0))
}
