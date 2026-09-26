import { randomUUID } from 'node:crypto'
import {
  encodeErc20Transfer,
  erc20Abi,
  findToken,
  hashSafeTransaction,
  readSafeNonce,
  tokens,
} from '@bizzet/contracts'
import {
  and,
  type Db,
  eq,
  groups,
  inArray,
  safeTransactionSignatures,
  safeTransactions,
} from '@bizzet/db'
import {
  type Address,
  getAddress,
  isAddress,
  parseUnits,
  zeroAddress,
} from 'viem'
import { publicClient } from '$lib/chain'
import { demoSafeNonce, getDemoBalances, isDemoMode } from './demo'
import type { Group, Member } from './member'

// 返金は店舗の Safe からの出金として作る。種類は出金（payout）のまま、説明の先頭でほかの出金と見分ける
export const REFUND_DESCRIPTION = '返金'
export const MEMO_MAX_LENGTH = 100

// 小数点を含む正の十進数。指数表記や桁区切りは受け付けない
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }

// 入力された金額を最小単位に直す。parseUnits は桁あふれを丸めるため、丸めで金額が変わらないよう先に桁数を確かめる
export function parseRefundAmount(
  input: string,
  symbol: string,
  decimals: number,
): ParseResult<bigint> {
  const text = input.trim()
  if (!DECIMAL_PATTERN.test(text)) {
    return { ok: false, message: '金額は正の数で入れてください' }
  }
  const fraction = text.split('.')[1] ?? ''
  if (fraction.length > decimals) {
    return {
      ok: false,
      message: `${symbol} の小数は ${decimals} 桁までです`,
    }
  }
  const amount = parseUnits(text, decimals)
  if (amount <= 0n) {
    return { ok: false, message: '金額は正の数で入れてください' }
  }
  return { ok: true, value: amount }
}

// 客のアドレス。ゼロアドレスと、返金元の Safe 自身は受け付けない
export function parseRecipient(
  input: string,
  safe: Address,
): ParseResult<Address> {
  const text = input.trim()
  if (!isAddress(text)) {
    return { ok: false, message: '宛先のアドレスが正しくありません' }
  }
  const recipient = getAddress(text)
  if (recipient === zeroAddress) {
    return { ok: false, message: 'ゼロアドレスには返金できません' }
  }
  if (recipient === getAddress(safe)) {
    return { ok: false, message: '店舗の Safe 自身には返金できません' }
  }
  return { ok: true, value: recipient }
}

// チェーン上のノンス以上で、送信前・送信済みの提案がまだ使っていない最小の番号。
// 却下で空いた番号は次の提案が埋めるため、後ろの提案は署名をやり直さずに済む（ダッシュボードと同じ決め方）
export function chooseNonce(onchain: bigint, used: Iterable<bigint>) {
  const taken = new Set(used)
  let nonce = onchain
  while (taken.has(nonce)) nonce += 1n
  return nonce
}

async function nextSafeNonce(db: Db, safe: Address) {
  // デモモードではチェーンを読まず、実行済みの提案からノンスを決める
  const onchain = isDemoMode()
    ? await demoSafeNonce(db, safe)
    : await readSafeNonce(publicClient, safe)
  const pending = await db.query.safeTransactions.findMany({
    where: and(
      eq(safeTransactions.safeAddress, safe.toLowerCase()),
      inArray(safeTransactions.status, ['open', 'submitted']),
    ),
    columns: { nonce: true },
  })
  return chooseNonce(
    onchain,
    pending.map((tx) => BigInt(tx.nonce)),
  )
}

// Safe が持つ通貨の残高（最小単位）。読み取りに失敗したら null
async function getTokenBalance(db: Db, safe: Address, token: Address) {
  try {
    // デモモードではチェーンの代わりにデモの残高を使う
    if (isDemoMode()) {
      const symbol = tokens.find((t) => t.address === token)?.symbol
      const balances = await getDemoBalances(db, [safe])
      const b = balances.get(safe.toLowerCase())
      return b && symbol ? b[symbol] : null
    }
    return await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [safe],
    })
  } catch {
    return null
  }
}

export type RefundInput = {
  token: unknown
  amount: unknown
  recipient: unknown
  memo: unknown
}

