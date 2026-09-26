import { erc20Abi, tokens } from '@bizzet/contracts'
import {
  type Db,
  deposits,
  eq,
  groups,
  indexCursors,
  isNotNull,
  sql,
} from '@bizzet/db'
import { type Address, getAbiItem, getAddress } from 'viem'
import { env } from '$env/dynamic/private'
import { publicClient } from './chain'

const CHAIN_ID = publicClient.chain.id
const CURSOR_KEY = `deposits:${CHAIN_ID}`

// 1回の getLogs で読むブロックの幅。公開 RPC の範囲の上限に当たったら半分にして読み直す
const CHUNK_BLOCKS = 5_000n
const MIN_CHUNK_BLOCKS = 250n
// 初回に DEPOSITS_START_BLOCK が無いとき、最新のブロックからさかのぼる幅
const DEFAULT_LOOKBACK_BLOCKS = 50_000n
// 画面の表示を待たせないための時間の上限。残りは次の呼び出しが続きから読む
const DEFAULT_BUDGET_MS = 4_000
// 直前の同期から間がないときは RPC を呼ばない。画面を開くたびに getLogs を投げないため
const MIN_INTERVAL_MS = 10_000

const transferEvent = getAbiItem({ abi: erc20Abi, name: 'Transfer' })

export type SyncResult = {
  // 読み終えたブロック（この番号まで取り込み済み）。Safe が1つもなければ null
  scannedTo: bigint | null
  // 最新のブロックまで追いついたか。false なら時間の上限で止まった
  caughtUp: boolean
  inserted: number
}

let running: Promise<SyncResult> | undefined
let lastFinishedAt = 0

// グループの Safe に入った JPYC と USDC の送金を、前回の続きのブロックから取り込む。
// 同じサーバーの中で同時に呼ばれたら、実行中の同期の結果を共有する
export function syncDeposits(
  db: Db,
  options: { budgetMs?: number; force?: boolean } = {},
): Promise<SyncResult> {
  if (running) return running
  if (!options.force && Date.now() - lastFinishedAt < MIN_INTERVAL_MS) {
    return Promise.resolve({ scannedTo: null, caughtUp: true, inserted: 0 })
  }
  running = runSync(db, options.budgetMs ?? DEFAULT_BUDGET_MS).finally(() => {
    running = undefined
    lastFinishedAt = Date.now()
  })
  return running
}

async function runSync(db: Db, budgetMs: number): Promise<SyncResult> {
  const startedAt = Date.now()

  // 設定済みの Safe のアドレス → グループ。設定前のアドレスは製品の中に存在しなかったため、
  // 設定より前の入金はさかのぼって取り込まない
  const configured = await db
    .select({ id: groups.id, safeAddress: groups.safeAddress })
    .from(groups)
    .where(isNotNull(groups.safeAddress))
  const groupBySafe = new Map(
    configured.map((g) => [(g.safeAddress as string).toLowerCase(), g.id]),
  )

  const latest = await publicClient.getBlockNumber()
  const cursor = await db.query.indexCursors.findFirst({
    where: eq(indexCursors.key, CURSOR_KEY),
  })
  let from = cursor
    ? BigInt(cursor.blockNumber) + 1n
    : initialStartBlock(latest)

  // Safe が1つもなければ読むものがないため、カーソルだけ最新まで進める
  if (groupBySafe.size === 0) {
    await saveCursor(db, latest)
    return { scannedTo: null, caughtUp: true, inserted: 0 }
  }

  const safes = [...groupBySafe.keys()].map((a) => getAddress(a) as Address)
  const tokenAddresses = tokens.map((t) => t.address)
  let chunk = CHUNK_BLOCKS
  let inserted = 0
  let scannedTo = from - 1n

  while (from <= latest && Date.now() - startedAt < budgetMs) {
    const to = from + chunk - 1n < latest ? from + chunk - 1n : latest
    let logs: Awaited<ReturnType<typeof fetchTransfers>>
    try {
      logs = await fetchTransfers(tokenAddresses, safes, from, to)
    } catch (e) {
      // 範囲が広すぎて拒まれた可能性があるため、幅を狭めて同じ位置から読み直す
      if (chunk > MIN_CHUNK_BLOCKS) {
        chunk /= 2n
        continue
      }
      throw e
    }

    if (logs.length > 0) {
      const timestamps = await fetchBlockTimestamps(
        logs.map((log) => log.blockNumber),
      )
      const rows = logs.flatMap((log) => {
        const safe = log.args.to.toLowerCase()
        const groupId = groupBySafe.get(safe)
        const timestamp = timestamps.get(log.blockNumber)
        if (!groupId || timestamp === undefined) return []
        return [
          {
            id: `${CHAIN_ID}:${log.transactionHash}:${log.logIndex}`,
            chainId: CHAIN_ID,
            groupId,
            safeAddress: safe,
            token: log.address.toLowerCase(),
            amount: log.args.value.toString(),
            from: log.args.from.toLowerCase(),
            txHash: log.transactionHash,
            logIndex: log.logIndex,
            blockNumber: log.blockNumber.toString(),
            blockTimestamp: new Date(Number(timestamp) * 1000),
          },
        ]
      })
      if (rows.length > 0) {
        // 同じログを二重に取り込んでも1件にする（同時の同期や、カーソル保存前の中断に備える）
        const result = await db
          .insert(deposits)
          .values(rows)
          .onConflictDoNothing()
          .returning({ id: deposits.id })
        inserted += result.length
      }
    }

    // 取り込みを済ませてからカーソルを進め、途中で止まっても取りこぼさないようにする
    await saveCursor(db, to)
    scannedTo = to
    from = to + 1n
  }

  return { scannedTo, caughtUp: scannedTo >= latest, inserted }
}

function initialStartBlock(latest: bigint) {
  const configured = env.DEPOSITS_START_BLOCK
  if (configured && /^\d+$/.test(configured)) return BigInt(configured)
  return latest > DEFAULT_LOOKBACK_BLOCKS
    ? latest - DEFAULT_LOOKBACK_BLOCKS
    : 0n
}

function fetchTransfers(
  tokenAddresses: Address[],
  safes: Address[],
  fromBlock: bigint,
  toBlock: bigint,
) {
  return publicClient.getLogs({
    address: tokenAddresses,
    event: transferEvent,
    args: { to: safes },
    fromBlock,
    toBlock,
    strict: true,
  })
}

// 同じブロックの入金が複数あっても、ブロックは1回だけ読む
async function fetchBlockTimestamps(blockNumbers: bigint[]) {
  const unique = [...new Set(blockNumbers)]
  const blocks = await Promise.all(
    unique.map((blockNumber) => publicClient.getBlock({ blockNumber })),
  )
  return new Map(blocks.map((block) => [block.number, block.timestamp]))
}

// カーソルは戻さない。同時に走った別の同期が先へ進めていても、その位置を保つ
async function saveCursor(db: Db, blockNumber: bigint) {
  await db
    .insert(indexCursors)
    .values({ key: CURSOR_KEY, blockNumber: blockNumber.toString() })
    .onConflictDoUpdate({
      target: indexCursors.key,
      set: {
        blockNumber: sql`greatest(${indexCursors.blockNumber}::numeric, ${blockNumber.toString()}::numeric)::text`,
        updatedAt: new Date(),
      },
    })
}
