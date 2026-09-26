// 承認の画面に出す送信前の提案の一覧
import { findToken } from '@bizzet/contracts'
import {
  and,
  type Db,
  eq,
  inArray,
  safeTransactionSignatures,
  safeTransactions,
} from '@bizzet/db'
import {
  findHeadquarters,
  isHeadquartersSafe,
  isOwner,
  type SafeTransaction,
  signingHashOf,
} from './approval-proposal'
import {
  type Group,
  getVisibleGroups,
  isHeadquartersSigner,
  type Member,
  type Passkey,
} from './member'

// 署名できない理由。画面にそのまま出す
export type Unsignable =
  | 'not_owner'
  | 'already_signed'
  | 'ready'
  | 'no_headquarters'

export type ApprovalItem = {
  id: string
  kind: SafeTransaction['kind']
  groupName: string
  description: string | null
  token: { symbol: string; decimals: number } | null
  amount: string | null
  recipient: string | null
  to: string
  value: string
  data: string
  nonce: number
  safeTxHash: string
  // メンバーがパスキーで署名するハッシュ。本部の Safe の提案なら safeTxHash、店舗の Safe の提案なら
  // 本部の Safe をドメインにした SafeMessage のハッシュ（hashNestedSafeTransaction）
  signingHash: string
  // 店舗の Safe の提案。本部の Safe として（入れ子の ERC-1271 で）承認する
  nested: boolean
  createdAt: string
  signatureCount: number
  threshold: number | null
  signedByMe: boolean
  // 署名できるなら null
  unsignable: Unsignable | null
  // しきい値の署名がそろい、実行を送れる
  executable: boolean
}

// 本部の Safe の提案も店舗の Safe の提案も、署名するのは本部の Safe のオーナーで、しきい値は本部の Safe のもの
export function whyUnsignable(
  hq: Group | undefined,
  signer: string,
  signedByMe: boolean,
  signatureCount: number,
): Unsignable | null {
  if (!hq?.safeAddress) return 'no_headquarters'
  if (signedByMe) return 'already_signed'
  if (hq.safeThreshold !== null && signatureCount >= hq.safeThreshold) {
    return 'ready'
  }
  if (!isOwner(hq, signer)) return 'not_owner'
  return null
}

// 送信前の提案を新しい順に返す。署名者になれない Viewer と店舗のメンバーには何も返さない
export async function listApprovals(
  db: Db,
  member: Member,
  own: Group,
  passkey: Passkey,
): Promise<ApprovalItem[]> {
  if (!isHeadquartersSigner(member, own)) return []
  const visible = await getVisibleGroups(db, own)
  const hq = findHeadquarters(visible)
  const groupById = new Map(visible.map((g) => [g.id, g]))
  const txs = await db.query.safeTransactions.findMany({
    where: and(
      inArray(safeTransactions.groupId, [...groupById.keys()]),
      eq(safeTransactions.status, 'open'),
    ),
  })
  if (txs.length === 0) return []
  const signatures = await db.query.safeTransactionSignatures.findMany({
    where: inArray(
      safeTransactionSignatures.transactionId,
      txs.map((tx) => tx.id),
    ),
  })
  return txs
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((tx) => {
      const own = signatures.filter((s) => s.transactionId === tx.id)
      const signatureCount = own.length
      const signedByMe = own.some((s) => s.memberId === member.id)
      const token = tx.token ? findToken(tx.token) : undefined
      const threshold = hq?.safeThreshold ?? null
      const unsignable = whyUnsignable(
        hq,
        passkey.signer,
        signedByMe,
        signatureCount,
      )
      return {
        id: tx.id,
        kind: tx.kind,
        groupName: groupById.get(tx.groupId)?.name ?? '',
        description: tx.description,
        token: token
          ? { symbol: token.symbol, decimals: token.decimals }
          : null,
        amount: tx.amount,
        recipient: tx.recipient,
        to: tx.to,
        value: tx.value,
        data: tx.data,
        nonce: tx.nonce,
        safeTxHash: tx.safeTxHash,
        signingHash: hq?.safeAddress ? signingHashOf(tx, hq) : tx.safeTxHash,
        nested: hq ? !isHeadquartersSafe(tx, hq) : false,
        createdAt: tx.createdAt.toISOString(),
        signatureCount,
        threshold,
        signedByMe,
        unsignable,
        executable:
          threshold !== null &&
          signatureCount >= threshold &&
          unsignable !== 'no_headquarters',
      }
    })
}
