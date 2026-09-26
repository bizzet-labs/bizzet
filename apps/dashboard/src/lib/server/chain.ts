import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { env } from '$env/dynamic/private'

// ベータ版は Sepolia だけを使う。SEPOLIA_RPC_URL が未設定なら、ログの取得に対応した公開 RPC を使う
export const DEFAULT_SEPOLIA_RPC_URL = 'https://sepolia.gateway.tenderly.co'

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(env.SEPOLIA_RPC_URL || DEFAULT_SEPOLIA_RPC_URL),
})
