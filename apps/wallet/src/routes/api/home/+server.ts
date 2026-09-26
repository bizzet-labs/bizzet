import { tokens } from '@bizzet/contracts'
import { json } from '@sveltejs/kit'
import { listApprovals } from '$lib/server/approvals'
import { getBalances, type TokenBalances } from '$lib/server/balances'
import {
  findMemberByPasskey,
  getVisibleGroups,
  isHeadquartersSigner,
} from '$lib/server/member'
import type { RequestHandler } from './$types'

// ホーム（WS-02）に出す、見られるグループの残高と、自分の署名を待っている提案の件数
export const POST: RequestHandler = async ({ locals, request }) => {
  const { passkeyId } = (await request.json()) as { passkeyId?: unknown }
  const { member, passkey, group } = await findMemberByPasskey(
    locals.db,
    passkeyId,
  )
  const visible = await getVisibleGroups(locals.db, group)
  const addresses = visible.flatMap((g) =>
    g.safeAddress ? [g.safeAddress] : [],
  )
  // 残高を読めなくても、グループと件数は出す
  let balances: Map<string, TokenBalances> | null
  try {
    balances = await getBalances(addresses)
  } catch (e) {
    console.error(e)
    balances = null
  }
  const approvals = await listApprovals(locals.db, member, group, passkey)
  return json({
    member: { name: member.name, email: member.email, role: member.role },
    tokens: tokens.map((t) => ({ symbol: t.symbol, decimals: t.decimals })),
    balancesError: balances === null,
    groups: visible.map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind,
      safeAddress: g.safeAddress,
      balances: g.safeAddress
        ? (balances?.get(g.safeAddress.toLowerCase()) ?? null)
        : null,
    })),
    pendingCount: approvals.filter((a) => a.unsignable === null).length,
    canSign: isHeadquartersSigner(member, group),
  })
}
