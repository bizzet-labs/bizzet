// 提案へのパスキーの署名の検証と保存
import { randomUUID } from 'node:crypto'
import {
  sepolia as addresses,
  EIP1271_MAGIC_VALUE,
  encodePasskeySignature,
  type PasskeySignature,
  signerFactoryAbi,
  verifiers,
} from '@bizzet/contracts'
import { type Db, eq, safeTransactionSignatures } from '@bizzet/db'
import { error } from '@sveltejs/kit'
import { type Address, type Hex, isAddressEqual } from 'viem'
import { publicClient } from '$lib/chain'
import { toCoordinates } from '$lib/passkey'
import { isOwner, loadProposal } from './approval-proposal'
import {
  type Group,
  isHeadquartersSigner,
  type Member,
  type Passkey,
} from './member'

// パスキーの署名を確かめて保存する。署名の検証は、Safe が execTransaction のときに呼ぶのと同じ
// 署名者のファクトリの処理を eth_call で呼び、保存した公開鍵に対して行う。
// 端末が送った公開鍵や署名者のアドレスは使わない。
// 店舗の Safe の提案でも保存先は safe_transaction_signatures で、signature は店舗の safe_tx_hash ではなく
// 本部の Safe の SafeMessage のハッシュへの署名になる（どちらのハッシュかは提案の Safe から決まる）
export async function addSignature(
  db: Db,
  member: Member,
  own: Group,
  passkey: Passkey,
  id: string,
  assertion: PasskeySignature,
) {
  if (!isHeadquartersSigner(member, own)) {
    error(403, '本部の Owner と Approver だけが署名できます')
  }
  const { tx, hq, hash, threshold } = await loadProposal(db, own, id)
  const { x, y } = toCoordinates(passkey.publicKey as Hex)
  const signer = await publicClient.readContract({
    address: addresses.passkey.signerFactory,
    abi: signerFactoryAbi,
    functionName: 'getSigner',
    args: [x, y, verifiers],
  })
  if (!isAddressEqual(signer, passkey.signer as Address)) {
    error(409, 'パスキーの署名者のアドレスが公開鍵と一致しません')
  }
  if (!isOwner(hq, signer)) {
    error(403, 'このパスキーは本部の Safe のオーナーではありません')
  }

  let data: Hex
  try {
    data = encodePasskeySignature(assertion)
  } catch {
    error(400, '署名の形式が正しくありません')
  }
  const magic = await publicClient.readContract({
    address: addresses.passkey.signerFactory,
    abi: signerFactoryAbi,
    functionName: 'isValidSignatureForSigner',
    args: [hash, data, x, y, verifiers],
  })
  if (magic !== EIP1271_MAGIC_VALUE) {
    error(400, 'パスキーの署名を検証できませんでした')
  }

  await db
    .insert(safeTransactionSignatures)
    .values({
      id: randomUUID(),
      transactionId: tx.id,
      memberId: member.id,
      signer: signer.toLowerCase(),
      signature: data,
    })
    .onConflictDoNothing()
  const rows = await db.query.safeTransactionSignatures.findMany({
    where: eq(safeTransactionSignatures.transactionId, tx.id),
    columns: { id: true },
  })
  return { signatureCount: rows.length, threshold }
}
