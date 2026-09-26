import { findToken } from '@bizzet/contracts'
import { deposits, desc, eq, groups } from '@bizzet/db'
import { error } from '@sveltejs/kit'
import { getAddress } from 'viem'
import { m } from '$lib/paraglide/messages.js'
import { balanceTokens, getBalances } from '$lib/server/balances'
import { syncDeposits } from '$lib/server/deposits'
import { isDeployed } from '$lib/server/safe'
import { canSeeGroup } from '$lib/server/visibility'
import type { PageServerLoad } from './$types'

// ベータ版は Sepolia だけのため、チェーンの表示とエクスプローラーはこの1つに決め打ちする
const EXPLORER_URL = 'https://sepolia.etherscan.io'
// 入金の履歴は新しい順にこの件数まで出す
const DEPOSIT_LIMIT = 100

export const load: PageServerLoad = async ({ locals, params }) => {
  const member = locals.member
  if (!member) error(401)
  const db = locals.db

  // 見られないグループは、存在も分からないよう 404 にする
  if (!(await canSeeGroup(db, member, params.id))) {
    error(404, m.common_error_not_found())
  }
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, params.id),
  })
  if (!group) error(404, m.common_error_not_found())

  // 入金の履歴を出す前に、取り込みを時間の上限つきで進める。失敗しても表示は止めない
  await syncDeposits(db).catch((e) => {
    console.error('入金の取り込みに失敗しました', e)
  })

  const safeAddress = group.safeAddress ? getAddress(group.safeAddress) : null
  const [balanceResult, deployed, history] = await Promise.all([
    safeAddress ? loadBalances(safeAddress) : Promise.resolve(undefined),
    safeAddress
      ? loadDeployed(safeAddress, group.safeDeployedAt !== null)
      : Promise.resolve(null),
    db.query.deposits.findMany({
      where: eq(deposits.groupId, group.id),
      orderBy: [desc(deposits.blockTimestamp), desc(deposits.logIndex)],
      limit: DEPOSIT_LIMIT,
    }),
  ])

  return {
    pageTitle: group.name,
    isOwner: member.role === 'owner',
    group: {
      id: group.id,
      name: group.name,
      kind: group.kind,
      safeAddress,
      safeUrl: safeAddress ? `${EXPLORER_URL}/address/${safeAddress}` : null,
      // true：配置済み、false：未配置、null：チェーンに確認できなかった
      deployed,
    },
    // undefined：Safe が未設定、null：RPC の失敗で読めなかった
    balances:
      balanceResult === undefined
        ? undefined
        : balanceResult === null
          ? null
          : balanceTokens.map((t) => ({
              ...t,
              amount: balanceResult[t.symbol]?.toString() ?? null,
            })),
    depositLimit: DEPOSIT_LIMIT,
    deposits: history.map((d) => {
      const token = findToken(d.token)
      return {
        id: d.id,
        blockTimestamp: d.blockTimestamp.toISOString(),
        amount: d.amount,
        symbol: token?.symbol ?? d.token,
        decimals: token?.decimals ?? 0,
        from: d.from,
        fromUrl: `${EXPLORER_URL}/address/${d.from}`,
        txHash: d.txHash,
        txUrl: `${EXPLORER_URL}/tx/${d.txHash}`,
      }
    }),
  }
}

async function loadBalances(safeAddress: string) {
  try {
    const balances = await getBalances([safeAddress])
    return balances.get(safeAddress.toLowerCase()) ?? null
  } catch (e) {
    console.error('残高の取得に失敗しました', e)
    return null
  }
}

// 配置済みの記録があればそれを信じ、なければチェーンのコードの有無で確かめる。
// 中継用アカウントが配置しても記録の更新が遅れる場合があるため
async function loadDeployed(
  safeAddress: `0x${string}`,
  recorded: boolean,
): Promise<boolean | null> {
  if (recorded) return true
  try {
    return await isDeployed(safeAddress)
  } catch (e) {
    console.error('Safe の配置の確認に失敗しました', e)
    return null
  }
}
