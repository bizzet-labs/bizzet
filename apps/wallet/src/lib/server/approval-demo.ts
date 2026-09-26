// デモモードの承認。パスキーの署名とチェーン上の検証・実行を省き、DB の記録だけを進める
import { randomUUID } from 'node:crypto'
import {
  and,
  type Db,
  eq,
  inArray,
  safeTransactionSignatures,
  safeTransactions,
} from '@bizzet/db'
import { error } from '@sveltejs/kit'
import { loadProposal } from './approval-proposal'
import { fakeTxHash } from './demo'
import {
  type Group,
  isHeadquartersSigner,
  type Member,
  type Passkey,
} from './member'

// 署名の代わりに印だけを保存する
export async function addDemoSignature(
  db: Db,
  member: Member,
  own: Group,
  passkey: Passkey,
  id: string,
) {
  if (!isHeadquartersSigner(member, own)) {
    error(403, '本部の Owner と Approver だけが署名できます')
  }
  const { tx, threshold } = await loadProposal(db, own, id)
  await db
    .insert(safeTransactionSignatures)
    .values({
      id: randomUUID(),
      transactionId: tx.id,
      memberId: member.id,
      signer: passkey.signer.toLowerCase(),
      signature: '0xdemo',
    })
    .onConflictDoNothing()
  const rows = await db.query.safeTransactionSignatures.findMany({
    where: eq(safeTransactionSignatures.transactionId, tx.id),
    columns: { id: true },
  })
  return { signatureCount: rows.length, threshold }
}

// 署名がしきい値に届いた提案を、送信せずに実行済みにする
export async function executeDemo(
  db: Db,
  member: Member,
  own: Group,
  id: string,
) {
  if (!isHeadquartersSigner(member, own)) {
    error(403, '本部の Owner と Approver だけが実行できます')
  }
  const { tx, threshold } = await loadProposal(db, own, id)
  const rows = await db.query.safeTransactionSignatures.findMany({
    where: eq(safeTransactionSignatures.transactionId, tx.id),
    columns: { id: true },
  })
  if (rows.length < threshold) error(409, '署名がまだそろっていません')
  const txHash = fakeTxHash()
  const executedAt = new Date()
  await db
    .update(safeTransactions)
    .set({ status: 'executed', txHash, executedAt })
    .where(
      and(
        eq(safeTransactions.id, tx.id),
        inArray(safeTransactions.status, ['open', 'submitted']),
      ),
    )
  return txHash
}