// 返金の申請を店舗の Safe の出金の提案として作る。署名と実行は本部の Owner と Approver が承認の画面で行う
export async function createRefund(
  db: Db,
  member: Member,
  group: Group,
  input: RefundInput,
): Promise<ParseResult<{ id: string }>> {
  if (!group.safeAddress) {
    return { ok: false, message: 'この店舗の Safe はまだ設定されていません' }
  }
  const safe = getAddress(group.safeAddress)
  const token = tokens.find((t) => t.symbol === input.token)
  if (!token) return { ok: false, message: '通貨を選んでください' }
  const amount = parseRefundAmount(
    String(input.amount ?? ''),
    token.symbol,
    token.decimals,
  )
  if (!amount.ok) return amount
  const recipient = parseRecipient(String(input.recipient ?? ''), safe)
  if (!recipient.ok) return recipient
  const memo = String(input.memo ?? '').trim()
  if (memo.length > MEMO_MAX_LENGTH) {
    return { ok: false, message: `メモは ${MEMO_MAX_LENGTH} 文字までです` }
  }

  // 残高を超える出金は実行に失敗するため作らせない。読み取れないときは通す
  const balance = await getTokenBalance(db, safe, token.address)
  if (balance !== null && amount.value > balance) {
    return { ok: false, message: `店舗の ${token.symbol} の残高が足りません` }
  }

  const data = encodeErc20Transfer(recipient.value, amount.value)
  const nonce = await nextSafeNonce(db, safe)
  const safeTxHash = hashSafeTransaction(safe, {
    to: token.address,
    value: 0n,
    data,
    operation: 0,
    nonce,
  })
  const id = randomUUID()
  await db.insert(safeTransactions).values({
    id,
    groupId: group.id,
    safeAddress: safe.toLowerCase(),
    kind: 'payout',
    to: token.address.toLowerCase(),
    value: '0',
    data,
    operation: 0,
    nonce: Number(nonce),
    safeTxHash,
    token: token.address.toLowerCase(),
    amount: amount.value.toString(),
    recipient: recipient.value.toLowerCase(),
    description: memo ? `${REFUND_DESCRIPTION}：${memo}` : REFUND_DESCRIPTION,
    createdBy: member.id,
  })
  return { ok: true, value: { id } }
}

export function isRefund(description: string | null) {
  return description?.startsWith(REFUND_DESCRIPTION) ?? false
}

export type RefundListItem = {
  id: string
  refund: boolean
  description: string
  token: { symbol: string; decimals: number } | null
  amount: string | null
  recipient: string | null
  status: 'open' | 'submitted' | 'executed' | 'rejected'
  signatureCount: number
  createdAt: string
}

// 店舗の出金の提案（返金を含む）を新しい順に返す
export async function listRefunds(
  db: Db,
  group: Group,
): Promise<RefundListItem[]> {
  const txs = await db.query.safeTransactions.findMany({
    where: and(
      eq(safeTransactions.groupId, group.id),
      eq(safeTransactions.kind, 'payout'),
    ),
  })
  if (txs.length === 0) return []
  const signatures = await db.query.safeTransactionSignatures.findMany({
    where: inArray(
      safeTransactionSignatures.transactionId,
      txs.map((tx) => tx.id),
    ),
    columns: { transactionId: true },
  })
  const countById = new Map<string, number>()
  for (const s of signatures) {
    countById.set(s.transactionId, (countById.get(s.transactionId) ?? 0) + 1)
  }
  return txs
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((tx) => {
      const token = tx.token ? findToken(tx.token) : undefined
      return {
        id: tx.id,
        refund: isRefund(tx.description),
        description: tx.description ?? '',
        token: token
          ? { symbol: token.symbol, decimals: token.decimals }
          : null,
        amount: tx.amount,
        recipient: tx.recipient,
        status: tx.status,
        signatureCount: countById.get(tx.id) ?? 0,
        createdAt: tx.createdAt.toISOString(),
      }
    })
}

// 実行に要る署名の数。店舗の Safe の唯一のオーナーは本部の Safe のため、本部のしきい値だけ署名が要る
export async function getRequiredApprovals(db: Db) {
  const hq = await db.query.groups.findFirst({
    where: eq(groups.kind, 'headquarters'),
    columns: { safeThreshold: true },
  })
  return hq?.safeThreshold ?? null
}
