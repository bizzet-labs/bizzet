import { erc20Abi, findToken, safeOwnerAbi } from '@bizzet/contracts'
import {
  and,
  type Db,
  eq,
  groups,
  gt,
  inArray,
  members,
  safeTransactionSignatures,
  safeTransactions,
} from '@bizzet/db'
import { error } from '@sveltejs/kit'
import { type Address, getAddress, type Hex } from 'viem'
import { m } from '$lib/paraglide/messages.js'
import type { Member } from './auth'
import { publicClient } from './chain'
import { getHeadquarters } from './safe'
import { type Group, getVisibleGroups } from './visibility'

export type SafeTransaction = typeof safeTransactions.$inferSelect
export type SafeTransactionKind = SafeTransaction['kind']

// 画面に出す状態。open は署名の数で「申請中」と「承認待ち」に分ける
export type DisplayStatus =
  | 'requested'
  | 'awaiting_approval'
  | 'submitted'
  | 'executed'
  | 'rejected'

export function displayStatus(
  status: SafeTransaction['status'],
  signatureCount: number,
): DisplayStatus {
  if (status === 'open') {
    return signatureCount === 0 ? 'requested' : 'awaiting_approval'
  }
  return status
}

// 出金の画面は、署名者になれる Owner と Approver だけが使える。Viewer はオンチェーンに何も持たないため見せない
export function requireSignerRole(member: Member | null) {
  if (!member) error(401)
  if (member.role === 'viewer') error(403, m.common_error_forbidden())
  return member
}

// 必要な承認の数。店舗の Safe の唯一のオーナーは本部の Safe のため、どの Safe の取引も本部のしきい値だけ署名が要る。
// 本部の Safe が未設定なら決まらないため null
export async function getRequiredApprovals(db: Db) {
  const hq = await getHeadquarters(db)
  return hq?.safeThreshold ?? null
}

function memberLabel(member: Pick<Member, 'name' | 'email'> | undefined) {
  if (!member) return ''
  return member.name || member.email
}

// 出金以外（オーナーの変更・Safe の設定）の内容。説明が無ければ対象のメンバーを出す
function describe(
  tx: SafeTransaction,
  memberById: Map<string, Pick<Member, 'name' | 'email'>>,
) {
  if (tx.description) return tx.description
  if (tx.targetMemberId) return memberLabel(memberById.get(tx.targetMemberId))
  return ''
}

export function tokenInfo(tx: SafeTransaction) {
  const token = tx.token ? findToken(tx.token) : undefined
  return token ? { symbol: token.symbol, decimals: token.decimals } : null
}

export type TransactionListItem = {
  id: string
  kind: SafeTransactionKind
  groupName: string
  description: string
  token: { symbol: string; decimals: number } | null
  amount: string | null
  recipient: string | null
  createdAt: string
  signatureCount: number
  status: DisplayStatus
}

// 見られるグループの提案を新しい順に返す
export async function listTransactions(
  db: Db,
  member: Member,
): Promise<TransactionListItem[]> {
  const visible = await getVisibleGroups(db, member)
  if (visible.length === 0) return []
  const groupById = new Map(visible.map((g) => [g.id, g]))
  const txs = await db.query.safeTransactions.findMany({
    where: inArray(safeTransactions.groupId, [...groupById.keys()]),
  })
  if (txs.length === 0) return []
  const ids = txs.map((tx) => tx.id)
  const [signatures, memberRows] = await Promise.all([
    db.query.safeTransactionSignatures.findMany({
      where: inArray(safeTransactionSignatures.transactionId, ids),
    }),
    db.query.members.findMany({
      columns: { id: true, name: true, email: true },
    }),
  ])
  const memberById = new Map(memberRows.map((r) => [r.id, r]))
  const countById = new Map<string, number>()
  for (const s of signatures) {
    countById.set(s.transactionId, (countById.get(s.transactionId) ?? 0) + 1)
  }
  return txs
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((tx) => {
      const signatureCount = countById.get(tx.id) ?? 0
      return {
        id: tx.id,
        kind: tx.kind,
        groupName: groupById.get(tx.groupId)?.name ?? '',
        description: describe(tx, memberById),
        token: tokenInfo(tx),
        amount: tx.amount,
        recipient: tx.recipient,
        createdAt: tx.createdAt.toISOString(),
        signatureCount,
        status: displayStatus(tx.status, signatureCount),
      }
    })
}

// 進行中（送信前・送信済み）か、完了（実行済み・却下）か
export function isInProgress(status: DisplayStatus) {
  return (
    status === 'requested' ||
    status === 'awaiting_approval' ||
    status === 'submitted'
  )
}

