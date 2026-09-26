// 承認の対象になる提案の読み込みと、一覧・署名・実行で共通に使う判定
import {
  hashNestedSafeTransaction,
  hashSafeTransaction,
  type SafeTransactionData,
} from '@bizzet/contracts'
import { type Db, eq, safeTransactions } from '@bizzet/db'
import { error } from '@sveltejs/kit'
import { type Address, getAddress, type Hex, isAddressEqual } from 'viem'
import { type Group, getVisibleGroups } from './member'

export type SafeTransaction = typeof safeTransactions.$inferSelect

export function toSafeTransactionData(
  tx: SafeTransaction,
): SafeTransactionData {
  return {
    to: getAddress(tx.to),
    value: BigInt(tx.value),
    data: tx.data as Hex,
    operation: tx.operation === 1 ? 1 : 0,
    nonce: BigInt(tx.nonce),
  }
}

export function isOwner(group: Group, signer: string) {
  return (group.safeOwners ?? []).some((o) =>
    isAddressEqual(o as Address, signer as Address),
  )
}

export function findHeadquarters(visible: Group[]) {
  return visible.find((g) => g.kind === 'headquarters' && g.safeAddress)
}

export function isHeadquartersSafe(tx: SafeTransaction, hq: Group) {
  return (
    !!hq.safeAddress &&
    tx.safeAddress.toLowerCase() === hq.safeAddress.toLowerCase()
  )
}

// メンバーが署名するハッシュ。店舗の Safe のオーナーは本部の Safe のため、店舗の取引には本部の Safe の
// コントラクト署名が要り、本部のオーナーは本部の Safe の SafeMessage（中身は店舗の SafeTx）に署名する
export function signingHashOf(tx: SafeTransaction, hq: Group): Hex {
  if (isHeadquartersSafe(tx, hq)) return tx.safeTxHash as Hex
  return hashNestedSafeTransaction(
    getAddress(hq.safeAddress as string),
    getAddress(tx.safeAddress),
    toSafeTransactionData(tx),
  )
}

// 署名の対象になる送信前の提案。SafeTx のハッシュは保存した値を信用せず、中身から計算し直す。
// 店舗の Safe の提案は、その店舗の Safe のオーナーが本部の Safe だけ（しきい値 1）であることも確かめ、
// メンバーが署名するハッシュを本部の Safe の SafeMessage のハッシュにする
export async function loadProposal(db: Db, own: Group, id: string) {
  const tx = await db.query.safeTransactions.findFirst({
    where: eq(safeTransactions.id, id),
  })
  if (!tx) error(404, '提案が見つかりません')
  if (tx.status !== 'open') error(409, 'この提案は送信前ではありません')
  const visible = await getVisibleGroups(db, own)
  const hq = findHeadquarters(visible)
  if (!hq?.safeAddress || hq.safeThreshold === null) {
    error(409, '本部の Safe が設定されていません')
  }
  const hqSafe = getAddress(hq.safeAddress)
  const safe = getAddress(tx.safeAddress)
  let store: Group | undefined
  if (!isAddressEqual(safe, hqSafe)) {
    store = visible.find(
      (g) =>
        g.id === tx.groupId &&
        g.kind === 'store' &&
        !!g.safeAddress &&
        isAddressEqual(getAddress(g.safeAddress), safe),
    )
    if (!store) error(409, '提案の Safe が店舗の Safe と一致しません')
    if (
      store.safeThreshold !== 1 ||
      store.safeOwners?.length !== 1 ||
      !isOwner(store, hqSafe)
    ) {
      error(409, '店舗の Safe のオーナーが本部の Safe だけになっていません')
    }
  }
  const data = toSafeTransactionData(tx)
  const safeTxHash = hashSafeTransaction(safe, data)
  if (safeTxHash.toLowerCase() !== tx.safeTxHash.toLowerCase()) {
    error(409, '提案の取引のハッシュが中身と一致しません')
  }
  const hash = store
    ? hashNestedSafeTransaction(hqSafe, safe, data)
    : safeTxHash
  return {
    tx,
    hq,
    hqSafe,
    store,
    safe,
    data,
    hash,
    threshold: hq.safeThreshold,
  }
}
