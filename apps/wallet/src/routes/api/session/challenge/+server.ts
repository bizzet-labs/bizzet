import { json } from '@sveltejs/kit'
import { setChallenge } from '$lib/server/session'
import { newChallenge } from '$lib/server/webauthn'
import type { RequestHandler } from './$types'

// ログインでパスキーに署名させる、使い捨てのチャレンジを出す
export const POST: RequestHandler = ({ cookies }) => {
  const challenge = newChallenge()
  setChallenge(cookies, challenge)
  return json({ challenge })
}
