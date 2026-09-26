import { Bytes, Hash, Hex, PublicKey, WebAuthnP256 } from 'ox'
import { toCoordinates } from '$lib/passkey'

const HEX = /^0x[0-9a-fA-F]+$/

export type LoginAssertion = {
  authenticatorData: Hex.Hex
  clientDataJSON: string
  r: bigint
  s: bigint
}

// 端末から届いたログインの署名の形を確かめ、検証に使える形に直す。形が違えば null
export function parseAssertion(value: unknown): LoginAssertion | null {
  if (typeof value !== 'object' || value === null) return null
  const { authenticatorData, clientDataJSON, r, s } = value as Record<
    string,
    unknown
  >
  if (
    typeof authenticatorData !== 'string' ||
    !HEX.test(authenticatorData) ||
    typeof clientDataJSON !== 'string' ||
    typeof r !== 'string' ||
    !HEX.test(r) ||
    typeof s !== 'string' ||
    !HEX.test(s)
  ) {
    return null
  }
  return {
    authenticatorData: authenticatorData as Hex.Hex,
    clientDataJSON,
    r: BigInt(r),
    s: BigInt(s),
  }
}

// ログインの署名を、サーバーが出したチャレンジと、DB に保存したパスキーの公開鍵で確かめる。
// ox の検証に加え、ログイン用の署名であること・開いているオリジン・パスキーのドメインを明示して確かめる
export function verifyLoginAssertion(options: {
  assertion: LoginAssertion
  challenge: Hex.Hex
  // DB に保存した公開鍵（x と y をつなげた 64 バイト）
  publicKey: Hex.Hex
  origin: string
  rpId: string
}) {
  const { assertion, challenge, publicKey, origin, rpId } = options
  let clientData: { type?: unknown; origin?: unknown }
  try {
    clientData = JSON.parse(assertion.clientDataJSON)
  } catch {
    return false
  }
  if (clientData.type !== 'webauthn.get') return false
  if (clientData.origin !== origin) return false
  const authenticatorData = Bytes.fromHex(assertion.authenticatorData)
  if (authenticatorData.length < 37) return false
  const rpIdHash = Hash.sha256(Bytes.fromString(rpId), { as: 'Bytes' })
  if (!Bytes.isEqual(authenticatorData.slice(0, 32), rpIdHash)) return false

  const { x, y } = toCoordinates(publicKey)
  try {
    return WebAuthnP256.verify({
      challenge,
      origin,
      rpId,
      metadata: {
        authenticatorData: assertion.authenticatorData,
        clientDataJSON: assertion.clientDataJSON,
        // 端末の申告にかかわらず、生体認証などでの本人確認を必須にする
        userVerificationRequired: true,
      },
      signature: { r: assertion.r, s: assertion.s },
      publicKey: PublicKey.from({ prefix: 4, x, y }),
    })
  } catch {
    return false
  }
}

export function newChallenge() {
  return Hex.fromBytes(Bytes.random(32))
}
