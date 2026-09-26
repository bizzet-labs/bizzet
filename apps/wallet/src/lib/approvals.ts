import { Hex, WebAuthnP256 } from 'ox'
import type { Address } from 'viem'
import { goto } from '$app/navigation'
import { RP_ID, type StoredPasskey } from './passkey.js'
import { sendPasskeyTransaction } from './user-operation.js'

// ウォレットのサーバーの API を呼ぶ。メンバーはサーバーがセッションの Cookie から決めるため、
// passkey は呼び出し側との互換のために受け取るだけで送らない
export async function callApi<T>(
  path: string,
  _passkey: StoredPasskey | null,
  body: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  // セッションが切れていれば、ログインし直してもらう
  if (response.status === 401) {
    await goto('/login')
  }
  if (!response.ok) {
    const message = await response
      .json()
      .then((b: { message?: string }) => b.message)
      .catch(() => undefined)
    throw new Error(message || `リクエストに失敗しました（${response.status}）`)
  }
  return (await response.json()) as T
}

// SafeTx のハッシュを、そのままチャレンジとしてパスキーに署名させる。
// Safe はパスキーの署名者に isValidSignature(safeTxHash, 署名) を尋ね、署名者はこのハッシュをチャレンジとして検証する
export async function signApproval(
  passkey: StoredPasskey,
  id: string,
  safeTxHash: Hex.Hex,
) {
  const { metadata, signature } = await WebAuthnP256.sign({
    credentialId: passkey.id,
    challenge: safeTxHash,
    rpId: RP_ID,
  })
  return callApi<{ signatureCount: number; threshold: number }>(
    `/api/approvals/${id}/sign`,
    passkey,
    {
      signature: {
        authenticatorData: metadata.authenticatorData,
        clientDataJSON: metadata.clientDataJSON,
        r: Hex.fromNumber(signature.r),
        s: Hex.fromNumber(signature.s),
      },
    },
  )
}

// 署名のそろった提案を、自分のパスキーの ERC-4337 アカウントから送り、実行済みにする。
// 仮置き：中継用アカウントを作るまでの代わり。ガス代は Paymaster が肩代わりする
export async function executeApproval(passkey: StoredPasskey, id: string) {
  const { calls } = await callApi<{ calls: { to: Address; data: Hex.Hex }[] }>(
    `/api/approvals/${id}/execution`,
    passkey,
  )
  const txHash = await sendPasskeyTransaction(
    passkey,
    calls.map((c) => ({ to: c.to, data: c.data, value: 0n })),
  )
  await callApi(`/api/approvals/${id}/executed`, passkey, { txHash })
  return txHash
}
