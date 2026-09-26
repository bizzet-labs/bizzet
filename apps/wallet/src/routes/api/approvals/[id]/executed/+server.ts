import { json } from '@sveltejs/kit'
import { confirmExecution } from '$lib/server/approvals'
import { requireMember } from '$lib/server/member'
import type { RequestHandler } from './$types'

// 送った取引で提案が実行されたことを、レシートで確かめてから実行済みにする
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const { txHash } = (await request.json()) as { txHash?: unknown }
  const { member, group } = await requireMember(locals)
  await confirmExecution(locals.db, member, group, params.id, txHash)
  return json({ ok: true })
}
