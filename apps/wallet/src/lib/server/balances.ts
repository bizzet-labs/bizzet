import { readTokenBalances, type TokenSymbol } from '@bizzet/contracts'
import { publicClient } from '$lib/chain'

// 1つの Safe の通貨ごとの残高（最小単位の10進文字列）。個別の呼び出しが失敗した通貨は null
export type TokenBalances = Record<TokenSymbol, string | null>

// Safe のアドレスごとに JPYC と USDC の balanceOf を読む。アドレス × 通貨の呼び出しを
// multicall3 で1回の RPC にまとめ、グループが増えても画面の表示が遅くならないようにする
export async function getBalances(
  addresses: readonly string[],
): Promise<Map<string, TokenBalances>> {
  const onchain = await readTokenBalances(publicClient, addresses)
  const result = new Map<string, TokenBalances>()
  for (const [address, balances] of onchain) {
    result.set(
      address,
      Object.fromEntries(
        Object.entries(balances).map(([symbol, value]) => [
          symbol,
          value === null ? null : value.toString(),
        ]),
      ) as TokenBalances,
    )
  }
  return result
}
