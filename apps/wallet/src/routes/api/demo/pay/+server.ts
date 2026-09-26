import { error, json } from '@sveltejs/kit'
import { MAX_PRICE_JPY } from '$lib/pay'
import {
  isDemoMode,
  recordDemoDeposit,
  resolveDemoName,
} from '$lib/server/demo'
import type { RequestHandler } from './$types'

// デモモードの支払い。取引を送らず、受取通貨での入金を DB に記録して模擬の取引のハッシュを返す
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!isDemoMode()) error(404)
  const { name, priceJpy } = (await request.json()) as {
    name?: unknown
    priceJpy?: unknown
  }
  if (
    typeof name !== 'string' ||
    typeof priceJpy !== 'number' ||
    !Number.isInteger(priceJpy) ||
    priceJpy <= 0 ||
    priceJpy > MAX_PRICE_JPY
  ) {
    error(400, '支払いの内容が正しくありません')
  }
  const resolution = await resolveDemoName(locals.db, name)
  if (!resolution) error(404, 'この名前の受取先がありません')
  const txHash = await recordDemoDeposit(locals.db, resolution, priceJpy)
  return json({ txHash })
}
