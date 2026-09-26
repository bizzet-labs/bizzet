import { type Address, getAddress, type PublicClient } from 'viem'
import {
  erc20Abi,
  safeOwnerAbi,
  type TokenSymbol,
  tokens,
} from './safe-transaction.ts'

// チェーンだけを読む共通の処理。データベースには触れず、ウォレットとダッシュボードのどちらからも使える

// アドレスにコントラクトのコードが置かれているか。Safe や署名者が配置済みかの判定に使う
export async function isDeployed(client: PublicClient, address: Address) {
  const code = await client.getCode({ address })
  return code !== undefined && code !== '0x'
}

// Safe のチェーン上のノンス。未配置の Safe は 0 とみなす
export async function readSafeNonce(client: PublicClient, safe: Address) {
  if (!(await isDeployed(client, safe))) return 0n
  return client.readContract({
    address: safe,
    abi: safeOwnerAbi,
    functionName: 'nonce',
  })
}

// 1つのアドレスの通貨ごとの残高（最小単位）。個別の呼び出しが失敗した通貨は null
export type OnchainTokenBalances = Record<TokenSymbol, bigint | null>

// アドレスごとに JPYC と USDC の balanceOf を読む。アドレス × 通貨の呼び出しを multicall3 で1回の RPC にまとめる。
// 結果のキーは小文字のアドレスで、重複したアドレスは1回だけ読む
export async function readTokenBalances(
  client: PublicClient,
  addresses: readonly string[],
): Promise<Map<string, OnchainTokenBalances>> {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))]
  const result = new Map<string, OnchainTokenBalances>()
  if (unique.length === 0) return result

  const contracts = unique.flatMap((address) =>
    tokens.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [getAddress(address)] as const,
    })),
  )
  const responses = await client.multicall({ contracts, allowFailure: true })

  unique.forEach((address, i) => {
    const balances = {} as OnchainTokenBalances
    tokens.forEach((token, j) => {
      const response = responses[i * tokens.length + j]
      balances[token.symbol] =
        response?.status === 'success' ? response.result : null
    })
    result.set(address, balances)
  })
  return result
}
