import { DEFAULT_SEPOLIA_RPC_URL } from '@bizzet/contracts'
import { createWalletClient, type Hex, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { env } from '$env/dynamic/private'

// 運用者の鍵。ENS の名前の登録とレコードの書き込み、グループの Safe の配置のガス代を払う。
// 資金は持たず、Safe の中身（オーナーとしきい値）は保存した設定で決まるため、この鍵では変えられない。未設定なら null
export function operatorWallet() {
  const key = env.ENS_OPERATOR_PRIVATE_KEY
  if (!key) return null
  return createWalletClient({
    account: privateKeyToAccount(key as Hex),
    chain: sepolia,
    transport: http(env.SEPOLIA_RPC_URL || DEFAULT_SEPOLIA_RPC_URL),
  })
}

export function isOperatorConfigured() {
  return Boolean(env.ENS_OPERATOR_PRIVATE_KEY)
}
