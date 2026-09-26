import { randomBytes } from 'node:crypto'
import type { Hex } from 'viem'
import { env } from '$env/dynamic/private'

// デモモード。DEMO_MODE=1 のときだけ、チェーンへの送信・ENS の登録・チェーンの読み取りを模擬に置き換える。
// 未設定なら通常どおりチェーンを使う
export function isDemoMode() {
  return env.DEMO_MODE === '1'
}

// 模擬の取引のハッシュ。チェーンには存在しない乱数の 32 バイト
export function fakeTxHash(): Hex {
  return `0x${randomBytes(32).toString('hex')}`
}

// デモモードで Safe のアドレスを予測するときの proxyCreationCode の代わり。
// チェーンを読まないため実際の Safe のアドレスとは一致しないが、設定から決まる値にはなる
export const DEMO_PROXY_CREATION_CODE: Hex = '0x'
