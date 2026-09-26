import { error, json } from '@sveltejs/kit'
import { findMemberByPasskey } from '$lib/server/member'
import { issuePasswordLink } from '$lib/server/password-link'
import type { RequestHandler } from './$types'

// ダッシュボードのパスワードを追加するためのリンク（W-07）を発行する
export const POST: RequestHandler = async ({ locals, request }) => {
  const { passkeyId } = (await request.json()) as { passkeyId?: unknown }
  const { member } = await findMemberByPasskey(locals.db, passkeyId)
  if (member.userId) {
    error(409, 'ダッシュボードのパスワードはすでに登録されています')
  }
  return json({ passwordLink: await issuePasswordLink(locals.db, member) })
}
