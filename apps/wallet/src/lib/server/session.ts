import { randomBytes } from 'node:crypto'
import type { Cookies } from '@sveltejs/kit'
import type { Hex } from 'ox'
import { dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { signToken, verifyToken } from './token'

const SESSION_COOKIE = 'bizzet_session'
const CHALLENGE_COOKIE = 'bizzet_login_challenge'
// ログインしたままでいられる時間
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
// ログインのチャレンジに署名するまでの猶予
const CHALLENGE_TTL_MS = 5 * 60 * 1000

// 開発中に秘密鍵を設定していなければ、プロセスごとの使い捨ての鍵で署名する。再起動するとログインし直しになる
let devSecret: string | undefined

function secret() {
  if (env.WALLET_SESSION_SECRET) return env.WALLET_SESSION_SECRET
  if (!dev) throw new Error('WALLET_SESSION_SECRET が設定されていません')
  if (!devSecret) {
    devSecret = randomBytes(32).toString('hex')
    console.warn(
      'WALLET_SESSION_SECRET が未設定のため、使い捨ての鍵でセッションに署名します',
    )
  }
  return devSecret
}

// Secure は SvelteKit の既定に任せる（http の localhost 以外では付く）
const cookieOptions = { path: '/', httpOnly: true, sameSite: 'lax' } as const

export function setSession(cookies: Cookies, passkeyId: string) {
  const exp = Date.now() + SESSION_TTL_MS
  cookies.set(SESSION_COOKIE, signToken({ passkeyId, exp }, secret()), {
    ...cookieOptions,
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export function clearSession(cookies: Cookies) {
  cookies.delete(SESSION_COOKIE, cookieOptions)
}

// セッションの Cookie が正しく署名され期限内なら、ログインしたパスキーのクレデンシャル ID を返す
export function readSession(cookies: Cookies): string | null {
  const payload = verifyToken(cookies.get(SESSION_COOKIE), secret())
  return typeof payload?.passkeyId === 'string' ? payload.passkeyId : null
}

// ログインのチャレンジを、DB に置かずに署名つきの Cookie で覚えておく
export function setChallenge(cookies: Cookies, challenge: Hex.Hex) {
  const exp = Date.now() + CHALLENGE_TTL_MS
  cookies.set(CHALLENGE_COOKIE, signToken({ challenge, exp }, secret()), {
    ...cookieOptions,
    maxAge: CHALLENGE_TTL_MS / 1000,
  })
}

// 覚えておいたチャレンジを取り出す。使い回されないよう、取り出したら消す
export function takeChallenge(cookies: Cookies): Hex.Hex | null {
  const payload = verifyToken(cookies.get(CHALLENGE_COOKIE), secret())
  cookies.delete(CHALLENGE_COOKIE, cookieOptions)
  return typeof payload?.challenge === 'string'
    ? (payload.challenge as Hex.Hex)
    : null
}
