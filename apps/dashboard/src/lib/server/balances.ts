import {
  type OnchainTokenBalances,
  readTokenBalances,
  tokens,
} from '@bizzet/contracts'
import { publicClient } from './chain'

// 1つの Safe の通貨ごとの残高（最小単位）。個別の呼び出しが失敗した通貨は null
export type TokenBalances = OnchainTokenBalances

// 画面に渡す通貨の一覧。小数の桁数は画面側での表示に使う
export const balanceTokens = tokens.map((t) => ({
  symbol: t.symbol,
  decimals: t.decimals,
}))

// Safe のアドレスごとに JPYC と USDC の残高を、multicall3 の1回の RPC で読む。
// RPC 自体が失敗した場合は例外を投げ、呼び出し側でエラーの表示に切り替える
export function getBalances(
  addresses: readonly string[],
): Promise<Map<string, TokenBalances>> {
  return readTokenBalances(publicClient, addresses)
}
