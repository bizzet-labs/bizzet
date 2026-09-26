import { createSepoliaPublicClient } from '@bizzet/contracts'
import { env } from '$env/dynamic/public'

// ベータ版は Sepolia だけを使う。RPC のフォールバックは @bizzet/contracts に集約し、
// ウォレットとダッシュボードで設定がずれないようにする
export const publicClient = createSepoliaPublicClient(
  env.PUBLIC_SEPOLIA_RPC_URL,
)
