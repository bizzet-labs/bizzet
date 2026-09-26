import { error, fail } from '@sveltejs/kit'
import { m } from '$lib/paraglide/messages.js'
import {
  canReject,
  displayStatus,
  getLaterOpenTransactions,
  getMemberLabel,
  getRequiredApprovals,
  getSignatures,
  getVisibleTransaction,
  rejectTransaction,
  requireSignerRole,
  syncSubmittedTransaction,
  tokenInfo,
} from '$lib/server/transactions'
import { isHeadquartersMember } from '$lib/server/visibility'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  const member = requireSignerRole(locals.member)
  const db = locals.db
  const found = await getVisibleTransaction(db, member, params.id)
  if (!found) error(404, m.common_error_not_found())
  // 送信済みなら、表示のついでにチェーン上の結果を反映する
  const tx = await syncSubmittedTransaction(db, found.tx)

  const [signatures, required, creator, targetMember, laterOpen, isHq] =
    await Promise.all([
      getSignatures(db, tx.id),
      getRequiredApprovals(db),
      getMemberLabel(db, tx.createdBy),
      getMemberLabel(db, tx.targetMemberId),
      // 送信前か却下のときだけ、後ろのノンスの提案への影響を知らせる
      tx.status === 'open' || tx.status === 'rejected'
        ? getLaterOpenTransactions(db, tx)
        : Promise.resolve([]),
      isHeadquartersMember(db, member),
    ])

  return {
    pageTitle: m.transactions_detail_title(),
    transaction: {
      id: tx.id,
      kind: tx.kind,
      status: displayStatus(tx.status, signatures.length),
      groupName: found.group.name,
      safeAddress: tx.safeAddress,
      to: tx.to,
      value: tx.value,
      data: tx.data,
      operation: tx.operation,
      nonce: tx.nonce,
      safeTxHash: tx.safeTxHash,
      token: tokenInfo(tx),
      amount: tx.amount,
      recipient: tx.recipient,
      description: tx.description,
      targetMember,
      creator,
      txHash: tx.txHash,
      createdAt: tx.createdAt.toISOString(),
      executedAt: tx.executedAt?.toISOString() ?? null,
      rejectedAt: tx.rejectedAt?.toISOString() ?? null,
    },
    signatures,
    required,
    laterOpenCount: laterOpen.length,
    canReject: canReject(member, tx, isHq),
  }
}

export const actions: Actions = {
  // 送信前の提案を取り下げる。後ろのノンスの提案は自動では直さず、画面で知らせるだけにする
  reject: async ({ locals, params }) => {
    const member = requireSignerRole(locals.member)
    const db = locals.db
    const found = await getVisibleTransaction(db, member, params.id)
    if (!found) error(404, m.common_error_not_found())
    if (found.tx.status !== 'open') {
      return fail(409, { message: m.transactions_error_not_open() })
    }
    const isHq = await isHeadquartersMember(db, member)
    if (!canReject(member, found.tx, isHq)) {
      return fail(403, { message: m.transactions_error_reject_forbidden() })
    }
    // 読んだ後に送信された場合に備え、却下は送信前のときだけ成功させる
    if (!(await rejectTransaction(db, found.tx.id))) {
      return fail(409, { message: m.transactions_error_not_open() })
    }
    return { rejected: true }
  },
}
