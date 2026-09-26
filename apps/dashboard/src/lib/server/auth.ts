import { randomBytes } from 'node:crypto'
import { type Db, eq, members, passkeys, sessions } from '@bizzet/db'
import type { Cookies } from '@sveltejs/kit'
import { Hex, PublicKey, Signature, WebAuthnP256 } from 'ox'
import { env } from '$env/dynamic/public'

export const SESSION_COOKIE = 'session'
const CHALLENGE_COOKIE = 'passkey_challenge'
const CHALLENGE_TTL_SEC = 5 * 60
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

// ブラウザがパスキーで署名する使い捨ての値。Cookie に置き、ログイン時に突き合わせる
export function issueChallenge(cookies: Cookies): Hex.Hex {
  const challenge = Hex.fromBytes(randomBytes(32))
  cookies.set(CHALLENGE_COOKIE, challenge, {
    path: '/login',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: CHALLENGE_TTL_SEC,
  })
  return challenge
}

// ブラウザから送る WebAuthn の応答。署名は 16 進、クレデンシャル ID は base64url
export type LoginResponse = {
  credentialId: string
  metadata: WebAuthnP256.SignMetadata
  signature: Hex.Hex
}

export type Member = typeof members.$inferSelect

// 保存した公開鍵で署名を検証し、対応するメンバーを返す。検証できなければ null
export async function verifyLogin(
  db: Db,
  cookies: Cookies,
  response: LoginResponse,
  origin: string,
): Promise<Member | null> {
  const challenge = cookies.get(CHALLENGE_COOKIE)
  cookies.delete(CHALLENGE_COOKIE, { path: '/login' })
  if (!challenge || !Hex.validate(challenge)) return null

  const passkey = await db.query.passkeys.findFirst({
    where: eq(passkeys.id, response.credentialId),
  })
  if (!passkey) return null

  const publicKey = PublicKey.from(passkey.publicKey as Hex.Hex)
  let ok = false
  try {
    ok = WebAuthnP256.verify({
      challenge,
      metadata: response.metadata,
      signature: Signature.fromHex(response.signature),
      publicKey,
      origin,
      rpId: env.PUBLIC_PASSKEY_RP_ID || new URL(origin).hostname,
    })
  } catch {
    return null
  }
  if (!ok) return null

  const member = await db.query.members.findFirst({
    where: eq(members.passkeyId, passkey.id),
  })
  return member ?? null
}

export async function createSession(
  db: Db,
  cookies: Cookies,
  memberId: string,
) {
  const id = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(sessions).values({ id, memberId, expiresAt })
  cookies.set(SESSION_COOKIE, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    expires: expiresAt,
  })
}

export async function getSessionMember(
  db: Db,
  cookies: Cookies,
): Promise<Member | null> {
  const id = cookies.get(SESSION_COOKIE)
  if (!id) return null
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
  })
  if (!session || session.expiresAt.getTime() < Date.now()) {
    cookies.delete(SESSION_COOKIE, { path: '/' })
    return null
  }
  const member = await db.query.members.findFirst({
    where: eq(members.id, session.memberId),
  })
  return member ?? null
}

export async function deleteSession(db: Db, cookies: Cookies) {
  const id = cookies.get(SESSION_COOKIE)
  cookies.delete(SESSION_COOKIE, { path: '/' })
  if (id) await db.delete(sessions).where(eq(sessions.id, id))
}
