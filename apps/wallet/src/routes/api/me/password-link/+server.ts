import { error, json } from '@sveltejs/kit'
import { requireMember } from '$lib/server/member'
import { issuePasswordLink } from '$lib/server/password-link'
import type { RequestHandler } from './$types'

// ダッシュボードのパスワードを追加するためのリンク（W-07）を発行する
export const POST: RequestHandler = async ({ locals }) => {
  const { member } = await requireMember(locals)
  if (member.userId) {
    error(409, 'ダッシュボードのパスワードはすでに登録されています')
  }
  return json({ passwordLink: await issuePasswordLink(locals.db, member) })
}
