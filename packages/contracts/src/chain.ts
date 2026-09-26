import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'

// ベータ版は Sepolia だけを使う。未設定なら、ログの取得に対応した公開 RPC を使う。
// ウォレットとダッシュボードで別々に定義すると設定がずれるため、ここに1つだけ置く
export const DEFAULT_SEPOLIA_RPC_URL = 'https://sepolia.gateway.tenderly.co'

export function createSepoliaPublicClient(rpcUrl?: string) {
  return createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl || DEFAULT_SEPOLIA_RPC_URL),
  })
}