// 見られるグループの提案を1件返す。見られない提案は存在しないものとして扱う
export async function getVisibleTransaction(
  db: Db,
  member: Member,
  id: string,
): Promise<{ tx: SafeTransaction; group: Group } | null> {
  const tx = await db.query.safeTransactions.findFirst({
    where: eq(safeTransactions.id, id),
  })
  if (!tx) return null
  const visible = await getVisibleGroups(db, member)
  const group = visible.find((g) => g.id === tx.groupId)
  return group ? { tx, group } : null
}

export async function getSignatures(db: Db, transactionId: string) {
  const rows = await db
    .select({
      id: safeTransactionSignatures.id,
      signer: safeTransactionSignatures.signer,
      createdAt: safeTransactionSignatures.createdAt,
      name: members.name,
      email: members.email,
    })
    .from(safeTransactionSignatures)
    .innerJoin(members, eq(members.id, safeTransactionSignatures.memberId))
    .where(eq(safeTransactionSignatures.transactionId, transactionId))
  return rows
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((r) => ({
      id: r.id,
      memberLabel: memberLabel(r),
      signer: r.signer,
      createdAt: r.createdAt.toISOString(),
    }))
}

export async function getMemberLabel(db: Db, memberId: string | null) {
  if (!memberId) return ''
  const row = await db.query.members.findFirst({
    where: eq(members.id, memberId),
    columns: { name: true, email: true },
  })
  return memberLabel(row)
}

// 同じ Safe で、この提案より後のノンスを持つ送信前の提案。
// この提案が実行されないまま却下されると Safe のノンスが進まず、これらは署名をやり直す必要がある
export async function getLaterOpenTransactions(db: Db, tx: SafeTransaction) {
  const rows = await db.query.safeTransactions.findMany({
    where: and(
      eq(safeTransactions.safeAddress, tx.safeAddress),
      eq(safeTransactions.status, 'open'),
      gt(safeTransactions.nonce, tx.nonce),
    ),
    columns: { id: true, nonce: true },
  })
  return rows.sort((a, b) => a.nonce - b.nonce)
}

// 却下できるのは、送信前の提案の作成者か本部の Owner
export function canReject(
  member: Member,
  tx: SafeTransaction,
  memberIsHeadquarters: boolean,
) {
  if (tx.status !== 'open') return false
  return (
    tx.createdBy === member.id ||
    (memberIsHeadquarters && member.role === 'owner')
  )
}

// 送信前のときだけ却下する。同時に送信された場合に却下で上書きしないよう、状態を条件に含める
export async function rejectTransaction(db: Db, id: string) {
  const updated = await db
    .update(safeTransactions)
    .set({ status: 'rejected', rejectedAt: new Date() })
    .where(
      and(eq(safeTransactions.id, id), eq(safeTransactions.status, 'open')),
    )
    .returning({ id: safeTransactions.id })
  return updated.length > 0
}

// 送信済みの取引の結果をチェーンから読み、成功していれば実行済みにする。
// 読み取りに失敗しても画面は出せるよう、失敗は無視して次の表示で再び確かめる
export async function syncSubmittedTransaction(
  db: Db,
  tx: SafeTransaction,
): Promise<SafeTransaction> {
  if (tx.status !== 'submitted' || !tx.txHash) return tx
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: tx.txHash as Hex,
    })
    if (receipt.status !== 'success') return tx
    const block = await publicClient.getBlock({
      blockNumber: receipt.blockNumber,
    })
    const executedAt = new Date(Number(block.timestamp) * 1000)
    const updated = await db
      .update(safeTransactions)
      .set({ status: 'executed', executedAt })
      .where(
        and(
          eq(safeTransactions.id, tx.id),
          eq(safeTransactions.status, 'submitted'),
        ),
      )
      .returning()
    const executed = updated[0]
    if (executed?.kind === 'owner_change') await refreshSafeOwners(db, executed)
    return executed ?? tx
  } catch {
    return tx
  }
}

// オーナーの変更が実行されたら、グループに保存した Safe のオーナー（getOwners() の並び）としきい値を
// チェーンから読み直す。次のオーナーの削除の提案は、この並びを使って1つ前のオーナーを求めるため
async function refreshSafeOwners(db: Db, tx: SafeTransaction) {
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
  await db
    .update(groups)
    .set({
      safeOwners: owners.map((owner) => getAddress(owner)),
      safeThreshold: Number(threshold),
    })
    .where(eq(groups.id, tx.groupId))
}

// Safe が持つ通貨の残高（最小単位）。読み取りに失敗したら null
export async function getTokenBalance(safe: string, token: Address) {
  try {
    return await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [getAddress(safe)],
    })
  } catch {
    return null
  }
}
