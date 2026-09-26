import { json } from '@sveltejs/kit'
import { listApprovals } from '$lib/server/approvals'
import { findMemberByPasskey, isHeadquartersSigner } from '$lib/server/member'
import type { RequestHandler } from './$types'

// 承認（WS-06）に出す、送信前の提案の一覧
export const POST: RequestHandler = async ({ locals, request }) => {
  const { passkeyId } = (await request.json()) as { passkeyId?: unknown }
  const { member, passkey, group } = await findMemberByPasskey(
    locals.db,
    passkeyId,
  )
  const approvals = await listApprovals(locals.db, member, group, passkey)
  return json({ canSign: isHeadquartersSigner(member, group), approvals })
}
