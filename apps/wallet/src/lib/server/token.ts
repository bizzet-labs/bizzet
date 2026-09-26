import { createHmac, timingSafeEqual } from 'node:crypto'

// 署名つきの小さなトークン。中身は JSON を base64url にしたもので、後ろに HMAC-SHA256 の署名を付ける。
// 中身は読めるため、秘密にしたい値は入れない。exp（ミリ秒の UNIX 時刻）を過ぎたものは無効とする
export type TokenPayload = { exp: number; [key: string]: unknown }

function hmac(body: string, secret: string) {
  return createHmac('sha256', secret).update(body).digest('base64url')
}

export function signToken(payload: TokenPayload, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${hmac(body, secret)}`
}

// 署名が合い、期限内のときだけ中身を返す。形が崩れたものは例外にせず null にする
export function verifyToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Record<string, unknown> | null {
  if (!token) return null
  const [body, mac, ...rest] = token.split('.')
  if (!body || !mac || rest.length > 0) return null
  const expected = Buffer.from(hmac(body, secret))
  const actual = Buffer.from(mac)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null
  }
  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof payload !== 'object' || payload === null) return null
  const { exp } = payload as { exp?: unknown }
  if (typeof exp !== 'number' || exp <= now) return null
  return payload as Record<string, unknown>
}
