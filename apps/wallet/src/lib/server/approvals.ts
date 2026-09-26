import { randomUUID } from 'node:crypto'
import {
  sepolia as addresses,
  EIP1271_MAGIC_VALUE,
  encodeCreateSigner,
  encodeExecTransaction,
  encodeNestedSafeSignature,
  encodePasskeySignature,
  encodeSafeSignatures,
  findToken,
  hashNestedSafeTransaction,
  hashSafeTransaction,
  type PasskeySignature,
  type SafeTransactionData,
  safeExecutionEventsAbi,
  safeOwnerAbi,
  signerFactoryAbi,
  verifiers,
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
import {
  type Address,
  decodeEventLog,
  getAddress,
  type Hex,
  hexToBigInt,
  isAddressEqual,
  slice,
} from 'viem'
import { publicClient } from '$lib/chain'
import {
  type Group,
  getVisibleGroups,
  isHeadquartersSigner,
  type Member,
  type Passkey,
} from './member'

type SafeTransaction = typeof safeTransactions.$inferSelect

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

function coordinates(publicKey: string) {
  const key = publicKey as Hex
  return {
    x: hexToBigInt(slice(key, 0, 32)),
    y: hexToBigInt(slice(key, 32, 64)),
  }
}

function toSafeTransactionData(tx: SafeTransaction): SafeTransactionData {
  return {
    to: getAddress(tx.to),
    value: BigInt(tx.value),
    data: tx.data as Hex,
    operation: tx.operation === 1 ? 1 : 0,
    nonce: BigInt(tx.nonce),
  }
}

function isOwner(group: Group, signer: string) {
  return (group.safeOwners ?? []).some((o) =>
    isAddressEqual(o as Address, signer as Address),
  )
}

function findHeadquarters(visible: Group[]) {
  return visible.find((g) => g.kind === 'headquarters' && g.safeAddress)
}

function isHeadquartersSafe(tx: SafeTransaction, hq: Group) {
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

// 署名の対象になる送信前の提案。SafeTx のハッシュは保存した値を信用せず、中身から計算し直す。
// 店舗の Safe の提案は、その店舗の Safe のオーナーが本部の Safe だけ（しきい値 1）であることも確かめ、
// メンバーが署名するハッシュを本部の Safe の SafeMessage のハッシュにする
async function loadProposal(db: Db, own: Group, id: string) {
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
  const { x, y } = coordinates(passkey.publicKey)
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

async function hasCode(address: Address) {
  const code = await publicClient.getCode({ address })
  return code !== undefined && code !== '0x'
}

export type ExecutionCall = { to: Address; data: Hex }

// グループの Safe は、ダッシュボードの「Safe を配置」でだけ作る。未配置なら実行を止める
async function requireDeployed(group: Group, label: string) {
  if (!(await hasCode(getAddress(group.safeAddress as string)))) {
    error(
      409,
      `${label}の Safe がまだ配置されていません。ダッシュボードで配置してください`,
    )
  }
}

// 実行する Safe のノンスが提案のノンスと一致することを確かめる。未配置の Safe のノンスは 0 とみなす
async function assertNextNonce(safe: Address, nonce: bigint) {
  const current = (await hasCode(safe))
    ? await publicClient.readContract({
        address: safe,
        abi: safeOwnerAbi,
        functionName: 'nonce',
      })
    : 0n
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
    if (!(await hasCode(getAddress(r.signer)))) {
      calls.push({
        to: addresses.passkey.signerFactory,
        data: encodeCreateSigner(coordinates(r.publicKey)),
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
