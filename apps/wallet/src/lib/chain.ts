import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'

// ベータ版は Sepolia だけを使う
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
})
