import {
  sepolia as addresses,
  signerFactoryAbi,
  verifiers,
} from '@bizzet/contracts'
import { Bytes, Hex, PublicKey, WebAuthnP256 } from 'ox'
import type { Address } from 'viem'
import { createWebAuthnCredential } from 'viem/account-abstraction'
import { publicClient } from './chain.js'

// 仮置き：パスキーと署名者の対応表は本来バックエンドに置く。バックエンドを決めるまではブラウザ内に保存する
const STORAGE_KEY = 'bizzet:passkey'
const SESSION_KEY = 'bizzet:session'

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
  const credential = await createWebAuthnCredential({ name: 'bizzet' })
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

// 保存したパスキーで使い捨てのチャレンジに署名させ、公開鍵で検証する
export async function authenticatePasskey(passkey: StoredPasskey) {
  const challenge = Hex.fromBytes(Bytes.random(32))
  const { metadata, signature } = await WebAuthnP256.sign({
    credentialId: passkey.id,
    challenge,
  })
  const { x, y } = toCoordinates(passkey.publicKey)
  const ok = WebAuthnP256.verify({
    challenge,
    metadata,
    signature,
    publicKey: PublicKey.from({ prefix: 4, x, y }),
  })
  if (!ok) throw new Error('パスキーの署名を検証できませんでした')
}

export function startSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // セッションを保存できなくても、画面の遷移はそのまま続ける
  }
}

export function endSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // 何もしない
  }
}
