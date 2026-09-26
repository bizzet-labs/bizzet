import { erc20Abi, type TokenSymbol, tokens } from '@bizzet/contracts'
import { type Address, getAddress } from 'viem'
import { publicClient } from '$lib/chain'

// 1つの Safe の通貨ごとの残高（最小単位の10進文字列）。個別の呼び出しが失敗した通貨は null
export type TokenBalances = Record<TokenSymbol, string | null>

// Safe のアドレスごとに JPYC と USDC の balanceOf を読む。アドレス × 通貨の呼び出しを
// multicall3 で1回の RPC にまとめ、グループが増えても画面の表示が遅くならないようにする
export async function getBalances(
  addresses: readonly string[],
): Promise<Map<string, TokenBalances>> {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))]
  const result = new Map<string, TokenBalances>()
  if (unique.length === 0) return result

  const contracts = unique.flatMap((address) =>
    tokens.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [getAddress(address) as Address] as const,
    })),
  )
  const responses = await publicClient.multicall({
    contracts,
    allowFailure: true,
  })

  unique.forEach((address, i) => {
    const balances = {} as TokenBalances
    tokens.forEach((token, j) => {
      const response = responses[i * tokens.length + j]
      balances[token.symbol] =
        response?.status === 'success' ? response.result.toString() : null
    })
    result.set(address, balances)
  })
  return result
}
