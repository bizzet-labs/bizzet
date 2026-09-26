import { eq, members, passkeys } from '@bizzet/db'
import { error, json } from '@sveltejs/kit'
import { isDemoMode } from '$lib/server/demo'
import { setSession } from '$lib/server/session'
import type { RequestHandler } from './$types'

// デモモードのログイン。パスキーの署名を求めず、選んだメンバーのパスキーでセッションを作る
export const POST: RequestHandler = async ({ cookies, locals, request }) => {
  if (!isDemoMode()) error(404)
  const { memberId } = (await request.json()) as { memberId?: unknown }
  if (typeof memberId !== 'string') error(400, 'メンバーを選んでください')
  const member = await locals.db.query.members.findFirst({
    where: eq(members.id, memberId),
  })
  if (!member?.passkeyId) error(404, 'このメンバーはパスキーを登録していません')
  const passkey = await locals.db.query.passkeys.findFirst({
    where: eq(passkeys.id, member.passkeyId),
  })
  if (!passkey) error(404, 'このメンバーのパスキーが見つかりません')
  setSession(cookies, passkey.id)
  return json({
    id: passkey.id,
    publicKey: passkey.publicKey,
    signer: passkey.signer,
  })
}
