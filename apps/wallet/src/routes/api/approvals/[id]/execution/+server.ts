import { json } from '@sveltejs/kit'
import { buildExecution } from '$lib/server/approvals'
import { findMemberByPasskey } from '$lib/server/member'
import type { RequestHandler } from './$types'

// 署名のそろった提案を実行する呼び出しの並び。端末はこれを自分のパスキーのアカウントから送る
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const { passkeyId } = (await request.json()) as { passkeyId?: unknown }
  const { member, group } = await findMemberByPasskey(locals.db, passkeyId)
  const calls = await buildExecution(locals.db, member, group, params.id)
  return json({ calls })
}
