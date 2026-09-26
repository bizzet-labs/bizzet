import { and, eq, inArray } from 'drizzle-orm'
import type { Db } from './client.ts'
import { deposits, safeTransactions } from './schema.ts'

// デモモードの残高の計算に使う通貨。@bizzet/contracts の tokens と同じ Sepolia のアドレス
const DEMO_TOKENS = {
  JPYC: '0xe7c3d8c9a439fede00d2600032d5db0be71c3c29',
  USDC: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
} as const

export type DemoTokenSymbol = keyof typeof DEMO_TOKENS
export type DemoBalances = Record<DemoTokenSymbol, bigint>

const symbolByAddress = new Map<string, DemoTokenSymbol>(
  (Object.entries(DEMO_TOKENS) as [DemoTokenSymbol, string][]).map(
    ([symbol, address]) => [address, symbol],
  ),
)

// ERC-20 の transfer(address,uint256) のセレクター
const TRANSFER_SELECTOR = '0xa9059cbb'

// 実行済みの出金から、通貨と金額を読む。保存した token・amount を優先し、無ければ data の transfer を解く
function payoutOf(tx: {
  to: string
  data: string
  token: string | null
  amount: string | null
}): { symbol: DemoTokenSymbol; amount: bigint } | null {
  const token = (tx.token ?? tx.to).toLowerCase()
  const symbol = symbolByAddress.get(token)
  if (!symbol) return null
  if (tx.amount && /^\d+$/.test(tx.amount)) {
    return { symbol, amount: BigInt(tx.amount) }
  }
  const data = tx.data.toLowerCase()
  if (data.startsWith(TRANSFER_SELECTOR) && data.length >= 10 + 128) {
    return { symbol, amount: BigInt(`0x${data.slice(10 + 64, 10 + 128)}`) }
  }
  return null
}

// デモモードの Safe の残高。チェーンを読まず、入金の合計から実行済みの出金の合計を引いて求める。
// キーは小文字のアドレス
export async function getDemoBalances(
  db: Db,
  safeAddresses: readonly string[],
): Promise<Map<string, DemoBalances>> {
  const safes = [...new Set(safeAddresses.map((a) => a.toLowerCase()))]
  const result = new Map<string, DemoBalances>(
    safes.map((s) => [s, { JPYC: 0n, USDC: 0n }]),
  )
  if (safes.length === 0) return result

  const [depositRows, payoutRows] = await Promise.all([
    db
      .select({
        safeAddress: deposits.safeAddress,
        token: deposits.token,
        amount: deposits.amount,
      })
      .from(deposits)
      .where(inArray(deposits.safeAddress, safes)),
    db
      .select({
        safeAddress: safeTransactions.safeAddress,
        to: safeTransactions.to,
        data: safeTransactions.data,
        token: safeTransactions.token,
        amount: safeTransactions.amount,
      })
      .from(safeTransactions)
      .where(
        and(
          inArray(safeTransactions.safeAddress, safes),
          eq(safeTransactions.kind, 'payout'),
          eq(safeTransactions.status, 'executed'),
        ),
      ),
  ])

  for (const row of depositRows) {
    const balances = result.get(row.safeAddress.toLowerCase())
    const symbol = symbolByAddress.get(row.token.toLowerCase())
    if (!balances || !symbol || !/^\d+$/.test(row.amount)) continue
    balances[symbol] += BigInt(row.amount)
  }
  for (const row of payoutRows) {
    const balances = result.get(row.safeAddress.toLowerCase())
    const payout = payoutOf(row)
    if (!balances || !payout) continue
    balances[payout.symbol] -= payout.amount
  }
  return result
}
