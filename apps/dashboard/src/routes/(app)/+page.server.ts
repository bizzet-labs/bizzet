import { and, count, eq, inArray, safeTransactions } from '@bizzet/db'
import { error } from '@sveltejs/kit'
import { m } from '$lib/paraglide/messages.js'
import { balanceTokens, getBalances } from '$lib/server/balances'
import { syncDeposits } from '$lib/server/deposits'
import { getVisibleGroups } from '$lib/server/visibility'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const member = locals.member
  if (!member) error(401)
  const db = locals.db

  // 入金の取り込みを時間の上限つきで進める。失敗してもホームの表示は止めない
  await syncDeposits(db).catch((e) => {
    console.error('入金の取り込みに失敗しました', e)
  })

  const groups = await getVisibleGroups(db, member)
  const safeAddresses = groups.flatMap((g) =>
    g.safeAddress ? [g.safeAddress] : [],
  )

  // 残高はチェーンから直接読む。RPC が失敗したら残高を出さず、エラーの表示に切り替える
  let balances: Awaited<ReturnType<typeof getBalances>> | null
  try {
    balances = await getBalances(safeAddresses)
  } catch (e) {
    console.error('残高の取得に失敗しました', e)
    balances = null
  }

  const rows = groups.map((group) => {
    const own = group.safeAddress
      ? balances?.get(group.safeAddress.toLowerCase())
      : undefined
    return {
      id: group.id,
      name: group.name,
      kind: group.kind,
      safeAddress: group.safeAddress,
      // 通貨ごとの残高（最小単位の文字列）。Safe が未設定か、読めなかった通貨は null
      balances: Object.fromEntries(
        balanceTokens.map((t) => [
          t.symbol,
          own?.[t.symbol]?.toString() ?? null,
        ]),
      ) as Record<string, string | null>,
    }
  })

  // 見られるグループの合計。1つでも読めない残高があれば、誤った合計を出さないよう null にする
  const totals = balanceTokens.map((token) => {
    const configured = rows.filter((r) => r.safeAddress)
    const values = configured.map((r) => r.balances[token.symbol])
    const complete = balances !== null && values.every((v) => v !== null)
    return {
      ...token,
      amount: complete
        ? values.reduce((sum, v) => sum + BigInt(v as string), 0n).toString()
        : null,
    }
  })

  // 承認待ちの出金（送信前の提案）の件数。出金を扱えるのは Owner と Approver だけ
  let pendingCount: number | null = null
  if (member.role !== 'viewer' && groups.length > 0) {
    const [row] = await db
      .select({ value: count() })
      .from(safeTransactions)
      .where(
        and(
          eq(safeTransactions.status, 'open'),
          inArray(
            safeTransactions.groupId,
            groups.map((g) => g.id),
          ),
        ),
      )
    pendingCount = row?.value ?? 0
  }

  return {
    pageTitle: m.common_nav_home(),
    isOwner: member.role === 'owner',
    tokens: balanceTokens,
    groups: rows,
    totals,
    balanceError: balances === null,
    pendingCount,
  }
}
