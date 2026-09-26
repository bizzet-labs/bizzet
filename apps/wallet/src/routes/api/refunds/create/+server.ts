import { error, json } from '@sveltejs/kit'
import { requireMember } from '$lib/server/member'
import { createRefund } from '$lib/server/refunds'
import type { RequestHandler } from './$types'

// 返金の申請（W-03）。ロールを問わず、店舗のメンバーなら自分の店舗の Safe からの出金の提案を作れる
export const POST: RequestHandler = async ({ locals, request }) => {
  const body = (await request.json()) as Record<string, unknown>
  const { member, group } = await requireMember(locals)
  if (group.kind !== 'store') {
    error(403, '返金は店舗のメンバーが申請します')
  }
  let result: Awaited<ReturnType<typeof createRefund>>
  try {
    result = await createRefund(locals.db, member, group, {
      token: body.token,
      amount: body.amount,
      recipient: body.recipient,
      memo: body.memo,
    })
  } catch (e) {
    // ノンスの割り当てにチェーンの読み取りが要るため、RPC の失敗はやり直しを促す
    console.error(e)
    error(503, '申請できませんでした。しばらくしてからやり直してください')
  }
  if (!result.ok) error(400, result.message)
  return json({ id: result.value.id })
}
