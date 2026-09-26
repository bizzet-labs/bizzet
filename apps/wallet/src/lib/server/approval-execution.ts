// 署名のそろった提案の実行の組み立てと、実行の確認
import {
  sepolia as addresses,
  encodeCreateSigner,
  encodeExecTransaction,
  encodeNestedSafeSignature,
  encodeSafeSignatures,
  isDeployed,
  readSafeNonce,
  safeExecutionEventsAbi,
  safeOwnerAbi,
} from '@bizzet/contracts'
import {
  and,
  type Db,
  eq,
  groups,
  inArray,
  members,
  passkeys,
  safeTransactionSignatures,
  safeTransactions,
} from '@bizzet/db'
import { error } from '@sveltejs/kit'
import { type Address, decodeEventLog, getAddress, type Hex } from 'viem'
import { publicClient } from '$lib/chain'
import { toCoordinates } from '$lib/passkey'
import { isOwner, loadProposal } from './approval-proposal'
import { type Group, isHeadquartersSigner, type Member } from './member'

export type ExecutionCall = { to: Address; data: Hex }

// グループの Safe は、ダッシュボードの「Safe を配置」でだけ作る。未配置なら実行を止める
async function requireDeployed(group: Group, label: string) {
  if (
    !(await isDeployed(publicClient, getAddress(group.safeAddress as string)))
  ) {
    error(
      409,
      `${label}の Safe がまだ配置されていません。ダッシュボードで配置してください`,
    )
  }
}

// 実行する Safe のノンスが提案のノンスと一致することを確かめる。未配置の Safe のノンスは 0 とみなす
async function assertNextNonce(safe: Address, nonce: bigint) {
  const current = await readSafeNonce(publicClient, safe)
  if (current !== nonce) {
    error(409, 'この提案より前のノンスの提案が、まだ実行されていません')
  }
}

// 署名のそろった提案を実行する呼び出しの並び。グループの Safe は配置済みであることを求め、署名者が未配置なら同じ取引の中で先に配置する。
// 店舗の Safe の提案は、本部のオーナーの署名の並びを本部の Safe のコントラクト署名に包んで店舗の Safe に渡す。
// 本部の Safe のコントラクト署名を検証するため、本部の Safe も配置済みである必要がある。
// 仮置き：中継用アカウントを作るまでは、この並びを最後に署名したメンバーのパスキーの ERC-4337 アカウントから送る
export async function buildExecution(
  db: Db,
  member: Member,
  own: Group,
  id: string,
): Promise<ExecutionCall[]> {
  if (!isHeadquartersSigner(member, own)) {
    error(403, '本部の Owner と Approver だけが実行できます')
  }
  const { tx, hq, hqSafe, store, safe, data, threshold } = await loadProposal(
    db,
    own,
    id,
  )
  const rows = await db
    .select({
      signer: safeTransactionSignatures.signer,
      signature: safeTransactionSignatures.signature,
      publicKey: passkeys.publicKey,
    })
    .from(safeTransactionSignatures)
    .innerJoin(members, eq(members.id, safeTransactionSignatures.memberId))
    .innerJoin(passkeys, eq(passkeys.id, members.passkeyId))
    .where(eq(safeTransactionSignatures.transactionId, tx.id))
  // 今も本部の Safe のオーナーである署名者の署名だけを、Safe が求めるアドレスの昇順で、しきい値の数だけ使う
  const usable = rows
    .filter((r) => isOwner(hq, r.signer))
    .sort((a, b) => (a.signer.toLowerCase() < b.signer.toLowerCase() ? -1 : 1))
    .slice(0, threshold)
  if (usable.length < threshold) error(409, '署名がまだそろっていません')

  await assertNextNonce(safe, data.nonce)
  const calls: ExecutionCall[] = []
  await requireDeployed(hq, '本部')
  if (store) await requireDeployed(store, '店舗')
  for (const r of usable) {
    if (!(await isDeployed(publicClient, getAddress(r.signer)))) {
      calls.push({
        to: addresses.passkey.signerFactory,
        data: encodeCreateSigner(toCoordinates(r.publicKey as Hex)),
      })
    }
  }
  const hqSignatures = encodeSafeSignatures(
    usable.map((r) => ({
      signer: getAddress(r.signer),
      data: r.signature as Hex,
    })),
  )
  calls.push({
    to: safe,
    data: encodeExecTransaction(
      data,
      store ? encodeNestedSafeSignature(hqSafe, hqSignatures) : hqSignatures,
    ),
  })
  return calls
}

// 送った取引のレシートから、本部の Safe がこの提案を実行したことを確かめて、実行済みにする。
// 端末から届いた取引のハッシュは、ExecutionSuccess のイベントで裏付けが取れたときだけ使う
export async function confirmExecution(
  db: Db,
  member: Member,
  own: Group,
  id: string,
  txHash: unknown,
) {
  if (!isHeadquartersSigner(member, own)) error(403)
  if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    error(400, '取引のハッシュが正しくありません')
  }
  const tx = await db.query.safeTransactions.findFirst({
    where: eq(safeTransactions.id, id),
  })
  if (!tx) error(404, '提案が見つかりません')
  if (tx.status === 'executed') return
  const receipt = await publicClient.getTransactionReceipt({
    hash: txHash as Hex,
  })
  const executed = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== tx.safeAddress.toLowerCase()) return false
    try {
      const event = decodeEventLog({ abi: safeExecutionEventsAbi, ...log })
      return (
        event.eventName === 'ExecutionSuccess' &&
        event.args.txHash.toLowerCase() === tx.safeTxHash.toLowerCase()
      )
    } catch {
      return false
    }
  })
  if (!executed) error(409, 'この取引では提案が実行されていません')
  const block = await publicClient.getBlock({
    blockNumber: receipt.blockNumber,
  })
  const executedAt = new Date(Number(block.timestamp) * 1000)
  await db
    .update(safeTransactions)
    .set({ status: 'executed', txHash, executedAt })
    .where(
      and(
        eq(safeTransactions.id, tx.id),
        inArray(safeTransactions.status, ['open', 'submitted']),
      ),
    )

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, tx.groupId),
  })
  if (!group) return
  const update: Partial<Group> = {}
  // 配置はダッシュボードで記録するが、記録の前に実行されたときのために埋めておく
  if (!group.safeDeployedAt) update.safeDeployedAt = executedAt
  // オーナーの変更が実行されたら、保存した Safe のオーナーの並びとしきい値をチェーンから読み直す
  if (tx.kind === 'owner_change') {
    const safe = getAddress(tx.safeAddress)
    const [owners, threshold] = await Promise.all([
      publicClient.readContract({
        address: safe,
        abi: safeOwnerAbi,
        functionName: 'getOwners',
      }),
      publicClient.readContract({
        address: safe,
        abi: safeOwnerAbi,
        functionName: 'getThreshold',
      }),
    ])
    update.safeOwners = owners.map((o) => getAddress(o))
    update.safeThreshold = Number(threshold)
  }
  if (Object.keys(update).length > 0) {
    await db.update(groups).set(update).where(eq(groups.id, group.id))
  }
}
