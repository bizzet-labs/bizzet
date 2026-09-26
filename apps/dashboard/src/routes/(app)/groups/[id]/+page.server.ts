import { findToken } from '@bizzet/contracts'
import { deposits, desc, eq } from '@bizzet/db'
import { getAddress } from 'viem'
import { explorerAddressUrl, explorerTxUrl } from '$lib/explorer'
import { balanceTokens, getBalances } from '$lib/server/balances'
import { syncDeposits } from '$lib/server/deposits'
import { getEnsSettings, resolveGroupEns } from '$lib/server/ens'
import { requireMember, requireVisibleGroup } from '$lib/server/guards'
import { isDeployed } from '$lib/server/safe'
import type { PageServerLoad } from './$types'

// 入金の履歴は新しい順にこの件数まで出す
const DEPOSIT_LIMIT = 100

export const load: PageServerLoad = async ({ locals, params }) => {
  const member = requireMember(locals.member)
  const db = locals.db
  const group = await requireVisibleGroup(db, member, params.id)

  // 入金の履歴を出す前に、取り込みを時間の上限つきで進める。失敗しても表示は止めない
  await syncDeposits(db).catch((e) => {
    console.error('入金の取り込みに失敗しました', e)
  })

  const safeAddress = group.safeAddress ? getAddress(group.safeAddress) : null
  const [balanceResult, deployed, history, ens] = await Promise.all([
    safeAddress ? loadBalances(safeAddress) : Promise.resolve(undefined),
    safeAddress
      ? loadDeployed(safeAddress, group.safeDeployedAt !== null)
      : Promise.resolve(null),
    db.query.deposits.findMany({
      where: eq(deposits.groupId, group.id),
      orderBy: [desc(deposits.blockTimestamp), desc(deposits.logIndex)],
      limit: DEPOSIT_LIMIT,
    }),
    getEnsSettings(db).then((settings) => resolveGroupEns(group, settings)),
  ])

  return {
    pageTitle: group.name,
    isOwner: member.role === 'owner',
    group: {
      id: group.id,
      name: group.name,
      kind: group.kind,
      safeAddress,
      safeUrl: safeAddress ? explorerAddressUrl(safeAddress) : null,
      // true：配置済み、false：未配置、null：チェーンに確認できなかった
      deployed,
    },
    // ENS の名前がなければ null。表示する値は Universal Resolver で解決したもの
    ens,
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
        fromUrl: explorerAddressUrl(d.from),
        txHash: d.txHash,
        txUrl: explorerTxUrl(d.txHash),
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
// 設定画面を開く前に配置された場合など、記録がまだ付いていないことがあるため
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
