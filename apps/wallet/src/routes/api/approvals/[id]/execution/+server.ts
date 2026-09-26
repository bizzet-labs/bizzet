import { json } from '@sveltejs/kit'
import { executeDemo } from '$lib/server/approval-demo'
import { buildExecution } from '$lib/server/approvals'
import { isDemoMode } from '$lib/server/demo'
import { requireMember } from '$lib/server/member'
import type { RequestHandler } from './$types'

// 署名のそろった提案を実行する呼び出しの並び。端末はこれを自分のパスキーのアカウントから送る
export const POST: RequestHandler = async ({ locals, params }) => {
  const { member, group } = await requireMember(locals)
  // デモモードでは送信せず、その場で実行済みにして模擬の取引のハッシュを返す
  if (isDemoMode()) {
    const txHash = await executeDemo(locals.db, member, group, params.id)
    return json({ calls: [], txHash })
  }
  const calls = await buildExecution(locals.db, member, group, params.id)
  return json({ calls })
}
