import {
  sepolia as addresses,
  signerFactoryAbi,
  verifiers,
} from '@bizzet/contracts'
import { Hex, WebAuthnP256 } from 'ox'
import type { Address } from 'viem'
import { createWebAuthnCredential } from 'viem/account-abstraction'
import { env } from '$env/dynamic/public'
import { publicClient } from './chain.js'

// パスキーを紐づけるドメイン。ウォレットとダッシュボードで同じ親ドメインを指すことで、
// 一方で登録したパスキーを他方のログインでも使える。未設定なら表示中のホスト名
export const RP_ID = env.PUBLIC_PASSKEY_RP_ID || undefined

// ログインや署名に使うパスキーを選ぶため、この端末のパスキーの情報をブラウザ内に保存する。
// 正本は DB にあり、ログインのたびにサーバーが返した情報で保存し直す
const STORAGE_KEY = 'bizzet:passkey'

export type StoredPasskey = {
  id: string
  // P-256 の公開鍵（x と y をつなげた 64 バイト）
  publicKey: Hex.Hex
  // Safe のオーナーになる署名者のアドレス
  signer: Address
}

export function loadPasskey(): StoredPasskey | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredPasskey) : null
  } catch {
    return null
  }
}

function savePasskey(passkey: StoredPasskey) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(passkey))
  } catch {
    // 保存できない環境では、次回また登録からやり直す
  }
}

export function toCoordinates(publicKey: Hex.Hex) {
  return {
    x: Hex.toBigInt(Hex.slice(publicKey, 0, 32)),
    y: Hex.toBigInt(Hex.slice(publicKey, 32, 64)),
  }
}

// パスキーを作り、その公開鍵から署名者のアドレスを求める。署名者はまだ配置しない
export async function registerPasskey(): Promise<StoredPasskey> {
  const credential = await createWebAuthnCredential({
    name: 'bizzet',
    ...(RP_ID && { rp: { id: RP_ID, name: 'bizzet' } }),
  })
  const { x, y } = toCoordinates(credential.publicKey)
  const signer = await publicClient.readContract({
    address: addresses.passkey.signerFactory,
    abi: signerFactoryAbi,
    functionName: 'getSigner',
    args: [x, y, verifiers],
  })
  const passkey = { id: credential.id, publicKey: credential.publicKey, signer }
  savePasskey(passkey)
  return passkey
}

// サーバーが出した使い捨てのチャレンジにパスキーで署名させ、サーバーで検証してもらってログインする。
// 端末にパスキーの情報がなければ、端末が持つパスキーから選ばせ、サーバーが返した情報を保存し直す
export async function login(passkey: StoredPasskey | null) {
  const { challenge } = await postJson<{ challenge: Hex.Hex }>(
    '/api/session/challenge',
  )
  const { id, metadata, signature } = await WebAuthnP256.sign({
    credentialId: passkey?.id,
    challenge,
    rpId: RP_ID,
  })
  const stored = await postJson<StoredPasskey>('/api/session', {
    id,
    signature: {
      authenticatorData: metadata.authenticatorData,
      clientDataJSON: metadata.clientDataJSON,
      r: Hex.fromNumber(signature.r),
      s: Hex.fromNumber(signature.s),
    },
  })
  savePasskey(stored)
}

async function postJson<T>(path: string, body: unknown = {}): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const message = await response
      .json()
      .then((b: { message?: string }) => b.message)
      .catch(() => undefined)
    throw new Error(message || `リクエストに失敗しました（${response.status}）`)
  }
  return (await response.json()) as T
}

// サーバーのセッションを消してログアウトする。端末のパスキーの情報は、次のログインのために残す
export async function endSession() {
  await fetch('/api/session', { method: 'DELETE' })
}
