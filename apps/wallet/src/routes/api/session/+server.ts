import { eq, members, passkeys } from '@bizzet/db'
import { error, json } from '@sveltejs/kit'
import type { Hex } from 'ox'
import { env } from '$env/dynamic/public'
import { clearSession, setSession, takeChallenge } from '$lib/server/session'
import { parseAssertion, verifyLoginAssertion } from '$lib/server/webauthn'
import type { RequestHandler } from './$types'

// チャレンジへのパスキーの署名を、DB に保存した公開鍵で確かめてからログインさせる。
// 端末がこのパスキーの情報を持っていなくても使えるよう、公開鍵と署名者を返す
export const POST: RequestHandler = async ({
  cookies,
  locals,
  request,
  url,
}) => {
  const { id, signature } = (await request.json()) as {
    id?: unknown
    signature?: unknown
  }
  const challenge = takeChallenge(cookies)
  if (!challenge) {
    error(400, 'ログインの有効期限が切れました。やり直してください')
  }
  const assertion = parseAssertion(signature)
  if (typeof id !== 'string' || !id || !assertion) {
    error(400, '署名の形式が正しくありません')
  }
  const passkey = await locals.db.query.passkeys.findFirst({
    where: eq(passkeys.id, id),
  })
  if (!passkey) error(401, 'このパスキーは登録されていません')
  const ok = verifyLoginAssertion({
    assertion,
    challenge,
    publicKey: passkey.publicKey as Hex.Hex,
    origin: url.origin,
    // パスキーを紐づけたドメイン。未設定なら開いているホスト名（ブラウザ側と同じ決め方）
    rpId: env.PUBLIC_PASSKEY_RP_ID || url.hostname,
  })
  if (!ok) error(401, 'パスキーの署名を検証できませんでした')
  const member = await locals.db.query.members.findFirst({
    where: eq(members.passkeyId, passkey.id),
  })
  if (!member) error(401, 'このパスキーのメンバーが見つかりません')
  setSession(cookies, passkey.id)
  return json({
    id: passkey.id,
    publicKey: passkey.publicKey,
    signer: passkey.signer,
  })
}

// ログアウト
export const DELETE: RequestHandler = ({ cookies }) => {
  clearSession(cookies)
  return json({ ok: true })
}
