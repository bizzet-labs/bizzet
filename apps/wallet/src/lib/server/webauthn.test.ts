import { Bytes, Hash, Hex, P256, PublicKey, WebAuthnP256 } from 'ox'
import { describe, expect, it } from 'vitest'
import {
  type LoginAssertion,
  parseAssertion,
  verifyLoginAssertion,
} from './webauthn'

const ORIGIN = 'https://wallet.example.com'
const RP_ID = 'example.com'
const challenge = Hex.fromBytes(Bytes.random(32))
const privateKey = P256.randomPrivateKey()
// DB に保存する形（x と y をつなげた 64 バイト）
const publicKey = Hex.slice(
  PublicKey.toHex(P256.getPublicKey({ privateKey })),
  1,
)

// 端末のパスキーが返す署名を、秘密鍵から作る
function assert(
  options: Partial<WebAuthnP256.getSignPayload.Options> = {},
  clientDataJSON?: (json: string) => string,
): LoginAssertion {
  const { metadata } = WebAuthnP256.getSignPayload({
    challenge,
    origin: ORIGIN,
    rpId: RP_ID,
    ...options,
  })
  const json = clientDataJSON
    ? clientDataJSON(metadata.clientDataJSON)
    : metadata.clientDataJSON
  const payload = Hex.concat(
    metadata.authenticatorData,
    Hash.sha256(Hex.fromString(json)),
  )
  const { r, s } = P256.sign({ payload, privateKey, hash: true })
  return {
    authenticatorData: metadata.authenticatorData,
    clientDataJSON: json,
    r,
    s,
  }
}

const verify = (assertion: LoginAssertion, overrides = {}) =>
  verifyLoginAssertion({
    assertion,
    challenge,
    publicKey,
    origin: ORIGIN,
    rpId: RP_ID,
    ...overrides,
  })

describe('verifyLoginAssertion', () => {
  it('チャレンジ・オリジン・ドメイン・公開鍵がそろった署名は通す', () => {
    expect(verify(assert())).toBe(true)
  })

  it('別のチャレンジへの署名は拒む', () => {
    expect(verify(assert({ challenge: Hex.fromBytes(Bytes.random(32)) }))).toBe(
      false,
    )
  })

  it('別のオリジンで作られた署名は拒む', () => {
    expect(verify(assert({ origin: 'https://evil.example' }))).toBe(false)
  })

  it('別のドメインに紐づいたパスキーの署名は拒む', () => {
    expect(verify(assert({ rpId: 'evil.example' }))).toBe(false)
  })

  it('登録時の署名（webauthn.create）は拒む', () => {
    expect(
      verify(
        assert({}, (json) => json.replace('webauthn.get', 'webauthn.create')),
      ),
    ).toBe(false)
  })

  it('別の公開鍵では拒む', () => {
    const other = Hex.slice(
      PublicKey.toHex(
        P256.getPublicKey({ privateKey: P256.randomPrivateKey() }),
      ),
      1,
    )
    expect(verify(assert(), { publicKey: other })).toBe(false)
  })

  it('本人確認（UV）のない署名は拒む', () => {
    expect(verify(assert({ flag: 0x01 }))).toBe(false)
  })

  it('clientDataJSON が JSON でなければ拒む', () => {
    expect(verify({ ...assert(), clientDataJSON: 'not json' })).toBe(false)
  })
})

describe('parseAssertion', () => {
  it('16 進の r・s を bigint に直す', () => {
    expect(
      parseAssertion({
        authenticatorData: '0x00',
        clientDataJSON: '{}',
        r: '0x01',
        s: '0x02',
      }),
    ).toEqual({
      authenticatorData: '0x00',
      clientDataJSON: '{}',
      r: 1n,
      s: 2n,
    })
  })

  it('形が違えば null', () => {
    expect(parseAssertion(null)).toBeNull()
    expect(
      parseAssertion({ authenticatorData: 'xx', clientDataJSON: '{}' }),
    ).toBeNull()
  })
})
