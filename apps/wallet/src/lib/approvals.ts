import { Hex, WebAuthnP256 } from 'ox'
import type { Address } from 'viem'
import { callApi } from './api.js'
import { RP_ID, type StoredPasskey } from './passkey.js'
import { sendPasskeyTransaction } from './user-operation.js'

// サーバーが示した署名するハッシュを、そのままチャレンジとしてパスキーに署名させる。
// 本部の Safe の提案では SafeTx のハッシュ、店舗の Safe の提案では本部の Safe の SafeMessage のハッシュで、
// Safe はパスキーの署名者にこのハッシュの元のバイト列で isValidSignature を尋ね、署名者はハッシュをチャレンジとして検証する
export async function signApproval(
  passkey: StoredPasskey,
  id: string,
  signingHash: Hex.Hex,
) {
  const { metadata, signature } = await WebAuthnP256.sign({
    credentialId: passkey.id,
    challenge: signingHash,
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
