import { error } from '@sveltejs/kit'
import { m } from '$lib/paraglide/messages.js'
import type { PageServerLoad } from './$types'

// 別のチェーンから本部の Safe へ移動中の売上の1件。画面の各行に出す項目にそろえる
export type BridgeTransfer = {
  id: string
  sourceChain: string
  symbol: string
  decimals: number
  amount: string
  receivedAt: string
  expectedArrivalAt: string | null
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.member) error(401)

  // ベータ版は Sepolia だけで動き、自動ブリッジを有効にしていないため、移動中の売上は常にない。
  // 自動ブリッジを有効にする時点で、ここで見られるグループの移動中の売上を読む
  const transfers: BridgeTransfer[] = []

  return {
    pageTitle: m.common_nav_bridge(),
    transfers,
  }
}
