import { describe, expect, it } from 'vitest'
import { signToken, verifyToken } from './token'

const SECRET = 'test-secret'
const NOW = 1_700_000_000_000

describe('signToken / verifyToken', () => {
  it('同じ鍵で署名した期限内のトークンは、中身を返す', () => {
    const token = signToken({ passkeyId: 'abc', exp: NOW + 1000 }, SECRET)
    expect(verifyToken(token, SECRET, NOW)).toEqual({
      passkeyId: 'abc',
      exp: NOW + 1000,
    })
  })

  it('期限を過ぎたトークンは null', () => {
    const token = signToken({ passkeyId: 'abc', exp: NOW }, SECRET)
    expect(verifyToken(token, SECRET, NOW)).toBeNull()
  })

  it('別の鍵で署名したトークンは null', () => {
    const token = signToken({ passkeyId: 'abc', exp: NOW + 1000 }, 'other')
    expect(verifyToken(token, SECRET, NOW)).toBeNull()
  })

  it('中身を書き換えたトークンは null', () => {
    const token = signToken({ passkeyId: 'abc', exp: NOW + 1000 }, SECRET)
    const [, mac] = token.split('.')
    const forged = Buffer.from(
      JSON.stringify({ passkeyId: 'victim', exp: NOW + 1000 }),
    ).toString('base64url')
    expect(verifyToken(`${forged}.${mac}`, SECRET, NOW)).toBeNull()
  })

  it('形の崩れたトークンや空の値は null', () => {
    expect(verifyToken(undefined, SECRET, NOW)).toBeNull()
    expect(verifyToken('', SECRET, NOW)).toBeNull()
    expect(verifyToken('abc', SECRET, NOW)).toBeNull()
    expect(verifyToken('a.b.c', SECRET, NOW)).toBeNull()
  })

  it('exp のないトークンは null', () => {
    const token = signToken({ exp: 'never' } as never, SECRET)
    expect(verifyToken(token, SECRET, NOW)).toBeNull()
  })
})
