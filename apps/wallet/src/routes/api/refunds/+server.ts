import { tokens } from '@bizzet/contracts'
import { json } from '@sveltejs/kit'
import { requireMember } from '$lib/server/member'
import {
  getRequiredApprovals,
  listRefunds,
  MEMO_MAX_LENGTH,
} from '$lib/server/refunds'
import type { RequestHandler } from './$types'

// 返金（WS-04）に出す、店舗の出金の提案と申請に要る情報。返金を申請できるのは店舗のメンバーだけ
export const POST: RequestHandler = async ({ locals }) => {
  const { group } = await requireMember(locals)
  const isStore = group.kind === 'store'
  return json({
    group: {
      name: group.name,
      kind: group.kind,
      hasSafe: group.safeAddress !== null,
    },
    canRequest: isStore && group.safeAddress !== null,
    tokens: tokens.map((t) => ({ symbol: t.symbol, decimals: t.decimals })),
    memoMaxLength: MEMO_MAX_LENGTH,
    requiredApprovals: await getRequiredApprovals(locals.db),
    refunds: isStore ? await listRefunds(locals.db, group) : [],
  })
}
